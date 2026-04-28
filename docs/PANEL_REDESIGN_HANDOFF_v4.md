# 오른쪽 패널 재설계 — 인수인계 v4
작성일: 2026-04-24 후속
대상: F:\Claude\PPTX 프로젝트
목적: 패널 컨텍스트 전환 리팩토링 **이후 남은 이슈** 정리 + 다음 세션 연속 작업용

## 0. 현재 상태 (한 줄)
**핵심 리팩토링은 완료.** 선택 대상에 따라 오른쪽 패널이 none/text/image/video/multi 5가지 컨텍스트로 전환됨. 영상 패널에 재생/자동재생/반복/음소거 4버튼. 드래그 이동(alt 없이도) 작동. pointer-events 수정도 방금 완료.

## 1. 완료된 작업 (이번 세션)

### 구조 변경
- `engine/panel-context.js` **신규** (242라인). IIFE. `window.PanelCtx.refresh(el, selBlocks, selBlock)` 노출. 선택 대상별 5개 컨텍스트 렌더.
- `engine/editor.js` `_setSel(el)` 끝에 `PanelCtx.refresh(el, selBlocks, selBlock)` 1줄. editor.js의 sel/selBlock/selBlocks는 IIFE 내부라 window에 안 보임 → 인자 전달이 필수.
- HTML 5개 파일에 `<script src=".../panel-context.js">` 추가: `engine/template.html`, `presentations/claude_for_beginners/claude_for_beginners.html`, `presentations/prompt_engineering/japan.html`, `presentations/prompt_engineering/prompt_engineering.html`, `presentations/미드저니_나노바나나_그록_활용/미드저니_나노바나나_그록_활용.html`.

### editor.js 수정 요약 (2611 → 2668라인)
- `_setSel` 끝에 PanelCtx.refresh 호출 (1줄)
- `startMoveDrag` — media-wrap 최초 이동 시 transform→px 변환 추가 (점핑 방지)
- mousedown 핸들러 "media wrap" 분기 — setBlockState + showBar + startMoveDrag (alt 없이 그냥 드래그로 이동 가능)
- 영상 토글 4함수 (`toggleVideoPlay`/`toggleVideoAutoplay`/`toggleVideoLoop`/`toggleVideoMute`) — 재생 중에도 즉시 반영. attribute까지 동기화. `EA.toggleVideoPlay` 신규 노출.
- `_syncVideoButtons` — edBtnPlay 포함 4버튼 상태 실시간 동기화
- dblclick 핸들러 — media-wrap 더블클릭 시 PanelCtx.refresh 강제 호출 + setBlockState + showBar. 재생 중 포커스 꼬임 대비.
- `showSlideCtxMenu` — 원본 초기화 메뉴 항목 (이전 세션에서 이미 완료)
- `resetSlide(idx)` — 시그니처 확장 (이전 세션)

### CSS 수정 (engine.css 218~219라인)
- `.ed-media-wrap video, .ed-media-wrap iframe { pointer-events: auto }` — edit 모드에서도 비디오 기본 컨트롤(재생/음소거/전체화면/시간) 작동하도록. 이전엔 `body:not(.editor-mode)` 조건이 걸려있어 edit 모드에서 비디오 컨트롤이 클릭 안 됐음.

### 문서
- `에러이슈노트.md` — "미디어 드래그 점핑 재발 주의" 섹션 추가 (188→232라인). 핵심 교훈: startDrag / startMoveDrag 두 벌 있어서 한쪽만 고치면 재발.

### 백업 파일 (롤백 가능)
```
engine/editor.js.before_setsel.bak         (Step 3 직전)
engine/editor.js.before_scope_fix.bak       (버그1 수정 직전)
engine/editor.js.before_media_drag.bak      (드래그 수정 직전)
engine/editor.js.before_video_ctrl.bak      (영상 컨트롤 수정 직전)
engine/editor.js.before_dblclick.bak        (dblclick 수정 직전)
engine/panel-context.js.before_scope_fix.bak
engine/panel-context.js.before_video_ctrl.bak
engine/engine.css.before_video_pe.bak       (방금 pointer-events 수정 직전)
backup/panel_v2_before_20260424_030919/     (세션 시작 전 전체 백업)
```

## 2. 남은 이슈 (다음 세션 우선순위)

