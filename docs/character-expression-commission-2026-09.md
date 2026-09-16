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

**노출 빈도 실측** (엔진 시뮬 12시드 × 루틴 3종 = 12,190주):

| 표정 | 전체 | 초등 | 중등 | 고등 | 주차수 |
|---|---:|---:|---:|---:|---:|
| happy | **56.3%** | 48.0% | 61.8% | 53.7% | 6,869 |
| neutral (보유) | 32.3% | 52.0% | 27.4% | 30.7% | 3,940 |
| tired | **10.7%** | **0.0%** | 10.1% | 14.9% | 1,310 |
| burnout | 0.5% | 0.0% | 0.6% | 0.5% | 60 |
| sad | **0.1%** | 0.0% | 0.0% | 0.2% | 11 |

**이 표가 배치 순서를 정한다.** 감으로 "happy/sad/tired 3종"을 뽑으면 sad(0.1%)에
happy(56.3%)와 같은 예산을 쓰게 된다.

> 시뮬 한계: 남주 기준, 상점·주말 선택을 최소로 돌린 값이다. 실플레이는 멘탈이 더 낮을 수 있으니
> tired·burnout 비중은 **하한**으로 볼 것. 순서는 뒤집히지 않는다.

---

## 2. 발주 범위

**주인공(player_m / player_f) 전용이다. NPC는 넣지 않는다.**
멘탈 구동 초상은 제품에 **딱 두 곳**(주간 화면 HUD, 주간 결산)뿐이고 둘 다 주인공이다.
다른 초상 13곳은 전부 `neutral` 하드코딩이라, NPC 표정을 뽑으면 **아무도 요청하지 않는 자산**이 된다.

### 배치

| 배치 | 내용 | 장수 | 회수 |
|---|---|---:|---|
| **1** | `happy` × 2성별 × 3학교급 | **6** | 전체 주차의 56.3% |
| **2** | `tired` × 2성별 × 중등·고등 | **4** | 10.7% (초등은 0%라 제외) |
| **3** | `burnout` × 2성별 × 중등·고등 | **4** | 0.5% — 드물지만 위기 장면의 정점 |

**`sad`는 발주하지 않는다.** 12,190주 중 11주(0.1%)다. 멘탈 25~39 구간 자체가 거의 점유되지 않는다.
필요하면 그림이 아니라 **매핑을 바꾸는 쪽**이 맞다(그 구간을 `tired`로 접거나 구간을 넓히거나).

배치 1만으로도 주간 루프의 절반 이상이 바뀐다. **배치 1 납품 → 인게임 확인 → 배치 2 발주** 순서를 권한다.

### 파일명 (정확히 이대로)

```
배치 1  player_m_elementary_happy.png    player_f_elementary_happy.png
        player_m_middle_happy.png        player_f_middle_happy.png
        player_m_high_happy.png          player_f_high_happy.png

배치 2  player_m_middle_tired.png        player_f_middle_tired.png
        player_m_high_tired.png          player_f_high_tired.png

배치 3  player_m_middle_burnout.png      player_f_middle_burnout.png
        player_m_high_burnout.png        player_f_high_burnout.png
```

---

## 3. 이미지 규칙 (전 컷 공통)

```
- 구도: 가슴 위(chest-up) — 기존 neutral과 동일 프레이밍
- 비율: 2:3, 권장 800x1200px 이상
- 배경: soft pastel pink-blue gradient — **최종 배경으로 유지한다. 배경 제거(누끼) 금지.**
- 출력: PNG
```

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

### burnout

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
| 표정 구별 | neutral과 확실히 다른가 / tired와 burnout이 서로 구별되는가 |
| 금지물 | 눈물·땀방울·감정 기호·글자·워터마크 없음 |
| **인게임 확인** | **52px 원형 크기에서도 표정이 읽히는가** ← 최종 판정은 여기서 |

> **마지막 항목이 실질 기준이다.** 이 초상이 실제로 뜨는 곳은 HUD의 **52px**다.
> 네이티브 크기에서만 보면 미세한 표정이 전부 통과하지만 인게임에선 소멸한다.
> 판정은 **52px로 리샘플한 뒤** 할 것. 눈꺼풀 높이와 입꼬리처럼 **큰 형태**로 표현돼야 살아남는다.
