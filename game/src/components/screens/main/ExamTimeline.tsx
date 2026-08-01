import { memo, useState } from 'react';
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

// 방학 구간(학기 리듬 음영) — SSOT 겸 툴팁 기간 표시에 재사용.
const VACATIONS: [number, number][] = [[20, 24], [43, 48]];

// 연간 시험 스트립 — 48주 트랙에 시험 마커 + 현재 주 위치. 상시 노출.
// 초등 2점 → 중등 4점 → 고등 6점(+수능)의 밀도 차이가 "읽지 않아도 보이는" 스테이지 체감 장치.
// 마우스오버/포커스/탭 시 각 마커(시험 주차·현재 주·방학 기간)를 툴팁으로 노출.
// 데이터는 getExamSchedule SSOT 재사용 — 엔진 무변경.
export const ExamTimeline = memo(function ExamTimeline({ year, week }: Props) {
  const schedule = Object.entries(getExamSchedule(year))
    .map(([w, t]) => ({ week: Number(w), type: t as ExamType }))
    .sort((a, b) => a.week - b.week);
  const pct = (w: number) => ((w - 1) / 47) * 100;

  // 활성 툴팁: id로 식별해 인접 마커 간 hover 전환 시 깜빡임 방지. left는 % 위치.
  const [tip, setTip] = useState<{ id: string; text: string; left: number } | null>(null);
  // 히트영역(투명)에 붙는 공통 핸들러 — 데스크톱 hover/포커스 + 모바일 탭 토글.
  const tipProps = (id: string, text: string, left: number) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': text,
    onMouseEnter: () => setTip({ id, text, left }),
    onMouseLeave: () => setTip(cur => (cur?.id === id ? null : cur)),
    onFocus: () => setTip({ id, text, left }),
    onBlur: () => setTip(cur => (cur?.id === id ? null : cur)),
    onClick: () => setTip(cur => (cur?.id === id ? null : { id, text, left })),
  });

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
        {/* 툴팁 — 트랙 위에 떠서 표시. 가장자리 오버플로 방지로 left 8~92% 클램프. */}
        {tip && (
          <div
            role="tooltip"
            style={{
              position: 'absolute', bottom: 'calc(100% + 4px)',
              left: `${Math.min(92, Math.max(8, tip.left))}%`,
              transform: 'translateX(-50%)',
              background: 'var(--text-primary)', color: 'var(--bg-primary, #2a2230)',
              fontSize: '0.62rem', fontWeight: 600, whiteSpace: 'nowrap',
              padding: '3px 7px', borderRadius: 5, pointerEvents: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)', zIndex: 5,
            }}
          >
            {tip.text}
          </div>
        )}
        {/* 트랙 기준선 */}
        <div style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
        {/* 방학 구간 음영 + 히트영역(기간 툴팁) */}
        {VACATIONS.map(([s, e]) => {
          const mid = (pct(s) + pct(e)) / 2;
          return (
            <div
              key={s}
              {...tipProps(`vac-${s}`, `방학 · W${s}~${e}`, mid)}
              style={{
                position: 'absolute', top: 0, height: 10, cursor: 'help',
                left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%`,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: 0, right: 0, height: 4,
                background: 'rgba(224,138,91,0.18)', borderRadius: 2,
              }} />
            </div>
          );
        })}
        {/* 현재 주 마커 + 히트영역(현재 주 툴팁) */}
        <div
          {...tipProps('now', `지금 · W${week}`, pct(week))}
          style={{
            position: 'absolute', top: -2, height: 14, width: 14, cursor: 'help',
            left: `calc(${pct(week)}% - 7px)`,
          }}
        >
          <div style={{
            position: 'absolute', top: 2, left: 'calc(50% - 1px)', height: 10, width: 2,
            background: 'var(--text-primary)', borderRadius: 1, opacity: 0.9,
          }} />
        </div>
        {/* 시험 마커 — 지난 시험은 흐리게. 넉넉한 투명 히트영역으로 6px 점도 쉽게 hover. */}
        {schedule.map(({ week: w, type }) => {
          const size = type === 'suneung' ? 8 : 6;
          return (
            <div
              key={w}
              {...tipProps(`exam-${w}`, `W${w} · ${EXAM_TYPE_LABELS[type]}`, pct(w))}
              style={{
                position: 'absolute', top: -3, height: 16, width: 18, cursor: 'help',
                left: `calc(${pct(w)}% - 9px)`,
              }}
            >
              <div style={{
                position: 'absolute', top: type === 'suneung' ? 4 : 5,
                left: `calc(50% - ${size / 2}px)`, width: size, height: size,
                background: EXAM_COLOR[type], borderRadius: '50%',
                opacity: w < week ? 0.3 : 1,
                boxShadow: type === 'suneung' && w >= week ? '0 0 5px rgba(217,100,88,0.7)' : 'none',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
