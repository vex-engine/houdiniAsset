# 에이전트 규칙 — 가장 먼저 읽기

## 문서 기본 언어

- 이 프로젝트의 문서, 인계 메모, 변경 요약은 한글을 기본으로 작성한다.
- 코드 식별자, 파일 경로, 명령어, Git 브랜치명처럼 원문 유지가 필요한 값만 영어/원문을 그대로 쓴다.

## 다음으로 읽을 문서

- 이 파일을 읽은 뒤, 작업을 계획하거나 수정하기 전에 루트의 `PROJECT_CONTEXT.md`를 읽는다.
- `PROJECT_CONTEXT.md`는 현재 프로젝트 상태, 최근 주요 변경사항, 사용자 작업 선호를 기록하는 인계 문서다.

## 현재 에디터 소스만 수정

- 에디터 작업은 `engine/editor/` 아래 분리 모듈에서 한다.
- 새 동작을 `engine/editor.js`에 구현하지 않는다.
- `engine/editor.js`는 레거시 단일 파일 참고/롤백용으로만 취급한다.
- 어떤 변경이 `engine/editor.js` 수정을 요구하는 것처럼 보이면, 먼저 현재 템플릿이나 프레젠테이션이 실제로 그 파일을 로드하는지 확인한다. 현재 작업 경로에서는 구현 대상이 아니다.

## 활성 에디터 파일

- `engine/editor/editor.core.js`
- `engine/editor/editor.block.js`
- `engine/editor/editor.io.js`
- `engine/editor/editor.main.js`
- 직접 관련될 때만 함께 수정할 수 있는 지원 파일:
  - `engine/engine.css`
  - `engine/presentation.js`
  - `engine/panel-context.js`

## 레거시 경계

- `engine/editor.js`는 오래된 덱과 롤백 비교를 위한 파일이다.
- 현재 개발의 기준 소스가 아니다.
