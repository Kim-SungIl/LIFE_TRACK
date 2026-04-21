# 기억 슬롯 스펙 (Memory Slot Spec) v1

> LIFE_TRACK의 A(회고록 해상도) + B(관계 그물) + C-lite(감정 리듬) 방향성 구현을 위한 **데이터 구조 및 설계 선행 문서**.
> 4개 리뷰(Sub-agent / GPT / Gemini / Cursor) 수렴 결과 반영.
> 작성: 2026-04-22

---

## 0. 왜 이 문서가 먼저 필요한가

**핵심 진단**: LIFE_TRACK의 "선택의 결과"가 **숫자 변동으로만 흡수**되어 플레이어 기억에 남지 않음. 엔딩은 스탯·수능등급 기반이고, 3,000개 선택은 회수되지 않음.

**핵심 해법**: "기억에 남을 것"을 **먼저 구조로 정의**한 뒤, 코드·콘텐츠·엔딩이 그 구조를 참조하게 하기.

**이 문서가 먼저 나와야 하는 이유** (GPT·Cursor 공통 지적):
- 태그 없이 엔딩 텍스트만 쓰면 → "로그 확인"이 됨 (Gemini 경고)
- 관계 필드 없이 그래프 UI부터 만들면 → 유지보수 지옥 (Cursor 경고)
- 구조 없이 선택을 인용하려 하면 → 분기 폭발 (공통 경고)

→ **설계 문서 → 타입 추가 → 엔딩 확장 → 세로 슬라이스 순서**.

---

## 1. 기억의 3가지 카테고리

GPT 프레이밍 채택:

### 1.1 `memoryFlags` — 정서적 이정표
플레이어의 **단일 선택**이 남긴 정서적 표식. 엔딩 회상에서 직접 인용.

| 카테고리 | 예시 |
|---|---|
| `courage` (첫 용기) | 반장 선거 자원, 장기자랑 나감, 괴롭힘 맞섬 |
| `betrayal` (첫 배신/상처) | 친구 약속 어김, 뒤에서 험담, 비밀 누설 |
| `reconciliation` (첫 화해) | 싸운 뒤 먼저 사과, 오해 풀기 |
| `failure` (첫 실패) | 중요 시험 대실수, 대회 낙방, 관계 깨짐 |
| `discovery` (첫 깨달음) | 진로 결정, 재능 발견, 자아 정의 |
| `growth` (첫 성장) | 번아웃 극복, 약점 보완, 가치관 변화 |

**슬롯 상한**: 카테고리당 **최대 2개** × 6개 = **최대 12개**. 초과 시 **나중 것이 덮어쓰지 않음**(첫 기억 우선).

### 1.2 `socialRipples` — 관계 전염
**NPC A의 변화**가 **NPC B의 반응**에 영향을 주는 파급. 대사 레벨의 "한 줄 교차 언급".

예시:
- 유나 친밀도 70+ → 민재가 "쟤 공부 잘한다던데" 언급
- 수빈 친밀도 60+ 후 학원 이탈 → 하은이 "요즘 안 보이던데" 걱정
- 지훈·민재 둘 다 친밀도 50+ → 셋이 같이 노는 이벤트 해금

**상한**: NPC 페어 최대 15쌍(6×5/2) 중 **MVP에서 4~5쌍만 활성화**. 전체 활성화는 콘텐츠 대공사.

### 1.3 `milestoneScenes` — 학년 단위 클로저
**336주 리듬 피로**(GPT)와 **중간 클로저 부재**(Cursor)에 대응. 학년 전환 시 해당 학년을 요약하는 장면 1개.

| 학년 | 시점 | 기본 소재 |
|---|---|---|
| Y1 (초6) | 졸업식 (W46) | 초등 시절의 가장 큰 사건 |
| Y2 (중1) | 겨울방학 직전 | 중학교 적응 |
| Y3 (중2) | 사춘기 전환점 | 가장 흔들린 순간 |
| Y4 (중3) | 고입 직전 | 진로 첫 고민 |
| Y5 (고1) | 트랙 선택 주 | 문·이과 결정 |
| Y6 (고2) | 여름방학 | 입시 체감 시작 |
| Y7 (고3) | 수능 전야 | 7년의 정점 |

