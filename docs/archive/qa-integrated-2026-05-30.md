# LIFE TRACK — 최종 통합 QA 리포트

**감사일:** 2026-05-30  
**대상:** LIFE TRACK (7년 성장 시뮬, Vite + React + Zustand)  
**방법:** 5개 전문 QA 팀(밸런스·버그·재미·UI/UX·콘텐츠/CI) 병렬 조사 + 핵심 P0 코드 재검증  
**벤치마크:** 설계 문서 v4.3, `verify:content` 18종, M5 플레이스루 체크리스트

---

## Executive Summary

| 영역 | 등급 | 한 줄 평가 |
|------|------|-----------|
| **엔진·데이터 정합성** | B+ | verify 83%, 7년 시뮬 크래시 없음, followup/orphan 양호 |
| **밸런스·경제** | C | Social 98+ 수렴, 돈 과잉, tired 데드존, “편한 빌드 0 burnout” vs 그라인드 33% tired |
| **버그·안정성** | C- | **학년말 이벤트 증발(P0)**, 새로고침 주 스킵, 이벤트 주차 off-by-one |
| **재미·내러티브** | B- | 이벤트 142+, 미니톡 30/50/70 강함 / **tier90·후회·앨범·Y2+ reach 공백** |
| **UI/UX** | B- | 결산·용돈 HUD 좋음 / 모바일 밀도, BM 불일치, a11y 미흡 |
| **콘텐츠·출시** | C | Y1 CG 양호, **Y2~Y7 CG ~0%**, CI quality gate 없음 |

### 출시 준비도

| 범위 | 점수 | 근거 |
|------|------|------|
| **Y1 데모 / 슬라이스** | **6.5 / 10** | 초등 CG 15종, 미니톡 3티어, 엔진 안정 |
| **7년 풀 출시** | **5.0 / 10** | CG·tier90·경제·번아웃·P0 버그·CI 미연동 |

**총평:** “인생을 설계하는 게임”이라는 철학을 받칠 **엔진·이벤트 골격은 충분**합니다. 다만 **마지막 주 이벤트 증발**, **Social/돈 메타 붕괴**, **후반 서사·비주얼 공백**이 EA 전에 반드시 손봐야 할 리스크입니다.

---

## P0 — 출시 전 필수 (8건)

### 1. 학년말/졸업 주 이벤트 증발 (Critical Bug)

**증상:** Y1~Y6 W48(및 Y7 W48)에 RNG로 이벤트가 선정되어도, `week++` 직후 `phase`가 `year-end`/`ending`으로 덮여 UI에 노출되지 않음. 선택·효과·memorySlot 영구 손실.

**메커니즘:** `game/src/engine/gameEngine.ts` — 이벤트 선정 시 `phase = 'event'` 설정 후, `week > 48`이면 `phase = 'year-end'`(또는 `ending`)로 덮어씀. `GameScreen.tsx`는 `year-end` 분기가 `event`보다 먼저 → `YearEndScreen`만 표시.

**수정 방향:** year-end 전환 전 pending event resolve, 또는 `currentEvent` 있으면 `phase='event'` 유지.

---

### 2. Social(인기) ~98+ 무조건 수렴

- 7년 시뮬: 학업형/특기형/사교형 모두 Social **98.4~98.5**
- v7.2 decay -0.8 강화에도 club(+1), hang-out(+2), academy 부수효과로 상쇄
- 설계 목표(외톨이 위기 <25) **미달**

**수정:** decay 추가 강화, club/social 부수효과 하향, 70+ 구간 추가 decay.  
**파일:** `game/src/engine/gameEngine.ts` (330–337), `game/src/engine/activities.ts`

---

### 3. 돈 과잉·싱크 부족

- 7년 후 잔고: none 전략 **~1405만**, wealth 부모 **+650만** vs control
- M4 돈 싱크 풀 전체 **~-70만** 수준 → 저축의 ~10%
- M5 기준 7년 후 **≤500만** → **FAIL** (실측 ~786만)

**수정:** recurring living cost, wealth 용돈 조정, 상점/이벤트 싱크 확대.  
**파일:** `parentModifiers.ts`, `shopSystem.ts`, money-sink events

---

### 4. Tired 데드존 (fatigue=0인데 영구 tired)

- 탈출: `mental >= 45 && fatigue < 50` (`gameEngine.ts` 487–489)
- tired 주당 mental +2, fatigue -5
- strict+학원 그라인드 시 fatigue=0, mental=40대에서 **19주 연속 tired** (`test-y1-mental.ts`)

**수정:** threshold 완화(40/30), 또는 fatigue=0 시 catch-up bonus.

---

### 5. 새로고침 시 주간 이중 진행

- `showResult`는 React 로컬 state → F5 후 리셋
- `weekLog`는 store에 남아 있으나 `advanceWeek` 가드 없음 → **한 주 건너뜀**

