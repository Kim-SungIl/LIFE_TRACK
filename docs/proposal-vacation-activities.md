# 방학 시스템 개편 — Phase 분리 명세 v2

> 작성일 2026-05-03 (v2). v1은 1차 시안, v2는 GPT/Gemini/Cursor 3-AI 리뷰 반영.
> 게임: LIFE_TRACK — 한국형 성장 시뮬레이션 (초6 → 고3, 7년 336주)

---

## 0. 한 줄 요약

**방학은 "효율 1.5배 주간"이 아니라, 학기와 규칙이 바뀌는 미니 시즌이다.**
이 정의를 코드·콘텐츠·연출 단에 단계적으로 깐다.

---

## 1. 배경 — 진단으로 확인된 문제

3개 자동 스크립트로 검증:

### 1.1 활동 풀 (가장 직접적)
- `getAvailableActivities(state)`에 `isVacation` 분기 자체가 없음
- 17개 활동 모두 학기/방학 동일 노출
- 방학 차이는 단지 "주말 슬롯 2 → 방학 슬롯 5"로 양만 늘어남

### 1.2 이벤트 게이팅 (`report-vacation-gating.ts`)
- 105개 중 **40개(38%)가 `!s.isVacation` 가드** 보유
- 방학 전용 이벤트는 단 **2개**
- **Y1 방학 12주 중 6주는 발화 가능 이벤트 0개**
- 방학 발화 풀 비율: Y1 8% / Y2~Y4 3% / Y5~Y7 11~19%

### 1.3 학년별 분포 (`report-year-distribution.ts`)
- Y4(중3)이 가장 빈약 (적격 27개)
- Y4 단독 이벤트 단 2개 (middle3-start, middle-school-graduation)
- Y2 빈 주 7주 모두 방학 주차

### 1.4 사용자 본질 요구
> "학기에 못한 재미를 방학에. 가난해도 진행 가능하고, 부자라도 배신감 없게."

---

## 2. 시스템 컨텍스트 (변하지 않는 제약)

### 2.1 부모 강점 wealth의 영향 (parentModifiers.ts:53)
| 항목 | wealth | non-wealth |
|------|--------|------------|
| 주간 용돈 | 6만원 | 3만원 |
| 주간 생활비 | -2.5만 | -1.2만 |
| 순 가용 (주당) | 3.5만 | 1.8만 |

**디렉터 승인 격차 ~840만/7년. 추가 확대 금지.**

### 2.2 방학 가용 예산
- 방학 11주 (여름 5 + 겨울 6) × 가용
- wealth 가정: ~38만 / non-wealth 가정: ~20만 (방학만 한정 시)

### 2.3 현재 활동 비용 분포
- 학기 활동 대부분 0~3만/주
- 방학 활동 비용 상한 -8만은 "한 번 큰맘 먹는 지출" 메타포

---

## 3. Phase 분리 — 전체 로드맵

```
Phase 1   : 방학 활동 시스템 (게이팅 + 9개 활동 + 인플레 방지)        [이번 PR]
Phase 1.5 : 방학 한정 콘텐츠 (NPC 초대 + Y4 겨울 + 안내문)            [다음 PR]
Phase 2   : 관계의 방학 (NPC 동행 + Vacation Momentum)               [후속 스프린트]
Phase 3   : 탐색의 방학 (방학 목표 + 진로 플래그 + 부모 분기)          [장기 백로그]
Phase 4   : 연출의 방학 (CG / 시각 피드백 / 음악 톤 변화)              [아트 의존]
```

---

## 4. Phase 1 — 활동 시스템 (이번 PR 범위 확정)

### 4.1 목표
**"방학에 들어가면 학기 활동 풀이 바뀌고, 방학 전용 활동이 노출된다."**

이 한 문장 체감을 코드·UI 단에서 보장.

### 4.2 구현 변경

#### (a) 타입 확장 — `engine/types.ts`
```ts
export interface Activity {
  // 기존 필드 유지
  seasonGate?: 'vacation-only' | 'semester-only';
  vacationLimit?: number;        // 방학당 최대 선택 횟수 (없으면 무제한)
  catchupBonus?: {               // 낮은 스탯 보정
    targetStat: StatKey;
    threshold: number;           // 이 값 미만이면 적용
    bonusEffects: Partial<Stats>;
  };
}
```