**상한**: 학년당 **1개 고정**.

---

## 2. 타입 스키마

```ts
// types.ts 추가

export type MemoryCategory =
  | 'courage' | 'betrayal' | 'reconciliation'
  | 'failure' | 'discovery' | 'growth';

export interface MemorySlot {
  id: string;                  // 고유 ID (카테고리_연차_주차)
  category: MemoryCategory;
  week: number;
  year: number;
  sourceEventId: string;       // 어느 이벤트에서 생겼는지
  choiceIndex: number;         // 어느 선택지에서 생겼는지
  recallText: string;          // 엔딩 회상용 1~2문장 (장면 묘사, 스탯 언급 금지)
  npcIds?: string[];           // 관련 NPC (있으면 해당 NPC 엔딩에도 영향)
}

export interface SocialRipple {
  id: string;                  // 예: 'yuna-met-minjae-reaction'
  sourceNpcId: string;         // 조건 NPC
  sourceCondition: 'intimacy_70' | 'intimacy_50' | 'event_resolved' | 'drifted';
  targetNpcId: string;         // 영향받는 NPC
  activatedAt?: number;        // 활성화된 주차 (없으면 비활성)
}

export interface MilestoneScene {
  year: number;                // 1~7
  sceneId: string;             // 미리 정의된 장면 중 하나
  chosenChoiceIndex?: number;  // 해당 장면의 선택
  recordedAt: number;          // 기록 주차
}

// GameState 확장
export interface GameState {
  // ... 기존 필드
  memorySlots: MemorySlot[];                        // 최대 12개
  socialRipples: SocialRipple[];
  milestoneScenes: MilestoneScene[];                // 최대 7개 (학년당 1)
}
```

**저장 비용**: 최대 ~24개 객체. JSON 크기 증가 1~2KB. 세이브 데이터 비대화 우려 최소.

---

## 3. 엔딩 확장 (calculateEnding 리라이트)

**기존 구조 유지 + 회상 레이어 추가**. `career`·`achievement`·`happiness` 계산은 그대로.

```ts
export function calculateEnding(state: GameState) {
  // ... 기존 계산 그대로

  // 신규: 회상 레이어
  const memorialHighlights = selectMemorialHighlights(state.memorySlots, 3);
  const npcStories = getTopNpcStoriesWithMemory(state);  // 실제 공유 기억 참조
  const yearClosings = state.milestoneScenes
    .sort((a, b) => a.year - b.year)
    .map(ms => renderMilestone(ms, state));

  return {
    ...기존,
    memorialHighlights,    // 엔딩 회상 섹션
    yearClosings,          // 학년별 1줄 요약
  };
}

function selectMemorialHighlights(slots: MemorySlot[], count: number): MemorySlot[] {
  // 티어링: 필수 3 + 랜덤 2 (Cursor 제안)
  //   - 필수: growth/failure/discovery 중 있는 것 우선
  //   - 랜덤: 나머지 중 year 다양성 유지하며 N개
  // 구현 시 deterministic (seed = 플레이어 선택 해시) → 같은 플레이는 같은 엔딩
  ...
}
```

**UI 섹션 순서**:
1. 진로 결과 (career)
2. 성취·행복 등급 (기존)
3. **회상 3~5장면** (memorialHighlights → recallText)
4. **NPC 근황** (공유 기억 기반 문장)
5. **7년 요약** (milestoneScenes 학년별 1줄)
6. 수능 등급 / 총평

---

## 4. 하드/소프트 위기 카탈로그 시안

Cursor 프레이밍: **소프트 위기가 앞마당, 하드 위기는 낮은 빈도**.

### 4.1 소프트 위기 (5~7개 목표)
**특성**: 관계 오해, 말 실수, 질투 한 스푼. **낮은 빈도 · 짧은 지속 · 회복 가능**.

| ID | 트리거 조건 | 내용 |
|---|---|---|
| `minjae-jealousy` | Y2~Y3, 민재 친밀도 60+ & 내 academic 급상승 주 | 민재가 말수 줄어듦, 화해 선택지 |
| `yuna-misunderstanding` | Y4, 유나 친밀도 50+ & 도서관 이벤트 스킵 연속 | 유나 오해, 설명 선택지 |
| `subin-drift` | Y5, 수빈 친밀도 40+ & 학원 4주 이탈 | 수빈 거리감, 복귀/무시 선택지 |
| `jihun-envy` | Y3, 지훈·타 NPC 친밀도 격차 30+ | 지훈 서운함, 관계 재조정 |
| `haeun-distance` | Y5, 하은 졸업 전 & 친밀도 60+ 아닐 때 | 떠나는 멘토에 대한 미련 |

