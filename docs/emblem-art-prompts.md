# 기억 카테고리 엠블럼 아트 세트 — 생성 가이드 (P1b)

학년말 회고(YearEndScreen)에서 **CG도 NPC 초상도 없는 기억**의 최후 폴백으로 쓰이는 카테고리 엠블럼.
현재는 이모지 플레이스홀더(🔥💔🤝☔💡🌱💸✉️🕊️). 이 문서는 그걸 대체할 **전용 일러스트 8+1종**을
GPT(이미지 생성)로 병렬 제작하기 위한 프롬프트/스펙이다.

> **SSOT 주의:** 카테고리 키·색·라벨의 정답은 `game/src/components/screens/YearEndScreen.tsx`의 `CATEGORY` 맵이다.
> 이 문서의 색/라벨은 그 스냅샷(2026-06)이며, 코드와 어긋나면 코드가 우선.

---

## 0. 어디에/어떻게 쓰이나 (제약의 근거)

코드상 엠블럼은 `MemoryThumb`에서 이렇게 렌더된다:

- **박스 비율 4:5 (세로형)**, `borderRadius = 변 길이의 15%` (살짝 둥근 모서리)
- **두 가지 크기**로 동시 사용:
  - 썸네일 카드 = **48px** (작게, 한눈에 카테고리 식별돼야 함)
  - CG 없는 해의 hero = **104px** (크게, 화면 focal — 빈약해 보이면 안 됨)
- 코드가 박스 위에 **카테고리 색 링**(1.5px)과 옅은 배경 틴트를 그린다 → 아트에 테두리·외곽선 불필요
- **공통 필터가 코드에서 입혀진다:** `saturate(0.82) sepia(0.12) brightness(0.98)`
  = "바랜 일기장" 톤. 모든 기억 이미지(CG·초상·엠블럼)를 한 톤으로 묶기 위함.
  → 이 페이드는 **코드가** 입힌다. 원본은 게임 기본 화풍(아래)대로 **clean anime + slightly muted tones**로 그리고,
    **수채화·종이 텍스처·미리 빛바램을 넣지 마라**(이중으로 칙칙해짐). 필터가 알아서 일기장 톤을 만든다.

### 핵심 디자인 결정
- **화풍은 게임 SSOT를 그대로 따른다 — anime-style illustration + clean thin uniform lineart + soft cel-shading
  (2~3 layers) + semi-realistic(not chibi) + slightly muted/soft pastel tones + soft even lighting(방향광 X).**
  (`character-prompt-spec.md` §1 Global Style Anchor / `event-cg-prompts-y1.md` 공통 스타일과 동일해야
  같은 회고 화면의 CG·초상 옆에서 안 튄다. **여기서 화풍이 어긋나면 그 두 문서가 우선.**)
- **풀-블리드 4:5 일러스트**로 제작(투명 아이콘 ❌). 가운데 덩그러니 아이콘 하나면 104px hero에서 허전하다.
- **단일 상징 모티프 + 부드러운 톤 배경**. 48px로 줄여도 뭉개지지 않게 모티프는 크게(프레임 높이의 55~65%).
- **얼굴·글자·숫자·로고 금지.** 사람 형상은 실루엣/손 정도까지만(특정 캐릭터로 읽히면 안 됨).

---

## 1. 공통 스타일 프롬프트 (마스터 — 모든 엠블럼에 prepend)

```
A single symbolic emblem illustration for a memory category in a calm Korean
coming-of-age life-sim game's year-end reflection screen.

Style: anime-style illustration matching a Korean visual-novel game — clean thin
uniform lineart, soft cel-shading (2~3 smooth layers), semi-realistic anime
(not chibi, not overly stylized), slightly muted natural tones, soft even lighting
with no strong directional shadows. (Must match the game's CG / character art.)
Composition: ONE centered focal motif filling ~60% of frame height, calm negative
space around it, full-bleed soft pastel background wash in the signature color.
Framing: vertical 4:5 portrait, motif readable even when shrunk to a 48px thumbnail.
Palette: built around {SIGNATURE_COLOR} ({COLOR_NAME}), slightly muted natural tones.
Absolutely NO text, NO numbers, NO letters, NO logos, NO faces, NO watermark.
Do NOT add watercolor / colored-pencil / paper texture, and do NOT pre-fade the
image — the faded "old diary" look is applied in-engine by a sepia filter; keep the
source clean anime so it sits cohesively next to the anime CGs and portraits.
Mood keyword: {MOOD}. Motif: {MOTIF}.
```

`{SIGNATURE_COLOR}` / `{COLOR_NAME}` / `{MOOD}` / `{MOTIF}` 는 아래 표에서 채운다.

---

## 2. 카테고리별 스펙 (8 + 폴백 1)

