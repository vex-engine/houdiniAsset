# HTML Presentation Engine — 시작 가이드 (v2.1)

---

## 🚀 빠른 시작

### 1단계: `서버시작.bat` 더블클릭
- cmd 창이 열리고 서버가 뜸
- **브라우저가 자동으로 `http://localhost:3000` 열림**
- 프레젠테이션 목록 페이지가 나타남

### 2단계: 작업할 프레젠테이션 클릭
- 목록에서 HTML 클릭 → 해당 프레젠테이션으로 이동
- `E` 키 → 에디터 모드

### 3단계: 편집
- 슬라이드 수정, 이미지/영상 추가 등
- `Ctrl+S` → **현재 파일 덮어쓰기** 저장

### 4단계: Export (다른 PC로 가져갈 때)
1. 에디터 모드에서 **Export** 버튼 클릭 (또는 `Ctrl+Shift+S`)
2. **Windows 폴더 선택 다이얼로그** 뜸 → 원하는 위치 선택 (빈 폴더 권장)
3. 파일명 확인/수정 → 확인
4. HTML + 모든 미디어가 그 폴더에 **flat 복사**
5. 완료 후 그 폴더를 압축/USB 복사 → 다른 PC에서 HTML 더블클릭

---

## ⚠️ 중요 규칙

### ❌ 이러면 안 됨
- HTML 파일을 **직접 더블클릭**해서 `file://` 로 여는 것 → Export/Save 안 됨
- `서버시작.bat` 꺼두고 작업 → Save/Export 전부 실패
- Export 대상 폴더로 **이미 파일이 있는 폴더** 선택 (덮어쓰기 경고)

### ✅ 이래야 함
- 항상 `http://localhost:3000` 에서 열기 (bat 실행 시 자동으로 열림)
- `서버시작.bat` cmd 창은 작업 중 켜둘 것
- Export는 **빈 폴더** 또는 새로 만든 폴더에 (예: `C:\presentations\2026-04-25\`)

---

## 📁 Export 결과물

```
지정한폴더/
├── my_deck.html             ← HTML 하나만 더블클릭하면 작동
├── demo_grok.mp4            ← 영상 복사본
├── demo_project01.mp4
├── img01.png                ← 이미지 복사본
├── img02.jpg
└── _export_manifest.json    ← 복사 기록 (누락/경고 포함)
```

- **Flat 구조**: 모든 파일이 한 폴더에 평평하게
- **뷰어 전용**: editor.js 제거됨 — 편집은 원본에서만
- **폰트 임베드**: Google Fonts base64 → 인터넷 없이도 한글 정상
- **완전 이식**: 다른 PC의 어느 경로(`C:\temp`, `D:\pre`, USB 등)에 둬도 작동

### Export 직후 확인할 것
- `_export_manifest.json` 열어서 `missing` 배열이 **비어있어야** 완벽한 Export
- `warnings` 배열도 **비어있어야** 함
- 뭐가 있으면 원본 HTML에서 경로가 잘못된 미디어가 있다는 뜻 → 재-Export

---

## 🔑 단축키

| 키 | 기능 |
|---|---|
| `E` | 에디터 모드 토글 |
| `←` `→` | 슬라이드 이동 |
| `Space` | 빌드 스텝 진행 |
| `F` | 전체화면 |
| `Ctrl+S` | Save (현재 파일 덮어쓰기) |
| `Ctrl+Shift+S` | Export (폴더 선택 → flat 복사) |
| `G` | 그리드 토글 |

---

## Save vs Save As vs Export

| 기능 | 용도 | 결과 | 다른 PC 가능? |
|---|---|---|---|
| **Save** (Ctrl+S) | 현재 파일 덮어쓰기 | HTML 수정 | ❌ (에디터 의존) |
| **Save As** | 로컬 백업 복사 | HTML 1개 | ❌ (미디어 누락) |
| **Export** (Ctrl+Shift+S) | 🌍 다른 PC 이식 | HTML + 미디어 flat 폴더 | ✅ |

**🔥 현장 발표용은 무조건 Export. Save As는 형 PC 안 백업 용도만.**

---

## 📂 폴더 구조

```
├── 00_START.md                  ← 지금 이 파일
├── index.html                   ← 랜딩 페이지 (http://localhost:3000/)
├── 서버시작.bat                 ← Save/Export 서버 실행 (먼저 실행!)
├── 새프레젠테이션.bat            ← 새 브리프 생성
├── save-server.js               ← Node.js 서버
├── new-presentation.js
├── presentations/               ← 프레젠테이션 작업 공간
├── engine/                      ← 엔진 코어
│   ├── engine.css, presentation.js, editor.js
│   ├── template.html            ← 새 프레젠테이션 원본
│   ├── EDITOR_DEV.md            ← 에디터 개발 레퍼런스
│   └── EXPORT_CONTRACT.md       ← Export 자립성 계약 (수정 전 필독)
├── samples/
└── 에러이슈노트.md
```

---

## 🆘 문제 해결

### "file:// 에서 Export 불가" 경고
→ HTML을 직접 더블클릭한 상태입니다. `서버시작.bat` 실행 후 자동으로 열리는 브라우저 창에서 다시 접근하세요.

### "서버 연결 실패"
→ `서버시작.bat` cmd 창이 꺼져있거나, 3000/3001 포트가 다른 프로세스에 점유됨. cmd 창 확인하고 재실행.

### Export 후 영상/이미지 안 나옴
1. `_export_manifest.json` 열기 → `missing` 배열 확인
2. 원본 프레젠테이션 HTML에서 해당 파일 경로가 실제 존재하는지 확인
3. 경로 고치고 재-Export

### 한글 폰트 깨짐
→ Export 시점에 인터넷이 있어야 Google Fonts가 base64로 임베드됩니다. 인터넷 연결 후 재-Export.

### 브라우저가 폴더 선택 다이얼로그 못 띄움
→ Chrome 또는 Edge 최신 버전 사용. Firefox는 File System Access API 미지원.

### 포트 3000/3001이 이미 사용 중
→ 기존 `서버시작.bat` cmd 창 닫기. 또는 작업 관리자에서 기존 node.exe 종료.

---

## 📚 엔지니어 문서

- `engine/EDITOR_DEV.md` — 에디터 내부 구조
- `engine/EXPORT_CONTRACT.md` — **Export 자립성 계약 (엔진 수정 전 반드시 읽을 것)**
- `에러이슈노트.md` — 과거 트러블슈팅 기록
