# Y1 NPC 이벤트 균등화 — AI 발주용 프롬프트 (2026-05-10)

> Phase 2.2 친밀도 도달형 이벤트 시스템을 위한 핸드오프 문서.
> 5명 Y1 NPC(jihun/minjae/doyun/yuna/subin)의 이벤트 풀을 5~6개로 균등화.
> 여러 AI에게 같은 프롬프트로 던져서 결과를 모은 후 좋은 이벤트만 채택하는 방식.

---

## 사용법

아래 "AI에게 줄 프롬프트" 섹션 전체를 ChatGPT/Gemini/Claude 등에 그대로 복사해 붙여넣기.
나온 결과 중 톤이 맞는 이벤트만 골라서 `game/src/engine/events.ts`의 `GAME_EVENTS` 배열에 추가/정비.

---

## AI에게 줄 프롬프트 (이 아래부터 복사)

당신은 한국 학교생활을 다루는 성장 시뮬레이션 게임의 시나리오 작가입니다. 게임의 NPC 이벤트 풀을 친밀도 도달형으로 균등화하는 작업을 의뢰합니다.

### 게임 배경

- 한국의 12세(초6) → 18세(고3)까지 7년간 학교생활을 시뮬레이션
- 학년 매핑: Y1=초6, Y2=중1, Y3=중2, Y4=중3, Y5=고1, Y6=고2, Y7=고3
- 플레이어는 NPC 친구들과 친밀도(0~100)를 쌓아가며 그들의 이야기를 본다
- 이벤트는 `game/src/engine/events.ts`의 `GAME_EVENTS` 배열에 정의되어 매주 자동 발동

### 이번 작업의 목표

**Y1(초6) 시점에 5명 NPC의 이벤트 수를 5~6개로 균등화**하는 것이 목표.

현재 Y1 이벤트 수:
- jihun: 5 (만남 1 + 학년 시즌 4)
- minjae: 4 (만남 1 + 학년 시즌 3)
- doyun: 3 (만남 1 + 친밀도 조건부 1 + 졸업 시즌 1)
- yuna: 1 (만남 1 — 부족!)
- subin: 1 (만남 1 — 부족!)

→ yuna/subin이 한 해 동안 거의 등장하지 않아 "친해지는 재미"가 부족.
→ **친밀도 도달형 이벤트**로 부족한 NPC를 보강하고, 5명을 균등화.

### 친밀도 도달형 이벤트 시스템

events.ts에는 이미 두 가지 발동 패턴이 있음:
- **고정 주차(`week: N`)**: 학년 시즌 이벤트(졸업식, 운동회 등) — 무조건 발동
- **조건부(`week` 없음 + `condition` 함수)**: 매주 50% 확률로 후보 중 1개 픽, **자동 1회성 보장** (이미 발동한 ID는 후보 풀에서 제외)

**친밀도 도달형 = 조건부 패턴**. condition에 친밀도 체크만 추가:

```ts
{
  id: 'yuna-some-event',
  title: '...',
  description: '...',
  // week 없음 (조건부)
  condition: (s) => {
    const yuna = s.npcs.find(n => n.id === 'yuna');
    return yuna?.met && yuna.intimacy >= 30 && s.year === 1;
  },
  speakers: ['yuna'],
  location: 'classroom',
  choices: [...]
}
```

**임계값: 30 / 50 / 70 / 90** (도달형, 1회성)
- 한 번 도달하면 그 이후 후보 풀에 영구 진입
- 도달 즉시 발동이 아니라, **그 다음 주부터 50% 확률 후보 중 1개**로 픽 (시간 흐름 자연스러움)
- 모든 NPC를 90까지 올리는 건 사실상 불가 → "한 명을 깊게 vs 여러 명 얕게" 선택 압박

### 게임 정서 (반드시 지킬 것)

**DO ✅**
- **노스탤지아 한국 학교**: 급식, 분식집, 학원, 단톡, 단원평가, 졸업앨범, 운동회 같은 디테일
- **잔잔한 일상의 무게**: 거대한 사건 X, 작은 순간이 누적되는 감각 O
- **캐릭터 결 살린 진심**: NPC 개인사·취향·고민이 자연스럽게 드러남
- **선택의 무게감**: 두 선택지가 모두 "괜찮은데 다른" 느낌이어야 함 (한쪽이 명백한 정답 X)
- **회상형 톤**: 어른이 된 화자가 그때를 떠올리는 듯한 차분한 서술

