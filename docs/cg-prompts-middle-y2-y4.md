# Event CG Prompts — 중학교 (Y2~Y4, 중1~중3)

> LIFE_TRACK 게임의 중학교(Y2~Y4) 이벤트 CG 생성 프롬프트 모음.
> GPT 등 이미지 생성 AI에게 **캐릭터/배경 레퍼런스 이미지 + 프롬프트**를 함께 입력하여 일관성 있는 CG를 제작.
> 포맷·공통 스타일 앵커는 `docs/event-cg-prompts-y1.md` 정본을 미러링.
> 촬영 대상·choiceIndex·장면 브리프 출처는 `docs/cg-shotlist-2026-06.md` "## 중학교 (Y2~Y4)" 섹션.
> 캐릭터 외형 마커 SSOT는 `docs/character-prompt-spec.md`.

---

## 🎨 공통 스타일 가이드

모든 중학교(Y2~Y4) CG에 공통 적용:

```
Art style: Anime-style illustration, soft pastel colors, gentle lighting,
           same character design as the provided reference sheets.
Era: 2010s~2020s Korean middle school life
Age: 14~16-year-old Korean middle school students (중1~중3)
Uniform: Korean MIDDLE SCHOOL uniform —
  Male: navy blazer + white shirt (NO tie at middle stage) + dark pants + sneakers/loafers
  Female: navy blazer + white shirt + red ribbon + plaid skirt + loafers + knee socks
Composition: cinematic scene, focused emotion, natural lens feel
Resolution: 1440x810 (16:9) or 1080x1440 (3:4 portrait — for character close-ups)
```

**Negative prompt 공통**:
```
no elementary clothing, no high school (no high-school setting/older proportions),
no adult features, no exaggerated anime eyes, no sexualization,
no modern flashy smartphones (plain 2010s~2020s smartphone OK), no tie on middle-stage uniform
```

> ⚠️ 중학생은 초등(사복)과 고등(넥타이·성숙한 비율)의 중간. 교복은 **navy blazer + 흰 셔츠 (넥타이 없음)**.
> 체격은 초등보다 크지만 고등만큼 성숙하지 않게. 얼굴은 spec §4.5 cross-stage face base 유지.

### 📁 파일명 / 리졸버 규칙

리졸버(`src/engine/eventCg.ts`)는 `resolveEventCgUrl(sourceEventId, choiceIndex, gender, year)`로
`{schoolLevel}/{id}_c{ci}_{g}.png` → `{sl}/{id}_{g}` → `{sl}/{id}_c{ci}` → `{sl}/{id}` → `common/...` 순 탐색.
**Y2~Y4 → schoolLevel = `middle`.** 따라서 본 문서 산출물은 전부 `middle/` 디렉토리.

```
public/images/events/middle/
```
- gender 분기 있는 컷: `middle/{eventId}_c{ci}_m.png` + `middle/{eventId}_c{ci}_f.png`
- gender 무관 컷: `middle/{eventId}_c{ci}.png`
- choice 무관 단일 컷(마일스톤): `middle/{eventId}.png`

> 본 담당 이벤트는 모두 **gender 영향이 낮은 장면**(주인공이 화면 비중 작거나 뒷모습/소품 위주,
> 또는 NPC·소품 중심)이라 별도 명시 없으면 **gender 무관 단일 컷**(`_c{ci}` 또는 무접미사)으로 충분.
> 주인공이 정면 비중 큰 컷만 `_m`/`_f` 분기.

---

## ⚠️ 캐릭터 외형 강제 마커 (등장 NPC만, 중학교 교복 버전)

> 인라인 기술이 spec과 어긋나면 spec이 우선. 단체씬 혼동 방지를 위해 핵심 마커는 프롬프트에 직접 박을 것.

### minjae (박민재) — spec L389-416 (middle full body L403-416)
```
[REQUIRED visual markers — must be visible in every minjae image]
- Thin rimless OR thin silver SQUARE-frame glasses (NOT round — round is haeun's marker)
  → defining identity marker, must be clearly visible
- Neat short hair: clean side-part or short cut, dark brown (NEVER buzz cut, NEVER messy)
- Composed half-smile or thoughtful neutral (NEVER wide grin showing teeth)
- Average PALE skin tone (NOT tanned)
- Notebook is signature prop — context-dependent:
  · Classroom / desk / study scenes → in hand OR on desk (visible)
  · Meals / outdoor / ceremonies → set aside (desk/table edge) OR omitted
- Outfit (middle): navy blazer worn PROPERLY BUTTONED + white shirt (NO tie) + dark pants
- Differentiation from player_m: player_m has NO glasses, NO notebook.
  Without these markers minjae and player_m look like the same person.
```

### subin (오수빈) — spec L356-367 (middle full body)
```
- Short black bob cut, clean and well-maintained
- Small gold STAR earrings (marker)
- Calm composed gentle smile, good posture
- Outfit (middle): navy blazer neatly buttoned + white shirt + red ribbon + plaid skirt
  + brown loafers + white ankle socks
- Often holds a neat notebook / pencil case
- Differs from yuna: bob (vs caramel wave), star EARRINGS (vs star hair clip), no glasses
```

