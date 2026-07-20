# 미생성 배경 에셋 17종 이미지 생성 프롬프트

> 2026-07-20 검수 갱신: school_entrance_rain을 시우 전용으로 재지정(유나 컷은 기존 school_gate_{school}_rain 사용),
> jihun-hs-injury를 school_bench에서 분리해 infirmary 신규 추가 (16→17종).

공통 상속: Anime-style illustration, soft pastel colors, gentle lighting. 2010s-2020s Korean school life tone. 모든 배경은 EventScene 캐릭터 합성용 빈 장면이며, 인물/실루엣/읽을 수 있는 글자/간판 문구를 배제한다.

## Tier 1 - 폴백 없음

### cafeteria_middle - 중학 급식실
**파일**: `game/public/images/backgrounds/cafeteria_middle.png` · 1440x810
**사용**: jihun-half-gimbap, jihun-ramen-bet, subin-cafeteria-line, subin-runs-without-me, minjae-three-minute-math
**장면**: 점심 종 직후의 중학교 급식실/매점 분위기. 삼각김밥, 컵라면, 빵, 무가당 두유처럼 간단한 점심 소품과 스테인리스 식판, 긴 테이블, 줄 서는 동선이 공통 근거다.
수빈의 북적이는 줄과 혼자 앉은 식판, 민재의 진열대 앞 선택, 지훈의 나눠 먹는 간식이 모두 올라갈 수 있도록 중앙 하단은 비우고 소품은 가장자리로 둔다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean middle school cafeteria with a small snack counter, stainless trays, long tables, cup ramen hot-water corner, wrapped rice balls, bread, and soy milk on side shelves.
Early lunch break atmosphere after the bell, warm fluorescent daylight, tidy but lived-in, soft reflections on the floor.
Keep the lower-center third open for standing characters; place tables, counter, and food details to the left and right edges.
No visible school-level clues beyond a modest middle school cafeteria mood; no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; menu boards, labels, posters, and notices are blurred or indistinct.
Wide 16:9 composition, 1440x810, natural lens feel, no vertical framing.
```

### bus_stop_evening - 공용 저녁 정류장·횡단보도
**파일**: `game/public/images/backgrounds/bus_stop_evening.png` · 1440x810
**사용**: subin-name-or-school, jihun-hs-firstgap, siwoo-last-signal
**장면**: 하굣길 저녁의 시내버스 정류장과 횡단보도가 공통 배경이다. 수빈은 학교 이름으로 불리는 정류장, 지훈은 약속을 깜빡한 다음 날의 어색한 사과, 시우는 모두가 건넌 뒤 끝물에 건너는 횡단보도 장면이다.
여러 학교가 섞이는 공용 장소로 보이되 특정 학교명·버스 번호·간판 문자는 보이지 않게 처리한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A shared Korean evening bus stop beside a crosswalk, glass shelter, curb, traffic signal glow, faint phone-light mood, and distant school-route street.
Dusk sky with warm streetlights turning on, a small feeling of after-school distance and missed timing.
The crosswalk and shelter frame the scene from the sides, leaving the lower-center third open and uncluttered.
Public shared setting, no specific school-grade identity, no readable bus numbers, no school names, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; route maps, advertisements, name tags, and signs are blurred or indistinct.
Wide 16:9 composition, 1440x810, cinematic but quiet, no vertical framing.
```

