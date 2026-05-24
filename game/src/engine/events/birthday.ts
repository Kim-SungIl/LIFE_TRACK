import { GameEvent } from '../types';

export const BIRTHDAY_EVENTS = [
  // ===== 생일 이벤트 (매년 고정 주차 발동) =====
  {
    id: 'jihun-birthday', title: '지훈이 생일',
    description: '오늘이 지훈이 생일이다.\n단톡방에 생일 축하 메시지가 쏟아진다.',
    week: 14,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && (s.year === 1 || jihun.intimacy >= 30);
    },
    choices: [
      { text: '선물을 사서 준다 (-2만원)', effects: { social: 3, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '지훈이가 진짜 좋아했다. "야 너 최고다!" 돈 아깝지 않다.' },
      { text: '좋아하는 농구화 끈 세트를 고른다 (-5만원)', effects: { social: 4, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 10 }],
        message: '지훈이가 신발끈을 보더니 입이 쩍 벌어졌다. "야, 이거... 너 진짜 나랑 오래 볼 생각인가 보네." 웃으며 말했지만 진지한 눈이었다.' },
      { text: '카톡으로 축하만 한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"축하해~" 보냈다. 지훈이가 "고마워~" 했다. 좀 성의없었나?' },
    ],
    femaleChoices: [
      { text: '선물을 사서 준다 (-2만원)', effects: { social: 3, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '지훈이가 진짜 좋아했다. "야 너 최고다!" 돈 아깝지 않다.' },
      { text: '배드민턴 라켓 그립테이프 세트를 고른다 (-5만원)', effects: { social: 4, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 10 }],
        message: '지훈이가 그립테이프를 보더니 입이 쩍 벌어졌다. "야, 이거... 너 진짜 나랑 오래 칠 생각인가 보네." 웃으며 말했지만 진지한 눈이었다.' },
      { text: '카톡으로 축하만 한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"축하해~" 보냈다. 지훈이가 "고마워~" 했다. 좀 성의없었나?' },
    ],
  },
  {
    id: 'subin-birthday', title: '수빈이 생일',
    description: '오늘이 수빈이 생일이라는 게 떠올랐다.\n2학기가 시작되고 9월이다.',
    week: 29,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && (s.year === 1 || subin.intimacy >= 30);
    },
    choices: [
      { text: '선물을 준비했다 (-2만원)', effects: { social: 2, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 "어, 어떻게 알았어!" 하며 눈이 커졌다. "고마워..." 수줍게 웃었다.' },
      { text: '여행 에세이 책 한 권을 고른다 (-5만원)', effects: { social: 3, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'subin', intimacyChange: 10 }],
        message: '수빈이가 책을 받아 들고 한참 아무 말도 안 했다. "...너, 내가 어디 떠나고 싶어하는 거 알았어?" 목소리가 살짝 떨렸다.' },
      { text: '카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '"고마워~" 수빈이가 이모티콘을 보냈다.' },
    ],
  },
  {
    id: 'yuna-birthday', title: '유나의 생일',
    description: '오늘이 유나 생일인 걸 단톡에서 알게 됐다.\n유나는 조용히 자리에 앉아 있다.',
    // W38 (W37 단원평가/기말 알림과 충돌 회피 — speakers 우선 규칙으로 시험 알림이 영구 손실되던 문제)
    week: 38,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && (s.year === 1 || yuna.intimacy >= 30);
    },
    choices: [
      { text: '작은 선물을 준다 (-2만원)', effects: { social: 2, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 조용히 받아들었다. "...고마워." 살짝 붉어진 귀가 보였다.' },
      { text: '별 장식 머리핀 세트를 준비한다 (-5만원)', effects: { social: 3, mental: 4 }, moneyEffect: -5,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 10 }],
        message: '유나가 머리핀을 한참 보더니 말했다. "...이거, 내가 늘 쓰는 거 알았어?" 그리고 바로 꽂았다. 교실이 창문 빛에 빛났다.' },
      { text: '조용히 카톡으로 축하한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '"고마워" 짧은 답장이 왔다. 유나답다.' },
    ],
  },
] satisfies readonly GameEvent[];