### yuna (유나) — spec L443-454 (middle full body)
```
- Medium-length WAVY light brown (caramel) hair
- STAR-shaped HAIR CLIP on right side (marker — vs subin's star earrings)
- NO glasses (haeun's marker)
- Colorful scrunchie bracelet on wrist; sketchbook in baseline (omit in study scenes)
- Bright energetic lively expression
- Outfit (middle): navy blazer + white shirt + red ribbon + plaid skirt + loafers + knee socks
```

### jihun (한지훈) — spec L295-307 (middle full body); player_m 비교 spec L167-178
```
- Short MESSY black hair, slightly spiky (NOT center part — center part is player_m's)
- Athletic build, taller than average, broad shoulders for his age
- Confident friendly GRIN showing teeth (more energetic than player_m's composed half-smile)
- Basketball KEYCHAIN on bag strap (fallback ID cue; ball itself only in sports/outdoor)
- Outfit (middle): navy blazer worn CASUALLY (slightly open) + white shirt + dark pants
  + white sneakers
- Differentiation from player_m (CRITICAL in cluster shots): jihun = messier hair, taller,
  athletic; player_m = soft center part, average build, no prop.
```

### haeun (김하은) — spec L545-571
```
- Dark brown straight BOB cut slightly above the shoulders, natural flyaways
- Black-framed ROUND-rectangle glasses (round is haeun's marker — vs minjae's square/rimless)
- Holding a RED-covered book close to chest with both hands
- Shy thoughtful smile (NOT wide grin), gaze slightly downward
- Outfit (middle): navy blazer + white shirt + LARGE red ribbon + plaid skirt + black knee socks
- NO star hair clip (yuna's marker)
> ⚠️ haeun-distance에서는 하은 본인 미등장(편지/사물함 컷). 위 마커는 본인 등장 시에만.
```

### player_m / player_f (주인공) — spec L163-283
```
[player_m] medium-length black hair soft CENTER part, NO glasses, NO hand prop,
  soft mature half-smile. Middle outfit: navy blazer fully buttoned + white shirt
  (NO tie) + dark pants + black loafers. Color tone neutral (NOT navy-on-navy clash
  with jihun). Average build.
[player_f] dark brown straight shoulder-length hair, warm gentle smile.
  Middle outfit: navy blazer + white shirt + red ribbon + plaid skirt + loafers + knee socks.
> 부모(mother/father)는 본 담당 이벤트(family-strain)에서 화면에 직접은 거의 안 나옴
  (식탁 장면, 주인공 POV·반응 위주). 등장 시 spec L703-744(성인, 40대 초중반) 참조.
```

---

# 📅 중학교 이벤트 CG

```
P1 = 기억 이벤트 (회고 갤러리/히어로에 직접 표시)
P2 = 마일스톤 ANNUAL (EventResultScreen 학년 변곡점 연출)
```

---

## 🔴 P1 — minjae-jealousy — 굳어진 민재

**발동**: Y2~3, minjae met & intimacy≥30, academic≥45, 학기중(쉬는 시간 교실).
**CG**: c0, c1, c2 (3장). gender 무관(민재 중심, 주인공 반응 보조) → `_c{ci}` 단일.
**배경**: `classroom_middle_afternoon`.

### [c0] `middle/minjae-jealousy_c0.png` — 어색하게 먼저 자리를 뜬다 (betrayal/regret/5)
```
Korean middle school classroom during a short break, afternoon light. Minjae (reference —
thin silver square/rimless glasses clearly visible, neat short side-part dark brown hair,
pale skin, navy blazer buttoned) standing near a desk with a composed but slightly tense
expression, his voice lowered. In the foreground, the protagonist is turning away and
stepping toward the classroom door, avoiding eye contact, a faint unresolved heaviness
in the posture (back/side view, face partly hidden). Other students blurred at desks.
Mood: quiet awkward retreat, something left unsettled between two rivals.
```
> 한글 메모: "...너 요즘 진짜 다르더라." 한 톤 낮은 민재. c0=눈을 피해 먼저 교실을 나섬, 풀리지 않은 채로 남음.

### [c1] `middle/minjae-jealousy_c1.png` — "너 덕분에 자극 받았어" 솔직히 (reconciliation/warm/6)
```
Same middle school classroom, break time. Two students facing each other near the desks.
Minjae (reference — square/rimless glasses visible, neat hair, navy blazer) has just lost
his words, turning his head slightly aside, the tension in his shoulders easing a little,
a faint reluctant softness behind the glasses. Protagonist facing him with an honest,
slightly sheepish but warm expression, having just confessed.
Mood: a guarded rival's wall lowering by an inch — warm reconciliation.
```
> 한글 메모: "미안, 너 덕분에 자극 받았어." 민재 "...알아" 하고 고개 돌림. 어깨 힘이 조금 풀림.

