import { memo, useState } from 'react';
import type { GameState } from '../../../engine/types';
import {
  canPickSemesterGoal, currentSemesterGoal, goalHint, goalStage, goalTitle, offerSemesterGoals,
  type GoalOffer, type GoalStageTone,
} from '../../../engine/semesterGoal';
import { Dialog } from '../../Dialog';
import { GLASS_BASE } from '../surface';

// T68 학기 목표 칩 — 주간 화면에서 "이번 학기에 하고 싶은 일" 하나를 고르고 진행을 본다.
// 판정(고를 수 있는 때·후보·단계)은 전부 engine/semesterGoal.ts. 이 파일은 그리기만 한다.
// 진행은 숫자 없이 단계 말로만(hide-numbers). 보상이 없으니 "얻는다" 류 문구도 쓰지 않는다.

const TONE_COLOR: Record<GoalStageTone, string> = {
  idle: 'var(--text-muted)',
  progress: 'var(--accent-soft)',
  done: 'var(--green)',
  tight: 'var(--yellow)',
};

type Props = {
  state: GameState;
  onChoose: (offer: GoalOffer) => boolean;
};

export const SemesterGoalChip = memo(function SemesterGoalChip({ state, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const goal = currentSemesterGoal(state);
  const canPick = canPickSemesterGoal(state);
  if (!goal && !canPick) return null;

  const offers = canPick ? offerSemesterGoals(state) : [];
  const stage = goal ? goalStage(goal, state) : null;

  return (
    <>
      <button
        type="button" className="btn-reset"
        data-testid="semester-goal-chip"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', background: GLASS_BASE, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10, cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>
          {goal ? <>🎯 {goalTitle(goal)}</> : '🎯 이번 학기 목표 정하기'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', flexShrink: 0 }}>
          {stage && <span data-testid="semester-goal-stage" style={{ color: TONE_COLOR[stage.tone], fontWeight: 600 }}>{stage.label}</span>}
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
        </span>
      </button>

      {open && (
        <Dialog
          onClose={() => setOpen(false)}
          align="bottom" maxWidth={600} labelledBy="semester-goal-title"
          contentStyle={{
            background: 'var(--bg-secondary)', borderRadius: '16px 16px 0 0',
            padding: '14px 16px 20px', maxHeight: '80dvh', overflowY: 'auto',
          }}
        >
          <div id="semester-goal-title" style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>
            이번 학기 목표
          </div>
          {goal && stage && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{goalTitle(goal)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{goalHint(goal.kind)}</div>
              <div style={{ fontSize: '0.78rem', marginTop: 6, color: TONE_COLOR[stage.tone], fontWeight: 600 }}>{stage.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>학기 마지막 주에 돌아본다.</div>
            </div>
          )}
          {offers.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {goal ? '아직 시작 전이라 다시 고를 수 있다.' : '학기 초에 하나 정해 두면, 주말을 짤 때 떠오른다.'}
              </div>
              <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {offers.map(o => {
                  const selected = !!goal && goal.kind === o.kind && goal.npcId === o.npcId;
                  return (
                    <button
                      key={`${o.kind}:${o.npcId ?? ''}`}
                      type="button" role="listitem" className="btn-reset"
                      data-testid={`semester-goal-offer-${o.kind}`}
                      aria-pressed={selected}
                      onClick={() => { if (onChoose(o)) setOpen(false); }}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--bg-card)', minHeight: 44,
                        border: selected ? '1px solid var(--accent-soft)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{goalTitle({ ...o, year: state.year })}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{goalHint(o.kind)}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <button type="button" className="btn" onClick={() => setOpen(false)} style={{ marginTop: 14 }}>닫기</button>
        </Dialog>
      )}
    </>
  );
});
