# Event CG Prompts — Y1 (초6, 초등학교 6학년)

> LIFE_TRACK 게임의 Y1(초등 6학년) 이벤트 CG 생성 프롬프트 모음.
> GPT 등 이미지 생성 AI에게 **캐릭터/배경 레퍼런스 이미지 + 프롬프트**를 함께 입력하여 일관성 있는 CG를 제작.

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
Minjae (reference): buzz cut, tanned skin, wide genuine grin, chopsticks in hand,
leaning forward slightly with animated expression.
Male protagonist: laughing at something minjae said, relaxed shoulders.
Background: bright cafeteria, other students blurred in background.
Mood: first-friendship spark, warm and cheerful.
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
Minjae (reference): buzz cut, tanned skin, mid-speaking expression with chopsticks pausing,
eyes animated, explaining something enthusiastically.
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

## 🔴 W3 jihun-call — 지훈이의 전화 (남=농구 / 여=떡볶이)

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
Minjae (reference): defending with serious focused expression, buzz cut.
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
Minjae (reference): carefully picking up a rice cake with chopsticks, small smile.
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
Minjae (reference): laughing, arm raised in animated gesture.
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

### [c0] 선물을 사서 준다

**공통** `minjae-birthday_c0.png`
```
Elementary classroom, after school hours. Minjae (reference) holding a small gift box
with both hands, wide surprised smile showing teeth, cheeks slightly red.
Blurred classmates in background clapping/watching.
Mood: heartfelt surprise, childhood friendship milestone.
```

### [c1] 카톡으로 축하만

**공통** `minjae-birthday_c1.png`
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

**Scene**: 교실에서 지훈이 생일 축하받음.

**References**:
- `jihun_elementary_fullbody.png`
- `classroom_elementary_afternoon.png`

### [c0] 선물을 사서 준다

**공통** `jihun-birthday_c0.png`
```
Elementary classroom. Jihun (reference) reacting with exaggerated joy to a gift,
"야 너 최고다!" moment — arms thrown up, huge grin. Small wrapped gift on his desk.
Mood: pure happy energetic friendship.
```

### [c1] 카톡으로 축하만

**공통** `jihun-birthday_c1.png`
```
Similar to minjae-birthday c1 — 2012 era phone screen, Korean messaging app chat interface
(soft yellow background, white speech bubbles — generic messaging style, no brand name):
"생일 축하해" bubble sent, then "고마워" reply.
Mood: casual but slightly impersonal.
```

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
(minjae, jihun in reference style) gathered at a desk laughing, one showing a photo on a flip phone.
Tan lines visible on some faces.
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

**Scene**: 2학기 9월. 수빈 생일.

**References**: `subin_elementary_fullbody.png`, `classroom_elementary_afternoon.png`

### [c0] 선물을 준비했다

**공통** `subin-birthday_c0.png`
```
Elementary classroom. Subin (reference) eyes wide in surprise, both hands cupping a small
gift bag, shy happy smile, cheeks faintly pink. "어... 어떻게 알았어!" feeling.
Mood: sweet unexpected joy, quiet character's rare delight.
```

### [c1] 카톡으로 축하

**공통** `subin-birthday_c1.png`
```
Phone screen chat close-up — heart emoticon and "고마워~" reply.
Mood: warm but distant.
```

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

**Scene**: 2학기 후반 유나 생일. 유나는 조용히 자리에 앉아 있음.

**References**: `yuna_elementary_fullbody.png`, `classroom_elementary_afternoon.png`

### [c0] 작은 선물을 준다

**공통** `yuna-birthday_c0.png`
```
Classroom afternoon. Yuna (reference) quietly receiving a small gift, hands both holding it,
looking down, ears and cheeks faintly red. Small genuine smile.
Mood: subtle deep emotion, quiet character's rare vulnerability.
```

### [c1] 카톡으로만 축하

