# Event CG Prompts — `jihun-promise` 중학판 (4컷)

> **엔딩 회상에서 그림이 비는 자리의 81%가 이 이벤트 하나다.** 그런데 CG는 이미 4장 있다 —
> `high/`에만 있어서, 실제 발동 학년(Y2 = 중1)에서 경로가 안 잡힐 뿐이다.
> 이 발주는 **같은 장면의 중학판 4장**을 채워 그 구멍을 닫는다.

**계측 재현**: `npx tsx scripts/sim/sim-qa-playthrough.ts <dir>` (29 페르소나 × 12시드 = 348런)
**장면 SSOT**: `src/engine/events/npc/jihun.ts` L160~ (`description`·`message` 원문)
**외형 SSOT**: `docs/character-prompt-spec.md` §player_m / §player_f / §jihun
**레퍼런스 SSOT**: 기존 `high/jihun-promise_c{0,1}_{m,f}.png` 4장 — **구도·카메라·색만 계승한다**
(c1은 감정 연출까지 계승하지 않는다. → 「컷 ③④는 판본이 아니라 리테이크다」 절)

**포맷**: `docs/cg-prompts-high-y5-y7.md` §공통 스타일에서 `Resolution` 한 줄을 상속.
`Art style` / `Composition` / `Age` / `Uniform` / `Safe area`는 **이 문서가 다시 정의한다**
(학교급이 다르고, 이 컷들은 주인공 얼굴이 프레임에 없다).

> **이 판(2판)은 3자 검수(codex·cursor·sub-agent) 지적 15건을 반영한 것이다.**
> 1판의 오류: 매니페스트 기대값(442), 노출면 표 2행, 축소 검수 폭(368), 크레스트 파일명,
> 발동 기전, 줄번호 2건. 아래 본문은 전부 재확인한 값이다.

---

## 🔍 왜 이 4컷인가 — 전부 실행으로 확인한 것

**① 회상 결손의 81%를 혼자 차지한다.** 348런에서 CG 없는 엔딩 회상 칸 252칸의 구성:

```
jihun-promise              204칸 (81.0%)   ← 이 발주가 닫는 구멍
adolescence-clash           24칸 ( 9.5%)   (#423에서 2컷 납품 완료)
career-conflict-info-y5     12칸 ( 4.8%)
career-conflict-info-y6     12칸 ( 4.8%)
```

**② 그리고 이 슬롯은 그림이 실제로 뜨는 자리다.** 두 선택지 모두 슬롯 카테고리가
`reconciliation` / 톤 `warm` / **importance 8**이다(`jihun.ts` **L183·L190**).

- `reconciliation`·`warm`은 **후회 풀이 아니다**(`REGRET_CATEGORIES` = failure/betrayal/bypass/unspoken_debt,
  `REGRET_TONES` = regret/melancholy/burden, `memorySystem.ts:248-251`). 후회 층은 그림을 안 그리므로,
  후회 풀로 가는 슬롯에 CG를 넣으면 엔딩에서 안 보인다 — **이건 그 함정에 걸리지 않는다.**
- importance **8**은 슬롯 상한 경쟁(카테고리당 2개, 교체는 importance **초과**일 때만)에서 거의 항상 이긴다.
  `reconciliation` 카테고리의 최대 importance가 8이라 **동률로는 축출되지 않는다.**

즉 `adolescence-clash` 배치가 "결과 화면 노출"로 정당화해야 했던 것과 달리,
**이 4컷은 엔딩 회상 갤러리에 그대로 뜬다.** 컷당 회수가 지금 남은 후보 중 가장 크다.

**③ 노출면은 네 곳, 크기는 여섯 가지다.** (1판에서 두 행이 틀렸다 — 전부 다시 확인했다)

| 노출면 | 크기·조건 |
|---|---|
| 결과 화면 | `EventResultScreen.tsx:113-141` — **전체화면이 아니라** `padding:'20px 24px 24px'` 안의 `borderRadius:12` 카드. `#root`가 `max-width:600`이라 iPhone SE 약 **327×184**, 데스크톱 약 550×309 |
| 학년말 회고 | **`HeroGallery`** (썸네일이 아니다 — `YearEndScreen.tsx:174`). 컨테이너 `maxWidth:480` − padding 32 = **448×200**, 여러 장이면 88%로 좁아져 **394×200** |
| 엔딩 회상 갤러리 | 같은 `HeroGallery`. 컨테이너 `maxWidth:420` → **420×200**, 여러 장이면 **370×200**. 전부 `object-fit:cover` + `object-position:center 30%` |
| 인물 앨범 — 칸 | `NpcAlbumScreen.tsx` `CELL = 44` → **44×44 `object-fit:cover`**. 16:9를 **정중앙 정사각으로** 잘라낸다 |
| 인물 앨범 — 확대뷰 | `maxHeight:'76vh'` + **`object-fit:contain`** — **이 발주에서 가장 큰 표시면이고, 유일하게 안 잘리는 면이다** |

