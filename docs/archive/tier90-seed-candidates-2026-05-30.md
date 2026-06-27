# tier90 시드 후보 수집 (2026-05-30)

발주 문서: `docs/mini-talk-event-prompts-tier90-2026-05-30.md` (PR #198)
채택 흐름: codex/cursor 자동 + GPT/Gemini 수동 → **4자 비교 → NPC별 1개 사용자 채택**

## ⚙️ 통합 시 결정사항 (확정)
- **학년 게이팅**: MiniTalkEvent에 `yearMin`/`condition` 추가(엔진 소확장). 시점 의존 시드 게이팅:
  - **haeun = Y6** (1학년 위 선배, 플레이어 Y6 때 졸업) — '졸업 직전' 시드
  - **jihun = Y5+** (체육 특기생 = 고등 톤)
  - 나머지(subin/minjae/yuna/junha)는 시점 무관이라 게이팅 불필요
- 통합 PR에서 yearMin/condition 필터를 talkSystem.getAvailableNpcEvents에 추가.

## 채택 시점 비교 (codex × cursor 자동, 제 lean)
| NPC | 제 lean | 사유 |
|---|---|---|
| jihun | codex | cursor는 발주 예시문 거의 복붙 |
| subin | cursor | 동정·신파 없이 흘리듯 (절제) |
| minjae | cursor 톤 + growth 카테고리(codex) | 화해할 갈등 없음 → reconciliation보다 growth |
| yuna | 막상막하(살짝 codex) | 박자 흔들림 디테일 |
| haeun | cursor | '그냥 있어도 됐어' 하은 결 압축 |
| junha | cursor | 사투리를 주제 아닌 voice로만 (가드 정확) |

---

## 🔵 codex (OpenAI) 생성본
```typescript
```typescript
// === 친밀도 90 단계 코어 시드 6개 ===

const NEW_MINI_EVENTS = [
  // jihun 90
  {
    id: 'talk_jihun_90_decision',
    npcId: 'jihun', intimacyMin: 90,
    description: '"나, 체육 특기생 진짜 준비해볼게."\n운동장 스탠드 아래, 지훈이가 끈 풀린 운동화를 다시 묶는다. "안 될 수도 있는 거 알아. 근데 이제 장난처럼 말 안 하려고."',
    effects: { intimacy: 5, stats: { mental: 2, health: 1 }, fatigue: 1 },
    message: '지훈이의 결심 — 멘탈 +2, 체력 +1, 피로 +1, 친밀도 +5',
    memorySlotDraft: {
      category: 'courage',
      importance: 5,
      toneTag: 'resolve',
      recallText: '스탠드 아래 지훈이가 처음 결심하던 순간',
      npcIds: ['jihun'],
    },
  },
  // subin 90
  {
    id: 'talk_subin_90_home',
    npcId: 'subin', intimacyMin: 90,
    description: '"우리 집은 엄마랑 나, 이렇게 둘이야."\n학원 끝 버스정류장, 수빈이가 빈 컵의 얼음을 천천히 흔든다. "네가 알면 갑자기 조심할까 봐 말 안 했어. 근데 이제는 그냥 알아줬으면 해."',
    effects: { intimacy: 5, stats: { social: 1, mental: 1 }, fatigue: -1 },
    message: '수빈이의 담담한 고백 — 사회 +1, 멘탈 +1, 피로 -1, 친밀도 +5',
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'warm',
      recallText: '수빈이가 둘뿐인 집을 담담히 말하던 순간',
      npcIds: ['subin'],
    },
  },
  // minjae 90
  {
    id: 'talk_minjae_90_recognition',
    npcId: 'minjae', intimacyMin: 90,
    description: '"야, 너 진짜 잘하더라."\n학급 발표가 끝난 뒤, 민재가 네가 넘긴 자료를 반듯하게 맞춰 놓는다. 평생 안 할 줄 알았던 말을, 이번엔 시선 피하지 않고 한 번 더 한다. "인정."',
    effects: { intimacy: 5, stats: { social: 2, mental: 1 } },
    message: '민재의 인정 — 사회 +2, 멘탈 +1, 친밀도 +5',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'breakthrough',
      recallText: '민재가 시선을 피하지 않고 인정하던 순간',
      npcIds: ['minjae'],
    },
  },
  // yuna 90
  {
    id: 'talk_yuna_90_first_phrase',
    npcId: 'yuna', intimacyMin: 90,
    description: '"이건 아직 아무한테도 안 들려줬어. 그냥 들어줘."\n음악실 무대 앞, 유나가 악보 없는 첫 마디를 조심스럽게 누른다. 박자가 조금 흔들리는데, 그 흔들림까지 유나의 소리처럼 남는다.',
    effects: { intimacy: 5, stats: { talent: 2, mental: 1 }, fatigue: 1 },
    message: '유나의 첫 연주 — 재능 +2, 멘탈 +1, 피로 +1, 친밀도 +5',
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'breakthrough',
      recallText: '유나가 처음 자기 숨으로 연주하던 순간',
      npcIds: ['yuna'],
    },
  },
  // haeun 90
  {
    id: 'talk_haeun_90_pace',
    npcId: 'haeun', intimacyMin: 90,
    description: '"나 먼저 가도, 따라오려고 애쓰진 마."\n졸업을 앞둔 오후, 강당 뒤편에서 하은 선배가 명찰 끈을 손가락에 감았다 푼다. "너는 네 속도로 와. 그게 생각보다 어렵더라."',
    effects: { intimacy: 5, stats: { mental: 2, social: 1 }, fatigue: -1 },
    message: '하은 선배의 마지막 말 — 멘탈 +2, 사회 +1, 피로 -1, 친밀도 +5',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'resolve',
      recallText: '하은 선배가 네 속도로 오라던 졸업 전날',
      npcIds: ['haeun'],
    },
  },
  // junha 90
  {
    id: 'talk_junha_90_place',
    npcId: 'junha', intimacyMin: 90,
    description: '"오늘 네 자리 비어 있으니까, 애들이 먼저 물어보더라."\n준하가 반 단톡 알림을 내려놓고 네 책상 쪽을 본다. "처음엔 내가 어디 앉아도 좀 남의 자리 같았는데, 이제는 내가 먼저 찾게 되네."',
    effects: { intimacy: 5, stats: { social: 2, mental: 1 }, fatigue: -1 },
    message: '준하의 새 자리 — 사회 +2, 멘탈 +1, 피로 -1, 친밀도 +5',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'warm',
      recallText: '준하가 새 자리에서 네 빈자리를 먼저 찾던 순간',
      npcIds: ['junha'],
    },
  },
];

