# Event CG Prompts — 고등학교 (Y5~Y7, 고1~고3)

> LIFE_TRACK 게임의 Y5~Y7(고등학교) 이벤트 CG 생성 프롬프트 모음.
> GPT 등 이미지 생성 AI에게 **캐릭터/배경 레퍼런스 이미지 + 프롬프트**를 함께 입력하여 일관성 있는 CG를 제작.
> 포맷·공통 스타일 앵커는 `docs/event-cg-prompts-y1.md` 정본을 미러링. 캐릭터 외형 마커 SSOT는 `docs/character-prompt-spec.md`.
> 촬영 대상은 `docs/cg-shotlist-2026-06.md` "## 고등학교 (Y5~Y7)" 섹션.

---

## 🎨 공통 스타일 가이드

모든 고등학교 CG에 공통 적용:

```
Art style: Anime-style illustration, soft pastel colors, gentle lighting,
           same character design as the provided reference sheets.
Era: 2010s~2020s Korean high school life
Age: 17~19-year-old Korean high school students (Korean grades 10~12)
Uniform: HIGH SCHOOL uniform — navy blazer (worn slightly more personalized/worn-in than
         middle school), white shirt, navy tie (male protagonist), plaid skirt + red ribbon
         (female), loafers. Taller, more mature proportions than middle school.
Composition: cinematic scene, focused emotion, natural lens feel
Resolution: 1440x810 (16:9) or 1080x1440 (3:4 portrait — for character close-ups)
```

**Negative prompt 공통**:
```
no elementary school, no middle school, no middle school uniform, no childish proportions,
no adult/college features, no exaggerated anime eyes, no sexualization,
no modern brand logos, no text/watermark, no inconsistent character design
```

> ⚠️ 고등 단계는 중학 단계와 **교복은 같은 디자인**이지만 (`character-prompt-spec` §4 High School):
> - **약간 더 큰 키 / 성숙한 비율**, **약간 더 진지·성숙한 표정**, **교복이 살짝 personalized/worn**.
> - 남주(player_m) 고등 단계는 **navy tie + 왼쪽 가슴 학교 crest 엠블럼** 추가(spec L208-218).
> 중학교 컷을 그대로 재활용하면 톤이 어려져 회고 히어로에서 위화감 → 반드시 고등 비율/표정 명시.

### 🍃 계절 의상 주의

고등 이벤트는 대부분 교복 착용(교실/옥상/강당/교문) → 교복 그대로. 단 사복 컷(방 안, 거리)은 계절을 반영:

| 계절 | 시기 | 의상 가이드 (사복 컷 한정) |
|---|---|---|
| 봄/초가을 | W1~W10, W31 | 가벼운 긴팔 T / 후드 / 카디건 |
| 여름 | W11~W30 | 반팔 T, 얇은 옷 |
| 늦가을/겨울 | W32~W48 | 두꺼운 후드/맨투맨/코트, 실내는 긴팔 |

> 본 문서의 사복 컷(`high-panic` 새벽 방, `suneung-eve` 수능 전날 밤 방)은 **늦가을~겨울(W34 전후)**이라
> 실내 긴팔 홈웨어(맨투맨/후드) 기준. 옥상/교실 컷은 교복.

## 📁 파일명 규칙 + 디렉토리 구조

```
public/images/events/
  elementary/   # Y1
  middle/       # Y2~Y4
  high/         # Y5~Y7  ← 본 문서 전부 여기
  common/       # 학교급-무관 폴백
```

파일명 형식: `{eventId}_c{choiceIndex}_{gender}.png` — choiceIndex 0부터, gender = `m`/`f`.
gender 분기 없으면 `_{g}` 생략, choice 분기 없으면 `_c{ci}` 생략.

**폴백 순서**(`eventCg.ts`): `high/{id}_c{ci}_{g}` → `high/{id}_{g}` → `high/{id}_c{ci}` → `high/{id}` → `common/...` 동일 cascade.

> 본 문서 고등 이벤트는 주인공 성별 차이가 결과/구도에 영향이 거의 없어 **대부분 성별무관 공통 1장**(`high/{id}_c{ci}.png`)으로 작성.
> (player가 직접 정면으로 크게 잡히는 컷은 back/side view 또는 군중 속 처리로 성별무관 프레이밍.)

## 🗂 레퍼런스 이미지 위치 (고등 자산)

모두 `game/public/images/` 하위:

**캐릭터 (고등 버전 — `*_high_*`)**:
- `characters/player_m_high_fullbody.png` + `player_m_high_neutral.png`
- `characters/player_f_high_fullbody.png` + `player_f_high_neutral.png` (있으면)
- `characters/jihun_high_fullbody.png` + `_neutral.png`
- `characters/subin_high_fullbody.png` + `_neutral.png`
- `characters/minjae_high_fullbody.png` + `_neutral.png`
- `characters/yuna_high_fullbody.png` + `_neutral.png`
- `characters/junha_high_fullbody.png` + `_neutral.png` (junha는 **고등 전용** stage만 존재)
- `characters/haeun_high_*` (재회 후)
- `characters/mother_middle_neutral.png` (성인 — 학년 무관 폴백, `high-panic`/`suneung-eve` 엄마)

**배경 (Y5~Y7에 등장 — 실재 확인됨)**:
- `backgrounds/classroom_high.png` / `classroom_high_spring.png` / `classroom_high_sunset.png`
- `backgrounds/rooftop_sunset.png` / `rooftop.png`
- `backgrounds/auditorium_high.png`
- `backgrounds/school_gate_high.png` / `school_gate_high_rain.png`
- `backgrounds/library_high.png` / `hallway_high.png`
- `backgrounds/bedroom_night.png`
- `backgrounds/clear_sky.png`
- `backgrounds/hagwon_front.png` / `festival_classroom.png` / `classroom_high_afternoon.png`
- (공용) `dinner_table` 계열 — `high-school-graduation`/치킨집은 별도 실내 배경

> ✅ `classroom_high_afternoon.png` **실재함**(엔진 다수 이벤트가 실제 사용 — money-sink·reachHigh·reachNew). 별도 대체 불필요. (톤이 안 맞으면 `classroom_high_sunset.png` 석양으로 선택 가능.)

---

## ⚠️ 캐릭터 외형 강제 마커 (고등 단계)

> 아래 마커는 `docs/character-prompt-spec.md` 정본과의 일치를 강제하기 위함.
> CG 프롬프트 인라인 기술이 spec과 어긋나면 spec이 우선.
> **고등 단계 공통 오버라이드**: 모든 인물 17~19세, 고등 교복(blazer), 약간 더 큰 키·성숙한 비율·진지한 표정.

### player_m (남자 주인공, 고등) — spec L208-218, L763
```
[REQUIRED visual markers — high stage]
- Natural medium-length black hair, soft CENTER PART (NOT messy bangs — that is jihun's)
- NO glasses, NO hand prop
- Navy blazer (top button optionally relaxed), white shirt, **navy tie**
- **Small gold-embroidered school crest emblem on left chest pocket** (laurel + crown motif)
- Soft, slightly mature half-smile baseline (more composed than middle stage)
- Build: average, taller/more mature than middle stage
- 사복 컷(방): casual 카테고리 (맨투맨/후드/T) — GREY/BEIGE/neutral 톤 (NOT navy/blue — jihun 색조 충돌)
```

