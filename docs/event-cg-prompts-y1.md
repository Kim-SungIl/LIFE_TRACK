# Event CG Prompts — Y1 (초6, 초등학교 6학년)

> LIFE_TRACK 게임의 Y1(초등 6학년) 이벤트 CG 생성 프롬프트 모음.
> GPT 등 이미지 생성 AI에게 **캐릭터/배경 레퍼런스 이미지 + 프롬프트**를 함께 입력하여 일관성 있는 CG를 제작.

---

## ⚠️ 캐릭터 외형 강제 마커 (모든 CG 프롬프트 공통)

> 아래 마커는 `docs/character-prompt-spec.md` 정본과의 일치를 강제하기 위함.
> CG 프롬프트 인라인 기술이 spec과 어긋나면 spec이 우선.
> 신규 minjae/haeun CG 프롬프트 작성 시 반드시 아래 마커 박스를 인용/참조할 것.

### minjae (박민재) — spec L326-365
```
[REQUIRED visual markers — must be visible in every minjae image]
- Thin rimless OR thin silver square-frame glasses (NOT round, NOT none)
  → defining identity marker, must be clearly visible
- Always holding a notebook (NOT hand in pocket, NOT chopsticks-only,
  NOT arms crossed) — daily-carried essential
- Neat short hair: clean side-part or short undercut
  (NEVER buzz cut, NEVER shaved head)
- Composed half-smile (NEVER wide grin showing teeth,
  NEVER overly energetic expression)
- Average pale skin tone (NOT tanned)
- Outfit:
  - elementary: navy hoodie + dark pants (NOT red hoodie)
  - mid/high: navy school blazer worn properly buttoned + white shirt
- Differentiation from player_m: player_m has NO glasses, NO notebook;
  without these markers minjae and player_m look like the same person.
```

### haeun (김하은) — spec L460-475
```
[REQUIRED visual markers]
- Black-framed round-rectangle glasses (round is haeun's marker —
  vs minjae's square/rimless)
- Holding a red-covered book close to chest with both hands
- Dark brown straight bob cut slightly above shoulders with natural flyaways
- Shy thoughtful smile (NOT wide grin, NOT excited)
- Navy blazer + white shirt + large red ribbon + plaid skirt + knee socks
- NO star hair clip (yuna's marker)
```

### yuna (유나) — spec L375-381
```
- Light brown (caramel) wavy hair
- Star hair clip on right side
- NO glasses (haeun's marker)
- Sketchbook + colorful scrunchie bracelet
- Bright curious expression, lively waving pose
```

### player_m — spec L162-164
```
- Natural medium-length black hair, soft center part
- NO glasses, NO hand prop
- Soft approachable slightly mature half-smile
- (high stage only) navy tie + chest crest
```

---

## 🎨 공통 스타일 가이드

모든 Y1 CG에 공통 적용:

```
Art style: Anime-style illustration, soft pastel colors, gentle lighting,
           same character design as the provided reference sheets.
Era: 2012~2015 Korean elementary school life nostalgia
Age: 12-year-old children (Korean 6th grade)
Composition: cinematic scene, focused emotion, natural lens feel
Resolution: 1440x810 (16:9) or 1080x1440 (3:4 portrait — for character close-ups)
```

**Negative prompt 공통**:
```
no middle school uniform, no high school uniform, no adult features,
no exaggerated anime eyes, no sexualization, no modern smartphones (2010s flip/slide phones OK)
```

### 🍃 계절 의상 주의 (중요)

캐릭터 레퍼런스 시트(`*_elementary_fullbody.png`)는 **봄·여름 평상복 기준**.
이 시트만 그대로 따라가면 겨울 장면에도 반팔/반바지가 나옴 → 계절감 깨짐.
**겨울/늦가을 이벤트는 반드시 의상을 명시적으로 오버라이드**해야 합니다.

| 계절 | 의상 가이드 |
|---|---|
| **봄/초가을** (W1~W30 일반): 레퍼런스 시트 그대로 (long-sleeve T or light hoodie) |
| **늦가을** (W31~W40, 운동회 이후): 가디건·후드 + 긴바지, 살짝 두꺼운 outerwear |
| **겨울** (W41~W48, 졸업 직전): puffy down jacket / 두꺼운 코트 / 목도리 / 장갑 / 입김, 빨개진 볼·코끝 가능 |

각 winter/late-autumn scene prompt 끝에 다음 항목 추가:
```
Outfit override: winter clothing — puffy down jacket or thick coat over long-sleeve,
scarf, gloves if outdoor; flushed cheeks/nose from cold; visible breath if cold enough.
Keep face, hair, height, and overall character design identical to the reference.
```

## 📁 파일명 규칙 + 디렉토리 구조

이벤트 결과 CG는 학교급별 디렉토리에 저장합니다 (GameScreen.tsx 참조):

```
public/images/events/
  elementary/   # Y1 (초6)
  middle/       # Y2~Y4 (중1~중3)
  high/         # Y5~Y7 (고1~고3)
  common/       # 학교급-무관 폴백
```

파일명 형식:

```
{eventId}_c{choiceIndex}_{gender}.png
```
- `eventId`: 이벤트 ID (예: `first-week`)
- `choiceIndex`: 0부터 시작 (첫 선택지 = c0)
- `gender`: `m` (남주) / `f` (여주)

**폴백 순서** (학교급 → common, 각 단계마다 4-suffix cascade):
1. `{schoolLevel}/{eventId}_c{ci}_{g}.png`
2. `{schoolLevel}/{eventId}_{g}.png`
3. `{schoolLevel}/{eventId}_c{ci}.png`
4. `{schoolLevel}/{eventId}.png`
5. `common/{eventId}_c{ci}_{g}.png`
6. `common/{eventId}_{g}.png`
7. `common/{eventId}_c{ci}.png`
8. `common/{eventId}.png`

→ 같은 이벤트라도 학년대별 시각적 차이(교복·배경·체격)가 필요하면 각 학교급 디렉토리에 별도 이미지 배치
→ 학교급 무관하게 한 장으로 충분하면 `common/`에만 배치
→ 성별/선택지 차이가 거의 없는 이벤트는 **공통 1장**(`{eventId}.png`)만 만들어도 됨

## 🗂 레퍼런스 이미지 위치

모두 `game/public/images/` 하위:

**캐릭터 (초등 버전)**:
- `characters/jihun_elementary_fullbody.png` + `_neutral.png` (남자 주인공 시나리오 — 농구공)
- `characters/jihun_elementary_fullbody_f.png` 🆕 **여자 주인공 시나리오용 (배드민턴 라켓)**
- `characters/minjae_elementary_fullbody.png` + `_neutral.png`
- `characters/yuna_elementary_fullbody.png` + `_neutral.png`
- `characters/subin_elementary_fullbody.png` + `_neutral.png`
- `characters/player_m_elementary_fullbody.png` + `_neutral.png`
- `characters/player_f_elementary_fullbody.png` + `_neutral.png`

### 🏸 지훈 여자 주인공 버전 생성 프롬프트

여자 주인공 시나리오의 배드민턴 컨벤션에 맞추기 위해 배드민턴 버전 fullbody 추가.
EventScene에서 `gender==='female'`이면 `_f` 접미사 이미지를 우선 로드 (없으면 기본으로 폴백).

**파일명**: `jihun_elementary_fullbody_f.png`

```
Same 12-year-old Korean elementary boy as jihun_elementary_fullbody.png reference
(identical face, hair, build, outfit, expression, art style).

CHANGE ONLY: Replace the basketball with a BADMINTON RACKET.
- Hold the racket casually on his shoulder (like carrying a guitar) or tucked under one arm.
- Optionally a shuttlecock in his free hand.

Keep everything else exactly the same:
- Messy black hair, confident friendly grin
- Blue athletic hoodie, white t-shirt, track pants, worn sneakers
- Same casual standing pose, one hand free waving
- Solid white (#FFFFFF) background
- Size: 800x1400px
```

**배경 (Y1에 등장)**:
- `backgrounds/classroom_elementary_spring.png`
- `backgrounds/classroom_elementary_afternoon.png`
- `backgrounds/classroom_elementary_sunset.png`
- `backgrounds/library_elementary.png`
- `backgrounds/school_gate_elementary.png`
- `backgrounds/hagwon_front.png`
- `backgrounds/park_spring.png`
- `backgrounds/gymnasium.png`
- `backgrounds/auditorium_elementary.png`

---

# 📅 Y1 이벤트 CG 타임라인

```
🔴 필수 CG (핵심 서사)
🟠 중요 CG (캐릭터 각인)
🟡 있으면 좋음 (분위기)
```

---

## 🔴 W1 first-week — 새 학기 첫날 (지훈)

