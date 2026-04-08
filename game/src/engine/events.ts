import { GameEvent, GameState } from './types';

export const GAME_EVENTS: GameEvent[] = [
  // ===== 초반 이벤트 (W1~W4) =====
  // ===== 초6 첫날 (Y1 W1) =====
  {
    id: 'first-week',
    title: '새 학기 첫날',
    description: '새 학기가 시작됐다. 교실에 들어서니 아는 얼굴도, 모르는 얼굴도 보인다.\n옆자리에 앉은 아이가 말을 건다. "야, 점심 같이 먹을래?"',
    week: 1,
    condition: (s) => s.year === 1,
    location: 'classroom',
    speakers: ['minjae'],
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
  // ===== 초등학교 졸업 (Y1 W46) =====
  {
    id: 'elementary-graduation',
    title: '초등학교 졸업식',
    description: '졸업식 날이다. 강당에 모인 아이들 표정이 다 다르다.\n웃는 애, 우는 애, 멍한 애.\n6년간 다니던 학교를 떠난다.\n교문을 나서며 뒤를 돌아본다.',
    week: 46,
    condition: (s) => s.year === 1,
    location: 'auditorium',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 사진을 찍는다',
        effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
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
    condition: (s) => s.year === 2,
    location: 'auditorium',
    speakers: ['subin'],
    choices: [
      {
        text: '옆자리 아이에게 먼저 말을 건다',
        effects: { social: 3, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '"나도 떨려..." 수빈이가 웃으며 대답했다. 나만 긴장한 게 아니었다.',
      },
      {
        text: '일단 자리에 앉아서 주변을 살핀다',
        effects: { mental: 2 },
        message: '낯선 얼굴들 사이에서 아는 얼굴을 찾았다. 지훈이가 손을 흔들었다. 다행이다.',
      },
      {
        text: '"교복 좋은데?" — 거울을 본다',
        effects: { mental: 3, social: 1 },
        message: '교복을 입으니 뭔가 어른이 된 기분. 나쁘지 않다.',
      },
    ],
  },
  // ===== 중2 개학 (Y3 W1) =====
  {
    id: 'middle2-start',
    title: '중2, 시작',
    description: '2학년이 됐다. 이제 이 학교에 완전히 익숙하다.\n후배가 생겼다. 복도에서 마주치면 인사하는 게 좀 어색하면서도 뿌듯하다.\n교실 창밖으로 벚꽃이 보인다.',
    week: 1,
    condition: (s) => s.year === 3,
    location: 'classroom',
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
    condition: (s) => s.year === 4,
    location: 'classroom',
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
    condition: (s) => s.year === 4,
    location: 'auditorium',
    speakers: ['jihun', 'subin', 'minjae', 'yuna'],
    choices: [
      {
        text: '친구들과 마지막 사진을 찍는다',
        effects: { social: 4, mental: 3 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 3 },
          { npcId: 'subin', intimacyChange: 3 },
          { npcId: 'minjae', intimacyChange: 3 },
          { npcId: 'yuna', intimacyChange: 3 },
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
    condition: (s) => s.year === 5,
    location: 'auditorium',
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '"야, 고등학교 어때?" 지훈이가 물었다. "아직 모르겠어. 근데 좀 무섭다." "ㅋㅋ 나도"',
      },
    ],
  },
  // ===== 고2 개학 (Y6 W1) =====
  {
    id: 'high2-start',
    title: '고2, 승부의 해',
    description: '고2가 됐다. 분위기가 확 달라졌다.\n선생님이 첫날부터 "올해가 가장 중요하다"고 하셨다.\n학원 상담, 내신 관리, 생기부 채우기...\n할 일이 너무 많다.',
    week: 1,
    condition: (s) => s.year === 6,
    location: 'classroom',
    choices: [
      {
        text: '"올해 내신이 진짜 중요하대" — 학업에 집중한다',
        effects: { academic: 2, mental: -1 },
        message: '부담이 크지만 피할 수 없다. 올해 어떻게 보내느냐가 대학을 결정한다.',
      },
      {
        text: '"생기부도 채워야 하는데..." — 활동을 고민한다',
        effects: { talent: 1, social: 1, mental: 1 },
        message: '동아리, 봉사, 대회... 뭐부터 해야 할지 머리가 복잡하다.',
      },
      {
        text: '"하나씩 하면 되지" — 마음을 다잡는다',
        effects: { mental: 4 },
        message: '불안해도 소용없다. 오늘 할 일부터 하자. 하나씩, 천천히.',
      },
    ],
  },
  // ===== 고3 개학 (Y7 W1) =====
  {
    id: 'high3-start',
    title: '고3, 마지막 시작',
    description: '마지막 학년이다.\n교실에 들어서는데 분위기가 무겁다. 칠판 위에 "D-xxx" 카운트다운이 적혀 있다.\n12년의 학교생활이 이 한 해로 끝난다.\n\n...복잡한 감정이 든다.',
    week: 1,
    condition: (s) => s.year === 7,
    location: 'classroom',
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
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
    week: 3,
    location: 'home',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '"가자!" — 주말에 농구하러 간다',
        effects: { health: 2, social: 2, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
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
  {
    id: 'midterm-1',
    title: '첫 중간고사',
    description: '중간고사가 다가온다. 교실 분위기가 달라졌다.\n다들 쉬는 시간에도 책을 펴고 있다.',
    week: 8,
    location: 'classroom',
    speakers: ['yuna'],
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
    location: 'convenience_store',
    speakers: ['subin'],
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
    location: 'gym',
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
    location: 'beach',
    speakers: ['jihun', 'minjae', 'subin'],
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
    description: '축제 준비가 한창이다. 우리 반은 푸드트럭을 하기로 했다.\n하은이가 "나 포스터 그릴 수 있는데, 같이 할 사람?" 하고 손을 든다.',
    week: 30,
    location: 'classroom',
    speakers: ['haeun'],
    choices: [
      {
        text: '"나도 할게!" — 하은이랑 홍보 담당',
        effects: { social: 4, talent: 3, mental: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '하은이랑 같이 포스터를 만들었다. 하은이 그림에 내가 문구를 넣었더니 반응이 폭발! "너네 콤비 최고다!"',
      },
      {
        text: '"회계 할게" — 뒤에서 조용히',
        effects: { academic: 1, social: 1 },
        message: '회계를 맡았다. 하은이가 혼자 포스터를 만들었는데... 솔직히 대단했다.',
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
    condition: (s) => s.stats.academic >= 50 && s.year !== 7, // Y7 W34는 수능 전날
    location: 'classroom',
    speakers: ['yuna'],
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
    location: 'classroom',
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
    location: 'home',
    speakers: ['jihun', 'subin'],
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
    condition: (s) => s.year !== 1 && s.year !== 4 && s.year !== 7, // 졸업 해에는 졸업 이벤트가 W46에 뜸
    location: 'home',
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
    condition: (s) => s.year === 7,
    location: 'home',
    speakers: ['jihun'],
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 3 }],
        message: '"야, 긴장돼?" "ㅇㅇ 미치겠어." "...내일 끝나고 치킨 먹자." "ㅋㅋㅋ 그래."',
      },
    ],
  },
  {
    id: 'suneung-done',
    title: '수능이 끝났다',
    description: '시험장을 나온다. 하늘이 유난히 맑다.\n12년의 공부가 끝났다. 주변에서 우는 애도, 웃는 애도, 멍하니 서 있는 애도 있다.\n\n...끝났다. 정말로.',
    week: 36,
    condition: (s) => s.year === 7,
    location: 'street',
    speakers: ['jihun', 'minjae'],
    choices: [
      {
        text: '친구들과 치킨을 먹으러 간다',
        effects: { social: 4, mental: 5 },
        moneyEffect: -2,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 5 }, { npcId: 'minjae', intimacyChange: 3 }],
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
    condition: (s) => s.year === 7,
    location: 'auditorium',
    speakers: ['jihun', 'subin', 'minjae', 'yuna', 'haeun'],
    choices: [
      {
        text: '친구들과 마지막 인사를 나눈다',
        effects: { social: 5, mental: 5 },
        npcEffects: [
          { npcId: 'jihun', intimacyChange: 5 },
          { npcId: 'subin', intimacyChange: 5 },
          { npcId: 'minjae', intimacyChange: 5 },
          { npcId: 'yuna', intimacyChange: 5 },
          { npcId: 'haeun', intimacyChange: 5 },
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
  // ===== 하은 이벤트 체인 =====
  {
    id: 'new-student', title: '전학생',
    description: '2학기가 시작된 지 얼마 안 됐는데, 반에 전학생이 왔다.\n선생님이 소개한다. "부산에서 온 김하은이라고 합니다."\n"안녕하세요... 잘 부탁해요." 낯설어하면서도 주변을 호기심 가득한 눈으로 둘러본다.',
    week: 26,
    location: 'classroom',
    speakers: ['haeun', 'minjae'],
    choices: [
      { text: '"안녕! 여기 처음이지? 뭐든 물어봐!" — 먼저 다가간다', effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '하은이가 환하게 웃었다. "고마워! 너 이름이 뭐야?" 첫 대화가 생각보다 편했다.' },
      { text: '지켜본다... 누군가 말 걸겠지', effects: {},
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }, { npcId: 'minjae', intimacyChange: 2 }],
        message: '민재가 먼저 다가갔다. "야, 부산에서 왔어? 사투리 써봐!" 하은이가 웃으며 대답했다. 살짝 아쉽다.' },
    ],
  },
  {
    id: 'haeun-sketchbook', title: '낙서가 들켰다',
    description: '쉬는 시간, 하은이가 공책 구석에 뭔가를 열심히 그리고 있다.\n들여다보니 교실 풍경 스케치다. 꽤 잘 그린다.',
    location: 'classroom',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 10 && s.week > 28 && !s.isVacation;
    },
    choices: [
      { text: '"뭐 그리는 거야? 진짜 잘 그린다!" — 관심을 보인다', effects: { talent: 2, mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '"에이, 이건 낙서야..." 하면서도 하은이 표정이 밝아졌다. 전학 와서 처음으로 그림 칭찬 받았다고.' },
      { text: '조용히 옆에 앉아서 본다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '하은이가 알아챘지만 뭐라 안 했다. 조용히 같이 있는 것도 나쁘지 않다.' },
      { text: '별 관심 없는 척 지나간다', effects: {}, message: '나중에 보니 하은이가 그 스케치를 접어서 넣고 있었다.' },
    ],
  },
  {
    id: 'haeun-local-guide', title: '이 동네 구경시켜 줘',
    description: '방과후, 하은이가 다가온다.\n"있잖아, 나 아직 이 동네를 잘 몰라서... 어디가 재밌어? 알려줄 수 있어?"',
    location: 'street',
    speakers: ['haeun', 'minjae'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 20 && s.week > 29 && !s.isVacation;
    },
    choices: [
      { text: '자주 가는 곳을 소개해준다', effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '분식집, 문구점, 공원... 하은이가 전부 사진을 찍었다. "여기 좋다! 부산이랑 완전 다르네."',
        timeCost: 1 },
      { text: '조용한 곳을 데려간다', effects: { mental: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 5 }],
        message: '한적한 산책로를 걸었다. 하은이가 "여기 그림 그리기 좋겠다..." 하며 눈을 빛냈다.',
        timeCost: 1 },
      { text: '"민재한테 물어봐, 걔가 잘 알아" — 민재에게 넘긴다', effects: {},
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }, { npcId: 'haeun', intimacyChange: 1 }],
        message: '민재가 하은이를 데리고 떡볶이집으로 갔다. 나중에 하은이가 "재밌었어, 근데 네가 같이 갔으면 좋았는데" 했다.' },
    ],
  },
  {
    id: 'haeun-afterclass', title: '방과후 교실',
    description: '모두 돌아간 빈 교실. 하은이가 창가에서 축제 포스터 아이디어를 끄적이고 있다.\n"아, 왔어? 나 축제 포스터 아이디어 좀 내고 있었는데..."',
    location: 'classroom',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 20 && s.week >= 28 && s.week <= 38 && !s.isVacation;
    },
    choices: [
      { text: '같이 아이디어를 낸다', effects: { talent: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '둘이서 아이디어를 주고받았다. 하은이가 "너 센스 좋은데? 같이 하면 진짜 괜찮겠다!" 했다.' },
      { text: '색칠이나 정리를 도와준다', effects: { talent: 1, social: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 5 }],
        message: '하은이가 스케치하고 내가 색을 칠했다. 해가 질 때쯤 꽤 괜찮은 포스터가 나왔다.' },
      { text: '"다음에 보자" — 먼저 간다', effects: {},
        npcEffects: [{ npcId: 'haeun', intimacyChange: 1 }],
        message: '하은이가 "어, 그래..." 하고 혼자 남았다. 뒤돌아보니 좀 외로워 보였다.' },
    ],
  },
  {
    id: 'haeun-specialty-awake', title: '"너, 이런 거 잘하네"',
    description: '하은이가 진지한 표정으로 다가온다.\n"있잖아... 네가 저번에 만든 거 봤는데, 솔직히 진짜 좋았어.\n너 이런 거 재능 있는 것 같아. 진심으로."',
    location: 'classroom',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 45 && s.stats.talent >= 40;
    },
    choices: [
      { text: '"진짜? 고마워..." — 쑥스럽지만 기쁘다', effects: { talent: 3, mental: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 7 }],
        message: '누군가한테 진심으로 인정받는 느낌. 가슴이 따뜻해졌다. 하은이가 "더 해봐, 나도 도와줄게" 했다.' },
      { text: '"별거 아니야..." — 넘긴다', effects: { talent: 1, mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '"아냐, 별거 맞아." 하은이가 단호하게 말했다. 겸손해도 들린 건 들린 거다.' },
      { text: '"같이 뭔가 더 해볼래?" — 제안한다', effects: { talent: 4, mental: 2, social: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '하은이 눈이 반짝였다. "진짜? 나 아이디어 있는데! 같이 하면 진짜 대박일 거야!"' },
    ],
  },
  {
    id: 'haeun-winter', title: '하은이의 겨울',
    description: '겨울방학이 다가오자 하은이가 말을 꺼낸다.\n"나 방학에 부산 갈 건데... 너도 같이 갈래? 맛있는 거 사줄게!"',
    location: 'beach',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 30 && s.week >= 42 && s.week <= 46;
    },
    choices: [
      { text: '"가자! 부산 가보고 싶었어!" — 함께 간다', effects: { social: 3, mental: 4, talent: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 10 }],
        moneyEffect: -3,
        message: '하은이의 고향 부산을 구경했다. 바다, 시장, 하은이가 다니던 학교... "여기가 내 세계였어." 하은이가 웃었다.',
        timeCost: 2 },
      { text: '"미안, 이번엔 못 갈 것 같아" — 거절한다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 2 }],
        message: '"그래, 알겠어... 다음에 꼭 같이 가자!" 하은이가 살짝 아쉬운 표정을 지었다.' },
    ],
  },
  // ===== 지훈 이벤트 체인 =====
  {
    id: 'jihun-basketball',
    title: '방과후 농구',
    description: '지훈이가 체육관 앞에서 손짓한다.\n"야, 오늘 방과후에 농구 안 할래? 3대3 하려는데 한 명 모자라."',
    location: 'gym',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 15 && s.week >= 10 && !s.isVacation;
    },
    choices: [
      {
        text: '"좋아, 나 넣어!" — 같이 농구한다',
        effects: { health: 3, social: 2, mental: 2 },
        fatigueEffect: 5,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
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
  },
  {
    id: 'jihun-secret',
    title: '지훈이의 고민',
    description: '하교 후, 지훈이가 평소와 달리 조용하다.\n"야... 나 좀 고민 있는데, 들어줄 수 있어?"\n벤치에 앉아서 지훈이가 말을 꺼낸다.\n"나 체육 특기생 준비할까 생각 중인데... 부모님은 공부하래."',
    location: 'park',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 30 && s.week >= 20 && !s.isVacation;
    },
    choices: [
      {
        text: '"네가 하고 싶은 거 해야지" — 지훈이 편을 든다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 8 }],
        message: '지훈이 눈이 빛났다. "...고마워. 너한테 말하길 잘했다." 진지한 지훈이는 처음 본다.',
      },
      {
        text: '"부모님 말도 한 번 생각해봐" — 현실적으로 조언한다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 4 }],
        message: '"...그것도 맞는 말이긴 해." 지훈이가 한숨을 쉬었다. 쉬운 문제가 아니다.',
      },
      {
        text: '"둘 다 해보면 안 돼?" — 절충안을 제시한다',
        effects: { social: 1, mental: 1 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 6 }],
        message: '"둘 다...? 힘들겠지만 해볼 만할까?" 지훈이가 고민하기 시작했다.',
      },
    ],
  },
  {
    id: 'jihun-fight',
    title: '지훈이와 다툼',
    description: '지훈이가 갑자기 화를 냈다.\n"너는 맨날 공부만 하잖아. 나 불러도 안 오고."\n예상 못한 말에 당황했다.\n"...나도 바쁜 거 알잖아."\n"그래, 그러니까 말이야."',
    location: 'hallway',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 40 && s.week >= 28 && !s.isVacation;
    },
    choices: [
      {
        text: '"미안, 내가 신경을 못 썼다" — 솔직하게 사과한다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 7 }],
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
        npcEffects: [{ npcId: 'jihun', intimacyChange: 2 }],
        message: '며칠 후 지훈이가 먼저 연락했다. "야... 그때 내가 좀 심했다." 시간이 필요했던 것 같다.',
      },
    ],
  },
  {
    id: 'jihun-support',
    title: '지훈이의 대회',
    description: '지훈이가 학교 대표로 농구 대회에 나간다.\n"이번 토요일인데... 너 올 수 있어? 아, 안 와도 되긴 하는데..."',
    location: 'gym',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 55 && s.week >= 35;
    },
    choices: [
      {
        text: '"당연히 가야지!" — 응원하러 간다',
        effects: { social: 3, mental: 3 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'jihun', intimacyChange: 8 }],
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
  },
  {
    id: 'jihun-promise',
    title: '졸업 후 약속',
    description: '졸업이 다가온다. 지훈이가 학교 옥상으로 올라가자고 했다.\n바람이 분다. 지훈이가 멀리 보며 말한다.\n"야... 우리 진짜 오래 알았다, 그치?"\n"...어. 초등학교 때부터."',
    location: 'rooftop',
    speakers: ['jihun'],
    condition: (s) => {
      const jihun = s.npcs.find(n => n.id === 'jihun');
      return !!jihun?.met && jihun.intimacy >= 70;
    },
    choices: [
      {
        text: '"앞으로도 계속 친구하자" — 약속한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 8 }],
        message: '"당연하지, 바보야." 지훈이가 웃었다. 바람에 눈이 좀 매웠다. ...바람 때문이다.',
      },
      {
        text: '"너 없었으면 학교생활 재미없었을 거야" — 고마움을 전한다',
        effects: { mental: 5, social: 2 },
        npcEffects: [{ npcId: 'jihun', intimacyChange: 7 }],
        message: '"야, 갑자기 왜 이래 ㅋㅋ" 지훈이가 웃으면서도 눈이 빨개졌다. "...나도."',
      },
    ],
  },
  // ===== 수빈 이벤트 체인 =====
  {
    id: 'subin-notes',
    title: '수빈이의 노트',
    description: '수빈이가 쉬는 시간에 다가온다.\n"야, 너 저번 시간 필기 좀 빌려줄 수 있어? 나 그날 결석해서..."\n수빈이 필통이 잘 정리되어 있는 게 눈에 들어온다.',
    location: 'classroom',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 15 && s.week >= 12 && !s.isVacation;
    },
    choices: [
      {
        text: '"그래, 여기" — 노트를 빌려준다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '수빈이가 노트를 꼼꼼히 사진 찍었다. "고마워, 다음에 내 거 필요하면 말해!" 믿음직하다.',
      },
      {
        text: '"나도 필기 별로 못했는데..." — 미안해한다',
        effects: {},
        npcEffects: [{ npcId: 'subin', intimacyChange: 2 }],
        message: '"아 그래? 괜찮아~" 수빈이가 다른 아이에게 물어보러 갔다.',
      },
    ],
  },
  {
    id: 'subin-cafe',
    title: '카페에서 공부',
    description: '시험 2주 전. 수빈이가 카톡을 보냈다.\n"나 카페에서 공부할 건데 같이 할래? 혼자 하면 졸려서..."\n수빈이가 먼저 연락하는 건 드문 일이다.',
    location: 'cafe',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 30 && s.week >= 22 && !s.isVacation;
    },
    choices: [
      {
        text: '"좋아, 어디서 만날까?" — 같이 공부하러 간다',
        effects: { academic: 2, social: 2 },
        fatigueEffect: 3,
        moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 7 }],
        message: '수빈이랑 카페에서 4시간을 공부했다. 수빈이가 수학을, 내가 영어를 알려줬다. "우리 꽤 잘 맞는 것 같아."',
        timeCost: 1,
      },
      {
        text: '"오늘은 집에서 할래" — 거절한다',
        effects: { academic: 1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: -2 }],
        message: '수빈이가 "알겠어~" 하고 혼자 갔다. 읽씹할 뻔했다.',
      },
    ],
  },
  {
    id: 'subin-dream',
    title: '수빈이의 꿈',
    description: '카페에서 공부하다가 수빈이가 갑자기 말했다.\n"있잖아... 나 사실 요리사가 되고 싶어."\n"...뭐?"\n성적 상위권인 수빈이 입에서 나올 줄 몰랐던 말.',
    location: 'cafe',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 40 && s.week >= 30 && !s.isVacation;
    },
    choices: [
      {
        text: '"대박, 몰랐다! 진짜 해봐!" — 응원한다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 8 }],
        message: '수빈이 얼굴이 환해졌다. "진짜? 부모님한테도 못 말했는데... 너한테 먼저 말하고 싶었어."',
      },
      {
        text: '"공부도 잘하는데, 좀 아깝지 않아?" — 현실적으로 말한다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '"...그런 말 많이 들었어." 수빈이가 조용해졌다. 잘못 말한 걸까.',
      },
      {
        text: '"수빈이 성격이면 뭘 해도 잘할 것 같아" — 수빈이를 믿어준다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 7 }],
        message: '"고마워... 너한테 말하니까 마음이 좀 편해졌다." 수빈이가 웃었다.',
      },
    ],
  },
  {
    id: 'subin-exam-stress',
    title: '시험 스트레스',
    description: '시험 기간. 도서관에서 수빈이가 책을 덮고 고개를 숙이고 있다.\n가까이 가니 눈이 빨갛다.\n"...나 아무리 해도 안 되는 것 같아."',
    location: 'library',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 50 && s.week >= 34 && !s.isVacation;
    },
    choices: [
      {
        text: '옆에 앉아서 조용히 같이 있어준다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 7 }],
        message: '아무 말 안 해도 됐다. 한참 후에 수빈이가 "...고마워, 좀 나아졌어" 했다.',
      },
      {
        text: '"편의점 가자. 아이스크림 사줄게" — 기분전환을 유도한다',
        effects: { social: 2, mental: 2 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '편의점에서 아이스크림을 먹으며 수다를 떨었다. "맨날 공부만 하니까 미치겠어 ㅋㅋ" 수빈이가 웃었다.',
      },
      {
        text: '"수빈이는 잘하고 있어" — 위로한다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 5 }],
        message: '"...그래?" 수빈이가 코를 훌쩍였다. "너도 힘들지?" "응, 나도."',
      },
    ],
  },
  {
    id: 'subin-farewell',
    title: '각자의 길',
    description: '졸업이 다가온다. 수빈이가 학원 앞에서 기다리고 있었다.\n"야, 나 조리 전문학교에 원서 넣었어."\n"...진짜? 부모님은?"\n"설득했어. 쉽지 않았지만." 수빈이가 담담하게 웃는다.',
    location: 'school_gate',
    speakers: ['subin'],
    condition: (s) => {
      const subin = s.npcs.find(n => n.id === 'subin');
      return !!subin?.met && subin.intimacy >= 65;
    },
    choices: [
      {
        text: '"잘했다, 수빈아. 나중에 네 가게 가서 밥 먹을게" — 진심으로 축하한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 8 }],
        message: '"꼭 와. 서비스 줄게." 수빈이가 웃었다. 학원 앞 가로등 아래에서 작별 인사를 했다. 서로 다른 길이지만 괜찮다.',
      },
      {
        text: '"좀 아쉽다... 같은 대학 갈 줄 알았는데" — 솔직한 감정을 말한다',
        effects: { mental: 3 },
        npcEffects: [{ npcId: 'subin', intimacyChange: 6 }],
        message: '"나도 아쉬워. 근데 이게 내 길이야." 수빈이가 단단하게 말했다. 멋있다.',
      },
    ],
  },
  // ===== 민재 이벤트 체인 =====
  {
    id: 'minjae-party',
    title: '민재의 생일파티',
    description: '민재가 교실에서 크게 외친다.\n"야 다들! 이번 주 토요일 내 생일이거든? 우리 집에서 파티 한다! 다 와!"',
    location: 'home',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 15 && s.week >= 8;
    },
    choices: [
      {
        text: '"나 갈게!" — 생일파티에 간다',
        effects: { social: 3, mental: 3 },
        moneyEffect: -1,
        fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 7 }],
        message: '민재네 집에 애들이 잔뜩 모였다. 피자 먹고, 게임하고, 웃느라 정신없었다. 민재가 "야 너 와줘서 고맙다!" 했다.',
        timeCost: 1,
      },
      {
        text: '"미안, 그날 일이 있어" — 못 간다',
        effects: { mental: -1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: -3 }],
        message: '단톡방에 파티 사진이 올라왔다. 다들 재밌어 보인다... 좀 아쉽다.',
      },
    ],
  },
  {
    id: 'minjae-mask',
    title: '민재의 뒷면',
    description: '쉬는 시간이 끝나고 복도에서 민재를 봤다.\n다른 애들이랑 웃고 떠들다가 혼자가 되자 표정이 확 바뀌었다.\n한숨을 쉬는 민재. 처음 보는 표정이다.',
    location: 'hallway',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 30 && s.week >= 20 && !s.isVacation;
    },
    choices: [
      {
        text: '"야, 괜찮아?" — 다가간다',
        effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 8 }],
        message: '민재가 놀란 표정을 지었다가 웃었다. "아, 봤어? ... 가끔 좀 피곤해." 처음으로 민재의 진짜 모습을 본 것 같다.',
      },
      {
        text: '못 본 척 지나간다',
        effects: {},
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '다음에 민재를 보니 또 평소처럼 웃고 있었다. 그 표정이 자꾸 생각난다.',
      },
    ],
  },
  {
    id: 'minjae-family',
    title: '민재의 이야기',
    description: '방과후, 민재가 "야, 잠깐 시간 돼?" 하고 불렀다.\n교실 뒤편 계단에 앉아서 민재가 천천히 말한다.\n"우리 엄마 아빠... 요즘 많이 싸워. 이혼 얘기도 나온대."',
    location: 'hallway',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 45 && s.week >= 30 && !s.isVacation;
    },
    choices: [
      {
        text: '아무 말 없이 옆에 있어준다',
        effects: { social: 2, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 8 }],
        message: '민재가 한참 동안 아무 말 안 했다. 그러다 "...고마워. 너한테 처음 말했다" 했다. 항상 밝던 민재가 이렇게 작아 보이는 건 처음이다.',
      },
      {
        text: '"힘들었겠다... 말해줘서 고마워" — 위로한다',
        effects: { social: 1, mental: 3 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 7 }],
        message: '"맨날 웃기만 하니까 아무도 모르더라." 민재가 쓸쓸하게 웃었다. "너는 알아줬으면 해서."',
      },
      {
        text: '"너 혼자 감당 안 해도 돼" — 함께하겠다고 말한다',
        effects: { social: 3, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 6 }],
        message: '"...진짜?" 민재 눈이 살짝 젖었다. "야, 나 앞에서 울지 마 ㅋㅋ" "누가 울어 ㅋㅋ" 서로 웃었다.',
      },
    ],
  },
  {
    id: 'minjae-real',
    title: '진짜 민재',
    description: '민재가 요즘 달라졌다. 여전히 밝지만, 가끔 혼자 있을 때 생각에 잠기는 모습이 보인다.\n오늘도 옥상에서 혼자 앉아 있는 민재를 발견했다.\n"아, 왔어? 여기 바람 좋다."',
    location: 'rooftop',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 55 && s.week >= 36 && !s.isVacation;
    },
    choices: [
      {
        text: '옆에 앉아서 같이 바람을 쐰다',
        effects: { mental: 4 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 7 }],
        message: '"나 맨날 밝은 척 하는 거 알지?" "알아." "...근데 너 앞에서는 안 해도 되더라." 바람이 좋았다.',
      },
      {
        text: '"야, 밥 먹으러 가자" — 분위기를 바꿔준다',
        effects: { social: 2, mental: 2 },
        moneyEffect: -1,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '분식집에서 라면을 먹었다. 민재가 "역시 넌 타이밍이 좋아" 하며 웃었다.',
      },
    ],
  },
  {
    id: 'minjae-future',
    title: '민재의 꿈',
    description: '졸업이 얼마 안 남았다. 민재가 진지하게 말한다.\n"야, 나 사회복지사 되려고. 웃기지? 맨날 놀기만 하던 애가."\n"뭐가 웃겨."\n"...나 같은 애한테 진짜 필요한 어른이 되고 싶어서."',
    location: 'classroom',
    speakers: ['minjae'],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !!minjae?.met && minjae.intimacy >= 70;
    },
    choices: [
      {
        text: '"민재야, 너 진짜 멋있다" — 진심으로 말한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 8 }],
        message: '"야... 그런 말 하지 마, 울 것 같잖아 ㅋㅋ" 민재가 눈을 비볐다. 이 녀석, 처음부터 끝까지 따뜻한 애였다.',
      },
      {
        text: '"너라면 할 수 있어. 진심으로" — 응원한다',
        effects: { mental: 4, social: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 7 }],
        message: '"고마워. 진짜." 민재가 주먹을 내밀었다. 쿵. 말 안 해도 통하는 사이가 됐다.',
      },
    ],
  },
  // ===== 유나 이벤트 체인 =====
  {
    id: 'yuna-library',
    title: '도서관에서',
    description: '도서관 구석 자리에 유나가 앉아 있다.\n책을 읽고 있는데... 소설이다. 교과서가 아니라.\n눈이 마주쳤다. 유나가 살짝 고개를 숙인다.',
    location: 'library',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 10 && s.week >= 8 && !s.isVacation;
    },
    choices: [
      {
        text: '"무슨 책 읽어?" — 말을 건다',
        effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '"...무라카미 하루키." 유나가 작은 목소리로 답했다. 의외다. "좋아해?" "...응." 짧지만 대화다.',
      },
      {
        text: '조용히 옆에 앉아서 공부한다',
        effects: { academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 3 }],
        message: '아무 말 없이 옆에서 공부했다. 돌아갈 때 유나가 작게 "안녕" 했다.',
      },
      {
        text: '그냥 지나간다',
        effects: {},
        message: '유나가 다시 책에 집중했다. 뭘 읽고 있었는지 좀 궁금하다.',
      },
    ],
  },
  {
    id: 'yuna-lunch',
    title: '옥상에서 점심',
    description: '점심시간에 옥상에 올라왔다. 여기 아무도 없을 줄 알았는데.\n유나가 혼자 앉아서 도시락을 먹고 있다.\n눈이 마주쳤다. 유나가 당황한 표정이다.\n"...여기 나만 알고 있었는데."',
    location: 'rooftop',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 25 && s.week >= 18 && !s.isVacation;
    },
    choices: [
      {
        text: '"같이 먹어도 돼?" — 옆에 앉는다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 잠깐 망설이다가 고개를 끄덕였다. 바람이 좋았다. 유나가 "...여기, 아무한테도 말하지 마" 했다. 비밀 장소다.',
      },
      {
        text: '"아, 미안. 나갈게" — 자리를 비켜준다',
        effects: { mental: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 2 }],
        message: '"...괜찮은데." 유나가 뒤늦게 말했지만 이미 문을 닫은 뒤였다.',
      },
    ],
  },
  {
    id: 'yuna-hobby',
    title: '유나의 취미',
    description: '방과후, 음악실에서 피아노 소리가 들린다.\n살짝 들여다보니 유나가 피아노를 치고 있다.\n쇼팽. 놀랄 정도로 잘 친다.\n문이 삐걱 소리를 내고 유나가 고개를 돌렸다.\n"...들었어?"',
    location: 'music_room',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 35 && s.week >= 25 && !s.isVacation;
    },
    choices: [
      {
        text: '"진짜 잘 친다... 피아노 배웠어?" — 관심을 보인다',
        effects: { talent: 2, mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 7 }],
        message: '"...초등학교 때부터. 그만뒀는데 가끔 치고 싶을 때가 있어." 유나가 어색하게 웃었다. "너한테 들킨 건 처음이야."',
      },
      {
        text: '"한 곡만 더 쳐줘" — 부탁한다',
        effects: { mental: 4, talent: 1 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '유나가 잠깐 망설이다가 다시 건반에 손을 올렸다. 드뷔시. 저녁 햇살이 음악실을 물들였다. 아름다운 시간이었다.',
      },
      {
        text: '"미안, 실수로 들었어" — 물러난다',
        effects: {},
        npcEffects: [{ npcId: 'yuna', intimacyChange: 2 }],
        message: '"...괜찮아." 유나가 뚜껑을 닫았다. 그 소리가 아쉬웠다.',
      },
    ],
  },
  {
    id: 'yuna-pressure',
    title: '1등의 무게',
    description: '시험 기간. 유나가 복도에서 멈춰 서 있다.\n가까이 가니 손이 떨리고 있다.\n"...나 또 1등 해야 해. 엄마가... 2등은 안 된대."',
    location: 'hallway',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 50 && s.week >= 33 && !s.isVacation;
    },
    choices: [
      {
        text: '"2등이면 어때, 유나는 유나야" — 있는 그대로를 인정해준다',
        effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 8 }],
        message: '유나가 눈물을 참고 있었다. "...아무도 그런 말 안 해줬어." 작게 "고마워" 하고 교실로 돌아갔다.',
      },
      {
        text: '"같이 공부하자. 내가 도와줄게" — 실질적으로 돕는다',
        effects: { academic: 1, social: 1, mental: 1 },
        fatigueEffect: 3,
        npcEffects: [{ npcId: 'yuna', intimacyChange: 6 }],
        message: '같이 도서관에서 공부했다. 유나가 조금씩 안정을 찾았다. "...너랑 공부하면 덜 무서워."',
      },
      {
        text: '"힘들면 쉬어도 돼" — 쉬는 것도 괜찮다고 말해준다',
        effects: { mental: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 5 }],
        message: '"쉬는 거... 나한테는 사치야." 유나가 쓸쓸하게 웃었다. 마음이 아팠다.',
      },
    ],
  },
  {
    id: 'yuna-smile',
    title: '유나가 웃었다',
    description: '졸업이 다가온다. 유나가 드물게 먼저 말을 걸었다.\n"있잖아, 나 음대 가려고. 피아노."\n"...진짜?"\n"엄마한테 말했어. 크게 싸웠는데... 이번엔 안 지려고."',
    location: 'classroom',
    speakers: ['yuna'],
    condition: (s) => {
      const yuna = s.npcs.find(n => n.id === 'yuna');
      return !!yuna?.met && yuna.intimacy >= 65;
    },
    choices: [
      {
        text: '"잘했다, 유나. 네 피아노 진짜 좋았어" — 진심을 말한다',
        effects: { social: 3, mental: 5 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 8 }],
        message: '유나가 웃었다. 진짜로. 소리 내서. 처음 보는 환한 웃음이었다.\n"...고마워. 네가 그때 들어줘서, 내가 여기까지 온 거야."',
      },
      {
        text: '"나중에 연주회 하면 꼭 갈게" — 약속한다',
        effects: { mental: 4, social: 2 },
        npcEffects: [{ npcId: 'yuna', intimacyChange: 7 }],
        message: '"...꼭 와." 유나가 작게 웃으며 새끼손가락을 내밀었다. 약속.',
      },
    ],
  },
  // ===== 반장 후속 이벤트 =====
  {
    id: 'class-president-nudge', title: '민재의 추천',
    description: '쉬는 시간에 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데, 너가 하면 딱인데? 내가 추천할까?"',
    location: 'classroom',
    speakers: ['minjae'],
    choices: [
      { text: '"...해볼까?" — 민재 말에 용기를 낸다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '부반장이 됐다! 민재가 "내 눈은 틀리지 않지" 하며 웃었다.' },
      { text: '"아니야, 난 괜찮아" — 정중하게 거절한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '"알겠어, 근데 너 진짜 잘할 수 있었을 텐데." 민재 말에 기분이 나쁘진 않았다.' },
    ],
    condition: (s) => {
      const electionEvent = s.events.find(e =>
        (e.id === 'class-president' || e.id === 'class-president-2') &&
        e.resolvedChoice === 1 &&
        s.week - (e.week || 0) <= 4
      );
      return !!electionEvent && s.stats.social >= 40;
    },
  },
  // ===== 랜덤 이벤트 (조건부) =====
  {
    id: 'fatigue-warning',
    title: '몸이 무겁다',
    description: '아침에 일어나기가 힘들다. 몸이 천근만근이다.\n"오늘 학교 가기 싫다..."',
    condition: (s) => s.fatigue >= 60 && s.week > 5,
    location: 'home',
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
    location: 'classroom',
    speakers: ['minjae'],
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
    location: 'home',
    speakers: ['jihun'],
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
    location: 'classroom',
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
  // ===== 반장 선거 이벤트 =====
  {
    id: 'class-president', title: '반장 선거',
    description: '반장 선거 시즌이다.\n선생님이 교탁 앞에 서서 말했다.\n"자, 반장 후보 나올 사람 있나요?"',
    week: 2,
    location: 'classroom',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '손을 들었다. 민재도 눈을 크게 뜨며 "오, 진짜?" 했다. 이제 선거 연설을 해야 한다.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '민재가 "아무도 없어? 그럼 내가!" 하고 나섰다. 민재가 반장이 됐다. 잘 어울리긴 한다.' },
    ],
  },
  {
    id: 'class-president-win', title: '반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n반 친구들이 박수를 쳐준다.',
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.resolvedChoice === 0) && s.stats.social >= 30 && !s.events.some(e => e.id === 'class-president-lose'),
    location: 'classroom',
    choices: [
      { text: '반장이 됐다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '당선됐다! 떨리지만 잘 해보자.' },
    ],
  },
  {
    id: 'class-president-lose', title: '반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n가슴이 조금 내려앉았다.',
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.resolvedChoice === 0) && s.stats.social < 30 && !s.events.some(e => e.id === 'class-president-win'),
    location: 'classroom',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '아깝게 졌다. 조금 씁쓸하지만 인정한다.' },
    ],
  },
  {
    id: 'class-president-vice', title: '부반장 제안',
    description: '쉬는 시간에 당선된 반장이 다가온다.\n"야, 부반장 자리 아직 비었는데... 어때?"',
    condition: (s) => s.events.some(e => e.id === 'class-president-lose'),
    location: 'classroom', speakers: ['minjae'],
    choices: [
      { text: '"좋아, 해볼게" — 부반장을 맡는다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 5 }],
        message: '부반장이 됐다! 민재가 "우리 잘 해보자!" 하며 주먹을 내밀었다.' },
      { text: '"아니, 괜찮아..." — 정중히 거절한다', effects: { mental: 1 },
        message: '다음에 기회가 있을 거다. 지금은 조용히 지내자.' },
    ],
  },
  {
    id: 'class-president-2', title: '2학기 반장 선거',
    description: '2학기가 시작됐다. 선생님이 교탁 앞에 서서 말했다.\n"이번 학기 반장, 나올 사람 있나요?"',
    week: 25, location: 'classroom',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '손을 들었다. 1학기 경험이 있으니 이번엔 더 자신 있다.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 2 }],
        message: '민재가 또 나섰다. "내가 하지 뭐!" 2학기도 민재가 반장. 에너지가 대단하다.' },
    ],
  },
  {
    id: 'class-president-2-win', title: '2학기 반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n다시 한 번 내 이름이 불렸다!\n2학기도 반장이다!',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.resolvedChoice === 0) && s.stats.social >= 40 && !s.events.some(e => e.id === 'class-president-2-lose'),
    location: 'classroom',
    choices: [
      { text: '2학기도 반장이다!', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '민재가 "야, 이제 완전히 자리 잡았다" 했다. 이번엔 더 잘 해내고 싶다.' },
    ],
  },
  {
    id: 'class-president-2-lose', title: '2학기 반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n이번에도 아깝게 졌다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.resolvedChoice === 0) && s.stats.social < 40 && !s.events.some(e => e.id === 'class-president-2-win'),
    location: 'classroom',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '인기를 더 쌓아야겠다는 생각이 든다. 민재가 "고마워" 하며 웃었다.' },
    ],
  },
];

