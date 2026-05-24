import { GameEvent, GameState } from '../types';
import { seededRandom } from '../rng';
import { ANNUAL_EVENT_IDS } from '../memorySystem';
import { isExamPeriod } from '../examSystem';
import {
  FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS, HARD_CRISIS_IDS, SOFT_CRISIS_IDS,
} from './constants';
import { GAME_EVENTS } from './data';

// ===== 학교생활 랜덤 이벤트 풀 (매주 1개씩 발생) =====
const SCHOOL_LIFE_EVENTS: GameEvent[] = [
  {
    id: 'random-quiz', title: '깜짝 퀴즈!',
    description: '선생님이 갑자기 "자, 퀴즈 보자" 하셨다.\n교실이 술렁인다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '자신 있게 풀어본다', effects: { academic: 2, mental: 1 }, message: '대부분 맞혔다! 선생님이 "역시" 하며 웃으셨다.' },
      { text: '찍기의 신이 되어본다', effects: { academic: 1, mental: -1 }, message: '반은 맞고 반은 틀렸다. 아슬아슬했다.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'friend-snack', title: '간식 나눠먹기',
    description: '쉬는 시간에 민재가 편의점 봉지를 꺼냈다.\n"이거 먹을래? 아까 사 온 건데."',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    choices: [
      { text: '고맙게 받아 먹는다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '맛있다. 민재가 의외로 이런 건 잘 챙긴다.' },
      { text: '"괜찮아, 고마워" — 거절한다', effects: {}, message: '"그래? 알겠어." 민재가 담담하게 넘겼다.' },
    ],
    condition: (s) => {
      const minjae = s.npcs.find(n => n.id === 'minjae');
      return !s.isVacation && !!minjae?.met;
    },
  },
  {
    id: 'class-prank', title: '교실 장난',
    description: '수업 중에 뒤에서 종이 비행기가 날아왔다.\n선생님은 못 보신 것 같다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
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
    background: 'school_gate_{school}_rain',
    choices: [
      { text: '그냥 뛰어간다!', effects: { health: -1, mental: 1 }, message: '흠뻑 젖었지만 왠지 상쾌하다.' },
      { text: '편의점에서 우산을 산다', effects: {}, moneyEffect: -1, message: '편의점 비닐 우산. 어른이 된 기분.' },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'lost-eraser', title: '지우개의 행방',
    description: '시험 중에 지우개가 바닥에 떨어졌다.\n옆자리 아이가 자기 거를 반으로 잘라 준다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
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
    background: 'classroom_{school}_afternoon',
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
    background: 'classroom_{school}_afternoon',
    choices: [
      { text: '리더를 맡는다', effects: { social: 2, academic: 2, mental: -2 }, fatigueEffect: 3, message: '힘들지만 뿌듯하다. 조원들이 고마워했다.' },
      { text: '맡은 부분만 열심히 한다', effects: { academic: 2, mental: 1 }, message: '내 할 일은 끝냈다. 편하다.' },
      { text: '대충 한다...', effects: { social: -2 }, message: '조원들 눈치가 좀 그렇다...', },
    ],
    condition: (s) => !s.isVacation,
  },
  {
    id: 'sick-day', title: '컨디션 난조',
    description: '이불 속에서 눈을 떴는데 머리가 아프고 열이 나는 것 같다.\n"오늘 쉴까..."',
    location: 'home',
    background: 'bedroom_night',
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
    background: 'school_road_morning',
    condition: (s) => !s.isVacation,
    choices: [
      { text: '경찰서에 맡긴다', effects: { mental: 3 }, message: '착한 일 했다. 마음이 뿌듯하다.' },
      { text: '...주머니에 넣는다', effects: { mental: -2 }, moneyEffect: 1, message: '돈은 생겼는데 찝찝하다.' },
    ],
  },
  {
    id: 'pe-class-hero', title: '체육 시간의 영웅',
    description: '체육 시간에 피구를 하는데, 상대편 에이스가 공을 던졌다!',
    location: 'gym',
    background: 'gymnasium',
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
    background: 'cafe_study',
    speakers: ['subin'],
    // 시험 직전 주 또는 시험 주에만 발동 — "시험 기간이라 만석" 본문과 정합 (중·고만)
    condition: (s) => !s.isVacation && s.year >= 2
      && isExamPeriod(s.year, s.week)
      && !!s.npcs.find(n => n.id === 'subin')?.met,
    choices: [
      { text: '수빈이랑 같이 공부한다', effects: { academic: 2, social: 1 }, moneyEffect: -1,
        npcEffects: [{ npcId: 'subin', intimacyChange: 3 }],
        message: '수빈이랑 같이 하니까 집중이 잘 됐다. 모르는 거 서로 알려주면서.' },
      { text: '이어폰 끼고 혼자 집중한다', effects: { academic: 2, mental: 1 }, moneyEffect: -1, message: '나만의 시간. 효율적이었다. 수빈이가 살짝 아쉬운 표정을 지었다.' },
    ],
  },
  {
    id: 'social-media-drama', title: 'SNS 소동',
    description: '단톡방에서 누가 누구 험담을 했다가 들켰다.\n분위기가 험악해졌다.',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
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
    background: 'sunset_walk',
    condition: (s) => !s.isVacation,
    choices: [
      { text: '사진 찍고 잠시 앉아있는다', effects: { mental: 4 }, message: '아무 생각 없이 하늘을 봤다. 마음이 편해졌다.' },
      { text: '빨리 집에 간다 (할 일이 많아)', effects: { academic: 1 }, message: '집에 와서 공부를 시작했다. 하늘이 좀 아쉽다.' },
    ],
  },
  {
    id: 'music-discovery', title: '새로운 노래',
    description: '유튜브에서 우연히 들은 노래가 너무 좋다.\n반복 재생이 멈추지 않는다.',
    location: 'home',
    background: 'bedroom_night',
    choices: [
      { text: '공부하면서 계속 듣는다', effects: { mental: 2, talent: 1 }, message: '좋은 음악과 함께하니 공부도 즐겁다.' },
      { text: '친구에게 공유한다', effects: { social: 2, mental: 1 }, message: '"이거 들어봐!" 친구도 좋아했다. 취향이 통하는 건 기분 좋다.' },
    ],
  },
  {
    id: 'cleaning-duty', title: '청소 당번',
    description: '오늘 청소 당번이다.\n교실이 엉망이다...',
    location: 'classroom',
    background: 'classroom_{school}_afternoon',
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
    background: 'classroom_{school}_afternoon',
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
    background: 'school_road_morning',
    choices: [
      { text: '뛰어간다!!!', effects: { health: 1 }, fatigueEffect: 3, message: '겨우 수업 시작 전에 도착했다. 심장이 터질 것 같다.' },
      { text: '포기하고 천천히 간다', effects: { mental: -1 }, message: '선생님한테 혼났다. 오늘 하루가 우울하다.' },
    ],
    condition: (s) => s.fatigue >= 30 && !s.isVacation,
  },
];

// 고정 주차 이벤트 해결 후 followup 이벤트 가져오기 (주당 1회 제한)
// ANNUAL_EVENT_IDS에 등록된 후속(반장 선거 후속 등)은 매년 재발동 허용

export function getFollowupForWeek(state: GameState, excludeLocation?: string): GameEvent | null {
  return GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id)) &&
    // 같은 장소 이벤트 연쇄 방지 (농구→축구 같은 어색한 연결 차단)
    // DIRECT_SEQUEL_IDS는 자연스러운 직접 후속이라 같은 장소도 허용 (선거→결과 등)
    (!excludeLocation || e.location !== excludeLocation || DIRECT_SEQUEL_IDS.has(e.id))
  ) || null;
}

