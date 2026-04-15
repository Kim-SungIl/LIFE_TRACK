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
- Background: soft pastel gradient (light pink / sky blue tone)
- Output: PNG, 2:3 ratio
```

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

## 5. Character Prompts

---

### 5-1. Player Characters

---

#### player_m (남자 주인공)

**Actual Image:** neat short black hair with slight center part, warm brown eyes, average build, soft approachable smile. Navy blazer, white shirt, dark pants, black loafers. One hand in pocket.

**Full Body (middle school)**
```
Anime-style Korean middle school boy, average height and build, neutral friendly expression.
- Hair: neat short black hair, slightly parted at center
- Eyes: warm brown eyes, gentle and approachable
- Build: average height and build, not athletic, not thin
- Outfit: navy blazer neatly buttoned, white shirt, dark pants, black loafers
- Pose: natural standing, one hand in pocket, slight smile
- Expression: soft, calm, approachable — the "everyman" protagonist
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Calm and friendly expression, slight smile.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same boy at age 11-12. Rounder face, slightly shorter.
- Hair: same neat short black hair, slightly messier
- Outfit: navy zip-up hoodie, white t-shirt, dark jeans, white sneakers
- Pose: natural standing, hands at sides
- Expression: brighter, more innocent smile
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

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

**Full Body (elementary)**
```
Same boy at age 11-12. Slightly shorter, rounder face, even more carefree.
- Hair: same messy black hair, slightly longer
- Outfit: blue athletic hoodie, white t-shirt, track pants, worn sneakers
- Accessory: basketball tucked under one arm
- Pose: casual standing, free hand waving
- Expression: big innocent grin, full of energy
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

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

#### minjae (박민재) — Class energizer, outgoing, confident

**Actual Image:** very short buzz cut dark brown hair, bright expressive eyes, wide smile showing teeth, slightly tanned skin. Navy blazer open/casual, white shirt, dark pants, trendy white sneakers. Arms crossed confidently.

**Full Body (middle school)**
```
Anime-style outgoing Korean middle school boy, confident and charismatic.
- Hair: very short buzz cut, dark brown
- Eyes: bright expressive brown eyes, wide and lively
- Skin: slightly tanned compared to other characters
- Build: average height, energetic body language
- Outfit: navy blazer worn casually (open, slightly loose), white shirt, dark pants, trendy white sneakers
- Pose: arms crossed confidently, standing tall, radiating energy
- Expression: big confident grin showing teeth, charismatic
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Wide charismatic smile, arms crossed.
Background: soft pastel pink-blue gradient.
```

**Full Body (elementary)**
```
Same boy at age 11-12. Same buzz cut, rounder face.
- Hair: same short buzz cut
- Outfit: bright red hoodie, shorts, sporty sneakers
- Pose: arms crossed or hands on hips, confident stance
- Expression: big cheerful grin, class clown energy
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
- Outfit: green jersey/soccer shirt, shorts, grass-stained sneakers
- Accessory: soccer ball under arm
- Pose: standing with one foot on soccer ball, hands on hips
- Expression: bright confident smile, golden boy of the class
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

---

### 5-4. Year 2~4 NPCs (Middle school)

---

#### haeun (김하은) — Transfer student, creative, sketch artist

**Actual Image:** medium-length wavy light brown (caramel) hair, star hair clip on right side, bright curious brown eyes, colorful scrunchie bracelet on wrist. Navy blazer, white shirt, red ribbon, plaid skirt, black loafers, dark knee socks. One hand holding sketchbook with doodles, other hand waving.

**Full Body (middle school)**
```
Anime-style creative Korean middle school girl, expressive and lively.
- Hair: medium-length wavy brown hair (lighter caramel brown), star-shaped hair clip on right side
- Eyes: warm brown eyes, curious and lively expression
- Build: average height, expressive body language
- Outfit: navy blazer, white shirt with red ribbon, plaid skirt, black loafers, dark knee socks
- Accessory: star hair clip, colorful scrunchie bracelet on wrist, sketchbook with doodles held casually
- Pose: one hand holding sketchbook at side, other hand waving or gesturing cheerfully
- Expression: bright cheerful smile, curious and open
- Background: solid white (#FFFFFF)
- Size: 800x1400px
```

**Portrait**
```
Same character, chest-up. Cheerful lively smile, star hair clip visible, holding sketchbook.
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

**Portrait**
```
Same character, chest-up. Reserved half-smile, calm analytical gaze.
Background: soft pastel pink-blue gradient.
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
| player_m | 주인공 (남) | M | All | Black neat hair, plain, everyman | Baseline male |
| player_f | 주인공 (여) | F | All | Dark brown straight hair, plain | Baseline female |
| jihun | 한지훈 | M | All | Messy black hair, athletic, basketball keychain | player_m: messier, taller, more muscular |
| subin | 오수빈 | F | All | Black bob, star earrings, notebook | player_f: shorter hair, earrings |
| minjae | 박민재 | M | All | Buzz cut, tanned skin, wide grin | jihun: shorter hair, darker skin, stockier |
| yuna | 유나 | F | All | Caramel wavy hair, star clip, bright smile, no glasses | subin: lighter hair, more energetic, star clip vs star earrings |
| doyun | 박도윤 | M | Elem~Mid | Neat black side-part, soccer keychain, leader aura | jihun: neat vs messy, composed vs playful |
| haeun | 김하은 | F | Mid | Caramel wavy hair, star clip, sketchbook, bracelet | subin: lighter hair, colorful accessories |
| seoa | 윤서아 | F | Mid | Long straight brown, hair clip, earphones, notebook | yuna: no glasses, longer hair, dreamy vs studious |
| junha | 김준하 | M | High | Dark brown messy, thick eyebrows, sturdy, ill-fitting blazer | player_m: sharper jaw, broader, more rugged |
| siwoo | 한시우 | M | High | Medium brown covering forehead, tall lean, slouched, tumbler | junha: leaner, taller, more reserved |
| yerin | 강예린 | F | High | Wavy brown ends, elegant earrings, planner, polished | subin: longer wavy hair, sharper gaze, calculated |

---

## 7. File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Full Body (middle/high) | `{id}_fullbody.png` | `jihun_fullbody.png` |
| Full Body (elementary) | `{id}_elementary_fullbody.png` | `jihun_elementary_fullbody.png` |
| Portrait (neutral) | `{id}_neutral.png` | `jihun_neutral.png` |
| Portrait (elementary) | `{id}_elementary_neutral.png` | `jihun_elementary_neutral.png` |
| Portrait (expression) | `{id}_{expression}.png` | `jihun_happy.png` |

Expressions: `neutral`, `happy`, `sad`, `angry`, `tired`, `burnout`, `surprised`, `shy`

---

## 8. File Directory

```
game/public/images/characters/
```

---

## 9. Background Removal

1. Generate with solid white (#FFFFFF) background
2. Use remove.bg or Photoshop to remove background
3. Save as PNG with transparency (RGBA)
4. Verify no white artifacts on edges

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
