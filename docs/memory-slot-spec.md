# 기억 슬롯 스펙 (Memory Slot Spec) v1.2

> LIFE_TRACK의 A(회고록 해상도) + B(관계 그물) + C-lite(감정 리듬) 구현 스펙.
>
> **v1.1 → v1.2**: 3 sub-agent 2차 딥리뷰(엔지니어 / 작가 / QA) 치명적 이슈 15건 반영.
>
> 작성: 2026-04-22
> v1.1: 외부 3 AI 2차 리뷰 통합
> v1.2 (2026-04-23): 내부 sub-agent 구현 feasibility·서사·QA 리뷰 반영
> - **RNG 시드 결정론화** — `Math.random()` 전량 교체, `state.rngSeed` 신설 (§6)
> - **EventChoice.memorySlotDraft 필드** — importance/recallText/toneTag를 선택지 단위에 귀속 (§2)
> - **세이브 마이그레이션 경로 확장** — `loadFromStorage`에도 백필 (§5)
> - **하드위기 우선순위 레이어** — `getEventForWeek` 계층 재구조 (§4)
> - **ANNUAL_EVENTS 슬롯 금지** — 생일/졸업 덮어쓰기 방지 (부록 B.4)
> - **톤 분산 폴백** — 학년별 기본 회상 시드 풀 (§7.2)
> - **슬롯 < 3 하한 규칙** — milestoneScene 승격 or 중립 슬롯 (§7.2)
> - **milestoneScene 기록 주차 하드 테이블** — 학년별 고정 W 명시 (§1.3)
> - **ripple은 조건부 이벤트 분기** — MVP 대사 치환 폐지 (§7.3)
> - **위기 발동 빈도 상한** — 연간 ≤2건 가드 (§4.3)
> - **importance 점수 가이드 테이블** — 튜닝 지옥 방지 (부록 C)
> - **choiceIndex 성별 분기 해시** — femaleChoices 구분 (부록 B.5)
> - **구현 순서 재조정** — 엔드투엔드 관통 우선 (§6.2)
> - **작가 시안 부록 D** — recallText 20개 예시
> - **message vs recallText 구분 가이드** (부록 E)

---

## 0. 왜 이 문서가 먼저 필요한가

**핵심 진단**: "선택의 결과"가 숫자로만 흡수되어 기억에 남지 않음. 엔딩은 스탯·수능등급 기반이고, 3,000개 선택이 회수되지 않음.

**핵심 해법**: 기억에 남을 것을 먼저 구조로 정의 → 코드·콘텐츠·엔딩이 구조를 참조.

**순서**: 설계 → 타입 → 엔딩 → 세로 슬라이스.

---

## 1. 기억의 3카테고리

### 1.1 `memorySlots` — 정서적 이정표

| 카테고리 | 예시 |
|---|---|
| `courage` (용기) | 반장 자원, 장기자랑 |
| `betrayal` (상처) | 약속 어김, 험담 |
| `reconciliation` (화해) | 사과, 오해 풀기 |
| `failure` (실패) | 시험 대실수, 낙방 |
| `discovery` (깨달음) | 진로 결정, 재능 발견 |
| `growth` (성장) | 번아웃 극복, 약점 보완 |

**상한**: 카테고리당 최대 2개 × 6 = 최대 12개. **교체 규칙**: importance + 학년 분산 + 톤 다양성 (§7.2).

### 1.2 `socialRipples` — 관계 전염

**5가지 타입**: `admiration` / `jealousy` / `concern` / `rumor` / `group_unlock`

**MVP 구현**: **조건부 이벤트 분기 방식** — `condition: (s) => s.socialRipples.some(r => r.id === 'xxx' && r.activatedAt && !r.consumed)`로 별개 이벤트 발동. 대사 중간 변수 치환은 M7로 후퇴 (렌더링 엔진 부재).

### 1.3 `milestoneScenes` — 학년 단위 클로저

**자동 요약 장면** 1개 (플레이어 선택 분기 아님). `processWeek` 내 `week > 48` 직전 훅에 기록.