### player_f (여자 주인공, 고등) — `_f`판 전용, 레퍼런스 `player_f_high_*`
```
[REQUIRED visual markers — high stage]
- Natural shoulder-length black hair (soft, neat; NOT waist-length)
- NO glasses, NO hand prop
- Navy blazer, white shirt, **red RIBBON** (남주 넥타이 대신), **plaid skirt**
- **Small gold-embroidered school crest on left chest** (남주와 동일 crest)
- Soft, slightly mature half-smile baseline; build: average, mature than middle stage
- 사복 컷(방): casual 카테고리 (맨투맨/후드/카디건) — GREY/BEIGE/neutral 톤
- 씬/배경/모티프는 남주판과 동일, 주인공 성별 표현(리본+치마·머리)만 다름
```

### jihun (한지훈, 고등) — spec L74-85, L291-307
```
[REQUIRED visual markers — high stage]
- Short MESSY BLACK hair, messy bangs over forehead (NOT center part — that is player_m's)
- Athletic build, taller, broad shoulders
- Outfit category: SPORTSWEAR energy. In uniform: navy blazer worn casually/open,
  white shirt; basketball keychain on bag strap as ID cue. NOT 모직 코트.
- Bright/saturated accent tone (royal blue, white, red) when in casual/sportswear
- Confident friendly grin showing teeth (more energetic than player_m's composed half-smile)
- Prop (context-dependent): basketball only in sports/walking scenes; set aside for
  static/indoor/rooftop scenes (PR #164 — do NOT force ball into every frame)
```

### subin (오수빈, 고등 — 항공서비스학과 지망) — spec L351-372
```
[REQUIRED visual markers — high stage]
- Short black BOB cut, clean and well-maintained
- Small GOLD STAR EARRINGS (signature marker)
- Navy blazer neatly buttoned, white shirt + red ribbon, plaid skirt
- Calm composed gentle smile; warm brown eyes
- Slim, good posture. Differs from yerin (longer wavy hair / planner)
```

### yuna (유나, 고등 — 음대 지망) — spec L438-460
```
[REQUIRED visual markers — high stage]
- Light brown (CARAMEL) WAVY hair, **STAR HAIR CLIP on right side**
- NO glasses (glasses are haeun/minjae markers)
- Navy blazer + white shirt + red ribbon + plaid skirt
- Bright lively expression baseline; colorful scrunchie bracelet on wrist
- Differs from subin: caramel wave vs black bob, star CLIP vs star EARRINGS
```

### minjae (박민재, 고등 — 의대 갈등) — spec L389-422, L768
```
[REQUIRED visual markers — high stage]
- Thin rimless OR thin silver SQUARE-frame glasses (NOT round — round is haeun's).
  Strongest identity cue; must be clearly visible every frame.
- Neat short hair (clean side-part / short undercut, NEVER buzz cut)
- Average PALE skin tone (NOT tanned)
- Navy blazer worn PROPERLY buttoned, white shirt
- Composed half-smile (NEVER wide toothy grin, never overly energetic)
- Notebook = signature prop, CONTEXT-DEPENDENT: study/classroom → in hand/on desk;
  rooftop/meal/outdoor → set aside or omitted (do NOT force into hands)
- Without glasses, minjae and player_m look identical → glasses mandatory.
```

### junha (송준하, 고등 — Y6 전학생, 요리사 꿈) — spec L606-631
```
[REQUIRED visual markers — high stage ONLY (junha는 elementary/middle 없음)]
- Short dark brown MESSY hair, unstyled natural look
- THICK, STRAIGHT eyebrows (thicker than other males) — key differentiator from player_m
- Slightly SHARPER jawline, sturdy build, broad shoulders
- Navy blazer slightly ILL-FITTING (recently transferred), white shirt, worn sneakers
- Earnest, straightforward warm smile (a touch awkward, trying to fit in)
- Busan transfer student vibe. Differs from player_m: thicker brows, sharper jaw, broader, messier hair
- (옥상 도시락 컷) 직접 만든 도시락통 = 맥락 prop
```

### haeun (김하은, 고등 — 재회 후) — spec L460-475, L545-565
```
[REQUIRED visual markers]
- Black-framed ROUND-rectangle glasses (round = haeun's marker vs minjae's square/rimless)
- Dark brown straight BOB slightly above shoulders with natural flyaways
- Holding a red-covered book to chest with both hands; shy thoughtful smile
- Navy blazer + white shirt + large red ribbon + plaid skirt + knee socks
- NO star hair clip (yuna's marker)
```

### mother (엄마 — `high-panic`, `suneung-eve`) — spec L703-716
```
[REQUIRED visual markers]
- Korean mother, early-to-mid 40s (NOT elderly)
- Soft shoulder-length dark brown hair loosely tucked, warm brown eyes
- Kind composed gentle smile; warm-toned soft knit cardigan over simple cream top
- Adult-female version of the shared Global Style Anchor face base
```

---

# ⚙️ 제작 방침 (2026-07 업그레이드 — reach 명세와 정합)

> 본 섹션은 reach 명세(`cg-prompts-high-reach-y5-y7.md`)의 하드닝 규칙·성별 방침을 이 비-reach 문서에 이식한 것이다. **개별 컷 프롬프트 본문에 남아 있는 `gender-neutral` 표현보다 아래 방침이 우선한다.**

## 🚫 [전 컷 공통 금지] (reach와 동일)
> ① 소품·종이의 **읽히는 글자/뒤집힌(거울상) 텍스트** 금지(간판·게시판·현수막은 흐리게 처리) ② **명세에 없는 가구·테이블·받침대·소품 추가 금지**(인물이 직접 들거나 명세가 지정한 표면에만) ③ **캔·컵은 빨대 없는 평평한 일반 풀탭**, 브랜드/텍스트 없음.
> ④ **캐릭터 마커는 매 컷 필수** — 특히 **민재=얇은 은색 사각/림리스 안경(매 컷)**, subin=검정보브+금별귀고리, yuna=카라멜웨이브+별클립, junha=굵은 직선눈썹+헐렁한 블레이저, jihun=메시 검정머리. 등장 시 위 마커를 프롬프트에 직접 명시(동일 인물 정합).

## 🚻 성별 방침 — 하이브리드 (2026-07)
> reach는 gender-neutral 프레이밍이 **전부 남주로 렌더**되어 전 컷 `_m`/`_f` 분기로 전환했다. 비-reach도 같은 리스크가 있으나, **NPC 감정 초점 컷의 구도를 지키기 위해 하이브리드**로 간다.
> - 남주 = navy tie(+가슴 crest), 레퍼런스 `player_m_high_*` · 여주 = red ribbon + plaid skirt, 레퍼런스 `player_f_high_*`. NPC·배경·씬·모티프는 두 판 동일, **주인공 성별 표현만** 다름.
> - **[분기] = `_m`/`_f` 2장 발주**. **[단일] = 성별 무관 1장**(순수 손 클로즈업 등 성별 구분 불가 컷).
> - **[분기-solo]**: 주인공이 화면 주체 → 정면/3-4로 성별이 또렷이. **[분기-NPC]**: NPC가 감정 초점 → 주인공은 현 구도(3/4·뒷모습)로 NPC를 마주보되, 보이는 **교복(치마/바지·리본/넥타이)** 으로만 성별 구분(정면으로 돌려 NPC 초점 흐리지 말 것).

## 📁 파일명 + 폴백 (reach와 동일 cascade)
> [분기] draft 선택지 = `{eventId}_c{ci}_{g}.png`, 무draft/폴백 = `{eventId}_{g}.png` (g=m/f). [단일] = `{eventId}_c{ci}.png` (접미사 없음).
> cascade: `high/{id}_c{ci}_{g}` → `high/{id}_{g}` → `high/{id}_c{ci}` → `high/{id}` → `common/...`.

