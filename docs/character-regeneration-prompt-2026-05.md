# Character Regeneration Prompt (2026-05) — Realistic Student Pass

## 0. 배경

2026-05-04 1차 재생성 결과(`game/public/images/characters/_review/2026-05-04-character-regeneration/`)는 **비주얼노벨 주연급 / 패션 일러스트 톤**으로 과도하게 양식화되었습니다.
중/고 캐릭터일수록 길쭉한 비례·날렵한 얼굴·새옷 같은 광택·모델 포즈가 두드러져, 학원물의 "평범한 학생" 톤과 어긋납니다.

**이번 라운드(2026-05-04-character-regeneration-realistic)의 목표**: 게임 톤(생활 시뮬·일상감)에 맞는 *ordinary Korean student* 비주얼로 재조정.

기존 `_review/2026-05-04-character-regeneration/` 폴더는 **삭제하지 않고 보존**(비교용).
새 결과물은 `_review/2026-05-04-character-regeneration-realistic/` 경로로 분리 저장.

## 1. 6축 보정 룰 (Global Anchor — 모든 캐릭터 공통)

### 1-1. 비율 (Proportion)

학년대별 차등을 **명시적으로 강제**합니다.

| 단계 | 등신 | 키 톤 |
|------|------|------|
| 초등 (Y1) | **5.8 ~ 6.3 heads tall** | 145~155cm 인상 |
| 중학 (Y2~Y4) | **6.5 ~ 7.0 heads tall** | 155~170cm 인상 |
| 고등 (Y5~Y7) | **6.8 ~ 7.2 heads tall** | 165~175cm 인상 |

`around 7 heads tall` 정도가 한국 학원물의 자연스러운 상한선이며, 이를 넘기면 즉시 패션 일러스트 톤으로 빠집니다.

### 1-2. 체형 (Body type)

- **DO**: 평균 키, 약간 어색한 성장기 비율, 살짝 짧은 다리, 자연스러운 어깨 폭
- **DON'T**: long legs, model-tall, lean fashion build, hourglass figure
- **DON'T**: chibi, super-deformed, cartoon-y short

### 1-3. 얼굴 (Face)

- **DO**: 평범한 학생 얼굴, 둥근 턱선, 미성숙한 인상(youthful), 살짝 둥근 볼
- **DON'T**: sharp jawline, pointy chin, mature/sexy features, idol-like beauty
- 눈은 기존 spec 유지 (warm brown, 단순 하이라이트, glossy 금지)
- 코는 최소 디테일

### 1-4. 의상 (Clothing)

- **DO**: 자연스럽게 살짝 헐렁하거나 평범한 핏, 일상적인 마모감
- **DO (중/고 교복)**: 약간 평범한 핏, 셔츠 살짝 구겨짐 허용, 새옷 같은 광택 금지
- **DO (초등)**: 캐주얼, 밝지만 과하지 않은 색감, 아동복 톤
- **DON'T**: 새 옷처럼 반짝이는 광택, fashion catalog, branded accessories 강조, perfect tailoring

### 1-5. 포즈 (Pose)

- **DO**: 자연스러운 증명사진/학생부 스냅 톤, 약간 어색한 standing
- **DO**: 무게중심 한쪽 다리, 손은 자연스럽게 옆 또는 가볍게 포즈
- **DON'T**: model pose, runway pose, dynamic action pose, hand-on-hip glamour pose
- **DON'T**: 카메라 정면 응시 + 한쪽 미소 같은 패션 화보 톤

### 1-6. 렌더링 (Rendering)

- **DO**: ordinary Korean school student, slice-of-life anime style
- **DO**: 살짝 무광 셀쉐이딩, 자연스러운 톤
- **DON'T**: fashion illustration, idol promo art, glossy magazine cover, dramatic rim lighting
- **DON'T**: painterly photoreal, ultra-detailed jewelry/accessories

## 2. Negative Anchor (모든 프롬프트 끝에 강제 첨부)