// 절대 주차 (학년 경계에서 음수가 안 나오도록) — 쿨다운 비교용
function weeksSince(state: GameState, prev: GameEvent): number {
  const curAbs = (state.year - 1) * 48 + state.week;
  const prevAbs = ((prev.year ?? state.year) - 1) * 48 + (prev.week ?? 0);
  return curAbs - prevAbs;
}

// conditional 이벤트 후보 필터링 — getEventForWeek 내부 + chain 픽(getConditionalForWeek)에서 공유
function pickConditionalCandidates(state: GameState): GameEvent[] {
  return GAME_EVENTS.filter(e =>
    !e.week &&
    e.condition &&
    e.condition(state) &&
    !FOLLOWUP_EVENT_IDS.has(e.id) &&
    !HARD_CRISIS_IDS.has(e.id) &&
    !SOFT_CRISIS_IDS.has(e.id) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 10)
  );
}

// E-2: 친밀도 도달형 자동 판별 — condition 함수 소스에서 npc.intimacy >= N 패턴 검사.
// 스토리 핵심 컷이라 일반 풀과 섞이지 않고 별도 풀로 우선 노출되도록 분리한다.
function isIntimacyMilestone(e: GameEvent): boolean {
  if (!e.condition) return false;
  return /\.intimacy\s*>=/.test(e.condition.toString());
}

