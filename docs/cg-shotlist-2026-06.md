# CG 촬영 리스트 — 중·고 갭 + 초등 누락 (2026-06)

> 학년말 회고(YearEndScreen) 갤러리/히어로 + 이벤트 결과 화면(EventResultScreen)에 붙는 이벤트 CG의 촬영 대상 목록.
> 산출물은 "촬영 리스트"다 — 장면 1줄 브리프까지만 적고, 프롬프트 전문은 `docs/event-cg-prompts-y1.md` 패턴을 따라 codex가 별도로 작성한다.
> 등장인물 외형 마커 SSOT는 `docs/character-prompt-spec.md` — 브리프엔 "(마커 spec 참조)"만 단다.

---

## 방법론 / 우선순위 정의

**CG는 `sourceEventId` 기준으로 붙는다.** 리졸버(`src/engine/eventCg.ts`)는
`{schoolLevel}/{id}_c{ci}_{g}.png` → `{sl}/{id}_{g}` → `{sl}/{id}_c{ci}` → `{sl}/{id}`
→ `common/...` 순으로 매니페스트를 탐색한다. schoolLevel은 **year로 결정**
(`backgrounds.ts` getSchoolLevel): **elementary=Y1 / middle=Y2~Y4 / high=Y5~Y7** (코드 확인 완료).

회고 화면은 `resolveEventCgUrl(slot.sourceEventId, slot.choiceIndex, gender, slot.year)`로 갤러리/히어로를 그린다
(`YearEndScreen.tsx` L204). 즉 **기억 슬롯(memorySlot)이 곧 회고 CG의 1차 소비처**다.

기억 슬롯 생성 규칙(`memorySystem.ts` 확인):
- `choice.memorySlotDraft`(이벤트) 또는 mini-talk `memorySlotDraft`(`store.applyMemorySlotFromMiniTalk`)에서 생성.
- `importance ≥ 3`만 슬롯이 된다.
- **`ANNUAL_EVENT_IDS`에 든 이벤트는 슬롯 생성 제외**(졸업/입학/시험/생일/반장선거 등).
- 카테고리당 최대 2개(초과 시 importance 낮은 것 교체).

→ **P1 = 기억 이벤트** (memorySlotDraft, importance≥3, non-ANNUAL): 회고 갤러리/히어로에 직접 뜸. 최우선.
→ **P2 = 마일스톤 ANNUAL** (졸업/입학/수능/시험 등): 기억엔 안 남지만 **EventResultScreen에서 CG 표시** → 학년 변곡점 연출용 2순위.

> ⚠️ **mini-talk(말걸기) 모달 자체는 CG를 안 쓴다** — `MiniTalkModal.tsx`는 `<Portrait>`만 렌더(L137).
> 그러나 mini-talk이 만든 기억 슬롯은 회고 갤러리에서 `sourceEventId`로 CG를 조회하므로,
> **mini-talk id로 명명한 CG 파일은 회고에서 정상 표시된다.** 따라서 P1 mini-talk도 촬영 대상.
> mini-talk 슬롯의 choiceIndex는 0(파라미터 기본값) — `{id}_c0_{g}` 또는 `{id}` 한 장이면 충분.

**이미 커버된 27개(전부 elementary)** 는 제외. 중/고 CG는 현재 0개라 사실상 전부 갭.

---

## 중학교 (Y2~Y4)

> middle = Y2(중1)~Y4(중3). 교복·배경이 초등과 완전히 다름 → elementary 자산 재활용 불가, 신규 촬영 필요.

### P1 — 기억 이벤트 (회고 갤러리/히어로)

