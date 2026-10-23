// 한 달 계획 화면 — 달 첫 주(또는 계획 없이 맞은 달 중간)에 그 달 남은 주의 주말(방학이면 자유) 칸을 한 번에 짠다.
// 설계: docs/monthly-plan-design-2026-10.md §3, 목업 https://claude.ai/artifact/UJcLgUvvRWvfDR7wPuje4V
//
// 무엇을 하고 무엇을 안 하나
//   · 주마다 칸을 고른다 — 고르기는 주간 화면과 **같은** 팝업(SlotEditPopup)·동행 창(NpcSelectModal)을 그 주 좌표로
//     다시 쓴다. 활동 목록은 그 주가 학기인지 방학인지에 맞춘 상태로 묻는다(방학 전용 활동·칸 수가 다르다).
//   · 방과후 루틴은 지금처럼 바꾼다(onSetRoutine) — 바꾸는 순간 남은 학기 주 몫을 낸다(monthlyMoney, 결정 (가)).
//   · 예산은 "쓸 수 있는 돈 = 잔액 − 아직 안 낸 학원비 − 이 계획의 예약"으로 실시간 보인다. 모자라면 시작을 막는다.
//   · 시작하면 store.setMonthPlan으로 저장한다(검증은 엔진 하나 — validateMonthPlan). 이 화면은 그 결과를 보여 줄 뿐.
//   · 진행은 아직 주마다다 — 계획을 저장하면 그 주 주간 화면이 계획한 칸으로 미리 채워진 채 뜬다(4주 자동 진행은 5단계).
import { useMemo, useState } from 'react';
import { playSfx } from '../../../audio/sfx';
import { ACTIVITIES, getActivityCost, getAvailableActivities } from '../../../engine/activities';
import { getExamsInMonth, getNextMonthOpeningExam } from '../../../engine/examSystem';
import { getRoutineDueCost, incomeNote, remainingSemesterWeeks } from '../../../engine/monthlyMoney';
import { plannedWeekCost, slotCountForWeek } from '../../../engine/monthPlan';
import { isNpcEnrolled } from '../../../engine/relationshipSignals';
import { EXAM_TYPE_LABELS, type GameState, type MonthPlan } from '../../../engine/types';
import { assignSlot } from '../../../engine/weekendPlan';
import { getMonthBlock, getWeekInfo, getWeekOfMonth } from '../../../engine/weekMath';
import { NpcSelectModal } from './NpcSelectModal';
import { chipSurface } from '../surface';
import { SlotEditPopup } from './SlotEditPopup';