> **기록실은 노출면이 아니다.** `ArchiveScreen.tsx`는 이벤트 CG를 렌더하지 않는다(34×42 인물 초상만).
> `archive.ts:261`은 **적립** 경로다. `EventScene.tsx`도 프리페치만 하고 그리지 않는다.
> 실제로 그리는 컴포넌트는 위 네 곳뿐이다.

**두 가지 파생 조건:**

- **`HeroGallery`는 톤 필터를 씌운다.** `warm` 슬롯은 `saturate(0.88) sepia(0.24) brightness(1.02)`
  (`memoryTokens.ts:52`, `memoryVisuals.tsx:70`). 이 장면은 이미 주황 노을이라 **sepia가 얹히면 탁해질 수 있다.**
- **엔딩 갤러리의 첫 장(anchor)이 될 공산이 크다.** anchor는 importance 최대 → 동률이면 이른 학년이다
  (`EndingScreen.tsx:64-72`). imp 8 슬롯 중 Y2는 이것뿐이라, 회상 갤러리의 **첫 화면**이 되는 판이 많다.

**④ 발동 학년 — 왜 항상 Y2인가.** `condition`은
`jihun.met && jihun.intimacy >= 70 && year >= 2 && week >= 40 && !isVacation`이고 **학년 고정 게이트가 없다.**
실측은 전부 **Y2**였다(회상 칸 204개의 슬롯 `year` 분포가 `{2: 204}`).

기전은 친밀도 감쇠가 아니라 **1회성 소진**이다 — `jihun-promise`는 `FOLLOWUP_EVENT_IDS`에 있어
조건이 참이면 **확정 발동**하고(`events/constants.ts:13`), `ANNUAL_REFIRE_IDS`에는 없어 재발동하지 않는다.
따라서 **최초 적격 창(Y2 W40)에서 소진된다.**

> 1판은 근거를 `jihun.ts`의 코드 주석("Y7엔 60까지 내려가 `>=70`이 성립하지 않는다", 20런 기준)에서
> 가져왔는데, 348런 재집계에서는 Y5~Y7에도 peak≥70인 런이 Y2와 같은 수만큼 있었다.
> **친밀도는 후반에도 성립한다 — 이벤트가 이미 소진돼 있을 뿐이다.**

**⑤ 결손을 리졸버로 직접 확인했다.** `resolveEventCgRelPaths('jihun-promise', ci, gender, year)` 실행:

```
Y2(middle) ci=0 male   -> []          Y5(high) ci=0 male   -> ["high/jihun-promise_c0_m.png"]
Y2(middle) ci=1 male   -> []          Y5(high) ci=1 male   -> ["high/jihun-promise_c1_m.png"]
Y2(middle) ci=0 female -> []          Y5(high) ci=0 female -> ["high/jihun-promise_c0_f.png"]
Y2(middle) ci=1 female -> []          Y5(high) ci=1 female -> ["high/jihun-promise_c1_f.png"]
Y4(middle) 4종 전부    -> []          Y7(high) 4종 전부    -> 정상 해석
```

**실제 발동 학년(Y2)에서 후보가 0개**다. 폴백 cascade의 `common/` 단계까지 내려가도 없다.

> 그래서 `middle/`이 이 이벤트의 **주 경로**다. 기존 `high/` 4장은 지우지 않는다 —
> 리졸버가 학년으로 갈리므로 Y5·Y7 경로에서 정상 해석되고, 앨범도 학교급별로 칸을 따로 만든다.
> 다만 **348런에서 high 경로 도달은 0회**였다(1회성 소진 때문). "친밀도를 후반까지 끌고 간 판을 위한
> 보조"라는 1판의 설명은 틀렸다. 늦게 t70을 넘는 판이 없다는 증명은 아니므로 자산은 남기되,
> **지훈 앨범의 high 칸 2개는 실측상 거의 안 채워진다**는 점은 알고 있어야 한다.
> `getSchoolLevel`: `year<=1` elementary / `<=4` middle / else high → `middle/`이 **Y2~Y4**를 덮는다.