```
NEGATIVE: model-like, fashion illustration, idol-style, glamour pose,
long legs, hourglass figure, sharp pointy jaw, mature features, sexy,
glossy magazine cover, runway, perfect tailoring, branded fashion,
8 heads tall, oversaturated promo art
```

## 3. 학년대별 Positive Anchor 스니펫

### 초등 (Elementary, age 11-12)

```
A 5.8 to 6.3 heads tall body proportion, ordinary Korean elementary
school child, slightly chubby cheeks, youthful face, casual everyday
clothing, awkward growing-body proportions, slice-of-life anime style,
not fashion illustration, not model-like
```

### 중학 (Middle school, age 13-15)

```
A 6.5 to 7.0 heads tall body proportion, ordinary Korean middle school
student, plain school uniform with relaxed (slightly loose) fit,
slightly youthful face, average build, natural standing pose, not model
proportions, slice-of-life anime style
```

### 고등 (High school, age 16-18)

```
Around 7 heads tall (6.8 to 7.2), ordinary Korean high school student,
plain school uniform, average build, slightly mature but not glamorous,
natural awkward standing pose, slice-of-life anime style, not fashion
illustration, not idol-like
```

## 4. 학년대 분리 정책 (2026-05 변경)

**이전(spec v1)**: 캐릭터당 비초등 이미지 1장(`{id}_fullbody.png`)이 중·고 6년을 모두 커버.
**이번(spec v2)**: 등장 시점에 따라 학년대별로 이미지를 분리해 7년에 걸친 노화감을 표현.

### 4-1. 등장 시점 그룹별 자산 매트릭스

| 그룹 | 캐릭터 | 초 (Y1) | 중 (Y2~Y4) | 고 (Y5~Y7) |
|------|--------|--------|--------|--------|
| **그룹 1 — 고등 등장** | junha, siwoo, yerin | — | — | ✅ 1장 |
| **그룹 2 — 중학 등장** | haeun, seoa | — | ✅ | ✅ (신규) |
| **그룹 3 — 초등 등장** | player_m, player_f, jihun, subin, minjae, yuna, doyun | ✅ | ✅ | ✅ (신규) |

총 추가되는 신규 자산:
- 그룹 2 high: 2명 → fullbody 2장 + portrait 2장 = **4장**
- 그룹 3 high: 7명 → fullbody 7장 + portrait 7장 = **14장**
- **합계: 18장 신규**

### 4-2. 검수 폴더 12장 평가

#### P0 — 즉시 재생성 (패션 일러스트 톤이 강함)

| ID | 단계 | 문제 |
|----|------|------|
| **junha** | 고등 | 검정 정장 + 모자 + 가방 → 패션 화보 톤. 등신·옷 과도함 |
| **siwoo** | 고등 | 길쭉 + 슬림 + 모델 톤. "평범한 관찰자" 인상이 안 살음 |
| **yerin** | 고등 | 광택 옷 + 정돈된 모델 포즈, 너무 idol-like |
| **seoa** | 중학 | 길쭉 + 헤어 광택 + 화보 분위기 |

#### P1 — 톤 다듬기 (대체로 ok이나 살짝 과함)

| ID | 단계 | 메모 |
|----|------|------|
| **doyun** (중) | 중학 | 정장 너무 깔끔. 약간 헐렁하게. 라벨도 "중/고" → "중학" 정정 |
| **doyun_elementary** | 초등 | 갈색 코트(?) 의상이 부자연. 초등은 jersey/캐주얼이 spec |
| **minjae_elementary** | 초등 | 빨강 후드 ok. 살짝 패션 톤 줄이기 |

#### P2 — 보존 후보 (수용 가능 수준)

| ID | 단계 | 메모 |
|----|------|------|
| jihun_elementary | 초등 | 농구공 + 점퍼, 톤 무난 |
| subin_elementary | 초등 | 단정·자연스러움 |
| yuna_elementary | 초등 | 캐주얼 톤 ok |
| player_m_elementary | 초등 | 무난 |
| player_f_elementary | 초등 | 무난 |

