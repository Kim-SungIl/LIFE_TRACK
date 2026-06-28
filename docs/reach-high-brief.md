# 고교(Y5~7) 도달형 reach 설계 브리프 v1

> 작성 2026-06-27. 신호-2 정밀판 작업 중 발견한 **고교 도달 콘텐츠 빈약** 문제의 콘텐츠 확충안.
> 중학교(reachMid v4, 42개)에 대응하는 고교 사다리. **집중형 ~26개** (사장님 결정).
> 목적: 입시·진로·이별이 몰리는 클라이맥스 구간(Y5~7)이 가장 빈약한 역설을 메운다.

---

## 0. 배경 — 왜 지금

신호-2(관계 "곧 더 가까워질 듯")를 NPC별 실제 임계로 정직하게 만들려다, 고교에 도달형 콘텐츠가
**거의 없다**는 걸 확인했다. 현황:

| NPC | 고교(Y5~7) 기존 | 비고 |
|---|---|---|
| jihun (소꿉친구) | **0개** | Y4 tier90까지 쌓고 고1~3 침묵 — 최대 갭 |
| subin | dream(Y5,≥60)·farewell(Y7,≥70) | 캡스톤 2개, 사다리 없음 |
| minjae | dream(Y6,≥65) | 단발 1개 |
| yuna | smile(Y7,≥45) | 단발 1개 |
| junha (Y6 전학생) | transfer/riceball/dialect/homesick/cook/birthday 7개 | 유일하게 짜임 |
| haeun (졸업 선배) | reunion(Y5,≥15)·birthday | 떠난 선배라 얇음 자연스러움 |
| doyun (첫사랑) | 0개 (Y2 school-split로 떠남) | **a 확정 — 후술** |

학년 매핑: **Y1=초 / Y2~4=중 / Y5~7=고(고1·고2·고3)** (`backgrounds.ts:getSchoolLevel`).

---

## 1. 설계 원칙

1. **기존 캡스톤으로 수렴**: 새 컷은 전부 기존 단발 캡스톤(dream/farewell/smile/cook)으로 흘러들게
   해서 고아 컷을 만들지 않는다. 사다리의 마지막 칸이 곧 이미 있는 그 장면.
2. **티어 현실성**: 초·중부터 쌓은 NPC(jihun 등)는 **고티어 심화**(80~97), 단발 NPC는 캡스톤
   티어에 맞춰 **낮게**(yuna 40~58). 안 그러면 reach가 영영 안 뜬다.
3. **데이터 컨벤션 통일**: 모든 컷에 `reach: { npc, tier, year }` 필드 + condition
   `intimacy >= tier && s.year === Y` (+ 교내 장면은 `!s.isVacation`). reach.ts/reachMid.ts와 동일.
   → 신호-2가 이 데이터를 그대로 읽어 고교까지 정직해진다.
4. **고교 톤 = 수렴**: 새 만남보다 **진로·갈림길·이별·졸업**. 관계가 깊어지는 게 아니라 *끝을 향해
   같이 걷는* 결. 입시·엔딩·부모 절정과 슬롯을 다투므로 양보다 밀도.
5. **회상 슬롯**: 핵심 컷(학년당 1개꼴)에만 `memorySlotDraft`(importance 6~7). 나머지는 진입/중간
   (importance 5). recallText 20~35자.
6. **페이싱**: reach 풀은 주당 1개 픽 + 동일 이벤트 쿨다운(기존 `selection.ts getReachForWeek`).
   학년 strict 게이트라 그 학년 못 오르면 유실 — **의도된 설계**(메모리: reach-event-year-gate).

---

## 2. doyun 결정 — a (떠난 첫사랑으로 둔다)

**5작가→10리뷰→5재검수 만장일치 a (20:0).** 코드로 직접 검증한 근거:

- `doyun-school-split`이 후회 슬롯 생성: `failure/importance 7/regret`(intimacy −12), `discovery/importance 6/regret`(−8).
- `selectRegretHighlights`(memorySystem.ts:298–310): `isDriftRelation = npc.met && npc.intimacy<=30` →
  점수 `importance + (드리프트 +1.5)`. doyun은 떠난 뒤 저친밀도로 남아 **+1.5가 항상 켜져 엔딩 후회카드
  1순위**.
- **b(재회)는 메커니즘적 자기모순**: 재회로 친밀도가 30 초과 시 `isDriftRelation`이 꺼져 +1.5가 사라지고
  doyun 후회 슬롯이 **강등**된다. 게임 최대의 첫 상실을 스스로 약화.
