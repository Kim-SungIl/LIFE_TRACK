# 발주 — 신규 3인 캐릭터 포트레이트 8장 (seoa·siwoo·yerin)

> 배경: `game/public/images/characters/`에 seoa/siwoo/yerin standing 포트레이트가 없어 친구 패널·인트로·상세 모달이 색상 아바타로 폴백(`Portrait.tsx:80`). 이벤트 CG(~70장)는 이미 있음. **standing 포트레이트만 결원.**
> 얼굴 레퍼런스: `_archive/2026-05-20-neutral-alpha-19/{id}_neutral.png.rgb-original.png` (원본 디자인 = 정합 기준).
> 규칙 출처: `docs/character-prompt-spec.md` §1·§2·§4·§4.5.

## ⚙️ 전 컷 공통 규칙 (SSOT §1·§2)
- **스타일 앵커**: Anime-style Korean visual novel character. Clean thin uniform-weight lineart, soft cel-shading (2–3 layers), semi-realistic anime (NOT chibi), natural skin with soft blush, minimal nose, brown eyes with simple (non-glossy) highlights, soft rounded jawline, soft even lighting (no harsh directional shadows), slightly muted natural colors. Same shared base face style as the existing LIFE_TRACK cast.
- **neutral(포트레이트)**: chest-up, slight angle to camera, soft neutral expression. **Background = soft pastel pink-blue gradient, KEEP it (do NOT remove).** 1024×1536 (2:3) PNG.
- **fullbody**: head-to-shoes, natural standing pose (weight on one leg, hands relaxed). **Background = plain solid pure white (#FFFFFF) for clean cutout → 이후 remove.bg로 투명 누끼.** 1024×1536 (2:3) RGBA.
- **교복 (§4)**: 여 middle/high = navy blazer + white shirt + red ribbon bow + (fullbody) plaid skirt + knee socks + loafers. 남 high = navy blazer + white shirt, **no tie**, + dark pants + loafers. high = middle 대비 약간 성숙한 비율·표정, 교복은 약간 착용감/개인화. **crest 금지**(crest는 주인공 전용 마커).
- **Negative (전 컷)**: `different face shape, different eye shape, photorealistic, different art style, mature face on young character, inconsistent character design, chibi, glossy plastic eyes, extra limbs, deformed hands, text, watermark, logo, chest crest/emblem`.

---

## 윤서아 (seoa) — F, 중2~고3 · 내성적 글쟁이
**외형(archive 고정)**: long straight dark-brown hair falling well past the chest, soft blunt bangs, a small white hair clip on the right side, large gentle brown eyes, calm reserved faint smile, fair skin. Quiet introvert air.
**cross-stage 일관**: `seoa_middle`과 `seoa_high`는 동일 face base. 차이는 high가 약간 성숙한 비율·차분한 표정뿐.

### 1) `seoa_middle_neutral.png` — pastel 유지
```
[STYLE ANCHOR] Korean middle-school girl, age ~14. Long straight dark-brown hair past the chest, soft bangs, small white hair clip on the right side, large gentle brown eyes, calm reserved faint smile, fair skin with soft blush. Slightly rounder youthful face. Middle-school uniform: navy blazer + white dress shirt + red ribbon bow + gold buttons. Chest-up, slight angle to camera, soft neutral expression. Background: soft pastel pink-blue gradient — KEEP, do not remove. 1024x1536.
NEG: [전 컷 negative]
```

### 2) `seoa_middle_fullbody.png` — 흰배경→누끼
```
[STYLE ANCHOR] Same girl as seoa_middle_neutral (identical face/hair/skin). Age ~14. Full body head-to-shoes, natural standing pose weight on one leg, hands relaxed at sides, one hand loosely holding a closed notebook to her side. Middle-school uniform: navy blazer + white shirt + red ribbon bow + plaid skirt + knee socks + loafers. Slightly reserved posture. Background: plain solid pure white (#FFFFFF) for clean cutout. 1024x1536, transparent-ready.
NEG: [전 컷 negative] + colored/gradient background, floor shadow
```

### 3) `seoa_high_neutral.png` — pastel 유지
```
[STYLE ANCHOR] Same girl as seoa_middle (identical face base), now age ~18 high-schooler — slightly more mature proportions and a calmer composed expression, SAME face shape/eyes/hair length/hair clip/skin tone. Long straight dark-brown hair past the chest, soft bangs, small white hair clip on the right side, large gentle brown eyes, faint reserved smile. High-school uniform: navy blazer + white shirt + red ribbon bow, slightly worn/personalized. Chest-up, slight angle, soft neutral expression. Background: soft pastel pink-blue gradient — KEEP. 1024x1536.
Maintain EXACT same face proportions, eye shape, jawline, art style, skin tone as seoa_middle.
NEG: [전 컷 negative]
```

### 4) `seoa_high_fullbody.png` — 흰배경→누끼
```
[STYLE ANCHOR] Same girl as seoa_high_neutral (identical face). Age ~18. Full body head-to-shoes, natural standing pose weight on one leg, one hand loosely holding a closed notebook. High-school uniform: navy blazer + white shirt + red ribbon bow + plaid skirt + knee socks + loafers, slightly worn/personalized, slightly more mature proportions. Background: plain solid pure white (#FFFFFF) for clean cutout. 1024x1536, transparent-ready.
NEG: [전 컷 negative] + colored/gradient background, floor shadow
```

---

## 한시우 (siwoo) — M, 고1~3(high 전용) · 창밖 보는 관찰자, 드라이유머
**외형(archive 고정)**: short tousled dark-brown hair, bangs partly falling over the eyes, sleepy half-lidded narrow eyes, faint cool/dry half-smile, fair skin, calm detached air. Signature prop: 스테인리스 텀블러.

### 5) `siwoo_high_neutral.png` — pastel 유지
```
[STYLE ANCHOR] Korean high-school boy, age ~17. Short tousled dark-brown hair with bangs partly over the eyes, sleepy half-lidded narrow brown eyes, faint cool dry half-smile, fair skin. Calm detached observer air. High-school uniform: navy blazer worn relaxed/open over a white shirt, NO tie, collar slightly open. Chest-up, slight angle to camera, soft neutral expression. Background: soft pastel pink-blue gradient — KEEP, do not remove. 1024x1536.
NEG: [전 컷 negative]
```

### 6) `siwoo_high_fullbody.png` — 흰배경→누끼
```
[STYLE ANCHOR] Same boy as siwoo_high_neutral (identical face/hair/skin). Age ~17. Full body head-to-shoes, natural standing pose weight on one leg, one hand in pocket, other hand loosely holding a plain stainless tumbler. High-school uniform: navy blazer worn relaxed/open, white shirt no tie, dark pants, loafers. Detached, slightly slouched cool posture. Background: plain solid pure white (#FFFFFF) for clean cutout. 1024x1536, transparent-ready.
NEG: [전 컷 negative] + colored/gradient background, floor shadow, tumbler text/logo
```

---

## 강예린 (yerin) — F, 고1~3(high 전용) · 입시 전략가, 효율의 언어
**외형(archive 고정)**: long dark-brown wavy hair, side-swept bangs, large brown eyes, small composed/confident faint smile, small teardrop earrings, fair skin, put-together capable air. Signature: 어깨 가방끈.

### 7) `yerin_high_neutral.png` — pastel 유지
```
[STYLE ANCHOR] Korean high-school girl, age ~17. Long dark-brown wavy hair, side-swept bangs, large brown eyes, small composed confident faint smile, small teardrop earrings, fair skin. Put-together capable strategist air. High-school uniform: navy blazer + white shirt + red ribbon bow, a black bag strap crossing one shoulder. Chest-up, slight angle to camera, soft neutral expression. Background: soft pastel pink-blue gradient — KEEP, do not remove. 1024x1536.
NEG: [전 컷 negative]
```

### 8) `yerin_high_fullbody.png` — 흰배경→누끼
```
[STYLE ANCHOR] Same girl as yerin_high_neutral (identical face/hair/skin). Age ~17. Full body head-to-shoes, natural standing pose weight on one leg, one hand holding a shoulder bag strap, posture upright and composed. High-school uniform: navy blazer + white shirt + red ribbon bow + plaid skirt + knee socks + loafers, black shoulder bag. Background: plain solid pure white (#FFFFFF) for clean cutout. 1024x1536, transparent-ready.
NEG: [전 컷 negative] + colored/gradient background, floor shadow
```

---

## 생성 후 체크리스트
- [ ] neutral 4장: 파스텔 배경 **유지**됐는지(누끼 X — 2026-05-20 흰프린지 사고 재발 방지)
- [ ] fullbody 4장: 흰배경 remove.bg → 투명 RGBA, 바닥 그림자 없음
- [ ] seoa middle↔high 얼굴 동일(머리길이·헤어핀 유지, high만 약간 성숙)
- [ ] crest/엠블럼 없음(주인공 마커라 NPC 금지), 텍스트/로고 없음
- [ ] 8장 전부 1024×1536, 파일명 정확
