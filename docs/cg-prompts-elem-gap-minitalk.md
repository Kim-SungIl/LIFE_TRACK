# Event CG Prompts — 초등 갭(Y1 누락분) + P1 mini-talk

> LIFE_TRACK 게임의 **초등 갭(Y1)** 이벤트 + **P1 mini-talk 8종** CG 생성 프롬프트 모음.
> 포맷·스타일 앵커는 `docs/event-cg-prompts-y1.md`를 정본으로 미러링.
> 캐릭터 외형 마커 SSOT는 `docs/character-prompt-spec.md` — 인라인 기술이 spec과 어긋나면 spec이 우선.
> 촬영 대상 정의·파일 경로 규칙은 `docs/cg-shotlist-2026-06.md`("## 초등 갭" 섹션 + "P1 mini-talk" 표).

---

## 🎨 공통 스타일 가이드

이 문서의 CG는 **두 그룹**으로 나뉘고, 학교급(나이·의상·배경)이 서로 다르다.

### 모든 CG 공통 앵커

```
Art style: Anime-style illustration, soft pastel colors, gentle lighting,
           same character design as the provided reference sheets.
Composition: cinematic scene, focused emotion, natural lens feel
Resolution: 1440x810 (16:9) or 1080x1440 (3:4 portrait — for character close-ups)
```

### 그룹 A — 초등 갭 (Y1)

```
Era: 2012~2015 Korean elementary school life nostalgia
Age: 12-year-old children (Korean 6th grade / 초6)
Outfit: NO school uniform — casual everyday wear (navy hoodie/zip-up, T-shirt, jeans, sneakers)
Setting: elementary school (운동장/교실/강당) or home
```

**Negative prompt (그룹 A)**:
```
no middle school uniform, no high school uniform, no adult features,
no exaggerated anime eyes, no sexualization, no modern smartphones (2010s flip/slide phones OK)
```

> ⚠️ **`doyun-school-split` 예외**: id는 초등 친구(도윤)와의 이별 서사지만 **발동이 Y2 W2**라
> `getSchoolLevel(2)=middle` → 파일은 **`middle/` 디렉토리**에 둬야 리졸버가 찾는다.
> 단 장면은 **혼자 방 안에서 폰 카톡을 보는 컷**이라 교복이 거의 안 보이므로,
> 나이는 13세(중1)·사복(실내 캐주얼)으로 그리되 학교 교복·배경은 등장시키지 않는다.

### 그룹 B — mini-talk (친밀도 80 도달 → 주로 중·고 구간)

```
Era: 2010s~present Korean school life
Age/School: 친밀도 도달 시점에 의존 — 대부분 middle(중)~high(고). 아래 개별 메모의 학교급 따름.
Outfit: school uniform per stage (middle/high navy blazer) — 단 사복/실내 컷은 캐주얼
Setting: 개별 장면(매점 평상/빈 교실/음악실/강당/비 오는 길/집 폰 화면 등)
```

**파일 경로(그룹 B)**: choiceIndex=0 고정, 발동 학년 유동 → **`common/{id}_{g}.png` 또는 성별무관 `common/{id}.png` 1장** 권고
(촬영 리스트 §B). 본 8종은 전부 성별무관 묘사라 **`common/{id}.png` 1장**으로 충분.

**Negative prompt (그룹 B)**:
```
no elementary casual-only framing, no adult/college features, no sexualization,
no exaggerated anime eyes, consistent character design with reference sheets
```

---

## ⚠️ 캐릭터 외형 강제 마커 (등장 NPC)

> 정본은 `character-prompt-spec.md`. CG 인라인 기술이 spec과 어긋나면 spec이 우선.

### 초등 그룹 — 등장 NPC

#### doyun (박도윤) — spec L505-517 (elementary)
```
[REQUIRED visual markers — elementary doyun]
- Short NEAT black hair, slightly side-parted (NOT messy bangs — messy bangs = jihun)
  ⚠️ HAIR COLOR = BLACK (NOT brown/caramel)
- Clear warm brown eyes, bright confident "golden boy of the class" smile
- Athletic, well-proportioned, slightly tall for age — but composed LEADER aura
  (NOT jihun's playful hyperactive energy)
- Outfit: GREEN jersey / soccer shirt + shorts + grass-stained sneakers
- Prop (맥락 의존): soccer ball under arm or one foot on the ball
  (소품은 운동장 컷에서만 — 교실·방·강당 컷에서는 생략 가능)
- Differentiation from jihun: neat hair (vs messy), clean-cut, leader composure (vs playful)
```

