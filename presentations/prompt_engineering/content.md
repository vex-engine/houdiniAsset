# 프롬프트 엔지니어링 for 3D 배경 디자이너
## AI 이미지 생성으로 레퍼런스 워크플로우 혁신하기

> **발표 대상:** UE4 기반 게임 그래픽 3D 배경 디자이너  
> **발표 시간:** 30분  
> **핵심 도구:** Nano Banana (Gemini), Grok Imagine, Midjourney, ChatGPT  

---

## 슬라이드 구성

---

### SLIDE 01 — 타이틀
# 프롬프트 엔지니어링
## AI 레퍼런스 이미지, 제대로 뽑는 법

- 부제: 3D 배경 디자이너를 위한 실전 가이드
- 발표일: 2026.04

> **화자 노트:** 가벼운 인사 후 바로 시작. "오늘 발표는 AI로 그림을 그리자는 얘기가 아닙니다. 우리가 매일 하는 레퍼런스 수집 작업을 10배 빠르게 만드는 방법에 대한 얘기입니다."

---

### SLIDE 02 — 현실 인식
# 레퍼런스 수집, 지금 어떻게 하고 계세요?

**기존 워크플로우:**
1. Pinterest / ArtStation / Google 이미지 검색
2. 원하는 분위기의 이미지를 찾을 때까지 스크롤
3. PureRef에 정리
4. 그래도 "딱 이 느낌"인 이미지는 없음

**문제점:**
- 검색 키워드의 한계 → 머릿속 이미지와 검색 결과의 괴리
- 시간 소모 → 레퍼런스 수집에만 반나절
- 저작권 불명확한 이미지 사용 리스크

> **화자 노트:** 청중에게 공감을 이끌어내는 슬라이드. "혹시 '중세 판타지 폐허인데 약간 동양적인 느낌'을 검색해본 적 있으세요? 나오는 게 없죠." 실제 경험담으로 연결.

---

### SLIDE 03 — 왜 지금인가
# 2026년, AI 이미지 생성의 현주소

**핵심 수치:**
- 2026년 기준 약 50%의 게임 스튜디오가 AI를 프로덕션 파이프라인에 통합
- 에셋 제작 시간 최대 40% 단축
- 아트 에셋 비용 15~20% 절감

**우리가 주목할 포인트:**
- AI는 최종 에셋을 만드는 도구가 **아니다**
- AI는 **레퍼런스 생성 + 방향성 탐색**을 가속하는 도구

> **화자 노트:** "중요한 건, 스마트한 팀들은 AI를 아티스트 대체가 아니라 인간 크리에이티비티의 증폭기로 씁니다. 반복적이고 탐색적인 작업을 AI에 맡기고, 아티스트는 최종 판단과 디테일에 집중하는 구조입니다."

---

### SLIDE 04 — 섹션 구분
# PART 1
## 2026년 이미지 생성 AI 지형도

---

### SLIDE 05 — 주요 도구 비교
# 도구별 특성 비교

| 도구 | 강점 | 프롬프트 스타일 | 가격 |
|------|------|----------------|------|
| **Nano Banana 2** (Gemini) | 4K 해상도, 레퍼런스 이미지 14장 지원, 텍스트 렌더링 우수 | 자연어 대화형 | 이미지당 ~$0.039 |
| **Grok Imagine** (xAI) | 드라마틱한 라이팅, 컨셉아트/포스터 스타일에 강함, Speed/Quality 모드 선택 | 구체적 묘사형 | X Premium 구독 포함 |
| **Midjourney V7** | 예술적 완성도 최고, 시네마틱 비주얼 | 짧은 키워드 + 레퍼런스 이미지 | 월 $10~ |
| **ChatGPT (GPT-5)** | 대화형 반복 수정, 멀티턴 편집 | 문단형 서술 | Plus 구독 포함 |
| **Flux 2** | 포토리얼리즘, 정밀한 프롬프트 팔로잉 | 자연어 문장형 | 플랫폼별 상이 |