---

## 🚫 기존 `high/` 자산을 그대로 옮기면 안 되는 이유

한때 *"파일만 옮기면 되는 무료 수정"*으로 적혀 있었다. **틀렸다.** 픽셀로 확인한 것:

지훈은 `high/jihun-promise_c0_m.png`·`_c1_m.png`·`_c1_f.png`에서 **네이비 넥타이**를 매고 있고,
**`high/jihun-promise_c1_f.png`** 에는 블레이저 왼쪽 가슴에 **금색 학교 크레스트 엠블럼**(왕관+방패+월계수)까지 있다.
(1판은 이 크레스트를 `_c1_m`이라고 적었다 — **틀렸다. `_c1_m`의 가슴은 민무늬 웰트 포켓이다.**)

그런데 스펙은:

| | 중등 | 고등 |
|---|---|---|
| player_m | `navy blazer fully buttoned, white shirt (**NO tie at middle stage**), dark pants, black loafers` (L201) | `navy tie` + `small gold-embroidered school crest emblem on left chest pocket` (**L218-219**) |
| jihun | `navy blazer worn casually (slightly open), white shirt, dark pants, **white sneakers**` (L307) — 넥타이 항목 없음 | (별도 블록 없음) |
| player_f | `navy blazer, white shirt with **red ribbon**, plaid skirt, brown loafers, dark knee socks` (L267) | **별도 블록 없음 — 중등과 동일** |

**넥타이와 크레스트는 고등 전용 마커다.** 중학 장면에 그대로 쓰면 톤 위험이 아니라 **명세 위반**이다.

> **여주 컷도 새로 그려야 한다.** player_f는 중·고 교복 규정이 같아서 여주 본인은 안 변하지만,
> **같은 화면의 지훈이 넥타이를 매고 있다.** 그리고 둘 다 중학생 비율로 어려져야 한다.

---

## 🔁 컷 ③④는 "판본"이 아니라 **리테이크**다

**c0(①②)은 학교급 판본이다** — 레퍼런스의 연출을 그대로 계승하고 교복·나이만 바꾼다.
**c1(③④)은 다르다.** 기존 `high/_c1_m`·`_c1_f`의 지훈은 **주인공을 정면으로 응시하며 울고 있다**
(눈물 자국·홍조·이 악문 미소). 그런데 현재 게임 문장은:

> `"야, 갑자기 왜 이래." 지훈이가 픽 웃으며 **괜히 먼 데를 본다.** "...나도, 인마."`

**그림과 텍스트가 어긋나 있다.** 원인은 recallText가 개작된 것이다 — 옛 문장은 "지훈이 눈이 붉어졌다"였고
고등 CG는 그 시절 발주(`docs/cg-prompts-high-y5-y7.md:598-604`)에 묶여 있다.

**결정: 중학판은 현재 텍스트를 따른다.** 따라서 ③④ 프롬프트는

- **계승한다** — 구도, 카메라 거리, 좌우 배치, 색, 조명, 배경
- **계승하지 않는다** — 지훈의 시선(정면 → 지평선), 눈물(있음 → 없음)

이 구분을 프롬프트 안에 **명시적으로 적는다.** 안 적으면 첨부 레퍼런스와 `[MUST NOT]`이 충돌해
생성기가 어느 쪽을 따를지 모른다.

> **부작용을 알고 간다.** 같은 이벤트의 중학 칸과 고등 칸이 앨범에 나란히 놓이는데 감정이 다르다.
> 다른 해의 다른 순간이라 허용 가능하다고 판단했다.
> 기존 `high/_c1_{m,f}` 2장의 텍스트-그림 불일치는 **별도 백로그**로 남긴다(이 발주 범위 밖).

---

## 📁 파일 경로 — `middle/` 4장, 성별 분기 **필수**

```
public/images/events/middle/jihun-promise_c0_m.png
public/images/events/middle/jihun-promise_c0_f.png
public/images/events/middle/jihun-promise_c1_m.png
public/images/events/middle/jihun-promise_c1_f.png
```

