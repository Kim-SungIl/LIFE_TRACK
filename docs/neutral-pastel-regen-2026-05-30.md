# Neutral 포트레이트 파스텔 배경 일괄 재생성 (2026-05-30)

> ⚠️ **이 문서(텍스트→이미지 재생성 프롬프트)는 채택되지 않음.** 텍스트 재생성은 기존 얼굴이
> 바뀔 위험이 있어서, 실제 작업은 **기존 이미지를 그대로 두고 배경만 합성**하는 방식으로 진행한다.
> → 실제 작업 지시: **`docs/neutral-pastel-bg-add-task.md`** 참조.
> (이 문서는 캐릭터별 특징/마커 레퍼런스로만 참고.)

---


> **목적**: 파스텔톤 배경이 아닌 neutral 포트레이트 24개를 **파스텔 배경으로 재생성**.
> 2026-05-20 일괄 알파 제거로 투명/흰잔여물이 된 것들을 neutral 컨벤션(파스텔 유지)으로 되돌림.
> 출처 프롬프트: `docs/character-prompt-spec.md` (각 캐릭터 Full Body + Portrait 블록, Section 4 의상, Section 4.5 얼굴 일관성).
>
> **제외(이미 정상 파스텔)**: `subin_elementary`, `player_f_elementary`, `player_m_elementary`.
> 저장 위치: `game/public/images/characters/{파일명}` (같은 이름 덮어쓰기). 생성 후 흰 잔여물 0 검증.

---

## 공통 블록 (모든 프롬프트에 적용)

**[스타일 앵커]** — 프롬프트 끝에 추가
```
korean manhwa style, soft cel-shading, clean lineart, pastel color palette,
school life theme, detailed face, high quality, digital illustration, consistent art style
```

**[얼굴 일관성]** — `{id}` = 캐릭터 id. Section 4.5 필수 문장.
```
Maintain EXACT same face proportions, eye shape, jawline, art style, and skin tone
as in {id}_fullbody.png (middle-school reference). Only allowed differences: slight maturity
in body proportions, slightly more composed expression, stage-appropriate outfit.
```

**[구도]** — 모든 neutral 포트레이트 공통
```
Chest-up portrait (upper body), slight angle toward camera, looking at viewer.
Background: soft pastel pink-blue gradient (light pink → sky blue). Size: 1024x1536 (2:3).
```

**[네거티브]** — 공통
```
3d, realistic, photo, blurry, low quality, deformed, extra fingers, bad anatomy, watermark,
text, signature, nsfw, transparent background, plain white background,
different face shape, different eye shape, photorealistic style, different art style,
mature face on young character, inconsistent character design
```

> ⚠️ **누끼 금지**: 이건 Portrait/neutral 이미지다. 파스텔 배경을 **최종 유지**한다. 절대 배경 제거하지 말 것 (그게 이번 흰 fringe 사고의 원인). — character-prompt-spec.md Section 2 / 9 참조.

각 프롬프트는 `[얼굴 일관성]+[구도]+[스타일 앵커]+[네거티브]`를 더해 완성한다. 아래는 캐릭터·스테이지별 가변부.

---

## player_m — 남자 주인공 (everyman, NO glasses, NO prop, 소프트 센터파트)

**`player_m_neutral.png`** (middle)
```
Korean middle school boy. Natural medium-length black hair with soft center part, fuller bangs
lightly covering forehead (NOT neat crop, NOT messy — messy is jihun). Warm brown eyes, soft jawline.
Expression: calm, friendly, slightly mature soft half-smile. Outfit: navy blazer fully buttoned,
white shirt (no tie), dark pants. NO glasses, NO hand prop.
```

**`player_m_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature proportions. Same black hair, soft center part.
Expression: composed gentle half-smile. Outfit: navy blazer, white shirt, NAVY TIE,
small gold-embroidered school crest emblem on left chest pocket (subtle laurel+crown). NO glasses.
```

---

## player_f — 여자 주인공

**`player_f_neutral.png`** (middle)
```
Korean middle school girl. Medium-length dark brown straight hair (shoulder length), warm brown eyes,
calm and kind. Expression: soft neutral smile, warm gaze. Outfit: navy blazer, white shirt with red
ribbon, plaid skirt.
```

**`player_f_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature. Same dark brown straight shoulder hair.
Expression: calm warm slight smile, a touch more composed. Outfit: high-school uniform —
navy blazer, white shirt with red ribbon neatly tied, plaid skirt (slightly more mature/personalized fit).
```

---

## jihun — 소꿉친구 (athletic, 메시 헤어, 농구 키체인). center part 금지(=player_m 마커)