## 🗂 컷별 성별 분류표 (38컷 → 약 70장)
| 이벤트 · 컷 | 분류 | 근거 |
|---|---|---|
| high-panic c0/c1/c2 | 분기-solo | 주인공 단독(엄마 c2도 주인공 몸/실루엣) |
| identity-crisis c0/c1/c2 | 분기-solo | 주인공 단독/담임·통화, 주인공 주체 |
| school-trip-high c0 | 분기-NPC | 지훈·그룹 초점, 주인공 3/4로 합류 |
| school-trip-high c1 | 분기-solo | 빈 교실 주인공 단독(교복 뒷모습) |
| club-academy-choice-y5 c0 | **단일** | 등록증 손 클로즈업(성별 구분 불가) |
| club-academy-choice-y5 c1 | 분기-solo | 동아리방 문 앞 주인공(교복) |
| graduation-prep-high c0 | 분기-solo | 거울 반영에 얼굴·정장 → 성별 또렷 |
| subin-farewell c0/c1 | 분기-NPC | 수빈 초점, 주인공 마주봄(교복) |
| yuna-smile c0 | 분기-NPC | 유나 초점 |
| yuna-smile c1 | **단일** | 새끼손가락 손 클로즈업 |
| jihun-promise c0/c1 | 분기-NPC | 지훈 초점(c0 나란히 서기 교복) |
| junha-cook c0/c2 | 분기-NPC | 준하 표정 초점(도시락/약속) |
| minjae-dream c0 | 분기-NPC | 민재 초점 |
| minjae-dream c2 | **단일** | 주먹 맞대기 손 클로즈업 |
| high-school-entrance | 분기-solo | 교문 앞 주인공(새 교복, 정면 성격) |
| high2-track-select c0/c1 | 분기-solo | 종이 든 주인공 |
| high3-start | 분기-solo | 착석 주인공(교복) |
| suneung-eve | 분기-solo | 책상 주인공+엄마(주인공 몸) |
| suneung-done c0 | 분기-NPC | 치킨집 지훈·민재 초점 |
| suneung-done (폴백) | 분기-solo | 홀로 걸어나가는 뒷모습(교복) |
| high-school-graduation c0 | 분기-NPC | 5인 단체+주인공 뒷모습(교복) |
| high-school-graduation (폴백) | 분기-solo | 빈 교실 뒷모습(교복) |
| mock-exam-prep / -2 | 분기-solo | 책상 주인공+담임 |
| school-festival c0 | 분기-NPC | 수빈과 포스터(3/4) |
| school-festival c1 | **단일** | 장부 쓰는 손 클로즈업 |
| school-festival c2 | 분기-solo | 천장 보는 주인공(몸/실루엣) |
| yuna-study c0/c1 | 분기-NPC | 유나 초점 |

> **[단일] 4컷**: club-academy-choice-y5_c0, yuna-smile_c1, minjae-dream_c2, school-festival_c1. 나머지 전부 [분기].

---

# 📅 고등학교 이벤트 CG

```
🔴 필수 CG (핵심 서사 / 회고 히어로)   🟠 중요 CG (캐릭터 각인)   🟡 마일스톤 (변곡점 연출)
[분기] = _m/_f 2장 · [단일] = 성별무관 1장 (컷별 분류표 참조)
```

---

# P1 — 기억 이벤트 (회고 갤러리/히어로)

> `memorySlotDraft`(importance≥3, non-ANNUAL)가 달려 회고 갤러리/히어로에 직접 노출. 최우선.

---

## 🔴 high-panic — 새벽의 패닉 (주인공 + 엄마)

**발동**: Y5~7, mental≤55 & academic≥50 (crisis.ts). **사복/실내** 컷 → 교복 없음.
**Scene**: 새벽 세 시, 문제집 펴놓고 졸다 깬 방. 심장이 빠르고 숨이 안 쉬어지는 패닉. (`bedroom_night`)

**References**: `player_m_high_neutral.png` (얼굴 일관성), `mother_middle_neutral.png` (c2), `bedroom_night.png`

### [c0] 책상에서 벗어나 현관문 밖으로 나간다 (failure/regret/7)

**공통** `high/high-panic_c0.png`
```
3 AM, cramped Korean apartment stairwell landing just outside the front door, dim.
A 17~18-year-old Korean high schooler (protagonist) sitting hunched on the cold concrete
step, one hand pressed to chest, head down, catching their breath after a panic surge.
3/4 from behind or side so the CHOSEN GENDER still reads via hair/build (`_m` short black
center-part hair, leaner shoulders; `_f` shoulder-length black hair) — loungewear, no uniform;
emphasize the hunched tension in the shoulders. [분기-solo: `_m`/`_f` 2판, 성별은 머리·실루엣으로] Bare feet / house slippers, indoor loungewear (long-sleeve
sweatshirt, late-autumn night). A sliver of warm light from the half-open apartment door
behind, cold blue stairwell light ahead.
Mood: 새벽 패닉의 한가운데, 숨을 고르는 외로운 순간. quiet desperation, not melodrama.
```
> 맥락: c0은 "벗어나기"의 임시 도피. 회복이 아니라 숨 고르기. regret 톤 — 혼자 삭이는 무게.

### [c1] 숨 고르고 조금만 더 공부한다 (failure/regret/6)

**공통** `high/high-panic_c1.png`
```
Same 3 AM bedroom (bedroom_night reference). Protagonist forced back into the desk chair,
shoulders rigid, gripping a pen over an open problem book — but the gaze is glassy and
unfocused, body language of pushing through panic by sheer will. Side view / face partly
shadowed but the CHOSEN GENDER reads via hair (`_m` short center-part / `_f` shoulder-length),
loungewear. [분기-solo: `_m`/`_f` 2판]. Single desk lamp pooling warm light over the book,
the rest of the room dark; window showing deep-night blue sky, no stars.
A cold cup of coffee or water sits by the book. Subtle sheen of cold sweat.
Mood: 패닉을 억누르고 책상에 다시 앉은 위태로운 의지 — 건강한 회복이 아님, 자기 소진의 regret.
```

### [c2] 엄마 방 문을 두드린다 — 도움을 청한다 (growth/breakthrough/8)

**공통** `high/high-panic_c2.png`
```
Late-night Korean apartment hallway / mother's bedroom doorway, warm lamp light spilling out.
The mother (mother_middle_neutral reference — early-40s, shoulder-length dark brown hair,
warm-toned knit cardigan, kind composed face now softened with concern) is sitting beside
the protagonist, who is seated on the floor or bed edge, a cup of water set down between them.
Protagonist shown from behind or in soft profile, gender via hair/build (`_m` short center-part
/ `_f` shoulder-length), loungewear [분기-solo: `_m`/`_f` 2판, 엄마는 두 판 동일]; mother's hand resting
gently on their back or shoulder. Loungewear, late-autumn night.
Warm intimate lighting, the panic finally breaking into relief.
Mood: 처음으로 도움을 청한 돌파의 순간 — breakthrough warmth, 무너졌다가 손을 잡힌 안도.
```
> 회고 Y5~7 히어로 가치 큼(imp 8). 엄마는 성인 → `mother_middle` 폴백 레퍼런스 사용, 학년 무관.

---

## 🔴 identity-crisis — 야자 끝 옥상의 흔들림

**발동**: Y5~6, mental≤55 (crisis.ts).
**Scene**: 야자 끝 옥상, 친구들은 꿈을 말하는데 나는 아무것도 안 떠오름. 하늘이 멀어 보임. (`rooftop_sunset`, 단 야자 끝이라 해질녘~밤 톤)

**References**: `player_m_high_neutral.png`, `jihun_high_neutral.png` (c2), `rooftop_sunset.png`

### [c0] 아무한테도 말하지 않고 혼자 삭인다 (failure/regret/6)