// === 추가 메모 ===
// - jihun: 70의 고민이 아니라 체육 특기생 준비를 실제로 시작하는 결심. courage/resolve.
// - subin: 거실 불빛 반복 없이, 엄마와 둘이 사는 삶을 직접 말하는 신뢰 장면. discovery/warm.
// - minjae: 성적·기대·가족 압박을 배제하고 라이벌/친구 인정 축으로 전환. growth/breakthrough.
// - yuna: 음악실·건반·첫 소리로 음악/감각/연주 축 복귀. discovery/breakthrough.
// - haeun: 자판기·창문·계단참 대신 강당 뒤편, 졸업 직전 선배의 마지막 결. growth/resolve.
// - junha: 부산·향수·정체성·요리 축을 피하고, 전학생이 현재 교실에서 새 자리를 얻은 장면. growth/warm.
```
```

## 🟣 cursor (Claude sonnet) 생성본
캐릭터 스펙을 확인했습니다. 각 NPC의 아크와 회피 노트를 반영해서 작성합니다.

---

```typescript
// === 친밀도 90 단계 코어 시드 6개 ===

const NEW_MINI_EVENTS = [
  // jihun 90
  {
    id: 'talk_jihun_90_decide',
    npcId: 'jihun',
    intimacyMin: 90,
    description:
      '"야, 너한테만 말하는 건데." 지훈이 체육관 뒤 벤치에 앉아 잠시 말을 멈췄다. "나 체육 특기생으로 진짜 가려고. 해볼 거야." 늘 장난스럽던 얼굴에 처음 보는 단단함이 있었다.',
    effects: {
      intimacy: 5,
      stats: { mental: 1 },
      fatigue: 0,
    },
    message: '지훈의 결심을 처음으로 들었다.',
    memorySlotDraft: {
      category: 'courage',
      importance: 5,
      toneTag: 'resolve',
      recallText: '체육관 벤치에서 지훈이 처음으로 진지해지던 순간',
      npcIds: ['jihun'],
    },
  },

  // subin 90
  {
    id: 'talk_subin_90_mom',
    npcId: 'subin',
    intimacyMin: 90,
    description:
      '"나 빨리 가야 해. 엄마 혼자라서." 수빈이 가방 끈을 고쳐 맸다. 평소와 다를 것 없는 목소리였다. 처음으로 직접 꺼낸 말인데도.',
    effects: {
      intimacy: 5,
      stats: { mental: 1 },
      fatigue: -1,
    },
    message: '수빈이 처음으로 직접 꺼낸 말을 들었다.',
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'warm',
      recallText: '엄마 혼자라서, 담담하게 꺼낸 수빈의 첫 고백',
      npcIds: ['subin'],
    },
  },

  // minjae 90
  {
    id: 'talk_minjae_90_admit',
    npcId: 'minjae',
    intimacyMin: 90,
    description:
      '"...야, 너 진짜 잘하더라." 복도를 지나치다 민재가 멈춰서 말했다. 위악도, 비교도 없이. 잠시 시선이 마주쳤다. "그냥, 사실이니까."',
    effects: {
      intimacy: 5,
      stats: { social: 1 },
      fatigue: 0,
    },
    message: '민재에게 처음으로 직접 인정을 받았다.',
    memorySlotDraft: {
      category: 'reconciliation',
      importance: 5,
      toneTag: 'breakthrough',
      recallText: '야 너 진짜 잘하더라, 처음으로 시선을 피하지 않은 민재',
      npcIds: ['minjae'],
    },
  },

  // yuna 90
  {
    id: 'talk_yuna_90_score',
    npcId: 'yuna',
    intimacyMin: 90,
    description:
      '유나가 악보를 덮었다. 잠시 건반 위에 손을 올려두다 천천히 치기 시작했다. "이거, 내가 만든 거야. 아무한테도 안 들려줬는데." 음악실에 소리가 퍼졌다.',
    effects: {
      intimacy: 5,
      stats: { talent: 1 },
      fatigue: 0,
    },
    message: '유나의 자작곡을 처음으로 들었다.',
    memorySlotDraft: {
      category: 'discovery',
      importance: 5,
      toneTag: 'breakthrough',
      recallText: '악보를 덮고 자기 곡을 처음으로 들려주던 유나의 손',
      npcIds: ['yuna'],
    },
  },

  // haeun 90
  {
    id: 'talk_haeun_90_last',
    npcId: 'haeun',
    intimacyMin: 90,
    description:
      '졸업을 앞둔 마지막 주, 도서관 반납대 앞. 하은이 책을 내려놓다 잠시 멈췄다. "나, 말 잘 못 하는 거 알지." 너를 한 번 봤다. "근데 너한테는 그냥 있어도 됐어. 그게 많이 다른 거야."',
    effects: {
      intimacy: 5,
      stats: { mental: 2 },
      fatigue: -1,
    },
    message: '하은 선배의 마지막 말을 들었다.',
    memorySlotDraft: {
      category: 'reconciliation',
      importance: 5,
      toneTag: 'warm',
      recallText: '그냥 있어도 됐어, 졸업 전 도서관에서 하은 선배의 한마디',
      npcIds: ['haeun'],
    },
  },

  // junha 90
  {
    id: 'talk_junha_90_here',
    npcId: 'junha',
    intimacyMin: 90,
    description:
      '점심 시간, 창가 자리. 준하가 창밖을 잠깐 내다보더니 말했다. "야, 나 여기서 어디 앉아야 밥이 제일 맛있는지 다 외웠제." 가볍게 웃었다. "언제부터인지 모르겠는데, 이제 여기가 내 자리 같아."',
    effects: {
      intimacy: 5,
      stats: { social: 1 },
      fatigue: 0,
    },
    message: '준하가 이 자리를 자신의 것으로 받아들이는 순간을 함께했다.',
    memorySlotDraft: {
      category: 'growth',
      importance: 5,
      toneTag: 'warm',
      recallText: '창가 자리에서 여기가 내 자리 같다던 준하의 말',
      npcIds: ['junha'],
    },
  },
];

// === 추가 메모 ===
//
// jihun 90 (talk_jihun_90_decide)
//   - 잡은 축: "결심/선언" — 70(locker)의 자기인식("가끔은 잘하고 싶어")을 행동으로 넘어서는 전환점
//   - 회피 확인: 운동 활동(30), 식성 코드(50), 자기인식 고민(70) 모두 피함. 이번엔 고민이 아니라 선언.
//   - category: courage / toneTag: resolve — 처음으로 결심을 입 밖에 낸 용기
//   - recallText: 7년 후 "지훈이 체육 특기생으로 간 계기"를 떠올릴 때 이 벤치 장면이 먼저 올 것
//
// subin 90 (talk_subin_90_mom)
//   - 잡은 축: "가정 직접 고백" — 70(night_light)이 거실 불빛으로 암시만 했다면, 90은 처음으로 직접
//   - 회피 확인: 문제 풀이(30), 접힌 문장(50), 거실 불빛 소품(70) 모두 피함. 동정·신파 없이 담담하게.
//   - category: discovery / toneTag: warm — 처음 알게 되는 것, 따뜻하게 받아들이는 순간
//   - recallText: "처음으로 직접 꺼낸 말"이라는 결이 7년 후에도 묵직하게 남을 것
//
// minjae 90 (talk_minjae_90_admit)
//   - 잡은 축: "라이벌 인정 / 관계 축" — 기대·성적·가족 압박 3연속이었던 30/50/70과 완전히 다른 결
//   - 회피 확인: 기대/성적/가족 압박 축 없음. 위악이나 자기 자랑도 없음.
//   - category: reconciliation / toneTag: breakthrough — 평생 안 할 줄 알았던 말을 처음으로
//   - recallText: "시선을 피하지 않은 민재"가 핵심 — 평소 위악 뒤에 숨던 인물이 처음으로 정면으로
//
// yuna 90 (talk_yuna_90_score)
//   - 잡은 축: "음악/연주/자작곡" — 70(chalk_dust)에서 음악 축을 벗어났다는 검수 지적 반영, 복귀
//   - 회피 확인: "잘한다는 말" 칭찬 압박(70) 반복 없음. 이번엔 압박이 아니라 소리 그 자체가 중심.
//     50(즉흥 멜로디)과 구별: 50은 즉흥/공유, 90은 오래 숨겨온 자작곡을 처음으로 꺼내는 것
//   - category: discovery / toneTag: breakthrough — 아무에게도 안 들려준 자기만의 소리를 처음으로
//   - recallText: "손"이라는 구체적 이미지 — 악보를 덮고 건반을 짚는 손이 7년 후에도 떠오를 것
//
// haeun 90 (talk_haeun_90_last)
//   - 잡은 축: "졸업 직전 / 새 공간(도서관)" — 30(자판기)·50(창문)·70(계단참) 정지공간 3연속 탈출
//   - 회피 확인: 자판기·창문·계단참 없음. 침묵형 하은이 처음으로 직접 말하는 구도.
//   - category: reconciliation / toneTag: warm — 관계가 마지막으로 완성되는 지점
//   - recallText: "그냥 있어도 됐어"가 핵심 — 하은의 캐릭터 전체(침묵·위로·거리)를 압축한 한마디
//
// junha 90 (talk_junha_90_here)
//   - 잡은 축: "소속감 / 현재의 자리" — 부산(50)·향수(50)·정체성(70) 3연속 후 완전히 다른 현재 축
//   - 회피 확인: 부산·향수·사투리 주제 없음. 요리(주먹밥 30)와 음식 결도 피함. 사투리는 인물 특성으로만 사용.
//   - category: growth / toneTag: warm — 외지인이 "여기 사람"이 되는 성장의 결정적 순간
//   - recallText: "여기가 내 자리 같아"가 핵심 — 전학생 준하의 7년을 닫는 한마디
```

---

**각 선택의 설계 근거 — 간략 정리:**

| NPC | 90 핵심 | 70과의 차이 |
|---|---|---|
| jihun | 고민 → **선언** (체육 특기생 결심) | 70이 "잘하고 싶어"(균열)라면 90은 "해볼 거야"(전환) |
| subin | **직접 고백** (엄마와 둘) | 70이 거실 불빛으로 암시, 90은 입으로 처음 꺼냄 |
| minjae | **라이벌 인정** (관계 축으로 전환) | 기대/성적/가족 압박 3연속에서 완전히 이탈 |
| yuna | **자작곡 초연** (소리 그 자체) | 70이 칭찬 압박, 90은 압박 없는 음악 자체로 복귀 |
| haeun | 도서관, **졸업 전 마지막 말** | 자판기·창문·계단참 3연속에서 새 공간으로 |
| junha | **소속감 선언** (여기가 내 자리) | 부산·향수·정체성 4연속 차단, 현재에 정착 |

## 🟢 GPT (수동) — 붙여넣기
_대기_

## 🔴 Gemini (수동) — 붙여넣기
_대기_