- `window-school`("저기 멀리 학교 하나 더") = 떠남의 의도적 복선. haeun 재회는 "카톡 계속하자, 약속이다"로
  연결을 *유지한* 멘토라 거울상이지 선례 아님.

→ **doyun 고교 reach = 0개 확정.**

### 옵션 D-1 — doyun 한 줄 언급 (선택, a를 지키며 기억만 살림)

"감정 페이오프" 리뷰어 지적: Y2~Y7 6년간 doyun 이름이 한 번도 안 나오면 엔딩 후회카드에서 "누구지?"가
될 위험. 해법은 **재회 이벤트가 아니라**, 고교 중반 다른 NPC 대사에 doyun 이름이 한 줄 스치는 경량 언급.

- 후보: jihun 고교 컷 중 하나에서 "야, 도윤이 걔 요즘 어디 산다더라?" 식 한 줄(분기·효과 없음, 텍스트만).
- 또는 yuna/subin 대사에 자연스러운 언급 1회.
- **이벤트 추가 0, 기존 컷 텍스트에 한 줄.** 친밀도 변동 없음 → 드리프트 가산점 불변(a 보존).
- 채택 시 집필 막바지에 jihun Y6 컷 1개에 삽입 권장.

---

## 3. NPC별 고교 아크 (티어는 초안 — 집필 시 미세조정)

표기: `[잠정 id] tier / 제목 — 시놉시스 (회상: category/importance)`

### 3.1 jihun (소꿉친구) — 8개 ⭐ 이 작업의 심장
Y4 "6년치 사진"(82)에서 이어, **입시가 둘의 시간을 갈라놓는** 아크. 활기=방패인 지훈이 처음으로 흔들린다.
말 못한 거리감 → 각자의 길 → 졸업.

**Y5 (고1) — 갈라지는 시간표**
- `jihun-hs-timetable` 80 / 다른 반 — 고교 첫 반배정에서 갈렸다. "이제 쉬는 시간에 보려면 복도 끝까지 와야 되네." (growth/5)
- `jihun-hs-latenight` 85 / 야자 끝 버스 — 야간자율학습 끝 같은 버스, 말없이 창밖. 6년 만에 처음 어색한 침묵. (bond/6)
- `jihun-hs-firstgap` 89 / 처음 안 맞은 약속 — 지훈이 약속을 처음으로 깜빡한다(학원 때문). "미안, 요즘 정신이 없어서." (growth/5)

**Y6 (고2) — 각자의 길이 보이기 시작**
- `jihun-hs-track` 90 / 문이과 갈림 — 진로가 갈린다. 지훈은 체대, 너는 다른 길. "우리 이제 진짜 다른 데 가는구나." (growth/6)
- `jihun-hs-unsaid` 93 / 말 못한 한마디 — 둘만 남은 교실, 하고 싶은 말이 목에 걸린다. (선택: 말한다/삼킨다 — 후자는 후회 슬롯) (bond/7)
- `jihun-hs-injury` 95 / 다친 날 — 지훈이 시합에서 다쳐 병원. 제일 먼저 달려간 게 너다. "역시 너밖에 없네." (bond/6)

**Y7 (고3) — 마지막 함께**
- `jihun-hs-lastgame` 94 / 마지막 경기 — 지훈의 고교 마지막 시합. 관중석에 너 혼자 보인다. (bond/6)
- `jihun-hs-graduation` 97 / 같은 사진 한 장 더 — 졸업식. "6년치 사진에 한 장 더 추가." Y3 "6년치 사진"과 수미상관. (memory/7)

### 3.2 subin — 4개
승무원 꿈 아크. dream(Y5,60) → farewell(Y7,70) 사이를 잇는다.
- `subin-hs-firstdream` 55 / 비행기 사진 (Y5) — dream 직전 리드인. 핸드폰 잠금화면이 비행기다. (growth/5)
- `subin-hs-momfight` 64 / 엄마와 부딪힌 날 (Y6) — "엄마는 안정적인 거 하래." 처음으로 운다. (bond/6)
- `subin-hs-studyboard` 68 / 영어 단어장 (Y6) — 승무원 면접 영어를 혼자 외운다. 같이 외워준다. (growth/5)
- `subin-hs-after` 72 / 합격 후 (Y7) — farewell(70) 이후 조용한 비트. "너 덕분에 안 포기했어." (memory/7)

