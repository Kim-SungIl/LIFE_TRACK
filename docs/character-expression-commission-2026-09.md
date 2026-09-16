# 주인공 표정 세트 발주 명세 (2026-09)

> **이 문서는 자기완결형이다.** 다른 문서를 참조하지 말고 이 안의 내용만으로 생성할 것.
> (`character-prompt-spec.md`를 읽게 하면 워킹트리 브랜치에 따라 구버전을 보는 사고가 두 번 났다.)

---

## 0. 발주 전 확인 (생성자에게 전달할 것)

```bash
cd ~/Projects/LIFE_TRACK && git checkout main && git pull
ls docs/character-expression-commission-2026-09.md    # 이 파일이 디스크에 있어야 한다
ls game/public/images/characters/player_*_neutral.png # 레퍼런스 6장이 있어야 한다
```

이 리포는 세션이 병렬로 돌아 브랜치가 수시로 갈린다. **"머지했다"가 아니라 "워킹트리에 있다"가 조건이다.**

---

## 1. 무엇을 왜 — 실측 근거

주인공 초상은 멘탈 상태에 따라 표정을 고른다. 그런데 **그 표정의 실물이 0장**이라
지금은 어떤 상태에서도 무표정만 보인다. 로직은 이미 있고 그림만 없다.

멘탈 → 표정 매핑(제품 코드, `mentalToExpression`):

```
번아웃 상태     → burnout
피로 상태       → tired
멘탈 80 이상    → happy
멘탈 40~79      → neutral   ← 유일하게 실물 보유
멘탈 25~39      → sad
멘탈 25 미만    → tired
```

**노출 빈도 실측** — 재현: `cd game && npx tsx scripts/sim/sim-expression-exposure.ts 12`

루틴 5종 × 12시드 = 20,311주. 루틴 표는 `scripts/lib/sim-routines.ts`(시뮬 정본)를 그대로 쓴다.

| 루틴 | 주차 | neutral | happy | tired | burnout | sad |
|---|---:|---:|---:|---:|---:|---:|
| 유료(학원+헬스) | 4,069 | 21.0% | 31.2% | **47.7%** | 0.1% | 0.0% |
| 혼합(학원+독학) | 4,065 | 1.8% | **98.2%** | 0.0% | 0.0% | 0.0% |
| 무료(독학+운동) | 4,058 | 49.9% | 45.8% | 4.3% | 0.0% | 0.0% |
| 지출형 | 4,055 | 64.4% | 19.7% | 15.9% | 0.0% | 0.0% |
| 지출형+부유한 부모 | 4,064 | 15.8% | 45.5% | 38.7% | 0.0% | 0.0% |
| **합계** | **20,311** | **30.6%** | **48.1%** | **21.3%** | **0.0%** | **0.0%** |

**이 표를 평균 한 줄로 요약하지 말 것.** happy가 19.7%~98.2%로 흩어진다 —
평균은 어느 플레이어의 경험도 아니다. 판단은 **커버리지**로 한다:

| 표정 | 합계 | 노출 5%↑ 루틴 | 노출 5%↑ (루틴×학교급) |
|---|---:|---:|---:|
| happy | 48.1% | **5/5** | **13/15** |
| tired | 21.3% | **3/5** | **10/15** |
| burnout | 0.0% | 0/5 | 0/15 |
| sad | 0.0% | 0/5 | 0/15 |

학교급별로 보면 tired가 **초등에서도 크게 뜬다** — 유료 루틴 초등 52.8%(306/580주),
지출형+부유 초등 39.1%, 지출형 초등 12.4%. 초등을 빼면 안 된다.