### [c2] `middle/minjae-jealousy_c2.png` — "나도 지기 싫어" 경쟁 인정 (reconciliation/resolve/6)
```
Same classroom break time. Minjae (reference — square/rimless glasses visible, neat
side-part, navy blazer) cracking a small involuntary smirk (pfft) — the first genuine
amused half-smile he's let slip, NOT a wide grin. Protagonist beside/across him with a
frank competitive grin, having just admitted "I hate losing too." Between them a feeling
of rivals who are also somehow on the same side.
Mood: competitive but companionable — rivalry acknowledged out loud, a spark of respect.
```
> 한글 메모: "솔직히 나도 지기 싫어." 민재가 피식 웃음. 처음으로 "지는 게 싫다"고 직접 말해줌.

---

## 🔴 P1 — minjae-effort — 새벽의 비밀

**발동**: Y2+, minjae intimacy≥25, `minjae-ranking` 이벤트 후, 학기중. 불 꺼진 빈 교실에 스탠드 하나.
**CG**: c0, c1 (2장). gender 무관 → `_c{ci}` 단일.
**배경**: `classroom_middle_sunset` (촬영 리스트 `classroom_{school}_sunset` → middle).

### [c0] `middle/minjae-effort_c0.png` — "너 공부 많이 하는구나" 솔직하게 (discovery/warm/6)
```
Darkened empty Korean middle school classroom at sunset, lights off except a single desk
lamp glowing in a corner. Minjae (reference — thin silver square/rimless glasses clearly
visible catching the lamp glow, neat short hair, pale skin, navy blazer) sitting alone at
a corner desk with an open notebook, caught off-guard — his face frozen and stiff, the
practiced composure cracked, no smile. He has just been discovered. Protagonist standing
a step away in the dim doorway light, a quiet surprised understanding on the face.
Warm orange sunset light bleeding through windows behind, deep classroom shadows.
Mood: the mask slips — "...들켰네." A secret seen.
```
> 한글 메모: 학원장 아들이 학원도 안 가고 스탠드 하나 켜고 노트 펼침. 굳은 얼굴 "들켰네... 아무한테도 말하지 마."

### [c1] `middle/minjae-effort_c1.png` — "너도 벼락치기?" 가볍게 (betrayal/regret/4)
```
Same darkened sunset classroom, single desk lamp. Minjae (reference — square/rimless
glasses visible, neat hair, navy blazer, open notebook on the lit desk) giving a smile
that is subtly OFF — polite on the surface but not reaching his eyes, a beat of something
unspoken behind the glasses. Protagonist treating it lightly, half-joking posture, not
quite noticing the difference. Warm lamp pool against cold blue dusk through the windows.
Mood: a moment glossed over — a smile that hides more than it shows.
```
> 한글 메모: "뭐야, 너도 벼락치기?" 민재가 웃었지만 그 웃음이 평소와 달랐다(못 본 척한 밤).

---

## 🔴 P1 — minjae-honest — 교실에 남은 민재

**발동**: Y4+(중3), minjae intimacy≥55, 학기중. 방과후 빈 교실, 눈이 붉은 민재가 펜만 쥠.
**CG**: c0, c2 (2장). ⚠️ choiceIndex 주의 — c0=옆에 앉음, c2=그냥 지나침. c1(가볍게 묻는다)은 드래프트 없음→CG 불요.
**배경**: `classroom_middle_afternoon`.

### [c0] `middle/minjae-honest_c0.png` — 아무 말 없이 옆에 앉는다 (reconciliation/warm/7)
```
After-school empty Korean middle school classroom, late afternoon light. Minjae (reference
— thin silver square/rimless glasses, neat short hair, pale skin, navy blazer) at a desk,
eyes faintly red, gripping a pen but writing nothing, the pen now set down on the desk.
Protagonist has quietly sat down in the adjacent seat in silence, no words, just present.
A long shared stillness between them. Soft golden light, empty desks, dust in the air.
Mood: a long wordless silence — the first time minjae's real voice is about to come out.
Composition: two-shot, both seated, quiet and intimate, no dramatic gestures.
```
> 한글 메모: "1등 해도 아무것도 안 달라져. 엄마는 더 하래, 아빠는 당연하대." 처음 듣는 진짜 목소리. 펜을 내려놓음.

### [c2] `middle/minjae-honest_c2.png` — 그냥 지나간다 (betrayal/regret/5)
```
School hallway at late afternoon, viewed from the protagonist's vantage as they walk away
and glance back over the shoulder. Down the dim hallway, one classroom's light is still on
— warm yellow glow spilling from a single doorway/window into the darkening corridor.
Minjae is implied inside (not clearly shown, or a faint silhouette at a desk through the
door glass). Protagonist's back/profile in the foreground, having chosen to pass by.
Mood: the regret of a light left on — a door not opened.
```
> 한글 메모: 그냥 지나침. 복도를 걸으며 돌아본, 꺼지지 않은 교실 불.

---

## 🔴 P1 — school-festival (중학분) — 학교 축제

**발동**: Y≥2 (중·고 공통, 본 문서는 **middle분만**), W30. 축제 준비 교실, 푸드트럭. 수빈이가 홍보 손듦.
**CG**: c0, c1, c2 (3장). gender 무관 → `_c{ci}` 단일. (고등 버전은 별도 작업자 — `high/...`)
**배경**: `festival_classroom` (middle 교복으로 구체화).