#### jihun (한지훈) — spec L315-347 (elementary). graduation-prep에 단체 등장
```
- Messy BLACK hair, messy bangs over forehead (NOT center part)
- Sportswear category (athletic zip-up / track / jersey) — NOT casual everyday (player_m's code)
- Color tone: royal blue / white / red accent
- Athletic build, broad shoulders, big energetic grin showing teeth
- Prop 맥락 의존: 졸업/실내 정적 컷에서는 농구공 생략 OR 가방 strap의 농구공 keychain만
```

#### minjae (박민재) — spec L424-434 (elementary). graduation-prep에 단체 등장
```
- Neat short hair (clean side-part / short cut, NOT buzz cut)
- Thin rimless OR thin silver square-frame glasses — defining marker, MUST be visible
  (NOT round — round is haeun)
- Composed half-smile (NEVER wide grin showing teeth), average pale skin (NOT tanned)
- Outfit (elementary): navy or grey plain hoodie (NOT bright red), dark pants
- Notebook: 졸업 앨범 촬영 같은 ceremony 컷에서는 손에서 빼고 set aside OR 생략
  (graduation에서 노트 강요 금지 — 졸업장/사진 맥락이 우선)
- Differentiation from player_m: player_m has NO glasses, NO notebook
```

#### player_m / player_f (주인공) — spec L220-283
```
[player_m elementary] natural medium-length BLACK hair, soft CENTER part (NOT messy bangs),
  NO glasses, NO prop. Casual everyday wear — light GREY/BEIGE zip-up over white/light T,
  dark indigo jeans (NOT navy/blue zip-up — navy collides with jihun's royal blue).
  Composed, slightly innocent smile (less energetic than jihun).
[player_f elementary] dark brown straight hair slightly above shoulders, light pink cardigan
  over white T, denim skirt, white sneakers, warm innocent smile.
```

### mini-talk 그룹 — 등장 NPC (중·고 버전)

#### jihun (한지훈) — spec middle/high. talk_jihun_90_bench
```
- Messy black hair, athletic broad-shouldered build, bright energetic baseline
- Navy school blazer (worn casually, slightly open) + white shirt, basketball keychain on bag
- 단 90_bench는 평상에 앉은 정적 컷 — 농구공 없이 이온음료 캔만, 표정은 서툰 다정함
```

#### subin (오수빈) — spec. talk_subin_70_*, talk_subin_90_*
```
- Short black bob (clean), small GOLD STAR EARRINGS (defining marker), slim, composed
- middle/high navy blazer + white shirt + red ribbon + plaid skirt
- 70_night_light는 폰 화면/거실 불빛 톤(수빈 본인 거의 미등장 가능),
  90_two_names는 집 앞/현관 문패 톤의 조용한 컷
```

#### minjae (박민재) — spec middle/high. talk_minjae_70_*, talk_minjae_90_*
```
- Thin rimless/silver square-frame glasses (MUST be visible), neat short side-part hair
- Composed half-smile (NOT wide grin), average pale skin
- middle/high navy blazer properly buttoned + white shirt
- 90_unmasked는 방과후 빈 교실 — 늘 날 서 있던 표정을 푸는 순간(살짝 지친·편안)
```

#### yuna (유나) — spec. talk_yuna_90_wrong_note
```
- Caramel (light brown) wavy hair, STAR HAIR CLIP on right side (marker), NO glasses
- Bright curious expression baseline — 단 90_wrong_note는 음악실에서 조용·내성적인 결
- middle/high navy blazer + red ribbon + plaid skirt
```

#### haeun (김하은) — spec L549-565. talk_haeun_90_empty_line (Y6+ → high 전용)
```
- Dark brown straight bob slightly above shoulders w/ natural flyaways
- BLACK-framed ROUND-rectangle glasses (round = haeun's marker, vs minjae's square)
- Holding could be a short note/쪽지 (이 장면 특화) — 평소엔 red-covered book을 품에 안음
- Shy thoughtful smile, navy blazer + large red ribbon + plaid skirt
- 선배(상급생) → 주인공보다 약간 성숙. high uniform
```

#### junha (김준하) — spec L606-625 (high 전용, Y6 전학생)
```
- Short dark brown messy/unstyled hair, THICKER STRAIGHTER eyebrows (marker)
- Slightly sharper jaw, sturdy broad-shouldered build
- Navy blazer slightly ill-fitting (recently transferred), warm earnest expression
- Differentiation from player_m: thicker brows, sharper jaw, broader, more rugged
```

---

## 📁 파일명 규칙 (요약)

