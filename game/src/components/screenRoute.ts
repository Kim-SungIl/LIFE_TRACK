// 지금 어느 화면을 그릴까 — GameScreen의 분기 판정을 순수 함수 하나로. (2026-10 리팩토링)
//
// 예전엔 이 판정이 GameScreen 렌더 본문의 if/else 사슬 안에 JSX와 섞여 있었다. 월 단위 계획(기능 플래그)을 켜는
// 순간 바뀌는 자리가 바로 여기라(결산 → 재생 카드/월말 결산 · 주간 화면 → 월 계획 화면), 렌더 없이 상태만 넣어
// 어느 화면인지 단언할 수 있어야 플래그 전환 전후를 잠글 수 있다. 화면 정체성 키(전환 페이드)도 여기서 같이 정한다 —
// 키를 분기와 다른 자리에서 다시 계산하면 라우터와 어긋난다(ScreenTransition).
import type { GameState, MonthPlan, MonthRun } from '../engine/types';
import { getCurrentMonthPlan } from '../engine/monthPlan';
import { getMonthRun, isMonthEndWeek } from '../engine/monthPlayback';
import { getMonthBlock } from '../engine/weekMath';
import { goalRecordForWeekLog } from '../engine/semesterGoal';
import type { TransitionPace } from './ScreenTransition';


/** 주간 결산 화면의 "계속" — 월말 결산으로(먼저 이 결산을 봤다고 적고) · 재생 이어서 · 계획 단계로. */
export type WeeklyContinue = 'mark-big-result-seen' | 'continue-playback' | 'to-weekday';

export type ScreenRoute =
  | { kind: 'event-result'; key: string; pace: TransitionPace }
  | { kind: 'year-end'; key: string; pace: TransitionPace }
  | { kind: 'ending'; key: string; pace: TransitionPace }
  | { kind: 'event'; key: string; pace: TransitionPace }
  | { kind: 'month-summary'; key: string; pace: TransitionPace; run: MonthRun }
  | { kind: 'card'; key: string; pace: TransitionPace }
  | { kind: 'weekly'; key: string; pace: TransitionPace; continueTo: WeeklyContinue; resultKey: string }
  | { kind: 'month-plan'; key: string; pace: TransitionPace; existing: MonthPlan | null }
  | { kind: 'main'; key: string; pace: TransitionPace; monthly: { plan: MonthPlan | null; run: MonthRun | null } | null };

export interface ScreenRouteInput {
  state: GameState;
  /** 방금 내린 선택의 결과 연출(EventResultScreen) — 있으면 어떤 phase보다 우선한다. */
  eventResult: { eventId?: string; choiceIndex?: number } | null;
  /** 엔딩 데이터가 계산됐는가(엔딩 phase라도 없으면 엔딩 화면을 못 그린다). */
  endingReady: boolean;
  /** 월 단위 계획 기능 플래그(featureFlags.isMonthlyPlanningEnabled). */
  monthlyEnabled: boolean;
  /** 월말 직전 큰 주(시험·학기 목표)의 결산을 이미 봤다고 적은 키(`${year}-${week}`). */
  bigResultSeen: string | null;
  /** 주간 화면에서 월 계획 화면을 열었는가(📅 이번 달 계획 · 계획 고치기 · 남은 주 다시 짜기). */
  planOpen: boolean;
}