type Props = {
  state: GameState;
  onSetRoutine: (slot2: string | null, slot3: string | null) => void;
  /** store.setMonthPlan — 저장되면 null, 아니면 이유. */
  onStart: (plan: MonthPlan) => string | null;
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

export function MonthPlanScreen({ state, onSetRoutine, onStart }: Props) {
  const block = getMonthBlock(state.week);
  const weeks = useMemo(
    () => Array.from({ length: block.endWeek - state.week + 1 }, (_, i) => state.week + i),
    [block.endWeek, state.week],
  );
  const [drafts, setDrafts] = useState<Draft[]>(() => weeks.map(() => ({ activities: [], npcChoices: {} })));
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [editing, setEditing] = useState<{ idx: number; slot: string } | null>(null);
  const [npcSelect, setNpcSelect] = useState<{ idx: number; key: string } | null>(null);
  const [showBudget, setShowBudget] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const npcName = (id: string) => state.npcs.find(n => n.id === id)?.name ?? id;
  const isVac = (w: number) => getWeekInfo(w).isVacation;
  /** 그 주 좌표로 맞춘 상태 — 활동 목록·칸 수·방학 횟수 제한이 그 주 기준이 되게. */
  const stateAt = (w: number): GameState => ({ ...state, week: w, isVacation: isVac(w) });

  const routineDue = getRoutineDueCost(state);
  const reserve = drafts.reduce((sum, d) => sum + plannedWeekCost(d.activities, state.year), 0);
  const spendable = Math.round((state.money - routineDue - reserve) * 10) / 10;
  const overspent = spendable < 0;
  const hasSemester = weeks.some(w => !isVac(w));
  const semesterWeeksLeft = remainingSemesterWeeks(state.week);
  const exams = getExamsInMonth(state.year, block).filter(e => e.week >= state.week);
  const nextExam = getNextMonthOpeningExam(state.year, block);
  const companionNpcs = state.npcs.filter(n => n.met && isNpcEnrolled(n, state));

  /** 칸을 바꾸면 그 칸을 가리키던 동행은 지운다 — 남겨 두면 엔진 검증(validateMonthPlan)이 계획을 거부한다. */
  const setDraft = (idx: number, patch: Partial<Draft>) =>
    setDrafts(ds => ds.map((d, i) => {
      if (i !== idx) return d;
      const next = { ...d, ...patch };
      const npcChoices = Object.fromEntries(Object.entries(next.npcChoices).filter(([key]) => {
        const m = /^(.+):(\d+)$/.exec(key);
        return !!m && next.activities[Number(m[2])] === m[1];
      }));
      return { ...next, npcChoices };
    }));

  /** 이 주를 고칠 때 쓸 수 있는 돈 — 다른 주 예약과 아직 안 낸 학원비를 뺀다(그 주 몫은 지금 고르는 중). */
  const availableFor = (idx: number) =>
    state.money - routineDue - drafts.reduce((s, d, i) => (i === idx ? s : s + plannedWeekCost(d.activities, state.year)), 0);

  /** 같은 계절의 첫 주를 나머지에 복사(모든 주 똑같이). */
  const copyFirstToAll = () => {
    playSfx('tap');
    setDrafts(ds => {
      const firstOf = (vac: boolean) => ds.find((_, i) => isVac(weeks[i]) === vac);
      return ds.map((d, i) => {
        const src = firstOf(isVac(weeks[i]));
        return src ? { activities: [...src.activities], npcChoices: { ...src.npcChoices } } : d;
      });
    });
  };

  /** 지난주 확정 계획을 같은 계절의 모든 주에 채운다("지난주처럼"과 같은 스냅샷). */
  const snapshot = state.lastWeekendPlan;
  const fillFromLast = () => {
    if (!snapshot) return;
    playSfx('tap');
    setDrafts(ds => ds.map((d, i) => (isVac(weeks[i]) === snapshot.isVacation
      ? { activities: [...snapshot.activities].slice(0, slotCountForWeek(state, weeks[i])), npcChoices: { ...snapshot.npcChoices } }
      : d)));
  };

  const start = () => {
    playSfx('confirm');
    const reason = onStart({
      year: state.year,
      month: block.index,
      weeks: weeks.map((week, i) => ({ week, activities: drafts[i].activities, npcChoices: drafts[i].npcChoices })),
    });
    setError(reason);
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
            {YEAR_NAMES[state.year - 1]} · {block.kind === 'mixed' ? '학기 + 방학' : block.kind === 'vacation' ? '방학' : `${state.semester}학기`} · {state.week}~{block.endWeek}주차
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

      <section aria-label="이번 달 예산" style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>이번 달 쓸 수 있는 돈</span>
          <button type="button" className="btn-reset" onClick={() => setShowBudget(v => !v)}
            style={{ minHeight: 44, padding: '0 4px', color: 'var(--accent-soft)', fontSize: '0.75rem' }}>
            {showBudget ? '내역 접기' : '내역 보기'}
          </button>
        </div>
        <div data-testid="month-spendable" style={{ fontSize: '1.9rem', fontWeight: 700, color: overspent ? 'var(--red)' : 'var(--text-primary)' }}>
          {won(spendable)}<span style={{ fontSize: '1rem', fontWeight: 600 }}>원</span>
        </div>
        {showBudget && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', rowGap: 4, columnGap: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
            <span>지금 잔액(이번 달 용돈 포함)</span><span style={{ textAlign: 'right' }}>{won(state.money)}</span>
            {routineDue > 0 && (<><span>학원 — 아직 안 낸 이번 달 몫</span><span style={{ textAlign: 'right', color: 'var(--red)' }}>−{won(routineDue)}</span></>)}
            <span>주말·방학 예약(떼어 둔 돈)</span><span style={{ textAlign: 'right', color: 'var(--yellow)' }}>−{won(reserve)}</span>
          </div>
        )}
      </section>

      {hasSemester && (
        <section aria-label="방과후 루틴" style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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

      <section aria-label="주별 계획" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      return (
                        <button key={k} type="button" className="btn-reset" data-testid={`slot-${w}-${k}`}
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

      <div className="bottom-action">
        <button type="button" className="btn btn-primary" disabled={overspent} onClick={start}>
          {overspent ? '⬆ 돈이 부족해요 — 계획을 줄이세요' : '이번 달 시작'}
        </button>
      </div>

      {editing && editingWeek !== null && (
        <SlotEditPopup
          editingSlot={editing.slot}
          setEditingSlot={(slot) => setEditing(slot ? { idx: editing.idx, slot } : null)}
          state={stateAt(editing.slot.startsWith('routine') ? state.week : editingWeek)}
          activities={getAvailableActivities(stateAt(editing.slot.startsWith('routine') ? state.week : editingWeek))}
          selectedActivities={drafts[editing.idx].activities}
          setSelectedActivities={(ids) => setDraft(editing.idx, { activities: ids })}
          npcChoices={drafts[editing.idx].npcChoices}
          maxSlots={slotCountForWeek(state, editingWeek)}
          currentSlots={drafts[editing.idx].activities.reduce((n, id) => n + (id ? 1 : 0), 0)}
          availableMoney={availableFor(editing.idx)}
          onSetRoutine={onSetRoutine}
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
            setDraft(npcSelect.idx, {
              activities: assignSlot(d.activities, slotIdx, activityId),
              npcChoices: { ...d.npcChoices, [`${activityId}:${slotIdx}`]: npcId },
            });
            setNpcSelect(null);
          }}
          onCancel={() => setNpcSelect(null)}
        />
      )}
    </div>
  );
}
