# Background Prompts — 전체 배경 재생성용

> LIFE_TRACK 게임의 44장 배경 이미지 생성 프롬프트.
> GPT-4 이상 이미지 생성 모델은 한글 렌더링 품질이 충분하므로,
> 학교 간판·현수막·칠판·교실 명패 등에 **한글 텍스트를 직접 명시**.

---

## 🎨 공통 스타일 가이드

모든 배경에 공통 적용:

```
Art style: Anime-style background painting, soft pastel palette, gentle natural lighting,
           subtle depth-of-field, no characters in frame (background only).
Era: 2012~2025 Korean school life — slightly nostalgic but modern enough to feel current.
Composition: Wide cinematic angle, suitable as background plate behind dialogue UI.
Resolution: 1920x1080 (16:9, landscape).
Format: PNG, no characters, no text overlay watermark.
```

**Negative prompt 공통**:
```
no characters, no people in foreground, no text watermark, no signature,
no overly saturated colors, no harsh shadows, no surreal elements, no fantasy elements,
no English-only signs (Korean text preferred for any signage).
```

**한글 텍스트 렌더링 지시**:
```
When Korean text is required (signage, banners, chalkboard), render in clear,
legible Korean Hangul characters. Use natural Korean typography
(고딕체 sans-serif for signage, 손글씨 handwriting style for chalkboard).
Avoid garbled or English-styled fake-Korean glyphs.
```

**가상 학교명 (전 학년 공통)**: `한빛초등학교 / 한빛중학교 / 한빛고등학교`
> 실제 학교명을 쓰지 않으면서 한글 가독성 확보. 변경하려면 본 문서 일괄 치환.

---

# 🔴 HIGH IMPACT — 한글 텍스트가 핵심

## 학교 교문 (6장) — `school_gate_*`

학교 간판에 **학교명 한글**이 또렷하게 보여야 함. Y1/Y2-4/Y5-7 진입 이벤트의 분위기를 좌우.

### `school_gate_elementary.png` — 초등 교문

**English**
```
Elementary school front gate, mid-morning. Painted concrete pillars on either side,
the school name plate centered above the gate in clear Korean Hangul: "한빛초등학교".
The plate uses a slightly worn but legible sans-serif Korean lettering — typical Korean
elementary school style. Behind the gate, a brick-and-pebble schoolyard, a small flagpole
to one side, low playground equipment visible in mid-distance, school building façade
in soft focus. Trees with light spring foliage frame the upper edges.
Soft morning light, gentle shadows, mood of arrival.
```

**한국어**
```
초등학교 정문, 오전 시간대. 양쪽 페인트 칠한 콘크리트 기둥, 정문 위 중앙에
한글 학교 명패 "한빛초등학교"가 또렷이 보임. 명패는 살짝 낡았지만 읽기 쉬운
고딕체 — 한국 초등학교 전형. 정문 너머로 벽돌·자갈 운동장, 한쪽에 작은 국기 게양대,
중간 거리에 낮은 놀이기구, 학교 건물 정면이 부드럽게 흐려져 있음. 위쪽 가장자리에
연한 봄 잎의 나무들. 부드러운 아침 햇살, 도착의 분위기.
```

**한글 텍스트**: `한빛초등학교` (정문 위 명패)

### `school_gate_middle.png` — 중학 교문

**English**
```
Middle school front gate, mid-morning. Steel-frame gate with brick pillars,
school name plate above reading "한빛중학교" in clean Korean Hangul sans-serif.
Slightly more formal than elementary — taller flagpole, bike rack visible just inside,
school building larger and more institutional behind. Korean middle school typical.
Soft morning light, late spring foliage on side trees.
```

**한국어**
```
중학교 정문, 오전 시간대. 철제 정문에 벽돌 기둥, 정문 위 명패에
"한빛중학교" 한글 고딕체로 또렷이 표시. 초등보다 살짝 격식 있는 느낌 —
더 높은 국기 게양대, 정문 안쪽에 자전거 보관대, 뒤로 더 크고 기관적인 학교 건물.
한국 중학교 전형. 부드러운 아침 햇살, 늦봄 잎의 측면 나무들.
```

**한글 텍스트**: `한빛중학교`

### `school_gate_high.png` — 고등 교문

**English**
```
High school front gate, morning. Imposing stone-and-metal gate with the school name
"한빛고등학교" in bold Korean Hangul on a polished plate. More serious atmosphere —
taller institutional building behind, school motto banner partially visible reading
something like "성실 · 정직 · 도전" (sincerity · honesty · challenge) in vertical Korean
text along one pillar. Bike rack, school crest visible.
Soft morning light, autumn-tinged trees suggesting transition to adulthood.
```

