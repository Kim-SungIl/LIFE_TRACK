import { GameState, Stats, StatKey, ParentStrength, WeekLog } from './types';
import { ACTIVITIES } from './activities';
import { getEventForWeek } from './events';

// ===== 초기 상태 생성 =====
export function createInitialState(gender: 'male' | 'female', parents: [ParentStrength, ParentStrength]): GameState {
  const stats: Stats = {
    academic: 30,
    social: 25,
    talent: 15,
    mental: 50,
    health: 40,
  };

  // 부모 보정
  if (parents.includes('emotional')) stats.mental += 10;
  if (parents.includes('gene')) { stats.academic += 5; stats.health += 5; }
  if (parents.includes('strict')) { stats.academic += 5; stats.mental -= 5; }
  if (parents.includes('wealth')) { /* 용돈으로 반영 */ }

  let money = 3; // 기본 용돈 3만원
  if (parents.includes('wealth')) money = 8;
  if (parents.includes('freedom')) money = 3;

  return {
    week: 1,
    year: 1,
    phase: 'weekday',
    gender,
    stats,
    fatigue: 0,
    money,
    parents,
    mentalState: 'normal',
    routineSlot2: null,
    routineSlot3: null,
    routineWeeks: 0,
    weekendChoices: [],
    vacationChoices: [],
    semester: 1,
    isVacation: false,
    weekLog: null,
    npcs: [
      { id: 'jihun', name: '지훈', intimacy: 40, description: '초등학교 때부터 알던 소꿉친구', emoji: '😄', met: true,
        greeting: '야! 오늘도 같이 놀자!', personality: '활발하고 운동을 좋아하는 소꿉친구. 항상 먼저 말을 걸어준다.' },
      { id: 'subin', name: '수빈', intimacy: 25, description: '같은 동네, 같은 학원. 편한 사이', emoji: '😊', met: false,
        greeting: '어, 안녕! 오늘 학원 같이 갈래?', personality: '같은 동네에 살아서 자주 마주치는 친구. 차분하고 꼼꼼하다.' },
      { id: 'minjae', name: '민재', intimacy: 15, description: '같은 반의 활발한 아이', emoji: '😎', met: false,
        greeting: '헤이~ 뭐해? 심심한데 같이 뭐 하자!', personality: '에너지가 넘치고 친구가 많은 인싸. 처음 보는 사람한테도 스스럼없이 다가간다.' },
      { id: 'yuna', name: '유나', intimacy: 20, description: '조용하지만 성적이 좋은 반 친구', emoji: '📚', met: false,
        greeting: '안녕... 혹시 오늘 숙제 했어?', personality: '말수가 적지만 성적은 항상 상위권. 알고 보면 따뜻한 친구.' },
    ],
    events: [],
    currentEvent: null,
    milestones: [],
    burnoutCount: 0,
    totalWeeksPlayed: 0,
  };
}

// ===== 학기 구조 =====
function getWeekInfo(week: number) {
  // 1학기: W1~W19, 여름방학: W20~W24, 2학기: W25~W42, 겨울방학: W43~W48
  if (week <= 19) return { semester: 1 as const, isVacation: false, label: `1학기 ${week}주차` };
  if (week <= 24) return { semester: 1 as const, isVacation: true, label: `여름방학 ${week - 19}주차` };
  if (week <= 42) return { semester: 2 as const, isVacation: false, label: `2학기 ${week - 24}주차` };
  return { semester: 2 as const, isVacation: true, label: `겨울방학 ${week - 42}주차` };
}

export function getWeekLabel(state: GameState): string {
  const yearNames = ['초6', '중1', '중2', '중3', '고1', '고2', '고3'];
  const info = getWeekInfo(state.week);
  return `${yearNames[state.year - 1]} ${info.label}`;
}

