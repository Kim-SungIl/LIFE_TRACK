# Phase 2.3 미니 이벤트 풀 확장 — AI 발주용 프롬프트 (2026-05-14)

> `11_미니이벤트설계.md` Phase 2.3 작업용 핸드오프 문서.
> 6명 NPC(jihun/subin/minjae/yuna/haeun/junha)의 **친밀도 70 단계 미니 이벤트 시드 1개씩**을 받아옴.
> Phase 2.2(PR #128, #135) 흐름과 동일 — 여러 AI에게 발주 후 NPC별 채택.

---

## 사용법

아래 "AI에게 줄 프롬프트" 섹션 전체를 ChatGPT/Gemini/Claude(웹) 등에 복사·붙여넣기.
나온 결과 중 톤이 맞는 시드만 골라서 `game/src/engine/talkSystem.ts`의 `NPC_MINI_EVENTS` 배열에 추가.

> ⚠️ **메인 이벤트(events.ts)가 아닌 미니 이벤트(talkSystem.ts)** 작업입니다.
> 선택지 없음, 효과 한 줄, NPC당 평생 1회.

> 📌 **Phase 2.2와 차이**: 70 단계는 일부 시드가 `memorySlotDraft` (importance 3) **후보**가 됨. 모든 시드에 추가하지 말 것 — 톤상 진짜 결정적인 한 장면에만.

---

## AI에게 줄 프롬프트 (이 아래부터 복사)

당신은 한국 학교생활을 다루는 성장 시뮬레이션 게임의 시나리오 작가입니다. 게임의 **미니 이벤트(말걸기 시스템)** 풀을 확장하는 작업을 의뢰합니다.

### 게임 배경

- 한국의 12세(초6) → 18세(고3)까지 7년간 학교생활을 시뮬레이션
- 학년 매핑: Y1=초6, Y2=중1, Y3=중2, Y4=중3, Y5=고1, Y6=고2, Y7=고3
- NPC와 친밀도(0~100)를 쌓아가는 게임

### 미니 이벤트란?

"말 걸기" 버튼 클릭 시 매주 0~1회 발동되는 짧은 장면. **선택지 없음**, description + 효과 한 줄로 끝. NPC당 평생 1회만 발동 후 풀에서 영구 제외(`talkEventsFired` 기록).

### 이번 작업의 목표

**친밀도 70 단계 미니 이벤트 시드 6개**를 작성합니다.

| NPC | 30 단계 | 50 단계 | 70 단계 (이번 작업) |
|---|---|---|---|
| jihun | ✅ basket/badminton | ✅ topping (떡볶이) | 신규 |
| subin | ✅ problem | ✅ sentence (접힌 페이지) | 신규 |
| minjae | ✅ notes | ✅ wrong_answer_mark (오답표시) | 신규 |
| yuna | ✅ song | ✅ humming (즉흥 멜로디) | 신규 |
| haeun | ✅ quiet | ✅ window (창문 신호) | 신규 |
| junha | ✅ riceball | ✅ seabreeze (부산 바람) | 신규 |

**도윤 제외** — Y2 W2 학군 이사로 자연소멸.

총 **6개 시드**.

### 친밀도 70 단계의 톤 — "속마음 한 조각"

| 단계 | 톤 | 한 줄 정의 |
|---|---|---|
| 30 (시드 존재) | 가벼운 호의 | "같이 뭐 할래?" 활동 제안 |
| 50 (시드 존재) | 두 사람만의 일상 코드 | "그거 또 시작이네" 둘만의 약속·습관 |
| **70 (이번 작업)** | **속마음 한 조각** | **"...너한테만 말하는 건데" 평소 안 보이는 약한 면** |
| 90 (이후 Phase) | 캐릭터 결정적 한 장면 | 메모리 슬롯 importance 5 필수 |

**70 단계의 핵심**: 그 NPC의 **공식 페르소나가 살짝 깨지는 한순간**.
- 활발한 지훈이 처음으로 진지하거나
- 외향형 수빈이 무리 속 외로움을 짧게 흘리거나
- 자랑 페르소나의 민재가 약한 면을 보이거나
- 밝은 유나가 1등 압박을 흘리거나
- 침묵형 하은이 자기도 모른다는 고백을 하거나
- 직설적 준하가 향수병을 가볍게 토로하거나

**중요**: 70 단계는 **고백·울음·진로 결단 같은 큰 사건은 X** (그건 90 단계 코어 영역). "평소엔 안 보이는 결" 정도의 가벼운 균열.

### 게임 정서 (반드시 지킬 것)

**DO ✅**
- **노스탤지아 한국 학교**: 급식, 분식집, 학원, 단톡, 도서관, 옥상, 매점, 단원평가, 운동회
- **잔잔한 일상의 무게**: 거대한 사건 X, 작은 순간이 누적되는 감각 O
- **공식 페르소나 살짝 균열**: 평소 안 보이는 결이 짧게 드러나고 끝
- **그 NPC만의 디테일**: "다른 NPC로 바꿔도 통하면 빈약" — 그 캐릭터만 할 수 있는 행동·말투
- **회상형 톤**: 어른이 된 화자가 그때를 떠올리는 듯한 차분한 서술

**DON'T ❌**
- **선택지 절대 금지** — 미니 이벤트는 짧은 장면 + 효과 한 줄
- 종결형 묘사 (`"~하고 헤어졌다"`, `"~하고 가버렸다"`, `"그게 다였다"`) — 진행 중 한 장면
- 학년 종속 표현 (`"야자"` `"수능"` `"대학"`) — 학년 무관 (junha는 예외)
- **큰 사건·결단·울음·고백 클라이맥스** — 그건 90 단계 코어 영역
- 게임에 없는 시스템 가정 (선물 X, 사진 공유 X)
- 한 NPC 일화에 다른 NPC가 주연으로 끼어들기 (조연 언급은 OK)

### NPC 프로필 (작업 대상 6명)

| ID | 이름 | 캐릭터 |
|---|---|---|
| `jihun` | 지훈 | 활발한 소꿉친구. 농구·게임·분식·PC방. 단순해 보이지만 챙기는 결. 진로는 운동 쪽 (체육 특기생 고민). |
| `subin` | 수빈 | 외향형이지만 어느 그룹에서든 "같이 어울리는 애". **엄마와 둘이 산다** (부모 이혼, intimacy 깊어지면 드러남). 시·문장 좋아함. |
| `minjae` | 민재 | 전교 1등 노력형. 새벽까지 공부하고 아침에 태연한 척. 위악적 자랑("어제 3시까지 공부했어")과 진짜 약한 면("...떨어지면 어쩌지") 공존. 학원 원장 엄마 + 교사 아빠 교육 가정. |
| `yuna` | 유나 | 밝고 에너지 넘치고 피아노도 잘 침. 밝음 뒤 "1등 놓치면 안 된다" 압박. 음악·감각·즉흥성. |
| `haeun` | 하은 | 학교 선배 (Y2~). 침묵형, 자판기 옆 콜라. "선배라고 다 아는 건 아냐". 멘탈/위로 톤. |
| `junha` | 준하 | 부산 전학생 (Y5~). 사투리 ("~제, ~노"). 요리 잘함 (주먹밥). 향수병. |

### 기존 시드 (중복 회피 — 절대 같은 결 반복 X)

```typescript
// ===== 친밀도 30 단계 =====
talk_jihun_basket(남)/badminton(여): "야 한판 갈래?" 운동
talk_subin_problem: "이 문제 답지 봐도 이해 안 돼" 노트
talk_minjae_notes: "노트 빌려줄까? 어차피 내가 다시 정리할 거니까"
talk_yuna_song: "이 노래 들어봐, 너 좋아할 것 같아" 이어폰
talk_haeun_quiet: "...괜찮아?" 자판기 옆 콜라
talk_junha_riceball: "이거 어제 만들어봤어" 주먹밥

// ===== 친밀도 50 단계 =====
talk_jihun_50_topping: 떡볶이 토핑 "너 이거 꼭 국물에 부셔 먹잖아" — 식성 기억
talk_subin_50_sentence: "이 문장, 너 생각나서 접어놨어" — 책 속 한 줄 공유
talk_minjae_50_wrong_answer_mark: 오답노트 작은 세모 "남한텐 안 보여줘. 좀 유치해서"
talk_yuna_50_humming: "너랑 떠들다 보니까 갑자기 생각났어" — 즉흥 멜로디 공유
talk_haeun_50_window: "오늘은 대답 안 해도 되는 날" — 창문 신호 (둘만의 규칙)
talk_junha_50_seabreeze: "이 바람은 좀 부산 같다. 진짜로" — 향수 가볍게
```

### ⚠️ NPC별 회피 노트 (Phase 2.2 lessons learned)

**70단계 작성 시 절대 같은 축 반복 금지**:

- **jihun**: 운동(30) / 분식·식성(50) 이미 썼음 → 70은 다른 축 (게임/PC방, 부모 잔소리, 진로 고민, 친구 관계 등)
- **subin**: 노트·문제풀이(30) / 책·문장(50) 이미 썼음 → 70은 다른 축 (가족·엄마 화제, SNS·교우관계 피로, 학원 외 일상 등)
- **minjae**: **노트(30) / 오답표시(50)** 둘 다 학습 도구 축 → **70은 절대 노트·공부 도구 X** (집·부모·새벽 시간·약한 면 노출 등)
- **yuna**: 노래(30) / 즉흥 멜로디(50) 음악 축 → 70도 음악 가능하나 1등 압박·창작 부담 쪽으로 깊어져야 함 (단순 음악 공유 X)
- **haeun**: 자판기·콜라(30) / 창문 신호(50) 침묵 위로 축 → 70은 자기 자신의 결 드러내기 (선배도 모른다는 결, 자기 불안 짧게 노출)
- **junha**: 주먹밥(30) / **바람·향수(50)** 이미 향수 결 사용 → **70은 절대 바람/부산/향수병 X** (가족·엄마 식당 일·서울 친구 적응 등 다른 축)

### MiniTalkEvent 타입 시그니처

```typescript
export interface MiniTalkEvent {
  id: string;                            // 'talk_<npcId>_70_<keyword>' 형식
  npcId?: string;
  intimacyMin?: number;                  // 70으로 설정
  gender?: 'male' | 'female';            // 톤 분기 시만
  description: string;                   // 본문 (NPC 대사 + 상황, 1~3줄)
  effects: {
    intimacy?: number;                   // 70 단계: +4 (고정)
    stats?: Partial<Stats>;              // academic / social / talent / mental / health
    fatigue?: number;                    // ±1~2
    money?: number;                      // ±1~2 (드물게)
  };
  message: string;                       // 효과 한 줄 요약
  // 70 단계: 톤이 강한 시드에 한해 memorySlotDraft 후보 (선택적, 6개 중 2~3개 정도)
  memorySlotDraft?: {
    category: 'discovery' | 'reconciliation' | 'growth' | 'courage' | 'failure';
    importance: 3;                       // 70 단계는 importance 3 고정 (90 단계가 5)
    toneTag?: 'warm' | 'regret' | 'resolve' | 'quiet';
    recallText: string;                  // 20~35자, 회상형, 스탯 단어 금지
    npcIds: [string];
  };
}
```

### 효과 가이드라인 (친밀도 70 단계)

| 항목 | 권장 범위 | 비고 |
|---|---|---|
| `intimacy` | **+4** (고정) | 11_미니이벤트설계.md §2-2 |
| `stats.*` | ±1~2 (mental 위주) | 감정형 톤이라 mental ±2 자주 |
| `fatigue` | **±1** (엄밀히) | Phase 2.2에서 -2 위반 사례 있었음 — 가이드라인 준수 |
| `money` | ±1 (드물게, 보통 0) | 일상 잡담이라 돈 안 드는 게 보통 |
| `memorySlotDraft` | **선택적**, 6개 중 2~3개만 | 톤이 진짜 결정적인 시드에만 |

**메모리 슬롯 후보 판단 기준**:
- 그 NPC의 페르소나가 명확히 균열되는 한순간인가?
- 7년 후 엔딩 회상에서 떠올릴 만한 결인가? (90 단계만큼은 아니어도)
- recallText로 20~35자 회상문이 자연스럽게 나오는가?
- 위 3가지 모두 ✅이면 importance 3 후보. 하나라도 약하면 추가하지 말 것.

### 작성 체크리스트

각 시드 작성 시 다음을 확인:

- [ ] **그 NPC만 할 수 있는 일인가?** (다른 NPC로 바꿔도 통하면 빈약)
- [ ] **70 단계 톤("속마음 한 조각")에 맞는가?** 50 단계 일상 코드 수준이거나 90 단계 결정적 사건 수준이면 X
- [ ] **회피 노트 준수** — 위 §"NPC별 회피 노트"의 같은 축 반복 X
- [ ] **선택지 없음** (description + effects + message만)
- [ ] **큰 사건·결단·고백 클라이맥스 없음** (90 영역)
- [ ] **학년 종속 표현 없음** (junha는 예외)
- [ ] **효과 가이드라인 준수** (intimacy +4, fatigue ±1 등)
- [ ] **memorySlotDraft는 선택적** — 무조건 추가하지 말 것

### 출력 포맷

JavaScript/TypeScript 객체 형태로 코드 그대로 붙여넣을 수 있게:

```typescript
// === 친밀도 70 단계 시드 6개 ===

const NEW_MINI_EVENTS = [
  // jihun 70
  {
    id: 'talk_jihun_70_<keyword>',
    npcId: 'jihun', intimacyMin: 70,
    description: '<NPC 대사 + 상황 1~3줄>',
    effects: { intimacy: 4, stats: { ... }, fatigue: ±1 },
    message: '<효과 한 줄 요약>',
    // memorySlotDraft가 필요하면 (선택적):
    // memorySlotDraft: { category: 'discovery', importance: 3, ... }
  },
  // subin 70, minjae 70, yuna 70, haeun 70, junha 70
];

// === 추가 메모 ===
// - 각 시드별 작성 의도 한 줄
// - 어느 축을 잡았는지 (회피 노트 준수 확인)
// - memorySlotDraft 추가한 시드면 그 이유
// - 추가 안 한 시드면 왜 안 추가했는지 (톤 약함, 결정적 결 아님 등)
```

description 톤 예시 (참고):
> `"...야 너네 부모님은 시험 점수 떨어지면 뭐라셔?"`
> 지훈이가 음료수를 까며 짧게 한숨을 쉰다. 내가 답하기도 전에 "...우리 엄마는 또 학원 늘리자 그러시더라." 평소 농구장 톤이 아닌, 처음 보는 결이다.

NPC의 짧은 직접 대사(큰따옴표) + 행동/상황 묘사. 종결형 묘사 절대 금지(`"~하고 가버렸다"` X). 진행 중인 한 장면이어야 함.

---

## (이 아래부터는 복사 X — 사용자 분 메모용)

### 채택 후 적용 위치

`game/src/engine/talkSystem.ts`의 `NPC_MINI_EVENTS` 배열에 신규 객체 6개 append (50 단계 시드 6개 뒤).

신규 시드 ID 작명 규칙: `talk_<npcId>_70_<keyword>`

### Phase 2.2 lessons learned 반영 사항

본 프롬프트는 PR #125(tier-50 발주)를 기본으로 하되 다음을 추가/강화:

1. **NPC별 회피 노트 (신규)** — 30/50 단계와 같은 축 반복 금지 명시
   - minjae/junha는 특히 강한 가드 (각각 학습도구 / 향수 축 이미 2회 사용)
2. **메모리 슬롯 정책 신규** — Phase 2.4 importance 5와 구분된 importance 3 후보 정의
3. **효과 가이드라인 엄밀화** — fatigue ±1 명시 (Phase 2.2 jihun -2 위반 사례 반영)
4. **70 단계와 90 단계 경계 강조** — 70은 균열, 90은 결정적 장면

### 검증 절차 (채택 후)

1. AI 결과 3~4개 모아서 NPC별 톤 좋은 시드 채택
2. `talkSystem.ts`에 객체 추가
3. `npx tsc --noEmit -p tsconfig.app.json` — typecheck
4. `npx tsx scripts/verify-followup-chain.ts` — 회귀 없음
5. `npx tsx scripts/sim-y1-qa-matrix.ts` — 0 실패
6. **신규**: `verify-tier50-mini-events.ts` 복제 → `verify-tier70-mini-events.ts` (TIER50_SEEDS 배열만 갈아끼움) 작성 + 실행
7. 인게임: 친밀도 70 도달 → 잡담 클릭 → 새 미니 이벤트 발동 확인 (NPC 6명)
8. memorySlotDraft 추가한 시드는 회상 화면에서 슬롯 생성 확인

### 톤 검증 (구현 PR 후)

PR #134(`docs/mini-talk-event-tone-review-2026-05-14.md`) 패턴 복제:
- `docs/mini-talk-event-tone-review-tier70-YYYY-MM-DD.md` 작성
- 외부 AI 다회 검증
- 2~3 AI 공통 교체추천 NPC만 실제 교체

### 다음 Phase

- **Phase 2.4** (intimacy 90 코어): NPC 6명 × 1개, **모두 메모리 슬롯 importance 5 필수** — 사용자 주도 검토
- **Phase 2.5** (학년/시즌 게이팅): 기존 시드에 condition 추가 + 신규 시즌 이벤트

### 참고

- `11_미니이벤트설계.md`: 설계 SSOT — 친밀도 4단계, 효과 가이드, Phase 분할
- `docs/mini-talk-event-prompts-2026-05-13.md` (#125): Phase 2.2 발주 프롬프트 (선행 사례)
- `docs/mini-talk-event-tone-review-2026-05-14.md` (#134): Phase 2.2 톤 검증 패턴
- `game/scripts/verify-tier50-mini-events.ts` (#130): 코드 레벨 회귀 검증 (복제용)
- `game/src/engine/talkSystem.ts`: NPC_MINI_EVENTS 정의 위치