**Scene**: 새 학기 첫날 교실. 뒷자리에서 지훈이가 달려와 주인공을 부르며 "3년 연속 같은 반!" 외치는 순간. 소꿉친구의 밝은 재회.

**References**:
- `jihun_elementary_fullbody.png` + `jihun_elementary_neutral.png`
- `player_m_elementary_fullbody.png` OR `player_f_elementary_fullbody.png`
- `classroom_elementary_spring.png`

### [c0] "좋아! 운동장에서 보자" → 방과후 함께 운동

> 결과 메시지: "방과 후에 운동장에서 뛰었다. 지훈이랑 같이 놀면 항상 편하다."
> → CG는 **이벤트 설명(첫 인사) 씬**이 아니라 **선택 결과 씬(방과후 운동)** 으로.

**[male / c0]** `first-week_c0_m.png`
```
Elementary school outdoor court, late afternoon. Two 12-year-old Korean boys playing
basketball together on a small half-court.
Jihun (reference) mid-jump going for a shot, messy black hair flying, huge confident grin,
athletic hoodie on. Sweat shining in golden afternoon sun.
Male protagonist (player_m reference) under the basket or defending, bright laughing expression,
similarly sweaty and happy.
Background: school building in distance, trees, long shadows from afternoon sun.
Mood: pure joyful exhaustion, childhood-friend playtime, golden hour nostalgia.
```

**[female / c0]** `first-week_c0_f.png`
```
School gymnasium, badminton court indoors. Two 12-year-old Korean kids playing badminton.
Jihun (reference) on one side of the net, mid-swing with badminton racket, wide grin,
shuttlecock in the air.
Female protagonist (player_f reference) on the other side, bright laughing expression,
racket ready, pony-tail/hair flying.
Background: gymnasium interior, wooden floor, afternoon light through high windows.
Mood: energetic fun, childhood-friend match.
```

### [c1] "오늘은 좀 피곤해..." → 거절

**[male / c1]** `first-week_c1_m.png`
```
Same classroom setting. Jihun (reference), still friendly expression but slightly
disappointed, waving "see you tomorrow" gesture with one hand raised.
Male protagonist turned partly away, gathering books, apologetic soft expression.
Light mood: warm but slightly bittersweet, comfortable childhood-friend dynamic.
```

**[female / c1]** `first-week_c1_f.png`
```
Same as c1 male but with female protagonist. No other changes.
```

### [c2] "대신 같이 숙제 하자" → 공부 제안

**[male / c2]** `first-week_c2_m.png`
```
Same classroom, evening light. Jihun (reference) sitting at a desk with reluctant
"ugh fine" pout expression, head resting on hand, open notebook.
Male protagonist beside him, small smile, pointing at a textbook.
Mood: cozy study session, childhood-friend banter.
```

**[female / c2]** `first-week_c2_f.png`
```
Same as c2 male with female protagonist.
```

---

## 🔴 W2 minjae-meet-elementary — 옆자리 민재

**Scene**: 새 자리 배치. 옆자리 민재가 필통/노트를 가지런히 정리하며 수줍게 "점심 같이 먹을래?" 인사.

**References**:
- `minjae_elementary_fullbody.png` + `minjae_elementary_neutral.png`
- `player_m_*` or `player_f_*`
- `classroom_elementary_spring.png`

### [c0] "좋아!" — 같이 점심

**[male / c0]** `minjae-meet-elementary_c0_m.png`
```
Elementary school cafeteria, lunch time. Two 12-year-old Korean boys sitting across
from each other at a school cafeteria table with trays.
Minjae (reference): neat short hair (clean side-part, NOT buzz cut), average pale
skin tone, thin rimless or silver square-frame glasses clearly visible, composed
half-smile slightly warmer than usual, chopsticks in one hand, a notebook resting
on the table beside his tray.
Male protagonist: laughing at something minjae said, relaxed shoulders.
Background: bright cafeteria, other students blurred in background.
Mood: first-friendship spark, warm and cheerful (minjae's warmth shows as quiet
softness, not a wide grin).
```

**[female / c0]** `minjae-meet-elementary_c0_f.png`
```
Same setting with female protagonist. No other changes.
```

### [c1] "나도 네 옆자리야" — 이야기 나눈다

> ⚠️ c0 "같이 점심 먹기" 승낙과 동일하게 "점심 중" 시점으로 맞춰야 함.
> 민재가 먼저 "점심 같이 먹자"고 제안한 상황 → c1은 그 제안에 응하면서 대화도 이어가는 선택.
> 따라서 교실 쉬는시간(책 정리) 씬은 시간이 역행되어 부자연스러움.

**[male / c1]** `minjae-meet-elementary_c1_m.png`
```
Elementary school cafeteria, lunch time. Two 12-year-old Korean boys sitting side by side
at cafeteria table, trays with lunch in front of them.
Minjae (reference): neat short hair (clean side-part, NOT buzz cut), average pale
skin tone, thin rimless or silver square-frame glasses clearly visible, composed
expression mid-speaking with chopsticks pausing, eyes thoughtful behind glasses,
explaining something quietly but earnestly. A notebook visible on the table near
his tray.
Male protagonist turned toward minjae, engaged listener posture, leaning forward slightly
with curious "아 그래?" face.
Background: bright cafeteria, trays/food on table, blurred students in background.
Mood: deeper conversation while eating, friendship warming up beyond casual chat.
```

**[female / c1]** `minjae-meet-elementary_c1_f.png`
```
Same setting with female protagonist. No other changes.
```

### [c2] "아... 나 할 거 있어서" — 혼자 도서관

**[male / c2]** `minjae-meet-elementary_c2_m.png`
```
Elementary school library (reference: library_elementary.png). Empty quiet space,
dust motes in sunlight. Male protagonist (player_m reference) sitting alone at a reading desk,
open book or notebook in front, quiet focused-but-slightly-lonely expression.
Mood: peaceful solitude with a hint of loneliness.
```

**[female / c2]** `minjae-meet-elementary_c2_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

---

## 🔴 W4 jihun-call — 지훈이의 전화 (남=농구 / 여=떡볶이)

**Scene**: 저녁에 지훈이한테 전화가 와서 "주말에 같이 놀자" 제안. 남주면 농구, 여주면 떡볶이. 민재도 합류한다고 함.
선택 결과 씬: c0는 함께 노는 모습, c1은 거절 후 혼자 남은 찝찝함.

**References**:
- `jihun_elementary_fullbody.png` (농구공) 또는 `jihun_elementary_fullbody_f.png` (배드민턴 — 여주용 레퍼런스)
- `minjae_elementary_fullbody.png`
- `player_m_*` or `player_f_*`
- `home_evening.png` (c1 거절 씬 배경)
- 장소: 농구 — 야외 공원/동네 농구장 / 떡볶이 — 분식집 내부

### [c0] "가자!" — 함께 놀러 간다

**[male / c0]** `jihun-call_c0_m.png`
```
Neighborhood outdoor basketball half-court, late afternoon.
Three 12-year-old Korean boys playing basketball together.
Jihun (reference): mid-dribble, huge competitive grin, messy hair flying.
Minjae (reference): defending with serious focused expression, neat short hair
(NOT buzz cut), thin rimless/square-frame glasses (sports-band strap optional
to keep them in place during play).
Male protagonist (player_m reference): laughing open-mouthed, reaching for the ball.
Background: low chain-link fence, apartment buildings in distance, golden hour light, long shadows.
Mood: weekend freedom, three-friends bonding, sweat and laughter.
```

**[female / c0]** `jihun-call_c0_f.png`
```
Korean tteokbokki snack shop interior, weekend afternoon.
Three 12-year-old Korean kids sitting at a red plastic table with a steaming pan of tteokbokki,
fish cakes and odeng cups. Steam rising.
Jihun (reference): mouth full, cheeks puffed comically, eyes happy.
Minjae (reference): neat short hair (NOT buzz cut), thin rimless/square-frame
glasses, carefully picking up a rice cake with chopsticks, composed small smile.
Female protagonist (player_f reference): mid-laugh, holding a paper cup of odeng broth.
Background: 2010s Korean 분식집 — handwritten menu on wall, small TV in corner,
red walls, steam and warm fluorescent lighting.
Mood: Saturday-afternoon comfort, three-friends chatting, 2012~2015 nostalgia.
```

### [c1] "미안, 공부해야 해..." — 거절한다

**공통** `jihun-call_c1.png`
```
Small Korean apartment living room or bedroom, evening.
Single 12-year-old Korean child (protagonist, back view or side view, face hidden or downcast)
sitting on the floor or at a small desk. Old-style 2012-era slide/flip phone just set down
on the desk, screen still lit showing an ended call.
Open textbook or notebook in front of them, half-studied. Dim warm table lamp glow.
Through window: blue evening sky, street lamp just turned on.
Mood: quiet regret, choosing the "right" thing but feeling lonely, bittersweet discipline.
Note: gender-neutral framing — use back view or side silhouette so single file works for both.
```

---

## 🟠 W5 elementary-spring-picnic — 봄 소풍

**Scene**: 공원에서 벚꽃 아래 반 친구들과 소풍. 민재+지훈 등장.

**References**:
- `jihun_elementary_fullbody.png` + `minjae_elementary_fullbody.png`
- `player_m_*` or `player_f_*`
- `park_spring.png`

### [c0] 친구들이랑 같이 먹는다

**[male / c0]** `elementary-spring-picnic_c0_m.png`
```
Public park in spring, cherry blossom petals falling. Three 12-year-old Korean
elementary students sitting on a picnic mat with gimbap boxes and snacks.
Jihun (reference): excited grin, mouth full of gimbap.
Minjae (reference): neat short hair (NOT buzz cut), thin rimless/square-frame
glasses, warm half-laugh (NOT wide grin showing teeth), gentle gesture toward
the picnic spread.
Male protagonist (player_m reference): mid-laugh.
Background: blooming cherry trees, other picnic groups scattered in distance.
Mood: warm spring day, pure childhood joy.
```

**[female / c0]** `elementary-spring-picnic_c0_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c1] 장기자랑에 나간다

