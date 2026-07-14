import { Activity, GameState } from './types';

// 학년별 비용 차등 헬퍼 — 현실 고증 (초등 종합반 < 중등 입시 < 고등 단과)
// yearlyCost가 정의된 활동만 학년 차등, 그 외는 base moneyCost 그대로.
export function getActivityCost(activity: Pick<Activity, 'moneyCost' | 'yearlyCost'>, year: number): number {
  if (!activity.yearlyCost) return activity.moneyCost;
  const level = year <= 1 ? 'elementary' : year <= 4 ? 'middle' : 'high';
  return activity.yearlyCost[level] ?? activity.moneyCost;
}

// NPC 동행 선택이 열리는 활동(선택 시 친밀도 +3 부여) — SlotEditPopup·activityHints 공용 SSOT.
// category와 무관: study-group은 category 'study'지만 동행 활동이고, 같은 social이라도 sns 등은 동행 아님.
export const NPC_COMPANION_ACTIVITIES: string[] = ['hang-out', 'club', 'study-group'];

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
    // 학원에서 친구들과 어울리는 부수효과 — 비싼 만큼 social 보너스
    effects: { academic: 1.5, social: 0.4 }, moneyCost: 3, category: 'study',
    // 현실 고증 — 초등 종합반 2만 / 중등 입시 3만 / 고등 단과 4만
    yearlyCost: { elementary: 2, middle: 3, high: 4 },
    description: '학원에서 체계적으로 배운다.',
    vacationDescription: '학원에서 방학 단기특강을 듣는다.',
    flavor: '학원 셔틀을 타고 간다. 같은 반 친구들이랑 떡볶이 먹고 가는 길도 즐겁다.',
    tags: ['체계적', '비용 있음', '고효율', '친구'],
    requires: (s) => s.money >= getActivityCost({ moneyCost: 3, yearlyCost: { elementary: 2, middle: 3, high: 4 } }, s.year),
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
    // QA C7-A: 고비용 학업 활동 — 돈 sink. 누적된 용돈을 학업 효율로 환원.
    // 유료라 applyActivity 의 "무료활동 80+ ×0.1" 캡을 면제받아 고구간에서 독학보다 효과적이되,
    // getDiminishingReturn·effectiveAcademic 소프트캡은 그대로 적용 → 돈으로 효율을 사는 것이지
    // 캡(수능 천장)을 우회하지 않음. wealth 부모(넉넉한 용돈)가 비로소 실질 어드밴티지가 됨.
    // QA C7-B: 고1(Y5)부터로 확대 + 비용 15→28. 이전엔 돈이 너무 흔해(791 적립) 비-wealth도 다 사서
    //   wealth 차별성이 없었다. 비용을 올려 고3 과외를 wealth만 매주 감당 → 돈 드레인 + 학업 격차 발생.
    id: 'private-tutoring', name: '집중 과외', slots: 1, fatigue: 9,
    effects: { academic: 2.5 }, moneyCost: 28, category: 'study',
    requires: (s) => s.year >= 5 && s.money >= 28,
    unlockYear: 5,
    description: '입시 전문 과외 선생님과 1:1로 약점을 짚는다.',
    flavor: '시간당 비싸지만 밀도가 다르다. 모르는 걸 그 자리에서 메운다. 다만 통장은 빠르게 가벼워진다.',
    tags: ['고3', '학업', '고효율', '고비용'],
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
    effects: { talent: 2.0 }, moneyCost: 2, category: 'talent',
    description: '음악/미술/체육 레슨을 받는다.',
    flavor: '선생님의 지도를 받으며 실력을 갈고닦는다. 느리지만 확실히 늘고 있다.',
    tags: ['전문적', '비용 있음', '특기 집중'],
    requires: (s) => s.money >= 2,
  },
  {
    id: 'creative', name: '창작 활동', slots: 1, fatigue: 3,
    effects: { talent: 1.5, mental: 1 }, moneyCost: 0, category: 'talent',
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
    id: 'rest', name: '휴식', slots: 1, fatigue: -10,
    effects: { mental: 2, health: 1 }, moneyCost: 0, category: 'rest',
    description: '아무것도 안 하고 푹 쉰다.',
    flavor: '이불 속에서 뒹굴거린다. 아무 생각 없이. 가끔은 이런 시간이 필요해.',
    tags: ['회복', '피로 해소', '여유'],
  },
  {
    id: 'deep-rest', name: '푹 쉬기', slots: 2, fatigue: -22,
    effects: { mental: 5, health: 2 }, moneyCost: 0, category: 'rest',
    description: '푹 쉬어 완전히 회복한다.',
    flavor: '방해 없이 온전히 쉴 수 있는 시간. 평소엔 짓눌리던 게 풀린다.',
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
    parentEffect: { baseDelta: 0.6, tag: 'familyTime' },
    description: '부모님과 함께 공부한다.',
    flavor: '"이거 이렇게 풀면 되지 않아?" 엄마가 옆에서 알려준다. 느리지만 든든하다.',
    tags: ['안정적', '무료', '따뜻함'],
    requires: (s) => s.parents.includes('emotional'),
  },
  {
    id: 'family-dinner', name: '가족 저녁시간', slots: 1, fatigue: -2,
    effects: { mental: 2 }, moneyCost: 0, category: 'parent',
    parentEffect: { baseDelta: 0.5, tag: 'familyTime' },
    description: '가족과 따뜻한 저녁 시간을 보낸다.',
    flavor: '"오늘 학교 어땠어?" 밥을 먹으며 이야기한다. 별거 아닌데 마음이 편해진다.',
    tags: ['피로 회복', '가족', '멘탈 회복'],
    // 게이트 해제 — 비-emotional 가정도 부모와 시간을 보낼 수 있어야 함 (emotional은 familyTime 1.4배)
  },
  // === 알바 ===
  {
    id: 'part-time', name: '편의점 알바', slots: 1, fatigue: 9,
    effects: { social: 0.5, mental: -1 }, moneyCost: -3,
    // 학년 올라갈수록 시급 인상 (Y4 중3 -3만, Y5~7 고등 -4만 — 약 33% 인상)
    yearlyCost: { middle: -3, high: -4 },
    // Phase 4B: "자립"은 자기주도(autonomyChoice) 신호 — freedom 1.4배(환영)·strict 0.6배(못마땅)로 강점별 반응이 갈린다.
    //           freedom 절정의 일반 트리거 도달 경로를 미니이벤트 외에 하나 더 확보(게임체크 항목4).
    parentEffect: { baseDelta: 0.4, tag: 'autonomyChoice' },
    category: 'work',
    requires: (s) => s.year >= 4, // short-term-job과 일관 — 현재 category 게이트(year<4)와 이중이나, 향후 category 조건 변경 시 Y1~3 노출 방어
    unlockYear: 4,
    description: '편의점에서 일하며 돈을 번다.',
    flavor: '"어서오세요~" 반복되는 인사. 힘들지만 통장 잔고가 올라가는 건 뿌듯하다.',
    tags: ['수입', '고피로', '자립'],
  },

  // ===== Phase 1: 방학 전용 활동 9종 =====
  // 무료 4개 (가난한 가정 보장)
  {
    id: 'vacation-library',
    name: '방학 도서관 몰입', slots: 2, fatigue: 3,
    effects: { academic: 3, mental: 1 }, moneyCost: 0,
    category: 'study',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    description: '도서관에서 종일 자습한다.',
    flavor: '에어컨 시원한 자리, 교재 한 권. 방학에만 가능한 호흡.',
    tags: ['방학', '학업', '무료'],
  },
  {
    id: 'creative-project',
    name: '장기 창작 프로젝트', slots: 2, fatigue: 5,
    effects: { talent: 3, mental: 1 }, moneyCost: 0,
    category: 'talent',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'talent', threshold: 50, bonus: 0.5 },
    description: '시간이 필요한 작품을 끝까지 밀어붙인다.',
    flavor: '학기 중에는 시작도 못 하던 일. 방학에만 가능한 깊이.',
    tags: ['방학', '재능', '몰입', '무료'],
  },
  {
    id: 'countryside',
    name: '시골/할머니댁', slots: 3, fatigue: -15,
    effects: { mental: 5, health: 3 }, moneyCost: 0,
    category: 'rest',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    description: '시골 친척집에서 며칠을 보낸다.',
    flavor: '평상에 누우면 바람 소리만 들린다. 도시에서 잊고 있던 박자.',
    tags: ['방학', '회복', '추억', '무료', '1회'],
  },

  // 저비용 사회성 1개
  {
    id: 'neighborhood-hangout',
    name: '동네 친구와 보내는 방학', slots: 1, fatigue: 3,
    effects: { social: 2, mental: 1 }, moneyCost: 0,
    category: 'social',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'social', threshold: 50, bonus: 0.5 },
    description: '동네에서 친구들과 시간을 보낸다.',
    flavor: '특별한 일 없이도, 방학이라 보낼 수 있는 시간.',
    tags: ['방학', '관계', '무료'],
  },

  // 유료 3개
  {
    id: 'intensive-academy',
    name: '학원 단기특강', slots: 2, fatigue: 12,
    effects: { academic: 4 }, moneyCost: 5,
    category: 'study',
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    description: '방학 한정 단기특강에 집중 등록한다.',
    flavor: '하루 8시간 강의실. 학기 학원과는 다른 밀도.',
    tags: ['방학', '학업', '집중', '유료'],
  },
  {
    id: 'sports-camp',
    name: '스포츠 캠프', slots: 3, fatigue: 8,
    effects: { health: 5, talent: 2, social: 2 }, moneyCost: 5,
    category: 'exercise',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    catchupBonus: { targetStat: 'health', threshold: 50, bonus: 0.5 },
    description: '며칠간 합숙 스포츠 캠프에 참가한다.',
    flavor: '아침 구보, 낮 훈련, 저녁 라면. 캠프 끝나면 다리가 후들거린다.',
    tags: ['방학', '체력', '관계', '유료', '1회'],
  },
  {
    id: 'family-trip',
    name: '가족 여행', slots: 3, fatigue: -8,
    effects: { mental: 6, social: 2, health: 1 }, moneyCost: 8,
    parentEffect: { baseDelta: 1.5, tag: 'familyTime' },
    category: 'parent',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    description: '가족과 함께 여행을 다녀온다.',
    flavor: '낯선 도시의 호텔 침대. 평소엔 안 하던 대화가 자연스러워진다.',
    tags: ['방학', '가족', '추억', '유료', '1회'],
  },

  // 알바 1개 (Y4+)
  // moneyCost 컨벤션: 양수 = 비용 / 음수 = 수입 (gameEngine.ts:281 state.money - cost)
  // 따라서 +8만 수입을 표현하려면 moneyCost: -8
  {
    id: 'short-term-job',
    name: '방학 단기 일손 돕기', slots: 2, fatigue: 12,
    effects: { social: 1 }, moneyCost: -8,
    yearlyCost: { middle: -6, high: -8 },
    category: 'work',
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    requires: (s) => s.year >= 4,
    unlockYear: 4,
    description: '며칠짜리 단기 일자리. 손에 쥐는 돈은 평소보다 크다.',
    flavor: '어른들 사이에서 종일 일했다. 시급은 짜지만 그래도 내 손으로 번 돈.',
    tags: ['방학', '수입', '자립', 'Y4+'],
  },
];