### night_bus - 공용 밤 시내버스 실내
**파일**: `game/public/images/backgrounds/night_bus.png` · 1440x810
**사용**: subin-cant-leave-chat, jihun-hs-latenight
**장면**: 늦은 밤 하굣길 시내버스 내부. 수빈은 죽은 단톡방을 못 나가는 뒷자리, 지훈은 야자 끝 같은 버스에서 처음 할 말이 없어진 침묵이 핵심이다.
어두운 창밖, 지나가는 가로등, 비어 있는 좌석, 휴대폰 빛 정도로 밤의 조용한 압박을 만든다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A late-night Korean city bus interior, rear seats visible, dim warm cabin lights, dark windows streaked with passing streetlights.
Quiet after-school ride mood, almost empty bus, soft reflections on metal poles and window glass.
A small phone glow or school bag silhouette may sit off to one side, but the lower-center third remains open for characters.
Shared public transit setting, no school-grade-specific uniform posters, no route numbers, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; safety notices, route maps, and ads are blurred or indistinct.
Wide 16:9 composition, 1440x810, calm natural lens, no vertical framing.
```

### school_bench - 공용 교정 벤치
**파일**: `game/public/images/backgrounds/school_bench.png` · 1440x810
**사용**: haeun-brothers-book
**장면**: 교정 한쪽의 조용한 벤치/쉼터. 하은이 물려받은 참고서를 펼쳐 으스대다 표지 안쪽 오빠 이름에서 멈추는 장면 — 열린 참고서와 나무 그늘, 쉬어 가는 자리의 온기가 핵심이다.
(jihun-hs-injury는 본문이 "보건실 침대"라 신규 `infirmary`로 분리 — 아래 항목.)

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A quiet Korean school campus bench beside a low school building wall, with a shaded tree, tiled walkway, and soft afternoon light.
An open reference book and a small drink are placed near the side of the bench, suggesting study and an easy senior-junior chat without showing anyone.
Keep the bench slightly off-center and the lower-center third visually open for standing characters.
Shared schoolyard setting, not clearly middle or high school, no uniform posters, no grade-specific decorations, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; book cover names and building notices are blurred or indistinct.
Wide 16:9 composition, 1440x810, gentle natural lens, no vertical framing.
```

### infirmary - 공용 보건실
**파일**: `game/public/images/backgrounds/infirmary.png` · 1440x810
**사용**: jihun-hs-injury
**장면**: 체대 입시 연습 중 발목을 접질린 지훈이 보건실 침대에 앉아 있는 장면. 침대와 커튼, 창가의 부드러운 빛, 구급 소품이 핵심이며 심각한 병원 톤이 아니라 학교 보건실의 담담한 온기여야 한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean school infirmary interior: a neat sickbed with white sheets, a half-drawn privacy curtain, a small medicine cabinet, a desk with simple first-aid supplies, and soft daylight through a window.
Calm, reassuring school-nurse-room mood — an ankle-sprain visit, not a hospital; an ice pack and a rolled bandage rest on a side tray.
Place the bed and curtain slightly to one side; keep the lower-center third open for standing and seated characters.
Shared school setting, not clearly middle or high school, no grade posters, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; charts, labels, and posters are blurred or indistinct.
Wide 16:9 composition, 1440x810, clean natural lens, no vertical framing.
```

### school_entrance_rain - 빗속 철거 골목 (siwoo 전용)
**파일**: `game/public/images/backgrounds/school_entrance_rain.png` · 1440x810
**사용**: siwoo-demolished-ground
**장면**: 시우가 어릴 때 살던 주택가 골목, 절반이 펜스로 막혀 철거 중이다. 펜스 틈으로 보이는 한 집의 빈터, 빗물이 비켜 가는 낮은 흙턱이 핵심 디테일이다.
(yuna-transfer-rumor는 본문이 "현관 처마 밑"이라 기존 `school_gate_{school}_rain` 에셋으로 재지정됨 — 이 배경은 시우 컷 전용.)

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A rainy old Korean residential alley half-blocked by temporary demolition fencing, with a glimpse through the fence gap of an empty house lot where a home once stood.
Gray rain atmosphere, wet cracked pavement, puddles pooling along one side, and a low hand-packed dirt ridge where water quietly parts around a bare spot.
Nostalgic, elegiac mood of a demolished childhood neighborhood, not dangerous or ruined-looking, just quietly emptied.
Place the fence and alley walls to the sides; keep the lower-center third open for characters standing in the rain.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; demolition notices, warning tape, and house plates are blurred or indistinct.
Wide 16:9 composition, 1440x810, subdued cinematic rain, no vertical framing.
```