**[male / c1]** `elementary-spring-picnic_c1_m.png`
```
Small makeshift stage in the park, male protagonist (player_m reference) standing center-stage,
microphone in hand, face red from embarrassment but smiling bravely. Audience of classmates
clapping and cheering in foreground silhouette. Cherry blossom petals in the air.
Mood: stage fright conquered, coming-of-age moment.
```

**[female / c1]** `elementary-spring-picnic_c1_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c2] 혼자 조용히 주변을 구경한다

**[male / c2]** `elementary-spring-picnic_c2_m.png`
```
Quiet corner of the park. Male protagonist (player_m reference, back view, face hidden)
standing alone under a cherry blossom tree, petals drifting around him. Short boy's haircut,
casual spring outfit visible from behind. Distant blurred classmates laughing in the background.
Mood: introspective peace, gentle solitude.
```

**[female / c2]** `elementary-spring-picnic_c2_f.png`
```
Same setting with female protagonist (player_f reference, back view, face hidden).
Longer hair visible from behind, girl's casual spring outfit. No other changes.
```

---

## 🟠 W6 yuna-meet-elementary — 도서관에서 유나

**Scene**: 도서관 창가에서 유나가 혼자 책 읽다가 주인공을 보고 살짝 미소. 별 머리핀, 피아노 가방.

**References**:
- `yuna_elementary_fullbody.png` + `yuna_elementary_neutral.png`
- `player_m_*` or `player_f_*`
- `library_elementary.png`

### [c0] "응, 나도 가끔 읽어" — 책 얘기

**[male / c0]** `yuna-meet-elementary_c0_m.png`
```
Elementary library, afternoon sunlight through window. 12-year-old Korean girl Yuna
(reference) sitting at window seat, caramel wavy hair with small star hair clip, open book
in hands, looking up with gentle shy smile.
Male protagonist standing beside her, showing interest, leaning slightly to see the book.
Piano bag visible hanging on the back of her chair.
Mood: quiet intellectual bonding, first meeting atmosphere.
```

**[female / c0]** `yuna-meet-elementary_c0_f.png`
```
Same setting with female protagonist. No other changes.
```

### [c1] "피아노 배워? 멋있다!" — 피아노 얘기

**[male / c1]** `yuna-meet-elementary_c1_m.png`
```
Library window seat. Yuna (reference) with hands near mouth hiding a small flattered smile,
eyes crinkled. Piano bag beside her, sheet music peeking out. Male protagonist
(player_m reference) sitting across from her, leaning in with a curious smile.
Background: soft sunlight, empty library.
Mood: sweet flustered reaction, gentle pride beneath shyness.
```

**[female / c1]** `yuna-meet-elementary_c1_f.png`
```
Same setting with female protagonist (player_f reference) leaning in with curious smile.
No other changes.
```

### [c2] "난 책 잘 안 봐" — 솔직히

**[male / c2]** `yuna-meet-elementary_c2_m.png`
```
Library window seat. Yuna (reference) back to reading her book, slightly awkward
but polite expression — "oh, that's okay" kind of smile while turning page.
Male protagonist (player_m reference, back view, face hidden) slightly stepping away,
short boy's haircut visible from behind.
Mood: gentle awkwardness, missed connection but not hostile.
```

**[female / c2]** `yuna-meet-elementary_c2_f.png`
```
Same setting with female protagonist (player_f reference, back view, face hidden).
Longer hair visible from behind. No other changes.
```

---

## 🟡 W7 minjae-birthday — 민재 생일

**Scene**: 교실에서 민재 생일. "야 민재 생일이래!" 외치는 반 아이들 속 민재가 수줍게 웃음.

**References**:
- `minjae_elementary_fullbody.png` + `minjae_elementary_neutral.png`
- `classroom_elementary_afternoon.png`

> 이벤트 선택지가 4개 (말걸기 / 편의점 선물 / 책 선물 / 넘기기). 모든 ci에 전용 CG 매핑.

### [c0] "생일 축하해!" — 말을 건다 — 🆕 신규

**공통** `minjae-birthday_c0.png`
```
Elementary classroom, after school. Minjae (reference — neat short hair NOT buzz cut,
thin rimless/square-frame glasses clearly visible) caught off-guard at his desk,
turning his head toward the camera with a small, surprised half-smile — the kind that
slips out before he can compose himself. No gift, no wrapped box — just the words
hanging in the air. One hand still resting on an open notebook (his daily-carried
essential), the other half-raised as if he was about to say something.
Cheeks faintly flushed. Eyes warmer than his usual cool composure allows, glasses
catching a soft glint of late afternoon light.
Background: blurred classmates in the distance, late afternoon light through the
windows, simple chalkboard.
Mood: a quiet beat of unguarded warmth — "고마워" said softly.
```

### [c1] 편의점에서 작은 선물

**공통** `minjae-birthday_c1.png`
```
Elementary classroom, after school hours. Minjae (reference — neat short hair NOT
buzz cut, thin rimless/square-frame glasses clearly visible) holding a small gift box
with both hands, surprised composed half-smile (NOT wide grin showing teeth), cheeks
slightly red. His notebook visible on the desk behind him.
Blurred classmates in background clapping/watching.
Mood: heartfelt surprise that breaks through his composure but doesn't break it
fully — childhood friendship milestone.
```

### [c2] 따로 골라 온 책 한 권 (-5만원, money>=10) — 🆕 신규

**공통** `minjae-birthday_c2.png`
```
Elementary classroom, after school. Minjae (reference — neat short hair NOT buzz
cut, thin rimless/square-frame glasses clearly visible) holding a hardcover book with
both hands, head tilted down reading the title, expression frozen between surprise
and a composed half-smile he's not letting through (NOT wide grin). The carefully
composed "전교 1등" facade is visibly cracking — eyes a touch wider than usual
behind the glasses, lips slightly parted.
Book cover should suggest something thoughtful (a literary novel or quiet essay
collection — not a study guide). Wrapping paper crumpled on the desk beside him,
his usual notebook pushed slightly aside.
Background: empty classroom, late afternoon warm light, blurred chalkboard with
faint test results still visible.
Dialogue cue: "...너, 날 너무 잘 아는데?" — first moment his guard fully drops.
Mood: rival becoming friend — gift that names the unspoken self.
```

### [c3] 그냥 넘어간다 — 🆕 신규

**공통** `minjae-birthday_c3.png`
```
Elementary classroom, after school. Wide shot from the protagonist's seat — the
back of an empty desk in the foreground (the player's POV, no figure shown).
In the middle distance, Minjae (reference — neat short hair NOT buzz cut, thin
rimless/square-frame glasses visible even at distance, notebook held in one hand)
is surrounded by a small cluster of classmates laughing and clapping; he wears a
polite, slightly stiff composed half-smile (NOT wide grin showing teeth) — the
practiced "전교 1등" composure back in place, accepting attention without
returning warmth. Late afternoon light, soft and a bit cold.
Mood: distance — watching from the outside, a small ache of not-quite-belonging.
No direct eye contact between Minjae and the camera.
```

---

### 📦 보관용 (현재 이벤트에 매칭 안 됨)

`_archive/minjae-birthday-phone-msg.png` — 원래 "카톡으로 축하만" c1용으로 만들었으나
이벤트 선택지가 4개로 확장되며 매칭 사라짐. 폰 화면 메시지 컷은 jihun-birthday/subin-birthday/yuna-birthday
같은 이벤트의 "메시지로만" 선택지가 추가되면 그쪽으로 재사용 가능.

```
Close-up of a 2012-era flip phone or slide phone screen showing a Korean messaging app
chat interface (soft yellow background, white speech bubbles — generic messaging style, no brand name):
"생일 축하해" bubble sent, then "고마워" reply.
Background: hand holding the phone, out of focus classroom environment.
Mood: casual minimal effort, slight awkwardness.
```

---

## 🟠 W10 subin-meet-elementary — 학원 친구 수빈

**Scene**: 학원 쉬는 시간. 뒷자리 수빈이 문제집 막혀서 공책을 내밀며 도움 요청.

**References**:
- `subin_elementary_fullbody.png` + `subin_elementary_neutral.png`
- `player_m_*` or `player_f_*`
- `hagwon_front.png`

### [c0] "나도 어렵더라" — 같이 푼다

**[male / c0]** `subin-meet-elementary_c0_m.png`
```
Small cram school (hagwon) classroom, evening. Two 12-year-old students at adjoining desks.
Subin (reference): short black bob, gold star earrings, looking up with earnest hopeful
expression, hand extending a small notebook with math problems.
Male protagonist beside her, leaning in to look at the notebook.
Background: simple hagwon classroom, warm yellow lighting, "학원" signage subtle in background.
Mood: quiet studious bonding, shared struggle.
```

**[female / c0]** `subin-meet-elementary_c0_f.png`
```
Same setting with female protagonist. No other changes.
```

### [c1] "이렇게 푸는 거야" — 설명해준다

**공통** `subin-meet-elementary_c1.png`
```
Hagwon desk close-up. Subin (reference) listening intently, pencil poised, making a
small "ah!" expression of understanding. Protagonist's hand pointing at a problem in her notebook.
Mood: the satisfying moment of teaching a friend, subin's diligent note-taking.
```

### [c2] "나도 막혔어..."

**[male / c2]** `subin-meet-elementary_c2_m.png`
```
Both students at the hagwon desk with defeated but amused expressions, subin covering her mouth
with a small laugh, male protagonist (player_m reference) slumped on the desk. Problem book open
with crossed-out scribbles.
Mood: commiserating failure, unexpected friendship in shared defeat.
```

**[female / c2]** `subin-meet-elementary_c2_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

---

## 🟡 W14 jihun-birthday — 지훈 생일

**Scene**: 교실에서 지훈이 생일 축하받음. 선택지 3종(작은선물 / 농구화끈 / 카톡).

**References**:
- `jihun_elementary_fullbody.png`
- `classroom_elementary_afternoon.png`

### [c0] 선물을 사서 준다 (-2만원) — 작은 선물

**공통** `jihun-birthday_c0.png` ✓
```
Elementary classroom. Jihun (reference) reacting with exaggerated joy to a gift,
"야 너 최고다!" moment — arms thrown up, huge grin. Small wrapped gift on his desk.
Mood: pure happy energetic friendship.
```

### [c1] 좋아하는 농구화 끈 세트를 고른다 (-5만원) — 🆕 신규

**공통** `jihun-birthday_c1.png`
```
Elementary classroom. Jihun (reference) holding a set of basketball shoelaces (multiple
colors — neon green/orange/black) up to the light, mouth agape in genuine awe, eyes wide
and glassy. Mid-laugh but with a serious moved undertone. Wrapped gift box open on his desk.
Background: classmates blurred, slanting golden afternoon light through windows.
Dialogue cue: "야, 이거... 너 진짜 나랑 오래 볼 생각인가 보네." — implied through
expression, mid-laugh that turned serious.
Mood: friendship deepening — small gift, big meaning.
```

### [c2] 카톡으로 축하만 한다 — 공통 카톡 폴백

`jihun-birthday_c2.png` = 본 문서 하단 [🔗 공통 카톡 컷] 동일 이미지 사본.

---

## 🟡 W16 elementary-unit-test — 단원평가 준비

**Scene**: 담임이 "다음 주 단원평가" 공지. 주변 친구들은 별로 신경 안 씀.

**References**: `classroom_elementary_afternoon.png`

### [c0] 집에서 복습

**[male / c0]** `elementary-unit-test_c0_m.png`
```
Child's bedroom desk at home, evening. Male protagonist (player_m reference) sitting at desk
with textbook open, small focused expression. Warm desk lamp light. Stuffed animal or toy on bed visible.
Mood: quiet earnest effort, elementary-student studying.
```

**[female / c0]** `elementary-unit-test_c0_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c1] 그냥 평소대로 논다

**[male / c1]** `elementary-unit-test_c1_m.png`
```
Outside a Korean apartment complex playground area, late afternoon. Male protagonist
(player_m reference) playing on swings or running with a ball, carefree expression.
Mood: carefree childhood, "test? what test".
```

**[female / c1]** `elementary-unit-test_c1_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

---

## 🟡 W25 elementary-semester2-start — 2학기 시작

**Scene**: 여름방학 끝. 햇빛에 탄 얼굴로 돌아온 반 친구들. 칠판에 "곧 졸업이다!".

**References**: `classroom_elementary_afternoon.png`

### [c0] 열심히 해야지

**[male / c0]** `elementary-semester2-start_c0_m.png`
```
Elementary classroom first day of fall semester. Male protagonist (player_m reference) at desk
with determined expression, new textbooks stacked neatly, teacher writing "곧 졸업!" on blackboard
in background. Other students visible but blurred. Sunlight through window — shift from summer
to early fall tone.
Mood: fresh resolve, end-of-childhood awareness.
```

**[female / c0]** `elementary-semester2-start_c0_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c1] 방학 얘기 수다

**[male / c1]** `elementary-semester2-start_c1_m.png`
```
Classroom break time cluster shot. Male protagonist (player_m reference) + 2~3 classmates
gathered at a desk laughing, one showing a photo on a flip phone.
Minjae (reference — neat short hair NOT buzz cut, thin rimless/square-frame glasses
clearly visible, notebook on desk nearby) wears a composed half-smile (NOT wide
grin); Jihun (reference) laughs more openly beside him.
Tan lines visible on some faces (minjae remains average pale skin tone, NOT tanned).
Mood: happy post-vacation chatter, summer tan vibes.
```

**[female / c1]** `elementary-semester2-start_c1_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c2] 추억을 남기자