// fixed/followup 이벤트 resolve 후 chain용 — conditional 이벤트 1개 추가 픽
// 같은 주(week+year)에 한 번만 호출되도록 호출자가 가드
export function getConditionalForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  if (candidates.length === 0) return null;

  // 친밀도 도달형 후보가 있으면 일반 풀과 섞지 않고 그중에서 무조건 1개 노출.
  // (도달형이 일반 이벤트와 1/N 경쟁해 묻히면 다음 노출까지 10주 쿨다운에 걸려 답답해진다.)
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length > 0) {
    return milestone[Math.floor(seededRandom(state) * milestone.length)];
  }

  // 일반 조건부 풀: 기존 동작 유지 (50% 게이트)
  if (seededRandom(state) < 0.5) {
    return candidates[Math.floor(seededRandom(state) * candidates.length)];
  }
  return null;
}

// 옵션 C: chain cap 초과 시 milestone-only 추가 픽용. 일반 조건부는 픽하지 않는다.
// 학년 한정 도달형(예: Y1 한정)이 학년 마감 직전에 발동 못 하고 사라지는 문제 완화.
export function getMilestoneForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length === 0) return null;
  return milestone[Math.floor(seededRandom(state) * milestone.length)];
}

// 이번 주에 발동할 이벤트 가져오기
export function getEventForWeek(state: GameState): GameEvent | null {
  // 0. 고정 주차 이벤트 최우선 (followup보다 먼저 — 이미 발동한 이벤트 제외)
  // 같은 주에 여러 fixed 이벤트가 매칭될 수 있음 (예: W37의 단원평가 + 유나생일).
  // NPC 이벤트(speakers 보유)는 보통 친밀도/met 같은 추가 조건이 붙어 더 희소하므로 우선.
  // 학교 일정 이벤트는 매년 발동하지만, NPC 생일/관계 이벤트는 한 번 놓치면 끝이라
  // 후자가 우선되도록 stable 정렬.
  const fixedCandidates = GAME_EVENTS.filter(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state)) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  const fixedEvent = fixedCandidates.find(e => (e.speakers?.length ?? 0) > 0) ?? fixedCandidates[0];
  if (fixedEvent) return fixedEvent;

  // 1. 후속 이벤트 체크 (100% 발동) — ANNUAL은 매년 재발동 허용
  const followup = GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  if (followup) return followup;

  // v1.2 (§4.3): 2. 하드 위기 — 연간 1회 가드 (state.hardCrisisYears)
  if (!state.hardCrisisYears.includes(state.year)) {
    const hardCrisis = GAME_EVENTS.find(e =>
      HARD_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (hardCrisis) {
      state.hardCrisisYears.push(state.year);
      return hardCrisis;
    }
  }

  // v1.2 (§4.3): 3. 소프트 위기 — 연간 2건 상한
  const softCrisisThisYear = state.events.filter(e =>
    e.year === state.year && SOFT_CRISIS_IDS.has(e.id)
  ).length;
  if (softCrisisThisYear < 2) {
    const softCrisis = GAME_EVENTS.find(e =>
      SOFT_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (softCrisis) return softCrisis;
  }

  // 4. 조건부 상태 이벤트 (피로/멘탈 등) — 50% 확률
  // 위기 ID는 위에서 이미 처리했으므로 중복 제거
  const conditionalEvents = pickConditionalCandidates(state);
  if (conditionalEvents.length > 0 && seededRandom(state) < 0.5) {
    return conditionalEvents[Math.floor(seededRandom(state) * conditionalEvents.length)];
  }

  // 5. 학교생활 랜덤 이벤트 — 70% 확률
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 6)
  );
  if (availableSchoolEvents.length > 0 && seededRandom(state) < 0.7) {
    return availableSchoolEvents[Math.floor(seededRandom(state) * availableSchoolEvents.length)];
  }

  return null;
}