#### P3 — 신규 생성 (이번 라운드 함께)

**그룹 2 신규**

| ID | 단계 | 메모 |
|----|------|------|
| haeun | 중학 | spec 5-4 참고. production 외형 기준: dark brown bob + 안경 + 빨간 책. yuna와 명확히 차별화 |
| haeun | **고등 (신규)** | 17~18세 톤. bob + 안경 + 빨간 책 유지, 약간 더 차분 |
| seoa | **고등 (신규)** | 17~18세. 여전히 reserved, 살짝 어른스러운 분위기 허용 |

**그룹 3 신규 (high 7장)**

| ID | 단계 | 메모 |
|----|------|------|
| player_m | 고등 (신규) | 17~18세 평범한 학생, 키 +5cm 인상 |
| player_f | 고등 (신규) | 동상 |
| jihun | 고등 (신규) | 농구공 키체인 유지, 어깨 살짝 더 넓게 |
| subin | 고등 (신규) | bob + 별귀걸이 유지, 살짝 차분 |
| minjae | 고등 (신규) | 버즈컷 + 그을린 피부 유지, 더 자신감 |
| yuna | 고등 (신규) | 캐러멜 웨이브 + 별 클립 유지, 살짝 침착 |
| doyun | 고등 (신규) | 깔끔 + soccer 키체인 유지, 약간 더 어른 톤 |

## 5. 캐릭터별 재생성 프롬프트 (P0/P1만 명시)

기존 `character-prompt-spec.md`의 캐릭터 디테일(머리·눈·액세서리)은 유지하되, **앞서 1~3절의 보정 룰을 prompt 머리에 prepend**합니다.

### 5-1. junha (고등) — P0

```
[Apply §3 high-school anchor]
[Apply §1 6-axis correction]

Anime-style Korean high school boy, 17 years old, transfer student.
Around 7 heads tall (NOT 8), ordinary student build, slightly awkward
stance — NOT a model.

- Hair: short dark brown, slightly messy, unstyled — no product shine
- Eyebrows: thicker and straighter
- Face: youthful, slightly rounded jaw (NOT sharp), earnest expression
- Build: sturdy average, broad-ish shoulders for his age, NOT lean-tall
- Outfit: navy blazer slightly ill-fitting (recently transferred),
  white shirt slightly wrinkled, dark pants, plain worn sneakers
  — NO fashion accessories, NO hat, NO premium bag
- Pose: one hand scratching back of head awkwardly, weight on one leg,
  natural standing — NOT a runway pose
- Expression: awkward warm smile, trying to fit in
- Background: solid #ff00ff (magenta) for chroma keying
- Size: 1024x1536

NEGATIVE: model-like, fashion illustration, idol-style, glamour pose,
long legs, sharp pointy jaw, mature features, glossy magazine cover,
runway, perfect tailoring, branded fashion, 8 heads tall, hat, suit
```

### 5-2. siwoo (고등) — P0

```
[Apply §3 high-school anchor]
[Apply §1 6-axis correction]

Anime-style Korean high school boy, 16 years old, calm observer.
Around 7 heads tall (NOT 7.5+), ordinary slim build (NOT lean-tall
model), slightly slouched.

- Hair: medium-length dark brown covering forehead, natural messy
  (NOT salon-styled)
- Eyes: sharp but calm dark brown, observant, slightly guarded
- Face: youthful, soft jaw — NOT chiseled
- Build: average to slightly lean, NORMAL student proportions, NOT
  catwalk-tall
- Outfit: navy blazer worn casually (top button undone), white shirt,
  dark pants, plain sneakers — sleeves slightly too long, lived-in look
- Accessory: silver tumbler hanging from bag strap (modest)
- Pose: hands in pockets, weight on one leg, relaxed but distant —
  NOT model lean
- Expression: reserved half-smile, observing
- Background: solid #ff00ff
- Size: 1024x1536

NEGATIVE: model-tall, fashion illustration, idol-style, lean runway
build, sharp jawline, mature glamour, perfect hair, polished sneakers,
8 heads tall, brand catalog
```