| 학년 | 기록 주차 (하드 고정) | 기본 소재 |
|---|---|---|
| Y1 (초6) | W46 (졸업식 주) | 초등 시절 최대 사건 |
| Y2 (중1) | W47 (겨울방학 직전) | 중학 적응 |
| Y3 (중2) | W40 (늦가을 전환점) | 사춘기·번아웃 |
| Y4 (중3) | W45 (고입 직전) | 진로 첫 고민 |
| Y5 (고1) | W1~W5 중 track 선택 직후 | 문·이과 결정 |
| Y6 (고2) | W28 (여름방학 시작) | 입시 체감 |
| Y7 (고3) | W46 (수능 전야) | 7년 정점 |

**주차 충돌 처리**: 해당 주차에 `currentEvent` 있으면 **milestone 먼저 기록** (백그라운드 데이터), 이벤트는 그대로 진행.

**상한**: 학년당 1개. 총 최대 7개.

---

## 2. 타입 스키마

```ts
// types.ts 추가

export type MemoryCategory =
  | 'courage' | 'betrayal' | 'reconciliation'
  | 'failure' | 'discovery' | 'growth';

export type PhaseTag = 'early' | 'mid' | 'late';
// early: Y1~Y2, mid: Y3~Y4, late: Y5~Y7

export type ToneTag = 'warm' | 'regret' | 'resolve' | 'breakthrough';

export interface MemorySlot {
  id: string;                  // {category}_{year}_{week}_{choiceIndex}
  category: MemoryCategory;
  week: number;
  year: number;
  sourceEventId: string;
  choiceIndex: number;
  recallText: string;          // 20~35자, 과거 회상형, 스탯 금지
  npcIds?: string[];
  importance: number;          // 1~10, 부록 C 기준
  phaseTag: PhaseTag;          // year 기반 자동 산출
  toneTag?: ToneTag;
}

// v1.2 신규: EventChoice에 슬롯 생성 draft 필드
export interface MemorySlotDraft {
  category: MemoryCategory;
  importance: number;
  toneTag?: ToneTag;
  recallText: string;
  npcIds?: string[];
}

// types.ts 기존 EventChoice 확장
export interface EventChoice {
  // ... 기존 필드 그대로
  memorySlotDraft?: MemorySlotDraft;   // v1.2 추가
}

export type RippleType =
  | 'admiration' | 'jealousy' | 'concern' | 'rumor' | 'group_unlock';

export type RippleSourceCondition =
  | 'intimacy_high'     // 조건 NPC 친밀도 ≥ 70
  | 'intimacy_mid'      // 조건 NPC 친밀도 ≥ 50
  | 'event_resolved'    // 특정 이벤트 resolvedChoice 종료
  | 'drifted';          // 조건 NPC 친밀도 ≤ 20

export interface SocialRipple {
  id: string;
  sourceNpcId: string;
  targetNpcId: string;
  sourceCondition: RippleSourceCondition;
  rippleType: RippleType;
  activatedAt?: number;        // 활성 주차
  consumed?: boolean;          // 일회성 소비 후 재활성 금지
  sourceEventId?: string;
}

export type MilestoneTheme = 'connection' | 'pressure' | 'identity' | 'loss' | 'growth';

export interface MilestoneScene {
  year: number;
  sceneId: string;
  dominantTheme?: MilestoneTheme;
  sourceMemoryIds?: string[];
  summaryText?: string;
  recordedAt: number;
}

// GameState 확장
export interface GameState {
  // ... 기존 필드
  memorySlots: MemorySlot[];          // 최대 12
  socialRipples: SocialRipple[];
  milestoneScenes: MilestoneScene[];  // 최대 7
  rngSeed: number;                    // v1.2: 결정론적 RNG (§6)
  hardCrisisYears: number[];          // v1.2: 연도당 하드위기 1회 가드
}
```

---

## 3. 엔딩 확장

`calculateEnding` 기존 구조 유지 + 회상 레이어 추가.

