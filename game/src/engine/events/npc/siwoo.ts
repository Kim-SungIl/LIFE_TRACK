import { GameEvent } from '../../types';

// 한시우(siwoo) — 고1(Y5) 데뷔, 관찰자·건축꿈·드라이유머. 감정 형용사 0, 사물·공간·동선으로만.
// intro '3주째 멈춘 크레인'이 t80 '아파트 한 동이 다 올라간 자리'로 회수(수미상관).
export const SIWOO_EVENTS = [
  {
    id: 'siwoo-meet',
    title: '3주째 멈춘 크레인',
    description: '고1 초입, 창가 뒷자리. 시우는 늘 창밖 한 점만 본다. 3주째 같은 자리에 멈춰 선 크레인 — 동네 한복판에 뼈대만 올라가다 만 건물. 말을 걸자 턱으로 창밖을 가리킬 뿐이다.\n시우: "저거 3주째 안 올라가. …뭐가 잘못된 거겠지, 보이는 데가 아니라." 시선은 멈춘 크레인에, 손은 빈 텀블러에.',
    location: 'classroom',
    background: 'classroom_high',
    speakers: ['siwoo'],
    condition: (s) => {
      const siwoo = s.npcs.find(n => n.id === 'siwoo');
      return s.year === 5 && !siwoo?.met && !s.isVacation;
    },
    choices: [
      { text: '"어디가 잘못된 건데?" 그의 시선을 따라간다', effects: { mental: 2, social: 1 },
        npcEffects: [{ npcId: 'siwoo', intimacyChange: 10 }],
        message: '시우가 처음으로 너를 한 번 본다. "…보려는 사람이 있네." 다시 크레인을 가리킨다. "기초가 안 맞으면 위는 못 올라가. 안 보이는 데가 문제야, 늘." 평소보다 말이 길다.' },
      { text: '"그거 그렇게 오래 봐?"', effects: { mental: 1 },
        npcEffects: [{ npcId: 'siwoo', intimacyChange: 6 }],
        message: '"매일 같은 시간에 같은 데가 안 변하면, 보게 돼." 빈 텀블러를 만지작거린다.' },
      { text: '"그게 너랑 무슨 상관인데"', effects: {},
        npcEffects: [{ npcId: 'siwoo', intimacyChange: 3 }],
        message: '"…상관은 없지." 시우가 시선을 도로 창밖에 둔다. 빈 텀블러가 책상 끝에서 조금 더 밀려난다.' },
    ],
  },
] satisfies readonly GameEvent[];