| 이벤트 id | 발동(학년/조건) | CG choiceIndex | category/tone/imp | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|---|
| `minjae-jealousy` | Y2~3, minjae met & intimacy≥30, academic≥45, 학기중 | c0,c1,c2 (3장) | c0 betrayal/regret/5 · c1 reconciliation/warm/6 · c2 reconciliation/resolve/6 | 교실 쉬는시간, 한 톤 낮은 목소리의 민재(안경, 마커 spec 참조). c0=주인공이 눈 피해 먼저 교실 나섬 / c1="너 덕분에 자극받았어" 솔직히 / c2="나도 지기 싫어" 경쟁 인정·민재 피식 | 신규 |
| `minjae-effort` | Y2+, minjae intimacy≥25, minjae-ranking 후, 학기중 | c0,c1 (2장) | c0 discovery/warm/6 · c1 betrayal/regret/4 | 불 꺼진 빈 교실, 스탠드 하나 켜고 노트 펴고 앉은 민재. c0="공부 많이 하는구나" → 굳은 얼굴 "들켰네" / c1="너도 벼락치기?" → 평소와 다른 웃음. 배경 `classroom_{school}_sunset` | 신규 |
| `minjae-honest` | Y4+, minjae intimacy≥55, 학기중 | c0,c2 (2장) | c0 reconciliation/warm/7 · c2 betrayal/regret/5 | 방과후 빈 교실, 눈이 붉은 민재가 펜만 쥐고 있음. c0=말없이 옆에 앉음(긴 침묵, 펜 내려놓음) / c2=그냥 지나침 → 복도에서 돌아본 꺼지지 않은 교실 불 | 신규 |
| `school-festival` | **Y≥2** (중·고 공통), W30 | c0,c1,c2 (3장) | c0 courage/resolve/5 · c1 discovery/warm/4 · c2 failure/regret/5 | 축제 준비 교실(푸드트럭). c0=수빈이와 포스터 붙이며 맞잡은 눈짓 / c1=회계 장부 한 귀퉁이에 매출 적는 내 글씨 / c2=불참, 단톡 축제 사진 보며 천장만. 배경 `festival_classroom` | **Y2~6 공통** → 아래 권고 참조 |
| `yuna-study` | academic≥50 & year≠7 (Y2~6), W34 | c0,c1 (2장) | c0 discovery/warm/5 · c1 betrayal/regret/5 | 도서관 책상, 유나(별핀, 마커 spec 참조)가 수학 7번 물어봄. c0=가르쳐줌 "천재 아냐?" / c1=거절, 가볍게 돌아서는 유나 뒷모습. 배경 `library_{school}` | **Y2~6 공통** → 권고 참조 |
| `school-trip-middle` | Y2, W28 | c0,c1 (2장) | c0 discovery/warm/6 · c1 betrayal/regret/4 | c0=경주 수학여행 밤 숙소 복도, 지훈이랑 몰래 라면(마커 spec) / c1=불참, 텅 빈 교실에서 단톡 사진. 배경 `classroom_middle_afternoon` | 신규 |
| `middle-burnout` | **Y3 전용**, idleWeeks≥3 & mental≤55 | c0,c1,c2 (3장) | c0 failure/regret/7 · c1 growth/breakthrough/8 · c2 growth/warm/8 | 밤 자기 방 책상(`bedroom_night`). c0=억지 공부, 식은 커피 얼룩 / c1=다 접고 이불 속, 숨이 먼저 돌아옴 / c2=지훈이에게 전화 "힘들어"(지훈 마커 spec) | 신규. 주인공 단독 위주 |
| `family-strain` | Y3~6, idleWeeks≥4 또는 mental≤45&academic≤55 | c0,c1,c2 (3장) | c0 betrayal/regret/7 · c1 failure/regret/6 · c2 reconciliation/warm/8 | 저녁 식탁(`dinner_table`), 아빠 "뭐 하는 거니". c0=맞받아치고 방문 안쪽 기댐 / c1=묵묵히 잔소리 다 들음 / c2="저 힘들어요" → 엄마 표정 무너짐 | **Y3~6 공통** → 권고 참조. 가족 장면(NPC 없음) |
| `haeun-distance` | **Y4 전용**, haeun intimacy 40~80, 학기중 | c0,c1,c2 (3장) | c0 reconciliation/warm/5 · c1 betrayal/regret/4 · c2 growth/resolve/4 | 사물함에 끼인 하은 선배 편지(하은 본인은 미등장, 편지/사물함 위주). c0=한 시간 답장 써서 우편함 / c1=가방에 넣고 못 꺼냄 구겨짐 / c2=서랍 맨 아래 보관. 배경 `hallway_{school}` | 신규. speaker 없음(편지컷) |

