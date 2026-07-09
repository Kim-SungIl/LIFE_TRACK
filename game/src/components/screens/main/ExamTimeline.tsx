import { memo } from 'react';
import { getExamSchedule } from '../../../engine/examSystem';
import { ExamType, EXAM_TYPE_LABELS } from '../../../engine/types';

type Props = { year: number; week: number };

// 시험 종류별 마커 색 — 내신(중간/기말/단원평가) accent, 모의고사 blue, 수능 red.
const EXAM_COLOR: Record<ExamType, string> = {
  'unit-test': 'var(--accent-soft)',
  'midterm': 'var(--accent-soft)',
  'final': 'var(--accent-soft)',
  'mock': 'var(--blue)',
  'suneung': 'var(--red)',
};

// 연간 시험 스트립 — 48주 트랙에 시험 마커 + 현재 주 위치. 상시 노출.
// 초등 2점 → 중등 4점 → 고등 6점(+수능)의 밀도 차이가 "읽지 않아도 보이는" 스테이지 체감 장치.
// 데이터는 getExamSchedule SSOT 재사용 — 엔진 무변경.
export const ExamTimeline = memo(function ExamTimeline({ year, week }: Props) {
  const schedule = Object.entries(getExamSchedule(year))
    .map(([w, t]) => ({ week: Number(w), type: t as ExamType }))
    .sort((a, b) => a.week - b.week);
  const pct = (w: number) => ((w - 1) / 47) * 100;
  return (
    <div style={{
      background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
      borderRadius: 10, padding: '7px 12px 9px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          🗓️ 올해 시험 {schedule.length}번
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>W{week}/48</span>
      </div>
      <div style={{ position: 'relative', height: 10 }}>
        {/* 트랙 + 방학 구간(W20~24, W43~48) 옅은 음영 — 학기 리듬 표시 */}
        <div style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
        {[[20, 24], [43, 48]].map(([s, e]) => (
          <div key={s} style={{
            position: 'absolute', top: 3, height: 4,
            left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%`,
            background: 'rgba(224,138,91,0.18)', borderRadius: 2,
          }} />
        ))}
        {/* 현재 주 마커 */}
        <div style={{
          position: 'absolute', top: 0, height: 10, width: 2,
          left: `calc(${pct(week)}% - 1px)`,
          background: 'var(--text-primary)', borderRadius: 1, opacity: 0.9,
        }} />
        {/* 시험 마커 — 지난 시험은 흐리게 */}
        {schedule.map(({ week: w, type }) => (
          <div
            key={w}
            title={`W${w} ${EXAM_TYPE_LABELS[type]}`}
            style={{
              position: 'absolute', top: type === 'suneung' ? 1 : 2,
              width: type === 'suneung' ? 8 : 6, height: type === 'suneung' ? 8 : 6,
              left: `calc(${pct(w)}% - ${type === 'suneung' ? 4 : 3}px)`,
              background: EXAM_COLOR[type], borderRadius: '50%',
              opacity: w < week ? 0.3 : 1,
              boxShadow: type === 'suneung' && w >= week ? '0 0 5px rgba(217,100,88,0.7)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
});