export function decideScreen(input: ScreenRouteInput): ScreenRoute {
  const { state, eventResult, endingReady, monthlyEnabled, bigResultSeen, planOpen } = input;

  // 이벤트 결과 — 방금 내린 선택의 결과 연출이라 어떤 phase보다 우선한다. 특히 학년말 주(W48) 이벤트에서
  // year-end/ending보다 먼저 봐야 결과 화면이 학년말 일기장에 묻히지 않는다.
  // 같은 선택의 결과 화면 안에서는 키가 고정 — cgLoaded 등으로 다시 페이드되지 않는다.
  if (eventResult) {
    return { kind: 'event-result', key: `event-result:${eventResult.eventId ?? '?'}#${eventResult.choiceIndex ?? '?'}`, pace: 'normal' };
  }
  // 학년말 일기장(Y1~Y6) — 한 판 6회라 드문 장면, 길게.
  if (state.phase === 'year-end') return { kind: 'year-end', key: `year-end:${state.year}`, pace: 'slow' };
  // 엔딩 — 한 판 1회.
  if (state.phase === 'ending' && endingReady) return { kind: 'ending', key: 'ending', pace: 'slow' };
  // 사건 — 연쇄 사건도 id가 바뀌므로 사이사이 전환이 들어간다. 고빈도라 normal 고정.
  if (state.currentEvent && state.phase === 'event') return { kind: 'event', key: `event:${state.currentEvent.id}`, pace: 'normal' };

  if (state.phase === 'result' && state.weekLog) {
    // 주간 결산 / 재생 카드 / 월말 결산.
    // 재생이 처리한 주는 짧은 카드로, 달의 마지막 주 뒤엔 월말 결산 한 장으로 간다(플래그 뒤).
    // 시험 결과·학기 목표 판정이 있는 주는 결산 화면을 그대로 보인다(그 주의 사건이 성적표다) — 월말이면 그 뒤에 결산.
    const log = state.weekLog;
    const rawRun = monthlyEnabled ? state.monthRun : undefined;
    // 결산 로그는 지난주 좌표다(state.week은 이미 다음 주) — 재생 장부는 로그 좌표로 맞춘다.
    const runForLog = rawRun && log.year === rawRun.year && log.week != null && log.week >= 1 && log.week <= 48
      && getMonthBlock(log.week).index === rawRun.month ? rawRun : null;
    const lastEntry = runForLog?.log[runForLog.log.length - 1];
    const autoWeek = !!lastEntry && lastEntry.week === log.week && lastEntry.auto;
    const monthEnd = !!runForLog && isMonthEndWeek(log.week!);
    const bigWeek = !!log.examResult || !!goalRecordForWeekLog(state);
    const resultKey = `${state.year}-${state.week}`;
    if (runForLog && monthEnd && (!bigWeek || bigResultSeen === resultKey)) {
      return { kind: 'month-summary', key: `month-summary:${runForLog.year}-${runForLog.month}`, pace: 'normal', run: runForLog };
    }
    if (autoWeek && !bigWeek && !monthEnd) {
      return { kind: 'card', key: `card:${state.year}-${state.week}`, pace: 'normal' };
    }
    const continueTo: WeeklyContinue = runForLog && monthEnd ? 'mark-big-result-seen'
      : autoWeek ? 'continue-playback'
      : 'to-weekday';
    return { kind: 'weekly', key: `weekly:${state.year}-${state.week}`, pace: 'normal', continueTo, resultKey };
  }

  // 한 달 계획(플래그 뒤) — **주간 화면이 메인이고, 계획 화면은 거기서 열 때만 뜬다**(2026-10-29 사용자 판정).
  // 예전엔 계획이 없는 달이면 주간 화면 대신 이 화면이 먼저 떴고, 재생을 멈춰야만 주간 화면이 보였다.
  // 열 때 이번 달 계획이 있으면 그걸 고치고(남은 주), 없으면 새로 짠다.
  const monthlyHere = monthlyEnabled && state.week >= 1 && state.week <= 48;
  if (monthlyHere && planOpen) {
    const existing = getCurrentMonthPlan(state);
    return { kind: 'month-plan', key: `month:${state.year}-${getMonthBlock(state.week).index}${existing ? ':replan' : ''}`, pace: 'normal', existing };
  }

  // 메인 주간 화면 — 주 안에서는 키가 고정이라 루틴 조작으로 페이드가 돌지 않는다.
  // 월 단위 판이면 맨 위 띠가 계획을 잇는다: 계획이 없으면 [📅 이번 달 계획], 있으면 [▶ 자동 진행]·[계획 고치기],
  // 자동 진행이 멈춰 섰으면 그 이유와 [▶ 이어서]·[남은 주 다시 짜기].
  const monthly = monthlyHere ? { plan: getCurrentMonthPlan(state), run: getMonthRun(state) } : null;
  return { kind: 'main', key: `main:${state.year}-${state.week}`, pace: 'normal', monthly };
}