**한국어**
```
고등학교 정문, 아침. 위엄 있는 석재·금속 정문에 광택 명패로 "한빛고등학교" 굵은
한글 고딕체. 더 진지한 분위기 — 뒤로 더 높고 기관적인 건물, 한쪽 기둥에 세로형
한글 교훈 현수막 일부가 보임 ("성실 · 정직 · 도전"). 자전거 보관대, 학교 문장.
부드러운 아침 햇살, 가을빛 도는 나무 — 성인으로의 전환 암시.
```

**한글 텍스트**: `한빛고등학교` (정문) + `성실 · 정직 · 도전` (교훈, 세로형)

### `school_gate_elementary_rain.png` / `_middle_rain.png` / `_high_rain.png`

각 학교급 정문과 동일하나 **비 내리는 분위기**:

**English (공통, 학교명만 교체)**
```
Same composition as the [elementary/middle/high] school gate, but in steady rainfall.
Gate plate "한빛[초등/중/고등]학교" still legible despite rain streaks. Wet asphalt
reflecting muted gate lights, students' umbrellas implied off-frame (closed in racks
near gate). Cool blue-gray palette, soft diffuse light. Puddles forming, rain droplets
beading on metal surfaces. Mood: contemplative weather, end-of-summer or autumn rain.
```

**한국어**
```
[초등/중학/고등]학교 정문과 동일 구도, 일정한 비. 빗물 자국이 있어도 명패
"한빛[초등/중/고등]학교"는 또렷이 읽힘. 젖은 아스팔트가 정문 가로등 빛을 은은하게
반사. 화면 밖에 우산을 접어둔 보관대 암시. 차가운 청회색 톤, 부드러운 확산광.
물웅덩이 형성, 금속 표면에 빗방울. 분위기: 사색적인 날씨, 늦여름·초가을 비.
```

---

## 강당 / 졸업식 (3장) — `auditorium_*`

졸업식 현수막에 **"졸업을 축하합니다"** 한글이 또렷하게 보여야 함.

### `auditorium_elementary.png` — 초등 강당 (졸업식)

**English**
```
Elementary school auditorium interior set up for graduation ceremony. Wide angle showing
rows of folding chairs (empty — pre/post ceremony), stage with podium centered, large
ceremonial banner across the back wall reading "졸업을 축하합니다" in clean bold Korean
Hangul calligraphy or formal sans-serif. Below the main banner, smaller text "제 ○○회
한빛초등학교 졸업식" in standard Korean. Korean flag and school flag flanking the stage.
Stage backdrop in soft pastel — gold and pale yellow tones suggesting celebration.
Soft warm interior lighting, sunlight filtering through high windows.
```

**한국어**
```
초등학교 강당 내부, 졸업식 준비 완료 모습. 넓은 앵글로 접이식 의자들이 줄지어
배치(비어있음 — 식 전/후), 중앙에 단상 + 연단, 뒷벽에 큰 의식 현수막
"졸업을 축하합니다" — 깔끔한 한글 굵은 캘리그라피 또는 격식 있는 고딕체.
메인 현수막 아래 작은 글씨 "제 ○○회 한빛초등학교 졸업식". 무대 양옆에 태극기와
교기. 무대 배경은 부드러운 파스텔 — 금빛·연노랑이 축하 분위기. 따뜻한 실내 조명,
높은 창으로 햇살이 비춰듦.
```

**한글 텍스트**:
- 메인 현수막: `졸업을 축하합니다`
- 서브 텍스트: `제 ○○회 한빛초등학교 졸업식`

### `auditorium_middle.png` — 중학 강당

위와 동일하나 `한빛중학교`로 교체. 더 격식 있는 분위기 — 짙은 푸른색 톤의 백드롭, 약간 더 높은 천장.

**한글 텍스트**: `졸업을 축하합니다` + `제 ○○회 한빛중학교 졸업식`

### `auditorium_high.png` — 고등 강당

위와 동일하나 `한빛고등학교`로 교체. 가장 격식 있고 큰 규모 — 깊은 보랏빛/와인색 백드롭, 천장에 큰 샹들리에 또는 무대 조명, "성실 · 정직 · 도전" 교훈 현수막이 측면 벽에.

**한글 텍스트**: `졸업을 축하합니다` + `제 ○○회 한빛고등학교 졸업식` + `성실 · 정직 · 도전`

---

## 학원 (1장) — `hagwon_front.png`

**English**
```
Korean cram school (hagwon) front, evening. Ground-floor commercial entrance in a typical
mixed-use Korean building. Bright LED signboard above reading "한빛 수학학원" in bold
red Korean Hangul on white background — typical Korean hagwon signage style.
Smaller window decals listing subjects in Korean: "초등 · 중등 · 고등 / 수학 · 과학".
Glass door reflecting soft evening street lights, wooden frame slightly worn.
Side billboard with class schedule poster (Korean text, blurred for legibility ease).
Mood: after-school weariness, urban Korean academic culture.
```

