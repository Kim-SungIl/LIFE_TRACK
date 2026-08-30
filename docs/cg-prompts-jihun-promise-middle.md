# Event CG Prompts — `jihun-promise` 중학판 (4컷)

> **엔딩 회상에서 그림이 비는 자리의 81%가 이 이벤트 하나다.** 그런데 CG는 이미 4장 있다 —
> `high/`에만 있어서, 실제 발동 학년(Y2 = 중1)에서 경로가 안 잡힐 뿐이다.
> 이 발주는 **같은 장면의 중학판 4장**을 채워 그 구멍을 닫는다.

**계측 재현**: `npx tsx scripts/sim/sim-qa-playthrough.ts <dir>` (29 페르소나 × 12시드 = 348런)
**장면 SSOT**: `src/engine/events/npc/jihun.ts` L160~ (`description`·`message` 원문)
**외형 SSOT**: `docs/character-prompt-spec.md` §player_m / §player_f / §jihun
**레퍼런스 SSOT**: 기존 `high/jihun-promise_c{0,1}_{m,f}.png` 4장 — **구도를 그대로 계승한다**

**포맷**: `docs/cg-prompts-high-y5-y7.md` §공통 스타일에서 `Resolution` / `Safe area` 두 줄을 상속.
`Art style` / `Composition` / `Age` / `Uniform`은 **이 문서가 다시 정의한다**(학교급이 다르므로 상속하면 안 된다).

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
`reconciliation` / 톤 `warm` / **importance 8**이다(`jihun.ts` L167·L175).

- `reconciliation`·`warm`은 **후회 풀이 아니다**(`REGRET_CATEGORIES` = failure/betrayal/bypass/unspoken_debt,
  `REGRET_TONES` = regret/melancholy/burden, `memorySystem.ts:248-251`). 후회 층은 그림을 안 그리므로,
  후회 풀로 가는 슬롯에 CG를 넣으면 엔딩에서 안 보인다 — **이건 그 함정에 걸리지 않는다.**
- importance **8**은 슬롯 상한 경쟁(카테고리당 2개, 교체는 importance 초과일 때만)에서 거의 항상 이긴다.
  실제로 `adolescence-clash`(imp 5)를 밀어내는 `graduation-prep-high`와 같은 체급이다.

즉 `adolescence-clash` 배치가 "결과 화면 노출"로 정당화해야 했던 것과 달리,
**이 4컷은 엔딩 회상 갤러리에 그대로 뜬다.** 컷당 회수가 지금 남은 후보 중 가장 크다.

**③ 노출면은 다섯 곳이다.** (초판에서 한 번 틀렸던 부분이라 실측치로 적는다)

| 노출면 | 크기·조건 |
|---|---|
| 엔딩 회상 갤러리 | `HeroGallery` 368×200, `object-fit:cover` + `object-position:center 30%` |
| 결과 화면 | `EventResultScreen.tsx:113-141` — **전체화면이 아니라** `padding:'20px 24px 24px'` 안의 `borderRadius:12` 카드. `#root`가 `max-width:600`이라 iPhone SE 약 327×184 |
| Y2 학년말 회고 | `YearEndScreen` 썸네일 |
| 기록실 | `archive.ts:261` — 일반 이벤트라 `e.year`로 해석(연도를 저장한다) |
| 인물 앨범 | `npcAlbum.ts` — 학교급별로 칸을 만들고 `${level}/`로 시작하는 경로만 인정한다. **지훈 뿌리에 middle 칸 2개가 새로 생긴다**(현재는 high 칸만 존재) |

**④ 발동 학년.** `condition`은 `jihun.met && jihun.intimacy >= 70 && year >= 2 && week >= 40 && !isVacation`이다
(학년 고정 게이트가 **없다**). 실측은 전부 **Y2**였다 — 회상 칸 204개의 슬롯 `year` 분포가 `{2: 204}`이고,
`jihun.ts`의 코드 주석도 *"실측 20/20 런에서 전부 Y2(중1)에 발동"*이라고 적어 뒀다.
지훈 친밀도가 Y2에 74로 정점이고 Y7엔 60까지 내려가 `>=70`이 후반엔 성립하지 않기 때문이다.

