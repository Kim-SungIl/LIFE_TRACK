import { useState } from 'react';
import { GameState, StatKey, STAT_LABELS, getGrade, STAT_FLAVOR_LABELS } from '../../../engine/types';
import { STAT_DESCRIPTIONS } from '../../../engine/statDescriptions';
import { STAT_ICONS } from '../shared';

type Props = { state: GameState };

// 능력치 패널 — 접기/펼치기 + 스탯별 설명 토글. 로컬 UI state(showStats/expandedStat)는 이 패널 전용.
// 주간 결산 왕복 시 MainWeekScreen 과 함께 언마운트되어 매 주 collapsed 로 초기화됨(의도된 동작).
export function StatsPanel({ state }: Props) {
  const [showStats, setShowStats] = useState(false);
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  return (
    <div data-tutorial="stats" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
      <div
        onClick={() => setShowStats(!showStats)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0' }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>📊 능력치</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 접혀있을 때 미니 요약 — 텍스트로 표시 */}
          {!showStats && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(state.stats) as StatKey[]).map(key => {
                const grade = getGrade(state.stats[key]);
                return (
                  <span key={key} style={{ fontSize: '0.62rem', fontWeight: 600, color: grade.color }}>
                    {STAT_LABELS[key]}{grade.grade}
                  </span>
                );
              })}
            </div>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{showStats ? '▲' : '▼'}</span>
        </div>
      </div>
      {showStats && (
        <div style={{ marginTop: 6 }}>
          {(Object.keys(state.stats) as StatKey[]).map(key => {
            const grade = getGrade(state.stats[key]);
            const isExp = expandedStat === key;
            const desc = STAT_DESCRIPTIONS[key];
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0', cursor: 'pointer' }} onClick={() => setExpandedStat(isExp ? null : key)}>
                  <span style={{ width: 20, fontSize: '0.75rem' }}>{STAT_ICONS[key]}</span>
                  <span style={{ width: 28, fontSize: '0.72rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                  <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, margin: '0 6px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(state.stats[key])}%`, background: grade.color, borderRadius: 5, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ width: 16, fontSize: '0.68rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                  <span style={{ minWidth: 56, fontSize: '0.6rem', color: grade.color, opacity: 0.85, marginLeft: 4 }}>{STAT_FLAVOR_LABELS[key][grade.grade]}</span>
                  <span style={{ width: 22, fontSize: '0.62rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
                </div>
                {isExp && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', margin: '2px 0 4px 20px', fontSize: '0.68rem', lineHeight: 1.5 }}>
                    <div style={{ color: 'var(--text-primary)' }}>{desc.what}</div>
                    <div style={{ color: 'var(--green)', marginTop: 2 }}>▲ {desc.high}</div>
                    <div style={{ color: 'var(--red)' }}>▼ {desc.low}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