export function getMonthLabel(week: number): string {
  // 대략적 매핑: W1=3월, W5=4월, W9=5월, ...
  const months = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7,
    7, 7, 8, 8, 8, // 여름방학
    9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12,
    1, 1, 1, 2, 2, 2]; // 겨울방학
  return `${months[week - 1] || 3}월`;
}

// ===== 구간 감쇠 =====
function getDiminishingReturn(value: number): number {
  if (value < 30) return 1.0;
  if (value < 50) return 1.0;
  if (value < 70) return 0.8;
  if (value < 85) return 0.5;
  if (value < 95) return 0.3;
  return 0.1;
}

// ===== 멘탈 회복 감쇠 =====
function getMentalRecoveryRate(mental: number): number {
  if (mental < 70) return 1.0;
  if (mental < 80) return 0.8;
  if (mental < 90) return 0.55;
  return 0.3;
}

// ===== 피로 보정 =====
function getFatigueModifier(fatigue: number): number {
  if (fatigue < 20) return 1.0;
  if (fatigue < 40) return 0.9;
  if (fatigue < 60) return 0.75;
  if (fatigue < 80) return 0.5;
  return 0.3;
}

// ===== 루틴 보너스 =====
function getRoutineBonus(weeks: number): number {
  if (weeks >= 8) return 2.0;
  if (weeks >= 6) return 1.5;
  if (weeks >= 3) return 1.0;
  return 0;
}

// ===== 활동 적용 =====
function applyActivity(state: GameState, activityId: string, log: WeekLog): void {
  const activity = ACTIVITIES.find(a => a.id === activityId);
  if (!activity) return;

  const fatiguemod = getFatigueModifier(state.fatigue);

  // 각 스탯 성장 적용
  for (const [key, baseValue] of Object.entries(activity.effects)) {
    const statKey = key as StatKey;
    let value = baseValue as number;

    if (statKey === 'mental') {
      // 멘탈은 전용 감쇠
      value *= getMentalRecoveryRate(state.stats.mental);
    } else if (value > 0) {
      // 양수 성장에만 감쇠 적용
      value *= getDiminishingReturn(state.stats[statKey]) * fatiguemod;
    }

    // 최저 보장 (양수 성장의 경우)
    if (baseValue > 0 && value < baseValue * 0.15) {
      value = baseValue * 0.15;
    }

    state.stats[statKey] = Math.max(0, Math.min(100, state.stats[statKey] + value));
    if (!log.statChanges[statKey]) log.statChanges[statKey] = 0;
    log.statChanges[statKey]! += value;
  }

  // 피로 적용
  const fatigueDelta = activity.fatigue;
  state.fatigue = Math.max(0, Math.min(100, state.fatigue + fatigueDelta));
  log.fatigueChange += fatigueDelta;

  // 용돈 적용
  state.money -= activity.moneyCost;
  log.moneyChange -= activity.moneyCost;

  log.messages.push(`${activity.name} 완료`);
}

// ===== 자연 감소 =====
function applyNaturalDecay(state: GameState, log: WeekLog, isVacation: boolean): void {
  // 학업: -0.5/주 (학기 중 학교수업이 상쇄)
  if (isVacation) {
    state.stats.academic = Math.max(0, state.stats.academic - 0.5);
    log.statChanges.academic = (log.statChanges.academic || 0) - 0.5;
  }

  // 인기: -1.0/주
  const socialDecay = -1.0;
  state.stats.social = Math.max(0, state.stats.social + socialDecay);
  log.statChanges.social = (log.statChanges.social || 0) + socialDecay;

  // 인기 50 미만: +0.3 (학기 중만)
  if (!isVacation && state.stats.social < 50) {
    state.stats.social = Math.min(100, state.stats.social + 0.3);
    log.statChanges.social = (log.statChanges.social || 0) + 0.3;
  }

  // 재능: -0.3/주
  state.stats.talent = Math.max(0, state.stats.talent - 0.3);
  log.statChanges.talent = (log.statChanges.talent || 0) - 0.3;

  // 체력: -0.8/주 (학기 중 학교가 50% 상쇄)
  const healthDecay = isVacation ? -0.8 : -0.4;
  state.stats.health = Math.max(0, state.stats.health + healthDecay);
  log.statChanges.health = (log.statChanges.health || 0) + healthDecay;

  // 멘탈 자연감소 (v4: 80+ 감소)
  if (state.stats.mental >= 90) {
    state.stats.mental -= 2;
    log.statChanges.mental = (log.statChanges.mental || 0) - 2;
  } else if (state.stats.mental >= 80) {
    state.stats.mental -= 1;
    log.statChanges.mental = (log.statChanges.mental || 0) - 1;
  }
}