> **화자 노트:** "각 도구마다 잘하는 게 다릅니다. 나노 바나나는 레퍼런스 이미지를 같이 넣을 수 있어서 스타일 일관성이 좋고, 그록은 드라마틱한 분위기에 강합니다. 하나만 쓰지 말고 용도에 따라 골라 쓰세요."

---

### SLIDE 06 — 나노 바나나 상세
# Nano Banana 2 (Gemini)
## 배경 디자이너에게 왜 유용한가

**핵심 기능:**
- **레퍼런스 이미지 14장까지 입력 가능** → 스타일 전이(Style Transfer)에 최적
- 4K 해상도 출력 → 디테일 확인에 충분
- 대화형 편집 → "여기 좀 더 어둡게", "안개 추가해줘" 가능

**배경 디자이너 활용 시나리오:**
- 기존 컨셉아트 3~4장 입력 → "이 스타일로 폐허 던전 만들어줘"
- 무드보드 이미지 입력 → 통일된 분위기의 변형 대량 생성

> **화자 노트:** "나노 바나나의 킬러 기능은 레퍼런스 이미지 멀티 입력입니다. 우리가 이미 갖고 있는 아트 가이드 이미지를 넣고, '이 느낌으로 새로운 환경 만들어줘'라고 하면 스타일이 유지됩니다. 이건 텍스트만으로는 불가능한 일관성이에요."

---

### SLIDE 07 — Grok Imagine 상세
# Grok Imagine
## 컨셉 탐색에 최적화된 도구

**핵심 기능:**
- 텍스트→이미지, 이미지 편집, 멀티 이미지 합성, 스타일 전환
- 2026년 4월 업데이트: **Speed 모드** (빠른 대량 생성) / **Quality 모드** (고품질 4장)
- 반복 편집(iterative refinement) 지원 → 한 장을 계속 다듬기 가능

**배경 디자이너 활용 시나리오:**
- Speed 모드로 20~30개 변형 빠르게 뽑기 → 방향성 탐색
- Quality 모드로 최종 레퍼런스 후보 정교하게 생성
- 기존 스크린샷에 "분위기 바꿔줘" 편집 적용

> **화자 노트:** "그록의 장점은 속도입니다. Speed 모드로 러프한 아이디어를 빠르게 시각화하고, 마음에 드는 방향이 잡히면 Quality 모드로 전환해서 정교하게 뽑는 2단계 전략이 효과적입니다."

---

### SLIDE 08 — 섹션 구분
# PART 2
## 컨텍스트(맥락) — 프롬프트의 핵심

---

### SLIDE 09 — 맥락이란
# "같은 단어, 다른 그림"
## 맥락이 결과를 결정한다

**예시: "abandoned castle" 하나만 입력했을 때의 문제:**
- 서양 중세? 일본 성? 판타지?
- 낮? 밤? 새벽?
- 멀리서 본 전경? 내부? 문 앞?
- 게임용? 영화용? 일러스트?

**→ AI는 모호함을 "평균"으로 처리한다**
**→ 구체적 맥락 = 원하는 결과에 가까워지는 유일한 방법**

> **화자 노트:** "AI를 일러스트레이터에게 일 맡기는 것처럼 생각하면 안 됩니다. AI는 캐스팅 디렉터 + 시네마토그래퍼 + 라이팅 테크니션의 조합이에요. 각각에게 구체적 지시를 내려야 합니다."

---

### SLIDE 10 — 맥락 구성 요소
# 배경 디자이너의 맥락 체크리스트

프롬프트에 반드시 포함해야 할 **6가지 맥락 레이어:**

| 레이어 | 설명 | 예시 |
|--------|------|------|
| **1. 공간/환경** | 어떤 장소인가 | crumbling Gothic cathedral, volcanic cave system |
| **2. 시대/세계관** | 언제, 어떤 세계인가 | post-apocalyptic 2300s, feudal Japan fantasy |
| **3. 라이팅** | 빛의 방향, 색온도, 분위기 | warm golden hour side lighting, cold moonlit blue |
| **4. 카메라/앵글** | 시점과 화각 | wide-angle establishing shot, low-angle looking up |
| **5. 재질/디테일** | 표면의 물성 | moss-covered weathered stone, rusted corroded metal |
| **6. 분위기/감정** | 전달하려는 무드 | ominous and foreboding, serene and mystical |