```ts
export function calculateEnding(state: GameState) {
  // ... 기존 career/achievement/happiness 계산

  const memorialHighlights = selectMemorialHighlights(state);  // 3~5개 보장
  const npcStories = getTopNpcStoriesWithMemory(state);
  const yearClosings = state.milestoneScenes
    .sort((a, b) => a.year - b.year)
    .map(ms => renderMilestone(ms, state));

  return {
    ...기존,
    memorialHighlights,
    yearClosings,
  };
}
```

**UI 순서**: 진로 → 성취/행복 → 회상 3~5장면 → NPC 근황 → 7년 요약 → 수능 총평.

---

## 4. 하드/소프트 위기

### 4.1 소프트 위기 (5~7개 목표)

낮은 빈도 · 짧은 지속 · 회복 가능. 기존 `conditional` 풀에 들어감.

| ID | 트리거 | 생성 슬롯 후보 |
|---|---|---|
| `minjae-jealousy` | Y2~Y3 & 민재 ≥60 & academic 급상승 | reconciliation/betrayal |
| `yuna-misunderstanding` | Y4 & 유나 ≥50 & 도서관 3주 스킵 | reconciliation |
| `subin-drift` | Y5 & 수빈 ≥40 & 학원 4주 이탈 | betrayal/reconciliation |
| `jihun-envy` | Y3 & 지훈·타 NPC 격차 30+ | reconciliation |
| `haeun-distance` | Y5 & 하은 졸업 전 & <60 | regret |

### 4.2 하드 위기 (3~4개, 학년당 ≤1)

정서적 기둥. 회복 가능하지만 쉽지 않음.

| ID | 학년 | 트리거 | 생성 슬롯 |
|---|---|---|---|
| `middle-burnout` | Y3 | idleWeeks ≥4 & mental ≤40 | growth/failure |
| `high-panic` | Y7 | W16~20(수능 직전) & mental ≤50 | growth/failure |
| `family-strain` | Y4~Y5 | 부모 strict & 성적 급락 | reconciliation/betrayal |
| `identity-crisis` | Y6 | track 선택 직후 mental ≤60 | discovery/failure |

### 4.3 발동 빈도 상한 (v1.2 신규)

`getEventForWeek`에 우선순위 레이어 신설:

```
priority:
1. fixed-week 이벤트 (기존)
2. followup 이벤트 (기존)
3. ⭐ hard-crisis 이벤트 (신규, state.hardCrisisYears 가드)
4. soft-crisis 이벤트 (신규, 연간 ≤2건 가드)
5. conditional 이벤트 (기존)
6. school-life random 이벤트 (기존)
```

**가드 조건**:
- 하드위기 발동 시 `state.hardCrisisYears.push(state.year)` → 해당 연도 재발동 금지
- 소프트위기: 연간 발동 수 2건 이하 유지. `state.events.filter(e => e.year === state.year && isSoftCrisis(e.id)).length < 2` 체크

**기존 `burnout-event`(events.ts:1915)와 중복 방지**: `middle-burnout`이 Y3에서 `burnout-event` 조건을 선점. `burnout-event`는 Y4+ 에서만 유효하도록 조건 조정 (또는 폐기 검토).

---

## 5. 국소 D 조치

### 5.1 자연 회복 — M6 플래그 실험으로 후퇴 (v1.1 유지)
- M1~M5는 `fatigue * 0.15` 그대로
- M6에서 `useReducedRecovery: boolean` 플래그 도입, 세로 슬라이스 검증 후 판단

### 5.2 돈 싱크 — 선택형 관계·추억 소비만 (v1.1 유지 + 규모 검토)

| 싱크 | 시점 | 금액 | 연동 |
|---|---|---|---|
| 수학여행 | Y2 가을, Y5 가을 | -10만원 | 참가 시 memorySlot(warm) |
| NPC 생일 선물 | NPC 생일 주차 | -1~5만원 | ripple(warm) 활성 |
| 졸업 준비 | Y1 W46, Y7 W46 | -5만원 | milestoneScene 풍성화 |
| 동아리/학원 선택비 | Y5 시작 주 | -10만원 | 해당 루틴 효율 버프 |

