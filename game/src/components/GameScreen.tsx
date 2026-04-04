import { useState } from 'react';
import { useGameStore } from '../engine/store';
import { getWeekLabel, getMonthLabel, calculateEnding } from '../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES } from '../engine/activities';
import { StatKey, STAT_LABELS, getGrade } from '../engine/types';
import { Portrait } from './Portrait';
import { NPC_APPEARANCES } from './CharacterAvatar';
import { STAT_DESCRIPTIONS } from '../engine/statDescriptions';
import { getBackground } from '../engine/backgrounds';
import { getCharacterDialogue, getActivityReaction } from '../engine/dialogues';

const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};

// 예상 효과 계산
function predictEffects(activityIds: string[]) {
  const effects: Partial<Record<StatKey, number>> = {};
  let fatigue = 0, money = 0;
  for (const id of activityIds) {
    const a = ACTIVITIES.find(x => x.id === id);
    if (!a) continue;
    for (const [k, v] of Object.entries(a.effects))
      effects[k as StatKey] = (effects[k as StatKey] || 0) + (v as number);
    fatigue += a.fatigue;
    money -= a.moneyCost;
  }
  return { effects, fatigue, money };
}

export function GameScreen() {
  const { state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek, resolveEvent, setNpcActivityMap } = useGameStore();
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showNpc, setShowNpc] = useState(false);
  const [routineSlot2Pick, setRoutineSlot2Pick] = useState<string | null>(null);
  const [routineSlot3Pick, setRoutineSlot3Pick] = useState<string | null>(null);
  const [routineConfirmed, setRoutineConfirmed] = useState(false);
  const [eventResultData, setEventResultData] = useState<{ message: string; effects: Record<string, string>[] } | null>(null);
  const [npcSelectFor, setNpcSelectFor] = useState<string | null>(null);
  const [npcChoices, setNpcChoices] = useState<Record<string, string>>({});
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  const [lastReaction, setLastReaction] = useState<string | null>(null);

  if (!state) return null;

  const bg = getBackground(state.week, state.isVacation, state.mentalState);
  const [bgImgError, setBgImgError] = useState(false);

  // 공통 배경 래퍼
  const BgWrapper = ({ children, extraStyle }: { children: React.ReactNode; extraStyle?: React.CSSProperties }) => (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: bg.gradient,
      ...extraStyle,
    }}>
      {/* 배경 이미지 (있으면) */}
      {bg.image && !bgImgError && (
        <img
          src={bg.image} alt=""
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25, pointerEvents: 'none' }}
          onError={() => setBgImgError(true)}
        />
      )}
      {/* 오버레이 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.overlay, pointerEvents: 'none' }} />
      {/* 콘텐츠 */}
      <div style={{ position: 'relative', zIndex: 1, padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );

  // ===== 엔딩 =====
  if (state.phase === 'ending') {
    const ending = calculateEnding(state);
    return (
      <BgWrapper>
        <div className="ending-screen fade-in" style={{ minHeight: 'auto', padding: 0 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>7년의 여정이 끝났습니다</div>
          <div className="ending-title">{ending.title}</div>
          <div className="ending-desc">{ending.description}</div>
          <div className="ending-grades">
            <div className="ending-grade-item">
              <div className="ending-grade-label">성취 지수</div>
              <div className="ending-grade-value" style={{ color: 'var(--gold)' }}>{ending.achievement}</div>
            </div>
            <div className="ending-grade-item">
              <div className="ending-grade-label">행복 지수</div>
              <div className="ending-grade-value" style={{ color: 'var(--accent-soft)' }}>{ending.happiness}</div>
            </div>
          </div>
          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto 24px' }}>
            {(Object.keys(state.stats) as StatKey[]).map(key => {
              const grade = getGrade(state.stats[key]);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ width: 24 }}>{STAT_ICONS[key]}</span>
                  <span style={{ width: 32, fontSize: '0.8rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                  <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 7, margin: '0 8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${state.stats[key]}%`, background: grade.color, borderRadius: 7 }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                  <span style={{ width: 28, fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
            총합 {Math.round(Object.values(state.stats).reduce((a, b) => a + b, 0))}점 · 번아웃 {state.burnoutCount}회
          </div>
          <button className="btn btn-primary" style={{ maxWidth: 280 }} onClick={() => window.location.reload()}>
            다시 시작하기
          </button>
        </div>
      </BgWrapper>
    );
  }

  // ===== 이벤트 화면 =====
  if (state.currentEvent && state.phase === 'event') {
    const event = state.currentEvent;
    const npcIds = new Set<string>();
    event.choices.forEach(c => c.npcEffects?.forEach(ne => npcIds.add(ne.npcId)));
    const eventNpcs = state.npcs.filter(n => npcIds.has(n.id));

    return (
      <BgWrapper>
        <div className="fade-in">
          <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 12 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getWeekLabel(state)}</div>
          </div>

          {eventNpcs.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
              {eventNpcs.map(npc => (
                <Portrait key={npc.id} characterId={npc.id} size={80} expression="neutral" label={npc.name} />
              ))}
            </div>
          )}

          <div style={{
            background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(8px)',
            borderRadius: 16, padding: '20px 24px', marginBottom: 20,
            border: '1px solid rgba(233,69,96,0.2)',
          }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 10, color: 'var(--accent-soft)' }}>
              {event.title}
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {event.description}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {event.choices.map((choice, i) => (
              <div key={i} onClick={() => {
                const effects: Record<string, string>[] = [];
                for (const [k, v] of Object.entries(choice.effects)) {
                  const val = v as number;
                  if (val !== 0) effects.push({ text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`, color: val > 0 ? 'var(--green)' : 'var(--red)' });
                }
                if (choice.fatigueEffect) effects.push({ text: `피로 ${choice.fatigueEffect > 0 ? '+' : ''}${choice.fatigueEffect}`, color: choice.fatigueEffect > 0 ? 'var(--red)' : 'var(--green)' });
                if (choice.moneyEffect) effects.push({ text: `💰 ${choice.moneyEffect > 0 ? '+' : ''}${choice.moneyEffect}만`, color: choice.moneyEffect > 0 ? 'var(--green)' : 'var(--red)' });
                if (choice.npcEffects) for (const ne of choice.npcEffects) {
                  const npc = state.npcs.find(n => n.id === ne.npcId);
                  if (npc) effects.push({ text: `${npc.emoji} ${npc.name} ${ne.intimacyChange > 0 ? '♥' : '💔'}`, color: ne.intimacyChange > 0 ? 'var(--blue)' : 'var(--red)' });
                }
                setEventResultData({ message: choice.message, effects });
                resolveEvent(i);
              }} style={{
                background: 'rgba(15,52,96,0.8)', backdropFilter: 'blur(4px)',
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(233,69,96,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(15,52,96,0.8)'; }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}>{choice.text}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(choice.effects).map(([k, v]) => (
                    <span key={k} style={{ color: (v as number) > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {STAT_ICONS[k as StatKey]}{(v as number) > 0 ? '↑' : '↓'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BgWrapper>
    );
  }

  // ===== 이벤트 결과 =====
  if (eventResultData) {
    return (
      <BgWrapper>
        <div className="fade-in" style={{ paddingTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
            <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={56}
              expression={eventResultData.effects.some(e => e.color.includes('green') || e.color.includes('blue')) ? 'happy' : 'sad'} />
            <div style={{
              flex: 1, background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(8px)',
              borderRadius: '4px 16px 16px 16px', padding: '16px 18px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.8, fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                "{eventResultData.message}"
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            {eventResultData.effects.map((eff, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, color: eff.color }}>
                {eff.text}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setEventResultData(null); setShowResult(true); }}>
            계속 →
          </button>
        </div>
      </BgWrapper>
    );
  }

  // ===== 메인 변수들 =====
  const weekInfo = getWeekLabel(state);
  const month = getMonthLabel(state.week);
  const maxSlots = state.isVacation ? (state.parents.includes('freedom') ? 6 : 5) : 2;
  const activities = getAvailableActivities(state, state.isVacation);
  const routineIds = !state.isVacation ? [state.routineSlot2, state.routineSlot3].filter(Boolean) as string[] : [];
  const prediction = predictEffects([...selectedActivities, ...routineIds]);
  const currentSlots = selectedActivities.reduce((s, aid) => s + (activities.find(x => x.id === aid)?.slots || 0), 0);
  const dialogue = getCharacterDialogue(state);
  const fatigueLabel = state.fatigue < 20 ? '좋음' : state.fatigue < 35 ? '경미' : state.fatigue < 50 ? '주의' : state.fatigue < 70 ? '위험' : '극한!';
  const fatigueColor = state.fatigue < 20 ? 'var(--green)' : state.fatigue < 35 ? 'var(--yellow)' : state.fatigue < 50 ? 'orange' : 'var(--red)';

  // 다가오는 이벤트 계산
  const upcomingEvents: string[] = [];
  const examWeeks = [8, 17, 34, 38];
  for (const ew of examWeeks) {
    const diff = ew - state.week;
    if (diff > 0 && diff <= 4) upcomingEvents.push(`시험까지 ${diff}주`);
  }
  if (state.week >= 18 && state.week < 20) upcomingEvents.push('여름방학이 다가온다');
  if (state.week >= 40 && state.week < 43) upcomingEvents.push('겨울방학이 다가온다');

  const SOCIAL_ACTIVITIES = ['hang-out', 'club', 'study-group'];

  const toggleActivity = (id: string) => {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    if (selectedActivities.includes(id)) {
      setSelectedActivities(selectedActivities.filter(a => a !== id));
      const nc = { ...npcChoices }; delete nc[id]; setNpcChoices(nc);
      setLastReaction(null);
    } else {
      const cur = selectedActivities.reduce((s, aid) => s + (activities.find(x => x.id === aid)?.slots || 0), 0);
      if (cur + activity.slots <= maxSlots) {
        if (SOCIAL_ACTIVITIES.includes(id)) { setNpcSelectFor(id); }
        else { setSelectedActivities([...selectedActivities, id]); setLastReaction(getActivityReaction(id)); }
      }
    }
  };

  const handleConfirm = () => {
    if (state.isVacation) setVacationChoices(selectedActivities);
    else setWeekendChoices(selectedActivities);
    setNpcActivityMap(npcChoices);
    advanceWeek();
    setSelectedActivities([]); setNpcChoices({}); setShowResult(true); setRoutineConfirmed(false); setLastReaction(null);
  };

  // ===== 주간 결산 =====
  if (showResult && state.weekLog) {
    return (
      <BgWrapper>
        <div className="fade-in">
          {/* 일기 스타일 결산 */}
          <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 8 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bg.mood} {weekInfo}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>이번 주의 기록</div>
          </div>

          {/* 주인공 + 독백 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} />
            <div style={{
              flex: 1, background: 'rgba(15,52,96,0.9)', backdropFilter: 'blur(6px)',
              borderRadius: '4px 12px 12px 12px', padding: '10px 14px', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.6,
            }}>
              {state.weekLog.milestone ? `"${state.weekLog.milestone}"` :
               state.weekLog.messages.find(m => m.startsWith('📖')) || `"${dialogue}"`}
            </div>
          </div>

          {state.weekLog.milestone && <div className="milestone-box">⭐ 마일스톤 달성!</div>}
          {state.weekLog.messages.filter(m => m.includes('⚠') || m.includes('🔥') || m.includes('✨') || m.includes('💪')).map((msg, i) => (
            <div key={i} className="message-box">{msg}</div>
          ))}

          {/* 스탯 변화 */}
          <div style={{ background: 'rgba(15,52,96,0.88)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            {(Object.keys(state.stats) as StatKey[]).map(key => {
              const change = state.weekLog?.statChanges[key] || 0;
              const grade = getGrade(state.stats[key]);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ width: 20, fontSize: '0.8rem' }}>{STAT_ICONS[key]}</span>
                  <span style={{ width: 32, fontSize: '0.78rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                  <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, margin: '0 6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(state.stats[key])}%`, background: grade.color, borderRadius: 6, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ width: 20, fontSize: '0.72rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                  <span style={{ width: 28, fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
                  <span style={{ width: 40, fontSize: '0.68rem', fontWeight: 600, textAlign: 'right',
                    color: change > 0.1 ? 'var(--green)' : change < -0.1 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {change > 0 ? '+' : ''}{Math.round(change * 10) / 10}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: fatigueColor }}>피로 {Math.round(state.fatigue)}</span>
              <span>💰 {state.money}만원</span>
            </div>
          </div>

          {/* 다음 주 예고 */}
          {upcomingEvents.length > 0 && (
            <div style={{ background: 'rgba(233,69,96,0.1)', borderRadius: 10, padding: '8px 12px', marginBottom: 16, fontSize: '0.78rem', textAlign: 'center' }}>
              📅 {upcomingEvents.join(' · ')}
            </div>
          )}

          <button className="btn btn-primary" onClick={() => setShowResult(false)}>다음 주로 →</button>
        </div>
      </BgWrapper>
    );
  }

  // ===== 메인 게임 화면 =====
  return (
    <BgWrapper>
      {/* HUD 상단 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{bg.mood} {weekInfo}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{month} {state.isVacation ? '· 방학' : ''}</div>
          {state.mentalState !== 'normal' && (
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: state.mentalState === 'burnout' ? 'var(--red)' : 'var(--yellow)' }}>
              {state.mentalState === 'burnout' ? '🔥 번아웃' : '😩 피로 상태'}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.72rem' }}>
          <div style={{ color: fatigueColor }}>피로 {Math.round(state.fatigue)}</div>
          <div>💰 {state.money}만원 <span style={{ color: 'var(--yellow)', fontSize: '0.65rem' }}>+{state.parents.includes('wealth') ? 8 : 3}/주</span></div>
        </div>
      </div>

      {/* 다가오는 이벤트 배너 */}
      {upcomingEvents.length > 0 && (
        <div style={{ background: 'rgba(233,69,96,0.12)', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: '0.72rem', textAlign: 'center', color: 'var(--accent-soft)' }}>
          📅 {upcomingEvents.join(' · ')}
        </div>
      )}

      {/* 독백 말풍선 */}
      <div style={{
        background: 'rgba(15,52,96,0.88)', backdropFilter: 'blur(6px)',
        borderRadius: '4px 12px 12px 12px', padding: '8px 14px', marginBottom: 10,
        fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)',
      }}>
        {lastReaction ? `"${lastReaction}"` : `"${dialogue}"`}
      </div>

      {/* 스탯 (컴팩트, 터치 확장) */}
      <div style={{ background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
        {(Object.keys(state.stats) as StatKey[]).map(key => {
          const grade = getGrade(state.stats[key]);
          const pred = prediction.effects[key] || 0;
          const isExp = expandedStat === key;
          const desc = STAT_DESCRIPTIONS[key];
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0', cursor: 'pointer' }} onClick={() => setExpandedStat(isExp ? null : key)}>
                <span style={{ width: 20, fontSize: '0.75rem' }}>{STAT_ICONS[key]}</span>
                <span style={{ width: 28, fontSize: '0.72rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, margin: '0 6px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(state.stats[key])}%`, background: grade.color, borderRadius: 5, transition: 'width 0.3s' }} />
                  {pred > 0 && <div style={{ position: 'absolute', top: 0, left: `${Math.round(state.stats[key])}%`, height: '100%', width: `${Math.min(pred * 2, 100 - state.stats[key])}%`, background: 'rgba(76,175,80,0.4)', borderRadius: '0 5px 5px 0' }} />}
                </div>
                <span style={{ width: 16, fontSize: '0.68rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                <span style={{ width: 22, fontSize: '0.62rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(state.stats[key])}</span>
                {pred !== 0 && <span style={{ width: 32, fontSize: '0.6rem', fontWeight: 600, textAlign: 'right', color: pred > 0 ? 'var(--green)' : 'var(--red)' }}>{pred > 0 ? '+' : ''}{Math.round(pred * 10) / 10}</span>}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem' }}>
          <span style={{ color: fatigueColor }}>피로 {Math.round(state.fatigue)} {prediction.fatigue !== 0 && <span style={{ color: prediction.fatigue > 0 ? 'var(--red)' : 'var(--green)' }}>{prediction.fatigue > 0 ? '+' : ''}{prediction.fatigue}</span>}</span>
          <span>💰 {state.money}만 {prediction.money !== 0 && <span style={{ color: prediction.money > 0 ? 'var(--green)' : 'var(--red)' }}>{prediction.money > 0 ? '+' : ''}{prediction.money}만</span>}</span>
        </div>
      </div>

      {/* 루틴 (학기 중) */}
      {!state.isVacation && (
        <div style={{ background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              📋 평일 루틴
              {state.routineWeeks >= 3 && <span style={{ color: 'var(--blue)', marginLeft: 6 }}>{state.routineWeeks}주 연속 {state.routineWeeks >= 8 ? '🔥+2.0' : state.routineWeeks >= 6 ? '⭐+1.5' : '✨+1.0'}</span>}
            </span>
            <span style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: '0.68rem' }} onClick={() => setRoutineConfirmed(!routineConfirmed)}>
              {routineConfirmed ? '닫기' : '변경'}
            </span>
          </div>
          <div style={{ marginTop: 2 }}>
            🏫 학교수업 + {state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2)?.name : <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setRoutineConfirmed(true)}>비어있음 (설정하기)</span>}
            {' + '}{state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.name : '자유시간'}
          </div>
          {routineConfirmed && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>슬롯 1</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {activities.filter(a => a.slots === 1 && a.category !== 'rest').map(a => {
                  const ok = !a.requires || a.requires(state);
                  const sel = (routineSlot2Pick ?? state.routineSlot2) === a.id;
                  return <div key={a.id} onClick={() => ok && setRoutineSlot2Pick(a.id)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.68rem', cursor: ok ? 'pointer' : 'not-allowed', background: sel ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)', border: sel ? '1px solid var(--accent)' : '1px solid transparent', opacity: ok ? 1 : 0.4 }}>{a.name}</div>;
                })}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>슬롯 2</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                <div onClick={() => setRoutineSlot3Pick('__none__')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.68rem', cursor: 'pointer', background: (routineSlot3Pick === '__none__' || (!routineSlot3Pick && !state.routineSlot3)) ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)', border: (routineSlot3Pick === '__none__' || (!routineSlot3Pick && !state.routineSlot3)) ? '1px solid var(--accent)' : '1px solid transparent' }}>자유시간 🕊️</div>
                {activities.filter(a => a.slots === 1 && a.category !== 'rest').map(a => {
                  const ok = !a.requires || a.requires(state);
                  const sel = (routineSlot3Pick ?? state.routineSlot3) === a.id;
                  return <div key={a.id} onClick={() => ok && setRoutineSlot3Pick(a.id)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.68rem', cursor: ok ? 'pointer' : 'not-allowed', background: sel ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)', border: sel ? '1px solid var(--accent)' : '1px solid transparent', opacity: ok ? 1 : 0.4 }}>{a.name}</div>;
                })}
              </div>
              <button className="btn btn-small btn-primary" onClick={() => { setRoutine(routineSlot2Pick ?? state.routineSlot2, (routineSlot3Pick ?? state.routineSlot3) === '__none__' ? null : (routineSlot3Pick ?? state.routineSlot3)); setRoutineConfirmed(false); }}>확정</button>
            </div>
          )}
        </div>
      )}

      {/* 활동 선택 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{state.isVacation ? '🏖️ 이번 주 활동' : '🗓️ 주말 활동'}</span>
          <span style={{ fontSize: '0.72rem', color: currentSlots >= maxSlots ? 'var(--green)' : 'var(--text-muted)' }}>{currentSlots}/{maxSlots}</span>
        </div>

        {(['study', 'exercise', 'social', 'talent', 'rest', 'parent', 'work'] as const).map(cat => {
          const ca = activities.filter(a => a.category === cat);
          if (ca.length === 0) return null;
          const catNames: Record<string, string> = { study: '📚 공부', exercise: '💪 운동', social: '👥 관계', talent: '🎨 자기계발', rest: '😴 휴식', parent: '💝 가족', work: '💼 알바' };
          return (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{catNames[cat]}</div>
              <div className="activity-grid">
                {ca.map(a => {
                  const sel = selectedActivities.includes(a.id);
                  const canSel = sel || currentSlots + a.slots <= maxSlots;
                  const canAfford = !a.requires || a.requires(state);
                  return (
                    <div key={a.id}
                      className={`activity-card ${sel ? 'selected' : ''} ${(!canSel || !canAfford) ? 'disabled' : ''}`}
                      onClick={() => canSel && canAfford && toggleActivity(a.id)}
                    >
                      <div className="activity-name">
                        {a.name}
                        {a.moneyCost > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--yellow)', marginLeft: 3 }}>({a.moneyCost}만)</span>}
                        {a.moneyCost < 0 && <span style={{ fontSize: '0.72rem', color: 'var(--green)', marginLeft: 3 }}>(+{-a.moneyCost}만)</span>}
                        {npcChoices[a.id] && <span style={{ fontSize: '0.68rem', color: 'var(--accent-soft)', marginLeft: 3 }}>({state.npcs.find(n => n.id === npcChoices[a.id])?.name})</span>}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>{a.flavor.slice(0, 40)}...</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 3 }}>
                        {a.tags.slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: '0.58rem', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>{t}</span>
                        ))}
                      </div>
                      <div className="activity-effects">
                        {Object.entries(a.effects).map(([k, v]) => (
                          <span key={k} style={{ color: (v as number) > 0 ? 'var(--green)' : 'var(--red)', marginRight: 3 }}>
                            {STAT_ICONS[k as StatKey]}{(v as number) > 0 ? '↑' : '↓'}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {a.fatigue !== 0 && <span style={{ color: a.fatigue > 0 ? 'var(--red)' : 'var(--green)' }}>피로{a.fatigue > 0 ? '+' : ''}{a.fatigue}</span>}
                        {a.slots > 1 && <span style={{ color: 'var(--purple)' }}>{a.slots}슬롯</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* NPC 간략 */}
      <div style={{ background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, cursor: 'pointer' }} onClick={() => setShowNpc(!showNpc)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span>👥 관계</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{showNpc ? '▲' : '▼'}</span>
        </div>
        {!showNpc && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.7rem' }}>
            {state.npcs.map(n => <span key={n.id} style={{ color: n.intimacy >= 50 ? 'var(--green)' : 'var(--text-muted)' }}>{n.emoji}{Math.round(n.intimacy)}</span>)}
          </div>
        )}
        {showNpc && state.npcs.map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <Portrait characterId={n.id} size={32} expression="neutral" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{n.name}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{n.description}</div>
            </div>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${n.intimacy}%`, background: 'var(--accent-soft)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>{Math.round(n.intimacy)}</span>
          </div>
        ))}
      </div>

      {/* NPC 선택 모달 */}
      {npcSelectFor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>누구와 {npcSelectFor === 'hang-out' ? '놀까' : npcSelectFor === 'study-group' ? '공부할까' : '활동할까'}?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>함께하는 친구에 따라 친밀도가 올라갑니다</div>
            {state.npcs.map(npc => (
              <div key={npc.id} onClick={() => { setNpcChoices({ ...npcChoices, [npcSelectFor]: npc.id }); setSelectedActivities([...selectedActivities, npcSelectFor]); setLastReaction(getActivityReaction(npcSelectFor)); setNpcSelectFor(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Portrait characterId={npc.id} size={40} expression="neutral" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{npc.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{npc.description}</div>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀 {Math.round(npc.intimacy)}</span>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setNpcSelectFor(null)}>취소</button>
          </div>
        </div>
      )}

      {/* 확정 버튼 */}
      <div style={{ paddingBottom: 20 }}>
        <button className="btn btn-primary" onClick={handleConfirm}>
          {currentSlots === 0 ? (state.isVacation ? '이번 주는 쉰다' : '주말 그냥 보내기') : '이번 주 확정 →'}
        </button>
        {!state.routineSlot2 && !state.isVacation && (
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--accent)', marginTop: 4 }}>
            평일 루틴이 비어있어요 — 위에서 설정해보세요
          </div>
        )}
      </div>
    </BgWrapper>
  );
}
