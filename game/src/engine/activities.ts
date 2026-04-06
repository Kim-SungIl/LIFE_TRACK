import { Activity, GameState } from './types';

// v6.2: 활동 기본값 전면 하향 — 7년 장기 레이스에 맞는 Y1 성장 속도
// 목표: 일반 플레이어 Y1 종료 시 주력 스탯 50~60, 집중형 65~75
export const ACTIVITIES: Activity[] = [
  // === 공부 계열 ===
  {
    id: 'self-study', name: '독학', slots: 1, fatigue: 5,
    effects: { academic: 1.5 }, moneyCost: 0, category: 'study',
    description: '혼자서 묵묵히 공부한다.',
    flavor: '조용히 책상에 앉아 진도를 뺀다. 집중이 잘 되는 날도 있고, 아닌 날도 있다.',
    tags: ['집중', '혼자', '꾸준함'],
  },
  {
    id: 'academy', name: '학원 수업', slots: 1, fatigue: 7,
    effects: { academic: 1.5 }, moneyCost: 2, category: 'study', // v6.4: 비용 3→2
    description: '학원에서 체계적으로 배운다.',
    flavor: '학원 셔틀을 타고 간다. 선생님 설명은 빠르지만, 확실히 혼자보단 낫다.',
    tags: ['체계적', '비용 있음', '고효율'],
    requires: (s) => s.money >= 2, // v6.4: 비용 3→2
  },
  {
    id: 'study-group', name: '스터디 그룹', slots: 1, fatigue: 4,
    effects: { academic: 1.5, social: 0.5 }, moneyCost: 0, category: 'study',
    description: '친구들과 함께 공부한다.',
    flavor: '카페에 모여 각자 공부하다가, 모르는 거 있으면 물어본다. 은근 효율적.',
    tags: ['친구', '협동', '변수 있음'],
  },
  {
    id: 'internet-lecture', name: '인강 시청', slots: 1, fatigue: 4,
    effects: { academic: 1.5 }, moneyCost: 1, category: 'study',
    description: '인터넷 강의를 듣는다.',
    flavor: '이어폰 끼고 인강을 튼다. 1.5배속으로 들으면 시간이 절약되지만, 졸릴 때도 있다.',
    tags: ['효율적', '저렴', '졸릴 수 있음'],
    requires: (s) => s.money >= 1,
  },
  {
    id: 'reading', name: '독서', slots: 1, fatigue: 2,
    effects: { academic: 0.5, talent: 0.5, mental: 1 }, moneyCost: 0, category: 'study',
    description: '책을 읽으며 여유를 즐긴다.',
    flavor: '좋아하는 책에 빠져든다. 공부는 아니지만, 뭔가 머릿속이 넓어지는 기분.',
    tags: ['여유', '멘탈 회복', '다재다능'],
  },
  {
    id: 'library', name: '도서관 자습', slots: 1, fatigue: 3,
    effects: { academic: 1, mental: 0.5 }, moneyCost: 0, category: 'study',
    description: '조용한 도서관에서 공부한다.',
    flavor: '도서관 자습실에 앉았다. 옆 사람이 열심히 하는 걸 보면 나도 집중이 된다.',
    tags: ['무료', '집중', '안정적'],
  },
  // === 운동 계열 ===
  {
    id: 'light-exercise', name: '가벼운 운동', slots: 1, fatigue: 2,
    effects: { health: 1.5, mental: 1 }, moneyCost: 0, category: 'exercise',
    description: '산책, 조깅 등으로 기분 전환.',
    flavor: '동네 한 바퀴를 뛴다. 바람이 시원하다. 머리가 맑아지는 느낌.',
    tags: ['가벼움', '기분 전환', '멘탈 회복'],
  },
  {
    id: 'school-sports', name: '학교 체육부', slots: 1, fatigue: 9,
    effects: { health: 2.5, talent: 1, social: 0.5 }, moneyCost: 0, category: 'exercise',
    description: '방과후 체육부 활동.',
    flavor: '운동장에서 땀을 흘린다. 힘들지만, 같이 뛰는 애들이 있으니 버틸 만하다.',
    tags: ['고효율', '고피로', '친구', '활동적'],
  },
  {
    id: 'gym', name: '헬스/PT', slots: 1, fatigue: 7,
    effects: { health: 2, mental: 0.5 }, moneyCost: 2, category: 'exercise',
    description: '체계적으로 운동한다.',
    flavor: '트레이너가 자세를 잡아준다. 근육이 아프지만 뿌듯하다.',
    tags: ['체계적', '비용 있음', '성장 확실'],
    requires: (s) => s.money >= 2,
  },
  // === 관계 계열 ===
  {
    id: 'hang-out', name: '친구와 놀기', slots: 1, fatigue: 3,
    effects: { social: 2, mental: 2 }, moneyCost: 1, category: 'social',
    description: '친구와 즐거운 시간을 보낸다.',
    flavor: '같이 웃고 떠들다 보면 시간이 훌쩍 간다. 이런 시간이 필요했어.',
    tags: ['즐거움', '멘탈 회복', '추억'],
  },
  {
    id: 'sns-activity', name: 'SNS 활동', slots: 1, fatigue: 2,
    effects: { social: 1, mental: -1 }, moneyCost: 0, category: 'social',
    description: '온라인에서 친구들과 소통한다.',
    flavor: '피드를 넘기다 보니 한 시간이 지났다. 재밌긴 한데... 좀 허무하다.',
    tags: ['간편', '인기 상승', '멘탈 주의'],
  },
  {
    id: 'club', name: '동아리 활동', slots: 1, fatigue: 4,
    effects: { social: 1, talent: 1, mental: 0.5 }, moneyCost: 0, category: 'social',
    description: '동아리에서 활동한다.',
    flavor: '같은 취미를 가진 사람들과 함께하는 시간. 학교에서 가장 좋아하는 시간.',
    tags: ['취미', '친구', '특기 성장'],
  },
  // === 자기계발 계열 ===
  {
    id: 'art-lesson', name: '예체능 레슨', slots: 1, fatigue: 6,
    effects: { talent: 1.7 }, moneyCost: 2, category: 'talent', // v6.4: 2→1.7
    description: '음악/미술/체육 레슨을 받는다.',
    flavor: '선생님의 지도를 받으며 실력을 갈고닦는다. 느리지만 확실히 늘고 있다.',
    tags: ['전문적', '비용 있음', '특기 집중'],
    requires: (s) => s.money >= 2,
  },
  {
    id: 'creative', name: '창작 활동', slots: 1, fatigue: 3,
    effects: { talent: 1.2, mental: 1 }, moneyCost: 0, category: 'talent', // v6.4: 1.5→1.2
    description: '글쓰기, 그림, 작곡 등에 몰두한다.',
    flavor: '좋아하는 것에 빠져들면 시간 가는 줄 모른다. 이게 나만의 세계.',
    tags: ['자유', '멘탈 회복', '표현'],
  },
  {
    id: 'coding', name: '코딩 독학', slots: 1, fatigue: 5,
    effects: { academic: 0.5, talent: 1.5 }, moneyCost: 0, category: 'talent',
    description: '프로그래밍을 독학한다.',
    flavor: '코드가 돌아가는 순간의 쾌감. 에러가 나면 답답하지만, 그것도 배움이다.',
    tags: ['미래형', '논리적', '성취감'],
  },
  {
    id: 'volunteer', name: '봉사 활동', slots: 1, fatigue: 4,
    effects: { social: 1.5, mental: 1 }, moneyCost: 0, category: 'social',
    description: '봉사활동에 참여한다.',
    flavor: '누군가를 돕고 나면 마음이 따뜻해진다. 생기부에도 좋다.',
    tags: ['따뜻함', '생기부', '보람'],
  },
  // === 휴식 계열 ===
  {
    id: 'rest', name: '휴식', slots: 1, fatigue: -12,
    effects: { mental: 2, health: 1 }, moneyCost: 0, category: 'rest',
    description: '아무것도 안 하고 푹 쉰다.',
    flavor: '이불 속에서 뒹굴거린다. 아무 생각 없이. 가끔은 이런 시간이 필요해.',
    tags: ['회복', '피로 해소', '여유'],
  },
  {
    id: 'deep-rest', name: '푹 쉬기', slots: 2, fatigue: -25,
    effects: { mental: 5, health: 2 }, moneyCost: 0, category: 'rest',
    description: '주말 전체를 휴식에 쓴다.',
    flavor: '토요일부터 일요일까지 완전히 쉬었다. 세상이 다르게 보인다.',
    tags: ['완전 회복', '2슬롯', '리셋'],
  },
  {
    id: 'gaming', name: '게임/영상', slots: 1, fatigue: -5,
    effects: { mental: 1 }, moneyCost: 0, category: 'rest',
    description: '게임하거나 영상을 본다.',
    flavor: '좋아하는 게임을 하거나 유튜브를 본다. 생산적이진 않지만... 행복하다.',
    tags: ['가벼운 휴식', '즐거움'],
  },
  {
    id: 'park-walk', name: '공원 산책', slots: 1, fatigue: -1,
    effects: { mental: 1.5, health: 0.5 }, moneyCost: 0, category: 'rest',
    description: '공원에서 여유롭게 산책한다.',
    flavor: '벤치에 앉아 하늘을 올려다본다. 바람이 좋다. 생각이 정리되는 느낌.',
    tags: ['산책', '여유', '체력 미세 회복'],
  },
  // === 부모 전용 ===
  {
    id: 'study-with-parent', name: '부모와 같이 공부', slots: 1, fatigue: 3,
    effects: { academic: 1.5, mental: 0.5 }, moneyCost: 0, category: 'parent',
    description: '부모님과 함께 공부한다.',
    flavor: '"이거 이렇게 풀면 되지 않아?" 엄마가 옆에서 알려준다. 느리지만 든든하다.',
    tags: ['안정적', '무료', '따뜻함'],
    requires: (s) => s.parents.includes('emotional'),
  },
  {
    id: 'family-dinner', name: '가족 저녁시간', slots: 1, fatigue: -2,
    effects: { mental: 2 }, moneyCost: 0, category: 'parent',
    description: '가족과 따뜻한 저녁 시간을 보낸다.',
    flavor: '"오늘 학교 어땠어?" 밥을 먹으며 이야기한다. 별거 아닌데 마음이 편해진다.',
    tags: ['피로 회복', '가족', '멘탈 회복'],
    requires: (s) => s.parents.includes('emotional'),
  },
  // === 알바 ===
  {
    id: 'part-time', name: '편의점 알바', slots: 1, fatigue: 9,
    effects: { social: 0.5, mental: -1 }, moneyCost: -3,
    category: 'work',
    description: '편의점에서 일하며 돈을 번다.',
    flavor: '"어서오세요~" 반복되는 인사. 힘들지만 통장 잔고가 올라가는 건 뿌듯하다.',
    tags: ['수입', '고피로', '자립'],
  },
];

export function getAvailableActivities(state: GameState, forVacation = false): Activity[] {
  return ACTIVITIES.filter(a => {
    if (a.category === 'parent' && a.requires && !a.requires(state)) return false;
    if (a.category === 'work' && state.year < 4) return false;
    if (a.id === 'deep-rest' && !forVacation) return true;
    return true;
  });
}