**DON'T ❌**
- 종결형 묘사로 끝나는 dialogue (`"~하고 헤어졌다"`, `"~하고 가버렸다"`, `"그게 다였다"`) — 살아있는 현재형이어야 함
- 학년 부적합 표현: Y1(초6)인데 야자/수능/모의고사/대학 언급 X. Y1 톤은 **초등학생**임
- 과한 드라마: 자살·왕따·폭력 같은 무거운 소재는 SOFT_CRISIS 영역, 일반 친밀도 이벤트엔 부적절
- 게임에 없는 시스템 가정 (예: "유나에게 선물을 사줬다" → 선물 시스템 없음)
- 한 NPC 일화에 다른 NPC가 주연으로 끼어들기 (조연 언급은 OK)

### 친밀도 임계값별 톤 가이드

| 임계값 | 관계 단계 | 톤 | 예시 컨셉 |
|---|---|---|---|
| **30** | 조금 친한 친구 | 가벼운 일상 공유, 작은 호의 | 같이 분식집 가기, 노트 빌려주기, 쉬는 시간 잡담 |
| **50** | 마음을 나누는 친구 | 사적 취향, 가족 일면, 작은 비밀 | 좋아하는 책 추천, 형제자매 얘기, 아빠가 늦게 들어온다는 얘기 |
| **70** | 깊은 친구 | 가족·진로 핵심 화제 | 부모 갈등, 진짜 꿈, 미래에 대한 두려움 |
| **90** | 베프 | 캐릭터 정점 일화, 결정적 순간 | 함께한 의미 있는 약속, 인생을 바꾼 한마디, 이별 직전의 진심 |

### NPC 프로필 (Y1에 등장하는 5명)

각 NPC의 캐릭터 결을 살린 이벤트여야 함. "누구나 할 법한 일"이 아닌, 그 NPC만 할 법한 일로.

| ID | 이름 | 캐릭터 |
|---|---|---|
| `jihun` | 지훈 | 활발하고 운동을 좋아하는 소꿉친구. 항상 먼저 말을 걸어준다. 농구·게임·분식 좋아함. 단순해 보이지만 친구를 챙기는 결이 있음. |
| `subin` | 수빈 | 차분하고 책을 좋아하는 친구. 어디서든 금방 친해지는 외향형이지만 어느 그룹에서든 "같이 어울리는 애" 포지션. **엄마와 둘이 산다** (부모 이혼 — 본인은 아직 말 안 함, intimacy 깊어지면 드러남). |
| `minjae` | 민재 | 전교 1등이지만 천재가 아니라 노력형. 새벽까지 공부하고 아침에 태연한 척하는 아이. 학원 원장 엄마와 교사 아빠 밑에서 자란 교육 가정. 압박 속에서도 친구는 챙기려 함. |
| `yuna` | 유나 | 성적은 항상 상위권인데 공부벌레 느낌은 아님. 밝고 에너지 넘치고 피아노도 잘 침. 그 밝음 뒤에 "1등 놓치면 안 된다"는 압박. 도서관 창가에서 처음 만남. |
| `doyun` | 도윤 | (성별별 등장: 플레이어 남=축구하는 옆자리, 플레이어 여=조용히 청소하는 짝꿍) Y1만 같이 다니다 Y2에 다른 학교로 진학해 멀어짐 — **Y1이 도윤과의 시간 전부**. 그래서 Y1 이벤트의 의미가 큼. |

### 현재 NPC별 이벤트 풀 (중복 회피용 — 비슷한 컨셉 새로 만들지 말 것)

#### jihun (지훈) — 14개