> **화자 노트:** "이 6개를 다 안 넣어도 됩니다. 하지만 최소 3~4개는 넣어야 쓸만한 결과가 나옵니다. 특히 라이팅과 카메라는 우리 3D 아티스트에게 익숙한 개념이니까, 이걸 프롬프트 언어로 옮기는 연습만 하면 됩니다."

---

### SLIDE 11 — Before/After 비교
# 프롬프트 Before / After

**❌ Before (맥락 없음):**
```
fantasy dungeon
```
→ 결과: 일반적인 판타지 던전. 어디서 본 듯한 이미지. 방향성 없음.

**✅ After (맥락 풍부):**
```
underground crystal cavern in a dark fantasy world,
massive geode formations emitting faint purple bioluminescence,
shallow water reflecting ceiling crystals,
wide-angle establishing shot from cave entrance looking inward,
volumetric fog, rim lighting from crystal glow,
wet stone surfaces with mineral deposits,
ominous yet awe-inspiring atmosphere,
Unreal Engine 5 cinematic render style
```
→ 결과: 특정 방향성이 있는, 3D 모델링의 가이드가 될 수 있는 레퍼런스.

> **화자 노트:** "핵심은 '구체적 디테일의 축적'입니다. 한 번에 완벽한 프롬프트를 쓸 필요 없어요. 짧게 시작하고, 결과를 보면서 한 번에 하나씩 조건을 추가하세요. '안개 넣어줘', '카메라 낮춰줘', '바닥에 물 추가해줘' 이런 식으로."

---

### SLIDE 12 — 섹션 구분
# PART 3
## 핵심 키워드 마스터

---

### SLIDE 13 — 프롬프트 공식
# 배경 디자이너를 위한 프롬프트 공식

## Subject → Description → Style

```
[주체/환경]  +  [상세 묘사 4~6개]  +  [스타일/렌더 방식]
```

**실전 공식:**
```
[공간 유형], [세계관/시대],
[핵심 오브젝트 2~3개],
[라이팅 조건],
[카메라 앵글 + 렌즈],
[재질감 키워드],
[분위기 형용사],
[렌더 스타일]
```

> **화자 노트:** "이 공식을 외울 필요는 없어요. 처음 몇 번은 이 리스트를 옆에 두고 체크하면서 프롬프트를 작성하세요. 금방 습관이 됩니다."

---

### SLIDE 14 — 환경/공간 키워드
# 키워드 사전 ① 환경/공간

**자연 환경:**
- volcanic wasteland, frozen tundra, dense jungle canopy
- crystal cavern, underwater ruins, floating islands
- ancient forest with massive roots, desert canyon

**인공 환경:**
- crumbling Gothic cathedral, abandoned industrial complex
- overgrown futuristic city, underground bunker network
- ancient temple carved into cliff face
- medieval marketplace at dawn

**복합 환경 (자연+인공):**
- castle ruins reclaimed by forest
- spaceship crash site overgrown with alien flora
- sunken city half-submerged in swamp

> **화자 노트:** "환경 키워드를 조합하면 독창적인 공간이 나옵니다. 'volcanic wasteland + ancient temple'처럼 두 개를 섞으면 AI가 재미있는 해석을 내놓습니다. 아이디에이션 단계에서 이 조합 실험이 엄청 유용합니다."

---

### SLIDE 15 — 라이팅 키워드
# 키워드 사전 ② 라이팅

**시간대:**
- golden hour, blue hour, harsh midday sun
- overcast diffuse lighting, twilight

**광원 유형:**
- volumetric god rays through broken ceiling
- bioluminescent glow from flora
- campfire warm point light
- cold moonlight through fog
- rim lighting from behind subject

**분위기 라이팅:**
- dramatic chiaroscuro, high contrast noir
- soft ambient with no harsh shadows
- neon-lit cyberpunk atmosphere
- candlelit warm interior glow

