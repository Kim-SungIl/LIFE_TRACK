import { GameEvent, GameState } from '../../types';

export const JIHUN_EVENTS: GameEvent[] = [
  // ===== 지훈 이벤트 체인 =====
  {
    id: 'jihun-basketball',
    title: '방과후 한 판',
    description: '지훈이가 체육관 앞에서 손짓한다.\n"야, 오늘 방과후에 농구 안 할래? 3대3 하려는데 한 명 모자라."',
    location: 'gym',
    background: 'gymnasium',
    speakers: ['jihun'],
    condition: (s: GameState) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 15 && s.week >= 10 && !s.isVacation;
    },
    choices: [
      {
        text: '"좋아, 나 넣어!" — 같이 농구한다',
        effects: { health: 3, social: 2, mental: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '땀 뻘뻘 흘리면서 뛰었다. 지훈이 패스가 기가 막힌다. "야, 너 생각보다 잘하는데?"',
        timeCost: 1,
      },
      {
        text: '"오늘은 좀..." — 거절한다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -2 }],
        message: '"아 알겠어..." 지훈이가 아쉬운 표정으로 체육관에 들어갔다.',
      },
    ],
    femaleDescription: '지훈이가 체육관 앞에서 손짓한다.\n"야, 오늘 방과후에 배드민턴 안 칠래? 복식 하려는데 한 명 모자라."',
    femaleChoices: [
      {
        text: '"좋아!" — 같이 배드민턴 친다',
        effects: { health: 3, social: 2, mental: 2 },
        fatigueEffect: 4,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '배드민턴 재밌다! 지훈이 스매시가 무섭다. "야, 너 은근 잘 치는데?"',
        timeCost: 1,
      },
      {
        text: '"오늘은 좀..." — 거절한다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -2 }],
        message: '"아 알겠어..." 지훈이가 아쉬운 표정으로 체육관에 들어갔다.',
      },
    ],
  },
  {
    id: 'jihun-secret',
    title: '지훈이의 고민',
    description: '하교 후, 지훈이가 평소와 달리 조용하다.\n"야... 나 좀 고민 있는데, 들어줄 수 있어?"\n벤치에 앉아서 지훈이가 말을 꺼낸다.\n"나 체육 특기생 준비할까 생각 중인데... 부모님은 공부하래."',
    location: 'park',
    background: 'sunset_walk',
    speakers: ['jihun'],
    condition: (s: GameState) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 30 && s.year >= 2 && s.week >= 20 && !s.isVacation;
    },
    choices: [
      {
        text: '"네가 하고 싶은 거 해야지" — 지훈이 편을 든다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '지훈이 눈이 빛났다. "...고마워. 너한테 말하길 잘했다." 진지한 지훈이는 처음 본다.',
      },
      {
        text: '"부모님 말도 한 번 생각해봐" — 현실적으로 조언한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '"...그것도 맞는 말이긴 해." 지훈이가 한숨을 쉬었다. 쉬운 문제가 아니다.',
      },
      {
        text: '"둘 다 해보면 안 돼?" — 절충안을 제시한다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '"둘 다...? 힘들겠지만 해볼 만할까?" 지훈이가 고민하기 시작했다.',
      },
    ],
  },
  {
    id: 'jihun-fight',
    title: '지훈이와 다툼',
    description: '지훈이가 갑자기 화를 냈다.\n"너는 요즘 연락도 잘 안 되고, 불러도 안 오고."\n예상 못한 말에 당황했다.\n"...나도 바쁜 거 알잖아."\n"그래, 그러니까 말이야."',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['jihun'],
    condition: (s: GameState) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 40 && s.week >= 28 && !s.isVacation;
    },
    choices: [
      {
        text: '"미안, 내가 신경을 못 썼다" — 솔직하게 사과한다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }],
        message: '"...나도 미안. 좀 예민했어." 지훈이가 머리를 긁적였다. 싸우고 나니 오히려 가까워진 느낌.',
      },
      {
        text: '"나한테만 왜 그래?" — 화를 낸다',
        effects: { mental: -3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -5 }],
        message: '둘 다 화가 난 채로 헤어졌다. ... 마음이 무겁다.',
      },
      {
        text: '"잠깐 시간 좀 줘" — 거리를 둔다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '며칠 후 지훈이가 먼저 연락했다. "야... 그때 내가 좀 심했다." 시간이 필요했던 것 같다.',
      },
    ],
  },
  {
    id: 'jihun-support',
    title: '지훈이의 대회',
    description: '지훈이가 학교 대표로 농구 대회에 나간다.\n"이번 토요일인데... 너 올 수 있어? 아, 안 와도 되긴 하는데..."',
    femaleDescription: '지훈이가 학교 대표로 배드민턴 대회에 나간다.\n"이번 토요일인데... 너 올 수 있어? 아, 안 와도 되긴 하는데..."',
    location: 'gym',
    background: 'gymnasium',
    speakers: ['jihun'],
    condition: (s: GameState) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 55 && s.week >= 35 && !s.isVacation;
    },
    choices: [
      {
        text: '"당연히 가야지!" — 응원하러 간다',
        effects: { social: 3, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '관중석에서 목이 터져라 응원했다. 지훈이가 3점슛을 넣고 이쪽을 봤다. 눈이 마주쳤다. 최고의 순간.',
        timeCost: 1,
      },
      {
        text: '"미안, 그날 일이 있어..." — 못 간다',
        effects: { mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '나중에 지훈이가 "이겼다" 하고 보냈다. 축하한다고 했지만... 직접 보고 싶었다.',
      },
    ],
    femaleChoices: [
      {
        text: '"당연히 가야지!" — 응원하러 간다',
        effects: { social: 3, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '관중석에서 목이 터져라 응원했다. 지훈이가 결정적인 스매시를 넣고 이쪽을 봤다. 눈이 마주쳤다. 최고의 순간.',
        timeCost: 1,
      },
      {
        text: '"미안, 그날 일이 있어..." — 못 간다',
        effects: { mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '나중에 지훈이가 "이겼다" 하고 보냈다. 축하한다고 했지만... 직접 보고 싶었다.',
      },
    ],
  },
  {
    id: 'jihun-promise',
    title: '졸업 후 약속',
    description: '졸업이 다가온다. 지훈이가 학교 옥상으로 올라가자고 했다.\n바람이 분다. 지훈이가 멀리 보며 말한다.\n"야... 우리 진짜 오래 알았다, 그치?"\n"...어. 초등학교 때부터."',
    location: 'rooftop',
    background: 'rooftop',
    speakers: ['jihun'],
    condition: (s: GameState) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 70 && s.week >= 40 && !s.isVacation;
    },
    choices: [
      {
        text: '"앞으로도 계속 친구하자" — 약속한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '"당연하지, 바보야." 지훈이가 웃었다. 바람에 눈이 좀 매웠다. ...바람 때문이다.',
      },
      {
        text: '"너 없었으면 학교생활 재미없었을 거야" — 고마움을 전한다',
        effects: { mental: 5, social: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }],
        message: '"야, 갑자기 왜 이래..." 지훈이가 웃으면서도 눈이 빨개졌다. "...나도."',
      },
    ],
  },
];