### snack_bar - 공용 학교 앞 분식집
**파일**: `game/public/images/backgrounds/snack_bar.png` · 1440x810
**사용**: jihun-mirror-height
**장면**: 하굣길 학교 앞 분식집에서 떡볶이를 기다리는 장면. 거울에 나란히 비친 키 차이와 초등 때부터의 추억이 핵심이므로, 큰 벽거울과 주문대, 떡볶이 냄비가 필요하다.
공용 장소로 보이게 학교급 단서는 배제하고, 간판·메뉴 글자는 모두 읽히지 않게 둔다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A small Korean snack bar near school after class, with a wide wall mirror, tteokbokki pot, fishcake steam, metal counter, plastic trays, and simple stools.
Warm late-afternoon street light coming through the front window, nostalgic everyday mood.
The mirror sits to one side for reflected height-comparison staging, while the lower-center third stays open for standing characters.
Shared school-front shop, no specific school-grade clues, no brand logos, no real franchise identity.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; menus, price tags, posters, and window decals are blurred or indistinct.
Wide 16:9 composition, 1440x810, cozy natural lens, no vertical framing.
```

### bus_stop_morning - 공용 아침 정류장
**파일**: `game/public/images/backgrounds/bus_stop_morning.png` · 1440x810
**사용**: subin-hundred-chats
**장면**: 등굣길 아침 정류장. 수빈의 수십 개 단톡방 알림과 "직접 온 톡은 없다"는 장면이므로, 바쁜 통학 전 시간대와 조용한 개인적 외로움이 동시에 필요하다.
휴대폰 알림은 읽을 수 없는 빛이나 추상적인 말풍선 형태로만 처리한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean morning bus stop on a school commute route, pale sunrise, glass shelter, bench, curb, and quiet street before the rush.
A small smartphone glow on the side bench suggests many muted notifications, all abstract and unreadable.
Fresh morning air, long soft shadows, ordinary commuting mood with a slight lonely pause.
Keep the shelter and bench to the side, preserving the lower-center third as open space for characters.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; route maps, bus stop signs, phone notifications, and ads are blurred or indistinct.
Wide 16:9 composition, 1440x810, shared public setting, no vertical framing.
```

### hagwon_shuttle - 공용 학원 셔틀
**파일**: `game/public/images/backgrounds/hagwon_shuttle.png` · 1440x810
**사용**: subin-mom-namecard
**장면**: 학원 셔틀 안에서 가방에서 명함 한 장이 떨어지는 장면. 수빈의 엄마 명함과 학원 이동 중의 좁은 실내가 핵심이므로, 좌석, 통로, 가방, 빈 명함 같은 소품이 필요하다.
학원명·전화번호·광고 문구는 절대 읽히지 않게 한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
Inside a small Korean academy shuttle bus at dusk, narrow aisle, vinyl seats, school bags tucked beside seats, soft city light through the windows.
A single blank business card lies near the aisle by a bag, with no readable information, hinting at a private family detail.
Quiet transitional mood between school and hagwon, intimate but still a shared public vehicle.
Seat backs and window frames guide the eye from the sides, leaving the lower-center third open for characters.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; academy decals, business card print, and safety notices are blurred or indistinct.
Wide 16:9 composition, 1440x810, no vertical framing, no brand logos.
```

### alley_night - 공용 밤 주택가 골목
**파일**: `game/public/images/backgrounds/alley_night.png` · 1440x810
**사용**: subin-two-of-us-home
**장면**: 가로등 켜진 동네 골목에서 전단 가방을 든 수빈과 마주치는 장면. 엄마와 둘이 살고 밤에도 같이 번다는 고백이므로, 주택가의 조용한 밤, 전단 묶음, 생활감 있는 골목이 필요하다.
가게 간판이나 전단 문구는 읽히지 않게 하고, 공용 주거지 톤으로 구성한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A quiet Korean residential alley at night, warm streetlamp glow, low apartment walls, small gates, utility poles, and damp pavement.
A tote bag or bundle of flyers rests near one side under the streetlight, with all papers indistinct and unreadable.
Hushed late-night neighborhood mood, honest and grounded, not dangerous or dramatic.
Keep walls and streetlamp framing to the sides, leaving the lower-center third open for characters walking or standing.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; flyers, house numbers, shop signs, and stickers are blurred or indistinct.
Wide 16:9 composition, 1440x810, shared non-school setting, no vertical framing.
```

## Tier 2 - 근사 폴백 전용화

