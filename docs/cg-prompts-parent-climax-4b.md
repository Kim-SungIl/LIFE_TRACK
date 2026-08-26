# Event CG Prompts — 부모 강점별 "절정 순간" (Phase 4B, 6컷)

> **왜 이 6컷이 최우선인가.** `PARENT_CLIMAX_EVENTS`(`src/engine/talkData/miniEvents.ts`)는 **강점당 평생 1회**
> 발동하고 한 판에 최대 2회 나온다. 회상 슬롯 importance는 **5**, 즉 엔딩 "돌아보면"에 잘 뽑힌다.
> 그런데 **CG가 0장이다** — `grep -c climax src/cg-manifest.generated.ts` → `0`.
> 엔딩 회상이 그림을 지게 된 뒤([[PR #414]]), CG 없는 회상은 카테고리 엠블럼으로 떨어진다.
> 실측 540런에서 마지막-선택지 플레이의 엠블럼 비율이 27.9%까지 오르는데, **그 자리의 상당 부분이 이 6종**이다.
> 6장으로 매 판 등장하는 최상위 importance 슬롯이 전부 실사진급 장면을 갖는다 — 컷당 회수가 가장 크다.

**스펙 SSOT**: `docs/parent-4b-climax-spec-2026-06-11.md` (장면 원문·트리거·화자 귀속)
**외형 SSOT**: `docs/character-prompt-spec.md` §mother / §father (L713~760)
**포맷 상속**: `docs/cg-prompts-high-y5-y7.md` §공통 스타일 가이드 (Art style / Era / Negative prompt)

---

## 📁 파일 경로 — `common/` 6장, 성별 분기 없음

| 근거 | 내용 |
|---|---|
| 학교급 | `climaxYearMin`이 2·3·4·4·4·5로 갈려 **발동 학교급이 중·고 유동**이다. `middle/`·`high/` 어느 쪽에 두어도 반쪽만 걸린다 → `common/` |
| choiceIndex | 선택지 없는 단일 컷. `applyMemorySlotFromMiniTalk`가 `choiceIndex = 0` 고정으로 기록한다(`memorySystem.ts`) |
| 성별 | **6컷 전부 주인공이 프레임에 없다**(POV 또는 소품·부모 단독). 교복·체형 단서가 아예 없으므로 `_m`/`_f` 분기가 불필요 |

```
public/images/events/common/climax_parent_emotional.png
public/images/events/common/climax_parent_wealth.png
public/images/events/common/climax_parent_info.png
public/images/events/common/climax_parent_strict.png
public/images/events/common/climax_parent_resilience.png
public/images/events/common/climax_parent_freedom.png
```

폴백 cascade가 `common/{id}` 를 마지막 후보로 포함하므로(`src/engine/eventCg.ts`) 위 6장이면 전 학년에서 해석된다.
파일 추가 후 `node scripts/generate-cg-manifest.mjs`(= `npm run prebuild`)로 매니페스트 재생성 필요.

> ⚠️ **성별 무분기는 "주인공을 프레임에 넣지 않는다"에 전적으로 의존한다.**
> 2026-07-01 개정 방침대로, gender-neutral 프레이밍은 **전부 남주로 렌더되는** 실적이 있다(교복·체형 단서가 남주로 기움).
> 그래서 이 6컷은 중립을 노리는 게 아니라 **주인공을 아예 빼는** 설계다. 각 컷 프롬프트에 인라인 부정문으로 박아 두었다.
> 생성 결과에 주인공(교복 상체·뒷모습·얼굴)이 들어왔다면 **폐기하지 말고** 그 성별로 리네임 후
> 카운터파트만 추가 생성한다(2026-07 1차 11장 구제와 동일 절차). 손·팔뚝만 보이는 건 무분기 유지 가능.

---

## 🎨 공통 스타일

`cg-prompts-high-y5-y7.md` §공통 스타일 가이드를 그대로 상속. 이 6컷 고유의 델타만 아래.

```
Era: 2010s~present Korean home interior
Setting: 집 안 — 공부방 / 서재·안방 서랍 / 거실 식탁 / 방문 앞 복도. 학교 배경 없음.
Cast: 엄마 또는 아빠 1인, 또는 무인(소품만). 주인공·형제·타 NPC 없음.
Light: 실내 저조도 기본(밤·저녁). 따뜻한 전구색과 식은 형광색의 대비가 정서를 나른다.
Framing: 1인칭 시선(POV) 또는 소품 클로즈업. 대화 장면이 아니라 "말이 없던 순간"의 정물.
```

**[전 컷 공통 금지]** — 상속 항목 ①~④에 더해:

1. **읽히는 글자 전면 금지.** 이 6컷은 종이 소품(통장·포스트잇·성적표·자료)이 서사의 중심이라 특히 위험하다.
   **"흐리게 처리"·"블러"로 지시하지 말 것** — 사각 가우시안 슬랩을 덧대 그림을 훼손한 전례가 있다(2026-07, 12장 리터치).
   올바른 지시는 **"원래부터 글자가 없는 표면"**: 종이는 접히거나 뒤집히거나 손·각도에 가려 **문자가 프레임에 들어오지 않는** 구도로 그린다.
   숫자·금액·날짜·이름·학교명 전부 해당. 유사 글리프(글자 같아 보이는 낙서)도 금지 — 차라리 여백으로 둔다.
2. **주인공 금지.** 교복 상체·뒷머리·얼굴·전신 실루엣 모두 프레임 밖. 손·팔뚝·손가락만 허용.
3. **부모는 성인이고 학년과 무관하다** — `mother_middle_*` / `father_middle_*` 초상을 그대로 레퍼런스로 첨부.
   중등/고등 발동 어느 쪽이든 같은 얼굴·같은 옷차림이어야 한다(연령 변화 표현 금지).
4. **감정 과장 금지.** 이 6종은 전부 "말을 아낀 순간"이다. 눈물·포옹·극적 표정·드라마틱한 역광 금지.
   전달 수단은 **소품의 배치와 문의 틈과 등의 각도**다.

**Negative prompt (전 컷 공통)**
```
no readable text, no letters, no numbers, no dates, no names, no pseudo-glyphs, no signage,
no blurred rectangular patches over surfaces, no protagonist, no student uniform, no child,
no siblings, no crying, no hugging, no melodramatic backlight, no adult/elderly exaggeration,
no western interior, no brand logos, consistent with mother/father reference portraits
```

**레퍼런스 첨부 (전 컷)**
- `game/public/images/characters/mother_middle_neutral.png`
- `game/public/images/characters/father_middle_neutral.png`

---

## 🖼 컷 명세 (6종)

### ① `common/climax_parent_emotional.png` — 문틈 5센티, 핫초코

**강점/화자**: emotional · 엄마 · `climaxYearMin: 2`
**슬롯**: reconciliation / warm / 5 — *"아무것도 묻지 않고 핫초코만 두고 가던 그 밤."*
**원문**: 밤 11시, 공부방 문이 5센티쯤 열렸다. 엄마는 아무것도 묻지 않았다. 핫초코 한 잔이 책상 모서리에 놓였다가, 문이 다시 조용히 닫혔다.

```
Late night, a Korean student's study room, lit only by a desk lamp. Close composition on the
CORNER OF THE DESK: a single mug of hot chocolate just set down, faint steam rising, a soft
ring of condensation forming on the wood. Beside it, the edges of open notebooks and a pen —
all pages BLANK, no writing whatsoever.
Behind and to the side, the room door stands open about five centimetres. Through that narrow
gap: warm hallway light, and nothing else — the mother has already gone, she is NOT in frame.
The gap is the whole point: a hand withdrew, a question was not asked.
Mood: reconciliation / warm — care delivered without a single word. Quiet, still, generous.
Palette: warm lamp amber on the desk against the cooler dark of the room; the hallway light a
thin warm blade through the door gap.
Framing: first-person view from where the student sits, desk corner in the near field, door gap
in the middle distance, shallow depth of field.
[MUST NOT] no person in frame at all, no protagonist, no uniform, no readable text on any page,
no clock face with legible numbers, no phone screen.
```

---

### ② `common/climax_parent_wealth.png` — 서랍, 내 이름의 통장

**강점/화자**: wealth · 아빠 · `climaxYearMin: 5`
**슬롯**: unspoken_debt / warm / 5 — *"개설일이 입학식 날이던, 내 이름의 통장."*
**원문**: 아빠 서랍을 열다 내 이름이 적힌 무언가를 봤다. 금액이 아니라, 개설일이 입학식 날인 게 먼저 눈에 들어왔다. 아빠는 그걸 보더니 "밥은 먹었냐" 하고는 서랍을 닫았다.

> ⚠️ 이 컷이 텍스트 사고 위험 1순위다. 통장은 **닫힌 채**로만 그린다 — 이름도 개설일도 금액도 프레임에 없다.
> 서사(오래 준비된 것)는 글자가 아니라 **낡음**으로 전달한다: 색이 바랜 표지, 닳은 모서리, 눌린 자국.

```
Evening. A half-open wooden drawer in a Korean home study/bedroom. Inside, among neatly kept
household odds and ends, a CLOSED bank passbook — plain, slightly faded cover, corners worn
soft, edges pressed from years of being tucked away. It stays SHUT: no page open, no cover
lettering, nothing legible anywhere.
A young person's HAND (only the hand and forearm, no uniform sleeve, no body, no face) has just
lifted it a few centimetres and gone still.
Just entering frame from the side, the FATHER's hand reaches for the drawer edge to close it —
his face may be out of frame or seen only in soft profile at the frame's margin, expression
mild and undemonstrative. He is not scolding and not explaining.
Mood: unspoken_debt / warm — a long preparation discovered by accident, and immediately closed
again. Weight, not sentiment.
Palette: muted warm evening interior, low contrast, dust motes in a single lamp's throw.
[MUST NOT] no readable text, no numbers, no dates, no names, no open passbook page, no cash,
no banknotes, no card, no protagonist body or uniform, no dramatic expression.
```

---

### ③ `common/climax_parent_info.png` — 포스트잇 한 장이 따로 붙은 자료 더미

**강점/화자**: info · 엄마 · `climaxYearMin: 4`
**슬롯**: discovery / resolve / 5 — *"내 한마디를 포스트잇으로 붙여둔 자료 더미."*
**원문**: 엄마가 자료 더미를 내려놨다. 맨 위에, 내가 흘리듯 한마디 했던 분야가 포스트잇으로 따로 붙어 있었다. "강제 아니야. 그냥, 네가 저번에 그랬잖아."

> 포스트잇은 **글자 없이 "따로 표시된 한 장"**으로 읽혀야 한다. 색과 위치와 각도로만 구별한다 —
> 더미 전체가 같은 무채색 종이인데 **단 한 장만 채색 탭이 튀어나와 있는** 구도.

```
A Korean home dining table or desk, early evening. A THICK STACK of printed booklets and loose
papers just set down — all surfaces BLANK, no letters, no charts with labels, no headings.
On the very top sheet, a SINGLE small coloured sticky note juts out at a slight angle — the only
saturated colour in the frame, placed deliberately, marking one thing among many. The note
itself carries NO writing: colour and position do the speaking.
The MOTHER stands just behind, one hand still resting on the stack as if she hasn't decided
whether to push it closer. Her expression is careful, a little self-conscious — she is offering,
not pressing. Reference: mother_middle_neutral.
Mood: discovery / resolve — being remembered, and offered a door rather than a push.
Palette: cool paper greys and warm kitchen light; the sticky note the single accent.
Framing: three-quarter view across the table; the stack occupies the lower half, mother's upper
body behind it. Protagonist NOT in frame.
[MUST NOT] no readable text on any paper or note, no charts with legible labels, no university
names, no logos, no protagonist, no uniform, no pointing finger, no stern expression.
```

---

### ④ `common/climax_parent_strict.png` — 돌아서는 등

**강점/화자**: strict · 아빠 · `climaxYearMin: 4` · **유일하게 스탯 있음(멘탈 +2)**
**슬롯**: growth / warm / 5 — *"\"고생했네\" 한마디 남기고 돌아서던 아빠."*
**원문**: 성적표를 한참 보던 아빠가, "잘했다" 대신 "…고생했네" 한마디만 남기고 먼저 돌아섰다. 그 등을 보는데, 왜인지 성적보다 그 말이 오래 남았다.

> 성적표는 **아빠 손에 들려 아래로 내려간 상태**로만 등장한다(표면이 시선에서 벗어난 각도).
> 이 컷의 주인공은 종이가 아니라 **등**이다.

```
A Korean living room, evening. The FATHER seen from BEHIND, mid-turn — already a half-step away,
shoulders squared, head slightly lowered. One hand holds a folded sheet of paper down at his
side, ANGLED AWAY from view so its surface is not visible at all.
He has just said something short and is not waiting for a reply. The room is ordinary and quiet;
a lamp behind him puts a soft rim on his shoulder and leaves his face unseen.
Reference: father_middle_neutral (same build, same short black hair with slight grey at the
temples, same muted blue-grey collared knit).
Mood: growth / warm — "you worked hard" instead of "well done". Restraint that lands harder than
praise. The emotional weight sits entirely in the back and the half-turn.
Palette: warm low lamp light, deep quiet shadows, no drama.
Framing: first-person view from a seated position; father's back fills the middle of the frame,
his face NOT visible. Protagonist NOT in frame.
[MUST NOT] no visible paper surface, no readable text, no grades, no numbers, no letters,
no father's face, no smile to camera, no protagonist, no uniform, no tears, no embrace.
```

---

### ⑤ `common/climax_parent_resilience.png` — 문 앞에 식은 밥상

**강점/화자**: resilience · 엄마 · `climaxYearMin: 3`
**슬롯**: growth / warm / 5 — *"문 앞에 식은 밥상을 두고 가던, 그 거리."*
**원문**: 크게 주저앉은 날, 엄마는 손을 내밀지 않았다. 문 앞에 식은 밥상만 두고 갔다. "안 들어갈게. 배고프면 나와." 문이 닫히고도, 발소리는 한참 복도에 남아 있었다.

> 이 컷의 핵심은 **거리**다. 밥상은 방 안이 아니라 **문 밖 복도 바닥**에 있고, 문은 닫혀 있다.
> "도와주지 않음"이 방치가 아니라 신뢰로 읽히려면, 밥상이 정성스레 차려져 있어야 한다 — 식었을 뿐이다.

```
A dim apartment hallway outside a closed bedroom door, night. On the floor, right against the
door, a small tray meal set down with care: a bowl of rice, two or three side dishes in proper
little dishes, chopsticks laid straight. It has gone COLD — no steam at all, a faint sheen
setting on the surface of the soup.
The door is CLOSED. No one is in the hallway; the mother has already stepped away. Farther down
the corridor, a warm light spills from another room, suggesting she is still nearby and not
coming in.
Mood: growth / warm — help withheld on purpose. Waiting instead of lifting. The distance between
the tray and the door is the whole scene.
Palette: cool hallway dark with a distant warm doorway glow; the food's colours muted by the low
light and by having gone cold.
Framing: low angle from floor level looking along the hallway toward the closed door, tray in the
near-middle field. No person in frame.
[MUST NOT] no person in frame, no open door, no steam, no protagonist, no uniform, no note or
written message on the tray, no readable text anywhere, no mess or spilled food.
```

---

### ⑥ `common/climax_parent_freedom.png` — 삼킨 한마디

**강점/화자**: freedom · 엄마 · `climaxYearMin: 4`
**슬롯**: discovery / resolve / 5 — *"말리고 싶은 걸 삼키던, 그 한마디."*
**원문**: 온 가족이 말리는 선택 앞에서, 엄마만 아무 말이 없었다. 입을 열었다 다시 다물고는— "…그래. 네가 정했으면." 말리고 싶은 걸 삼킨 한순간이었다.

> 6컷 중 유일하게 **얼굴이 주인공인 컷**이다. 잡아야 하는 건 표정이 아니라 **직전에 멈춘 동작** —
> 입을 열었다 다시 다문 그 1초. 슬픔도 미소도 아니고, 삼킨 말이 목에 남아 있는 상태.

```
Close portrait of the MOTHER in a Korean home interior, evening. She has just closed her mouth
again after starting to speak — lips barely parted then pressed together, jaw slightly set, one
breath held. Her eyes are steady on someone off-frame, neither disapproving nor relieved; there
is something she has decided not to say.
One hand has half-risen and stopped, as if it were going to gesture and thought better of it.
Reference: mother_middle_neutral (same face, same soft shoulder-length dark brown hair, same
warm-toned knit cardigan) — the expression is the ONLY difference from the reference.
Behind her, softly out of focus, the ordinary warmth of a family living room, and the suggestion
of other people having just fallen silent — no other faces legible.
Mood: discovery / resolve — a permission given by swallowing an objection. Love as restraint.
Palette: warm interior, gentle even light on the face, no hard shadow, no theatrical rim.
Framing: chest-up, slight angle, shallow depth of field. Protagonist NOT in frame.
[MUST NOT] no tears, no crying, no wide smile, no frown or anger, no open mouth mid-speech,
no other identifiable faces, no protagonist, no uniform, no readable text, no hands on shoulders.
```

---

## ✅ 촬영 후 체크리스트

납품 6장에 대해 **파일별로 픽셀 직접 확인**한다(sub-agent 단독 판정 금지 — 오탐 실적 있음).

- [ ] **글자 0개** — 통장(②)·포스트잇(③)·성적표(④)에 문자·숫자·유사 글리프가 없다. 사각 블러 슬랩도 없다.
- [ ] **주인공 부재** — 교복·뒷머리·얼굴·전신이 어느 컷에도 없다. 손/팔뚝만 있는 건 ②만 해당.
- [ ] **부모 정합** — ①은 무인, ②④는 아빠, ③⑤⑥은 엄마(⑤는 무인). 등장분이 `mother/father_middle_neutral`과 같은 얼굴·머리·옷차림이다.
- [ ] **화자 SSOT 위반 없음** — 엄마 = emotional/info/resilience/freedom, 아빠 = wealth/strict.
- [ ] **④에 성적표 표면이 안 보인다**, **⑤에 김(steam)이 없다**(식은 밥상), **①에 사람이 없다**.
- [ ] **과장 금지 준수** — 눈물·포옹·극적 역광 없음.
- [ ] `node scripts/generate-cg-manifest.mjs` 재실행 후 `grep -c climax game/src/cg-manifest.generated.ts` → **6**.
- [ ] 인게임 확인은 **`debugSkipToEnding`으로 하지 말 것**(그 훅은 `memorySlots`를 채우지 않아 회상 그림이 0장이다).
      헤드리스 완주 state를 `localStorage['lifetrack_save']`에 주입하고 `이어하기`로 진입한다.
