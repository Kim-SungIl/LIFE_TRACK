import { GameState, Stats, StatKey, ParentStrength, WeekLog } from './types';
import { ACTIVITIES } from './activities';
import { getEventForWeek } from './events';
import { generateExamResult } from './examSystem';

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
      { id: 'haeun', name: '하은', intimacy: 0, description: '2학기에 전학 온 새로운 친구', emoji: '🎨', met: false,
        greeting: '아, 안녕! 여기 아직 낯설어서... 잘 부탁해!', personality: '다른 도시에서 전학 온 아이. 낯선 환경에서도 주변의 재미를 찾아내는 감각파. 만들고 꾸미고 표현하는 걸 좋아한다.' },
    ],
    events: [],
    currentEvent: null,
    milestones: [],
    burnoutCount: 0,
    totalWeeksPlayed: 0,
    examResults: [],
    currentExamResult: null,
    activeBuffs: [],
    weekPurchases: {},
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
function applyActivity(state: GameState, activityId: string, log: WeekLog, routineBonus = 0): void {
  const activity = ACTIVITIES.find(a => a.id === activityId);
  if (!activity) return;

  const fatiguemod = getFatigueModifier(state.fatigue);
  // v5.1: tired/burnout 상태 성장 패널티
  const mentalPenalty = state.mentalState === 'burnout' ? 0.3 : state.mentalState === 'tired' ? 0.8 : 1.0;

  // v5.3: 상점 버프 보너스 계산
  let buffBonus = 0;
  if (state.activeBuffs) {
    for (const buff of state.activeBuffs) {
      if (buff.target === 'all' || buff.target === activity.category) {
        buffBonus += buff.amount;
      }
    }
  }

  // 각 스탯 성장 적용
  for (const [key, baseValue] of Object.entries(activity.effects)) {
    const statKey = key as StatKey;
    let value = baseValue as number;

    if (statKey === 'mental') {
      // 멘탈은 전용 감쇠
      value *= getMentalRecoveryRate(state.stats.mental);
    } else if (value > 0) {
      // 양수 성장에만 감쇠 적용 + 멘탈 상태 패널티 + 버프/루틴 보너스
      value *= getDiminishingReturn(state.stats[statKey]) * fatiguemod * mentalPenalty * (1 + buffBonus + routineBonus);

      // v5.2: 무료 활동 soft cap — 돈 안 드는 활동은 80+ 구간에서 급감
      // moneyCost === 0만 체크 (알바처럼 돈 버는 활동은 제외)
      if (activity.moneyCost === 0 && state.stats[statKey] >= 80) {
        value *= 0.1;
      }
    }

    // 최저 보장 (양수 성장의 경우)
    if (baseValue > 0 && value < baseValue * 0.15) {
      value = baseValue * 0.15;
    }

    state.stats[statKey] = Math.max(0, Math.min(100, state.stats[statKey] + value));
    if (!log.statChanges[statKey]) log.statChanges[statKey] = 0;
    log.statChanges[statKey]! += value;
  }

  // 피로 적용 (v5.2: 체력 < 20이면 피로 증가량 1.5배)
  let fatigueDelta = activity.fatigue;
  if (fatigueDelta > 0 && state.stats.health < 20) {
    fatigueDelta = Math.round(fatigueDelta * 1.5);
  }
  state.fatigue = Math.max(0, Math.min(100, state.fatigue + fatigueDelta));
  log.fatigueChange += fatigueDelta;

  // 용돈 적용 (음수 방지)
  state.money -= activity.moneyCost;
  if (state.money < 0) state.money = 0;
  log.moneyChange -= activity.moneyCost;

  log.messages.push(`${activity.name} 완료`);
}

