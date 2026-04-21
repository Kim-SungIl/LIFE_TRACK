# 기억 슬롯 스펙 (Memory Slot Spec) v1.1

> LIFE_TRACK의 A(회고록 해상도) + B(관계 그물) + C-lite(감정 리듬) 방향성 구현을 위한 **데이터 구조 및 설계 선행 문서**.
> 4개 리뷰(Sub-agent / GPT / Gemini / Cursor) + 3개 외부 AI 2차 리뷰(Gemini / Cursor / GPT) 통합 반영.
>
> 작성: 2026-04-22
> v1.1: 2026-04-22 — 외부 3 AI 2차 리뷰 통합
> - 슬롯 교체: 첫 기억 우선 → **importance + phaseTag + 학년 분산** (GPT, Gemini 통합)
> - 용어 통일: `memoryFlags` → `memorySlots` (Cursor)
> - 회상 개수 고정: **3~5개 가변** (필수 3 + 랜덤 0~2) (Cursor)
> - `SocialRipple`: `rippleType` + MVP sourceCondition 값 명시 (GPT, Cursor)
> - `MilestoneScene`: `dominantTheme` + `sourceMemoryIds` 추가, 역할 "자동 요약"으로 고정 (GPT, Cursor)
> - **자연 회복 조정은 M6 플래그 실험 + A/B 검증 후 결정** (Cursor: 두 문서 모순 해소)
> - **돈 싱크는 의무 지출 제거, 관계·추억 소비만** (GPT)
> - 회상 선정에 **톤 분산 규칙** 추가 (GPT)
> - 구현 체크포인트 + recallText 템플릿 부록 추가 (Cursor)

---

## 0. 왜 이 문서가 먼저 필요한가

**핵심 진단**: LIFE_TRACK의 "선택의 결과"가 **숫자 변동으로만 흡수**되어 플레이어 기억에 남지 않음. 엔딩은 스탯·수능등급 기반이고, 3,000개 선택은 회수되지 않음.

**핵심 해법**: "기억에 남을 것"을 **먼저 구조로 정의**한 뒤, 코드·콘텐츠·엔딩이 그 구조를 참조하게 하기.

**이 문서가 먼저 나와야 하는 이유**:
- 태그 없이 엔딩 텍스트만 쓰면 → "로그 확인"이 됨
- 관계 필드 없이 그래프 UI부터 만들면 → 유지보수 지옥
- 구조 없이 선택을 인용하려 하면 → 분기 폭발

→ **설계 문서 → 타입 추가 → 엔딩 확장 → 세로 슬라이스 순서**.

---

## 1. 기억의 3가지 카테고리

### 1.1 `memorySlots` — 정서적 이정표
플레이어의 **단일 선택**이 남긴 정서적 표식. 엔딩 회상에서 직접 인용.

| 카테고리 | 예시 |
|---|---|
| `courage` (용기) | 반장 자원, 장기자랑, 괴롭힘 맞섬 |
| `betrayal` (상처) | 친구 약속 어김, 험담, 비밀 누설 |
| `reconciliation` (화해) | 싸운 뒤 사과, 오해 풀기 |
| `failure` (실패) | 시험 대실수, 대회 낙방, 관계 깨짐 |
| `discovery` (깨달음) | 진로 결정, 재능 발견, 자아 정의 |
| `growth` (성장) | 번아웃 극복, 약점 보완, 가치관 변화 |

**상한**: 카테고리당 **최대 2개** × 6 = **최대 12개**.
**교체 규칙 (v1.1 변경)**: 첫 기억 우선 X. **`importance` + 학년 분산 + 톤 다양성** 기반으로 선별 (§2, §7.2 참조).

### 1.2 `socialRipples` — 관계 전염
**NPC A의 변화**가 **NPC B의 반응**에 영향을 주는 파급. 대사 레벨의 "한 줄 교차 언급".

**5가지 타입** (v1.1 추가):
- `admiration` (감탄): "쟤 공부 잘한다던데" 류
- `jealousy` (질투): "네가 걔랑 더 친해진 것 같아"
- `concern` (걱정): "요즘 안 보이던데 괜찮아?"
- `rumor` (소문): "어제 □□랑 있었다며?"
- `group_unlock` (그룹 이벤트 해금): 조건 만족 시 셋 이상 그룹 장면 활성화

**상한**: NPC 페어 최대 15쌍 중 **MVP에서 4~5쌍만**.

### 1.3 `milestoneScenes` — 학년 단위 클로저
**336주 리듬 피로**와 **중간 클로저 부재**에 대응. 학년 전환 시 해당 학년을 요약하는 **자동 요약 장면** 1개 (플레이어 선택 분기 아님).