> **이 표는 한 번 틀렸다(2026-09-16).** 처음 측정한 하네스가 루틴을 직접 지어내면서
> 존재하지 않는 활동 id(`online-lecture`, 실제는 `internet-lecture`)를 넣었다. 엔진은 못 찾은
> 슬롯을 조용히 스킵하므로 주당 피로가 14 → 7로 반토막 난 채 돌았고, 주말·방학 선택도 비어 있었다.
> 그 값(happy 56.3% / tired 10.7% / 초등 tired 0.0% / burnout 0.5%)으로 burnout 4장을 발주하고
> 초등 tired 2장을 뺄 뻔했다. **활동 id는 plain string이라 `tsc -b`도 `tsx`도 오타를 못 잡는다** —
> 그래서 `assertRoutineIds()`가 실행 시점에 throw하도록 박아 뒀다.

## 2. 발주 범위

**주인공(player_m / player_f) 전용이다. NPC는 넣지 않는다.**
멘탈 구동 초상은 제품에 **딱 두 곳**(주간 화면 HUD `HudPanel.tsx:76`, 주간 결산
`WeeklyResultScreen.tsx:120`)뿐이고 둘 다 주인공이다. 나머지 12곳은 표정을 고정해 넘긴다 —
`neutral` 11곳, `happy` 1곳(`HomeModal.tsx:34` 부모 얼굴 크로스페이드, 실물 2장이 이미 있다).
NPC 표정을 뽑으면 **아무도 요청하지 않는 자산**이 된다.

### 배치

| 배치 | 내용 | 장수 | 근거 |
|---|---|---:|---|
| **1** | `happy` × 2성별 × 3학교급 | **6** | 5/5 루틴 · 13/15 학교급에서 노출 |
| **2** | `tired` × 2성별 × 3학교급 | **6** | 3/5 루틴 · 10/15 학교급. 유료 루틴에서는 happy를 앞선다(47.7% vs 31.2%) |

**총 12장.** 두 배치는 우선순위 차이일 뿐 둘 다 필수다 — happy는 넓게, tired는 깊게 뜬다.
배치 1 납품 → 인게임 확인 → 배치 2 발주 순서를 권한다.

**`sad`는 발주하지 않는다.** 5개 루틴 × 3학교급 = 15칸 **전부 0.0%**다. 멘탈 25~39 구간이
사실상 점유되지 않는다. 필요하면 그림이 아니라 **매핑을 바꾸는 쪽**이 맞다(그 구간을
`tired`로 접거나 구간을 넓히거나).

**`burnout`도 발주하지 않는다.** 15칸 전부 0.0%다(유료 루틴 초등에서만 0.5%).
번아웃은 진입 조건이 좁고 쿨다운이 걸려 있어 상태로는 거의 머물지 않는다.
연출상 필요하다고 판단되면 노출과 무관한 별도 결정으로 다루고, 이 표를 근거로 쓰지 말 것.

### 파일명 (정확히 이대로)

```
배치 1  player_m_elementary_happy.png    player_f_elementary_happy.png
        player_m_middle_happy.png        player_f_middle_happy.png
        player_m_high_happy.png          player_f_high_happy.png

배치 2  player_m_elementary_tired.png    player_f_elementary_tired.png
        player_m_middle_tired.png        player_f_middle_tired.png
        player_m_high_tired.png          player_f_high_tired.png
```

---

## 3. 이미지 규칙 (전 컷 공통)

```
- 구도: 가슴 위(chest-up) — 기존 neutral과 동일 프레이밍
- 비율: 2:3, **1024x1200px 이상** (기존 자산 전부 1024x1536이다 — 같은 크기를 권장)
- 배경: soft pastel pink-blue gradient — **최종 배경으로 유지한다. 배경 제거(누끼) 금지.**
- 출력: PNG
```

> ⚠ **세로가 잘린다.** 게임은 이 2:3 그림을 1:1.25 박스에 `cover`로 넣으므로
> **상하 8.3%씩(1536px 기준 128px씩) 화면에 안 나온다.** 정수리와 가슴 아래를
> 여유 있게 잡을 것 — 자세한 안전영역은 §8.

> **배경 제거 금지가 중요하다.** 전신(`_fullbody`)만 투명 누끼이고 초상(`_neutral`/표정)은
> 파스텔 배경을 남긴다. 2026-05-20에 초상에 일괄 알파 제거를 적용했다가 흰옷 캐릭터에서
> 흰 테두리 잔여물이 생긴 사고가 있었다.