**QA 지적 반영**: 선택적 싱크만으로는 잉여 1,480만원 여전히 큼. **"기억 매개 상점"은 M7에서 병행 착수** (보류 카드에서 활성 카드로 승격 대기). M3 세로 슬라이스 완성 후 재평가.

### 5.3 세이브 마이그레이션 경로 (v1.2 명시)

**두 경로 모두 백필 필수**:

```ts
// gameEngine.ts processWeek 시작부 (기존 패턴 유지)
if (!newState.memorySlots) newState.memorySlots = [];
if (!newState.socialRipples) newState.socialRipples = [];
if (!newState.milestoneScenes) newState.milestoneScenes = [];
if (newState.rngSeed == null) newState.rngSeed = hashInitialState(newState);
if (!newState.hardCrisisYears) newState.hardCrisisYears = [];

// store.ts loadFromStorage 내부 (신규 추가)
function migrateLoadedState(state: GameState): GameState {
  return {
    ...state,
    memorySlots: state.memorySlots || [],
    socialRipples: state.socialRipples || [],
    milestoneScenes: state.milestoneScenes || [],
    rngSeed: state.rngSeed ?? hashInitialState(state),
    hardCrisisYears: state.hardCrisisYears || [],
  };
}
```

**`SAVE_VERSION` 유지 정책**: 올리지 않음. 부재 필드 백필만으로 호환. 기존 세이브 중반 상태에서 로드 시 슬롯 0개 시작은 허용 (부록 B.6 폴백 규칙 참조).

---

## 6. 결정론적 RNG (v1.2 신규 섹션)

### 6.1 문제

현재 `getEventForWeek` (`events.ts:2626,2635`)가 `Math.random()` 2군데 사용. 같은 플레이어 입력으로도 매주 다른 이벤트가 뜸 → `state.events` 배열 자체가 non-deterministic → "같은 플레이 2회 같은 엔딩" 불가능.

### 6.2 해결: seeded RNG 도입

```ts
// gameEngine.ts 신규 유틸
export function seededRandom(state: GameState): number {
  // Linear Congruential Generator (LCG) — 충분한 품질
  const a = 1664525, c = 1013904223, m = 0x100000000;
  state.rngSeed = (Math.imul(a, state.rngSeed) + c) >>> 0;
  return state.rngSeed / m;
}

export function hashInitialState(state: GameState): number {
  // 초기 세팅(gender + parents + 시작 시각)로 시드 생성
  const str = `${state.gender}_${state.parents.join('-')}_${state.week}_${state.year}`;
  let hash = 2166136261;
  for (const ch of str) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}
```

### 6.3 적용 범위

`Math.random()` 호출부 전체 교체 대상:
- `events.ts:2626` — conditional 50% 게이트
- `events.ts:2635` — school-life 70% 게이트 + 균등 pick
- 기타 발견 시 추가

**주의**: `resolveEvent` 내 시험 점수 생성 등 다른 랜덤은 **제외** (엔딩 해시 영향 없음). 이벤트 발동 분기만 결정론화.

### 6.4 엔딩 회상 시드

`selectMemorialHighlights`의 랜덤 픽은 별도 시드 사용:

```ts
function endingSeed(state: GameState): number {
  // events.map(e => `${e.id}_${e.resolvedChoice ?? 'x'}_${e.year ?? 1}`).join('|') 해시
  // resolvedChoice undefined는 'x'로 치환, 고정주차/annual의 choiceIndex 0 대응
}
```

### 6.5 성별 분기 해시 (부록 B.5와 연계)

`femaleChoices` 경로로 분기된 선택은 **`f${choiceIndex}`** 토큰으로 구분:

```ts
const token = (isFemale && event.femaleChoices)
  ? `${event.id}_f${event.resolvedChoice}`
  : `${event.id}_${event.resolvedChoice}`;
```

---

## 7. 설계 원칙

### 7.1 기억 문장은 장면, 스탯 언급 금지

❌ "너는 Y3 W15에 academic을 8 올렸다"
✅ "중2 겨울, 모의고사 밤새 준비하던 책상 위에 남은 커피 얼룩"

**린트 (부록 B.7)**: CI 단계에서 금지어(`academic`, `+`, `등급`, 숫자 시퀀스) 정적 체크.