// ===== 피로 자연 회복 =====
function applyFatigueRecovery(state: GameState, log: WeekLog): void {
  // 비례 회복: 15%, 최소 -3, 최대 -12
  let recovery = Math.max(3, Math.min(12, state.fatigue * 0.15));

  // 정서적 지지: +2 (멘탈 70+ 시 +1)
  if (state.parents.includes('emotional')) {
    recovery += state.stats.mental >= 70 ? 1 : 2;
  }

  // 방학 추가 회복
  if (state.isVacation) recovery += 2;

  state.fatigue = Math.max(0, state.fatigue - recovery);
  log.fatigueChange -= recovery;
}

// ===== 학교 수업 효과 (평일 자동) =====
function applySchoolClass(state: GameState, log: WeekLog): void {
  const academicGain = 1 * getDiminishingReturn(state.stats.academic) * getFatigueModifier(state.fatigue);
  state.stats.academic = Math.min(100, state.stats.academic + academicGain);
  log.statChanges.academic = (log.statChanges.academic || 0) + academicGain;
  state.fatigue = Math.min(100, state.fatigue + 2);
  log.fatigueChange += 2;
}

// ===== 마일스톤 체크 =====
function checkMilestones(state: GameState, log: WeekLog): void {
  const milestoneChecks: { id: string; stat: StatKey; threshold: number; message: string }[] = [
    { id: 'academic-30', stat: 'academic', threshold: 30, message: '"수업 내용이 들리기 시작했다"' },
    { id: 'academic-50', stat: 'academic', threshold: 50, message: '"중간권 진입 — 선생님이 이름을 기억하기 시작한다"' },
    { id: 'academic-70', stat: 'academic', threshold: 70, message: '"상위권 — 반에서 공부 잘하는 애로 인식된다"' },
    { id: 'academic-85', stat: 'academic', threshold: 85, message: '"전교 상위 5% — 부모님이 감동하신다"' },
    { id: 'social-30', stat: 'social', threshold: 30, message: '"아는 사람이 생겼다 — 급식 시간에 혼자 먹지 않게 됐다"' },
    { id: 'social-50', stat: 'social', threshold: 50, message: '"쉬는 시간의 인기인 — 누군가 항상 말을 건다"' },
    { id: 'social-70', stat: 'social', threshold: 70, message: '"반 대표급 — 학교 행사에서 이름이 불린다"' },
    { id: 'talent-30', stat: 'talent', threshold: 30, message: '"취미가 생겼다 — 좋아하는 걸 찾은 느낌"' },
    { id: 'talent-50', stat: 'talent', threshold: 50, message: '"교내 대회 출전 자격 — 선생님이 대회 참가를 권유한다"' },
    { id: 'talent-70', stat: 'talent', threshold: 70, message: '"학교 대표 — 교외 대회에 출전한다"' },
    { id: 'health-50', stat: 'health', threshold: 50, message: '"기본기 완성 — 체력장에서 중위권"' },
    { id: 'health-70', stat: 'health', threshold: 70, message: '"체력왕 — 체육대회에서 활약한다"' },
    { id: 'mental-70', stat: 'mental', threshold: 70, message: '"단단한 멘탈 — 웬만한 일에 흔들리지 않는다"' },
  ];

  for (const m of milestoneChecks) {
    if (!state.milestones.includes(m.id) && state.stats[m.stat] >= m.threshold) {
      state.milestones.push(m.id);
      log.milestone = m.message;
      log.messages.push(`마일스톤 달성! ${m.message}`);
    }
  }
}

