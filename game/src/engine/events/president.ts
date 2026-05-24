import { GameEvent, GameState } from '../types';

// 실제 반장(반장선거 당선) 여부 체크 — 반장 전용 이벤트 조건에 사용
// 현재 연도 기준 반장 여부 — 매년 선거가 새로 열리므로 같은 해 당선만 카운트
function isClassPresident(s: GameState): boolean {
  return s.events.some(e =>
    (e.id === 'class-president-win' || e.id === 'class-president-2-win')
    && e.year === s.year
    && e.resolvedChoice !== undefined
  );
}

// 반장/부반장 포함 학급 임원 여부 체크 — 같은 해 기준
function isClassOfficer(s: GameState): boolean {
  return isClassPresident(s)
    || s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year && e.resolvedChoice === 0)
    || s.events.some(e => e.id === 'class-president-vice' && e.year === s.year && e.resolvedChoice === 0);
}

export const PRESIDENT_FOLLOWUP = [
  // ===== 반장 후속 이벤트 =====
  {
    id: 'class-president-nudge', title: '민재의 추천',
    description: '쉬는 시간에 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데, 너가 하면 딱인데? 내가 추천할까?"',
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['minjae'],
    choices: [
      { text: '"...해볼까?" — 민재 말에 용기를 낸다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "내 눈은 틀리지 않지" 하며 웃었다.' },
      { text: '"아니야, 난 괜찮아" — 정중하게 거절한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '"알겠어, 근데 너 진짜 잘할 수 있었을 텐데." 민재 말에 기분이 나쁘진 않았다.' },
    ],
    condition: (s) => {
      const electionEvent = s.events.find(e =>
        (e.id === 'class-president' || e.id === 'class-president-2') &&
        e.year === s.year &&
        e.resolvedChoice === 1 &&
        s.week - (e.week || 0) <= 4
      );
      const alreadyFiredThisYear = s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year);
      return !!electionEvent && !alreadyFiredThisYear && s.stats.social >= 55;
    },
  },
] satisfies readonly GameEvent[];

export const PRESIDENT_ELECTION = [
  // ===== 반장 선거 이벤트 =====
  {
    id: 'class-president', title: '반장 선거',
    description: '반장 선거 시즌이다.\n선생님이 교탁 앞에 서서 말했다.\n"자, 반장 후보 나올 사람 있나요?"',
    week: 3,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 교실이 술렁인다. 이제 선거 연설을 해야 한다.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 조용히 손을 들었다. "아무도 안 하면 제가 할게요." 민재가 반장이 됐다. 의외로 차분하게 나서는 타입이다.' },
    ],
  },
  {
    id: 'class-president-speech', title: '선거 연설',
    description: '교탁 앞에 섰다.\n반 친구들의 시선이 모인다.\n무슨 말을 해야 할까?',
    // 같은 해 출마(c0) 후 + 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-win' || e.id === 'class-president-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"열심히 하겠습니다!" — 진심을 담아 외친다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '떨리는 목소리지만 진심이 닿았다. 박수 소리가 들린다.' },
      { text: '"여러분의 의견을 듣겠습니다" — 차분하게 약속한다', effects: { social: 2, mental: 2 }, fatigueEffect: 2,
        message: '담담했지만 어른스러운 인상을 남겼다. 몇몇이 고개를 끄덕였다.' },
      { text: '"...잘 부탁드립니다" — 짧게 끝낸다', effects: { social: 1 }, fatigueEffect: 1,
        message: '짧게 마쳤다. 무난했지만 인상에 남지 않았다.' },
    ],
  },
  {
    id: 'class-president-win', title: '반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n반 친구들이 박수를 쳐준다.',
    // 매년 발동: 같은 해 출마(c0) + 같은 해에 -lose/-win 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 40
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '반장이 됐다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '당선됐다! 떨리지만 잘 해보자.' },
    ],
  },
  {
    id: 'class-president-lose', title: '반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n가슴이 조금 내려앉았다.',
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 40
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '아깝게 졌다. 조금 씁쓸하지만 인정한다.' },
    ],
  },
  {
    id: 'class-president-vice', title: '부반장 제안',
    description: '쉬는 시간에 당선된 반장이 다가온다.\n"야, 부반장 자리 아직 비었는데... 어때?"',
    condition: (s) => s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-vice' && e.year === s.year),
    location: 'classroom', background: 'classroom_{school}', speakers: ['minjae'],
    choices: [
      { text: '"좋아, 해볼게" — 부반장을 맡는다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "우리 잘 해보자!" 하며 주먹을 내밀었다.' },
      { text: '"아니, 괜찮아..." — 정중히 거절한다', effects: { mental: 1 },
        message: '다음에 기회가 있을 거다. 지금은 조용히 지내자.' },
    ],
  },
  {
    id: 'class-president-2', title: '2학기 반장 선거',
    description: '2학기가 시작됐다. 선생님이 교탁 앞에 서서 말했다.\n"이번 학기 반장, 나올 사람 있나요?"',
    week: 25, location: 'classroom', background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 올해는 조금 더 자신 있게.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 다시 손을 들었다. "할 사람 없으면 제가 하죠." 2학기도 민재가 반장. 책임감이 대단하다.' },
    ],
  },
  {
    id: 'class-president-2-speech', title: '2학기 선거 연설',
    description: '다시 교탁 앞에 섰다.\n이번엔 조금 덜 떨린다. 어떤 말을 할까.',
    // 같은 해 2학기 출마(c0) 후 + 2학기 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-2-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-2-win' || e.id === 'class-president-2-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"이번 학기엔 더 잘 해보겠습니다" — 1학기 경험을 살려 다짐한다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '경험에서 우러난 말이라 무게가 달랐다. 호응이 좋았다.' },
      { text: '"새로운 계획을 준비했습니다" — 구체적인 약속을 한다', effects: { social: 2, mental: 2, academic: 1 }, fatigueEffect: 2,
        message: '준비한 만큼 차분하게 전했다. "오, 진심이네" 누군가가 작게 말했다.' },
      { text: '"잘 부탁드립니다" — 짧게 마무리한다', effects: { social: 1 }, fatigueEffect: 1,
        message: '담담히 끝냈다. 평이했다.' },
    ],
  },
  {
    id: 'class-president-2-win', title: '2학기 반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n2학기 반장이다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 50
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '2학기도 반장이다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '이번엔 더 잘 해내고 싶다. 반 친구들의 기대가 느껴진다.' },
    ],
  },
  {
    id: 'class-president-2-lose', title: '2학기 반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n이번에도 아깝게 졌다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 50
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '인기를 더 쌓아야겠다는 생각이 든다. 옆자리 친구가 "다음 학기엔 될 거야" 하며 어깨를 두드렸다.' },
    ],
  },
] satisfies readonly GameEvent[];

