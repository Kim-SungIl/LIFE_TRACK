// 캐릭터 독백 — 상황에 따라 랜덤으로 하나 선택
import { GameState } from './types';

interface DialoguePool {
  condition: (s: GameState) => boolean;
  lines: string[];
  priority: number; // 높을수록 우선
}

const DIALOGUE_POOLS: DialoguePool[] = [
  // 번아웃
  { priority: 100, condition: s => s.mentalState === 'burnout', lines: [
    '...아무것도 하고 싶지 않다.',
    '왜 이렇게 피곤하지...',
    '오늘도 하루가 길다.',
    '숨쉬는 것도 귀찮다.',
    '침대에서 나오기 싫어...',
    '언제쯤 괜찮아질까.',
  ]},
  // 피로 높음
  { priority: 90, condition: s => s.fatigue >= 60, lines: [
    '몸이 천근만근이다...',
    '좀 쉬어야 할 것 같은데.',
    '오늘은 일찍 자고 싶다.',
    '눈이 자꾸 감긴다...',
    '책상 앞에 앉아도 글자가 안 읽혀.',
    '어깨가 너무 뻣뻣해...',
  ]},
  // 피로 상태
  { priority: 80, condition: s => s.mentalState === 'tired', lines: [
    '요즘 뭘 해도 재미가 없다.',
    '집중이 잘 안 된다...',
    '좀 쉬고 싶은데, 쉴 수가 없네.',
    '다들 잘 하는 것 같은데, 나만 제자리...',
    '하... 언제 끝나지.',
    '그냥 시간이 빨리 갔으면.',
  ]},
  // 시험 기간 (W7~8, W16~17, W33~34, W37~38)
  { priority: 70, condition: s => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
    '시험이 다가온다... 긴장된다.',
    '공부를 더 해야 하는데...',
    '이번엔 잘 볼 수 있을까?',
    '시험 범위가 왜 이렇게 많아...',
    '벼락치기라도 해야 하나?',
    '단톡방에 시험 범위 물어보는 애가 있다.',
  ]},
  // 돈 부족
  { priority: 60, condition: s => s.money <= 2, lines: [
    '용돈이 바닥이다...',
    '이번 주는 아끼자.',
    '돈이 없으니 할 수 있는 게 별로 없네.',
    '편의점 앞을 지나가기 힘들다.',
    '친구들이 떡볶이 먹자는데 돈이...',
  ]},
  // 방학
  { priority: 55, condition: s => s.isVacation, lines: [
    '방학이다! 뭘 하지?',
    '시간이 많으니까 뭐든 할 수 있어.',
    '놀고 싶지만, 공부도 해야 하고...',
    '방학이라 여유롭다.',
    '아침에 늦잠 자는 게 최고야.',
    '밤 새워도 내일 학교 안 가도 돼!',
    '방학 계획을 세웠는데... 벌써 무너졌다.',
  ]},
  // 멘탈 높음
  { priority: 50, condition: s => s.stats.mental >= 80, lines: [
    '오늘 기분 좋다!',
    '뭐든 할 수 있을 것 같은 기분.',
    '이번 주도 파이팅!',
    '요즘 꽤 잘 하고 있는 것 같아.',
    '하늘이 유난히 예쁜 날이다.',
    '콧노래가 나온다~',
  ]},
  // 학업 높음
  { priority: 42, condition: s => s.stats.academic >= 70, lines: [
    '수업 내용이 귀에 쏙쏙 들어온다.',
    '이 정도면 시험 좀 잘 볼 수 있겠지?',
    '모르는 게 줄어드는 게 느껴진다.',
  ]},
  // 인기 높음
  { priority: 42, condition: s => s.stats.social >= 70, lines: [
    '요즘 친구들이 먼저 말 걸어준다.',
    '점심 같이 먹자는 애가 많아서 행복하다.',
    '학교 오는 게 재밌어졌다.',
  ]},
  // 인기 낮음
  { priority: 45, condition: s => s.stats.social < 25, lines: [
    '오늘도 조용한 하루.',
    '누가 먼저 말 걸어줬으면...',
    '점심시간이 좀 외롭다.',
    '혼자 밥 먹는 것도 이제 익숙해...',
    '단톡방이 조용하다.',
  ]},
  // 특기 높음
  { priority: 38, condition: s => s.stats.talent >= 60, lines: [
    '요즘 실력이 느는 게 느껴진다.',
    '내가 잘하는 게 있다는 건 좋은 거지.',
    '이 분야에선 자신감이 좀 있어.',
  ]},
  // 고등학생 (Y5~Y7)
  { priority: 30, condition: s => s.year >= 5, lines: [
    '고등학생이 되니 시간이 더 빨리 간다.',
    '진로를 슬슬 정해야 하는데...',
    '주변 분위기가 확 달라졌다.',
    '벌써 이만큼 컸구나.',
  ]},
  // 중학생 (Y2~Y4)
  { priority: 25, condition: s => s.year >= 2 && s.year <= 4, lines: [
    '중학생이 되니까 확실히 바빠졌다.',
    '교복 입으니까 좀 어른이 된 기분?',
    '선배가 무섭다...',
  ]},
  // 기본
  { priority: 0, condition: () => true, lines: [
    '이번 주는 뭘 할까?',
    '오늘도 평범한 하루.',
    '뭔가 재밌는 일 없나?',
    '할 일이 많네...',
    '날씨가 좋다.',
    '학교 끝났다!',
    '오늘 급식 뭐지?',
    '쉬는 시간이 제일 좋아.',
    '하교 종이 빨리 울렸으면.',
  ]},
];