### 5-3. yerin (고등) — P0

```
[Apply §3 high-school anchor]
[Apply §1 6-axis correction]

Anime-style Korean high school girl, 16 years old, polished but still a
student. Around 6.8~7 heads tall, average build (NOT slim-tall model),
youthful face.

- Hair: medium-length dark brown, neatly styled with slight wave at
  ends — well-groomed but not salon-glossy
- Eyes: bright sharp brown, intelligent
- Face: youthful, soft jaw, polite smile with subtle dimples — NOT
  glamorous
- Build: average height, slim-normal (NOT model-thin)
- Outfit: navy blazer fitted but NOT tailored-perfect, white shirt with
  red ribbon, plaid skirt at normal length, plain loafers — uniform
  looks like everyday wear, not catalog
- Accessory: simple modest backpack (NOT branded), small planner held
  at waist, simple stud earrings (NOT statement jewelry)
- Pose: poised standing with planner at waist, weight on one leg,
  natural — NOT runway
- Expression: polite calculated smile (subtle), composed
- Background: solid #ff00ff
- Size: 1024x1536

IMPORTANT: Must NOT look like subin (subin = bob + star earrings).
Differentiation: longer wavy hair, simple stud (NOT statement) earrings,
planner instead of notebook.

NEGATIVE: model-like, fashion illustration, idol, runway, glamour pose,
mature sexy features, sharp jaw, hourglass, branded designer bag,
glossy magazine, 8 heads tall, perfect tailoring, statement jewelry
```

### 5-4. seoa (중학) — P0

```
[Apply §3 middle-school anchor]
[Apply §1 6-axis correction]

Anime-style quiet Korean middle school girl, 14 years old, reserved.
Around 6.5~7 heads tall, slim-average build (NOT model-slim), youthful
delicate face.

- Hair: long straight dark brown past shoulders, simple hair clip on
  one side — natural, NOT salon shine
- Eyes: deep brown, thoughtful, slightly dreamy
- Face: youthful soft jaw, faintly shy
- Build: slim average middle-school girl, NOT tall lean
- Outfit: navy blazer buttoned up neatly, white shirt with red ribbon,
  plaid skirt normal length, plain loafers — uniform looks lived-in
- Accessory: earphone cord visible from blazer pocket, thin notebook
  at side
- Pose: slightly turned body, one hand holding notebook at hip, subtle
  shy smile — NOT model pose
- Expression: calm observant, looking slightly to side
- Background: solid #ff00ff
- Size: 1024x1536

IMPORTANT: Must NOT look like yuna (caramel hair + star clip + bright).
Differentiation: longer straight darker hair, simple clip, dreamy/shy
vs energetic.

NEGATIVE: model-like, fashion, idol-style, glamour, mature features,
hourglass, sharp jaw, perfect glossy hair, 8 heads tall, runway,
catalog
```

### 5-5. doyun (중학) — P1

```
[Apply §3 middle-school anchor]
[Apply §1 6-axis correction]

Anime-style reliable Korean middle school boy, athletic but not model.
Around 6.7~7 heads tall, sturdy student build (NOT lean-tall),
youthful clean-cut face.

- Hair: short neat black, slightly side-parted — natural cut, NOT
  styled-with-product
- Eyes: clear warm brown, dependable
- Face: youthful slightly rounded jaw, friendly
- Build: athletic average, broad-ish shoulders — NOT runway-tall
- Outfit: navy blazer neatly worn but NOT tailored-perfect, white
  shirt, dark pants, clean-but-worn white sneakers — looks like daily
  wear
- Accessory: small soccer ball keychain on bag, red captain armband
  peeking from pocket (modest)
- Pose: standing tall with arms relaxed at sides, natural leader vibe
  — NOT a hero pose
- Expression: friendly confident smile, approachable
- Background: solid #ff00ff
- Size: 1024x1536

IMPORTANT: Must NOT resemble jihun (messy + casual + playful).
Differentiation: neat hair, clean-cut, composed leader.

NEGATIVE: model-like, fashion, idol-style, glamour pose, lean runway
build, sharp jaw, glossy hair, branded sneakers, 8 heads tall, suit
```