**한국어**
```
한국 학원 정면, 저녁. 전형적인 한국 상가 건물 1층 입구. 위쪽에 LED 간판
"한빛 수학학원" — 흰 바탕에 굵은 빨간 한글 고딕체, 한국 학원 전형 스타일.
유리문에 작은 데칼로 과목 표시: "초등 · 중등 · 고등 / 수학 · 과학".
유리문에 부드러운 저녁 거리 불빛 반사, 약간 낡은 나무 프레임. 옆 게시판에
시간표 포스터 (한글, 가독성 위해 살짝 블러). 분위기: 방과후의 피로,
한국 도시 학습 문화.
```

**한글 텍스트**:
- 주 간판: `한빛 수학학원`
- 창문 데칼: `초등 · 중등 · 고등 / 수학 · 과학`

---

## 교실 (12장) — `classroom_*`

칠판에 **한글 날짜·단원·시간표**를 적어 학기 흐름을 표현.

### 공통 칠판 콘텐츠 (학기·시간대별 차등)

| 시기 | 칠판 콘텐츠 |
|---|---|
| `_spring` (W1) | `3월 4일 (월)` + `새 학기 첫날 — 자기소개` |
| `_afternoon` (일반) | `오늘의 학습 — 5단원: 분수의 곱셈` (학교급별 단원명 교체) |
| `_sunset` (방과후, 빈 교실) | 흐릿한 잔여 글씨 — 지워진 자국만 |
| 기본(이름 없음) | `시간표` (월~금 6교시, 한글 과목명) |

### 학교급별 톤 차이

- **초등 (`elementary_*`)**: 분필 손글씨, 곱셈 단원, 빨간색 강조선, 어린이 그림 한두 점
- **중학 (`middle_*`)**: 보드마커, 영어 + 수학 혼용, 시간표 표
- **고등 (`high_*`)**: 단정한 보드마커, "수능 D-XXX" 카운트다운(고3만), 모의고사 일정

### `classroom_elementary_spring.png` — 초등 교실 봄

**English**
```
Korean elementary school classroom interior, early March. View from front-left toward
the teacher's desk and chalkboard. Empty rows of small wooden desks with attached
seats. Chalkboard at front showing handwritten chalk text in Korean: top line in
larger lettering "3월 4일 (월)" (March 4, Monday), below in slightly smaller
"새 학기 첫날 — 자기소개" (First day of new term — Self-introduction). A small
hand-drawn cherry blossom doodle in the corner of the board.
Spring atmosphere — pink cherry blossom petals visible through windows, gentle morning
light, classroom wall posters in Korean (학급 규칙, 시간표). Subtle pastel palette,
warm spring tones.
```

**한국어**
```
한국 초등학교 교실 내부, 3월 초. 앞쪽 왼편에서 교탁·칠판 방향 시점. 빈 작은
나무 책상들이 줄지어 (의자 결합형). 앞쪽 칠판에 분필 손글씨 한글: 윗줄 큰 글씨
"3월 4일 (월)", 그 아래 살짝 작게 "새 학기 첫날 — 자기소개". 칠판 한 모서리에
작은 벚꽃 낙서. 봄 분위기 — 창 너머로 분홍 벚꽃 잎, 부드러운 아침 햇살,
교실 벽에 한글 포스터(학급 규칙, 시간표). 은은한 파스텔 팔레트, 따뜻한 봄 톤.
```

**한글 텍스트**: `3월 4일 (월)` / `새 학기 첫날 — 자기소개` (칠판) + 벽 포스터 `학급 규칙`, `시간표`

### `classroom_elementary_afternoon.png` — 초등 교실 일반 오후

**English**
```
Same elementary classroom but during a regular afternoon class period (empty for the
moment — recess or after class). Chalkboard reads in Korean handwriting: "5단원:
분수의 곱셈" (Unit 5: Multiplication of Fractions) with example problem written below.
Wall posters: "이달의 글짓기" (Writing of the Month) with student artwork pinned around.
Side bulletin board with timetable "시간표" — week grid with Korean subject names
(국어, 수학, 사회, 과학, 체육, 음악, 미술). Warm late-afternoon sunlight slanting
through windows, dust motes in the light.
```

**한국어**
```
동일한 초등 교실, 평범한 오후 시간(잠시 비어있음 — 쉬는 시간 또는 방과 후 직후).
칠판에 한글 손글씨: "5단원: 분수의 곱셈" 그 아래 예제 문제. 벽 포스터: "이달의 글짓기"
주위에 학생 작품들. 측면 게시판에 시간표 "시간표" — 주간 표 + 한글 과목명
(국어, 수학, 사회, 과학, 체육, 음악, 미술). 창문으로 따뜻한 늦은 오후 햇살,
빛 속에 먼지 입자.
```

