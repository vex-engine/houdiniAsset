# Slide Editor — Developer Reference

> `prompt_engineering.html` 내장 에디터의 아키텍처, 설정, 확장 가이드

---

## 파일 구조

단일 HTML 파일 내에 3개 레이어가 존재합니다.

```
prompt_engineering.html
├── <style>          ─── 프레젠테이션 CSS + 에디터 CSS
├── <body>
│   ├── Editor UI    ─── .ed-nav, .ed-panel, .ed-toolbar (에디터 전용 DOM)
│   ├── .slide-frame ─── 프레젠테이션 콘텐츠 (32개 슬라이드)
│   │   ├── .slide-deck > .slide[data-slide="N"]
│   │   ├── .ed-guide-169, .ed-crosshair-*, .ed-grid, .ed-snap-*
│   │   └── .slide-controls, .help-hint
│   ├── <script> #1  ─── Presentation Engine (pAPI)
│   └── <script> #2  ─── Editor Engine (EA)
```

---

## 아키텍처

### Presentation Engine (`pAPI`)
- 슬라이드 전환, 빌드 스텝, 터치/키보드 내비게이션
- `window.pAPI` 로 에디터에 API 노출
- 에디터는 `pAPI.reinit()` 를 호출하여 슬라이드 추가/삭제 후 동기화

### Editor Engine (`EA`)
- 모듈 순서가 의존성 순서를 따름 (위에서 아래로 참조 가능)

```
CFG (설정) → State → Palette → Helpers → Guide/Grid →
Nav → SlideOps → Editables → DragHandles(startDrag) →
Toolbar → MediaWrap → I/O → Undo → Download →
Toggle → EventHandlers → PublicAPI
```

### 의존성 규칙
- Editor → Presentation: `pAPI.S`, `pAPI.slides`, `pAPI.jump()`, `pAPI.reinit()`
- Presentation → Editor: **없음** (단방향 의존)
- HTML `onclick` → `EA.*` (Public API만 호출)

---

## 설정 객체 (CFG)

**모든 매직 넘버는 `CFG` 객체에 집중되어 있습니다.**

| 키 | 기본값 | 설명 |
|----|--------|------|
| `MAX_UNDO` | 15 | Undo/Redo 스택 깊이 |
| `SNAP_PX` | 8 | 스냅 가이드 흡착 거리 (px) |
| `GUIDE_RATIO` | 16/9 | 가이드 영역 종횡비 |
| `GUIDE_SCALE` | 0.9 | 가이드 크기 = 프레임의 90% |
| `TOAST_MS` | 1800 | 토스트 알림 표시 시간 (ms) |
| `NAV_TITLE_LEN` | 28 | 네비게이터 제목 잘림 글자수 |
| `MAX_CUSTOM_PAL` | 9 | 커스텀 팔레트 최대 색상 수 |
| `IMG_DEFAULT_W` | '400px' | 삽입 이미지 기본 너비 |
| `VID_DEFAULT_W` | '640px' | 삽입 영상 기본 너비 |
| `MEDIA_MIN_W` | 60 | 미디어 최소 리사이즈 너비 (px) |
| `MEDIA_RADIUS` | '8px' | 미디어 border-radius |
| `NUDGE_SM` | 1 | 화살표 키 이동 (px) |
| `NUDGE_LG` | 10 | Shift+화살표 이동 (px) |
| `ZINDEX_STEP` | 10 | z-index 증감 단위 |
| `DUP_OFFSET` | 20 | 요소 복제 시 오프셋 (px) |
| `TB_OFFSET_TOP` | 120 | 툴바-요소 상단 간격 |
| `TB_OFFSET_BOT` | 20 | 툴바가 아래에 뜰 때 간격 |
| `TB_HALF_W` | 260 | 툴바 너비 절반 (센터링용) |
| `TB_MIN_LEFT` | 250 | 툴바 최소 left (네비게이터 회피) |
| `CSS_SPLIT_MARK` | `'/* ===='` | 다운로드시 에디터 CSS 제거 기준점 |
| `LS_PALETTE` | `'ed_pal'` | localStorage 키: 커스텀 팔레트 |
| `LS_TOOLBAR` | `'ed_tb'` | localStorage 키: 툴바 위치 |
| `LS_SAVE` | `'ed_save'` | localStorage 키: 저장된 편집 상태 |