#### (b) 활동 게이팅 — `engine/activities.ts`
```ts
export function getAvailableActivities(state: GameState): Activity[] {
  return ACTIVITIES.filter(a => {
    if (a.category === 'parent' && a.requires && !a.requires(state)) return false;
    if (a.category === 'work' && state.year < 4) return false;
    if (a.seasonGate === 'vacation-only' && !state.isVacation) return false;
    if (a.seasonGate === 'semester-only' && state.isVacation) return false;
    return true;
  });
}
```

#### (c) 방학당 횟수 제한 — `state.vacationActivityCounts`
- 방학 시작 시 리셋 (W20 / W43 진입 시)
- 활동 선택 시 +1, `vacationLimit` 초과면 disable

#### (d) catch-up 보너스 적용 시점
주간 처리(`processWeek`)에서 활동 효과 적용 시:
```ts
if (activity.catchupBonus && state.stats[catchupBonus.targetStat] < catchupBonus.threshold) {
  // bonusEffects 추가 적용
}
```

baseline 단순화: **각 스탯 50 미만이면 catch-up 트리거** (학년·부모 무관).

#### (e) 학기 활동 자동 변환 (Cursor 제안 채택, 최소 변경 형태)
- `academy` 활동: 방학 진입 시 description/flavor를 "단기특강"으로 동적 표시
- 비용·효과는 그대로 (코드 분기 단순화)
- 변경 파일: `ActivityPicker.tsx`에서 `state.isVacation` 분기로 description 오버라이드만

### 4.3 활동 9종 최종 확정

#### 무료 활동 4개 (가난한 가정 보장)

| ID | 이름 | 슬롯 | 효과 | 피로 | 비용 | 1회 제한 |
|---|---|---|---|---|---|---|
| `vacation-library` | 방학 도서관 몰입 | 2 | academic +3, mental +1 | +3 | 0 | 무제한 |
| `creative-project` | 장기 창작 프로젝트 | 2 | talent +3, mental +1 | +5 | 0 | 무제한 |
| `countryside` | 시골/할머니댁 | 2 | mental +5, health +3 | -15 | 0 | **방학당 1회** |
| `do-nothing` | 집에서 푹 쉬기 | 2 | mental +4 | -20 | 0 | **방학당 1회** |

#### 저비용 사회성 1개

| ID | 이름 | 슬롯 | 효과 | 피로 | 비용 | 1회 제한 |
|---|---|---|---|---|---|---|
| `neighborhood-hangout` | 동네 친구와 보내는 방학 | 1 | social +3, mental +1 | +3 | 0 | 무제한 |

→ 1슬롯이라 부담 적고, 가난해도 사교 플레이 가능.

#### 유료 활동 3개

| ID | 이름 | 슬롯 | 효과 | 피로 | 비용 | 1회 제한 |
|---|---|---|---|---|---|---|
| `intensive-academy` | 학원 단기특강 | 2 | academic +4 | +12 | -6만 | 방학당 2회 |
| `sports-camp` | 스포츠 캠프 | 2 | health +4, talent +1, social +2 | +8 | -5만 | **방학당 1회** |
| `family-trip` | 가족 여행 | 2 | mental +5, social +2, health +1 | -5 | -8만 | **방학당 1회** |

#### 알바 (Gemini·Cursor 제안 채택) 1개

| ID | 이름 | 슬롯 | 효과 | 피로 | 수입 | 학년 | 1회 제한 |
|---|---|---|---|---|---|---|---|
| `short-term-job` | 방학 단기 일손 돕기 | 2 | social +1 | +12 | **+8만** | Y4+ | 방학당 2회 |

→ 학기 편의점 알바(+3~4만/주)보다 시급 높음. 피로 큼.
→ **non-wealth 역전 드라마 트리거**: 단기알바 ×2 = +16만 → family-trip + intensive-academy 가능.

**학년별 description 분기**:
- Y4 (중3): "친척 가게나 동네 행사 보조. 어른들 사이에서 종일 도왔다."
- Y5~Y7 (고등): "단기 아르바이트, 행사 스태프, 매장 보조. 시급은 짜지만 그래도 내 손으로 번 돈."