// ===== 멘탈 상태 전환 =====
function checkMentalStateTransition(state: GameState, log: WeekLog): void {
  const prev = state.mentalState;

  if (state.mentalState === 'normal' && state.stats.mental < 30 && state.fatigue > 50) {
    state.mentalState = 'tired';
    log.messages.push('⚠️ 피로 상태 진입 — "요즘 뭘 해도 재미없다..."');
  } else if (state.mentalState === 'tired' && state.stats.mental < 15) {
    state.mentalState = 'burnout';
    state.burnoutCount++;
    log.messages.push('🔥 번아웃! — "...더 이상 못하겠다"');
  } else if (state.mentalState === 'tired' && state.stats.mental >= 50 && state.fatigue < 30) {
    state.mentalState = 'normal';
    log.messages.push('✨ 회복! — 다시 일상으로 돌아왔다.');
  } else if (state.mentalState === 'burnout' && state.stats.mental >= 20 && state.fatigue < 30) {
    state.mentalState = 'tired';
    log.messages.push('💪 번아웃에서 벗어나는 중...');
  }
}

// ===== NPC 친밀도 자연 감소 =====
function applyNpcDecay(state: GameState): void {
  for (const npc of state.npcs) {
    npc.intimacy = Math.max(0, npc.intimacy - 0.5);
  }
}

// NPC 친밀도 증가 (친구놀기 등)
function applyNpcBoost(state: GameState, activityIds: string[]): void {
  const socialActivities = ['hang-out', 'club', 'study-group'];
  const hasSocial = activityIds.some(id => socialActivities.includes(id));
  if (hasSocial && state.npcs.length > 0) {
    // 가장 친밀도가 높은 NPC에게 +2
    const sorted = [...state.npcs].sort((a, b) => b.intimacy - a.intimacy);
    sorted[0].intimacy = Math.min(100, sorted[0].intimacy + 2);
  }
}

// ===== 주간 처리 (메인 루프) =====
export function processWeek(state: GameState): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const info = getWeekInfo(newState.week);
  newState.semester = info.semester;
  newState.isVacation = info.isVacation;

  const log: WeekLog = {
    statChanges: {},
    fatigueChange: 0,
    moneyChange: 0,
    messages: [],
    milestone: null,
  };

  // 1. 피로 자연 회복
  applyFatigueRecovery(newState, log);

  // 2. 학교 수업 (학기 중만)
  if (!newState.isVacation) {
    applySchoolClass(newState, log);
  }

  // 3. 루틴 활동 (학기 중, 방과후)
  if (!newState.isVacation) {
    if (newState.routineSlot2) {
      applyActivity(newState, newState.routineSlot2, log);
      newState.routineWeeks++;
    }
    if (newState.routineSlot3) {
      applyActivity(newState, newState.routineSlot3, log);
    }
  }

  // 4. 주말/방학 선택 활동
  const choices = newState.isVacation ? newState.vacationChoices : newState.weekendChoices;
  const allActivities = [...choices];
  for (const choice of choices) {
    applyActivity(newState, choice, log);
  }

  // 루틴 활동도 포함
  if (newState.routineSlot2) allActivities.push(newState.routineSlot2);
  if (newState.routineSlot3) allActivities.push(newState.routineSlot3);

  // 5. 자연 감소
  applyNaturalDecay(newState, log, newState.isVacation);

  // 6. NPC
  applyNpcDecay(newState);
  applyNpcBoost(newState, allActivities);

  // 7. 멘탈 상태 전환
  checkMentalStateTransition(newState, log);

  // 8. 마일스톤
  checkMilestones(newState, log);

  // 9. 용돈 지급 (매주)
  let weeklyMoney = 3;
  if (newState.parents.includes('wealth')) weeklyMoney = 8;
  newState.money += weeklyMoney;
  log.moneyChange += weeklyMoney;

  // 스탯 범위 보정
  for (const key of Object.keys(newState.stats) as StatKey[]) {
    newState.stats[key] = Math.max(0, Math.min(100, Math.round(newState.stats[key] * 10) / 10));
  }
  newState.fatigue = Math.max(0, Math.min(100, Math.round(newState.fatigue * 10) / 10));

  newState.weekLog = log;
  newState.totalWeeksPlayed++;

  // 10. 이벤트 체크
  const event = getEventForWeek(newState);
  if (event) {
    newState.currentEvent = { ...event, week: newState.week };
    newState.phase = 'event';
  }

  // 주 진행
  newState.week++;
  if (newState.week > 48) {
    newState.week = 1;
    newState.year++;
    if (newState.year > 7) {
      newState.phase = 'ending';
    }
  }

  // 다음 주의 학기/방학 상태 업데이트
  const nextInfo = getWeekInfo(newState.week);
  newState.semester = nextInfo.semester;
  newState.isVacation = nextInfo.isVacation;

  // 선택 초기화
  newState.weekendChoices = [];
  newState.vacationChoices = [];

  return newState;
}

