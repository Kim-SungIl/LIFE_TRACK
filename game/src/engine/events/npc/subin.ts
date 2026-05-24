import { GameEvent } from '../../types';

export const SUBIN_EVENTS = [
  // ===== 수빈 이벤트 체인 =====
  {
    id: 'subin-bridge',
    title: '수빈이의 소개',
    description: '점심시간에 수빈이가 손을 잡고 끌어간다.\n"야, 잠깐만! 내 학원 친구 소개시켜줄게. 너랑 잘 맞을 것 같아."\n옆 반 아이가 어색하게 웃으며 서 있다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      if (!subin?.met || subin.intimacy < 20 || s.isVacation) return false;
      // Y1은 1학기 밀집 완화로 2학기부터, 그 외 연도는 W10부터
      return s.year === 1 ? s.week >= 26 : s.week >= 10;
    },
    choices: [
      {
        text: '"안녕!" — 밝게 인사한다',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 4 }],
        message: '수빈이 덕분에 새로운 친구가 생겼다. 수빈이는 이런 걸 참 잘한다. 어디서든 사람을 이어주는 애.',
      },
      {
        text: '"아... 안녕" — 어색하게 인사한다',
        effects: { social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 1 }],
        message: '수빈이가 중간에서 분위기를 풀어줬다. "걔 좀 낯가리는데 원래 재밌어~" 하면서.',
      },
    ],
  },
  {
    id: 'subin-lonely',
    title: '혼자 있는 수빈',
    description: '체험학습 날. 다들 그룹으로 모여서 떠드는데,\n수빈이가 혼자 벤치에 앉아 핸드폰을 보고 있다.\n아까까지 다른 반 애들이랑 웃고 있었는데... 다 가고 없다.\n"어? 나? 괜찮아, 나 원래 이런 거 익숙해."',
    location: 'school_gate',
    background: 'school_gate_{school}',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 35 && !s.isVacation && s.year >= 2;
    },
    choices: [
      {
        text: '"같이 있자" — 옆에 앉는다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 잠깐 놀란 표정을 지었다가 웃었다. "...고마워." 친구가 많은 애인 줄만 알았는데, 이런 순간도 있구나.',
      },
      {
        text: '"괜찮아?" — 물어본다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '"응, 진짜 괜찮아~ 나 혼자 있는 거 좋아해." 밝게 웃었지만, 아까 핸드폰을 보던 표정이 자꾸 생각난다.',
      },
      {
        text: '그냥 지나간다',
        effects: {},
        message: '수빈이가 뒤에서 누군가에게 전화를 걸고 있었다. 밝은 목소리로.',
      },
    ],
  },
  {
    id: 'subin-divorce',
    title: '수빈이의 비밀',
    description: '학원 끝나고 편의점에서 아이스크림을 먹고 있는데,\n수빈이가 갑자기 조용해졌다.\n"있잖아... 우리 엄마아빠 이혼했어. 초등학교 때."\n"아 왜 이렇게 표정 심각해, 별 거 아니야."',
    location: 'street',
    background: 'hagwon_front',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 50 && !s.isVacation && s.year >= 3;
    },
    choices: [
      {
        text: '조용히 들어준다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '"별 거 아니라고 했지만... 사실 아빠가 보고 싶을 때 있어." 수빈이가 아이스크림을 녹이고 있었다. 처음 보는 표정이다.',
      },
      {
        text: '"말해줘서 고마워" — 짧게 위로한다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 4 }],
        message: '"야, 진짜 별 거 아니라니까~ 분위기 왜 이래." 수빈이가 웃었지만 눈이 빨개져 있었다.',
      },
      {
        text: '"그래서 그랬구나..." — 수빈이의 밝음이 이해가 된다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '수빈이가 잠깐 멈칫했다. "...뭐가?" "항상 밝은 거." 한참 침묵. "...너 은근 무섭다." 수빈이가 코를 훌쩍였다.',
      },
    ],
  },
  {
    id: 'subin-dream',
    title: '어디든 갈 수 있다면',
    description: '수빈이가 카톡을 보냈다. "야, 내일 학원 빠지고 카페 갈래?"\n카페에서 수빈이가 핸드폰에 항공사 사이트를 보여준다.\n"나 승무원 되고 싶어. 어디든 떠나고 싶어서..."',
    location: 'cafe',
    background: 'cafe_study',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 60 && !s.isVacation && s.year >= 5;
    },
    choices: [
      {
        text: '"수빈이답다. 어울린다" — 응원한다',
        effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '"진짜? 엄마는 대학 가라고 하는데..." 수빈이 눈이 반짝였다. "너한테 먼저 말하고 싶었어. 나 이거 진지해."',
      },
      {
        text: '"왜 떠나고 싶어?" — 물어본다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '"...잠깐 만나고 스쳐지나가는 거, 그게 나한테는 오히려 편해." 수빈이가 조용히 말했다. 밝은 수빈이 안에 이런 마음이 있었다.',
      },
      {
        text: '"멀리 가면 외롭지 않아?" — 걱정한다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '"지금도 외로운 건 마찬가지야." 수빈이가 웃었다. "근데 비행기 위에서 외로운 게 여기서 외로운 것보단 나을 것 같아."',
      },
    ],
  },
  {
    id: 'subin-farewell',
    title: '각자의 하늘',
    description: '졸업이 다가온다. 학원 앞에서 수빈이가 기다리고 있었다.\n"야, 나 항공서비스학과에 원서 넣었어."\n"...진짜?"\n"엄마 설득하는 게 제일 힘들었어. 근데 해냈다." 수빈이가 환하게 웃는다.',
    location: 'street',
    background: 'hagwon_front',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 70 && s.week >= 40 && !s.isVacation && s.year === 7;
    },
    choices: [
      {
        text: '"수빈아, 꼭 되길 바라. 너 비행기에서 완전 잘 어울릴 거야"',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '"야... 나 울 것 같잖아." 수빈이가 눈을 비볐다. "너한테 먼저 말하길 잘했어." 학원 앞 가로등 아래에서 인사를 했다. 각자의 하늘로.',
      },
      {
        text: '"좀 아쉽다... 근데 멋있다" — 솔직하게 말한다',
        effects: { mental: 3, social: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 4 }],
        message: '"나도 아쉬워. 근데 이게 내 길이야." 수빈이가 단단하게 말했다. "어디 가든 연락할게. 진짜야."',
      },
    ],
  },
] satisfies readonly GameEvent[];
