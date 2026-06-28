# LIFE TRACK 코드 리뷰 — 전수조사 (리팩토링·버그픽스 후)

> **감사 시점:** 리팩토링·버그픽스 완료 후 재검수  
> **이전 대비:** 6/9 1차 재감사 → 저장/로드 P0·lint·CI·엔진 내부 구조 대부분 개선. **verify:content는 여전히 RED** (CG 커버리지 + patch-batch 3종).

---

## Executive Summary

| 영역 | 6/9 재감사 | **현재 (전수조사)** |
|------|-----------|---------------------|
| 저장/로드 P0 (3건) | OPEN | **✅ FIXED** (`stateMigration.ts`) |
| EventScene soft-lock | OPEN | **✅ FIXED** |
| events baseline | FAIL | **✅ PASS** (171개) |
| `npm run lint` | 91 error | **✅ PASS** (`--max-warnings 0`) |
| `npm run build` | pass | **✅ PASS** (753KB) |
| CI | build만 | **⚠️ lint+build** (PR 포함), verify 미연동 |
| `verify:content` (18종) | FAIL@baseline | **❌ FAIL@CG** (3번째 스크립트에서 중단) |
| M4 돈 싱크 | OPEN | **✅ PASS** (61 passed) |
| CG 자산 | 139 PNG | **139 PNG** (97 elem + 42 middle, **high 0**) |
| 엔진 모듈 분리 | OPEN | **⚠️ 부분** (in-file helper, 별도 파일 없음) |
| NPC mini talk RNG | OPEN | **❌ OPEN** (`available[0]`) |

**출시 준비도 (추정):** Y1 데모 **~8/10** · 7년 풀 **~6/10** (CG·verify chain·high tier 잔여)

---

## ✅ FIXED — 이번 전수조사에서 확인

### P0 버그 · 저장/로드

[`stateMigration.ts`](../game/src/engine/stateMigration.ts) 3건 모두 수정됨:

| 이슈 | 수정 |
|------|------|
| SCHOOL_LIFE 재수화 | L62-63: `GAME_EVENTS` → `SCHOOL_LIFE_EVENTS` fallback |
| `currentEvent.week` | L67: `cur.week ?? result.week` (발생주 보존) |
| phase soft-lock | L68-72: catalog miss → `phase = weekLog ? 'result' : 'weekday'` |

### P0 · UI soft-lock

[`EventScene.tsx`](../game/src/components/EventScene.tsx):
- L285-289, L644-665: `visibleChoices.length === 0` 또는 전원 비용 부족 → **「지나친다」** fallback
- [`store.ts`](../game/src/engine/store.ts) L288-294: sentinel `-1` choice로 강제 종료 가능

### P0 · 런타임 (이전부터 유지)

- 학년말 이벤트 deferral — `verify-year-end-event`: **24/24 pass**
- 새로고침 주 스킵 — `phase: 'result'` 영속
- `resolveEvent` occurrenceWeek — off-by-one 런타임 수정

### 개발 체계

- **Lint:** `eslint . --max-warnings 0` → **0 error**
- **CI:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — PR+main에 **lint + build** 게이트 추가
- **Baseline:** `verify-events-split` — **171 GAME_EVENTS** order 일치

### 엔진 · store 리팩토링 (부분)

[`gameEngine.ts`](../game/src/engine/gameEngine.ts) **974줄** — `processWeek`를 in-file helper로 분해:

| Helper | 역할 |
|--------|------|
| `prepareWeekContext` | 학기/방학/pressure 롤 |
| `applyRoutineActivities` | 평일 루틴 |
| `applyWeekendActivities` | 주말/방학 |
| `applyExamForWeek` | 시험 |
| `selectEventForWeek` | 이벤트 선정 |
| `advanceWeekCounter` | week++ / year transition |

[`store.ts`](../game/src/engine/store.ts) **550줄** — `resolveEvent` helper 추출:

- `applyChoiceOutcome`, `recordResolvedEvent`, `resolveEventChain` (L107-216)
- `resolveEvent` 본체 L282-328
- `scaleStatChange` on choice effects

**아직 별도 파일 없음:** `weekProcessor.ts`, `statEffects.ts` — 계획 대비 **in-file 분리만 완료**.

### verify (standalone pass)

| Script | Result |
|--------|--------|
| verify-events-split | ✅ |
| verify-event-fixes | 33/33 |
| verify-crisis-events | 65/65 |
| verify-followup-chain | 20/20 |
| verify-phase22-events | 93/93 |
| verify-tier50/70/90 | 70 / 93 / 114 |
| verify-ending-branches | 30/30 |
| verify-m2-state | 25/25 |
| verify-m3-memory | 51/51 |
| **verify-m4-money** | **61/61** ← 이전 OPEN 해소 |
| verify-m6-recovery | 17/17 |
| verify-year-end-event | 24/24 |
| verify-parent-phase2a | 197/197 |
| verify-parent-adolescence | 25/25 |
| verify-parent-career | 57/57 |
| verify-parent-climax | 92/92 |
| verify-parent-ending | 32/32 |
| verify-parent-smalltalk-school | 92/92 |
| verify-reach-pacing | PASS |
| verify-patch-batch1-2 | 27/27 |