**공통** `elementary-semester2-start_c2.png`
```
Classroom viewed from protagonist's POV (first-person, looking out across the room from their desk).
Empty desks, late afternoon sun. Protagonist not shown directly (only hint of shoulder/hand on desk at edge of frame).
Sentimental mood.
Mood: nostalgic contemplation of "last semester here".
```

---

## 🟡 W29 subin-birthday — 수빈 생일

**Scene**: 2학기 9월. 수빈 생일. 선택지 3종(작은선물 / 여행에세이 / 카톡).

**References**: `subin_elementary_fullbody.png`, `classroom_elementary_afternoon.png`

### [c0] 선물을 준비했다 (-2만원) — 작은 선물

**공통** `subin-birthday_c0.png` ✓
```
Elementary classroom. Subin (reference) eyes wide in surprise, both hands cupping a small
gift bag, shy happy smile, cheeks faintly pink. "어... 어떻게 알았어!" feeling.
Mood: sweet unexpected joy, quiet character's rare delight.
```

### [c1] 여행 에세이 책 한 권을 고른다 (-5만원) — 🆕 신규

**공통** `subin-birthday_c1.png`
```
Elementary classroom afternoon. Subin (reference) holding a travel essay book with both
hands, head slightly down, eyes shadowed by hair, lips parted but no words coming out.
Long held silence. Book cover should suggest travel/distance — silhouette of distant
landscape, airplane, or open road imagery (no specific brand text).
Background: empty classroom, late afternoon golden light from windows, dust motes visible.
Dialogue cue: "...너, 내가 어디 떠나고 싶어하는 거 알았어?" — moment when she realizes
the protagonist saw a part of her she rarely shows.
Mood: quiet revelation, unspoken understanding between two reserved kids.
```

### [c2] 카톡으로 축하한다 — 공통 카톡 폴백

`subin-birthday_c2.png` = 본 문서 하단 [🔗 공통 카톡 컷] 동일 이미지 사본.

---

## 🟠 W32 elementary-sports-day — 가을 운동회

**Scene**: 10월 가을 운동회. 이어달리기. 지훈이 바통 건네며 "청팀 이길 수 있어!"

**References**:
- `jihun_elementary_fullbody.png`
- `player_m_*` or `player_f_*`
- `gymnasium.png` (또는 스포츠 트랙 배경)

### [c0] 있는 힘껏 달린다 — 결승선 직후 (2등, 지훈이 어깨 감쌈)