### 4.2 하드 위기 (3~4개 목표, 학년당 최대 1)
**특성**: 정서적 기둥. 진짜 위기감. 극복은 선택 가능하지만 쉽지 않음.

| ID | 학년 | 트리거 조건 | 내용 |
|---|---|---|---|
| `middle-burnout` | Y3 | idleWeeks 4+ & mental 40- | 첫 번아웃. 회복 이벤트 체인 |
| `high-panic` | Y7 | 수능 D-30 & mental 50- | 수능 직전 공황 |
| `family-strain` | Y4~Y5 | 부모 특성 strict + 성적 급락 | 가족 갈등 이벤트 |
| `identity-crisis` | Y6 | track 선택 직후 mental 60- | 진로 회의 |

각 위기는 극복 시 **memorySlot `growth` 카테고리**에 기록되어 엔딩에서 인용됨.

---

## 5. 국소 D 조치 (밸런스 미세 조정)

Gemini·Cursor 합의: **D 메인화 X, 하지만 얇은 조정은 즉시 효과**.

### 5.1 자연 회복 미세 하향 (코드 한 줄)
```ts
// gameEngine.ts applyFatigueRecovery
const recovery = Math.max(3, Math.min(12, fatigue * 0.12));  // 0.15 → 0.12
```
**효과**: 평형점 50 → ~60. 피로가 진짜 자원화. 번아웃 0회 → 플레이 스타일에 따라 가끔 발생.

### 5.2 돈 싱크 추가
| 싱크 | 시점 | 금액 | 성격 |
|---|---|---|---|
| 학원비 | Y4~Y7 학기 시작 주 | 학기당 -15만원 | 의무 |
| 연간 여행/수학여행 | Y2, Y5 가을 | 일회 -10만원 | 선택 (안 가면 관계 감소) |

**효과**: Y7 말 잉여 1,540만원 → ~500만원 이하.

---

## 6. 세로 슬라이스 MVP (첫 구현 범위)

**원칙**(GPT): NPC 2명, 선택 3개, 위기 1개, 학년 1개.

### 6.1 선정
- **NPC**: 유나 + 민재 (이미 대사 레벨 교차 존재, 공부 축 공유)
- **소프트 위기 1**: `minjae-jealousy`
- **하드 위기 1**: `middle-burnout`
- **milestoneScene 1**: Y3 (중2 사춘기 전환점)
- **엔딩 인용**: 위 3개 중 최대 3개 선택

### 6.2 구현 순서
1. `types.ts` 스키마 추가 (MemorySlot/SocialRipple/MilestoneScene)
2. `gameEngine.ts` 마이그레이션 (processWeek에서 빈 배열 초기화)
3. 기존 `minjae-jealousy` 해당 이벤트에 `memorySlot` 생성 로직
4. `calculateEnding` 확장 (memorialHighlights, yearClosings)
5. 엔딩 UI 추가 섹션 렌더링
6. 자연 회복 0.15 → 0.12 조정

### 6.3 검증 체크리스트
- [ ] 같은 플레이 2회 → 엔딩 인용 3개가 동일 (deterministic)
- [ ] 위기 회피 플레이 vs 극복 플레이 → 엔딩 문장이 다름
- [ ] memorySlot 최대 12개 상한 유지
- [ ] 기존 플레이 세이브 호환 (빈 배열로 마이그레이션)
- [ ] 회상 문장에 "academic 80 달성" 같은 스탯 표현 없음

---

## 7. 설계 원칙

### 7.1 기억 문장은 장면, 스탯 언급 금지
❌ "너는 Y3 W15에 academic을 8 올렸다"
✅ "중2 겨울, 모의고사 밤새 준비하던 너의 책상 위에 남은 커피 얼룩"