**⑤ 결손을 리졸버로 직접 확인했다.** `resolveEventCgRelPaths('jihun-promise', ci, gender, year)` 실행:

```
Y2(middle) ci=0 male   -> []          Y5(high) ci=0 male   -> ["high/jihun-promise_c0_m.png"]
Y2(middle) ci=1 male   -> []          Y5(high) ci=1 male   -> ["high/jihun-promise_c1_m.png"]
Y2(middle) ci=0 female -> []          Y5(high) ci=0 female -> ["high/jihun-promise_c0_f.png"]
Y2(middle) ci=1 female -> []          Y5(high) ci=1 female -> ["high/jihun-promise_c1_f.png"]
Y4(middle) 4종 전부    -> []          Y7(high) 4종 전부    -> 정상 해석
```

**실제 발동 학년(Y2)에서 후보가 0개**다. 폴백 cascade의 `common/` 단계까지 내려가도 없다.

> 그래서 `middle/`이 실질적으로 이 이벤트의 **주 경로**이고, 기존 `high/` 4장은
> 친밀도를 후반까지 끌고 간 판을 위한 보조로 남는다. **기존 자산은 지우지 않는다.**
> `getSchoolLevel`: `year<=1` elementary / `<=4` middle / else high → `middle/`이 Y2~Y4를 덮는다.

---

## 🚫 기존 `high/` 자산을 그대로 옮기면 안 되는 이유

한때 *"파일만 옮기면 되는 무료 수정"*으로 적혀 있었다. **틀렸다.** 픽셀로 확인한 것:

`high/jihun-promise_c0_m.png` · `_c1_m.png` 에서 지훈은 **네이비 넥타이**를 매고 있고,
`_c1_m`에는 블레이저 왼쪽 가슴에 **금색 학교 크레스트 엠블럼**까지 있다. 그런데 스펙은:

| | 중등 | 고등 |
|---|---|---|
| player_m | `navy blazer fully buttoned, white shirt (**NO tie at middle stage**), dark pants, black loafers` (L201) | `navy tie` + `small gold-embroidered school crest emblem on left chest pocket` (L210-211) |
| jihun | `navy blazer worn casually (slightly open), white shirt, dark pants, **white sneakers**` — 넥타이 항목 없음 | (별도 블록 없음) |
| player_f | `navy blazer, white shirt with **red ribbon**, plaid skirt, brown loafers, dark knee socks` | **별도 블록 없음 — 중등과 동일** |

**넥타이와 크레스트는 고등 전용 마커다.** 중학 장면에 그대로 쓰면 톤 위험이 아니라 **명세 위반**이다.

> **여주 컷도 새로 그려야 한다.** player_f는 중·고 교복 규정이 같아서 여주 본인은 안 변하지만,
> **같은 화면의 지훈이 넥타이를 매고 있다.** 그리고 둘 다 중1(13세) 비율로 어려져야 한다.

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
| choiceIndex 분기 | 두 선택지의 **비트가 다르다**. c0은 약속을 주고받는 순간(둘 다 먼 데를 본다), c1은 지훈이 쑥스러워 얼굴을 돌리는 순간이다. 기존 `high/` 4장도 같은 구조로 갈라져 있다 |
| 학교급 | Y2 발동 → `middle/`. `high/` 4장은 그대로 둔다 |

cascade 1순위 `{sl}/{id}_c{ci}_{g}`에서 잡힌다(`src/engine/eventCg.ts`).
파일 추가 후 **`node scripts/generate-cg-manifest.mjs`** 필수 → 442장, `grep -c "middle/jihun-promise"` = 4.

> ⚠️ 브랜치를 옮기면 매니페스트(tracked)만 원복되고 PNG(untracked)는 남아 **4장이 조용히 안 뜨는**
> 상태가 된다. 브랜치 이동 후에는 무조건 재생성할 것.

### 더 싸게 가는 선택지 (권장하지 않음)

