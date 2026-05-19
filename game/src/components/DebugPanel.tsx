// 개발 환경 한정 디버그 패널 — Vite import.meta.env.DEV 가드로 GameScreen에서만 렌더.
// 학년말/엔딩 화면 검증을 위해 phase 점프 + 스탯 빠른 조작 제공.
// 프로덕션 빌드에선 자동 tree-shake 되도록 GameScreen에서 가드된 조건 렌더.

import { useState } from 'react';
import { useGameStore } from '../engine/store';
import type { StatKey } from '../engine/types';

const STAT_LABELS: Record<StatKey, string> = {
  academic: '학업', social: '인기', talent: '특기', mental: '멘탈', health: '체력',
};

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const state = useGameStore(s => s.state);
  const { debugAdvanceToYearEnd, debugSkipToEnding, debugSetStat } = useGameStore.getState();

  if (!state) return null;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 8,
    right: 8,
    background: 'rgba(20,20,30,0.92)',
    color: '#e4e6eb',
    padding: open ? '10px 12px' : '4px 8px',
    borderRadius: 8,
    fontSize: '0.7rem',
    zIndex: 100,
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: open ? 180 : 'auto',
    maxWidth: 220,
  };
  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#e4e6eb',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.7rem',
    width: '100%',
    marginBottom: 4,
    textAlign: 'left',
  };

  if (!open) {
    return (
      <div style={panelStyle} onClick={() => setOpen(true)} role="button" aria-label="디버그 패널 열기">
        🐞 DEV
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>🐞 DEV — Y{state.year}W{state.week}</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#e4e6eb', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
      </div>

      <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: 4 }}>페이즈 점프</div>
      <button style={btnStyle} onClick={debugAdvanceToYearEnd}>▶ 현재 학년 종료 (year-end)</button>
      <button style={btnStyle} onClick={debugSkipToEnding}>🏁 엔딩으로 (Y7 결산)</button>

      <div style={{ fontSize: '0.62rem', color: '#aaa', margin: '8px 0 4px' }}>스탯 빠른 설정</div>
      {(Object.keys(state.stats) as StatKey[]).map(key => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 30, fontSize: '0.65rem' }}>{STAT_LABELS[key]}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(state.stats[key])}
            onChange={(e) => debugSetStat(key, parseInt(e.target.value, 10))}
            style={{ flex: 1, height: 4 }}
          />
          <span style={{ width: 22, fontSize: '0.62rem', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
        </div>
      ))}

      <div style={{ fontSize: '0.6rem', color: '#888', marginTop: 8, lineHeight: 1.4 }}>
        행복 등급: S(men≥80,soc≥60) / A(60,40) / B(men≥40) / C(≥25) / D(&lt;25)
      </div>
    </div>
  );
}