**한글 텍스트**: `5단원: 분수의 곱셈` / `이달의 글짓기` / `시간표` + 과목명 7개

### `classroom_elementary_sunset.png` — 초등 빈 교실 방과후

**English**
```
Empty elementary classroom at sunset, deep golden light flooding through windows
casting long shadows of desks. Chalkboard mostly erased — faint white residue of
earlier writing visible (illegible chalk smudges, hint of "수업 끝" or similar
fragment). Chairs neatly placed atop desks (cleaning duty done). One forgotten
notebook on a desk near the window. Dust suspended in light beams.
Mood: quiet contemplation, end of a school day, the room remembering.
```

**한국어**
```
빈 초등학교 교실, 노을 무렵. 창으로 깊은 황금빛이 쏟아져 들어와 책상들의 긴 그림자.
칠판은 대부분 지워짐 — 이전 글씨의 흐릿한 백색 잔흔만 (분필 자국, "수업 끝" 같은
파편). 의자들이 책상 위에 단정히 올려져 있음(청소 끝). 창가 책상 위에 잊혀진
공책 한 권. 빛줄기 속에 먼지 부유. 분위기: 조용한 사색, 학교가 끝난 후, 교실이 기억하는.
```

**한글 텍스트**: 흐릿한 잔흔 정도, 명확한 텍스트 X (분위기 우선)

### `classroom_elementary.png` — 초등 교실 기본 (시간대 무관)

**English**
```
Standard elementary classroom interior, neutral lighting. Chalkboard with full weekly
timetable "시간표" — clean handwritten grid: rows = 1교시 to 6교시, columns =
월·화·수·목·금. Korean subject names filled in: 국어, 수학, 사회, 과학, 체육, 음악,
미술, 도덕, 영어. Class number plate above board "6학년 3반". Clean morning light,
neutral pastel palette.
```

**한국어**
```
표준 초등학교 교실, 중성 조명. 칠판에 주간 시간표 "시간표" — 깔끔한 손글씨 격자:
행 = 1교시~6교시, 열 = 월·화·수·목·금. 한글 과목명: 국어, 수학, 사회, 과학, 체육,
음악, 미술, 도덕, 영어. 칠판 위 학급 명패 "6학년 3반". 깨끗한 아침 햇살, 중성 파스텔.
```

**한글 텍스트**: `시간표` / `1교시~6교시` / `월·화·수·목·금` / 과목명 9개 / `6학년 3반`

### Middle 교실 4장 (`middle_*`)

- **공통 변경**: 책상이 더 크고, 보드마커(분필 X) 화이트보드, 학급 명패 `2학년 1반` 같은 중학 패턴
- 칠판 콘텐츠:
  - `_spring`: `3월 4일 (월)` + `새 학기 환영 — 자유 좌석`
  - `_afternoon`: `중간고사 D-7` + `중1 영어 Unit 4: My Family` (학년별 변형)
  - `_sunset`: 흐릿한 잔여
  - 기본: `시간표` + 과목명(중학: 국어·영어·수학·사회·과학·기술가정·음악·미술·체육·도덕)

### High 교실 4장 (`high_*`)

- **공통 변경**: 더 큰 책상, 사물함이 측면에 보임, 학급 명패 `3학년 2반` 같은 고등 패턴
- 칠판 콘텐츠:
  - `_spring`: `3월 4일 (월)` + `고3 D-256` 같은 수능 카운트다운(있다면 진지 분위기)
  - `_afternoon`: `수학(상) 4단원: 도형의 방정식` + 예제 문제
  - `_sunset`: 흐릿한 잔여 + `수능 화이팅` 같은 격려 낙서
  - 기본: `시간표` + 과목명(고등: 국어·수학·영어·사회·과학·한국사·체육·예술·기술가정)

---

## 복도 (3장) — `hallway_*`

교실 명패에 **학년·반 한글 표기** 필수.

### `hallway_elementary.png` — 초등 복도

**English**
```
Korean elementary school hallway, mid-day. Long perspective with classroom doors on
the left side, windows on the right facing schoolyard. Each classroom door has a
clear room sign in Korean: "6학년 1반", "6학년 2반", "6학년 3반" — receding into
distance. Wooden floor with slight wear, pinboards between doors showing student
artwork and notices in Korean ("학급 게시판", "이달의 우수 학생"). Soft natural
light from right windows. Mood: schoolday calm, slightly nostalgic.
```