// ===== 엔딩 계산 =====
export function calculateEnding(state: GameState) {
  const { academic, social, talent, mental, health } = state.stats;
  const total = academic + social + talent + mental + health;

  // 성취 지수
  let achievement = 'C';
  if (academic >= 85 || talent >= 85) achievement = 'S';
  else if (academic >= 70 || talent >= 70) achievement = 'A';
  else if (academic >= 50 || talent >= 50) achievement = 'B';
  else if (academic >= 30) achievement = 'C';
  else achievement = 'D';

  // 행복 지수
  let happiness = 'C';
  if (mental >= 80 && social >= 60) happiness = 'S';
  else if (mental >= 60 && social >= 40) happiness = 'A';
  else if (mental >= 40) happiness = 'B';
  else if (mental >= 25) happiness = 'C';
  else happiness = 'D';

  // 엔딩 타이틀
  let title = '평범한 학창시절';
  let description = '특별할 것 없지만, 그래도 나쁘지 않은 7년이었다.';

  if (achievement === 'S' && happiness === 'S') {
    title = '완벽한 청춘';
    description = '성적도, 관계도, 모든 것이 빛나는 학창시절이었다.';
  } else if (achievement === 'S' && happiness <= 'C') {
    title = '고독한 승리자';
    description = '성적은 최고였지만, 돌아보면 곁에 아무도 없었다.';
  } else if (achievement <= 'C' && happiness === 'S') {
    title = '행복한 평범함';
    description = '성적은 평범했지만, 웃음이 가득한 학창시절이었다.';
  } else if (academic >= 85) {
    title = '공부의 신';
    description = '오직 공부만을 위한 7년. 그 끝에 무엇이 있을까.';
  } else if (talent >= 85) {
    title = '숨은 천재';
    description = '남들과 다른 길을 걸었다. 그리고 그 길이 맞았다.';
  } else if (social >= 85) {
    title = '인싸 of 인싸';
    description = '모두가 아는 이름. 하지만 진짜 친구는 몇 명일까.';
  } else if (state.burnoutCount >= 3) {
    title = '불꽃은 꺼지지 않는다';
    description = '몇 번이고 쓰러졌지만, 그래도 일어났다.';
  } else if (total >= 350) {
    title = '밸런스의 달인';
    description = '모든 것을 조금씩. 평범하지만 단단한 인생의 기반.';
  }

  return { title, description, achievement, happiness, total };
}