### faculty_hallway - 공용 교무실 앞 복도
**파일**: `game/public/images/backgrounds/faculty_hallway.png` · 1440x810
**사용**: jihun-different-path, minjae-point-one, minjae-good-on-his-own, yuna-teacher-comment, haeun-before-application
**장면**: 교무실 앞 복도에서 원서, 석차표, 소견문, 교사 부모와의 마주침, 다른 학교 가능성 같은 진학/평가 장면이 이어진다. 게시판과 교무실 문, 창가, 서류를 공통 장치로 둔다.
중학·고교 모두 쓰는 공용 배경이므로 특정 학교급 포스터나 학년 단서는 흐리게 처리한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean school faculty-office hallway, frosted teacher-room doors, bulletin board, window light, stacked forms, application envelopes, and rank-sheet-like papers on a side table.
Quiet tense school-administration mood: recommendations, applications, scores, and paths about to split.
Frame the bulletin board and office door to the side; keep the lower-center third open for characters standing in the hallway.
Shared middle/high school setting, no specific grade markers, no readable school names, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; charts, forms, notices, and name plates are blurred or indistinct.
Wide 16:9 composition, 1440x810, natural lens, no vertical framing.
```

### locker_hallway - 공용 사물함 복도
**파일**: `game/public/images/backgrounds/locker_hallway.png` · 1440x810
**사용**: jihun-locker-code, jihun-six-years-photos, minjae-locker-timetable, yuna-clearing-locker
**장면**: 사물함 비밀번호, 6년치 사진이 쏟아지는 폴더, 문 안쪽 분 단위 시간표, 미리 비우는 악보·상장·책이 모두 같은 사물함 복도에 걸린다.
추억이 쏟아지거나 떠날 준비를 하는 장면을 받을 수 있도록 열린 사물함과 종이가방, 사진 더미, 책을 가장자리 소품으로 둔다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean school locker hallway with rows of muted lockers, a few slightly open doors, shoe cubby details, and soft daylight from a corridor window.
Side details include a spilled photo folder, folded schedule paper, music sheets, books, and a paper bag, all arranged away from the center.
Everyday hallway mood with a quiet sense of memory and early departure.
Keep the locker rows receding diagonally and the lower-center third open for character standing positions.
Shared school setting, not clearly middle or high school, no specific school emblems, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; locker labels, schedules, photos, certificates, and notes are blurred or indistinct.
Wide 16:9 composition, 1440x810, no vertical framing.
```

### counseling_hallway - 공용 진로·상담실 앞
**파일**: `game/public/images/backgrounds/counseling_hallway.png` · 1440x810
**사용**: minjae-displayed-model, jihun-hs-track, minjae-hs-choice, siwoo-hobby-seat
**장면**: 상담실 밖 반투명 유리문, 진학실 앞 게시판, 고3 상담 주간의 구겨진 진학 자료, 비상계단 참에서 보는 동네가 공통 장치다. 진로 선택과 타인이 정한 길 앞에서 멈추는 정서를 담는다.
진학 게시판과 상담실 표식은 있어도 글자는 읽히지 않게 하며, 중고교 공용 톤으로 둔다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean career counseling hallway beside frosted glass counseling-room doors, admissions bulletin board, plastic waiting chairs, brochures, and a nearby stair-landing window overlooking rooftops.
Career-decision-week mood: quiet, suspended, with papers and guidebooks slightly rumpled on a side chair.
Place the board, door, and stair-window to the sides, leaving the lower-center third open for characters.
Shared middle/high school setting, no specific grade identity, no university names, no school logos, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; admissions posters, guidebook covers, door labels, and notices are blurred or indistinct.
Wide 16:9 composition, 1440x810, soft daylight, no vertical framing.
```

### club_room - 공용 동아리방
**파일**: `game/public/images/backgrounds/club_room.png` · 1440x810
**사용**: subin-applause-stage, haeun-handover-note
**장면**: 장기자랑 무대가 끝난 뒤 정리하는 동아리방과, 졸업 선배에게 물려받은 방에서 인수인계 노트를 건네는 장면이 공통이다. 마이크 줄, 접이식 의자, 박스, 빼곡한 노트 같은 소품이 필요하다.
특정 동아리나 학교급을 고정하지 않는 다목적 동아리방으로 구성한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A multipurpose Korean school club room after a small performance, folding chairs, stacked boxes, coiled microphone cables, portable speaker, low table, and a handover notebook near the side.
Post-event cleanup mood, faint applause memory, practical and slightly cluttered but warm.
Keep stage props and tables around the edges, with the lower-center third open for character compositing.
Shared club-room setting, no specific club name, no school-grade markers, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; notebook pages, labels, posters, and equipment stickers are blurred or indistinct.
Wide 16:9 composition, 1440x810, natural indoor lens, no vertical framing.
```

