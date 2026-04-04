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
  ]},
  // 피로 높음
  { priority: 90, condition: s => s.fatigue >= 60, lines: [
    '몸이 천근만근이다...',
    '좀 쉬어야 할 것 같은데.',
    '오늘은 일찍 자고 싶다.',
  ]},
  // 피로 상태
  { priority: 80, condition: s => s.mentalState === 'tired', lines: [
    '요즘 뭘 해도 재미가 없다.',
    '집중이 잘 안 된다...',
    '좀 쉬고 싶은데, 쉴 수가 없네.',
  ]},
  // 멘탈 높음
  { priority: 50, condition: s => s.stats.mental >= 80, lines: [
    '오늘 기분 좋다!',
    '뭐든 할 수 있을 것 같은 기분.',
    '이번 주도 파이팅!',
    '요즘 꽤 잘 하고 있는 것 같아.',
  ]},
  // 돈 부족
  { priority: 60, condition: s => s.money <= 2, lines: [
    '용돈이 바닥이다...',
    '이번 주는 아끼자.',
    '돈이 없으니 할 수 있는 게 별로 없네.',
  ]},
  // 시험 기간 (W7~8, W16~17, W33~34, W37~38)
  { priority: 70, condition: s => [7,8,16,17,33,34,37,38].includes(s.week), lines: [
    '시험이 다가온다... 긴장된다.',
    '공부를 더 해야 하는데...',
    '이번엔 잘 볼 수 있을까?',
  ]},
  // 방학
  { priority: 55, condition: s => s.isVacation, lines: [
    '방학이다! 뭘 하지?',
    '시간이 많으니까 뭐든 할 수 있어.',
    '놀고 싶지만, 공부도 해야 하고...',
    '방학이라 여유롭다.',
  ]},
  // 인기 낮음
  { priority: 45, condition: s => s.stats.social < 25, lines: [
    '오늘도 조용한 하루.',
    '누가 먼저 말 걸어줬으면...',
    '점심시간이 좀 외롭다.',
  ]},
  // 기본
  { priority: 0, condition: () => true, lines: [
    '이번 주는 뭘 할까?',
    '오늘도 평범한 하루.',
    '뭔가 재밌는 일 없나?',
    '할 일이 많네...',
    '날씨가 좋다.',
    '학교 끝났다!',
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