**`jihun_neutral.png`** (middle)
```
Korean middle school boy, athletic, taller. Short messy black hair, slightly spiky, messy bangs.
Bright lively brown eyes. Expression: confident friendly grin showing teeth. Outfit: navy blazer worn
casually (slightly open), white shirt. Basketball keychain on bag strap visible at shoulder.
```

**`jihun_elementary_neutral.png`** (elementary)
```
Same boy at 11-12, rounder face, more carefree. Same messy black hair, slightly longer, messy bangs
over forehead. Expression: big innocent energetic grin. Outfit (SPORTSWEAR — NOT casual everyday):
royal blue athletic zip-up hoodie with white sleeve stripe over pure white T-shirt.
```

**`jihun_high_neutral.png`** (high)
```
Same character at 16-18, more mature athletic build. Same short messy black hair. Expression:
confident friendly grin, a bit more composed. Outfit: high-school uniform — navy blazer (casual,
slightly open), white shirt, navy tie, small gold chest crest. Athletic vibe retained.
```

---

## subin — 학원 친구 (블랙 보브, 골드 별 귀걸이, 차분)

**`subin_neutral.png`** (middle)
```
Korean middle school girl, neat and composed. Short black bob cut, warm brown calm eyes, slim.
Small gold star earrings visible. Expression: quiet gentle composed smile. Outfit: navy blazer neatly
buttoned, white shirt with red ribbon, plaid skirt.
```

**`subin_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature. Same short black bob, gold star earrings.
Expression: soft composed smile. Outfit: high-school uniform — navy blazer, white shirt with red ribbon,
plaid skirt (more mature fit).
```

---

## minjae — 조용한 1등 (얇은 사각/무테 안경 + 노트 = 핵심 마커. 둥근 안경 금지=haeun)

**`minjae_neutral.png`** (middle)
```
Korean middle school boy, composed and modest. Neat short side-part dark brown hair (no buzz, no mess).
THIN rimless or thin silver square-frame glasses (NOT round). Thoughtful brown eyes behind glasses,
average pale skin. Expression: composed half-smile or thoughtful neutral (NO wide grin, NO teeth).
Outfit: navy blazer properly buttoned, white shirt. Holding a notebook at chest level (core identity prop).
```

**`minjae_elementary_neutral.png`** (elementary)
```
Same boy at 11-12, rounder face, same composed energy. Same neat short cut. Same thin square/rimless
glasses (child-sized frame, NOT round). Expression: faint focused smile (NO big grin). Outfit: simple
plain navy or grey hoodie (NOT bright red), holding a notebook or small textbook.
```

**`minjae_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature. Same neat side-part, same thin square/rimless glasses.
Expression: composed thoughtful half-smile. Outfit: high-school uniform — navy blazer, white shirt,
navy tie, small gold chest crest. Notebook held at chest level.
```

---

## yuna — 밝은 우등생 (캐러멜 웨이브, 별 헤어클립, 안경 없음)

**`yuna_neutral.png`** (middle)
```
Korean middle school girl, bright and energetic. Medium-length wavy light brown (caramel) hair,
star-shaped hair clip on right side. Bright warm brown eyes, NO glasses. Colorful scrunchie bracelet.
Expression: bright lively friendly smile. Outfit: navy blazer, white shirt with red ribbon, plaid skirt.
```

**`yuna_elementary_neutral.png`** (elementary)
```
Same girl at 11-12, rounder face, even brighter. Caramel wavy hair (slightly shorter), star hair clip,
colorful scrunchie bracelet. Expression: bright innocent curious smile. Outfit: yellow hoodie (NO uniform).
```

**`yuna_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature. Same caramel wavy hair, star hair clip, no glasses.
Expression: bright friendly smile, a touch more composed. Outfit: high-school uniform — navy blazer,
white shirt with red ribbon, plaid skirt.
```

---

## doyun — 초등 인기남/축구 주장 (단정 블랙 사이드파트, 리더 아우라). jihun과 구분: 단정 vs 메시

**`doyun_neutral.png`** (middle)
```
Korean middle school boy, athletic dependable leader aura. Short neat black hair, slightly side-parted,
clean cut. Clear warm brown eyes, dependable honest gaze. Expression: friendly confident soft smile.
Outfit: navy blazer neatly worn, white shirt. Small soccer ball keychain on bag strap.
Must NOT resemble jihun (neat vs messy, composed vs playful).
```

**`doyun_elementary_neutral.png`** (elementary)
```
Same boy at 11-12, bright pure energy. Same neat black hair, slightly less styled. Clear warm brown eyes.
Expression: soft neutral smile, calm and approachable (NOT wide grin, NO teeth). Outfit: green V-neck
soccer jersey with white collar trim and white sleeve cuffs.
```