// ===== 자연 감소 =====
// v5.1: 학년별 학업 감소 + 고학업 추가 감소 + 피로→멘탈 침식
function applyNaturalDecay(state: GameState, log: WeekLog, isVacation: boolean): void {
  // 학업: 학년별 자연 감소 (높을수록 유지 비용 증가)
  // 초등(Y1): 학기 0 / 방학 -0.3
  // 중등(Y2~4): 학기 -0.2 / 방학 -0.6
  // 고등(Y5~7): 학기 -0.4 / 방학 -1.0
  let academicDecay = 0;
  if (state.year <= 1) {
    academicDecay = isVacation ? -0.3 : 0;
  } else if (state.year <= 4) {
    academicDecay = isVacation ? -0.6 : -0.2;
  } else {
    academicDecay = isVacation ? -1.0 : -0.4;
  }
  // 고학업 추가 감소: 90+ → -0.5 추가, 95+ → -1.0 추가
  if (state.stats.academic >= 95) academicDecay -= 1.0;
  else if (state.stats.academic >= 90) academicDecay -= 0.5;

  state.stats.academic = Math.max(0, state.stats.academic + academicDecay);
  log.statChanges.academic = (log.statChanges.academic || 0) + academicDecay;

  // 인기: 감소 → 학기 중 회복 → floor 적용 (순서 중요)
  let socialChange = -1.0;
  if (state.stats.social <= 12) socialChange = -0.2; // 바닥 근처 감소 완화
  if (!isVacation && state.stats.social < 50) socialChange += 0.3; // 학기 중 미량 회복
  state.stats.social = Math.max(10, state.stats.social + socialChange); // floor 마지막에 적용
  log.statChanges.social = (log.statChanges.social || 0) + socialChange;

  // v5.2: 인기 < 20 패널티 — 사회적 고립 → 멘탈 추가 감소
  if (state.stats.social < 20) {
    const isolationDrain = -1.5;
    state.stats.mental = Math.max(0, state.stats.mental + isolationDrain);
    log.statChanges.mental = (log.statChanges.mental || 0) + isolationDrain;
  }

  // 특기: -0.3/주
  state.stats.talent = Math.max(0, state.stats.talent - 0.3);
  log.statChanges.talent = (log.statChanges.talent || 0) - 0.3;

  // 체력: -0.8/주 (학기 중 학교가 50% 상쇄, soft floor 10)
  let healthDecay = isVacation ? -0.8 : -0.4;
  if (state.stats.health <= 12) healthDecay = -0.1; // 바닥 근처 완화
  state.stats.health = Math.max(10, state.stats.health + healthDecay);
  log.statChanges.health = (log.statChanges.health || 0) + healthDecay;

  // v5.2: 체력 < 20 패널티 — 허약 → 피로 증가량 1.5배 (applyActivity에서 적용)
  // (체력 패널티는 getFatigueModifier 계열에서 처리)

  // 멘탈 자연감소 (v4: 80+ 감소)
  if (state.stats.mental >= 90) {
    state.stats.mental -= 2;
    log.statChanges.mental = (log.statChanges.mental || 0) - 2;
  } else if (state.stats.mental >= 80) {
    state.stats.mental -= 1;
    log.statChanges.mental = (log.statChanges.mental || 0) - 1;
  }

  // v5.1: 고피로 → 멘탈 침식 (피로가 높으면 멘탈이 추가 감소)
  let fatigueMentalDrain = 0;
  if (state.fatigue >= 80) fatigueMentalDrain = -4;
  else if (state.fatigue >= 60) fatigueMentalDrain = -2;
  else if (state.fatigue >= 40) fatigueMentalDrain = -1;
  if (fatigueMentalDrain < 0) {
    state.stats.mental = Math.max(0, state.stats.mental + fatigueMentalDrain);
    log.statChanges.mental = (log.statChanges.mental || 0) + fatigueMentalDrain;
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
// v5.1: 자동 학업 +1 → +0.3, 학년별 학업 유지 비용 도입
function applySchoolClass(state: GameState, log: WeekLog): void {
  // 학교 수업 기본 효과: +0.3 (기존 +1에서 대폭 하향)
  const baseGain = 0.3;
  const academicGain = baseGain * getDiminishingReturn(state.stats.academic) * getFatigueModifier(state.fatigue);
  state.stats.academic = Math.min(100, state.stats.academic + academicGain);
  log.statChanges.academic = (log.statChanges.academic || 0) + academicGain;
  state.fatigue = Math.min(100, state.fatigue + 2);
  log.fatigueChange += 2;
}

// ===== 마일스톤 체크 =====
function checkMilestones(state: GameState, log: WeekLog): void {
  const milestoneChecks: { id: string; stat: StatKey; threshold: number; message: string }[] = [
    // 초기값: academic 30, social 25, talent 15, mental 50, health 40
    // 마일스톤은 초기값보다 충분히 높은 곳에서 시작
    { id: 'academic-40', stat: 'academic', threshold: 40, message: '"수업 내용이 들리기 시작했다"' },
    { id: 'academic-55', stat: 'academic', threshold: 55, message: '"중간권 진입 — 선생님이 이름을 기억하기 시작한다"' },
    { id: 'academic-70', stat: 'academic', threshold: 70, message: '"상위권 — 반에서 공부 잘하는 애로 인식된다"' },
    { id: 'academic-85', stat: 'academic', threshold: 85, message: '"전교 상위 5% — 부모님이 감동하신다"' },
    { id: 'social-35', stat: 'social', threshold: 35, message: '"아는 사람이 생겼다 — 급식 시간에 혼자 먹지 않게 됐다"' },
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
      log.milestone = m.message; // 하위호환
      log.milestoneMessages.push(m.message);
    }
  }
}

// ===== 멘탈 상태 전환 =====
// v5.1: tired/burnout 조건 완화 + tired 효과 추가
function checkMentalStateTransition(state: GameState, log: WeekLog): void {
  // tired 진입: 멘탈 < 40 AND 피로 > 45 (기존: 멘탈 < 30, 피로 > 50)
  if (state.mentalState === 'normal' && state.stats.mental < 40 && state.fatigue > 45) {
    state.mentalState = 'tired';
    log.messages.push('⚠️ 피로 상태 진입 — "요즘 뭘 해도 재미없다..."');
  }
  // burnout 진입: tired + 멘탈 < 20 (기존: < 15), 또는 멘탈 < 25 + 피로 > 70
  else if (state.mentalState === 'tired' && (state.stats.mental < 20 || (state.stats.mental < 25 && state.fatigue > 70))) {
    state.mentalState = 'burnout';
    state.burnoutCount++;
    log.messages.push('🔥 번아웃! — "...더 이상 못하겠다"');
  }
  // 회복: tired → normal (멘탈 50+ AND 피로 < 30)
  else if (state.mentalState === 'tired' && state.stats.mental >= 50 && state.fatigue < 30) {
    state.mentalState = 'normal';
    log.messages.push('✨ 회복! — 다시 일상으로 돌아왔다.');
  }
  // burnout → tired (멘탈 25+ AND 피로 < 25)
  else if (state.mentalState === 'burnout' && state.stats.mental >= 25 && state.fatigue < 25) {
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
  const socialCount = activityIds.filter(id => socialActivities.includes(id)).length;
  if (socialCount > 0 && state.npcs.length > 0) {
    // 만난 NPC 전체에 소량 + 가장 친한 NPC에 추가
    const metNpcs = state.npcs.filter(n => n.met);
    for (const npc of metNpcs) {
      npc.intimacy = Math.min(100, npc.intimacy + 0.5 * socialCount);
    }
    // 가장 친한 NPC에게 추가 보너스
    if (metNpcs.length > 0) {
      const sorted = [...metNpcs].sort((a, b) => b.intimacy - a.intimacy);
      sorted[0].intimacy = Math.min(100, sorted[0].intimacy + 1 * socialCount);
    }
  }
}

// ===== 주간 처리 (메인 루프) =====
export function processWeek(state: GameState): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  // 구세이브 호환: 누락 필드 초기화
  if (!newState.examResults) newState.examResults = [];
  if (!newState.activeBuffs) newState.activeBuffs = [];
  if (!newState.weekPurchases) newState.weekPurchases = {};

  const info = getWeekInfo(newState.week);
  newState.semester = info.semester;
  newState.isVacation = info.isVacation;

  const log: WeekLog = {
    statChanges: {},
    fatigueChange: 0,
    moneyChange: 0,
    messages: [],
    milestone: null,
    milestoneMessages: [],
  };

  // 1. 피로 자연 회복
  applyFatigueRecovery(newState, log);

  // 2. 학교 수업 (학기 중만)
  if (!newState.isVacation) {
    applySchoolClass(newState, log);
  }

  // 3. 루틴 활동 (학기 중, 방과후) — 돈 부족하면 스킵 + 루틴 연속 보너스
  if (!newState.isVacation) {
    const rBonus = getRoutineBonus(newState.routineWeeks);
    if (newState.routineSlot2) {
      const r2 = ACTIVITIES.find(a => a.id === newState.routineSlot2);
      if (r2 && (r2.moneyCost <= 0 || newState.money >= r2.moneyCost)) {
        applyActivity(newState, newState.routineSlot2, log, rBonus);
        newState.routineWeeks++;
      } else {
        log.messages.push(`💰 돈이 부족해서 ${r2?.name || '활동'}을 못 했다...`);
        newState.routineWeeks = 0;
      }
    }
    if (newState.routineSlot3) {
      const r3 = ACTIVITIES.find(a => a.id === newState.routineSlot3);
      if (r3 && (r3.moneyCost <= 0 || newState.money >= r3.moneyCost)) {
        applyActivity(newState, newState.routineSlot3, log, rBonus);
      } else {
        log.messages.push(`💰 돈이 부족해서 ${r3?.name || '활동'}을 못 했다...`);
      }
    }
  }

  // 4. 주말/방학 선택 활동 — 돈 부족하면 스킵
  const choices = newState.isVacation ? newState.vacationChoices : newState.weekendChoices;
  const allActivities = [...choices];
  for (const choice of choices) {
    const act = ACTIVITIES.find(a => a.id === choice);
    if (act && act.moneyCost > 0 && newState.money < act.moneyCost) {
      log.messages.push(`💰 돈이 부족해서 ${act.name}을 못 했다...`);
      continue;
    }
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

  // 10. 시험 체크 (W8 1학기 중간, W17 1학기 기말, W30 2학기 중간, W38 2학기 기말)
  const examWeeks: Record<number, 'midterm' | 'final'> = { 8: 'midterm', 17: 'final', 30: 'midterm', 38: 'final' };
  if (examWeeks[newState.week]) {
    const examResult = generateExamResult(newState, examWeeks[newState.week]);
    newState.examResults.push(examResult);
    newState.currentExamResult = examResult;
    log.messages.push(`📝 ${examWeeks[newState.week] === 'midterm' ? '중간고사' : '기말고사'} 결과 발표!`);
  } else {
    newState.currentExamResult = null;
  }

  // 11. 이벤트 체크
  const event = getEventForWeek(newState);
  if (event) {
    newState.currentEvent = { ...event, week: newState.week };
    newState.phase = 'event';
  }

  // 12. 버프 틱다운 + 주간 구매 리셋
  if (newState.activeBuffs) {
    newState.activeBuffs = newState.activeBuffs
      .map(b => ({ ...b, remainingWeeks: b.remainingWeeks - 1 }))
      .filter(b => b.remainingWeeks > 0);
  }
  newState.weekPurchases = {};

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

  // v5.2: 성취 3축 평가 — 학업/특기/생활 중 최고축 기반 + 결함 체크
  // 학업 성취: 학업 중심
  const academicScore = academic;
  // 특기 성취: 특기 중심
  const talentScore = talent;
  // 생활 성취: 멘탈+체력+인기 평균
  const lifeScore = (mental + health + social) / 3;

  // 최고 축으로 기본 등급 결정
  const bestAxis = Math.max(academicScore, talentScore, lifeScore);
  let achievement = 'C';
  if (bestAxis >= 85) achievement = 'S';
  else if (bestAxis >= 70) achievement = 'A';
  else if (bestAxis >= 50) achievement = 'B';
  else if (bestAxis >= 30) achievement = 'C';
  else achievement = 'D';

  // 결함 체크: 핵심 스탯 중 20 미만이 있으면 S 불가, 10 미만이면 A도 불가
  const allStats = [academic, social, talent, mental, health];
  const hasCollapse = allStats.some(v => v < 10);      // 붕괴
  const hasWeakness = allStats.some(v => v < 20);       // 결함
  if (hasCollapse && achievement === 'A') achievement = 'B';
  if (hasWeakness && achievement === 'S') achievement = 'A';
  if (hasCollapse && achievement === 'S') achievement = 'B';

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