> **화자 노트:** "라이팅 키워드는 3D 아티스트인 우리가 가장 자연스럽게 쓸 수 있는 영역입니다. UE4에서 라이트 세팅할 때 생각하는 것들을 영어로 옮기면 됩니다. 'volumetric fog'은 우리가 이미 쓰는 용어잖아요."

---

### SLIDE 16 — 카메라 & 재질 키워드
# 키워드 사전 ③ 카메라 & 재질

**카메라/앵글:**
- wide-angle establishing shot (14mm)
- bird's eye view / top-down
- low-angle looking up (dramatic)
- eye-level straight-on
- over-the-shoulder POV
- deep depth of field (환경 전체 선명)
- shallow depth of field (전경 포커스)

**재질/표면:**
- weathered stone with moss, cracked marble
- rusted corroded metal, oxidized copper green
- wet cobblestone reflecting light
- polished obsidian, rough-hewn wood
- translucent crystal, frosted glass
- charred and scorched surfaces

> **화자 노트:** "재질 키워드가 특히 중요합니다. 단순히 'stone wall'이라고 하면 밋밋한 결과가 나오지만, 'weathered limestone wall with deep cracks and dark water stains, patches of dried moss in crevices'라고 하면 텍스처 레퍼런스로 바로 쓸 수 있는 수준이 나옵니다."

---

### SLIDE 17 — 쓸모없는 키워드
# ⚠️ 2026년에 효과 없는 키워드들

**더 이상 안 먹히는 "품질 태그":**
- ~~masterpiece, best quality, highly detailed, 8k~~
- ~~ultra-realistic, photorealistic, award-winning~~
- ~~trending on ArtStation~~

**왜?**
- 2026년 모델들은 이미 높은 기본 품질을 가짐
- 범용 품질 태그는 "정크 토큰"으로 취급됨
- **구체적 디테일 묘사가 범용 태그보다 훨씬 효과적**

**대안:**
- ~~"highly detailed"~~ → "visible pores on skin, intricate gold embroidery on velvet"
- ~~"8k ultra realistic"~~ → "shot on 85mm lens, f/1.8, cinematic rim lighting"
- 실제 묘사 > 추상적 품질 요구

> **화자 노트:** "초기 AI 시대에는 이런 태그가 효과가 있었습니다. 하지만 지금 모델들은 기본 품질이 이미 높아서, 이런 태그를 넣으면 오히려 프롬프트 공간만 낭비합니다. 그 자리에 구체적인 라이팅이나 재질 묘사를 넣는 게 훨씬 낫습니다."

---

### SLIDE 18 — 네거티브 프롬프트
# 네거티브 프롬프트 활용

**기본 세트 (배경 디자이너용):**
```
blurry, low resolution, watermark, text overlay,
cartoon style, anime, flat lighting,
oversaturated colors, lens flare,
people in foreground, UI elements
```

**상황별 추가:**
- 실내 배경: `window glare, overexposed`
- 자연 환경: `man-made objects, modern elements`
- 다크 판타지: `bright cheerful colors, cute, kawaii`
- 건축물: `impossible architecture, floating elements`

> **화자 노트:** "네거티브 프롬프트는 AI한테 '이건 하지마'라고 알려주는 겁니다. 배경 작업에서 가장 흔한 문제가 의도치 않은 인물 삽입, 워터마크, 만화 스타일 오염 등인데, 이걸 사전에 차단합니다. 다만 긍정적 묘사에 집중하는 것이 네거티브에 의존하는 것보다 더 효과적입니다."

---

### SLIDE 19 — 섹션 구분
# PART 4
## ⚠️ 반드시 알아야 할 주의사항

---

### SLIDE 20 — 저작권
# 주의사항 ① 저작권

**현재 법적 상황 (2026년 4월 기준):**
- 미국 대법원: AI 단독 생성물은 저작권 보호 대상이 아님 (2026.03 확정)
- 핵심 원칙: **저작권은 "인간의 창작적 기여"가 있어야 성립**
- 프롬프트만으로는 충분한 창작적 기여로 인정되지 않음