**한국어**
```
한국 초등학교 복도, 한낮. 왼쪽에 교실 문들이 깊이감 있게 늘어서고 오른쪽 창은
운동장 향함. 각 교실 문에 또렷한 한글 명패: "6학년 1반", "6학년 2반", "6학년 3반"
— 원근감 있게. 약간 닳은 나무 바닥, 문 사이 게시판에 학생 작품과 한글 안내문
("학급 게시판", "이달의 우수 학생"). 오른쪽 창에서 부드러운 자연광. 분위기:
학교 일과의 평온, 살짝 노스탤지어.
```

**한글 텍스트**: `6학년 1반` `6학년 2반` `6학년 3반` + `학급 게시판` `이달의 우수 학생`

### `hallway_middle.png` — 중학 복도

위와 유사하나 명패 `1학년 1반` ~ `3학년 5반` 식, 게시판에 `학생회 공지`, `진로 안내` 등.

**한글 텍스트**: `2학년 1반` `2학년 2반` `2학년 3반` + `학생회 공지` `진로 안내`

### `hallway_high.png` — 고등 복도

명패 `1학년 1반` ~ `3학년 10반` 식, 게시판에 `대입 정보`, `모의고사 안내`, `D-XXX 수능` 카운트다운.

**한글 텍스트**: `3학년 1반` `3학년 2반` + `대입 정보` `모의고사 안내` `수능 D-${day}` 

---

## 축제 / 파티 (2장)

### `festival_classroom.png` — 학교 축제 교실

**English**
```
Korean high school classroom transformed for school festival (학교 축제). Walls covered
in colorful handmade banners and posters in Korean: large central banner "한빛고 축제
— 한빛제" with smaller booth signs ("동아리 부스", "사진관", "보드게임 카페", "타로점").
Desks rearranged into booth tables with handmade decorations, fairy lights strung overhead.
Class door has handwritten Korean "어서오세요!" greeting. Students implied off-frame
(empty mid-prep moment). Late afternoon golden light through windows.
Mood: anticipation, creative chaos, high school memory peak.
```

**한국어**
```
학교 축제용으로 꾸며진 한국 고등학교 교실. 벽 가득 색색의 손제작 한글 현수막·포스터:
큰 중앙 현수막 "한빛고 축제 — 한빛제", 더 작은 부스 표지("동아리 부스", "사진관",
"보드게임 카페", "타로점"). 책상을 부스 테이블로 재배치, 장식·페어리 라이트.
교실 문에 손글씨 "어서오세요!". 학생은 프레임 밖(준비 중간 빈 순간 암시).
창으로 늦은 오후 황금빛. 분위기: 기대, 창의적 혼돈, 고등학교 추억의 정점.
```

**한글 텍스트**: `한빛고 축제 — 한빛제` / `동아리 부스` `사진관` `보드게임 카페` `타로점` / `어서오세요!`

### `party_room.png` — 생일 파티 방

**English**
```
Cozy Korean home living room set up for a kid's/teen's birthday party. Wall behind
sofa decorated with a hand-string letter banner reading "생일 축하해" (Happy Birthday)
in playful Korean Hangul cutouts. Balloons in pastel colors, small low table with
cake (candles unlit, ready to be lit), birthday hats. Soft warm interior lighting,
colorful streamers. No people in frame. Mood: cozy anticipation, intimate gathering.
```

**한국어**
```
어린이/청소년 생일 파티용으로 꾸며진 아늑한 한국 가정 거실. 소파 뒤 벽에
손글씨 글자 가랜드 "생일 축하해" — 장난기 있는 한글 컷아웃. 파스텔 컬러 풍선,
낮은 테이블 위 케이크(촛불 미점화, 점화 직전), 생일 모자. 부드럽고 따뜻한 실내 조명,
색색의 리본. 사람 없음. 분위기: 아늑한 기대, 친밀한 모임.
```

**한글 텍스트**: `생일 축하해` (가랜드)

---

# 🟠 MEDIUM IMPACT — 한글이 있으면 좋음

## 도서관 (3장) — `library_*`

서가 라벨·안내판에 한글 표기.

### `library_elementary.png` — 초등 도서관

**English**
```
Korean elementary school library, afternoon. Wooden bookshelves filled with picture
books and chapter books, organized by category — small shelf labels in Korean:
"동화", "위인전", "과학", "역사", "한국 명작". Reading nook with bean bags, low
round table with picture books. Reading rules poster on wall: "도서관 이용 규칙
— 조용히 / 책 소중히 / 제자리에". Soft afternoon light through high windows.
Mood: quiet curiosity, childhood reading.
```

**한국어**
```
한국 초등학교 도서관, 오후. 그림책·중급 도서로 가득 찬 나무 서가, 카테고리별 정리
— 작은 한글 라벨: "동화", "위인전", "과학", "역사", "한국 명작". 빈백 의자가
있는 독서 코너, 낮은 원형 테이블 위 그림책들. 벽에 도서관 규칙 포스터:
"도서관 이용 규칙 — 조용히 / 책 소중히 / 제자리에". 높은 창으로 부드러운 오후 햇살.
분위기: 조용한 호기심, 어린 시절 독서.
```