> **이름 변경 이유** (3-AI 리뷰): 중3에게 "택배/과외"는 현실성 부족. "단기 일손 돕기"로 가정·동네 단위 일감을 자연스럽게 포함.

### 4.4 catch-up 보너스 (스탯 < 50일 때 적용)

| 활동 | catch-up 추가 효과 |
|---|---|
| `vacation-library` | academic < 50이면 academic +1 추가 |
| `creative-project` | talent < 50이면 talent +1 추가 |
| `intensive-academy` | academic < 50이면 academic +1 추가 |
| `sports-camp` | health < 50이면 health +1 추가 |
| `neighborhood-hangout` | social < 50이면 social +1 추가 |
| `do-nothing` | fatigue ≥ 70이면 fatigue 추가 -5 |

**원칙**: 못한 사람만 따라잡고, 잘한 사람은 catch-up 없음. → wealth 격차 확대 방지.

### 4.5 방학 시작·마무리 안내

#### 방학 시작 (W20, W43)
schoolLevel별 분기:
- 초등: "방학식이 끝났다. 가방이 평소보다 가볍게 느껴졌다."
- 중등: "방학이 시작됐지만, 숙제와 학원 일정표가 먼저 눈에 들어왔다."
- 고등: "방학이라는 말이 예전처럼 가볍게 들리지는 않았다."

#### 방학 마무리 (W24, W48 마지막 주)
선택한 활동 카테고리 합산해서 한 줄 회고:
- "이번 방학은 도서관에서 많은 시간을 보냈다."
- "이번 방학에는 푹 쉬었다."
- "이번 방학에는 가족과의 시간이 많았다."

(memorySlot 직접 생성은 안 함 — Phase 1.5에서 검토)

### 4.6 인플레이션 방지 장치 (요약)

1. **횟수 제한** — countryside / do-nothing / sports-camp / family-trip는 방학당 1회
2. **catch-up은 낮은 스탯에만** — 잘한 사람은 보너스 없음
3. **slot 비용** — 강한 활동은 2슬롯 (가용 5슬롯 중 40%)
4. **유료 가성비 vs 슬롯·돈 트레이드오프** — 같은 효과를 무료로 얻을 길도 항상 보장

### 4.7 변경 파일 목록 (예상)
- `engine/types.ts` — Activity 필드 추가
- `engine/activities.ts` — 9개 활동 추가, 게이팅 함수
- `engine/gameEngine.ts` — vacationActivityCounts 리셋, catch-up 적용
- `components/ActivityPicker.tsx` — "방학 한정" 배지, 횟수 표시, academy description 오버라이드
- `components/GameScreen.tsx` — 방학 시작/마무리 안내 문구
- `scripts/report-vacation-gating.ts` — 활동 풀도 진단하도록 확장 (선택)

### 4.8 세이브 호환
- 신규 필드는 모두 optional → 기존 세이브 로드 시 undefined로 처리 (방학당 횟수 0으로 초기화)
- 게임 진행 중 방학 시작 시점에 자연 정상화

### 4.9 기존 시스템과의 정합성 — "좀비 티켓" 발견

상점 시스템(`shopSystem.ts`)에 이미 방학 관련 인프라가 존재함:

| ID | 가격 | 효과 | 상태 |
|---|---:|---|---|
| `camp-fee` | 8만 | 4주간 모든 활동 효율 +15% buff | `seasonal: true` (방학 한정) ✓ 작동 |
| `contest-fee` | 3만 | event_unlock: 'contest' + talent +2 즉시 | **이벤트 미구현** (좀비) |
| `portfolio-kit` | 10만 | event_unlock: 'portfolio' + talent/aca 즉시 | **이벤트 미구현** (좀비) |

**인프라 재사용 가능**:
- `seasonal: true` 필드 + 방학 게이팅 (shopSystem.ts:206) — 그대로 활용
- `event_unlock` 효과 타입 + `state.unlockedEvents` 배열 — Phase 1.5에서 활성화 대상
- `requireStat` / `requireYear` 조건 — Phase 1 활동에는 사용하지 않음 (단순화 우선)

**Phase 1 처리 원칙**:
- 활동 9종은 **티켓과 별개로** 추가 (B 통합안은 Phase 2로 미룸 — 활동 prerequisite 시스템 추가 필요)
- 단 `sports-camp` 활동과 `camp-fee` 티켓의 개념 중복은 인지 — Phase 1.5에서 콘텐츠 결합으로 해소