**`doyun_high_neutral.png`** (high)
```
Same character at 16-18, more mature athletic build. Same neat side-part black hair. Expression:
confident reliable soft smile, composed. Outfit: high-school uniform — navy blazer, white shirt,
navy tie, small gold chest crest. Leader composure.
```

---

## haeun — 전학생/조용한 독서가 (다크브라운 직모 보브, 검은 둥근사각 안경, 빨간 책). yuna와 구분

**`haeun_neutral.png`** (middle)
```
Korean middle school girl, quiet thoughtful transfer student. Dark brown STRAIGHT bob cut slightly above
shoulders with natural flyaway hairs (NO caramel, NO wave). Warm brown eyes, shy thoughtful expression.
Black-framed round-rectangle glasses. Expression: calm slightly shy bookish smile. Outfit: navy blazer
neatly buttoned, white shirt with large red ribbon, plaid skirt. Red-covered book held near chest.
Must NOT look like yuna (straight dark bob + glasses + red book vs caramel wave + star clip).
```

**`haeun_high_neutral.png`** (high)
```
Same character at 16-18, slightly more mature. Same dark brown straight bob, black round-rectangle glasses.
Expression: calm shy thoughtful smile. Outfit: high-school uniform — navy blazer, white shirt with red
ribbon, plaid skirt. Red book near chest.
```

---

## seoa — 조용한 작가형 (긴 직모 다크브라운, 한쪽 헤어클립, 이어폰). yuna와 구분: 안경 없음·긴머리·이어폰

**`seoa_neutral.png`** (middle)
```
Korean middle school girl, reserved and thoughtful. Long straight dark brown hair slightly past shoulders,
simple hair clip on one side. Deep brown eyes, thoughtful slightly dreamy expression, NO glasses.
Expression: calm observant subtle shy smile, looking slightly to the side. Outfit: navy blazer neatly
buttoned, white shirt with red ribbon, plaid skirt. Earphone cord slightly visible from blazer pocket.
```

---

## siwoo — 관찰자형 고등 (포어헤드 덮는 다크브라운 메시, 키 크고 마른 슬라우치, 텀블러)

**`siwoo_neutral.png`** (high)
```
Korean high school boy, 16, calm and observant. Medium-length dark brown hair slightly covering forehead,
natural messy style. Sharp but calm dark brown eyes, observant slightly guarded. Expression: slight
reserved half-smile, calm analytical gaze ("observer" vibe). Outfit: navy blazer worn casually
(top button undone), white shirt.
```

---

## junha — 부산 전학생/요리 (메시 다크브라운, 두꺼운 직선 눈썹, 약간 샤프한 턱, 듬직). player_m과 구분

**`junha_neutral.png`** (high)
```
Korean high school boy, 17, transfer student, sturdy and slightly awkward. Short dark brown slightly messy
unstyled hair. Warm dark brown earnest eyes. Eyebrows thicker and straighter than other males; slightly
sharper jawline; broad shoulders. Expression: slightly awkward but warm smile. Outfit: navy blazer
(slightly ill-fitting — recently transferred), white shirt. Must NOT resemble player_m (thicker brows,
sharper jaw, broader, messier, more rugged).
```

---

## yerin — 사교 전략가 (다크브라운 끝 웨이브, 플래너, 우아한 귀걸이, 정돈)

**`yerin_neutral.png`** (high)
```
Korean high school girl, 16, polished and poised. Medium-length dark brown hair neatly styled with slight
wave at ends, well-maintained. Bright sharp brown eyes, intelligent observant. Simple elegant earrings.
Expression: poised confident slight smile. Outfit: navy blazer perfectly fitted, white shirt with red
ribbon neatly tied, plaid skirt.
```

---

## 재생성 대상 체크리스트 (24)

- [ ] player_m_neutral · player_m_high_neutral
- [ ] player_f_neutral · player_f_high_neutral
- [ ] jihun_neutral · jihun_elementary_neutral · jihun_high_neutral
- [ ] subin_neutral · subin_high_neutral
- [ ] minjae_neutral · minjae_elementary_neutral · minjae_high_neutral
- [ ] yuna_neutral · yuna_elementary_neutral · yuna_high_neutral
- [ ] doyun_neutral · doyun_elementary_neutral · doyun_high_neutral
- [ ] haeun_neutral · haeun_high_neutral
- [ ] seoa_neutral
- [ ] siwoo_neutral
- [ ] junha_neutral
- [ ] yerin_neutral