**한글 텍스트**: 서가 라벨 (`동화` `위인전` `과학` `역사` `한국 명작`) + `도서관 이용 규칙 — 조용히 / 책 소중히 / 제자리에`

### `library_middle.png` — 중학 도서관

서가 라벨: `소설` `학습참고서` `잡지` `사회과학` `자연과학` `예술`.
규칙: `정숙 / 음식물 반입 금지 / 휴대폰 무음`. 자습 책상이 추가됨.

### `library_high.png` — 고등 도서관 (자습실 겸용)

서가 라벨: `문학` `자기계발` `대입 자료` `EBS 교재` `과학·수학`.
포스터: `수능 자료실` / `자습실 운영 시간 — 평일 18:00~22:00`. 칸막이 자습 책상.

---

## 체육관 (1장) — `gymnasium.png`

응원 현수막에 한글 표기 (선택).

**English**
```
Korean school gymnasium interior, daytime. Wooden floor, basketball hoops at both ends,
side bleachers (empty). One end wall has a hanging cloth banner reading "체력은 학력
이다 — 한빛 체육부" in bold Korean. Side wall sports posters: "건강한 신체에 건강한
정신". Volleyball net partially set up to one side. Skylights filtering soft natural
light. Mood: school sports day energy at rest.
```

**한국어**
```
한국 학교 체육관 내부, 낮. 나무 바닥, 양 끝에 농구 골대, 측면 관중석(비어있음).
한쪽 끝 벽에 천 현수막 "체력은 학력이다 — 한빛 체육부" 굵은 한글. 측면 벽 스포츠
포스터 "건강한 신체에 건강한 정신". 한쪽에 일부 설치된 배구 네트. 천창으로 부드러운
자연광. 분위기: 정적 상태의 학교 운동회 에너지.
```

**한글 텍스트**: `체력은 학력이다 — 한빛 체육부` + `건강한 신체에 건강한 정신`

---

## 음악실 (1장) — `music_room.png`

악보·악기 라벨 한글.

**English**
```
Korean school music room, afternoon. Upright piano on one side, music stands and
folding chairs arranged for ensemble. Chalkboard at front showing musical staff with
Korean note labels and song title written above: "오늘의 곡 — 봄이 오면". Posters
of composers on side wall (Beethoven, Mozart, etc.) with Korean name labels
"베토벤", "모차르트", "쇼팽". Acoustic foam panels. Soft natural light through
high windows. Mood: gentle artistic concentration.
```

**한국어**
```
한국 학교 음악실, 오후. 한쪽에 업라이트 피아노, 합주용 보면대·접이식 의자.
앞쪽 칠판에 오선보 + 한글 음표 표기, 위에 곡목 "오늘의 곡 — 봄이 오면".
측면 벽에 작곡가 포스터(베토벤, 모차르트 등) + 한글 이름 "베토벤", "모차르트",
"쇼팽". 흡음 패널. 높은 창으로 부드러운 자연광. 분위기: 잔잔한 예술적 집중.
```

**한글 텍스트**: `오늘의 곡 — 봄이 오면` + `베토벤` `모차르트` `쇼팽`

---

## 카페 / 학원 거리 (2장)

### `cafe_study.png` — 스터디 카페

**English**
```
Korean study cafe interior, evening. Long shared tables with individual desk lamps,
power outlets, partition dividers between seats. Wall menu board in Korean reads
"메뉴 — 아메리카노 4,500 / 라떼 5,000 / 디카페인 +500 / 1시간 2,000원 무제한 +5,000".
Wall hours sign: "운영 시간 09:00 ~ 24:00". Subdued warm lighting, books and
study materials on tables (no people). Soft jazz ambience implied through cozy mood.
```

**한국어**
```
한국 스터디 카페 내부, 저녁. 공용 긴 테이블에 개별 스탠드 조명, 콘센트, 좌석 사이
파티션. 벽 메뉴판 한글 "메뉴 — 아메리카노 4,500 / 라떼 5,000 / 디카페인 +500
/ 1시간 2,000원 무제한 +5,000". 벽에 운영시간 표지 "운영 시간 09:00 ~ 24:00".
은은한 따뜻한 조명, 테이블 위 책·학습 자료(사람 없음). 아늑한 분위기로 부드러운
재즈 분위기 암시.
```

**한글 텍스트**:
- 메뉴: `메뉴 — 아메리카노 4,500 / 라떼 5,000 / 디카페인 +500 / 1시간 2,000원 무제한 +5,000`
- 운영시간: `운영 시간 09:00 ~ 24:00`

