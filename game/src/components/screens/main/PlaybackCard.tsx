// 재생 카드 — 한 달 자동 진행 중 한 주가 끝날 때마다 잠깐 뜨는 짧은 카드(설계안 §5).
// 주간 결산 화면을 대신한다: 날짜, 그 주의 한 줄, 변화 배지(숫자 없음 — 방향 표시만), 지친 표정. 저절로 넘어가고 탭하면 바로 넘어간다.
//
// **⏸를 누를 틈이 있어야 한다(2026-10-29 사용자 지적 "멈춤 누르기가 어렵다").** 예전엔 2.2초 고정이라 카드를 읽고
// 멈출지 정하기 전에 다음 주가 처리됐다. 사건 문장 820개 실측은 공백 뺀 p50 34자 · p90 51자 · 최대 82자라 거의 모든 카드가
// 하한에 머문다 — 그래서 실제 지렛대는 하한(4초)과 누름 정지다. 그래서
//   · 머무는 시간은 읽을 글자 수에 맞춘다(cardDwellMs — 하한·상한 있음). [⏭ 다음 멈춤까지]는 그대로 짧다.
//   · 카드나 조작 줄을 누르고 있는 동안은 시간이 멈춘다 — 떼면 남은 시간부터 이어 간다(처음부터가 아니라).
//     길게 누른 뒤 떼면 브라우저가 click을 하나 더 내는데, 그게 카드의 "다음 주로"를 누르지 않게 삼킨다.
//     다시 이어 갈 땐 최소 RESUME_MIN_MS를 준다 — 다 된 타이머 위로 ⏸를 터치하면 click보다 타이머가 먼저 돌았다.
//   · 카드 아래 막대가 남은 시간을 보인다(애니메이션 줄이기면 안 그린다).
//   · 조작 줄은 화면 아래에 고정한다 — 카드 높이(사건 문장·줄 수)에 따라 버튼이 오르내리지 않게.
//
// 조작은 넷이다 — ⏸ 일시정지 · ⏭ 다음 멈춤까지(카드를 빨리 넘긴다) · 💬 대화 · 🛒 상점. 셋 다 "다음 주 경계에서 멈춤"이고,
// 카드 자체가 경계 바로 앞이라 누르면 곧장 멈춘 주간 화면으로 간다(그 화면이 말걸기·상점을 그대로 준다).
import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../../audio/sfx';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { STAT_LABELS, type GameState, type StatKey, type WeekLog } from '../../../engine/types';
import { getWeekOfMonth } from '../../../engine/weekMath';
import { cardLine } from '../../../engine/talkData/playbackLines';
import { CARD_DWELL_FAST_MS, LONG_PRESS_MS, RESUME_MIN_MS, cardDwellMs } from './playbackPace';
import { Portrait } from '../../Portrait';
import { BgWrapper, type ScreenBgProps } from '../BgWrapper';
import { chipSurface, tintedGlass } from '../surface';
import { statChangeMark } from '../shared';


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

/** 카드마다 하나 — 막대 애니메이션을 타이머와 같은 기준(weekLog가 바뀔 때)으로 다시 시작한다. 좌표는 구세이브에서 빌 수 있다. */
const CARD_SEQ = new WeakMap<WeekLog, number>();
let nextCardSeq = 0;
function cardSeq(log: WeekLog): number {
  let n = CARD_SEQ.get(log);
  if (n === undefined) { n = ++nextCardSeq; CARD_SEQ.set(log, n); }
  return n;
}

/** 카드에 올릴 줄 — 약속·결석·사건 결과. 사건 문장(📖)은 마지막 것을 머리 줄로 쓰니 여기선 뺀다. */
const NOTE_PREFIXES = ['📌', '💔', '📅'];