/**
 * 2슬롯 이상 활동이 같은 id로 인접 슬롯에 중복 저장된 배열을, 한 인스턴스 = 한 항목으로 collapse.
 *
 * UI(슬롯 인덱스 = 배열 인덱스)와 엔진(applyActivity 인스턴스당 1회) 사이의 변환 레이어.
 * 사용 안 하면 가족 여행(2칸 -8만원)이 -16만원으로 차감되는 등 데이터 표기와 실제가 어긋남.
 *
 * 꼬리 잘림(timeCost로 2칸 활동의 마지막 칸이 잘린 케이스)은 push만 하고 skip 없음 → 1회만 적용.
 *
 * 예시:
 *   [countryside, countryside, study-group] → [countryside, study-group]
 *   [intensive, intensive, intensive, intensive] → [intensive, intensive] (인스턴스 2개)
 *   [trip, trip] timeCost=1 후 [trip] → [trip] (꼬리 잘림 1회만)
 */
export function collapseActivityChoices(ids: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id) continue;
    const act = ACTIVITIES.find(a => a.id === id);
    if (!act) continue;
    result.push(id);
    if (act.slots >= 2) {
      let skip = 0;
      for (let k = 1; k < act.slots && ids[i + k] === id; k++) skip++;
      i += skip;
    }
  }
  return result;
}