| 근거 | 내용 |
|---|---|
| 성별 분기 | **주인공의 몸이 프레임에 있다.** 교복이 남녀 완전히 다르므로(넥타이 없는 바지 vs 리본+체크스커트) `_m`/`_f` 페어가 강제된다. 부모 절정·사춘기 배치의 "주인공을 프레임에서 뺀다" 전략은 여기선 못 쓴다 — 이 장면의 주체가 둘이기 때문이다 |
| choiceIndex 분기 | 두 선택지의 **비트가 다르다**. c0은 약속을 주고받는 순간(둘 다 먼 데를 본다), c1은 지훈이 쑥스러워 얼굴을 돌리는 순간이다 |
| 학교급 | Y2 발동 → `middle/`. `high/` 4장은 그대로 둔다 |

cascade 1순위 `{sl}/{id}_c{ci}_{g}`에서 잡힌다(`src/engine/eventCg.ts`).
파일 추가 후 **`node scripts/generate-cg-manifest.mjs`** 필수 → **444장**(현재 440 + 4),
`grep -c "middle/jihun-promise"` = 4.

**앨범 실측**: 4장을 넣고 `npcAlbum('jihun')`을 돌린 결과 — `middle` 버킷 **3 → 5칸**, 지훈 총 **52 → 54칸**.
(`reach.year`가 없어 `y2` 행이 아니라 `middle` 행에 들어간다.)

> ⚠️ 브랜치를 옮기면 매니페스트(tracked)만 원복되고 PNG(untracked)는 남아 **4장이 조용히 안 뜨는**
> 상태가 된다. 브랜치 이동 후에는 무조건 재생성할 것.

### 더 싸게 가는 선택지 (권장하지 않음)

`middle/jihun-promise_m.png` + `_f.png` **2장**만 그려도 된다 — cascade 2순위 `{sl}/{id}_{g}`가
두 선택지를 모두 덮는다. 컷 수가 절반이고 회상 204칸도 그대로 채워진다.

**손실은 두 가지다:**
1. 결과 화면에서 두 선택지가 같은 그림을 받는다.
2. **인물 앨범 칸이 2칸이 아니라 1칸으로 접힌다.** `npcAlbum`은 `${male}|${female}` 그림 서명으로 칸을
   접으므로(`npcAlbum.ts:85-99`), `_c` 없는 파일이면 두 선택지가 한 칸이 된다 — 지훈 52 → **53**칸.
   앨범에서 **중학판의 두 선택지를 영구히 구분할 수 없다.**

이 이벤트는 importance 8에 회상 노출 1위라 선택의 차이를 그림이 지고 갈 값이 있다고 본다.
예산이 빠듯하면 2장으로 줄이되, 그때는 **c0 구도(와이드 투샷)** 를 채택할 것 — 두 대사 모두에 무리 없이 붙는다.

---

## 🎨 공통 스타일 (4컷 공통 — 프롬프트마다 붙인다)

```
Art style: soft anime illustration, hand-painted look, gentle cel shading with painterly
  texture. Korean web-novel / visual-novel cover quality. No harsh outlines, no 3D render feel.
Composition: 16:9 landscape, cinematic framing.
Age: Korean MIDDLE SCHOOL students, around 13-15 years old.
  Younger, slighter proportions than high schoolers — shorter, narrower shoulders, rounder faces.
Uniform (MIDDLE SCHOOL — this is the point of the whole commission):
  - JIHUN: navy blazer worn casually and slightly open, white shirt, dark pants, white sneakers.
    NO NECKTIE. NO crest, NO emblem, NO badge, NO pin anywhere on the blazer.
  - MALE PROTAGONIST: navy blazer fully buttoned, white shirt, dark pants, black loafers.
    NO NECKTIE. NO crest, NO emblem, NO badge, NO pin anywhere on the blazer.
  - FEMALE PROTAGONIST: navy blazer, white shirt with a RED RIBBON at the collar, plaid skirt,
    brown loafers, dark knee socks.
Setting: the rooftop of a Korean school at sunset. Chain-link fence along the edge, low concrete
  parapet, city skyline below, a rooftop stair-housing block and a ladder to one side.
  Warm orange and pink sky with scattered clouds; the low sun near the horizon.
  Cool late-winter light, but NO snow, NO visible breath, NO coats or scarves —
  the school uniform must be fully readable.
Wind: their hair and clothes are moving — the scene says "바람이 분다".
Resolution: 1440x810. No alpha channel.
Safe area: the composition is cropped hard on some screens (see below). Keep every face and
  every uniform marker (collar, ribbon, chest pocket) inside the central 60% of the frame
  BOTH horizontally and vertically. Do not place anything essential in the top or bottom 20%.
```