리졸버 cascade: `{schoolLevel}/{id}_c{ci}_{g}` → `{sl}/{id}_{g}` → `{sl}/{id}_c{ci}` → `{sl}/{id}` → `common/...`
schoolLevel은 year로 결정: **elementary=Y1 / middle=Y2~Y4 / high=Y5~Y7**.

- 초등 갭: `elementary/{id}_c{ci}_{g}.png` (gender 분기 있는 컷) 또는 `elementary/{id}_c{ci}.png` (공통 컷)
  - **예외 `doyun-school-split`**: `middle/doyun-school-split_c{ci}.png` (Y2 발동)
- mini-talk: `common/{id}.png` (성별무관 1장; choiceIndex=0 고정)

---

# 📅 초등 갭 (Y1, 누락분)

---

## 🟠 W4 doyun-meet-elementary — 운동장 한 명 모자라 (★남주 전용)

**발동조건**: `year === 1 && gender === 'male'`, W4. 체육부장 도윤이 점심시간 운동장 축구에 합류 권유.
**Scene**: 점심시간 운동장. 도윤이가 축구공을 한 손으로 튕기며 다가와 "한 명 모자라는데, 너 들어올래? 너 발 빠르잖아."

**References**: `doyun_elementary_fullbody.png` + `doyun_elementary_neutral.png` · `player_m_elementary_fullbody.png` · `gymnasium.png`

### [c0] "좋아!" — 같이 뛴다 (첫 골)

> 결과: "도윤이가 패스를 정확하게 줬다. 한 골 넣고 같이 웃었다." (discovery/warm/4)

**파일명** `elementary/doyun-meet-elementary_c0_m.png`
```
Elementary school outdoor field / gymnasium, lunch-time, late spring daylight.
Two 12-year-old Korean BOYS playing soccer together.
Doyun (reference): GREEN soccer jersey + shorts + grass-stained sneakers, short NEAT
black hair (side-parted, NOT messy bangs), bright confident "golden boy" grin, mid-motion
just after passing the ball — natural leader posture.
Male protagonist (player_m reference): just received the pass / striking the ball into goal,
bright open laughing expression, light GREY or beige casual T-shirt + shorts (NOT navy —
navy collides with sport tones), sweaty from running.
Background: school field, goal net, blurred classmates playing, bright midday sun, dust kicked up.
Mood: first-friendship spark through sport, the satisfying moment of scoring the first goal together.
```

### [c1] "잠깐만, 가방만 두고 갈게"

> 결과: "교실에 가방 두고 운동장으로 뛰었다. 도윤이가 '왜 이렇게 늦어!' 하면서도 자리를 만들어줬다." (discovery/warm/3)

**파일명** `elementary/doyun-meet-elementary_c1_m.png`
```
Elementary school field edge, lunch-time. Male protagonist (player_m reference) jogging in
from the school building side, schoolbag just dropped by the fence, slightly out of breath,
small eager smile (괜히 빨라진 걸음).
Doyun (reference): GREEN jersey, one hand waving him over / making space in the lineup,
mock-complaining "왜 이렇게 늦어!" grin, foot resting on the soccer ball.
Background: outdoor field, other kids mid-game blurred, bright midday sun.
Mood: warm welcome, a slightly-too-eager step toward a new friendship.
```

> c2("오늘은 좀..." 사양)는 memorySlotDraft 없음 → CG 비대상.

---

## 🟠 W4 doyun-meet-elementary-f — 청소시간 (★여주 전용, 별도 id)

**발동조건**: `year === 1 && gender === 'female'`, W4. **남주 버전과 id가 분리**된 별도 장면(축구 X, 청소시간 관찰).
**Scene**: 청소시간 교실. 도윤이가 무거운 양동이를 대신 들어주고 "내가 들게. 별것도 아니야." 정리하다 너와 잠깐 눈이 마주치며 살짝 웃는다.

**References**: `doyun_elementary_fullbody.png` + `doyun_elementary_neutral.png` · `player_f_elementary_fullbody.png` · `classroom_elementary.png`

### [c0] "멋있다" — 솔직하게 말한다

> 결과: "도윤이가 '어, 별거 아닌데' 하면서도 어깨가 살짝 으쓱해졌다." (discovery/warm/4)

**파일명** `elementary/doyun-meet-elementary-f_c0_f.png`
```
Elementary classroom during cleaning time, late afternoon. Doyun (reference) carrying a
heavy water bucket with both hands (helping a classmate), GREEN jersey or casual tee,
short NEAT black hair, shoulders subtly puffed up with modest pride ("어, 별거 아닌데"),
warm confident smile. NO soccer ball in this indoor cleaning scene.
Female protagonist (player_f reference): pausing mid-cleaning (broom or cloth in hand),
looking at him with a candid impressed expression, light pink cardigan over white T.
Background: classroom mid-cleaning — desks pushed aside, mop/broom, soft afternoon light,
relaxed loosened class atmosphere, blurred classmates.
Mood: noticing why he's popular — a quiet first spark of admiration.
```

