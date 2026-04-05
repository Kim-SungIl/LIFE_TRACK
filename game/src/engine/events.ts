import { GameEvent, GameState } from './types';

export const GAME_EVENTS: GameEvent[] = [
  // ===== 초반 이벤트 (W1~W4) =====
  {
    id: 'first-week',
    title: '새 학기 첫날',
    description: '새 학기가 시작됐다. 교실에 들어서니 아는 얼굴도, 모르는 얼굴도 보인다.\n옆자리에 앉은 아이가 말을 건다. "야, 점심 같이 먹을래?"',
    week: 1,
    choices: [
      {
        text: '"좋아!" — 같이 먹으러 간다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '민재와 점심을 먹었다. 생각보다 재밌는 애다.',
      },
      {
        text: '"아... 나 할 거 있어서" — 혼자 도서관에 간다',
        effects: { academic: 1, mental: -1 },
        message: '도서관에서 조용히 시간을 보냈다. 편하긴 한데... 좀 외롭다.',
      },
    ],
  },
  {
    id: 'jihun-call',
    title: '지훈이의 전화',
    // 남자 버전: 농구
    description: '저녁에 지훈이한테 전화가 왔다.\n"야, 이번 주말에 농구하러 갈래? 민재도 온대."',
    week: 3,
    choices: [
      {
        text: '"가자!" — 주말에 농구하러 간다',
        effects: { health: 2, social: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
        message: '지훈이, 민재와 농구를 했다. 오랜만에 신나게 뛰었다!',
      },
      {
        text: '"미안, 공부해야 해..." — 거절한다',
        effects: { academic: 1, mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "알겠어..."라고 했다. 전화를 끊고 나니 좀 찝찝하다.',
      },
    ],
    // 여자 버전: 떡볶이
    femaleDescription: '저녁에 지훈이한테 전화가 왔다.\n"야, 너 요즘 공부만 하잖아. 이번 주말에 떡볶이 먹으러 갈래? 민재도 온대."',
    femaleChoices: [
      {
        text: '"가자!" — 같이 떡볶이 먹으러 간다',
        effects: { social: 3, mental: 4 },
        fatigueEffect: 1,
        moneyEffect: -1,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
        message: '지훈이, 민재와 분식집에서 떡볶이를 먹었다. 수다 떨다 보니 시간 가는 줄 몰랐다!',
      },
      {
        text: '"미안, 공부해야 해..." — 거절한다',
        effects: { academic: 1, mental: -2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -3 }],
        message: '지훈이가 "알겠어..."라고 했다. 전화를 끊고 나니 좀 찝찝하다.',
      },
    ],
  },
  // ===== 1학기 이벤트 =====
  {
    id: 'midterm-1',
    title: '첫 중간고사',
    description: '중간고사가 다가온다. 교실 분위기가 달라졌다.\n다들 쉬는 시간에도 책을 펴고 있다.',
    week: 8,
    choices: [
      {
        text: '시험공부에 올인한다 — 이번만큼은 잘 보고 싶다',
        effects: { academic: 4, mental: -3 },
        fatigueEffect: 10,
        message: '시험공부에 매달렸다. 피곤하지만 뭔가 뿌듯하다.',
      },
      {
        text: '평소대로 한다 — 벼락치기는 안 맞아',
        effects: { academic: 1, mental: 1 },
        message: '무리하지 않고 평소 페이스를 유지했다.',
      },
      {
        text: '친구들이랑 같이 공부한다 — 혼자는 지루해',
        effects: { academic: 2, social: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '유나랑 같이 공부했다. 유나가 모르는 거 잘 알려준다.',
      },
    ],
  },
  {
    id: 'subin-academy',
    title: '수빈이와 학원',
    description: '학원에서 수빈이를 만났다. 같은 학원이었는데 몰랐다.\n"우리 같은 학원이었어? 쉬는 시간에 같이 편의점 갈래?"',
    week: 5,
    condition: (s) => s.routineSlot2 === 'academy' || s.routineSlot3 === 'academy',
    choices: [
      {
        text: '"그래!" — 같이 간다',
        effects: { social: 1, mental: 2 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 8 }],
        message: '수빈이랑 편의점에서 아이스크림을 먹었다. 학원이 덜 지루해졌다.',
      },
      {
        text: '"나 복습 좀 해야 해" — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: -2 }],
        message: '수빈이가 "아, 그래..." 하고 혼자 갔다.',
      },
    ],
  },
  {
    id: 'sports-day',
    title: '체육대회',
    description: '학교 체육대회 날이다! 반 대항 릴레이가 있다.\n"야, 너 달리기 잘해? 우리 반 대표 한 명 더 필요한데..."',
    week: 10,
    choices: [
      {
        text: '"내가 할게!" — 대표로 나선다',
        effects: { social: 4, health: 2, mental: 3 },
        fatigueEffect: 5,
        message: '반 대표로 달렸다! 1등은 아니었지만 다들 고마워했다. 이름을 기억하는 아이가 늘었다.',
      },
      {
        text: '"나는 패스..." — 응원만 한다',
        effects: { social: 1, mental: 1 },
        message: '응원석에서 소리 질렀다. 재밌긴 한데, 좀 아쉽다.',
      },
      {
        text: '체육대회를 핑계로 쉰다 — 보건실에 간다',
        effects: { health: 1 },
        fatigueEffect: -5,
        message: '보건실에서 쉬면서 소리만 들었다. 편하긴 한데...',
      },
    ],
  },
  // ===== 여름방학 이벤트 =====
  {
    id: 'summer-start',
    title: '여름방학 시작!',
    description: '드디어 방학이다! 종업식이 끝나고 교문을 나서는 순간, 자유의 공기가 느껴진다.\n이번 방학, 뭘 하고 싶어?',
    week: 20,
    choices: [
      {
        text: '"이번 방학엔 진짜 공부 열심히 할 거야"',
        effects: { academic: 2, mental: -1 },
        message: '의지를 다졌다. 과연 지킬 수 있을까?',
      },
      {
        text: '"실컷 놀 거야!!!"',
        effects: { mental: 5, social: 2 },
        message: '해방감이 밀려온다. 이게 방학이지!',
      },
      {
        text: '"돈 좀 모아야겠다"',
        effects: {},
        moneyEffect: 3,
        message: '알바를 알아보기로 했다.',
      },
    ],
  },
  {
    id: 'summer-trip',
    title: '지훈이의 제안',
    description: '"야, 이번에 바다 갈래? 민재도 간대.\n수빈이한테도 물어볼까?"',
    week: 22,
    choices: [
      {
        text: '"가자!!!" — 다 같이 바다로!',
        effects: { social: 3, health: 2, mental: 5 },
        fatigueEffect: 3,
        moneyEffect: -3,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 8 },
          { npcId: 'minjae', intimacyChange: 5 },
          { npcId: 'subin', intimacyChange: 5 },
        ],
        message: '바다에서 하루를 보냈다. 지훈이가 수박을 사왔고, 민재는 모래성을 만들다 무너뜨렸다. 최고의 하루.',
      },
      {
        text: '"나 학원 있어서..." — 못 간다',
        effects: { academic: 2, mental: -3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: -5 }],
        message: '학원에 앉아있는데 SNS에 바다 사진이 올라왔다. ... 집중이 안 된다.',
      },
    ],
  },
  // ===== 2학기 이벤트 =====
  {
    id: 'school-festival',
    title: '학교 축제',
    description: '축제 준비가 한창이다. 우리 반은 푸드트럭을 하기로 했다.\n"너 뭐 할래? 요리? 홍보? 회계?"',
    week: 30,
    choices: [
      {
        text: '"홍보 할게!" — SNS 홍보 담당',
        effects: { social: 5, talent: 1, mental: 2 },
        fatigueEffect: 5,
        message: '홍보 포스터를 만들고, SNS에 올렸다. 반응이 좋다! 아이들이 "너 센스 있다"고 했다.',
      },
      {
        text: '"회계 할게" — 뒤에서 조용히',
        effects: { academic: 1, social: 1 },
        message: '회계를 맡았다. 눈에 안 띄지만 없으면 안 되는 역할. 담임이 칭찬해줬다.',
      },
      {
        text: '"나 몸이 안 좋아서..." — 축제에 참여 안 한다',
        effects: { social: -3, mental: -2 },
        fatigueEffect: -5,
        message: '집에서 쉬었다. 단톡방에 축제 사진이 올라온다. ... 괜히 빠진 것 같다.',
      },
    ],
  },
  {
    id: 'yuna-study',
    title: '유나의 부탁',
    description: '유나가 조심스럽게 말을 건다.\n"있잖아... 나 수학 좀 알려줄 수 있어? 이번 시험 진짜 망할 것 같아."',
    week: 34,
    condition: (s) => s.stats.academic >= 50,
    choices: [
      {
        text: '"그래, 같이 하자" — 가르쳐준다',
        effects: { academic: 1, social: 2, mental: 2 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 10 }],
        message: '유나에게 수학을 가르쳤다. 가르치면서 나도 더 잘 이해하게 됐다. 유나가 "고마워, 진짜" 했다.',
      },
      {
        text: '"미안, 나도 바빠서..." — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: -5 }],
        message: '유나가 "아, 그래... 알겠어"라며 돌아갔다. 표정이 안 좋았다.',
      },
    ],
  },
  {
    id: 'final-exam-2',
    title: '기말고사',
    description: '2학기 기말고사. 올해의 마지막 시험이다.\n이번 성적이 통지표에 그대로 간다.',
    week: 38,
    choices: [
      {
        text: '이번엔 진짜 최선을 다한다',
        effects: { academic: 5, mental: -4 },
        fatigueEffect: 12,
        message: '있는 힘을 다해 시험을 봤다. 끝나고 나니 머리가 텅 비었다.',
      },
      {
        text: '적당히 한다 — 건강이 먼저야',
        effects: { academic: 2, mental: 1 },
        fatigueEffect: 3,
        message: '무리하지 않았다. 결과가 어떻든 후회는 없다.',
      },
    ],
  },
  // ===== 겨울방학 이벤트 =====
  {
    id: 'winter-start',
    title: '겨울방학',
    description: '겨울방학이 시작됐다. 크리스마스가 다가오고, 거리에 캐롤이 흘러나온다.\n올해도 끝나간다.',
    week: 43,
    choices: [
      {
        text: '크리스마스에 친구들과 모인다',
        effects: { social: 3, mental: 4 },
        moneyEffect: -2,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 5 },
          { npcId: 'subin', intimacyChange: 3 },
        ],
        message: '친구들과 선물을 교환하고 케이크를 먹었다. 따뜻한 하루.',
      },
      {
        text: '집에서 가족과 보낸다',
        effects: { mental: 3 },
        message: '가족과 조용히 보냈다. 엄마가 치킨을 시켜줬다.',
      },
      {
        text: '알바한다 — 돈이 필요해',
        effects: { mental: -1 },
        moneyEffect: 5,
        message: '크리스마스에도 일했다. 돈은 벌었는데... 좀 씁쓸하다.',
      },
    ],
  },
  {
    id: 'year-end-reflection',
    title: '새해 전날',
    description: '12월 31일 밤. 올 한 해를 돌아본다.\n창밖으로 불꽃놀이 소리가 들린다.',
    week: 47,
    choices: [
      {
        text: '"내년에는 더 잘할 거야" — 다짐한다',
        effects: { mental: 3 },
        message: '"내년에는..." 다짐을 적었다. 지킬 수 있을까. 그래도 적는 것만으로 기분이 좋다.',
      },
      {
        text: '"올해도 나쁘지 않았어" — 만족한다',
        effects: { mental: 5 },
        message: '올해를 돌아보니, 생각보다 많은 일이 있었다. 나쁘지 않았어.',
      },
    ],
  },
  // ===== 랜덤 이벤트 (조건부) =====
  {
    id: 'fatigue-warning',
    title: '몸이 무겁다',
    description: '아침에 일어나기가 힘들다. 몸이 천근만근이다.\n"오늘 학교 가기 싫다..."',
    condition: (s) => s.fatigue >= 60 && s.week > 5,
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
    condition: (s) => s.stats.social < 25 && s.week > 8,
    choices: [
      {
        text: '괜찮아, 혼자가 편해',
        effects: { mental: 1 },
        message: '혼자만의 시간도 나쁘지 않다. ... 정말?',
      },
      {
        text: '옆 반 아이에게 말을 걸어본다',
        effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '"같이 먹어도 돼?" "어, 그래!" 용기를 냈더니 생각보다 쉬웠다.',
      },
    ],
  },
  {
    id: 'burnout-event',
    title: '한계',
    description: '아무것도 하고 싶지 않다. 책상 앞에 앉아도 글자가 안 읽힌다.\n창밖만 멍하니 바라본다.',
    condition: (s) => s.mentalState === 'burnout',
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }],
        message: '"야, 나 요즘 좀 힘들어..." 지훈이가 아무 말 없이 들어줬다. 좀 나아졌다.',
      },
    ],
  },
  {
    id: 'good-grade',
    title: '성적 상승!',
    description: '시험 결과가 나왔다. 생각보다 잘 봤다!\n선생님이 "요즘 열심히 하더니 잘했네" 하고 말씀하셨다.',
    condition: (s) => s.stats.academic >= 60 && s.week % 8 === 0 && s.week > 1,
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
    choices: [
      {
        text: '"네, 열심히 하고 있어요"',
        effects: { mental: -1 },
        message: '"그래, 기대하마." 부담이 좀 느껴진다.',
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
];

// ===== 학교생활 랜덤 이벤트 풀 (매주 1개씩 발생) =====
const SCHOOL_LIFE_EVENTS: GameEvent[] = [
  {
    id: 'random-quiz', title: '깜짝 퀴즈!',
    description: '선생님이 갑자기 "자, 퀴즈 보자" 하셨다.\n교실이 술렁인다.',
    choices: [
      { text: '자신 있게 풀어본다', effects: { academic: 2, mental: 1 }, message: '대부분 맞혔다! 선생님이 "역시" 하며 웃으셨다.' },
      { text: '찍기의 신이 되어본다', effects: { academic: 1, mental: -1 }, message: '반은 맞고 반은 틀렸다. 아슬아슬했다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'friend-snack', title: '간식 나눠먹기',
    description: '쉬는 시간에 민재가 과자를 까서 돌린다.\n"야, 너도 먹어!"',
    choices: [
      { text: '고맙게 받아 먹는다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '맛있다. 민재 덕분에 소소한 행복.' },
      { text: '다이어트 중이라 거절한다', effects: { health: 1 }, message: '"아 나 괜찮아~" 했지만 좀 아쉽다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'class-prank', title: '교실 장난',
    description: '수업 중에 뒤에서 종이 비행기가 날아왔다.\n선생님은 못 보신 것 같다.',
    choices: [
      { text: '웃으며 무시한다', effects: { mental: 1 }, message: '웃음을 참느라 힘들었다. 그래도 수업은 들었다.' },
      { text: '같이 보내본다 (몰래)', effects: { social: 2, mental: 2, academic: -1 }, message: '같이 장난치다 수업을 날렸다. 하지만 재밌었다!' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'rain-day', title: '비 오는 날',
    description: '우산을 안 가져왔는데 비가 온다.\n교문 앞에서 멈칫한다.',
    choices: [
      { text: '그냥 뛰어간다!', effects: { health: -1, mental: 1 }, message: '흠뻑 젖었지만 왠지 상쾌하다.' },
      { text: '편의점에서 우산을 산다', effects: {}, moneyEffect: -1, message: '1000원짜리 투명 우산. 어른이 된 기분.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'lost-eraser', title: '지우개의 행방',
    description: '시험 중에 지우개가 바닥에 떨어졌다.\n옆자리 아이가 자기 거를 반으로 잘라 준다.',
    choices: [
      { text: '"고마워!" — 감동받는다', effects: { social: 1, mental: 2 }, message: '작은 친절이 큰 감동이 됐다. 시험도 잘 본 것 같다.' },
      { text: '안 쓰고 그냥 시험 본다 (자존심)', effects: { academic: -1, mental: -1 }, message: '지우개 없이 시험 봤다. 아... 실수 고칠 걸.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'teacher-praise', title: '선생님의 칭찬',
    description: '오늘 수업 시간에 발표를 했는데 선생님이 크게 칭찬해주셨다.\n"와, 정말 잘했다!"',
    choices: [
      { text: '기분 좋게 받아들인다', effects: { mental: 3, academic: 1 }, message: '얼굴이 빨개졌지만 기분은 좋다. 자신감이 생겼다.' },
      { text: '부끄러워서 작아진다', effects: { mental: 1 }, message: '칭찬은 좋은데... 다들 쳐다보니 부끄럽다.' },
    ],
    condition: (s) => s.stats.academic >= 40 && !s.isVacation,
  },
  {
    id: 'class-president', title: '반장 선거',
    description: '반장 선거 시즌이다.\n선생님이 "자, 반장 후보 나올 사람?" 하고 물으신다.',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 5, mental: 2 }, fatigueEffect: 3,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '당선됐다! 반 친구들이 박수를 쳐줬다. 민재가 "역시 너야!" 했다.' },
      { text: '가만히 있는다...', effects: { mental: 1 }, message: '다른 아이가 반장이 됐다. 뭔가 살짝 아쉽다.' },
    ],
    condition: (s) => s.week === 2 || s.week === 25,
  },
  {
    id: 'class-president-nudge', title: '민재의 추천',
    description: '쉬는 시간에 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데, 너가 하면 딱인데? 내가 추천할까?"',
    choices: [
      { text: '"...해볼까?" — 민재 말에 용기를 낸다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '부반장이 됐다! 민재가 "내 눈은 틀리지 않지" 하며 웃었다.' },
      { text: '"아니야, 난 괜찮아" — 정중하게 거절한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '"알겠어, 근데 너 진짜 잘할 수 있었을 텐데." 민재 말에 기분이 나쁘진 않았다.' },
    ],
    condition: (s) => {
      // 반장 선거에서 "안 한다"(choiceIndex 1)를 골랐고, social >= 40일 때만
      const electionEvent = s.events.find(e =>
        e.id === 'class-president' &&
        e.resolvedChoice === 1 &&
        s.week - (e.week || 0) <= 2
      );
      return !!electionEvent && s.stats.social >= 40;
    },
  },
  {
    id: 'new-student', title: '전학생',
    description: '오늘 반에 전학생이 왔다.\n낯설어하는 표정이 보인다.',
    choices: [
      { text: '먼저 다가가 말을 건다', effects: { social: 3, mental: 2 }, message: '"안녕! 여기 처음이지?" 전학생이 환하게 웃었다.' },
      { text: '누군가 말 걸겠지... 지켜본다', effects: {}, message: '다른 아이가 먼저 다가갔다. 살짝 아쉽다.' },
    ],
    condition: (s) => !s.isVacation && s.week > 3,
  },
  {
    id: 'group-project', title: '조별 과제',
    description: '선생님이 조별 과제를 내셨다.\n"한 달 안에 제출해야 합니다."',
    choices: [
      { text: '리더를 맡는다', effects: { social: 2, academic: 2, mental: -2 }, fatigueEffect: 3, message: '힘들지만 뿌듯하다. 조원들이 고마워했다.' },
      { text: '맡은 부분만 열심히 한다', effects: { academic: 2, mental: 1 }, message: '내 할 일은 끝냈다. 편하다.' },
      { text: '대충 한다...', effects: { social: -2 }, message: '조원들 눈치가 좀 그렇다...', },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'sick-day', title: '컨디션 난조',
    description: '아침부터 머리가 아프고 열이 나는 것 같다.\n"오늘 쉴까..."',
    choices: [
      { text: '참고 학교 간다', effects: { academic: 1, health: -2 }, fatigueEffect: 5, message: '억지로 갔는데 수업 내내 고통이었다.' },
      { text: '하루 쉰다', effects: { health: 1, mental: 1 }, fatigueEffect: -8, message: '푹 쉬고 나니 한결 나아졌다.' },
    ],
    condition: (s) => s.fatigue >= 40 && !s.isVacation,
  },
  {
    id: 'found-money', title: '길에서 만원',
    description: '등굣길에 만원짜리를 주웠다.\n주변에 떨어뜨린 사람이 안 보인다.',
    choices: [
      { text: '경찰서에 맡긴다', effects: { mental: 3 }, message: '착한 일 했다. 마음이 뿌듯하다.' },
      { text: '...주머니에 넣는다', effects: { mental: -2 }, moneyEffect: 1, message: '돈은 생겼는데 찝찝하다.' },
    ],
  },
  {
    id: 'birthday-friend', title: '지훈이 생일',
    description: '오늘이 지훈이 생일이다.\n단톡방에 생일 축하 메시지가 쏟아진다.',
    choices: [
      { text: '선물을 사서 준다', effects: { social: 3, mental: 2 }, moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 8 }],
        message: '지훈이가 진짜 좋아했다. "야 너 최고다!" 돈 아깝지 않다.' },
      { text: '카톡으로 축하만 한다', effects: { social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"ㅊㅋ~" 보냈다. 지훈이가 "ㄱㅅ" 했다. 좀 성의없었나?' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'pe-class-hero', title: '체육 시간의 영웅',
    description: '체육 시간에 피구를 하는데, 상대편 에이스가 공을 던졌다!',
    choices: [
      { text: '멋지게 잡아본다!', effects: { health: 2, social: 3, mental: 2 }, message: '잡았다!! 반 전체가 환호했다. 오늘 영웅이다!' },
      { text: '피한다 (안전제일)', effects: { health: 1 }, message: '무사히 살아남았다. 뭐, 이것도 전략이지.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'study-cafe', title: '스터디 카페',
    description: '시험 기간이라 스터디 카페가 만석이다.\n겨우 자리를 잡았는데 옆에 수빈이가 앉아 있다!',
    choices: [
      { text: '수빈이랑 같이 공부한다', effects: { academic: 2, social: 1 }, moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '수빈이랑 같이 하니까 집중이 잘 됐다. 모르는 거 서로 알려주면서.' },
      { text: '이어폰 끼고 혼자 집중한다', effects: { academic: 2, mental: 1 }, moneyEffect: -1, message: '나만의 시간. 효율적이었다. 수빈이가 살짝 아쉬운 표정을 지었다.' },
    ],
  },
  {
    id: 'social-media-drama', title: 'SNS 소동',
    description: '단톡방에서 누가 누구 험담을 했다가 들켰다.\n분위기가 험악해졌다.',
    choices: [
      { text: '중재를 시도한다', effects: { social: 3, mental: -1 }, message: '양쪽 이야기를 듣고 화해시켰다. 피곤하지만 뿌듯하다.' },
      { text: '안 끼어든다 (조용히 나간다)', effects: { mental: 1 }, message: '현명한 선택. 남의 싸움에 끼면 안 된다.' },
    ],
    condition: (s) => !s.isVacation && s.stats.social >= 20,
  },
  {
    id: 'sunset-walk', title: '노을이 예쁜 날',
    description: '방과후 집에 가는 길. 하늘이 유난히 예쁘다.\n발걸음이 느려진다.',
    choices: [
      { text: '사진 찍고 잠시 앉아있는다', effects: { mental: 4 }, message: '아무 생각 없이 하늘을 봤다. 마음이 편해졌다.' },
      { text: '빨리 집에 간다 (할 일이 많아)', effects: { academic: 1 }, message: '집에 와서 공부를 시작했다. 하늘이 좀 아쉽다.' },
    ],
  },
  {
    id: 'music-discovery', title: '새로운 노래',
    description: '유튜브에서 우연히 들은 노래가 너무 좋다.\n반복 재생이 멈추지 않는다.',
    choices: [
      { text: '공부하면서 계속 듣는다', effects: { mental: 2, talent: 1 }, message: '좋은 음악과 함께하니 공부도 즐겁다.' },
      { text: '친구에게 공유한다', effects: { social: 2, mental: 1 }, message: '"이거 들어봐!" 친구도 좋아했다. 취향이 통하는 건 기분 좋다.' },
    ],
  },
  {
    id: 'cleaning-duty', title: '청소 당번',
    description: '오늘 청소 당번이다.\n교실이 엉망이다...',
    choices: [
      { text: '열심히 한다', effects: { health: 1, mental: 1 }, fatigueEffect: 2, message: '깨끗해진 교실을 보니 뿌듯하다.' },
      { text: '대충 하고 빠진다', effects: { social: -1 }, message: '옆에서 열심히 하는 애가 좀 미안하다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'dream-question', title: '꿈이 뭐야?',
    description: '수업 시간에 선생님이 물었다.\n"너희, 나중에 뭐 하고 싶어?"',
    choices: [
      { text: '"아직 잘 모르겠어요" — 솔직하게', effects: { mental: 1 }, message: '모른다고 하는 것도 용기다. 선생님이 "천천히 찾아봐" 하셨다.' },
      { text: '"공부 관련 일이요!" — 학업형', effects: { academic: 1, mental: 1 }, message: '말하고 보니 진짜 그런 것 같기도 하다.' },
      { text: '"뭔가 만드는 일이요!" — 재능형', effects: { talent: 1, mental: 2 }, message: '선생님이 "좋은 꿈이네" 하며 웃으셨다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'late-to-school', title: '지각!',
    description: '알람을 못 듣고 늦잠을 잤다!\n학교까지 전력 질주 중...',
    choices: [
      { text: '뛰어간다!!!', effects: { health: 1 }, fatigueEffect: 3, message: '겨우 수업 시작 전에 도착했다. 심장이 터질 것 같다.' },
      { text: '포기하고 천천히 간다', effects: { mental: -1 }, message: '선생님한테 혼났다. 오늘 하루가 우울하다.' },
    ],
    condition: (s) => s.fatigue >= 30 && !s.isVacation,
  },
];

// 이번 주에 발동할 이벤트 가져오기
export function getEventForWeek(state: GameState): GameEvent | null {
  // 고정 주차 이벤트 우선
  const fixedEvent = GAME_EVENTS.find(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state))
  );
  if (fixedEvent) return fixedEvent;

  // 조건부 상태 이벤트 (피로/멘탈/번아웃 등) — 50% 확률
  const conditionalEvents = GAME_EVENTS.filter(e =>
    !e.week &&
    e.condition &&
    e.condition(state) &&
    !state.events.some(prev => prev.id === e.id && state.week - (prev.week || 0) < 10)
  );
  if (conditionalEvents.length > 0 && Math.random() < 0.5) {
    return conditionalEvents[Math.floor(Math.random() * conditionalEvents.length)];
  }

  // 학교생활 랜덤 이벤트 — 70% 확률 (거의 매주 발생)
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && state.week - (prev.week || 0) < 6)
  );
  if (availableSchoolEvents.length > 0 && Math.random() < 0.7) {
    return availableSchoolEvents[Math.floor(Math.random() * availableSchoolEvents.length)];
  }

  return null;
}
