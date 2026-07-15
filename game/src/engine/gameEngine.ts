import { GameState, Stats, StatKey, ParentStrength, WeekLog } from './types';
import { ACTIVITIES, getActivityCost, collapseActivityChoices, canApplyActivity } from './activities';
import { getSchoolLevel } from './backgrounds';
import { getEventForWeek } from './events';
import { generateExamResult, generateMockExamResult, generateSuneungResult, getExamSchedule } from './examSystem';
import { seededRandom, hashInitialState, deriveTalkSeed } from './rng';
import { recordMilestoneForYear } from './memorySystem';
import { getParentMods } from './parentModifiers';
import { applyParentIntimacyDelta, applyParentMeanReversion, examParentEffect } from './parentIntimacy';
import { migrateLoadedState } from './stateMigration';
import { cloneGameState } from './stateClone';
import { absWeek } from './relationshipSignals';

// rng utility re-export (하위 호환)
export { seededRandom, hashInitialState } from './rng';

// 시험 스케줄 SSOT는 examSystem.ts로 이동 (events.ts circular import 회피)

// ===== 초기 상태 생성 =====
export function createInitialState(
  gender: 'male' | 'female',
  parents: [ParentStrength, ParentStrength],
  options?: { useReducedRecovery?: boolean; rngSeed?: number },
): GameState {
  const stats: Stats = {
    academic: 30,
    social: 25,
    talent: 15,
    mental: 50,
    health: 40,
  };

  // 부모 보정 — 단일 셀렉터(parentModifiers)에서 일괄 산출
  const mods = getParentMods(parents);
  if (mods.initStatBonus.academic) stats.academic += mods.initStatBonus.academic;
  if (mods.initStatBonus.mental) stats.mental += mods.initStatBonus.mental;
  if (mods.initStatBonus.health) stats.health += mods.initStatBonus.health;
  const money = mods.weeklyIncome;
  // freedom의 별도 효과는 idle 페널티 완화 + 방학 슬롯 +1로 처리됨

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
    routineSlot2Weeks: 0,
    routineSlot3Weeks: 0,
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
      { id: 'doyun', name: '도윤', intimacy: 20, description: '초등 같은 반 체육부장', emoji: '⚽', met: false,
        greeting: '야! 점심에 축구 나갈래? 한 명 모자라!', personality: '반에서 모두가 따르는 자연스러운 리더. 축구 잘하고 예의 바르지만 찐따스럽지 않음. "괜찮아"를 입에 달고 사는 착한 아이 페르소나 — 부모 기대에 부응하느라 속마음 잘 안 보여줌. 중학교 진학 시 학군 이사로 갈라짐.' },
      { id: 'haeun', name: '하은', intimacy: 0, description: '1학년 위 선배', emoji: '🌿', met: false,
        greeting: '야, 존댓말 하지 마. 어색해.', personality: '중학교 2학년 선배. 겉으로는 여유 있어 보이지만, 고등학교 진학과 오빠의 수능 실패 트라우마로 속은 불안하다. 후배를 챙기면서 자기 자신을 다독이는 사람.' },
      { id: 'junha', name: '준하', intimacy: 0, description: '고2에 전학 온 부산 출신', emoji: '🍙', met: false,
        greeting: '안녕하세요... 아 안녕. (어색하게 웃는다)', personality: '부산에서 전학 온 직설적인 남자아이. 원래 밝고 사람을 좋아하는 성격인데 전학이 눌러놓고 있다. 요리를 좋아하고 주먹밥을 싸온다. 엄마가 식당에서 일한다.' },
      { id: 'seoa', name: '서아', intimacy: 0, description: '중학교 때 만난 글 쓰는 아이', emoji: '✏️', met: false,
        greeting: '…어. (한쪽 이어폰을 뺀다)', personality: '내성적인 글쟁이. 한쪽 이어폰=한 칸 열림 / 양쪽 다 낌=닫힘. 욕망을 숨기듯 글의 끝을 자꾸 미룬다. 읽어줄 한 사람이 생겨야 끝이 따라온다.' },
      { id: 'siwoo', name: '시우', intimacy: 0, description: '고1 때 만난 창밖만 보는 아이', emoji: '🏙️', met: false,
        greeting: '저거 봐. 저 자리.', personality: '건축을 꿈꾸는 관찰자. 감정을 사물·공간·동선으로만 비춘다. 밖을 향하던 시선의 소실점이 줄곧 한 사람이었다.' },
      { id: 'yerin', name: '예린', intimacy: 0, description: '고1 때 만난 입시 전략가', emoji: '📊', met: false,
        greeting: '너 단가, 아직 미산정이야.', personality: '효율의 언어로 사람을 장부·단가로 번역하는 입시 전략가. 모두를 등급으로 매기지만 주인공 줄만은 단가를 못 매겨 미산정으로 남긴다.' },
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
    totalTiredWeeks: 0,
    burnoutCooldown: 0,
    eventTimeCost: 0,
    // v1.2 기억 슬롯 시스템
    memorySlots: [],
    milestoneScenes: [],
    rngSeed: options?.rngSeed ?? hashInitialState({ gender, parents }),
    talkRngSeed: deriveTalkSeed(options?.rngSeed ?? hashInitialState({ gender, parents })),
    hardCrisisYears: [],
    // M6: 자연 회복 감소 모드 (도전 모드)
    useReducedRecovery: options?.useReducedRecovery ?? false,
    // Phase 2.1 말걸기 — 첫 주는 NPC/가정 둘 다 이벤트 보장 (첫 인상)
    talkEventPressure: 0,
    parentTalkPressure: 0,
    parentIntimacy: 50,
    talkEventsFired: [],
    npcEventPendingThisWeek: true,
    parentEventPendingThisWeek: true,
    parentEventsFired: [],
    parentPraiseYears: [],
    parentClimaxFired: [],
    parentPositiveTags: {},
  };
}

