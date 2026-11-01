// 한 달 계획 화면 — 달 첫 주(또는 계획 없이 맞은 달 중간)에 그 달 남은 주의 주말(방학이면 자유) 칸을 한 번에 짠다.
// 설계: docs/monthly-plan-design-2026-10.md §3, 목업 https://claude.ai/artifact/UJcLgUvvRWvfDR7wPuje4V
//
// 무엇을 하고 무엇을 안 하나
//   · 주마다 칸을 고른다 — 고르기는 주간 화면과 **같은** 팝업(SlotEditPopup)·동행 창(NpcSelectModal)을 그 주 좌표로
//     다시 쓴다. 활동 목록은 그 주가 학기인지 방학인지에 맞춘 상태로 묻는다(방학 전용 활동·칸 수가 다르다).
//   · 방과후 루틴은 지금처럼 바꾼다(onSetRoutine) — 바꾸는 순간 남은 학기 주 몫을 낸다(monthlyMoney, 결정 (가)).
//   · 예산은 "쓸 수 있는 돈 = 잔액 − 아직 안 낸 학원비 − 이 계획의 예약"으로 실시간 보인다. 모자라면 시작을 막는다.
//   · 저장하면 store.setMonthPlan으로 남긴다(검증은 엔진 하나 — validateMonthPlan). 이 화면은 그 결과를 보여 줄 뿐.
//   · 저장하면 주간 화면으로 돌아간다 — 남은 주의 칸이 계획대로 채워지고, 자동 진행은 그 화면 띠에서 고른다(2026-10-29).
//   · 계획이 있는 달에 다시 열면(`existing`, 계획 고치기·남은 주 다시 짜기) 남은 주만 짜고, 초대는 처음 받은 그대로 고정이다
//     (엔진도 다시 짠 계획의 초대 답이 처음과 다르면 거부한다 — monthInvites.validateInviteAnswers).
import { useEffect, useMemo, useRef, useState } from 'react';
import { playSfx } from '../../../audio/sfx';
import { ACTIVITIES, collapseActivityChoices, collapseActivityChoicesWithSlots, getActivityCost, getAvailableActivities, isVacationLimitReached } from '../../../engine/activities';
import { getExamsInMonth, getNextMonthOpeningExam } from '../../../engine/examSystem';
import { getRoutineDueCost, incomeNote, remainingSemesterWeeks } from '../../../engine/monthlyMoney';
import { plannedWeekCost, slotCountForWeek } from '../../../engine/monthPlan';
import { generateMonthInvites } from '../../../engine/monthInvites';
import { josa } from '../../../engine/korean';
import { isNpcEnrolled } from '../../../engine/relationshipSignals';
import { EXAM_TYPE_LABELS, type GameState, type MonthInvite, type MonthPlan } from '../../../engine/types';
import { assignSlot } from '../../../engine/weekendPlan';
import { getMonthBlock, getWeekInfo, getWeekOfMonth } from '../../../engine/weekMath';
import { NpcSelectModal } from './NpcSelectModal';
import { chipSurface } from '../surface';
import { SlotEditPopup } from './SlotEditPopup';
import { SemesterGoalChip } from './SemesterGoalChip';
import { Tutorial } from '../../Tutorial';
import { TUTORIAL_KEYS, monthPlanSteps } from '../../tutorialSteps';
import { recordTelemetry } from '../../../engine/telemetry';
import { inviteLine, inviteVoice } from '../../../engine/talkData/inviteVoices';
import type { GoalOffer } from '../../../engine/semesterGoal';

type Props = {
  state: GameState;
  onSetRoutine: (slot2: string | null, slot3: string | null) => void;
  /** store.setMonthPlan — 저장되면 null, 아니면 이유. */
  onStart: (plan: MonthPlan) => string | null;
  /** 지금 달 계획 — 있으면 "남은 주 다시 짜기"다(재생이 멈춘 뒤). */
  existing?: MonthPlan | null;
  /** 다시 짜기를 그만두고 짜 둔 계획 그대로 돌아간다. */
  onCancel?: () => void;
  /**
   * T68 학기 목표 고르기(store.chooseSemesterGoal). 고를 수 있는 창은 학기 첫 두 주인데, 한 달 계획을 저장하면
   * 그 두 주가 재생 카드로 지나가 주간 화면의 칩을 볼 일이 없다 — 그래서 계획 화면에서 고른다(디렉터 결정 2026-10-26).
   */
  onChooseGoal?: (offer: GoalOffer) => boolean;
  /** [이번 달 시작]이 돈 때문에 잠겼다 — 엔딩·학년말 돈 회고의 "막힌 주"(store.markMoneyBlockedMonth). */
  onMoneyBlocked?: () => void;
};