export function getCharacterDialogue(state: GameState): string {
  // 우선순위 높은 것부터 체크, 조건 맞으면 랜덤 선택
  const sorted = [...DIALOGUE_POOLS].sort((a, b) => b.priority - a.priority);
  for (const pool of sorted) {
    if (pool.condition(state)) {
      return pool.lines[Math.floor(Math.random() * pool.lines.length)];
    }
  }
  return '이번 주도 힘내자.';
}

// NPC 대사 — 친밀도/상태에 따라 다양한 대사
interface NpcDialoguePool {
  condition: (intimacy: number, state: GameState) => boolean;
  lines: string[];
  priority: number;
}

const NPC_DIALOGUES: Record<string, NpcDialoguePool[]> = {
  jihun: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '야, 너 오늘 뭐해? 같이 놀자!',
      '너 아니면 누구한테 말하겠어. 들어봐.',
      '우리 진짜 오래 알았다, 그치?',
      '너랑 있으면 시간 가는 줄 모르겠어.',
      '나중에 커서도 계속 친구하자.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '야! 오늘도 같이 놀자!',
      '뭐해? 심심한데 같이 뭐 하자.',
      '오늘 체육 시간에 같은 팀 하자!',
      '이따 편의점 갈래? 내가 음료 살게.',
      '주말에 뭐 할 거야?',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '어, 왔어? 오늘 뭐 하기로 했더라?',
      '야, 오늘 급식 맛있대. 빨리 가자.',
      '아 맞다, 숙제 했어?',
    ]},
    { priority: 0, condition: () => true, lines: [
      '...어, 안녕.',
      '요즘 바쁘구나.',
      '오랜만이다.',
    ]},
    // 시험 기간
    { priority: 90, condition: (_, s) => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
      '야, 시험 범위 뭐야? 하나도 모르겠어...',
      '아 시험 싫다... 같이 공부할래?',
      '너는 공부 잘하잖아, 좀 알려줘!',
    ]},
    // 방학
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이다!! 뭐 하고 놀까?',
      '야, 이번 방학에 바다 갈래?',
      '방학인데 집에만 있을 거야? 나가자!',
    ]},
  ],
  subin: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '너 오면 왠지 안심이 돼.',
      '있잖아... 나 너한테 할 말이 있는데.',
      '오늘 카페 갈래? 내가 살게.',
      '너는 나한테 특별한 친구야.',
      '같이 있으면 편해서 좋다.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '어, 안녕! 오늘 학원 같이 갈래?',
      '나 오늘 새 필통 샀어, 예쁘지?',
      '시험 공부 같이 하자. 카페에서.',
      '어제 본 드라마 봤어? 진짜 재밌었는데.',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '안녕! 오늘도 파이팅.',
      '학원에서 보자~',
      '오늘 수학 숙제 어려웠지?',
    ]},
    { priority: 0, condition: () => true, lines: [
      '아, 안녕...',
      '우리 같은 동네인데 별로 안 마주치네.',
      '...바빠 보인다.',
    ]},
    { priority: 90, condition: (_, s) => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
      '시험 공부 같이 할래? 나 혼자 하면 잠 와...',
      '이번 시험 범위 정리해 왔는데 볼래?',
      '너는 준비 잘 되고 있어?',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학에 뭐 할 거야? 나는 여행 가고 싶은데.',
      '방학이라 좀 심심하다...',
      '방학 숙제 같이 할래?',
    ]},
  ],
  minjae: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '야, 너 진짜 내 찐친이다.',
      '오늘 학교 끝나고 우리만 뭐 하자!',
      '너 없으면 학교 재미없어.',
      '너한테 비밀인데... 아 아무것도 아니야.',
      '요즘 너랑 있는 시간이 제일 좋아.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '헤이~ 뭐해? 심심한데 같이 뭐 하자!',
      '야, 오늘 새로 생긴 떡볶이집 가봤어? 같이 가자!',
      '인스타 봤어? 웃긴 거 보내줄게.',
      '오늘 뭐 입고 온 거야? 괜찮은데?',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '어~ 안녕! 오늘도 화이팅!',
      '야, 오늘 점심 같이 먹자.',
      '아, 너 이름이... 맞다맞다!',
    ]},
    { priority: 0, condition: () => true, lines: [
      '어, 안녕?',
      '아 그... 같은 반이지?',
      '...(바쁜 듯)',
    ]},
    { priority: 90, condition: (_, s) => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
      '시험? 그게 뭐야? 하하... 하...',
      '야 시험 끝나면 놀자. 약속이다!',
      '어차피 망한 거, 한 문제라도 더 맞히자...',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이다!!! 매일 놀 거야!',
      '야, 방학에 맛집 투어 갈래?',
      '방학 계획? 그런 건 없어. 자유다!',
    ]},
  ],
  yuna: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '...너한테는 말할 수 있을 것 같아.',
      '있잖아, 너랑 얘기하면 마음이 편해져.',
      '나... 너한테 고마운 거 알지?',
      '오늘도 와줘서 고마워.',
      '너는 참 따뜻한 사람이야.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '안녕! 혹시 오늘 숙제 했어?',
      '이 문제 같이 풀어볼래?',
      '나 어제 좋은 책 발견했는데, 추천해줄게.',
      '오늘 도서관 갈 건데, 같이 갈래?',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '안녕...',
      '오늘도 열심히 하자.',
      '수업 잘 들었어?',
    ]},
    { priority: 0, condition: () => true, lines: [
      '......',
      '(고개만 살짝 끄덕인다)',
      '...안녕.',
    ]},
    { priority: 90, condition: (_, s) => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
      '시험 준비 잘 되고 있어? 나는... 걱정이야.',
      '이번 범위 노트 정리한 거 있는데, 볼래?',
      '같이 공부하면 더 잘 될 것 같은데...',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학에는 책 많이 읽고 싶어.',
      '방학이라 여유롭다... 좋다.',
      '혹시 방학에 도서관 같이 갈래?',
    ]},
  ],
  haeun: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '너한테 보여주고 싶은 게 있어. 같이 가자!',
      '너는 나한테 이 동네 처음 알려준 사람이야. 특별해.',
      '같이 만든 거 보면 진짜 뿌듯하지 않아?',
      '너랑 있으면 아이디어가 막 떠올라!',
      '부산 돌아가면... 너가 제일 보고 싶을 것 같아.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '아, 왔네! 오늘은 좀 덜 어색한데?',
      '여긴 아직도 신기한 게 많아. 너는 익숙해서 모르지?',
      '같이 있으면 덜 심심해서 좋아.',
      '나 오늘 좋은 거 발견했는데, 보여줄까?',
      '이거 그려봤는데 어때? 솔직하게 말해!',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '안녕! 오늘 뭐 하기로 했더라?',
      '여기 분식집은 부산이랑 맛이 좀 다르더라.',
      '아, 이 노래 알아? 요즘 빠졌어.',
      '나 아직 길 잘 헷갈려... 학교 앞 골목 왜 이렇게 많아?',
    ]},
    { priority: 40, condition: (int) => int >= 10, lines: [
      '안녕... 나 아직 이름 다 못 외웠어.',
      '여기 급식은 부산이랑 다른 게 뭐야?',
      '전학 오니까 다 처음부터야... 좀 힘들다.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '......',
      '(살짝 고개를 끄덕인다)',
      '아... 안녕.',
    ]},
    { priority: 90, condition: (_, s) => [33,34,37,38].includes(s.week), lines: [
      '시험 범위가 부산이랑 달라서 멘붕이야...',
      '여기 시험 문제 스타일이 다른 것 같아. 도와줄 수 있어?',
      '아 시험... 전학생한테 너무 가혹하다...',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학에 부산 갈 건데, 같이 갈래? 맛있는 거 많아!',
      '방학이다! 뭔가 만들어 볼까? 아이디어 있어!',
      '이번 방학엔 그림 연습 많이 할 거야.',
    ]},
  ],
};