### 3.3 minjae — 4개
의대 압박 아크. dream(Y6,65 "의대가 전부야?") 중심.
- `minjae-hs-pressure` 58 / 성적표 (Y5) — 전교 1등인데 표정이 없다. "이 정돈 당연한 거래, 우리 집은." (growth/5)
- `minjae-hs-doubt` 62 / 진짜 하고 싶은 거 (Y6) — dream 직전. "넌 하고 싶은 거 있어? 난 모르겠어." (bond/6)
- `minjae-hs-mask` 70 / 페르소나 (Y6) — dream 이후 심화. 무심한 척이 방패였음을 들킨다. (bond/6)
- `minjae-hs-choice` 75 / 자기 선택 (Y7) — 의대 외 다른 길을 처음 입에 올린다. 해방. (memory/7)

### 3.4 yuna — 3개 (티어 낮게)
피아노/음대 아크. smile(Y7,45) 캡스톤.
- `yuna-hs-piano` 40 / 빈 음악실 (Y5) — 야자 빼고 피아노 친다. "이게 제일 나다워." (growth/5)
- `yuna-hs-recital` 48 / 콩쿠르 전날 (Y6) — 떨려서 손이 굳는다. 옆에 있어준다. (bond/6)
- `yuna-hs-decision` 55 / 결심 직전 (Y7) — smile(음대 결정) 직전 리드인. 엄마와 싸우기 전 망설임. (growth/5)

### 3.5 junha (Y6 전학생) — 2개
이미 Y6~7 7개로 짜임. cook(Y7,38 요리사 꿈) 라운드업만.
- `junha-hs-recipe` 42 / 레시피 노트 (Y7) — 요리사 꿈을 노트에 적는다. "부산 가면 가게 차릴 거다." (growth/5)
- `junha-hs-farewell` 50 / 다시 부산 (Y7) — 졸업 후 부산으로 돌아간다. 짧은 작별. (memory/6)

### 3.6 haeun (졸업 선배) — 2개
reunion(Y5,15)에서 이어, 그녀가 졸업해 떠나기까지의 짧은 비트. (haeun은 1년 위라 Y5~6만)
- `haeun-hs-rooftop` 28 / 옥상의 선배 (Y5) — 재회 후, 늘 가던 옥상에서 진로 고민을 들어준다. (bond/5)
- `haeun-hs-leaving` 40 / 마지막 줄 (Y6) — 선배 졸업. "마지막 줄은 비워둘게"(기존 talk 비트)와 호응하는 작별. (memory/6)

---

## 4. 합계 & 검증

| NPC | 개수 | 학년 분포 |
|---|---|---|
| jihun | 8 | Y5×3, Y6×3, Y7×2 |
| subin | 4 | Y5×1, Y6×2, Y7×1 |
| minjae | 4 | Y5×1, Y6×2, Y7×1 |
| yuna | 3 | Y5×1, Y6×1, Y7×1 |
| junha | 2 | Y7×2 |
| haeun | 2 | Y5×1, Y6×1 |
| **합계** | **23** | (+버퍼 2~3 → ~26) |

**집필 후 검증 체크리스트**
- [ ] 모든 컷 `reach:{npc,tier,year}` + condition `intimacy>=tier && year===Y` 정합
- [ ] 교내 장면 `!s.isVacation` 가드 (집/단톡/졸업 컷은 예외)
- [ ] 티어가 학년 내 오름차순, 기존 캡스톤 티어와 충돌·중복 없음
- [ ] 캡스톤 수렴 확인 (jihun-graduation↔six-years-photos, subin-after↔farewell 등)
- [ ] memorySlotDraft recallText 20~35자, importance 5~7
- [ ] 동성/이성 분기 필요한 컷 femaleChoices/femaleDescription (특히 jihun 정서 컷)
- [ ] index.ts 등록 + `npm run check` + 신호-2가 새 티어 읽는지 in-game 확인
- [ ] (옵션 D-1) doyun 한 줄 언급 1곳 삽입 여부

---

## 5. 집필·검수 파이프라인 (다음 단계)

reachMid v4 선례: 5작가 → 10인리뷰 → codex/cursor → 5인재검수. 규모(~26개)에 맞춰 결정 필요.
- 파도 분할 권장: **Wave 1 = jihun 8개**(심장, 단독 검수) → **Wave 2 = subin/minjae 8개** →
  **Wave 3 = yuna/junha/haeun 7개 + 옵션 D-1**. 각 파도마다 집필→검수.
- 신호-2 코드 변경은 이 콘텐츠와 **독립** — 콘텐츠 데이터화가 끝나야 신호가 읽을 게 생기므로 콘텐츠 선행.