### 7.2 인용 선택: importance + 학년 분산 + 톤 다양성 + 하한 폴백

```ts
function selectMemorialHighlights(state: GameState): Array<MemorySlot | MilestoneScene> {
  // 1. memorySlots importance 내림차순 정렬
  // 2. 카테고리 다양성: growth/discovery/failure 중 있는 것 최소 1개씩 우선 집어감
  // 3. 학년 분산: 같은 phaseTag 3개 이상이면 1개 치환
  // 4. 톤 분산: toneTag 기준 최소 2종 포함 (부족 시 다른 슬롯으로 대체)
  // 5. 필수 3개 확보 후 랜덤 0~2개 추가 (seededRandom 사용)
  // 6. 반환 개수 < 3이면 폴백:
  //    a. milestoneScenes를 회상 풀에 승격 (부족분 채움)
  //    b. 여전히 부족하면 학년별 기본 시드 풀(부록 D.2)에서 보충
  // 7. 최소 3개, 최대 5개 반환 보장
}
```

**톤 분산 규칙**:
- 최소 1개는 아쉬움 계열 (`failure` / `betrayal` / `toneTag: 'regret'`)
- 최소 1개는 관계 계열 (`npcIds` 존재)
- 최소 1개는 자기 발견 계열 (`discovery` / `growth` / `toneTag: 'breakthrough'`)
- 규칙 위배 시 조용히 실패하지 말고 폴백 풀에서 보충

### 7.3 B는 조건부 이벤트 분기 (v1.2 변경)

~~v1.1: 대사 중간에 한 줄 치환 삽입~~
**v1.2: `socialRipple` 활성화 → 별개 이벤트 `condition`에서 참조 → 별개 이벤트 풀에 뜸**

```ts
// 예시: yuna 친밀도 ≥70 → minjae 반응 이벤트 발동
// 1. yuna-meet-elementary c0 resolve → addRipple('yuna-high-minjae-admiration')
// 2. 별개 이벤트 minjae-notices-yuna 등록:
{
  id: 'minjae-notices-yuna',
  condition: (s) => {
    const r = s.socialRipples.find(r => r.id === 'yuna-high-minjae-admiration');
    return !!r?.activatedAt && !r.consumed;
  },
  // ... 내용
}
// 3. resolve 시 해당 ripple consumed: true
```

**이점**: 기존 이벤트 시스템과 완전 호환, 대사 렌더링 엔진 불필요, 디버깅 쉬움.

### 7.4 위기는 회복 가능한 장면

- 번아웃 = 게임오버 X
- 선택지 중 "쉬기"/"도움 받기"가 반드시 있음
- 극복 시 `growth`, 회피 시 `failure` 슬롯 — 둘 다 엔딩에서 의미 있음

---

## 8. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| 분기 폭발 | 슬롯 상한 (카테고리 × 2) |
| 엔딩 평가표화 | recallText 스탯 금지 + CI 린트 |
| 초반 편향 | importance + 학년 분산 교체 규칙 |
| 좋은 장면만 앨범 | 톤 분산 규칙 (아쉬움/관계/자기발견) |
| 회피 러너 슬롯 부족 | 폴백 풀(milestoneScene 승격 + 기본 시드) |
| B 유지보수 지옥 | "조건부 이벤트 분기" 방식, 4~5쌍 한정 |
| 세이브 비대화 | 슬롯 상한 → 최대 ~25 객체, ~3KB |
| C가 "가이드 이벤트"로 읽힘 | 조건 기반 자연 발생, 하드위기 학년당 ≤1 |
| 톤 훼손 | 자연 회복 조정 M6 플래그, 의무 지출 제거 |
| RNG 비결정성 | §6 seeded RNG |
| 세이브 로드 크래시 | loadFromStorage 마이그레이션 (§5.3) |
| ANNUAL 이벤트 슬롯 폭증 | 생일/졸업 memorySlotDraft 금지 (부록 B.4) |
| 위기 이벤트 경쟁 | getEventForWeek 우선순위 레이어 (§4.3) |
| importance 튜닝 지옥 | 점수 가이드 테이블 (부록 C) |

