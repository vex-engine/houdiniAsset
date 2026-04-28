# VERSION

**현재 버전**: `v1.3.1` — **media-scale-handle-2026-04-27**
**릴리스 날짜**: 2026-04-27

## 핵심 변경
- 이미지/영상 선택 시 우측 하단 리사이즈 핸들이 우측 패널의 `Scale`과 같은 경로로 동작하도록 수정
- 뷰포트 드래그 시 `data-crop-scale` + `_cropApply()` 기준으로 프레임과 미디어가 함께 확대/축소
- 저장된 HTML에서 복구되는 미디어 핸들도 동일한 공용 스케일 드래그 로직 사용

## v1.3.0 핵심 변경
- `editor.js` (2858줄 / 128KB) → **4파일 물리 분할**
  - `engine/editor/editor.core.js`  (604줄)
  - `engine/editor/editor.block.js` (612줄)
  - `engine/editor/editor.io.js`    (902줄)
  - `engine/editor/editor.main.js`  (787줄)
- `window.EA` 공개 API **54개 키 100% 동일** (jsdom 검증)

## 마일스톤 백업
- `engine/_milestones/v2026-04-24_pre_split/`  — 분할 직전
- `engine/_milestones/v2026-04-24_post_split/` — 분할 직후 (현재)

## 원클릭 롤백
```bash
bash scripts/rollback_split.sh
```

## 이전 버전
- v1.3.0 — 2026-04-24 (엔진 물리 분할)
- v1.2 — 2026-04-24 (패널 컨텍스트 전환)
- v1.1 — 2026-04-24 (블럭 시스템 v2)
- v1.0 — 최초

자세한 변경 이력: [CHANGELOG.md](CHANGELOG.md)