// ===== 학교생활 랜덤 이벤트 풀 (매주 1개씩 발생) =====
const SCHOOL_LIFE_EVENTS: GameEvent[] = [
  {
    id: 'random-quiz', title: '깜짝 퀴즈!',
    description: '선생님이 갑자기 "자, 퀴즈 보자" 하셨다.\n교실이 술렁인다.',
    location: 'classroom',
    choices: [
      { text: '자신 있게 풀어본다', effects: { academic: 2, mental: 1 }, message: '대부분 맞혔다! 선생님이 "역시" 하며 웃으셨다.' },
      { text: '찍기의 신이 되어본다', effects: { academic: 1, mental: -1 }, message: '반은 맞고 반은 틀렸다. 아슬아슬했다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'friend-snack', title: '간식 나눠먹기',
    description: '쉬는 시간에 민재가 과자를 까서 돌린다.\n"야, 너도 먹어!"',
    location: 'classroom',
    speakers: ['minjae'],
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
    location: 'classroom',
    choices: [
      { text: '웃으며 무시한다', effects: { mental: 1 }, message: '웃음을 참느라 힘들었다. 그래도 수업은 들었다.' },
      { text: '같이 보내본다 (몰래)', effects: { social: 2, mental: 2, academic: -1 }, message: '같이 장난치다 수업을 날렸다. 하지만 재밌었다!' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'rain-day', title: '비 오는 날',
    description: '우산을 안 가져왔는데 비가 온다.\n교문 앞에서 멈칫한다.',
    location: 'school_gate',
    choices: [
      { text: '그냥 뛰어간다!', effects: { health: -1, mental: 1 }, message: '흠뻑 젖었지만 왠지 상쾌하다.' },
      { text: '편의점에서 우산을 산다', effects: {}, moneyEffect: -1, message: '1000원짜리 투명 우산. 어른이 된 기분.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'lost-eraser', title: '지우개의 행방',
    description: '시험 중에 지우개가 바닥에 떨어졌다.\n옆자리 아이가 자기 거를 반으로 잘라 준다.',
    location: 'classroom',
    choices: [
      { text: '"고마워!" — 감동받는다', effects: { social: 1, mental: 2 }, message: '작은 친절이 큰 감동이 됐다. 시험도 잘 본 것 같다.' },
      { text: '안 쓰고 그냥 시험 본다 (자존심)', effects: { academic: -1, mental: -1 }, message: '지우개 없이 시험 봤다. 아... 실수 고칠 걸.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'teacher-praise', title: '선생님의 칭찬',
    description: '오늘 수업 시간에 발표를 했는데 선생님이 크게 칭찬해주셨다.\n"와, 정말 잘했다!"',
    location: 'classroom',
    choices: [
      { text: '기분 좋게 받아들인다', effects: { mental: 3, academic: 1 }, message: '얼굴이 빨개졌지만 기분은 좋다. 자신감이 생겼다.' },
      { text: '부끄러워서 작아진다', effects: { mental: 1 }, message: '칭찬은 좋은데... 다들 쳐다보니 부끄럽다.' },
    ],
    condition: (s) => s.stats.academic >= 40 && !s.isVacation,
  },
  {
    id: 'group-project', title: '조별 과제',
    description: '선생님이 조별 과제를 내셨다.\n"한 달 안에 제출해야 합니다."',
    location: 'classroom',
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
    location: 'home',
    choices: [
      { text: '참고 학교 간다', effects: { academic: 1, health: -2 }, fatigueEffect: 5, message: '억지로 갔는데 수업 내내 고통이었다.' },
      { text: '하루 쉰다', effects: { health: 1, mental: 1 }, fatigueEffect: -8, message: '푹 쉬고 나니 한결 나아졌다.' },
    ],
    condition: (s) => s.fatigue >= 40 && !s.isVacation,
  },
  {
    id: 'found-money', title: '길에서 만원',
    description: '등굣길에 만원짜리를 주웠다.\n주변에 떨어뜨린 사람이 안 보인다.',
    location: 'street',
    choices: [
      { text: '경찰서에 맡긴다', effects: { mental: 3 }, message: '착한 일 했다. 마음이 뿌듯하다.' },
      { text: '...주머니에 넣는다', effects: { mental: -2 }, moneyEffect: 1, message: '돈은 생겼는데 찝찝하다.' },
    ],
  },
  {
    id: 'birthday-friend', title: '지훈이 생일',
    description: '오늘이 지훈이 생일이다.\n단톡방에 생일 축하 메시지가 쏟아진다.',
    location: 'classroom',
    speakers: ['jihun'],
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
    location: 'gym',
    choices: [
      { text: '멋지게 잡아본다!', effects: { health: 2, social: 3, mental: 2 }, message: '잡았다!! 반 전체가 환호했다. 오늘 영웅이다!' },
      { text: '피한다 (안전제일)', effects: { health: 1 }, message: '무사히 살아남았다. 뭐, 이것도 전략이지.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'study-cafe', title: '스터디 카페',
    description: '시험 기간이라 스터디 카페가 만석이다.\n겨우 자리를 잡았는데 옆에 수빈이가 앉아 있다!',
    location: 'cafe',
    speakers: ['subin'],
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
    location: 'classroom',
    choices: [
      { text: '중재를 시도한다', effects: { social: 3, mental: -1 }, message: '양쪽 이야기를 듣고 화해시켰다. 피곤하지만 뿌듯하다.' },
      { text: '안 끼어든다 (조용히 나간다)', effects: { mental: 1 }, message: '현명한 선택. 남의 싸움에 끼면 안 된다.' },
    ],
    condition: (s) => !s.isVacation && s.stats.social >= 20,
  },
  {
    id: 'sunset-walk', title: '노을이 예쁜 날',
    description: '방과후 집에 가는 길. 하늘이 유난히 예쁘다.\n발걸음이 느려진다.',
    location: 'street',
    choices: [
      { text: '사진 찍고 잠시 앉아있는다', effects: { mental: 4 }, message: '아무 생각 없이 하늘을 봤다. 마음이 편해졌다.' },
      { text: '빨리 집에 간다 (할 일이 많아)', effects: { academic: 1 }, message: '집에 와서 공부를 시작했다. 하늘이 좀 아쉽다.' },
    ],
  },
  {
    id: 'music-discovery', title: '새로운 노래',
    description: '유튜브에서 우연히 들은 노래가 너무 좋다.\n반복 재생이 멈추지 않는다.',
    location: 'home',
    choices: [
      { text: '공부하면서 계속 듣는다', effects: { mental: 2, talent: 1 }, message: '좋은 음악과 함께하니 공부도 즐겁다.' },
      { text: '친구에게 공유한다', effects: { social: 2, mental: 1 }, message: '"이거 들어봐!" 친구도 좋아했다. 취향이 통하는 건 기분 좋다.' },
    ],
  },
  {
    id: 'cleaning-duty', title: '청소 당번',
    description: '오늘 청소 당번이다.\n교실이 엉망이다...',
    location: 'classroom',
    choices: [
      { text: '열심히 한다', effects: { health: 1, mental: 1 }, fatigueEffect: 2, message: '깨끗해진 교실을 보니 뿌듯하다.' },
      { text: '대충 하고 빠진다', effects: { social: -1 }, message: '옆에서 열심히 하는 애가 좀 미안하다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'dream-question', title: '꿈이 뭐야?',
    description: '수업 시간에 선생님이 물었다.\n"너희, 나중에 뭐 하고 싶어?"',
    location: 'classroom',
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
    location: 'street',
    choices: [
      { text: '뛰어간다!!!', effects: { health: 1 }, fatigueEffect: 3, message: '겨우 수업 시작 전에 도착했다. 심장이 터질 것 같다.' },
      { text: '포기하고 천천히 간다', effects: { mental: -1 }, message: '선생님한테 혼났다. 오늘 하루가 우울하다.' },
    ],
    condition: (s) => s.fatigue >= 30 && !s.isVacation,
  },
];

// 반장/부반장 당선 여부 체크
function isClassPresident(s: GameState): boolean {
  return s.events.some(e =>
    (e.id === 'class-president-win' || e.id === 'class-president-2-win') && e.resolvedChoice !== undefined
  ) || s.events.some(e => e.id === 'class-president-nudge' && e.resolvedChoice === 0)
    || s.events.some(e => e.id === 'class-president-vice' && e.resolvedChoice === 0);
}

// 후속 이벤트 ID — 이전 선택에 연결된 이벤트 (100% 확정 발동)
const FOLLOWUP_EVENT_IDS = new Set([
  'class-president-win', 'class-president-lose', 'class-president-vice',
  'class-president-2-win', 'class-president-2-lose',
  'class-president-nudge',
  'haeun-sketchbook', 'haeun-local-guide', 'haeun-afterclass', 'haeun-specialty-awake', 'haeun-winter',
  'jihun-basketball', 'jihun-secret', 'jihun-fight', 'jihun-support', 'jihun-promise',
  'subin-notes', 'subin-cafe', 'subin-dream', 'subin-exam-stress', 'subin-farewell',
  'minjae-party', 'minjae-mask', 'minjae-family', 'minjae-real', 'minjae-future',
  'yuna-library', 'yuna-lunch', 'yuna-hobby', 'yuna-pressure', 'yuna-smile',
]);

// 고정 주차 이벤트 해결 후 followup 이벤트 가져오기 (주당 1회 제한)
export function getFollowupForWeek(state: GameState): GameEvent | null {
  return GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    !state.events.some(prev => prev.id === e.id)
  ) || null;
}

// 이번 주에 발동할 이벤트 가져오기
export function getEventForWeek(state: GameState): GameEvent | null {
  // 0. 고정 주차 이벤트 최우선 (followup보다 먼저 — 이미 발동한 이벤트 제외)
  const ANNUAL_EVENTS = new Set(['elementary-graduation','middle-school-entrance','middle-graduation','high-school-entrance','suneung-eve','suneung-done','high-graduation','year-end-reflection']);
  const fixedEvent = GAME_EVENTS.find(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state)) &&
    (ANNUAL_EVENTS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  if (fixedEvent) return fixedEvent;

  // 1. 후속 이벤트 체크 (100% 발동)
  const followup = GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    !state.events.some(prev => prev.id === e.id)
  );
  if (followup) return followup;

  // 조건부 상태 이벤트 (피로/멘탈/번아웃 등) — 50% 확률
  const conditionalEvents = GAME_EVENTS.filter(e =>
    !e.week &&
    e.condition &&
    e.condition(state) &&
    !FOLLOWUP_EVENT_IDS.has(e.id) &&
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
