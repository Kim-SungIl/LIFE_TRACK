// 캐릭터 독백 — 상황에 따라 랜덤으로 하나 선택
import { GameState, WeekLog } from './types';
import { isExamPeriod } from './examSystem';

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
  // 시험 기간 — 시험 주 또는 직전 주 (학년별 examSchedule SSOT 사용 — Y1은 W17/W38만)
  { priority: 70, condition: s => isExamPeriod(s.year, s.week), lines: [
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
  { priority: 45, condition: s => s.stats.social < 30, lines: [
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
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
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
      '있잖아... 나 사실 어디에도 완전히 속한 적이 없는 것 같아.',
      '너한테는 솔직해도 될 것 같아. 나 엄마아빠 이혼했어.',
      '친구가 많다고들 하는데, 진짜 친구는 몇 명 안 되는 것 같아.',
      '너는 내가 사라져도 눈치챌 사람이야. 그게 고마워.',
      '승무원 되면 너 비행기 태워줄게. 진짜야.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '야, 오늘 학원 끝나고 떡볶이 먹으러 갈래?',
      '인스타 봤어? 웃긴 거 보내줄게!',
      '이번 주말에 뭐 해? 나 심심한데~',
      '너랑 있으면 편해서 좋다. 힘 안 빼도 되니까.',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '안녕! 오늘도 파이팅~',
      '아, 그 애 알아? 옆 반인데 되게 재밌어.',
      '학원에서 보자! 오늘 김쌤 기분 좋을 때 가야 돼.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '어, 안녕! 같은 학원이지?',
      '아, 우리 같은 동네잖아~',
      '...바쁜 듯?',
    ]},
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
      '시험이다~ 카페에서 같이 공부할래?',
      '나 혼자 하면 집중이 안 돼. 같이 하자!',
      '시험 끝나면 놀자. 약속이다!',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이다! 어디 여행 가고 싶다~',
      '방학에 뭐 해? 나는 학원... 아 그리고 놀아야지.',
      '방학인데 집에만 있을 거야? 나와!',
    ]},
  ],
  minjae: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '야... 나 솔직히 의사 되고 싶은 건지 모르겠어.',
      '너한테는 말할 수 있을 것 같아. 나 새벽 1시까지 공부해.',
      '가끔 네가 부러워. 넌 뭘 좋아하는지 아는 것 같잖아.',
      '우리 이렇게 된 거 웃기지 않아? 선생님들이 비교 안 했으면 그냥 친구였을 텐데.',
      '수능 끝나면... 나 뭘 하고 싶은지 처음부터 생각해보고 싶어.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '이번 시험 어땠어? 나? 뭐 그냥 그랬어. (의식하는 눈빛)',
      '야, 솔직히 너 아니었으면 나 이만큼 안 올랐을 거야.',
      '점심 같이 먹을래? 아 참, 너 요즘 바쁘구나.',
      '쉬는 시간에 웹툰이나 보자. 공부 얘기 말고.',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '어, 안녕. 오늘도 열심히 하네.',
      '야, 시험 범위 어디까지야? ...아 나도 알아, 그냥 확인.',
      '점심 뭐 먹어? 급식 별로던데.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '(교과서를 보고 있다)',
      '...어, 안녕.',
      '(노트 필기에 집중하고 있다)',
    ]},
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
      '시험? 하나도 안 했는데. (눈 밑에 다크서클이 있다)',
      '이번엔 좀 어려울 것 같다... 아 아니, 그냥 그런 느낌.',
      '너 몇 등 나올 것 같아? ...아무것도 아니야, 그냥 물어본 거야.',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이라고 쉬는 거 아니야... 엄마가 학원 특강 넣었어.',
      '야, 방학에 뭐 해? 나는 뭐... 학원.',
      '놀고 싶다... (작은 목소리)',
    ]},
  ],
  yuna: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '너한테는 진짜 다 말할 수 있어. 고마워!',
      '있잖아, 너랑 얘기하면 진짜 편해~',
      '나 너한테 진짜 고마운 거 알지?',
      '오늘도 와줬네! 역시 넌 최고야.',
      '너는 진짜 따뜻한 사람이야. 알지?',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '야! 오늘 숙제 했어? 나 7번 모르겠는데!',
      '이 문제 같이 풀어보자! 나 혼자 하면 지루해~',
      '나 어제 책 하나 발견했는데, 진짜 좋아. 추천해줄게!',
      '오늘 도서관 갈 건데 같이 가자!',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '안녕! 오늘도 파이팅이지!',
      '오늘도 열심히 해보자~',
      '수업 어땠어? 나 좀 졸렸어.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '안녕!',
      '(밝게 손을 흔든다)',
      '어, 안녕~',
    ]},
    { priority: 35, condition: (int, s) => s.year >= 3 && int < 50, lines: [
      '요즘 바쁘구나! 나도 좀 그래~',
      '(복도에서 밝게 손 흔든다)',
      '오랜만이다! 잘 지내지?',
      '같은 학교인데 잘 안 마주치네! 아쉬워~',
    ]},
    { priority: 45, condition: (int, s) => s.year >= 5 && int >= 60, lines: [
      '야, 오랜만에 얘기하는 것 같아! 좀 그리웠어.',
      '나 요즘 피아노 다시 치기 시작했어! 예전 감각 돌아오더라~',
      '너는 변하지 않는 것 같아. 좋은 의미로!',
    ]},
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
      '시험 준비 되고 있어? 나는... 좀 걱정이야.',
      '이번 범위 노트 정리한 거 있는데 볼래? 같이 하자!',
      '같이 공부하면 더 잘 될 것 같은데!',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이다! 책 읽고 피아노 치고 바쁠 예정~',
      '방학이라 여유롭다! 좋아~',
      '방학에 도서관 같이 갈래? 나 혼자 가면 심심해!',
    ]},
  ],
  haeun: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '나 오빠가 수능 망했거든. 그거 보고 나서 좀 무서워졌어.',
      '너는 나보다 잘할 거야. 진짜로.',
      '고등학교 가면... 나 없어도 괜찮겠지?',
      '나중에 상담사가 되면, 너 같은 후배한테 도움이 되고 싶어.',
      '너한테 조언해주면서 사실 나도 다독이는 거야.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '2학년 되면 과학 김쌤 수업 들어, 설명 잘해.',
      '야, 고등학교 생각하면 무서워? 나도 무서워.',
      '점심 같이 먹자. 매점 가자, 내가 살게.',
      '네가 힘들 때 와줘서 고마워. 선배라고 항상 괜찮은 건 아니거든.',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '1학년이 제일 좋은 거야. 아직 아무것도 정해진 거 없잖아.',
      '시험 걱정돼? 이거 이렇게 정리하면 외우기 쉬워.',
      '급식에서 저거 먹지 마, 그거 맛없어.',
    ]},
    { priority: 40, condition: (int) => int >= 10, lines: [
      '야, 존댓말 하지 마. 어색해.',
      '후배~ 오늘 하루 어땠어?',
      '복도에서 뛰지 마, 다친다.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '(가디건을 걸치고 복도를 지나간다)',
      '...어, 안녕.',
      '(도서관에서 창밖을 보고 있다)',
    ]},
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
      '시험 기간이지? 이 단원은 이렇게 정리하면 돼.',
      '너무 무리하지 마. 멘탈이 더 중요해.',
      '시험 끝나면 같이 뭐 맛있는 거 먹자.',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학이다. 좀 쉬어. 다음 학기는 더 바빠져.',
      '방학에 읽을 책 추천해줄까?',
      '나도 방학인데 학원 때문에 쉴 수가 없어...',
    ]},
  ],
  junha: [
    { priority: 100, condition: (int) => int >= 80, lines: [
      '야, 서울 와서 처음 밥 같이 먹어준 게 너야. 잊지 마.',
      '나 부산 친구들 단톡방 나왔어. 대화에 못 끼겠더라...',
      '졸업하면 부산 놀러 와. 내가 안내해줄게.',
      '나 요리사 될 거야. 웃기지? 근데 진심이야.',
      '여기가 집이라고 말하기엔 아직 어색한데... 너 덕분에 좀 나아졌어.',
    ]},
    { priority: 80, condition: (int) => int >= 50, lines: [
      '야, 이거 어제 만들어 봤는데 먹어봐. 김밥이야.',
      '서울은 다 빠르다. 사람도 빠르고 말도 빠르고.',
      '아이고 마! 아 아니, 아 진짜... (사투리가 나왔다)',
      '점심 같이 먹자. 내가 주먹밥 싸왔어.',
    ]},
    { priority: 60, condition: (int) => int >= 30, lines: [
      '어, 안녕. 오늘도 수고했다.',
      '...서울 급식은 맛이 좀 달라.',
      '야, 그냥 싫으면 싫다고 해. 서울 애들은 돌려 말하더라.',
    ]},
    { priority: 40, condition: (int) => int >= 10, lines: [
      '안녕하세요... 아 안녕. (어색하게 웃는다)',
      '(핸드폰으로 부산 친구들 단톡방을 보고 있다)',
      '여기 아직 잘 모르겠어.',
    ]},
    { priority: 0, condition: () => true, lines: [
      '...(혼자 점심을 먹고 있다)',
      '(가방이 좀 낡았다)',
      '...안녕.',
    ]},
    { priority: 90, condition: (_, s) => isExamPeriod(s.year, s.week), lines: [
      '나 수시는 아예 못 쓸 것 같아. 정시 올인이다.',
      '야, 이 단원 어떻게 외워? 부산에서 안 배운 건데...',
      '도서관에서 인강 들을래. 무료 강의 괜찮은 거 있더라.',
    ]},
    { priority: 85, condition: (_, s) => s.isVacation, lines: [
      '방학에 부산 내려갈까... 아니다, 여기서 공부해야지.',
      '방학이라 알바하려고. 어디 자리 있는 데 알아?',
      '방학에 요리 연습 많이 해야지. 먹어볼래?',
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

// 결산 독백 — weekLog의 실제 사건/스탯 변화에 맞춰 골라 줌.
// getCharacterDialogue는 상태 풀(피로/멘탈/방학 등)에서 무작위로 뽑기 때문에
// 선거 당선 같은 강한 이벤트 직후에도 "날씨가 좋다"가 나올 수 있어 결산에서는 위화감이 큼.
// 우선순위: 시험 결과 > 마일스톤 > 큰 변화 > 이벤트 발생 → 그래도 안 잡히면 기본 풀로 fallback.
interface ResultDialoguePool {
  condition: (s: GameState, w: WeekLog) => boolean;
  lines: string[];
  priority: number;
}

// 5개 스탯 변화의 합. 양성/음성 풀 매칭 시 "혼재 주차" 오발동을 막는 보조 가드.
// 예: 학업+1.9 / 멘탈-1.7인 주에 멘탈 한 스탯만으로 "어긋난 한 주"가 뜨던 문제 회피.
function netStatChange(w: WeekLog): number {
  return Object.values(w.statChanges).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

const RESULT_POOLS: ResultDialoguePool[] = [
  // 모의/수능 — 등급 기반
  { priority: 100,
    condition: (_, w) => w.examResult?.mockGrade != null && w.examResult.mockGrade <= 2,
    lines: [
      '...해냈다. 진짜로.',
      '이번엔 손이 떨릴 정도로 잘 봤다.',
      '준비한 게 결과로 나왔다.',
    ],
  },
  { priority: 100,
    condition: (_, w) => w.examResult?.mockGrade != null && w.examResult.mockGrade >= 6,
    lines: [
      '...많이 부족했다.',
      '망했다... 다음엔 진짜 더 해야지.',
      '시험지를 보는 순간 머리가 하얘졌다.',
    ],
  },
  // 내신 시험 — 평균 기반
  { priority: 95,
    condition: (_, w) => w.examResult != null && w.examResult.mockGrade == null && w.examResult.average >= 85,
    lines: [
      '이번엔 정말 잘 본 것 같다.',
      '책상 앞에 앉아 있던 시간이 보상받은 기분.',
      '성적표를 받자마자 혼자 웃었다.',
    ],
  },
  { priority: 95,
    condition: (_, w) => w.examResult != null && w.examResult.mockGrade == null && w.examResult.average < 60,
    lines: [
      '...집에 가는 길이 멀게 느껴졌다.',
      '준비를 더 했어야 했다.',
      '점수표를 가방 깊숙이 넣었다.',
    ],
  },
  // 성장 마일스톤
  { priority: 80,
    condition: (_, w) => (w.milestoneMessages?.length ?? 0) > 0,
    lines: [
      '뭔가 한 단계 올라간 기분이다.',
      '내가 변하고 있는 게 느껴진다.',
      '이번 주는 의미가 있었다.',
      '거울을 봤더니 표정이 좀 달라 보였다.',
    ],
  },
  // 큰 양수 변화 — stat 임계 + net 양성 가드 (혼재 주차에선 fallback으로 빠지도록)
  { priority: 60,
    condition: (_, w) => (w.statChanges.academic ?? 0) >= 1.5 && netStatChange(w) >= 1,
    lines: ['공부가 손에 잡힌 한 주였다.', '머리가 잘 돌아간 느낌이야.', '문제집 한 권을 끝낸 기분.'],
  },
  { priority: 60,
    condition: (_, w) => (w.statChanges.social ?? 0) >= 1.5 && netStatChange(w) >= 1,
    lines: ['친구들과 가까워진 느낌이다.', '이번 주는 사람 사이의 온도가 좋았어.', '단톡방 알림이 많아진 게 좋다.'],
  },
  { priority: 60,
    condition: (_, w) => (w.statChanges.talent ?? 0) >= 1.5 && netStatChange(w) >= 1,
    lines: ['내가 좋아하는 게 손에 익는다.', '이거 진짜 내 길인지도 모르겠다.', '연습한 만큼 늘었다.'],
  },
  { priority: 55,
    condition: (_, w) => (w.statChanges.mental ?? 0) >= 2 && netStatChange(w) >= 1,
    lines: ['마음이 한결 가볍다.', '오랜만에 숨이 잘 쉬어진다.', '괜찮은 한 주였다.'],
  },
  { priority: 55,
    condition: (_, w) => (w.statChanges.health ?? 0) >= 1.5 && netStatChange(w) >= 1,
    lines: ['몸이 가벼워졌다.', '체력이 붙는 게 느껴진다.', '계단을 올라가는 게 덜 힘들다.'],
  },
  // 큰 음수 변화 — 어느 스탯이든 -1.5 이하 + net도 음성일 때만 (양성 우세 주차에서 오발동 방지)
  { priority: 50,
    condition: (_, w) => Object.values(w.statChanges).some(v => (v ?? 0) <= -1.5) && netStatChange(w) <= -1,
    lines: [
      '이번 주는 좀 무리했나...',
      '몸도 마음도 따라오질 않는다.',
      '많이 깎였다... 다음 주는 잘 챙겨야지.',
      '뭔가 어긋난 한 주였다.',
    ],
  },
  // 이벤트 발생 (📖)
  { priority: 30,
    condition: (_, w) => w.messages.some(m => m.startsWith('📖')),
    lines: [
      '이번 주는 평소랑 좀 달랐다.',
      '뭔가 일이 많았던 한 주.',
      '생각할 게 많았다.',
    ],
  },
];

export function getResultDialogue(state: GameState, weekLog: WeekLog): string {
  const sorted = [...RESULT_POOLS].sort((a, b) => b.priority - a.priority);
  for (const pool of sorted) {
    if (pool.condition(state, weekLog)) {
      return pool.lines[Math.floor(Math.random() * pool.lines.length)];
    }
  }
  return getCharacterDialogue(state);
}

// 활동 선택 시 반응 독백
export function getActivityReaction(activityId: string): string {
  const reactions: Record<string, string[]> = {
    'self-study': ['집중, 집중...', '오늘은 좀 하는 느낌이다.', '졸리다...'],
    'academy': ['오늘도 셔틀버스를 타야 하나...', '학원은 피곤하지만 확실하긴 해.'],
    'study-group': ['같이 하니까 덜 지루하다.', '누가 과자 사왔으면 좋겠다.'],
    'private-tutoring': ['1:1이라 빠져나갈 데가 없다.', '약점만 콕 집어주니 효율은 확실해.'],
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
    // 방학 전용 활동
    'vacation-library': ['종일 앉아 있었더니 진도 쭉 나갔다.', '방학 도서관, 의외로 집중 잘 되네.'],
    'creative-project': ['드디어 형태가 잡히기 시작했다.', '시간 들인 만큼 나온다.'],
    'countryside': ['공기부터 다르다.', '할머니 밥이 최고지.'],
    'neighborhood-hangout': ['동네 친구들은 역시 편하다.', '별거 안 해도 재밌네.'],
    'intensive-academy': ['짧고 굵게 몰아쳤다.', '머리에 쥐 날 것 같지만 남는 건 있어.'],
    'sports-camp': ['합숙은 빡세도 끈끈해진다.', '몸은 천근만근, 마음은 뿌듯.'],
    'family-trip': ['오랜만에 가족이랑 푹 쉬었다.', '이런 시간이 필요했어.'],
    'short-term-job': ['며칠 고생했더니 지갑이 두둑하네.', '몸은 힘들어도 보람은 있다.'],
  };
  const lines = reactions[activityId] || ['열심히 했다.'];
  return lines[Math.floor(Math.random() * lines.length)];
}