**플레이어가 느낄 두 시스템 차이 (Phase 1 시점)**:
- 활동 (sports-camp, family-trip 등) = "이번 주에 ~한다" 즉시 효과, 슬롯 소비
- 티켓 (camp-fee 등) = "이번 방학 기간 효율 buff" 4주 지속, 슬롯 무관

→ 동시 사용 가능. 부유한 가정은 둘 다, 가난한 가정은 활동만 선택하는 자연스러운 차등.

### 5.1 목표
"활동만 늘면 버튼은 늘고 이야기는 빈다" 문제 해결.

### 5.2 작업 항목

#### (a) NPC 방학 초대 이벤트 (학년별 1~2개)
- 방학 첫 주(W20 또는 W43)에 친밀도 30+ NPC가 초대
- 선택 시 다음 주 활동에 NPC 동행 보너스 (companionNpcId는 Phase 2)
- 1차에서는 단순 이벤트 + 친밀도 +5 + memorySlot 시드

예:
- 지훈: "방학에 같이 운동장 나갈래?" → sports-camp 추천 분기
- 유나: "도서관에서 같이 자료 찾아볼래?" → vacation-library 분기
- 수빈: "단기특강 같이 들을래?" → intensive-academy 분기

#### (b) Y4(중3) 겨울방학 전용 이벤트 3~5개
- Y4 W43~48 한정
- 톤: "고입 전 마지막 긴 방학", "친구들이 다른 학교를 생각하기 시작"
- 위기성 1개 + 관계 1개 + 기회 1개

#### (c) 방학 빈 주 메우기 — 짧은 마이크로 이벤트
- Y1~Y3 방학 0건 주에 우선 배치
- 1~2 줄 텍스트, 선택지 없는 회고 또는 이미지 1장 + 한 줄

#### (d) family-trip 전용 회고 이벤트
- family-trip 선택한 주 다음 주에 짧은 회고 이벤트 (선택지 없는 1~2줄)
- 예: "여행에서 돌아온 첫날 밤, 사진을 정리하다가 한참을 앉아 있었다."
- GPT가 family-trip 3슬롯 권장한 것의 절충 — 슬롯 늘리는 대신 서사 보강

#### (e) 좀비 티켓 콘텐츠 활성화 — `contest` / `portfolio` / `camp` 이벤트 신설
**배경**: shopSystem에 이미 티켓 3종(camp-fee / contest-fee / portfolio-kit)이 있는데, 해금되는 이벤트가 events.ts에 없어서 "사도 아무 일도 안 일어나는" 상태. §4.9 참조.

**작업**:
1. `getEventForWeek()`에 `state.unlockedEvents` 체크 추가 — 해금된 이벤트만 발화 가능
2. 신규 이벤트 3개:
   - `contest-event`: 대회 참가비 구매 후 1~3주 내 발화. 수상/탈락 분기 + memorySlot 시드. talent 추가 보상
   - `portfolio-review`: 포트폴리오 구매 후 발화. 결과물 평가 분기. 입시 진로 플래그 (Phase 3 연계)
   - `camp-experience`: 캠프 참가비 + 방학 중 발화. 또래 만남 + NPC 친밀도 또는 신규 NPC 시드
3. 발화 후 `unlockedEvents`에서 제거 (1회용)

**효과**: 기존 인프라(seasonal·event_unlock·requireStat)가 살아남. 부유한 가정 차별화 콘텐츠가 "buff 4주"가 아닌 "기억에 남는 한 장면"으로 진화.

#### (f) sports-camp 활동과 camp-fee 티켓 결합 검토
- 현재는 별개로 동시 사용 가능 (§4.9)
- Phase 1.5에서 결합 옵션 검토:
  - 옵션 1: sports-camp 활동 선택 시 camp-fee 자동 동의 (UI 통합)
  - 옵션 2: 그대로 분리 유지 (활동 = 즉시 / 티켓 = buff)
- 시뮬 결과 보고 결정 — Phase 2의 prerequisite 시스템과 같이 가는 것이 적절할 수 있음