---

## 단축키

| 키 | 모드 | 기능 |
|----|------|------|
| `E` | 전역 | 에디터 토글 |
| `G` | 에디터 | 격자 토글 |
| `PageUp/Down` | 에디터 | 슬라이드 이동 |
| `Ctrl+S` | 에디터 | 저장 (localStorage) |
| `Ctrl+Shift+S` | 에디터 | Save As (파일명 지정 다운로드) |
| `Ctrl+Z` | 에디터 | Undo |
| `Ctrl+Shift+Z` | 에디터 | Redo |
| `Ctrl+Y` | 에디터 | Redo (대체) |
| `Ctrl+D` | 에디터 | 선택 요소 복제 |
| `Arrow` | 에디터 (요소 선택 시) | 1px 이동 |
| `Shift+Arrow` | 에디터 (요소 선택 시) | 10px 이동 |
| `Delete` | 에디터 (요소 선택 시) | 요소 삭제 |
| `←/→` | 프레젠테이션 | 슬라이드 전환 |
| `Space` | 프레젠테이션 | 빌드 스텝 진행 |
| `F` | 프레젠테이션 | 전체화면 |
| `N` | 프레젠테이션 | 발표자 노트 토글 |

---

## 핵심 설계 원칙 — 반드시 지켜야 할 규칙

### 1. 미디어(이미지/영상)는 반드시 flex 밖에 존재해야 한다

`.slide`는 `display:flex` 컨테이너입니다. 미디어가 flex 자식이면 크기 변경 시 전체 레이아웃이 재계산됩니다.

```
[규칙] .ed-media-wrap은 position:absolute — flex 흐름에서 완전히 제외
[금지] max-width:100% 를 미디어 요소에 절대 사용하지 않는다
[금지] .ed-media-wrap에 flex-shrink/flex-grow 등 flex 속성을 사용하지 않는다
```

**위반 시 증상**: 미디어 리사이즈/드래그 시 텍스트 위치가 함께 변경됨

### 2. position 인라인 설정 — 텍스트 vs 미디어 구분 필수

```
[텍스트 블록] 이동 시 el.style.position='relative' 인라인 설정 필수
  → 에디터 CSS가 종료되면 position:static으로 돌아가 left/top 무시됨
  → 인라인 relative가 있어야 Exit 후에도 위치 유지

[미디어 wrap] position:absolute 유지 — 절대 relative로 바꾸면 안 됨
  → ed-media-wrap은 CSS에서 position:absolute (flex 밖)
  → relative로 바꾸면 flex 자식 복귀 → 레이아웃 깨짐/사라짐
  
[올바른 패턴]
  if(!el.classList.contains('ed-media-wrap')) el.style.position='relative';
```

### 3. 미디어 파일은 base64/blob으로 HTML에 넣지 않는다

```
[규칙] readAsDataURL 사용 금지 — URL.createObjectURL 사용
[이유] 100MB 영상 → base64 = ~130MB → HTML 110MB+, localStorage 초과
[Save] blob URL을 파일명 참조로 변환 후 저장
[Save As] blob URL → data-filename 값으로 교체
[유저 안내] "미디어 파일을 HTML과 같은 폴더에 배치하세요"
```

### 3. 드래그 중 DOM 측정을 하지 않는다

```
[규칙] getBoundingClientRect()는 드래그 시작 시 1회만 호출, 이동 중에는 순수 수학 계산
[금지] mousemove 콜백 안에서 getBoundingClientRect() 호출
[올바른 패턴]
  // 시작 시 오프셋 스냅샷
  const rect0 = el.getBoundingClientRect();
  const elCxOff = rect0.left - frame0.left + rect0.width/2 - oL;
  // 이동 중 — 순수 덧셈만
  const cx = elCxOff + nx;  // DOM 측정 없음
```

**위반 시 증상**: 드래그 시 요소가 튀거나 진동, 스냅이 불안정

### 4. pointer-events 계층 구조