**공통** `high/identity-crisis_c0.png`
```
School rooftop at dusk after evening self-study (야자), fading orange-to-violet sky
(rooftop_sunset reference, pushed toward late evening). A lone 17~18-year-old Korean high
schooler in high-school uniform (navy blazer) standing at the rooftop fence or sitting against
a wall, looking up at the vast distant sky. 3/4 / face turned up and away, in uniform so the
CHOSEN GENDER reads (`_m` navy tie + trousers / `_f` red ribbon + plaid skirt). [분기-solo: `_m`/`_f` 2판]
The sky feels impossibly far. Empty rooftop, distant city/school lights starting to glow.
Mood: 혼자 삭이는 막막함 — quiet existential loneliness, the sky too far to reach. regret.
```

### [c1] 담임한테 털어놓는다 (discovery/resolve/7)

**공통** `high/identity-crisis_c1.png`
```
Quiet after-hours school setting at dusk (rooftop or a hallway/empty classroom corner).
The protagonist (uniform, 3/4 or side view; `_m` navy tie / `_f` red ribbon + plaid skirt — [분기-solo]) talking to a homeroom teacher —
the teacher a calm 30s~40s Korean adult in a simple cardigan/shirt, listening with a reassuring
nod, one hand maybe on the student's shoulder. Soft dusk light. The student's posture loosening,
a weight lifting.
Dialogue cue: "모르는 게 정상이야" — the relief of being told it's okay not to know.
Mood: 털어놓고 나서 길이 열리는 discovery·resolve — gentle reassurance, 어른의 인정.
```

### [c2] 지훈이한테 전화해서 같이 밤까지 얘기한다 (growth/warm/8)

**공통** `high/identity-crisis_c2.png`
```
Split-feeling night phone-call scene. Protagonist sitting on rooftop or bedroom windowsill at
night, phone to ear, faint smile breaking through; gender via hair/build (`_m` short center-part
/ `_f` shoulder-length), casual/loungewear [분기-solo: `_m`/`_f` 2판]. Warm bedroom/rooftop night lighting.
Optionally a soft inset / side-by-side framing of Jihun on the other end (jihun_high reference —
messy black hair, athletic build, bright grin, casual sportswear), also on a phone, laughing.
Deep night sky. The mood lighter than it started.
Dialogue cue: "졸업이나 하자" — two old friends laughing the dread away till midnight.
Mood: 밤까지 이어진 통화의 따뜻함 — childhood-friend comfort, growth/warm. (imp 8, 회고 히어로급)
```
> jihun 정면 분할컷이 부담이면 주인공 단독 + 폰 화면 톤으로도 가능. jihun 등장 시 농구공 prop은 생략(통화 정적 컷).

---

## 🟠 school-trip-high — 고등학교 첫 수학여행 (제주)

**발동**: Y5, W28 (money-sink.ts). **고 디렉토리 버전만 작성**.
**Scene**: 제주 3박 4일 수학여행. "마지막일 거다." c0=참가, c1=불참 공부.

**References**: `jihun_high_fullbody.png`, `player_m_high_*`, `classroom_high.png`(c1 대체 배경)

### [c0] "간다" — 마지막 수학여행 (discovery/warm/7)

**공통** `high/school-trip-high_c0.png`
```
Jeju Island night beach, school trip. A small group of 17~18-year-old Korean high schoolers
sitting on the dark sand around the sound of waves, faces lit warm by a phone flashlight or
distant streetlights, laughing together. Jihun (jihun_high reference — messy black hair,
athletic build, bright open grin) mid-laugh at the center; protagonist beside the group
(3/4 / partly back facing the group; gender via hair/build — `_m` short center-part / `_f` shoulder-length — [분기-NPC: 그룹 초점 유지]) sharing the moment. Casual trip clothes (light jacket /
hoodie, NOT uniform — it's a night beach). Stars and dark sea horizon behind, gentle surf.
Mood: 파도 소리 속 친구들의 웃음 — once-in-a-lifetime trip warmth, summer-night freedom.
```
> W28 여름 → 밤 해변 캐주얼. 교복 아님. jihun 농구공 없음(해변 정적 컷).

### [c1] "공부해야지" — 불참 (failure/regret/5)

**공통** `high/school-trip-high_c1.png`
```
Empty high-school classroom in the afternoon (classroom_high_afternoon.png; classroom_high_sunset.png
for a more melancholy tone). A single protagonist
(uniform, 3/4 / back at a desk; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-solo]) with a study book/workbook open,
the rest of the desks empty around them. Late afternoon light slanting through windows,
everyone else away on the trip. A phone face-down or a group-chat photo glow on the desk.
Mood: 텅 빈 교실의 참고서 — 옳은 선택이지만 남겨진 자의 regret, quiet missing-out.
```

---

## 🟠 club-academy-choice-y5 — 동아리/학원 선택

**발동**: Y5, W2 (money-sink.ts). 주인공 단독/소품 위주.
**선택지 순서**(코드): c0="학원 등록", c1="동아리 들어갈래", c2="알아서 할게"(자율 — **CG 없음**).
> ⚠️ 촬영 리스트 브리프는 c0=학원 등록증, c1=동아리방으로 적었고 코드 선택지 순서와 일치(c0=학원, c1=동아리). 그대로 반영.

**References**: `player_m_high_*`, `classroom_high.png`, (학원 등록증/동아리방 소품)

### [c0] "학원 등록할게" — 공부에 집중 (discovery/resolve/5)

**공통** `high/club-academy-choice-y5_c0.png`
```
A hagwon (cram school) front desk / registration moment, evening. A 17-year-old Korean high
schooler (uniform, 3/4 / hands-focused, gender-neutral) receiving or holding a freshly stamped
academy registration slip (enrollment paper, generic — no brand; any printed text kept soft/illegible,
non-mirrored). Close on the hands and paper, the student's determined face partly in frame. Warm hagwon lobby lighting,
"학원" signage softly blurred behind.
Mood: "이제 시작" — quiet resolve, choosing the studying path. discovery/resolve.
```

### [c1] "동아리 들어갈래" — 사람 (discovery/warm/5)

**공통** `high/club-academy-choice-y5_c1.png`
```
A high-school club room (동아리방) door being opened for the first time, afternoon
(classroom_high.png style interior repurposed as a club room). Protagonist (uniform, back view
from doorway; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-solo]) stepping in, hand on the door frame, facing an awkward but warm
unfamiliar space — mismatched chairs, club posters/instruments/props on the walls, a few
blurred club members glancing over. Soft daylight through windows. A faint nervous-friendly air.
Mood: 처음 연 동아리방의 어색한 공기 — first-step warmth, new belonging. discovery/warm.
```
> c2(자율)는 memorySlotDraft 없음 → CG 미작성.

---

## 🔴 graduation-prep-high — 졸업 준비 (거울 앞)

**발동**: Y7, W45 (money-sink.ts). **회고 Y7 히어로 가치 큼**(growth/breakthrough/8).
**Scene**: 수능 끝, 졸업식 다음 주. 졸업 정장 입고 거울 앞 낯선 얼굴. "마지막"의 무게.

**References**: `player_m_high_*`, `classroom_high.png`(또는 거울 있는 실내), 교정 사진 소품

### [c0] 제대로 준비한다 (growth/breakthrough/8)