`middle/jihun-promise_m.png` + `_f.png` **2장**만 그려도 된다 — cascade 2순위 `{sl}/{id}_{g}`가
두 선택지를 모두 덮는다. 컷 수가 절반이고 회상 204칸도 그대로 채워진다.
**다만 결과 화면에서 두 선택지가 같은 그림을 받는다.** 이 이벤트는 importance 8에 회상 노출 1위라
선택의 차이를 그림이 지고 갈 값이 있다고 본다. 예산이 빠듯하면 2장으로 줄이되,
그때는 **c0 구도(와이드 투샷)** 를 채택할 것 — 두 대사 모두에 무리 없이 붙는다.

---

## 🎨 공통 스타일 (4컷 공통 — 프롬프트마다 붙인다)

```
Art style: soft anime illustration, hand-painted look, gentle cel shading with painterly
  texture. Korean web-novel / visual-novel cover quality. No harsh outlines, no 3D render feel.
Composition: 16:9 landscape, cinematic framing.
Age: 13-year-old Korean MIDDLE SCHOOL students (first year of middle school).
  Younger, slighter proportions than high schoolers — shorter, narrower shoulders, rounder faces.
Uniform (MIDDLE SCHOOL — this is the point of the whole commission):
  - Boys: navy blazer, white dress shirt buttoned to the collar, NO NECKTIE, dark pants.
    NO crest, NO emblem, NO badge, NO pin anywhere on the blazer.
  - Girl: navy blazer, white shirt with a RED RIBBON at the collar, plaid skirt,
    brown loafers, dark knee socks.
Setting: the rooftop of a Korean school at sunset in late winter. Chain-link fence along the
  edge, low concrete parapet, city skyline below, a rooftop stair-housing block and a ladder
  to one side. Warm orange and pink sky with scattered clouds; the low sun near the horizon.
Wind: their hair and clothes are moving — the scene says "바람이 분다".
Resolution: 1440x810.
Safe area: keep both faces inside the horizontal 10-90% band of the frame.
```

**첨부 레퍼런스 (컷마다 해당하는 것 1장씩 반드시 첨부)**

| 그릴 컷 | 첨부할 기존 파일 | 역할 |
|---|---|---|
| `_c0_m` | `game/public/images/events/high/jihun-promise_c0_m.png` | **구도·색·카메라를 그대로 계승** |
| `_c0_f` | `game/public/images/events/high/jihun-promise_c0_f.png` | 〃 |
| `_c1_m` | `game/public/images/events/high/jihun-promise_c1_m.png` | 〃 |
| `_c1_f` | `game/public/images/events/high/jihun-promise_c1_f.png` | 〃 |

추가로 인물 정합용: `characters/jihun_middle_neutral.png`,
`characters/player_m_middle_neutral.png`(남주 컷) 또는 `characters/player_f_middle_neutral.png`(여주 컷).

> **왜 기존 파일을 첨부하는가.** 중등 61장 배치에서 *"페어 카운터파트 생성 시 기존 파일을 레퍼런스로
> 첨부"* 한 25쌍이 전부 장면 정합을 유지했다. 이 발주는 **새 장면을 만드는 게 아니라 같은 장면을
> 중학판으로 다시 그리는 것**이므로, 첨부가 품질과 검수 비용을 동시에 줄인다.

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
[레퍼런스] 첨부한 high/jihun-promise_c0_m.png 와 같은 구도·같은 카메라·같은 색으로 그린다.
바뀌는 것은 교복(중학)과 나이(13세)뿐이다.

Two 13-year-old Korean MIDDLE SCHOOL boys stand at the chain-link fence on their school
rooftop at sunset, seen in a wide shot from behind and slightly to the side. Neither is
facing the camera.
LEFT — JIHUN: short messy black hair, slightly spiky; athletic build, a little taller than
the other boy. Navy blazer worn casually and slightly open over a white shirt, dark pants,
white sneakers. He has turned his head toward his friend and is grinning — the confident,
teeth-showing grin that is his marker. NO NECKTIE.
RIGHT — THE PROTAGONIST: natural medium-length black hair with a soft centre part and fuller
bangs. Average build, slightly shorter. Navy blazer fully buttoned, white shirt, dark pants,
black loafers. NO NECKTIE, NO crest or emblem on the blazer. Seen from behind; his face is
not visible. He is looking out at the city.
The low sun sits on the horizon between them; the city stretches out below the fence.
Wind moves their hair and the hems of their blazers.
Mood: two boys who have known each other since they were small, promising something they
will not say out loud again.

