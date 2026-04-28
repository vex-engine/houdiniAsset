# Export Contract — 자립성 계약 (v2.0)

> **이 문서는 Export 자립성을 보장하는 계약이다.**
> 엔진 코드를 수정할 때마다 이 문서의 원칙을 위반하지 않는지 반드시 확인하라.
> 이 문서를 위반하는 PR은 머지 금지.

---

## 🎯 Export의 단 하나의 목적

**Export된 폴더를 USB에 담아 어느 PC로 옮겨도,
인터넷 없이, 서버 없이, 그냥 HTML 파일 하나 더블클릭하면 완벽하게 작동한다.**

이 목적을 훼손하는 어떤 변경도 허용하지 않는다.

---

## 📐 불가침 원칙 (절대 어기면 안 됨)

### P1. Flat 폴더 구조
Export 결과물은 **단일 폴더에 평평하게** 들어간다. 하위 폴더 금지.

```
target/
├── presentation.html
├── demo_grok.mp4
├── img01.png
├── NotoSansKR-Bold.woff2  (또는 base64 임베드)
└── _export_manifest.json
```

HTML 내부 참조는 **오로지 파일 basename만** 사용한다.
- OK: `<video src="demo.mp4">`
- 금지: `<video src="./demo.mp4">`
- 금지: `<video src="media/demo.mp4">`
- 금지: `<video src="../../engine/demo.mp4">`

### P2. 절대경로·외부 URL 금지 (폰트 예외)
Export 결과 HTML에 다음 패턴이 남아있으면 **무효한 Export**다:

| 패턴 | 허용? |
|---|---|
| `http://localhost:*` | ❌ |
| `http://127.0.0.1:*` | ❌ |
| `file:///C:/…` | ❌ |
| `C:\…` (Windows 드라이브 절대경로) | ❌ |
| `../…` (상위 폴더) | ❌ |
| `data:image/…base64,…` | ✅ (인라인은 허용) |
| `https://fonts.googleapis.com` 또는 `fonts.gstatic.com` | ⚠ 폰트 임베드 실패 시에만 허용 |
| `https://www.youtube.com/embed/…` (iframe) | ✅ |

### P3. 미디어는 복사, 폰트는 임베드
- **이미지·비디오·오디오**: 원본 파일을 대상 폴더에 **복사**. base64 임베드 금지 (파일 부풀음).
- **폰트 (Google Fonts 등)**: 네트워크 의존 제거를 위해 **CSS 안에 base64 임베드**.

### P4. 뷰어 전용
Export된 HTML은 **뷰어 전용**이다. 에디터 스크립트(`panel-context.js`, `editor/editor.*.js`, 레거시 `editor.js`)는 포함하지 않는다.
다시 편집하려면 원본 프로젝트 폴더에서 열어야 한다.

### P5. 서버 필수
Export 실행에는 `서버시작.bat`(= `save-server.js`)이 반드시 필요하다.
서버가 없는 상황에서의 "대체 Export" 경로를 만들지 말 것.
애매한 폴백은 "작동하는 것처럼 보이지만 망가진 Export"를 낳는다.

---

## 🚨 과거 실패 사례 (반복 금지)

### 사례 1 — engine 경로가 절대경로로 박힘
**증상**: 내일 발표 직전 다른 PC에서 열었더니 CSS가 완전히 깨짐.

**원인**: `_inlineAssets`의 폴백 경로에서 fetch 실패 시 `link.href = new URL(href, location.href).href` 를 박았다. 이게 `file:///C:/Users/…` 절대경로가 되어 외부 PC에서 실패.

**재발 방지**:
- Export 경로에선 **폴백으로 절대경로 박지 말 것**. 실패 시 Export 자체를 중단한다.
- 이 책임은 `exportHTML()` 본체가 진다 (`_inlineEngineAssets` 는 실패 시 throw).

### 사례 2 — 미디어는 인라인 안 되어 있었음
**증상**: Export 한 HTML을 다른 폴더로 옮기니 영상이 안 보임.

**원인**: 과거 `exportHTML()`은 CSS/JS만 인라인하고 미디어는 상대경로 그대로 남겼다. 같은 폴더에 영상이 **우연히 있으면** 작동했지만, 폴더 이동하면 깨졌다.