// ===== 학기 구조 =====
export function getWeekInfo(week: number) {
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

// ===== 구간 감쇠 (문서 §1-3 표 기준) =====
function getDiminishingReturn(value: number): number {
  if (value < 30) return 1.2;  // 0~29 초반 가속
  if (value < 50) return 1.0;  // 30~49 기본
  if (value < 70) return 0.8;  // 50~69
  if (value < 85) return 0.5;  // 70~84
  if (value < 95) return 0.3;  // 85~94
  return 0.1;                  // 95~100
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
  // v6.4 → v7.1: 만성 피로 누적 패널티 — 임계 늦춤 + 강도 완화
  // (Y1 W11~12에 ×0.6 발동되던 문제 해결)
  let tiredPenalty = 0.8;  // 기본 피로 배율
  const ctw = state.consecutiveTiredWeeks || 0;
  if (ctw >= 16) tiredPenalty = 0.5;        // 만성: 거의 성장 불가 (0.4 → 0.5)
  else if (ctw >= 10) tiredPenalty = 0.75;  // 장기: 루틴 재고 필요 (8주 → 10주, 0.6 → 0.75)
  const mentalPenalty = state.mentalState === 'burnout' ? 0.35 : state.mentalState === 'tired' ? tiredPenalty : 1.0;

  // v5.3: 상점 버프 보너스 계산
  let buffBonus = 0;
  if (state.activeBuffs) {
    for (const buff of state.activeBuffs) {
      if (buff.target === 'all' || buff.target === activity.category) {
        buffBonus += buff.amount;
      }
    }
  }

  // v7.2: 부모 강점 활동 효율 보너스 (parentModifiers SSOT)
  const pMods = getParentMods(state.parents);
  let parentEfficiencyBonus = 0;
  if (activity.category === 'study' && pMods.studyEfficiencyBonus > 0) {
    parentEfficiencyBonus += pMods.studyEfficiencyBonus;
    if (!log.parentBonusesApplied?.some(b => b.parent === 'info')) {
      log.parentBonusesApplied?.push({ parent: 'info', what: '학원·자습 효율 +10%' });
    }
  }
  if (activity.category === 'exercise' && pMods.exerciseEfficiencyBonus > 0) {
    parentEfficiencyBonus += pMods.exerciseEfficiencyBonus;
    if (!log.parentBonusesApplied?.some(b => b.parent === 'resilience')) {
      log.parentBonusesApplied?.push({ parent: 'resilience', what: '운동 효율 +10%' });
    }
  }

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
      value *= getDiminishingReturn(state.stats[statKey]) * fatiguemod * mentalPenalty * (1 + buffBonus + routineBonus + parentEfficiencyBonus) * efficiency;

      // v6.1: 동일 축 중복 효율 감소 — 3단계 (2회 70%, 3회+ 45%)
      const priorGain = log.statChanges[statKey] || 0;
      if (priorGain > 2) value *= 0.45;       // 3회째+ → 45%
      else if (priorGain > 0.5) value *= 0.7;  // 2회째 → 70%

      // v5.2: 무료 활동 soft cap — 돈 안 드는 활동은 80+ 구간에서 급감
      if (getActivityCost(activity, state.year) === 0 && state.stats[statKey] >= 80) {
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

  // Phase 1: catch-up 보너스 — 방학에만 트리거, 낮은 스탯에 한정
  // 학교급별 발동선 차등: 초 25 / 중 35 / 고 50 (활동 데이터의 threshold는 high 기준 base로 둠)
  // 의도: Y1 시작 스탯 분포(30/25/15...)에서 모든 활동이 catchup 발동되어 "안전망"이 일반 부스트로
  // 변질되던 문제 해소. 진짜 뒤처진 학생만 보호하도록 발동선을 학교급에 맞춤.
  // v8.x: 초 30→25 / 중 40→35 추가 너프 — sim에서 Y1 5.30회/방학(임계 3 초과)으로 발동 빈도 과다.
  if (state.isVacation && activity.catchupBonus) {
    const cb = activity.catchupBonus;
    if (cb.bonus > 0) {
      const level = getSchoolLevel(state.year);
      const adjustedThreshold = level === 'elementary' ? 25 : level === 'middle' ? 35 : cb.threshold;
      if (state.stats[cb.targetStat] < adjustedThreshold) {
        const before = state.stats[cb.targetStat];
        state.stats[cb.targetStat] = Math.max(0, Math.min(100, before + cb.bonus));
        if (!log.statChanges[cb.targetStat]) log.statChanges[cb.targetStat] = 0;
        log.statChanges[cb.targetStat]! += cb.bonus;
      }
    }
  }
  // Phase 1: 방학 활동 횟수 카운트 (vacationLimit 추적)
  if (state.isVacation && activity.seasonGate === 'vacation-only') {
    if (!state.vacationActivityCounts) state.vacationActivityCounts = {};
    state.vacationActivityCounts[activity.id] = (state.vacationActivityCounts[activity.id] ?? 0) + 1;
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
  // v7.2: resilience 부모 — 피로 증가 -15% (타고난 체질)
  if (fatigueDelta > 0 && pMods.fatigueIncreaseMult < 1.0) {
    fatigueDelta = Math.max(1, Math.round(fatigueDelta * pMods.fatigueIncreaseMult));
    if (!log.parentBonusesApplied?.some(b => b.parent === 'resilience' && b.what.includes('피로'))) {
      log.parentBonusesApplied?.push({ parent: 'resilience', what: '체질 — 피로 증가 -15%' });
    }
  }
  state.fatigue = Math.max(0, Math.min(100, state.fatigue + fatigueDelta));
  log.fatigueChange += fatigueDelta;

  // 용돈 적용 (음수 방지) — 학년별 차등 비용 적용
  const cost = getActivityCost(activity, state.year);
  state.money = Math.round((state.money - cost) * 10) / 10;
  if (state.money < 0) state.money = 0;
  log.moneyChange -= cost;

  // 부모 친밀도 — stat 감쇠(diminishing/fatigue 등)와 무관하게 raw baseDelta를 단일 진입점에 전달.
  // §2.1 구간 감쇠는 applyParentIntimacyDelta 내부에서만 적용(이중 적용 방지).
  // 같은 활동이 루틴 슬롯 + 주말 선택에 동시 등록되면 2번 호출되므로, 활동 id별 주 1회만 친밀도 적용.
  if (activity.parentEffect && !log.parentEffectAppliedIds?.includes(activity.id)) {
    applyParentIntimacyDelta(state, activity.parentEffect.baseDelta, activity.parentEffect.tag);
    state.actedWithParentThisWeek = true; // 이번 주 평균 회귀 면제
    (log.parentEffectAppliedIds ??= []).push(activity.id);
    // 체감 보상: 친밀도가 이미 돈독하면 가족 저녁의 멘탈 회복이 미세하게 더 크다 (숫자 비노출)
    if (activity.id === 'family-dinner' && (state.parentIntimacy ?? 50) >= 60) {
      state.stats.mental = Math.min(100, state.stats.mental + 0.5);
      log.statChanges.mental = (log.statChanges.mental ?? 0) + 0.5;
    }
  }

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

  // 인기: 감소 → 학기 중 미세 회복 → floor 적용 (순서 중요)
  // v7.2: -0.5 → -0.8 강화. <50 자동 회복 폐지(→ <30만 약하게). floor 10 → 0.
  // 이유: m5 5/5 패턴 social=99 수렴, 외톨이 위기(<25) 0/5 발동. 자동 회복이 모든 임계점을 자동 충족.
  let socialChange = -0.8;
  if (state.stats.social <= 12) socialChange = -0.2; // 바닥 근처 감소 약간 완화
  if (!isVacation && state.stats.social < 30) socialChange += 0.2; // 학기 중 최저 30 미만일 때만 미세 회복
  state.stats.social = Math.max(0, state.stats.social + socialChange); // floor 0 (외톨이 위기 도달 가능)
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

  // 멘탈 자연감소 (문서 §4-5 기준: 80 진입에 비용 발생, 100 고정 방지)
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
// M6: useReducedRecovery 플래그 시 전체 회복량 × 0.6 (도전 모드).
// 상점 의존성·의사결정 부담 강화를 위해 플레이어가 옵션으로 선택.
function applyFatigueRecovery(state: GameState, log: WeekLog): void {
  const mult = state.useReducedRecovery ? 0.6 : 1.0;
  const before = state.fatigue;

  // 비례 회복: 15%, 최소 -3, 최대 -12 (reduced 모드에서는 하한도 -1.8까지)
  let recovery = Math.max(3, Math.min(12, state.fatigue * 0.15)) * mult;

  // 정서적 지지: +2 (멘탈 70+ 시 +1) — emotional 부모만 발동
  const recoveryMods = getParentMods(state.parents);
  let emoBonus = 0;
  if (recoveryMods.fatigueRecoveryBonus > 0) {
    emoBonus = state.stats.mental >= 70 ? 1 : recoveryMods.fatigueRecoveryBonus;
    recovery += emoBonus * mult;
  }

  // 방학 추가 회복
  if (state.isVacation) recovery += 2 * mult;

  state.fatigue = Math.max(0, state.fatigue - recovery);
  log.fatigueChange -= recovery;

  // 표시는 emotional 보너스가 실효 회복에 기여한 주만 — 피로 0 직전이면 노이즈
  if (emoBonus > 0 && before >= emoBonus * mult) {
    log.parentBonusesApplied?.push({ parent: 'emotional', what: `엄마가 물어봐줬다 — 피로 -${emoBonus}` });
  }
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
      state.routineSlot2Weeks = 0;
      state.routineSlot3Weeks = 0;
      log.messages.push('🔥 번아웃! — "...더 이상 못하겠다"');
    }
  }
  // 회복: tired → normal
  // v7.2: 임계 완화 (50/40 → 45/50) — Y1 만성 진입 39% / 회복률 38% 데스 스파이럴 완화
  // v8.2: 진입(mental<40)과 탈출(mental>=45) 사이 5점 갭이 영구 tired(데드존)를 만들던 문제.
  //   tired 중 mental 성장은 패널티(×0.8, 만성 ×0.5)라 45 복귀가 어려워 Y2+ 88% tired 고착.
  //   탈출을 mental>=42 && fatigue<55로 완화해 갭을 좁히고(2점 히스테리시스) "dip→recover" 리듬 회복.
  else if (state.mentalState === 'tired' && state.stats.mental >= 42 && state.fatigue < 55) {
    state.mentalState = 'normal';
    log.messages.push('✨ 회복! — 다시 일상으로 돌아왔다.');
  }
  // burnout → tired (회복 시작)
  else if (state.mentalState === 'burnout' && state.stats.mental >= 20 && state.fatigue < 40) {
    state.mentalState = 'tired';
    state.burnoutCooldown = 8; // v7.1: 4 → 8주 면역 (Y1 25주 연속 tired 데스 스파이럴 방지)
    log.messages.push('💪 번아웃에서 벗어나는 중...');
  }

  // QA C5: 만성 탈진 강제 붕괴 — 24주+ 연속 tired면 mental 수치와 무관하게 몸이 무너진다.
  //   게이트만으론 grind 빌드가 mental을 20~42에 부유시켜 번아웃에도 회복에도 못 닿고
  //   영구 tired 락(294주)·A/A 안전빵이 됐다. "24주 연속 tired"라는 사실 자체가 갈아넣기 신호다 —
  //   회복 중인 빌드는 게이트된 자력탈출 보조(fatigue<60)로 이미 24주 전에 위(normal)로 빠져나가므로,
  //   24주를 못 빠져나온 건 진짜로 쉬지 못한 빌드뿐. 강제로 burnout 전환 → burnoutCount 누적 →
  //   재수/잠시쉼표로 "밑으로 무너지게" 한다(갈아넣기의 서사적 대가). 쿨다운 면역 중엔 미발동.
  if (state.mentalState === 'tired' && (state.consecutiveTiredWeeks || 0) >= 24
    && (state.burnoutCooldown || 0) === 0) {
    state.mentalState = 'burnout';
    state.burnoutCount++;
    state.routineSlot2Weeks = 0;
    state.routineSlot3Weeks = 0;
    log.messages.push('🔥 한계였다 — 쉬지 않고 달린 몸이 결국 멈춰 섰다.');
  }

  // v8.2: 장기 tired 자력 탈출 보조 — 8주+ 연속 tired면 몸이 강제 회복 모드로 전환.
  // 멘탈 회복 활동이 루틴에 없는 그라인드 빌드는 mental이 바닥에 깔려 탈출선에 영구 미달,
  // 200주+ tired에 고착되던 데드존이 있었다. 탈출조건 완화만으로는 거의 안 풀려(58.9→58.3%)
  // 수동 회복을 더한다 → 최장 연속 tired 222→19주로 영구 락 제거(전체 tired 58→53%).
  // 균형 빌드(멘탈 활동 포함)는 이 보조 없이도 건강하므로(tired 21%) 영향 미미.
  // QA C5: 단 fatigue>=60(쉬지 않고 갈아넣는 중)이면 이 보조를 끊는다. C4-A(고피로 시 +2 차단)와
  //   동일 기준. 이전엔 이 +1.5가 갈아넣기 빌드의 mental을 번아웃 게이트(<20) 위로 떠받쳐,
  //   tired에서 위(normal)로도 아래(burnout)로도 못 가고 영구 부유(grind-burnout 294주 tired·
  //   burnoutCount 2 → 재수 게이트 ≥4 미달 → A/A 안전빵)했다. 고피로 빌드는 보조를 끊어 mental을
  //   드레인 → burnout 반복 → burnoutCount 누적 → 재수/잠시쉼표 엔딩으로 "밑으로 무너지게" 한다.
  //   (회복 중인 빌드는 fatigue<60이라 그대로 위로 탈출 — 영구 락 제거 효과는 유지)
  if (state.mentalState === 'tired' && (state.consecutiveTiredWeeks || 0) >= 8 && state.fatigue < 60) {
    state.stats.mental = Math.min(100, state.stats.mental + 1.5);
    state.fatigue = Math.max(0, state.fatigue - 3);
    log.statChanges.mental = (log.statChanges.mental || 0) + 1.5;
  }

  // 쿨다운 틱다운
  if ((state.burnoutCooldown || 0) > 0 && state.mentalState !== 'burnout') {
    state.burnoutCooldown = Math.max(0, (state.burnoutCooldown || 0) - 1);
  }

  // v6.4: 연속 피로 주수 카운터 + QA C5: 누적 tired/burnout 주수(엔딩 만성탈진 라우팅용)
  if (state.mentalState === 'tired' || state.mentalState === 'burnout') {
    state.consecutiveTiredWeeks = (state.consecutiveTiredWeeks || 0) + 1;
    state.totalTiredWeeks = (state.totalTiredWeeks || 0) + 1;
  } else {
    state.consecutiveTiredWeeks = 0;
  }

  // v6.4: tired 자동 회복 강화 — 피로 -5 (만성화 방지)
  // M6: reduced 모드에서는 -3
  if (state.mentalState === 'tired') {
    const fatDrop = state.useReducedRecovery ? 3 : 5;
    state.fatigue = Math.max(0, state.fatigue - fatDrop);
    log.fatigueChange -= fatDrop;
    // v7.2: 자동 mental 회복 +1 → +2 (임계 완화와 함께 burnout 재진입 차단)
    // QA C4-A: 단 고피로(fatigue>=60)에선 자동 회복을 끊어 '갈아넣기' 루틴이 번아웃 게이트에 닿게 한다.
    //          (12 페르소나 전원 burnoutCount 0 — tired 자가치유가 mental<20 게이트를 영구 차단하던 문제)
    if (state.fatigue < 60) {
      state.stats.mental = Math.min(100, state.stats.mental + 2);
      log.statChanges.mental = (log.statChanges.mental || 0) + 2;
    }
  }

  // v6.1: 번아웃 자동 회복 — 강화 (활동 피로를 이길 수 있는 수준)
  // M6: reduced 모드에서는 피로 -8, 멘탈 +3 (탈출 속도 완만)
  if (state.mentalState === 'burnout') {
    const fatDrop = state.useReducedRecovery ? 8 : 12;
    const menUp = state.useReducedRecovery ? 3 : 4;
    state.fatigue = Math.max(0, state.fatigue - fatDrop);
    state.stats.mental = Math.min(100, state.stats.mental + menUp);
    log.fatigueChange -= fatDrop;
    log.statChanges.mental = (log.statChanges.mental || 0) + menUp;
  }
}

// ===== 행복 등급 산출 (학년말·엔딩 공통 SSOT) =====
// 행복 등급/엔딩 산정은 ending.ts 로 이동.

// ===== NPC 친밀도 변화량 구간별 감쇠 =====
// 원본 +10 이상(현재 +8 이상)인 큰 이벤트와 음수는 면제. 그 외 양수만 친밀도 구간별 효율 적용.
// 0~39: 100% (낯선이 → 친구, 진입은 빠르게)
// 40~59: 80%  (친구 → 친한 친구)
// 60~79: 60%  (친한 친구 → 절친 직전)
// 80~100: 25% (절친 plateau — 천장 효과)
// floor + max(1): 효율 누수 차단하되 양수 효과는 최소 +1 보장 (0 소멸 방지).
export function scaleIntimacyChange(delta: number, currentIntimacy: number): number {
  if (delta <= 0) return delta;
  if (delta >= 8) return delta;
  let multiplier: number;
  if (currentIntimacy < 40) multiplier = 1.0;
  else if (currentIntimacy < 60) multiplier = 0.8;
  else if (currentIntimacy < 80) multiplier = 0.6;
  else multiplier = 0.25;
  return Math.max(1, Math.floor(delta * multiplier));
}

// ===== 이벤트 스탯 효과 구간별 감쇠 (QA C3-B) =====
// 문제: 활동(applyActivity)은 getDiminishingReturn 으로 70+ 구간에서 강하게 눌리는데,
// 이벤트 선택지 효과(store.resolveEvent)는 raw 가산이라 캡을 우회 → 한 판 350+ 이벤트가
// 빌드 무관하게 social/mental 을 97~99 로 수렴시켜 빌드 차별성을 지웠다(QA C3 근본원인).
// scaleIntimacyChange 와 동일 철학: 음수 패널티·큰 단발 보상(≥8, "majorReward")은 면제,
// 그 외 양수만 고구간에서 감쇠. 활동 곡선(0.5/0.3/0.1)보다 완만 — 이벤트는 드물고 플레이어가 고른
// 보상이라 초·중반(70 미만)은 100% 유지해 여정의 보상감을 지키고, 천장 근처만 누른다.
// 0~69: 100% / 70~84: 60% / 85~94: 40% / 95~100: 25%
export function scaleStatChange(delta: number, currentStat: number): number {
  if (delta <= 0) return delta;       // 패널티는 그대로 (감쇠 면제)
  if (delta >= 8) return delta;       // majorReward: 큰 단발 보상은 캡 우회 유지
  let multiplier: number;
  if (currentStat < 70) multiplier = 1.0;
  else if (currentStat < 85) multiplier = 0.6;
  else if (currentStat < 95) multiplier = 0.4;
  else multiplier = 0.25;
  return delta * multiplier;          // 스탯은 소수 누적이라 floor 없이 비율만 적용
}

// ===== NPC 친밀도 자연 감소 =====
// M5 Phase 4: 80 초과 -0.2 / 20~80 -0.15 / 20 미만 0 (floor 20).
// 자연 감소는 20에서 멈추고, 그 아래는 이벤트에서 관계를 해치는 선택지를 골라야 도달.
// 친구 활동 안 해도 친밀도 100 수렴하던 문제 차단 — 상한 근처는 더 빨리 식고, 바닥은 이벤트 책임.
function applyNpcDecay(state: GameState): void {
  for (const npc of state.npcs) {
    if (npc.intimacy < 20) continue;
    const rate = npc.intimacy > 80 ? 0.2 : 0.15;
    npc.intimacy = Math.max(20, npc.intimacy - rate);
  }
}

// 구세이브 호환 백필은 stateMigration.ts 로 이동.

// 학년 마감(week>48) 전환 — milestone 기록 후 Y7은 엔딩, 그 외는 학년말 일기장으로.
// processWeek와 resolveEvent 양쪽에서 호출된다: W48에 이벤트가 대기 중이면 전환을
// 이벤트 resolve 시점까지 미뤄, 학년말/졸업 주 이벤트가 year-end 화면에 묻혀 유실되는 걸 막는다.
export function applyYearTransition(s: GameState): void {
  // v1.2: 학년 전환 직전에 해당 학년의 milestoneScene 기록
  recordMilestoneForYear(s, s.year);
  if (s.year >= 7) {
    // Y7 끝 → 바로 엔딩 (엔딩에 이미 7년 전체 회상 포함)
    s.week = 1;
    s.year++;
    s.phase = 'ending';
  } else {
    // Y1~Y6 끝 → 학년말 일기장 화면. week는 49 상태로 유지
    // 사용자가 advanceFromYearEnd 호출하면 정리됨
    s.phase = 'year-end';
  }
}

// ===== processWeek 단계 헬퍼 (순수 추출 — state를 직접 mutate, 동작 보존) =====

// npcActivityMap(UI에서 고른 동행 친구)에 따른 친밀도 +3
function applyNpcActivitySelection(state: GameState, npcActivityMap?: Record<string, string>): void {
  if (!npcActivityMap) return;
  for (const npcId of Object.values(npcActivityMap)) {
    const npc = state.npcs.find(n => n.id === npcId);
    if (npc) {
      npc.intimacy = Math.min(100, npc.intimacy + 3);
      npc.lastInteractionWeek = absWeek(state.year, state.week); // 관계 신호: 동행 = 상호작용
    }
  }
}

// 주 시작 컨텍스트: 학기/방학 상태 + 말걸기 pressure 차오름 + 이번 주 이벤트 사전결정.
// seededRandom 2회 호출 순서는 rngSeed 전진이라 절대 바꾸지 말 것.
function prepareWeekContext(state: GameState): void {
  const info = getWeekInfo(state.week);
  state.semester = info.semester;
  state.isVacation = info.isVacation;
  // Phase 1: 학기 중에는 방학 활동 카운터 자동 초기화 (방학 동안만 누적)
  if (!state.isVacation) {
    state.vacationActivityCounts = {};
  }
  // Phase 2.1 말걸기 — pressure 차오름 + 사전 결정. pressure는 fire 시점에 0 리셋.
  state.talkEventPressure = Math.min(1, (state.talkEventPressure ?? 0) + 0.1);
  state.parentTalkPressure = Math.min(1, (state.parentTalkPressure ?? 0) + 0.05);
  state.npcEventPendingThisWeek = seededRandom(state) < state.talkEventPressure;
  state.parentEventPendingThisWeek = seededRandom(state) < state.parentTalkPressure;
}

// 용돈 지급 + 생활비 차감 (v6, parentModifiers SSOT). econMods를 반환해 idle 페널티와 공유.
function applyAllowanceAndLiving(state: GameState, log: WeekLog): ReturnType<typeof getParentMods> {
  const econMods = getParentMods(state.parents);
  const netMoney = Math.round((econMods.weeklyIncome - econMods.livingCost) * 10) / 10;
  if (state.parents.includes('wealth')) {
    log.parentBonusesApplied?.push({ parent: 'wealth', what: '용돈이 넉넉했다' });
  }
  state.money = Math.round((state.money + netMoney) * 10) / 10;
  log.moneyChange += netMoney;
  return econMods;
}

// 방치 무기력 (v6): 3주 연속 비생산적 활동 시 멘탈/소셜 감소. freedom 부모는 페널티 배율(econMods).
function applyIdlePenalty(state: GameState, log: WeekLog, econMods: ReturnType<typeof getParentMods>): void {
  const productiveActivities = [...(state.isVacation ? state.vacationChoices : state.weekendChoices)];
  if (state.routineSlot2) productiveActivities.push(state.routineSlot2);
  if (state.routineSlot3) productiveActivities.push(state.routineSlot3);
  const restOnlyIds = ['rest', 'deep-rest', 'gaming', 'park-walk'];
  const isRestOnly = productiveActivities.length === 0 || productiveActivities.every(id => restOnlyIds.includes(id));
  if (isRestOnly) {
    state.idleWeeks = (state.idleWeeks || 0) + 1;
  } else {
    state.idleWeeks = 0;
  }
  if ((state.idleWeeks || 0) >= 3) {
    // v7.2: freedom 부모 — idle 페널티 배율 (parentModifiers SSOT)
    const isFreeSpirit = econMods.idlePenaltyMult < 1.0;
    const mentalDrain = 2 * econMods.idlePenaltyMult;
    const socialDrain = 1 * econMods.idlePenaltyMult;
    if (isFreeSpirit) {
      log.parentBonusesApplied?.push({ parent: 'freedom', what: '"알아서 해" — idle 페널티 -50%' });
    }
    state.stats.mental = Math.max(0, state.stats.mental - mentalDrain);
    state.stats.social = Math.max(5, state.stats.social - socialDrain);
    log.statChanges.mental = (log.statChanges.mental || 0) - mentalDrain;
    log.statChanges.social = (log.statChanges.social || 0) - socialDrain;
    log.messages.push(isFreeSpirit
      ? '🌿 좀 쉬는 중. 부모님이 별 말씀 안 하셔서 다행이다.'
      : '😶 무기력... 뭔가 해야 할 것 같은데, 아무것도 하기 싫다.');
  }
}

// 이번 주 이벤트 선택 (getEventForWeek는 순수 — patch는 호출자가 명시 적용).
function selectEventForWeek(state: GameState): void {
  const selection = getEventForWeek(state);
  if (selection.patch) {
    state.hardCrisisYears = selection.patch.hardCrisisYears;
  }
  if (selection.event) {
    state.currentEvent = { ...selection.event, week: state.week };
    state.phase = 'event';
  }
}

// 버프 틱다운 + 주간 구매 리셋.
function tickBuffsAndResetPurchases(state: GameState): void {
  if (state.activeBuffs) {
    state.activeBuffs = state.activeBuffs
      .map(b => ({ ...b, remainingWeeks: b.remainingWeeks - 1 }))
      .filter(b => b.remainingWeeks > 0);
  }
  state.weekPurchases = {};
}

// 루틴 활동 (학기 중 방과후). timeCost(이벤트 소모)로 슬롯 스킵, strict 부모 루틴 보너스 +1주.
function applyRoutineActivities(state: GameState, log: WeekLog, timeCost: number): void {
  if (timeCost > 0) {
    const skipMsg = timeCost >= 2 ? '📅 이벤트 때문에 이번 주 방과후 활동을 다 빠졌다.' : '📅 이벤트 때문에 이번 주 방과후 활동 하나를 빠졌다.';
    log.messages.push(skipMsg);
    state.eventTimeCost = 0;
  }
  if (!state.isVacation) {
    // v7.2: strict 부모 — 루틴 보너스 도달 1주 단축 (3→2, 6→5, 8→7주에 도달)
    const wkMods = getParentMods(state.parents);
    const boost = wkMods.routineWeeksBoost;
    // 슬롯별 rBonus — 한쪽 슬롯만 변경되어도 다른 슬롯 보너스 보전
    const r2Bonus = getRoutineBonus(state.routineSlot2Weeks + boost);
    const r3Bonus = getRoutineBonus(state.routineSlot3Weeks + boost);
    // strict 표시 — 어느 슬롯이라도 부스트로 임계값 통과한 주만
    const r2Base = getRoutineBonus(state.routineSlot2Weeks);
    const r3Base = getRoutineBonus(state.routineSlot3Weeks);
    if (boost > 0 && (r2Bonus > r2Base || r3Bonus > r3Base)) {
      log.parentBonusesApplied?.push({ parent: 'strict', what: '정해진 시간에 책상 — 루틴 +1주' });
    }
    // timeCost 2: 둘 다 스킵, timeCost 1: 슬롯2는 실행 + 슬롯3 스킵
    // 돈 체크를 먼저(메시지 구분 유지), 그다음 canApplyActivity 게이트 —
    // UI를 안 거친 입력(세이브 변조/sim/스테일 루틴)이 학년·학기 조건을 우회하는 것 방어.
    if (state.routineSlot2 && timeCost < 2) {
      const r2 = ACTIVITIES.find(a => a.id === state.routineSlot2);
      const r2Cost = r2 ? getActivityCost(r2, state.year) : 0;
      if (r2 && r2Cost > 0 && state.money < r2Cost) {
        log.messages.push(`💰 돈이 부족해서 ${r2.name}을 못 했다...`);
      } else if (!r2 || !canApplyActivity(state, r2.id)) {
        log.messages.push(`⚠ 지금은 ${r2?.name || '설정된 활동'}을 할 수 없어 건너뛰었다.`);
      } else {
        applyActivity(state, state.routineSlot2, log, r2Bonus);
        state.routineSlot2Weeks++;
      }
    }
    if (state.routineSlot3 && timeCost < 1) {
      const r3 = ACTIVITIES.find(a => a.id === state.routineSlot3);
      const r3Cost = r3 ? getActivityCost(r3, state.year) : 0;
      if (r3 && r3Cost > 0 && state.money < r3Cost) {
        log.messages.push(`💰 돈이 부족해서 ${r3.name}을 못 했다...`);
      } else if (!r3 || !canApplyActivity(state, r3.id)) {
        log.messages.push(`⚠ 지금은 ${r3?.name || '설정된 활동'}을 할 수 없어 건너뛰었다.`);
      } else {
        applyActivity(state, state.routineSlot3, log, r3Bonus);
        state.routineSlot3Weeks++;
      }
    }
    // timeCost로 스킵해도 카운터는 유지 (습관은 남아있음)
    if (timeCost >= 2) {
      if (state.routineSlot2) state.routineSlot2Weeks++;
      if (state.routineSlot3) state.routineSlot3Weeks++;
    }
  }
}

// 주말/방학 선택 활동 — 돈 부족하면 스킵, timeCost로 뒤에서부터 슬롯 감소.
function applyWeekendActivities(state: GameState, log: WeekLog, timeCost: number): void {
  const rawChoices = state.isVacation ? state.vacationChoices : state.weekendChoices;
  // timeCost: 뒤에서부터 슬롯 제거 (1=마지막 1개, 2=마지막 2개) → 꼬리 잘린 2칸 활동은 collapse에서 1회만 push
  const slicedChoices = timeCost > 0 ? rawChoices.slice(0, Math.max(0, rawChoices.length - timeCost)) : rawChoices;
  // 2칸 활동의 같은 id 인접 중복을 1 인스턴스로 collapse
  const choices = collapseActivityChoices(slicedChoices);
  const allActivities = [...choices];
  for (const choice of choices) {
    const act = ACTIVITIES.find(a => a.id === choice);
    const actCost = act ? getActivityCost(act, state.year) : 0;
    if (act && actCost > 0 && state.money < actCost) {
      log.messages.push(`💰 돈이 부족해서 ${act.name}을 못 했다...`);
      continue;
    }
    // 학년/학기/방학횟수 게이트 — UI를 안 거친 입력 방어 (canApplyActivity SSOT)
    if (!act || !canApplyActivity(state, choice)) {
      log.messages.push(`⚠ 지금은 ${act?.name || '선택한 활동'}을 할 수 없어 건너뛰었다.`);
      continue;
    }
    applyActivity(state, choice, log);
  }
  // 루틴 활동도 포함 (allActivities는 idle 페널티가 자체 재계산하므로 현재 읽는 곳 없음 — 원본 보존)
  if (state.routineSlot2) allActivities.push(state.routineSlot2);
  if (state.routineSlot3) allActivities.push(state.routineSlot3);
}

// 시험 주 처리 — 결과 생성(수능/모의/일반), 멘탈 후처리, 부모 친밀도 약연동 + strict 칭찬.
function applyExamForWeek(state: GameState, log: WeekLog): void {
  const thisWeekExam = getExamSchedule(state.year)[state.week];
  if (thisWeekExam) {
    let examResult;
    let examName: string;

    if (thisWeekExam === 'suneung') {
      examResult = generateSuneungResult(state);
      examName = '수능';
    } else if (thisWeekExam === 'mock') {
      examResult = generateMockExamResult(state);
      examName = '모의고사';
    } else {
      examResult = generateExamResult(state, thisWeekExam);
      examName = thisWeekExam === 'unit-test' ? '단원평가'
        : thisWeekExam === 'midterm' ? '중간고사' : '기말고사';
    }

    state.examResults.push(examResult);
    state.currentExamResult = examResult;
    log.examResult = examResult;
    log.messages.push(`📝 ${examName} 결과 발표!`);

    // 시험 결과 멘탈 후처리
    if (examResult.mentalDelta) {
      state.stats.mental = Math.max(0, Math.min(100, state.stats.mental + examResult.mentalDelta));
      if (examResult.mentalDelta > 0) {
        log.messages.push(`시험 결과에 기분이 좋아졌다! (멘탈 +${examResult.mentalDelta})`);
      } else if (examResult.mentalDelta < 0) {
        log.messages.push(`시험 결과에 기분이 가라앉았다... (멘탈 ${examResult.mentalDelta})`);
      }
    }

    // 시험 결과 → 부모 친밀도 약연동 (Phase 2B §3.3, 단일 진입점).
    // 주의: 평균회귀(5b)와 actedWithParentThisWeek 리셋이 이미 끝난 지점이라 여기선 델타만 적용한다.
    const examEffect = examParentEffect(examResult);
    if (examEffect) {
      applyParentIntimacyDelta(state, examEffect.baseDelta, examEffect.tag);

      // B2: strict + 뚜렷한 성적 향상 → 연 1회 어드밴티지(멘탈 버프 + 서사).
      const praiseYears = (state.parentPraiseYears ??= []);
      const topTier = (examResult.rank != null && examResult.rank <= 5)
        || (examResult.mockGrade != null && examResult.mockGrade <= 2)
        || (examResult.schoolLevel === 'elementary' && examResult.average >= 85);
      if (state.parents.includes('strict') && examEffect.tag === 'gradeImprove'
          && topTier && !praiseYears.includes(state.year)) {
        state.stats.mental = Math.min(100, state.stats.mental + 2);
        log.statChanges.mental = (log.statChanges.mental ?? 0) + 2;
        praiseYears.push(state.year);
        log.messages.push('아빠가 성적표를 한참 보더니, 드물게 "잘했다"고 했다. (멘탈 +2)');
      }
    }
  } else {
    state.currentExamResult = null;
    log.examResult = null;
  }
}

// 주 진행 + 학년 전환 판정 + 다음 주 학기/방학 상태.
function advanceWeekCounter(state: GameState): void {
  state.week++;
  if (state.week > 48 && !state.currentEvent) {
    // 대기 중인 W48 이벤트가 없을 때만 즉시 학년 전환. 이벤트가 있으면 phase='event' 유지,
    // 전환은 resolveEvent가 이벤트 종료 후 수행한다 (학년말 이벤트 유실 방지).
    applyYearTransition(state);
  }
  // 다음 주의 학기/방학 상태 — year-end거나 week=49(학년말 이벤트 대기)면 직전 주 값 유지.
  if (state.phase !== 'year-end' && state.week <= 48) {
    const nextInfo = getWeekInfo(state.week);
    state.semester = nextInfo.semester;
    state.isVacation = nextInfo.isVacation;
  }
}

// ===== 주간 처리 (메인 루프) =====
export function processWeek(state: GameState, npcActivityMap?: Record<string, string>): GameState {
  const newState = migrateLoadedState(cloneGameState(state)) as GameState;

  // 도달형 페이싱: 주 시작 시점 친밀도 스냅샷. 이번 주 이벤트로 친밀도가 임계를 "방금 넘으면"(fresh)
  // 즉시 발동, 이미 넘어 있었으면(pre-met) 쿨다운으로 분산 — getReachForWeek 가 이 값으로 판별.
  for (const npc of newState.npcs) npc.weekStartIntimacy = npc.intimacy;

  // NPC 선택(activity→npc 매핑)에 따른 친밀도 적용
  applyNpcActivitySelection(newState, npcActivityMap);

  // 학기/방학 상태 + 말걸기 pressure 차오름 + 이번 주 이벤트 사전결정
  prepareWeekContext(newState);
  // 부모 친밀도 자연 변화는 더 이상 강점 자동 드리프트가 아니다(결정론 제거).
  // actedWithParentThisWeek 플래그는 talkToHome(processWeek 이전) + 부모 활동(아래)에서 누적되고,
  // 평균 회귀(50 수렴)와 플래그 리셋은 활동 적용 뒤 "5b"에서 처리한다.

  const log: WeekLog = {
    statChanges: {},
    fatigueChange: 0,
    moneyChange: 0,
    messages: [],
    milestoneMessages: [],
    parentBonusesApplied: [],
  };

  // 1. 피로 자연 회복
  applyFatigueRecovery(newState, log);

  // 2. 학교 수업 (학기 중만)
  if (!newState.isVacation) {
    applySchoolClass(newState, log);
  }

  // 3. 루틴 활동 (학기 중 방과후) — timeCost(이벤트 소모)로 슬롯 스킵. timeCost는 4번에서도 쓰임.
  const timeCost = newState.eventTimeCost || 0;
  applyRoutineActivities(newState, log, timeCost);

  // 4. 주말/방학 선택 활동 — 돈 부족하면 스킵, timeCost로 슬롯 감소
  applyWeekendActivities(newState, log, timeCost);

  // 5b. 부모 친밀도 평균 회귀 — 이번 주 부모 행동(활동/대화)이 없었으면 50으로 천천히 수렴.
  //     (talkToHome은 processWeek 이전에, 부모 활동은 위에서 actedWithParentThisWeek를 세팅)
  applyParentMeanReversion(newState);
  newState.actedWithParentThisWeek = false; // 다음 주를 위해 리셋

  // 5. 자연 감소
  applyNaturalDecay(newState, log, newState.isVacation);

  // 6. NPC
  applyNpcDecay(newState);
  // 친밀도 증가는 npcActivityMap(UI에서 선택한 친구)에만 적용 — 광역 보정 제거

  // 7. 멘탈 상태 전환
  checkMentalStateTransition(newState, log);

  // 8. 마일스톤
  checkMilestones(newState, log);

  // 9. 용돈 지급 — 생활비 차감 (v6, parentModifiers SSOT)
  const econMods = applyAllowanceAndLiving(newState, log);

  // 10. 방치 무기력 체크 (v6: 3주 연속 비생산적 활동 시 멘탈/소셜 감소)
  applyIdlePenalty(newState, log, econMods);

  // 스탯 범위 보정
  for (const key of Object.keys(newState.stats) as StatKey[]) {
    newState.stats[key] = Math.max(0, Math.min(100, Math.round(newState.stats[key] * 10) / 10));
  }
  newState.fatigue = Math.max(0, Math.min(100, Math.round(newState.fatigue * 10) / 10));

  newState.weekLog = log;
  newState.totalWeeksPlayed++;

  // 10. 시험 체크 — 스케줄은 getExamSchedule SSOT 사용
  applyExamForWeek(newState, log);

  // 11. 이벤트 체크 — getEventForWeek는 순수 함수, patch는 selectEventForWeek 내부에서 명시 적용
  selectEventForWeek(newState);

  // 12. 버프 틱다운 + 주간 구매 리셋
  tickBuffsAndResetPurchases(newState);

  // 주 진행 + 학년 전환 판정 + 다음 주 학기/방학 상태
  advanceWeekCounter(newState);

  // 선택 초기화
  newState.weekendChoices = [];
  newState.vacationChoices = [];

  return newState;
}

// 엔딩 산정·진로 판정·NPC 근황은 ending.ts 로 이동.