### P1 — mini-talk 기억 이벤트 (회고 갤러리; 모달은 Portrait, 회고는 sourceEventId로 CG 조회)

> 발동 학년 게이트는 친밀도 도달 시점에 의존. intimacy 70/80 도달은 현실적으로 중2~고3 구간이라 middle/high 공통.
> choiceIndex=0 고정 → `{id}_c0_{g}` 또는 `{id}` 한 장.

| mini-talk id | 발동 게이트 | category/tone/imp | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|
| `talk_subin_70_night_light` | subin intimacy≥70 | discovery/melancholy/3 | 늦은 밤 단톡, 수빈이 "거실 불 밤새 켜두는 날 있어". 폰 화면/거실 불빛 톤 | middle/high 공통 |
| `talk_minjae_70_phone_call` | minjae intimacy≥70 | discovery/burden/3 | 민재가 휴대폰 뒤집어 놓고 물컵 만지작, "기대받는 거 시끄러워"(마커 spec) | middle/high 공통 |
| `talk_jihun_90_bench` | jihun intimacy≥80 | growth/warm/5 | 매점 평상, 지훈이가 이온음료 이마에 대며 "힘든 척해도 돼"(마커 spec) | 고지 친밀도 — 주로 high |
| `talk_subin_90_two_names` | subin intimacy≥80 | discovery/melancholy/5 | 수빈이 "문패엔 이름 두 개면 돼, 엄마랑 나" 처음 보여주는 집의 모양 | 주로 high |
| `talk_minjae_90_unmasked` | minjae intimacy≥80 | discovery/warm/5 | 방과후 빈 교실, 민재가 날 선 표정 풀며 "안 괜찮아도 되더라"(마커 spec) | 주로 high |
| `talk_yuna_90_wrong_note` | yuna intimacy≥80 | growth/breakthrough/5 | 음악실, 유나가 틀린 음에 지우개 올려두고 안 지움 "지금 내 소리 같아서"(마커 spec) | 주로 high |
| `talk_haeun_90_empty_line` | haeun intimacy≥80 **& yearMin 6** | growth/resolve/5 | 졸업 앞둔 강당, 하은 선배가 마지막 줄 비운 쪽지 건넴 | **Y6+ 확정 → high 전용** |
| `talk_junha_90_umbrella` | junha intimacy≥80 (junha=Y6 전학생) | growth/warm/5 | 비 오는 날 준하가 우산 손잡이 기울이며 "혼자 빨리 가는 거 멋있는 거 아이더라" | **준하=고2 전학 → high 전용** |

### P2 — 마일스톤 ANNUAL (EventResultScreen)

| 이벤트 id | 발동 | CG choiceIndex | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|
| `middle-school-entrance` | Y2, W1 | 공통 1장 권장 | 새 교복 입고 중학교 교문, 긴장+설렘. 수빈이 "같이 다니자"(마커 spec). 배경 `school_gate_middle` | ANNUAL |
| `middle2-start` | Y3, W1 | 공통 1장 | 중2 개학 교실, 창밖 벚꽃, 후배 생긴 뿌듯함. 배경 `classroom_{school}_spring` | ANNUAL. 비-`ANNUAL_EVENT_IDS`지만 W1 개학 마일스톤 |
| `middle3-start` | Y4, W1 | 공통 1장 | 중3 첫날, 진지해진 교실 분위기 "고등학교 진학". 배경 `classroom_{school}` | 동상 |
| `middle-school-graduation` | Y4, W46 | c0/공통 | 중학교 졸업식 강당, 지훈·수빈·민재·유나와 단체사진, 눈 빨갛게. 배경 `auditorium_middle` | ANNUAL |
| `midterm-1` | **Y≥2** (중·고 공통), W7 | 공통 1장 | 중간고사 전주, 쉬는시간에도 책 편 교실. (c2는 유나와 같이 공부) | **Y2~7 공통** → 권고 참조 |
| `final-exam-2` | **Y≥2** (중·고 공통), W37 | 공통 1장 | 2학기 기말, 올해 마지막 시험의 무게 | **Y2~7 공통** → 권고 참조 |