**재발 방지**: 미디어는 **반드시** 대상 폴더에 복사. 복사 후 HTML의 `src`는 basename만.

### 사례 3 — 한글 폰트 오프라인에서 깨짐
**증상**: 인터넷 안 되는 강의실에서 Noto Sans KR이 시스템 폰트로 대체됨.

**원인**: Google Fonts CSS는 외부 CDN이라 오프라인에서 로드 실패.

**재발 방지**: `_embedGoogleFonts`가 CSS를 fetch 후 woff2까지 base64로 임베드.

---

## ✅ Export 체크리스트 (PR 리뷰용)

다음 중 하나라도 "No"면 머지 금지:

- [ ] Export된 HTML을 **빈 폴더**에 옮기고 더블클릭 → 작동하는가?
- [ ] 그 PC에서 **인터넷을 끊고** 다시 열어도 폰트가 유지되는가?
- [ ] 그 PC에서 **`C:\temp\` 등 낯선 경로**에 두고 열어도 작동하는가?
- [ ] Export 후 `_export_manifest.json`의 `missing` 배열이 비어있는가?
- [ ] `exportHTML()` 마지막의 `_validateExportedHTML()` 경고가 0건인가?
- [ ] 새 미디어 속성(`<img srcset>`, `<source>`, CSS `url()`)을 추가했다면 **`exportHTML` 내의 미디어 수집 루프에도** 추가했는가?

---

## 🛠 수정 시 반드시 지킬 것

### A. 새로운 미디어 타입 추가 시
`exportHTML()` 의 **7a/7b/7c 섹션** (미디어 수집 루프)에 셀렉터를 반드시 추가한다.
그냥 새 DOM 속성만 추가하고 Export 로직을 안 건드리면 → **외부 PC에서 누락된다**.

### B. CSS에 새로운 `url(...)` 참조 추가 시
`engine.css`에 `background-image: url(../img/x.png)` 같은 상대 참조를 **절대 쓰지 말 것**.
- 폰트: `@font-face src: url(...)` 만 허용하되, Export 시 `_embedGoogleFonts`가 처리한다.
- 배경 이미지가 필요하면 슬라이드 HTML의 inline `style` 로 처리하고, Export의 7c 루프가 수집하게 한다.

### C. `_assetCache` 프리페치
에디터 I/O 모듈은 페이지 로드 시 동기적으로 CSS를 캐시하고 비동기로 JS를 캐시한다.
**이 프리페치를 망가뜨리는 변경 금지**:
- `<script src>` 순서를 바꾸지 말 것. 현재 공식 순서는 `presentation.js` → `panel-context.js` → `editor.core.js` → `editor.block.js` → `editor.io.js` → `editor.main.js`.
- `<link rel="stylesheet">` 를 JS로 나중에 동적 추가하는 패턴 금지.

### D. 새 단축키/버튼을 추가해서 Export를 호출할 때
무조건 `exportHTML()` 를 호출. 절대 "간소화된 export 복사본"을 만들지 말 것.
단일 진입점 원칙.

---

## 🔬 Export 자체 검증 (`_validateExportedHTML`)

Export 함수는 생성된 HTML을 스캔해서 아래를 리포트한다. 경고 하나라도 있으면 사용자에게 보인다:
- `localhost` / `127.0.0.1` 잔존
- `file://` 잔존
- Windows 드라이브 절대경로 잔존
- `../` 상위 폴더 참조 잔존

이 검증 함수를 약화하지 말 것. 새로운 실패 패턴을 발견하면 **추가**만 하라.

---

## 📦 Export 결과물 스펙

```
target/
├── {htmlName}.html          ← 뷰어 전용, 에디터 스크립트 없음, 폰트 임베드
├── {media files...}         ← flat, basename만
└── _export_manifest.json    ← 검증 로그 + 파일 목록
```

### `_export_manifest.json` 스키마
```json
{
  "exportedAt": "ISO8601",
  "engineVersion": "2.0",
  "html":    { "name":"...", "bytes":123 },
  "files":   [{ "original":"../../x/demo.mp4", "name":"demo.mp4", "bytes":45000000 }],
  "missing": [{ "ref":"...", "reason":"source file not found" }],
  "totalBytes": 45123456
}
```

**manifest가 있어야 Export다.** 없는 결과물은 사람이 검증할 수 없다.