type Draft = { activities: string[]; npcChoices: Record<string, string> };

const YEAR_NAMES = ['초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const nameOf = (id: string) => ACTIVITIES.find(a => a.id === id)?.name ?? id;
const won = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}만`;

/** 슬롯 배열을 사람이 읽는 한 줄로 — 여러 칸 활동은 한 번만. 비었으면 "쉰다". */
function summarize(d: Draft, npcName: (id: string) => string): string {
  const parts: string[] = [];
  d.activities.forEach((id, i) => {
    if (!id || (i > 0 && d.activities[i - 1] === id && (ACTIVITIES.find(a => a.id === id)?.slots ?? 1) > 1)) return;
    const npc = d.npcChoices[`${id}:${i}`];
    parts.push(npc ? `${nameOf(id)} · ${npcName(npc)}` : nameOf(id));
  });
  return parts.length ? parts.join(' / ') : '쉰다';
}

export function MonthPlanScreen({ state, onSetRoutine, onStart, existing, onCancel, onChooseGoal, onMoneyBlocked }: Props) {
  const block = getMonthBlock(state.week);
  const weeks = useMemo(
    () => Array.from({ length: block.endWeek - state.week + 1 }, (_, i) => state.week + i),
    [block.endWeek, state.week],
  );
  const replan = !!existing;
  const [drafts, setDrafts] = useState<Draft[]>(() => weeks.map(w => {
    const prev = existing?.weeks.find(x => x.week === w);
    return prev ? { activities: [...prev.activities], npcChoices: { ...prev.npcChoices } } : { activities: [], npcChoices: {} };
  }));
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [editing, setEditing] = useState<{ idx: number; slot: string } | null>(null);
  const [npcSelect, setNpcSelect] = useState<{ idx: number; key: string } | null>(null);
  const [showBudget, setShowBudget] = useState(true);
  // 월 계획 튜토리얼 — 이 화면을 처음 보는 플레이어에게 한 번(영속). 다시 짜기에서는 안 띄운다(이미 이 화면을 지나왔다).
  const [showTutorial, setShowTutorial] = useState(() => {
    if (existing) return false;
    try { return !localStorage.getItem(TUTORIAL_KEYS.monthSeen); } catch { return false; }
  });
  // 계측(설계안 §12 "지난달처럼만 누르고 끝낸 달") — 칸을 손으로 고친 횟수와 채우기 버튼을 누른 횟수. 렌더를 안 일으키게 ref.
  const touched = useRef({ edits: 0, fills: 0 });
  const [error, setError] = useState<string | null>(null);
  // 친구 초대(monthInvites) — 상태를 읽기만 하는 결정론적 함수라 다시 그려도 같은 초대다. 답은 시작할 때 계획에 실린다.
  // 다시 짤 때는 처음 받은 초대와 답 그대로(새로 받지 않는다).
  const invites: MonthInvite[] = useMemo(
    () => (existing ? (existing.invites ?? []).map(({ accepted: _a, ...inv }) => { void _a; return inv; }) : generateMonthInvites(state)),
    [existing, state],
  );
  const [answers, setAnswers] = useState<Record<number, boolean>>(
    () => Object.fromEntries((existing?.invites ?? []).map((inv, i) => [i, inv.accepted])),
  );
  const unanswered = invites.some((_, i) => answers[i] === undefined);
  const pinnedFor = (week: number, slot: number) =>
    invites.find((inv, i) => answers[i] === true && inv.week === week && inv.slotIdx === slot);

  const npcName = (id: string) => state.npcs.find(n => n.id === id)?.name ?? id;
  const isVac = (w: number) => getWeekInfo(w).isVacation;
  /** 그 주 좌표로 맞춘 상태 — 활동 목록·칸 수·방학 횟수 제한이 그 주 기준이 되게. */
  const stateAt = (w: number): GameState => ({ ...state, week: w, isVacation: isVac(w) });

  const routineDue = getRoutineDueCost(state);
  const reserve = drafts.reduce((sum, d) => sum + plannedWeekCost(d.activities, state.year), 0);
  const spendable = Math.round((state.money - routineDue - reserve) * 10) / 10;
  const overspent = spendable < 0;
  // 학기 주가 끼어 있는데 루틴이 비면 그 주에서 재생이 멈춘다(checkPlannedWeek '방과후 루틴이 비어 있어요').
  // 저장을 먼저 막아 계획을 세운 자리에서 고르게 한다 — 판정은 확정 잠금(getConfirmGate missingRoutine)과 같은 근거.
  const noRoutine = !state.routineSlot2 && weeks.some(w => !isVac(w));
  // 돈 회고 — 주간 화면이 확정 잠금을 알리는 것(MainWeekScreen onMoneyBlocked)과 같은 자리. 스토어가 달마다 한 번만 센다.
  useEffect(() => {
    if (overspent) onMoneyBlocked?.();
  }, [overspent, onMoneyBlocked]);
  const hasSemester = weeks.some(w => !isVac(w));
  // 화면에 실제로 있는 칸의 스텝만 — 마운트 동안 바뀌지 않는 값들이다(초대는 상태를 읽기만 하는 결정론 함수).
  const tutorialSteps = useMemo(() => monthPlanSteps({ hasInvites: !replan && invites.length > 0, hasRoutine: hasSemester }), [replan, invites.length, hasSemester]);
  const semesterWeeksLeft = remainingSemesterWeeks(state.week);
  const exams = getExamsInMonth(state.year, block).filter(e => e.week >= state.week);
  const nextExam = getNextMonthOpeningExam(state.year, block);
  const companionNpcs = state.npcs.filter(n => n.met && isNpcEnrolled(n, state));

  /**
   * 수락한 초대의 칸은 약속으로 고정 — 복사·편집이 덮어써도 다시 박는다(못 지킨 약속은 −2라 화면이 실수로 지우면 안 된다).
   * 박은 뒤에는 **칸의 활동과 맞지 않게 된 동행 키를 지운다**. 수락·복사·「지난주처럼」·편집이 모두 여기를 지나므로
   * 정리도 여기 하나다 — 예전엔 편집(setDraft)만 지워, 친구와 놀기 칸 위로 초대를 수락하면 `hang-out:1`이 남아
   * 엔진 검증(validateMonthPlan)이 계획을 거부했다(3자 검수).
   */
  const withPins = (week: number, d: Draft, acc: Record<number, boolean> = answers): Draft => {
    let { activities, npcChoices } = d;
    invites.forEach((inv, i) => {
      if (acc[i] !== true || inv.week !== week) return;
      activities = assignSlot(activities, inv.slotIdx, inv.activityId);
      npcChoices = { ...npcChoices, [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId };
    });
    const pinned = activities;
    npcChoices = Object.fromEntries(Object.entries(npcChoices).filter(([key]) => {
      const m = /^(.+):(\d+)$/.exec(key);
      return !!m && pinned[Number(m[2])] === m[1];
    }));
    return { activities, npcChoices };
  };

  const answer = (i: number, accepted: boolean) => {
    playSfx('tap');
    const next = { ...answers, [i]: accepted };
    setAnswers(next);
    const inv = invites[i];
    setDrafts(ds => ds.map((d, idx) => {
      if (weeks[idx] !== inv.week) return d;
      if (accepted) return withPins(inv.week, d, next);
      // 수락을 거절로 바꾸면 그 칸을 비운다
      const key = `${inv.activityId}:${inv.slotIdx}`;
      if (d.npcChoices[key] !== inv.npcId) return d;
      const { [key]: _drop, ...rest } = d.npcChoices;
      void _drop;
      return { activities: assignSlot(d.activities, inv.slotIdx, ''), npcChoices: rest };
    }));
  };

  /** 칸을 바꾸면 그 칸을 가리키던 동행은 지운다(withPins) — 남겨 두면 엔진 검증(validateMonthPlan)이 계획을 거부한다. */
  const setDraft = (idx: number, patch: Partial<Draft>) =>
    setDrafts(ds => ds.map((d, i) => (i === idx ? withPins(weeks[i], { ...d, ...patch }) : d)));

  /** 루틴 칸 판정용 지금 주 판 — 렌더마다 새 객체면 팝업의 판정 메모가 매번 깨져 미리보기를 다시 돌린다. */
  const routineState = useMemo(() => ({ ...state, week: state.week, isVacation: getWeekInfo(state.week).isVacation }), [state]);

  /** 저장 전 초안을 이번 달 계획 모양으로 — 루틴 칸 판정이 잠금 판단에 초안의 봉투를 보게 한다. */
  const draftPlan: MonthPlan = useMemo(() => ({
    year: state.year, month: block.index,
    weeks: weeks.map((week, i) => ({ week, activities: drafts[i].activities, npcChoices: drafts[i].npcChoices })),
  }), [state.year, block.index, weeks, drafts]);

  /** 이 주를 고칠 때 쓸 수 있는 돈 — 다른 주 예약과 아직 안 낸 학원비를 뺀다(그 주 몫은 지금 고르는 중). */
  const availableFor = (idx: number) =>
    state.money - routineDue - drafts.reduce((s, d, i) => (i === idx ? s : s + plannedWeekCost(d.activities, state.year)), 0);

  /**
   * 이 주 밖(같은 달의 다른 방학 주)에 짜 둔 방학 활동 횟수 — 방학당 횟수 제한은 방학 전체를 센다.
   * 그 주 초안만 세면 4주 모두에 「할머니댁」(방학당 1회)을 넣을 수 있었고, 재생은 넘친 주를 건너뛰면서
   * 그 비용은 봉투에 잡아 두었다(3자 검수).
   */
  const vacUseOutside = (idx: number): Record<string, number> => {
    const counts: Record<string, number> = {};
    drafts.forEach((d, i) => {
      if (i === idx || !isVac(weeks[i])) return;
      for (const id of collapseActivityChoices(d.activities)) counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  };

  /**
   * 방학당 횟수를 넘친 칸을 비운다 — 주 순서대로 세어 한도를 넘는 인스턴스는 지운다(동행 키도 withPins가 같이 정리).
   * 복사·「지난주처럼」은 피커를 안 거치므로 피커의 한도 판정(vacUseOutside)이 못 막는다. 넘친 주는 재생이
   * 건너뛰면서 그 비용은 봉투에 잡아 두었다(3자 재검수).
   */
  const capVacationUses = (ds: Draft[]): Draft[] => {
    const used: Record<string, number> = {};
    return ds.map((d, i) => {
      if (!isVac(weeks[i])) return d;
      const activities = [...d.activities];
      for (const inst of collapseActivityChoicesWithSlots(activities)) {
        const a = ACTIVITIES.find(x => x.id === inst.id);
        if (!a) continue;
        if (isVacationLimitReached(a, stateAt(weeks[i]), used[a.id] ?? 0)) {
          for (const k of inst.slots) activities[k] = '';
          continue;
        }
        used[a.id] = (used[a.id] ?? 0) + 1;
      }
      return withPins(weeks[i], { activities, npcChoices: d.npcChoices });
    });
  };

  /** 같은 계절의 첫 주를 나머지에 복사(모든 주 똑같이). */
  const copyFirstToAll = () => {
    playSfx('tap');
    touched.current.fills++;
    setDrafts(ds => {
      const firstOf = (vac: boolean) => ds.find((_, i) => isVac(weeks[i]) === vac);
      return capVacationUses(ds.map((d, i) => {
        const src = firstOf(isVac(weeks[i]));
        return src ? withPins(weeks[i], { activities: [...src.activities], npcChoices: { ...src.npcChoices } }) : d;
      }));
    });
  };

  /** 지난주 확정 계획을 같은 계절의 모든 주에 채운다("지난주처럼"과 같은 스냅샷). */
  const snapshot = state.lastWeekendPlan;
  const fillFromLast = () => {
    if (!snapshot) return;
    playSfx('tap');
    touched.current.fills++;
    setDrafts(ds => capVacationUses(ds.map((d, i) => (isVac(weeks[i]) === snapshot.isVacation
      ? withPins(weeks[i], { activities: [...snapshot.activities].slice(0, slotCountForWeek(state, weeks[i])), npcChoices: { ...snapshot.npcChoices } })
      : d))));
  };

  const start = () => {
    playSfx('confirm');
    const reason = onStart({
      year: state.year,
      month: block.index,
      weeks: weeks.map((week, i) => ({ week, activities: drafts[i].activities, npcChoices: drafts[i].npcChoices })),
      invites: invites.map((inv, i) => ({ ...inv, accepted: answers[i] === true })),
    });
    setError(reason);
    if (reason === null) {
      recordTelemetry({
        t: 'month', y: state.year, m: block.index, week: state.week, replan, ...touched.current,
        invitesAccepted: invites.filter((_, i) => answers[i] === true).length,
        invitesDeclined: invites.filter((_, i) => answers[i] === false).length,
      });
    }
  };

  const r2 = state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2) : null;
  const r3 = state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3) : null;

  const editingIdx = editing?.idx ?? npcSelect?.idx ?? null;
  const editingWeek = editingIdx !== null ? weeks[editingIdx] : null;

  return (
    <div data-testid="month-plan" style={{
      minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)',
      padding: '16px 16px 120px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600, margin: '0 auto',
      boxSizing: 'border-box', wordBreak: 'keep-all',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{block.label}</h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {replan ? '남은 주 다시 짜기 · ' : ''}{YEAR_NAMES[state.year - 1]} · {block.kind === 'mixed' ? '학기 + 방학' : block.kind === 'vacation' ? '방학' : `${state.semester}학기`} · {state.week}~{block.endWeek}주차
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', lineHeight: 1.5 }}>
          잔액 {won(state.money)}원<br />{incomeNote(state)}
        </div>
      </header>

      {nextExam && (
        <div role="note" style={{ fontSize: '0.78rem', color: 'var(--blue)', background: chipSurface('rgba(125,163,217,0.12)'), borderRadius: 10, padding: '8px 12px' }}>
          다음 달 첫 주에 {EXAM_TYPE_LABELS[nextExam.type]}가 있어요 — 이번 달 마지막 주가 준비 주예요.
        </div>
      )}

      <section aria-label="이번 달 예산" data-tutorial="month-budget" style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>이번 달 쓸 수 있는 돈</span>
          <button type="button" className="btn-reset" onClick={() => setShowBudget(v => !v)}
            style={{ minHeight: 44, padding: '0 4px', color: 'var(--accent-soft)', fontSize: '0.75rem' }}>
            {showBudget ? '내역 접기' : '내역 보기'}
          </button>
        </div>
        {/* 1.9rem은 주변 글자(0.8rem)의 두 배가 넘어 화면에서 돈만 튀었다 — 다른 칸 제목보다 한 단계 크게만. */}
        <div data-testid="month-spendable" style={{ fontSize: '1.2rem', fontWeight: 700, color: overspent ? 'var(--red)' : 'var(--text-primary)' }}>
          {won(spendable)}<span style={{ fontSize: '0.85rem', fontWeight: 600 }}>원</span>
        </div>
        {showBudget && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', rowGap: 4, columnGap: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
            <span>지금 잔액(이번 달 용돈 포함)</span><span style={{ textAlign: 'right' }}>{won(state.money)}</span>
            {routineDue > 0 && (<><span>학원 — 아직 안 낸 이번 달 몫</span><span style={{ textAlign: 'right', color: 'var(--red)' }}>−{won(routineDue)}</span></>)}
            <span>주말·방학 예약(떼어 둔 돈)</span><span style={{ textAlign: 'right', color: reserve > 0 ? 'var(--yellow)' : 'var(--text-secondary)' }}>{reserve > 0 ? '−' : ''}{won(reserve)}</span>
          </div>
        )}
      </section>

      {hasSemester && (
        <section aria-label="방과후 루틴" data-tutorial="month-routine" style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>방과후 · 한 달 등록</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>바꾸면 남은 주 몫을 다시 내요</span>
          </div>
          {[{ slot: 'routine1', act: r2, label: '①', weeks: state.routineSlot2Weeks }, { slot: 'routine2', act: r3, label: '②', weeks: state.routineSlot3Weeks }].map(({ slot, act, label, weeks: streak }) => (
            <button key={slot} type="button" className="btn-reset" onClick={() => { playSfx('tap'); setEditing({ idx: 0, slot }); }}
              style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: slot === 'routine1' ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'left' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label} {act ? act.name : slot === 'routine1' ? '방과후 활동을 고르세요' : '자유시간'}</span>
                {act && (() => {
                  const unit = getActivityCost(act, state.year);
                  return <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{unit > 0 ? `주 ${won(unit)} · 이번 달 학기 ${semesterWeeksLeft}주` : unit < 0 ? `수입 주 ${won(-unit)} · 일한 주에 받아요` : '무료'}</span>;
                })()}
              </span>
              {act && streak > 0 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--yellow)', background: chipSurface('rgba(224,179,84,0.14)'), borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>연속 {streak}주째</span>
              )}
            </button>
          ))}
        </section>
      )}

      {!replan && invites.length > 0 && (
        <div data-tutorial="month-invite" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invites.map((inv, i) => (
            <InviteCard key={`${inv.npcId}-${inv.week}`} invite={inv} answer={answers[i]} npcName={npcName(inv.npcId)}
              cost={plannedWeekCost([inv.activityId], state.year)} onAnswer={(a) => answer(i, a)} />
          ))}
        </div>
      )}

      {/* T68 학기 목표 — 주별 계획 바로 위. 칩이 스스로 고를 수 있는 때(학기 첫 두 주)와 진행 중 표시를 가른다. */}
      {onChooseGoal && <SemesterGoalChip state={state} onChoose={onChooseGoal} />}

      <section aria-label="주별 계획" data-tutorial="month-weeks" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{block.kind === 'vacation' ? '방학 일과' : '주말'}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {snapshot && (
              <button type="button" className="btn-reset" onClick={fillFromLast}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-secondary)', fontSize: '0.75rem' }}>
                지난주처럼 채우기
              </button>
            )}
            <button type="button" className="btn-reset" onClick={copyFirstToAll}
              style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-secondary)', fontSize: '0.75rem' }}>
              모든 주 똑같이
            </button>
          </span>
        </div>

        {weeks.map((w, idx) => {
          const d = drafts[idx];
          const open = openIdx === idx;
          const vac = isVac(w);
          const slots = slotCountForWeek(state, w);
          const exam = exams.find(e => e.week === w);
          const firstVac = vac && (idx === 0 || !isVac(weeks[idx - 1]));
          const cost = plannedWeekCost(d.activities, state.year);
          return (
            <div key={w}>
              {firstVac && block.kind === 'mixed' && (
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '6px 4px' }}>방학 부분 · 하루 {slots}칸 · 방과후 없음</div>
              )}
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden' }}>
                <button type="button" className="btn-reset" aria-expanded={open} onClick={() => setOpenIdx(open ? null : idx)}
                  style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: 32, flexShrink: 0 }}>{getWeekOfMonth(w)}주</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span data-testid={`week-summary-${w}`} style={{ fontSize: '0.82rem' }}>{summarize(d, npcName)}{cost > 0 ? ` (${won(cost)})` : ''}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {exam && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--blue)', background: chipSurface('rgba(125,163,217,0.14)'), borderRadius: 6, padding: '2px 6px' }}>{EXAM_TYPE_LABELS[exam.type]} 주</span>}
                      {invites.some((inv, i) => answers[i] === true && inv.week === w) && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-soft)', background: chipSurface('rgba(240,164,122,0.14)'), borderRadius: 6, padding: '2px 6px' }}>
                          {invites.filter((inv, i) => answers[i] === true && inv.week === w).map(inv => `${josa(npcName(inv.npcId), '와/과')} 약속`).join(' · ')}
                        </span>
                      )}
                      {(w === 19 || w === 42) && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--yellow)', background: chipSurface('rgba(224,179,84,0.14)'), borderRadius: 6, padding: '2px 6px' }}>학기 마지막 주</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
                </button>
                {open && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${vac ? Math.min(slots, 3) : 2}, minmax(0,1fr))`, gap: 8, padding: '0 14px 12px' }}>
                    {Array.from({ length: slots }, (_, k) => {
                      const id = d.activities[k];
                      const dayLabel = vac ? `${k + 1}칸` : k === 0 ? '토' : '일';
                      const pin = pinnedFor(w, k);
                      return (
                        <button key={k} type="button" className="btn-reset" data-testid={`slot-${w}-${k}`}
                          disabled={!!pin} aria-label={pin ? `${dayLabel} — ${josa(npcName(pin.npcId), '와/과')} 약속(초대에서 바꿀 수 있어요)` : undefined}
                          onClick={() => { playSfx('tap'); setEditing({ idx, slot: `weekend${k + 1}` }); }}
                          style={{ minHeight: 56, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2, padding: '6px 10px', textAlign: 'left' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{dayLabel}</span>
                          <span style={{ fontSize: '0.8rem' }}>{id ? nameOf(id) : '비움'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {exams.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
          이번 달 시험: {exams.map(e => `${getWeekOfMonth(e.week)}주차 ${EXAM_TYPE_LABELS[e.type]}`).join(' · ')}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: '0.78rem', color: 'var(--red)', padding: '0 4px' }}>{error}</div>}

      <div data-tutorial="month-start" className="bottom-action" style={onCancel ? { display: 'flex', gap: 8 } : undefined}>
        {onCancel && (
          <button type="button" className="btn btn-secondary" data-testid="month-plan-cancel" onClick={onCancel} style={{ flex: '0 0 auto', width: 'auto', minWidth: 88 }}>{replan ? '그대로' : '닫기'}</button>
        )}
        <button type="button" className="btn btn-primary" disabled={noRoutine || overspent || unanswered} onClick={start} style={onCancel ? { flex: 1 } : undefined}>
          {noRoutine ? '⬆ 방과후 루틴을 골라 주세요' : overspent ? '⬆ 돈이 부족해요 — 계획을 줄이세요' : unanswered ? '⬆ 친구 초대에 답해 주세요' : replan ? '이대로 저장' : '계획 저장'}
        </button>
      </div>

      {editing && editingWeek !== null && (
        <SlotEditPopup
          editingSlot={editing.slot}
          setEditingSlot={(slot) => setEditing(slot ? { idx: editing.idx, slot } : null)}
          state={editing.slot.startsWith('routine') ? routineState : stateAt(editingWeek)}
          // 루틴 칸: 결제는 실제 판 그대로, 잠금 판단에만 저장 전 초안 계획을 씌운다(makeRoutineChangeCheck judgePlan).
          routineJudgePlan={editing.slot.startsWith('routine') ? draftPlan : undefined}
          activities={getAvailableActivities(stateAt(editing.slot.startsWith('routine') ? state.week : editingWeek))}
          selectedActivities={drafts[editing.idx].activities}
          setSelectedActivities={(ids) => { touched.current.edits++; setDraft(editing.idx, { activities: ids }); }}
          npcChoices={drafts[editing.idx].npcChoices}
          maxSlots={slotCountForWeek(state, editingWeek)}
          currentSlots={drafts[editing.idx].activities.reduce((n, id) => n + (id ? 1 : 0), 0)}
          // 루틴 칸은 어느 주의 칸도 아니다 — 모든 주 초안의 예약을 뺀 돈(spendable)으로 잰다(availableFor는 그 주 몫을 남긴다).
          availableMoney={editing.slot.startsWith('routine') ? spendable : availableFor(editing.idx)}
          extraVacUse={vacUseOutside(editing.idx)}
          onSetRoutine={(a, b) => { touched.current.edits++; onSetRoutine(a, b); }}
          setNpcSelectFor={(v) => { if (v) setNpcSelect({ idx: editing.idx, key: v }); }}
          setLastReaction={() => {}}
        />
      )}
      {npcSelect && (
        <NpcSelectModal
          metNpcs={companionNpcs}
          year={state.year}
          npcSelectFor={npcSelect.key}
          onSelect={(npcId) => {
            const [, idxStr, activityId] = npcSelect.key.split(':');
            const slotIdx = parseInt(idxStr);
            const d = drafts[npcSelect.idx];
            touched.current.edits++;
            setDraft(npcSelect.idx, {
              activities: assignSlot(d.activities, slotIdx, activityId),
              npcChoices: { ...d.npcChoices, [`${activityId}:${slotIdx}`]: npcId },
            });
            setNpcSelect(null);
          }}
          onCancel={() => setNpcSelect(null)}
        />
      )}
      {/* 튜토리얼 — 칸 고르기 창이 열린 동안엔 CSS로만 숨긴다(언마운트하면 스텝이 처음으로 돌아간다 — MainWeekScreen과 같은 규칙). */}
      {showTutorial && (
        <div style={{ display: editing || npcSelect ? 'none' : 'contents' }}>
          <Tutorial
            steps={tutorialSteps}
            routineSet={!!state.routineSlot2}
            onComplete={() => {
              setShowTutorial(false);
              try {
                // 이 화면 몫만 적는다 — 주간 화면이 메인이 된 뒤(2026-10-29) 주간 튜토리얼은 따로 끝까지 돈다. 예전처럼 done·ever_seen까지
                // 적으면 주간 튜토리얼 도중 계획 화면을 열었다 돌아온 첫 판이 나머지 스텝(루틴·친구·확정)을 못 봤다(3자 검수).
                localStorage.setItem(TUTORIAL_KEYS.monthSeen, '1');
              } catch { /* storage unavailable */ }
            }}
          />
        </div>
      )}
    </div>
  );
}

/** 친구 초대 카드 — 좋아(그 칸을 약속으로 고정) / 다음에(저장할 때 친밀도 −1). 답한 뒤에도 바꿀 수 있다. */
function InviteCard({ invite, answer, npcName, cost, onAnswer }: {
  invite: MonthInvite; answer: boolean | undefined; npcName: string; cost: number; onAnswer: (accepted: boolean) => void;
}) {
  const vac = getWeekInfo(invite.week).isVacation;
  const when = `${getWeekOfMonth(invite.week)}주차 ${vac ? '하루' : invite.slotIdx === 0 ? '토요일' : '일요일'}`;
  // 친구마다 말투가 다르다(talkData/inviteVoices.ts) — 누가 불러도 같은 말이면 초대가 달마다 다른 요청이 못 된다.
  const line = inviteLine(invite.npcId, invite.activityId, invite.week, when);
  const decline = inviteVoice(invite.npcId).decline;
  return (
    <section aria-label={`${npcName}의 초대`} data-testid={`invite-${invite.npcId}`} style={{
      background: 'var(--bg-card-hover)', border: '1px solid rgba(240,164,122,0.35)', borderRadius: 14,
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-soft)', fontWeight: 600 }}>{npcName}의 초대 · {when}</span>
        <span style={{ fontSize: '0.9rem' }}>{line}</span>
      </div>
      {answer === false && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{decline.startsWith('"') ? `${npcName}: ${decline}` : decline}</div>}
      {answer === true && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>약속했다. 그 칸은 {josa(npcName, '와/과')} 보내는 시간으로 비워 둔다.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {/* btn-reset은 여백 0·왼쪽 정렬이라 테두리에 글자가 붙는다 — 계획 띠 버튼(#541)과 같이 여백·가운데 정렬을 준다. */}
        <button type="button" className="btn-reset" aria-pressed={answer === true} onClick={() => onAnswer(true)} style={{
          minHeight: 44, padding: '6px 10px', textAlign: 'center', borderRadius: 10, background: answer === true ? 'var(--accent)' : 'transparent',
          color: answer === true ? 'var(--btn-ink)' : 'var(--text-primary)', border: '1px solid var(--accent)', fontWeight: 700,
        }}>좋아{cost > 0 ? ` · ${cost}만` : ''}</button>
        <button type="button" className="btn-reset" aria-pressed={answer === false} onClick={() => onAnswer(false)} style={{
          minHeight: 44, padding: '6px 10px', textAlign: 'center', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
          background: answer === false ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)',
        }}>다음에</button>
      </div>
    </section>
  );
}