---

## 9. 구현 마일스톤

### M1 ✅ — 설계 확정 (v1.2)

### M2 (0.5~1일) — 타입 + 마이그레이션 + RNG
- [ ] `types.ts` 신규 타입 추가
- [ ] `types.ts` `EventChoice.memorySlotDraft` 추가
- [ ] `gameEngine.ts` `seededRandom` / `hashInitialState` 유틸
- [ ] `gameEngine.ts` processWeek 마이그레이션
- [ ] `gameEngine.ts` createInitialState 신규 필드
- [ ] `store.ts` loadFromStorage 마이그레이션
- [ ] `events.ts` `Math.random()` 호출부 전량 `seededRandom(state)` 교체

### M3 (2~3일) — 세로 슬라이스 (엔지니어 권장 순서)
1. **빈 배열 기반 엔딩 먼저 통과** — `calculateEnding` 확장, 크래시 보험
2. **`selectMemorialHighlights` 유닛 테스트 먼저** — edge case(0/1/12 슬롯)
3. `store.ts` `resolveEvent`에 `applyMemorySlotFromChoice` 삽입
4. **`minjae-jealousy` 1개만** 구현 → 엔드투엔드 관통 검증
5. `middle-burnout` + `getEventForWeek` 우선순위 레이어
6. ripple (조건부 이벤트 분기 방식)
7. Y3 milestoneScene 자동 기록

### M4 (0.5일) — 돈 싱크 (선택형)
- [ ] 수학여행 이벤트 (Y2, Y5)
- [ ] 생일 선물 memorySlotDraft 연동
- [ ] 졸업 준비 / 동아리비

### M5 (0.5일) — 검증
- [ ] 검증 체크리스트
- [ ] 세로 슬라이스 플레이 체감

### M6 (선택, 0.3일) — 자연 회복 플래그 실험

### M7 (확장, 향후) — 기억 매개 상점 등

---

## 10. 보류 카드

- **"기억 매개 상점"** → M7 승격 대기 (돈 싱크 실효성 부족 → 활성 카드 전환 예정)
- **재플레이 앨범/트로피** → A 성공 시 자연 발생
- **피드백 지연 해소** → 보류
- **ripple 대사 중간 치환** → M7 (렌더 엔진 필요)

---

## 부록 A: recallText 작성 전략

**단계 1 (MVP)**: 문장 직접 저장. `EventChoice.memorySlotDraft.recallText`.

**단계 2 (M7 확장)**: 템플릿 + 변수 비추천 — 서브에이전트 실측 결과 품질 손실 큼 ("중2 겨울, 유나와 도서관에서 나눈 설렘" 같은 어색함). 대신 **importance ≥6 이벤트만 슬롯 생성 대상**으로 필터링 → 실제 작성 대상 40~60문장으로 축소.

---

## 부록 B: 구현 체크포인트

### B.1 `idleWeeks`
`GameState.idleWeeks` 이미 존재 (v6). "연속 비생산적 주차". `middle-burnout` 트리거에 그대로 사용.

### B.2 같은 이벤트 재발
- 같은 `sourceEventId`로 `memorySlot` 생성은 **최초 1회**
- `ANNUAL_EVENTS`는 매년 재발하지만 슬롯 갱신 금지 (B.4 참조)

### B.3 결정론적 시드
§6 참조. `events.map(e => e.id + '_' + (e.resolvedChoice ?? 'x') + '_' + (e.year ?? 1)).join('|')` 해시.

### B.4 ANNUAL_EVENTS 슬롯 금지

`events.ts` ANNUAL_EVENTS Set (2602)에 포함된 이벤트는 **`memorySlotDraft` 금지**. 생일 7회 발동 시 동일 카테고리 슬롯 7번 덮어쓰는 것 방지.

```ts
// applyMemorySlotFromChoice 내부
if (ANNUAL_EVENTS.has(event.id)) return; // 슬롯 생성 스킵
```