---

## 4. 얼굴 일관성 (CRITICAL)

**같은 파일의 표정만 바꾼 판본이다. 새로 그리는 게 아니다.**

각 컷의 **레퍼런스로 같은 학교급의 neutral을 첨부할 것**:

```
player_m_middle_happy.png  ← 레퍼런스: game/public/images/characters/player_m_middle_neutral.png
player_f_high_tired.png    ← 레퍼런스: game/public/images/characters/player_f_high_neutral.png
   (이하 동일 규칙)
```

프롬프트에 반드시 넣을 문장:

```
Maintain EXACT same face proportions, eye shape, jawline, art style, skin tone, hairstyle,
outfit, framing, and pastel background as in the attached reference image.
Change ONLY the facial expression and the minimal posture cues listed below.
```

**금지(negative prompt):**

```
different face shape, different eye shape, different hairstyle, different outfit,
different background color, photorealistic style, different art style,
exaggerated cartoon emotion, tears, sweat drops, anime emotion symbols,
speech bubbles, text, watermark, white background, transparent background
```

---

## 5. 표정 지시 — **감정어가 아니라 구조로 쓴다**

이 리포의 전례: *"입을 열었다 다시 다문 직후"* 같은 감정 서술을 두 번 발주해 두 번 다
**옅은 미소**가 나왔다. 표정은 감정어로 지시하면 생성자의 관용구로 수렴한다.
그래서 아래는 **눈·눈썹·입·고개·어깨**를 각각 잠근다. 이 다섯 줄을 그대로 넣을 것.

### happy

```
- Eyes: narrowed into gentle upward crescents, lower eyelids raised (a real smile reaches the eyes)
- Eyebrows: relaxed, slightly raised at the outer ends
- Mouth: closed-lip smile with clearly lifted corners, OR a small open smile showing upper teeth only
- Head: tilted about 5 degrees toward the camera, chin slightly up
- Shoulders: level and relaxed, upper body leaning a few degrees toward the viewer
```

기준선: neutral은 "옅은 미소"다. **happy는 그보다 확실히 더 웃어야 한다** — 눈이 같이 웃는지가 판정 기준이다.
neutral 옆에 나란히 놓고 구별이 안 되면 실패다.

### tired

```
- Eyes: upper eyelids lowered to cover the top third of the iris, gaze slightly downward
- Under-eye: faint darker shading directly under both eyes (subtle, not makeup, not bruising)
- Eyebrows: inner ends drawn slightly down and together, outer ends flat
- Mouth: closed, corners flat and slightly heavy — no smile, no frown
- Head: chin lowered about 5 degrees; shoulders dropped slightly forward
```

**눈물·땀방울·만화식 감정 기호 금지.** 지친 상태는 "울고 있다"가 아니라 "눈꺼풀이 무겁다"이다.

### burnout — **이번 발주 범위 아님(참고용)**

> 노출 0.0%라 발주하지 않는다(§2). 지시문은 나중에 필요해질 때를 위해 남겨 둔다.
> **이번 납품에 포함하지 말 것.**

```
- Eyes: half-closed, unfocused, gaze past the camera rather than at it
- Under-eye: darker shading than the tired version, extending slightly onto the cheekbone
- Eyebrows: flat and slack — no tension, not furrowed
- Mouth: closed, lips slightly parted at the center, corners neutral and slack
- Head: chin lowered about 10 degrees, head tilted a few degrees off-axis
- Shoulders: noticeably dropped, posture collapsed inward
- Skin/tone: very slightly desaturated compared to the reference (do NOT change the background)
```

**tired와 구별되어야 한다.** tired = 힘들지만 버티는 중, burnout = 더 이상 안 버티는 중.
둘을 나란히 놓고 구별이 안 되면 실패다. 핵심 차이는 **초점**(tired는 카메라를 보고, burnout은 안 본다)이다.

---

## 6. 학교급별 의상 (레퍼런스와 동일해야 하지만, 대조용으로 적어 둔다)