export const PRESIDENT_ONLY = [
  // ===== 반장 전용 이벤트 =====
  {
    id: 'president-errand', title: '반장의 심부름',
    description: '선생님이 부르신다.\n"반장, 교무실에서 유인물 좀 가져다줄래? 아, 그리고 다음 주 현장학습 인원 확인도 부탁해."',
    location: 'hallway', background: 'hallway_{school}',
    choices: [
      { text: '"네, 알겠습니다!" — 성실하게 처리한다', effects: { social: 2, academic: 1 }, fatigueEffect: 3,
        message: '바쁘지만 선생님이 "역시 믿음직하다" 하셨다. 뿌듯하다.' },
      { text: '"아... 네..." — 좀 귀찮지만 한다', effects: { social: 1 }, fatigueEffect: 2,
        message: '시킨 건 했지만 의욕은 없었다. 반장이 이렇게 피곤한 거였나.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.week > 4,
  },
  {
    id: 'president-mediate', title: '반장의 중재',
    description: '반 친구 둘이 크게 싸우고 있다.\n선생님이 자리를 비운 사이, 다들 반장인 나를 쳐다본다.\n"야, 너가 좀 말려봐..."',
    location: 'classroom', background: 'classroom_{school}_afternoon',
    choices: [
      { text: '중간에서 양쪽 이야기를 듣는다', effects: { social: 4, mental: -2 }, fatigueEffect: 3,
        message: '쉽지 않았지만 결국 둘 다 진정시켰다. "고마워, 반장." 피곤하지만 보람 있다.' },
      { text: '"선생님 오실 때까지 기다리자" — 넘긴다', effects: { social: -1, mental: 1 },
        message: '결국 담임이 와서 해결했다. "반장이 좀 나섰어야지..." 누군가가 작게 말했다.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.stats.social >= 40,
  },
  {
    id: 'president-speech', title: '조회 시간 발표',
    description: '월요일 조회. 담임이 "반장, 이번 주 공지사항 전달해" 한다.\n반 전체가 나를 본다. 긴장된다.',
    location: 'classroom', background: 'classroom_{school}',
    choices: [
      { text: '당당하게 발표한다', effects: { social: 3, mental: 2 }, fatigueEffect: 2,
        message: '떨렸지만 잘 해냈다! 끝나고 지훈이가 "야, 반장 제법인데?" 했다.' },
      { text: '후다닥 빨리 끝낸다', effects: { social: 1, mental: -1 },
        message: '우물우물 빨리 끝냈다. 아무도 뭐라 안 했지만... 좀 창피하다.' },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation,
  },
] satisfies readonly GameEvent[];

export const PRESIDENT_NON = [
  // ===== 비반장: 반장을 지켜보는 이벤트 =====
  {
    id: 'watching-president', title: '민재가 지쳐 보인다',
    description: '요즘 반장 민재가 피곤해 보인다. 성적도 유지해야 하고, 반장 일도 해야 하고...\n쉬는 시간에 민재가 노트를 펴놓고 한숨을 쉬고 있다.\n"야... 시간이 안 된다 진짜..."',
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    choices: [
      { text: '"괜찮아? 뭐 도와줄까?" — 다가간다', effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"진짜? 고마워..." 민재가 노트를 덮었다. 반장 일에 성적까지, 혼자 다 하려는 애다.' },
      { text: '조용히 지나간다', effects: { mental: 1 },
        message: '민재도 버거운 거구나. 전교 1등이 쉬운 게 아니라는 걸 처음 느꼈다.' },
    ],
    condition: (s) => !isClassOfficer(s) && !s.isVacation && s.week > 6 && s.stats.social >= 35,
  },

] satisfies readonly GameEvent[];
