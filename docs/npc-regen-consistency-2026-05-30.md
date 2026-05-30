# NPC 일관성 재생성 지시 (2026-05-30)

> **대상: 아래 4장만 재생성.** 나머지 NPC neutral 포트레이트는 일관성 OK → 손대지 말 것.
> 저장 위치: `game/public/images/characters/{파일명}` (같은 이름 덮어쓰기).
> 캐릭터 마커 SSOT: `docs/character-prompt-spec.md` (Section 4.5 얼굴 일관성, 각 캐릭터 블록).
>
> **왜 이 4장인가** (2026-05-30 in-game 일관성 점검 결과):
> 1. `yuna_high_neutral` — 다른 모델로 생성돼 **화풍이 캐스트에서 단독 이탈**(과도하게 정밀 렌더). 사이즈도 1023×1537.
> 2. `jihun_middle_neutral` — **512×1024** (전 자산 중 유일한 규격 이탈, 좁게 잘려 보임).
> 3. `jihun_elementary_neutral` — 머리색이 **갈색**으로 드리프트 (중·고는 검정).
> 4. `doyun_elementary_neutral` — 머리색이 **갈색**으로 드리프트 (중·고는 검정).
>
> 핵심 원칙: **얼굴/화풍을 새로 상상하지 말고, 지정한 기존 정상 PNG를 reference로 고정**해서
> "같은 캐릭터를 유저가 계속 알아볼 수 있게" 유지한다. 텍스트만으로 재생성하면 얼굴이 드리프트한다
> (이번 yuna_high가 정확히 그 사고). 가능하면 reference 이미지를 입력(img2img/reference)으로 사용.

---

## 공통 블록 (4장 모두 적용)

**[스타일 앵커]** — 프롬프트 끝에 추가
```
korean manhwa style, SOFT cel-shading (2~3 layers), clean thin lineart, pastel color palette,
school life theme, detailed but NOT over-rendered face, semi-realistic anime (NOT photorealistic),
brown eyes with simple highlights (not glossy), digital illustration, consistent art style
```

**[구도]** — 모든 neutral 포트레이트 공통
```
Chest-up portrait (upper body), slight angle toward camera, looking at viewer.
Background: soft pastel pink-blue gradient (light pink → sky blue), KEEP as final background.
Output: PNG, 1024x1536 px (2:3 ratio). Do NOT crop narrower, do NOT output half-resolution.
```

**[네거티브]** — 공통
```
3d, realistic, photo, blurry, low quality, deformed, extra fingers, bad anatomy, watermark,
text, signature, nsfw, transparent background, plain white background,
different face shape, different eye shape, photorealistic style, different art style,
over-rendered, semi-realistic 3d render, different illustrator style,
mature face on young character, inconsistent character design
```

> ⚠️ **누끼 금지**: neutral 포트레이트는 파스텔 배경을 **최종 유지**. 배경 제거(알파) 절대 금지
> (흰 fringe 사고의 원인). — `character-prompt-spec.md` Section 2 / 9 참조.

각 프롬프트는 `[가변부] + [구도] + [스타일 앵커] + [네거티브]`를 합쳐 완성한다.

---

## 1. `yuna_high_neutral.png` (고등 — 화풍 통일 + 사이즈)

> **Face/화풍 reference: `yuna_middle_neutral.png`** (이게 캐스트 공통의 부드러운 화풍). 고등 버전이
> 이 reference보다 정밀하게 렌더되면 안 됨 — eye/shading rendering을 middle과 동일하게 유지.

```
Maintain the EXACT same face proportions, eye shape, eye rendering, jawline, skin tone, AND
art/shading style as yuna_middle_neutral.png. This is a STYLE-MATCH regen — the previous high
version drifted to a more rendered/semi-realistic look; match the softer middle style exactly.

Korean high school girl at 16-18, slightly more mature proportions only. Medium-length wavy
light brown (CARAMEL) hair, gold star-shaped hair clip on right side, NO glasses. Bright warm
brown eyes. Expression: bright friendly smile, a touch more composed than middle.
Outfit: high-school uniform — navy blazer, white shirt with red ribbon, plaid skirt.
```

## 2. `jihun_middle_neutral.png` (중등 — 규격 정상화)

> **Face reference: `jihun_high_neutral.png`** (얼굴·화풍 정상). 이건 다른 자산들이 가리키는 base인데
> 512×1024로 잘못 나와 있어 1024×1536로 다시 뽑는다. 얼굴은 high와 동일인.

```
Maintain the EXACT same face proportions, eye shape, jawline, skin tone, and art style as
jihun_high_neutral.png (one stage younger). 

Korean middle school boy, athletic, taller than average. Short messy BLACK hair, slightly spiky,
messy bangs. Bright lively brown eyes. Expression: confident friendly grin showing teeth.
Outfit: navy blazer worn casually (slightly open), white shirt, NO tie (middle stage).
Basketball keychain visible on bag strap at shoulder.
```

## 3. `jihun_elementary_neutral.png` (초등 — 머리색 검정 통일)

> **Face reference: `jihun_high_neutral.png`**. 변경점은 머리색(갈색→검정)뿐. 의상(royal blue
> athletic zip-up)·grin은 그대로 두되 얼굴은 동일인 유지.

```
Maintain the EXACT same face proportions, eye shape, jawline, skin tone, and art style as
jihun_high_neutral.png (older stage).

Korean boy at 11-12, rounder face, carefree. Short messy BLACK hair (⚠️ BLACK, NOT brown/caramel
— previous version drifted to brown; middle/high are black so unify to black), slightly longer,
messy bangs over forehead. Expression: big innocent energetic grin.
Outfit (SPORTSWEAR — NOT casual everyday): royal blue athletic zip-up hoodie with white sleeve
stripe over pure white T-shirt.
```
> 네거티브에 추가: `brown hair, caramel hair, light hair`

## 4. `doyun_elementary_neutral.png` (초등 — 머리색 검정 통일)

> **Face reference: `doyun_middle_neutral.png`**. 변경점은 머리색(갈색→검정)뿐. 의상(green soccer
> jersey)은 그대로. neutral 표정(이 차분 미소 그대로) 유지.

```
Maintain the EXACT same face proportions, eye shape, jawline, skin tone, and art style as
doyun_middle_neutral.png (older stage).

Korean boy at 11-12, bright pure energy. Short neat BLACK hair, slightly side-parted, slightly
less styled (⚠️ BLACK, NOT brown — previous version drifted to brown; middle/high are black so
unify to black). Clear warm brown eyes, dependable honest gaze. Expression: soft neutral smile,
calm and approachable (NOT wide grin, NO teeth showing — this is the NEUTRAL portrait).
Outfit: green V-neck soccer jersey with white collar trim and white sleeve cuffs.
```
> 네거티브에 추가: `brown hair, light hair`

---

## 생성 후 검증 체크리스트 (codex 또는 사람)

- [ ] 4장 모두 **1024×1536** (jihun_middle 이 512×1024 아님, yuna_high 가 1023×1537 아님)
- [ ] 배경 = 파스텔 핑크-블루 그라데이션 **유지** (투명/흰배경 아님, 흰 fringe 0)
- [ ] `yuna_high` 화풍이 `yuna_middle`·나머지 캐스트와 동일 (정밀 렌더 단독 이탈 아님)
- [ ] `jihun_elementary`·`doyun_elementary` 머리색 = **검정** (중·고와 동일)
- [ ] 각 캐릭터가 초/중/고 나란히 봤을 때 동일 인물로 인지됨
