# Event CG Prompts — 고등학교 도달형(reach) 이벤트 (Y5~Y7)

> **캐스트 복원 Wave 콘텐츠 전용.** 기존 `docs/cg-prompts-high-y5-y7.md`(crisis·money-sink 마일스톤·졸업 self-condition 체인)와
> **이벤트 계열이 다르다.** 본 문서는 `reach` 필드가 달린 **39개 친밀도 도달형 이벤트**(jihun-hs-*, subin-hs-*,
> minjae-hs-*, yuna-hs-*, junha-hs-*, haeun-hs-*, **신규 NPC** seoa-*, siwoo-*, yerin-*)를 다룬다.
> 두 문서를 합쳐야 고교 CG 전수가 된다(겹치는 이벤트 없음).
>
> 포맷·공통 스타일·교복 앵커는 `cg-prompts-high-y5-y7.md` §공통 스타일 가이드를 **그대로 상속**한다.
> 캐릭터 외형 마커 SSOT는 `docs/character-prompt-spec.md`. 본 문서는 reach 고유의 **델타(신규 NPC 마커·신규 배경·범위 규칙)**만 명시.
>
> **작성 범위(확정)**: 풀(C) — 회고 draft 달린 모든 선택지 per-choice + 무draft 이벤트는 공통 1장. **총 77컷.**

---

## 🎨 공통 스타일 — 상속

`cg-prompts-high-y5-y7.md`의 Art style / Era / Uniform / Negative prompt / 계절 의상표 / "고등 단계 공통 오버라이드"
(17~19세, 고교 교복, 약간 더 큰 키·성숙한 비율·진지한 표정, player_m navy tie + 가슴 crest)를 **전부 동일 적용**.

> **[전 컷 공통 금지]** ① 소품·종이의 **읽히는 글자/뒤집힌(거울상) 텍스트** 금지(간판·게시판은 흐리게 처리) ② **명세에 없는 가구·테이블·받침대·소품 추가 금지**(인물이 소품을 직접 들거나, 명세가 지정한 표면에만) ③ **캔은 빨대 없는 평평한 일반 풀탭**, 브랜드/텍스트 없음.

> 본 reach 이벤트는 전부 **친구 1:1 정서 컷**(군중·단체 없음, 졸업 강당 컷도 인물은 둘).
> **성별 방침(2026-07-01 개정): 전 컷 남/여 주인공 분기(`_m`/`_f`).** 초기엔 "성별무관 뒷모습" 공통 1장으로 설계했으나,
> 실제 생성 결과 gender-neutral 프레이밍이 **전부 남주로 렌더**되는 것이 확인돼(교복·체형 단서가 남주로 기울음) 방침을 전환.
> - 각 컷을 **남주판 + 여주판 2장**으로 발주. 남주 = navy tie(+가슴 crest), 여주 = red ribbon + plaid skirt.
> - 레퍼런스: `_m`은 `player_m_high_*`, `_f`는 `player_f_high_*`(실재). NPC·배경·씬 프롬프트·모티프는 두 판 동일, 주인공 성별 표현만 다름.
> - 77 유니크 컷 × 2 = **154컷**. (jihun femaleChoices는 대사 분기라 CG 구도엔 무관 — `_f`판은 여주 외형만 반영.)

## 📁 파일명 + 폴백

전부 남/여 분기: draft 선택지 = `{eventId}_c{ci}_{g}.png`, 무draft 이벤트 공통 = `{eventId}_{g}.png` (g = m/f). 전부 `public/images/events/high/`.
폴백 cascade: `high/{id}_c{ci}_{g}` → `high/{id}_{g}` → `high/{id}_c{ci}` → `high/{id}` → `common/...`.
→ **draft 선택지엔 per-choice(×성별), 무draft 선택지는 같은 이벤트의 `{id}_{g}.png` 공통으로 폴백.**
→ 기존 생성된 남주 31컷은 `_m` 접미사로 리네임 완료(재활용). `_f`판만 신규 생성하면 됨.

---

## 🧩 배경 에셋 의존성 (촬영 선행 조건)

reach 이벤트가 쓰는 배경 13종 중 **6종 미존재** — 신규 발주 또는 대체 필요:

| 배경 | 상태 | 사용 이벤트 | 대체안 |
|---|---|---|---|
| classroom_high / _afternoon / _sunset | ✅ 존재 | 다수 | — |
| auditorium_high · gymnasium · cafe_study · rooftop_sunset · school_gate_high | ✅ 존재 | 졸업/체육/카페/옥상/교문 | — |
| **night_bus** | ✗ 신규 | jihun-hs-latenight | (없음) 밤 시내버스 실내. **신규 발주 권장** |
| **bus_stop_evening** | ✗ 신규 | jihun-hs-firstgap, siwoo-last-signal | 저녁 정류장/횡단보도. **신규 발주** |
| **counseling_hallway** | ✗ 신규 | jihun-hs-track, minjae-hs-choice, siwoo-hobby-seat | `hallway_high.png`로 대체 가능(진학실 게시판 데코) |
| **school_bench** | ✗ 신규 | jihun-hs-injury | 보건실 침대 정경. `classroom_high` 실내 톤으로 임시 대체 가능, 신규 권장 |
| **music_room_middle** | ✗ (high엔 없음) | yuna-hs-piano, yuna-hs-recital | `music_room.png`(범용) 존재 → **대체 사용** |
| **school_entrance_rain** | ✗ 신규 | siwoo-demolished-ground | 철거 골목 빗속. `school_gate_high_rain`은 톤 불일치 → **신규 발주 권장** |

> ⚠️ 신규 NPC **seoa/siwoo/yerin은 캐릭터 레퍼런스(portrait/fullbody) 미제작**(character-prompt-spec §체크리스트 미체크).
> 이들이 등장하는 컷(seoa 9·siwoo 13·yerin 14 = 36컷)은 **포트레이트/풀바디 발주(Track A) 선행** 후 촬영. 본 명세의 마커로 발주 가능.

---

## ⚠️ 캐릭터 외형 마커

**기존 6인**(jihun·subin·minjae·yuna·junha·haeun): `cg-prompts-high-y5-y7.md` §캐릭터 외형 강제 마커(고등 단계)를 **그대로 인용**.
핵심 cue만 재확인 — jihun=메시 검정머리+농구공키체인, subin=검정보브+금별귀고리, minjae=얇은 사각/림리스 안경+무가당두유, yuna=카라멜웨이브+별 머리클립, junha=굵은 직선눈썹+도시락+부산, haeun=둥근 검은테 안경+빨간책/방송부 대본.

**신규 3인**(spec L575/635/668 — 고등 stage 오버라이드 적용):

### seoa (윤서아, 고등 — 조용한 작가지망·이어폰) — spec L575
```
[REQUIRED visual markers — high stage]
- Long straight dark brown hair, slightly past shoulders, simple hair clip on one side
- NO glasses (glasses are minjae/haeun). Deep brown thoughtful, slightly dreamy eyes
- Slim delicate frame
- High-school: navy blazer + white shirt + red ribbon + plaid skirt, 18~19, more mature proportions
- Signature props: a single EARPHONE cord (often only ONE earbud in, the other dangling), a thin NOTEBOOK / torn notebook PAGE
- Quiet observant air, slight shy/distant half-smile. Differs from yuna: longer straight hair (vs caramel wave), NO clip-as-star, earphones+notebook (vs piano), dreamy (vs lively)
```

### siwoo (한시우, 고등 — 관찰자·건축꿈·드라이) — spec L635
```
[REQUIRED visual markers — high stage]
- Medium-length dark brown hair slightly covering the forehead, natural messy
- Sharp but calm dark brown eyes, observant slightly guarded; reserved half-smile, "watching not engaging"
- Tall and lean, slightly SLOUCHED posture, hands often in pockets, sleeves a touch too long
- Navy blazer worn casually (top button undone), white shirt
- Signature prop: SILVER TUMBLER (thermos) hanging from bag strap or held in hand
- Differs from junha: leaner/taller, more reserved, no thick brows; from player_m: messier forehead-covering hair, slouch, tumbler
```

