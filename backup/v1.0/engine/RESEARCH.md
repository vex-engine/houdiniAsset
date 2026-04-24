# 순수 HTML/CSS/JS 웹 슬라이드 프레젠테이션 리서치 결과

---

## 1. 추천 구조 (최종 아키텍처)

### HTML 구조

```html
<body>  <!-- 검정 배경, flex center → 레터박스/필러박스 처리 -->
  <div class="slide-frame">  <!-- 16:9 비율 고정, 흰색 배경 -->
    <main class="slide-deck">  <!-- position: relative, 100% x 100% -->
      <section class="slide active" data-slide="0" aria-hidden="false">
        <h1>제목</h1>
        <p data-step="1" data-animate="fade-up">빌드 요소</p>
        <aside class="speaker-notes">화자 노트</aside>
      </section>
      <section class="slide" data-slide="1" aria-hidden="true">...</section>
    </main>
    <nav class="slide-controls">  <!-- 프로그레스 바 + 카운터 -->
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="slide-counter"><span class="current">1</span> / <span class="total">N</span></div>
    </nav>
  </div>
</body>
```

### CSS 핵심 전략

```css
/* 16:9 비율 고정 + 뷰포트 fit */
body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden; }

.slide-frame {
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
  position: relative; overflow: hidden; background: #fff;
}

/* 슬라이드 겹침: absolute positioning */
.slide { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }

/* 전환: CSS transition (GPU 가속 속성만 사용) */
.slide { opacity: 0; visibility: hidden; transition: opacity 0.5s ease, transform 0.5s ease; }
.slide.active { opacity: 1; visibility: visible; }
```

### JS 상태 관리

```javascript
const state = {
  currentSlide: 0,
  currentStep: 0,
  isTransitioning: false,  // 이벤트 잠금
  slides: []               // { element, maxStep } 배열
};
```

---

## 2. 핵심 패턴 (주제별 Best Practice)

### 레이아웃 & DOM 구조
- **컨테이너:** `position: absolute` + `inset: 0`으로 슬라이드 겹침, 내부는 Flexbox 정렬
- **16:9 고정:** `min()` 함수로 뷰포트에 fit, `aspect-ratio: 16/9` 폴백 제공
- **반응형 폰트:** `clamp(최소, vw기반, 최대)` 조합으로 어떤 화면에서든 가독성 유지

### 키보드 & 네비게이션
- **키보드:** `keydown` + `e.key` 사용, Space/PageDown/Arrow 등 `preventDefault()`로 스크롤 차단
- **URL 동기화:** `history.pushState` + `popstate` 이벤트로 뒤로가기/앞으로가기 지원
- **터치 제스처:** `touchstart`/`touchend`로 감지, 임계값 50px + 시간 300ms + 각도 30도 필터링

### 전환 애니메이션
- **방식:** CSS Transition + JS 클래스 토글 (단순하고 성능 최적)
- **GPU 가속:** `transform`/`opacity`만 애니메이션, `will-change`는 전환 직전/직후에만 동적 적용
- **입력 잠금:** `isTransitioning` 플래그 + `transitionend` 이벤트 + 안전 타임아웃(fallback)

### 콘텐츠 빌드 효과
- **순서 등장:** `data-step="N"` 속성, 같은 번호로 동시 등장 가능, prev 시 maxStep 복원
- **등장 효과:** `data-animate="fade-up"` + CSS transition (opacity + transform)
- **화자 노트:** `aside.speaker-notes` + `P` 키로 `window.open` 프레젠터 뷰

---

## 3. 주의사항

### 흔한 실수
| 실수 | 해결 방법 |
|------|-----------|
| `will-change`를 모든 슬라이드에 항상 적용 | 전환 직전에만 설정, 완료 후 `auto`로 복원 |
| `transitionend`가 발생하지 않아 잠금 영구화 | 안전 타임아웃(`setTimeout`)을 fallback으로 설정 |
| `popstate` → `goToSlide` → `pushState` 무한 루프 | `popstate` 핸들러에서는 `renderSlide()`만 직접 호출 |
| `left`/`top`/`width`/`height` 애니메이션 사용 | Layout 트리거됨 → `transform`/`opacity`만 사용 |
| Space 키에 `preventDefault()` 누락 | 페이지 스크롤 발생 → keydown에서 반드시 차단 |
| `transitionend`가 여러 번 발생 | `e.propertyName` 필터링 또는 `{ once: true }` 사용 |
| reflow 없이 시작 위치 설정 | `el.offsetHeight` 호출로 강제 reflow 후 전환 시작 |

### 브라우저 호환성
| 기능 | 지원 현황 |
|------|-----------|
| `aspect-ratio` | Chrome 88+, Firefox 89+, Safari 15+ (95%+) |
| `inset` 단축 속성 | Chrome 87+, Firefox 66+, Safari 14.1+ |
| `min()`/`clamp()` | Chrome 79+, Firefox 75+, Safari 13.1+ |
| `contain` 속성 | Chrome 52+, Firefox 69+, Safari 15.4+ |
| `BroadcastChannel` | Chrome 54+, Firefox 38+, Safari 15.4+ |
| `{ passive: true }` | Chrome 51+, Firefox 49+, Safari 10+ |
| Web Animations API | Chrome 36+, Firefox 48+, Safari 13.1+ |

---

## 4. 전환 효과 구현 비교

### Fade (페이드)
```css
.slide { opacity: 0; transition: opacity 0.6s ease; }
.slide.active { opacity: 1; }
```
- 가장 단순하고 안정적, 방향 무관

### Slide (좌우 슬라이드)
```css
.slide { transform: translateX(100%); transition: transform 0.5s ease; }
.slide.active { transform: translateX(0); }
.slide.exit-left { transform: translateX(-100%); }
```
- `offsetHeight` reflow 필요, 방향(next/prev)에 따라 분기

### Zoom (확대/축소)
```css
.slide { opacity: 0; transform: scale(0.8); transition: opacity 0.5s ease, transform 0.5s ease; }
.slide.active { opacity: 1; transform: scale(1); }
```
- 들어올 때 축소→원본, 나갈 때 원본→확대

---

## 5. 빌드 효과 구현

### data-step 기반 순차 등장
```html
<li data-step="1" data-animate="fade-up">항목 1</li>
<li data-step="2" data-animate="fade-left">항목 2</li>
```

```css
[data-step] { opacity: 0; transform: translateY(40px); pointer-events: none; transition: opacity 0.5s ease, transform 0.5s ease; }
[data-animate="fade-left"] { transform: translateX(-40px); }
[data-step].visible { opacity: 1; transform: translate(0,0) scale(1); pointer-events: auto; }
```

### step/slide 분기 로직
```javascript
function next() {
  if (currentStep < maxStep) { currentStep++; revealSteps(); }
  else { nextSlide(); }
}
function prev() {
  if (currentStep > 0) { currentStep--; revealSteps(); }
  else { prevSlide(); /* maxStep으로 복원 */ }
}
```

---

## 6. 스케일링 전략 비교

| 전략 | 방식 | 장점 | 단점 |
|------|------|------|------|
| **순수 CSS** | `min()` + `clamp()` + `vw/vh` | JS 불필요, 간결 | 복잡한 레이아웃에서 예측 어려움 |
| **고정 해상도 + scale** | 1920x1080 기준 + `transform: scale()` | 완벽한 레이아웃 일관성 | JS resize 리스너 필요 |

> **추천:** 고정 해상도(1920x1080) + `transform: scale()` 방식 (Google Slides, Reveal.js 등 실제 도구들이 사용하는 방식)
