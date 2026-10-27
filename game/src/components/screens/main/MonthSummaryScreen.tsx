// 월말 결산 한 장 — 그 달 계획에 답하는 화면(설계안 §7). 재생 카드가 주간 결산을 흡수했으니 월말에 이것 하나만 뜬다.
//   N월의 나 / 한 줄 총평(가장 강한 신호 하나) / 계획 vs 실제 / 약속 / 변화(방향만, 숫자 없음) / 돈 / [다음 달 계획하기]
// 사건 기억 회수·CG는 쓰지 않는다(학년말·엔딩의 몫). 내용은 엔진(monthPlayback.buildMonthSummary)이 만든다.
import type { ReactNode } from 'react';
import { playSfx } from '../../../audio/sfx';
import type { MonthSummary } from '../../../engine/monthPlayback';
import { chipSurface } from '../surface';

type Props = {
  summary: MonthSummary;
  /** 다음 달 이름("5월"). 학년의 마지막 달이면 null. */
  nextLabel: string | null;
  /** 이번 달을 마친 잔액(다음 달 용돈·학원비가 들어가기 전). */
  moneyLeft: number;
  /** 다음 달 첫 주에 들어온 용돈·낸 학원비(weekLog.monthMoney) — 없으면 null. */
  nextMonthMoney: { allowance: number; routinePaid: number } | null;
  /** 재생이 지나친 이야기 — 다음 달에 이어서 할 수 있다. */
  missedTalks: number;
  onContinue: () => void;
};

const won = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}만`;

export function MonthSummaryScreen({ summary, nextLabel, moneyLeft, nextMonthMoney, missedTalks, onContinue }: Props) {
  const row = (label: string, body: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 10, alignItems: 'baseline', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{label}</span>
      <span>{body}</span>
    </div>
  );
  return (
    <div data-testid="month-summary" style={{
      minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)',
      padding: '24px 16px 120px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto',
      boxSizing: 'border-box', wordBreak: 'keep-all',
    }}>
      <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{summary.label}의 나</h1>
      <p data-testid="month-verdict" style={{ margin: 0, fontSize: '1rem', lineHeight: 1.7, fontStyle: 'italic' }}>"{summary.verdict}"</p>

      <section aria-label="이번 달 정리" style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {summary.routine && row('방과후', <span data-testid="month-routine">{summary.routine.total}주 중 {summary.routine.kept}주 다 갔다</span>)}
        {summary.choiceMissedWeeks > 0 && row(summary.routine ? '주말' : '일과', `계획대로 못 한 주 ${summary.choiceMissedWeeks}번`)}
        {summary.promises.length > 0 && row('약속', (
          <span data-testid="month-promises" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {summary.promises.map((p, i) => <span key={i} style={{ color: p.kept ? 'var(--green)' : 'var(--red)' }}>{p.name} {p.kept ? '✔' : '✕'}</span>)}
          </span>
        ))}
        {row('변화', summary.statDirs.length === 0 && summary.friendDirs.length === 0
          ? <span style={{ color: 'var(--text-secondary)' }}>크게 달라진 건 없다</span>
          : (
            <span data-testid="month-changes" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {summary.statDirs.map(d => (
                <span key={d.key} style={{ fontSize: '0.78rem', fontWeight: 600, color: d.dir === 'up' ? 'var(--green)' : 'var(--red)', background: chipSurface(d.dir === 'up' ? 'rgba(110,190,140,0.14)' : 'rgba(214,110,110,0.14)'), borderRadius: 6, padding: '2px 8px' }}>{d.label} {d.dir === 'up' ? '↑' : '↓'}</span>
              ))}
              {summary.friendDirs.map(d => (
                <span key={d.npcId} style={{ fontSize: '0.78rem', fontWeight: 600, color: d.dir === 'up' ? 'var(--blue)' : 'var(--red)', background: chipSurface(d.dir === 'up' ? 'rgba(125,163,217,0.14)' : 'rgba(214,110,110,0.14)'), borderRadius: 6, padding: '2px 8px' }}>{d.name} {d.dir === 'up' ? '♥↑' : '♥↓'}</span>
              ))}
            </span>
          ))}
        {row('돈', (
          <span>
            {won(moneyLeft)}원 남음{nextLabel ? ' → 다음 달로' : ''}
            {nextMonthMoney && nextMonthMoney.allowance > 0 && (
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {nextLabel} 용돈 +{won(nextMonthMoney.allowance)}원{nextMonthMoney.routinePaid > 0 ? ` · 학원비 −${won(nextMonthMoney.routinePaid)}원(한 달 등록)` : ''}
              </span>
            )}
          </span>
        ))}
      </section>

      {missedTalks > 0 && (
        <div role="note" data-testid="month-missed-talks" style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', background: chipSurface('rgba(240,164,122,0.12)'), borderRadius: 10, padding: '10px 12px' }}>
          이번 달 못 다한 이야기 {missedTalks} — 다음 달에 💬 대화로 이어서 할 수 있어요.
        </div>
      )}

      <div className="bottom-action">
        <button type="button" className="btn btn-primary" onClick={() => { playSfx('confirm'); onContinue(); }}>
          {nextLabel ? `${nextLabel} 계획하기 ▶` : '계속 ▶'}
        </button>
      </div>
    </div>
  );
}
