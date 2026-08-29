# Event CG Prompts — 사춘기 골짜기 `adolescence-clash` (Phase 4D, 2컷)

> **먼저 정정.** `docs/cg-prompts-parent-climax-4b.md`(#415)에 *"회수 기준 1등은 `adolescence-clash`다 …
> 엠블럼 자리 60건 = 50%를 이 한 이벤트가 차지한다"* 라고 적혀 있다. **이 수치는 틀렸다.**
> QA 페르소나 하네스 **348런**(29 페르소나) 재측정 결과 CG 없는 회상 칸 252칸 중
> `adolescence-clash`는 **24칸(9.5%)**이고, 실제 1등은 **`jihun-promise` 204칸(81%)**이다.
> 그 문서의 해당 문장은 정정이 필요하다.
>
> **그래도 이 2컷을 그리는 이유는 따로 있다** — 아래 §왜 이 컷인가의 ③.

**계측 재현**: `npx tsx scripts/sim/sim-qa-playthrough.ts <dir>` (29 페르소나 × 12시드 = 348런)
**포맷 상속 — 범위를 좁혀 명시한다.** `docs/cg-prompts-high-y5-y7.md` §공통 스타일 가이드에서
**`Resolution` / `Safe area` 두 줄은 그대로 상속**하고, **`Art style` / `Composition`은 의도적으로 다시 쓴다**
(4b 검수에서 나온 "3D 렌더에 가깝다"는 지적에 대한 대응 — 아래 §공통 스타일이 SSOT다).

> 🚫 **`Age` / `Era` / `Uniform` 줄은 상속하지 않는다.** 원문은 고등학생 교복 지시다.
> **이 2컷에는 학생이 없다** — 그대로 붙이면 "주인공을 프레임에서 뺀다"는 설계와 정반대 지시가
> 같은 프롬프트에 동봉되고, 성별 무분기 근거가 그 자리에서 무너진다.
> (부모 절정 6컷 발주에서 이미 밟은 함정이라 같은 방식으로 차단한다.)

---

## 🔍 왜 이 컷인가 — 전부 실행으로 확인한 것

**① 매 판 무조건 발동한다.** `condition: (s) => s.year === 3` 단 하나 + `week: 26` 고정
(`src/engine/events/parent-adolescence.ts:16-17`). 348런 전부 발동, 발동 학년 전부 Y3.
게이트도 확률도 없다 — 이 리포에서 이만큼 확실한 슬롯 이벤트는 드물다.

**② 그런데 엔딩 회상에는 거의 안 뜬다.** 선택지 3개 중 슬롯을 만드는 건 c0·c2 둘뿐이고
(c1 `울컥했지만 말없이`는 `memorySlotDraft`가 없다), **둘 다 엔딩 그림 자리에 못 간다.**

| 선택지 | 슬롯 | 엔딩에서 실제로 | 실측 |
|---|---|---|---|
| c0 `방문을 쾅 닫는다` | `betrayal` / `regret` / imp **5** | **후회 층**으로 간다 — 후회 층은 **의도적으로 그림을 렌더하지 않는다** | 슬롯 생존 348/348(100%) · 후회 300칸(**86.2%** 판) · 회상 **12칸**(3.4%) |
| c1 `말없이 방에 들어간다` | 없음 | 슬롯 자체가 없다 | — |
| c2 `"…몰라요" 솔직히 말한다` | `growth` / `warm` / imp **5** | **밀려날 수 있다**(기제는 확인, 348런 관측 0회) | 회상 12칸(3.4%) · growth 자리는 imp **8**이 점유 |

`c2`가 사라지는 기제는 명확하다. 슬롯 상한이 **카테고리당 2개**이고 교체 조건이
`newSlot.importance > weakest.importance`(**동률이면 교체 안 됨**, `memorySystem.ts:144-159`)인데,
엔딩 시점 `growth` 두 자리는 실측에서 **`yuna-smile`(312) · `graduation-prep-high`(298)** 이
importance **8**로 채우고 있다(684칸 중 672칸이 imp 8). imp 5인 c2 슬롯은 이 두 자리가 다 차면
밀려난다 — **기제는 단위 검증으로 확인했지만, 348런에서 실제 축출은 0회 관측됐다.** c2를 고른 12런에서
c2 슬롯은 12/12 생존해 회상에 떴다(그 런들은 같은 선택 정책이 `yuna-smile`의 growth 선택지도 피해 가서
growth 슬롯이 애초에 1개뿐이었다). **즉 "밀려난다"는 관측이 아니라 기제로부터의 추론이다** —
이 리포가 반복해 밟은 "실측처럼 적힌 추론" 형태라 그대로 표기해 둔다.

**③ 진짜 노출면은 엔딩이 아니라 "선택 직후"다.** 이게 발주 근거다.
`adolescence-clash`는 미니톡이 아니라 정규 이벤트라 `EventScene → resolveEvent → EventResultScreen`
경로를 **반드시** 지나간다(`GameScreen.tsx`). 그리고 매 판 100% 발동한다.

> 🚫 **"전체화면"이 아니다(2026-08-29 정정).** 초판은 *"전체화면으로 뜬다 · 368×200 갤러리와 체급이
> 다르다"*라고 적었는데 **틀렸다.** CG `<img>`는 `width:100%`이지만 상위 컨테이너에
> `padding:'20px 24px 24px'`가 걸린 `borderRadius:12` **카드**다(`EventResultScreen.tsx:113-141`).
> 초판이 인용한 `:69-79`는 후보 URL 해석부지 레이아웃이 아니다. `#root`가 `max-width:600`이라
> 실제 카드는 **iPhone SE에서 약 327×184, 데스크톱에서 약 550×309** — 뷰포트의 20~24%다.
> 모바일에서는 회상 갤러리 슬라이드(368×200)보다 오히려 **작다.**
>
> 그럼에도 값이 있는 이유는 **크기가 아니라 대체 관계**다. `showFallback = !hasCg || cgError`라서
> CG가 없으면 그 화면은 **풀블리드 배경 + 주인공 전신**을 띄운다 — 즉 "그 장면"이 아니라
> "아무 저녁 배경에 서 있는 주인공"이 나온다. 그림을 넣는다는 것은 **매 판 반드시 지나가는 전용
> 화면에서 범용 폴백을 그 장면의 그림으로 바꾸는 것**이다. 반대로 CG가 붙으면 그 풀블리드 배경과
> 주인공은 사라지므로, **시각 면적 자체는 줄어드는 트레이드오프**가 있다.
>
> 그리고 c1(`말없이 방에 들어간다`)은 컷이 없으므로 "모든 플레이어"가 아니라 **선택지 3개 중 2개**다.

여기에 **Y3 학년말 회고**(`YearEndScreen`, 별도 rest-only 측정에서 Y3 마감 시점 슬롯 생존 16/24판)와
**기록실**, 그리고 인물 앨범(`npcAlbum`은 `common/`을 제외하지만 이 2장은 `middle/`이라 등재된다)이 더해진다.

즉 이 2컷의 값은 *"엠블럼을 CG로 바꾼다"*가 아니라 *"매 판 반드시 지나가는 장면에 그림을 준다"*다.
엔딩 회상 커버리지를 목표로 삼으면 이 배치는 **오답**이다.

**④ 더 싼 후보가 실재한다.** CG 없는 회상 칸 252칸의 구성:

```
jihun-promise              204칸 (81.0%)   ← CG가 이미 있다. high/에만 있어서 Y2(=middle) 발동에 미매칭
adolescence-clash           24칸 ( 9.5%)
career-conflict-info-y5     12칸 ( 4.8%)   ← importance 5 · CG 0장
career-conflict-info-y6     12칸 ( 4.8%)   ← importance 5 · CG 0장
```

`jihun-promise`는 회상 결손의 81%를 혼자 차지하므로 **다음 1순위**다. 다만 **"신규 아트 0장"은 틀렸다**
(2026-08-29 정정). 자산 `high/jihun-promise_c0_m.png`를 열어 보면 두 남학생이 **네이비 넥타이**를 매고
있는데, `docs/character-prompt-spec.md:201`은 중학 남주를 `white shirt (NO tie at middle stage)`로 못 박는다.
넥타이는 **고등 전용 마커**라 Y2(=middle) 재사용은 톤 위험이 아니라 **명세 위반**이다.
실제 비용은 **중학판 신규 2컷(성별 분기 시 4컷)**이다. 그래도 같은 컷 수로 회상 204칸을 사므로
컷당 회수는 이 배치보다 크다 — **다만 "무료"라는 전제로 우선순위를 정하면 안 된다.**

**⑤ `adolescence-reconcile`(Y5)은 보류 권장.** 게이트는 `year===5 && clash 발동 && parentIntimacy>=60`
(경계 실측: pi 60 → true / 59 → false / Y4 → false / clash 미발동 → false).
348런에서 **발동 6.9%**, 엔딩 회상 **0칸**.
⚠️ 다만 **6.9%는 하네스 하한이지 게임의 발동률이 아니다** — `sim-qa-playthrough.ts`에는 `talkToHome`
호출이 **0건**이라 부모 말걸기를 한 번도 하지 않고, `applyParentMeanReversion`이 부모 행동 없는 주마다
친밀도를 50으로 되돌린다. 게이트가 `pi>=60`이니 이 하네스는 구조적으로 게이트에 못 닿는다.
**실플레이 발동률은 미측정.** 보류 결론 자체는 "100% 발동 이벤트가 먼저"만으로도 서지만, 근거를
발동률에 두면 안 된다.

---

## 📁 파일 경로 — `middle/` 2장, 성별 분기 없음

| 근거 | 내용 |
|---|---|
| 학교급 | Y3 → **middle** (`getSchoolLevel`: `year<=1` elementary / `<=4` middle / else high). 발동 학년이 3으로 고정이라 학교급도 고정이다 |
| `common/` 불필요 | 부모 절정 6컷은 발동 연도를 state에 안 남겨서 `common/`이 강제였다. **이건 다르다** — 일반 이벤트라 `s.events`에 `year`가 남고 `archive.ts:261`이 `e.year ?? state.year`로 해석한다. 엔딩(`slot.year`)과 기록실이 같은 값을 본다 |
| choiceIndex | 선택지별로 장면이 정반대(문을 닫는다 ↔ 말을 한다)라 **`_c{ci}` 분기 필수**. 공용 1장으로는 못 덮는다 |
| 성별 | **두 컷 모두 주인공의 몸이 프레임에 없다.** 교복·체형 단서가 0이므로 `_m`/`_f` 분기가 불필요 |

```
public/images/events/middle/adolescence-clash_c0.png
public/images/events/middle/adolescence-clash_c2.png
```

폴백 cascade는 `{sl}/{id}_c{ci}_{g}` → `{sl}/{id}_{g}` → `{sl}/{id}_c{ci}` → `{sl}/{id}` → 같은 4개의 `common/`
순이다(`src/engine/eventCg.ts`). 위 2장은 3순위에서 잡힌다.

> **c1용 3번째 컷은 만들지 않는다.** c1은 슬롯이 없고, 결과 화면은 CG가 없으면 배경+주인공 폴백으로
> 정상 렌더된다. 중립 컷 `middle/adolescence-clash.png`을 두면 c1도 그림을 지게 되지만,
> "문을 닫지도 말을 하지도 않은" 상태를 그릴 방법이 마땅치 않고 c0·c2를 가리지도 않으니 이득이 얇다.

파일 추가 후 **`node scripts/generate-cg-manifest.mjs`**(= `npm run prebuild`) 필수.
브랜치를 옮기면 매니페스트(tracked)만 원복되고 PNG(untracked)는 남아 **2장이 조용히 안 뜨는** 상태가 된다 —
브랜치 이동 후에는 무조건 재생성할 것.

---

## 🎨 공통 스타일 (두 컷 공통 — 프롬프트마다 이 블록을 붙인다)

```
Art style: soft anime illustration, hand-painted look, gentle cel shading with painterly
  texture. Korean web-novel / visual-novel cover quality. No harsh outlines, no 3D render feel.
Composition: 16:9 landscape, cinematic framing, shallow depth of field.
Resolution: 1440x810.
Safe area: keep the subject inside the horizontal 10-90% band of the frame.
Era: contemporary Korean apartment interior, evening. Warm indoor light, no overhead glare.
Mood: a small domestic rupture that nobody raises their voice about.
```

**장면 SSOT**: `src/engine/events/parent-adolescence.ts` L12-50 (`description`·`message` 원문)
**외형 SSOT**: `docs/character-prompt-spec.md` §mother
**첨부 레퍼런스**: `game/public/images/characters/mother_middle_neutral.png`
— Y3 = 중학 시기라 `_middle` 초상이 **나이까지 정확**하다(부모 절정 배치는 고등 발동에 중등 레퍼런스를 쓴 케이스였다).

> ⚠️ **기존 컷과 겹친다 — 픽셀로 확인한 것(2026-08-29 보강).**
> - `common/climax_parent_resilience.png`은 **복도 · 정면 닫힌 방문 · 문 아래 빛 띠 · 무인**에 더해
>   **문 옆 벽의 액자**까지 이미 갖고 있다. 초판이 "①을 갈라낼 소품"으로 지정한 바로 그 물건이라,
>   액자는 차별화 레버가 되지 못한다. 실제로 갈라지는 축은 **빛의 색온도**(그쪽 청색 / 이쪽 주황)와
>   **전경 소품**(그쪽 바닥 밥상 / 이쪽 없음), 그리고 **복도 깊이 + 왼쪽 거실**이다.
> - `middle/family-strain_c0_m.png`은 **같은 폴더**에 있고 **닫힌 문 + 문 아래 따뜻한 빛 띠**까지 같다.
>   다만 주인공이 문에 기대앉아 화면을 차지하는 컷이라 무인 구도와는 인상이 갈린다.
>   초판은 이 이웃을 아예 비교 대상에 넣지 않았다 — **같은 학교급 폴더부터 훑을 것.**
> - `common/climax_parent_freedom.png`은 "저녁 거실 · 엄마 단독 · **정면 · 서 있음**"이라
>   c2(**앉음 · 반측면 · 시선 아래 · 머그**)와는 자세로 갈린다. 이건 유효한 차별화다.
>
> **후속 배치에 남기는 것**: 이 리포의 가정 실내 CG는 이미 "닫힌 문 + 문 아래 빛"에 몰려 있다.
> 다음 가정 컷은 이 모티프를 **쓰지 않는 쪽**으로 설계할 것.

---

## 🎬 컷 ① `middle/adolescence-clash_c0.png` — 방문을 쾅 닫는다

**원문**
> `description`: 별것도 아닌 일로 엄마랑 부딪혔다. / "너 요즘 왜 그래?" 그 한마디에 뭔가 욱했다. / …나도 내가 왜 이러는지 모르겠다.
> `message`: **방문이 쾅 닫혔다. 집이 조용해졌다.**
> 슬롯: `betrayal` / `regret` / importance 5 → 대부분 **후회 층**으로 간다(그림 없음). 노출면은 결과 화면·Y3 학년말·기록실.

**설계 의도**: 사람을 그리지 않는다. "쾅" 다음의 **정적**을 그린다.
소리의 여파는 흔들린 물건 하나로만 말한다 — 그게 이 게임의 절제와 맞는다.

```
[장면]
방금 방문이 닫혔다. 아무도 화면에 없다.

An empty hallway in a Korean apartment at night, seen head-on. At the end of the hallway,
a bedroom DOOR IS SHUT — flat, plain, no window, the handle still. A thin line of warm light
leaks from under the door; the hallway itself is dim.
On the wall beside the door hangs a small PICTURE FRAME, and it is TILTED very slightly
out of level — the only trace that the door was just slammed. Inside the frame is a plain
ABSTRACT PRINT on a cream mat: soft blocks of muted green and warm grey, the kind of
decorative art that has no subject at all. It is not a photograph and contains no people.
Beyond the hallway, a corner of the living room is visible and EMPTY — a couch arm, a lamp
still on, nobody sitting there.
Mood: the second after a loud noise, when the whole apartment has gone quiet.
Palette: dim warm hallway, the under-door light the brightest thing in frame.

[MUST NOT]
no people anywhere, no silhouettes, no shadows shaped like a person, no hands,
no child, no teenager, no student, no school uniform, no parent,
no readable text, no letters, no numbers, no faces or figures inside the picture frame,
no first-person legs, knees, thighs or feet in the foreground,
no motion blur streaks, no impact lines, no comic effects, no dust cloud,
no rectangular blur patches, no western interior
```

---

## 🎬 컷 ② `middle/adolescence-clash_c2.png` — "…몰라요. 저도 왜 이러는지 모르겠어요."

**원문**
> `message`: 엄마는 잠깐 말이 없다가, **"그래, 그럴 때지"** 했다.
> 슬롯: `growth` / `warm` / importance 5 → **엔딩 전에 밀려난다**(growth 두 자리는 imp 8이 점유).
> 노출면은 결과 화면(약 327×184 카드)·Y3 학년말·기록실·인물 앨범.

**설계 의도**: 받아들여진 순간인데 **웃지 않는다.** "그래, 그럴 때지"는 위로가 아니라 인정이다.
엄마는 방금 말을 끝낸 상태고, 표정은 온화함이 아니라 **누그러짐**이다.

```
[장면]
아이의 솔직한 말에, 엄마가 잠깐 말이 없다가 "그래, 그럴 때지" 하고 답한 직후.

Portrait of the MOTHER in a Korean home at night. She is SEATED at the dining table,
turned about 30 degrees away from the camera — a three-quarter view, NOT facing front.
Her hands are wrapped around a mug on the table. Her gaze is lowered toward the mug,
not at the camera and not at anyone.
Her LIPS ARE CLOSED and relaxed, corners level — she has just finished saying something
short and is letting it sit. Not smiling, not consoling, not disapproving. Her shoulders
have come down; the tension has left them.
Reference: the attached mother portrait — same face, same soft shoulder-length dark brown
hair, same warm-toned knit cardigan over a cream top.
Behind her the dining area is quiet and EMPTY: the second chair pushed back, a single lamp
lit, the rest of the room falling into shadow.
Mood: an answer given by lowering one's guard, not by comforting.
Palette: warm lamp light on one side of her face, soft falloff, no rim light, no hard shadow.

[MUST NOT]
no other people, no silhouettes or blurred figures behind her, no child, no teenager,
no student, no school uniform, no father,
no smile, no upturned mouth corners, no open mouth, no laughing, no tears, no crying,
no frown, no anger, no hand on anyone's shoulder, no hand raised, no open palm toward camera,
no standing pose, no straight-on front view,
no readable text, no letters, no numbers, no logos, no western interior
```

> **왜 이렇게 좁게 지시하는가.** 부모 절정 ⑥에서 *"손을 들어라"* 로 위치만 지시했더니
> 손바닥을 정면으로 펴 든 그림이 나와 **배웅/만류**로 읽혔다(허락 장면인데 의미가 반대).
> 손·자세는 **위치가 아니라 상태**로 잠근다. 그래서 여기선 `앉음`·`반측면`·`컵을 감싼 손`·
> `시선 아래`를 전부 못 박고, 서기·정면·손 들기를 금지문에 명시했다.

---

## ✅ 납품 검수 체크리스트

발주자가 아니라 **검수자가** 픽셀로 확인한다. 자체 신고 표는 신뢰하지 않는다.

| # | 항목 | 방법 |
|---|---|---|
| 1 | `1440x810` PNG, alpha 없음 | `sips -g pixelWidth -g pixelHeight -g hasAlpha` |
| 2 | **글자 0개** | 네이티브 해상도에서 액자 내부·벽·컵을 확대 확인 |
| 3 | **사람 0명 / 교복 0** | ①은 그림자 포함 전면 금지, ②는 엄마 단독 |
| 4 | ② 입꼬리가 올라가지 않았는가 | 네이티브 확대. 축소본으로 판정하면 틀린다 |
| 5 | ② 앉은 반측면인가 (정면·서기 아님) | 기존 `climax_parent_freedom`과 나란히 놓고 비교 |
| 6 | ① 액자가 "살짝" 기울었는가 | 과하게 기울면 만화적 연출이 된다 |
| 7 | 안전대역 | 핵심 소품(문·액자 / 얼굴·컵)이 가로 10~90% 안 |
| 8 | **축소 판정** | 368×200으로 리샘플해서(`object-fit:cover`+`object-position:center 30%`, 원본 기준 위 8px·아래 20px 크롭) 의미가 남는지 |
| 9 | 매니페스트 | `node scripts/generate-cg-manifest.mjs` → `grep -c adolescence` = 2 |
| 10 | 해석 확인 | `resolveEventCgRelPaths('adolescence-clash', 0, g, 3)`와 `(…, 2, g, 3)`이 각각 잡히는가 (양 성별) |
| 11 | CI | `npx vitest run` / `npm run verify:ci` |
| 12 | 릴리즈 용량 | sharp `quality:82, effort:5`로 webp 변환 후 실측 |

> **⑧을 빼면 안 된다.** 부모 절정 ⑥ 1차는 네이티브로는 완벽했는데 368px에서 표정이 통째로
> 사라져 재생성했다. 네이티브만 보고 통과시키면 같은 일이 반복된다.

---

## 📮 발주 절차

1. 이 문서를 **머지한 뒤** 발주한다. 또는 **프롬프트를 자기완결형으로 복사**해 보낸다 —
   생성자는 워킹트리의 파일을 읽으므로, 문서가 `main`에만 있고 워킹트리가 다른 브랜치면
   **구버전 스펙으로 그린다**(부모 절정 배치에서 실제로 발생).
2. 컷당 1회 발주, `mother_middle_neutral.png` 첨부(②만 필수, ①은 불필요).
3. 납품 후 위 체크리스트 12항목을 **검수자가 직접** 수행.
4. 매니페스트 재생성 → 6장 아니라 **2장**만 추가됐는지 diff로 확인(`+2 −0`).

---

## 📦 납품 기록 (2026-08-29)

2장 모두 1440x810 PNG, alpha 없음. 매니페스트 438 → 440.

| | 판정 | 확인한 것 |
|---|---|---|
| ① `_c0` | **수용** | 무인 ✓ · 글자 0 ✓ · 정면 닫힌 문 + 문 아래 주황 빛 ✓ · 액자 기울기 판독 가능 ✓ · 왼쪽에 빈 거실(소파·스탠드·야경) |
| ② `_c2` | **수용** | 엄마 단독 ✓ · **앉음 · 반측면 · 시선 아래 · 머그를 감싼 손** 전부 지시대로 ✓ · 빈 식탁 · 글자 0 ✓ · 레퍼런스(카디건+크림 상의) 정합 ✓ |

**액자는 운이 좋았다.** 발주 시점 프롬프트는 `The photograph inside is indistinct: soft shapes`였는데,
이건 이 리포가 금지한 **사후 흐림 지시**이고 같은 프롬프트의 `no rectangular blur patches`와 모순이었다
(검수 2인이 독립적으로 지적). 납품물은 얼굴도 사각 블러 슬랩도 없이 **부드러운 추상 인쇄물**로 나왔지만,
**지시가 옳아서가 아니라 굴림이 좋아서다.** 위 §컷 ① 프롬프트는 이미 긍정 지시
(`a plain ABSTRACT PRINT on a cream mat … not a photograph`)로 교체해 뒀다 — 재발주 시 그쪽을 쓸 것.

**② 입꼬리**: 네이티브에서 오른쪽 입꼬리가 아주 미세하게 올라가 있다. `no smile` 지시의 위반으로 보기엔
약하고 "누그러짐"의 범위로 읽힌다 — **수용하되 인게임 판단이 우선**이다.

**검수 상태**: 이 문서의 초판은 sub-agent(Opus 5)와 cursor(`composer-2.5`) **2인 검수**를 받았다.
codex(`gpt-5.5`)는 371k 토큰을 읽고 리뷰 직전 사용량 한도로 실패해 **3자를 채우지 못했다.**
두 검수자가 공통으로 잡은 것은 ③ "전체화면" 오류와 ① 액자 지시, 그리고 c0 회상 칸 수 표기였다.
`climax_parent_resilience`의 벽 액자와 `middle/family-strain_c0`은 **sub-agent만** 잡았고
(cursor는 중복을 `[낮음]`으로 판정), `talkToHome` 0건 근거도 sub-agent만 제시했다.
반대로 sub-agent가 낸 "슬롯 생존 96.6%"는 **오류**다 — 재집계 결과 348/348(100%)이고
"c0을 고른 런 336"과 혼동한 것이다.