[MUST NOT]
no necktie on either boy, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no other people on the rooftop,
no readable text, no letters, no numbers, no school name, no signage, no banner,
no tears on a visible face, no dramatic lens flare, no rectangular blur patches,
no western school architecture
```

---

## 🎬 컷 ② `middle/jihun-promise_c0_f.png` — 약속 (여주)

컷 ①과 **같은 장면·같은 카메라**. 오른쪽 인물만 여주로 바뀐다.

```
[레퍼런스] 첨부한 high/jihun-promise_c0_f.png 와 같은 구도·같은 카메라·같은 색으로 그린다.
바뀌는 것은 교복(중학)과 나이(13세)뿐이다.

Same rooftop, same sunset, same wide shot from behind.
LEFT — JIHUN: identical to the description above — messy black hair, navy blazer worn open,
white shirt, dark pants, white sneakers, NO NECKTIE, head turned toward his friend, grinning.
RIGHT — THE PROTAGONIST (GIRL): medium-length dark brown straight hair, shoulder length,
moving in the wind. Navy blazer, white shirt with a RED RIBBON at the collar, plaid skirt,
brown loafers, dark knee socks. Average build, slightly shorter than Jihun.
Seen from behind; her face is not visible. She is looking out at the city.
The low sun sits on the horizon between them.
Mood: identical — a promise made while both of them look somewhere else.

[MUST NOT]
no necktie on Jihun, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no other people on the rooftop,
no romantic framing, no hand-holding, no leaning on each other,
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
c0이 와이드였으니 여기는 **가까이** 간다 — 기존 `high/_c1_m`이 이미 그 구조다.

```
[레퍼런스] 첨부한 high/jihun-promise_c1_m.png 와 같은 구도·같은 카메라·같은 색으로 그린다.
바뀌는 것은 교복(중학)과 나이(13세)뿐이다.

Close shot on JIHUN, a 13-year-old Korean MIDDLE SCHOOL boy, on the school rooftop at sunset.
Short messy black hair moving in the wind. Navy blazer worn casually and slightly open over a
white shirt. NO NECKTIE, NO crest, NO emblem, NO badge on the blazer.
He is caught mid-reaction: a small embarrassed grin pulling at one side of his mouth while his
EYES ARE TURNED AWAY toward the horizon — he is deflecting, not receiving. A faint flush on
his cheeks. He is not looking at the person in front of him.
In the foreground on the right, out of focus and cropped by the frame edge, is the BACK OF THE
PROTAGONIST'S HEAD and one shoulder — natural medium-length black hair with a soft centre part,
navy blazer, white shirt collar, NO NECKTIE. His face is not visible at all.
Behind Jihun: the chain-link fence, the sunset city, warm orange sky.
Mood: "야, 갑자기 왜 이래." — a boy who has just been told something sincere and is handling
it by looking somewhere else.

[MUST NOT]
no necktie on either boy, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no eye contact between them,
no wide open laughing mouth, no tears, no crying, no other people on the rooftop,
no protagonist's face visible in the foreground,
no readable text, no letters, no numbers, no school name, no signage,
no dramatic lens flare, no rectangular blur patches, no western school architecture
```

---

## 🎬 컷 ④ `middle/jihun-promise_c1_f.png` — 고마움 (여주)

컷 ③과 **같은 장면·같은 카메라**. 전경 인물만 여주로 바뀐다.