```
.ed-media-wrap 자식(img, video, iframe): pointer-events:none  ← 네이티브 드래그 차단
.ed-media-wrap 자체 (에디터 모드):      pointer-events:auto  ← 클릭/드래그 수신
.ed-media-del (삭제 버튼):              pointer-events:auto  ← 부모의 none 오버라이드
.ed-resize-handle:                      pointer-events:auto  ← 부모의 none 오버라이드
```

**위반 시 증상**: 삭제 버튼/리사이즈 핸들 클릭 안 됨, 또는 이미지가 브라우저 기본 드래그(복사)됨

---

## 드래그 시스템 상세

### `startDrag(el, e)` — 통합 드래그 함수

모든 요소 이동(텍스트 블록 핸들 + 미디어 직접 드래그)이 이 함수를 공유합니다.

```
1. push() — undo 스냅샷 저장
2. 미디어 wrap인 경우: transform:translate(-50%,-50%) → px left/top 전환 (1회)
3. 시작 좌표 스냅샷: oL, oT, sX, sY, elCxOff, elCyOff (getBoundingClientRect 1회)
4. mousemove: nx = oL + (clientX - sX), ny = oT + (clientY - sY) (순수 수학)
5. 스냅: cx = elCxOff + nx (DOM 측정 없이 예측)
6. Math.round()로 정수 좌표 — 서브픽셀 렌더링 방지
7. mouseup: 정리
```

### 미디어 리사이즈

```
1. push() — undo 저장
2. mousedown 시 media.offsetWidth 캡처
3. mousemove: media.style.width만 변경 (wrap은 auto-fit)
4. wrap은 position:absolute이므로 형제 요소에 영향 없음
```

---

## 저장 시스템

### 저장 (`Ctrl+S`) — 포토샵처럼 파일 직접 덮어씀
- **첫 Save**: `showSaveFilePicker`로 파일 1회 선택 → 핸들 `_saveHandle`에 캐싱
- **이후 Save**: 다이얼로그 없이 같은 파일 즉시 덮어씀
- 파일이 이동/삭제된 경우: 핸들 캐시 초기화 후 다운로드 폴백
- `localStorage`에도 백업 저장 (빠른 복원용)
- File System Access API 미지원 환경: 다운로드 폴백

### Save As
- 항상 새 파일 선택 다이얼로그
- 선택한 파일이 이후 `Ctrl+S`의 저장 대상이 됨 (`_saveHandle` 업데이트)

### 핵심 헬퍼: `_buildSaveHTML()`
- DOM 클론 + 런타임 아티팩트 제거 로직을 save/saveAs/exportHTML이 공유
- `_inlineAssets()` 호출은 각 함수에서 직접 (비동기)

### Reset
- 모든 슬라이드를 최초 로딩 시점의 원본 HTML로 복원
- localStorage 저장 데이터도 삭제

### 핵심 규칙: Save는 라이브 DOM을 그대로 저장한다
```
[금지] cleanDeckHTML() 같은 정리 함수를 통해 저장 — 정리 과정에서 데이터 손실 위험
[올바른 패턴] deck.innerHTML을 직접 저장, 로드 시 아티팩트 정리
[이유] 인라인 스타일(position, left, top, fontSize, color 등)이 편집의 핵심 데이터
       정리 함수가 이를 누락하면 편집 내용이 사라짐
```

---

## Undo/Redo 시스템

- **방식**: `deck.innerHTML` 전체 스냅샷 저장
- **스택 깊이**: 15 (CFG.MAX_UNDO)
- **단축키**: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+Y (redo)
- **동작 범위**: contenteditable 내부에서도 작동

### 주의사항
- `push()`는 변경 **전에** 호출
- Redo 스택은 새 `push()` 시 초기화
- base64 미디어가 포함되면 스냅샷 크기 급증 가능

---

## 다운로드 (Clean Export)

`downloadHTML()` 순서:
1. 에디터 모드 해제 + contenteditable 제거
2. DOM 전체 복제
3. 에디터 전용 요소 17종 셀렉터로 제거
4. 미디어 내 draggable/pointerEvents 정리
5. 에디터 스크립트 제거
6. CSS `/* ====` 마커 이후 에디터 CSS 제거
7. Blob 다운로드

---

## 확장 가이드

### 새 기능 추가 시