**예외**: 졸업식 W46(`elementary-graduation`, `high-school-graduation`)은 `milestoneScene` 자동 기록 대상. `memorySlot`은 여전히 금지.

### B.5 choiceIndex 성별 분기

`resolveEvent` 저장 시 성별 분기 정보 포함:

```ts
// store.ts resolveEvent
newState.events.push({
  ...newState.currentEvent!,
  resolvedChoice: choiceIndex,
  week: newState.week,
  year: newState.year,
  resolvedFemale: isFemale && !!s.currentEvent.femaleChoices,  // v1.2 추가
});
```

`types.ts` GameEvent에 `resolvedFemale?: boolean` 추가.

### B.6 빈 플레이 폴백

슬롯 < 3 시 우선순위:
1. milestoneScenes를 회상 풀에 승격
2. 여전히 부족하면 학년별 기본 시드 풀 (부록 D.2)

### B.7 recallText 린트

CI / 런타임 개발 모드에서 금지어 체크:

```ts
const FORBIDDEN_PATTERNS = [
  /academic|social|talent|mental|health/,
  /\+\d+|-\d+|\d+\s*점/,
  /등급|스탯/,
];
function lintRecallText(text: string): string[] {
  return FORBIDDEN_PATTERNS
    .filter(p => p.test(text))
    .map(p => `금지 패턴: ${p}`);
}
```

### B.8 버그 방지
- 슬롯 `id` 충돌: `{category}_{year}_{week}_{choiceIndex}` 포맷. 같은 주차 다른 선택지는 choiceIndex로 구분.
- ripple `consumed: true` 이후 재활성 금지
- milestoneScenes 학년당 1개 초과 시 덮어쓰지 않고 error log

---

## 부록 C: importance 점수 가이드 테이블 (v1.2 신규)

| 점수 | 레벨 | 기준 | 예시 |
|---|---|---|---|
| 9~10 | 인생 전환 | 진로 확정, 정체성 붕괴·재건 | 수능 결과, identity-crisis 극복 |
| 7~8 | 강한 기억 | 하드 위기 선택, 연/절교 | middle-burnout 극복, 절친과 절교 |
| 5~6 | 중간 기억 | 소프트 위기, 중요 관계 변화 | minjae-jealousy 화해, 유나 고백 |
| 3~4 | 잔잔한 기억 | 일상 용기, 작은 성취 | 장기자랑 참가, 수학여행 조원 선택 |
| 1~2 | 배경 기억 | 슬롯 생성 권장 X | 편의점 음료 선택 |

**슬롯 생성 임계값 (v1.2)**: `importance >= 3`만 생성. 이하 이벤트는 `memorySlotDraft` 정의 X 또는 무시.

---

## 부록 D: 세로 슬라이스 recallText 시안 (v1.2 신규)

### D.1 세로 슬라이스 3이벤트

**`minjae-jealousy`** (Y2~Y3, 소프트)

| choice | category | importance | toneTag | recallText |
|---|---|---|---|---|
| 외면 | betrayal | 5 | regret | 중2 가을, 민재의 눈을 피해 먼저 교실을 나섰다. |
| 솔직히 사과 | reconciliation | 6 | warm | 사과했더니 민재가 '알아'라고만 했다. 그걸로 충분했다. |
| 경쟁 인정 | reconciliation | 6 | resolve | 지는 게 싫다고, 민재가 처음으로 말해줬다. |

**`middle-burnout`** (Y3, 하드)

| choice | category | importance | toneTag | recallText |
|---|---|---|---|---|
| 억지로 공부 | failure | 7 | regret | 책상 위 커피 얼룩만 늘어가던, 중2의 긴 겨울. |
| 쉬기 | growth | 8 | breakthrough | 아무것도 안 한 날. 죄책감보다 숨이 먼저 돌아왔다. |
| 지훈에게 전화 | growth | 8 | warm | 힘들다고 말했더니, 지훈이는 그냥 들어줬다. |

**Y3 milestoneScene summaryText 풀**