### 5.3 변경 파일
- `engine/events.ts` — 신규 이벤트 (NPC 초대 + Y4 겨울 + 빈 주 + family-trip 회고 + contest/portfolio/camp)
- `engine/gameEngine.ts` — `getEventForWeek`에 `unlockedEvents` 체크 연결
- `engine/memorySystem.ts` — 필요 시 시드 카테고리 추가

---

## 6. Phase 2 — 관계의 방학 (별도 스프린트)

### 6.1 목표
"방학은 NPC 관계가 움직이는 시즌이다."

### 6.2 작업 항목
- `Activity.companionNpcId?: string` — 방학 활동에 NPC 동행
- NPC 초대 수락 시 다음 주 활동에 친밀도 +N 보너스 + 선택지 텍스트 변형
- **Vacation Momentum 시스템**: 방학 활동 카테고리에 따라 다음 학기 4~8주간 효율 +10%
  - vacation-library → 다음 학기 self-study 효율 +10%
  - creative-project → 다음 학기 art-lesson/creative 효율 +10%
  - sports-camp → 다음 학기 운동 카테고리 효율 +10%
- UI: 학기 시작 시 "이번 학기의 흐름: 공부 리듬 회복" 안내
- **활동 prerequisite 시스템** (Phase 1.5 (f) 결합 결정 시 도입):
  - `Activity.requiresUnlockedEvent?: string` 또는 `requiresItem?: string`
  - 예: sports-camp 선택 가능 조건 = camp-fee 보유
  - 티켓 ↔ 활동 통합 → 부유한 가정의 "캠프"가 활동·티켓·이벤트 3중 결합으로 강화

### 6.3 변경 규모
- types.ts (companionNpcId, vacationMomentum 필드)
- gameEngine.ts (Momentum buff 적용)
- 컴포넌트 UI 다수

---

## 7. Phase 3 — 탐색의 방학 (장기 백로그)

### 7.1 목표
"방학은 새로운 자기 발견의 시기다."

### 7.2 작업 항목
- **방학 목표 시스템 (Gemini 제안)**: 방학 시작 시 1~2개 목표 설정
  - 예: "수학 정복", "체력 회복", "단편 완성"
  - 달성 시 memorySlot 강제 생성 + 학년말 일기 보너스
- **진로/취향 플래그 시스템 (GPT 제안)**: 활동 누적으로 진로 플래그 발견
  - 예: creative-project ×3회 → "예술적 성향" 플래그
- **부모 성향별 family-trip 분기 (GPT 제안)**: wealth는 고급 여행 CG, freedom은 자율 일정, strict는 학습 압박 분기
- **장학금/조기예약 할인 (Gemini 제안)**: 학기 중 특정 조건 달성 시 다음 방학 활동 비용 할인

### 7.3 보류 이유
- 신규 시스템 다수 (목표·플래그·할인 모두 새 자료구조)
- UI 노출 영역 큼
- Phase 1·2 안정화 후 도입

---

## 8. Phase 4 — 연출의 방학 (아트 의존, 가장 후순위)

### 8.1 작업 항목
- 방학 전용 배경 (해변·시골·도서관 가을·눈 내리는 동네)
- 활동 결과 CG (가족 여행 / 캠프 / 시골 할머니댁)
- 시각 피드백 (Gemini 제안): 캐릭터 아바타 변화 (탄 피부, 결과물 책상 위)
- 방학 전용 BGM/효과음

### 8.2 보류 이유
- 아트 파이프라인 의존
- Phase 1~3 시스템 확정 후 일괄 진행이 효율적

---

## 9. Phase 1 검증 결과 (3-AI 리뷰 종합, 2026-05-03)

3개 AI(GPT / Cursor / Gemini)에 v2 던져서 받은 답변 정리.

### 질문 A — 시스템 vs 이벤트 우선순위

| AI | 의견 |
|---|---|
| GPT | 활동 시스템 먼저. 단 시작/마무리 안내는 Phase 1에 필수 |
| Cursor | 활동 시스템 우선. 안내문이 1차 PR의 콘텐츠 빈자리 완충 |
| Gemini | 활동 시스템 우선. 시스템은 7년 14회 방학 관통하는 기반 |

**만장일치 → Phase 1 활동 시스템 우선 확정.** v2 그대로.

### 질문 B — short-term-job 수치