> **세로 안전대역이 왜 필요한가.** 회상 갤러리는 `object-fit:cover`로 높이 200에 맞추는데,
> 렌더 폭이 370~448로 변한다. 원본 1440×810 기준 실제로 잘려나가는 양:
>
> ```
> 렌더 폭    위 크롭   아래 크롭   합계     원본 높이의
>    370       9px      22px      32px       3.9%   (엔딩·여러 장)
>    394      24px      55px      79px       9.8%   (학년말·여러 장)
>    420      37px      87px     124px      15.3%   (엔딩·한 장)
>    448      50px     117px     167px      20.6%   (학년말·한 장)
> ```
>
> 최악은 **위 50 / 아래 117px**. 여기에 앨범 칸은 **44×44 정중앙 정사각**이라 좌우까지 잘린다 —
> 인물이 프레임 양끝에 서면 앨범에는 **펜스와 노을만** 남는다.

**첨부 레퍼런스 (컷마다 해당하는 것 1장씩 반드시 첨부)**

| 그릴 컷 | 첨부할 기존 파일 | 역할 |
|---|---|---|
| `_c0_m` | `game/public/images/events/high/jihun-promise_c0_m.png` | **구도·색·카메라를 그대로 계승** |
| `_c0_f` | `game/public/images/events/high/jihun-promise_c0_f.png` | 〃 |
| `_c1_m` | `game/public/images/events/high/jihun-promise_c1_m.png` | 구도·카메라만 계승 — **시선·눈물은 계승하지 않는다** |
| `_c1_f` | `game/public/images/events/high/jihun-promise_c1_f.png` | 〃 |

추가로 인물 정합용(전부 존재 확인):
`game/public/images/characters/jihun_middle_neutral.png`,
`game/public/images/characters/player_m_middle_neutral.png`(남주 컷) 또는
`game/public/images/characters/player_f_middle_neutral.png`(여주 컷).

> **왜 기존 파일을 첨부하는가.** 중등 61장 배치에서 *"페어 카운터파트 생성 시 기존 파일을 레퍼런스로
> 첨부"* 한 25쌍이 전부 장면 정합을 유지했다. c0은 **같은 장면을 중학판으로 다시 그리는 것**이므로
> 첨부가 품질과 검수 비용을 동시에 줄인다. c1은 구도만 빌리므로 첨부에 **계승 범위를 명시**해야 한다.

---

## 🎬 컷 ① `middle/jihun-promise_c0_m.png` — 약속 (남주)

**원문**
> `description`: 한 학년이 끝나간다. 지훈이가 학교 옥상으로 올라가자고 했다. / 바람이 분다. / **"야... 우리 진짜 오래 알았다, 그치?"** / "...어. 초등학교 때부터."
> 선택지 c0: `"앞으로도 계속 친구하자" — 약속한다`
> `message`: **"당연하지, 바보야." 지훈이가 웃었다. 바람에 눈이 좀 매웠다. ...바람 때문이다.**
> 슬롯: `reconciliation` / `warm` / importance **8**

**설계 의도**: 마주 보고 하는 약속이 아니다. **둘 다 먼 데를 보면서** 하는 약속이다.
"바람 때문이다"라는 문장이 눈물을 부인하는 자리라, 얼굴을 정면으로 잡지 않는 구도가 원문에 맞는다.

```
[레퍼런스] 첨부한 high/jihun-promise_c0_m.png 와 같은 구도·같은 카메라·같은 색·같은 감정으로
그린다. 바뀌는 것은 교복(중학)과 나이(중학생)뿐이다.

Two Korean MIDDLE SCHOOL boys (13-15) stand at the chain-link fence on their school rooftop at
sunset, seen in a wide shot from behind and slightly to the side. Neither is facing the camera.
LEFT — JIHUN: short messy black hair, slightly spiky; athletic build, a little taller than
the other boy. Navy blazer worn casually and slightly open over a white shirt, dark pants,
white sneakers. His head is turned slightly so his face reads in profile, wearing the faint
confident smile that is his marker. NO NECKTIE.
RIGHT — THE PROTAGONIST: natural medium-length black hair with a soft centre part and fuller
bangs. Average build, slightly shorter. Navy blazer fully buttoned, white shirt, dark pants,
black loafers. NO NECKTIE, NO crest or emblem on the blazer. Seen from behind; his face is
not visible. He is looking out at the city.
The low sun sits on the horizon between them; the city stretches out below the fence.
Wind moves their hair and the hems of their blazers.
Mood: two boys who have known each other since they were small, promising something they
will not say out loud again.

Keep both figures and the sun inside the central 60% of the frame, vertically as well as
horizontally — the top and bottom 20% will be cropped on some screens.

[MUST NOT]
no necktie on either boy, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no other people on the rooftop,
no snow, no visible breath, no coats, no scarves, no gloves,
no readable text, no letters, no numbers, no school name, no signage, no banner,
no tears on a visible face, no dramatic lens flare, no rectangular blur patches,
no western school architecture
```