---

## ❌ OPEN — 잔여 이슈

### 1. `verify:content` 체인 실패 (Critical for CI)

**중단 지점:** 3/18 — `verify-event-cg-coverage.ts`

```
총 조합: 2586 / 매칭: 406 / 미매칭: 2180 (417 이벤트 그룹)
```

- middle/high tier 이벤트 대비 PNG 부족 (manifest: **high/ 0장**)
- Y2+ reach·NPC 이벤트 급증 vs CG 139장 — **의도적 gap**이면 verify 정책 조정 필요 (Y1-only gate 등)

**체인 후반 (CG 통과 가정 시에도 FAIL):**

| Script | Result |
|--------|--------|
| verify-patch-batch3 | 12/13 — freedom mental Δ≥1.0 실패 |
| verify-patch-batch4 | 28/30 — wealth bias 데드 카테고리 2건 |
| verify-patch-batch5 | 40/43 — store/processWeek **소스 regex** 3건 (리팩터 후 stale 가능) |

**체인 미포함이지만 FAIL:**

| Script | Result |
|--------|--------|
| verify-parent-phase2b | 22/25 — examParentEffect 소스 구조 3건 |

→ batch5·phase2b 실패는 **런타임 버그**보다 **verify 스크립트가 리팩터링 후 갱신 안 됨** 가능성 높음. 수동 확인 필요.

### 2. `verify-save-load.ts` 없음

- F5 roundtrip (SCHOOL_LIFE mid-event, phase fallback) **자동 검증 없음**
- migration 수정은 코드상 완료, 회귀 방지 스크립트 **미작성**

### 3. `npcActivityMap` 미영속 (Low-Medium)

- [`store.ts`](../game/src/engine/store.ts) — `SaveData`에 `state`만 저장
- F5 시 주말 NPC 활동 매핑 유실 (확정 전 planner local state도 유실)

### 4. NPC mini talk — `available[0]` (Low)

- [`store.ts`](../game/src/engine/store.ts) L382 — catalog 순서 고정
- 부모 home talk는 rotation sort로 **FIXED** (L438, `talkSystem.ts`)

### 5. 구조 부채 (P2)

| 항목 | 상태 |
|------|------|
| `gameEngine.ts` | 974줄 (in-file helper만) |
| `resolveEvent` in store | 550줄 store에 잔존 |
| `EventScene.tsx` | 677줄 monolith |
| `talkData.ts` | 2067줄 monolith |
| shop `event_unlock` | 미구현 |
| `SAVE_VERSION` | 불일치 시 전체 폐기 |

### 6. CI verify 미연동

- deploy.yml: lint + build ✅ · **`verify:content` ❌**
- standalone pass 스크립트 10+종 CI 미포함

---

## verify:content 통과 현황 (18종 체인)

```
[✅]  1. verify-events-split
[✅]  2. verify-event-fixes
[❌]  3. verify-event-cg-coverage     ← 여기서 중단
[?]   4-15. (개별 실행 시 대부분 PASS, CG 제외)
[❌] 16. verify-patch-batch3
[❌] 17. verify-patch-batch4
[❌] 18. verify-patch-batch5
```

**실질 pass rate:** 체인 기준 **2/18 완료** · 개별 실행 기준 **~15/18 PASS** (CG + patch-batch 3종 + phase2b 제외)

---

## 권장 다음 작업 (우선순위)

### 즉시
1. **CG verify 정책 결정** — Y1-only / importance≥N gate vs middle·high PNG 대량 추가
2. **patch-batch3/4/5·phase2b** — 리팩터 반영해 verify 갱신 또는 의도적 변경 문서화
3. **`verify-save-load.ts`** 추가 + `verify:content`에 포함

### 단기
4. CI에 `verify:content` (또는 CG 제외 subset) 연동
5. NPC mini talk seeded pick

### 중기 (선택)
6. `weekProcessor.ts` / `resolveEvent.ts` 파일 분리
7. `talkData.ts` 도메인 분리
8. high/ CG 제작

---

## TODO (갱신)

- [x] P0: SCHOOL_LIFE_EVENTS rehydration + currentEvent.week + phase fallback
- [x] P0: EventScene visibleChoices=0 / allInsufficient fallback
- [x] events-split baseline 갱신
- [x] lint 0 error + CI lint/build
- [ ] verify-save-load.ts + mid-event F5 roundtrip
- [ ] verify:content green (CG 정책 + patch-batch verify 갱신)
- [ ] CI verify:content 연동
- [ ] npcActivityMap 영속화 (선택)
- [ ] NPC mini talk RNG
- [ ] 엔진 파일 분리 (weekProcessor, resolveEvent module)
- [ ] high CG + event_unlock shop

---

## 참고

- 1차 QA: [`qa-integrated-2026-05-30.md`](qa-integrated-2026-05-30.md)
- Cursor Plan 원본: `~/.cursor/plans/코드_리뷰_정리_ca6ee9cf.plan.md`