---

## 고등학교 (Y5~Y7)

> high = Y5(고1)~Y7(고3). 교복·체격이 중학교와도 다름. 준하/하은(재회 후)·입시 라인이 여기 집중.

### P1 — 기억 이벤트 (회고 갤러리/히어로)

| 이벤트 id | 발동(학년/조건) | CG choiceIndex | category/tone/imp | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|---|
| `high-panic` | Y5~7, mental≤55 & academic≥50 | c0,c1,c2 (3장) | c0 failure/regret/7 · c1 failure/regret/6 · c2 growth/breakthrough/8 | 새벽 세 시 방, 패닉(`bedroom_night`). c0=현관 밖 계단참에서 숨 고름 / c1=참고 책상에 억지로 앉음 / c2=엄마 방 문 두드림, 물 한 컵·옆에 앉음 | 신규. 주인공+엄마 |
| `identity-crisis` | Y5~6, mental≤55 | c0,c1,c2 (3장) | c0 failure/regret/6 · c1 discovery/resolve/7 · c2 growth/warm/8 | 야자 끝 옥상(`rooftop_sunset`). c0=혼자 천장만 / c1=담임에게 털어놓음 "모르는 게 정상" / c2=지훈이와 밤까지 통화 "졸업이나 하자"(마커 spec) | 신규 |
| `school-trip-high` | Y5, W28 | c0,c1 (2장) | c0 discovery/warm/7 · c1 failure/regret/5 | c0=제주 밤 해변, 파도 소리에 친구들 웃음(지훈 마커 spec) / c1=불참, 빈 교실 참고서. 배경 `classroom_high_afternoon` | 신규 |
| `club-academy-choice-y5` | Y5, W2 | c0,c1 (2장; c2 무드래프트) | c0 discovery/resolve/5 · c1 discovery/warm/5 | c0=학원 등록증 받는 날 "이제 시작" / c1=동아리방 문 처음 연 어색한 공기. 배경 `classroom_high`. 주인공 단독/소품 | 신규. c2(자율)는 CG 없음 |
| `graduation-prep-high` | Y7, W45 | c0 (1장) | growth/breakthrough/8 | 졸업 정장 입고 거울 앞 낯선 얼굴, 교정 사진. 배경 `classroom_high_afternoon`. (c1 무드래프트) | 신규. 회고 Y7 히어로 가치 큼 |
| `subin-farewell` | Y7, subin intimacy≥70, W40+ | c0,c1 (2장) | c0 reconciliation/warm/8 · c1 reconciliation/melancholy/7 | 학원 앞 가로등 아래, 항공과 진학 알리는 수빈. c0=환하게 웃으며 작별 / c1=아쉬움 묻은 작별 | **P1** (draft 추가됨, 2026-06) |
| `yuna-smile` | Y7, yuna intimacy≥45, W40+ | c0,c1 (2장) | c0 growth/breakthrough/8 · c1 reconciliation/warm/7 | 노을 교실, 음대 결정 알리는 유나. c0=이겨낸 사람의 웃음 / c1=연주회 새끼손가락 약속 | **P1** (draft 추가됨) |
| `jihun-promise` | 졸업 W40+, jihun intimacy≥70 | c0,c1 (2장) | 둘 다 reconciliation/warm/8 | 옥상 바람, 졸업 작별. c0=계속 친구하자 약속 / c1=고마움 전하자 지훈 눈 붉어짐 | **P1** (draft 추가됨) |
| `junha-cook` | Y7, junha intimacy≥50, W8+ | c0,c2 (2장) | c0 growth/warm/7 · c2 reconciliation/warm/7 | 옥상 도시락, 요리사 꿈. c0=응원 / c2=네 가게 첫 손님 약속. (c1 대학질문은 무드래프트) | **P1** (draft 추가됨) |
| `minjae-dream` | Y6+, minjae intimacy≥65 | c0,c2 (2장) | c0 discovery/melancholy/7 · c2 growth/resolve/8 | 옥상, "의대가 전부야?". c0=처음 솔직한 민재 / c2=네 인생이라 하자 주먹 쿵. (c1 현실응답 무드래프트) | **P1** (draft 추가됨. Y6 발동 시 Y6 회고에도 노출) |