**공통** `high/graduation-prep-high_c0.png`
```
A 19-year-old Korean student standing before a mirror, wearing a rented graduation suit/formal
outfit (NOT the school blazer — this is post-수능 graduation prep). The reflection shows an
unfamiliar, more grown-up face looking back — the moment of seeing oneself as no longer a
high schooler. Soft afternoon light. Back-and-mirror composition (we see them from behind +
their reflection): the reflected FACE and formal outfit read the CHOSEN GENDER (`_m` suit + tie,
short center-part hair / `_f` formal skirt-suit or dress, shoulder-length hair) — [분기-solo].
On a nearby surface: a framed school-campus photo / a few
keepsakes. Quiet, weighty stillness.
Mood: 거울 속 낯선 얼굴 — coming-of-age breakthrough, the threshold of leaving. 묵직하고 벅참.
```
> c1은 무드래프트(간소화 선택) → CG 미작성.

---

# P1 — 졸업 NPC 체인 (★중요: memorySlotDraft 추가됨 → 회고 노출. P1으로 작성)

> 촬영 리스트엔 "P1 아님"으로 적혀 있을 수 있으나, 방금 `memorySlotDraft`가 추가되어 회고 갤러리에 뜬다(소스 확인 완료). **P1으로 작성.**
> 각 이벤트는 drafts 달린 choice만 CG 작성. 대학질문/현실응답 등 무드래프트 choice는 제외.

---

## 🔴 subin-farewell — 각자의 하늘로 (수빈, 항공서비스학과)

**발동**: Y7, subin intimacy≥70, W40+ (subin.ts). 배경: 학원 앞 가로등(저녁).
**Scene**: 졸업 임박. 학원 앞에서 기다리던 수빈이 "항공서비스학과 원서 넣었어. 엄마 설득이 제일 힘들었는데 해냈어."

**References**: `subin_high_fullbody.png` + `_neutral.png`, `player_m_high_*`, (학원 앞 거리 + 가로등, 저녁)

### [c0] "꼭 되길 바라, 비행기에서 잘 어울릴 거야" (reconciliation/warm/8)

**공통** `high/subin-farewell_c0.png`
```
Evening street in front of a hagwon, under a single warm streetlamp. Subin (subin_high reference —
short black bob, gold star earrings, navy blazer + red ribbon high-school uniform) standing beneath
the lamp, smiling brightly and openly — a rare unguarded radiant smile. The protagonist (uniform,
3/4 / back facing her; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-NPC: 수빈 초점 유지]) facing her. Soft pools of streetlamp light, blue evening dusk around,
the hagwon sign dim behind. A sense of two paths about to diverge skyward.
Dialogue cue: "각자의 하늘로 간다" — heading to their own skies.
Mood: 가로등 아래 환하게 웃는 수빈 — warm farewell, proud send-off. reconciliation/warm (imp 8).
```

### [c1] "좀 아쉽다... 근데 멋있다" — 솔직하게 (reconciliation/melancholy/7)

**공통** `high/subin-farewell_c1.png`
```
Same hagwon-front streetlamp scene, evening. Subin (subin_high reference — short black bob, gold
star earrings) and the protagonist (uniform, 3/4 / back facing her; `_m` navy tie + trousers / `_f`
red ribbon + plaid skirt visible — [분기-NPC: 수빈 초점 유지]) standing a little apart under the lamp,
the goodbye lingering — Subin with a softer, wistful
smile, perhaps a small wave or a "let's keep in touch" gesture at the end of the conversation.
Cooler, more melancholy blue-dusk tone than c0, the streetlamp a small warm island.
Dialogue cue: 아쉽다는 말끝에, 어디서든 연락하겠다던 수빈.
Mood: 아쉬움이 묻은 작별 — bittersweet, reconciliation/melancholy.
```

---

## 🔴 yuna-smile — 음대를 택한 웃음 (유나, 노을 교실)

**발동**: Y7, yuna intimacy≥45, W40+ (yuna.ts). 배경: 노을 교실(`classroom_high_sunset`).
**Scene**: 졸업 임박. 유나가 평소보다 환하게 "나 음대 갈 거야, 피아노. 엄마랑 크게 싸웠는데 이번엔 안 지려고."

**References**: `yuna_high_fullbody.png` + `_neutral.png`, `player_m_high_*`, `classroom_high_sunset.png`

### [c0] "잘했다, 유나. 네 피아노 진짜 좋았어" — 진심 (growth/breakthrough/8)

**공통** `high/yuna-smile_c0.png`
```
High-school classroom drenched in sunset light (classroom_high_sunset reference), warm orange
glow flooding through the windows. Yuna (yuna_high reference — caramel wavy hair, star hair clip
on right side, navy blazer high-school uniform, colorful scrunchie bracelet) facing the protagonist
with a bright, triumphant smile — the smile of someone who has WON a hard fight, not just a cheerful
one. Eyes a little glassy with resolve. The protagonist (uniform, 3/4 / back facing her; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 유나 초점 유지]) before
her. Empty classroom, golden hour, dust motes in the light.
Dialogue cue: 이겨낸 사람의 웃음으로 음대를 택했다고.
Mood: 싸워서 이겨낸 자의 환한 웃음 — growth/breakthrough, hard-won self-determination. (imp 8)
```

### [c1] "나중에 연주회 하면 꼭 갈게" — 약속 (reconciliation/warm/7)

**공통** `high/yuna-smile_c1.png`
```
Same sunset classroom (classroom_high_sunset reference). Yuna (yuna_high reference) holding out
her PINKY for a pinky-promise, a warm bright grin, sunset light catching the star hair clip.
Protagonist's hand reaching to hook pinkies (hands-focused, gender-neutral framing). Golden glow,
intimate friendly warmth.
Dialogue cue: 연주회에 꼭 오라며, 유나가 새끼손가락을 걸었다.
Mood: 새끼손가락 약속의 따뜻함 — reconciliation/warm, a promise to come to her recital.
```

---

## 🔴 jihun-promise — 옥상의 약속 (지훈, 졸업)

**발동**: 졸업 임박, jihun intimacy≥70, W40+ (jihun.ts). 배경: 옥상 바람(`rooftop_sunset` / `rooftop`).
**Scene**: 지훈이가 옥상으로 부름. 바람. "우리 진짜 오래 알았다, 그치? 초등학교 때부터."

**References**: `jihun_high_fullbody.png` + `_neutral.png`, `player_m_high_*`, `rooftop_sunset.png`

### [c0] "앞으로도 계속 친구하자" — 약속 (reconciliation/warm/8)

**공통** `high/jihun-promise_c0.png`
```
School rooftop, wind blowing, late-afternoon/sunset sky (rooftop_sunset reference). Jihun
(jihun_high reference — messy black hair tousled by wind, athletic build, navy blazer worn
casually) and the protagonist (uniform, side/3/4 beside jihun; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-NPC: 지훈과 나란히]) standing side by side at the
rooftop fence, looking out at the distance, hair and ties caught in the wind. A quiet promise
in the air, both faintly smiling. No basketball (still, windswept moment). Warm sky, long light.
Dialogue cue: 옥상 바람 속에서, 계속 친구하자고 약속했다.
Mood: 바람 부는 옥상의 우정 약속 — reconciliation/warm, childhood friends at the threshold. (imp 8)
```

### [c1] "너 없었으면 학교생활 재미없었을 거야" — 고마움 (reconciliation/warm/8)

**공통** `high/jihun-promise_c1.png`
```
Same windswept rooftop at sunset (rooftop_sunset reference). Close on Jihun (jihun_high reference —
messy black hair, athletic build) turning toward the protagonist, his bright grin faltering — eyes reddening, brimming, the energetic
boy moved to the edge of tears. The protagonist facing him (3/4 / back; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 지훈 초점 유지]). Wind,
warm sunset glow, a rare vulnerable beat for Jihun.
Dialogue cue: 너 없으면 재미없었을 거라 하자, 지훈이 눈이 붉어졌다.
Mood: 처음 보는 지훈의 붉어진 눈 — reconciliation/warm, the tough friend's hidden softness. (imp 8)
```

