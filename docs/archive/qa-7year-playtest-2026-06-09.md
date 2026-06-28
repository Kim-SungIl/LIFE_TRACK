> # ⚠️ 보관용(ARCHIVED) — 2026-06-24 기준 절반 이상 해결됨
> **이 문서는 PR #259~#272 밸런스 패치 *이전* 스냅샷입니다. 리뷰·진단의 근거로 인용하기 전에 아래 현황을 먼저 확인하세요.**
>
> | TOP 5 항목 | 현재 상태 |
> |---|---|
> | 1. 엔딩 다운그레이드 순서 버그 | ✅ **해결** (#266, `ending.ts:228-234` — collapse<10→B를 weakness<20→A보다 먼저 판정) |
> | 2. 행복 산식 health 무시 | ✅ **해결** (#266, `ending.ts:14` — `calculateHappinessGrade(... health)`, health<20이면 S 불가, QA C1-B) |
> | 3. 수능 internalAvg 중학 내신 혼입 | ✅ **해결** (examSystem 고등 필터 + Y전환 리셋) |
> | 4. 이벤트 효과 감쇠 우회 → 89~98 수렴 | 🟡 **일부/설계** — academic 천장 ~91은 softcap+2/week로 *구조적*. 변별은 "방치한 축"에서 발생 |
> | 5. 번아웃 도달 불가 (tired 자기치유) | ✅ **해결** (#266, 만성 강제번아웃 + `totalTiredWeeks≥235` 엔딩 라우팅. sim 번아웃 0%→42%, 실패엔딩 0→47) |
>
> **돈 무의미**: 🟡 일부 해결(#271, 사교육비 15→28·year≥5). 후반 고비용 sink 확대는 잔여.
> **잔여(진짜 열림)**: 중후반(중2~고3) 서사 밀도 · 고등 event CG 공백 · 관계 UI 신호 · 활동 카드 전략 태그 · 엔딩 "방치 축" 문장화.
> **삭제 금지 사유**: 하단 "시뮬 아티팩트로 제외/유보" 섹션은 이미 기각된 가짜 버그(sim 비결정론 아티팩트) 기록 — 재제기 방지용.

# LIFE_TRACK 7년 플레이스루 QA 통합 리포트 (2026-06-09)

> QA 20명(밸런스5·버그5·재미4·방향성3·내러티브3) × 12 플레이 페르소나 7년 자동 플레이스루.
> 시뮬 하네스: `game/scripts/sim/sim-qa-playthrough.ts` / 데이터: `/tmp/qa-results/qa-all.json`
> 워크플로: 21 에이전트 / 1.21M 토큰 / ~12분.

---

통합 리포트를 작성하기 위해 findings를 분석하겠습니다. 데이터는 이미 모두 제공되었으니 별도 파일 읽기 없이 정리하겠습니다.

# LIFE_TRACK 7년 플레이스루 QA 통합 리포트

> QA 20명 × 12 페르소나 시뮬(qa-all.json) + 코드 분석 통합. 출처가 겹치는 항목은 "신뢰도 높음"으로 표기. 시뮬 아티팩트(자동플레이가 talkToNpc 미호출, track 미덤프, 루틴 고정 등)로 의심되는 것은 별도 섹션으로 분리.

---

## TOP 5 우선 조치 (실제 플레이 영향 큰 순, 아티팩트 제외)

1. **엔딩 다운그레이드 순서 버그 — collapse가 weakness보다 약하게 처리됨** (`ending.ts:131-133`). S→A가 먼저 평가돼 붕괴 스탯 보유자가 의도된 B로 못 떨어짐. 한 줄 순서 교체로 즉시 수정 가능한 명백한 로직 버그.
2. **행복도 산식이 health를 통째로 무시** (`ending.ts:11`). health 10~16 바닥 7/12명이 행복 S. "몸 갈아넣고 행복 S"가 양산됨. 학년말 카드(YearEndScreen)도 동일 산식이라 인게임 노출됨.
3. **수능 internalAvg에 중학교(Y2~4) 내신이 섞여 고득점자를 체계적으로 하향** (`examSystem.ts:315`, 학교급 필터 없음). examResults가 학년 전환 시 리셋 안 됨(`gameEngine.ts:81`). poor-resilience가 고3 모의 grade1 연속인데 수능 grade2로 내려앉음.
4. **이벤트 선택지 효과가 감쇠/소프트캡/주당캡을 전부 우회** (`store.ts:188-191`). 활동은 강하게 눌리는데(`gameEngine.ts:223/231/243`) 이벤트는 raw 가산 → social/academic/mental이 빌드 무관하게 89~98 수렴, 빌드 차별성 소멸.
5. **번아웃이 구조적으로 도달 불가 — tired 상태가 자기치유 루프** (`gameEngine.ts:543-550`). tired 진입 즉시 매주 mental +2/fatigue -5 자동회복이라 mental<20 게이트(line 488)에 못 닿음. "갈아넣기" 리스크 빌드가 게임에 존재하지 않음. 처리 순서 문제(회복이 판정보다 먼저, `processWeek` 660→744→751)도 함께.

---

## BALANCE

### major

**[신뢰도 높음 · 5+ QA] 이벤트 선택지 효과가 감쇠/소프트캡/주당캡을 전부 우회 → social·academic·mental 빌드 무관 수렴**
- 심각도: major
- 근거: `store.ts:188-191` resolveEvent는 choice.effects를 stats에 raw 가산(getDiminishingReturn·fatiguemod·주당+2캡·무료활동 80+ ×0.1 미적용). 활동은 `gameEngine.ts:223/231/243`에서 70+ ×0.5/85+ ×0.3/95+ ×0.1로 강하게 눌림. academic-max는 social 활동 0인데도 social 96.8. 한 판 354~376 이벤트 해결.
- 제안: social/academic처럼 "거의 모든 이벤트가 올려주는" 축에 이벤트 효과 high-stat 감쇠(85+ 0.5배)나 학기당 이벤트 누적 캡 부여. "이벤트로도 캡" vs "활동만 캡" 의도 결정이 핵심.

**[신뢰도 높음 · 다수 QA] academic 변별력 소멸 — 자연감소 floor 12 + 학교수업 자동 +0.3 + effectiveAcademic 80↑ 0.5 소프트캡 3중 작용**
- 심각도: major
- 근거: `gameEngine.ts:344` academic floor 12, `applySchoolClass(438-441)` 매주 +0.3. `examSystem.ts:68-71` ea: academic>80이면 80+(a-80)*0.5 → acad 93.2→86.6, 94.1→87.05로 7점차가 0.45점으로 압축. 비몰빵 빌드도 academic 91~94, academic-max(93.2)와 health-max(91.9) 차이 1.3점. 공부 몰빵의 academic 보상이 사실상 없음.
- 제안: 소프트캡 계수를 0.65~0.7로 완화하거나 임계를 85로 미뤄 상위권 학업 투자가 최소 1등급 차를 만들게. 학교수업 baseline vs 이벤트 효과 기여 분리 측정 권장.

**[신뢰도 높음 · 다수 QA] 동일 academic 92에서 수능 2등급 차이의 대부분이 health→fatigue 페널티 — 학업이 아니라 health가 수능을 결정**
- 심각도: major
- 근거: academic-max(acad93/health12)·grind-burnout(acad94/health10)·info-parent(acad90/health12)는 수능 grade4. balanced/neglect-first/health-max(health 78~82)는 grade2. `examSystem.ts:260` mockScore=ea*0.98+mental*0.15+fatiguePenalty. health<20→fatigue 가속(`gameEngine.ts:290-291` ×1.5), 시험시 fatiguePenalty -6~-9(`examSystem.ts:257`). base차 약 -5(mental 기여) + fatigue -9 ≈ -14점 = 2등급.
- 제안: 공부몰빵 손해 방향성은 좋으나 폭이 과함. fatiguePenalty 상한을 -9→-5~-6, 또는 academic 95+이면 일부 상쇄항을 둬 폭을 1등급대로 압축 검토.

**[신뢰도 높음 · 다수 QA] 수능 grade1(SKY/의대 게이트)이 구조적으로 도달 불가 — 내신 20% 가중 + 소프트캡이 천장을 막음**
- 심각도: major
- 근거: `examSystem.ts:320` suneungBase=mock1*0.35+mock2*0.45+internalAvg*0.20, grade1=score≥96(`:50`). 12 페르소나 최고가 poor-resilience grade2(92점). internalAvg ~80~90을 못 넘어 20% 항이 끌어내림. mock 만점도 grade1 불가. SKY/의대(`ending.ts:67-86` mockGrade≤1)는 도달 불가 루트.
- 제안: internalAvg 가중을 0.10으로 낮추거나 grade1 임계 93~94 완화, 또는 소프트캡 임계 85 상향. 최상위 보상을 열 의도면 필요.

**[신뢰도 높음 · 다수 QA] talent>=90 특기자 분기가 수능 최상위를 무조건 덮어쓰는 hard cliff**
- 심각도: major
- 근거: `ending.ts:37-38` talent>=90 특기자 return이 mockGrade/academic 체크보다 먼저. talent90+acad90+수능1등급 → 「예술/체육 특기자」(의대/SKY 상실), talent89 동일조건 → 「의대 합격」. talent-max(talent95/acad93)도 특기자로 귀결.
- 제안: 특기자 override를 `talent>=90 && academic<80`로 한정하거나, 수능 1·2등급이면 「특기+학업 겸비」 별도 분기. 단일 임계 절벽 완화.

**[신뢰도 높음 · 5+ QA] 번아웃 0/12 — tired 자기치유 루프 + 주간 처리순서로 게이트 도달 불가**
- 심각도: major
- 근거: `checkMentalStateTransition(gameEngine.ts:543-550)` tired 진입 즉시 매주 mental +2/fatigue -5, 8주+ tired면 추가 +1.5/-3(`523-527`). 번아웃 게이트는 tired AND mental<20(`488`)인데 tired가 mental을 +2/주로 올려 하강 자체가 안 일어남. grind-burnout(strict+strict) 최종 mental 82·burnout 0. 추가로 `processWeek` 순서가 회복(660)→감쇠(744)→판정(751)이라 판정이 항상 "회복 다 된 상태"에서 이뤄짐.
- 제안: tired 자동 mental 회복(+2)을 "쉬는 활동을 해야" 들어오게 분리하거나 fatigue>70 동안 tired 자동회복 0으로 게이트. 멘탈상태 판정을 드레인 직후·회복 전으로 이동. 최소 하강 경로 하나는 회복보다 빠르게.

**[신뢰도 높음 · 다수 QA] 돈이 자원으로 전혀 기능 안 함 — 전 페르소나 과잉 누적**
- 심각도: major
- 근거: finalMoney 789~1609. 활동 최고비용 8(`activities.ts:275`), 상점 최고가 tablet 15(`shopSystem.ts:94`), 주간수입 3~5(`parentModifiers.ts:55`). 337주 단조 누적, 최빈곤 페르소나도 tablet 50회분 잔고로 종료. `ending.ts`/`examSystem.ts`에 money 의존 0.
- 제안: (a) 고비용·고효과 엔드게임 지출처(고3 집중과외, 입시컨설팅, 레슨 패키지) 도입, 또는 (b) 돈을 핵심축에서 빼는 결정 명시. 부모강점 wealth도 이에 묶여 사실상 최약체.

**[신뢰도 높음 · 다수 QA] 체력·특기가 수능 본과목과 디커플 + 10/80 완전 이분화(중간 0건)**
- 심각도: major
- 근거: health<20 7명/>70 5명/중간 0명. `examSystem.ts:126/158` health는 예체능 과목만, talent는 korean/socialScience만 가중. 본과목(국영수탐)은 ea·mental·fatigue 지배. academic-max(health12)와 social-max(health16/talent84)가 동일 mock4. 등속감쇠 -0.4/-0.8(`gameEngine.ts:368`)로 운동 미선택 시 floor 10 직행.
- 제안: health<20 페널티를 본과목 경로(저체력 시 mental/fatigue 회복 둔화)로 일부 연결. 감쇠를 체력값 비례로 바꿔 중위권 평형 생성 검토. (이분화 일부는 고정루틴 아티팩트 — 결정론 A/B로 평형 존재 확인 권장)

**[신뢰도 높음 · 5+ QA] doyun 친밀도 0~3 전원 + tier90 코어 6개 중 3개(haeun/junha/doyun) 도달 0회**
- 심각도: major
- 근거: `gameEngine.ts:69` doyun 시작 intimacy 0, 미니토크 2개 모두 intimacyMin 30(`talkData.ts:100-112`) → 0→30 부트스트랩 시드 없음. tier90 코어(`talkData.ts:213-297`) intimacyMin 80. 12런 최댓값: junha 34, haeun 58, doyun 3. haeun_90은 80+yearMin6 이중게이트.
- 제안: doyun에 intimacyMin 0인 도입/재회 미니토크 추가 또는 시작 intimacy 15~20. 후발/이탈 NPC(junha Y6, haeun 졸업)의 tier90 문턱을 70으로 낮추거나 등장 학년 +3 기회 추가. 의도된 휴면이면 회고/UI에 명시.

**[신뢰도 높음 · 5+ QA] 엔딩 수렴 — 12 페르소나가 인서울/수도권+행복S로 5종 수렴, 실패 엔딩 0**
- 심각도: major (선택 무력감·난이도·빌드다양성·엔딩분기 렌즈에서 독립적으로 동일 결론)
- 근거: 12/12 4년제 합격, 11/12 행복S. 최악 last-choice(acad39.5, 수능6등급)조차 지방국립대+행복S. neglect-first(항상 첫 선택)는 수능g2/인서울상위권/S/S. bestAxis 전원 84.9~95.4(`ending.ts:120`). achievement는 max 단일축이라 한 스탯만 높으면 A 보장. happiness는 mental≥80&&social≥60(`ending.ts:11`)인데 social 11/12명 95+, mental 9명 95+. 재수(burnout≥4&&mental<30)·잠시쉼표(mental<15)·전문대(mockGrade≥7)·고독한승리자(hap=D) 전부 0회. balanced/mental-care/health-max/neglect-first 4명이 글자 그대로 동일 「완벽한 청춘」.
- 제안: bestAxis에 최저축 페널티 가중, happiness 임계 상향 또는 학년별 변화량 반영, mental 상단 감쇠 강화. "균형형 지배전략"이 의도인지부터 결정. (social 만점은 아티팩트 의심 병행)

### minor

**health soft floor 10이 사실상 하드 바닥 — 데스스파이럴 대신 "전원 체력 바닥 수렴"**
- 심각도: minor
- 근거: `gameEngine.ts:368-370` health<=12에서 -0.1 완화 + Math.max(10,...). 고피로 90+ 경로(`396-397`)만 health 5 허용하나 burnout 0이라 거의 안 탐. health 분포가 10~15.5에 7개 밀집. `line794` 최종 클램프 Math.max(0)이 floor 10을 덮어쓸 수 있음(점검 필요).
- 제안: floor를 5로 낮추거나 학기중 50% 상쇄 축소. line794와 floor 정합성 점검.

**친밀도 plateau가 minitalk/활동매핑 경로엔 미적용 — 한쪽만 감쇠**
- 심각도: minor
- 근거: `store.ts:388-390` minitalk은 raw 가산(감쇠 미적용), `store.ts:209` 이벤트 npcEffects만 scaleIntimacyChange 통과. `gameEngine.ts:625` npcActivityMap +3/주도 raw. 결과 social계열 jihun 100/subin 94~100 수렴, academic계열 jihun 57·subin 45~54, last-choice 전원 20 floor.
- 제안: minitalk/활동매핑에도 scaleIntimacyChange 적용해 정렬. 단 비-social의 친구빈곤이 trade-off 의도인지 확인.

**친밀도 wealth 부모강점이 돈 과잉공급에 묻혀 무의미 / resilience만 체감**
- 심각도: minor
- 근거: wealth 보유 4명 평균 finalMoney 1496 vs 비보유 826~1237이나 돈 자체가 무영향. resilience(health+5/운동효율+0.1/피로0.85, `parentModifiers.ts:36-48`)는 health-max·poor-resilience에서 체감.
- 제안: finding 1(돈 지출처)과 연동. wealth를 "돈으로 기회를 사는" 능동효과로 재정의 검토.

**특기 5 vs 85 이분화 / talent가 club 부수효과로만 80대 도달**
- 심각도: minor
- 근거: talent<20 2명/>70 9명, 중간 grind-burnout 55.3 하나. `activities.ts:103` club {social:1,talent:1,mental:0.5}. talent 활동 안 하는 social-max/mental-care도 84~85, club 없는 academic-max 5.8. talent floor 5 등속감쇠 -0.2(`gameEngine.ts:364`).
- 제안: club의 talent +1을 +0.5로 낮추거나 자연감소 강화 → creative/coding/art 투자 빌드가 변별되게. 단 talent는 예체능 특기자 출구가 있어 health보다 덜 문제.

**health·talent만 양극화되어 사실상 "운동했나/club했나" 2개 토글이 유일 빌드 차원**
- 심각도: minor
- 근거: spread talent 90.4/health 72.1이나 academic·social·mental 수렴. 12 중 7개가 동일 「인서울 상위권 S/S」.
- 제안: 수렴 축 하나를 풀거나 health/talent를 엔딩 분기에 강하게 연결.

**academic-max 공부몰빵이 수능4등급/수도권 — 피로 페널티의 정당한 산물(아티팩트 아님)**
- 심각도: minor
- 근거: 고등 진입 후 final/midterm avg 60→40~50대 하락, mock 3~4, suneung grade4. health11.6/mental63.1로 ea가 academic93을 깎음.
- 제안: 의도된 trade-off로 보이나 acad93에 4등급은 과할 수 있음 — fatigue/health 페널티 곡선 수치 확인 권장.

**이과(science) 루트가 삼중 페널티로 통계적 불리 — 의대 컷은 더 높음**
- 심각도: minor
- 근거: `examSystem.ts:142-143` 이과 수학 rand=11(문과9), `:150-152` 과탐 rand=9(사탐7), 사탐은 social*0.15 가산(social 만점 수렴). 의대 academic≥88(SKY경영 85). 균형 빌드가 합리적으로 문과 선택.
- 제안: 이과 변동성이 "리스크 보상" 의도인지 확인. 의대 컷을 SKY경영과 맞추거나 이과 탐구 보정 추가 검토.

### idea

**mentalState 페널티(-8/-15) 미발동 / 시뮬에서 tired·burnout 상태 시험 0건** — 결정론 A/B로 시험주 강제 burnout 시나리오 별도 측정 필요.
**applyNpcDecay floor 20 정상 동작 확인** — 버그 아님. 다만 80↑ -0.2/주가 raw 가산에 묻혀 plateau 체감 안 됨.
**시뮬 mental 만점 수렴이 자동선택 편향인지 메커니즘인지 분리 필요** — weekLogs 덤프 없어 추측 영역, 극단빌드 결정론 A/B 권장.

---

## BUG

### major

**[신뢰도 높음] 엔딩 다운그레이드 순서 버그 — collapse가 weakness보다 약하게 처리**
- 심각도: major
- 근거: `ending.ts:131-133` line132(hasWeakness && S→A)가 line133(hasCollapse && S→B)보다 먼저 평가 → S에서 시작한 케이스는 132에서 A로 떨어진 뒤 133 조건(achievement==='S')에 안 걸림. academic-max(talent5.8<10)·poor-resilience(talent5<10) 둘 다 의도상 B여야 하나 reported A. 시뮬 재계산 일치.
- 제안: line133(collapse)을 line132(weakness)보다 먼저 평가하거나 if/else if 체인으로 묶어 가장 강한 페널티 하나만 적용.

**[신뢰도 높음] 행복도 산식에서 health 완전 누락 — "몸 무너진 채 행복 S" 양산**
- 심각도: major
- 근거: `ending.ts:11` calculateHappinessGrade(mental, social) — health 인자 없음. 12개 중 7개가 health 10~15.5, 그 중 6개 happiness S. grind-burnout(health10/tired)도 S. YearEndScreen 동일 산식 → 인게임 노출.
- 제안: health 하한 게이트(health<20이면 S 불가) 검토. 의도면 명시.

**[신뢰도 높음] 수능 internalAvg에 중학교(Y2~4) 내신 혼입 — 고득점자 체계적 하향**
- 심각도: major
- 근거: `examSystem.ts:315` filter에 학교급 가드 없음. getExamSchedule이 year<=4에도 midterm/final 발행, examResults는 `gameEngine.ts:81` []로 시작·`820` push만, 학년 전환 시 리셋 안 됨. poor-resilience 고3 모의 grade1인데 suneung grade2로 하락.
- 제안: 필터에 `e.schoolLevel === 'high'` 또는 `year>=5` 가드, 또는 최근 N개만 가중. "전 학창 누적" 의도면 주석 명시.

**[신뢰도 높음] 시뮬 하니스가 W48 이벤트 후 year-end 안 거치고 week=49를 한 번 더 processWeek — QA 수치 잉여 1주 오염**
- 심각도: major (측정 신뢰도 문제, 게임 본체 버그 아님)
- 근거: `store.resolveEvent`는 chain 소진 후 week>48이면 applyYearTransition(`store.ts:310-313`). `scripts/lib/y1-sim-resolve.ts:123-124`는 phase='weekday'만 세팅하고 transition 미호출 → W48 이벤트 있으면 week=49(겨울방학)로 한 번 더 돌고 week++→50 transition. totalWeeksPlayed 7*48=336 초과(336~340 산포).
- 제안: resolveEventLikeStore의 종료 분기를 store와 동일하게 맞춰 잉여 49주 제거. 다른 QA 결론도 이 잉여주에 미세 오염됨.

**[신뢰도 높음 · 다수 QA] Y7 작별 도달컷이 isVacation 가드로 W40~42 3주에 압축 + chain 1주1픽으로 일부 묻힘**
- 심각도: major
- 근거: 작별컷 다수가 `s.week>=40 && !s.isVacation`(jihun.ts:168, subin.ts:137, yuna.ts:143). W43+는 겨울방학(`gameEngine.ts:114`)이라 실발동 W40~42. chain은 밀스톤 주당 1픽(`selection.ts:74-79`), conditional 10주 쿨다운(`:41`). 반면 reach.ts:144/298은 week>=41인데 isVacation 가드 없음(비일관).
- 제안: 작별컷 isVacation 조건 재검토(연말 회상은 방학 주에 떠도 자연스러움), 또는 마감 직전 강제 1회 노출 슬롯 승격. reach vs npc/*.ts 게이팅 일관화.

**[신뢰도 높음 · 5+ QA] QA 하니스가 talkToNpc/미니토크를 0회 호출 — talkEventsFired=0, tier90 회상·미니토크 메모리 경로 전체 미검증**
- 심각도: major (측정 한계, 게임 버그 아님)
- 근거: 12 페르소나 전원 talkEventsFired=0. `sim-qa-playthrough.ts:135`는 `s.talkEventsFired?.length` 읽지만 GameState에 필드 자체 없음(grep 0). 하니스(`84-104`)는 processWeek+resolveEvent만, talkToNpc 미호출. applyMemorySlotFromMiniTalk은 store.ts:392/428/463 talkToNpc 안에만 존재. 미니토크 memorySlotDraft 105개 중 다수 미검증.
- 제안: 하니스에 주차별 talkToNpc 호출 추가 + talkEventsFired 소스를 store 결과에서 정확히 수집. 별도 결정론 친밀도→tier 도달 테스트로 보람 루프 검증.

### minor

**effectiveAcademic 80↑ 0.5 감쇠로 academic 93~94가 86~87로 수렴** — (balance major와 동일 이슈, bug-exam-pipeline 렌즈에서 재확인) 감쇠 시작점 상향 또는 계수 0.65~0.7 완화.

**Y7 시험 스케줄에 2학기 기말(week 38) 누락**
- 근거: `examSystem.ts:12` Y7 = {...,30:midterm,33:mock,35:suneung}. Y5/Y6은 30:midterm/38:final 둘인데 Y7은 38 final 없음. internalAvg에 Y7 2학기 내신 1개 덜 반영.
- 제안: "Y7 2학기는 수능이 기말 대체" 주석 명시(SSOT 회귀 방지).

**processWeek 시험이 항상 prep='normal' — cram/friends 보너스 사장**
- 근거: `gameEngine.ts:809/812/815` prep 인자 미전달 → 기본 'normal'. prepBonus(cram +8/friends +4, `examSystem.ts:83/256`)가 정규 시험에서 항상 0.
- 제안: 시험 직전 주 활동/선택을 state 누적해 prep 전달, 또는 미사용 데드코드면 제거.

**track=null 폴백 경로(`ending.ts:61-63,89-91`)는 정상 플레이 도달 불가 dead code**
- 근거: track은 Y6W1 high2-track-select(`school.ts:396-413`, 두 선택지 모두 trackSelect 필수, condition year===6&&track===null)에서 강제. 영구 스킵 경로 없음.
- 제안: 안전망임을 주석 명시하거나 단순화. 실밸런스 영향 없음.

**track=null 폴백에서 수능 1·2등급이 「상위권 대학」으로 뭉개짐** — dead code면 무시 가능. 향후 track-null 경로 열 계획이면 grade<=1과 ==2 분리.

**특기자 talent 85~89 & academic 70+ 구간이 일반 진로로 빠져 특기 무반영(주석은 +α 의도)**
- 근거: `ending.ts:39-40` 코드상 가산 없음. talent87+acad75 → 「지방 국립대」(특기 흔적 없음).
- 제안: 실제 +α 부여하거나 주석과 동작 일치.

**last-choice eventsResolved 284(최저) — 유실 아니라 스탯/친밀도 게이트 미충족(콘텐츠 차단)**
- 근거: npcIntimacy 전원 ~20캡, academic 39.5. 도달형이 intimacy≥25~70/stat 임계 요구 → 후보 풀에서 빠짐.
- 제안: 유실 버그 아님. 다만 저관여 플레이어용 "바닥 보장" 도달컷(intimacy 무관 1~2개) 학년별 점검 권장.

**doyun-comic-share(intimacy≥30) 사실상 도달 불가 — 콘텐츠 사문화 가능성** — (doyun finding과 동류) 임계 12~15로 낮추거나 Y1 doyun 상호작용 보강. 의도된 사문이면 유지.

**수능 미응시→9등급→전문대 폴백은 정상 처리, 단 detail 톤 갑작스러움** — 버그 없음. 미응시는 별도 detail로 구분하면 정직함↑.

### idea

**저스탯 클램프/NaN 견고 — 별도 수정 불필요** (`determineCareer` talent>=85 게이트, `examSystem.ts:31` clamp, scaleIntimacyChange 양수 보장).
**importance5+ 이벤트 회상이 엔딩에 실제 노출 — 회상 선정 로직 정상** (프로브: imp5+ 슬롯 6~7개 중 5개 노출).
**memorySlots 분포 건전(5~7개, 카테고리당 2캡 정상)** — 0건 없음. 미니토크 합산 후 재측정 권장.
**시험 멘탈델타·부모친밀도 연동 중복 없음(클린)** — `gameEngine.ts:826-855` 단일 진입점, strict 어드밴티지는 parentPraiseYears 연1회 가드.
**「track 미선택 디폴트」는 시뮬 dump 아티팩트** — 실제론 Y6W1에서 track 항상 선택됨(직접 재현: academic-max=humanities, last-choice=science). QA 결과 키에 track 추가 권장.

---

## FUN

### major

**[신뢰도 높음 · 다수 QA] 선택 무력감 — 방치형(항상 첫 선택)이 의도적 공부몰빵보다 좋은 엔딩**
- 심각도: major
- 근거: neglect-first(policy=first) 수능g2/인서울상위권/S/S(qa-all L1508-1521). academic-max(공부몰빵) 수능g4/수도권/A(L14-27). 첫선택만 누른 쪽이 모든 축에서 이김. 진짜 레버는 health/fatigue(루틴·방학 휴식 배합)인데 시뮬에선 페르소나 고정. 이벤트 선택 effect 대부분 +1~+3(196건 +1, 187건 +2, 100건 +3)이라 336주 누적에 묻힘.
- 제안: 분기점 이벤트(시험 직전 휴식 vs 벼락치기, 진로)를 fatigue/track을 크게 흔드는 큰 선택으로 격상해 "그때 그 선택" 흔적이 결과에 남게.

**[신뢰도 높음 · 다수 QA] 방학 주 56%가 스크립트 이벤트 0 — 가장 긴 조용한 구간**
- 심각도: major
- 근거: 방학 85주 중 48주(56%) 빈 주 vs 학기 253주 중 31주(12%). 학교생활 17개 풀 전부 `!s.isVacation`(`school-life.ts:21,49,60,71,...`). 방학엔 vacationActivityCounts만 돌고 서사 사건 비어 있음.
- 제안: 방학 한정 가벼운 이벤트(여행/특강/알바/가족) 소수 추가, 또는 방학엔 말걸기/부모 pressure 빨리 차오르게. 의도된 휴식이면 유지.

**[신뢰도 높음] 학교생활 랜덤 풀 17개가 연령 무관 — 고3이 초6과 같은 깜짝퀴즈/지우개/청소당번**
- 심각도: major
- 근거: `school-life.ts` 17개 중 year 게이트는 study-cafe(year>=2) 하나. 나머지는 !isVacation·stat 임계만. 70% 게이트(`selection.ts:154`), 쿨다운 6주(`:152`)뿐이라 7년 재탕.
- 제안: 초/중/고 단계별 톤 분기(고등=진로/야자/수시, 초등=유치한 사건). 70% 필러 풀 정체가 체감 단조로움의 본체.

**[신뢰도 높음 · 다수 QA] 보상 루프가 Y1에 집중 — 도달형(reach) 11개 전부 Y1 + tier90 코어 절반 도달 불가 → 중반(Y2~Y4) 보상 공백**
- 심각도: major
- 근거: reach 11개 전부 `s.year===1`(grep: 11회, 타 학년 0). yuna/subin/doyun/minjae의 30→50→70→90 친밀도 CG 아크가 초6 집약. 내신 avg는 중반 정점(balanced Y3~4 avg 93~97/rank2~3)인데 관계·기억 보상 비어 있음. tier90 코어 6개 중 haeun/junha/doyun 3개 도달 불가.
- 제안: 보상 타입을 학년에 고루 분산(중·고 시점 도달 아크 신설). 한정 NPC tier90 문턱 70 완화. jihun(최고 친밀도지만 reach 아크 0개)에 중·고 도달 아크 신설.

**[신뢰도 높음] 공부몰빵 climax가 음(-)으로 뒤집힘 — 7년 투자한 academic-max가 마지막 학년에 rank 추락**
- 심각도: major
- 근거: academic-max 내신 trajectory 초중반 rank11~13/avg60~66 → 후반 rank15~16/avg49~53. 소프트캡(93→86.5)+고피로 fatigueBonus -10+health12. 모의 3,3,3,4,3,4 정체. "제일 열심히 한 캐릭이 수능 직전 학년에 성적 하락" = 반보상.
- 제안: 막판 하락을 사전 인지·회복할 수 있는 피드백(피로 경고 가시화, 회복 선택지 명확한 보상)으로 climax가 우상향 곡선으로 끝나게.

### minor

**중반 학년(Y3~Y5) 빈 주 비율이 후반보다 높게 튀는 구간** — academic-max Y3 29%/Y5 33%, social-max Y4 35%, last-choice Y6 38%. Y1은 15~27%. 중3~고2 타깃 이벤트(첫 모의고사 충격, 친구관계 재편, 진로 고민) 보강.

**last-choice 이벤트 체인 덜 이어져 총 이벤트 적음** — Y4 ev=36/Y6 ev=33(타 페르소나 47~59). followup 진입 조건 완화 검토.

**최적/방치 결과 차이 한 단계뿐 — 노력 보상 구배가 얕거나 역전** — (선택 무력감과 동류) 노력↔결과 구배 또렷이.

### idea

**시뮬 미니토크 0회 발동 — tier90 보람 루프 전체 미측정**(아티팩트). 말걸기 발동 정책 추가 또는 결정론 친밀도 테스트.

---

## DIRECTION

### major

**[신뢰도 높음 · 5+ QA] track(문이과) 분기는 정상 작동 — SKY/의대 미노출의 진짜 병목은 "수능 1등급 도달 불가"**
- 심각도: major
- 근거: 진로 분포 인서울상위권5/수도권4/예체능1/지방국립이공계1/인서울문과1. suneungMockGrade 2~6(최고2). `ending.ts:67-68`(SKY경영 mockGrade≤1)·`:79-80`(의대 ≤1) 전제 grade1을 sim 정책이 못 만듦. ea 소프트캡(acad93→ea86.5)+내신20% 가중이 천장. last-choice가 science 루트(지방국립이공계)로 떨어진 게 track 정상 작동 증거. ("track 미선택 디폴트"는 dump 아티팩트 — 실제 Y6W1 강제 선택)
- 제안: 1등급 컷을 academic+mental+저fatigue 빌드로 도달 가능한지 결정론 A/B 검증, 또는 SKY/의대 게이트를 "grade2 + academic 매우 높음"으로 한 단 완화. 강제 답 아님.

**[신뢰도 높음 · 다수 QA] 이과(science) 상위 진로 5종(의대/SKY공대/인서울공대/인서울이과/수도권이공계) 무노출**
- 심각도: major
- 근거: track-select(`school.ts:400-412`) 문과 effects{social:2}/이과{talent:2}. 학업형 정책이 모두 index0(문과) 수렴 → 고학력=전원 humanities. 이과는 last-choice(grade6)와 talent-max(특기자 override)뿐.
- 제안: 이과 고학력 조합을 페르소나 1~2개에 강제해 분기 검증. talent>=90이 track 무관 특기자로 덮어쓰는 점도 의도 확인. (시뮬 선택정책 아티팩트 측면 있음)

**[신뢰도 높음 · 다수 QA] 실패·하강 엔딩(재수/쉼표/전문대) 게이트 과엄격으로 미발동**
- 심각도: major
- 근거: 재수 burnoutCount≥4&&mental<30(`ending.ts:46`), 잠시쉼표 mental<15(`:49`), 전문대 mockGrade≥7(`:54`). 데이터: burnout 전원0, 최저 mental 63, 최저 수능 6등급. 셋 다 0회.
- 제안: 번아웃 0 수렴은 아티팩트 가능성 — 게이트 결함 단정 금지. mockGrade≥7 컷·mental 임계가 현 밸런스(min mental 63)에서 닿는 값인지 재점검.

**[신뢰도 높음] bestAxis 전원 84.9~95.4 수렴 + happiness 11/12 S — 성취·행복 등급이 전략 신호 못 줌**
- 심각도: major (balance 섹션 엔딩 수렴과 교차 확인, dir 렌즈에서 독립 도출)
- 근거: bestAxis 전원 ~90(`ending.ts:120`). S/A 차이는 weakness 페널티(health 10~16=A/78~82=S)로만 갈림. 337주 동안 무료활동+catchupBonus(`activities.ts:241`, `gameEngine.ts:257-261`)로 비주력 스탯도 90 근처. 4개 페르소나(balanced/mental/health/neglect)가 동일 「완벽한 청춘」, 고유 타이틀 12명 중 6종.
- 제안: 한 축 극대화 vs 균형의 trade-off가 실제 페널티로 체감되는지 점검. 약점 특화 빌드에 고유 보상/엔딩 부여.

**[신뢰도 높음] 실질 전략 분기 3개(특기자/입시실패/그외)뿐**
- 심각도: major
- 근거: talent-max(특기자)·last-choice(지방이공계)만 군집 이탈, 나머지 10명 인서울상위권/수도권/문과 미세분기. talent>=85 2명, >=90 1명.
- 제안: track 활성화로 상위 루트 개방 + 특기자 임계 도달성 확대 + 균형형 지배전략 완화 중 1개 이상.

### minor

**번아웃 0/12 — '갈아넣기' 리스크 빌드 미작동** — (balance/fun과 교차) 결정론 A/B로 번아웃 도달 가능성 분리 측정.

**track 강제 2지선다라 "미선택 디폴트"는 정상 완주 플레이에서 발생 불가** — `school.ts:393-413` 보류/스킵 없음, condition year===6&&track===null. SKY/의대 미노출을 track 문제로 진단하면 오진. (qa JSON에 track 키 없어 "None"으로 보인 건 측정 아티팩트)

### idea

**track 미선택 fallback은 방어코드로만 존재** — 정상 플레이 도달 불가. 스킵 의도 없으면 fallback 정리.

---

## NARRATIVE

### major

**[신뢰도 높음 · 다수 QA] 엔딩 회상이 페르소나/정책 무관 거의 동일 — 최상위 회상이 강제 연례/졸업 이벤트에 고정**
- 심각도: major
- 근거: 프로브 5개 정책 중 4개 highlights 상위 2줄 동일: 'y7 고3 졸업…거울 앞 낯선 얼굴'(graduation-prep-high, imp8) + 'y1 초등 졸업앨범 롤링페이퍼'(graduation-prep-elementary, imp7). imp5+ 풀도 graduation-prep/school-trip-high/doyun-school-split가 거의 공통. 플레이 선택이 회상에 잘 반영 안 됨.
- 제안: graduation-prep류 importance 6~7로 낮추거나, selectMemorialHighlights에서 "플레이어 선택 기인 슬롯"에 가중. (정책 다양성 부족은 미니토크 미발동+결정론 선택 아티팩트일 수 있으나 imp8 졸업 슬롯 점유는 실플레이도 동일 가능)

**[신뢰도 높음] '돌아보면' 회상문이 비연대순 — 바로 아래 '7년의 마디'(연대순)와 시간감각 충돌**
- 심각도: major
- 근거: `memorySystem.ts:201-269` selectMemorialHighlights는 선정 순서(우선카테고리→phase쿼터→importance) 그대로 반환, 연도 정렬 안 함. `ending.ts:167-169` yearClosings는 `.sort((a,b)=>a.year-b.year)`. `EndingScreen.tsx:87-91`은 받은 순서대로 렌더 → Y7 growth가 Y1 discovery 위에 뜨는 역순/뒤섞임, 아래 '7년의 마디'(`:96-102`)는 Y1→Y7.
- 제안: 선정 로직 유지하되 최종 출력만 year(필요시 week) 오름차순 재정렬. 강도순 의도면 카피/레이아웃으로 "시간순 아님" 명확히.

**[신뢰도 높음] bypass / unspoken_debt 카테고리가 회상 선정·milestone에서 전면 누락 — wealth 부모 시그니처 기억이 죽은 코드 취급**
- 심각도: major
- 근거: `types.ts:234-235` 정의 + 콘텐츠 실재(bypass 2개, unspoken_debt 3개; `reach.ts:255` importance5, `talkData.ts:352/363/534`). 그러나 `memorySystem.ts` PARENT_MEMORY_BIAS(18-25)·countPositive(284)·countNegative(283)·milestone requires 어디에도 미참조. 주석(15-17)은 'wealth는 betrayal/failure로 매핑'이라 코드-콘텐츠 불일치. wealth 부모 4페르소나의 '돈으로 건너뛴 거리감' 정서가 bias 0/anchor 0.
- 제안: (a) PARENT_MEMORY_BIAS wealth에 추가, (b) countNegative/별도 그룹 포함, (c) milestone requires에 패턴 추가 — 또는 콘텐츠를 betrayal/failure로 환원. 코드-콘텐츠 일치.

**[신뢰도 높음 · 다수 QA] '연애루트'는 실제 분기가 아니라 성별 톤 리스킨 — femaleChoices가 진로/엔딩/연인 플래그를 안 만듦**
- 심각도: major
- 근거: femaleChoices는 NPC 이벤트(jihun/minjae/doyun)+school.ts:471/birthday/crisis에만, 내용은 남주 버전 톤 변형(농구→떡볶이, 같은 NPC·스탯·intimacyChange). resolvedFemale는 `store.ts:268` 히스토리에만 기록, `ending.ts`에서 안 읽힘(grep 0). romance/연인 분기 없음. social-female-romance vs social-max 결과 사실상 동일(acad92/91, jihun100·minjae93/94 평행).
- 제안: 연애를 진짜 분기로 만들 의도면 (NPC 고정 호감 누적→고백→연인 플래그→엔딩 에필로그) 최소 1축 필요. 담백한 톤 차이 의도면 라벨에서 '연애루트' 제거해 기대치 mismatch 축소. social 만점 수렴이 "특정 상대 선택"을 구조적으로 막는 점도 연동.

**[신뢰도 높음] health 붕괴(5~16)인데 진로 detail은 전부 밝은 톤 — 텍스트가 스탯 현실을 부정**
- 심각도: major
- 근거: 12판 중 8판 final health<20. achievement은 weakness/collapse로 강등되나 determineCareer detail(`ending.ts:73` '이제 본격적인 시작이다', `:38` '명문 예술대학·체대에 진학했다')은 health 미참조 → 모두 무탈한 청춘. 등급은 떨어졌는데 문장 멀쩡.
- 제안: determineCareer/calculateEnding 말미에 health<20 등 붕괴 시 톤 보정 한 줄(예: '대학은 붙었지만 몸은 이미 한계였다') 분기. 등급 강등과 텍스트 동기화 여부 의도 확인.

**[신뢰도 높음] social 스탯 만점인데 NPC 친밀도 50대 → 엔딩 회상 '가끔 생각나는 사이'로 미지근**
- 심각도: major
- 근거: academic-max social스탯97/maxIntimacy57 → `getTopNpcStories(ending.ts:103-105)` '가끔 생각나는 사이'. last-choice social69/maxIntimacy20이라 ≥50 필터(`:97`)로 npcStories=[] 빈 배열인데 happiness S '곁에 사람도 많았다'(`:20`) 출력. social스탯·intimacy·happiness 3개 신호 충돌.
- 제안: happiness가 social스탯만(`:11-16`), NPC회상은 intimacy만 보는 디커플링을 한쪽 톤으로 정렬. (social 만점은 아티팩트 의심 — 실플레이 분포 확인)

**[신뢰도 높음] 시뮬 talkEventsFired=0 — 잡담/말걸기 레이어가 측정에서 통째로 빠져 페이싱·회상 결론 신뢰도 제약**
- 심각도: major (측정 한계)
- 근거: 12 페르소나 전원 0. 말걸기/잡담은 `store.ts talkToNpc/talkToHome(:361,408)` player 클릭으로만, sim 하니스(`:84-96`)는 미호출. eventsResolved(~1.0~1.1/주)는 스크립트 이벤트만 집계. 1700여 줄 잡담·미니이벤트 풀 전체가 사각지대.
- 제안: 페이싱 결론을 eventsResolved 단일지표로 내지 말 것. 하니스에 talkToNpc/talkToHome 주입 또는 "빈 주 잡담 충전율" 별도 계측. `verify-parent-smalltalk-school.ts` 선례 활용한 경량 톤 회귀 verify 권장.

### minor

**recallText 길이 가이드(20~35자) 위반 3개** — `types.ts:248` 규정, `doyun.ts:272` ~45자(academic-max 엔딩에 실노출). lintRecallText에 길이 규칙 추가, in-game 줄바꿈 확인.

**카테고리당 2개 상한이 풍부한 경험 과도하게 깎음(discovery 28종→최대 2)** — `memorySystem.ts:113-128`. 회상 5칸이 "카테고리 5종 각1등"으로 균질화. 동률 깰 때 year 분산 강화 또는 phaseTag 다르면 둘 다 살리기.

**doyun 친밀 tier가 elementary만 존재 — 중·고 진학 후 base로 회귀** — `talkData.ts:1487-1565` doyun warm/close/deep 모두 elementary 셀만. `talkSystem.ts:47` level middle/high면 빈 배열. deep.elementary:1552 "곧 다른 중학교 가면…" 대사로 초등 졸별 의도 시사 → yearMax 게이트/주석으로 명시 권장.

**milestone NPC 고정 참조 + 부모 톤 append 임계 민감** — `memorySystem.ts:321-336` Y3 minjae 고정(폴백 있어 안전). 부모 톤(`:462-467` pi<30/pi>=70)이 임계 1점차(29 vs 31)로 정반대 문장. 중간대 중립 한 줄 또는 hysteresis.

**특수조합 4종 중 3종(고독한 승리자/불꽃/행복한 평범함) 12판 전부 미발동** — '완벽한 청춘'만 발동. hap=D는 mental<25(최저63), ach=C는 bestAxis<게이트(전원≥85), 불꽃은 burnout≥3(전원0). mental 고수렴·burnout 0 아티팩트 의심 — 결정론 A/B 확인.

**minjae/doyun 친밀도 20~23 정체 — deep(80+) 콘텐츠 도달 불가 구간** — close/deep 잡담이 특정 플레이스타일만 노출. minjae 70 phone_call·90 unmasked 시드 사장 여부 기획 판단.

### idea

**고3 입시 시점 분기(seniorEarly/Rush/After) 정상 작동 — 시점 모순 방지 양호** (`talkSystem.ts:63` early≤27/rush28~35/after≥36, 수능35주 경계 정합). rush 상한 35(수능 당일)~36 전환 어색함만 in-game 확인.
**tier 톤 상승 곡선(warm→close→deep)이 NPC 고유색 유지하며 일관** — minjae '효율', junha 사투리/부산, subin '조용함/엄마 둘이 사는 집'. 유지 권장.
**talent-max hap=S인데 특기자 detail이 성취만 언급** — 특기자/일반 진로가 특수조합보다 우선 return. 의도면 OK, hap=S 수식 한 줄 여지.
**SKY/의대 텍스트 미노출 원인은 track 아니라 mock 천장(최고2)** — 재귀인.

---

## 시뮬 아티팩트로 보여 제외/유보한 것

- **track 전 페르소나 None** — qa-all.json에 track 키를 안 찍은 dump 아티팩트. 실제 sim/플레이 모두 Y6W1에서 강제 선택됨(재현: academic-max=humanities, last-choice=science). "track 미선택이 SKY/의대 봉인 원인"은 오진 — 진짜 병목은 수능 1등급 도달 불가.
- **talkEventsFired=0 / 미니토크·잡담 0회 발동** — 하니스가 talkToNpc를 호출하지 않는 측정 한계. tier90 회상·미니토크 메모리·smalltalk 선택지 영향은 이 데이터로 검증 불가(게임 버그 아님).
- **social 스탯 95~98 만점 수렴 / mental 90+ 수렴** — 자동선택 편향 의심(기존 club 테스트 아티팩트 메모리와 동류). 단, social 수렴의 상당부분은 "이벤트 효과가 감쇠 우회"라는 실코드 구조에서도 옴 → 순수 아티팩트로만 치부하지 말 것.
- **체력 10/80 완전 이분화(중간 0)** — 페르소나가 7년 내내 동일 routineSlot 사용(`sim-qa-playthrough.ts:142-153`). 실플레이는 혼합 가능 → 중위권 평형 존재 여부 결정론 A/B 권장.
- **번아웃 0/12** — 자동선택이 회복활동을 섞었을 가능성 + tired 자기치유 루프(실코드 문제). 둘 분리 위해 "공부만 강제" 결정론 케이스 재측정 필요.
- **totalWeeksPlayed 336~340 산포** — 하니스가 W48 후 week=49를 한 번 더 처리하는 잉여 1주 오염. 다른 QA 수치(이벤트·스탯)도 미세 오염.

> 주의: 도달형 이벤트 학년 게이트(year===N)는 의도된 설계이므로 "한 판에 다 못 봄"은 버그 아님. reach 11개 Y1 집중은 게이트 제거가 아니라 분포 재배치 문제로 접근.