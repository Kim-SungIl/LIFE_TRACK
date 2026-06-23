import { GameEvent } from '../types';

export const RANDOM_EVENTS = [
  // ===== 랜덤 이벤트 (조건부) =====
  {
    id: 'fatigue-warning',
    title: '몸이 무겁다',
    description: '아침에 일어나기가 힘들다. 몸이 천근만근이다.\n"오늘 학교 가기 싫다..."',
    condition: (s) => s.fatigue >= 60 && s.week > 5,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '그래도 간다 — 빠지면 뒤처져',
        effects: { academic: 1, mental: -2 },
        fatigueEffect: 3,
        message: '억지로 학교에 갔다. 수업 내내 졸았다.',
      },
      {
        text: '하루 쉰다 — 오늘은 못 가겠어',
        effects: { mental: 2 },
        fatigueEffect: -10,
        message: '하루 푹 쉬었다. 몸은 좀 나아졌는데, 결석 1일.',
      },
    ],
  },
  {
    id: 'mental-low',
    title: '혼자인 점심시간',
    description: '점심시간. 친구들이 다 어디 갔는지 주변에 아무도 없다.\n혼자 밥을 먹으며 핸드폰을 본다.',
    condition: (s) => s.stats.social < 30 && s.week > 8,
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    // speakers 제거 — description에는 아직 아무도 등장하지 않음 (choices에서만 등장)
    choices: [
      {
        text: '괜찮아, 혼자가 편해',
        effects: { mental: 1 },
        message: '혼자만의 시간도 나쁘지 않다. ... 정말?',
      },
      {
        text: '같은 반 아이에게 말을 걸어본다',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"같이 먹어도 돼?" "어, 그래!" 용기를 냈더니 생각보다 쉬웠다.',
      },
    ],
  },
  // v1.2 하드 위기: 중2 번아웃 (Y3 전용, 부록 D.1)
  // getEventForWeek가 state.hardCrisisYears 가드로 연간 1회 상한 강제
  {
    id: 'middle-burnout',
    title: '중2의 긴 겨울',
    description: '책상 앞에 앉아도 펜만 굴러다닌다.\n어제랑 오늘이 구분이 안 간다.\n엄마가 뭐라고 했는데 반쪽은 흘려들었다.\n"나 괜찮은 걸까..."',
    // M5 Phase 2: mental 40 → 55, idleWeeks 4 → 3 완화. Y3 1회 가드(hardCrisisYears)로
    // 과잉 발동 방지. burnout-event(year !== 3 가드)와 충돌 없음.
    condition: (s) => s.year === 3 && s.idleWeeks >= 3 && s.stats.mental <= 55,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '그래도 억지로 공부한다',
        effects: { academic: 1, mental: -4 },
        fatigueEffect: 5,
        message: '책은 펼쳐 놨지만 글자가 안 읽힌다. 저녁이 지나가고 커피만 식었다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 7,
          toneTag: 'regret',
          recallText: '책상 위 커피 얼룩만 늘어가던, 중2의 긴 겨울.',
        },
      },
      {
        text: '오늘은 아무것도 안 한다 — 쉰다',
        effects: { mental: 4 },
        fatigueEffect: -15,
        message: '책상 정리하고 이불 안으로 들어갔다. 죄책감보다 숨이 먼저 돌아왔다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'breakthrough',
          recallText: '아무것도 안 한 날. 죄책감보다 숨이 먼저 돌아왔다.',
        },
      },
      {
        text: '지훈이에게 전화한다 — 힘들다고 말한다',
        effects: { mental: 6, social: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '"...힘들어." 지훈이가 오래 들어줬다. 뭐라고 조언해준 건 아닌데, 그게 더 좋았다.',
        memorySlotDraft: {
          category: 'growth',
          importance: 8,
          toneTag: 'warm',
          recallText: '힘들다고 말했더니, 지훈이는 그냥 들어줬다.',
          npcIds: ['jihun'],
        },
      },
    ],
  },
  {
    id: 'burnout-event',
    title: '한계',
    description: '아무것도 하고 싶지 않다. 책상 앞에 앉아도 글자가 안 읽힌다.\n창밖만 멍하니 바라본다.',
    condition: (s) => s.mentalState === 'burnout' && s.year !== 3,  // v1.2: Y3는 middle-burnout이 선점
    location: 'home',
    background: 'bedroom_night',
    // speakers 제거 — 집에서 혼자인 장면. 지훈은 choices[2]에서만 등장
    choices: [
      {
        text: '그래도 억지로 공부한다',
        effects: { academic: 1, mental: -5 },
        fatigueEffect: 5,
        message: '억지로 했지만 아무것도 머리에 안 들어온다. 더 지쳤다.',
      },
      {
        text: '오늘은 그냥 쉰다',
        effects: { mental: 3 },
        fatigueEffect: -8,
        message: '아무것도 안 했다. 죄책감이 들지만... 지금은 쉬는 게 맞다.',
      },
      {
        text: '지훈이에게 전화한다',
        effects: { mental: 5, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '"야, 나 요즘 좀 힘들어..." 지훈이가 아무 말 없이 들어줬다. 좀 나아졌다.',
      },
    ],
  },
  {
    id: 'good-grade',
    title: '성적 상승!',
    description: '요즘 공부 흐름이 좋다.\n쉬는 시간에 담임 선생님이 지나가다 "요즘 꽤 열심히 하더라? 이대로만 계속 해" 하고 말씀하셨다.',
    condition: (s) => s.stats.academic >= 60 && s.week % 8 === 0 && s.week > 1,
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      {
        text: '"더 열심히 해야지!" — 의욕이 생긴다',
        effects: { academic: 2, mental: 3 },
        message: '칭찬을 들으니 기분이 좋다. 더 잘하고 싶다.',
      },
      {
        text: '"이 정도면 됐지~" — 여유를 부린다',
        effects: { mental: 2, social: 1 },
        message: '좀 쉬어도 되겠지. 친구들이 "부럽다" 한다.',
      },
    ],
  },
  {
    id: 'parent-pressure',
    title: '부모님의 한마디',
    description: '저녁 식사 중. 부모님이 성적 이야기를 꺼내신다.\n"요즘 공부는 잘 되니?"',
    condition: (s) => s.week === 15 || s.week === 36,
    location: 'home',
    background: 'dinner_table',
    choices: [
      {
        text: '"네, 열심히 하고 있어요"',
        effects: { mental: -1 },
        message: '"그래, 기대한다." 부담이 좀 느껴진다.',
      },
      {
        text: '"...보통이요"',
        effects: { mental: -2 },
        message: '부모님 표정이 살짝 굳었다.',
      },
      {
        text: '"요즘 좀 힘들어요" — 솔직하게 말한다',
        effects: { mental: 2 },
        message: '부모님이 잠시 침묵하다가 "힘들면 말해. 같이 생각해보자" 하셨다.',
      },
    ],
  },
] satisfies readonly GameEvent[];