> 이벤트 결과 메시지("결과는 2등. 지훈이가 '수고했다!' 하며 어깨를 감쌌다.")를 살린 컷.
> 액션 sprint보다 "선택의 결과"가 보이는 결승 직후가 의미상 더 적합.

**[male / c0]** `elementary-sports-day_c0_m.png`
```
Right after the relay finish line at school sports day. Male protagonist (player_m reference)
breathing hard, slightly bent over with hands on knees or straightening up, sweaty hair.
Jihun (jihun_elementary_fullbody.png reference) beside him, arm draped around the
protagonist's shoulder, big sweaty grin, thumbs up with the other hand. Both wearing
blue team headbands.
Background: blurred cheering crowd, results board faintly visible showing "2위", late
afternoon golden light slanting across the dirt track, "운동회" banner softly out of focus.
Dialogue cue: Jihun saying "수고했다!" — implied through expression and pose.
Mood: shared exhaustion and pride. Not first, but together.
```

**[female / c0]** `elementary-sports-day_c0_f.png`
```
Same setting with female protagonist (player_f reference). Jihun's arm-around-shoulder
gesture should feel like a buddy/teammate, not romantic — friendly camaraderie. No other changes.
```

### [c1] 페이스 유지 — 단독 컷

> 결과 메시지("적당히 뛰었다. 순위는 중간쯤. 그래도 즐거웠다.")는 혼자만의 만족감 톤.
> 지훈이 등장 X — c0와 의도적으로 대비.

**[male / c1]** `elementary-sports-day_c1_m.png`
```
Mid-pack relay finish at school sports day. Male protagonist (player_m reference)
crossing the finish line at moderate pace, neutral relaxed expression, slight smile.
Other runners visible ahead and behind, motion blur on the back ones. Wearing
blue team headband.
Background: outdoor track with blue and white team flags mixed (no clear winner side),
afternoon light, classmates cheering generally rather than at protagonist.
Mood: easy effort, no regret no glory — just a Saturday afternoon.
```

**[female / c1]** `elementary-sports-day_c1_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

---

## 🟡 W37 yuna-birthday — 유나 생일

**Scene**: 2학기 후반 유나 생일. 유나는 조용히 자리에 앉아 있음. 선택지 3종(작은선물 / 머리핀 / 카톡).

**References**: `yuna_elementary_fullbody.png`, `classroom_elementary_afternoon.png`

### [c0] 작은 선물을 준다 (-2만원)

**공통** `yuna-birthday_c0.png` ✓
```
Classroom afternoon. Yuna (reference) quietly receiving a small gift, hands both holding it,
looking down, ears and cheeks faintly red. Small genuine smile.
Mood: subtle deep emotion, quiet character's rare vulnerability.
```

### [c1] 별 장식 머리핀 세트를 준비한다 (-5만원) — 🆕 신규

**공통** `yuna-birthday_c1.png`
```
Elementary classroom, late afternoon — sunlight streaming through windows in clear bright
shafts. Yuna (reference) just put on a small star-shaped hairpin (one of a set, others
visible in opened gift box on desk). She's looking down quietly examining a second pin
in her palm, but the corner of her mouth turns up — a private smile rarely shown.
The protagonist is implied (off-frame). Light catches the metal star on her hair — small
flare of golden window light reflecting off it.
Dialogue cue: "...이거, 내가 늘 쓰는 거 알았어?" — a moment of being seen.
Mood: quiet character finally feeling noticed in a way that matters.
```

### [c2] 조용히 카톡으로 축하한다 — 공통 카톡 폴백

`yuna-birthday_c2.png` = 본 문서 하단 [🔗 공통 카톡 컷] 동일 이미지 사본.

---

## 🟡 W37 elementary-unit-test-2 — 2학기 단원평가가 다가온다

**Scene**: 2학기 마지막 단원평가 전주(W37). "다음 주에 2학기 단원평가~ 올해 마지막" 선생님 말.

**References**: `classroom_elementary_afternoon.png`

### [c0] 열심히 복습

**[male / c0]** `elementary-unit-test-2_c0_m.png`
```
Male protagonist (player_m reference) at home desk, concentrated — but softer, more wistful mood
than c0 of W16. "마지막이니까" awareness. Winter light through window.
Mood: quiet diligence, end-of-elementary-era reflection.
```

**[female / c0]** `elementary-unit-test-2_c0_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

### [c1] 대충 본다

**[male / c1]** `elementary-unit-test-2_c1_m.png`
```
Male protagonist (player_m reference) on bed or lounging, daydreaming expression, holding a
graduation photo booklet or looking at something unrelated to study.
Mood: "곧 졸업이잖아" daydream.
```

**[female / c1]** `elementary-unit-test-2_c1_f.png`
```
Same setting with female protagonist (player_f reference). No other changes.
```

---

## 🔴 W46 elementary-graduation — 초등학교 졸업식

**Scene**: 졸업식 날 강당. 웃는 애, 우는 애, 멍한 애. Y1 감정 클라이맥스.

**References**:
- `jihun_elementary_fullbody.png` + `minjae_elementary_fullbody.png`
- `player_m_*` or `player_f_*`
- `auditorium_elementary.png`

### [c0] 친구들과 사진을 찍는다

**[male / c0]** `elementary-graduation_c0_m.png`
```
Elementary school auditorium or outside of school gate after graduation ceremony.
Three 12-year-old Korean kids in graduation attire/school uniform posing for a photo.
Jihun (reference) center, arm around male protagonist's shoulder, big brave smile with
slightly wet eyes. Male protagonist beside him, emotional smile. Minjae (reference —
neat short hair NOT buzz cut, thin rimless/square-frame glasses clearly visible) on
the other side, composed half-smile (NOT wide grin showing teeth), one hand giving a
small thumbs-up, other hand holding his notebook tucked under his arm. Graduation
flowers in hand. Snow or cold-looking light (winter/february feel).
Background: graduation banner "졸업식", other families in background.
Mood: bittersweet joy, true friendship milestone, tears just held back.
```

**[female / c0]** `elementary-graduation_c0_f.png`
```
Same composition with female protagonist. No other changes.
```

### [c1] 조용히 교실을 둘러본다

**[male / c1]** `elementary-graduation_c1_m.png`
```
Empty classroom viewed from doorway. Male protagonist (player_m reference, back view or
silhouette) standing in middle of the empty classroom, chairs up on desks, short boy's
haircut visible from behind. Afternoon winter sunlight streams through window. Blackboard
wiped clean. One flower petal or graduation paper on a desk.
Mood: profound nostalgic solitude, "this chapter is closing".
```

**[female / c1]** `elementary-graduation_c1_f.png`
```
Same setting with female protagonist (player_f reference, back view or silhouette,
longer hair visible from behind). No other changes.
```

### [c2] "빨리 중학교 가고 싶다!"

**[male / c2]** `elementary-graduation_c2_m.png`
```
Male protagonist (player_m reference) walking out of school gate, back view, short
boy's haircut, looking forward with confident stride. Elementary school building fades
behind. Cherry blossom buds (pre-bloom) on trees hint at spring ahead.
Mood: forward-facing hope, end as new beginning.
```

**[female / c2]** `elementary-graduation_c2_f.png`
```
Same setting with female protagonist (player_f reference, back view, longer hair
visible from behind). No other changes.
```

---

# 🔗 공통 카톡 컷 (생일 c2 폴백 자산)

`jihun-birthday`, `subin-birthday`, `yuna-birthday`의 c2(카톡) 선택은 **NPC 묘사가 약화**된
폰 화면 컷이라 NPC별 차별화 가치가 낮음. **단일 프롬프트로 1개 이미지를 생성**한 뒤
다음 3개 파일명으로 동일 사본 저장:

```
public/images/events/elementary/jihun-birthday_c2.png
public/images/events/elementary/subin-birthday_c2.png
public/images/events/elementary/yuna-birthday_c2.png
```

**공통** 카톡 컷 — 🆕 신규
```
Close-up of a 2012-era flip phone or slide phone screen showing a Korean messaging app
chat interface (soft yellow background, white speech bubbles — generic style, no brand name):
sent bubble "생일 축하해", reply bubble "고마워" — short and minimal.
Phone is held by a hand in the lower frame, blurred classroom or desk in deep background
(no specific NPC visible — must be reusable across 3 events).
Lighting: soft afternoon classroom ambience, slight bokeh on background.
Mood: casual minimal effort — the safe, distant choice between friends who could be closer.
```

> **주의**: NPC별 특이 표현·이름·실루엣 없이 generic하게. 단일 이미지가 3개 이벤트
> (지훈/수빈/유나)에서 모두 사용됨.

---

# 🧭 CG 폴백 정책 (SSOT)