**실무 가이드라인:**
- ✅ 레퍼런스/무드보드 용도로 활용 → **안전**
- ✅ AI 생성 이미지를 기반으로 인간이 수정/재창작 → **안전** (수정 정도에 따라)
- ⚠️ AI 생성 이미지를 최종 게임 에셋으로 직접 사용 → **리스크 있음**
- ❌ 특정 아티스트 이름을 프롬프트에 넣어 스타일 복제 → **윤리적 문제**

> **화자 노트:** "우리 용도는 레퍼런스이기 때문에 법적 리스크가 낮습니다. 하지만 회사 차원에서 알아둬야 할 것: AI 생성물 자체는 저작권으로 보호받기 어렵습니다. 또한 '○○ 작가 스타일로'라고 프롬프트에 넣는 건 윤리적으로 문제가 될 수 있으니 피하세요. 대신 스타일 특성을 묘사하세요."

---

### SLIDE 21 — 기술적 한계
# 주의사항 ② 기술적 정확성의 한계

**AI가 자주 틀리는 것들:**
- 🏗️ **구조적 지지:** 건축물이 물리적으로 불가능한 구조 (떠 있는 기둥, 지지대 없는 아치)
- 📐 **비율과 스케일:** 문 크기가 일관되지 않음, 계단 높이 불균일
- 🔧 **기능적 디자인:** 기계/장치가 시각적으로만 그럴듯, 실제로는 작동 불가
- 🧱 **재질 물리:** 유리가 돌처럼 보이거나, 금속이 천처럼 접힘
- 🏛️ **건축 양식 혼합:** 고딕+아르데코+일본식이 무분별하게 섞임

**대응 방법:**
- AI 이미지는 **"영감의 출발점"**이지 **"그대로 따라 만들 가이드"가 아님**
- 물리적 정확성은 3D 아티스트인 우리가 판단하고 수정해야 할 영역
- 의도적 불가능 구조(판타지)와 실수를 구분하는 눈이 필요

> **화자 노트:** "이게 가장 중요한 포인트입니다. AI가 만든 멋있는 이미지를 보고 '이대로 만들자'고 하면 3D로 옮길 때 구조적으로 말이 안 되는 경우가 많습니다. 우리의 전문성은 바로 이 판단에 있습니다. AI가 제안하고, 우리가 검증하고 실현하는 거죠."

---

### SLIDE 22 — 일관성 문제
# 주의사항 ③ 일관성 유지의 어려움

**문제:**
- 같은 환경을 다른 앵글에서 일관되게 생성하기 매우 어려움
- 색감, 재질, 건축 디테일이 생성마다 달라짐
- 캐릭터보다 배경의 일관성 유지가 더 어려운 편

**해결 전략:**
1. **레퍼런스 이미지 활용** — 이전 생성 결과를 다음 프롬프트의 레퍼런스로 입력 (나노 바나나 최대 14장)
2. **스타일 가이드 프롬프트** — 색상 팔레트, 재질, 라이팅 조건을 고정 문구로 만들어 반복 사용
3. **시드(Seed) 고정** — 지원하는 도구에서 시드 번호를 고정하여 변수 최소화
4. **프롬프트 템플릿** — 팀 공유 프롬프트 라이브러리 구축

> **화자 노트:** "실전에서 가장 답답한 부분이 이겁니다. 멋진 이미지 하나 뽑았는데, 같은 공간을 다른 각도에서 보면 완전 다른 곳이 되어버려요. 이걸 줄이려면 '브랜드 프롬프트 공식'을 만들어야 합니다. 한번 마음에 드는 설정을 찾으면, 그 프롬프트의 스타일 부분을 복사해서 계속 재사용하세요."

---

### SLIDE 23 — 섹션 구분
# PART 5
## 실전 워크플로우

---

### SLIDE 24 — 4단계 워크플로우
# AI 레퍼런스 워크플로우 4단계