| 학년 | 시점 | 기본 소재 |
|---|---|---|
| Y1 (초6) | 졸업식 (W46) | 초등 시절의 가장 큰 사건 |
| Y2 (중1) | 겨울방학 직전 | 중학교 적응 |
| Y3 (중2) | 사춘기 전환점 | 가장 흔들린 순간 |
| Y4 (중3) | 고입 직전 | 진로 첫 고민 |
| Y5 (고1) | 트랙 선택 주 | 문·이과 결정 |
| Y6 (고2) | 여름방학 | 입시 체감 시작 |
| Y7 (고3) | 수능 전야 | 7년의 정점 |

**상한**: 학년당 **1개 고정**. 총 **최대 7개**.
**역할 (v1.1 명시)**: 해당 학년의 `memorySlots`를 기반으로 **자동 생성되는 요약**. 플레이어가 직접 선택하는 이벤트 아님.

---

## 2. 타입 스키마 (v1.1)

```ts
// types.ts 추가

export type MemoryCategory =
  | 'courage' | 'betrayal' | 'reconciliation'
  | 'failure' | 'discovery' | 'growth';

export type PhaseTag = 'early' | 'mid' | 'late';
// early: Y1~Y2 (초6~중1)
// mid:   Y3~Y4 (중2~중3)
// late:  Y5~Y7 (고1~고3)

export type ToneTag = 'warm' | 'regret' | 'resolve' | 'breakthrough';

export interface MemorySlot {
  id: string;                  // 고유 ID
  category: MemoryCategory;
  week: number;
  year: number;
  sourceEventId: string;
  choiceIndex: number;
  recallText: string;          // 엔딩 회상용 1~2문장 (장면 묘사, 스탯 언급 금지)
  npcIds?: string[];           // 관련 NPC
  importance: number;          // 0~10, 이벤트 정의 시 부여 (상징성)
  phaseTag: PhaseTag;          // 학년 분산용
  toneTag?: ToneTag;           // 톤 다양성 분산용
}

export type RippleType =
  | 'admiration' | 'jealousy' | 'concern' | 'rumor' | 'group_unlock';

export type RippleSourceCondition =
  | 'intimacy_high'     // 조건 NPC 친밀도 70+
  | 'intimacy_mid'      // 조건 NPC 친밀도 50+
  | 'event_resolved'    // 특정 이벤트 resolvedChoice로 종료
  | 'drifted';          // 조건 NPC 친밀도 20- 하락

export interface SocialRipple {
  id: string;                  // 예: 'yuna-high-minjae-admiration'
  sourceNpcId: string;
  targetNpcId: string;
  sourceCondition: RippleSourceCondition;
  rippleType: RippleType;
  activatedAt?: number;        // 활성화 주차 (없으면 비활성)
  consumed?: boolean;          // 일회성 반응이면 true → 소비 후 재활성 안 됨
  sourceEventId?: string;      // 연관된 트리거 이벤트
}

export type MilestoneTheme = 'connection' | 'pressure' | 'identity' | 'loss' | 'growth';

export interface MilestoneScene {
  year: number;                // 1~7
  sceneId: string;             // 렌더링 템플릿 키
  dominantTheme?: MilestoneTheme;      // 자동 판정
  sourceMemoryIds?: string[];          // 이 학년의 주요 memorySlot 참조
  summaryText?: string;                // 렌더링된 요약 (선택 저장 or 런타임 생성)
  recordedAt: number;                  // 기록 주차
}

// GameState 확장
export interface GameState {
  // ... 기존 필드
  memorySlots: MemorySlot[];                        // 최대 12개
  socialRipples: SocialRipple[];
  milestoneScenes: MilestoneScene[];                // 최대 7개 (학년당 1)
}
```

**저장 비용**: 최대 ~25개 객체. JSON 크기 증가 2~3KB.

---

## 3. 엔딩 확장 (calculateEnding 리라이트)

**기존 구조 유지 + 회상 레이어 추가**.