| id | 학년 | 컨셉 | 분류 |
|---|---|---|---|
| first-week | Y1 W1 | 새 학기 첫날 등굣길에서 만남 | 만남 |
| elementary-spring-picnic | Y1 W5 | 봄 소풍 (minjae 공유) | 시즌 |
| elementary-sports-day | Y1 W32 | 가을 운동회 | 시즌 |
| graduation-prep-elementary | Y1 W45 | 졸업 앨범 제작 (minjae 공유) | 시즌 |
| elementary-graduation | Y1 W46 | 초등 졸업식 (minjae 공유) | 시즌 |
| jihun-call | (Y2+) W4 | 지훈이의 전화 — 중학교 입학 후 연락 | 친밀도조건 |
| summer-trip | (Y2+) W22 | 지훈이의 여름방학 제안 | 친밀도조건 |
| jihun-basketball | (Y2+) | 방과 후 한 판 | 친밀도조건 |
| jihun-secret | (Y2+) | 지훈이의 고민 | 친밀도조건 |
| jihun-fight | (Y2+) | 지훈이와 다툼 | 일반조건 |
| jihun-support | (Y2+) | 지훈이의 대회 응원 | 친밀도조건 |
| jihun-promise | Y7 | 졸업 후 약속 | 후속 |
| jihun-birthday | W14 | 지훈이 생일 | 시즌 |
| jihun-envy | (중후반) | 지훈이 말끝에 남은 것 (소프트 위기) | 위기 |

#### minjae (민재) — 13개

| id | 학년 | 컨셉 | 분류 |
|---|---|---|---|
| minjae-meet-elementary | Y1 W2 | 새 짝꿍 — 옆자리 배정 | 만남 |
| elementary-spring-picnic | Y1 W5 | 봄 소풍 (jihun 공유) | 시즌 |
| graduation-prep-elementary | Y1 W45 | 졸업 앨범 (jihun 공유) | 시즌 |
| elementary-graduation | Y1 W46 | 초등 졸업식 (jihun 공유) | 시즌 |
| minjae-sports | (Y2+) | 체육시간의 민재 | 친밀도조건 |
| minjae-exam-chat | (Y2+) | 시험 결과 대화 | 친밀도조건 |
| minjae-birthday | W7 | 민재 생일 | 시즌 |
| minjae-ranking | (Y2+) | 성적표가 붙은 날 | 친밀도조건 |
| minjae-effort | (중) | 새벽의 비밀 — 새벽까지 공부하는 모습 발견 | 친밀도조건 |
| minjae-pressure | (중후반) | 엄마의 전화 — 학원 엄마 압박 | 친밀도조건 |
| minjae-honest | (중후반) | 교실에 남은 민재 | 친밀도조건 |
| minjae-dream | (고) | 의대가 전부야? — 진로 갈등 | 친밀도조건 |
| minjae-jealousy | (중) | 굳어진 민재 (소프트 위기) | 위기 |

#### doyun (도윤) — 5개 (Y1만)

| id | 학년 | 컨셉 | 분류 |
|---|---|---|---|
| doyun-meet-elementary | Y1 W4 (남) | 운동장 한 명 모자라 — 축구 끼워주기 | 만남 |
| doyun-meet-elementary-f | Y1 W4 (여) | 청소시간 — 짝꿍 청소 같이 | 만남 |
| doyun-comic-share | Y1 W22 | 쉬는 시간 만화책 (현재 intimacy >= 15) | 친밀도조건 |
| doyun-graduation-sign | Y1 W47 | 졸업앨범 뒤에 사인 | 시즌+조건 |
| doyun-school-split | Y2 W2 | 도윤이는 다른 학교 — 멀어짐 | 시즌 |

#### yuna (유나) — 9개

| id | 학년 | 컨셉 | 분류 |
|---|---|---|---|
| yuna-meet-elementary | Y1 W6 | 도서관 창가 자리 — 조용히 책 읽는 모습 발견 | 만남 |
| yuna-study | (any) W34 | 유나의 부탁 — 시험 공부 도움 | 일반조건 |
| yuna-library | (Y2+) | 도서관에서 — 같이 공부 | 친밀도조건 |
| yuna-lunch | (Y2+) | 옥상에서 점심 | 친밀도조건 |
| yuna-hobby | (Y2+) | 유나의 취미 — 피아노 | 친밀도조건 |
| yuna-pressure | (중후반) | 1등의 무게 — 압박 토로 | 친밀도조건 |
| yuna-smile | (고) | 유나의 선택 — 진로 결정 | 친밀도조건 |
| yuna-birthday | W38 | 유나의 생일 | 시즌 |
| yuna-misunderstanding | (중) | 유나의 차가운 인사 (소프트 위기) | 위기 |

#### subin (수빈) — 9개