### [c1] 눈이 마주치자 살짝 웃어준다

> 결과: "도윤이가 살짝 끄덕이고 다시 청소를 한다. 별 말 안 했는데 뭔가 통한 기분이다." (discovery/warm/3)

**파일명** `elementary/doyun-meet-elementary-f_c1_f.png`
```
Same elementary classroom cleaning-time setting. A brief eye-meet between Doyun (reference,
GREEN jersey/casual, neat black hair) and the female protagonist (player_f reference) across
the room — Doyun gives a small nod and a faint smile before turning back to cleaning.
Composition: medium-wide so both faces read the silent "something clicked" beat.
Soft afternoon light, blurred classmates tidying in background.
Mood: wordless understanding — the moment a circle starts being drawn in the yearbook.
```

> c2(못 본 척 청소 계속)는 memorySlotDraft 없음 → CG 비대상.

---

## 🔴 W2(Y2) doyun-school-split — 도윤이는 다른 학교 (★middle 디렉토리 함정)

**발동조건**: `year === 2 && doyun.met`, W2. **Y2 발동 → schoolLevel=middle** → 파일은 `middle/` 디렉토리.
**Scene**: 중학교 입학 둘째 주. 카톡으로 도윤이가 "나 다른 중학교 가게 됐어. 학군 때문에 이사 가더라고. 미리 말 못해서 미안~~" 읽고 한참 가만히 있었다.
**톤**: 혼자 방 안에서 폰 화면을 보는 컷. 교복 거의 안 보임 — 실내 사복/13세.

**References**: `player_m_*` / `player_f_*` (실내 사복, 후방·측면 실루엣 권장) · `home_evening.png`
> NPC(도윤) 직접 등장 X — 폰 화면의 카톡 말풍선으로만 존재.

### [c0] "야 진짜야? 우리 만나서 밥이라도 먹자" — 약속을 잡으려 한다

> 결과: "도윤이가 '오 진짜? 좋지!!!' 답했지만, 약속은 결국 잡히지 않았다." (discovery/regret/6)

**파일명** `middle/doyun-school-split_c0.png`
```
A 13-year-old Korean kid (protagonist, back view or side silhouette, face hidden/downcast)
alone in their own bedroom in the evening, sitting on the floor or bed, holding a smartphone.
Phone screen lit, showing a Korean messaging app chat (generic, no brand): a long hopeful
message just sent ("우리 만나서 밥이라도 먹자"), reply bubble "오 진짜? 좋지!!!" — but the
chat trails off, no follow-up scheduling. Indoor casual home wear (NO school uniform visible).
Through window: blue evening sky, a single streetlamp on.
Mood: a promise made that quietly never happens — first lesson that different schools mean
different time. Bittersweet, not bitter.
```

### [c1] "잘 가" — 짧게 답한다

> 결과: "'응. 너도 잘 지내.' 도윤이의 답도 짧았다. 그렇게 카톡 창이 닫혔다." (failure/regret/7)

**파일명** `middle/doyun-school-split_c1.png`
```
Same bedroom-evening setting, protagonist (back/side silhouette, face hidden). Phone screen
shows a very short exchange: "잘 가" sent, "응. 너도 잘 지내." reply — then the thumb hovering
over a closed/dimming chat. The screen is about to go dark. Indoor casual wear, NO uniform.
Dim warm room, single lamp, cold blue light from the phone on the face/hand.
Mood: a relationship closing in two short lines — quiet regret of words not said.
```

### [c2] 읽씹한다 — 뭐라고 답해야 할지 모르겠다

> 결과: "하루, 이틀, 일주일이 지나자 답할 수 없는 분위기가 됐다." (failure/regret/7)

**파일명** `middle/doyun-school-split_c2.png`
```
Same bedroom-evening setting. The phone lies face-up on the desk or floor, screen showing
Doyun's last unanswered message ("...미리 말 못해서 미안~~") marked READ (읽음) but with no reply,
a "1" read-mark gone. Protagonist (back view / out of frame, only a shoulder or hand at the
edge) NOT touching the phone — frozen, unable to type. Indoor casual, NO uniform.
Several days implied (a calendar / faint time passing). Dim cooling light.
Mood: the ache of a message you couldn't bring yourself to answer — a spring that quietly faded.
```