### 7.2 인용 선택은 티어 + 결정론적
- 필수 3 (growth/failure/discovery 우선)
- 랜덤 2 (year 다양성 유지)
- 시드 = 플레이어 선택 해시 → **같은 플레이 = 같은 엔딩**

### 7.3 B는 그래프 UI 아닌 "한 줄 엣지"
- 관계도 렌더링 없음
- `socialRipples` 활성화 → 특정 이벤트 대사에 "아 유나랑 친하다며?" 한 줄 삽입
- 구현 복잡도는 이벤트 조건 추가 수준

### 7.4 위기는 회복 가능한 장면, 벌점 아님
- 번아웃 = 게임오버 X
- 선택지 중 "쉬기"·"도움 받기"가 **반드시** 있음
- 극복 시 `growth` 슬롯, 회피 시 `failure` 슬롯 — **둘 다 엔딩에서 의미 있음**

---

## 8. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| 분기 폭발 | 슬롯 상한 엄수 (카테고리별 2개) |
| 엔딩의 "평가표"화 | 기억 문장에 스탯 금지, 장면 묘사만 |
| B 유지보수 지옥 | MVP 4~5 페어만, 대사 조건은 "한 줄" 수준 |
| 세이브 데이터 비대 | 슬롯 상한 → 최대 ~24 객체, 크기 1~2KB |
| C가 "가이드 이벤트"로 읽힘 | 위기 트리거는 **조건 기반 자연 발생**, 학년별 필연 배치는 하드 1개만 |
| 톤 훼손 | 하드 위기 3개 이내 + 회복 가능 |
| A의 선택 인용이 무작위 장면 | 카테고리 우선순위 + 결정론적 시드 |

---

## 9. 구현 마일스톤

### M1 (현재 세션 이후) — 설계 확정
- [x] 이 문서 커밋
- [ ] 외부 AI 3곳(GPT/Gemini/Cursor)에 v1 공유 가능
- [ ] 세로 슬라이스 범위 최종 승인

### M2 (1~2일) — 타입 및 인프라
- [ ] `types.ts` 스키마 추가
- [ ] `gameEngine.ts` 마이그레이션 (구세이브 호환)
- [ ] 헬퍼 함수 (슬롯 추가/제한/선택) 구현

### M3 (2~3일) — 세로 슬라이스
- [ ] `minjae-jealousy` 이벤트 구현 + memorySlot 생성
- [ ] `middle-burnout` 이벤트 구현
- [ ] Y3 milestoneScene 자동 기록
- [ ] `calculateEnding` 확장
- [ ] 엔딩 UI 회상 섹션

### M4 (0.5일) — 국소 D
- [ ] 자연 회복 0.15 → 0.12
- [ ] 학원비 의무 지출 (Y4+)

### M5 (0.5일) — 검증
- [ ] 검증 체크리스트 전부 통과
- [ ] 세로 슬라이스 플레이 후 "기억에 남는가" 체감 평가

### M6 (확장, 향후)
- 나머지 NPC 페어 관계 전염
- 소프트 위기 카탈로그 전체 구현
- `milestoneScenes` 7개 완성
- "기억 매개 상점" 재정의 (GPT 제안 카드)

---

## 10. 보류 카드

- **"기억 매개 상점"** (GPT): 상점을 스탯 효율이 아니라 "기억·관계 매개 장치"로 재정의. A+B+C-lite 세로 슬라이스 성공 시 검토.
- **재플레이 앨범/트로피** (E): A가 잘 작동하면 자연 발생 가능. 별도 작업 최소화.
- **피드백 지연 해소** (서브에이전트 지적): Persona 방식 카드 연출. 지금은 과함.

---

## 부록: 4개 리뷰 수렴 기록

- **Sub-agent**: A+B가 Tension 외면. 엔딩 공수 현실적 2~3일.
- **GPT**: 3가지 문제는 "기억에 남는 인과 부족" 하나. 태그 체계 + 세로 슬라이스.
- **Gemini**: 자연 회복 하향이 코드 한 줄에 효과 큼. "비 온 뒤 땅이 굳는" 톤.
- **Cursor**: 하드/소프트 위기 구분. 중간 클로저 설계. 기억 슬롯 스펙 = 3스텝보다 선행.

본 문서는 위 4가지 관점을 통합한 v1 합의안이다.