```ts
export function calculateEnding(state: GameState) {
  // ... 기존 계산 (career, achievement, happiness) 그대로

  // 신규: 회상 레이어
  const memorialHighlights = selectMemorialHighlights(state.memorySlots);  // 3~5개
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

### UI 섹션 순서
1. 진로 결과 (career)
2. 성취·행복 등급 (기존)
3. **회상 3~5장면** (memorialHighlights)
4. **NPC 근황** (공유 기억 기반)
5. **7년 요약** (milestoneScenes 학년별 1줄)
6. 수능 등급 / 총평

---

## 4. 하드/소프트 위기 카탈로그 시안

### 4.1 소프트 위기 (5~7개 목표)
**특성**: 관계 오해, 말 실수, 질투 한 스푼. **낮은 빈도 · 짧은 지속 · 회복 가능**.

| ID | 트리거 | 발동 ripple | 생성 memorySlot 후보 |
|---|---|---|---|
| `minjae-jealousy` | Y2~Y3, 민재 친밀도 60+ & 내 academic 급상승 | `jealousy` | `reconciliation`/`failure` |
| `yuna-misunderstanding` | Y4, 유나 친밀도 50+ & 도서관 이벤트 스킵 연속 | - | `reconciliation`/`regret` |
| `subin-drift` | Y5, 수빈 친밀도 40+ & 학원 4주 이탈 | `concern` | `betrayal`/`reconciliation` |
| `jihun-envy` | Y3, 지훈·타 NPC 친밀도 격차 30+ | `jealousy` | `reconciliation` |
| `haeun-distance` | Y5, 하은 졸업 전 & 친밀도 60+ 아닐 때 | - | `regret` |

### 4.2 하드 위기 (3~4개 목표, 학년당 최대 1)
**특성**: 정서적 기둥. 회복 가능하지만 쉽지 않음.

| ID | 학년 | 트리거 | 생성 memorySlot |
|---|---|---|---|
| `middle-burnout` | Y3 | idleWeeks 4+ & mental 40- | `growth`(극복) / `failure`(방치) |
| `high-panic` | Y7 | 수능 D-30 & mental 50- | `growth` / `failure` |
| `family-strain` | Y4~Y5 | 부모 strict + 성적 급락 | `reconciliation` / `betrayal` |
| `identity-crisis` | Y6 | track 선택 직후 mental 60- | `discovery` / `failure` |

---

## 5. 국소 D 조치 (v1.1 재조정)

### 5.1 자연 회복 — **M6 플래그 실험으로 후퇴**
design-direction-review 문서와 spec v1 사이 모순 존재. v1.1에서는:
- **M1~M5 (메인 구현)에는 자연 회복 그대로 유지** (`fatigue * 0.15`)
- **M6**에서 플래그(`useReducedRecovery: boolean`)로 0.12안 도입 → 세로 슬라이스 플레이 후 A/B 체감 비교
- 기억 시스템이 먼저 "결과 가시성"을 올리면 피로 조정 없이도 텐션 체감이 바뀔 가능성 있음. 그 가능성 확인 후 판단.

### 5.2 돈 싱크 — **선택적 관계·추억 소비만** (v1.1 변경)
**의무 지출 제거.** 전부 **선택형** + 기억/관계 연동.

| 싱크 | 시점 | 금액 | 성격 | 연동 |
|---|---|---|---|---|
| 수학여행 | Y2 가을, Y5 가을 | -10만원 | 선택 (안 가면 관계 감소) | 참가 시 `memorySlot` 생성 (`warm`) |
| NPC 생일 선물 | NPC 생일 주차 | -1~5만원 | 선택 (기존 강화) | 선물 시 `ripple('warm')` |
| 졸업 준비 | Y1 W46, Y7 W46 | -5만원 | 선택 | 지출 시 `milestoneScene` 풍성해짐 |
| 동아리/학원 선택비 | Y5 시작 주 | -10만원 | 선택 (해당 루틴 효율 버프) | - |

**GPT 지적 수용**: 돈을 태우게 하더라도 **"기억을 사는 소비"가 먼저**. 의무 지출(학원비)은 톤 훼손 위험으로 제거.

---

## 6. 세로 슬라이스 MVP

**원칙**: NPC 2명, 선택 3개, 위기 1개, 학년 1개.

### 6.1 선정
- **NPC**: 유나 + 민재 (공부 축 공유, 대사 레벨 교차 이미 존재)
- **소프트 위기 1**: `minjae-jealousy`
- **하드 위기 1**: `middle-burnout`
- **milestoneScene 1**: Y3 (중2 사춘기 전환점)
- **엔딩 인용**: 위 3개 중 최대 3개 선택

### 6.2 구현 순서 (v1.1 조정: 자연 회복을 맨 뒤로)

1. `types.ts` 스키마 추가 (MemorySlot/SocialRipple/MilestoneScene)
2. `gameEngine.ts` 마이그레이션 (processWeek에서 빈 배열 초기화)
3. **슬롯 헬퍼/선정 로직 완성** (`addMemorySlot`, `selectMemorialHighlights`)
4. `minjae-jealousy` 이벤트 구현 + memorySlot 생성 + ripple 활성화
5. `middle-burnout` 이벤트 구현
6. Y3 milestoneScene 자동 기록 로직
7. `calculateEnding` 확장 (memorialHighlights, yearClosings)
8. 엔딩 UI 회상 섹션
9. **(M6 별도)** 자연 회복 플래그 실험

### 6.3 검증 체크리스트
- [ ] 같은 플레이 2회 → 엔딩 인용 동일 (deterministic)
- [ ] 위기 회피 vs 극복 → 엔딩 문장 다름
- [ ] memorySlot 최대 12개 상한 유지
- [ ] 기존 세이브 호환 (빈 배열로 마이그레이션)
- [ ] 회상 문장에 스탯 표현 없음
- [ ] 톤 분산 규칙 준수 (§7.2)

---

## 7. 설계 원칙

### 7.1 기억 문장은 장면, 스탯 언급 금지
❌ "너는 Y3 W15에 academic을 8 올렸다"
✅ "중2 겨울, 모의고사 밤새 준비하던 너의 책상 위에 남은 커피 얼룩"

### 7.2 인용 선택: importance + 학년 분산 + 톤 다양성

```ts
function selectMemorialHighlights(slots: MemorySlot[]): MemorySlot[] {
  // 1. 필수 3개 (category 우선순위)
  //    - growth, discovery, failure 중 있으면 최소 1개씩
  // 2. importance 높은 순
  // 3. 학년 분산 보정: 같은 phaseTag 3개 이상이면 1개 치환
  // 4. 톤 다양성: toneTag 기준 최소 2종 포함
  // 5. 랜덤 0~2개 추가 (seed = 플레이어 선택 해시, deterministic)
  // 6. 최종 반환 3~5개
}
```

**톤 분산 규칙** (GPT 제안):
- 최소 1개는 아쉬움 계열 (`failure` / `betrayal`)
- 최소 1개는 관계 계열 (`npcIds` 존재)
- 최소 1개는 자기 발견 계열 (`discovery` / `growth`)

엔딩은 "잘 컸다" 앨범이 아니라 **감정 혼합물**이어야 함.

### 7.3 B는 그래프 UI 아닌 "한 줄 엣지"
- 관계도 렌더링 없음
- `socialRipple.activatedAt` 설정 → 특정 이벤트 대사에 한 줄 삽입
- 구현 복잡도는 이벤트 조건 확인 수준

### 7.4 위기는 회복 가능한 장면, 벌점 아님
- 번아웃 = 게임오버 X
- 선택지 중 "쉬기"·"도움 받기"가 **반드시** 있음
- 극복 시 `growth`, 회피 시 `failure` 슬롯 — **둘 다 엔딩에서 의미 있음**

---

## 8. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| 분기 폭발 | 슬롯 상한 엄수 (카테고리 × 2) |
| 엔딩 "평가표"화 | 기억 문장 스탯 금지, 장면만 |
| 초반 편향 (Gemini 지적) | **importance + 학년 분산 교체 규칙** |
| 좋은 장면만 모인 앨범 (GPT 지적) | **톤 분산 규칙** (아쉬움/관계/자기발견 각 1) |
| B 유지보수 지옥 | MVP 4~5 페어만, 대사 조건 한 줄 수준 |
| 세이브 비대화 | 슬롯 상한 → 최대 ~25 객체, ~3KB |
| C가 "가이드 이벤트"로 읽힘 | 트리거는 **조건 기반 자연 발생** |
| 톤 훼손 (D 오남용) | **자연 회복 조정 M6로 후퇴**, 의무 지출 제거 |
| ripple 유지보수 | `rippleType` + `consumed` 플래그로 소비 관리 |

---

## 9. 구현 마일스톤

### M1 ✅ — 설계 확정
- [x] 스펙 v1 초안
- [x] 외부 AI 3곳 2차 리뷰
- [x] 스펙 v1.1 통합

### M2 (1~2일) — 타입 및 인프라
- [ ] `types.ts` 스키마 추가 (v1.1 기준)
- [ ] `gameEngine.ts` 마이그레이션
- [ ] 헬퍼 함수: `addMemorySlot`, `selectMemorialHighlights`, `activateRipple`

### M3 (2~3일) — 세로 슬라이스
- [ ] `minjae-jealousy` 이벤트 + memorySlot 생성 + ripple
- [ ] `middle-burnout` 이벤트
- [ ] Y3 milestoneScene 자동 기록
- [ ] `calculateEnding` 확장
- [ ] 엔딩 UI 회상 섹션

### M4 (0.5일) — 돈 싱크 (선택형만)
- [ ] 수학여행 이벤트 (Y2, Y5)
- [ ] 생일 선물 시스템 강화
- [ ] 졸업 준비 지출
- [ ] 동아리/학원 선택비

### M5 (0.5일) — 검증
- [ ] 검증 체크리스트 전부 통과
- [ ] 세로 슬라이스 플레이 "기억에 남는가" 체감 평가

### M6 (선택, 0.3일) — 자연 회복 실험
- [ ] `useReducedRecovery` 플래그 도입
- [ ] `fatigue * 0.12` vs `0.15` 체감 비교
- [ ] 채택 여부 결정

### M7 (확장, 향후)
- 나머지 NPC 페어 관계 전염
- 소프트 위기 카탈로그 전체
- `milestoneScenes` 7개 완성
- "기억 매개 상점" 재정의 (D의 자연 확장)

---

## 10. 보류 카드

- **"기억 매개 상점"**: 상점을 "기억·관계 매개 장치"로 재정의. M4 돈 싱크가 그 씨앗. M7 검토.
- **재플레이 앨범/트로피**: A 성공 시 자연 발생. 별도 최소화.
- **피드백 지연 해소 (Persona 카드 연출)**: 과함. 보류.

---

## 부록 A: recallText 작성 전략

### 단계 1 (MVP) — 문장 직접 저장
각 이벤트 정의 시 `recallText`를 직접 집필. 품질 높음, 작성 부담 큼.

### 단계 2 (확장) — 템플릿 + 변수
콘텐츠 스케일 시 템플릿화:
```ts
recallTextTemplate: "중2 겨울, {npcName}와 {location}에서 나눈 {mood}"
recallTextVars: { npcName: 'minjae', location: '도서관', mood: '서늘한 침묵' }
```
런타임 렌더링 시 변수 치환. 품질은 약간 내려가지만 작성 부담 감소.

→ M3에서는 직접 저장, M7 이후 템플릿 도입 검토.

---

## 부록 B: 구현 체크포인트

### B.1 `idleWeeks` 상태 필드
- 이미 `GameState.idleWeeks`로 정의됨 (v6에서 추가)
- `middle-burnout` 트리거 조건에 그대로 사용 가능
- 정의: "연속 비생산적 주차 카운트" — 루틴이 없거나 rest만 한 주

### B.2 같은 이벤트 재발 규칙
- 같은 `sourceEventId`로 `memorySlot` 생성은 **최초 1회만**
- 같은 이벤트가 여러 번 발동 가능하더라도 슬롯은 덮어쓰지 않음
- 단, `importance` 더 높은 자연 재발이면 갱신 고려 (M7 이후)

### B.3 결정론적 시드
- `selectMemorialHighlights`의 랜덤 요소는 **플레이어 선택 해시 시드 사용**
- 해시 입력: `events.map(e => e.id + '_' + e.resolvedChoice).join('|')`
- 문자열 정규화 필수 (NFC) — 세이브/플랫폼 간 호환

### B.4 버그 방지
- `memorySlots` 추가 시 `id` 충돌 검사 (카테고리_연차_주차)
- `socialRipples` `consumed: true` 이후 재활성 금지
- `milestoneScenes` 학년당 1개 초과 시 덮어쓰지 않고 error log

---

## 부록 C: 3 AI 2차 리뷰 수렴 기록 (v1.1)

| 지적 | 제기 | v1.1 반영 |
|---|---|---|
| 첫 기억 우선 → 초반 편향 | Gemini, GPT | `importance` + 학년 분산 + 톤 다양성 |
| 용어 혼용 (`memoryFlags` vs `memorySlots`) | Cursor | `memorySlots` 통일 |
| 회상 개수 불일치 | Cursor | 3~5 가변 고정 |
| `SocialRipple` 정보 부족 | Cursor, GPT | `rippleType` + 명시된 sourceCondition |
| `MilestoneScene` 역할 모호 | Cursor, GPT | 자동 요약 + theme + sourceMemory |
| 자연 회복 두 문서 모순 | Cursor | M6 플래그 실험으로 후퇴 |
| 돈 싱크 의무 지출 위험 | GPT | 선택형 + 관계/추억 연동만 |
| 좋은 장면만 앨범 | GPT | 톤 분산 규칙 |
| `recallText` 스케일 | Cursor | 부록 A 템플릿 전략 |
| `idleWeeks` 정의 | Cursor | 부록 B.1 확인 |
| 결정론적 시드 세이브 호환 | Cursor | 부록 B.3 명시 |

본 v1.1은 위 11개 지적을 모두 반영한 통합 합의안이다.