| id | 학년 | 컨셉 | 분류 |
|---|---|---|---|
| subin-meet-elementary | Y1 W10 | 학원 뒷자리 — 같은 학원 발견 | 만남 |
| subin-academy | (any) W5 | 수빈이와 학원 — 같이 다니기 | 친밀도조건 |
| subin-bridge | (Y2+) | 수빈이의 소개 — 다른 친구 다리 놓아주기 | 친밀도조건 |
| subin-lonely | (Y2+) | 혼자 있는 수빈 — 엄마 늦은 밤 | 친밀도조건 |
| subin-divorce | (중후반) | 수빈이의 비밀 — 부모 이혼 고백 | 친밀도조건 (높음) |
| subin-dream | (고) | 어디든 갈 수 있다면 — 도시 떠나고 싶은 꿈 | 친밀도조건 |
| subin-farewell | Y7 | 각자의 하늘 — 졸업 후 | 후속 |
| subin-birthday | W29 | 수빈이 생일 | 시즌 |
| subin-drift | (중) | 수빈이 멀어진다 (소프트 위기) | 위기 |

### 균등화 목표 분포 (Y1 기준)

| NPC | 만남 | 시즌 | 도달형 신규 | Y1 합계 |
|---|---|---|---|---|
| jihun | 1 | 4 | 0 (이미 충족) | 5 |
| minjae | 1 | 3 | 1 (70 도달) | 5 |
| doyun | 1 | 1 (W47) | 3 (30/40/60) ※ W22 정비 | 5 |
| yuna | 1 | 0 | 4 (30/50/70/90) | 5 |
| subin | 1 | 0 | 4 (30/50/70/90) | 5 |

**총 신규: 12개** (yuna 4 + subin 4 + doyun 3 + minjae 1)
**기존 정비: 1개** (doyun-comic-share W22 → 도달형 30 패턴으로 변환)

### GameEvent 타입 시그니처

```ts
export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  week?: number;          // 도달형 이벤트는 비워둠
  condition?: (state: GameState) => boolean;
  location?: EventLocation; // 'classroom'|'home'|'park'|'hallway'|'rooftop'|'street'|'gym'|'school_gate'|'cafe'|'music_room'|'beach'|'convenience_store'|'library'|'auditorium'
  speakers?: string[];    // 등장 NPC ID
  background?: string;    // 배경 이미지 키 (없으면 기본)
  femaleDescription?: string;  // 성별 분기
  femaleChoices?: EventChoice[];
}

export interface EventChoice {
  text: string;                    // 선택지 텍스트
  effects: Partial<Stats>;         // 스탯 변화 (academic/social/talent/mental/health)
  fatigueEffect?: number;          // 피로도 변화
  moneyEffect?: number;            // 돈 변화
  npcEffects?: { npcId: string; intimacyChange: number }[];  // NPC 친밀도 변화
  message: string;                 // 선택 후 결과 메시지
  timeCost?: 1 | 2;
  memorySlotDraft?: MemorySlotDraft;  // 회상 슬롯 후보 (importance >= 3만 실제 생성)
}

export interface MemorySlotDraft {
  category: 'courage' | 'betrayal' | 'reconciliation' | 'failure' | 'discovery' | 'growth' | 'bypass' | 'unspoken_debt';
  importance: number;              // 1~10. <3은 슬롯 생성 스킵
  toneTag?: 'warm' | 'regret' | 'resolve' | 'breakthrough';
  recallText: string;              // 20~35자, 과거 회상형, 스탯 단어 금지
  npcIds?: string[];
}
```

### 작업 의뢰

#### Part A: 기존 이벤트 검토 (jihun / minjae / doyun)

이미 이벤트가 많은 jihun/minjae와 정비 대상 doyun에 대해, 다음을 분석:

1. **기존 Y1 이벤트 중 도달형으로 변환 가능한 후보**가 있는지 — 시즌 이벤트(졸업식 등)는 학년 행사라 유지 필요. 캐릭터 개인 일화면서 친밀도 게이트가 자연스러운 것만 후보.
2. **의미가 약하거나 중복된 이벤트가 있어 삭제 후보**인지 — 만약 삭제 추천이면 이유와 어떤 신규 도달형으로 대체할지 제안.
3. **doyun-comic-share** (현 intimacy >= 15)는 친밀도 30 도달형으로 표준화. 톤은 그대로 유지하면서 임계값만 조정 추천 또는 컨셉 보강 제안.