`GameScreen.tsx`의 폴백 cascade는 다음과 같이 동작:

```
{schoolLevel}/{eventId}_c{ci}_{gender}  →  {schoolLevel}/{eventId}_{gender}
  →  {schoolLevel}/{eventId}_c{ci}      →  {schoolLevel}/{eventId}
  →  common/{eventId}_c{ci}_{gender}    →  common/{eventId}_{gender}
  →  common/{eventId}_c{ci}             →  common/{eventId}
```

이벤트별 의도 정책:

| 이벤트 | ci=0 | ci=1 | ci=2 | ci=3 |
|---|---|---|---|---|
| `jihun-birthday` | 작은 선물 (전용) | 농구화 끈 (전용) | 카톡 (공유 사본) | — |
| `subin-birthday` | 작은 선물 (전용) | 여행 에세이 (전용) | 카톡 (공유 사본) | — |
| `yuna-birthday` | 작은 선물 (전용) | 머리핀 (전용) | 카톡 (공유 사본) | — |
| `minjae-birthday` | 말 건다 (전용) | 편의점 선물 (전용) | 책 (전용) | 넘어감 (전용) |

폴백 정책 변경 시 본 표와 `GameScreen.tsx:388` 위 주석을 함께 갱신.

---

# 📊 생성 체크리스트

> 체크 기준: **디스크 파일 존재 여부**. "재생성 강화 프롬프트" 반영도(시각적 품질)는 사람 눈 검수 필요 — `cg-review.html`로 확인하세요.

## 필수
- [x] `first-week_c0_m.png`, `_c0_f.png`
- [x] `first-week_c1_m.png`, `_c1_f.png`
- [x] `first-week_c2_m.png`, `_c2_f.png`
- [x] `minjae-meet-elementary_c0_m.png`, `_c0_f.png`
- [x] `minjae-meet-elementary_c1_m.png`, `_c1_f.png`
- [x] `minjae-meet-elementary_c2_m.png`, `_c2_f.png`
- [x] `jihun-call_c0_m.png` (농구) / `_c0_f.png` (떡볶이)
- [x] `jihun-call_c1.png` (공통: 전화 끊고 혼자, back view/silhouette)
- [x] `yuna-meet-elementary_c0_m.png`, `_c0_f.png`
- [x] `subin-meet-elementary_c0_m.png`, `_c0_f.png`
- [x] `elementary-graduation_c0_m.png`, `_c0_f.png`

## 중요
- [x] `elementary-spring-picnic_c0_m.png`, `_c0_f.png`
- [x] `elementary-spring-picnic_c1_m.png`, `_c1_f.png`
- [x] `elementary-spring-picnic_c2_m.png`, `_c2_f.png` (back view, 실루엣/헤어 구분)
- [x] `yuna-meet-elementary_c1_m.png`, `_c1_f.png` (피아노 reaction)
- [x] `yuna-meet-elementary_c2_m.png`, `_c2_f.png` (back view, 실루엣/헤어 구분)
- [x] `subin-meet-elementary_c1.png` (공통: hand only)
- [x] `subin-meet-elementary_c2_m.png`, `_c2_f.png`
- [x] `elementary-sports-day_c0_m.png`, `_c0_f.png`
- [x] `elementary-sports-day_c1_m.png`, `_c1_f.png`
- [x] `elementary-graduation_c1_m.png`, `_c1_f.png` (silhouette/back view, 헤어 구분)
- [x] `elementary-graduation_c2_m.png`, `_c2_f.png` (back view, 헤어 구분)

## 있으면 좋음
- [x] `minjae-birthday_c0.png` (말 건다) 🆕
- [x] `minjae-birthday_c1.png` (편의점 선물)
- [x] `minjae-birthday_c2.png` (책 한 권)
- [x] `minjae-birthday_c3.png` (그냥 넘어감) 🆕
- [x] `jihun-birthday_c0.png` (작은 선물)
- [x] `jihun-birthday_c1.png` (농구화 끈)
- [x] `subin-birthday_c0.png` (작은 선물)
- [x] `subin-birthday_c1.png` (여행 에세이)
- [x] `yuna-birthday_c0.png` (작은 선물)
- [x] `yuna-birthday_c1.png` (별 머리핀)
- [x] 공통 카톡 컷 → `jihun-birthday_c2.png` / `subin-birthday_c2.png` / `yuna-birthday_c2.png` (동일 SHA 사본 3개 확인)
- [x] `elementary-unit-test_c0_m.png`, `_c0_f.png`
- [x] `elementary-unit-test_c1_m.png`, `_c1_f.png`
- [x] `elementary-semester2-start_c0_m.png`, `_c0_f.png`
- [x] `elementary-semester2-start_c1_m.png`, `_c1_f.png`
- [x] `elementary-semester2-start_c2.png` (공통: POV view)
- [x] `elementary-unit-test-2_c0_m.png`, `_c0_f.png`
- [x] `elementary-unit-test-2_c1_m.png`, `_c1_f.png`

---

**총 34종 (남/여 변형 포함 시 약 55~60장)**

## 🧠 GPT 작업 팁

1. **세션당 1~2 이벤트씩** 진행해 캐릭터 일관성 유지
2. 레퍼런스 이미지 업로드 → "use this exact character design" 명시
3. 이미 만든 CG 하나를 "same style as this" 레퍼런스로 다음 작업에 활용
4. 선택지 간 차이는 구도·표정·배경만 바꾸고 캐릭터 디자인은 그대로 유지 요청
5. 생성 후 `game/public/images/events/` 폴더에 정확한 파일명으로 저장

---

# 🔁 재생성/신규 생성 큐 (2026-05-02 검증 반영)

PNG 비전 검증으로 의도된 서사와 어긋난 컷 + 누락분. 아래 강화 프롬프트로 처리.
기존 위 섹션의 동일 파일명 프롬프트보다 **이쪽이 우선** (negative prompt·강조 추가).

---

## 🆕 1. `elementary-graduation_c2_m.png` — 신규 생성 (누락)

폴더에 미존재. 위 W46 [c2 / male] 프롬프트 그대로 사용:

```
Male protagonist (player_m reference) walking out of school gate, back view, short
boy's haircut, looking forward with confident stride. Elementary school building fades
behind. Cherry blossom buds (pre-bloom) on trees hint at spring ahead.
Mood: forward-facing hope, end as new beginning.
```

---

## 🔁 2. `elementary-sports-day_c1_f.png` — 재생성

**문제**: 현재 PNG가 여주가 결승선 테이프를 끊고 1등으로 들어오는 모습 → 결과 메시지 "순위는 중간쯤"과 정면 충돌.
(c1_m은 텐션은 있으나 결승선·다툼 없음 → 보류 가능. 일관성 위해 같이 재생성하면 더 좋음.)

**강화 프롬프트** (c1 공통, 성별만 reference 교체):

```
Mid-race relay scene at school sports day — RUNNERS STILL IN MOTION, NOT a finish.
ABSOLUTELY NO finish line tape, NO ribbon being broken, NO 1st-place winning pose,
NO podium, NO victory expression.

Female protagonist (player_f reference) running mid-pack on the dirt track,
surrounded by 2~3 other runners on BOTH sides at similar pace (not ahead of them).
Holding the relay baton casually. Neutral relaxed expression with the faintest
small smile — "그저 그런 정도", easy effort, no glory.
Wearing blue team headband.

Background: outdoor track, blue and white team flags mixed (no clear winner side),
afternoon light, classmates cheering generally rather than aimed at protagonist,
"운동회" banner softly out of focus.

Mood: easy effort, no regret no glory — just a Saturday afternoon mid-pack run.

Negative prompt: no finish line tape, no breaking ribbon, no winning pose,
no 1st place podium, no triumphant arms-up gesture.
```

---

## 🔁 3. `yuna-meet-elementary_c2_m.png` & `_c2_f.png` — 재생성

**문제**: 현재 PNG에서 유나가 **정면 응시 + 미소** 짓고 있어 거절 후 어색한 톤이 완전히 사라짐. 프롬프트의 "back to reading her book / slightly awkward" 의도가 안 살아남.

**강화 프롬프트** (c2_m / c2_f 공통 — 주인공 reference만 교체):

```
Elementary library window seat, afternoon. Yuna (reference) ALREADY returned to
reading her book — EYES DOWN ON THE BOOK, head tilted slightly down, fingers on
the page mid-turn. Her face seen mostly from a SIDE/THREE-QUARTER angle, NOT
frontal. Polite "oh, that's okay" smile visible only as a soft mouth corner —
NO direct eye contact with the protagonist, NO frontal beaming smile.

Star hair clip in caramel wavy hair. Piano bag with sheet music beside her chair.

Protagonist (player_m reference [for c2_m] / player_f reference [for c2_f]) shown
in BACK VIEW, face fully hidden, body slightly stepping away from the desk —
mild awkward retreat posture. For c2_m: short boy's haircut visible. For c2_f:
longer hair visible from behind.

Mood: gentle awkwardness, missed connection but not hostile. Emotional distance
quietly restored.

Negative prompt: no frontal smile from Yuna, no direct eye contact between them,
no inviting expression, no protagonist face visible.
```

