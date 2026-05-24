import { GameEvent, GameState } from '../types';

export const SCHOOL_Y1_INTRO: GameEvent[] = [
  // ===== 초반 이벤트 (W1~W4) =====
  // ===== 초6 첫날 (Y1 W1) — 소꿉친구 지훈이랑 또 같은 반 =====
  {
    id: 'first-week',
    title: '새 학기 첫날',
    description: '새 학기 첫날. 교실에 들어서자마자 뒤에서 "야!" 하는 소리.\n돌아보니 지훈이가 농구공을 옆구리에 낀 채 달려온다.\n"우리 또 같은 반이다? 3년 연속이야!"\n싱글벙글 웃는 얼굴이 어릴 때랑 똑같다.\n"방과 후에 한 판 어때? 오랜만에 뛰자."',
    week: 1,
    condition: (s: GameState) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_spring',
    speakers: ['jihun'],
    choices: [
      {
        text: '"좋아! 운동장에서 보자"',
        effects: { social: 2, health: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '방과 후에 운동장에서 뛰었다. 지훈이랑 같이 놀면 항상 편하다. "넌 역시 최고야!"',
      },
      {
        text: '"오늘은 좀 피곤해..." — 다음에 하자고 한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "알겠어, 그럼 내일!" 쿨하게 넘겼다. 소꿉친구라 이런 게 편하다.',
      },
      {
        text: '"대신 같이 숙제 하자" — 공부 제안',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "으, 숙제? ...알겠어, 같이 하면 그나마 낫겠지." 공부는 싫어하지만 친구 부탁은 못 거절한다.',
      },
    ],
    // 여자 버전: 배드민턴 (기존 컨벤션)
    femaleDescription: '새 학기 첫날. 교실에 들어서자마자 뒤에서 "야!" 하는 소리.\n돌아보니 지훈이가 배드민턴 라켓을 어깨에 걸친 채 달려온다.\n"우리 또 같은 반이다? 3년 연속이야!"\n싱글벙글 웃는 얼굴이 어릴 때랑 똑같다.\n"방과 후에 배드민턴 어때? 오랜만에 한 판 치자."',
    femaleChoices: [
      {
        text: '"좋아! 체육관에서 보자"',
        effects: { social: 2, health: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '방과 후에 체육관에서 배드민턴 쳤다. 지훈이랑 놀면 항상 편하다. "야 너 잘 치네!"',
      },
      {
        text: '"오늘은 좀 피곤해..." — 다음에 하자고 한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "알겠어, 그럼 내일!" 쿨하게 넘겼다. 소꿉친구라 이런 게 편하다.',
      },
      {
        text: '"대신 같이 숙제 하자" — 공부 제안',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '지훈이가 "으, 숙제? ...알겠어, 같이 하면 그나마 낫겠지." 공부는 싫어하지만 친구 부탁은 못 거절한다.',
      },
    ],
  },
  // ===== 옆자리 민재 (Y1 W2) — 새 짝꿍 =====
  {
    id: 'minjae-meet-elementary',
    title: '새 짝꿍',
    description: '새 자리 배치. 옆자리에 처음 보는 애가 앉았다.\n필통을 가지런히 꺼내놓고, 노트에 오늘 날짜를 정자로 적는다.\n쉬는 시간에 조심스럽게 말을 건다.\n"야, 점심 같이 먹을래? 나 박민재."',
    week: 2,
    condition: (s: GameState) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_spring',
    speakers: ['minjae'],
    choices: [
      {
        text: '"좋아!" — 같이 먹으러 간다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재와 점심을 먹었다. 조용한 줄 알았는데 의외로 유쾌한 애다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '초6 봄, 민재와 처음 같이 먹은 급식의 낯선 편안함.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"...응, 잘 부탁해" — 같이 가며 이야기한다',
        effects: { social: 1, academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 4 }],
        message: '급식실에서 같이 먹으며 이야기 나눴다. 조용한데 막상 얘기해보면 은근 디테일에 꼼꼼한 애다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '민재의 노트 정자(正字)를 보며 "이상한 애네" 생각했던 날.',
          npcIds: ['minjae'],
        },
      },
      {
        text: '"아... 나 할 거 있어서" — 혼자 도서관에 간다',
        effects: { academic: 1, mental: -1 },
        message: '도서관에서 조용히 시간을 보냈다. 편하긴 한데... 좀 외롭다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '처음 내민 손을 피한 점심시간. 도서관 창밖이 유난히 멀었다.',
          npcIds: ['minjae'],
        },
      },
    ],
  },
  // ===== 유나 첫 만남 (Y1 W6) — 같은 반 모범생 =====
  {
    id: 'yuna-meet-elementary',
    title: '도서관 창가 자리',
    description: '쉬는 시간에 도서관에 갔다. 창가 자리에 같은 반 여자애가 혼자 책을 읽고 있다.\n머리핀에 작은 별 장식. 피아노 학원 가방이 의자에 걸려 있다.\n나를 보더니 살짝 웃어준다.\n"아, 너도 책 좋아해?"',
    week: 6,
    condition: (s: GameState) => s.year === 1,
    location: 'library',
    background: 'library_elementary',
    speakers: ['yuna'],
    choices: [
      {
        text: '"응, 나도 가끔 읽어" — 같이 책 얘기한다',
        effects: { academic: 1, social: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '유나랑 책 얘기했다. 유나가 추천해 준 책이 있는데, 재밌어 보인다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '초6 도서관 창가, 유나가 추천해준 책 제목을 종이 귀퉁이에 적던 순간.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"피아노 배워? 멋있다!"',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 4 }],
        message: '유나가 "엄마가 시켜서 하는 건데..." 하면서도 입가에 웃음. 피아노 연주회 얘기도 해줬다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '"엄마가 시켜서"라고 말하면서도 웃던 유나의 얼굴.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"난 책 잘 안 봐" — 솔직히 말한다',
        effects: { mental: 0 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 1 }],
        message: '유나가 "괜찮아, 그럴 수도 있지" 하며 다시 책으로 돌아갔다. 약간 어색했다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 4,
          toneTag: 'regret',
          recallText: '도서관 창가에서 유나가 책으로 돌아섰다. 어색한 침묵이 길었다.',
          npcIds: ['yuna'],
        },
      },
    ],
  },
  // ===== 수빈 첫 만남 (Y1 W10) — 학원 친구 =====
  {
    id: 'subin-meet-elementary',
    title: '학원 뒷자리',
    description: '학원 쉬는 시간. 뒷자리 여자애가 내 책을 힐끔 본다.\n단정한 단발머리, 작은 별 귀걸이. 손에는 작은 노트를 들고 있다.\n"너도 이 문제집 풀어? 나 여기 막혔는데..."\n공책을 살며시 내밀어 보인다.',
    week: 10,
    condition: (s: GameState) => s.year === 1,
    location: 'classroom',
    background: 'hagwon_front',
    speakers: ['subin'],
    choices: [
      {
        text: '"어, 이거 나도 어렵더라" — 같이 푼다',
        effects: { academic: 2, social: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '수빈이랑 같이 문제를 풀었다. 조용한데 꼼꼼한 애다. 모르는 걸 솔직히 말할 줄 안다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '학원 뒷자리, 수빈이 공책에 같이 그린 화살표와 동그라미들.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"이거? 이렇게 푸는 거야" — 설명해준다',
        effects: { academic: 1, social: 2, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 "아, 그렇구나! 고마워" 하며 노트에 꼼꼼히 적었다. 누굴 도와주는 게 생각보다 뿌듯하다.',
        memorySlotDraft: {
          category: 'courage',
          importance: 5,
          toneTag: 'resolve',
          recallText: '수빈이 앞에서 또박또박 설명하던 날, 내 목소리가 낯설게 단단했다.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"나도 막혔어..." — 같이 고민한다',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '같이 끙끙대다가 둘 다 모른다는 걸 깨닫고 웃었다. 그래도 이상하게 친해진 기분이다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '둘 다 모른다는 걸 깨닫고 웃던 학원 쉬는 시간.',
          npcIds: ['subin'],
        },
      },
    ],
  },
];

export const SCHOOL_ELEM_TO_MIDDLE: GameEvent[] = [
  // ===== 초등학교 졸업 (Y1 W46) =====
  {
    id: 'elementary-graduation',
    title: '초등학교 졸업식',
    description: '졸업식 날이다. 강당에 모인 아이들 표정이 다 다르다.\n웃는 애, 우는 애, 멍한 애.\n6년간 다니던 학교를 떠난다.\n교문을 나서며 뒤를 돌아본다.',
    week: 46,
    condition: (s: GameState) => s.year === 1,
    location: 'auditorium',
    background: 'auditorium_elementary',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 사진을 찍는다',
        effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '"중학교 가서도 연락하자!" 지훈이가 웃으며 말했다. 좀 울컥했다.',
      },
      {
        text: '조용히 교실을 둘러본다',
        effects: { mental: 5 },
        message: '빈 교실에 혼자 서 있었다. 칠판, 책상, 창밖 풍경... 다 기억에 남을 것 같다.',
      },
      {
        text: '"빨리 중학교 가고 싶다!" — 앞만 본다',
        effects: { mental: 2, academic: 1 },
        message: '초등학교는 끝났다. 이제 새로운 시작이다!',
      },
    ],
  },
  // ===== 중학교 입학 (Y2 W1) =====
  {
    id: 'middle-school-entrance',
    title: '중학교 입학식',
    description: '새 교복을 입고 교문을 들어선다. 모든 게 다르다.\n건물도 크고, 선배도 있고, 교실 번호도 낯설다.\n심장이 빨리 뛴다. 긴장되면서도 설렌다.\n"...나 여기서 잘 할 수 있겠지?"',
    week: 1,
    condition: (s: GameState) => s.year === 2,
    location: 'auditorium',
    background: 'school_gate_middle',
    speakers: ['subin'],
    choices: [
      {
        text: '옆자리 아이에게 먼저 말을 건다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '"야, 여기 진짜 크다! 같이 다니자~" 수빈이가 팔짱을 끼며 웃었다. 나만 긴장한 건가.',
      },
      {
        text: '일단 자리에 앉아서 주변을 살핀다',
        effects: { mental: 2 },
        message: '낯선 얼굴들 사이에서 아는 얼굴을 찾았다. 옆에선 수빈이가 신나서 두리번거리고 있다. 다행이다.',
      },
      {
        text: '"교복 좋은데?" — 거울을 본다',
        effects: { mental: 3, social: 1 },
        message: '교복을 입으니 뭔가 어른이 된 기분. 나쁘지 않다.',
      },
    ],
  },
];