```
초등 (player_*_elementary)
  남: 밝은 회색 또는 베이지 집업 후디 + 흰/연회색 티셔츠 (네이비·블루 금지)
  여: 연분홍 카디건 + 흰 티셔츠
  * 교복 없음. 얼굴이 더 둥글고 비율이 어림.

중등 (player_*_middle)
  남: 네이비 블레이저 + 흰 셔츠 + **넥타이 없음** + 어두운 바지
  여: 네이비 블레이저 + 흰 셔츠 + **빨간 리본** + 체크 스커트

고등 (player_*_high)
  중등과 같은 교복. 단:
  남: **네이비 넥타이** 추가 + 왼쪽 가슴에 작은 금색 교표 자수
  여: 중등과 동일(**빨간 리본 유지** — 고등이라고 넥타이로 바꾸지 말 것)
  * 비율이 더 성숙하고 키가 약간 큼.
```

---

## 7. 납품 후 절차 (개발 쪽, 발주자 참고용)

1. PNG를 `game/public/images/characters/`에 넣는다.
2. **매니페스트를 재생성해 같은 커밋에 넣는다:**
   ```bash
   cd game && node scripts/generate-cg-manifest.mjs
   git add public/images/characters src/character-manifest.generated.ts
   ```
   `src/character-manifest.generated.ts`는 생성 파일이지만 **커밋 대상**이다.
   PNG만 커밋하면 브랜치를 옮길 때마다 "디스크엔 있는데 매니페스트엔 없음"이 되고
   `src/engine/__tests__/characterManifest.test.ts`가 빨강이 된다.
3. **코드 수정은 필요 없다.** 매니페스트에 파일이 들어오는 순간 초상이 자동으로 그 표정을 쓴다.
4. `npm test`로 확인. `manifest = 디스크` 단언이 재생성 누락을 잡는다.

---

## 8. 검수 기준

납품 컷을 **레퍼런스 neutral과 나란히 놓고** 본다.

| 항목 | 기준 |
|---|---|
| 얼굴 동일성 | 눈 모양·턱선·헤어·화풍이 레퍼런스와 같은가 |
| 의상·배경 | 의상 동일, 파스텔 배경 유지(누끼 아님) |
| 표정 구별 | neutral과 확실히 다른가 (happy는 눈이 같이 웃는가 / tired는 눈꺼풀이 무거운가) |
| 금지물 | 눈물·땀방울·감정 기호·글자·워터마크 없음 |
| **인게임 확인** | **52×65px로 줄이고 세로를 잘라낸 뒤에도 표정이 읽히는가** ← 최종 판정은 여기서 |

> **마지막 항목이 실질 기준이다.** 네이티브 크기에서만 보면 미세한 표정이 전부 통과하지만
> 인게임에선 소멸한다. 눈꺼풀 높이와 입꼬리처럼 **큰 형태**로 표현돼야 살아남는다.
>
> **실제 렌더 박스는 52×65px이고 원형이 아니다** — `Portrait.tsx`가 `width:52` ·
> `aspect-ratio:1/1.25` · `border-radius:7.8px`로 그린다(라운드 사각형).
>
> **그리고 세로가 잘린다.** 납품 비율 2:3(0.667)이 1:1.25(0.8) 박스에 `object-fit:cover`로
> 들어가므로 **세로 16.7%가 상하 균등으로(각 8.3%) 잘려 나간다.** 1024×1536을 넣으면
> 위아래 128px씩이 화면에 안 나온다.
>
> ```
> 안전영역 — 이 안에 들어와야 인게임에서 보인다
>   세로: 위에서 8.3% ~ 아래에서 8.3% 사이 (1536px 기준 128 ~ 1408)
>   가로: 전체 사용
>   → 정수리와 가슴 아래는 잘린다고 보고 구도를 잡을 것. 눈·눈썹·입은 중앙부에 둔다.
> ```
>
> 판정 절차: **① 1024×1536 원본에서 상하 128px씩 잘라내고 ② 52×65로 리샘플한 뒤 ③ 본다.**