---

## 🔁 4. `minjae-meet-elementary_c1_m.png` & `_c1_f.png` — 재생성

**문제**: 현재 PNG가 **마주 앉은(across)** 구도 → c0와 구도가 똑같고 프롬프트의 "side by side" 의도 위배. c0 "같이 점심" vs c1 "옆에서 대화" 차별화가 사라짐.

**강화 프롬프트** (c1_m / c1_f 공통 — 주인공 reference만 교체):

```
Elementary school cafeteria, lunch time. Two 12-year-old Korean kids sitting
SIDE BY SIDE on the SAME SIDE of a long cafeteria table — shoulder to shoulder,
both bodies facing the SAME direction. Camera angle: from across the EMPTY
opposite side of the table, looking at both of them together.
Both trays placed in front of them on the same side of the table.

ABSOLUTELY NOT facing each other across the table. NOT a face-to-face composition.

Minjae (reference, on one side): neat short hair (clean side-part, NOT buzz
cut), average pale skin tone, thin rimless or silver square-frame glasses
clearly visible, chopsticks pausing mid-air, head turned slightly TOWARD the
protagonist beside him, quietly engaged explaining gesture, eyes thoughtful
behind glasses. A notebook visible on the table near his tray.
Protagonist (player_m reference [c1_m] / player_f reference [c1_f]) seated
RIGHT NEXT TO Minjae on the same bench/side, head turned slightly toward him,
engaged listener posture, leaning in with curious "아 그래?" expression.

Background: bright cafeteria, other students blurred at distant tables.
Mood: deeper conversation while eating, friendship warming up beyond casual
first-meeting chat — visibly more intimate than c0 "across the table" composition.

Negative prompt: no across-the-table seating, no face-to-face composition,
no two trays facing each other.
```

---

---

## 🌸 Phase 2.2: 친밀도 도달형 이벤트 (Y1 한정)

> 친밀도 30/40/50/60/70/90 도달 시 발동되는 1회성 이벤트.
> 모든 이벤트 `s.year === 1` 한정. **week 없음** → 친밀도 조건 충족 후 매주 RNG 픽.
> 컨셉이 일상~정점이라 각 이벤트당 **NPC 중심 1장**만 만들면 폴백으로 c0/c1/c2 모두 커버 가능.
> 90 슬롯(yuna-window-promise / subin-paper-airplane)만 성별 분기 권장.

### 우선순위

- **P0 (정점, 성별별 2장 권장)**: yuna-window-promise (90), subin-paper-airplane (90)
- **P1 (핵심 70 슬롯, 1장)**: yuna-perfect-smile, doyun-window-school, minjae-crumbled-note
- **P2 (중간 50 슬롯, 1장)**: yuna-sticker-plan, subin-keychain, doyun-secret-spot
- **P3 (가벼운 30 슬롯, 1장)**: yuna-milk-duty, subin-reading-marathon, doyun-comic-share(정비)

→ subin-night-light(70)는 단톡 메시지 장면이라 일반 CG보다 **스마트폰 화면 일러스트**가 자연스러움 (P1 별도 처리).

---

## 🌸 [도달형 intimacy>=30] yuna-milk-duty — 우유 당번 (P3)

> 결과: 유나가 "고마워, 사실 좀 무거웠어" 하고 웃는다.

**`yuna-milk-duty.png`** (공통 1장, 성별/선택지 폴백)
```
Korean elementary classroom doorway, early morning spring light. A 12-year-old girl
Yuna (reference) standing at the door holding one handle of a square milk crate.
Her fingertips slightly red from the cold metal handle, bright smile but a tiny shy hint.
Another small figure (player, silhouette/back view, gender-neutral) holding the other handle.
Background: morning hallway through the open door, soft sunrise glow on tile floor.
Mood: small-shared-effort, springtime classroom warmth, "we're carrying this together".
```

---

## 🌸 [도달형 intimacy>=50] yuna-sticker-plan — 별 스티커 계획표 (P2)

> 결과: 유나가 계획표 귀퉁이를 만지작거린다. "나 이거 다 채우면 괜히 안심돼."

**`yuna-sticker-plan.png`** (공통 1장)
```
Elementary classroom desk during break time, mid-day light. Close shot on Yuna's
(reference) hand-drawn weekly planner spread on the desk — handwritten columns
(국어/수학/피아노) covered in tiny gold/silver star stickers, some still
half-peeled. Yuna sitting beside the planner, slightly embarrassed expression,
fingertips touching the corner of the page as if to hide it. Player (back view,
gender-neutral) leaning over to look.
Mood: a small private ritual gently revealed, slight vulnerability behind brightness.
```

---

## 🌸 [도달형 intimacy>=70] yuna-perfect-smile — 칠판 옆 웃음 (P1)

> 결과: 유나가 칠판 손잡이를 놓았다. "…고마워. 진짜." 말끝이 떨리다가 또 웃음으로 감춰진다.

**`yuna-perfect-smile.png`** (공통 1장)
```
Korean elementary classroom before class, sunlit chalkboard area. Yuna (reference)
standing beside the green chalkboard, one hand frozen mid-erase with chalk dust
floating in slanted morning sunlight. Her expression: half-smile that doesn't reach
the eyes, vulnerable question hovering in the air. Chalk dust drifting like tiny
particles in the sunbeam. Player (silhouette/back) at the desk in foreground, blurred.
Mood: a brave honest moment behind the role of "always smiling", quiet vulnerability,
chalk dust shimmer.
```

---

## 🌸 [도달형 intimacy>=90] yuna-window-promise — 창문 옆 약속 (P0, 성별 분기)

> 결과: 유나가 창문에 그린 별을 손바닥으로 지운다. "그 말, 오래 기억할 것 같아."

**[male]** `yuna-window-promise_m.png`
```
Elementary classroom at dusk, deep winter light. Empty classroom, soft golden-blue
hour. Yuna (reference) standing at a frosted window, fingertip drawing a tiny star
on the cold glass — small star shape visible in the fog of her breath. Male
protagonist (player_m reference) standing a step behind her, hands in coat pockets,
soft uncertain warm expression.
Background: empty desks in shadow, winter trees outside through the misted window.
Mood: pre-graduation winter quietness, "is it okay to just be me?" weight of friendship.

Outfit override (winter, 졸업 직전): Yuna and player both wearing puffy down jackets
or thick winter coats over long-sleeve tops; scarves around their necks; flushed
pink cheeks and nose tips from cold; visible breath fog at the window. Keep face,
hair, height, and overall character design identical to the references.
```

**[female]** `yuna-window-promise_f.png`
```
Same scene with female protagonist (player_f reference). Slight pose difference:
both girls' silhouettes against the misted window, both quiet, gentle parallel energy.
Mood: same — pre-graduation winter, vulnerable confidence between two girls.

Outfit override (winter, 졸업 직전): both girls in puffy down jackets or thick
winter coats over long-sleeve tops; scarves around their necks; flushed pink cheeks
and nose tips from cold; visible breath fog at the window. Keep face/hair/build
identical to the references.
```

---

## 🌸 [도달형 intimacy>=30] subin-reading-marathon — 독서 마라톤 종이 (P3)

> 결과: 수빈이가 책등 세 권을 집어 준다. "이 중에 하나만 같이 읽어도 돼."

**`subin-reading-marathon.png`** (공통 1장)
```
Elementary school library corner, afternoon sun through tall windows. Small
bulletin board with a handmade "이번 주 책 세 권 읽기" paper notice pinned with
a single thumbtack. Subin (reference) standing beside the shelf, three slim
children's books cradled in her arms, gentle smile that pretends not to need
an answer. Player (back view, gender-neutral) in foreground reading the notice.
Mood: quiet bookish friendship, "no pressure" softness, library hush.
```

---

## 🌸 [도달형 intimacy>=50] subin-keychain — 책갈피 대신 열쇠고리 (P2)

> 결과: 수빈이가 "잘 쓸 거지?" 하고 웃는다. 열쇠고리가 가벼운데 주머니 한쪽은 왠지 무겁다.

**`subin-keychain.png`** (공통 1장)
```
Elementary school hallway after lunch. Subin (reference) standing by the wall,
her open palm extended showing a small mart-promo keychain (cheap plastic fruit
or character mascot, slightly worn). Soft smile, eyes a little distant as if
giving away something small but personal. Player's hand (gender-neutral, partial)
reaching to receive it. Hallway windows behind, midday light.
Mood: a tiny token passed between friends, slight bittersweet undertone of
"things mom brings home".
```