### [c0] `middle/school-festival_c0.png` — 수빈이랑 홍보 담당 (courage/resolve/5)
```
Korean middle school classroom decorated for the school festival (food-truck booth theme
— handmade posters, streamers, balloons, a cardboard food-truck setup). Evening before the
festival. Subin (reference — short black bob, gold STAR earrings, navy blazer + red ribbon
middle uniform) and the protagonist putting up a promotional poster on the wall together,
sharing a quick locked glance / nod of teamwork, both energized. Other classmates blurred
decorating in the background.
Mood: pre-festival excitement, a beat of shared resolve and connection over a poster.
```
> 한글 메모: "나도 할게!" 수빈이랑 포스터 제작, 옆 반까지 불러와 반응 폭발. recallText="포스터 붙이다 수빈이와 맞잡은 눈짓."

### [c1] `middle/school-festival_c1.png` — "회계 할게" 뒤에서 조용히 (discovery/warm/4)
```
Festival-decorated middle school classroom, quiet corner away from the bustle. Close-ish
on a ledger/account notebook on a desk, the protagonist's hand writing the day's sales
figures in a corner of the page in neat handwriting. A pen, a cash box / small coin tray,
festival noise and warm string-lights blurred in the background.
Mood: quiet behind-the-scenes contribution — a small private record of a big day.
Composition: soft focus on hand + ledger; protagonist's face optional/partial.
```
> 한글 메모: 회계 담당. 수빈이가 SNS·옆 반까지 돌려 줄이 길어짐. recallText="회계 장부 한 귀퉁이에 그날 매출을 적어둔 내 글씨."

### [c2] `middle/school-festival_c2.png` — 불참 (failure/regret/5)
```
Dim Korean bedroom at night. The protagonist lying on the bed staring up at the ceiling
(back/overhead or side view, face partly hidden), a smartphone glowing in hand showing a
group-chat feed full of bright festival photos from classmates. The contrast between the
warm photos on screen and the dim quiet room.
Mood: the ache of having opted out — left out while everyone else made the memory.
```
> 한글 메모: "몸이 안 좋아서..." 불참, 집에서 쉼. 단톡방 축제 사진. recallText="천장만 보고 있었다."

---

## 🔴 P1 — yuna-study (중학분) — 유나의 부탁

**발동**: academic≥50 & year≠7 (중학분 = Y2~4), W34. 도서관 책상, 유나가 수학 7번 물음.
**CG**: c0, c1 (2장). gender 무관 → `_c{ci}` 단일. (고등 버전은 별도 작업자)
**배경**: `library_middle` (촬영 리스트 `library_{school}` → middle).

### [c0] `middle/yuna-study_c0.png` — "같이 하자" 가르쳐준다 (discovery/warm/5)
```
Korean middle school library, afternoon sunlight through tall windows. Yuna (reference —
caramel WAVY hair with a STAR HAIR CLIP on the right side, NO glasses, navy blazer + red
ribbon middle uniform, scrunchie bracelet) leaning over a shared desk pointing at a math
problem (#7), eyes wide with a bright impressed "wow you're a genius?" expression.
Protagonist beside her explaining, pencil in hand, a quiet pleased focus — teaching helps
them understand it better too. Open math workbook between them. Quiet library, blurred
shelves behind.
Mood: warm intellectual bonding, the small glow of being admired for what you're good at.
```
> 한글 메모: "오 대박, 이거였어? 천재 아냐?" recallText="유나의 '천재 아냐?' 웃는 목소리가 오래 남았다."

### [c1] `middle/yuna-study_c1.png` — "나도 바빠서" 거절 (betrayal/regret/5)
```
Same middle school library, afternoon. Yuna (reference — caramel wavy hair, STAR HAIR CLIP,
no glasses, middle uniform) turning to walk away, seen from behind / three-quarter back,
a light wave of the hand, an "oh okay~" politeness — but the lightness of her departing
back feels a touch too casual, a small disappointment beneath the smile. Protagonist at the
desk, having just declined, a faint regret on the face. Empty library, soft window light.
Mood: a missed small kindness — her too-light departing back lingers.
```
> 한글 메모: 거절. "아 그래? 알겠어~" 웃고 있는데 좀 아쉬워 보임. recallText="돌아서던 유나의 뒷모습이 너무 가볍게 느껴졌다."

---

## 🔴 P1 — school-trip-middle — 수학여행 신청서

**발동**: Y2(중1), W28. 담임이 신청서 배포(경주 2박3일, 10만원). speaker = jihun.
**CG**: c0, c1 (2장). gender 무관 → `_c{ci}` 단일. c2(미룬다)는 드래프트 없음→CG 불요.
**배경**: c0 = 경주 숙소 복도(밤) / c1 = `classroom_middle_afternoon`(텅 빈 교실).

### [c0] `middle/school-trip-middle_c0.png` — 신청서를 낸다 (discovery/warm/6)
```
Nighttime hallway of a Korean school-trip lodging (Gyeongju, 경주 수학여행). Two middle
school boys crouched/sitting on the corridor floor secretly cooking instant ramen on a
small portable burner, steam rising from a pot. Jihun (reference — short MESSY black hair,
athletic build, big confident grin showing teeth) leaning in laughing; protagonist
(player_m, soft center-part hair, no glasses) grinning beside him, finger to lips "shh".
Both in casual night clothes / loosened uniform. Dim corridor lamps, room doors lining the
hall, a mischievous late-night warmth.
Mood: forbidden-snack adventure, two friends, the funniest kind of getting-caught night.
```
> 한글 메모: "간다." 경주 밤 숙소 복도에서 지훈이랑 몰래 라면. 걸려서 혼났지만 더 웃김. recallText="숙소 복도의 라면 냄새."

