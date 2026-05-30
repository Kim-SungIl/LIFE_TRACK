# LIFE TRACK - Character Image Generation Prompt (Final)

---

## 1. Global Style Anchor (ALL CHARACTERS MUST FOLLOW)

```
Anime-style Korean visual novel character.

- Clean thin lineart (uniform line weight)
- Soft cel-shading (2~3 layers, smooth transitions)
- Semi-realistic anime style (not chibi, not overly stylized)
- Natural skin tone with soft blush
- Minimal nose detail
- Brown eyes with simple highlights (not glossy)
- Soft rounded jawline
- Consistent face proportions across all characters

Lighting:
- Soft, even lighting
- No strong directional shadows

Color:
- Slightly muted tones (natural, not overly saturated)

IMPORTANT:
All characters MUST share the same base face style.
Only vary details like hair, expression, accessories, and personality.
```

---

## 2. Image Type Rules

### Full Body (transparent background)

```
- Full body (head to shoes visible)
- Natural standing pose (slightly asymmetrical, weight shifted to one leg)
- Hands relaxed or lightly posed
- Background: pure white (#FFFFFF) -> remove.bg 등으로 배경 제거
- Output: PNG, transparent background (RGBA), 800x1400px (2:3)
```

### Portrait (upper body)

```
- Chest-up framing
- Same face proportions as full-body version
- Slight angle toward camera
- Neutral soft expression
- Background: soft pastel gradient (light pink / sky blue tone) — KEEP as final background, do NOT remove
- Output: PNG, 2:3 ratio
```

> Full Body → white bg → removed → transparent (Section 9).
> Portrait / neutral → pastel gradient → **kept** (no removal). Mixing these up is what caused the 2026-05-20 white-fringe defect.

---

## 3. Character Differentiation Rules

Characters differ ONLY by:
- Hair shape / length / texture / color
- Eyebrow thickness and angle
- Eye shape (slightly round vs narrow)
- Expression tone
- Pose and body language
- Accessories (earrings, glasses, hair clips, bags, etc.)

DO NOT CHANGE:
- Face base proportions
- Eye rendering style
- Shading style
- Overall art style

---

## 4. School Level Outfit Rules

### Elementary School (Year 1 = Grade 6)

```
- NO school uniform
- Casual clothing: hoodie, t-shirt, jeans, sneakers
- Brighter and slightly more playful colors
- Slightly rounder face, softer proportions
- More innocent and expressive facial tone
```

### Middle School (Year 2~4 = Grade 7~9)

```
Male: navy blazer + white shirt (no tie) + dark pants + sneakers/loafers
Female: navy blazer + white shirt + red ribbon + plaid skirt + loafers + knee socks
```

### High School (Year 5~7 = Grade 10~12)

```
Same uniform as middle school, but:
- Slightly taller and more mature proportions
- Subtly more serious/mature expression
- Uniform may appear slightly more worn or personalized
```

---

## 4.5 Cross-Stage Face Consistency (CRITICAL)

**같은 캐릭터의 모든 학년 단계(elementary / middle / high) 이미지는 단일 face base를 공유해야 한다.**
2026-05-18 발견: `player_m_high_fullbody.png`가 다른 모델로 생성되어 face proportion/art style이 `player_m_fullbody.png` 및 `player_m_high_neutral.png`와 어긋남. 이런 화풍 분리를 막기 위한 규칙.

### Reference 우선순위 (재생성·신규 생성 모두)

1. **얼굴 absolute reference**: 같은 캐릭터의 `*_fullbody.png` (Middle School 단계)
   - 모든 신규 stage(elementary, high)는 이 얼굴을 1픽셀도 안 바꾼다는 가정으로 생성
2. **의상/구도 reference**: 같은 캐릭터의 다른 stage 이미지 (의상 규칙 따라 변경)

### 학년 간 허용 변경 / 금지 변경

```
✅ ALLOWED across stages:
- Slightly more mature body proportions (jaw line, shoulders)
- Slightly more composed / mature expression tone
- Outfit details per Section 4 (elementary casual / middle uniform / high uniform with marks)
- Yuna-style intentional growth (e.g., hair length change) ONLY if narratively justified

❌ FORBIDDEN across stages:
- Face shape change (round → elongated, etc.)
- Eye shape change (large → narrow, etc.)
- Art style drift (soft anime → semi-realistic, etc.)
- Hair cut change (unless intentional growth narrative)
- Skin tone shift
```

### Prompt에 반드시 명시할 문장

```
Maintain EXACT same face proportions, eye shape, jawline, art style, and skin tone
as in [reference filename]. Only allowed differences: slight maturity in body proportions,
slightly more composed expression, stage-appropriate outfit per Section 4.
```

