// 재생 카드 — 한 달 자동 진행 중 한 주가 끝날 때마다 잠깐 뜨는 짧은 카드(설계안 §5).
// 주간 결산 화면을 대신한다: 날짜, 그 주의 한 줄, 변화 배지(숫자 없음 — 방향 표시만), 지친 표정. 저절로 넘어가고 탭하면 바로 넘어간다.
//
// 조작은 넷이다 — ⏸ 일시정지 · ⏭ 다음 멈춤까지(카드를 빨리 넘긴다) · 💬 대화 · 🛒 상점. 셋 다 "다음 주 경계에서 멈춤"이고,
// 카드 자체가 경계 바로 앞이라 누르면 곧장 멈춘 주간 화면으로 간다(그 화면이 말걸기·상점을 그대로 준다).
import { useEffect, useRef } from 'react';
import { playSfx } from '../../../audio/sfx';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { STAT_LABELS, type GameState, type StatKey, type WeekLog } from '../../../engine/types';
import { getWeekOfMonth } from '../../../engine/weekMath';
import { Portrait } from '../../Portrait';
import { BgWrapper, type ScreenBgProps } from '../BgWrapper';
import { chipSurface, tintedGlass } from '../surface';
import { statChangeMark } from '../shared';

/** 카드가 머무는 시간(ms) — 보통 / "다음 멈춤까지". */
export const CARD_DWELL_MS = 2200;
export const CARD_DWELL_FAST_MS = 600;

type Props = {
  state: GameState;
  weekLog: WeekLog;
  weekLabel: string;
  resultDialogue: string;
  bgProps: ScreenBgProps;
  fast: boolean;
  /** 💬 배지 — 이번 주에 이야기할 거리가 있거나 지난달 못 다한 이야기가 남았다. 재생은 멈추지 않는다. */
  talkBadge: boolean;
  onToggleFast: () => void;
  onContinue: () => void;
  onPause: () => void;
  onTalk: () => void;
  onShop: () => void;
};

/** 카드에 올릴 줄 — 약속·결석·사건 결과. 사건 문장(📖)은 마지막 것을 머리 줄로 쓰니 여기선 뺀다. */
const NOTE_PREFIXES = ['📌', '💔', '📅'];

export function PlaybackCard({ state, weekLog, weekLabel, resultDialogue, bgProps, fast, talkBadge, onToggleFast, onContinue, onPause, onTalk, onShop }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  // 한 카드에서 한 번만 넘어간다 — 타이머와 탭이 겹치면 다음 주가 두 번 재생된다.
  const doneRef = useRef(false);
  const advance = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onContinue();
  };
  useEffect(() => {
    doneRef.current = false;
    const t = setTimeout(advance, fast ? CARD_DWELL_FAST_MS : CARD_DWELL_MS);
    return () => clearTimeout(t);
    // 카드 하나(=주 하나)마다 타이머 하나. advance는 ref만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekLog, fast]);

  const narration = weekLog.messages.filter(m => m.startsWith('📖'));
  const hero = narration.length ? narration[narration.length - 1].replace(/^📖\s*/, '') : resultDialogue;
  const notes = weekLog.messages.filter(m => NOTE_PREFIXES.some(p => m.startsWith(p))).slice(0, 3);
  const badges = (Object.keys(STAT_LABELS) as StatKey[]).flatMap(k => {
    const mark = statChangeMark(weekLog.statChanges[k] ?? 0);
    return mark ? [{ k, text: `${STAT_LABELS[k]} ${mark}`, up: (weekLog.statChanges[k] ?? 0) > 0 }] : [];
  });
  const weekOfMonth = weekLog.week != null ? getWeekOfMonth(weekLog.week) : null;
  const press = (fn: () => void) => () => { if (doneRef.current) return; doneRef.current = true; playSfx('tap'); fn(); };

  return (
    <BgWrapper {...bgProps}>
      <div data-testid="playback-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '70dvh', justifyContent: 'center' }}>
        <button type="button" className="btn-reset" onClick={advance} aria-label="다음 주로"
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 16, padding: '16px 18px',
            background: tintedGlass('rgba(42,34,48,0.88)'), border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: 12,
            animation: reducedMotion ? undefined : 'fadeIn 0.25s ease',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{weekLabel}</span>
            {weekOfMonth && (
              <span aria-label={`이번 달 ${weekOfMonth}주째`} style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i <= weekOfMonth ? 'var(--accent)' : 'rgba(255,255,255,0.18)' }} />
                ))}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52}
              mental={state.stats.mental} mentalState={state.mentalState} year={state.year} frame="photo" />
            <div data-testid="playback-hero" style={{ flex: 1, fontSize: '0.95rem', lineHeight: 1.6 }}>{hero}</div>
          </div>
          {notes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {notes.map((n, i) => <span key={i}>{n}</span>)}
            </div>
          )}
          {(badges.length > 0 || state.mentalState !== 'normal') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.mentalState === 'burnout' && (
                <span data-testid="playback-burnout" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--red)', background: chipSurface('rgba(214,110,110,0.16)'), borderRadius: 6, padding: '3px 8px' }}>번아웃</span>
              )}
              {state.mentalState === 'tired' && (
                <span data-testid="playback-tired" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--yellow)', background: chipSurface('rgba(224,179,84,0.16)'), borderRadius: 6, padding: '3px 8px' }}>지쳤다</span>
              )}
              {badges.map(b => (
                <span key={b.k} style={{ fontSize: '0.75rem', fontWeight: 600, color: b.up ? 'var(--green)' : 'var(--red)', background: chipSurface(b.up ? 'rgba(110,190,140,0.14)' : 'rgba(214,110,110,0.14)'), borderRadius: 6, padding: '3px 8px' }}>{b.text}</span>
              ))}
            </div>
          )}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>탭하면 바로 다음 주</span>
        </button>

        <div role="group" aria-label="재생 조작" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
          <ControlButton label="⏸ 멈춤" onClick={press(onPause)} />
          <ControlButton label={fast ? '⏭ 보통 속도' : '⏭ 다음 멈춤까지'} pressed={fast} onClick={() => { playSfx('tap'); onToggleFast(); }} />
          <ControlButton label={talkBadge ? '💬 대화 •' : '💬 대화'} onClick={press(onTalk)} testId="playback-talk" />
          <ControlButton label="🛒 상점" onClick={press(onShop)} />
        </div>
      </div>
    </BgWrapper>
  );
}

function ControlButton({ label, onClick, pressed, testId }: { label: string; onClick: () => void; pressed?: boolean; testId?: string }) {
  return (
    <button type="button" className="btn-reset" onClick={onClick} aria-pressed={pressed} data-testid={testId}
      style={{
        minHeight: 48, borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, padding: '0 4px',
        background: chipSurface(pressed ? 'rgba(240,164,122,0.22)' : 'rgba(42,34,48,0.85)'),
        border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', wordBreak: 'keep-all',
      }}>
      {label}
    </button>
  );
}