export function getNpcDialogue(npcId: string, intimacy: number, state: GameState): string {
  const pools = NPC_DIALOGUES[npcId];
  if (!pools) return '...';
  const sorted = [...pools].sort((a, b) => b.priority - a.priority);
  for (const pool of sorted) {
    if (pool.condition(intimacy, state)) {
      return pool.lines[Math.floor(Math.random() * pool.lines.length)];
    }
  }
  return '...';
}

// 활동 선택 시 반응 독백
export function getActivityReaction(activityId: string): string {
  const reactions: Record<string, string[]> = {
    'self-study': ['집중, 집중...', '오늘은 좀 하는 느낌이다.', '졸리다...'],
    'academy': ['오늘도 셔틀버스를 타야 하나...', '학원은 피곤하지만 확실하긴 해.'],
    'study-group': ['같이 하니까 덜 지루하다.', '누가 과자 사왔으면 좋겠다.'],
    'light-exercise': ['바람이 시원하다.', '달리고 나니 머리가 맑아졌어.'],
    'school-sports': ['오늘 연습 빡셌다...', '같이 뛰는 게 좋다.'],
    'hang-out': ['역시 노는 게 최고야!', '시간 가는 줄 몰랐다.'],
    'sns-activity': ['피드 넘기다 보니 한 시간...', '좋아요 눌러야지.'],
    'club': ['동아리가 학교에서 제일 재밌어.', '오늘 활동 알찼다.'],
    'art-lesson': ['선생님이 칭찬해줬다!', '아직 멀었지만, 조금씩 늘고 있어.'],
    'creative': ['이건 내 세계야.', '시간 가는 줄 몰랐다.'],
    'rest': ['이불 밖은 위험해...', 'zzZ...', '가끔은 이런 시간이 필요해.'],
    'deep-rest': ['완전히 리셋됐다.', '세상이 다르게 보인다.'],
    'gaming': ['한 판만 더...', '재밌다!', '시간이 순삭이네.'],
    'park-walk': ['바람이 좋다.', '하늘이 예쁘네.'],
    'study-with-parent': ['엄마가 옆에 있으니 든든하다.', '"이건 이렇게 하는 거야."'],
    'family-dinner': ['"오늘 학교 어땠어?"', '밥이 맛있다.'],
    'part-time': ['"어서오세요~"', '오늘도 열심히 일했다.'],
    'coding': ['코드가 돌아갔다!', '왜 에러가 나는 거야...'],
    'volunteer': ['좋은 일 하니까 기분이 좋다.', '보람 있는 하루.'],
    'reading': ['이 책 재밌다.', '한 챕터만 더...'],
    'library': ['도서관은 역시 집중이 잘 돼.', '옆자리 사람도 열심히 하네.'],
    'internet-lecture': ['1.5배속으로 돌려야지.', '이 부분 이해 안 되는데...'],
    'gym': ['근육이 아프다... 하지만 뿌듯.', '오늘 기록 갱신!'],
  };
  const lines = reactions[activityId] || ['열심히 했다.'];
  return lines[Math.floor(Math.random() * lines.length)];
}