> ✅ **졸업 라인 NPC 체인 5종은 memorySlotDraft를 추가했다(2026-06).** 이제 회상(엔딩 하이라이트 + Y6 발동분은 Y6 회고)에 뜬다.
> 단 **YearEndScreen은 Y1~Y6만** 표시하므로 Y7 발동분은 학년말 회고가 아니라 **엔딩 회상**과 **EventResultScreen**에서 노출된다.
> 무드래프트 선택지(`junha-cook` c1, `minjae-dream` c1)는 슬롯 미생성 → CG 불필요.

### P1 — mini-talk 기억 이벤트

위 중학교 섹션의 mini-talk 표에서 "주로 high / high 전용" 표기한 항목
(`talk_jihun_90_bench`, `talk_subin_90_two_names`, `talk_minjae_90_unmasked`, `talk_yuna_90_wrong_note`,
`talk_haeun_90_empty_line`[Y6+], `talk_junha_90_umbrella`[준하=고2 전학])이 high 구간 실발동.
중복 촬영 방지를 위해 **mini-talk CG는 학교급 디렉토리 대신 `common/`에 1장 권고**(아래 권고 §B).

### P2 — 마일스톤 ANNUAL (EventResultScreen)

| 이벤트 id | 발동 | CG choiceIndex | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|
| `high-school-entrance` | Y5, W1 | 공통 1장 | 고등 교문 앞에서 멈춤 "수능까지 3년". 지훈이 등장(마커 spec). 배경 `school_gate_high` | ANNUAL |
| `high2-track-select` | Y6, W1, track==null | c0(문과)/c1(이과) 2장 또는 공통 | 고2 문·이과 선택지 나눠주는 교실, 웅성거림. 배경 `classroom_{school}` | ANNUAL |
| `high3-start` | Y7, W1 | 공통 1장 | 고3 첫날, 칠판 "D-xxx" 카운트다운, 무거운 교실. 지훈이(마커 spec) | ANNUAL |
| `suneung-eve` | Y7, W34 | 공통 1장 | 수능 전날 밤 방, 엄마가 문 열고 "잘 할 수 있어"(`bedroom_night`) | ANNUAL |
| `suneung-done` | Y7, W36 | c0/공통 | 시험장 나선 맑은 하늘, 우는 애·웃는 애. c0=친구들과 치킨(지훈·민재 마커 spec). 배경 `clear_sky` | ANNUAL |
| `high-school-graduation` | Y7, W46 | c0/공통 | 졸업식 강당, 지훈·수빈·민재·유나·준하와 마지막 인사·눈물. 배경 `auditorium_high` | ANNUAL. 5인 단체 |
| `mock-exam-prep` | Y≥5, W11 | 공통 1장 | 전국 모의고사 전주 교실 "수능 출제 방식 똑같아" | ANNUAL(고 전용) |
| `mock-exam-prep-2` | Y≥5, W32 | 공통 1장 | 9월 모의 "수시 지원 기준", 조용해진 교실 | ANNUAL(고 전용) |
| `midterm-1` / `final-exam-2` | Y≥2 공통 | — | (중학교 섹션과 동일 자산) | 중·고 공통 — 권고 §A |

