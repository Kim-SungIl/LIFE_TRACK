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
**`Art style` / `Composition` / `Resolution` / `Safe area` 네 줄만** 가져온다.

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
| c0 `방문을 쾅 닫는다` | `betrayal` / `regret` / imp **5** | **후회 층**으로 간다 — 후회 층은 **의도적으로 그림을 렌더하지 않는다** | 슬롯 생존 100% · 후회 300칸(**86.2%** 판) · 회상 24칸(6.9%) |
| c1 `말없이 방에 들어간다` | 없음 | 슬롯 자체가 없다 | — |
| c2 `"…몰라요" 솔직히 말한다` | `growth` / `warm` / imp **5** | **엔딩 전에 밀려난다** | growth 자리는 imp **8**이 점유 |

`c2`가 사라지는 기제는 명확하다. 슬롯 상한이 **카테고리당 2개**이고 교체 조건이
`newSlot.importance > weakest.importance`(**동률이면 교체 안 됨**, `memorySystem.ts:144-159`)인데,
엔딩 시점 `growth` 두 자리는 실측에서 **`yuna-smile`(312) · `graduation-prep-high`(298)** 이
importance **8**로 채우고 있다. imp 5인 c2 슬롯은 Y3에 생성되지만 그 뒤 밀려난다
(672/684 슬롯이 imp 8, imp 5로 살아남은 건 12개뿐).

**③ 진짜 노출면은 엔딩이 아니라 "선택 직후"다.** 이게 발주 근거다.
`EventResultScreen`은 CG가 잡히면 **전체화면**으로 띄운다(`EventResultScreen.tsx:69-79`,
없으면 배경+주인공 폴백). `adolescence-clash`는 매 판 100% 발동하므로
**모든 플레이어가 Y3에 이 그림을 전체화면으로 한 번 본다.** 368×200 갤러리 슬라이드와는
노출 체급이 다르다. 여기에 **Y3 학년말 회고**(`YearEndScreen`, 별도 rest-only 측정에서 Y3 마감 시점
슬롯 생존 16/24판)와 **기록실**이 더해진다.

즉 이 2컷의 값은 *"엠블럼을 CG로 바꾼다"*가 아니라 *"매 판 반드시 지나가는 장면에 그림을 준다"*다.
엔딩 회상 커버리지를 목표로 삼으면 이 배치는 **오답**이다.

**④ 더 싼 후보가 실재한다.** CG 없는 회상 칸 252칸의 구성:

```
jihun-promise              204칸 (81.0%)   ← CG가 이미 있다. high/에만 있어서 Y2(=middle) 발동에 미매칭
adolescence-clash           24칸 ( 9.5%)
career-conflict-info-y5     12칸 ( 4.8%)   ← importance 5 · CG 0장
career-conflict-info-y6     12칸 ( 4.8%)   ← importance 5 · CG 0장
```

`jihun-promise`는 **신규 아트 0장**으로 대부분이 해소된다. 다만 자산이 고등 교복 그림이라
중학 장면에 그대로 쓰면 톤이 어긋난다 — "파일 이동만" 이 아니라 **그림 확인이 선행**돼야 한다.
**이 배치보다 먼저 볼 것.**

**⑤ `adolescence-reconcile`(Y5)은 보류 권장.** 게이트는 `year===5 && clash 발동 && parentIntimacy>=60`
(경계 실측: pi 60 → true / 59 → false / Y4 → false / clash 미발동 → false).
348런에서 **발동 6.9%**, 엔딩 회상 **0칸**. 노출이 이 배치의 1/14이라 같이 발주할 근거가 약하다.

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
브랜치를 옮기면 매니페스트(tracked)만 원복되고 PNG(untracked)는 남아 **6장이 조용히 안 뜨는** 상태가 된다 —
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

> ⚠️ **기존 컷과 겹치지 않게.** `common/climax_parent_freedom.png`이 이미
> "저녁 거실 · 엄마 단독 · 정면 · 서 있음"이다. c2는 **앉은 자세 · 반측면 · 시선 아래**로 확실히 갈라야 한다.
> `common/climax_parent_emotional.png`(빈 책상+문틈 빛)과 `common/climax_parent_resilience.png`(식은 밥상+문)도
> "문/빛" 모티프를 이미 쓰고 있다 — c0은 **가족사진 액자**를 중심 소품으로 삼아 갈라낸다.

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
On the wall beside the door hangs a small FAMILY PHOTO FRAME, and it is TILTED very slightly
out of level — the only trace that the door was just slammed. The photograph inside is
indistinct: soft shapes, no recognizable faces, no text.
Beyond the hallway, a corner of the living room is visible and EMPTY — a couch arm, a lamp
still on, nobody sitting there.
Mood: the second after a loud noise, when the whole apartment has gone quiet.
Palette: dim warm hallway, the under-door light the brightest thing in frame.

[MUST NOT]
no people anywhere, no silhouettes, no shadows shaped like a person, no hands,
no child, no teenager, no student, no school uniform, no parent,
no readable text, no letters, no numbers, no recognizable faces inside the photo frame,
no motion blur streaks, no impact lines, no comic effects, no dust cloud,
no rectangular blur patches, no western interior
```

---

## 🎬 컷 ② `middle/adolescence-clash_c2.png` — "…몰라요. 저도 왜 이러는지 모르겠어요."

**원문**
> `message`: 엄마는 잠깐 말이 없다가, **"그래, 그럴 때지"** 했다.
> 슬롯: `growth` / `warm` / importance 5 → **엔딩 전에 밀려난다**(growth 두 자리는 imp 8이 점유).
> 노출면은 결과 화면(전체화면)·Y3 학년말·기록실.

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