### `school_road_morning.png` — 등굣길

**English**
```
Korean residential street toward a school, early morning. Cherry blossom trees lining
the road, soft pink petals on the ground. Small commercial signs visible — convenience
store sign in Korean "GS25" or "한빛 편의점", a pedestrian crossing sign with Korean
"학교 앞 — 천천히 30km" speed warning. Bus stop pole with route sign. Empty street
suggesting just-before-school-time, a few backpacks implied to come into frame any
moment. Cool morning light, soft mist on the ground.
```

**한국어**
```
학교를 향한 한국 주택가 길, 이른 아침. 길 양옆에 벚나무, 바닥에 분홍 꽃잎.
작은 상업 간판 — 편의점 한글 간판 "GS25" 또는 "한빛 편의점", 보행자 횡단 표지에
한글 속도 경고 "학교 앞 — 천천히 30km". 버스 정류장 기둥에 노선 표지.
빈 거리, 등교 직전 시간 — 곧 책가방들이 프레임에 들어올 듯한 분위기.
시원한 아침 햇살, 바닥에 옅은 안개.
```

**한글 텍스트**: `한빛 편의점` (또는 `GS25`) + `학교 앞 — 천천히 30km`

---

## 침실 (1장) — `bedroom_night.png`

책 표지·메모 한글 (선택).

**English**
```
Korean teenager's bedroom at night. Single bed with rumpled blanket, desk by the
window with study materials and a book pile. Top book cover shows Korean title
"수능 기출문제집" (College Entrance Exam Practice Book) in bold Hangul.
Small calendar on wall with Korean month name "11월" and a circled date with
"수능" written in red. Desk lamp on, warm yellow glow. Window showing dark night
sky outside. Mood: late-night study room solitude.
```

**한국어**
```
한국 청소년 침실, 밤. 이불이 흐트러진 1인용 침대, 창가 책상에 학습 자료와 책 더미.
맨 위 책 표지에 한글 제목 "수능 기출문제집" 굵은 글씨. 벽에 작은 달력 한글 월명
"11월"과 빨간 동그라미 친 날짜에 "수능" 표기. 책상 등 켜져 있고 따뜻한 노란빛.
창밖에 어두운 밤하늘. 분위기: 깊은 밤 공부방의 고독.
```

**한글 텍스트**: `수능 기출문제집` + `11월` + `수능`

---

# 🟢 LOW IMPACT — 한글 거의 불필요

## 자연/공용 공간 (8장)

### `clear_sky.png` — 맑은 하늘 (수능 후)
```
Wide sky-only composition, late autumn afternoon. Layered cumulus clouds, soft pale
blue gradient, gentle sun rays. No text, no buildings, no people. Mood: profound
relief, openness after long pressure.
```
**한글**: 없음.

### `night_sky_fireworks.png` — 새해 밤하늘 불꽃놀이
```
Night sky with bursting fireworks — multiple colored explosions (red, gold, green,
blue) at various heights. Distant city silhouette at the bottom edge. Stars faint
through the smoke. Mood: New Year's eve celebration, looking up.
```
**한글**: 없음. (옵션: 도시 실루엣에 작은 한글 네온 간판)

### `beach_summer.png` — 여름 바다
```
Korean east-coast beach in summer afternoon. Sandy shore, gentle waves, distant blue
horizon. A few beach umbrellas in pastel colors. No people in frame. Soft warm sunlight,
slight haze. Mood: vacation calm.
```
**한글**: 없음. (옵션: 작은 표지판 `해수욕장 안내`)

### `park_spring.png` — 공원 봄
```
Korean neighborhood park in spring. Benches under cherry blossom trees in full bloom,
cherry petals on the path. Distant playground equipment. Soft afternoon light, gentle
breeze suggested by drifting petals. Mood: serene reflection.
```
**한글**: 없음. (옵션: 표지판 `한빛 어린이공원`)

### `home_evening.png` — 집 방 저녁
```
Korean teenager's bedroom at evening. Desk with open notebook, study lamp. Bed neatly
made. Window showing twilight sky. Soft warm yellow desk lamp lighting. Mood:
homework time, warm familiar.
```
**한글**: 없음. (책 표지 살짝 보여도 OK)

### `sunset_walk.png` — 노을 하굣길
```
Empty residential road at sunset, deep golden-orange sky, long shadows from low sun.
Suburban houses, telephone poles, occasional shopfront. Mood: end-of-day quiet,
solitary walk home.
```
**한글**: 없음. (옵션: 멀리 작은 한글 간판)

### `dinner_table.png` — 저녁 식탁
```
Korean family dinner table set for dinner — bowls of rice, side dishes (kimchi, namul),
main soup pot in center, chopsticks and spoons in proper Korean placement. No food being
eaten yet. Soft warm pendant lighting. Mood: family time about to begin.
```
**한글**: 없음.