export const SCHOOL_MIDDLE_HIGH: GameEvent[] = [
  // ===== 중2 개학 (Y3 W1) =====
  {
    id: 'middle2-start',
    title: '중2, 시작',
    description: '2학년이 됐다. 이제 이 학교에 완전히 익숙하다.\n후배가 생겼다. 복도에서 마주치면 인사하는 게 좀 어색하면서도 뿌듯하다.\n교실 창밖으로 벚꽃이 보인다.',
    week: 1,
    condition: (s: GameState) => s.year === 3,
    location: 'classroom',
    background: 'classroom_{school}_spring',
    choices: [
      {
        text: '"올해는 좀 더 열심히 해볼까" — 다짐한다',
        effects: { academic: 1, mental: 3 },
        message: '새 학기 결심은 항상 좋다. 얼마나 갈지는 모르지만.',
      },
      {
        text: '"이제 좀 여유롭네" — 편안하게 시작한다',
        effects: { mental: 4, social: 1 },
        message: '작년에 비하면 훨씬 편하다. 친구도 있고, 학교도 익숙하고.',
      },
    ],
  },
  // ===== 중3 개학 (Y4 W1) =====
  {
    id: 'middle3-start',
    title: '중3, 마지막 해',
    description: '중학교 마지막 해다. 선생님이 첫날부터 말씀하신다.\n"올해는 고등학교 진학이 있으니까 정신 차려야 해."\n교실 분위기가 작년과 좀 다르다. 다들 뭔가 진지해졌다.',
    week: 1,
    condition: (s: GameState) => s.year === 4,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      {
        text: '"고등학교..." — 진지하게 생각해본다',
        effects: { academic: 2, mental: 1 },
        message: '아직 실감이 안 나지만, 뭔가 준비해야 한다는 건 안다.',
      },
      {
        text: '"아직 1년이나 남았는데 뭘" — 여유를 부린다',
        effects: { mental: 3, social: 1 },
        message: '1년이면 긴 거지. 일단 오늘은 친구들이랑 놀자.',
      },
      {
        text: '"특목고 가려면..." — 목표를 세운다',
        effects: { academic: 3, mental: -1 },
        message: '벌써부터 부담이 느껴진다. 하지만 목표가 생기니 뭔가 달라진 느낌.',
      },
    ],
  },
  // ===== 중학교 졸업 (Y4 W46) =====
  {
    id: 'middle-school-graduation',
    title: '중학교 졸업식',
    description: '졸업장을 받았다. 3년이 이렇게 빨리 갈 줄 몰랐다.\n교실에서 친구들과 마지막 시간을 보내고 있다.\n누군가가 "우리 고등학교 가서도 만나자" 했다.\n정말 만날 수 있을까?',
    week: 46,
    condition: (s: GameState) => s.year === 4,
    location: 'auditorium',
    background: 'auditorium_middle',
    speakers: ['jihun', 'subin', 'minjae', 'yuna'],
    choices: [
      {
        text: '친구들과 마지막 사진을 찍는다',
        effects: { social: 4, mental: 3 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 1 },
          { npcId: 'subin', intimacyChange: 1 },
          { npcId: 'minjae', intimacyChange: 1 },
          { npcId: 'yuna', intimacyChange: 1 },
        ],
        message: '단체 사진을 찍었다. 다들 웃고 있지만 눈이 좀 빨갛다. 이 순간을 잊지 말자.',
      },
      {
        text: '교실에서 혼자 시간을 보낸다',
        effects: { mental: 5 },
        message: '빈 교실에서 3년을 돌아봤다. 후회도, 감사도, 그리움도. 전부 내 중학교 시절이다.',
      },
      {
        text: '"고등학교에서 더 잘하면 되지!" — 앞을 본다',
        effects: { mental: 3, academic: 1 },
        message: '졸업은 끝이 아니라 시작이다. 다음 3년이 기대된다.',
      },
    ],
  },
  // ===== 고등학교 입학 (Y5 W1) =====
  {
    id: 'high-school-entrance',
    title: '고등학교 입학식',
    description: '고등학생이 됐다.\n교문 앞에서 한 번 멈춘다. 여기서 3년을 보내게 되는 거다.\n새 교복, 새 학교, 새 교실. 모든 게 처음부터 다시.\n"수능까지 3년..." 누군가가 중얼거렸다.\n\n...본격적인 시작이다.',
    week: 1,
    condition: (s: GameState) => s.year === 5,
    location: 'auditorium',
    background: 'school_gate_high',
    speakers: ['jihun'],
    choices: [
      {
        text: '새로운 친구에게 말을 건다',
        effects: { social: 3, mental: 3 },
        message: '"반가워! 나도 처음이라 떨려." 새 환경이지만, 사람 사이는 어디나 비슷하다.',
      },
      {
        text: '"3년 안에 최선을 다하자" — 각오를 다진다',
        effects: { academic: 2, mental: 2 },
        message: '고등학교. 여기서의 3년이 인생을 바꿀 수도 있다. 긴장되지만 해볼 만하다.',
      },
      {
        text: '중학교 친구에게 연락한다',
        effects: { mental: 4, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"야, 고등학교 어때?" 지훈이가 물었다. "아직 모르겠어. 근데 좀 무섭다." "...나도."',
      },
    ],
  },
  // ===== 고2 개학 + 문이과 선택 (Y6 W1) =====
  {
    id: 'high2-track-select',
    title: '고2, 문·이과를 고르다',
    description: '고2가 됐다. 담임이 종이 한 장을 나눠준다.\n"이번 주까지 문·이과 결정해서 내. 나중에 바꾸기 어려워."\n\n주변 애들이 웅성거린다.\n"나 그냥 이과 갈래, 취업 잘 된다잖아."\n"난 수학 못 해서 문과..."\n\n한 번 정하면 돌이킬 수 없는 선택이다.',
    week: 1,
    condition: (s: GameState) => s.year === 6 && s.track === null,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      {
        text: '문과 — 사람과 사회를 공부하고 싶다',
        effects: { social: 2, mental: -1 },
        trackSelect: 'humanities',
        message: '문과로 결정했다. 국어·영어·사회탐구가 주 과목이다.\n법, 경영, 언론, 교육... 길은 많다.',
      },
      {
        text: '이과 — 수학·과학이 더 적성에 맞는다',
        effects: { talent: 2, mental: -1 },
        trackSelect: 'science',
        message: '이과로 결정했다. 수학·과학탐구가 주 과목이다.\n의대, 공대, 자연과학... 길은 많지만 수학이 관건이다.',
      },
    ],
  },
  // ===== 고3 개학 (Y7 W1) =====
  {
    id: 'high3-start',
    title: '고3, 마지막 시작',
    description: '마지막 학년이다.\n교실에 들어서는데 분위기가 무겁다. 칠판 위에 "D-xxx" 카운트다운이 적혀 있다.\n12년의 학교생활이 이 한 해로 끝난다.\n\n...복잡한 감정이 든다.',
    week: 1,
    condition: (s: GameState) => s.year === 7,
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['jihun'],
    choices: [
      {
        text: '"후회 없이 보내자" — 담담하게 시작한다',
        effects: { mental: 5, academic: 1 },
        message: '긴장되지만, 지금까지 해온 게 있다. 내가 걸어온 길을 믿자.',
      },
      {
        text: '"...무섭다" — 솔직하게 느낀다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"나도 무서워." 지훈이가 옆에서 말했다. "근데 같이 하면 괜찮을 거야."',
      },
      {
        text: '"어차피 할 건 해야지" — 이를 악문다',
        effects: { academic: 3, mental: -2 },
        message: '감정은 사치다. 일단 공부. 하지만... 이 속도로 1년을 버틸 수 있을까.',
      },
    ],
  },
  {
    id: 'jihun-call',
    title: '지훈이의 전화',
    // 남자 버전: 농구
    description: '저녁에 지훈이한테 전화가 왔다.\n"야, 이번 주말에 농구하러 갈래? 민재도 온대."',
    week: 4,
    location: 'home',
    background: 'home_evening',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '"가자!" — 주말에 농구하러 간다',
        effects: { health: 2, social: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '지훈이, 민재와 농구를 했다. 오랜만에 신나게 뛰었다!',
        timeCost: 1,
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '지훈이, 민재와 분식집에서 떡볶이를 먹었다. 수다 떨다 보니 시간 가는 줄 몰랐다!',
        timeCost: 1,
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
  // ===== 초등 봄 소풍 (Y1 W5) — 4월 말 =====
  {
    id: 'elementary-spring-picnic',
    title: '봄 소풍',
    description: '오늘은 봄 소풍 날. 김밥 도시락에 간식까지 든 가방이 묵직하다.\n공원에 도착하니 벚꽃잎이 바람에 흩날린다.\n민재가 손을 흔든다. "야 너도 여기 앉아!"\n한쪽에서는 선생님이 장기자랑 신청을 받고 있다.',
    week: 5,
    condition: (s: GameState) => s.year === 1,
    location: 'park',
    background: 'park_spring',
    speakers: ['minjae', 'jihun'],
    choices: [
      {
        text: '친구들이랑 같이 먹는다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }, { npcId: 'jihun', intimacyChange: 1 }],
        message: '김밥 나눠 먹으면서 웃고 떠들었다. 이런 게 학교 다니는 맛이지.',
      },
      {
        text: '장기자랑에 나간다',
        effects: { social: 4, talent: 2, mental: 2 },
        message: '얼떨결에 무대에 올라갔다. 얼굴이 빨개졌지만, 박수 소리가 좋았다.',
      },
      {
        text: '혼자 조용히 주변을 구경한다',
        effects: { mental: 3, health: 1 },
        message: '벚꽃이 바람에 흩날린다. 혼자 있는 시간도 나쁘지 않다.',
      },
    ],
  },
  // ===== 초등 2학기 시작 (Y1 W25) — 여름방학 끝, 9월 초 =====
  {
    id: 'elementary-semester2-start',
    title: '2학기 시작',
    description: '여름방학이 끝나고 2학기가 시작됐다.\n반 애들이 햇빛에 탄 얼굴로 돌아왔다.\n칠판에는 "곧 졸업이다!" 라고 선생님이 큰 글씨로 써놓았다.\n벌써 마지막 학기라니.',
    week: 25,
    condition: (s: GameState) => s.year === 1,
    location: 'classroom',
    background: 'classroom_elementary_afternoon',
    choices: [
      {
        text: '"중학교 가기 전에 더 열심히 해야지"',
        effects: { academic: 2, mental: -1 },
        message: '마지막 학기. 중학교 진학 준비를 조금씩 시작하기로 했다.',
      },
      {
        text: '"일단 방학 얘기부터 풀자!" — 친구들과 수다',
        effects: { social: 3, mental: 3 },
        message: '방학 동안 있었던 얘기로 한참을 떠들었다. 다들 할 얘기가 많다.',
      },
      {
        text: '"졸업 전에 좋은 추억 많이 남겨야지"',
        effects: { mental: 3, social: 1 },
        message: '이 교실에 있을 시간도 얼마 안 남았다는 게 새삼 실감난다.',
      },
    ],
  },
  // ===== 초등 가을 운동회 (Y1 W32) — 10월 =====
  {
    id: 'elementary-sports-day',
    title: '가을 운동회',
    description: '가을 운동회다. 선선한 바람에 깃발이 펄럭이고, 청팀·백팀 응원 소리가 운동장을 가득 메운다.\n이어달리기 순서가 돌아왔다.\n지훈이가 바통을 건넨다. "야, 우리 청팀이 이길 수 있어!"',
    week: 32,
    condition: (s: GameState) => s.year === 1,
    location: 'gym',
    background: 'gymnasium',
    speakers: ['jihun'],
    choices: [
      {
        text: '있는 힘껏 달린다',
        effects: { health: 3, social: 2, mental: 2 },
        fatigueEffect: 8,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '바람이 귀를 스친다. 결과는 2등. 지훈이가 "수고했다!" 하며 어깨를 감쌌다.',
      },
      {
        text: '무리 안 하고 페이스 유지한다',
        effects: { health: 1, mental: 1 },
        fatigueEffect: 3,
        message: '적당히 뛰었다. 순위는 중간쯤. 그래도 즐거웠다.',
      },
    ],
  },
  // 초등 단원평가 이벤트 (Y1, W16 — 단원평가 W17 전주)
  {
    id: 'elementary-unit-test',
    title: '단원평가가 다가온다',
    description: '선생님이 "다음 주에 단원평가 볼 거야~" 하고 말했다.\n주변 친구들은 별로 신경 안 쓰는 눈치다.',
    week: 16,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year === 1,
    choices: [
      {
        text: '집에 가서 복습한다',
        effects: { academic: 2, mental: -1 },
        message: '교과서를 펴고 복습했다. 내용이 좀 기억난다.',
      },
      {
        text: '그냥 평소대로 논다',
        effects: { mental: 1 },
        message: '시험이라고 해도 별로 긴장은 안 된다. 어차피 단원평가잖아.',
      },
    ],
  },
  // 중등/고등 중간고사 이벤트 (W7 — 중간고사 W8 전주)
  {
    id: 'midterm-1',
    title: '첫 중간고사',
    description: '중간고사가 다가온다. 교실 분위기가 달라졌다.\n다들 쉬는 시간에도 책을 펴고 있다.',
    week: 7,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year >= 2,
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
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '유나랑 같이 공부했다. 유나가 모르는 거 잘 알려준다.',
      },
    ],
  },
  // 고등 모의고사 이벤트 (W11 — 모의 W12 전주)
  {
    id: 'mock-exam-prep',
    title: '모의고사가 다가온다',
    description: '다음 주에 전국 모의고사다.\n선생님이 "이번 모의는 수능 출제 방식이랑 똑같아" 하고 말한다.\n...긴장된다.',
    week: 11,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year >= 5,
    choices: [
      {
        text: '기출문제를 풀며 감을 잡는다',
        effects: { academic: 3, mental: -2 },
        fatigueEffect: 8,
        message: '기출문제를 풀었다. 실전 감각이 좀 살아나는 느낌이다.',
      },
      {
        text: '컨디션 관리에 집중한다',
        effects: { mental: 2, health: 1 },
        message: '무리하지 않고 컨디션을 맞췄다. 머리가 맑다.',
      },
      {
        text: '모의는 모의일 뿐 — 크게 신경 안 쓴다',
        effects: { mental: 1 },
        message: '별로 긴장하지 않았다. 어차피 모의고사잖아.',
      },
    ],
  },
  {
    id: 'subin-academy',
    title: '수빈이와 학원',
    description: '학원 복도에서 수빈이가 다른 반 아이들과 웃으며 얘기하고 있다.\n나를 발견하자 "야, 너도 김쌤 반이야? 김쌤 숙제 진짜 많지 않아? 쉬는 시간에 편의점 가자~"',
    week: 5,
    condition: (s: GameState) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && (s.routineSlot2 === 'academy' || s.routineSlot3 === 'academy');
    },
    location: 'street',
    background: 'hagwon_front',
    speakers: ['subin'],
    choices: [
      {
        text: '"그래!" — 같이 간다',
        effects: { social: 1, mental: 2 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이랑 편의점에서 아이스크림을 먹었다. 수빈이는 벌써 편의점 누나랑도 친해져 있었다. 이 애는 어디서든 금방 친해진다.',
      },
      {
        text: '"나 복습 좀 해야 해" — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: -2 }],
        message: '"아 그래? 알겠어~" 수빈이가 금방 다른 아이를 데리고 갔다. 아쉬울 틈도 없다.',
      },
    ],
  },
  {
    id: 'sports-day',
    title: '체육대회',
    description: '학교 체육대회 날이다! 반 대항 릴레이가 있다.\n"야, 너 달리기 잘해? 우리 반 대표 한 명 더 필요한데..."',
    week: 10,
    location: 'gym',
    background: 'gymnasium',
    choices: [
      {
        text: '"내가 할게!" — 대표로 나선다',
        effects: { social: 4, health: 2, mental: 3 },
        fatigueEffect: 5,
        message: '반 대표로 달렸다! 1등은 아니었지만 다들 고마워했다. 이름을 기억하는 아이가 늘었다.',
        timeCost: 1,
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
    location: 'school_gate',
    background: 'school_gate_{school}',
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
        message: '용돈 벌 방법을 찾아봤다. 뭐라도 해봐야지.',
      },
    ],
  },
  {
    id: 'summer-trip',
    title: '지훈이의 제안',
    description: '"야, 이번에 바다 갈래? 민재도 간대.\n수빈이한테도 물어볼까?"',
    background: 'beach_summer',
    week: 22,
    location: 'beach',
    speakers: ['jihun', 'minjae', 'subin'],
    choices: [
      {
        text: '"가자!!!" — 다 같이 바다로!',
        effects: { social: 3, health: 2, mental: 5 },
        fatigueEffect: 3,
        moneyEffect: -3,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 6 },
          { npcId: 'minjae', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 3 },
        ],
        message: '바다에서 하루를 보냈다. 지훈이가 수박을 사왔고, 민재는 모래성을 만들다 무너뜨렸다. 최고의 하루.',
        timeCost: 2,
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
    description: '축제 준비가 한창이다. 우리 반은 푸드트럭을 하기로 했다.\n수빈이가 "야, 홍보는 내가 할게! 누가 같이 하자~" 하며 손을 든다.',
    week: 30,
    condition: (s: GameState) => s.year >= 2,
    location: 'classroom',
    background: 'festival_classroom',
    speakers: ['subin'],
    choices: [
      {
        text: '"나도 할게!" — 수빈이랑 홍보 담당',
        effects: { social: 4, talent: 3, mental: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이랑 같이 포스터를 만들었다. 수빈이가 옆 반 애들까지 불러와서 반응이 폭발! "너네 반 축제 진짜 기대된다!"',
        memorySlotDraft: {
          category: 'courage',
          importance: 5,
          toneTag: 'resolve',
          recallText: '축제 전날 복도에서 포스터 붙이다 수빈이와 맞잡은 눈짓.',
          npcIds: ['subin'],
        },
      },
      {
        text: '"회계 할게" — 뒤에서 조용히',
        effects: { academic: 1, social: 1 },
        message: '회계를 맡았다. 수빈이가 SNS에 올리고 옆 반까지 다 돌려서... 줄이 길어졌다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 4,
          toneTag: 'warm',
          recallText: '축제 회계 장부 한 귀퉁이에 그날 매출을 적어둔 내 글씨.',
        },
      },
      {
        text: '"나 몸이 안 좋아서..." — 축제에 참여 안 한다',
        effects: { social: -3, mental: -2 },
        fatigueEffect: -5,
        message: '집에서 쉬었다. 단톡방에 축제 사진이 올라온다. ... 괜히 빠진 것 같다.',
        memorySlotDraft: {
          category: 'failure',
          importance: 5,
          toneTag: 'regret',
          recallText: '축제 사진이 단톡방에 올라오던 밤, 천장만 보고 있었다.',
        },
      },
    ],
  },
  {
    id: 'yuna-study',
    title: '유나의 부탁',
    description: '유나가 씩 웃으며 다가온다.\n"야, 나 수학 7번 도저히 모르겠거든? 너 잘하잖아, 좀 알려줘!"',
    week: 34,
    condition: (s: GameState) => s.stats.academic >= 50 && s.year !== 7, // Y7 W34는 수능 전날
    location: 'library',
    background: 'library_{school}',
    speakers: ['yuna'],
    choices: [
      {
        text: '"그래, 같이 하자" — 가르쳐준다',
        effects: { academic: 1, social: 2, mental: 2 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 8 }],
        message: '유나에게 수학을 가르쳤다. 가르치면서 나도 더 잘 이해하게 됐다. 유나가 "오 대박, 이거였어? 천재 아냐?" 했다.',
        memorySlotDraft: {
          category: 'discovery',
          importance: 5,
          toneTag: 'warm',
          recallText: '도서관 책상 위 유나의 "천재 아냐?" — 웃는 목소리가 이상하게 오래 남았다.',
          npcIds: ['yuna'],
        },
      },
      {
        text: '"미안, 나도 바빠서..." — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: -5 }],
        message: '유나가 "아 그래? 알겠어~" 하며 돌아갔다. 웃고 있는데 좀 아쉬워 보였다.',
        memorySlotDraft: {
          category: 'betrayal',
          importance: 5,
          toneTag: 'regret',
          recallText: '"괜찮아~" 하고 돌아서던 유나의 뒷모습이 너무 가볍게 느껴졌다.',
          npcIds: ['yuna'],
        },
      },
    ],
  },
  // 초등 2학기 단원평가 이벤트 (Y1, W37 — 단원평가 W38 전주)
  {
    id: 'elementary-unit-test-2',
    title: '2학기 단원평가가 다가온다',
    description: '선생님이 "다음 주에 2학기 단원평가 볼 거야~ 올해 마지막이니까 잘 해보자!" 하고 웃는다.\n주변 친구들도 이번엔 조금은 긴장하는 눈치다.',
    week: 37,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year === 1,
    choices: [
      {
        text: '열심히 복습한다 — 마지막이니까!',
        effects: { academic: 2, mental: -1 },
        message: '열심히 복습했다. 올해 배운 게 꽤 많았구나.',
      },
      {
        text: '대충 본다 — 곧 졸업이잖아',
        effects: { mental: 1 },
        message: '시험보다는 졸업식이 더 기대된다.',
      },
    ],
  },
  // 중등/고등 기말고사 이벤트 (W37 — 기말 W38 전주)
  {
    id: 'final-exam-2',
    title: '기말고사',
    description: '2학기 기말고사. 올해의 마지막 시험이다.\n이번 성적이 통지표에 그대로 간다.',
    week: 37,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year >= 2,
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
  // 고등 2학기 모의고사 이벤트 (W32 — 모의 W33 전주)
  {
    id: 'mock-exam-prep-2',
    title: '9월 모의고사',
    description: '9월 모의고사가 다가온다.\n"이번 모의 성적이 수시 지원 기준이야" — 선생님의 말에 교실이 조용해졌다.',
    week: 32,
    location: 'classroom',
    background: 'classroom_{school}',
    condition: (s: GameState) => s.year >= 5,
    choices: [
      {
        text: '이번엔 제대로 준비한다',
        effects: { academic: 4, mental: -3 },
        fatigueEffect: 10,
        message: '밤늦게까지 공부했다. 이번엔 좀 다른 결과가 나올까.',
      },
      {
        text: '평소 실력대로 본다',
        effects: { mental: 1 },
        message: '있는 그대로 보기로 했다. 그게 진짜 실력이니까.',
      },
    ],
  },
  // ===== 겨울방학 이벤트 =====
  {
    id: 'winter-start',
    title: '겨울방학',
    description: '겨울방학이 시작됐다. 크리스마스가 다가오고, 거리에 캐롤이 흘러나온다.\n올해도 끝나간다.',
    week: 43,
    location: 'home',
    background: 'school_road_morning',
    speakers: ['jihun', 'subin'],
    choices: [
      {
        text: '크리스마스에 친구들과 모인다',
        effects: { social: 3, mental: 4 },
        moneyEffect: -2,
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 1 },
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
        condition: (s: GameState) => s.year >= 4,
      },
      {
        text: '엄마 심부름 — 용돈 받기',
        effects: { mental: 1 },
        moneyEffect: 1,
        message: '엄마 부탁으로 마트 심부름. 거스름돈에서 천 원짜리 한 장을 슬쩍 챙겼다. 작은 용돈이지만 기분이 좋다.',
        condition: (s: GameState) => s.year < 4,
      },
    ],
  },
  {
    id: 'year-end-reflection',
    title: '새해 전날',
    description: '12월 31일 밤. 올 한 해를 돌아본다.\n창밖으로 불꽃놀이 소리가 들린다.',
    week: 47,
    condition: (s: GameState) => s.year !== 1 && s.year !== 4 && s.year !== 7, // 졸업 해에는 졸업 이벤트가 W46에 뜸
    location: 'home',
    background: 'night_sky_fireworks',
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
  // ===== 고3 수능 이벤트 =====
  {
    id: 'suneung-eve',
    title: '수능 전날',
    description: '내일이 수능이다.\n방에 앉아 있는데 아무것도 손에 잡히지 않는다.\n12년을 달려온 끝이 내일이라니.\n엄마가 방문을 열고 들어오셨다. "...잘 할 수 있어."',
    week: 34,
    condition: (s: GameState) => s.year === 7,
    location: 'home',
    background: 'bedroom_night',
    choices: [
      {
        text: '일찍 잠자리에 든다',
        effects: { mental: 3 },
        fatigueEffect: -10,
        message: '이불을 덮었는데 잠이 안 온다. 천장만 바라보다가 어느새 잠들었다.',
      },
      {
        text: '마지막으로 오답 노트를 펼친다',
        effects: { academic: 2, mental: -1 },
        message: '손에 잡히지 않지만 한 장씩 넘겼다. 이 정도면... 됐다.',
      },
      {
        text: '친구에게 연락한다',
        effects: { mental: 5, social: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 1 }],
        message: '"야, 긴장돼?" "응. 미치겠어." "...내일 끝나고 치킨 먹자." "...그래."',
      },
    ],
  },
  {
    id: 'suneung-done',
    title: '수능이 끝났다',
    description: '시험장을 나온다. 하늘이 유난히 맑다.\n12년의 공부가 끝났다. 주변에서 우는 애도, 웃는 애도, 멍하니 서 있는 애도 있다.\n\n...끝났다. 정말로.',
    week: 36,
    condition: (s: GameState) => s.year === 7,
    location: 'street',
    background: 'clear_sky',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 치킨을 먹으러 간다',
        effects: { social: 4, mental: 5 },
        moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 1 }],
        message: '"야, 우리 해냈다!" 치킨이 이렇게 맛있었던 적이 있었나. 다 같이 웃고 울었다.',
        timeCost: 1,
      },
      {
        text: '혼자 걸어서 집에 간다',
        effects: { mental: 4 },
        message: '천천히 걸었다. 벚꽃이 질 때 시작해서, 낙엽이 질 때 끝났다. 긴 여정이었다.',
      },
      {
        text: '바로 성적 채점을 해본다',
        effects: { academic: 1, mental: -3 },
        message: '채점 결과가... 어떻게 됐든, 이미 끝난 거다. 결과는 12월에 나온다.',
      },
    ],
  },
  // ===== 고등학교 졸업 (Y7 W46) =====
  {
    id: 'high-school-graduation',
    title: '졸업',
    description: '졸업식 날이다.\n12년간의 학교생활이 오늘로 끝난다.\n\n강당에서 졸업장을 받고, 교실로 돌아왔다.\n칠판에 누군가가 적어놨다.\n\n"졸업 축하해. 우리 모두 수고했어."',
    week: 46,
    condition: (s: GameState) => s.year === 7,
    location: 'auditorium',
    background: 'auditorium_high',
    speakers: ['jihun', 'subin', 'minjae', 'yuna', 'junha'],
    choices: [
      {
        text: '친구들과 마지막 인사를 나눈다',
        effects: { social: 5, mental: 5 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 3 },
          { npcId: 'minjae', intimacyChange: 3 },
          { npcId: 'yuna', intimacyChange: 3 },
          { npcId: 'junha', intimacyChange: 3 },
        ],
        message: '서로 안아주고, 사진 찍고, 연락처를 확인했다. "꼭 다시 만나자." 눈물이 났다.',
      },
      {
        text: '빈 교실에서 혼자만의 시간을 보낸다',
        effects: { mental: 7 },
        message: '창밖을 바라봤다. 이 교실에서 웃고, 울고, 싸우고, 화해했다. 전부 내 청춘이었다.',
      },
      {
        text: '교문을 나서며 뒤를 돌아보지 않는다',
        effects: { mental: 3, academic: 1 },
        message: '앞만 보고 걸었다. 이제부터가 진짜 시작이다.',
      },
    ],
  },
];