```
[Step 1]                [Step 2]                [Step 3]                [Step 4]
기획서/설정 텍스트  →   대량 변형 생성      →   선별 & 보드 구성    →   UE4 제작 참조
                                                                    
ChatGPT로            나노바나나 Speed      PureRef에 정리          모델링/레벨디자인
프롬프트 초안 생성    Grok Speed 모드       팀 리뷰 & 피드백        텍스처/라이팅 설정
                     20~30개 변형 생성      방향성 확정             레이아웃 블록아웃
                                           Quality로 정교화
```

> **화자 노트:** "이 4단계가 핵심입니다. 1단계에서 ChatGPT에게 기획 문서를 주고 프롬프트를 만들게 하면, 영어 프롬프트 작성 부담이 사라집니다. 2단계에서 빠르게 대량 생성하고, 3단계에서 골라서 정리하고, 4단계에서 UE4 작업의 가이드로 씁니다."

---

### SLIDE 25 — Step 1 상세
# Step 1: ChatGPT로 프롬프트 초안 생성

**방법:** 기획서의 한글 설정 텍스트를 ChatGPT에 넣고, 이미지 생성 프롬프트로 변환 요청

**입력 예시:**
```
다음 게임 배경 설정을 이미지 생성 AI용 영어 프롬프트로 변환해줘.
스타일은 언리얼 엔진 시네마틱 렌더 느낌으로.

[설정]
화산 지대 한가운데 위치한 고대 대장간. 용암이 천연 화로 역할을 한다.
거대한 석조 기둥들이 천장을 받치고 있고, 곳곳에 사용된 흔적이 있는
단조 도구들이 놓여 있다. 분위기는 위압적이면서도 경이로운 느낌.
```

**ChatGPT 출력 결과를 나노바나나/그록에 바로 사용**

> **화자 노트:** "영어 프롬프트 작성이 부담스러운 분들을 위한 핵심 팁입니다. 기획서 텍스트를 그대로 ChatGPT에 넣고 '이미지 생성 프롬프트로 변환해줘'라고 하면 됩니다. 나온 프롬프트를 나노바나나나 그록에 복붙하세요."

---

### SLIDE 26 — Step 2 상세
# Step 2: 대량 변형 생성

**전략: 한 번에 하나씩 조건 변경**

**1라운드 — 구도 탐색:**
- 같은 환경을 wide shot / medium shot / close-up으로 각각 생성
- 카메라 앵글 변경: 정면, 부감, 앙각

**2라운드 — 라이팅 탐색:**
- 같은 구도에서 시간대 변경: dawn, midday, dusk, night
- 광원 타입 변경: natural sunlight, torch-lit, bioluminescent

**3라운드 — 분위기 탐색:**
- 같은 세팅에서 무드 변경: ominous, serene, chaotic, mysterious

> **화자 노트:** "한 번에 모든 조건을 바꾸지 마세요. 한 라운드에 하나의 변수만 바꿔가며 비교하면 어떤 요소가 결과에 가장 큰 영향을 주는지 파악할 수 있습니다. 이 과정이 프롬프트 실력을 빠르게 키워줍니다."

---

### SLIDE 27 — Step 3~4 상세
# Step 3~4: 선별 → UE4 제작 연결

**Step 3 — 레퍼런스 보드 구성:**
- PureRef 또는 사내 도구에 선별한 이미지 정리
- 카테고리별 분류: 전체 분위기 / 라이팅 참조 / 재질 참조 / 구도 참조
- 팀 리뷰에서 방향성 합의 → 불필요한 반복 제거

**Step 4 — UE4 작업 연결:**
- 레퍼런스를 보며 **블록아웃 단계** 진행 (BSP/기본 지오메트리)
- 라이팅 레퍼런스 → UE4 라이팅 초기 세팅
- 재질 레퍼런스 → 머티리얼/텍스처 방향성 확인
- AI 이미지의 "느낌"을 가져오되, 구조적 정확성은 직접 설계

> **화자 노트:** "Step 4에서 강조할 건, AI 이미지를 '똑같이 만들기'가 목표가 아니라는 겁니다. 분위기, 색감, 라이팅의 방향성을 빠르게 정하는 게 목적입니다. 구조와 디테일은 우리의 전문 영역이에요."