### `rooftop.png` — 옥상
```
Korean school rooftop, late afternoon. Concrete surface with safety fence around perimeter,
HVAC units to one side, water tank cylinder. Wide sky visible, distant city or school
ground view. Mood: solitary reflection space, the place where students go to think.
```
**한글**: 없음. (옵션: 안전 표지 `옥상 출입금지` — 살짝 색바랜 느낌)

### `stairwell.png` — 계단
```
Korean school stairwell, mid-day. Concrete stairs zig-zagging up, metal handrails,
windows on the landing showing schoolyard. Slight wear marks on steps. Soft natural
light from the landing window. Mood: in-between transitional space.
```
**한글**: 없음. (옵션: 층 표지 `2F` `3F`)

---

# 📊 생성 체크리스트 (44장)

## 🔴 HIGH (한글 필수)
- [ ] `school_gate_elementary.png` (`한빛초등학교`)
- [ ] `school_gate_middle.png` (`한빛중학교`)
- [ ] `school_gate_high.png` (`한빛고등학교` + 교훈)
- [ ] `school_gate_elementary_rain.png`
- [ ] `school_gate_middle_rain.png`
- [ ] `school_gate_high_rain.png`
- [ ] `auditorium_elementary.png` (`졸업을 축하합니다`)
- [ ] `auditorium_middle.png`
- [ ] `auditorium_high.png` (+ 교훈)
- [ ] `hagwon_front.png` (`한빛 수학학원`)
- [ ] `classroom_elementary_spring.png` (`3월 4일 (월) — 자기소개`)
- [ ] `classroom_elementary_afternoon.png` (`5단원: 분수의 곱셈`)
- [ ] `classroom_elementary_sunset.png`
- [ ] `classroom_elementary.png` (`시간표`)
- [ ] `classroom_middle_spring.png`
- [ ] `classroom_middle_afternoon.png` (`중간고사 D-7`)
- [ ] `classroom_middle_sunset.png`
- [ ] `classroom_middle.png`
- [ ] `classroom_high_spring.png` (`수능 D-XXX`)
- [ ] `classroom_high_afternoon.png` (`수학(상) 4단원`)
- [ ] `classroom_high_sunset.png` (`수능 화이팅`)
- [ ] `classroom_high.png`
- [ ] `hallway_elementary.png` (`6학년 N반` 명패)
- [ ] `hallway_middle.png`
- [ ] `hallway_high.png` (`수능 D-XXX`)
- [ ] `festival_classroom.png` (`한빛고 축제`)
- [ ] `party_room.png` (`생일 축하해`)

## 🟠 MEDIUM
- [ ] `library_elementary.png` (서가 라벨)
- [ ] `library_middle.png`
- [ ] `library_high.png` (`수능 자료실`)
- [ ] `gymnasium.png` (`체력은 학력이다`)
- [ ] `music_room.png` (`오늘의 곡`)
- [ ] `cafe_study.png` (메뉴판)
- [ ] `school_road_morning.png` (`학교 앞 — 천천히 30km`)
- [ ] `bedroom_night.png` (`수능 기출문제집`)

## 🟢 LOW (텍스트 거의 없음, 그림만 재생성)
- [ ] `clear_sky.png`
- [ ] `night_sky_fireworks.png`
- [ ] `beach_summer.png`
- [ ] `park_spring.png`
- [ ] `home_evening.png`
- [ ] `sunset_walk.png`
- [ ] `dinner_table.png`
- [ ] `rooftop.png`
- [ ] `stairwell.png`

---

# 🧠 GPT 작업 팁

1. **한글 텍스트 명시 시** — 영문 prompt 내에서 한글 단어를 따옴표로 감싸 직접 표기 (예: `text reading "한빛초등학교"`). GPT-4 이상은 한글 글리프 제대로 렌더.
2. **한글 가독성 우선** — 너무 작거나 비스듬한 각도는 깨질 수 있음. 정면 또는 살짝 비스듬한 각도, 충분한 크기로.
3. **학교명 일괄 변경** — `한빛`을 다른 이름으로 바꾸려면 본 문서 일괄 치환 후 재생성.
4. **스타일 일관성** — 같은 학교급(초/중/고)끼리는 톤·팔레트·디테일 수준 맞추기. 한 카테고리(예: 교실 4장)는 같은 세션에서 한 번에 생성 추천.
5. **텍스트 검수** — 생성 후 zoom-in으로 한글이 정상 글리프인지 확인 (`/cg-review.html` 패턴 참고하여 별도 검수 페이지 가능).

---

**총 44장. 한글 텍스트 포함: 35장 (HIGH 27 + MEDIUM 8). 텍스트 없음: 9장.**