---

## 🎬 컷 ② `middle/jihun-promise_c0_f.png` — 약속 (여주)

컷 ①과 **같은 장면·같은 카메라**. 오른쪽 인물만 여주로 바뀐다.

```
[레퍼런스] 첨부한 high/jihun-promise_c0_f.png 와 같은 구도·같은 카메라·같은 색·같은 감정으로
그린다. 바뀌는 것은 교복(중학)과 나이(중학생)뿐이다.

Same rooftop, same sunset, same wide shot from behind. Korean MIDDLE SCHOOL students (13-15).
LEFT — JIHUN: identical to the description above — messy black hair, navy blazer worn open,
white shirt, dark pants, white sneakers, NO NECKTIE, head turned so his face reads in profile,
faint confident smile.
RIGHT — THE PROTAGONIST (GIRL): medium-length dark brown straight hair, shoulder length,
moving in the wind. Navy blazer, white shirt with a RED RIBBON at the collar, plaid skirt,
brown loafers, dark knee socks. Average build, slightly shorter than Jihun.
Seen from behind; her face is not visible. She is looking out at the city.
The low sun sits on the horizon between them.
Mood: identical — a promise made while both of them look somewhere else. Childhood friends.

Keep both figures and the sun inside the central 60% of the frame, vertically as well as
horizontally — the top and bottom 20% will be cropped on some screens.

[MUST NOT]
no necktie on Jihun, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no other people on the rooftop,
no romantic framing, no hand-holding, no leaning on each other, no faces turned toward
each other, no blush directed at the girl,
no snow, no visible breath, no coats, no scarves, no gloves,
no readable text, no letters, no numbers, no school name, no signage,
no dramatic lens flare, no rectangular blur patches, no western school architecture
```

> **`no romantic framing`을 넣는 이유.** 지훈은 여주 루트에서도 **우정 코드**다.
> 여주 컷에서 생성기가 습관적으로 연애 구도(마주 보기·거리 좁히기·손)를 넣는 사례가 있었다.

---

## 🎬 컷 ③ `middle/jihun-promise_c1_m.png` — 고마움 (남주)

**원문**
> 선택지 c1: `"너 없었으면 학교생활 재미없었을 거야" — 고마움을 전한다`
> `message`: **"야, 갑자기 왜 이래." 지훈이가 픽 웃으며 괜히 먼 데를 본다. "...나도, 인마."**
> 슬롯: `reconciliation` / `warm` / importance **8**

**설계 의도**: 이 컷의 주인공은 **쑥스러움**이다. 지훈이 웃긴 웃는데 **눈은 딴 데를 본다.**
c0이 와이드였으니 여기는 **가까이** 간다.

> ⚠️ **첨부 레퍼런스는 이 감정이 아니다.** `high/_c1_m`의 지훈은 정면을 보며 울고 있다(옛 텍스트 기준).
> 구도와 카메라만 빌리고 **감정은 현재 텍스트를 따른다.** 프롬프트에 그 구분이 들어가 있다.