### 5-6. doyun_elementary — P1

```
[Apply §3 elementary anchor]
[Apply §1 6-axis correction]

Same boy at age 11-12. 5.8~6.2 heads tall, slightly chubby cheeks,
brighter pure energy.

- Hair: same neat black, slightly less styled
- Outfit: green soccer jersey shirt, athletic shorts, grass-stained
  white sneakers — child-like, NOT fashion
- Accessory: soccer ball under arm
- Pose: standing with one foot on soccer ball, hands on hips —
  child-natural, NOT model
- Expression: bright confident smile, golden boy of the class
- Background: solid #ff00ff
- Size: 1024x1536

NEGATIVE: model-like, fashion illustration, mature features, long legs,
suit, formal coat, 7+ heads tall, glamorous
```

### 5-7. minjae_elementary — P1 (톤만 다듬기)

```
[Apply §3 elementary anchor]
[Apply §1 6-axis correction]

Same boy at age 11-12. 5.8~6.2 heads tall, rounder face, energetic.

- Hair: same very short buzz cut, dark brown
- Skin: slightly tanned (warm beige, NOT dramatic)
- Outfit: bright but normal red hoodie, plain shorts, simple sporty
  sneakers — child everyday wear, NOT fashion
- Pose: arms crossed or hands on hips, confident kid stance
- Expression: big cheerful grin, class-clown energy
- Background: solid #ff00ff
- Size: 1024x1536

NEGATIVE: model, fashion, idol kids, glamour, long legs, branded
streetwear, 7+ heads tall
```

### 5-8. 고등(High) 변형 — 그룹 2/3 공통 템플릿

§4-1에 표기된 신규 9장(그룹2 haeun·seoa, 그룹3 player_m/f·jihun·subin·minjae·yuna·doyun)은 **각 캐릭터의 기존 외형 spec**(`character-prompt-spec.md` §5)에 다음 anchor를 prepend하여 생성합니다.

#### 공통 prepend 블록 (모든 high 변형)

```
[Apply §3 high-school anchor]
[Apply §1 6-axis correction]

This is the SAME character as the middle-school version, aged 17~18.

Aging rules from middle-school version to high-school version:
- Body: +5cm height inference (NOT proportionally taller — STILL 6.8~7.2 heads)
- Face: slightly less rounded jaw, slightly more defined features —
  but STILL youthful, NOT mature/glamorous
- Hair: same color/style/length as middle-school version, slightly
  more settled (less child-like volume)
- Outfit: same school uniform style but slightly more lived-in/worn
  — uniform looks like it has been worn for years
- Pose: same character pose archetype, slightly more composed
- Accessories: same accessories as middle-school version (keychain,
  earrings, hair clip, etc. all preserved)
- Personality cue: slightly more settled / more aware version of the
  same personality

CRITICAL: This must be visually recognizable as the SAME person
two years older. Do NOT redesign hair color, do NOT redesign accessories,
do NOT change skin tone, do NOT add new fashion elements.

[Then append the character's existing detail spec from
character-prompt-spec.md §5, but replacing "middle school" wording
with "high school" and using the high-school school uniform note from
character-prompt-spec.md §4]

NEGATIVE: model-like, fashion illustration, idol-style, glamour pose,
long legs, hourglass figure, sharp pointy jaw, mature sexy features,
8 heads tall, redesigned hair, redesigned accessories, branded fashion,
runway pose, perfect tailoring
```

#### 캐릭터별 추가 메모 (high 변형 시 강조점)

