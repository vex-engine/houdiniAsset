// ============================================================
//  새 프레젠테이션 브리프 생성기
//  - 대화형 질문 5개로 _brief.md 파일 생성
//  - Claude에 전달할 지시문을 클립보드에 자동 복사
// ============================================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PRESENTATIONS_DIR = path.join(ROOT, 'presentations');

// ---------- 유틸 ----------
// readline을 line 이벤트 방식으로 구성 (파이프/TTY 양쪽 호환)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});
const _pending = [];
let _answered = null;
rl.on('line', (line) => {
  if (_answered) {
    const fn = _answered;
    _answered = null;
    fn(line.trim());
  } else {
    _pending.push(line.trim());
  }
});
const ask = (q) =>
  new Promise((resolve) => {
    process.stdout.write(q);
    if (_pending.length > 0) {
      resolve(_pending.shift());
    } else {
      _answered = resolve;
    }
  });

function slugify(str) {
  // 한글/공백/특수문자 → 안전한 폴더명으로
  // 영문+숫자는 살리고, 나머지는 언더스코어
  const ascii = str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\uAC00-\uD7A3가-힣]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
  return ascii || `presentation_${Date.now()}`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function copyToClipboard(text) {
  // Windows clip.exe 사용
  return new Promise((resolve) => {
    const clip = spawn('clip');
    clip.stdin.write(text);
    clip.stdin.end();
    clip.on('close', () => resolve(true));
    clip.on('error', () => resolve(false));
  });
}

// ---------- 메인 ----------
async function main() {
  console.log('');
  console.log('  ==========================================');
  console.log('   새 프레젠테이션 브리프 생성');
  console.log('  ==========================================');
  console.log('');

  // [1] 주제
  const topic = await ask('  [1/5] 프레젠테이션 주제: ');
  if (!topic) {
    console.log('\n  ! 주제가 비어있어 종료합니다.\n');
    rl.close();
    return;
  }

  // [2] 청중
  const audience = await ask('  [2/5] 대상 청중 (예: 개발자 신입, 비전공자 일반인): ');

  // [3] 시간
  const durationRaw = await ask('  [3/5] 총 강의 시간(분): ');
  const duration = parseInt(durationRaw, 10) || 0;

  // [4] 톤
  console.log('');
  console.log('    톤 선택지: 1) 강의형  2) 세미나형  3) 워크숍형  4) 라이트닝톡');
  const toneRaw = await ask('  [4/5] 발표 톤 (숫자 또는 직접입력): ');
  const toneMap = { 1: '강의형', 2: '세미나형', 3: '워크숍형', 4: '라이트닝톡' };
  const tone = toneMap[toneRaw] || toneRaw || '강의형';

  // [5] 참고자료
  console.log('');
  const refPath = await ask('  [5/5] 참고 md 파일 경로 (없으면 Enter): ');
  const hasRef = refPath && refPath.length > 0;
  let refExists = false;
  if (hasRef) {
    const abs = path.isAbsolute(refPath) ? refPath : path.join(ROOT, refPath);
    refExists = fs.existsSync(abs);
    if (!refExists) {
      console.log(`  ! 경고: 경로에서 파일을 찾지 못했습니다 → ${abs}`);
      console.log('  ! 브리프에는 기록하되, Claude가 확인하도록 표시해둡니다.');
    }
  }

  // ---------- 폴더 생성 ----------
  const slug = slugify(topic);
  const folder = path.join(PRESENTATIONS_DIR, slug);

  if (!fs.existsSync(PRESENTATIONS_DIR)) {
    fs.mkdirSync(PRESENTATIONS_DIR, { recursive: true });
  }

  // 이미 폴더가 있으면 번호 붙이기
  let finalFolder = folder;
  let finalSlug = slug;
  let n = 2;
  while (fs.existsSync(finalFolder)) {
    finalSlug = `${slug}_v${n}`;
    finalFolder = path.join(PRESENTATIONS_DIR, finalSlug);
    n++;
  }
  fs.mkdirSync(finalFolder, { recursive: true });

  // ---------- _brief.md 작성 ----------
  const brief = `# 프레젠테이션 브리프

- 생성일: ${nowStamp()}
- 폴더: presentations/${finalSlug}/

## 입력값

| 항목 | 내용 |
|------|------|
| 주제 | ${topic} |
| 청중 | ${audience || '(미지정)'} |
| 시간 | ${duration ? duration + '분' : '(미지정)'} |
| 톤 | ${tone} |
| 참고자료 | ${hasRef ? refPath + (refExists ? '' : ' (⚠ 파일 없음)') : '없음 → 자동 생성'} |

## Claude 작업 지시

1. \`engine/template.html\`을 복사해서 \`presentations/${finalSlug}/${finalSlug}.html\` 로 시작한다.
2. 위 입력값을 기준으로 **먼저 목차(제안 슬라이드 수 포함)를 제시**하고 사용자 확인을 받는다.
3. 참고자료가 "없음"이면 주제 기반으로 **자동 리서치 + 초안 생성**.
4. 참고자료가 있으면 **해당 md 내용 기반**으로 슬라이드 구성.
5. 엔진 규칙 준수: \`engine/EDITOR_DEV.md\`의 "핵심 설계 원칙" 반드시 따를 것.
   - 미디어는 \`.ed-media-wrap\` 으로 감싸고 \`position:absolute\`
   - 인라인 스타일 유지 (\`position:relative\` 강제 패턴)
   - base64/blob 금지, 파일 참조만

## 슬라이드 밀도 가이드 (Claude 참고)

- 강의형: 약 ${Math.max(1, Math.round(duration / 2))}장 기준 (2분/장)
- 세미나형: 약 ${Math.max(1, Math.round(duration / 3))}장 (3분/장, 토론 여유)
- 워크숍형: 약 ${Math.max(1, Math.round(duration / 5))}장 + 실습 블록 (5분/장)
- 라이트닝톡: 약 ${Math.max(1, Math.round(duration / 0.5))}장 (30초/장, 빠른 전환)

현재 선택: **${tone}** → 예상 슬라이드 수는 위 공식으로 제안, 사용자 확인 후 확정.
`;

  const briefPath = path.join(finalFolder, '_brief.md');
  fs.writeFileSync(briefPath, brief, 'utf8');

  // ---------- Claude 지시문 (클립보드) ----------
  const claudeInstruction = `presentations/${finalSlug}/_brief.md 읽고 슬라이드 만들어줘. 먼저 목차랑 예상 슬라이드 수 제안하고 내 확인 받은 다음에 HTML 생성해.`;

  const clipOk = await copyToClipboard(claudeInstruction);

  // ---------- 결과 출력 ----------
  console.log('');
  console.log('  ==========================================');
  console.log('   ✓ 브리프 생성 완료');
  console.log('  ==========================================');
  console.log('');
  console.log(`   파일: presentations/${finalSlug}/_brief.md`);
  console.log('');
  if (clipOk) {
    console.log('   ✓ Claude 지시문이 클립보드에 복사되었습니다.');
    console.log('     → Claude 창에서 Ctrl+V 로 붙여넣기');
  } else {
    console.log('   ! 클립보드 복사 실패. 아래 문장을 직접 복사해 사용하세요:');
  }
  console.log('');
  console.log('   --------------------------------------------');
  console.log(`   ${claudeInstruction}`);
  console.log('   --------------------------------------------');
  console.log('');

  rl.close();
}

main().catch((err) => {
  console.error('\n  ! 오류 발생:', err.message);
  rl.close();
  process.exit(1);
});