### [c1] `middle/school-trip-middle_c1.png` — 불참 (betrayal/regret/4)
```
Nearly empty Korean middle school classroom during the school-trip week, daytime. Only a
few students scattered at desks. The protagonist alone at a desk (side/back view, face
partly hidden), looking at a smartphone showing group-chat photos of friends on the trip.
The classroom feels unusually wide and quiet, empty desks all around, flat afternoon light.
Mood: the quiet hollow of being left behind — the room too big without everyone.
```
> 한글 메모: "돈이 좀..." 집안 사정으로 불참. 단톡방 사진 보며 먹먹. recallText="교실이 유난히 넓었다."

---

## 🔴 P1 — middle-burnout — 중2의 긴 겨울

**발동**: **Y3 전용**(중2), idleWeeks≥3 & mental≤55. 밤 자기 방 책상. 주인공 단독 위주.
**CG**: c0, c1, c2 (3장). gender 무관(방·주인공 단독, 사복) → `_c{ci}` 단일.
**배경**: `bedroom_night`.

### [c0] `middle/middle-burnout_c0.png` — 억지로 공부한다 (failure/regret/7)
```
Korean teenager's bedroom at night. The protagonist (middle-schooler, in casual home
clothes) slumped at a study desk under a desk lamp, forcing themselves to study but
clearly hollowed out — pen idly rolling, eyes unfocused, an open textbook unread. On the
desk a cup of coffee gone cold, a faint coffee ring/stain. The night drags; window dark
behind. Heavy, exhausted atmosphere.
Mood: burnout pushing through anyway — a cold-coffee, glazed-over winter night.
```
> 한글 메모: "그래도 억지로 공부한다." 글자가 안 읽힘, 커피만 식음. recallText="책상 위 커피 얼룩만 늘어가던 중2의 긴 겨울."

### [c1] `middle/middle-burnout_c1.png` — 오늘은 쉰다 (growth/breakthrough/8)
```
Same bedroom at night. The protagonist has set the desk aside and crawled under the
blanket on the bed, curled and finally letting go — a loosening of the shoulders, a long
breath returning before any guilt. Desk lamp dimmed, soft warm low light, the room quiet
and safe. A subtle sense of relief washing in.
Mood: the breath that comes back before the guilt — choosing rest, a quiet breakthrough.
```
> 한글 메모: "오늘은 아무것도 안 한다." 이불 안으로. recallText="죄책감보다 숨이 먼저 돌아왔다."

### [c2] `middle/middle-burnout_c2.png` — 지훈이에게 전화 (growth/warm/8)
```
Korean teenager's bedroom at night. The protagonist sitting on the floor or bed holding a
smartphone to the ear, having called jihun, shoulders dropping as they finally say "...I'm
struggling." On the call (could be shown via a small inset or implied, OR jihun as a warm
glow on the screen) jihun (reference — messy black hair, athletic) just listens. Dim warm
room, a single soft light, the relief of being heard without being fixed.
Mood: warmth of a friend who just listens — "힘들어" said out loud at last.
```
> 한글 메모: "지훈이에게 전화 — 힘들다고." 조언이 아니라 그냥 들어줌. recallText="힘들다고 말했더니, 지훈이는 그냥 들어줬다."

---

## 🔴 P1 — family-strain — 식탁 위 침묵

**발동**: Y3~6 (중·고 공통, 식탁 장면이라 **common 권고도 가능하나 본 담당은 middle 작성**), idleWeeks≥4 또는 (mental≤45 & academic≤55).
저녁 식탁, 아빠 "뭐 하는 거니". 가족 장면(NPC 마커 없음, 부모는 spec L703-744 성인).
**CG**: c0, c1, c2 (3장). gender 무관(주인공 사복, 식탁) → `_c{ci}` 단일.
**배경**: `dinner_table`.

> 메모: shotlist 권고상 집 식탁이라 common 1세트로도 충분(교복 무관). 본 문서는 middle 디렉토리 버전을
> 명시하나, 예산상 common 통합 시 톤 동일. 주인공 의상은 **사복**(교복 아님 — 저녁 집).

### [c0] `middle/family-strain_c0.png` — "제가 알아서 할게요" 맞받아친다 (betrayal/regret/7)
```
Korean home, evening. A closed bedroom door seen from the inside; the protagonist (middle
schooler in casual home clothes) sitting on the floor with their back leaned against the
inside of the just-closed door, knees up, head down — having just left the dinner table.
Faint warm hallway light leaking under the door. A defended posture that doesn't feel like
winning. Quiet, heavy stillness.
Mood: a defense that brought no victory — alone behind a shut door.
```
> 한글 메모: 수저 놓고 방으로, 문 닫고 벽에 기대 앉음. recallText="방문 안쪽에 기대어 앉아 있던 저녁."

