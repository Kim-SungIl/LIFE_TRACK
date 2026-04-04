import { StatKey, STAT_LABELS, getGrade } from '../engine/types';

interface Props {
  statKey: StatKey;
  value: number;
  change?: number;
}

export function StatBar({ statKey, value, change }: Props) {
  const grade = getGrade(value);
  const rounded = Math.round(value);

  return (
    <div className="stat-row">
      <span className="stat-label">{STAT_LABELS[statKey]}</span>
      <div className="stat-bar-bg">
        <div
          className="stat-bar-fill"
          style={{ width: `${rounded}%`, background: grade.color }}
        />
      </div>
      <span className="stat-grade" style={{ color: grade.color }}>{grade.grade}</span>
      <span className="stat-value">{rounded}</span>
      {change !== undefined && change !== 0 && (
        <span style={{
          width: 40,
          fontSize: '0.7rem',
          fontWeight: 600,
          color: change > 0 ? 'var(--green)' : change < 0 ? 'var(--red)' : 'var(--text-muted)',
          textAlign: 'right',
        }}>
          {change > 0 ? '+' : ''}{Math.round(change * 10) / 10}
        </span>
      )}
    </div>
  );
}