---

## 🔴 W45 graduation-prep-elementary — 졸업 앨범 촬영

**발동조건**: Y1 W45. **`ANNUAL_EVENT_IDS` 아님** → memorySlotDraft 슬롯 생성됨(회고 대상). (discovery/warm/7)
**Scene**: 졸업 앨범 촬영. 사진관/교실에서 반 전체가 웃는다. 롤링페이퍼에 "중학교 가서도 보자". 지훈·민재 등장(마커 spec).

**References**: `jihun_elementary_fullbody.png` · `minjae_elementary_fullbody.png` · `player_m_*` / `player_f_*` · `classroom_elementary_afternoon.png`

### [c0] (사진 촬영 — 단체 컷)

**파일명** `elementary/graduation-prep-elementary_c0_m.png`
```
Elementary classroom decorated for yearbook photo day, late autumn / early winter afternoon
light. A group of 12-year-old Korean classmates squeezed together for a class photo, all
warm laughing smiles, a 롤링페이퍼 (rolling-paper poster) on the wall reading
"중학교 가서도 보자".
Front-center cluster: Male protagonist (player_m reference — black soft center-part hair,
casual grey/beige top, NO glasses) mid-laugh.
Jihun (reference — messy black hair, athletic, big open grin showing teeth, royal-blue
accent casual/sport top) beside him, arm thrown around shoulders.
Minjae (reference — neat short hair NOT buzz cut, thin rimless/square glasses clearly
visible, composed half-smile NOT wide grin) on the other side; NO notebook in this photo
scene — hands free or a small peace sign.
Background: classroom decorated with garlands, chalkboard with "졸업 축하" doodles, a
photographer's camera/tripod hint in foreground, warm nostalgic afternoon glow.
Mood: pure end-of-childhood warmth — last class photo before everyone scatters to different
middle schools. Bittersweet but bright.
```

**[female] 파일명** `elementary/graduation-prep-elementary_c0_f.png`
```
Same composition with ONLY one change: male protagonist replaced by female protagonist
(player_f reference — shoulder-length dark brown hair, pink cardigan, warm smile).
Jihun MUST remain a 12-year-old BOY, Minjae MUST remain a 12-year-old BOY (glasses visible,
composed half-smile). All other elements (롤링페이퍼, decorations, mood, light) identical.
```

> c1(무드래프트)은 importance 미달/슬롯 미생성 → 단일 c0 1세트(남/여)면 충분.

---

## 🟠 W47 doyun-graduation-sign — 졸업앨범 뒤에 사인 (남/여 choices 둘 다)

**발동조건**: `year === 1 && doyun.met`, W47. **남(`choices`) / 여(`femaleChoices`) 서술·선택 분기**. 각 importance≥3 → 전부 CG 대상.
> 촬영 리스트 본 표엔 미기재였으나 본 담당에 명시 포함됨(리스트 "애매한 점 2" 참조). femaleChoices까지 드래프트 풍부.

**References**: `doyun_elementary_fullbody.png` + `doyun_elementary_neutral.png` · `player_m_*` / `player_f_*` · `auditorium_elementary.png` (운동장 톤도 가능)

### 남주 — Scene
졸업식 며칠 뒤 운동장. 도윤이가 졸업앨범을 들고 "야, 사인 하나 해줘. 나도 너 거 해줄게." 매직펜을 쥐어준다.

#### [c0] "중학교 달라도 자주 보자" — 진심으로 적는다 (reconciliation/warm/6)
> 결과: 도윤이가 자기 사인 옆에 작은 축구공을 그렸다. "나중에 만나면 모른 척하지 마라."

**파일명** `elementary/doyun-graduation-sign_c0_m.png`
```
Outside the elementary school field a few days after graduation, bright clear winter daylight.
Doyun (reference — GREEN jersey or casual graduation-day clothes, short neat black hair,
warm bright smile) holding an open graduation yearbook (졸업앨범), having just drawn a tiny
soccer ball next to his signature with a marker pen. Male protagonist (player_m reference)
beside him writing a heartfelt line in Doyun's book, both leaning over the open page.
Marker pens in hand. Background: empty field, a couple of lingering classmates, soft winter sun.
Dialogue cue: "나중에 만나면 모른 척하지 마라." — implied through Doyun's warm grin.
Mood: a real promise between two boys parting for different middle schools — warm, hopeful.
```

#### [c1] 장난스럽게 짧게 적는다 (discovery/warm/4)
> 결과: "'야 이게 뭐야!!!' 도윤이가 웃으면서 똑같이 짧게 적었다."