**공통** `yuna-birthday_c1.png`
```
Phone screen. Simple "고마워" message, no emoji — minimalist just like yuna.
Mood: cool and quiet.
```

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
slightly wet eyes. Male protagonist beside him, emotional smile. Minjae on the other side,
thumbs-up. Graduation flowers in hand. Snow or cold-looking light (winter/february feel).
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

# 📊 생성 체크리스트

## 필수
- [ ] `first-week_c0_m.png`, `_c0_f.png`
- [ ] `first-week_c1_m.png`, `_c1_f.png`
- [ ] `first-week_c2_m.png`, `_c2_f.png`
- [ ] `minjae-meet-elementary_c0_m.png`, `_c0_f.png`
- [ ] `minjae-meet-elementary_c1_m.png`, `_c1_f.png`
- [ ] `minjae-meet-elementary_c2_m.png`, `_c2_f.png`
- [ ] `jihun-call_c0_m.png` (농구) / `_c0_f.png` (떡볶이)
- [ ] `jihun-call_c1.png` (공통: 전화 끊고 혼자, back view/silhouette)
- [ ] `yuna-meet-elementary_c0_m.png`, `_c0_f.png`
- [ ] `subin-meet-elementary_c0_m.png`, `_c0_f.png`
- [ ] `elementary-graduation_c0_m.png`, `_c0_f.png`

## 중요
- [ ] `elementary-spring-picnic_c0_m.png`, `_c0_f.png`
- [ ] `elementary-spring-picnic_c1_m.png`, `_c1_f.png`
- [ ] `elementary-spring-picnic_c2_m.png`, `_c2_f.png` (back view, 실루엣/헤어 구분)
- [ ] `yuna-meet-elementary_c1_m.png`, `_c1_f.png` (피아노 reaction)
- [ ] `yuna-meet-elementary_c2_m.png`, `_c2_f.png` (back view, 실루엣/헤어 구분)
- [ ] `subin-meet-elementary_c1.png` (공통: hand only)
- [ ] `subin-meet-elementary_c2_m.png`, `_c2_f.png`
- [ ] `elementary-sports-day_c0_m.png`, `_c0_f.png`
- [ ] `elementary-sports-day_c1_m.png`, `_c1_f.png`
- [ ] `elementary-graduation_c1_m.png`, `_c1_f.png` (silhouette/back view, 헤어 구분)
- [ ] `elementary-graduation_c2_m.png`, `_c2_f.png` (back view, 헤어 구분)

## 있으면 좋음
- [ ] `minjae-birthday_c0.png`, `_c1.png` (공통: minjae / phone)
- [ ] `jihun-birthday_c0.png`, `_c1.png` (공통: jihun / phone)
- [ ] `subin-birthday_c0.png`, `_c1.png` (공통: subin / phone)
- [ ] `yuna-birthday_c0.png`, `_c1.png` (공통: yuna / phone)
- [ ] `elementary-unit-test_c0_m.png`, `_c0_f.png`
- [ ] `elementary-unit-test_c1_m.png`, `_c1_f.png`
- [ ] `elementary-semester2-start_c0_m.png`, `_c0_f.png`
- [ ] `elementary-semester2-start_c1_m.png`, `_c1_f.png`
- [ ] `elementary-semester2-start_c2.png` (공통: POV view)
- [ ] `elementary-unit-test-2_c0_m.png`, `_c0_f.png`
- [ ] `elementary-unit-test-2_c1_m.png`, `_c1_f.png`

---

**총 34종 (남/여 변형 포함 시 약 55~60장)**

## 🧠 GPT 작업 팁

1. **세션당 1~2 이벤트씩** 진행해 캐릭터 일관성 유지
2. 레퍼런스 이미지 업로드 → "use this exact character design" 명시
3. 이미 만든 CG 하나를 "same style as this" 레퍼런스로 다음 작업에 활용
4. 선택지 간 차이는 구도·표정·배경만 바꾸고 캐릭터 디자인은 그대로 유지 요청
5. 생성 후 `game/public/images/events/` 폴더에 정확한 파일명으로 저장