---

## 🔴 junha-cook — 요리사의 꿈 (준하, 옥상 도시락)

**발동**: Y7, junha intimacy≥50, W8+ (junha.ts). 배경: 옥상(`rooftop_sunset` / `rooftop`).
**Scene**: 점심시간 옥상, 준하가 직접 만든 도시락을 꺼내며 "나 요리사 될 거야. 엄마 식당 보면서 음식이 사람을 편하게 만든다고 느꼈어."
> 선택지 순서(코드): c0="멋있다, 너한테 딱 맞아"(draft), c1="대학은?"(현실질문 — **CG 불필요**), c2="언젠가 네 가게에 갈게"(draft).

**References**: `junha_high_fullbody.png` + `_neutral.png`, `player_m_high_*`, `rooftop_sunset.png`

### [c0] "멋있다. 너한테 딱 맞는 것 같아" — 응원 (growth/warm/7)

**공통** `high/junha-cook_c0.png`
```
School rooftop at lunchtime, warm daylight/early sunset (rooftop / rooftop_sunset reference).
Junha (junha_high reference — short messy dark brown hair, THICK straight eyebrows, sturdy build,
slightly ill-fitting navy blazer, earnest warm face) sitting with a home-made lunchbox (도시락)
open between them, neatly packed rice balls visible. The protagonist (uniform, 3/4 / back,
3/4 / back facing him; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-NPC: 준하 초점 유지]) facing him, an encouraging air. Junha's face proud and a little shy as he
declares his dream. Breeze, open sky behind.
Dialogue cue: 요리사가 되겠다는 준하를, 다들 응원할 거라 했다.
Mood: 옥상 도시락 위로 전한 응원 — growth/warm, supporting a friend's calling.
```

### [c2] "언젠가 네 가게에 갈게" — 약속 (reconciliation/warm/7)

**공통** `high/junha-cook_c2.png`
```
Same rooftop lunch scene (rooftop / rooftop_sunset reference). Junha (junha_high reference — thick
straight eyebrows, ill-fitting blazer) breaking into a wide, genuinely moved smile — the awkward
transfer student fully at ease now — as the protagonist (uniform, 3/4 / back facing him; `_m` navy
tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-NPC: 준하 초점 유지]) promises to be the
first customer at his future restaurant. The open home-made
lunchbox between them. Warm breeze, open sky. A handshake or a fist-bump of a promise.
Dialogue cue: 네 가게 첫 손님이 되겠다고, 옥상에서 약속했다.
Mood: 첫 손님 약속의 따뜻함 — reconciliation/warm, a promise sealed on the rooftop.
```
> c1(대학질문)은 memorySlotDraft 없음 → CG 미작성.

---

## 🔴 minjae-dream — 의대가 전부야? (민재, 옥상)

**발동**: Y6+, minjae intimacy≥65 (minjae.ts). 배경: 옥상(`rooftop_sunset` / `rooftop`).
**Scene**: 점심시간 옥상, 한참 말없이 서 있다가 민재가 "나 의사 되고 싶은 건지 모르겠어. 그냥 가장 틀리지 않는 대답이라서 의대라고 한 거야."
> 선택지 순서(코드): c0="그럼 뭘 하고 싶어?"(draft, discovery/melancholy), c1="일단 가서 생각해도"(현실응답 — **CG 불필요**), c2="네가 정하는 거야, 네 인생이잖아"(draft, growth/resolve).

**References**: `minjae_high_fullbody.png` + `_neutral.png`, `player_m_high_*`, `rooftop_sunset.png`

### [c0] "그럼 뭘 하고 싶어?" — 물어본다 (discovery/melancholy/7)

**공통** `high/minjae-dream_c0.png`
```
School rooftop, wind, fading light (rooftop_sunset reference). Minjae (minjae_high reference —
thin silver square-frame / rimless GLASSES clearly visible, neat short hair, pale skin, navy
blazer properly buttoned, composed half-smile) standing at the rooftop edge, but for once the
composure cracks — a rare honest, uncertain, almost lost expression behind the glasses, looking
out rather than at the protagonist. The protagonist (uniform, 3/4 / back beside him; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 민재 초점 유지]) beside
him. No notebook (rooftop scene — set aside/omitted). Quiet, melancholy dusk wind.
Dialogue cue: 모르는 게 제일 무섭다던 민재가, 처음으로 솔직했다.
Mood: 처음 보는 민재의 솔직함 — discovery/melancholy, the top student's hidden fear.
```

### [c2] "네가 정하는 거야. 네 인생이잖아" — 단호하게 (growth/resolve/8)

**공통** `high/minjae-dream_c2.png`
```
Same rooftop at dusk (rooftop_sunset reference). Minjae (minjae_high reference — glasses clearly
visible, neat hair, navy blazer) holding out a FIST for a fist-bump, wordless, his composed mask
softened into something real and resolved. The protagonist's fist meeting his (hands-focused,
gender-neutral) — a quiet "쿵." Wind, last light. No notebook in hand.
Dialogue cue: 네 인생이라 하자, 민재가 말없이 주먹을 내밀었다. 쿵.
Mood: 말없는 주먹 쿵 — growth/resolve, mutual recognition between rivals-turned-friends. (imp 8)
```
> c1(현실응답)은 memorySlotDraft 없음 → CG 미작성.

---

# P2 — 마일스톤 ANNUAL (EventResultScreen)

> ANNUAL이라 기억 슬롯엔 안 남지만 EventResultScreen에서 CG로 학년 변곡점 연출. 대개 공통 1장.

---

## 🟡 high-school-entrance — 고등학교 입학 (Y5, W1)

**Scene**: 고등학생이 됐다. 교문 앞에서 한 번 멈춤. "수능까지 3년." (`school_gate_high`)

**References**: `jihun_high_fullbody.png`, `player_m_high_*`, `school_gate_high.png`

**공통** `high/high-school-entrance.png`
```
In front of a Korean high-school gate in spring (school_gate_high reference), morning. A
17-year-old protagonist in a crisp new high-school uniform (`_m` navy blazer + navy tie + chest crest / `_f` navy blazer + red ribbon + plaid skirt + chest crest — [분기-solo])
pausing at the gate, looking up at the school — a mix of tension and resolve. Jihun (jihun_high
reference — messy black hair, athletic build, basketball keychain on bag) beside or just behind,
grinning. Other new students streaming in, cherry blossoms or fresh spring trees. Banner/sign of
the school faintly visible.
Dialogue cue: "수능까지 3년" — the real beginning.
Mood: 새 출발의 긴장과 설렘 — fresh start, the weight of three years ahead.
```

---

## 🟡 high2-track-select — 문·이과 선택 (Y6, W1)

**Scene**: 고2. 담임이 문·이과 선택지 종이를 나눠줌. "한 번 정하면 돌이킬 수 없다." 웅성거리는 교실.
> 선택지 순서(코드 확인): **c0 = 문과**, **c1 = 이과** (엔진 선택지 2개, c2 없음). 두 갈래 CG.

**References**: `player_m_high_*`, `classroom_high.png`

### [c0] 문과 — 사람과 사회를 공부하고 싶다

**공통** `high/high2-track-select_c0.png`
```
High-school classroom (classroom_high reference), a track-selection paper (문·이과 선택지) being
handed out, students murmuring. (종이 글자는 깔끔·비거울상; 선택 칸 라벨 외 잔글씨는 흐리게.) The protagonist (uniform, 3/4; `_m` navy tie / `_f` red ribbon + plaid skirt — [분기-solo]) holding the
paper, pen hovering over the HUMANITIES (문과) choice, a thoughtful resolved expression. Soft
daylight, blurred classmates debating around. Books leaning toward literature/social-studies on
the desk as a subtle cue.
Mood: 돌이킬 수 없는 선택 앞의 결심 — humanities path.
```