**파일명** `elementary/doyun-graduation-sign_c1_m.png`
```
Same field / post-graduation setting. Doyun (reference) laughing big "야 이게 뭐야!!!" at a
silly short scribble in his yearbook, scribbling something equally short back. Male protagonist
(player_m reference) grinning mischievously, marker in hand. Light playful energy, open
yearbook between them, bright winter sun.
Mood: goofy lightness — both pretending this isn't the last time (둘 다 마지막인 줄 모르는 척).
```

#### [c2] 뭐라고 적을지 한참 고민하다 평범하게 마무리 (failure/regret/4)
> 결과: "'잘 지내' 정도로 적었다. 그게 어떤 뜻인지는 그때 몰랐다."

**파일명** `elementary/doyun-graduation-sign_c2_m.png`
```
Same setting. Close-ish on the open yearbook page — a plain short line "잘 지내" written in
marker, the pen hesitating / lingering over the page. Male protagonist (player_m reference,
slightly downcast or pensive) having struggled to find words; Doyun (reference) writing
something similarly plain beside him, a small unreadable expression. Muted winter light.
Mood: the quiet regret of a goodbye that should have said more — felt only later.
```

### 여주 — Scene (femaleDescription, 거리감 호감 톤)
무리에 둘러싸여 있던 도윤이가 졸업앨범을 든 채 너 쪽으로 슬쩍 다가와 "...사인, 한 줄만 해줄래?" 매직펜이 건네진다.

#### [c0-f] 잠깐 펜을 멈췄다가, 한 줄 진심으로 적는다 (discovery/warm/5)
> 결과: 도윤이가 페이지를 보더니 "...너답다" 하고 자기 것도 짧게 적어줬다.

**파일명** `elementary/doyun-graduation-sign_c0_f.png`
```
Outside the elementary school field a few days after graduation, clear winter daylight.
Doyun (reference — neat black hair, GREEN jersey or casual, having just slipped away from a
small cluster of classmates in the background) holding an open yearbook toward the female
protagonist (player_f reference). She has paused her marker pen for a beat, then writes one
sincere line. Doyun glances at the page with a small soft "...너답다" expression.
Background: distant cluster of classmates, winter sun, slightly shy distance between the two.
Mood: a quiet crush-distance warmth — being singled out for one honest line.
```

#### [c1-f] 살짝 웃고 짧게 한 줄 적는다 (discovery/warm/4)
> 결과: "도윤이도 별 말 없이 짧게 적었다. 페이지를 닫는 손이 평소보다 조심스러웠다."

**파일명** `elementary/doyun-graduation-sign_c1_f.png`
```
Same post-graduation field setting. Female protagonist (player_f reference) writing a short
line with a faint smile; Doyun (reference) writing back wordlessly, then closing the yearbook
page with unusually careful hands. Background: classmates in distance, soft winter light.
Mood: gentle, unspoken — the one day Doyun was quieter than usual.
```

#### [c2-f] "...뭐 적지" 하다가 평범하게 마무리 (failure/regret/4)
> 결과: "결국 '잘 지내' 정도로 끝냈다. 그게 어떤 뜻인지는 그땐 몰랐다."

**파일명** `elementary/doyun-graduation-sign_c2_f.png`
```
Same setting, close-ish on the open yearbook page with a plain "잘 지내" line, marker pen
hesitating ("...뭐 적지"). Female protagonist (player_f reference, slightly pensive) and Doyun
(reference) each writing something plain, a small distance between them. Muted winter light.
Mood: a goodbye that stayed safe and ordinary — regret understood only in hindsight.
```

---

# 📅 P1 mini-talk (8종)

> 모달은 `<Portrait>`만 렌더하지만, mini-talk 슬롯이 회고 갤러리에서 `sourceEventId`로 CG를 조회 → 촬영 대상.
> choiceIndex=0 고정 · 성별무관 묘사 → 전부 **`common/{id}.png` 1장**.

---

## talk_subin_70_night_light — 거실 불빛 (subin intimacy≥70)

**카테고리/톤/imp**: discovery / melancholy / 3 · 중·고 공통
**Scene**: 늦은 밤 단톡. 수빈이 답장이 평소보다 늦게 도착 — "우리 집 거실 불, 밤새 켜두는 날이 있어. 그냥." 이모티콘 하나 없는 말풍선.

