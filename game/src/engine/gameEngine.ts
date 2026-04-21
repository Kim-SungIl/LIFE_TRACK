import { GameState, Stats, StatKey, ParentStrength, WeekLog } from './types';
import { ACTIVITIES } from './activities';
import { getEventForWeek } from './events';
import { generateExamResult, generateMockExamResult, generateSuneungResult } from './examSystem';
import { ExamType } from './types';

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
  if (parents.includes('strict')) { stats.academic += 5; stats.mental -= 3; }
  if (parents.includes('wealth')) { /* 용돈으로 반영 */ }

  let money = 3; // 기본 용돈 3만원
  if (parents.includes('wealth')) money = 8;
  if (parents.includes('freedom')) money = 3;

  return {
    week: 1,
    year: 1,
    phase: 'weekday',
    track: null,
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
      { id: 'subin', name: '수빈', intimacy: 25, description: '같은 동네에 사는 같은 학원 친구', emoji: '😊', met: false,
        greeting: '어, 안녕! 너도 김쌤 반이야? 숙제 진짜 많지 않아?', personality: '어디서든 금방 친해지는 외향형. 친구가 많아 보이지만 어느 그룹에서든 "같이 어울리는 애" 포지션. 엄마와 둘이 산다.' },
      { id: 'minjae', name: '민재', intimacy: 15, description: '공부를 잘하는데 티를 안 내는 아이', emoji: '😎', met: false,
        greeting: '어, 안녕. 시험공부 했어? 나 하나도 안 했는데.', personality: '전교 1등이지만 천재가 아니라 노력형. 새벽까지 공부하고 아침에 태연한 척하는 아이. 학원 원장 엄마와 교사 아빠 밑에서 자란 교육 가정.' },
      { id: 'yuna', name: '유나', intimacy: 20, description: '밝고 활발한 같은 반 친구', emoji: '🌟', met: false,
        greeting: '야! 오늘 숙제 했어? 나 7번 모르겠는데 같이 풀자!', personality: '성적은 항상 상위권인데 공부벌레 느낌은 아니다. 밝고 에너지 넘치는 성격. 피아노도 잘 치고 친구도 잘 사귄다. 근데 그 밝음 뒤에는 1등을 놓치면 안 된다는 압박이 있다.' },
      { id: 'haeun', name: '하은', intimacy: 0, description: '1학년 위 선배', emoji: '🌿', met: false,
        greeting: '야, 존댓말 하지 마. 어색해.', personality: '중학교 2학년 선배. 겉으로는 여유 있어 보이지만, 고등학교 진학과 오빠의 수능 실패 트라우마로 속은 불안하다. 후배를 챙기면서 자기 자신을 다독이는 사람.' },
      { id: 'junha', name: '준하', intimacy: 0, description: '고2에 전학 온 부산 출신', emoji: '🍙', met: false,
        greeting: '안녕하세요... 아 안녕. (어색하게 웃는다)', personality: '부산에서 전학 온 직설적인 남자아이. 원래 밝고 사람을 좋아하는 성격인데 전학이 눌러놓고 있다. 요리를 좋아하고 주먹밥을 싸온다. 엄마가 식당에서 일한다.' },
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
    idleWeeks: 0,
    consecutiveTiredWeeks: 0,
    burnoutCooldown: 0,
    eventTimeCost: 0,
    unlockedEvents: [],
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

// ===== 구간 감쇠 (v6.4: 50~60 소폭 하향) =====
function getDiminishingReturn(value: number): number {
  if (value < 30) return 1.0;
  if (value < 50) return 0.8;
  if (value < 60) return 0.50;   // v6.4: 0.55→0.50
  if (value < 70) return 0.35;
  if (value < 85) return 0.18;   // v6.3: 0.35→0.18
  if (value < 95) return 0.08;   // v6.3: 0.18→0.08
  return 0.03;
}

// ===== 멘탈 회복 감쇠 =====
function getMentalRecoveryRate(mental: number): number {
  if (mental < 70) return 1.0;
  if (mental < 80) return 0.8;
  if (mental < 90) return 0.55;
  return 0.3;
}

// ===== 피로 보정 (v6: 60+/80+ 구간 강화) =====
function getFatigueModifier(fatigue: number): number {
  if (fatigue < 20) return 1.0;
  if (fatigue < 40) return 0.9;
  if (fatigue < 60) return 0.75;
  if (fatigue < 80) return 0.5;
  if (fatigue < 90) return 0.3;
  return 0.2;   // v6: 90+ 극한 피로시 효율 대폭 하락
}

// ===== 루틴 보너스 (v6.2: 12주 캡 — 영원히 쌓이는 문제 해결) =====
function getRoutineBonus(weeks: number): number {
  const capped = Math.min(weeks, 12); // 12주 이후 추가 보너스 없음
  if (capped >= 8) return 0.3;   // v6.1: 0.5 → 0.3 (+30%)
  if (capped >= 6) return 0.2;
  if (capped >= 3) return 0.1;
  return 0;
}

// ===== 활동 적용 =====
function applyActivity(state: GameState, activityId: string, log: WeekLog, routineBonus = 0, efficiency = 1.0): void {
  const activity = ACTIVITIES.find(a => a.id === activityId);
  if (!activity) return;

  const fatiguemod = getFatigueModifier(state.fatigue);
  // v6.4: 만성 피로 누적 패널티 (잠깐은 가볍게, 오래되면 심각하게)
  let tiredPenalty = 0.8;  // 기본 피로 배율
  const ctw = state.consecutiveTiredWeeks || 0;
  if (ctw >= 16) tiredPenalty = 0.4;       // 만성: 거의 성장 불가
  else if (ctw >= 8) tiredPenalty = 0.6;   // 장기: 루틴 재고 필요
  const mentalPenalty = state.mentalState === 'burnout' ? 0.2 : state.mentalState === 'tired' ? tiredPenalty : 1.0;

  // v5.3: 상점 버프 보너스 계산
  let buffBonus = 0;
  if (state.activeBuffs) {
    for (const buff of state.activeBuffs) {
      if (buff.target === 'all' || buff.target === activity.category) {
        buffBonus += buff.amount;
      }
    }
  }

  // v6: 동일 축 중복 스택 효율 감소 (같은 주에 같은 스탯을 여러 번 올리면 효율 하락)
  const statHitCount: Partial<Record<StatKey, number>> = {};

  // 각 스탯 성장 적용
  for (const [key, baseValue] of Object.entries(activity.effects)) {
    const statKey = key as StatKey;
    let value = baseValue as number;

    if (statKey === 'mental') {
      // 멘탈은 전용 감쇠
      value *= getMentalRecoveryRate(state.stats.mental);
      // v6.1: 무기력 3주+ 시 쉬기 계열 멘탈 회복 대폭 감소 (쉬어도 공허함)
      if ((state.idleWeeks || 0) >= 3 && activity.category === 'rest' && value > 0) {
        value *= 0.3;
      }
    } else if (value > 0) {
      // 양수 성장에만 감쇠 적용 + 멘탈 상태 패널티 + 버프/루틴 보너스
      value *= getDiminishingReturn(state.stats[statKey]) * fatiguemod * mentalPenalty * (1 + buffBonus + routineBonus) * efficiency;

      // v6.1: 동일 축 중복 효율 감소 — 3단계 (2회 70%, 3회+ 45%)
      const priorGain = log.statChanges[statKey] || 0;
      if (priorGain > 2) value *= 0.45;       // 3회째+ → 45%
      else if (priorGain > 0.5) value *= 0.7;  // 2회째 → 70%

      // v5.2: 무료 활동 soft cap — 돈 안 드는 활동은 80+ 구간에서 급감
      if (activity.moneyCost === 0 && state.stats[statKey] >= 80) {
        value *= 0.1;
      }
    }

    // 최저 보장 — v6.2: 85+ 구간은 최저 보장 없음 (고구간은 진짜 어려워야 함)
    if (baseValue > 0 && state.stats[statKey] < 85 && value < baseValue * 0.1) {
      value = baseValue * 0.1;
    }

    // v6.2: 주당 스탯 성장 상한 (+2/주) — 활동값 하향과 함께 조정
    const weeklyGainSoFar = log.statChanges[statKey] || 0;
    if (statKey !== 'mental' && value > 0 && weeklyGainSoFar + value > 2) {
      value = Math.max(0, 2 - weeklyGainSoFar);
    }

    state.stats[statKey] = Math.max(0, Math.min(100, state.stats[statKey] + value));
    if (!log.statChanges[statKey]) log.statChanges[statKey] = 0;
    log.statChanges[statKey]! += value;
  }

  // 피로 적용
  let fatigueDelta = activity.fatigue;
  // v6.3: tired/burnout 중 활동 피로 감소 (tired 함정 방지)
  if (fatigueDelta > 0 && state.mentalState === 'burnout') {
    fatigueDelta = Math.round(fatigueDelta * 0.5);  // 번아웃: 50% 감소
  } else if (fatigueDelta > 0 && state.mentalState === 'tired') {
    fatigueDelta = Math.round(fatigueDelta * 0.75); // tired: 25% 감소
  }
  // v6.4: 체력 기반 피로 저항 (체력이 높으면 같은 활동도 덜 힘들다)
  if (fatigueDelta > 0) {
    if (state.stats.health >= 60) fatigueDelta = Math.max(1, fatigueDelta - 2);
    else if (state.stats.health >= 30) fatigueDelta = Math.max(1, fatigueDelta - 1);
  }
  // v5.2: 체력 < 20이면 피로 증가량 1.5배
  if (fatigueDelta > 0 && state.stats.health < 20) {
    fatigueDelta = Math.round(fatigueDelta * 1.5);
  }
  state.fatigue = Math.max(0, Math.min(100, state.fatigue + fatigueDelta));
  log.fatigueChange += fatigueDelta;

  // 용돈 적용 (음수 방지)
  state.money = Math.round((state.money - activity.moneyCost) * 10) / 10;
  if (state.money < 0) state.money = 0;
  log.moneyChange -= activity.moneyCost;

  log.messages.push(`${activity.name} 완료`);
}

// ===== 자연 감소 =====
// v5.1: 학년별 학업 감소 + 고학업 추가 감소 + 피로→멘탈 침식
function applyNaturalDecay(state: GameState, log: WeekLog, isVacation: boolean): void {
  // 학업: 학년별 자연 감소 (높을수록 유지 비용 증가) — v7: 감쇠 완화로 85+ 달성 가능하게
  // 초등(Y1): 학기 -0.1 / 방학 -0.3
  // 중등(Y2~4): 학기 -0.15 / 방학 -0.4
  // 고등(Y5~7): 학기 -0.3 / 방학 -0.7
  let academicDecay = 0;
  if (state.year <= 1) {
    academicDecay = isVacation ? -0.3 : -0.1;
  } else if (state.year <= 4) {
    academicDecay = isVacation ? -0.4 : -0.15;
  } else {
    academicDecay = isVacation ? -0.7 : -0.3;
  }
  // 고학업 추가 감소: 95+ → -0.5 추가 (90+는 삭제 — 90대 진입 자체가 어려워지는 문제)
  if (state.stats.academic >= 95) academicDecay -= 0.5;

  state.stats.academic = Math.max(12, state.stats.academic + academicDecay); // v6.4: floor 12 (학교 다니는데 0은 과함)
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

  // 특기: -0.2/주 (v7: -0.3→-0.2로 완화 — talent 85 달성 가능하게)
  state.stats.talent = Math.max(5, state.stats.talent - 0.2);
  log.statChanges.talent = (log.statChanges.talent || 0) - 0.2;

  // 체력: -0.8/주 (학기 중 학교가 50% 상쇄, soft floor 10)
  let healthDecay = isVacation ? -0.8 : -0.4;
  if (state.stats.health <= 12) healthDecay = -0.1; // 바닥 근처 완화
  state.stats.health = Math.max(10, state.stats.health + healthDecay);
  log.statChanges.health = (log.statChanges.health || 0) + healthDecay;

  // v5.2: 체력 < 20 패널티 — 허약 → 피로 증가량 1.5배 (applyActivity에서 적용)
  // (체력 패널티는 getFatigueModifier 계열에서 처리)

  // v6.2: 멘탈 자연감소 강화 (멘탈이 자원이 되도록)
  if (state.stats.mental >= 90) {
    state.stats.mental -= 4;
    log.statChanges.mental = (log.statChanges.mental || 0) - 4;
  } else if (state.stats.mental >= 80) {
    state.stats.mental -= 2;
    log.statChanges.mental = (log.statChanges.mental || 0) - 2;
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

  // v6: 고피로 90+ → 체력 자연 감소 (무리하면 몸이 망가짐)
  if (state.fatigue >= 90) {
    state.stats.health = Math.max(5, state.stats.health - 1);
    log.statChanges.health = (log.statChanges.health || 0) - 1;
    if (!log.messages.some(m => m.includes('체력'))) {
      log.messages.push('⚠️ 피로가 극한이라 몸이 약해지고 있다...');
    }
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
  // v6.2: tired 진입 — 기존 조건 OR 피로 85+ 단독 (피로 100인데 안 지치는 문제 해결)
  if (state.mentalState === 'normal' && (
    (state.stats.mental < 40 && state.fatigue > 45) || state.fatigue >= 85
  )) {
    state.mentalState = 'tired';
    log.messages.push('⚠️ 피로 상태 진입 — "요즘 뭘 해도 재미없다..."');
  }
  // burnout 진입: tired + 멘탈 < 20 또는 멘탈 < 25 + 피로 > 70
  // 단, 번아웃 쿨다운 중이면 재진입 차단 (데스 스파이럴 방지)
  else if (state.mentalState === 'tired' && (state.stats.mental < 20 || (state.stats.mental < 25 && state.fatigue > 70))) {
    if ((state.burnoutCooldown || 0) > 0) {
      // 쿨다운 중 — 번아웃 대신 tired 유지, 멘탈 소폭 회복 (면역 효과)
      state.stats.mental = Math.min(100, state.stats.mental + 2);
      log.statChanges.mental = (log.statChanges.mental || 0) + 2;
      log.messages.push('😮‍💨 한계 직전이지만, 간신히 버텼다.');
    } else {
      state.mentalState = 'burnout';
      state.burnoutCount++;
      state.routineWeeks = 0;
      log.messages.push('🔥 번아웃! — "...더 이상 못하겠다"');
    }
  }
  // 회복: tired → normal
  else if (state.mentalState === 'tired' && state.stats.mental >= 50 && state.fatigue < 40) {
    state.mentalState = 'normal';
    log.messages.push('✨ 회복! — 다시 일상으로 돌아왔다.');
  }
  // burnout → tired (회복 시작)
  else if (state.mentalState === 'burnout' && state.stats.mental >= 20 && state.fatigue < 40) {
    state.mentalState = 'tired';
    state.burnoutCooldown = 4; // 번아웃 회복 후 4주 면역
    log.messages.push('💪 번아웃에서 벗어나는 중...');
  }

  // 쿨다운 틱다운
  if ((state.burnoutCooldown || 0) > 0 && state.mentalState !== 'burnout') {
    state.burnoutCooldown = Math.max(0, (state.burnoutCooldown || 0) - 1);
  }

  // v6.4: 연속 피로 주수 카운터
  if (state.mentalState === 'tired' || state.mentalState === 'burnout') {
    state.consecutiveTiredWeeks = (state.consecutiveTiredWeeks || 0) + 1;
  } else {
    state.consecutiveTiredWeeks = 0;
  }

  // v6.4: tired 자동 회복 강화 — 피로 -5 (만성화 방지)
  if (state.mentalState === 'tired') {
    state.fatigue = Math.max(0, state.fatigue - 5);
    state.stats.mental = Math.min(100, state.stats.mental + 1);
    log.fatigueChange -= 5;
    log.statChanges.mental = (log.statChanges.mental || 0) + 1;
  }

  // v6.1: 번아웃 자동 회복 — 강화 (활동 피로를 이길 수 있는 수준)
  if (state.mentalState === 'burnout') {
    state.fatigue = Math.max(0, state.fatigue - 12);
    state.stats.mental = Math.min(100, state.stats.mental + 4);
    log.fatigueChange -= 12;
    log.statChanges.mental = (log.statChanges.mental || 0) + 4;
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
  if (newState.consecutiveTiredWeeks == null) newState.consecutiveTiredWeeks = 0;
  if (newState.burnoutCooldown == null) newState.burnoutCooldown = 0;
  if (newState.eventTimeCost == null) newState.eventTimeCost = 0;
  if (!newState.unlockedEvents) newState.unlockedEvents = [];

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
  // 이벤트 시간 소모: 1=슬롯3 스킵, 2=둘 다 스킵
  const timeCost = newState.eventTimeCost || 0;
  if (timeCost > 0) {
    const skipMsg = timeCost >= 2 ? '📅 이벤트 때문에 이번 주 방과후 활동을 다 빠졌다.' : '📅 이벤트 때문에 이번 주 방과후 활동 하나를 빠졌다.';
    log.messages.push(skipMsg);
    newState.eventTimeCost = 0;
  }
  if (!newState.isVacation) {
    const rBonus = getRoutineBonus(newState.routineWeeks);
    // timeCost 2: 둘 다 스킵, timeCost 1: 슬롯2는 실행 + 슬롯3 스킵
    if (newState.routineSlot2 && timeCost < 2) {
      const r2 = ACTIVITIES.find(a => a.id === newState.routineSlot2);
      if (r2 && (r2.moneyCost <= 0 || newState.money >= r2.moneyCost)) {
        applyActivity(newState, newState.routineSlot2, log, rBonus);
        newState.routineWeeks++;
      } else {
        log.messages.push(`💰 돈이 부족해서 ${r2?.name || '활동'}을 못 했다...`);
      }
    }
    if (newState.routineSlot3 && timeCost < 1) {
      const r3 = ACTIVITIES.find(a => a.id === newState.routineSlot3);
      if (r3 && (r3.moneyCost <= 0 || newState.money >= r3.moneyCost)) {
        applyActivity(newState, newState.routineSlot3, log, rBonus);
      } else {
        log.messages.push(`💰 돈이 부족해서 ${r3?.name || '활동'}을 못 했다...`);
      }
    }
    // timeCost로 스킵해도 routineWeeks는 유지 (습관은 남아있음)
    if (timeCost >= 2 && newState.routineSlot2) newState.routineWeeks++;
  }

  // 4. 주말/방학 선택 활동 — 돈 부족하면 스킵, timeCost로 슬롯 감소
  const rawChoices = newState.isVacation ? newState.vacationChoices : newState.weekendChoices;
  // timeCost: 뒤에서부터 슬롯 제거 (1=마지막 1개 제거, 2=마지막 2개 제거)
  const choices = timeCost > 0 ? rawChoices.slice(0, Math.max(0, rawChoices.length - timeCost)) : rawChoices;
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

  // 9. 용돈 지급 — 생활비 차감 (v6)
  let weeklyMoney = 3;
  if (newState.parents.includes('wealth')) weeklyMoney = 8;
  // v6: 생활비 자동 차감 (교통비, 간식, 잡비)
  const livingCost = newState.parents.includes('wealth') ? 2.5 : 1.2;
  const netMoney = Math.round((weeklyMoney - livingCost) * 10) / 10;
  newState.money = Math.round((newState.money + netMoney) * 10) / 10;
  log.moneyChange += netMoney;

  // 10. 방치 무기력 체크 (v6: 3주 연속 비생산적 활동 시 멘탈/소셜 감소)
  const productiveActivities = [...(newState.isVacation ? newState.vacationChoices : newState.weekendChoices)];
  if (newState.routineSlot2) productiveActivities.push(newState.routineSlot2);
  if (newState.routineSlot3) productiveActivities.push(newState.routineSlot3);
  const restOnlyIds = ['rest', 'deep-rest', 'gaming', 'park-walk'];
  const isRestOnly = productiveActivities.length === 0 || productiveActivities.every(id => restOnlyIds.includes(id));
  if (isRestOnly) {
    newState.idleWeeks = (newState.idleWeeks || 0) + 1;
  } else {
    newState.idleWeeks = 0;
  }
  if ((newState.idleWeeks || 0) >= 3) {
    newState.stats.mental = Math.max(0, newState.stats.mental - 2);
    newState.stats.social = Math.max(5, newState.stats.social - 1);
    log.statChanges.mental = (log.statChanges.mental || 0) - 2;
    log.statChanges.social = (log.statChanges.social || 0) - 1;
    log.messages.push('😶 무기력... 뭔가 해야 할 것 같은데, 아무것도 하기 싫다.');
  }

  // 스탯 범위 보정
  for (const key of Object.keys(newState.stats) as StatKey[]) {
    newState.stats[key] = Math.max(0, Math.min(100, Math.round(newState.stats[key] * 10) / 10));
  }
  newState.fatigue = Math.max(0, Math.min(100, Math.round(newState.fatigue * 10) / 10));

  newState.weekLog = log;
  newState.totalWeeksPlayed++;

  // 10. 시험 체크 (학교급별 차등)
  // 초등(Y1): W17 단원평가, W38 단원평가
  // 중등(Y2~Y4): W8 중간, W17 기말, W30 중간, W38 기말
  // 고등(Y5~Y7): 내신 W8/W17/W30/W38 + 모의 W12/W33 + Y7 W35 수능
  const isY7 = newState.year === 7;
  let examSchedule: Record<number, ExamType> = {};

  if (newState.year <= 1) {
    // 초등: 학기말 단원평가만
    examSchedule = { 17: 'unit-test', 38: 'unit-test' };
  } else if (newState.year <= 4) {
    // 중등: 중간+기말
    examSchedule = { 8: 'midterm', 17: 'final', 30: 'midterm', 38: 'final' };
  } else if (isY7) {
    // 고3: 내신 + 모의 + 수능
    examSchedule = { 8: 'midterm', 12: 'mock', 17: 'final', 30: 'midterm', 33: 'mock', 35: 'suneung' };
  } else {
    // 고1~2: 내신 + 모의
    examSchedule = { 8: 'midterm', 12: 'mock', 17: 'final', 30: 'midterm', 33: 'mock', 38: 'final' };
  }

  const thisWeekExam = examSchedule[newState.week];
  if (thisWeekExam) {
    let examResult;
    let examName: string;

    if (thisWeekExam === 'suneung') {
      examResult = generateSuneungResult(newState);
      examName = '수능';
    } else if (thisWeekExam === 'mock') {
      examResult = generateMockExamResult(newState);
      examName = '모의고사';
    } else {
      examResult = generateExamResult(newState, thisWeekExam);
      examName = thisWeekExam === 'unit-test' ? '단원평가'
        : thisWeekExam === 'midterm' ? '중간고사' : '기말고사';
    }

    newState.examResults.push(examResult);
    newState.currentExamResult = examResult;
    log.examResult = examResult;
    log.messages.push(`📝 ${examName} 결과 발표!`);

    // 시험 결과 멘탈 후처리
    if (examResult.mentalDelta) {
      newState.stats.mental = Math.max(0, Math.min(100, newState.stats.mental + examResult.mentalDelta));
      if (examResult.mentalDelta > 0) {
        log.messages.push(`시험 결과에 기분이 좋아졌다! (멘탈 +${examResult.mentalDelta})`);
      } else if (examResult.mentalDelta < 0) {
        log.messages.push(`시험 결과에 기분이 가라앉았다... (멘탈 ${examResult.mentalDelta})`);
      }
    }
  } else {
    newState.currentExamResult = null;
    log.examResult = null;
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
// ===== 진로 판정 =====
// 수능 등급 + 문이과 + 특기를 기반으로 "진로" 결정
function determineCareer(state: GameState): { path: string; detail: string } {
  const suneung = state.examResults.find(e => e.examType === 'suneung');
  const mockGrade = suneung?.mockGrade ?? 9; // 수능 없으면 9등급 취급
  const { academic, talent, mental } = state.stats;
  const track = state.track;

  // 예체능 특기자 최우선 체크 (수능 등급과 무관하게 talent 우위이면 특기자 루트)
  // academic 낮아도 특기로 대학 가는 실제 진로 반영
  if (talent >= 85) {
    if (talent >= 90) return { path: '예술/체육 특기자', detail: '특기로 명문 예술대학·체대에 진학했다.' };
    if (academic < 70) return { path: '예체능 진학', detail: '특기를 살려 예체능 계열 대학에 진학했다.' };
    // talent 85~89 + academic 70+ → 특기 + 학업 균형 → 아래 일반 진로 로직에서 +α
  }

  // 번아웃 심각 or 멘탈 붕괴 → 방황
  if (state.burnoutCount >= 4 || mental < 20) {
    return { path: '재수 결심', detail: '올해는 결과가 좋지 않았다. 1년 더 해보기로 했다.' };
  }

  // 수능 7등급 이하 — 입시 실패 루트
  if (mockGrade >= 7) {
    if (state.burnoutCount >= 2) return { path: '잠시 쉼표', detail: '대학보다 자신을 돌보는 게 먼저였다.' };
    return { path: '전문대 / 재수', detail: '원하는 곳은 못 갔다. 다른 길을 찾아야 한다.' };
  }

  // 문과 진로
  if (track === 'humanities') {
    if (mockGrade <= 1) {
      if (academic >= 85 && mental >= 50) return { path: 'SKY 경영대 합격', detail: '전국 수석권. 원하는 대학 어디든 갈 수 있다.' };
      return { path: 'SKY 인문대 합격', detail: '오랜 노력의 결실. 명문대 합격 통지서를 받았다.' };
    }
    if (mockGrade === 2) return { path: '인서울 상위권 대학', detail: '중앙대·경희대 수준의 문과 상위권에 합격했다.' };
    if (mockGrade === 3) return { path: '인서울 문과', detail: '인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.' };
    if (mockGrade === 4) return { path: '수도권 대학', detail: '수도권 4년제에 합격. 이제 본격적인 시작이다.' };
    return { path: '지방 국립대', detail: '지방 국립대 문과에 합격했다. 길은 여기서부터다.' };
  }

  // 이과 진로
  if (track === 'science') {
    if (mockGrade <= 1) {
      if (academic >= 88) return { path: '의대 합격', detail: '최고의 성적. 의과대학 합격 통지서를 받았다.' };
      return { path: 'SKY 공대 합격', detail: '최상위권 공대에 합격. 공학도의 길이 시작된다.' };
    }
    if (mockGrade === 2) return { path: '인서울 상위권 공대', detail: '한양·성균관 수준 공대에 합격했다.' };
    if (mockGrade === 3) return { path: '인서울 이과', detail: '인서울 4년제 이공계에 합격했다.' };
    if (mockGrade === 4) return { path: '수도권 이공계', detail: '수도권 이공계 대학에 합격했다.' };
    return { path: '지방 국립대 이공계', detail: '지방 국립대 이공계에 합격했다. 길은 여기서부터다.' };
  }

  // track 미선택(Y5~Y6 조기 종료) fallback
  if (mockGrade <= 2) return { path: '상위권 대학', detail: '좋은 성적으로 상위권 대학에 합격했다.' };
  if (mockGrade <= 4) return { path: '인서울 대학', detail: '인서울 대학에 합격했다.' };
  return { path: '대학 진학', detail: '대학에 합격했다. 이제 새로운 시작이다.' };
}

// ===== 주요 NPC 근황 =====
function getTopNpcStories(state: GameState, limit = 2): string[] {
  const sorted = [...state.npcs]
    .filter(n => n.met && n.intimacy >= 50)
    .sort((a, b) => b.intimacy - a.intimacy)
    .slice(0, limit);

  const stories: string[] = [];
  for (const npc of sorted) {
    if (npc.intimacy >= 85) stories.push(`${npc.name}와는 지금도 가장 친한 친구다.`);
    else if (npc.intimacy >= 70) stories.push(`${npc.name}와는 종종 연락한다. 좋은 기억으로 남아 있다.`);
    else stories.push(`${npc.name}와는 가끔 생각나는 사이다.`);
  }
  return stories;
}

export function calculateEnding(state: GameState) {
  const { academic, social, talent, mental, health } = state.stats;
  const total = academic + social + talent + mental + health;

  // 성취 3축
  const academicScore = academic;
  const talentScore = talent;
  const lifeScore = (mental + health + social) / 3;

  const bestAxis = Math.max(academicScore, talentScore, lifeScore);
  let achievement = 'C';
  if (bestAxis >= 85) achievement = 'S';
  else if (bestAxis >= 70) achievement = 'A';
  else if (bestAxis >= 50) achievement = 'B';
  else if (bestAxis >= 30) achievement = 'C';
  else achievement = 'D';

  const allStats = [academic, social, talent, mental, health];
  const hasCollapse = allStats.some(v => v < 10);
  const hasWeakness = allStats.some(v => v < 20);
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

  // 진로 판정
  const career = determineCareer(state);
  const suneung = state.examResults.find(e => e.examType === 'suneung');
  const suneungGrade = suneung?.mockGrade ?? null;

  // NPC 근황
  const npcStories = getTopNpcStories(state);

  // 엔딩 타이틀 (진로 기반 + 성취/행복으로 수식)
  let title = career.path;
  let description = career.detail;

  // 특수 조합 — 진로 덮어쓰기
  if (achievement === 'S' && happiness === 'S' && suneungGrade && suneungGrade <= 2) {
    title = `완벽한 청춘 — ${career.path}`;
    description = '성적도, 관계도, 모든 것이 빛나는 학창시절이었다. ' + career.detail;
  } else if (achievement === 'S' && happiness === 'D' && suneungGrade && suneungGrade <= 2) {
    title = `고독한 승리자 — ${career.path}`;
    description = '성적은 최고였지만, 돌아보면 곁에 아무도 없었다. ' + career.detail;
  } else if (state.burnoutCount >= 3 && suneungGrade && suneungGrade <= 4) {
    title = `불꽃은 꺼지지 않는다 — ${career.path}`;
    description = '몇 번이고 쓰러졌지만, 그래도 일어났다. ' + career.detail;
  } else if (happiness === 'S' && achievement === 'C') {
    title = `행복한 평범함 — ${career.path}`;
    description = '성적은 평범했지만, 웃음이 가득한 학창시절이었다. ' + career.detail;
  }

  return {
    title,
    description,
    achievement,
    happiness,
    total,
    career: career.path,
    careerDetail: career.detail,
    suneungGrade,
    npcStories,
  };
}