### 우선순위 A — 미완료
- [ ] **CSS pointer-events 수정 브라우저 검증**. 방금 `.ed-media-wrap video { pointer-events: auto }` 로 바꿨음. Ctrl+Shift+R 새로고침 후 edit 모드에서 영상 재생/음소거/전체화면 직접 작동하는지 확인. **이거 결과부터 받아서 다음 단계 결정.**
- [ ] 만약 **드래그 이동과 비디오 컨트롤 클릭이 충돌**하면 (예: 비디오 바디 클릭이 재생토글로 먹혀서 드래그가 안 됨) → 드래그는 **테두리(outline 영역) 전용**으로 바꾸거나 alt+드래그만 허용하는 쪽으로 역행 필요.

### 우선순위 B — Step 4 (보류 중)
- [ ] **인라인 export 3개 파일에 panel-context.js 임베드**
  - `presentations/prompt_engineering/prompt_engineering_origin.html`
  - `presentations/prompt_engineeringv02/prompt_lecture.html`
  - `presentations/prompt_engineeringv02/prompt_lecture_original.html`
  - 이 3개는 self-contained export라 `<script src>` 가 아니라 editor.js가 인라인 임베드됨.
  - 방안 (A): `save-server.js` export 로직 수정해서 앞으로 export할 때 panel-context.js도 인라인 포함 (근본 해결)
  - 방안 (B): 현재 3개 파일에 직접 `<script>` 태그로 panel-context.js 내용 임베드 (임시)
  - **방안 A 추천**. save-server.js `/export` 엔드포인트 찾아서 editor.js 임베드하는 부분 옆에 panel-context.js도 추가.

### 우선순위 C — 낮음
- [ ] 다중 선택(shift+클릭) 상태에서 정렬 버튼이 1개 요소만 정렬하는 문제. `EA.alignEl`이 `selBlocks`를 순회 안 함. 이건 **원래 editor.js 동작**이고 이번 리팩토링과 무관. editor.js alignEl 함수를 `selBlocks.length>1 ? selBlocks.forEach : sel` 패턴으로 개선하면 됨.

## 3. 아키텍처 요약 (다음 세션 Claude가 빠르게 이해용)

```
[사용자 클릭]
      ↓
editor.js mousedown 핸들러
      ↓
_setSel(el)  ← sel/selBlock/selBlocks 갱신
      ↓
PanelCtx.refresh(el, selBlocks, selBlock)  ← 인자 전달 필수
      ↓
panel-context.js detectContext → render  ← 아래 5개 중 하나
      ↓
<aside class="ed-panel"> innerHTML 교체
```

컨텍스트 5개:
- `none`  : 빈 곳 클릭 — 미디어 삽입 / 슬라이드 배경 / Grid / 블럭 추가 / 단축키
- `text`  : 텍스트·일반 블럭 — 📝 + 애니 + 정렬 + 레이어 + 복제/삭제
- `image` : 이미지 (media-wrap > img) — 🖼 + 애니 + 정렬 + 레이어 + 복제/삭제
- `video` : 영상 (media-wrap > video/iframe) — 🎬 + 재생/자동재생/반복/음소거 + 애니 + 정렬 + 레이어 + 복제/삭제
- `multi` : shift+클릭 2개 이상 — ⊟ + 정렬 + 레이어 + 복제/삭제

## 4. 절대 규칙 (이번 세션에서 배운 것)

### Edit 툴 금지
`Edit` 툴이 HTML/JS 큰 파일 수정 시 **파일 끝을 잘라먹는 심각한 버그** 있음. 이번 세션에서 HTML 5개 파일 전부 `<script src="editor.js">` 줄부터 `</body></html>`까지 날려먹음. **editor.js, panel-context.js, HTML 파일 수정은 무조건 bash + sed 또는 Python 스크립트로.**

### 대체 방법
- 단순 치환: bash `sed -i 's|old|new|'`
- 복잡한 치환: Python `data.replace(old, new, 1)` with `assert data.count(old)==1`
- 한글 들어간 문자열은 Python `str` 사용. `bytes`는 ASCII만 되므로 에러.

### 매 변경 후 검증 3종
```bash
python3 -c "print(open('FILE','rb').read().count(b'\x00'))"  # 0이어야 함
wc -l FILE                                                    # 예상 라인 수 ±1 이내
cp FILE /tmp/c.js && node -c /tmp/c.js                        # JS면 문법 OK
```

## 5. 스코프 함정 (잊지 말 것)
- editor.js는 `(()=>{...})()`  IIFE로 감싸짐
- 내부 `let sel`, `let selBlock`, `let selBlocks` 는 **window에 안 보임**
- 그래서 panel-context.js가 `window.sel`로 읽으면 항상 undefined → 'none' 렌더
- **반드시 editor.js가 호출 시 인자로 넘겨줘야 함**: `PanelCtx.refresh(el, selBlocks, selBlock)`
- panel-context.js refresh는 **인자 없이 호출되면 render 생략** (보조 리스너가 실제 상태 덮어쓰는 버그 방지)