**파일명** `common/talk_subin_70_night_light.png`
```
Late night. Close composition on a smartphone in a hand, Korean messaging app chat (generic,
no brand) showing a quiet message from Subin: "우리 집 거실 불, 밤새 켜두는 날이 있어. 그냥."
— a plain bubble, no emoji, arriving late at night.
Behind / reflected: a warm living-room light glow that doesn't turn off, seen softly through
a window or doorway (subin's home implied, she need not appear directly). Dark room, the phone
and the distant warm light the only sources.
Mood: melancholy tenderness — a light that stays on, words that linger longer than they should.
```

---

## talk_minjae_70_phone_call — 뒤집힌 휴대폰 (minjae intimacy≥70)

**카테고리/톤/imp**: discovery / burden / 3 · 중·고 공통
**Scene**: 민재가 휴대폰을 뒤집어 놓고 물컵만 만지작 — "별일 아니야. 집에서 전화 온 거야." "나 가끔은... 기대받는 거 되게 시끄러워." 자랑하던 목소리가 처음 작아진다.

**파일명** `common/talk_minjae_70_phone_call.png`
```
Minjae (reference — neat short hair, thin rimless/silver square glasses CLEARLY visible,
composed but pale, navy school blazer) sitting at a table, his smartphone turned FACE-DOWN
beside him, fingers fidgeting with a water glass. His usual composed expression has dropped
a notch — voice gone quiet, eyes slightly tired. "기대받는 거 되게 시끄러워" implied.
Background: quiet indoor (classroom corner / cafe), soft muted light.
Mood: the weight of expectation — the first time his confident facade gets quieter.
```

---

## talk_jihun_90_bench — 매점 평상 (jihun intimacy≥80, 주로 high)

**카테고리/톤/imp**: growth / warm / 5 · 주로 high
**Scene**: 매점 평상. 지훈이가 말없이 이온음료를 네 이마에 대어 온다. "나한텐 힘든 척해도 돼. 내가 힘은 세니까." 앞만 보며 툭 던지는 서툰 다정함.

**파일명** `common/talk_jihun_90_bench.png`
```
A school snack-bar (매점) wooden bench/platform (평상), daytime. Jihun (reference — messy black
hair, athletic build, high-school navy blazer worn casually) sitting beside the viewer/protagonist,
NOT looking at them — facing forward — while pressing a cold sports-drink can/bottle to their
forehead. Awkward gruff tenderness in his expression. NO basketball in hand (static bench scene).
Background: snack-bar, blurred students, bright casual daytime.
Dialogue cue: "힘든 척해도 돼." — clumsy warmth, eyes forward.
Mood: a friend offering a shoulder instead of a joke — warm, slightly embarrassed care.
```

---

## talk_subin_90_two_names — 두 이름의 집 (subin intimacy≥80, 주로 high)

**카테고리/톤/imp**: discovery / melancholy / 5 · 주로 high
**Scene**: 수빈이가 웃는 얼굴을 조금 늦게 꺼낸다. "우리 집 문패엔 이름이 두 개면 돼. 엄마랑 나." 처음으로 보여주는 집의 모양.

**파일명** `common/talk_subin_90_two_names.png`
```
Subin (reference — short black bob, small gold star earrings clearly visible, composed,
high-school navy blazer + red ribbon) standing near a home entrance / doorway, a slightly
delayed quiet smile. Subtle focus on a small nameplate (문패) by the door bearing two names
(no readable text needed — just two name slots). She is letting the protagonist see the
shape of her home for the first time.
Background: a modest apartment/house entrance, soft evening light.
Mood: quiet melancholy trust — showing a private truth ("엄마랑 나") to someone who won't
make it strange.
```

---

## talk_minjae_90_unmasked — 빈 교실 (minjae intimacy≥80, 주로 high)

**카테고리/톤/imp**: discovery / warm / 5 · 주로 high (교복 강하게 보임 → high 허용)
**Scene**: 방과후 빈 교실. 민재가 늘 날 서 있던 표정을 슬쩍 푼다. "나... 사실 다 괜찮은 척하느라 좀 지쳤나 봐." "근데 너 앞에선 안 괜찮아도 되더라."

**파일명** `common/talk_minjae_90_unmasked.png`
```
An empty classroom after school, late afternoon light. Minjae (reference — neat short hair,
thin rimless/silver square glasses CLEARLY visible, high-school navy blazer + white shirt)
sitting at a desk, the usual tense/composed sharpness in his face SOFTENED — a tired but
relieved half-smile (NOT wide grin). Slightly slumped, guard down.
Background: rows of empty desks, warm slanting afternoon sun through windows, chalkboard faint.
Dialogue cue: "안 괜찮아도 되더라." — first time the mask comes off.
Mood: warm vulnerability — the relief of not having to be okay in front of one person.
```

---

