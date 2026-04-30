# 프로젝트 컨텍스트

이 문서는 `AGENTS.md` 다음으로 가장 먼저 읽어야 하는 현재 프로젝트 인계 문서다.

## 문서 작성 원칙

- 이 프로젝트의 문서, 인계 메모, 변경 요약은 기본적으로 한글로 작성한다.
- 코드 식별자, 파일 경로, 명령어, Git 브랜치명처럼 원문 유지가 필요한 값만 영어/원문을 그대로 쓴다.
- 사용자는 한국어 설명을 선호한다. 작업 설명은 짧고 직접적으로 쓴다.

## 저장소 구조

- GitHub 저장소: `vex-engine/apps`
- 현재 브랜치: `pptx`
- `main`은 원격 기본 브랜치이므로 유지한다.
- `apps` 저장소는 여러 앱을 모으는 용도로 유지한다. 저장소 이름을 `pptx`로 바꾸지 않는다.
- 나중에 실제 폴더 구조를 정리할 때는 현재 PPTX 프로젝트를 `apps/pptx/` 아래로 옮길 수 있다. 현재 로컬 루트는 아직 PPTX 앱 자체다.

## 현재 에디터 소스

- 활성 에디터 코드는 `engine/editor/` 아래 분리 모듈이다.
- 새 에디터 동작을 `engine/editor.js`에 추가하지 않는다. 이 파일은 레거시 단일 파일 참고용이다.
- 로드 순서: `presentation.js`, `panel-context.js`, `editor.core.js`, `editor.block.js`, `editor.io.js`, `editor.main.js`.

## 최근 주요 변경

- 브랜치 이름을 `codex/push-current-work`에서 `pptx`로 변경했다. 현재 로컬 브랜치는 `origin/pptx`를 추적한다.
- 편집 캔버스 확대/이동 기능이 추가됐다. 관련 API는 `pAPI.zoomEditViewAt`, `pAPI.panEditViewBy`, `pAPI.editView`다.
- 오브젝트 이동/복제 로직에 공용 스냅, Shift 축 잠금, 선택된 블럭에만 핸들을 붙이는 동작이 들어갔다.
- Windows 탐색기에서 이미지/영상을 드래그앤드롭할 때 실제 마우스 드롭 위치 중심에 배치되도록 수정했다.
- Save As / Export 코드는 현재 작업트리에서 단순화된 상태다. 저장/내보내기 동작을 바꿀 때는 `engine/editor/editor.io.js`를 특히 조심해서 확인한다.
- 서버와 `index.html`은 Git 메타데이터를 표시할 수 있도록 바뀌었다.
- 새 발표 복사본과 미디어가 `presentations/미드저니_나노바나나_그록_활용2/` 아래에 있다.

## 재발 방지 메모

- 에디터 모드에서는 `body.editor-mode [data-step]{ transform:none!important }`가 적용된다. 미디어 래퍼도 `data-step`을 받으므로 transform 기반 위치 보정은 무력화될 수 있다.
- 드롭 배치는 `translate(-50%, -50%)`에 의존하지 말고, 로드된 미디어 크기 기준으로 `left/top`을 직접 계산한다.
- 새로 드롭된 미디어 래퍼를 크기 보정 전 원시 드롭 좌표에 먼저 보여주지 않는다. 보정된 `left/top`이 적용되기 전에는 숨겨야 좌상단에서 커서 위치로 튀는 한 프레임 점프가 보이지 않는다.
- `ㄱㄱ`는 사용자가 앞서 논의한 계획을 바로 실행하라는 뜻이다.

## 검증

- 공식 엔진 검증: `bash scripts/verify_engine.sh`
- 단일 JS 파일 최소 검증: `node --check <file>`
- 미디어 드롭 위치 및 깜빡임 수정 후 마지막 전체 검증은 `bash scripts/verify_engine.sh` 기준 `ALL GREEN`이었다.