---

### SLIDE 28 — 실전 프롬프트 예시 모음
# 실전 프롬프트 예시 3종

**① 다크 판타지 던전:**
```
vast underground throne room of a forgotten dark lord,
massive obsidian pillars carved with ancient runes glowing faint green,
crumbled stone steps leading to an elevated throne,
volumetric dust particles in shafts of pale light from ceiling cracks,
wide-angle shot from base of steps looking up at throne,
wet stone floor reflecting ambient light,
dark fantasy atmosphere, foreboding and grand,
Unreal Engine cinematic render, muted desaturated palette
```

**② 자연 + 폐허 복합:**
```
ancient stone aqueduct bridge overgrown with giant tree roots,
spanning across a misty ravine in dense subtropical forest,
morning golden hour light filtering through canopy,
moss and ferns covering every stone surface,
birds in mid-flight near the arches,
medium shot from slightly below bridge level,
lush green palette with warm highlights,
environmental concept art style, painterly but detailed
```

**③ SF 산업 시설:**
```
abandoned space mining facility on asteroid surface,
massive drilling equipment half-buried in grey regolith,
harsh directional sunlight casting sharp shadows,
no atmosphere — pure black sky with visible stars,
industrial pipelines and modular hab units,
wide establishing shot showing facility against starfield,
hard sci-fi aesthetic, functional industrial design,
muted metallic color palette with orange safety markings
```

> **화자 노트:** "이 3가지 예시를 복사해서 바로 써보세요. 여기서 환경, 라이팅, 분위기 부분만 바꿔도 수십 개의 변형이 가능합니다. 프롬프트는 처음부터 새로 쓰는 것보다 좋은 템플릿을 수정하는 게 훨씬 효율적입니다."

---

### SLIDE 29 — 반복 수정 전략
# 프로 팁: 반복 수정(Iteration) 전략

**원칙: 한 번에 하나만 바꿔라**

| 라운드 | 변경 요소 | 예시 |
|--------|-----------|------|
| 1 | 기본 프롬프트로 시작 | "underground crystal cavern..." |
| 2 | 라이팅 변경 | + "warm torch-lit" → "cold blue bioluminescent" |
| 3 | 카메라 거리 변경 | "wide shot" → "medium shot focusing on crystal cluster" |
| 4 | 분위기 변경 | "ominous" → "serene and meditative" |
| 5 | 디테일 추가 | + "shallow pool reflecting crystals, small glowing insects" |

**마음에 드는 결과가 나오면:**
- 해당 프롬프트를 팀 라이브러리에 저장
- 레퍼런스 이미지로 등록하여 다음 생성의 스타일 앵커로 활용

> **화자 노트:** "프롬프트 엔지니어링의 핵심은 '한 번에 완벽하게'가 아니라 '빠르게 반복하며 수렴'하는 겁니다. AI의 장점은 반복 비용이 거의 0이라는 거예요. 부담 없이 실험하세요."

---

### SLIDE 30 — 팀 활용 제안
# 팀 차원의 활용 제안

**1. 프롬프트 라이브러리 구축**
- 프로젝트별 검증된 프롬프트 템플릿 공유 폴더
- 카테고리: 환경 유형별 / 분위기별 / 시간대별

**2. 레퍼런스 생성 규칙 합의**
- 레퍼런스 용도 한정 (최종 에셋 X)
- AI 생성 이미지에 명확히 태그 표시 (AI-generated)
- 특정 아티스트 이름 프롬프트 사용 금지

**3. 주간 프롬프트 실험 공유**
- 각자 발견한 효과적인 프롬프트/키워드 공유
- 실패 사례도 공유 → 팀 전체의 학습 속도 향상

> **화자 노트:** "도구를 아는 것도 중요하지만, 팀 차원에서 시스템으로 만드는 게 더 중요합니다. 한 사람이 찾은 좋은 프롬프트를 팀 전체가 쓸 수 있게 공유 구조를 만드세요."