```
[레퍼런스] 첨부한 high/jihun-promise_c1_f.png 와 같은 구도·같은 카메라·같은 색으로 그린다.
바뀌는 것은 교복(중학)과 나이(13세)뿐이다.

Same close shot on JIHUN — identical to the description above: messy black hair, navy blazer
worn open, white shirt, NO NECKTIE, no crest or emblem, embarrassed half-grin, eyes turned
away toward the horizon, faint flush.
In the foreground on the LEFT, out of focus and cropped by the frame edge, is the BACK OF THE
PROTAGONIST'S HEAD (GIRL) — medium-length dark brown straight hair moving in the wind, navy
blazer, a RED RIBBON just visible at her collar. Her face is not visible at all.
Behind Jihun: the chain-link fence, the sunset city, warm orange sky.
Mood: identical — deflected sincerity, not romance.

[MUST NOT]
no necktie on Jihun, no crest, no emblem, no badge, no pin on any blazer,
no high-school-aged or adult proportions, no eye contact, no romantic framing,
no blushing directed at the girl, no hand-holding, no faces turned toward each other,
no protagonist's face visible in the foreground,
no wide open laughing mouth, no tears, no other people on the rooftop,
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
| 3 | **크레스트·엠블럼·배지 0개** | 왼쪽 가슴 주머니를 확대해서 볼 것 (`high/_c1_m`에 실재한다) |
| 4 | 여주 컷의 **빨간 리본** 존재 | 중등 스펙에도 리본은 있다 — 빼면 안 된다 |
| 5 | 지훈 **흰 운동화** / 남주 **검정 로퍼** | 와이드 컷(①②)에서 발이 보이면 확인 |
| 6 | **연령감이 중1인가** | 기존 `high/` 4장과 나란히 놓고 비교. 키·어깨너비·얼굴 둥글기 |
| 7 | 글자 0개 | 교명·현수막·간판. 옥상은 글자가 잘 생기는 배경이다 |
| 8 | 얼굴 노출 규칙 | ①② 주인공 얼굴 안 보임 / ③④ 주인공 얼굴 안 보임 · 지훈은 시선이 딴 데 |
| 9 | 여주 컷에 연애 코드 없는가 | 지훈은 우정 코드다. 마주 보기·손·거리 좁히기 없어야 함 |
| 10 | 구도가 기존 4장과 이어지는가 | 같은 이벤트의 학교급 판본이라 카메라가 튀면 안 된다 |
| 11 | 안전대역 | 두 얼굴이 가로 10~90% 안 |
| 12 | **축소 판정** | 368×200으로 리샘플(`object-fit:cover` + `object-position:center 30%`, 원본 기준 위 8px·아래 20px 크롭)해서 누가 누구인지 읽히는가 |
| 13 | 매니페스트 | `node scripts/generate-cg-manifest.mjs` → 442장, `grep -c "middle/jihun-promise"` = 4 |
| 14 | 해석 확인 | `resolveEventCgRelPaths('jihun-promise', 0, 'male', 2)` → `middle/jihun-promise_c0_m.png` (양 성별 × ci 0·1) |
| 15 | CI | `npx vitest run` / `npm run verify:ci` |
| 16 | 릴리즈 용량 | sharp `quality:82, effort:5`로 webp 변환 후 실측 |

> **⑫를 빼면 안 된다.** 이 4컷은 엔딩 회상 갤러리에 **실제로 뜨는** 첫 배치다
> (`adolescence-clash`는 결과 화면이 주 노출면이었다). 368px에서 안 읽히면 값의 대부분을 잃는다.

---

## 📮 발주 절차

1. **컷당 1회씩, 4번 나눠 발주한다.** 한 프롬프트에 여러 장을 넣으면 교복이 섞인다.
2. **레퍼런스 첨부가 이 발주의 핵심이다** — 위 표대로 기존 `high/` 대응 파일을 반드시 붙인다.
   붙이지 않으면 "같은 장면의 다른 학교급"이 아니라 "비슷한 다른 장면"이 나온다.
3. 프롬프트는 **자기완결형**으로 복사해 보낸다. 생성자가 워킹트리의 문서를 못 읽는 상황이
   두 번 있었다(부모 절정 6장, 사춘기 2장) — 문서 참조 없이 프롬프트 안에 전부 넣는다.
4. 납품 후 위 체크리스트 16항목을 **검수자가 직접** 수행. 특히 ②③은 이 발주의 존재 이유다.
5. 매니페스트 재생성 → **`+4 −0`** 인지 diff로 확인.