1. **설정값** → `CFG` 객체에 추가
2. **새 모듈** → 의존성 순서에 맞게 배치
3. **Public API** → `window.EA` 객체에 등록
4. **에디터 전용 DOM** → 다운로드 제거 셀렉터에 등록
5. **에디터 전용 CSS** → `/* ====` 마커 이후에 추가

### 새 미디어 타입 추가 시

1. `wrapMedia()`로 감싸기 — position:absolute 자동 적용
2. `max-width:100%` 사용 금지 — 고정 px width만
3. 내부 요소에 `pointer-events:none; -webkit-user-drag:none`
4. 삭제/리사이즈 버튼에 `pointer-events:auto`

### 새 드래그 가능 요소 추가 시

1. `attachHandles()`의 targets 셀렉터에 추가
2. 절대 `el.style.position='relative'` 무조건 사용 금지
3. `getComputedStyle(el).position==='static'` 체크 필수

---

## 해결된 버그 이력 (재발 방지 참고)

| 날짜 | 증상 | 근본 원인 | 수정 |
|------|------|-----------|------|
| 04-04 | 미디어 리사이즈 시 텍스트 위치 변경 | 미디어가 flex 자식 (position:relative) | position:absolute로 flex 이탈 |
| 04-05 | absolute로 바꿔도 여전히 텍스트 이동 | attachHandles()가 position:relative로 덮어씀 | getComputedStyle 체크로 변경 (4곳) |
| 04-05 | 드래그 시 요소 튀김/진동 | mousemove에서 매 프레임 getBoundingClientRect | 시작 시 1회 스냅샷, 이동 중 순수 수학 |
| 04-05 | 드래그 시 이미지 크기 줄어듦 | max-width:100%가 absolute containing block과 충돌 | max-width:100% 전면 제거 |
| 04-05 | 삭제(X) 버튼 안 됨 | 부모의 pointer-events:none이 자식에 전파 | 삭제/리사이즈에 pointer-events:auto 명시 |
| 04-05 | Save 후 Exit 해도 편집 반영 안 됨 (1차) | cleanDeckHTML()이 라이브 DOM 파괴 | Save는 deck.innerHTML 직접 저장 |
| 04-05 | Save 후 Exit 해도 편집 반영 안 됨 (2차) | 에디터 CSS가 position:relative 제공 → Exit 시 static 복귀 → left/top 무시 | 인라인 style.position='relative' 강제 |
| 04-05 | 에디터/프레젠테이션 간 위치 불일치 | px 좌표가 slide-frame 크기 기준 → 모드 전환 시 frame 크기 변경 → 같은 px이 다른 위치 | 좌표를 슬라이드 크기 대비 %로 저장 (pxToViewport) |

---

## 버전 히스토리

| 날짜 | 변경 |
|------|------|
| 2026-04-04 | 초기 에디터: 텍스트 편집, 미디어 삽입, 슬라이드 관리 |
| 2026-04-04 | Phase2: 드래그 이동, 스냅, 정렬, 격자, 배경색, z-index, 복제 |
| 2026-04-04 | 십자선, 커스텀 팔레트(+저장), 툴바 드래그/축소, 원본 초기화, Grid 커스터마이징 |
| 2026-04-04 | D&D 이미지, 클립보드 붙여넣기, 미디어 리사이즈 격리 |
| 2026-04-05 | Undo/Redo 단축키 개선 (Ctrl+Z/Ctrl+Shift+Z) |
| 2026-04-05 | 아키텍처 리팩토링: CFG 설정 객체, 모듈 구조, 하드코딩 제거 |
| 2026-04-05 | 미디어 시스템 전면 수정: absolute 격리, startDrag 통합, DOM 측정 제거, pointer-events 계층 정립 |
| 2026-04-05 | 저장/Save As/Reset/Edit Mode Out 기능, 파일 메뉴 바, 팔레트 .plt 파일 |
| 2026-04-05 | Save 근본 수정: 라이브 DOM 직접 저장, 페이지 로드 시 자동 복원, SaveAs 클론 방식 |
| 2026-04-13 | Save 파일 직접 덮어쓰기: File System Access API + _saveHandle 캐싱, _buildSaveHTML() 헬퍼 분리 |