---

### SLIDE 31 — 마무리
# 정리

**오늘 핵심 3가지:**

1. **AI는 레퍼런스 도구다** — 최종 에셋이 아니라 방향성 탐색의 가속기
2. **맥락이 품질을 결정한다** — 공간, 라이팅, 카메라, 재질, 분위기를 구체적으로
3. **반복이 실력이다** — 한 번에 하나씩 바꾸며 빠르게 수렴

**기억할 것:**
- 구체적 묘사 > 추상적 품질 태그
- 레퍼런스 용도 = 저작권 안전 지대
- AI가 제안하고, 우리가 판단하고 실현한다
- 프롬프트는 새로 쓰지 말고 템플릿을 수정하라

> **화자 노트:** "마지막으로 강조하고 싶은 건, AI가 우리를 대체하는 게 아니라는 겁니다. 오히려 반대예요. AI가 반복적 탐색 작업을 맡아주면서, 우리는 진짜 중요한 일 — 판단, 디테일, 구조적 정확성 — 에 더 집중할 수 있게 됩니다. 프롬프트 엔지니어링은 그 첫걸음입니다."

---

### SLIDE 32 — Q&A
# Q&A
## 질문 & 실습 안내

**추천 실습:**
1. 오늘 프롬프트 예시 3종 중 하나를 골라 나노바나나에서 직접 생성해보기
2. 결과물을 보고 라이팅/카메라/분위기 하나씩 바꿔보기
3. 마음에 드는 프롬프트를 팀 채널에 공유하기

**참고 자료:**
- Gemini (나노바나나): gemini.google.com
- Grok Imagine: grok.com
- ChatGPT: chatgpt.com

> **화자 노트:** "질문 받고, 시간이 되면 라이브 데모로 하나 직접 만들어보는 것도 좋습니다. 청중 중 한 명에게 배경 설정을 말해달라고 하고, 그 자리에서 프롬프트를 만들어 생성하면 임팩트가 큽니다."

---

## 부록: 슬라이드 구성 요약

| # | 제목 | 시간 | 비고 |
|---|------|------|------|
| 01 | 타이틀 | 0.5분 | |
| 02 | 현실 인식 | 1분 | 공감 유도 |
| 03 | 왜 지금인가 | 1.5분 | 수치 데이터 |
| 04 | PART 1 구분 | — | 전환 |
| 05 | 도구 비교 표 | 2분 | |
| 06 | 나노 바나나 상세 | 1.5분 | |
| 07 | Grok 상세 | 1.5분 | |
| 08 | PART 2 구분 | — | 전환 |
| 09 | 맥락이란 | 1.5분 | |
| 10 | 맥락 체크리스트 | 2분 | 핵심 슬라이드 |
| 11 | Before/After | 1.5분 | |
| 12 | PART 3 구분 | — | 전환 |
| 13 | 프롬프트 공식 | 1.5분 | |
| 14 | 환경 키워드 | 1분 | |
| 15 | 라이팅 키워드 | 1분 | |
| 16 | 카메라&재질 키워드 | 1분 | |
| 17 | 쓸모없는 키워드 | 1분 | |
| 18 | 네거티브 프롬프트 | 1분 | |
| 19 | PART 4 구분 | — | 전환 |
| 20 | 저작권 | 2분 | |
| 21 | 기술적 한계 | 2분 | 핵심 슬라이드 |
| 22 | 일관성 문제 | 1.5분 | |
| 23 | PART 5 구분 | — | 전환 |
| 24 | 4단계 워크플로우 | 1.5분 | 핵심 슬라이드 |
| 25 | Step 1 상세 | 1분 | |
| 26 | Step 2 상세 | 1.5분 | |
| 27 | Step 3~4 상세 | 1.5분 | |
| 28 | 프롬프트 예시 3종 | 2분 | |
| 29 | 반복 수정 전략 | 1분 | |
| 30 | 팀 활용 제안 | 1.5분 | |
| 31 | 정리 | 1분 | |
| 32 | Q&A | 2분+ | 라이브 데모 가능 |