| 조건 (sourceMemoryIds) | summaryText |
|---|---|
| 민재 화해 + 번아웃 극복 | 경쟁과 번아웃 사이, 나를 붙잡아준 건 사람이었다. |
| 방치 + 실패 | 중2는 조용히 지나갔다. 기억나는 건 피로뿐. |
| 혼합 | 민재와는 다시 얘기했지만, 내 안의 무언가는 돌아오지 않았다. |
| 고립 | 그해 겨울, 나는 혼자 견디는 법을 먼저 배웠다. |
| 폴백 (슬롯 0개) | 중2는 그저 지나갔다. 돌아보면 길었던 해. |

### D.2 폴백 기본 시드 풀 (학년 × 카테고리)

슬롯 < 3 시 사용. 각 학년당 6카테고리 중 2개만 필수, 나머지는 확장 시 추가.

| 학년 | 폴백 (중립 회상) |
|---|---|
| Y1 | 초등학교의 마지막 날, 운동장은 여전히 시끄러웠다. |
| Y2 | 처음으로 입은 교복이 조금 컸던 중1의 봄. |
| Y3 | 중2는 그저 지나갔다. 돌아보면 길었던 해. |
| Y4 | 고입 원서를 쓰던 손끝이 차가웠다. |
| Y5 | 새 교복, 새 반, 새 시간표. 낯설고 묘하게 설렜다. |
| Y6 | 고2의 여름. 입시가 갑자기 가까워졌다. |
| Y7 | 수능 전날 밤, 창밖은 이상하리만치 조용했다. |

### D.3 NPC별 recallText 키워드 사전

| NPC | 키워드·음색 |
|---|---|
| 지훈 | 무뚝뚝한 위로, '그냥 들어줬다' |
| 민재 | 침묵·주먹, '알아'라고만 |
| 유나 | 책/감각, 창가·별 |
| 수빈 | 거리감, 웃음 뒤 공백 |
| 하은 | 선배어, 떠나는 자리 |
| 준하 | 사투리·음식, '괜찮나' |

---

## 부록 E: message vs recallText 구분 가이드 (v1.2 신규)

| 구분 | `EventChoice.message` | `EventChoice.memorySlotDraft.recallText` |
|---|---|---|
| 용도 | 주간 로그용 | 엔딩 회상용 |
| 시제 | 현재형 | 과거 회상형 |
| 길이 | 40~80자 + 대사 인용 OK | 20~35자, 대사 최소화 |
| 시점 | 장면 내부 | 장면 바깥 ("그해", "중2 가을") |
| 스탯 언급 | OK ("멘탈 -3") | 금지 |
| 의무 여부 | 모든 선택지 필수 | importance ≥3 선택지만 |

**둘 다 정의해야 함** (중복 X). `message`는 주차 후 바로 표시, `recallText`는 Y7 엔딩에서 재호출.

---

## 부록 F: v1.1 → v1.2 변경 요약

| 영역 | v1.1 | v1.2 |
|---|---|---|
| RNG | Math.random 그대로, deterministic 주장만 | seededRandom 교체 (§6) |
| 슬롯 draft 위치 | 암시만 | `EventChoice.memorySlotDraft` 명시 (§2) |
| 세이브 마이그 | processWeek만 | loadFromStorage 추가 (§5.3) |
| 위기 우선순위 | 없음 | hard-crisis 레이어 + 빈도 상한 (§4.3) |
| ANNUAL 슬롯 | 미정 | 금지 (B.4) |
| 폴백 풀 | 없음 | milestoneScene 승격 + 기본 시드 (§7.2, D.2) |
| milestone 주차 | 느슨함 | 학년별 고정 W (§1.3) |
| ripple 치환 | 대사 중간 삽입 | 조건부 이벤트 분기 (§7.3) |
| importance 기준 | 숫자만 | 점수 가이드 테이블 (부록 C) |
| femaleChoices 해시 | 미고려 | 토큰 구분 (§6.5, B.5) |
| 구현 순서 | 콘텐츠→엔딩 | 엔드투엔드 먼저 (§9 M3) |
| recallText 시안 | 없음 | 부록 D |
| 린트 | 원칙만 | 정적 체크 함수 (B.7) |
| message 구분 | 암시 | 구분 테이블 (E) |