| ID | 추가 메모 |
|----|----------|
| **player_m (고)** | 키 살짝 +, 어깨 살짝 더 발달. 표정·머리·옷 spec 동일 |
| **player_f (고)** | 키 살짝 +, 헤어 길이 동일. 표정·옷 spec 동일 |
| **jihun (고)** | 어깨 더 넓어짐 (athletic 강조 자연스럽게). 농구공 키체인 유지 |
| **subin (고)** | bob 길이 동일, 별 귀걸이 유지. 살짝 더 차분 |
| **minjae (고)** | 버즈컷 + 그을린 피부 유지. 자신감 살짝 더 |
| **yuna (고)** | 캐러멜 웨이브 + 별 클립 + bracelet 유지. 살짝 침착 |
| **doyun (고)** | 깔끔 사이드파트 + soccer 키체인 + captain 암밴드 유지 |
| **haeun (고)** | dark brown bob + 안경 + 빨간 책 유지. yuna 요소(caramel hair, star clip, sketchbook, bracelet, waving) 금지 |
| **seoa (고)** | 긴 직모 + 이어폰 + 노트북 유지 (dreamy reserved 톤 유지). 약간 어른 침착함 허용 |

## 6. 출력 규칙

### 6-1. 파일 컨벤션 (spec v2)

| 학년 | Fullbody | Portrait |
|------|----------|----------|
| 초등 (Y1) | `{id}_elementary_fullbody.png` | `{id}_elementary_neutral.png` |
| 중학 (Y2~Y4) | `{id}_fullbody.png` (의미 명확화 — middle 전용) | `{id}_neutral.png` |
| 고등 (Y5~Y7) | `{id}_high_fullbody.png` (**신규**) | `{id}_high_neutral.png` (**신규**) |

**기존 production 파일 영향**: 없음. `{id}_fullbody.png`는 그대로 middle 의미로 재정의되며, high만 신규 추가됨. 따라서 백워드 호환 ✓.

**`getNpcImage` 폴백 권장 순서** (자산 도착 후 코드 작업):

```
year >= 5 (Y5~Y7):
  1순위: {id}_high_fullbody.png
  2순위: {id}_fullbody.png  (high 자산 미준비 캐릭터 폴백)
year >= 2 (Y2~Y4):
  1순위: {id}_fullbody.png
year == 1:
  1순위: {id}_elementary_fullbody.png
  2순위: {id}_fullbody.png  (elementary 미준비 캐릭터 폴백)
```

### 6-2. 검수 폴더 출력

- 경로: `game/public/images/characters/_review/2026-05-04-character-regeneration-realistic/`
- 하위: `source/` (마젠타 배경), `fullbody/` (배경 제거), `portrait/` (상반신, 파스텔 그라데이션)
- manifest.json + README.md 생성
- contact_sheet_fullbody.png + contact_sheet_portrait.png 생성

### 6-3. 이번 라운드 생성 목록 (총 24장)

**재생성 (P0/P1)** — 12장 fullbody + 12장 portrait의 갱신
- junha (고), siwoo (고), yerin (고)
- seoa (중)
- doyun (중), doyun_elementary, minjae_elementary
- (P2 보존 5장은 재생성 권장이지만 톤 일관성 위해 함께 뽑아도 OK)

**신규 — 그룹 2 high (4장)**
- haeun_high_fullbody, haeun_high_neutral
- seoa_high_fullbody, seoa_high_neutral

**신규 — 그룹 3 high (14장)**
- player_m, player_f, jihun, subin, minjae, yuna, doyun × {fullbody, neutral} = 14장

## 7. 검수 체크리스트

### 7-1. 단일 이미지 (각 생성 직후)

- [ ] 등신이 §1-1 표 범위 안인가? (특히 7등신 이하)
- [ ] 다리 길이가 비정상적으로 길지 않은가?
- [ ] 얼굴이 sharp/mature가 아닌 youthful한가?
- [ ] 옷이 새 옷처럼 광택 나지 않는가?
- [ ] 포즈가 모델/런웨이 톤이 아닌가?