**수정:** `phase: 'result'` store persist 또는 `weekLog` 소비 플래그.  
**파일:** `GameScreen.tsx`, `store.ts`

---

### 6. tier90 미니 이벤트 6종 전무

- `talkData.ts`에 `intimacyMin: 90` **0건**
- backlog Phase 2.4 최우선 — NPC 친밀 90 곡선 끊김, 회상 importance 5 슬롯 공백

**참고:** `docs/backlog-2026-05-29.md` Phase 2.4

---

### 7. CI quality gate 없음

- `deploy.yml`: build만, `verify:content`·`lint` **미연동**
- verify **15/18** 통과, lint **73 error**
- 회귀가 main까지 merge 가능

---

### 8. Y2~Y7 CG 사실상 없음

- `cg-manifest`: **85 PNG**, 전부 `elementary/`
- 실발동 학년대 CG 매칭 **~23%**, 미매칭 이벤트 **96개**
- 7년 플레이 대부분 **텍스트-only**

---

## P1 — 단기 (12건)

| # | 영역 | 이슈 |
|---|------|------|
| 1 | 밸런스 | 7년 Academic **93~95** (설계 목표 ~88 초과) |
| 2 | 밸런스 | Greedy 상점 → mental **+21%** (사실상 필수 메타) |
| 3 | 밸런스 | Health 비운동 빌드 **floor 10** 고정 |
| 4 | 밸런스 | study-group > self-study (무료·고효율) |
| 5 | 밸런스 | `sim-parent-balance.ts` year-end 미처리 → 부모 매트릭스 출력 **무효** |
| 6 | 버그 | 이벤트 기록 `week` off-by-one (발생 주+1) |
| 7 | 버그 | EventScene `visibleChoices === 0` → soft-lock |
| 8 | 버그 | mini talk 풀 내 항상 `[0]`만 선택 (`store.ts`) |
| 9 | 버그 | year-end `week=49` 비정상 (getMonthLabel undefined) |
| 10 | 재미 | Y2~ reach 이벤트 공백 (`reach.ts` Y1만 11종) |
| 11 | 재미 | 행복 지수 = mental+social 단순화 (관계·딜레마 미반영) |
| 12 | UX | 상점 growth/consumable 스탯·버프 ↔ 09_BM “Pay to Experience” 불일치 |

---

## P2 — 중기 (8건)

- ESLint 73 error, 번들 633KB
- `verify-followup-chain` stale (social 30/40 vs 코드 40/50) — **로직은 정상**
- patch-batch3 info/freedom 부모 밸런스 3 fail
- M5: middle-burnout 0/5, junha 생일 정성선물만 보유
- 평일/주말 UI 통합 (설계 “평일 자동→주말” 리듬 없음)
- 방학 목표·NPC decay 미구현
- 피로 라벨 HUD vs 결산 불일치 (`getFatigueDisplay` vs `getFatigueLabel`)
- 접근성: dialog/focus/44px 타겟 거의 없음

---

## 팀별 상세 요약

### Team 1–5: 밸런스·경제

**잘 된 것**

- 85+ diminishing returns, 95+ maintenance (-0.40/주)
- 학년별 academic decay escalation
- 주당 스탯 cap +2, 동일축 중복 감소
- burnout 쿨다운 8주, health 장기 투자 보상

**깨진 메타**

| 메타 | 결과 |
|------|------|
| 클럽 루틴 | Social 98+ regardless of build |
| emotional+wealth+light-exercise | Burnout 0, Academic 93+ |
| Greedy shop | mental 96, 잔고 유지 |
| Y1 idle only | mental 0, social 5 |

**참고 스크립트:** `test-7year-balance.ts`, `test-7year-academic.ts`, `diagnose-shop-fatigue.ts`, `analyze-tired-distribution.ts`, `sim-parent-balance.ts` (year-end 버그 주의)

---

### Team 6–12: 버그·엣지케이스

**확인 버그:** 학년말 이벤트 증발, 새로고침 이중 advance, week off-by-one

**유력:** EventScene soft-lock, talk `[0]` 고정, RNG 잡담 클릭 오염, SAVE_VERSION 불일치 시 세이브 거부

**안전:** advanceWeek phase 가드, followup cap, hard crisis 연간 1회, save subscribe, resolveEvent sentinel -1

**verify 공백:** W48+event+year-end, F5 시뮬, visibleChoices=0 — 전 스크립트가 `currentEvent=null` 스킵으로 P0 놓침

---

### Team 13–18: 재미·내러티브

**강점**

- 메인 이벤트 ~142, NPC followup chain
- 미니톡 pressure + tier 30/50/70 + 잡담 계층
- crisis HARD/SOFT, memory→엔딩, WeeklyResult Hero