// 활동의 vacationLimit 도달 여부
// pendingUse: 이번 주 계획에 이미 배치된 인스턴스 수 — UI(슬롯 편집)에서 같은 주 중복 배치가
// 엔진 스킵으로 이어지지 않도록 합산 판정. 엔진 경로(canApplyActivity)는 적용마다 카운트가
// 갱신되므로 0 그대로.
export function isVacationLimitReached(activity: Activity, state: GameState, pendingUse = 0): boolean {
  if (!activity.vacationLimit || !state.isVacation) return false;
  const used = (state.vacationActivityCounts?.[activity.id] ?? 0) + pendingUse;
  return used >= activity.vacationLimit;
}

// 활동 게이트 공통 판정 — UI 목록(getAvailableActivities)과 엔진 검증(canApplyActivity)이 공유하는 SSOT.
function passesActivityGates(a: Activity, state: GameState): boolean {
  if (a.category === 'work' && state.year < 4) return false;
  // Phase 1: 학기/방학 게이팅
  if (a.seasonGate === 'vacation-only' && !state.isVacation) return false;
  if (a.seasonGate === 'semester-only' && state.isVacation) return false;
  // requires 함수 (방학 알바 등 추가 조건)
  if (a.requires && !a.requires(state)) return false;
  return true;
}

export function getAvailableActivities(state: GameState): Activity[] {
  return ACTIVITIES.filter(a => passesActivityGates(a, state));
}

// 엔진 진입점 단일 검증 — UI를 안 거치는 호출자(sim 하니스, 세이브 변조, 스테일 루틴,
// 향후 다른 UI)가 학년/학기/방학횟수 게이트를 우회해 활동을 적용하는 것을 막는다.
// 밸런스 수치 무변경 — 판정만. (vacationLimit은 UI에선 목록에 남겨 비활성 표시하므로
// getAvailableActivities가 아니라 여기서만 합산 판정한다)
export function canApplyActivity(state: GameState, activityId: string): boolean {
  const a = ACTIVITIES.find(x => x.id === activityId);
  if (!a) return false;
  return passesActivityGates(a, state) && !isVacationLimitReached(a, state);
}