export function PlaybackCard({ state, weekLog, weekLabel, resultDialogue, bgProps, fast, talkBadge, onToggleFast, onContinue, onPause, onTalk, onShop }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const narration = weekLog.messages.filter(m => m.startsWith('📖'));
  const hero = narration.length ? narration[narration.length - 1].replace(/^📖\s*/, '') : cardLine(state, weekLog, resultDialogue);
  const notes = weekLog.messages.filter(m => NOTE_PREFIXES.some(p => m.startsWith(p))).slice(0, 3);
  const dwell = fast ? CARD_DWELL_FAST_MS : cardDwellMs([hero, ...notes].join('').replace(/\s/g, '').length);

  // 한 카드에서 한 번만 넘어간다 — 타이머와 탭이 겹치면 다음 주가 두 번 재생된다.
  const doneRef = useRef(false);
  const advance = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onContinue();
  };
  // 남은 시간과 지금 도는 타이머 — 누르고 있으면 멈췄다가 떼면 남은 만큼만 더 기다린다.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(dwell);
  const startedAtRef = useRef(0);
  const [held, setHeld] = useState(false);
  // 이번 누름이 시작된 시각과, 길게 누른 뒤 따라오는 click을 삼킬지.
  const pressedAtRef = useRef(0);
  const swallowClickRef = useRef(false);
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const runTimer = () => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(advance, remainingRef.current);
  };
  useEffect(() => {
    doneRef.current = false;
    remainingRef.current = dwell;
    swallowClickRef.current = false;
    setHeld(false);
    runTimer();
    return clearTimer;
    // 카드 하나(=주 하나)마다 타이머 하나. advance·runTimer는 ref만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekLog, fast]);
  const hold = () => {
    swallowClickRef.current = false;
    pressedAtRef.current = Date.now();
    if (doneRef.current || !timerRef.current) return;
    clearTimer();
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    setHeld(true);
  };
  const release = () => {
    if (doneRef.current || timerRef.current) return;
    if (Date.now() - pressedAtRef.current >= LONG_PRESS_MS) swallowClickRef.current = true;
    remainingRef.current = Math.max(RESUME_MIN_MS, remainingRef.current);
    setHeld(false);
    runTimer();
  };
  // 카드 탭 = 다음 주. 길게 누르고 뗀 뒤의 click은 읽으려고 누른 것이라 넘기지 않는다.
  const tapCard = () => {
    if (swallowClickRef.current) { swallowClickRef.current = false; return; }
    advance();
  };
  const badges = (Object.keys(STAT_LABELS) as StatKey[]).flatMap(k => {
    const mark = statChangeMark(weekLog.statChanges[k] ?? 0);
    return mark ? [{ k, text: `${STAT_LABELS[k]} ${mark}`, up: (weekLog.statChanges[k] ?? 0) > 0 }] : [];
  });
  const weekOfMonth = weekLog.week != null ? getWeekOfMonth(weekLog.week) : null;
  const press = (fn: () => void) => () => { if (doneRef.current) return; doneRef.current = true; playSfx('tap'); fn(); };

  return (
    <BgWrapper {...bgProps}>
      <div data-testid="playback-card" onPointerDown={hold} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        // 길게 누르면 뜨는 메뉴·글자 선택이 누름을 끊지 않게(누름 = 읽으려고 멈춤).
        onContextMenu={e => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '70dvh', justifyContent: 'center', paddingBottom: 'calc(88px + env(safe-area-inset-bottom))', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
        <button type="button" className="btn-reset" onClick={tapCard} aria-label="다음 주로"
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
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>탭하면 바로 다음 주 · 누르고 있으면 멈춰 있어요</span>
          {!reducedMotion && (
            <span aria-hidden="true" style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <span key={`${cardSeq(weekLog)}-${fast}`} data-testid="playback-dwell" style={{
                display: 'block', height: '100%', background: 'var(--accent)', transformOrigin: 'left',
                animation: `cardDwell ${dwell}ms linear forwards`, animationPlayState: held ? 'paused' : 'running',
              }} />
            </span>
          )}
        </button>

        {/* 조작 줄은 화면 아래에 고정 — 카드 높이가 주마다 달라도 버튼 자리는 그대로다. */}
        <div role="group" aria-label="재생 조작" className="bottom-action" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
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