### [c1] `middle/family-strain_c1.png` — 묵묵히 듣는다 (failure/regret/6)
```
Korean dinner table, evening, heavy air. The protagonist (middle schooler, casual home
clothes) seated at the table, head slightly lowered, silently enduring a parent's long
lecture (parent can be a partial/blurred adult figure across the table, face not central
— per spec parents are 40s adults, but keep focus on the protagonist's quiet endured
expression). Untouched rice bowl, chopsticks set down. Dim warm kitchen light.
Mood: silently taking it all in — words that bounce off, a draining evening.
```
> 한글 메모: 한참 잔소리, 반박 안 함. 끝나고 방에서 책 폈지만 글자가 튕겨나감. recallText="식탁에서 묵묵히 잔소리를 다 듣던 날."

### [c2] `middle/family-strain_c2.png` — "저 사실 힘들어요" 솔직히 (reconciliation/warm/8)
```
Korean dinner table, evening. The protagonist (middle schooler, casual home clothes) has
just quietly said "I'm actually having a hard time." Across/beside, the mother's composed
expression breaking — a softening, eyes welling, a hand half-reaching; the father gone
still. (Parents as warm 40s adults per spec L703-744; mother soft shoulder-length brown
hair + knit cardigan, father short black hair w/ grey temples + collared knit.) The tense
air at the table loosening for the first time. Warm low kitchen light.
Mood: the table's air finally releasing — honesty that lets the family back in.
```
> 한글 메모: "저 사실 힘들어요." 엄마 "...왜 이제 말해." 식탁 공기가 처음으로 풀어짐. recallText="엄마 표정이 무너지던 저녁."

---

## 🔴 P1 — haeun-distance — 하은 선배의 편지

**발동**: **Y4 전용**(중3), haeun intimacy 40~80, 학기중. ⚠️ speaker 없음 — **편지/사물함 컷**(하은 본인 미등장).
**CG**: c0, c1, c2 (3장). gender 무관(소품·손·뒷모습 위주) → `_c{ci}` 단일.
**배경**: `hallway_middle` (촬영 리스트 `hallway_{school}` → middle).

### [c0] `middle/haeun-distance_c0.png` — 답장을 써서 우편함에 넣는다 (reconciliation/warm/5)
```
Korean middle school hallway by a wall of lockers, afternoon. Close-ish on the
protagonist's hands sliding a handwritten reply letter (folded paper) into a school mail
box / drop box; or a quiet shot of them just having posted it, turning to walk back down
the sunlit corridor with an oddly lightened, relieved expression. A folded note + pen
implied (they spent an hour writing it). Warm low afternoon light through hallway windows.
NOTE: haeun herself does NOT appear — this is a letter/locker-centric scene.
Mood: the quiet relief of replying — a goodbye answered with care.
```
> 한글 메모: 하은 선배 편지가 사물함에 끼어 있음. c0=한 시간 답장 써서 우편함에. recallText="한 시간 걸려 쓴 답장."

### [c1] `middle/haeun-distance_c1.png` — 가방에 넣고 못 꺼낸다 (betrayal/regret/4)
```
Korean middle school setting. A crumpled folded letter pushed into the bottom corner of a
school bag, half-buried under books, slightly creased — close, still-life-like framing of
the bag's open mouth and the wrinkled paper. Dim, slightly cold light. The protagonist's
hand or shadow optional, hesitant, not pulling it out. A whole semester implied to have
passed over it.
NOTE: haeun does NOT appear — letter-centric.
Mood: the reply never written — a note left to wrinkle in a bag corner.
```
> 한글 메모: 답장을 써야지 하다가 학기가 지나감. recallText="끝내 답장을 못 쓴 채로 학기가 지나갔다."

### [c2] `middle/haeun-distance_c2.png` — 편지만 보관하고 접는다 (growth/resolve/4)
```
A quiet domestic/desk close-up: the folded letter being placed flat at the very bottom of
a desk drawer, beneath other items, the drawer about to close. Calm, unhurried framing,
soft even light. Not sad — a deliberate, accepting gesture of keeping a memory put away.
The protagonist's hand placing it; face not necessary.
NOTE: haeun does NOT appear — letter-centric.
Mood: some relationships end like this — a memory filed away, no grief.
```
> 한글 메모: "자연스러운 거지." 책상 서랍 맨 아래에 보관. recallText="서랍 맨 아래 넣은 날. 슬프진 않았다."

---

# 🟠 P2 — 마일스톤 ANNUAL (EventResultScreen)

> ANNUAL은 기억 슬롯을 만들지 않으나 결과 화면에서 CG를 표시 → 학년 변곡점 연출.
> 전부 choice 무관 **공통 1장** 권장. 파일명 `middle/{eventId}.png` (choiceIndex 미지정 폴백 활용).

## 🟠 middle-school-entrance — 중학교 입학식