---

## 초등 갭 (Y1, 누락분)

> 이미 커버된 27개를 제외하고, **memorySlotDraft가 있는데 CG가 없는 Y1 이벤트**만 추림.
> (도달형 Y1 reach 이벤트 대부분은 27개에 포함되어 이미 커버됨.)

### P1 — 기억 이벤트

| 이벤트 id | 발동 | CG choiceIndex | category/tone/imp | 장면 1줄 브리프 | 비고 |
|---|---|---|---|---|---|
| `doyun-meet-elementary` | Y1 W4, **male 전용** | c0,c1 (2장; c2 무드래프트) | 둘 다 discovery/warm/4·3 | 점심 운동장, 체육부장 도윤이 축구 합류 권유. c0=같이 뛰어 첫 골 / c1=가방 두러 갔다 합류. 배경 `gymnasium` | 신규. **남주 전용** |
| `doyun-meet-elementary-f` | Y1 W4, **female 전용** | c0,c1 (2장; c2 무드래프트) | 둘 다 discovery/warm/4·3 | 청소시간 교실, 도윤이 양동이 들어줌. c0="멋있다" / c1=눈 마주치며 살짝 웃음. 배경 `classroom_elementary` | 신규. **여주 전용** (별도 id) |
| `doyun-school-split` | Y2 W2 (**slot.year=2 → middle 디렉토리**) | c0,c1,c2 (3장) | c0 discovery/regret/6 · c1 failure/regret/7 · c2 failure/regret/7 | 입학 둘째 주, 도윤이 "다른 중학교 가게 됐어" 카톡. c0=약속 잡으려다 무산 / c1="잘 가" 짧게 / c2=읽씹. 배경 `home_evening`. 폰 화면/혼자 방 톤 | ⚠️ **Y2 발동 → schoolLevel=middle**. 파일은 `middle/doyun-school-split_*`로 둘 것 |
| `graduation-prep-elementary` | Y1 W45 | c0 (1장; c1 무드래프트) | discovery/warm/7 | 졸업 앨범 촬영, 사진관에서 반 전체 웃음. 롤링페이퍼 "중학교 가서도 보자"(지훈·민재 마커 spec). 배경 `classroom_elementary_afternoon` | 신규. 27개에 없음 |

> `doyun-comic-share`, `doyun-secret-spot`, `doyun-window-school`, `minjae-crumbled-note`,
> `subin-*`, `yuna-*` 등 나머지 Y1 도달형은 이미 커버 27개에 포함 → 제외.
> `doyun-graduation-sign`도 27개(`doyun-secret-spot` 등과 함께)에는 없지만 — **확인 결과 커버 목록 밖**이며
> femaleChoices까지 memorySlotDraft 풍부 → 아래 "애매한 점"에 별도 기재.

---

## gender / choice 분기 조사 결과

- **gender 분기 있는 이벤트**(남/여 CG 별도 필요, `_m`/`_f`):
  - `minjae-sports`(femaleChoices, but Y1 1차 — 27개 밖이나 Y1), `jihun-call`(femaleChoices, W4), `jihun-envy`(crisis, femaleChoices),
    `jihun-basketball`/`jihun-support`(femaleChoices — 단 memorySlotDraft 없음 → 비대상),
    `doyun-meet-elementary`(남) vs `doyun-meet-elementary-f`(여, **id 자체가 분리**),
    `doyun-graduation-sign`(femaleDescription/femaleChoices).
  - mini-talk: `talk_jihun_basket`(male)/`talk_jihun_badminton`(female), `talk_doyun_soccer`(male)/`talk_doyun_classroom`(female) — **id가 성별로 분리**되어 각각 한 장.
- **gender 무관**(공통 1장 가능): 부모 mini-talk 전부, `family-strain`, `high-panic`, `middle-burnout`,
  대부분의 ANNUAL 개학/시험 이벤트, `school-festival`/`yuna-study`(주인공 성별 영향 낮음 — 단 결과 메시지 동일).