5개 중 1개라도 실패 → 재생성.

### 7-2. 학년대 연속성 (그룹 2/3 한정)

같은 캐릭터의 초→중→고 또는 중→고 변형이 같은 사람으로 보이는지:

- [ ] 머리 색·길이·스타일이 동일 (자연 성장만 허용)
- [ ] 눈 색·모양 동일
- [ ] 피부 톤 동일
- [ ] 액세서리 동일 (별 클립, 농구 키체인, 별 귀걸이, 캡틴 암밴드, 안경 등)
- [ ] 차별화 포인트 유지 (예: doyun=neat / jihun=messy, yuna=caramel star clip / haeun=dark brown bob + glasses + red book)
- [ ] 등신은 단계별로 자연스럽게 증가 (초 5.8~6.3 → 중 6.5~7 → 고 6.8~7.2)

1개라도 실패 → 해당 단계 재생성.

## 8. 본 채택 기준

`character-prompt-spec.md` 안의 기존 디테일 spec(머리/눈/액세서리/차별화 포인트)은 유지.
이 문서(2026-05)는 그 위에 *덧씌우는 톤 보정 가이드*로만 작동합니다.

본 채택(`game/public/images/characters/`로 승격) 시 절차:

1. 검수 폴더에서 P0/P1 + §7-1 + §7-2 모두 통과한 결과만 선택
2. 기존 production 파일과 1:1 비교 (등신·톤·일관성)
3. 채택 시 git mv 또는 cp 후 production 위치에 배치
4. **`getNpcImage` 분기 추가 작업 (별도 PR)**: §6-1 폴백 순서 구현
   - high 자산이 모든 캐릭터에 갖춰지지 않은 시점에도 `{id}_fullbody.png` 폴백으로 안전 동작
   - 그룹 1(junha/siwoo/yerin)은 high 전용이라 `_high_` 없이 `_fullbody.png`만 보유 → 폴백 자체로 정상 동작

## 9. Promotion 현황 (2026-05-06 기준)

### ✅ 채택 완료 — production 반영

| 자산 | PR | 비고 |
|---|---|---|
| `jihun_elementary_fullbody_f.png` | #90 | 여자 주인공 전용 변주 |
| `_high_fullbody.png` × 9 (jihun/subin/minjae/yuna/haeun + doyun/seoa + player_m/player_f) | #92 | EventScene/GameScreen `year>=5` 분기 추가 포함 |
| `_high_neutral.png` × 7 (jihun/subin/minjae/yuna/haeun + player_m/player_f) | #94 | 풀바디와 톤 통일 |
| `junha_fullbody.png` / `junha_neutral.png` (base) | (현재) | 그룹 1 정책에 따라 `_high_` 없이 base만 보유 (Y5+ 폴백으로 동작) |

### 🟡 보류 (검토 필요)

- `minjae_elementary_fullbody.png` / `minjae_elementary_neutral.png` — Y1 컷에서 다른 elementary(jihun base / subin / yuna anime 톤)와 같이 등장 시 톤 mismatch 우려. 다른 elementary 일괄 realistic 통일 결정 시 함께 처리.

### 📦 archive 보존 (미사용 자산 — 향후 NPC 추가 대비)

`game/public/images/characters/_archive/2026-05-04-character-regeneration-realistic/`
- doyun (elementary/base/high) — 게임 NPC 아님
- seoa (base/high) — 게임 NPC 아님
- siwoo (base) — 게임 NPC 아님
- yerin (base) — 게임 NPC 아님

향후 이 NPC들이 게임에 추가되면 archive에서 promote 가능.

### ❌ 폐기

- `haeun_high_fullbody_REJECTED_v1.png` (Yuna-like 톤 잘못 생성) — 삭제 완료
- `haeun_high_fullbody_source_magenta_REJECTED_v1.png` — 삭제 완료