---

## 🔁 테스트 절차 (매 릴리즈마다)

1. 에디터에서 새 프레젠테이션 생성, 이미지 + 비디오 + 한글 텍스트 + 애니메이션 추가.
2. Export → `C:\temp\test_export\` 지정.
3. **해당 폴더를 USB에 복사**.
4. 다른 PC (또는 현재 PC의 다른 드라이브, 인터넷 OFF 상태)에서:
   - HTML 더블클릭 → 한글/애니메이션/영상/이미지 전부 정상인지 확인.
   - 개발자 도구 Console 에 에러 0건인지 확인.
   - Network 탭에 실패한 요청 0건인지 확인.
5. `_export_manifest.json` 열어서 `missing`이 비어있는지 확인.

이 5단계를 건너뛰고 릴리즈하지 말 것.

---

## 📜 버전 히스토리

| v | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-13 | 초기 Export (CSS/JS 인라인, 미디어 미처리 — 결함) |
| 1.5 | 2026-04-14 | `_fixRelativePaths`, `_bakeMedia` 추가 (부분 해결) |
| 2.0 | 2026-04-24 | Flat 폴더 기반, 서버 복사, 폰트 임베드, 자체검증 |
| **2.1** | **2026-04-24** | **UX 전환: showDirectoryPicker 기반. `file://` 폐기, localhost 경유 의무화** ← 현재 |

v2.0 이후의 변경은 반드시 이 문서 맨 위 "불가침 원칙"을 지키며 이뤄져야 한다.

---

## 🎨 v2.1 UX 전환 기록

### 변경 배경
v2.0은 기능은 작동했지만 `prompt()`로 폴더 경로를 사용자에게 타이핑시키는 UX였다.
형 피드백: "기본적인 것(폴더 선택 다이얼로그)을 왜 새로 만들려 하느냐 — 화장실 가서 똥 싸고 안 닦은 격."

### 근본 교훈 (재발 방지)
- **기본 UX 패턴을 새로 창조하지 말 것.** OS/브라우저가 제공하는 표준 다이얼로그를 먼저 찾아라.
- **"사용자 여정"을 텍스트로 먼저 서술하고 승인받은 뒤 구현**.
- **"제약 때문에 안 된다"고 선언하기 전에 전제를 한 번 더 의심**.
  (v2.0 당시 "file://에선 API 막힘"을 핑계 삼았으나, localhost 서버가 전제인 환경에선 API가 열려있었음)

### 구조적 변경
- **진입점 통일**: `file://` 직접 열기 경로 폐기. 모든 작업은 `http://localhost:3000` 경유.
- **랜딩 페이지**: `index.html` 신설. 서버 상태 + 프레젠테이션 카드 목록.
- **폴더 선택**: `window.showDirectoryPicker({mode:'readwrite'})` — Windows 기본 다이얼로그.
- **파일 쓰기**: 브라우저가 `FileSystemDirectoryHandle`로 직접 파일 씀 (서버 `/export` 엔드포인트 미사용).
- **서버 역할 축소**: 미디어 원본 읽어서 base64로 제공(`/read-asset`)만 담당.

### UX 흐름 (현재)
```
[E키] → [에디터 모드] → [Export 버튼]
  ↓
[Windows 폴더 선택 다이얼로그]  ← OS 기본 (만들지 말 것)
  ↓
[파일명 입력 다이얼로그]  ← 엔진 자체 (검은 배경 모달, 기본값 자동)
  ↓
[브라우저가 폴더에 직접 쓰기: HTML + 미디어 + manifest]
  ↓
[결과 리포트 모달]  ← 복사 파일 수, 누락, 경고
```

### 불가침 원칙 (v2.1 추가)
- P6. **Export는 `http://localhost:3000` (또는 https) 에서만 실행 가능**. `file://`는 명확한 에러 메시지 띄우고 중단.
- P7. **OS 표준 다이얼로그 우선**. 경로 입력을 `prompt()`, `confirm()`, 커스텀 폼으로 구현하지 말 것.
- P8. **브라우저가 파일 시스템을 건드리는 경우, `FileSystemDirectoryHandle` 사용**. 경로 문자열을 서버에 보내서 쓰게 하는 방식은 **금지** (사용자가 폴더를 클릭으로 고른 의미가 없어짐).