**발동**: Y2, W1. speaker = subin. 새 교복 입고 중학교 교문, 긴장+설렘.
**파일**: `middle/middle-school-entrance.png` (공통 1장).
**배경**: `school_gate_middle`.
```
First day of Korean middle school, at the school gate. The protagonist standing just
inside a brand-new, slightly stiff middle-school uniform (navy blazer + white shirt, NO
tie), a mix of nervousness and excitement, looking up at the big unfamiliar school
building. Beside them, Subin (reference — short black bob, gold STAR earrings, navy blazer
+ red ribbon uniform) cheerfully linking arms, saying "let's go together~", upbeat and
reassuring. Spring morning light, cherry-ish fresh-start atmosphere, older students and a
welcome banner blurred behind.
Mood: a big new beginning — heart racing, "can I do well here?" softened by a friend.
```
> 한글 메모: "야, 여기 진짜 크다! 같이 다니자~" 수빈이가 팔짱 낌. 긴장되면서도 설렘.

## 🟠 middle2-start — 중2, 시작

**발동**: Y3, W1. 중2 개학 교실, 창밖 벚꽃, 후배 생긴 뿌듯함.
**파일**: `middle/middle2-start.png` (공통 1장).
**배경**: `classroom_middle_spring` (촬영 리스트 `classroom_{school}_spring` → middle).
```
First day of the new school year in a Korean middle school classroom, now familiar and
comfortable. The protagonist (navy blazer + white shirt, NO tie) at a desk with a settled,
slightly proud ease — a second-year now, with juniors below them. Cherry blossoms visible
through the classroom window. Soft warm spring morning light, relaxed classmates around.
Mood: comfortable belonging — the awkward-but-proud feeling of being an upperclassman.
```
> 한글 메모: 2학년, 후배 생김. 복도 인사 어색하면서도 뿌듯. 창밖 벚꽃.

## 🟠 middle3-start — 중3, 마지막 해

**발동**: Y4, W1. 중3 첫날, 진지해진 교실 "고등학교 진학".
**파일**: `middle/middle3-start.png` (공통 1장).
**배경**: `classroom_middle` (촬영 리스트 `classroom_{school}` → middle).
```
First day of the final middle-school year, Korean classroom. The mood is noticeably more
serious than before — students sitting up straighter, a quieter weight in the air as the
homeroom teacher speaks about high-school entrance ahead. The protagonist (navy blazer +
white shirt, NO tie) with a more grown, focused expression. Morning light, a chalkboard
with the new term written, classmates attentive rather than chatty.
Mood: the seriousness of a last year — high school looming on the horizon.
```
> 한글 메모: "올해는 고등학교 진학이 있으니까 정신 차려야 해." 교실 분위기가 진지해짐.

## 🟠 middle-school-graduation — 중학교 졸업식

**발동**: Y4, W46. speakers = jihun, subin, minjae, yuna. 졸업식 강당, 4인 단체사진, 눈 빨갛게.
**파일**: `middle/middle-school-graduation.png` (c0 단체사진 컷이 대표 → 공통/c0).
**배경**: `auditorium_middle`.
```
Korean middle school graduation day, in the auditorium. The protagonist taking a final
group photo together with four friends — Jihun (reference: messy black hair, athletic,
grin), Subin (reference: black bob, STAR earrings, red ribbon uniform), Minjae (reference:
square/rimless glasses, neat hair, navy blazer), and Yuna (reference: caramel wavy hair,
STAR hair clip, no glasses) — all in middle-school uniforms, holding diplomas. Everyone
smiling but with reddened, teary eyes. Warm auditorium light, graduation banners and
balloons softly behind, a bittersweet end-of-three-years glow.
Mood: tearful warm farewell — "let's meet again in high school", the close of an era.
> ⚠️ 5인 단체. 각 NPC 마커가 모두 또렷이 구분되게(특히 minjae 안경 vs player_m, jihun 머리). 모두 넥타이 없는 중학교 교복.
```
> 한글 메모: "우리 고등학교 가서도 만나자." 단체사진, 다들 웃지만 눈 빨갛게.

## 🟠 midterm-1 (중학분) — 첫 중간고사

**발동**: Y≥2 (중·고 공통, 본 문서 **middle분만**), W7. 쉬는시간에도 책 편 교실. (고등 버전 별도 작업자)
**파일**: `middle/midterm-1.png` (공통 1장).
**배경**: `classroom_middle` (촬영 리스트 `classroom_{school}` → middle).
```
Korean middle school classroom in the week before midterm exams, the atmosphere shifted —
even during break time students have their textbooks open, heads down studying. The
protagonist (navy blazer + white shirt, NO tie) among them, a focused exam-season tension.
Daytime classroom light, books and notes on desks, a quietly studious hum.
Mood: the pre-exam pressure settling over the room — first midterms of middle school.
> 메모: c2 선택지(친구들이랑 같이 공부)는 유나와 함께지만 본 마일스톤 컷은 결과화면용 분위기 1장이라 단체 불요.
```
> 한글 메모: 중간고사 다가옴, 교실 분위기 달라짐. 쉬는 시간에도 책 폄.

## 🟠 final-exam-2 (중학분) — 기말고사