### yerin (강예린, 고등 — 사회전략가·계산형 외향·입시맘) — spec L668
```
[REQUIRED visual markers — high stage]
- Medium-length dark brown hair (shoulder-length, slight wave at the ends), neatly styled, well-maintained — [MUST] 어깨선 길이 유지, 허리/가슴 아래로 내려오는 롱헤어 금지(_m·_f 동일 길이)
- Bright sharp intelligent brown eyes; polite dimpled smile with a subtly CALCULATED composure
- Slim, well-groomed, poised posture
- Navy blazer perfectly FITTED, white shirt + red ribbon neatly tied, plaid skirt, clean loafers
- Signature props: a small PLANNER held at waist, ELEGANT (not star) earrings, a stylish brand backpack
- Differs from subin: longer wavy hair (vs bob), sharper calculated gaze (vs gentle), planner (vs notebook), elegant earrings (vs star earrings)
```

---

# 📅 도달형 이벤트 CG (NPC별)

표기: 🔴 회고 히어로(draft imp≥7) · 🟠 회고(draft imp5~6) · ⚪ 무draft(공통 1장, 인게임 일러스트)

---

## 한지훈 (jihun) — 14컷

> 6인 중 유일하게 femaleChoices 보유(7개). **대사만 분기, CG 구도는 공통.** prop: 농구공은 운동/걷기 컷만, 정적 컷은 생략(PR #164).

### ⚪ jihun-hs-timetable — 다른 반 (t80, Y5)
**배경**: classroom_high(복도 톤) · **공통** `high/jihun-hs-timetable.png`
```
A high-school hallway during a short break (classroom_high / hallway tone). Jihun (messy black
hair, athletic build, navy blazer worn casually, basketball keychain on bag) walking up from the
FAR END of a long corridor, waving, slightly out of breath. The protagonist (uniform, 3/4 / back,
gender-neutral) near a classroom door. Different homeroom name-plates above two doors as a subtle
cue. Daylight through corridor windows.
Mood: 6년 만에 처음 갈린 반 — the small ache of separate classes, a friend who still crosses the hall.
```

### 🟠 jihun-hs-latenight — 야자 끝 버스 (t85, Y5, growth/6)
**배경**: night_bus(신규) · **References**: jihun_high_*, player_m_high_*
- **[c0]** `high/jihun-hs-latenight_c0.png` — "우리 언제부터 할 말 없었지?" *(growth/melancholy/6)*
```
Late-night city bus interior (night_bus), dim warm cabin lights, dark windows streaked with
passing streetlights. Jihun (messy black hair, navy blazer, bag on lap, fiddling with the strap)
seated beside the protagonist (uniform, side/back, gender-neutral). The first words breaking a long
unusual silence between two lifelong friends — Jihun turning with a faint wry smile. Empty late bus.
Mood: 6년 만에 처음 찾아온 침묵을 먼저 깬 밤 — growth/melancholy, comfortable even in the quiet.
```
- **[c1]** `high/jihun-hs-latenight_c1.png` — 말없이 이어폰 한쪽을 건넨다 *(growth/warm/6)*
```
Same late-night bus (night_bus). The protagonist (gender-neutral) holding out ONE earbud; Jihun
(messy black hair) taking it, both now sharing a single pair of earphones, looking ahead at the
dark window. One song's worth of quiet. Warm dim cabin, streetlights sliding past.
Mood: 말 없어도 괜찮아진 한 곡 — growth/warm, a shared earbud saying what words can't.
```
- **[c2 폴백·공통]** `high/jihun-hs-latenight.png` — 같이 창밖
```
Same night bus, two friends side by side looking out the dark window at the same passing night,
a short "피곤하지" exchange. Quiet, tired, easy. (covers no-draft c2.)
```

### ⚪ jihun-hs-firstgap — 처음 깜빡한 약속 (t89, Y5)
**배경**: bus_stop_evening(신규) · **공통** `high/jihun-hs-firstgap.png`
```
An evening bus stop / street corner (bus_stop_evening). Jihun (messy black hair, navy blazer,
bag) scratching the back of his head, apologetic, the day after standing the protagonist up for
the first time in years. The protagonist (uniform, 3/4 / back, gender-neutral) facing him. Soft
dusk light, a faint phone glow. A small new distance between busy lives.
Mood: 처음으로 약속을 깜빡한 미안함 — the first crack of growing-up busyness.
```

### ⚪ jihun-hs-track — 갈림길 (t90, Y6)
**배경**: counseling_hallway(=hallway_high 대체) · **공통** `high/jihun-hs-track.png`
```
In front of a career/admissions notice board in a school hallway (hallway_high, repurposed as
진학실 앞 — pinned university/track notices). Jihun (messy black hair, athletic build) lingering
unusually long at the board, not leaving, a touch wistful as paths begin to diverge (체대 준비).
The protagonist (uniform, 3/4 / back, gender-neutral) beside him. Daylight, papers on the board.
Mood: 진로가 갈리기 시작하는 게시판 앞 — friends sensing their roads about to split.
```

### 🔴 jihun-hs-unsaid — 말 못한 한마디 (t93, Y6, growth·failure/7)
**배경**: classroom_high_afternoon(석양) · **References**: jihun_high_*, player_m_high_*
- **[c0]** `high/jihun-hs-unsaid_c0.png` — 끝까지 듣는다 *(growth/breakthrough/7)*
```
Empty high-school classroom at sunset (classroom_high_afternoon / sunset light), long shadows of
desk rows cutting across the floor. Just the two of them. Jihun (messy black hair, navy blazer,
ears faintly red) finally letting out the words he kept swallowing — earnest, vulnerable, eyes not
looking away. The protagonist (uniform, 3/4 / back, gender-neutral) staying, listening. Orange glow.
Mood: 끝까지 기다려 들은, 처음 꺼낸 진심 — growth/breakthrough, the tough friend's rare honesty.
```
- **[c1]** `high/jihun-hs-unsaid_c1.png` — 퇴로를 연다 *(failure/regret/7)*
```
Same sunset classroom (classroom_high_afternoon). Jihun (messy black hair) swallowing the words
back down, a forced "다음에" smile, the moment slipping into the sunset. The protagonist
(gender-neutral) across the desk. Something unsaid sinking into the orange light. A beat of loss.
Mood: 노을 속으로 묻힌 다음이라는 말 — failure/regret, the door left open became an exit.
```
- **[c2]** `high/jihun-hs-unsaid_c2.png` — 분위기를 푼다 *(failure/regret/7)*
```
Same sunset classroom. Jihun (messy black hair) flustered ("긴장은 무슨!"), the joke breaking the
tension — and the timing — so the real words get swallowed again. Lighter surface, the chance gone
underneath. The protagonist (gender-neutral) mid-laugh. Sunset.
Mood: 농담에 떠밀려 지나간 타이밍 — failure/regret, a kindness that closed the window.
```

### ⚪ jihun-hs-injury — 다친 날 (t95, Y6)
**배경**: school_bench(=보건실, classroom_high 임시) · **공통** `high/jihun-hs-injury.png`
```
A school infirmary / nurse's room (soft interior, afternoon light through a curtain). Jihun
(messy black hair, athletic build, in PE/sportswear) sitting on the bed edge, an ankle wrapped,
caught off guard that the protagonist skipped class to come — a pained-but-relieved face. The
protagonist (uniform, 3/4 / back, gender-neutral) beside the bed, offering a drink from a bag.
Curtain-filtered afternoon sun.
Mood: 수업도 제치고 달려온 보건실 — quiet care, the always-fine boy admitting it hurts.
```

### ⚪ jihun-hs-lastgame — 마지막 경기 (t96, Y7)
**배경**: gymnasium · **공통** `high/jihun-hs-lastgame.png`
```
A school gymnasium during Jihun's last high-school game (gymnasium), sparse stands. Jihun (messy
black hair, athletic build, basketball jersey, mid-play or catching breath) glancing up toward the
stands — his gaze landing on the protagonist (uniform / casual, in the stands, 3/4 / back,
gender-neutral) cheering. Court lines, bright gym lighting, a basketball in motion.
Mood: 듬성한 관중석에서 딱 한 사람을 찾는 시선 — the one face he plays for.
```

### 🔴 jihun-hs-graduation — 같은 사진 한 장 더 (t97, Y7, reconciliation/7)
**배경**: auditorium_high(졸업식 후 운동장 구석) · **References**: jihun_high_*, player_m_high_*
> 모티프: 핸드폰 속 **초등 운동회 빛바랜 사진** → "12년치 폴더", 새끼손가락 약속.
- **[c0]** `high/jihun-hs-graduation_c0.png` — "12년치, 한 장도 안 버릴게" *(reconciliation/warm/7)*
```
A corner of the schoolyard after the graduation ceremony (auditorium_high / outside it), graduation
crowd blurred behind. Jihun (messy black hair, navy blazer, holding up his PHONE) showing a faded
childhood sports-day photo of the two of them on screen, thumb brushing the old image. About to take
a NEW photo together. The protagonist (uniform, 3/4 / back, gender-neutral) leaning in to the screen.
Mood: 12년치 사진 폴더에 더하는 첫 장 — reconciliation/warm, twelve years, none of it thrown away. (imp 7)
```
- **[c1]** `high/jihun-hs-graduation_c1.png` — "다음 12년도 같이 찍자" *(reconciliation/warm/7)*
```
Same schoolyard corner (auditorium_high). Jihun (messy black hair, navy blazer) holding out his
PINKY for a pinky-promise, his bright grin softened, graduation procession faint behind. The
protagonist's hand reaching to hook pinkies (hands-focused, gender-neutral). Spring light.
Mood: 다음 12년의 약속 — reconciliation/warm, sealing the next twelve years. (imp 7)
```
- **[c2]** `high/jihun-hs-graduation_c2.png` — "우리 진짜 다 컸다" *(reconciliation/warm/7)*
```
Same corner (auditorium_high). The two leaning shoulder to shoulder over the phone, looking at the
old sports-day photo — Jihun (messy black hair) laughing at his tiny childhood height, the same
laugh as twelve years ago. The protagonist (gender-neutral) beside him. Warm, sentimental.
Mood: 콩만 하던 게 다 컸다 — reconciliation/warm, the unchanged laugh across twelve years. (imp 7)
```

---

## 오수빈 (subin) — 7컷

> 모티프: **이륙하는 비행기 잠금화면**(승무원 꿈), 영어 단어장, 음료 건배. 금별 귀고리 필수.

### ⚪ subin-hs-firstdream — 비행기 사진 (t55, Y5)
**배경**: classroom_high · **공통** `high/subin-hs-firstdream.png`
```
High-school classroom during a break (classroom_high). Subin (short black bob, gold STAR EARRINGS,
navy blazer + red ribbon) caught with her phone lock screen showing a photo of a PLANE taking off
(instead of the usual group selfie), a bashful unguarded look — not her social smile. The
protagonist (uniform, 3/4 / back, gender-neutral) beside her. Daylight, desks.
Mood: 처음 들킨 비행기 잠금화면 — a secret dream, "어디든 갈 수 있을 것 같고."
```

### 🟠 subin-hs-momfight — 엄마와 부딪힌 날 (t64, Y6, growth/6)
**배경**: classroom_high_afternoon · **References**: subin_high_*, player_m_high_*
- **[c0]** `high/subin-hs-momfight_c0.png` — 말없이 등을 토닥인다 *(growth/melancholy/6)*
```
Empty high-school classroom, late afternoon (classroom_high_afternoon). Subin (short black bob,
gold star earrings) face-down on a desk, shoulders trembling small, after a phone fight with her
mother (승무원 vs 안정적인 직업). The protagonist (uniform, 3/4 / back, gender-neutral) sitting
beside her, a hand patting her back. The one person she cries in front of. Cool slanting light.
Mood: 남들 앞에선 안 울던 애가 처음 운다 — growth/melancholy, trust shown through tears.
```
- **[c1/c2 폴백·공통]** `high/subin-hs-momfight.png`
```
Same afternoon classroom. Subin (bob, star earrings) lifting a reddened face, the protagonist
across the desk — a quiet exchange about her dream and her mother. (covers no-draft c1/c2.)
Mood: 맞는 말과 응원 사이 — the weight of being understood.
```

### ⚪ subin-hs-studyboard — 영어 단어장 (t68, Y6)
**배경**: cafe_study · **공통** `high/subin-hs-studyboard.png`
```
A quiet corner of a study café (cafe_study). Subin (short black bob, gold star earrings) muttering
over an ENGLISH VOCABULARY BOOK, re-reading pronunciations (for a flight-attendant interview), the
book pushed half toward the protagonist (uniform, 3/4 / gender-neutral) to study together. Warm café
lighting, open books, a drink.
Mood: 혼자 외우다 같이 외우게 된 단어장 — the small joy of company in effort.
```

### 🔴 subin-hs-after — 합격 후 (t72, Y7, reconciliation/7)
**배경**: classroom_high · **References**: subin_high_*, player_m_high_*
> 모티프: 음료 두 개 → 건배, 창밖 하늘(비행기 잠금화면이 진짜가 됨).
> [MUST] 모든 음료 캔: **빨대 없음**, 평평한 일반 풀탭(pull-tab) 캔, 브랜드/텍스트 없음. (구멍·빨대 방향 오류 방지)
- **[c0]** `high/subin-hs-after_c0.png` — "포기 안 해줘서 고마워" *(reconciliation/warm/7)*
```
High-school classroom, quiet after acceptance results (classroom_high). Subin (short black bob,
gold star earrings) holding out one of TWO drinks, eyes reddening, a soft real smile — not her
public one. The protagonist (uniform, 3/4 / back, gender-neutral) facing her. Calm daylight.
Mood: 접으려던 꿈을 못 접게 한 "한 명" — reconciliation/warm, the friend who was the one cheer. (imp 8 vibe)
```
- **[c1]** `high/subin-hs-after_c1.png` — "이제 하늘 위를 날겠네" *(reconciliation/warm/7)*
```
Same classroom (classroom_high). Subin (bob, star earrings) looking out the window at the open SKY,
the lock-screen plane finally becoming real, a drink in hand. The protagonist (gender-neutral) beside
her following her gaze. Bright sky through glass.
Mood: 잠금화면이 진짜가 된 하늘 — reconciliation/warm, the dream cleared for takeoff. (imp 7)
```
- **[c2]** `high/subin-hs-after_c2.png` — 말없이 건배 *(reconciliation/warm/7)*
```
Same classroom. Close on two drink cans CLINKING together (hands-focused, gender-neutral), Subin
(bob, star earrings) finally showing her whole self to the protagonist rather than the world. Soft
daylight.
Mood: 캔 부딪는 소리의 작별-아닌-시작 — reconciliation/warm, "고마웠어, 진짜." (imp 7)
```

---

## 박민재 (minjae) — 8컷

> 모티프: **무가당 두유**, **떨리는 손**(천재인 척), 성적표, 의대→생명공학. 얇은 사각/림리스 안경 매 컷 필수.

### ⚪ minjae-hs-pressure — 성적표 (t58, Y5)
**배경**: classroom_high · **공통** `high/minjae-hs-pressure.png`
```
High-school classroom (classroom_high). Minjae (thin silver SQUARE/rimless glasses clearly visible,
neat short hair, pale skin, navy blazer properly buttoned, composed face with no expression) stuffing
a top-rank mock-exam report card carelessly into his bag, sipping UNSWEETENED SOY MILK. The
protagonist (uniform, 3/4 / back, gender-neutral) beside him. Daylight.
Mood: 잘해도 본전인 집의 무표정 — the loneliness behind a perfect score.
```

### ⚪ minjae-hs-doubt — 진짜 하고 싶은 거 (t62, Y6)
**배경**: classroom_high_afternoon · **공통** `high/minjae-hs-doubt.png`
```
Evening self-study classroom (classroom_high_afternoon). Minjae (square/rimless glasses, neat hair,
navy blazer) — who never rests — having put his pen DOWN, looking out the window, a rare uncertain
look ("의대 가야 되는 건 아는데, 하고 싶은 건진 모르겠어"). Soy milk carton on the desk. The
protagonist (uniform, 3/4 / back, gender-neutral) at the next desk. Cool dusk light.
Mood: 펜을 놓고 처음 던진 질문 — the top student unsure what he actually wants.
```

### 🟠 minjae-hs-mask — 페르소나 (t70, Y6, growth/6)
**배경**: classroom_high_afternoon(자습실) · **References**: minjae_high_*, player_m_high_*
> 모티프: **떨리는 손**을 책상 밑으로 숨김 → 안 숨김.
- **[c0]** `high/minjae-hs-mask_c0.png` — "나한텐 안 떨어도 돼" *(growth/melancholy/6)*
```
A self-study room after exams (classroom_high_afternoon), others gone. Minjae (square/rimless
glasses, neat hair, navy blazer) lifting his TREMBLING HAND off the workbook — for once NOT hiding
it under the desk. A crack in the composed "effortless genius" mask. The protagonist (uniform, 3/4 /
back, gender-neutral) beside him. Quiet late light.
Mood: 처음으로 안 숨긴 떨리는 손 — growth/melancholy, the mask set down for one person.
```
- **[c1]** `high/minjae-hs-mask_c1.png` — "천재인 척, 안 힘들어?" *(growth/melancholy/6)*
```
Same self-study room (classroom_high_afternoon). Minjae (glasses, neat hair) admitting it too
easily — "힘들지" — a tired honest half-smile, soy milk aside. The protagonist (gender-neutral)
across the desk. The relief of being asked.
Mood: 너무 쉽게 인정한 피로 — growth/melancholy, the first person he says it to.
```
- **[c2 폴백·공통]** `high/minjae-hs-mask.png`
```
Same room, two students solving problems in silence, only pencil sounds; Minjae's trembling hand
gradually settling. (covers no-draft c2.)
```

### 🔴 minjae-hs-choice — 자기 선택 (t75, Y7, discovery/7)
**배경**: counseling_hallway(=hallway_high) · **References**: minjae_high_*, player_m_high_*
> 모티프: **구겨진 진학 자료**를 폄, 손 떨림이 없어짐(처음 고른 칸 — 생명공학).
- **[c0]** `high/minjae-hs-choice_c0.png` — "네 입으로 말했으면 시작이야" *(discovery/breakthrough/7)*
```
Outside a counseling room, school hallway (hallway_high — 진로상담실 door + notice board). Minjae
(square/rimless glasses, neat hair, navy blazer) STANDING in the corridor, holding a CRUMPLED
admissions paper in both hands and smoothing it flat as a gesture of RESOLVE — his hand NOT trembling
for once ("처음으로 내가 고른 칸"). The protagonist (uniform, 3/4 / back, gender-neutral) beside him.
Daylight in the corridor.
[MUST] 읽는 자세로 보이지 않게(결심을 보여주는 동작). 종이에 읽히는 글자·뒤집힌(거울상) 텍스트 없음.
종이 밑에 테이블·책상·받침대 없음 — 복도에 서서 손에 든 상태.
Mood: 처음 제 손으로 고른 칸 — discovery/breakthrough, choosing for himself at last. (imp 7)
```
- **[c1]** `high/minjae-hs-choice_c1.png` — "엄마는 같이 말하자" *(discovery/breakthrough/7)*
```
Same hallway (hallway_high). Minjae (glasses, neat hair) turning to the protagonist, surprised —
"…같이?" — the weight he meant to carry alone now shared. The protagonist (gender-neutral) facing
him steadily. Corridor light.
Mood: 혼자 지려던 짐에 끼어든 한 사람 — discovery/breakthrough, not carrying it alone. (imp 7)
```
- **[c2]** `high/minjae-hs-choice_c2.png` — "네 얼굴 지금 좋아 보여" *(discovery/breakthrough/7)*
```
Same hallway (hallway_high). Minjae (glasses, neat hair) with a faint REAL smile — not the composed
mask — caught at the threshold of his own choice. The protagonist (gender-neutral) noticing it.
Soft daylight.
Mood: 무심한 척이 아닌 진짜 웃음 — discovery/breakthrough, relief becoming a real smile. (imp 7)
```

---

## 유나 (yuna) — 4컷

> 모티프: **피아노/빈 음악실**(숨이 쉬어지는 곳), 콩쿠르. 카라멜 웨이브 + 별 머리클립 필수. (배경 `music_room` 범용 대체.)

### ⚪ yuna-hs-piano — 빈 음악실 (t38, Y5)
**배경**: music_room(대체) · **공통** `high/yuna-hs-piano.png`
```
An empty music room at lunchtime (music_room). Yuna (caramel WAVY hair, STAR HAIR CLIP on right side,
navy blazer + red ribbon, scrunchie bracelet) at the PIANO, hands just lifting off the keys after
playing a song she loves (not a test piece), a bashful "여기 있을 때가 제일 나 같아" look. The
protagonist (uniform, 3/4 / back, gender-neutral) as the lone listener. Soft daylight, dust motes.
Mood: 숨이 쉬어지는 유일한 자리 — the piano where she's most herself.
```

### 🟠 yuna-hs-recital — 콩쿠르 전날 (t42, Y6, growth/6)
**배경**: music_room(대체) · **References**: yuna_high_*, player_m_high_*
- **[c0]** `high/yuna-hs-recital_c0.png` — "내가 제일 앞에서 들을게" *(growth/warm/6)*
```
Empty music room the night before a recital (music_room). Yuna (caramel wavy hair, star hair clip)
pale and tense at the piano, fingers stiff from a remembered mistake — beginning to ease as the
protagonist (uniform, 3/4 / back, gender-neutral) promises to listen from the very front row. Warm
practice-room light, sheet music on the stand.
Mood: 한 명이 앞에 있다고 생각하면 칠 수 있을 것 같은 — growth/warm, one listener un-freezing the hands.
```
- **[c1/c2 폴백·공통]** `high/yuna-hs-recital.png`
```
Same music room AT NIGHT (dark windows, warm lamp/practice-room light — same time-of-day as c0, NOT
daytime), Yuna (caramel wavy hair, star clip) replaying the stuck measure, the protagonist beating
time with a hand beside her. (covers no-draft c1/c2.)
```
> [MUST] 콩쿠르 **전날 밤** 이벤트 — 창밖은 야경/어둠, 실내는 연습실 램프광. c0와 시간대 일치(대낮 금지).

### ⚪ yuna-hs-decision — 결심 직전 (t44, Y7)
**배경**: classroom_high · **공통** `high/yuna-hs-decision.png`
```
High-school classroom, career-decision season (classroom_high). Yuna (caramel wavy hair, star hair
clip) weighing TWO sets of papers in her hands — a music-college admissions packet vs a general
department one — "결정하기 전에 너한테 먼저 말하고 싶었어." The protagonist (uniform, 3/4 / back,
gender-neutral) facing her. Daylight.
Mood: 양손의 저울 앞에서 먼저 부른 한 사람 — the choice she wanted to say out loud first.
```

---

## 송준하 (junha) — 4컷

> 모티프: **직접 싼 도시락 + 레시피 노트**, 부산 사투리, 주먹밥, 요리사 꿈. 굵은 직선 눈썹 + 약간 큰 교복 필수.

### ⚪ junha-hs-recipe — 레시피 노트 (t42, Y7)
**배경**: rooftop_sunset · **공통** `high/junha-hs-recipe.png`
```
School rooftop at lunch, early sunset (rooftop_sunset). Junha (short messy dark brown hair, THICK
straight eyebrows, sturdy build, slightly ill-fitting navy blazer) opening his home-made LUNCHBOX
and beside it a small RECIPE NOTEBOOK packed with handwriting (요리사 꿈, 부산 가게). The
protagonist (uniform, 3/4 / back, gender-neutral) facing him. Breeze, open sky.
Mood: 도시락 옆에 편 레시피 노트 — an earnest dream written down, dialect thickening with hope.
```

### 🔴 junha-hs-farewell — 다시 부산 (t50, Y7, reconciliation/6)
**배경**: school_gate_high · **References**: junha_high_*, player_m_high_*
> 모티프: 평소보다 큰 짐 가방, 새끼손가락 약속(가게 1호 손님), 코끝 빨개짐.
- **[c0]** `high/junha-hs-farewell_c0.png` — "1호 손님 약속 지켜야지" *(reconciliation/melancholy/6)*
```
In front of the high-school gate near graduation (school_gate_high). Junha (short messy dark brown
hair, thick straight eyebrows, navy blazer, a LARGER-than-usual travel bag) hooking a PINKY-promise,
his dialect trembling ("가게 차리믄 젤 먼저 연락한다"). The protagonist (uniform, 3/4 / back,
gender-neutral) hooking pinkies (hands-focused). Soft daylight, the gate behind.
Mood: 부산으로 떠나기 전 새끼손가락 약속 — reconciliation/melancholy, a promise across distance.
```
- **[c1]** `high/junha-hs-farewell_c1.png` — "여기가 네 자리였다니 다행" *(reconciliation/melancholy/6)*
```
Same school gate (school_gate_high). Junha (messy dark brown hair, THICK STRAIGHT eyebrows, navy
blazer with NECKTIE ON, big bag) looking straight at the protagonist without dodging for once —
"니가 그래 만들어줬지." The protagonist (gender-neutral) facing him. Warm parting light.
Mood: 여기도 내 자리 같더라 — reconciliation/melancholy, belonging found just before leaving.
```
> [MUST] 준하 얼굴/복장은 _m·_f 동일 인물로: **굵은 직선 눈썹, 어두운 갈색 머리, 넥타이 착용**(오픈칼라·얇은눈썹·밝은머리 금지).
- **[c2]** `high/junha-hs-farewell_c2.png` — 말없이 가방 한쪽을 든다 *(reconciliation/melancholy/6)*
```
Same gate (school_gate_high). The two carrying Junha's heavy bag TOGETHER toward the gate, Junha
(messy dark brown hair, thick brows) smiling with a reddened nose-tip ("부산엔 이런 친구 없었다").
The protagonist (3/4 / back, gender-neutral) sharing the load.
Mood: 가방을 나눠 든 마지막 배웅 — reconciliation/melancholy, a goodbye carried together.
```

---

## 김하은 (haeun) — 4컷

> 1년 선배(Y5 입학 시 고2, Y6 졸업). 모티프: **방송부 대본 마지막 줄을 비워둠 → 너에게 건넴**, 옥상. 둥근 검은테 안경 필수.

### ⚪ haeun-hs-rooftop — 옥상의 선배 (t28, Y5)
**배경**: rooftop_sunset · **공통** `high/haeun-hs-rooftop.png`
```
School rooftop at sunset (rooftop_sunset). Haeun (black-framed ROUND glasses, dark brown straight
bob, navy blazer + red ribbon — a year senior) listening to the protagonist's worries by the railing,
but deflecting her own ("난 뭐… 잘 지내지" — a beat late). The protagonist (uniform, 3/4 / back,
gender-neutral) beside her. Warm fading light.
Mood: 늘 챙기기만 하던 선배의 한 박자 늦은 대답 — the senior who never speaks of herself.
```

### 🔴 haeun-hs-leaving — 마지막 줄 (t40, Y6, reconciliation/6)
**배경**: auditorium_high(졸업식) · **References**: haeun_high_*, player_m_high_*
> 모티프: 낡은 **방송부 대본**, 비워둔 **마지막 줄**을 너에게 넘김.
- **[c0]** `high/haeun-hs-leaving_c0.png` — "제가 꼭 채울게요" *(reconciliation/melancholy/6)*
```
Haeun's graduation day, near the auditorium (auditorium_high). Haeun (round glasses, dark brown bob,
navy blazer) holding out an old, worn BROADCASTING-CLUB SCRIPT, its LAST LINE left blank, handing it
to the protagonist (uniform, 3/4 / back, gender-neutral). A faint smile — "마지막 줄은 네가 채우라고
비워뒀어." Graduation blur behind.
Mood: 비워둔 마지막 줄이 넘어오는 순간 — reconciliation/melancholy, a torch passed in a blank line.
```
- **[c1]** `high/haeun-hs-leaving_c1.png` — "선배 없으면 허전할 거예요" *(reconciliation/melancholy/6)*
```
Same auditorium exterior (auditorium_high). Haeun (round glasses, bob, script in hand) saying she'll
be "금방 또 채워질걸" — yet not turning to leave for a long while. The protagonist (gender-neutral)
facing her. Soft daylight, parting air.
Mood: 말은 그렇게 하면서 못 돌아서는 선배 — reconciliation/melancholy, reluctance under lightness.
```
- **[c2]** `high/haeun-hs-leaving_c2.png` — "선배는 다를 거예요" *(reconciliation/melancholy/6)*
```
Same auditorium (auditorium_high). Haeun (round glasses, bob) faltering — eyes briefly wavering —
as the protagonist gently recalls something heavy she once shared ("오빠 일"). "응. 나는, 다를게."
The protagonist (gender-neutral) careful before her.
Mood: 기억해준 한마디에 흔들린 눈가 — reconciliation/melancholy, seen where she hid.
```

---

## 윤서아 (seoa) — 9컷  ※캐릭터 레퍼런스 발주 선행

> 모티프: **찢긴 노트 페이지 / 끊긴 끝줄**, **한쪽만 뺀 이어폰**, 음악실 경첩이 두 번 울리던 소리, 엄마가 더 또박또박 고쳐 쓴 두 줄.

### 🟠 seoa-both-earphones-again — 도로 양쪽 다 (t50, Y5, reconciliation/5)
**배경**: classroom_high_afternoon(야자 첫 주) · **References**: seoa_high_*(미제작), player_m_high_*
- **[c0]** `high/seoa-both-earphones-again_c0.png` — "그거 아직 쓰는구나" *(reconciliation/warm/5)*
```
High-school self-study classroom, rows of fluorescent-lit desks, late evening
(classroom_high_afternoon, pushed to night-study tone). Seoa (long straight dark brown hair, side
hair clip, NO glasses) at the far end, having had BOTH earbuds in, now pulling ONE out — and sliding
back out the NOTEBOOK she'd hidden under a workbook, its torn corner showing, because the protagonist
recognized it. The protagonist (uniform, 3/4 / back, gender-neutral) beside her desk.
Mood: 너만 이게 노트인 줄 아네 — reconciliation/warm, a hidden self gently seen again.
```
- **[c1/c2 폴백·공통]** `high/seoa-both-earphones-again.png`
```
Same night-study classroom. Seoa (long straight hair, side clip, one earbud) at the far desk, the
torn-corner notebook between hidden and out. (covers no-draft c1=둘 다 뺌·c2=양쪽 다 도로 낌.)
```

### 🟠 seoa-clearer-handwriting — 더 또박또박한 글씨 (t65, Y6, growth/7)
**배경**: classroom_high_afternoon · **References**: seoa_high_*, player_m_high_*
- **[c0]** `high/seoa-clearer-handwriting_c0.png` — "끝은 내가 데리고 있을게" *(growth/burden/7)*
```
Empty classroom after self-study (classroom_high_afternoon). Seoa (long straight dark brown hair,
side clip, NO glasses) setting her pen down over a career-aspiration form: in the first-choice box,
her own faint handwriting is STRUCK THROUGH WITH TWO LINES and overwritten in a neater hand (her
mother's). She looks up, unburdened, as the protagonist (uniform, 3/4 / back, gender-neutral) takes
the weight of "the ending" off her. Cool late light.
Mood: 내 칸인데 내 글씨가 제일 흐린 — growth/burden, someone holding her ending so she can keep writing. (imp 7)
```
- **[c1/c2 폴백·공통]** `high/seoa-clearer-handwriting.png`
```
Same classroom. Close on the aspiration form — faint struck-through handwriting under a neater
overwriting (mother's), Seoa's pen hovering over the box. (covers no-draft c1/c2.)
```

### 🟠 seoa-name-blank — 제목 칸 (t75, Y7, growth/7)
**배경**: classroom_high_afternoon · **References**: seoa_high_*, player_m_high_*
- **[c0]** `high/seoa-name-blank_c0.png` — "적고 싶은 칸에 떨어지는 거잖아" *(growth/resolve/7)*
```
Empty classroom after self-study, late spring of senior year (classroom_high_afternoon). Seoa (long
straight dark brown hair, side clip, NO glasses) finally writing a TITLE into the blank TITLE BOX of
a youth literary-contest entry form, one letter at a time — beside it a college self-introduction
printout being slid into a drawer (she can only do one). The protagonist (uniform, 3/4 / back,
gender-neutral) beside her, steadying her. "이번엔 안 도망쳐."
Mood: 제목 칸을 처음 끝까지 채운 손 — growth/resolve, choosing the box she wants to fall short in. (imp 7)
```
- **[c1/c2 폴백·공통]** `high/seoa-name-blank.png`
```
Same classroom. The contest form with an empty TITLE box, Seoa's pen tapping it without writing, a
self-intro printout beside it. (covers no-draft c1/c2.)
```

### 🔴 seoa-ending-page — 끝을 데려온 페이지 (t90, Y7, reconciliation/8)
**배경**: auditorium_high(졸업식) · **References**: seoa_high_*, player_m_high_*
> 모티프: 4년 전 **찢어 쥐여준 페이지** — 끊겼던 끝줄에 글씨가 채워짐(잉크색 다름), 한쪽 이어폰, 경첩 두 번 소리.
- **[c0]** `high/seoa-ending-page_c0.png` — 채워진 줄을 끝까지 읽는다 *(reconciliation/warm/8)*
```
High-school graduation day in the auditorium (auditorium_high), soft daylight. Seoa (long straight
dark brown hair, side hair clip, NO glasses, high-school stage 18-19) holding out a single TORN
NOTEBOOK PAGE — ONE earbud removed and dangling, the way she first did in the music room years ago,
NOT covering the page. The protagonist (uniform, 3/4 / back, gender-neutral) reading the filled-in
last line (ink a different color from years ago). Diplomas/bouquets blurred behind.
Mood: 끊겼던 줄 끝에 내 이름이 채워진 — reconciliation/warm, a story finally given its ending. (imp 8)
```
- **[c1]** `high/seoa-ending-page_c1.png` — "나도 못 적은 줄 있어" *(reconciliation/warm/8)*
```
Just outside the auditorium (auditorium_high). BOTH of them with earbuds removed, reading aloud for
the first time the lines each had put off — Seoa (long straight hair, side clip) and the protagonist
(gender-neutral) side by side over the torn page. "…너도 끝을 미뤄뒀구나." Warm light.
Mood: 서로 미뤄둔 줄을 처음 소리 내 읽는 — reconciliation/warm, two unfinished endings meeting. (imp 8)
```
- **[c2]** `high/seoa-ending-page_c2.png` — 페이지를 통째로 쥐여준다 *(reconciliation/warm/8)*
```
Same auditorium (auditorium_high). Seoa (long straight hair, side clip) pressing the WHOLE page into
the protagonist's hands — this time NOT torn, intact — a warm laughing-close-to-tears face. Hands-
focused on the page passing between them (gender-neutral).
Mood: 이번엔 안 찢고 통째로 — reconciliation/warm, the page handed over whole at last. (imp 8)
```

---

## 한시우 (siwoo) — 13컷  ※캐릭터 레퍼런스 발주 선행

> 모티프: **은색 텀블러**, 동선/소실점, **끝물에만 건너는 횡단보도**, 분필로 그은 동선, 헐린 평상 자리(턱을 높인 손), 건축. "전부 네가 서 있던 자리."

### ⚪ siwoo-invisible-narrowing — 안 보이는 게 더 이상한 거 (t30, Y5)
**배경**: classroom_high · **공통** `high/siwoo-invisible-narrowing.png`
```
High-school classroom during a break (classroom_high). Siwoo (medium-length dark brown hair over
forehead, slouched, navy blazer top button undone, SILVER TUMBLER in hand) pointing out the window
toward a corner of the schoolyard where students keep bumping at the same narrowing spot. An
observant, slightly detached air. The protagonist (uniform, 3/4 / back, gender-neutral) at his desk.
Mood: 매일 같은 자리서 부딪히는 걸 며칠째 보는 눈 — the observer who sees what others walk past.
```

### ⚪ siwoo-last-signal — 신호 끝물 (t45, Y5)
**배경**: bus_stop_evening(신규)/횡단보도 · **공통** `high/siwoo-last-signal.png`
```
A crosswalk at dusk on the way home (bus_stop_evening / evening street). Everyone has crossed;
Siwoo (medium brown hair over forehead, slouched, SILVER TUMBLER in hand) still standing at the curb,
letting the green light run down, stepping off only as it starts BLINKING — so he meets no one in the
middle. The protagonist (uniform, 3/4 / back, gender-neutral) noticing. Evening glow, empty crossing.
Mood: 끝물에만 건너는 동선 — "내 동선은 이렇게 짜," avoiding everyone in the middle.
```

### 🟠 siwoo-unbuilt-spot — 아직 안 선 자리 (t60, Y5, discovery/6)
**배경**: rooftop_sunset(공터 내려다봄) · **References**: siwoo_high_*, player_m_high_*
> 모티프: 손가락으로 허공에 윤곽 → 모든 선이 **공터의 한 점(소실점)**으로 모임, 그 점만 안 짚음.
- **[c0]** `high/siwoo-unbuilt-spot_c0.png` — "저 점이 누구 보는 자린데" *(discovery/melancholy/6)*
```
A rooftop at sunset overlooking an empty lot (rooftop_sunset). Siwoo (medium brown hair, slouched,
SILVER TUMBLER) tracing an invisible outline in the air with a finger — every line converging on ONE
POINT over the empty lot — but stopping short of touching that one point, closing his mouth ("말하면
안 짓게 돼"). The protagonist (uniform, 3/4 / back, gender-neutral) beside him. Fading light.
Mood: 끝내 안 짚은 한 점(소실점) — discovery/melancholy, a future gained, the named point withheld.
```
- **[c1]** `high/siwoo-unbuilt-spot_c1.png` — 더 안 묻고 같이 본다 *(discovery/melancholy/6)*
```
Same rooftop at sunset (rooftop_sunset). Siwoo (medium brown hair, slouched) lowering his tumbler,
the two simply looking together at the unbuilt empty lot's vanishing point, lingering longer than
usual. Quiet, unasked. Warm sky.
Mood: 캐묻지 않은 자리에서 더 머문 — discovery/melancholy, an unnamed vanishing point left in peace.
```
- **[c2 폴백·공통]** `high/siwoo-unbuilt-spot.png`
```
Same rooftop, Siwoo (tumbler, slouch) and the protagonist over the empty lot, a light "안 선 거 보니
너 같다" beat. (covers no-draft c2.)
```

### ⚪ siwoo-hand-first — 손이 먼저 나갔다 (t62, Y6)
**배경**: gymnasium · **공통** `high/siwoo-hand-first.png`
```
A gymnasium during sports-day prep (gymnasium). Siwoo (medium brown hair over forehead, slouched —
but this time DOWN from the top stand, crouching), drawing movement paths on the floor with CHALK
("여기 막히니까 이쪽으로 빠져"), surprised at himself for stepping in. The class quieting around. The
protagonist (uniform, 3/4 / back, gender-neutral) nearby. Bright gym light, chalk lines on the floor.
Mood: 발이 먼저 한가운데로 — the observer stepping off the top stand for once.
```

### 🔴 siwoo-demolished-ground — 정들면 헐리는 지반 (t75, Y6, growth/7)
**배경**: school_entrance_rain(신규=철거 골목 빗속) · **References**: siwoo_high_*, player_m_high_*
> 모티프: 어릴 적 살던 **철거 중인 골목/빈터**, 평상 자리에 비 안 가게 **턱을 높인 손**, 빈 텀블러에 고이는 빗물.
- **[c0]** `high/siwoo-demolished-ground_c0.png` — "네 기억엔 아직 안 헐렸잖아" *(growth/burden/7)*
```
A half-demolished alley in the rain, fenced off (school_entrance_rain tone / demolition-site rain).
Siwoo (medium brown hair over forehead, navy blazer, an EMPTY silver tumbler in a fidgeting hand)
looking through a fence gap at an empty lot where his childhood home stood — gazing far longer than
usual, not shifting his eyes. The protagonist (uniform, 3/4 / back, gender-neutral) beside him under
the rain. Puddle pooling at one edge.
Mood: 막을 사람은 없어진 자리에 막아둔 손만 남은 — growth/burden, a memory not yet torn down.
```
- **[c1]** `high/siwoo-demolished-ground_c1.png` — "다시 뭐든 세우면 보러 올게" *(growth/burden/7)*
```
Same rainy fenced demolition site (school_entrance_rain tone). Siwoo (medium brown hair, tumbler)
looking at the empty lot DIFFERENTLY — seeing, for the first time in a torn-down place, something to
BUILD ("턱부터 다시 높여야겠다"). The protagonist (gender-neutral) beside him. Rain easing.
Mood: 헐린 자리에서 처음 본 '세울 것' — growth/burden, ruin turned to foundation.
```
- **[c2]** `high/siwoo-demolished-ground_c2.png` — 말없이 같이 선다 *(growth/burden/7)*
```
Same scene (school_entrance_rain tone). The two standing silently beside the fence in the rain, only
rain sound; rainwater collecting in Siwoo's EMPTY TUMBLER. Quiet, gray, close.
Mood: 빈 텀블러에 고이는 빗물 — growth/burden, presence as the only comfort.
```

### ⚪ siwoo-hobby-seat — 취미로 하라는 자리 (t78, Y7)
**배경**: counseling_hallway(=hallway_high/비상계단 참) · **공통** `high/siwoo-hobby-seat.png`
```
A fire-stair landing with a wide view of the neighborhood (hallway_high / stair-landing tone),
career-decision week. Siwoo (medium brown hair over forehead, slouched, NO tumbler this time —
unusual) with an admissions guide on his knees, an X marked over "건축학과" (father said keep it as
a hobby). A rare directly-asking look at the protagonist (uniform, 3/4 / back, gender-neutral):
"봐주지 말고." Daylight over rooftops.
Mood: 매일 보는 게 취미면 진짜는 뭐가 되나 — the dream told to stay a hobby.
```

### 🔴 siwoo-where-you-stood — 전부 네가 서 있던 자리더라 (t80, Y7, reconciliation/8)
**배경**: rooftop_sunset(학교 옥상) · **References**: siwoo_high_*, player_m_high_*
> 모티프: 처음 만난 날 멈췄던 **크레인 자리에 다 올라간 아파트**, 텀블러를 난간에 내려놓고 동네 곳곳('자리')을 짚음, 처음으로 먼저 내민 악수.
- **[c0]** `high/siwoo-where-you-stood_c0.png` — "그 자리들 평생 안 잊을게" *(reconciliation/warm/8)*
```
School rooftop at sunset just before graduation (rooftop_sunset). The crane-site from the day they
met is now a finished apartment block on the skyline. Siwoo (medium brown hair over forehead, navy
blazer) has set his SILVER TUMBLER on the railing and is offering a HANDSHAKE first — for the first
time reaching out himself. His expression is NOT a bright smile — a reserved, wistful, faintly
self-effacing look ("잊는 게 나아"), warmth and quiet resignation at once. The protagonist (uniform,
3/4 / back, gender-neutral) before him. Long warm light over the neighborhood.
Mood: 전부 네가 서 있던 자리였어 — reconciliation/warm, BUT edged with self-effacing distance: 시우는
"잊는 게 나아 … 나처럼"이라며 한 발 물러선다. 환한 웃음 금지(그건 c1) — 따뜻함과 체념이 함께. (imp 8)
```
- **[c1]** `high/siwoo-where-you-stood_c1.png` — "너랑 본 자리들이 제일 좋았어" *(reconciliation/warm/8)*
```
Same sunset rooftop (rooftop_sunset). Siwoo (medium brown hair) smiling STRAIGHT and openly for the
first and last time ("…나도"), not turning his gaze away — a crack of pure warmth in the observer.
The protagonist (gender-neutral) facing him. Tumbler on the railing, golden skyline.
Mood: 처음이자 마지막으로 똑바로 웃는 — reconciliation/warm, the guarded boy fully open once. (imp 8)
```
- **[c2]** `high/siwoo-where-you-stood_c2.png` — "그 앞에 꼭 서 있을게" *(reconciliation/warm/8)*
```
Same rooftop sunset (rooftop_sunset). Siwoo (medium brown hair) holding out his SILVER TUMBLER to
the protagonist — and this time NOT taking it back — as he trails off ("그땐 네 설 자리부터—").
Hands-focused on the tumbler passing over (gender-neutral). Warm last light.
Mood: 이번엔 안 돌려받은 텀블러 — reconciliation/warm, the prop he never shared, given away. (imp 8)
```

---

## 강예린 (yerin) — 14컷  ※캐릭터 레퍼런스 발주 선행

> 모티프: **장부/단가/산출/미수금**(회계 화법), 보세 가방 영수증, 장래희망 줄의 **??? + 두 줄**, 끝내 안 닫는 결산선. 우아한 귀고리 + planner 필수.

### 🟠 yerin-only-sample — 표본이 너밖에 없어 (t40, Y5, discovery/6)
**배경**: classroom_high_afternoon(점심 빈 교실) · **References**: yerin_high_*(미제작), player_m_high_*
- **[c0]** `high/yerin-only-sample_c0.png` — "산출 까먹는 거 나쁜 거 아니야" *(discovery/melancholy/6)*
```
An empty classroom at lunch (classroom_high_afternoon). Yerin (medium dark brown WAVY-end hair,
elegant earrings, perfectly fitted navy blazer, a small PLANNER nearby) having flipped her PHONE
face-DOWN on the desk, her usually-busy hand momentarily STILL, deliberately not looking toward the
laughing crowd outside the window ("표본이 너밖에 없어서"). The protagonist (uniform, 3/4 / back,
gender-neutral) beside her. Daylight, distant playground sounds.
Mood: 너랑 있을 때만 산출을 안 돌리는 — discovery/melancholy, the strategist with no metric for this.
```
- **[c1/c2 폴백·공통]** `high/yerin-only-sample.png`
```
Same empty classroom. Yerin (wavy-end hair, elegant earrings) and the protagonist beside a face-down
phone, neither looking at the playground. (covers no-draft c1/c2.)
```

### 🔴 yerin-stolen-material — 가로챈 자료 (t42, Y6, betrayal/7)
**배경**: classroom_high(복도) · **References**: yerin_high_*, player_m_high_*
> 모티프: 우리 조 발표 구성을 가로챔 → 박수 속 외면, 복도서 변명하려다 창밖으로 시선. 회계 화법("사과는 원가만 나가고 회수가 없어").
- **[c0]** `high/yerin-stolen-material_c0.png` — "실망했어" 한마디 *(betrayal/regret/7)*
```
A high-school hallway (classroom_high / hallway). Yerin (wavy-end brown hair, elegant earrings,
fitted navy blazer) unable to meet the protagonist's eyes after stealing their project work, the
protagonist (uniform, back view turning away, gender-neutral) leaving with one word. Cold corridor
light, a presentation folder in her hand. Distance opening between them.
Mood: 실망은 기대가 있어야 하는 거잖아 — betrayal/regret, a quiet severing.
```
- **[c1]** `high/yerin-stolen-material_c1.png` — "이겨서 좋아?" *(betrayal/regret/7)*
```
Same hallway (classroom_high / hallway). Yerin (wavy-end hair, elegant earrings) unable to answer,
glancing at the praised (stolen) presentation material, her words going cold ("…좋아야 하는데"). The
protagonist (gender-neutral) facing her. Tense corridor light.
Mood: 이겼는데 식어버린 말끝 — betrayal/regret, a win that tastes like nothing.
```
- **[c2]** `high/yerin-stolen-material_c2.png` — "한 번은 빚으로 달아둘게" *(betrayal/regret/7)*
```
Same hallway (classroom_high / hallway). Yerin (wavy-end hair, elegant earrings) struck speechless
for the first time ("왜 빚으로 해줘, 손절하면 깔끔한데"), clutching the planner. A debt she can't
repay opening between them. The protagonist (gender-neutral) before her.
Mood: 스스로 못 갚는 빚 — betrayal/regret, mercy that only tightens the knot.
```

### 🔴 yerin-receipt — 가방 안의 영수증 (t55, Y6, discovery/6)
**배경**: cafe_study · **References**: yerin_high_*, player_m_high_*
> 모티프: 떨어진 **보세 가방 영수증**(명품인 척), 발끝으로 더 깊이 밀어 가림, 처음 실패한 표정 관리.
- **[c0]** `high/yerin-receipt_c0.png` — "라인 안 짜도 돼" *(discovery/melancholy/6)*
```
A study café (cafe_study). On the floor, a RECEIPT — for a knock-off of the same expensive-brand bag
Yerin always carries. Yerin (wavy-end brown hair, elegant earrings, fitted blazer) failing at her
composure for the first time, NUDGING the receipt deeper under the chair with her TOE to hide it,
changing the subject too fast. The protagonist (uniform, 3/4 / gender-neutral) quietly looking at
the bag, not the receipt. Warm café light.
Mood: 나한테까지 라인 안 짜도 돼 — discovery/melancholy, the polished armor cracking.
```
- **[c1]** `high/yerin-receipt_c1.png` — "마이너스로 안 잡히는데" *(discovery/melancholy/6)*
```
Same café (cafe_study). Yerin (wavy-end hair, elegant earrings) — her toe slipping off the hidden
receipt, neither picking it up nor re-hiding it, just sitting still a long while, eyes wavering. The
protagonist (gender-neutral) across the table. Warm light.
Mood: 가렸던 발끝이 슬쩍 떨어진 — discovery/melancholy, an admission she can't yet voice.
```
- **[c2]** `high/yerin-receipt_c2.png` — 말없이 주워 가방에 넣어준다 *(discovery/melancholy/6)*
```
Same café (cafe_study). The protagonist (gender-neutral, hands-focused) PICKING UP the receipt and
tucking it into Yerin's bag; Yerin (wavy-end hair, elegant earrings) gripping the bag strap tight,
retreating into the familiar language of debt ("…빚 하나 진 거다"). Warm café light.
Mood: 익숙한 거래로 도망친 손 — discovery/melancholy, kindness she can only file as a debt.
```

### 🔴 yerin-undroppable-line — 단가가 안 떨어지는 줄 (t58, Y7, discovery/7)
**배경**: classroom_high_afternoon(야자 끝) · **References**: yerin_high_*, player_m_high_*
> 모티프: 처음으로 대가 없이 부탁한 자소서, 장래희망 줄에만 **'???' + 두 줄**(처음 만난 날 내 이름 줄에 한 처리 그대로).
- **[c0]** `high/yerin-undroppable-line_c0.png` — "나도 단가 못 내본 줄이야" *(discovery/resolve/7)*
```
Empty classroom after self-study, senior-year summer (classroom_high_afternoon). Yerin (wavy-end
brown hair, elegant earrings, fitted blazer) handing over a complete self-introduction draft — every
box dense except the FUTURE-DREAM line, which reads "???" STRUCK THROUGH WITH TWO LINES. The
protagonist (uniform, 3/4 / back, gender-neutral) opening their OWN unsettled line beside hers,
both marked ???. "…너도 적자였구나." Cool late light.
Mood: 되고 싶은 건 한 줄도 산출 못 돌려본 — discovery/resolve, two unpriced lines side by side. (imp 7)
```
- **[c1]** `high/yerin-undroppable-line_c1.png` — "시간 가는 줄 몰랐어?" *(discovery/resolve/7)*
```
Same classroom (classroom_high_afternoon). Yerin (wavy-end hair, elegant earrings) falling into a
long silence ("…기억이 안 나"), pen touched to the ??? line and lifted off. The protagonist
(gender-neutral) across the desk. Quiet evening light.
Mood: 기억이 안 나는 '되고 싶은 것' — discovery/resolve, the question she never let herself ask.
```
- **[c2]** `high/yerin-undroppable-line_c2.png` — "결산 안 하고 그냥 둬볼래?" *(discovery/resolve/7)*
```
Same classroom (classroom_high_afternoon). Yerin (wavy-end hair, elegant earrings) holding her pen
over the struck-through ??? a long beat, then lifting it — the same hand that once left the
protagonist's line "unpriced/pending." "결산을 미루는 회계는 처음 본다." Hands and form in focus.
Mood: 결산을 미루는 회계 — discovery/resolve, leaving one line open on purpose. (imp 7)
```

### 🔴 yerin-not-a-trade — 이번엔 교환 아니야 (t68, Y7, reconciliation·failure/8)
**배경**: school_gate_high(졸업 직전) · **References**: yerin_high_*, player_m_high_*
> 모티프: 반 전체를 단가로 적은 **장부**, 다른 줄은 다 결산선 → 내 이름 줄만 안 닫고 여백에 **'미수금'**.
- **[c0]** `high/yerin-not-a-trade_c0.png` — "근거 없이? 너답지 않게" *(reconciliation/warm/8)*
```
In front of the high-school gate near graduation (school_gate_high). Yerin (wavy-end brown hair,
elegant earrings, fitted blazer) holding an open LEDGER where every classmate's line is ruled CLOSED
with a settlement stroke — except the protagonist's line, left UN-closed with one accounting note in
the margin: "미수금" (receivable). She laughs for the first time WITHOUT calculating. The protagonist
(uniform, 3/4 / back, gender-neutral) looking at the line with her. Soft daylight.
Mood: 평생 결산으로 살았는데 못 닫은 줄 하나 — reconciliation/warm, one line left open forever. (imp 8)
```
- **[c1]** `high/yerin-not-a-trade_c1.png` — "끝내 결산 안 했네" *(reconciliation/warm/8)*
```
Same school gate (school_gate_high). Yerin (wavy-end hair, elegant earrings) raising her pen to draw
the settlement stroke — and stopping, unable to close it ("닫으면 또 단가가 되니까"), shutting the
ledger with the line still "미수금." The protagonist (gender-neutral) beside her.
Mood: 닫으면 또 단가가 되니까 — reconciliation/warm, refusing to price what matters. (imp 8)
```
- **[c2]** `high/yerin-not-a-trade_c2.png` — "그 줄도 닫아" 돌려보낸다 *(failure/regret/8)*
```
Same school gate (school_gate_high). Yerin (wavy-end hair, elegant earrings) pausing half a second,
then RULING the settlement stroke across the protagonist's line and putting the ledger away ("…그게
너답네"), not holding on any longer. The protagonist (gender-neutral) watching the line close. Cooler
light, a quiet ending.
Mood: 닫힌 채 안 건너온 줄 — failure/regret, the receivable settled and lost. (imp 8)
```

---

## 📋 작성 컷 목록 (총 77)

| NPC | 컷 | 비고 |
|---|---|---|
| jihun | 14 | unsaid·graduation 각 3 per-choice, latenight·mask류 혼합 |
| subin | 7 | after 3 per-choice |
| minjae | 8 | choice 3, mask 혼합 |
| yuna | 4 | recital 혼합, 배경 music_room 대체 |
| junha | 4 | farewell 3 |
| haeun | 4 | leaving 3 |
| **seoa** | **9** | ending-page 3. ※레퍼런스 발주 선행 |
| **siwoo** | **13** | demolished·where-you-stood 각 3. ※레퍼런스 발주 선행 |
| **yerin** | **14** | stolen·receipt·undroppable·not-a-trade 각 3. ※레퍼런스 발주 선행 |

**선행 의존성**: ① 신규 NPC 3인 portrait/fullbody 발주(seoa/siwoo/yerin, 36컷 차단) ② 배경 6종(night_bus·bus_stop_evening·school_bench·school_entrance_rain 신규 / counseling_hallway·music_room_middle 대체 가능).
**병렬 가능**: 기존 6인(jihun·subin·minjae·yuna·junha·haeun) 31컷은 레퍼런스·배경 대부분 확보 → **즉시 발주 가능**.
