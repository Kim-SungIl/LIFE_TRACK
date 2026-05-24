import { GameEvent, GameState } from '../../types';

export const YUNA_EVENTS: GameEvent[] = [
  // ===== 유나 이벤트 체인 =====
  {
    id: 'yuna-library',
    title: '도서관에서',
    description: '도서관에서 유나를 발견했다.\n교과서가 아니라 소설을 읽고 있다.\n눈이 마주치자 유나가 손을 흔든다.\n"어, 왔어? 나 지금 이거 읽는데 진짜 재밌어!"',
    location: 'library',
    background: 'library_{school}',
    speakers: ['yuna'],
    condition: (s: GameState) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      if (!yuna?.met || yuna.intimacy < 10 || s.isVacation) return false;
      // Y1은 1학기 밀집 완화로 2학기부터, 그 외 연도는 W8부터
      return s.year === 1 ? s.week >= 25 : s.week >= 8;
    },
    choices: [
      {
        text: '"무슨 책 읽어?" — 말을 건다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '"요즘 빠진 소설인데, 진짜 좋아. 너도 읽어봐!" 유나가 신나서 책을 보여줬다. 의외로 소설 취향이 있다.',
      },
      {
        text: '조용히 옆에 앉아서 공부한다',
        effects: { academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '옆에서 공부했다. 유나가 가끔 소설 구절을 읽어줬다. 돌아갈 때 "다음에도 같이 오자!" 했다.',
      },
      {
        text: '그냥 지나간다',
        effects: {},
        message: '유나가 "에이~" 하더니 다시 책에 빠졌다. 뭘 읽고 있었는지 좀 궁금하다.',
      },
    ],
  },
  {
    id: 'yuna-lunch',
    title: '옥상에서 점심',
    description: '점심시간에 옥상에 올라왔다. 여기 아무도 없을 줄 알았는데.\n유나가 도시락을 펼쳐놓고 앉아 있다.\n"어, 너도 여기 왔어? 여기 바람 좋지 않아? 나만의 비밀 장소인데!"',
    location: 'rooftop',
    background: 'rooftop',
    speakers: ['yuna'],
    // M5 Phase 3: intimacy 25→20, week 18→10 완화
    condition: (s: GameState) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 20 && s.week >= 10 && !s.isVacation;
    },
    choices: [
      {
        text: '"같이 먹어도 돼?" — 옆에 앉는다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '유나가 신나서 자리를 만들어줬다. 바람이 좋았다. "여기 비밀이야? 아무한테도 말하면 안 돼!" 하며 새끼손가락을 내밀었다.',
      },
      {
        text: '"아, 미안. 나갈게" — 자리를 비켜준다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '"에이, 같이 먹자!" 유나가 뒤늦게 외쳤지만 이미 문을 닫은 뒤였다.',
      },
    ],
  },
  {
    id: 'yuna-hobby',
    title: '유나의 취미',
    description: '방과후, 음악실에서 피아노 소리가 들린다.\n들여다보니 유나가 피아노를 치고 있다.\n쇼팽. 놀랄 정도로 잘 친다.\n문이 삐걱 소리를 내고 유나가 고개를 돌렸다.\n"아, 들었어? 어때, 좀 치지?"',
    location: 'music_room',
    background: 'music_room',
    speakers: ['yuna'],
    // M5 Phase 3: intimacy 35→25 완화
    condition: (s: GameState) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 25 && s.week >= 25 && !s.isVacation;
    },
    choices: [
      {
        text: '"진짜 잘 친다... 피아노 배웠어?" — 관심을 보인다',
        effects: { talent: 2, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '"초등학교 때부터 쳤어! 그만뒀는데 가끔 치고 싶을 때가 있거든." 유나가 환하게 웃었다. "너한테 들킨 건 처음이야. 비밀이다?"',
      },
      {
        text: '"한 곡만 더 쳐줘" — 부탁한다',
        effects: { mental: 4, talent: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '"그래? 그럼 이거 들어봐!" 유나가 신나서 다시 건반에 손을 올렸다. 드뷔시. 저녁 햇살이 음악실을 물들였다. 아름다운 시간이었다.',
      },
      {
        text: '"미안, 실수로 들었어" — 물러난다',
        effects: {},
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '"아 괜찮아~ 다음에 제대로 들려줄게!" 유나가 뚜껑을 닫았다. 다음이 기대된다.',
      },
    ],
  },
  {
    id: 'yuna-pressure',
    title: '1등의 무게',
    description: '시험 기간. 항상 밝던 유나가 복도에서 멈춰 서 있다.\n가까이 가니 손이 떨리고 있다.\n"...나 또 1등 해야 해. 엄마가... 2등은 안 된대."\n처음 보는 표정이다.',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['yuna'],
    // M5 Phase 3: intimacy 50→35, week 범위 30~40 확대, 여러 학년 가능
    condition: (s: GameState) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 35 && s.week >= 30 && s.week <= 40 && !s.isVacation;
    },
    choices: [
      {
        text: '"2등이면 어때, 유나는 유나야" — 있는 그대로를 인정해준다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 눈물을 참고 있었다. 항상 웃기만 하던 유나가. "...아무도 그런 말 안 해줬어." 작게 "고마워" 하고 교실로 돌아갔다.',
      },
      {
        text: '"같이 공부하자. 내가 도와줄게" — 실질적으로 돕는다',
        effects: { academic: 1, social: 1, mental: 1 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '같이 도서관에서 공부했다. 유나가 조금씩 원래 모습을 되찾았다. "너랑 공부하면 덜 무서워. 진짜야."',
      },
      {
        text: '"힘들면 쉬어도 돼" — 쉬는 것도 괜찮다고 말해준다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '"쉬는 거... 나한테는 사치야." 유나가 평소와 다르게 힘없이 웃었다. 마음이 아팠다.',
      },
    ],
  },
  {
    id: 'yuna-smile',
    title: '유나의 선택',
    description: '졸업이 다가온다. 유나가 평소보다 더 환하게 다가왔다.\n"야, 나 결정했어. 음대 갈 거야. 피아노."\n"...진짜?"\n"엄마한테 말했거든. 크게 싸웠는데... 이번엔 안 지려고."',
    location: 'classroom',
    background: 'classroom_{school}_sunset',
    speakers: ['yuna'],
    // M5 Phase 3: intimacy 65→45 완화
    // 졸업/음대 결정 컨텍스트 — Y7 후반에만 (subin-farewell과 동일 패턴)
    condition: (s: GameState) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 45 && s.year === 7 && s.week >= 40 && !s.isVacation;
    },
    choices: [
      {
        text: '"잘했다, 유나. 네 피아노 진짜 좋았어" — 진심을 말한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 웃었다. 평소의 밝은 웃음이 아니라, 뭔가를 이겨낸 사람의 웃음이었다.\n"고마워. 네가 그때 들어줘서, 내가 여기까지 온 거야."',
      },
      {
        text: '"나중에 연주회 하면 꼭 갈게" — 약속한다',
        effects: { mental: 4, social: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '"꼭 와야 해! 약속!" 유나가 새끼손가락을 내밀었다. 약속.',
      },
    ],
  },
];