```
[레퍼런스] 첨부한 high/jihun-promise_c1_m.png 에서 **구도·카메라 거리·좌우 배치·색·조명·배경만**
계승한다. 바뀌는 것: 교복(중학), 나이(중학생), 그리고 **지훈의 감정**.
첨부 이미지의 지훈은 정면을 보며 울고 있는데, 이번 컷은 그렇지 않다 —
**시선은 지평선으로 돌아가 있고 눈물은 없다.** 시선과 눈물은 계승하지 않는다.

Close shot on JIHUN, a Korean MIDDLE SCHOOL boy (13-15), on the school rooftop at sunset.
Short messy black hair moving in the wind. Navy blazer worn casually and slightly open over a
white shirt, collar unbuttoned. NO NECKTIE, NO crest, NO emblem, NO badge on the blazer.
He is caught mid-reaction: a small embarrassed grin pulling at one side of his mouth while his
EYES ARE TURNED AWAY toward the horizon — he is deflecting, not receiving. A faint flush on
his cheeks. He is NOT looking at the person in front of him. His eyes are dry and clear.
In the foreground on the RIGHT, out of focus and cropped by the frame edge, is the BACK OF THE
PROTAGONIST'S HEAD and one shoulder — natural medium-length black hair with a soft centre part,
navy blazer, white shirt collar, NO NECKTIE. His face is not visible at all.
Behind Jihun: the chain-link fence, the sunset city, warm orange sky.
Mood: "야, 갑자기 왜 이래." — a boy who has just been told something sincere and is handling
it by looking somewhere else. Awkward warmth, not grief.

Keep Jihun's face and collar inside the central 60% of the frame, vertically as well as
horizontally — the top and bottom 20% will be cropped on some screens.

[MUST NOT]
no necktie on either boy, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no eye contact between them,
no tears, no crying, no reddened or brimming eyes, no wet cheeks,
no wide open laughing mouth, no other people on the rooftop,
no protagonist's face visible in the foreground,
no snow, no visible breath, no coats, no scarves, no gloves,
no readable text, no letters, no numbers, no school name, no signage,
no dramatic lens flare, no rectangular blur patches, no western school architecture
```

---

## 🎬 컷 ④ `middle/jihun-promise_c1_f.png` — 고마움 (여주)

컷 ③과 **같은 장면·같은 카메라**. 전경 인물만 여주로 바뀐다(레퍼런스대로 **왼쪽**).

```
[레퍼런스] 첨부한 high/jihun-promise_c1_f.png 에서 **구도·카메라 거리·좌우 배치·색·조명·배경만**
계승한다. 바뀌는 것: 교복(중학), 나이(중학생), 그리고 **지훈의 감정**.
첨부 이미지의 지훈은 정면을 보며 울고 있는데, 이번 컷은 그렇지 않다 —
**시선은 지평선으로 돌아가 있고 눈물은 없다.** 시선과 눈물은 계승하지 않는다.
참고: 첨부 이미지의 지훈은 왼쪽 가슴에 금색 크레스트를 달고 있다. 이번 컷에는 **없어야 한다.**

Same close shot on JIHUN — Korean MIDDLE SCHOOL boy (13-15): messy black hair, navy blazer
worn open, white shirt with the collar unbuttoned, NO NECKTIE, NO crest or emblem,
embarrassed half-grin, eyes turned away toward the horizon, faint flush, eyes dry and clear.
In the foreground on the LEFT, out of focus and cropped by the frame edge, is the BACK OF THE
PROTAGONIST'S HEAD (GIRL) — medium-length dark brown straight hair moving in the wind, navy
blazer, a RED RIBBON just visible at her collar. Her face is not visible at all.
Behind Jihun: the chain-link fence, the sunset city, warm orange sky.
Mood: identical — deflected sincerity between childhood friends. Not romance, not grief.

Keep Jihun's face and collar inside the central 60% of the frame, vertically as well as
horizontally — the top and bottom 20% will be cropped on some screens.

[MUST NOT]
no necktie on Jihun, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no eye contact, no romantic framing,
no tears, no crying, no reddened or brimming eyes, no wet cheeks,
no blushing directed at the girl, no hand-holding, no faces turned toward each other,
no protagonist's face visible in the foreground,
no wide open laughing mouth, no other people on the rooftop,
no snow, no visible breath, no coats, no scarves, no gloves,
no readable text, no letters, no numbers, no school name, no signage,
no dramatic lens flare, no rectangular blur patches, no western school architecture
```

---

## ✅ 납품 검수 체크리스트

발주자가 아니라 **검수자가** 픽셀로 확인한다. 자체 신고 표는 신뢰하지 않는다.