## 6. 이번 세션에서 만든 버그와 해결 (같은 버그 재발 방지)

### 버그1: Edit 툴이 HTML 5개 전부 손상
- 증상: `<script src="editor.js">` + `</body></html>` 삭제됨, `<script s` 에서 잘림
- 해결: 백업에서 cp로 복원 → bash sed로 재처리

### 버그2: 모든 컨텍스트가 'none'으로만 표시
- 증상: 선택해도 패널 안 바뀜
- 원인: panel-context의 mouseup/click 리스너가 인자 없이 `refresh()` 호출 → IIFE 스코프 문제 → 항상 'none' 으로 덮어씀
- 해결: `refresh(arguments.length===0 ? return : normal)`, `bindListeners`는 no-op으로

### 버그3: alt+드래그 시 이미지/영상 점핑
- 증상: 최초 이동 시 화면 바깥으로 순간이동
- 원인: `startMoveDrag`에서 media-wrap의 `transform: translate(-50%,-50%)` 해제 로직 누락 → oL/oT가 0으로 잡힘
- 해결: `initial.map` 안에서 media-wrap이면 getBoundingClientRect로 px 좌표 계산 후 transform='none'
- **재발 주의**: `startDrag` 와 `startMoveDrag` 두 경로. 드래그 핸들러 새로 만들 때 반드시 같은 변환 로직 넣을 것.

### 버그4: 영상 위 HTML 컨트롤 클릭 안 됨 (방금 수정)
- 증상: edit 모드에서 영상 재생 중 재생/음소거/전체화면 버튼 안 먹음
- 원인: `.ed-media-wrap video { pointer-events: none }` — body:not(.editor-mode) 조건 때문에 edit 모드에서만 none
- 해결: 조건 제거, edit 모드에서도 video/iframe에 pointer-events: auto
- **확인 필요**: 드래그 이동과 충돌하는지 다음 세션에서 테스트

## 7. 즉시 실행 명령어 (다음 세션 시작 시)

### 현재 상태 검증
```bash
cd F:\Claude\PPTX  (또는 리눅스 경로 /sessions/.../mnt/PPTX)

# editor.js 상태
wc -l engine/editor.js                    # → 2668 기대
python3 -c "print(open('engine/editor.js','rb').read().count(b'\x00'))"  # → 0
cp engine/editor.js /tmp/c.js && node -c /tmp/c.js

# panel-context.js
wc -l engine/panel-context.js             # → 242 기대
cp engine/panel-context.js /tmp/c.js && node -c /tmp/c.js

# HTML 5개 script 순서
for f in engine/template.html presentations/claude_for_beginners/claude_for_beginners.html presentations/prompt_engineering/japan.html presentations/prompt_engineering/prompt_engineering.html "presentations/미드저니_나노바나나_그록_활용/미드저니_나노바나나_그록_활용.html"; do
  grep -c "panel-context.js" "$f"        # → 1 이어야 함
done
```

### 롤백 필요 시
```bash
# editor.js 만 되돌리기
cp engine/editor.js.before_dblclick.bak engine/editor.js    # 가장 최신 단계 되돌림
# 또는 더 이전으로
cp engine/editor.js.before_video_ctrl.bak engine/editor.js
# 전체 원점으로
cp -r backup/panel_v2_before_20260424_030919/* .
```

## 8. 사용자(형) 스타일 메모
- 한국어. "ㄱㄱ", "시작해", "수정해" → 바로 실행
- "고민이야", "어떻게" → 소크라테스 모드 (질문으로 유도)
- **말 많은 거 싫어함**. 응답 짧게. 옵션 A/B/C 나열 금지. 하나만 판단해서 진행.
- 이번 세션 후반에 "물어보는 거 왜 이렇게 많냐" 강하게 지적함. 다음 세션 Claude는 **기본 실행 모드**로.
- 파일 첨부 + "이렇게 해줘" = 바로 실행. 추가 확인 불필요.
- 동작 안 하는 결과물에 매우 민감. edit 모드 깨지면 신뢰 즉시 잃음.

## 9. 한 줄 요약 (다시)
pointer-events 수정 검증 → 문제 없으면 Step 4(인라인 export 3개) → 있으면 드래그/비디오 컨트롤 충돌 해결.