각 NPC별로 다음 형식으로 출력:

```
### jihun 검토
- elementary-sports-day (W32): [유지/도달형변환/삭제] — 이유
- ...
- 권장 신규 도달형 0개 (이미 5개 충족)

### minjae 검토
- ...
- 권장 신규 도달형 1개 (임계값 70): 컨셉 한 줄 (예: "민재의 학원 가방을 들어주는 날")

### doyun 검토
- doyun-comic-share: [도달형 30으로 표준화. 컨셉 그대로 유지 OR 다음과 같이 보강]
- 권장 신규 도달형 2개:
  - 임계값 50: 컨셉 한 줄
  - 임계값 70: 컨셉 한 줄
```

#### Part B: 신규 도달형 이벤트 작성

다음 12개를 GameEvent 객체 형태로 작성:

| NPC | 임계값 | 개수 |
|---|---|---|
| yuna | 30 / 50 / 70 / 90 | 4 |
| subin | 30 / 50 / 70 / 90 | 4 |
| doyun | 30 / 40 / 60 (Part A 제안 따름) | 3 |
| minjae | 70 | 1 |

**조건:**
- 각 이벤트는 위 "현재 NPC별 이벤트 풀"과 **컨셉 중복 X** (예: yuna-library가 이미 있으니 "도서관에서 함께 공부" 컨셉 새로 만들지 말 것)
- Y1(초6) 시점에 어울리는 톤 (초등학생 — 야자/수능/대학 X)
- 임계값별 톤 가이드 준수
- 선택지는 2~3개, 각 선택의 stat/intimacy 변화 명시
- 각 이벤트에 적합한 location/speakers 지정
- 임계값 70/90의 핵심 일화에는 `memorySlotDraft` 포함 권장 (importance 3+)

**condition 함수 패턴:**

```ts
condition: (s) => {
  const npc = s.npcs.find(n => n.id === '<npcId>');
  return !!npc?.met && npc.intimacy >= <threshold> && s.year === 1;
}
```

(`s.year === 1`은 Y1 한정 이벤트 시. NPC와 학년 무관하게 모든 학년 도달 시 발동시키고 싶으면 year 조건 제거 가능 — 이 경우 메모에 명시)

### 출력 포맷

JavaScript/TypeScript 객체 형태로 코드 그대로 붙여넣을 수 있게:

```javascript
// === Part A: 기존 이벤트 검토 결과 ===

(분석 텍스트)

// === Part B: 신규 도달형 이벤트 ===

const NEW_EVENTS = [
  // yuna 30
  {
    id: 'yuna-...',
    title: '...',
    description: '...',
    speakers: ['yuna'],
    location: 'library',
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 30 && s.year === 1;
    },
    choices: [
      {
        text: '...',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 2 }],
        message: '...',
        timeCost: 1,
      },
      // ...
    ],
  },
  // ...총 12개
];
```

description은 1~3 문장(한 화면에 들어가야 함). dialogue가 들어가면 큰따옴표(`"..."`) 그대로 포함. 종결형 묘사 절대 금지.

---

## (이 아래부터는 복사 X — 사용자 분 메모용)

### 채택 후 적용 위치

`game/src/engine/events.ts`의 `GAME_EVENTS` 배열에 신규 객체 12개 append + `doyun-comic-share` 정비.

신규 이벤트 ID 작명 규칙 권장:
- `<npcId>-<concept>` (예: `yuna-piano-recital`, `subin-mom-late-night`)
- 임계값을 ID에 박지 말 것 (변경 가능성)

### CG 이미지

신규 이벤트 중 임계값 70/90 핵심 일화는 CG 추가 후보. `event-cg-prompts-y1.md` 패턴 따라 별도 발주.

### 다음 단계

1. AI 결과 모아서 좋은 라인 채택 (3~4 AI 결과 비교)
2. doyun-comic-share 정비 + 신규 12개 events.ts 추가
3. `game/scripts/sim-y1-balance.ts` 재실행해 친밀도 도달 가능성/풀 픽 확률 시뮬
4. CG 발주 (70/90 위주)

### 참고

- talk-line-prompts-2026-05-08.md: 말걸기 잡담 라인 프롬프트 (선행 작업)
- event-cg-prompts-y1.md: 이벤트 CG 프롬프트 패턴
