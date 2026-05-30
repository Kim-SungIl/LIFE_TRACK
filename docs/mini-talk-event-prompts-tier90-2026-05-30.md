# Phase 2.4 미니 이벤트 풀 확장 — AI 발주용 프롬프트 (2026-05-30)

> `11_미니이벤트설계.md` Phase 2.4 작업용 핸드오프 문서.
> 6명 NPC(jihun/subin/minjae/yuna/haeun/junha)의 **친밀도 90 단계(코어) 미니 이벤트 시드 1개씩**을 받아옴.
> Phase 2.2(#128/#134) / 2.3(#140/#189) 흐름과 동일 — 여러 AI에게 발주 후 NPC별 채택.

---

## 사용법

아래 "AI에게 줄 프롬프트" 섹션 전체를 ChatGPT/Gemini/Claude(웹) 등에 복사·붙여넣기.
나온 결과 중 톤이 맞는 시드만 골라서 `game/src/engine/talkData.ts`의 `NPC_MINI_EVENTS` 배열에 추가(70 단계 시드 뒤).

> ⚠️ **메인 이벤트(events.ts)가 아닌 미니 이벤트(talkData.ts)** 작업입니다. 선택지 없음, 효과 한 줄, NPC당 평생 1회.

> 📌 **70 단계와 결정적 차이**: 90 단계는 **모든 시드에 `memorySlotDraft` importance 5가 필수**입니다(70은 선택적 importance 3). 이 슬롯은 회상 시스템 **최강 가중치** — 엔딩/학년말 회상에 "그 NPC다운 결정적 장면"으로 떠오릅니다.

> 🚨 **사용자 주도 채택 (절대 단순 채택 금지)**: importance 5 슬롯의 톤이 어긋나면 회상 시스템 **전체 톤**이 무너집니다. 외부 AI 결과를 그대로 넣지 말고, 캐릭터 결·톤을 직접 검수한 1개만 NPC별로 채택할 것.

---

## AI에게 줄 프롬프트 (이 아래부터 복사)

당신은 한국 학교생활을 다루는 성장 시뮬레이션 게임의 시나리오 작가입니다. 게임의 **미니 이벤트(말걸기 시스템)** 풀의 **최상위 단계(친밀도 90, 코어)**를 작성하는 작업을 의뢰합니다.

### 게임 배경

- 한국의 12세(초6) → 18세(고3)까지 7년간 학교생활을 시뮬레이션
- 학년 매핑: Y1=초6, Y2=중1, Y3=중2, Y4=중3, Y5=고1, Y6=고2, Y7=고3
- NPC와 친밀도(0~100)를 쌓아가는 게임

### 미니 이벤트란?

"말 걸기" 버튼 클릭 시 매주 0~1회 발동되는 짧은 장면. **선택지 없음**, description + 효과 한 줄로 끝. NPC당 평생 1회만 발동 후 풀에서 영구 제외(`talkEventsFired` 기록).

### 이번 작업의 목표

**친밀도 90 단계(코어) 미니 이벤트 시드 6개**를 작성합니다. 각 NPC의 친밀도 곡선의 **마지막 결정적 한 장면**입니다.

| NPC | 30 | 50 | 70 | 90 (이번 작업) |
|---|---|---|---|---|
| jihun | ✅ basket/badminton | ✅ topping (떡볶이 식성) | ✅ locker (운동≠공부싫음 자기인식) | 신규 |
| subin | ✅ problem | ✅ sentence (접힌 문장) | ✅ night_light (거실 불빛=가정사 암시) | 신규 |
| minjae | ✅ notes | ✅ wrong_answer_mark (오답 세모) | ✅ phone_call (기대 압박) | 신규 |
| yuna | ✅ song | ✅ humming (즉흥 멜로디) | ✅ chalk_dust (칭찬 압박) | 신규 |
| haeun | ✅ quiet | ✅ window (창문 신호) | ✅ direction (아는 척의 피로, 계단참) | 신규 |
| junha | ✅ riceball | ✅ seabreeze (부산 바람) | ✅ speech (사투리=정체성) | 신규 |

**도윤 제외** — Y2 W2 학군 이사로 자연소멸.

총 **6개 시드**.

### 친밀도 90 단계의 톤 — "캐릭터 결정적 한 장면 (코어)"

| 단계 | 톤 | 한 줄 정의 |
|---|---|---|
| 30 (시드 존재) | 가벼운 호의 | "같이 뭐 할래?" 활동 제안 |
| 50 (시드 존재) | 두 사람만의 일상 코드 | "그거 또 시작이네" 둘만의 약속·습관 |
| 70 (시드 존재) | 속마음 한 조각 | "...너한테만 말하는 건데" 평소 안 보이는 약한 면 (균열, 다시 일상으로) |
| **90 (이번 작업)** | **캐릭터 결정적 한 장면** | **그 NPC를 "그 NPC답게" 만드는 사건. 7년 후 회상으로 떠오를 한 장면.** |

**90 단계의 핵심**: 70이 "균열"이라면 90은 **전환점**. 그 NPC가 너에게(플레이어에게) **처음으로, 너이기 때문에** 보여주는 결정적 순간. 자기 고백(속내 털어놓기)·결심·인정처럼 **무게가 실린 한 장면**이되, 여전히 짧고 절제된 미니 이벤트 형식.

> ※ 여기서 "고백"은 **연애 고백이 아니라 자기 내면을 털어놓는 것**을 뜻합니다.

#### ⚠️ 70 vs 90 경계 (가장 중요)

- **70 = 한 조각/균열**: 스스로 멈추고 다시 일상으로 돌아감. 결정적 사건이 아님. (예: "가끔은 나도 잘하고 싶은 게 많아" 하고 작게 덧붙이고 끝)
- **90 = 결정적 전환점**: 그 NPC의 정체성·관계·미래가 걸린 한 장면. 무게가 실리되 **감정 폭발이 아니라 행동·관계 인식의 변화로** 드러낼 것. **멜로드라마·장황한 독백·눈물 클라이맥스 금지** — 절제가 격을 만든다.
- 70이 "지금 이 순간만" 드러나는 결이라면, 90은 "오래 남을" 결. recallText로 적었을 때 7년 후 엔딩에 떠올라도 묵직한가?

### 게임 정서 (반드시 지킬 것)

**DO ✅**
- **노스탤지아 한국 학교**: 급식, 분식집, 학원, 단톡, 도서관, 옥상, 매점, 운동회
- **절제로 버는 감정**: 큰 순간일수록 묘사는 더 차분하게. 침묵·여백·짧은 한마디가 클라이맥스를 만든다
- **그 NPC만의 결정적 결**: "다른 NPC로 바꿔도 통하면 빈약" — 그 캐릭터 7년을 압축한 한 장면
- **회상형 톤**: 어른이 된 화자가 그때를 떠올리는 듯한 차분한 서술
- **너이기 때문에**: 그 NPC가 무리/세상엔 안 보이고 오직 플레이어에게만 보여주는 결

**DON'T ❌**
- **선택지 절대 금지** — 짧은 장면 + 효과 한 줄
- 종결형 묘사 (`"~하고 헤어졌다"`, `"그게 다였다"`) — 진행 중 한 장면
- 학년 종속 *용어* (`"야자"` `"수능"` `"대학"`) 금지 — 단 "졸업을 앞둔 선배"처럼 캐릭터 설정상 시점(haeun은 플레이어 Y6 때 졸업)은 허용. junha 사투리도 예외.
- **멜로드라마·장황한 독백·과잉 연출** — 90이라고 시끄러우면 안 됨. 절제가 격을 만든다
- 게임에 없는 시스템 가정 (선물 X, 사진 공유 X)
- 한 NPC 일화에 다른 NPC가 주연으로 끼어들기 (조연 언급은 OK)

### NPC 프로필 (작업 대상 6명)

| ID | 이름 | 캐릭터 |
|---|---|---|
| `jihun` | 지훈 | 활발한 소꿉친구. 농구·게임·분식·PC방. 단순해 보이지만 챙기는 결. 진로는 운동 쪽 (체육 특기생 고민). |
| `subin` | 수빈 | 외향형이지만 어느 그룹에서든 "같이 어울리는 애". **엄마와 둘이 산다** (부모 이혼, intimacy 깊어지면 드러남). 시·문장 좋아함. |
| `minjae` | 민재 | 전교 1등 노력형. 새벽까지 공부하고 아침에 태연한 척. 위악적 자랑과 진짜 약한 면 공존. 학원 원장 엄마 + 교사 아빠 교육 가정. |
| `yuna` | 유나 | 밝고 에너지 넘치고 피아노도 잘 침. 밝음 뒤 "1등 놓치면 안 된다" 압박. 음악·감각·즉흥성. |
| `haeun` | 하은 | **1학년 위 선배** (Y2 등장 → 플레이어 Y6 때 고3로 졸업, Y7엔 학교에 없음). 침묵형, 자판기 옆 콜라. "선배라고 다 아는 건 아냐". 멘탈/위로 톤. |
| `junha` | 준하 | 부산 전학생 (Y5~). 사투리 ("~제, ~노"). 요리 잘함 (주먹밥). 향수병. |

> 상세 캐릭터 설정(성별·외형·말투·가정 배경)은 `docs/character-prompt-spec.md` 참조.

### 기존 시드 (중복 회피 — 절대 같은 결 반복 X)

```typescript
// ===== 30 단계 =====
talk_jihun_basket/badminton: 운동 한 판
talk_subin_problem: 문제 풀이 노트
talk_minjae_notes: "어차피 내가 다시 정리할 거니까" 노트
talk_yuna_song: "이 노래 들어봐" 이어폰
talk_haeun_quiet: "...괜찮아?" 자판기 옆 콜라
talk_junha_riceball: "어제 만들어봤어" 주먹밥

// ===== 50 단계 (두 사람만의 코드) =====
talk_jihun_50_topping: 떡볶이 계란 추가 — 식성 기억
talk_subin_50_sentence: "이 문장, 너 생각나서 접어놨어"
talk_minjae_50_wrong_answer_mark: 오답노트 세모 표시
talk_yuna_50_humming: 즉흥 멜로디 공유
talk_haeun_50_window: "오늘은 대답 안 해도 되는 날" 복도 끝 창문
talk_junha_50_seabreeze: "이 바람은 좀 부산 같다"

// ===== 70 단계 (속마음 한 조각) =====
talk_jihun_70_locker: "가끔은 나도 잘하고 싶은 게 많아" 사물함 (운동≠공부싫음)
talk_subin_70_night_light: "거실 불, 밤새 켜두는 날이 있어. 그냥." (가정사 암시) — 메모리(discovery/melancholy)
talk_minjae_70_phone_call: "기대받는 거 되게 시끄러워" 뒤집은 휴대폰 — 메모리(discovery/burden)
talk_yuna_70_chalk_dust: "잘한다는 말, 무서울 때도 있어" 분필가루
talk_haeun_70_direction: "아는 척하는 것도, 가끔은 길을 잃는 일이더라" 계단참
talk_junha_70_speech: "말투 고치면 내가 좀 없어지는 것 같아" 식판 (사투리=정체성)
```

### ⚠️ NPC별 회피 노트 + 90 방향 가드 (필수 — tier70 톤검수 results 반영)

각 NPC가 30/50/70에서 이미 쓴 축을 **절대 반복하지 말 것**. 아래는 검수에서 도출된 90 방향:

- **jihun**: 70(locker)이 이미 운동/공부 자기인식을 다룸 → 90은 "고민"이 아니라 **결정/선언**으로 차별화. (예: 체육 특기생을 진짜 준비하겠다는 처음 보는 진지함)
- **subin**: 70(night_light)이 가정사를 **암시**만 함 → 90은 한 걸음 더 — **엄마와 둘이 사는 삶을 처음으로 너에게 직접**. 70의 "거실 불빛" 소품/이미지 반복 금지, 동정·신파 없이 담담하게.
- **minjae**: 30·50(학습도구)·70(기대/성적/가족 압박) 누적 → **90은 기대·성적·가족 압박 축 절대 금지(반복)**. 권장: **라이벌 인정**("야, 너 진짜 잘하더라" — 평생 안 할 줄 알았던 말) 같은 관계 축.
- **yuna**: 70(chalk_dust)이 음악 축에서 **벗어났다는** 톤검수 지적 있었음 → 90은 **음악/건반/연주 감각 축으로 복귀**. 단 "칭찬 압박"(70 결) 반복이 아니라 **연주·소리·음악적 선택 그 자체**가 중심인 장면으로. (예: 무대 직전, 자기 음악을 처음으로 들려주는 순간)
- **haeun**: 정지공간(자판기·창문·계단참)이 30·50·70에 누적 → **90은 다른 공간/구도**. 졸업을 앞둔 선배의 마지막 결. (Y6/Y7 졸업 직전 톤)
- **junha**: 30(주먹밥)→50(부산 바람)→70(사투리/정체성)로 **부산·향수·정체성·사투리 축이 3연속**. → **90이 또 이 축이면 4연속 — 절대 금지**. (기존 "부산 초대" 아이디어 폐기) 권장 축: **관찰력·전학 적응·여기서 새로 생긴 자리** 등 부산과 무관한 현재. (요리는 30단계 주먹밥과 음식 결이 겹치니 피하는 편이 안전)

### MiniTalkEvent 타입 시그니처

```typescript
export interface MiniTalkEvent {
  id: string;                            // 'talk_<npcId>_90_<keyword>' 형식
  npcId?: string;                        // 이번 작업: 6개 모두 필수 (부모 이벤트 아님)
  intimacyMin?: number;                  // 90으로 설정
  gender?: 'male' | 'female';            // 톤 분기 시만
  description: string;                   // 본문 (NPC 대사 + 상황, 1~3줄, 절제)
  effects: {
    intimacy?: number;                   // 90 단계: +5 (고정)
    stats?: Partial<Stats>;              // academic / social / talent / mental / health
    fatigue?: number;                    // ±2 이내
    money?: number;                      // 보통 0
  };
  message: string;                       // 효과 한 줄 요약
  // 90 단계: memorySlotDraft 필수 (importance 5)
  memorySlotDraft: {
    category: 'courage' | 'betrayal' | 'reconciliation' | 'failure' | 'discovery' | 'growth';
    importance: 5;                       // 90 단계는 importance 5 고정
    toneTag?: 'warm' | 'regret' | 'resolve' | 'breakthrough' | 'melancholy' | 'burden';
    recallText: string;                  // 20~35자, 회상형, 스탯 단어 금지, 필수
    npcIds: [string];
  };
}
```

> 🔒 **`category` / `toneTag` 는 위 union 값만 사용하세요.** `'longing'`·`'nostalgia'`·`'quiet'` 같은 **임의값 절대 금지** — 코드의 닫힌 타입이라 그대로 넣으면 컴파일이 깨집니다.

### 효과 가이드라인 (친밀도 90 단계)

| 항목 | 권장 | 비고 |
|---|---|---|
| `intimacy` | **+5** (고정) | 11_미니이벤트설계.md §2-2 |
| `stats.*` | 카테고리 의미 부여 | 그 장면의 결에 맞는 스탯 (예: 결심=mental, 인정=social) |
| `fatigue` | ±2 이내 | 무거운 장면이면 +, 위로받는 장면이면 - |
| `money` | 보통 0 | |
| `memorySlotDraft` | **전부 필수, importance 5** | recallText 반드시 작성 |

**카테고리 권장 (NPC 아크 기준)**: jihun=courage / subin=discovery 또는 growth / minjae=growth 또는 reconciliation / yuna=discovery / haeun=reconciliation 또는 growth / junha=growth. (강제는 아님, 장면에 맞게)

**recallText 작성 기준**:
- 20~35자, 과거 회상형("~던 순간", "~던 그 ...")
- 스탯/수치 단어 금지 (회상은 정서지 보상 명세가 아님)
- 그 한 줄만 읽어도 "그 NPC다운 결정적 장면"이 떠오르는가?

### 작성 체크리스트

- [ ] **그 NPC만 할 수 있는, 7년을 압축한 결정적 한 장면인가?**
- [ ] **90 톤("결정적 전환점")에 맞는가?** 70 균열 수준이면 약하고, 멜로드라마면 과함
- [ ] **회피 노트 준수 (하지 말 것)** — 30/50/70과 같은 축 반복 X. **회피 대상**: minjae 기대/성적·가족, junha 부산/향수/정체성(4연속 금지), haeun 정지공간
- [ ] **yuna는 반대 — 회피가 아니라 해야 할 것(DO)**: 70(chalk_dust)에서 벗어났던 **음악/감각/연주 축으로 복귀**
- [ ] **선택지 없음** (description + effects + message + memorySlotDraft)
- [ ] **절제** — 큰 순간일수록 차분하게, 장황한 독백 금지
- [ ] **학년 종속 표현 없음** (junha 사투리는 예외)
- [ ] **effects: intimacy +5, memorySlotDraft importance 5 필수**
- [ ] **recallText 20~35자, 스탯 단어 없음**

### 출력 포맷

JavaScript/TypeScript 객체 형태로 코드 그대로 붙여넣을 수 있게:

```typescript
// === 친밀도 90 단계 코어 시드 6개 ===

const NEW_MINI_EVENTS = [
  // jihun 90
  {
    id: 'talk_jihun_90_<keyword>',
    npcId: 'jihun', intimacyMin: 90,
    description: '<NPC 대사 + 상황 1~3줄, 절제된 결정적 장면>',
    effects: { intimacy: 5, stats: { ... }, fatigue: ... },
    message: '<효과 한 줄 요약>',
    memorySlotDraft: {
      category: '<NPC 아크에 맞는 카테고리>',
      importance: 5,
      toneTag: '<warm | regret | resolve | breakthrough | melancholy | burden>',
      recallText: '<20~35자 회상문, 스탯 단어 금지>',
      npcIds: ['jihun'],
    },
  },
  // subin 90, minjae 90, yuna 90, haeun 90, junha 90
];

// === 추가 메모 ===
// - 각 시드별 작성 의도 한 줄
// - 어느 축을 잡았는지 (회피 노트 준수 확인 — 특히 minjae/junha/haeun/yuna)
// - category/toneTag 선택 이유
// - recallText가 7년 후 회상에 떠올랐을 때의 결
```

description 톤 예시 (참고 — jihun 90 방향):
> `"야, 너한테만 말하는 건데... 나 진짜 체육 특기생 준비할까 봐."`
> 체육관 뒤 벤치. 지훈이가 잠시 말을 멈춘다. "안 될 수도 있다는 거 알아. 근데 안 해보면 더 후회할 것 같아서." 늘 장난스럽던 얼굴에 처음 보는 단단함.

위는 jihun 톤일 뿐 — **각 NPC는 자기 결로** (jihun 톤 모사 금지). 다른 결 방향 예시:
> - **minjae (라이벌 인정 / 관계축)**: "...야, 너 진짜 잘하더라." 평생 안 할 줄 알았던 말을, 시선 피하지 않고 한 번.
> - **subin (자기 고백형 / 가정사)**: 엄마와 둘이 사는 삶을 처음으로, 동정도 농담도 없이 담담하게 너에게만.
> - **yuna (음악 축 복귀)**: 무대/연주 직전, 자기 음악을 처음으로 들려주는 한순간 — 칭찬 압박이 아니라 소리 그 자체.
> - **haeun (졸업 직전 / 새 공간)**: 자판기·창문·계단참이 아닌 곳에서, 선배로서 남기는 마지막 한마디.
> - **junha (부산 무관 현재)**: 부산·향수·사투리가 아니라, 여기서 새로 생긴 자리·관찰을 담담히.

NPC의 짧은 직접 대사(큰따옴표) + 행동/상황 묘사. 종결형 묘사 금지. 진행 중인 한 장면. **90이라도 시끄럽지 않게, 절제로 깊게.**

---

## (이 아래부터는 복사 X — 사용자 분 메모용)

### 채택 후 적용 위치

`game/src/engine/talkData.ts`의 `NPC_MINI_EVENTS` 배열에 신규 객체 6개 append (70 단계 시드 뒤).
신규 시드 ID 작명 규칙: `talk_<npcId>_90_<keyword>`

### tier90 특유 주의 (tier70과 차이)

1. **memorySlotDraft 전부 필수 (importance 5)** — 하나도 빠지면 안 됨. 회상 시스템 최강 가중치.
2. **사용자 주도 채택** — importance 5 슬롯 톤이 어긋나면 회상 전체 톤 붕괴. 외부 AI 결과 단순 채택 금지, NPC별 1개 직접 검수 채택.
3. **회피 가드가 tier70보다 빡셈** — junha(부산 4연속 금지), minjae(기대/성적 회피), haeun(정지공간 회피), yuna(음악축 복귀). 출처: `docs/tier70-tone-review-results-2026-05-29.md`.
4. **category/toneTag는 닫힌 union** — types.ts 기준. melancholy/burden은 #189에서 추가됨. 없는 값 넣으면 tsc 깨짐.

### 검증 절차 (채택 후)

1. AI 결과 3~4개 모아서 NPC별 톤 좋은 시드 1개씩 채택 (사용자 직접 검수)
2. `talkData.ts`에 객체 6개 추가
3. `npx tsc --noEmit` — typecheck (category/toneTag union 위반 없는지)
4. `verify-tier70-mini-events.ts` 복제 → `verify-tier90-mini-events.ts` (SEED 배열 + importance 5 검증 추가) 작성 + 실행
5. `npx tsx scripts/verify/verify-m3-memory.ts` — 회상 슬롯 생성 회귀
6. 인게임: 친밀도 90 도달 → 잡담 클릭 → 새 미니 이벤트 발동 + 🌙 회상 배지 + 슬롯 생성 확인 (NPC 6명)

### 톤 검증 (구현 PR 후)

PR #186/#189(tier70) 패턴 복제:
- `docs/mini-talk-event-tone-review-tier90-YYYY-MM-DD.md` 작성 (검수 발주)
- 외부 AI 다회 검증 (codex/cursor CLI 자동 + GPT/Gemini 수동)
- 2~3 AI 공통 교체추천 NPC만 실제 교체
- **importance 5 슬롯이라 검수 기준 더 엄격하게**

### 다음 Phase

- **Phase 2.5** (학년/시즌 게이팅): 기존 시드에 condition 추가 + 신규 시즌 이벤트
- **Phase 2.6** (부모 풀 단계 분기)

### 참고

- `11_미니이벤트설계.md`: 설계 SSOT — §2-2 효과, §2-6 모달 표현, §3 NPC별 매트릭스(90 가드 포함)
- `docs/mini-talk-event-prompts-tier70-2026-05-14.md` (#140): tier70 생성 발주 (본 문서 원형)
- `docs/tier70-tone-review-results-2026-05-29.md`: 4자 AI 톤검수 결과 + tier90 이월 가드 (회피 노트 출처)
- `docs/memory-slot-spec.md`: MemoryCategory/ToneTag union SSOT
- `game/src/engine/talkData.ts`: NPC_MINI_EVENTS 정의 위치
- `game/src/components/screens/main/MiniTalkModal.tsx`: 결과 표현(90 = 🌙 회상 배지 + 느린 페이스)