| 키 | 라벨 | 색(signature) | mood | 모티프(권장 / 대안) |
|---|---|---|---|---|
| `courage` | 용기 | `#e0a45e` 따뜻한 호박색 | brave, warm-resolve | 흔들림 없이 타는 **작은 촛불 하나** / 바람 속에서도 꺾이지 않는 종이배 |
| `betrayal` | 상처 | `#d96458` 바랜 주홍 | quiet hurt | **금이 간 유리구슬** / 끊어진 채 늘어진 붉은 실 한 가닥 |
| `reconciliation` | 화해 | `#6fa890` 청록 | mending, gentle | **킨츠기(금으로 이어 붙인) 도자기 조각** / 거의 맞닿은 두 손 |
| `failure` | 실패 | `#7c89a8` 회청 | melancholy, soft-rain | **빗방울 맺힌 작은 창** / 바닥에 접힌 우산 |
| `discovery` | 깨달음 | `#e0b354` 황금빛 | warm insight | **켜진 작은 등불(랜턴)** / 빛이 새어드는 반쯤 열린 창 |
| `growth` | 성장 | `#8fb573` 새잎 초록 | hopeful, tender | **화분에서 막 돋은 새싹** / 어린 묘목 |
| `bypass` | 우회 | `#a89888` 흙빛 그레이 | wry, distant | **갈림길에서 빙 둘러가는 오솔길** / 손바닥 위 동전 하나 |
| `unspoken_debt` | 말없는 빚 | `#caa17a` 모래빛 | tender regret | **부치지 못한 봉인된 편지** / 책갈피처럼 끼워둔 접힌 쪽지 |
| `memory`(폴백) | 기억 | `#a89888` 흙빛 그레이 | nostalgic, quiet | **하늘로 접어 날린 종이새** / 빛바랜 폴라로이드 한 장 |

> 색 메모: `reconciliation`은 `growth`(초록)와 안 겹치게 **청록**으로 분리돼 있음. `bypass`·`memory`는 둘 다 흙빛 그레이라
> 모티프로 구분(둘러가는 길 vs 종이새).

### 채워 넣은 예시 — `growth`
```
A single symbolic emblem illustration for a memory category in a calm Korean
coming-of-age life-sim game's year-end reflection screen.
Style: anime-style illustration matching a Korean visual-novel game — clean thin
uniform lineart, soft cel-shading (2~3 smooth layers), semi-realistic anime
(not chibi, not overly stylized), slightly muted natural tones, soft even lighting
with no strong directional shadows. (Must match the game's CG / character art.)
Composition: ONE centered focal motif filling ~60% of frame height, calm negative
space around it, full-bleed soft pastel background wash in the signature color.
Framing: vertical 4:5 portrait, motif readable even when shrunk to a 48px thumbnail.
Palette: built around #8fb573 (tender new-leaf green), slightly muted natural tones.
Absolutely NO text, NO numbers, NO letters, NO logos, NO faces, NO watermark.
Do NOT add watercolor / colored-pencil / paper texture, and do NOT pre-fade the
image — the faded "old diary" look is applied in-engine by a sepia filter; keep the
source clean anime so it sits cohesively next to the anime CGs and portraits.
Mood keyword: hopeful, tender. Motif: a small sprout just rising from a clay pot.
```

---

## 3. 기술 스펙 (출력/파일)

- **비율:** 4:5 세로. **권장 해상도 480×600px** (104px hero의 ~2x 레티나 + 여유). 최소 320×400.
- **포맷:** PNG. 풀-블리드(투명 X) — 박스를 꽉 채운다.
- **세트 일관성(가장 중요):** 9종을 **한 세션/동일 시드 계열**로 뽑아 라인·텍스처·라이팅·여백·채도 통일.
  한 장씩 따로 뽑으면 톤이 튄다 → 인게임에서 "한 시스템"으로 안 묶임.
- **파일명 = 카테고리 키** (그대로, 소문자):
  ```
  courage.png  betrayal.png  reconciliation.png  failure.png
  discovery.png  growth.png  bypass.png  unspoken_debt.png  memory.png
  ```
- **배치 위치:** `game/public/images/emblems/`

---

## 4. 합격 기준 (QA 체크리스트)

- [ ] 9종을 **나란히 늘어놨을 때** 한 세트로 보인다(톤·텍스처·여백 일관)
- [ ] **48px로 축소**해도 모티프가 식별된다(뭉개지지 않음)
- [ ] 글자·숫자·얼굴·로고 없음
- [ ] 각 색이 signature hue 계열(서로 안 헷갈림, 특히 화해 청록 vs 성장 초록 / 우회 vs 기억)
- [ ] 인게임 필터(`saturate .82 sepia .12 brightness .98`) 적용 후에도 칙칙하지 않음
      → 미리 [Photopea/피그마]에서 같은 필터 걸어 미리보기 권장

---

## 5. 연동 (아트 도착 후, 코드 작업 — 별도 PR)

`YearEndScreen.tsx`의 `CATEGORY` 맵에 `art` 경로를 추가하고 `MemoryThumb` 폴백 분기를 emoji → `<img>`로 교체.
이미지 로드 실패 시 기존 emoji로 폴백 유지(안전망). 로직 변경 없이 **emoji 자리만 이미지로** 바꾸는 수준.

```tsx
// 예시 스케치 (아트 도착 후 적용)
discovery: { emoji: '💡', label: '깨달음', color: '#e0b354',
             art: `${import.meta.env.BASE_URL}images/emblems/discovery.png` },
// MemoryThumb: art 있으면 <img src={cat.art} onError={→ emoji 폴백}/>, 없으면 emoji
```

---

### 부록 — 한 번에 9종 요청용 묶음 프롬프트(선택)
세트 일관성을 위해 "9개를 같은 스타일로"를 한 요청에 담고 싶을 때, §1 마스터 스타일을 머리에 두고
각 칸을 `{color}/{mood}/{motif}`만 바꿔 9번 반복 요청하거나, 3×3 컨택트시트로 한 장에 뽑은 뒤 분할한다.
(컨택트시트는 개별 추출 시 가장자리 잘림 주의 — 칸 사이 여백 충분히.)