### [c1] 이과 — 수학·과학이 더 적성에 맞는다

**공통** `high/high2-track-select_c1.png`
```
Same classroom track-selection scene (classroom_high reference). Protagonist (uniform, 3/4;
`_m` navy tie / `_f` red ribbon + plaid skirt — [분기-solo]) marking the SCIENCE (이과) choice, pen on the science track line, determined.
Subtle cue: math/science workbook on the desk. Blurred murmuring classmates.
Mood: 이과를 택하는 결단 — science path.
```
> 예산상 갈래 구분이 부담이면 공통 1장(`high/high2-track-select.png` — 종이 받아드는 교실 일반 컷)으로 타협 가능.

---

## 🟡 high3-start — 고3 첫날 (Y7, W1)

**Scene**: 마지막 학년 첫날. 칠판 위 "D-xxx" 카운트다운. 무거운 교실 분위기. 지훈이 등장.

**References**: `jihun_high_fullbody.png`, `player_m_high_*`, `classroom_high.png`

**공통** `high/high3-start.png`
```
High-school classroom on the first day of senior year (classroom_high reference), heavy somber
mood. A "D-xxx" countdown to 수능 written above the blackboard (깔끔·비거울상, 살짝 흐리게). Students at desks, subdued.
Protagonist (uniform, 3/4 / back; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-solo]) seated, facing forward toward the blackboard
like everyone else; Jihun (jihun_high reference — messy black hair) at a nearby desk, unusually
quiet for him. Morning light, the gravity of the final year settling in.
Mood: 12년이 이 한 해로 끝난다 — the weight of the last year, hushed resolve.
```

---

## 🟡 suneung-eve — 수능 전날 밤 (Y7, W34)

**Scene**: 내일이 수능. 방에 앉아 아무것도 손에 안 잡힘. 엄마가 방문 열고 "...잘 할 수 있어." (`bedroom_night`)

**References**: `player_m_high_neutral.png`, `mother_middle_neutral.png`, `bedroom_night.png`

**공통** `high/suneung-eve.png`
```
A high schooler's bedroom at night the day before 수능 (bedroom_night reference), warm desk lamp,
deep-night window. The protagonist (loungewear, late-autumn night; 3/4 / back, gender via hair/build — `_m` short center-part / `_f` shoulder-length — [분기-solo])
sitting at the desk unable to focus, study materials untouched. The bedroom door open with the
mother (mother_middle_neutral reference — early-40s, knit cardigan, gentle face) standing in the
doorway, soft hallway light behind her, offering quiet reassurance.
Dialogue cue: "...잘 할 수 있어."
Mood: 12년의 끝을 앞둔 밤 — tender pre-exam stillness, a mother's quiet support.
```

---

## 🟡 suneung-done — 수능 끝 (Y7, W36)

**Scene**: 시험장을 나선 맑은 하늘. 우는 애, 웃는 애, 멍한 애. (`clear_sky`)
> 선택지: c0="친구들과 치킨", c1="혼자 걸어서 집", c2="바로 채점". c0/공통.

**References**: `jihun_high_fullbody.png`, `minjae_high_fullbody.png`, `player_m_high_*`, `clear_sky.png`, (치킨집 실내)

### [c0] 친구들과 치킨을 먹으러 간다

**공통** `high/suneung-done_c0.png`
```
A cozy Korean chicken restaurant (치킨집) right after 수능, late afternoon/early evening. A small
group of 19-year-old students around a table with fried chicken and drinks, the giddy exhausted
relief of the exam being over. Jihun (jihun_high reference — messy black hair, athletic build,
big grin) mid-cheer; Minjae (minjae_high reference — thin square/rimless GLASSES clearly visible,
neat hair, composed half-smile finally relaxing, NO notebook — celebration scene) beside him.
Protagonist (uniform or casual, 3/4 / back facing the table; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 지훈·민재 초점 유지]) at the table. Warm restaurant lighting,
clear bright sky visible through a window.
Dialogue cue: 끝났다, 정말로 — friends celebrating the end of 12 years.
Mood: 수능 끝의 후련함 — joyous exhausted relief.
```
> ★ 5인급 아님이나 친구 2인 등장 → minjae 안경/jihun 머리 마커 직접 명시(혼동 방지). minjae 노트북 생략(축하 컷).

### [공통 폴백] `high/suneung-done.png`
```
Stepping out of the exam hall under an unusually clear bright sky (clear_sky reference). A
crowd of students — some crying, some laughing, some standing dazed. The protagonist (uniform,
back view; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-solo]) walking out into the open light, the long road of 12 years behind them.
Wide cinematic sky.
Mood: 12년의 끝 — the strange quiet of finishing.
```

---

## 🟡 high-school-graduation — 졸업식 (Y7, W46) ★5인 단체

**Scene**: 졸업식 날. 강당에서 졸업장. 교실 칠판 "졸업 축하해. 우리 모두 수고했어." 지훈·수빈·민재·유나·준하와 마지막 인사·눈물. (`auditorium_high`)
> 선택지: c0="친구들과 마지막 인사", c1="빈 교실 혼자", c2="뒤돌아보지 않고 교문". c0/공통.

**References**: `jihun_high_fullbody.png`, `subin_high_fullbody.png`, `minjae_high_fullbody.png`, `yuna_high_fullbody.png`, `junha_high_fullbody.png`, `player_m_high_*`, `auditorium_high.png`

### [c0] 친구들과 마지막 인사를 나눈다 (★5인 단체 — 각 인물 마커 직접 명시)