---

## 🌸 [도달형 intimacy>=70] subin-night-light — 늦은 밤 불빛 얘기 (P1, 폰 화면 일러스트)

> 결과: 답장이 늦게 왔다. "…그렇구나. 나만 그런 줄 알았어." 이모티콘 하나 없는 대화가 이상하게 따뜻하다.

**`subin-night-light.png`** (폰 화면 또는 야경 1장)
```
Late-night scene from player's perspective. A small smartphone (2010s-style)
glowing in a dim bedroom, screen showing a Korean chat (KakaoTalk-like UI)
with messages: "너 아직 깨어 있어? …괜찮으면 잠깐만." "우리 집 거실 불, 밤새
켜두는 날이 있어. 그냥." The phone illuminates a corner of a blanket and a
sleeping desk lamp. Outside the bedroom window, a single warm light glowing
from an apartment window across the street (suggesting Subin's living room).
Mood: quiet midnight, gentle solitude shared across a screen, soft warm glow.
```

(폰 화면 일러스트가 어려우면 대안: 어두운 거실 창문 밖에서 보이는 한 칸 노란 불빛, 인물 등장 없음)

---

## 🌸 [도달형 intimacy>=90] subin-paper-airplane — 종이비행기 (P0, 성별 분기)

> 결과: 종이비행기가 교실 앞문까지 미끄러진다. 수빈이가 "생각보다 멀리 갔다" 하고 오래 바라본다.

**[male]** `subin-paper-airplane_m.png`
```
Empty elementary classroom on the day before graduation, late afternoon winter sun.
Subin (reference) sitting on top of a desk, hands holding a finished paper airplane
with two tiny handwritten names on the wings (just barely visible). Male protagonist
(player_m reference) sitting on the adjacent desk, both looking at the plane between
them. Empty rows of desks behind, faint golden particles of dust in the sunbeam.
Mood: pre-graduation last quiet moment, names-on-wings dream, "anywhere we could go".

Outfit override (winter, 졸업 직전): Subin and player both in thick winter sweaters
or puffy down jackets over long-sleeve shirts; scarves loose around necks; classroom
heater suggested by warm tones but their cheeks slightly pink. Keep face/hair/build
identical to the references.
```

**[female]** `subin-paper-airplane_f.png`
```
Same scene with female protagonist (player_f reference). Both girls perched on
desks, same paper airplane, same names on wings.
Mood: parallel friendship quietness, same wistful dream.

Outfit override (winter, 졸업 직전): both girls in thick winter sweaters or puffy
down jackets over long-sleeve shirts; scarves loose around necks; cheeks slightly
pink. Keep face/hair/build identical to references.
```

---

## 🌸 [도달형 intimacy>=30] doyun-comic-share — 쉬는 시간 만화책 (P3, 정비)

> 결과: 도윤이가 "다 보면 다음 사람한테 넘겨줘" 하며 자연스럽게 순서를 정한다.
> ※ 기존 W22 고정에서 도달형으로 정비. CG 컨셉은 동일.

**`doyun-comic-share.png`** (공통 1장 — 성별 무관, 도윤 단독+책)
```
Korean elementary classroom during break time. Doyun (reference, gender depends
on player) walking between desks holding a slightly worn comic book volume out
with one hand toward viewer, casual confident smile, classmates in background
already reading other volumes of the same series. Mid-day classroom light.
Mood: friendly book-sharing ritual, "you next" easygoing camaraderie.
```

(남주 플레이 → male doyun, 여주 플레이 → female doyun. 기존 doyun 캐릭터 시트의 성별별 버전 사용)

---

## 🌸 [도달형 intimacy>=40] doyun-secret-spot — 운동장 스탠드 뒤편 (P2)

> 결과: "저건 축구공 모양인데? 야, 넌 먹는 것만 생각하냐?" 도윤이가 웃자 그늘 안 공기가 같이 흔들린다.

**`doyun-secret-spot.png`** (공통 1장)
```
A quiet shaded spot behind the schoolyard bleachers / under the gym's outer
stairs. Doyun (reference) leaning back against the concrete wall, looking up
at the sky through a gap with a lazy grin, one knee bent. Player (silhouette
beside doyun, gender-neutral) sitting too, looking up. Afternoon golden light
filtered through the structure overhead, dust motes floating.
Mood: secret-hideout childhood feeling, "no one knows about this place",
cool-shade relief from the schoolyard noise.
```

---

## 🌸 [도달형 intimacy>=60] doyun-window-school — 창문 너머 말 (P1)

> 결과: 도윤이가 고개를 끄덕이고 창문에 손을 댄다. 유리가 따뜻해서 김이 서린다.

**`doyun-window-school.png`** (공통 1장)
```
Elementary classroom after school, noisy classmates blurred in background.
Doyun (reference) leaning against a sunlit window, palm pressed to the warm
glass — a small misted handprint forming on the inside of the window. Looking
out toward distant rooftops where another school is faintly visible. Eyes
unfocused, faint sadness behind a casual posture. Player (silhouette/back)
in foreground out of focus.
Mood: pre-separation quiet, "we won't be at the same school next year",
warm glass and cold horizon.

Outfit override (winter, 졸업 직전 겨울): Doyun in a thick winter sweater or
zip-up fleece over long-sleeve, optional puffy jacket draped on chair; bare
trees visible outside the misted window; warm interior tone vs. cold exterior.
Keep face/hair/build identical to the doyun reference (gender follows player).
```

---

## 🌸 [도달형 intimacy>=70] minjae-crumbled-note — 구겨진 만점 (P1)

> 결과: 민재가 한참 만에 "실수하면 안 된대" 하고 낮게 말했다. 구겨진 종이만 조금 펴진다.

**`minjae-crumbled-note.png`** (공통 1장)
```
Empty corner of an elementary classroom, late afternoon. Minjae (reference —
neat short hair NOT buzz cut, thin rimless/square-frame glasses clearly visible
in 3/4 view, average pale skin) sitting at his desk, head slightly bowed, an
open desk drawer in front of him revealing a crumpled paper note in his palm
— a small "100점" (100 score) written in red visible on the wrinkled note.
His other hand resting limp on the desk near his closed notebook. Expression:
composed half-smile trying to seem casual but losing the mask, eyes hidden
behind glasses catching the evening light. Empty chairs around, evening light
slanting through windows.
Mood: hidden pressure visible for a moment, "it's nothing" said too quickly,
gold-light loneliness.

Outfit override (late autumn ~ early winter, around W30~W40): Minjae wearing
a long-sleeve school sweater or cardigan over collar shirt, long pants; no
short sleeves. Indoor warm tone; trees outside the window with sparse remaining
leaves or bare branches. Keep face/hair/build identical to the minjae reference
(thin glasses must remain visible).
```

---

## 📋 GPT에 던질 때 체크리스트

### 기존 (완료)
- [x] `elementary-graduation_c2_m.png` (신규)
- [x] `elementary-sports-day_c1_f.png` (재생성)
- [x] `yuna-meet-elementary_c2_m.png` (재생성)
- [x] `yuna-meet-elementary_c2_f.png` (재생성)
- [x] `minjae-meet-elementary_c1_m.png` (재생성)
- [x] `minjae-meet-elementary_c1_f.png` (재생성)

### Phase 2.2 도달형 — P0 (정점, 우선)
- [x] `yuna-window-promise_m.png`
- [x] `yuna-window-promise_f.png`
- [x] `subin-paper-airplane_m.png`
- [x] `subin-paper-airplane_f.png`

### Phase 2.2 도달형 — P1 (핵심 70)
- [x] `yuna-perfect-smile.png`
- [x] `doyun-window-school.png`
- [x] `minjae-crumbled-note.png`
- [x] `subin-night-light.png` (폰 화면 일러스트 또는 야경)

### Phase 2.2 도달형 — P2 (중간 50)
- [x] `yuna-sticker-plan.png`
- [x] `subin-keychain.png`
- [x] `doyun-secret-spot.png`

### Phase 2.2 도달형 — P3 (가벼운 30, 후순위)
- [x] `yuna-milk-duty.png`
- [x] `subin-reading-marathon.png`
- [x] `doyun-comic-share.png` (정비)

생성 완료 후 `game/public/images/events/elementary/`에 동일 파일명으로 저장.
파일이 없으면 GameScreen.tsx의 폴백 cascade가 자동으로 처리 (`{eventId}_c{ci}_{g}` → `{eventId}_{g}` → `{eventId}_c{ci}` → `{eventId}` → common).
