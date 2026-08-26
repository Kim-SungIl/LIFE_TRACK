# Event CG Prompts — 부모 강점별 "절정 순간" (Phase 4B, 6컷)

> **왜 이 6컷인가.** `PARENT_CLIMAX_EVENTS`(`src/engine/talkData/miniEvents.ts`)는 **강점당 평생 1회**
> 발동하고 한 판에 최대 2회 나온다. 회상 슬롯 importance는 **5**인데 **CG가 0장이다** —
> `grep -c climax src/cg-manifest.generated.ts` → `0`.
> 엔딩 회상이 그림을 지게 된 뒤(PR #414), CG 없는 회상은 카테고리 엠블럼으로 떨어진다.
> 실측 90런에서 마지막-선택지 플레이의 엠블럼 비율이 27.9%이고, **그 자리 120건 중 절정이 50건(41.7%)**이다.
>
> **다만 "컷당 회수 최대"는 아니다(3자검수에서 반박됨).** 정직하게 적어 둔다:
> - 발동 순간에는 **이 그림이 아예 안 보인다.** `MiniTalkModal.tsx`에 이미지 렌더가 없다 —
>   노출면은 엔딩 회상 · 학년말 회고 · 기록실/앨범뿐이다(기존 `common/talk_*.png` 8장과 같은 구조).
> - 90런에서 엔딩 회상에 실제로 뜬 것은 info 20 · freedom 20 · emotional 9 · wealth 1 · **strict 0 · resilience 0**.
>   뒤 둘은 `growth` 카테고리라 카테고리 cap 경합(`memorySystem.ts`)에서 밀린다. 런당 슬롯 생존도 2회 발동 대비 0.89개.
> - **회수 기준 1등은 `adolescence-clash`다** — `condition: (s) => s.year === 3`으로 **매 판 무조건** 발동하고
>   슬롯 선택지가 2개(c0 betrayal/5, c2 growth/5)인데 CG 0장이다. 같은 90런에서 엠블럼 자리 **60건 = 50%**를
>   이 한 이벤트가 차지한다. 신규 2컷(성별 분기 시 4컷)으로 60건 — 컷당 회수가 절정 6장의 1.5~4배다.
>   **다음 배치에 반드시 끼울 것.** `career-conflict-{info,strict}-{y5,y6}`도 importance 5 · CG 0장이다.
> - 그리고 **아트 없이 해소되는 배치 오류**가 따로 있다: `jihun-promise`(importance 8, Y2 발동인데 자산은 `high/`),
>   `minjae-honest`(high 발동인데 자산은 `middle/`), `yuna-study`(Y1 발동인데 자산은 `middle`+`high`).
>   파일 위치만 옮기면 되지만 **학교급이 다른 그림을 재사용하는 톤 위험이 있어 "무료"는 아니다**
>   (생일 2종은 초등 그림을 고등에 쓰는 격이라 특히 그렇다).
>
> 즉 이 6컷은 **"CG가 아예 없는 매 판 등장 슬롯"이라 언젠가는 그려야 하는 것**이고, 최우선 후보군에 속한다 —
> 하지만 배치 1순위라는 주장은 실측이 지지하지 않는다.

**스펙 SSOT**: `docs/parent-4b-climax-spec-2026-06-11.md` (장면 원문·트리거·화자 귀속)
**외형 SSOT**: `docs/character-prompt-spec.md` §mother / §father (L713~760)
**포맷 상속 — 상속 범위를 좁혀서 명시한다.** `docs/cg-prompts-high-y5-y7.md` §공통 스타일 가이드에서
**`Art style` / `Composition` / `Resolution` 세 줄만** 가져온다.

> 🚫 **`Age` / `Era` / `Uniform` 줄은 상속하지 않는다.** 그 블록 원문은
> `Age: 17~19-year-old Korean high school students` · `Uniform: HIGH SCHOOL uniform — navy tie (male
> protagonist), plaid skirt + red ribbon (female)`이다. **이 6컷에는 학생이 없다** — 그대로 붙이면
> "주인공을 프레임에서 뺀다"는 이 발주의 설계와 정반대 지시가 같은 프롬프트에 동봉되고,
> 성별 무분기 근거가 그 자리에서 무너진다. Era는 아래 §공통 스타일에서 집 배경용으로 다시 정의한다.

---

## 📁 파일 경로 — `common/` 6장, 성별 분기 없음

| 근거 | 내용 |
|---|---|
| 학교급 | **발동 학년이 state에 저장되지 않는다.** `parentClimaxFired?: ParentStrength[]`(`types.ts`)에는 강점만 남는다. 그래서 `archive.ts`가 절정 CG를 **로드 시점의 `state.year`**로 해석하고(그 파일 주석이 이미 경고해 뒀다: *"high/talk_*.png 하나만 추가되면 두 경로가 다른 파일을 넣는다"*), 엔딩은 `slot.year`로 해석한다 — **두 경로가 서로 다른 파일을 가리킬 수 있다.** `common/`만이 그것을 무해하게 만든다. 비교 가능한 유일한 자산군(미니톡 CG 8장)도 전부 `common/`인 이유가 같다 |
| choiceIndex | 선택지 없는 단일 컷. `applyMemorySlotFromMiniTalk`가 `choiceIndex = 0` 고정으로 기록한다(`memorySystem.ts`) |
| 성별 | **6컷 전부 주인공의 몸이 프레임에 없다**(POV 또는 소품·부모 단독). 유일한 예외가 ②의 손인데 손목에서 자른다 — 교복·체형 단서가 아예 없으므로 `_m`/`_f` 분기가 불필요 |

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

**[전 컷 공통 금지]**

> ⚠️ **상속 목록을 뭉뚱그려 인용하지 말 것.** `cg-prompts-high-y5-y7.md`와 `cg-prompts-high-reach-y5-y7.md`에
> 각각 다른 `①~④`가 있고(전자의 ④ = 캐릭터 마커, 후자의 ④ = 연도·날짜·D-day 금지), 그중
> **`cg-prompts-high-y5-y7.md`의 ①은 "간판·게시판·현수막은 흐리게 처리"라고 지시한다** — 아래 1번이
> 금지하는 바로 그 문장이다. 그래서 이 문서는 상속 대상을 다음으로 **한정**한다:
> - **상속함**: `cg-prompts-high-y5-y7.md`의 ② (명세에 없는 가구·소품 추가 금지) · ③ (캔·컵)
> - **상속함**: `cg-prompts-high-reach-y5-y7.md`의 ④ — **연도·날짜 표기 전면 금지.** ②(통장 **개설일**)에 필수다.
> - **override**: 전자의 ① — "흐리게 처리"를 **쓰지 않고** 아래 1번으로 대체한다.
> - **비상속**: 전자의 ④ (캐릭터 마커) — 이 6컷엔 학생 NPC가 없다. 부모 마커는 레퍼런스 첨부로 갈음.

그 위에 이 6컷 고유의 금지 넷:

1. **읽히는 글자 전면 금지.** 이 6컷은 종이 소품(통장·포스트잇·성적표·자료)이 서사의 중심이라 특히 위험하다.
   **"흐리게 처리"·"블러"로 지시하지 말 것** — 사각 가우시안 슬랩을 덧대 그림을 훼손한 전례가 있다(2026-07, 12장 리터치).
   올바른 지시는 **"원래부터 글자가 없는 표면"**: 종이는 접히거나 뒤집히거나 손·각도에 가려 **문자가 프레임에 들어오지 않는** 구도로 그린다.
   숫자·금액·날짜·이름·학교명 전부 해당. 유사 글리프(글자 같아 보이는 낙서)도 금지 — 차라리 여백으로 둔다.
2. **주인공 금지.** 교복 상체·뒷머리·얼굴·전신 실루엣 모두 프레임 밖. **손목 아래의 손만** 허용(②만 해당).
   POV 컷은 **전경에 관찰자의 무릎·허벅지·발이 들어오는 것도 금지** — 생성기가 1인칭 착석 시점에서
   습관적으로 넣는 구도이고, 교복 바지/치마가 그려지면 성별 무분기가 그 자리에서 깨진다.
   그림 안에 사람 몸이 있으면 그 컷은 자동으로 성별을 주장한다.
3. **부모는 성인이고 학년과 무관하다** — `mother_middle_*` / `father_middle_*` 초상을 그대로 레퍼런스로 첨부.
   중등/고등 발동 어느 쪽이든 같은 얼굴·같은 옷차림이어야 한다(연령 변화 표현 금지).
4. **감정 과장 금지.** 이 6종은 전부 "말을 아낀 순간"이다. 눈물·포옹·극적 표정·드라마틱한 역광 금지.
   전달 수단은 **소품의 배치와 문의 틈과 등의 각도**다.
5. **서사 정보는 이미지가 지지 않는다.** ②의 "내 이름"·"개설일이 입학식 날"처럼 **글자로만 전달되는 정보는
   회상 텍스트(`recallText`)가 담당**하고, 이미지는 그 순간의 정서(발견·숨김·거리·삼킴)만 담당한다.
   그림에서 그 정보가 읽히게 만들려는 시도가 곧 텍스트 사고다. 프롬프트에 **렌더 불가한 서사 해설을
   섞지 말 것** — 심볼·문자로 변형되거나, 금지한 요소를 되불러온다.

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
ring of condensation forming on the wood. Beside it, the edge of a CLOSED notebook and a pen
lying apart from it — no open page anywhere, no writing surface visible at all.
Behind and to the side, the room door stands open about five centimetres. Through that narrow
gap: warm hallway light, and nothing else — the mother has already gone, she is NOT in frame.
The narrow gap and the untouched mug are the only storytelling elements.
Mood: reconciliation / warm — care delivered without a single word. Quiet, still, generous.
Palette: warm lamp amber on the desk against the cooler dark of the room; the hallway light a
thin warm blade through the door gap.
Framing: eye-level view across the desk corner, door gap in the middle distance, shallow depth
of field.
[MUST NOT] no person in frame at all, no hand, no arm, no protagonist, no uniform,
no legs, knees, lap, thighs or feet in the foreground, no open notebook, no lettering,
no numbers, no clock face, no phone screen, no calendar.
```

---

### ② `common/climax_parent_wealth.png` — 서랍, 내 이름의 통장

**강점/화자**: wealth · 아빠 · `climaxYearMin: 5`
**슬롯**: unspoken_debt / warm / 5 — *"개설일이 입학식 날이던, 내 이름의 통장."*
**원문**: 아빠 서랍을 열다 내 이름이 적힌 무언가를 봤다. 금액이 아니라, 개설일이 입학식 날인 게 먼저 눈에 들어왔다. 아빠는 그걸 보더니 "밥은 먹었냐" 하고는 서랍을 닫았다.

> ⚠️ 이 컷이 텍스트 사고 위험 1순위다. 통장은 **닫힌 채**로만 그린다 — 이름도 개설일도 금액도 프레임에 없다.
> **"bank passbook"이라고 부르지 않는다**: 그 단어가 표지 글자·로고의 시각문법을 함께 불러온다.
> 대신 "표면이 완전히 매끈하고 아무 표시 없는 닫힌 소책자"로 **긍정형 무특징 묘사**를 준다.
> 서사(오래 준비된 것)는 글자가 아니라 **낡음**으로 전달한다: 불균일하게 바랜 색, 닳은 모서리, 눌린 자국,
> 그리고 오래 끼워져 있던 **글자 없는 종이 슬립** 한 장.
>
> **원문의 "내 이름"·"개설일이 입학식 날"은 이미지가 지지 않는다** — 회상 텍스트가 그 정보를 담당하고,
> 이 그림은 "발견했다가 곧 닫혔다"는 정서만 담당한다. 그림에서 그게 읽히게 만들려는 시도가 곧 텍스트 사고다.

```
Evening. A half-open wooden drawer in a Korean home study/bedroom. Inside, among neatly kept
household odds and ends, a small CLOSED booklet with a smooth, completely featureless cover —
a plain flat surface with no design, no emblem, no marking of any kind. Its colour has faded
unevenly, the corners are worn soft, the edges pressed from years of being tucked away.
It stays SHUT. A thin coloured paper slip is tucked between its closed pages, one blank corner
protruding — it has been there a long time.
A single HAND, cropped at the wrist, has just lifted the booklet a few centimetres and gone still.
Just entering frame from the side, the FATHER's hand reaches for the drawer edge to close it —
his face may be out of frame or seen only in soft profile at the frame's margin, expression
mild and undemonstrative. He is not scolding and not explaining.
Mood: unspoken_debt / warm — a long preparation discovered by accident, and immediately closed
again.
Palette: muted warm evening interior, low contrast, dust motes in a single lamp's throw.
[MUST NOT] no lettering, no numbers, no dates, no names, no printed cover design, no emblem,
no open page, no cash, no banknotes, no card, no sleeve, no forearm, no watch, no ring,
no nail polish, no skin above the wrist, no protagonist body or uniform, no legs or lap in the
foreground, no dramatic expression.
```

---

### ③ `common/climax_parent_info.png` — 포스트잇 한 장이 따로 붙은 자료 더미

**강점/화자**: info · 엄마 · `climaxYearMin: 4`
**슬롯**: discovery / resolve / 5 — *"내 한마디를 포스트잇으로 붙여둔 자료 더미."*
**원문**: 엄마가 자료 더미를 내려놨다. 맨 위에, 내가 흘리듯 한마디 했던 분야가 포스트잇으로 따로 붙어 있었다. "강제 아니야. 그냥, 네가 저번에 그랬잖아."

> 포스트잇은 **글자 없이 "따로 표시된 한 장"**으로 읽혀야 한다. 색과 위치와 각도로만 구별한다 —
> 더미 전체가 같은 무채색 종이인데 **단 한 장만 채색 탭이 튀어나와 있는** 구도.

```
A Korean home dining table or desk, early evening. A THICK STACK of blank stapled paper packets
and loose blank sheets just set down — every surface is unmarked paper, uniformly empty.
On the very top sheet, a SINGLE small coloured sticky note juts out at a slight angle — the only
saturated colour in the frame, placed deliberately, marking one thing among many. The note is a
plain blank tab: colour and position do the speaking.
The MOTHER stands just behind, one hand still resting on the stack as if she hasn't decided
whether to push it closer. Her expression is careful, a little self-conscious — she is offering,
not pressing. Reference: mother_middle_neutral.
Mood: discovery / resolve — being remembered, and offered a door rather than a push.
Palette: cool paper greys and warm kitchen light; the sticky note the single accent.
Framing: three-quarter view across the table; the stack occupies the lower half, mother's upper
body behind it. Protagonist NOT in frame.
[MUST NOT] no lettering, no numbers, no names, no logos, no charts of any kind, no diagrams,
no tables, no printed matter, no handwriting, no protagonist, no uniform, no legs or lap in the
foreground, no other people, no pointing finger, no stern expression.
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
Mood: growth / warm — the emotional weight sits entirely in the back and the half-turn.
Palette: warm low lamp light, deep quiet shadows, no drama.
Framing: eye-level from a low seated height; father's back fills the middle of the frame, his
face NOT visible. **The foreground is empty floor and room — nothing of the viewer's body.**
[MUST NOT] no visible paper surface, no lettering, no numbers, no grades, no father's face,
no smile to camera, no protagonist, no uniform, **no legs, knees, lap, thighs or feet in the
foreground**, no hands, no other people, no tears, no embrace.
```

---

### ⑤ `common/climax_parent_resilience.png` — 문 앞에 식은 밥상

**강점/화자**: resilience · 엄마 · `climaxYearMin: 3`
**슬롯**: growth / warm / 5 — *"문 앞에 식은 밥상을 두고 가던, 그 거리."*
**원문**: 크게 주저앉은 날, 엄마는 손을 내밀지 않았다. 문 앞에 식은 밥상만 두고 갔다. "안 들어갈게. 배고프면 나와." 문이 닫히고도, 발소리는 한참 복도에 남아 있었다.

> 이 컷의 핵심은 **거리**다. 밥상은 방 안이 아니라 **문 밖 복도 바닥**에 있고, 문은 닫혀 있다.
> "도와주지 않음"이 방치가 아니라 신뢰로 읽히려면, 밥상이 정성스레 차려져 있어야 한다 — 식었을 뿐이다.

```
A dim apartment hallway outside a closed bedroom door, night. On the floor, set down a hand's
width AWAY from the door so it does not block it from opening, a small tray meal placed with
care: a bowl of rice, two or three side dishes in proper little dishes, chopsticks laid straight.
It has gone COLD — no steam at all, a faint sheen setting on the surface of the soup.
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

> 6컷 중 유일하게 **사람 얼굴이 나오는 컷**이고, 그래서 재생성 확률이 가장 높다.
> **부담을 얼굴에서 손으로 옮겼다** — "입을 열었다 다시 다문 그 1초"는 한 장에 담을 수 없는 시간 서술이라
> 생성기가 벌린 입을 그릴 유인이 된다. 그래서 입은 **닫힌 상태로 확정**하고, 삼킨 말은 **공중에서 멈춘 손**이
> 진다. 원문의 "온 가족이 말리는"은 **빈 거실과 밀린 의자**로 옮겼다 — 배경 인물을 넣으면 그 실루엣이
> 교복 청소년으로 렌더될 수 있고, 그게 곧 주인공이 되어 성별 무분기가 깨진다.

```
Portrait of the MOTHER in a Korean home interior, evening. Her LIPS ARE CLOSED in a thin line,
jaw just set — she has finished not saying something. Her eyes are steady on someone off-frame,
neither disapproving nor relieved.
The real subject is her HAND: it has half-risen toward the person off-frame and STOPPED in
mid-air, fingers slightly open, as if it were going to gesture and thought better of it. Keep
that stopped hand fully inside the frame — it carries the swallowed sentence.
Reference: mother_middle_neutral (same face, same soft shoulder-length dark brown hair, same
warm-toned knit cardigan) — the expression is the ONLY difference from the reference.
Behind her, softly out of focus, an EMPTY family living room: on the table, two half-finished
cups and a chair pushed back. The room has just gone quiet and nobody is in it.
Mood: discovery / resolve — a permission given by swallowing an objection.
Palette: warm interior, gentle even light on the face, no hard shadow, no theatrical rim.
Framing: upper body wide enough to include the stopped hand, slight angle, shallow depth of field.
[MUST NOT] no other people anywhere, no human shapes or silhouettes behind her, no blurred
figures, no protagonist, no uniform, no children, no tears, no crying, no wide smile, no frown
or anger, no open mouth, no lettering, no hands on shoulders.
```

---

## ✅ 촬영 후 체크리스트

납품 6장에 대해 **파일별로 픽셀 직접 확인**한다(sub-agent 단독 판정 금지 — 오탐 실적 있음).

- [ ] **글자 0개** — 통장(②)·포스트잇(③)·성적표(④)에 문자·숫자·유사 글리프가 없다. 사각 블러 슬랩도 없다.
- [ ] **주인공 부재** — 교복·뒷머리·얼굴·전신이 어느 컷에도 없다. **전경에 무릎·허벅지·발도 없다.**
      손이 보이는 건 ②뿐이고, 손목에서 잘려 소매·시계·반지가 없다.
- [ ] **부모 정합** — **①⑤ 무인 / ②④ 아빠 / ③⑥ 엄마.** 등장분이 `mother/father_middle_neutral`과 같은 얼굴·머리·옷차림이다.
      (⑤는 "엄마가 이미 물러난" 장면이라 **사람이 없는 것이 정답**이다 — 엄마를 찾지 말 것.)
- [ ] **⑥에 배경 인물이 없다** — 실루엣·흐린 형체도 포함. 빈 거실 + 밀린 의자 + 반쯤 남은 컵 두 개여야 한다.
- [ ] **화자 SSOT 위반 없음** — 엄마 = emotional/info/resilience/freedom, 아빠 = wealth/strict.
- [ ] **④에 성적표 표면이 안 보인다**, **⑤에 김(steam)이 없다**(식은 밥상), **①에 사람이 없다**.
- [ ] **과장 금지 준수** — 눈물·포옹·극적 역광 없음.
- [ ] `node scripts/generate-cg-manifest.mjs` 재실행 후 `grep -c climax game/src/cg-manifest.generated.ts` → **6**.
- [ ] 인게임 확인은 **`debugSkipToEnding`으로 하지 말 것**(그 훅은 `memorySlots`를 채우지 않아 회상 그림이 0장이다).
      헤드리스 완주 state를 `localStorage['lifetrack_save']`에 주입하고 `이어하기`로 진입한다.