## talk_yuna_90_wrong_note — 음악실 (yuna intimacy≥80, 주로 high)

**카테고리/톤/imp**: growth / breakthrough / 5 · 주로 high
**Scene**: 음악실. 유나가 악보 위에 지우개를 올려두고도 쓰지 않는다. "방금 음, 틀렸는데... 그냥 둘래." "이상하게 들려도, 지금 내 소리 같아서."

**파일명** `common/talk_yuna_90_wrong_note.png`
```
A school music room, soft daytime light. Yuna (reference — caramel wavy hair, STAR HAIR CLIP
on right side clearly visible, NO glasses, high-school navy blazer) at a piano or desk with a
sheet of music, an eraser RESTING on the score but NOT being used. Quieter and more inward
than her usual bright energy — a small resolved smile looking at the un-erased wrong note.
Background: music room (piano, music stands), gentle light.
Dialogue cue: "지금 내 소리 같아서." — choosing her own voice over a perfect note.
Mood: a quiet breakthrough — accepting imperfection as authenticity.
```

---

## talk_haeun_90_empty_line — 졸업 앞둔 강당 (haeun intimacy≥80 & yearMin 6, ★high 전용)

**카테고리/톤/imp**: growth / resolve / 5 · **Y6+ 확정 → high 전용**
**Scene**: 졸업을 앞둔 강당. 하은 선배가 짧은 쪽지를 접지 않은 채 건넨다. "마지막 줄은 비워둘게. 네가 나중에 쓰면 돼." "내 말로 끝나면, 그건 네 얘기가 아니니까."

**파일명** `common/talk_haeun_90_empty_line.png`
```
A school auditorium near graduation, late winter light. Haeun (reference — dark brown straight
bob slightly above shoulders w/ flyaways, BLACK-framed ROUND-rectangle glasses clearly visible,
high-school navy blazer + large red ribbon, shy thoughtful smile) — a senior/상급생, slightly
mature — holding out a short hand-written note (쪽지), UNFOLDED, toward the viewer/protagonist.
The note's last line is visibly left BLANK (empty space at the bottom). Soft graduation-season
auditorium light.
Dialogue cue: "마지막 줄은 비워둘게." — leaving room for the protagonist to finish.
Mood: gentle resolve — a mentor leaving a deliberate blank instead of an answer.
```

---

## talk_junha_90_umbrella — 비 오는 날 (junha intimacy≥80, ★high 전용 / Y6 전학생)

**카테고리/톤/imp**: growth / warm / 5 · **준하=고2 전학 → high 전용**
**Scene**: 비 오는 날. 준하가 우산 손잡이를 네 쪽으로 조금 더 기울인다. "비 오면 그냥 뛰면 된다 했는데, 같이 있으니까 속도를 맞춰야 되더라." "혼자 빨리 가는 거, 별로 멋있는 일 아이더라."

**파일명** `common/talk_junha_90_umbrella.png`
```
A rainy day, walking outdoors. Junha (reference — short dark brown messy hair, THICKER straighter
eyebrows, sturdy broad-shouldered build, high-school navy blazer slightly ill-fitting) holding
an umbrella and TILTING the handle a little more toward the viewer/protagonist, so the umbrella
shelters them rather than himself — his outer shoulder getting slightly wet. Earnest warm
expression, matching his pace to a slower walking companion.
Background: rainy street/school path, puddles, soft grey daylight, rain texture.
Dialogue cue: "혼자 빨리 가는 거, 별로 멋있는 일 아이더라." (부산 사투리 톤) — implied through pose.
Mood: warm growth — choosing to slow down and share the umbrella instead of rushing alone.
```

---

## 📊 작성 목록 요약

**초등 갭 (그룹 A) — 13컷**
- `doyun-meet-elementary` (남): c0_m, c1_m → 2
- `doyun-meet-elementary-f` (여): c0_f, c1_f → 2
- `doyun-school-split` (★`middle/`): c0, c1, c2 → 3
- `graduation-prep-elementary`: c0_m, c0_f → 2
- `doyun-graduation-sign`: c0_m, c1_m, c2_m, c0_f, c1_f, c2_f → 6 (담당 명시 "남/여 choices 둘 다")

**P1 mini-talk (그룹 B) — 8컷** (전부 `common/{id}.png` 성별무관 1장)
- talk_subin_70_night_light, talk_minjae_70_phone_call, talk_jihun_90_bench, talk_subin_90_two_names,
  talk_minjae_90_unmasked, talk_yuna_90_wrong_note, talk_haeun_90_empty_line, talk_junha_90_umbrella

**총 21컷.**