- **choice 분기**: 위 표의 "CG choiceIndex" 열이 곧 분기 수. importance≥3 드래프트가 달린 choice만 P1 CG 필요.

---

## 같은 이벤트가 여러 학년 발동 → common vs 학교급별 권고

### A. 학교급에 걸친 P1/P2 이벤트 (year만으로 schoolLevel이 갈림)

| 이벤트 | 발동 학년 | schoolLevel 분포 | 권고 |
|---|---|---|---|
| `school-festival` | Y≥2 | middle(Y2~4) + high(Y5,6) | **학교급별 2장**(`middle/`, `high/`). 교복·교실 톤 다름. 같은 choiceIndex 세트로 각각. |
| `yuna-study` | Y2~6 | middle + high | **학교급별 2장**. 유나 교복(중/고)·체격 차이. |
| `family-strain` | Y3~6 | middle + high | **common 1세트로 충분**. 집 식탁 장면이라 교복/학교 무관, 주인공 사복. (단 체격 차가 신경 쓰이면 학교급별) |
| `midterm-1` | Y2~7 | middle + high | **학교급별 2장 권장**(교실 배경·교복). 단조 컷이면 common 1장 타협 가능. |
| `final-exam-2` | Y2~7 | middle + high | 동상. |
| `high-panic` | Y5~7 | high only | high 1세트(또는 common). 방 장면이라 교복 무관 → common 가능. |
| `middle-burnout` | Y3 only | middle only | middle 1세트(또는 common, 방 장면). |
| `identity-crisis` | Y5~6 | high only | high 1세트. 옥상/방 장면 → common도 무방. |

**일반 원칙(이 프로젝트):** 교복·학교 배경이 보이는 컷(교실/복도/강당/운동장)은 **학교급별 촬영**,
집/방/거리/옥상 등 사복·중립 배경 컷은 **common 1장**으로 절약.

### B. mini-talk CG

mini-talk 슬롯은 친밀도 도달 시점에만 의존해 발동 학년이 유동적(같은 id가 중·고 어디서나 가능).
choiceIndex=0 고정·주인공 사복/배경 다양 → **`common/{id}_{g}.png` 1장(또는 성별무관 `common/{id}.png`)** 권고.
예외: 학교 교복이 강하게 보이는 컷(`talk_minjae_90_unmasked` 빈 교실 등)은 발동이 거의 high라 `high/`도 허용.

---

## 총계

### 학교급별 P1/P2 이벤트 수

| 학교급 | P1 이벤트 | P2(ANNUAL) 이벤트 |
|---|---|---|
| 중학교(Y2~Y4) | 9 (이벤트) + mini-talk 8 = 17* | 6 (그중 2개는 Y≥2 공통) |
| 고등학교(Y5~Y7) | 5 (이벤트) + mini-talk(중학과 공유 8) | 9 (그중 mock 2·midterm/final 공통) |
| 초등 갭(Y1) | 4 | 0 |

> *mini-talk 8개는 중·고 공통 셋이라 학교급 합산 시 중복. 고유 mini-talk P1 = 8.
> `school-festival`/`yuna-study`/`family-strain`/`midterm-1`/`final-exam-2`는 중·고 양쪽에 계상되나 고유 이벤트는 1개씩.

### 대략적 CG 장수 추정 (choice·gender 분기 고려)

- **P1 이벤트 CG**(드래프트 달린 choice만, 학교급별 분리 적용):
  - 중학교 신규: minjae-jealousy 3 + minjae-effort 2 + minjae-honest 2 + school-trip-middle 2
    + middle-burnout 3 + family-strain 3(common) + haeun-distance 3
    + (school-festival·yuna-study는 middle분 3+2) ≈ **23장**
  - 고등학교 신규: high-panic 3 + identity-crisis 3 + school-trip-high 2 + club-academy 2
    + graduation-prep-high 1 + (school-festival·yuna-study high분 3+2) ≈ **16장**
  - 초등 갭: doyun-meet(남) 2 + doyun-meet-f(여) 2 + doyun-school-split 3 + graduation-prep-elementary 1 ≈ **8장**