### study_room_night - 공용 밤 자습실
**파일**: `game/public/images/backgrounds/study_room_night.png` · 1440x810
**사용**: minjae-red-pen, haeun-highlighter-overdraw
**장면**: 야간 자습실에서 민재는 빨간펜 채점 습관을, 하은은 고등 입시자료 한 줄을 형광펜으로 덧칠하는 불안을 드러낸다. 책상, 스탠드, 모의고사 채점지, 형광펜과 빨간펜이 핵심 소품이다.
밤의 조용한 압박은 살리되 텍스트와 문제 내용은 전부 흐리게 처리한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean school self-study room at night, rows of desks, desk lamps, dark windows, test papers, admissions booklets, a red pen, and a highlighter on a side desk.
Quiet late-study pressure, soft fluorescent and lamp light, empty chairs, paper edges slightly worn from repeated marking.
Keep the nearest desk and stationery off to one side, preserving the lower-center third for characters.
Shared middle/high school study room, no grade-specific posters, no university names, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; exam sheets, guidebooks, highlighted lines, and wall notices are blurred or indistinct.
Wide 16:9 composition, 1440x810, calm night interior, no vertical framing.
```

### broadcast_room - 공용 방송실
**파일**: `game/public/images/backgrounds/broadcast_room.png` · 1440x810
**사용**: haeun-broadcast-mic
**장면**: 점심방송 ON AIR 직전과 직후의 방송실. 마이크, 믹서, 헤드폰, 방음 패널, 불빛이 켜진 표시등이 핵심이며, 하은의 떨림과 끝까지 읽어낸 감정을 받쳐야 한다.
표시등에는 글자를 넣지 말고 단순한 붉은 빛으로 처리한다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A small Korean school broadcast room, desk microphone, audio mixer, headphones, soundproof wall panels, cables neatly arranged, and a simple glowing red indicator light without lettering.
Lunch broadcast atmosphere, quiet focus just before or after speaking, warm booth lighting.
Place the microphone and mixer slightly to the side, leaving the lower-center third open for characters.
Shared school setting, no specific grade identity, no station names, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; equipment labels, schedules, posters, and indicator lettering are blurred or absent.
Wide 16:9 composition, 1440x810, clean natural lens, no vertical framing.
```

## Tier 3 - 선택 전용화

### music_room_middle - 중학 음악실
**파일**: `game/public/images/backgrounds/music_room_middle.png` · 1440x810
**사용**: seoa-meet, yuna-metronome, yuna-song-pick, yuna-wet-score, yuna-last-recital
**장면**: 점심시간 비어 있어야 할 중학 음악실, 두 번 울리는 문과 경첩, 메트로놈, 피아노, 학예제 합주곡, 라디에이터에 말리는 젖은 악보, 마지막으로 좋아하는 곡을 치는 빈 음악실이 모두 핵심이다.
중학 전용이므로 고등 입시 톤보다 조금 더 밝고 작지만, 평가·작별의 조용한 기미는 남긴다.

```text
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean middle school music room at lunchtime, upright piano, metronome, music stands, slightly stubborn hinged door ajar, radiator, and indistinct sheet music drying near one side.
Soft afternoon light, modest middle school scale, quiet room that can hold practice, hesitation, and a last favorite song.
Place piano, radiator, notebook, and music stands around the sides; keep the lower-center third open for character compositing.
Middle school music room tone, no high school uniform cues, no concert-hall grandeur, no brand logos.
Empty scene, no people, no characters, no figures, no silhouettes.
No readable text, no signage lettering; sheet titles, notebook writing, posters, and labels are blurred or indistinct.
Wide 16:9 composition, 1440x810, natural lens, no vertical framing.
```