| # | 항목 | 방법 |
|---|---|---|
| 1 | `1440x810` PNG, alpha 없음 × 4장 | `sips -g pixelWidth -g pixelHeight -g hasAlpha` |
| 2 | **넥타이 0개** | 네이티브 확대. 4장 전부, 두 인물 전부 |
| 3 | **크레스트·엠블럼·배지 0개** | 왼쪽 가슴 주머니를 확대. 비교 대상은 **`high/_c1_f`**(여기에 금색 크레스트가 실재한다 — `_c1_m`이 아니다) |
| 4 | 여주 컷의 **빨간 리본** 존재 | 중등 스펙에도 리본은 있다 — 빼면 안 된다 |
| 5 | 지훈 **흰 운동화** / 남주 **검정 로퍼** | 레퍼런스 ①②는 허벅지에서 잘려 발이 안 보인다. **발이 프레임에 들어온 경우에만** 확인 |
| 6 | **연령감이 중학생인가** | 기존 `high/` 4장과 나란히 놓고 비교. 키·어깨너비·얼굴 둥글기 |
| 7 | 글자 0개 | 교명·현수막·간판. 옥상은 글자가 잘 생기는 배경이다 |
| 8 | 얼굴 노출 규칙 | ①② 주인공 얼굴 안 보임·지훈은 측면 / ③④ 주인공 얼굴 안 보임 · **지훈은 시선이 딴 데, 눈물 없음** |
| 9 | 여주 컷에 연애 코드 없는가 | 지훈은 우정 코드다. 마주 보기·손·거리 좁히기 없어야 함 |
| 10 | ①②의 구도가 기존 `high/_c0`과 이어지는가 | c0만 해당. **③④는 리테이크라 감정이 다른 게 정상** |
| 11 | 안전대역 | **지훈 얼굴**과 교복 마커(칼라·리본·가슴)가 가로·**세로** 중앙 60% 안 (주인공 얼굴은 4컷 모두 안 보이는 게 설계다) |
| 12 | **축소 판정 — 네 폭 전부** | `object-fit:cover` + `center 30%`로 **448·420·394·370 ×200** 리샘플. 최악(448)은 원본 기준 **위 50px·아래 117px**가 날아간다. 각 폭에서 누가 누구인지 읽히는가 |
| 13 | **톤 필터 판정** | 위 축소본에 `saturate(0.88) sepia(0.24) brightness(1.02)`를 걸어서 볼 것. 이미 주황 노을이라 탁해지기 쉽다 |
| 14 | **앨범 칸 판정** | **44×44 `cover`**(정중앙 정사각)로 잘라서, 사람이 남는가 — 인물이 양끝에 서면 펜스만 남는다 |
| 15 | **앨범 확대뷰** | `76vh` `contain` — 안 잘리는 유일한 면이자 가장 큰 면. 원본 화질로 볼 것 |
| 16 | 매니페스트 | `node scripts/generate-cg-manifest.mjs` → **444장**, `grep -c "middle/jihun-promise"` = 4, diff가 **`+4 −0`** |
| 17 | 해석 확인 — 신규 | `resolveEventCgRelPaths('jihun-promise', ci, g, 2)` → `middle/...` (양 성별 × ci 0·1) |
| 18 | **해석 확인 — 회귀** | `resolveEventCgRelPaths('jihun-promise', ci, g, 5)`·`(…, 7)` → **여전히 `high/...`** (신규 middle이 기존 high를 가리지 않는지) |
| 19 | 앨범 칸 수 | `npcAlbum('jihun')` → `middle` 버킷 **3 → 5**, 총 **52 → 54** |
| 20 | CI | `npx vitest run` / `npm run verify:ci` |
| 21 | 릴리즈 용량 | sharp `quality:82, effort:5`로 webp 변환 후 실측 |

> **⑫~⑮를 빼면 안 된다.** 이 4컷은 엔딩 회상 갤러리에 **실제로 뜨는** 첫 배치이고
> (`adolescence-clash`는 결과 화면이 주 노출면이었다), **엔딩 갤러리의 첫 장이 될 공산이 크다.**
> 그리고 표시면이 44px부터 76vh까지 **한 자릿수 배율 차이**로 벌어진다.

---

## 📮 발주 절차

1. **컷당 1회씩, 4번 나눠 발주한다.** 한 프롬프트에 여러 장을 넣으면 교복이 섞인다.
2. **레퍼런스 첨부가 이 발주의 핵심이다** — 위 표대로 기존 `high/` 대응 파일을 반드시 붙인다.
   붙이지 않으면 "같은 장면의 다른 학교급"이 아니라 "비슷한 다른 장면"이 나온다.
   **③④는 첨부와 함께 "무엇을 계승하지 않는지"를 반드시 같이 보낸다.**
3. 프롬프트는 **자기완결형**으로 복사해 보낸다. 생성자가 워킹트리의 문서를 못 읽는 상황이
   두 번 있었다(부모 절정 6장, 사춘기 2장) — 문서 참조 없이 프롬프트 안에 전부 넣는다.
4. 납품 후 위 체크리스트 21항목을 **검수자가 직접** 수행. 특히 ②③은 이 발주의 존재 이유다.
5. 매니페스트 재생성 → **`+4 −0`** 인지 diff로 확인.