**발동**: Y≥2 (중·고 공통, 본 문서 **middle분만**), W37. 2학기 기말, 올해 마지막 시험의 무게. (고등 버전 별도)
**파일**: `middle/final-exam-2.png` (공통 1장).
**배경**: `classroom_middle` (촬영 리스트 `classroom_{school}` → middle).
```
Korean middle school classroom during the second-semester final exams, late in the year.
A heavier, more weighted quiet than the midterms — this is the last test of the year and
it goes straight onto the report card. The protagonist (navy blazer + white shirt, NO tie)
at a desk mid-exam or in tense final review, a tired determined focus. Cooler late-autumn
light through the windows, exam papers on desks, a hushed serious room.
Mood: the weight of the year's last exam — everything riding on this one.
```
> 한글 메모: 2학기 기말, 올해의 마지막 시험. 이번 성적이 통지표에 그대로 감.

---

## 📋 산출 요약 (파일 목록)

**P1 (기억 이벤트)** — 모두 `middle/` :
- `minjae-jealousy_c0 / _c1 / _c2`
- `minjae-effort_c0 / _c1`
- `minjae-honest_c0 / _c2` (c1 드래프트 없음 제외)
- `school-festival_c0 / _c1 / _c2` (middle분)
- `yuna-study_c0 / _c1` (middle분)
- `school-trip-middle_c0 / _c1` (c2 드래프트 없음 제외)
- `middle-burnout_c0 / _c1 / _c2`
- `family-strain_c0 / _c1 / _c2`
- `haeun-distance_c0 / _c1 / _c2`

**P2 (마일스톤 ANNUAL)** — 모두 `middle/`, 공통 1장 :
- `middle-school-entrance` · `middle2-start` · `middle3-start`
- `middle-school-graduation` (c0 단체 대표)
- `midterm-1` (middle분) · `final-exam-2` (middle분)

---

# 📅 초등 친구와의 이별 (Y2 발동 → middle CG)

> doyun-school-split: 내용은 초등 친구지만 Y2 발동이라 schoolLevel=middle → 파일이 middle/. 폰/방 컷이라 교복 거의 안 보임.

## 🔴 W2(Y2) doyun-school-split — 도윤이는 다른 학교 (★middle 디렉토리 함정)

**발동조건**: `year === 2 && doyun.met`, W2. **Y2 발동 → schoolLevel=middle** → 파일은 `middle/` 디렉토리.
**Scene**: 중학교 입학 둘째 주. 카톡으로 도윤이가 "나 다른 중학교 가게 됐어. 학군 때문에 이사 가더라고. 미리 말 못해서 미안~~" 읽고 한참 가만히 있었다.
**톤**: 혼자 방 안에서 폰 화면을 보는 컷. 교복 거의 안 보임 — 실내 사복/13세.

**References**: `player_m_*` / `player_f_*` (실내 사복, 후방·측면 실루엣 권장) · `home_evening.png`
> NPC(도윤) 직접 등장 X — 폰 화면의 카톡 말풍선으로만 존재.

### [c0] "야 진짜야? 우리 만나서 밥이라도 먹자" — 약속을 잡으려 한다

> 결과: "도윤이가 '오 진짜? 좋지!!!' 답했지만, 약속은 결국 잡히지 않았다." (discovery/regret/6)

**파일명** `middle/doyun-school-split_c0.png`
```
A 13-year-old Korean kid (protagonist, back view or side silhouette, face hidden/downcast)
alone in their own bedroom in the evening, sitting on the floor or bed, holding a smartphone.
Phone screen lit, showing a Korean messaging app chat (generic, no brand): a long hopeful
message just sent ("우리 만나서 밥이라도 먹자"), reply bubble "오 진짜? 좋지!!!" — but the
chat trails off, no follow-up scheduling. Indoor casual home wear (NO school uniform visible).
Through window: blue evening sky, a single streetlamp on.
Mood: a promise made that quietly never happens — first lesson that different schools mean
different time. Bittersweet, not bitter.
```

### [c1] "잘 가" — 짧게 답한다

> 결과: "'응. 너도 잘 지내.' 도윤이의 답도 짧았다. 그렇게 카톡 창이 닫혔다." (failure/regret/7)

**파일명** `middle/doyun-school-split_c1.png`
```
Same bedroom-evening setting, protagonist (back/side silhouette, face hidden). Phone screen
shows a very short exchange: "잘 가" sent, "응. 너도 잘 지내." reply — then the thumb hovering
over a closed/dimming chat. The screen is about to go dark. Indoor casual wear, NO uniform.
Dim warm room, single lamp, cold blue light from the phone on the face/hand.
Mood: a relationship closing in two short lines — quiet regret of words not said.
```

### [c2] 읽씹한다 — 뭐라고 답해야 할지 모르겠다

> 결과: "하루, 이틀, 일주일이 지나자 답할 수 없는 분위기가 됐다." (failure/regret/7)

**파일명** `middle/doyun-school-split_c2.png`
```
Same bedroom-evening setting. The phone lies face-up on the desk or floor, screen showing
Doyun's last unanswered message ("...미리 말 못해서 미안~~") marked READ (읽음) but with no reply,
a "1" read-mark gone. Protagonist (back view / out of frame, only a shoulder or hand at the
edge) NOT touching the phone — frozen, unable to type. Indoor casual, NO uniform.
Several days implied (a calendar / faint time passing). Dim cooling light.
Mood: the ache of a message you couldn't bring yourself to answer — a spring that quietly faded.
```