**공통** `high/high-school-graduation_c0.png`
```
High-school graduation day in the auditorium / just outside it (auditorium_high reference). The
protagonist (high-school uniform, 3/4 / back; `_m` navy tie + chest crest / `_f` red ribbon + plaid skirt + chest crest — [분기-NPC: 5인 단체 초점 유지]) surrounded
by five close friends for a final goodbye, eyes red, bittersweet smiles, some holding diplomas /
bouquets. Each friend MUST be individually identifiable by their core marker:
- Jihun: messy black hair, athletic build, broad shoulders, bright grin (now teary)
- Subin: short black BOB, gold STAR EARRINGS, calm composed face
- Minjae: thin silver SQUARE/rimless GLASSES, neat short hair, pale skin, composed half-smile
  (NO notebook — graduation scene)
- Yuna: caramel WAVY hair, STAR HAIR CLIP on right side, no glasses, bright expression
- Junha: short messy dark brown hair, THICK straight eyebrows, sturdy build, slightly ill-fitting
  blazer, earnest warm smile
Auditorium lighting / soft daylight, a banner or chalkboard "졸업 축하해" faintly behind.
Mood: 마지막 인사와 눈물 — the warm ache of parting, 12 years ending together.
```
> ⚠️ 5인 단체라 마커 충돌 위험 최상 → 위처럼 각 인물 핵심 마커를 한 줄씩 직접 명시. minjae 노트/jihun 농구공 등 prop은 졸업 정적 컷이라 전부 생략(spec L397, PR #164).

### [공통 폴백] `high/high-school-graduation.png`
```
Empty high-school classroom after the graduation ceremony (or auditorium_high reference),
late afternoon. The blackboard faintly reads "졸업 축하해. 우리 모두 수고했어." (흐리게 — c0와 동일 처리). Empty desks, soft light.
Protagonist (uniform, back view; `_m` navy tie + trousers / `_f` red ribbon + plaid skirt visible — [분기-solo]) taking one last look at the room.
Mood: 12년의 끝 — quiet sentimental closure.
```

---

## 🟡 mock-exam-prep — 전국 모의고사 전주 (Y≥5, W11)

**Scene**: 다음 주 전국 모의고사. "이번 모의는 수능 출제 방식이랑 똑같아." 긴장된 교실.

**References**: `player_m_high_*`, `classroom_high.png`

**공통** `high/mock-exam-prep.png`
```
High-school classroom the week before a nationwide mock exam (classroom_high reference). The
homeroom teacher (calm adult, simple shirt/cardigan) addressing the class about the mock mirroring
the 수능 format. Students with a tense focus, workbooks/past-papers open. Protagonist (uniform,
3/4 / back; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-solo]) at a desk, listening, a knot of nerves. Daylight through windows.
Dialogue cue: "이번 모의는 수능 출제 방식이랑 똑같아."
Mood: 첫 본격 모의의 긴장 — the pressure ramping up.
```

---

## 🟡 mock-exam-prep-2 — 9월 모의고사 (Y≥5, W32)

**Scene**: 9월 모의고사. "이번 모의 성적이 수시 지원 기준이야." 조용해진 교실.

**References**: `player_m_high_*`, `classroom_high.png`

**공통** `high/mock-exam-prep-2.png`
```
High-school classroom as the September mock exam approaches (classroom_high reference), an
even more hushed, heavier atmosphere than mock-exam-prep. The teacher's words about this mock
being the basis for 수시 (early admission) applications hang in the air; the room goes quiet.
Protagonist (uniform, 3/4 / back; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-solo]) at a desk, the gravity of college admissions
settling in. Slightly cooler late-summer/early-autumn light.
Dialogue cue: "이번 모의 성적이 수시 지원 기준이야."
Mood: 입시 현실이 무겁게 내려앉은 교실 — the quiet weight of admissions.
```

---

## 📎 작성 범위 밖 (참고)

- `midterm-1` / `final-exam-2`: Y≥2 중·고 공통 자산. 촬영 리스트 권고 §A에 따라 별도 관리 → **본 high 문서 미작성**(중복 회피).
- mini-talk 80단계(`talk_jihun_90_bench` 등): 촬영 리스트 권고 §B에 따라 `common/` 1장 권고 → high 디렉토리 미작성 대상.
- `school-festival`/`yuna-study`는 **high 디렉토리 버전만** 본 문서에 포함했고(아래), `subin-dream`(승무원 꿈, draft 없음 — Y5)은 회고 미노출이라 제외.

---

## 🟠 school-festival (고등분) — 학교 축제 푸드트럭

**발동**: Y≥2 (중·고 공통), W30 (school.ts). **본 문서는 high 버전만**. 파일 `high/...`.
**Scene**: 축제 준비, 우리 반 푸드트럭. 수빈이 "홍보는 내가 할게, 누가 같이 하자~" (`festival_classroom` — 없으면 `classroom_high` 축제 데코)

**References**: `subin_high_fullbody.png`, `player_m_high_*`, `classroom_high.png`(축제 준비 데코)

### [c0] "나도 할게!" — 수빈이랑 홍보 담당 (courage/resolve/5)

**공통** `high/school-festival_c0.png`
```
A high-school classroom decorated for a festival food-truck booth (festival prep — posters,
streamers; classroom_high reference repurposed). Subin (subin_high reference — short black bob,
gold star earrings, navy blazer high-school uniform) and the protagonist (uniform, 3/4 beside subin;
`_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 수빈과 함께]) putting up a promo poster together, a shared determined glance between them.
Bright, lively festival energy. Other students bustling, blurred.
Mood: 홍보를 맡으며 맞잡은 눈짓 — courage/resolve, stepping up together.
```

### [c1] "회계 할게" — 뒤에서 조용히 (discovery/warm/4)

**공통** `high/school-festival_c1.png`
```
Same festival classroom (classroom_high reference, festival decor). Close on a ledger/account
book at the booth, the protagonist's hand writing sales figures in one corner (hands-focused,
gender-neutral). Warm festival lighting, blurred busy classmates behind. A quiet contribution
from the back.
Mood: 장부 귀퉁이에 적는 내 글씨 — discovery/warm, quiet behind-the-scenes belonging.
```

### [c2] "나 몸이 안 좋아서..." — 불참 (failure/regret/5)

**공통** `high/school-festival_c2.png`
```
A dim quiet room (bedroom or empty classroom), the protagonist (back view / lying back; gender via hair/build — `_m` short center-part / `_f` shoulder-length — [분기-solo]) staring at the ceiling, a phone glowing with a group-chat full of festival
photos they're not in. The warm festival happening elsewhere, felt only through the screen.
Mood: 단톡 축제 사진 보며 천장만 — failure/regret, the ache of opting out.
```

---

## 🟠 yuna-study (고등분) — 도서관에서 수학 7번

**발동**: academic≥50 & year≠7 (Y5~6 high 구간), W34 (school.ts). **본 문서는 high 버전만**. 파일 `high/...`.
**Scene**: 유나가 씩 웃으며 "나 수학 7번 도저히 모르겠거든? 너 잘하잖아, 좀 알려줘!" (`library_high`)

**References**: `yuna_high_fullbody.png`, `player_m_high_*`, `library_high.png`

### [c0] "그래, 같이 하자" — 가르쳐준다 (discovery/warm/5)

**공통** `high/yuna-study_c0.png`
```
High-school library (library_high reference), study desks, soft daylight. Yuna (yuna_high
reference — caramel wavy hair, star hair clip on right side, navy blazer high-school uniform,
scrunchie bracelet) leaning over a math problem (no. 7), bright impressed expression as the
protagonist (uniform, 3/4 beside yuna; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 유나 초점 유지]) explains it, pointing at the workbook. Open books,
pencils, quiet library warmth.
Dialogue cue: "너 천재 아냐?" — the satisfaction of teaching a friend.
Mood: 같이 푸는 도서관 — discovery/warm, easy studious camaraderie.
```

### [c1] "미안, 나도 바빠서..." — 거절 (betrayal/regret/5)

**공통** `high/yuna-study_c1.png`
```
Same high-school library (library_high reference). Yuna (yuna_high reference — caramel wavy hair, star hair clip) turning away
lightly, a small disappointed-but-okay shrug, her back to the protagonist as she walks off
between the shelves. Protagonist (uniform, 3/4 / back; `_m` navy tie / `_f` red ribbon + plaid skirt visible — [분기-NPC: 유나 뒷모습 초점]) at the desk, the refusal lingering.
Quiet daylight, the missed connection.
Mood: 가볍게 돌아서는 유나 뒷모습 — betrayal/regret, a small turning-away.
```

---

## 📋 작성 이벤트 목록

**P1 기억 이벤트 (6)**: high-panic(c0/c1/c2), identity-crisis(c0/c1/c2), school-trip-high(c0/c1),
club-academy-choice-y5(c0/c1), graduation-prep-high(c0), + school-festival 고등분(c0/c1/c2),
yuna-study 고등분(c0/c1).

**P1 졸업 NPC 체인 (5)**: subin-farewell(c0/c1), yuna-smile(c0/c1), jihun-promise(c0/c1),
junha-cook(c0/c2), minjae-dream(c0/c2). (대학질문/현실응답 등 무드래프트 choice는 CG 미작성.)

**P2 마일스톤 ANNUAL (8)**: high-school-entrance, high2-track-select(c0/c1), high3-start,
suneung-eve, suneung-done(c0/공통), high-school-graduation(c0/공통, 5인), mock-exam-prep, mock-exam-prep-2.

총 CG 장수(대략): P1 기억 ~16 + NPC 체인 ~10 + P2 ~12 = **약 38장**(공통 폴백 포함).