### Negative prompt 예시

```
different face shape, different eye shape, photorealistic style,
different art style, mature face on young character,
inconsistent character design
```

---

## 5. Character Prompts

---

### 5-1. Player Characters

---

#### player_m (남자 주인공)

> **Differentiation from minjae:** player_m is the "everyman" baseline — NO glasses, NO notebook prop, soft approachable but slightly mature smile. Hair has clear soft center part (vs minjae's side-part). minjae 항목 참조.

> **Differentiation from jihun (CRITICAL — 단체씬에서 자주 혼동):** 후드티 색만 다르게 해서 차별화하면 단체씬에서 결국 비슷하게 묶임. **의상 카테고리 자체를 분리**하고, prop은 맥락에 맞을 때만 사용:
>
> | 마커 | player_m | jihun |
> |---|---|---|
> | **의상 카테고리** | **Casual everyday wear** (T+청바지, 카디건, 셔츠, 가벼운 코트) | **Sportswear** (athletic/track 라인) |
> | 의상 색조 | **Muted GREY/BEIGE/dark neutral 우선** (NOT navy/blue 톤 — navy/blue는 jihun royal blue와 색조 겹침 위험) | Bright/saturated (royal blue, white, red accent) |
> | 헤어 | Soft center part, neat | Messy bangs |
> | 체형 | Average | Athletic, 약간 더 큰 키, 넓은 어깨 |
> | Prop | **NO prop** (손 자유 또는 포켓) | **맥락 의존** — 야외 운동·등하교 등에서 농구공(남주)/배드민턴 라켓(여주). 식사·실내 정적·졸업 등에서는 옆에 두거나 생략 (가방 strap의 농구공 keychain이 fallback 식별 cue) |
> | 분위기 | 차분 baseline | 활발 energetic |
>
> **핵심**: 둘 다 "후드티 + 청바지"라는 default가 사라져야 함. 후드티를 입어야만 하는 경우(쌀쌀한 계절)에도 jihun은 athletic zip-up, player_m은 모직/캐주얼 외투가 자연.
>
> 단체씬(first-week, jihun-call, spring-picnic, graduation 등)에서 두 캐릭터를 그릴 때 위 마커가 시각적으로 모두 살아 있어야 함.
>
> **계절 의상 분기 (둘 다)** — 자세한 규칙은 `event-cg-prompts-y1.md` "계절 의상 주의" 섹션 참조:
> - 봄/초가을 (선선): 가벼운 zip-up / 카디건 / 트랙 jacket
> - **여름 (더움)**: **반드시 T-shirt + 반바지/쇼츠** (후드티 금지)
> - 늦가을/겨울: 두꺼운 외투 (player_m=모직 코트, jihun=패딩)

**Actual Image:** natural medium-length black hair with soft center part (slightly fuller bangs covering part of forehead, NOT closely cropped), warm brown eyes, soft jawline, gentle and slightly mature half-smile. Navy blazer, white shirt, dark pants, black loafers. NO glasses, NO hand prop.

**Full Body (middle school)**
```
Anime-style Korean middle school boy, average height and build, neutral friendly expression.
- Hair: natural medium-length black hair, soft center part, fuller bangs lightly covering forehead (NOT neat short crop)
- Eyes: warm brown eyes, gentle and approachable
- Build: average height and build, not athletic, not thin
- Outfit: navy blazer fully buttoned, white shirt (NO tie at middle stage), dark pants, black loafers
- Pose: natural standing, one hand in pocket, slight smile
- Expression: soft, calm, slightly mature half-smile — the "everyman" protagonist with quiet charm
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Calm and friendly slightly mature expression, soft half-smile.
Background: soft pastel pink-blue gradient.
```

**Full Body (high school)**
```
Same character at age 16-18. Slightly taller and more mature proportions.
- Hair: same natural medium-length black with soft center part
- Outfit: navy blazer (top button optionally unbuttoned for slight casual smart vibe), white shirt with top button possibly relaxed, **navy tie**, dark pants, black loafers
- Accessory: **small gold-embroidered school crest emblem on left chest pocket** (subtle laurel + crown motif)
- Pose: natural standing, hand in pocket or both hands relaxed
- Expression: slightly more composed than middle stage, gentle half-smile
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Full Body (elementary) — character sheet baseline**
```
Same boy at age 11-12. Rounder face, slightly shorter.
- Hair: same natural medium-length black with soft center part, slightly messier and shorter
  (NOT messy bangs — that is jihun's marker)
- Outfit category: CASUAL EVERYDAY WEAR (NOT sportswear — sportswear is jihun's marker)
- Baseline outfit (시트 표준): **LIGHT GREY or BEIGE zip-up hoodie** (NOT navy, NOT blue tones
  — navy/blue는 jihun의 royal blue와 색조 겹침 위험) over **white or light grey T-shirt**,
  dark indigo jeans, plain white sneakers.
  (CG에서는 계절에 맞춰 outer를 변형 — 아래 참조).
- Pose: natural standing, hands at sides or one hand in pocket (NO prop, NO ball, NO racket)
- Expression: brighter, more innocent smile but composed (less energetic than jihun)
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**계절별 의상 (CG 생성 시 적용)**
```
- 봄/초가을 (W1-W10, W31): light grey or beige zip-up over 흰/light grey T + 청바지
  (NOT navy zip-up — color clash with jihun's royal blue)
- 여름 (W11-W30): muted grey/beige crewneck T-shirt + 청 반바지 또는 면 반바지
  (반드시 hoodie 금지)
- 늦가을 (W32-W40): 베이지/grey 카디건 또는 셔츠 + T + 긴바지
- 겨울 (W41-W48): 베이지/카멜 모직 코트 또는 더플코트 + 머플러 + 긴바지
  (NOT 패딩 — 패딩은 jihun athletic 마커)
```

> 차별화 마커는 위 player_m 섹션 상단의 "Differentiation from jihun" 표 참조.

---

#### player_f (여자 주인공)

**Actual Image:** medium-length dark brown straight hair (shoulder length), warm brown eyes, average build, gentle smile. Navy blazer, white shirt, red ribbon, plaid skirt, loafers, dark knee socks. Hands clasped in front.

**Full Body (middle school)**
```
Anime-style Korean middle school girl, average height, gentle presence.
- Hair: medium-length dark brown hair, straight, shoulder length
- Eyes: warm brown eyes, calm and kind
- Build: average height and build
- Outfit: navy blazer, white shirt with red ribbon, plaid skirt, brown loafers, dark knee socks
- Pose: hands clasped lightly in front, natural standing
- Expression: soft neutral smile, warm gaze
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Warm and calm expression, slight smile.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same girl at age 11-12. Rounder face, slightly shorter.
- Hair: same dark brown straight hair, slightly shorter (above shoulders)
- Outfit: light pink cardigan over white t-shirt, denim skirt, white sneakers
- Pose: hands clasped in front, slight tilt of head
- Expression: innocent and warm smile
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

---

### 5-2. Year 1 NPCs (Elementary start)

---

#### jihun (한지훈) — Childhood best friend, athletic, energetic

**Actual Image:** messy short black hair, bright lively brown eyes, athletic build, confident grin showing teeth. Navy blazer open/casual, white shirt, dark pants, white sneakers. Basketball keychain on bag strap. One hand in pocket.

**Full Body (middle school)**
```
Anime-style energetic Korean middle school boy, athletic build, taller than average.
- Hair: short messy black hair, slightly spiky
- Eyes: bright brown eyes, energetic and lively expression
- Build: athletic, taller than average, broad shoulders for his age
- Outfit: navy blazer worn casually (slightly open), white shirt, dark pants, white sneakers
- Accessory: basketball keychain hanging from school bag strap
- Pose: one hand in pocket, relaxed confident standing, weight on one leg
- Expression: confident friendly grin showing teeth
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Bright energetic grin, basketball visible on bag strap.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary) — character sheet baseline**
```
Same boy at age 11-12. Slightly shorter, rounder face, even more carefree.
- Hair: same messy black hair, slightly longer, messy bangs that fall over forehead
  (NOT center part — center part is player_m's marker)
  (⚠️ HAIR COLOR = BLACK, NOT brown/caramel — 초등 단계에서 갈색으로 드리프트한 사고 재발 방지.
   middle/high 가 검정이므로 초등도 반드시 검정으로 통일)
- Outfit category: SPORTSWEAR (athletic/track 라인 — NOT casual everyday;
  casual everyday is player_m's marker)
- Baseline outfit: royal blue athletic zip-up hoodie with white sleeve stripe + pure white
  T-shirt + black track pants with white side stripe + sporty sneakers
  (이게 sheet 표준. 실제 CG에서는 계절에 맞춰 변형 — 아래 참조).
- Accessory (맥락 의존): 야외 운동·등하교 등에서 농구공(남주 시나리오) 또는 배드민턴 라켓
  (여주 시나리오). 식사·실내 정적·졸업 등에서는 옆에 두거나 생략. 가방 strap의 농구공
  keychain이 fallback 식별 cue.
- Pose: casual standing, free hand waving, weight shifted (NOT static neutral stance)
- Expression: big innocent grin, full of energy (clearly more energetic than player_m's
  composed half-smile)
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**계절별 의상 (CG 생성 시 적용)**
```
- 봄/초가을 (W1-W10, W31): royal blue athletic zip-up + 흰 T + 트랙팬츠
- 여름 (W11-W30): athletic 단색 T-shirt (royal blue, red 등 sporty accent) + 트랙 쇼츠
  또는 운동용 반바지 (반드시 hoodie 금지). 농구 jersey 옵션도 OK.
- 늦가을 (W32-W40): athletic zip-up 또는 트랙 jacket + 긴 트랙팬츠
- 겨울 (W41-W48): athletic 패딩 (sporty 디자인) + 모자/머플러 + 트랙팬츠
  (NOT 모직 코트 — 모직 코트는 player_m casual 마커)
```

> 차별화 마커는 player_m 섹션의 "Differentiation from jihun" 표 참조. 단체씬 prompt에서는 위 마커가 모두 살아 있어야 함. **농구공/라켓은 맥락 의존이지 항상 휴대 아님** — minjae 노트 항상 휴대로 부자연이 생긴 사례 참고 (PR #164).

---

#### subin (오수빈) — Academy friend, calm, meticulous

**Actual Image:** short black bob cut, gold star earrings, warm brown calm eyes, slim build. Navy blazer neatly worn, white shirt, red ribbon, plaid skirt, brown loafers, white ankle socks. Hands clasped in front holding small notebook.

**Full Body (middle school)**
```
Anime-style calm Korean middle school girl, neat and composed appearance.
- Hair: short black bob cut, clean and well-maintained
- Eyes: warm brown eyes, calm and composed expression
- Build: average height, slim
- Outfit: navy blazer neatly buttoned, white shirt with red ribbon, plaid skirt, brown loafers, white ankle socks
- Accessory: small gold star earrings, neatly held notebook or pencil case
- Pose: hands clasped together in front, good posture, slightly tilted head
- Expression: quiet gentle smile, composed
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Soft composed expression, star earrings visible.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same girl at age 11-12. Rounder face, bob cut slightly shorter.
- Hair: same black bob cut, slightly shorter
- Accessory: small star earrings (same)
- Outfit: beige cardigan, striped t-shirt, jeans, clean white sneakers
- Pose: hands held neatly in front, good posture
- Expression: polite quiet smile, well-mannered child
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

---

#### minjae (박민재) — Quiet top student, hidden effort, composed

> **Narrative alignment note:** game's `events.ts` portrays minjae as a quiet top-scorer who deflects attention ("이번엔 좀 쉬웠어"), keeps his desk neat ("필통을 가지런히 꺼내놓고"), and hides effort behind composure ("구겨진 만점 쪽지" — minjae-crumbled-note). He's also good at sports (`minjae-sports`) but never self-promotes. Visual must read as *composed, modest, focused* — not class energizer.

> **Differentiation from player_m (CRITICAL):** player_m is intentionally the "everyman" baseline (neat short hair, navy blazer, hand in pocket, soft approachable smile). minjae MUST visually stand apart with two distinctive markers:
> 1. **Thin square or rimless glasses** (NOT round — round is haeun's marker). This is the strongest visual cue and signals "studious top student" instantly.
> 2. **Notebook as signature prop — context-dependent placement.**
>    - **Portrait / classroom / study scenes**: holding notebook in hand or against chest (core identity prop, NOT just hand-in-pocket).
>    - **Sports / meals / picnics / ceremonies / outdoor scenes**: notebook should be set aside naturally (on bench / desk / picnic mat / table edge in frame) or omitted entirely. DO NOT force notebook into hands during basketball, dining, picnics, graduation photos, etc. — the prop must serve the scene, not violate it.
>
> Without the glasses marker (and the notebook where contextually appropriate), minjae and player_m look like the same person.

**Actual Image:** neat short hair (clean side-part or short undercut, NOT buzz cut), **thin rimless or thin silver square-frame glasses** (NOT round frame), thoughtful brown eyes behind glasses, composed half-smile (NOT wide grin showing teeth), average pale skin tone. Navy blazer worn properly buttoned, white shirt, dark pants, simple plain sneakers. **Portrait/classroom/study context: holding a notebook in one hand. Sports/meals/outdoor context: notebook set aside or omitted.**

**Full Body (middle school)**
```
Anime-style quiet top-student Korean middle school boy, composed and modest.
- Hair: neat short side-part or clean short cut, dark brown (NO buzz cut, NO messiness)
- Eyewear: thin rimless or thin silver square-frame glasses (NOT round frame — round is reserved for haeun). Glasses are a defining identity marker.
- Eyes: thoughtful brown eyes behind glasses, focused expression with slight tension
- Skin: average pale skin tone (NOT tanned)
- Build: average height, composed body language (no big gestures)
- Outfit: navy blazer worn properly (buttoned all the way), white shirt, dark pants, simple plain sneakers
- Pose: standing composed, one hand holding a notebook (notebook clearly visible — this is core identity), the other relaxed at side
- Expression: composed half-smile or thoughtful neutral (NO wide grin, NO teeth showing)
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Thin square/rimless glasses clearly visible, composed half-smile or thoughtful expression, notebook held at chest level (NOT just hand prop — must read as a daily-carried essential).
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same boy at age 11-12. Rounder face but same composed energy.
- Hair: same neat short cut
- Eyewear: same thin square/rimless glasses (slightly child-sized frame, NOT round)
- Outfit: simple plain hoodie (navy or grey, NOT bright red), dark pants, plain sneakers (no flashy colors)
- Pose: standing composed, one hand holding a notebook (or small textbook)
- Expression: faint smile, focused (NO big cheerful grin, NO class clown energy)
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

---

#### yuna (유나) — Bright top student, piano, energetic

**Actual Image:** light brown (caramel) wavy hair, star hair clip on right side, bright curious brown eyes, no glasses. Navy blazer, white shirt, red ribbon, plaid skirt, loafers, knee socks. Holding sketchbook, waving hand, colorful scrunchie bracelet.

**Full Body (middle school)**
```
Anime-style bright and energetic Korean middle school girl.
- Hair: medium-length wavy light brown (caramel) hair, star-shaped hair clip on right side
- Eyes: bright warm brown eyes, lively and curious expression (NO glasses)
- Build: average height, expressive body language
- Outfit: navy blazer, white shirt with red ribbon, plaid skirt, black loafers, dark knee socks
- Accessory: star hair clip, colorful scrunchie bracelet on wrist
- Pose: one hand waving cheerfully, bright open posture
- Expression: bright energetic smile, friendly and outgoing
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Bright lively smile, star hair clip visible, energetic expression.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same girl at age 11-12. Rounder face, even more bright and curious.
- Hair: light brown (caramel) wavy hair, slightly shorter, star hair clip
- Accessory: star hair clip, colorful scrunchie bracelet
- Outfit: yellow hoodie, denim shorts, colorful sneakers (NO school uniform)
- Pose: one hand waving cheerfully
- Expression: bright innocent smile, full of curiosity
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

---

### 5-3. Year 1~2 NPC (Elementary to Middle transition)

---

#### doyun (박도윤) — Elementary popular boy, soccer captain, reliable leader

**Full Body (middle school)**
```
Anime-style reliable Korean middle school boy, athletic and dependable aura.
- Hair: short neat black hair, slightly side-parted, clean cut
- Eyes: clear warm brown eyes, dependable and honest expression
- Build: athletic and well-proportioned, tall for his age
- Outfit: navy blazer neatly worn, white shirt, dark pants, clean white sneakers
- Accessory: small soccer ball keychain on bag, red captain armband peeking from pocket
- Pose: standing tall with arms relaxed at sides, natural leader vibe
- Expression: friendly confident smile, approachable and trustworthy
- Background: solid white (#FFFFFF)
- Size: 800x1400px

IMPORTANT: Must NOT resemble jihun.
Differentiation from jihun: neat hair (vs messy), clean-cut (vs casual), leader composure (vs playful energy).
```

**Portrait**
```
Same character, chest-up. Warm reliable smile, clean-cut appearance.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same boy at age 11-12. Even more bright and pure energy.
- Hair: same neat black hair, slightly less styled
  (⚠️ HAIR COLOR = BLACK, NOT brown — 초등 단계에서 갈색으로 드리프트한 사고 재발 방지.
   middle/high 가 검정이므로 초등도 반드시 검정으로 통일)
- Outfit: green jersey/soccer shirt, shorts, grass-stained sneakers
- Accessory: soccer ball under arm
- Pose: standing with one foot on soccer ball, hands on hips
- Expression: bright confident smile, golden boy of the class
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait (elementary)** → `doyun_elementary_neutral.png`
```
Same boy at age 11-12, bright and pure energy. Chest-up portrait, slight angle toward camera, looking at viewer.
- Face: SAME base face as doyun middle version (identical proportions, eye rendering, shading) — do NOT alter face base
- Hair: short neat black hair, slightly side-parted, slightly less styled than older versions
- Eyes: clear warm brown eyes, dependable honest gaze
- Expression: soft neutral smile, calm and approachable (NOT wide grin, NO teeth showing) — this is the NEUTRAL portrait
- Outfit: green V-neck soccer jersey with white collar trim and white sleeve cuffs
- Background: soft pastel pink-blue gradient (light pink → sky blue)
- Size: 1024x1536px (2:3)

[append common style anchor + negative prompt]
Negative additions: transparent background, plain white background

IMPORTANT: This is a Portrait/neutral image → KEEP the pastel background.
Do NOT run background removal. The jersey has WHITE collar/cuffs, and removing a
background here previously left white fringe artifacts (the 2026-05-20 alpha pass).
Pastel-background neutral portraits need no removal — see Section 2 / Section 9.
```

---

### 5-4. Year 2~4 NPCs (Middle school)

---

#### haeun (김하은) — Transfer student, quiet reader, thoughtful

**Actual Image:** dark brown straight bob cut slightly above the shoulders with natural flyaway hairs, black-framed round-rectangle glasses, warm brown eyes, shy thoughtful smile. Navy blazer neatly buttoned, white shirt with large red ribbon, plaid skirt, black knee socks, black loafers. Holding a red-covered book close to chest with both hands.

**Full Body (middle school)**
```
Anime-style quiet Korean middle school girl, thoughtful transfer student.
- Hair: dark brown straight bob cut slightly above the shoulders, natural flyaway hairs, NO caramel, NO wavy texture
- Eyes: warm brown eyes, shy and thoughtful expression
- Build: average height and build, gentle body language
- Outfit: navy blazer neatly buttoned, white shirt with large red ribbon, plaid skirt, black knee socks, black loafers
- Accessory: black-framed round-rectangle glasses, NO star hair clip
- Item: red-covered book held close to chest with both hands, NOT sketchbook
- Pose: shy straight standing pose, both hands hugging the red book at chest, gaze slightly downward, NO waving
- Expression: calm and slightly shy transfer student tone, careful and bookish
- Background: solid white (#FFFFFF)
- Size: 800x1400px

IMPORTANT: Must NOT look like yuna.
Differentiation from yuna: haeun has dark brown straight bob hair, black-framed glasses, red book, shy bookish posture. Yuna has caramel wavy hair, star clip, no glasses, bright waving pose, sketchbook/bracelet cues.
```

**Portrait**
```
Same character, chest-up. Shy thoughtful smile, round glasses visible, red book held near chest.
Background: soft pastel pink-blue gradient.
```

---

#### seoa (윤서아) — Quiet, introspective, writer, earphones

**Full Body (middle school)**
```
Anime-style quiet Korean middle school girl, reserved and thoughtful.
- Hair: long straight dark brown hair, slightly past shoulders, simple hair clip on one side
- Eyes: deep brown eyes, thoughtful and slightly dreamy expression
- Build: slim, average height, delicate frame
- Outfit: navy blazer buttoned up neatly, white shirt with red ribbon, plaid skirt, simple loafers
- Accessory: earphone cord slightly visible from blazer pocket, thin notebook held at side
- Pose: slightly turned body, one hand holding notebook at hip level, subtle shy smile
- Expression: calm and observant, looking slightly to the side, inner world visible
- Background: solid white (#FFFFFF)
- Size: 800x1400px

IMPORTANT: Must NOT look like yuna.
Differentiation from yuna: NO glasses, longer hair, earphones instead of book, dreamy expression vs studious.
```

**Portrait**
```
Same character, chest-up. Calm dreamy gaze, earphone cord visible, slight distant smile.
Background: soft pastel pink-blue gradient.
```

---

### 5-5. Year 5~7 NPCs (High school)

---

#### junha (김준하) — Transfer student from Busan, straightforward, cooking lover

**Full Body (high school)**
```
Anime-style Korean high school boy, 17 years old, transfer student. Sturdy and slightly awkward.
- Hair: short dark brown hair, slightly messy, unstyled natural look
- Eyes: warm dark brown eyes, earnest and straightforward expression
- Eyebrows: thicker and straighter than other male characters
- Face: slightly sharper jawline than protagonist
- Build: sturdy build, broad shoulders, average height
- Outfit: navy blazer (slightly ill-fitting — recently transferred), white shirt, dark pants, worn sneakers
- Accessory: old/used school bag, simple wristwatch
- Pose: one hand scratching back of head awkwardly, other hand holding bag strap
- Expression: slightly awkward but warm smile, trying to fit in
- Background: solid white (#FFFFFF)
- Size: 800x1400px

IMPORTANT: Must NOT resemble player_m (protagonist).
Differentiation: thicker eyebrows, sharper jaw, broader shoulders, messier hair, more rugged appearance.
```

**Portrait**
```
Same character, chest-up. Awkward warm smile, slight tension in expression.
Background: soft pastel pink-blue gradient.
```

---

#### siwoo (한시우) — Observer type, architecture dream, dry humor

**Full Body (high school)**
```
Anime-style Korean high school boy, 16 years old, calm and observant.
- Hair: medium-length dark brown hair, slightly covering forehead, natural messy style
- Eyes: sharp but calm dark brown eyes, observant and slightly guarded expression
- Build: tall and lean, slightly slouched posture
- Outfit: navy blazer worn casually (top button undone), white shirt, dark pants, simple sneakers
- Accessory: silver tumbler (thermos) hanging from bag strap, sleeves slightly too long
- Pose: hands in pockets, leaning weight on one leg, relaxed but distant
- Expression: slight reserved smile, watching rather than engaging — "observer" vibe
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait** → `siwoo_neutral.png`
```
Same character, chest-up, slight angle toward camera, looking at viewer.
- Face: same proportions as siwoo full-body version
- Hair: medium-length dark brown hair slightly covering forehead, natural messy style
- Eyes: sharp but calm dark brown eyes, observant slightly guarded
- Expression: slight reserved half-smile, calm analytical gaze, watching rather than engaging
- Outfit: navy blazer worn casually (top button undone), white shirt
- Background: soft pastel pink-blue gradient (light pink → sky blue)
- Size: 1024x1536px (2:3)

IMPORTANT: Portrait/neutral → KEEP the pastel background. Do NOT run background removal.
Outfit has a WHITE shirt; the previous removal pass left white fringe at the hem. See Section 9.
```

---

#### yerin (강예린) — Social strategist, calculated extrovert, college-prep expert mom

**Full Body (high school)**
```
Anime-style Korean high school girl, 16 years old, polished and poised.
- Hair: medium-length dark brown hair, neatly styled with slight wave at ends, well-maintained
- Eyes: bright sharp brown eyes, intelligent and observant expression
- Build: average height, slim, well-groomed appearance
- Outfit: navy blazer perfectly fitted, white shirt with red ribbon neatly tied, plaid skirt, clean loafers
- Accessory: stylish brand backpack (not school-issue), small planner visible in hand, simple elegant earrings
- Pose: one hand holding planner at waist level, other hand relaxed, poised and confident standing
- Expression: polite smile with dimples, friendly but subtly calculated composure
- Background: solid white (#FFFFFF)
- Size: 800x1400px

IMPORTANT: Must NOT look like subin.
Differentiation from subin: longer wavy hair (vs bob), sharper expression (vs gentle), planner (vs notebook), calculated smile (vs genuine), elegant earrings (vs star earrings).
```

**Portrait**
```
Same character, chest-up. Polished smile, elegant earrings, composed confidence.
Background: soft pastel pink-blue gradient.
```

---

## 6. Character Summary Table

| ID | Name | Gender | School | Key Visual Features | Differs From |
|----|------|--------|--------|--------------------|----|
| player_m | 주인공 (남) | M | All | Natural medium-length black, soft center part, slightly mature half-smile, NO glasses, NO prop | Baseline male — high stage adds navy tie + chest crest |
| player_f | 주인공 (여) | F | All | Dark brown straight hair, plain | Baseline female |
| jihun | 한지훈 | M | All | Messy black hair, athletic, basketball keychain | player_m: messier, taller, more muscular |
| subin | 오수빈 | F | All | Black bob, star earrings, notebook | player_f: shorter hair, earrings |
| minjae | 박민재 | M | All | Thin square/rimless glasses, neat short cut, always with notebook | player_m: glasses + notebook (vs no glasses, hand in pocket); jihun: neat composed vs messy playful; haeun: square/rimless vs round glasses |
| yuna | 유나 | F | All | Caramel wavy hair, star clip, bright smile, no glasses | subin: lighter hair, more energetic, star clip vs star earrings |
| doyun | 박도윤 | M | Elem~Mid | Neat black side-part, soccer keychain, leader aura | jihun: neat vs messy, composed vs playful |
| haeun | 김하은 | F | Mid | Dark brown bob, round glasses, red book, shy smile | yuna: darker bob + glasses + red book vs caramel wave + star clip |
| seoa | 윤서아 | F | Mid | Long straight brown, hair clip, earphones, notebook | yuna: no glasses, longer hair, dreamy vs studious |
| junha | 김준하 | M | High | Dark brown messy, thick eyebrows, sturdy, ill-fitting blazer | player_m: sharper jaw, broader, more rugged |
| siwoo | 한시우 | M | High | Medium brown covering forehead, tall lean, slouched, tumbler | junha: leaner, taller, more reserved |
| yerin | 강예린 | F | High | Wavy brown ends, elegant earrings, planner, polished | subin: longer wavy hair, sharper gaze, calculated |

---

## 7. File Naming Convention

**명시적 3-stage 네이밍** — 학년(year)별로 stage 접미사를 항상 붙인다. 무접미사(base) 이름은
쓰지 않는다. 런타임 SSOT는 `game/src/engine/characterAssets.ts`.

| stage | year | prefix |
|-------|------|--------|
| elementary | Y1 | `{id}_elementary` |
| middle | Y2~Y4 | `{id}_middle` |
| high | Y5~Y7 | `{id}_high` |

| Type | Pattern | Example |
|------|---------|---------|
| Full Body | `{id}_{stage}_fullbody.png` | `jihun_middle_fullbody.png` |
| Portrait (neutral) | `{id}_{stage}_neutral.png` | `jihun_high_neutral.png` |
| Portrait (expression) | `{id}_{stage}_{expression}.png` | `jihun_middle_happy.png` |
| Gendered full body | `{id}_{stage}_fullbody_f.png` | `jihun_elementary_fullbody_f.png` (여자 주인공 동반 씬) |

Expressions: `neutral`, `happy`, `sad`, `angry`, `tired`, `burnout`, `surprised`, `shy`
(현재 실제 생성된 표정은 `neutral` 뿐 — 나머지는 폴백으로 neutral 사용)

**학년 범위 / stage 예외 (NPC 등장 구간 기준):**
- 전 학년 등장(jihun/subin/minjae/yuna/player): elementary·middle·high 모두 필요
- haeun: Y2 전학 → middle·high (elementary 없음)
- doyun: Y1~Y2 → elementary·middle (high 도달 안 함)
- **junha: Y6 전학(고등 전용) → `junha_high_*` 만** (middle/elementary 없음)
- 폴백 바닥은 `_middle`. staged 자산이 없으면 `_middle` → CSS 아바타 순.

---

## 8. File Directory

```
game/public/images/characters/
```

---

## 9. Background Removal

**Applies to FULL BODY images ONLY.** Portrait / neutral images KEEP their pastel
gradient background — do NOT run removal on them (see Section 2).

1. Generate with solid white (#FFFFFF) background
2. Use remove.bg or Photoshop to remove background
3. Save as PNG with transparency (RGBA)
4. Verify no white artifacts on edges

⚠️ Known failure (2026-05-20): a blanket alpha pass was applied to neutral PORTRAITS
that should have kept their pastel background. Characters with white clothing
(doyun's white jersey trim, siwoo's white shirt) left white fringe/residue. Never run
background removal on a Portrait/neutral image.

**Recovery (face-preserving — do NOT regenerate from text, which drifts the face):**
composite a soft pastel pink→blue gradient *behind* the existing transparent PNG (pure
alpha-composite, character pixels untouched). For images with leftover white fringe,
clean only the border-connected white before compositing (keep interior white like
collars/shirts). Full task spec: **`docs/neutral-pastel-bg-add-task.md`** (24 files;
excludes already-pastel subin/player_f/player_m_elementary).

---

## 10. Generation Checklist

### Existing (generated)
- [x] player_m — fullbody, portrait
- [x] player_f — fullbody, portrait
- [x] jihun — fullbody, portrait
- [x] subin — fullbody, portrait
- [x] minjae — fullbody, portrait
- [x] yuna — fullbody, portrait
- [x] haeun — fullbody, portrait

### Needed — New Characters
- [ ] doyun — fullbody, portrait
- [ ] seoa — fullbody, portrait
- [ ] junha — fullbody, portrait
- [ ] siwoo — fullbody, portrait
- [ ] yerin — fullbody, portrait

### Needed — Elementary Versions
- [ ] player_m — elementary fullbody, elementary portrait
- [ ] player_f — elementary fullbody, elementary portrait
- [ ] jihun — elementary fullbody, elementary portrait
- [ ] subin — elementary fullbody, elementary portrait
- [ ] minjae — elementary fullbody, elementary portrait
- [ ] yuna — elementary fullbody, elementary portrait
- [ ] doyun — elementary fullbody, elementary portrait

### Stretch Goal — Expression Variants
- [ ] All main NPCs: happy, sad, angry (portrait only)