- **P1 mini-talk CG**: 8개 × (성별 무관 1장 가정) ≈ **8장** (gender 분기되는 jihun/doyun 30단계는 P1 아님 — imp<3).
- **P2 ANNUAL CG**: 중 6 + 고 9 (공통 midterm/final/mock 중복 제거하면 고유 약 11~12개) × 대개 1장
  (track-select·suneung-done·졸업식만 choice 분기 고려 시 +3~4) ≈ **15장**.

**합계 추정: 약 70장 내외** (P1 ~47, mini-talk ~8, P2 ~15). gender 분기 별도 촬영 시 P1에서 +5~8장 추가 가능.

---

## 보고 — 요약 + 애매했던 점

**요약**: 중·고 CG가 0개라 사실상 전 구간이 갭. 우선순위는 (1) 회고 갤러리에 직접 뜨는 P1 기억 이벤트,
(2) 결과화면 마일스톤 ANNUAL P2 순. P1의 진짜 핵심은 crisis.ts(family-strain/high-panic/identity-crisis,
imp 6~8)와 minjae 후반 체인, school-festival/yuna-study(중·고 공통)였다. mini-talk은 모달에선 Portrait만 쓰지만
회고에선 sourceEventId로 CG를 조회하므로 촬영 대상에 포함했다.

**애매했던/확인 필요한 점:**
1. **`doyun-school-split`의 schoolLevel 함정** — Y2 W2 발동이라 `getSchoolLevel(2)=middle`. 내용은 "초등 친구와의
   이별"인데 CG는 **middle 디렉토리**(`middle/doyun-school-split_*`)에 둬야 리졸버가 찾는다. 폰/방 컷이라 교복은
   거의 안 보이지만, 파일 경로는 middle 고정. 초등 갭 섹션에 넣되 디렉토리만 주의.
2. **`doyun-graduation-sign`** — 제외 27개 리스트에 없는데 femaleChoices까지 memorySlotDraft가 풍부(Y1 W47).
   "이미 elementary 전부 커버"라는 전제와 충돌. 27개 목록에 누락된 것인지, 의도적으로 미커버인지 확인 필요.
   현재는 초등 갭 후보로 분류(남 3 choice + 여 3 choice).
3. **졸업 NPC 체인(subin-farewell/yuna-smile/jihun-promise/junha-cook/minjae-dream)** — Y7 핵심 서사인데
   memorySlotDraft가 없어 회고 갤러리에 안 뜨고 ANNUAL도 아님 → P1/P2 어디에도 못 들어감. 의도라면 P3로,
   회고에 띄울 의도였다면 드래프트 추가가 선행돼야 함(데이터 결정 필요).
4. **mini-talk gender** — `talk_jihun_basket/badminton`, `talk_doyun_soccer/classroom`은 id가 성별로 분리돼 각각
   한 장이면 되나, 이들은 imp<3(또는 드래프트 없음)이라 P1 아님. P1 mini-talk 8종은 전부 성별무관 묘사라 common 1장 가능.
5. **`school-festival`/`yuna-study`/`midterm-1`/`final-exam-2`의 common vs 학교급별** — 코드상 year만으로 갈리고
   교복이 보이는 교실 컷이라 학교급별 2장을 권고했으나, 예산상 common 1장으로 타협 시 중학생 교복이 고등 회고에
   섞이는 톤 미스가 난다(in-game 확인 권장).
6. **mini-talk 80단계 실발동 학년** — intimacy 80 도달은 결정론적으로 정해지지 않음. haeun(yearMin 6)·junha(고2 전학)는
   high 확정이나 나머지는 "주로 high"로만 추정했다. 정확한 발동 학년 분포는 시뮬레이션 필요.