| AI | 의견 | 추천 수입 |
|---|---|---|
| GPT | +8만 × 2회 = +16만은 메타화 위험. **+6만 권장** | +6만 |
| Cursor | 방향 타당. **시뮬 1회로 메타화 여부 확인** | 현 수치 OK (시뮬 후 조정) |
| Gemini | +8만 매우 적절. 역전 시나리오 핵심 | +8만 유지 |

**판단**: 2:1로 +8만 유지 의견. **v3 결정 = +8만 그대로 두되, Phase 1 PR 직후 시뮬레이션 의무**.
- 시뮬에서 "알바 2회 + 회복 1회"가 매 방학 정답 루틴으로 보이면 +6만으로 다운그레이드
- 이름·카피만 수정 (택배/과외 → 단기 일손 돕기) — 한국 정서상 중3 현실성

### 질문 C — catch-up threshold 50 vs 45

| AI | 의견 | 추천 |
|---|---|---|
| GPT | 50은 관대. 초중반 항상 발동. **45 권장** | 45 |
| Cursor | 50은 합리적 1차값. 발동 빈도는 시뮬 리포트로 조정 | 50 OK |
| Gemini | Phase 1엔 50 적절. 향후 동적 baseline 권장 | 50 OK |

**판단**: 2:1로 50 유지. **v3 결정 = threshold 50 그대로**.
- catch-up 효과가 +1 수준이라 인플레보다 저능선 완충 쪽으로 작동 (Cursor 분석)
- 시뮬 리포트에서 "매 방학 거의 모든 활동에서 발동"이 보이면 그때 45로 조정
- Phase 3에서 학년별 동적 baseline 검토 (Gemini 제안)

### 추가 채택/보류 사항

| 제안 | 출처 | 채택 여부 |
|---|---|---|
| do-nothing 이름 → "집에서 푹 쉬기" | GPT | **채택** (UI 친화) |
| short-term-job 이름 → "단기 일손 돕기" | GPT | **채택** (현실성) |
| 1회 제한 활동 UI 명확 표시 | Gemini | **채택** (구현 시 자연 반영) |
| countryside 너프 (-1/-1) | GPT | **보류** (Gemini는 do-nothing 우려 / 시뮬로 검증) |
| neighborhood-hangout social +3→+2 | GPT | **보류** (다른 AI 미언급 / 시뮬로 검증) |
| family-trip 3슬롯 | GPT | **이견 (2슬롯 유지)** + Phase 1.5에서 회고 이벤트로 보강 |
| do-nothing 효율 모니터링 | Gemini | Phase 1 시뮬 리포트 항목으로 추가 |

---

## 10. 다음 액션

1. ~~3-AI 리뷰~~ ✅ 완료
2. ~~수치 조정 (이름·카피만 v3 반영)~~ ✅ 완료
3. **Phase 1 PR 생성** (변경 파일 6개 예상, +500/-50 라인)
4. **PR 머지 직후 시뮬 검증 의무** — 다음 4개 리포트 항목 측정:
   - short-term-job 평균 선택 회수 (방학당 1.5 초과 시 +6만으로 다운그레이드)
   - catch-up 발동 빈도 (학년별 평균 3회 초과 시 threshold 45로 조정)
   - "알바 2회 + 회복 1회" 패턴 출현 빈도 (메타화 지표)
   - countryside / do-nothing / family-trip 선택률 (한쪽으로 쏠림 확인)
5. 시뮬 결과 반영 후 Phase 1.5 착수

---

## 11. 변경 이력

- v1 (2026-05-03 초안): 활동 6종 시안 + 리뷰 5개 질문
- v2 (2026-05-03 갱신): 3-AI 1차 리뷰 반영, Phase 4단 분리, 활동 9종 확장, catch-up·횟수제한 추가
- v3 (2026-05-03 마감): 3-AI 2차 검증 반영. 수치는 v2 유지(다수결), 이름·카피 수정, §9를 검증 결과 요약으로 대체, 시뮬 검증 액션 추가
- v3.1 (2026-05-03): "좀비 티켓" 발견 반영. §4.9 기존 시스템 정합성 추가, Phase 1.5에 (e)(f) 추가 (티켓 콘텐츠 활성화 + 활동·티켓 결합 검토), Phase 2에 prerequisite 시스템 추가