**약점 — “한 주 더” ★★★☆☆ (3.5/5)**

- tier90·후회카드·인생앨범·12종 엔딩 미완
- Y3~Y5 서사 밀도 하락 (reach Y1 소진)
- mid-game “숫자 내기” 수렴 위험

**ROI 최대:** tier90 6종 → 후회/회상 레이어 → Y2+ reach 보강

---

### Team 19–24: UI/UX·접근성

**09_BM_UX 정렬**

| 원칙 | 상태 |
|------|------|
| 누적 비용·입금 시점 | ◎ |
| 상점 단일 진입 | ◎ |
| Pay to Win 금지 | ✗ |
| 점진적 정보 공개 (Y1 3스탯) | ✗ |
| 관계 맵 | ✗ |
| 접근성 옵션 | ✗ |

**Quick wins:** 피로 라벨 SSOT, confirm 모달, 모바일 플래너 세로 스택, 튜토리얼 주말 waitFor

**대공사:** 탭형 메인 [평일|주말|관계], BM 재정렬, a11y 설정 패널

---

### Team 25–30: 콘텐츠·CI

| 검증 | 결과 |
|------|------|
| verify:content | **15/18** (83%) |
| scripts/test 6종 | 전부 pass |
| build | pass |
| lint | 73 error |
| CG orphan | 없음 |
| followup orphan | 없음 |

**verify FAIL 3건:** event-cg-coverage, followup-chain(stale), patch-batch3

**M5 자동:** PASS 12, FAIL 1 (7년 잔고), PARTIAL 2, MANUAL 8

---

## 설계 문서 vs 구현 Gap

| 항목 | 설계 | 구현 | Gap |
|------|------|------|-----|
| 평일/주말 분리 | 블록+연출 | 일괄 확정 | 중 |
| 미니톡 30/50/70/90 | 4×6 NPC | 90 ❌ | **高** |
| 엔딩 12종+후회+앨범 | 풀 | 진로문자열 중심 | **高** |
| 7년 CG | 전 학년 | elementary만 | **高** |
| 크라이시스 | HARD/SOFT | 구현됨 | 低 |
| 주간 Hero·마일스톤 | v8.1 | ✅ | 低 |
| 방학 특수 | 목표·decay | 슬롯만 | 高 |

---

## 수정 로드맵 (권장 순서)

### Sprint 0 — 출시 블로커 (1~2주)

1. 학년말 pending event 처리 + verify 추가
2. 새로고침 이중 advance (`phase: 'result'`)
3. CI: `verify:content` + lint gate
4. Social decay 재설계 + 7년 sim 재검증
5. Tired 탈출 조건 수정

### Sprint 1 — 밸런스·경제 (2주)

6. 돈 싱크 / living cost
7. Greedy shop nerf, dead shop items
8. Academic ceiling 하향
9. `sim-parent-balance` year-end fix

### Sprint 2 — 콘텐츠·감정 (3~4주)

10. **tier90 미니 6종** (backlog P0)
11. 후회 카드 스텁 + 엔딩 연동
12. Y2+ reach 1~2/학년
13. W48 이벤트 week off-by-one

### Sprint 3 — UX·비주얼 (병행)

14. 모바일 플래너, confirm 모달, 피로 라벨
15. Y2~Y7 CG 로드맵 (수학여행·졸업·크라이시스 우선)
16. 상점 BM vs 09_BM 정합

---

## Pre-Launch 체크리스트

### Must

- [ ] P0 버그 8건 중 1~5 해결
- [ ] tier90 6종 + verify-tier90
- [ ] CI verify:content + lint
- [ ] M5 수동 8항 (저장/로드, YEAR-END UI 등) 1회 풀플레이

### Should

- [ ] 7년 잔고 ≤300만 목표
- [ ] middle-burnout 발동률 점검
- [ ] verify-followup social 40/50 수정
- [ ] ESLint `src/` 우선 정리

### Could

- [ ] 번들 code-split
- [ ] npm audit
- [ ] E2E Playwright 스켈레톤

---

## 결론

LIFE TRACK은 **“프린세스 메이커식 주간 루프 + 한국형 학생 리듬”**이 코드와 콘텐츠로 실제 구현된 **기술적으로 성숙한 프로토타입**입니다.

**QA 출시 판정**

- **내부 플레이테스트 / Y1 데모:** 진행 가능 (조건부 GO)
- **Steam EA 7년 풀:** **NO-GO** — P0 버그·밸런스·CG·tier90·CI 해결 후 재평가

---

## 관련 문서

- `docs/backlog-2026-05-29.md` — Phase 2.4 tier90 등 다음 작업
- `docs/m5-playthrough-checklist.md` — 수동 QA
- `09_BM_UX.md` — UX/BM SSOT
- `game/package.json` — `verify:content` 스크립트 목록
