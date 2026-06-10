# Event CG Prompts — P1 mini-talk (회고 노출 미니톡 8종)

> "말 걸기" 미니이벤트 중 기억으로 남는 8종. 모달은 Portrait만 쓰지만, 회고 화면에선 sourceEventId로 CG를 조회한다.
> 친밀도 80 도달이라 발동 학년이 유동적(주로 중·고) → 파일은 common/{id}.png(성별무관 1장) 권고.

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
