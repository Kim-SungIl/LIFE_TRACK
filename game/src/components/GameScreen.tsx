import { useState } from 'react';
import { useGameStore } from '../engine/store';
import { getWeekLabel, getMonthLabel, calculateEnding } from '../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES } from '../engine/activities';
import { StatKey, STAT_LABELS, getGrade, SubjectKey, SUBJECT_LABELS, ExamResult } from '../engine/types';
import { Portrait } from './Portrait';
import { NPC_APPEARANCES } from './CharacterAvatar';
import { STAT_DESCRIPTIONS } from '../engine/statDescriptions';
import { ActivityPicker } from './ActivityPicker';
import { getBackground } from '../engine/backgrounds';
import { getCharacterDialogue, getActivityReaction } from '../engine/dialogues';
import { Tutorial } from './Tutorial';
import { Shop } from './Shop';
import { ShopItem } from '../engine/shopSystem';

const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};


export function GameScreen() {
  const { state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek, resolveEvent, setNpcActivityMap, buyItem } = useGameStore();
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showNpc, setShowNpc] = useState(false);
  const [routineSlot2Pick, setRoutineSlot2Pick] = useState<string | null>(null);
  const [routineSlot3Pick, setRoutineSlot3Pick] = useState<string | null>(null);
  const [routineConfirmed, setRoutineConfirmed] = useState(false);
  const [routineStep, setRoutineStep] = useState<1 | 2>(1); // 슬롯 1 먼저, 그 다음 슬롯 2
  const [eventResultData, setEventResultData] = useState<{ message: string; effects: Record<string, string>[] } | null>(null);
  const [npcSelectFor, setNpcSelectFor] = useState<string | null>(null);
  const [npcDetailFor, setNpcDetailFor] = useState<string | null>(null);
  const [npcChoices, setNpcChoices] = useState<Record<string, string>>({});
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('lifetrack_tutorial_done');
  });

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
          src={`${import.meta.env.BASE_URL}${bg.image.replace(/^\//, '')}`} alt=""
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
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{choice.text}</div>
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
  const currentSlots = selectedActivities.reduce((s, aid) => s + (activities.find(x => x.id === aid)?.slots || 0), 0);
  const dialogue = getCharacterDialogue(state);
  const fatigueLabel = state.fatigue < 20 ? '좋음' : state.fatigue < 35 ? '경미' : state.fatigue < 50 ? '주의' : state.fatigue < 70 ? '위험' : '극한!';
  const fatigueColor = state.fatigue < 20 ? 'var(--green)' : state.fatigue < 35 ? 'var(--yellow)' : state.fatigue < 50 ? 'orange' : 'var(--red)';

  // 루틴 비용 체크 — 돈이 부족하면 루틴 변경 강제
  const routineCost = (state.routineSlot2 ? (ACTIVITIES.find(a => a.id === state.routineSlot2)?.moneyCost || 0) : 0)
    + (state.routineSlot3 ? (ACTIVITIES.find(a => a.id === state.routineSlot3)?.moneyCost || 0) : 0);
  const routineTooExpensive = !state.isVacation && state.routineSlot2 && routineCost > 0 && state.money < routineCost;

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

          {/* 스탯 변화 — 정확한 수치 */}
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

          {/* 시험 결과 */}
          {state.currentExamResult && (() => {
            const exam = state.currentExamResult!;
            const gradeColors: Record<string, string> = { S: '#FFD700', A: '#4CAF50', B: '#2196F3', C: '#FF9800', D: '#F44336' };
            return (
              <div style={{
                background: 'rgba(15,52,96,0.92)', backdropFilter: 'blur(6px)', borderRadius: 14,
                padding: '16px 16px', marginBottom: 16, border: '1px solid rgba(233,69,96,0.2)',
              }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
                  📝 {exam.examType === 'midterm' ? '중간고사' : '기말고사'} 성적표
                </div>

                {/* 과목별 등급 */}
                {(Object.keys(exam.subjects) as SubjectKey[]).map(key => {
                  const s = exam.subjects[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ width: 70, fontSize: '0.8rem', fontWeight: 600 }}>{SUBJECT_LABELS[key]}</span>
                      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, margin: '0 8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.score}%`, background: gradeColors[s.grade], borderRadius: 4, transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ width: 22, fontSize: '0.82rem', fontWeight: 700, color: gradeColors[s.grade], textAlign: 'center' }}>{s.grade}</span>
                      {s.delta !== 0 && (
                        <span style={{ width: 36, fontSize: '0.65rem', fontWeight: 600, textAlign: 'right', color: s.delta > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {s.delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(s.delta))}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* 석차 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>반 석차</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>{exam.rank}등</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ 30명</span>
                    {exam.prevRank && (
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600,
                        color: exam.rank < exam.prevRank ? 'var(--green)' : exam.rank > exam.prevRank ? 'var(--red)' : 'var(--text-muted)',
                      }}>
                        {exam.rank < exam.prevRank ? `▲${exam.prevRank - exam.rank}` : exam.rank > exam.prevRank ? `▼${exam.rank - exam.prevRank}` : '→'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 총평 */}
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px', marginTop: 8, fontSize: '0.8rem', fontStyle: 'italic', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  "{exam.comment}"
                </div>

                {/* 반응 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: '0.75rem' }}>
                  <div><span style={{ color: 'var(--accent-soft)' }}>부모님:</span> {exam.parentReaction}</div>
                  <div><span style={{ color: 'var(--blue)' }}>선생님:</span> {exam.teacherReaction}</div>
                </div>
              </div>
            );
          })()}

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
    <>
    <BgWrapper>
      {/* HUD 상단 */}
      <div data-tutorial="hud" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{bg.mood} {weekInfo}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{month} {state.isVacation ? '· 방학' : ''}</div>
          {state.mentalState !== 'normal' && (
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: state.mentalState === 'burnout' ? 'var(--red)' : 'var(--yellow)' }}>
              {state.mentalState === 'burnout' ? '🔥 번아웃' : '😩 피로 상태'}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.6 }}>
          <div style={{ color: fatigueColor }}>피로 {Math.round(state.fatigue)} · {fatigueLabel}</div>
          <div onClick={() => { setShowShop(true); setNpcDetailFor(null); setNpcSelectFor(null); }} style={{ cursor: 'pointer' }}>
            💰 {state.money}만원 <span style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>🛒</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>매주 용돈 +{state.parents.includes('wealth') ? 8 : 3}만원</div>
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

      {/* 스탯 (접기/펼치기) */}
      <div data-tutorial="stats" style={{ background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: showStats ? '8px 12px' : '8px 12px', marginBottom: 10 }}>
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

      {/* 루틴 (학기 중) */}
      {!state.isVacation && (
        <div data-tutorial="routine" style={{
          background: 'rgba(15,52,96,0.85)',
          backdropFilter: 'blur(6px)', borderRadius: 12, padding: '14px 16px', marginBottom: 12,
          border: routineTooExpensive ? '1px solid var(--red)' : !state.routineSlot2 ? '1px solid var(--yellow)' : '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              📋 평일 방과후 루틴
              {state.routineWeeks >= 3 && <span style={{ color: 'var(--blue)', marginLeft: 8, fontSize: '0.78rem' }}>{state.routineWeeks}주 연속 {state.routineWeeks >= 8 ? '🔥+2.0' : state.routineWeeks >= 6 ? '⭐+1.5' : '✨+1.0'}</span>}
            </span>
            {state.routineSlot2 && (
              <span style={{ color: 'var(--blue)', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => { setRoutineConfirmed(!routineConfirmed); setRoutineStep(1); }}>
                {routineConfirmed ? '닫기' : '변경'}
              </span>
            )}
          </div>

          {/* 루틴 미설정 시 */}
          {!state.routineSlot2 && !routineConfirmed && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '0.85rem', marginBottom: 6, color: 'var(--text-secondary)' }}>
                아직 평일 방과후 계획이 없어요
              </div>
              <div style={{ fontSize: '0.72rem', marginBottom: 12, color: 'var(--text-muted)' }}>
                루틴을 정하면 매주 자동으로 진행돼요
              </div>
              <button className="btn btn-primary" style={{ maxWidth: 280, margin: '0 auto', display: 'block' }} onClick={() => { setRoutineConfirmed(true); setRoutineStep(1); }}>
                방과후 활동 정해보기
              </button>
            </div>
          )}

          {/* 루틴 설정됨: 요약 */}
          {state.routineSlot2 && !routineConfirmed && (
            <div>
              {/* 돈 부족 경고 */}
              {routineTooExpensive && (
                <div style={{
                  background: 'rgba(255,87,34,0.15)', border: '1px solid rgba(255,87,34,0.3)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 10, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>
                    💰 돈이 부족해요!
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    현재 {state.money}만원인데 루틴 비용이 매주 {routineCost}만원이에요.
                    <br />루틴을 바꾸지 않으면 이번 주 활동을 할 수 없어요.
                  </div>
                  <button className="btn btn-primary" style={{ maxWidth: 240, margin: '0 auto', display: 'block', fontSize: '0.85rem' }}
                    onClick={() => { setRoutineConfirmed(true); setRoutineStep(1); }}>
                    루틴 변경하기
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px' }}>
                  🏫 학교수업
                </div>
                <div style={{ background: 'rgba(91,141,239,0.15)', border: '1px solid rgba(91,141,239,0.3)', borderRadius: 8, padding: '6px 12px' }}>
                  {ACTIVITIES.find(a => a.id === state.routineSlot2)?.name}
                  {(() => { const a = ACTIVITIES.find(x => x.id === state.routineSlot2); return a && a.moneyCost > 0 ? ` (${a.moneyCost}만/주)` : ''; })()}
                </div>
                <div style={{ background: 'rgba(91,141,239,0.15)', border: '1px solid rgba(91,141,239,0.3)', borderRadius: 8, padding: '6px 12px' }}>
                  {state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.name : '🕊️ 자유시간'}
                </div>
              </div>
            </div>
          )}

          {/* 루틴 설정 — 단계별 */}
          {routineConfirmed && routineStep === 1 && (
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 8, color: 'var(--blue)' }}>
                STEP 1 — 방과후 첫 번째 활동을 골라주세요
              </div>
              <ActivityPicker
                activities={activities.filter(a => a.slots === 1 && a.category !== 'rest')}
                selected={routineSlot2Pick ? [routineSlot2Pick] : state.routineSlot2 ? [state.routineSlot2] : []}
                onToggle={(id) => {
                  setRoutineSlot2Pick(id);
                  // 선택하면 자동으로 슬롯 2로
                  setTimeout(() => setRoutineStep(2), 200);
                }}
                maxSlots={1} currentSlots={0} state={state} compact
              />
            </div>
          )}

          {routineConfirmed && routineStep === 2 && (
            <div>
              {/* 슬롯 1 요약 (클릭하면 다시 열림) */}
              <div
                onClick={() => setRoutineStep(1)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, marginBottom: 10, cursor: 'pointer',
                  background: 'rgba(91,141,239,0.1)', border: '1px solid rgba(91,141,239,0.2)',
                }}
              >
                <span style={{ fontSize: '0.82rem' }}>
                  슬롯 1: <strong>{ACTIVITIES.find(a => a.id === (routineSlot2Pick ?? state.routineSlot2))?.name}</strong>
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--blue)' }}>변경</span>
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 8, color: 'var(--blue)' }}>
                STEP 2 — 두 번째 활동을 골라주세요
              </div>

              {/* 자유시간 옵션 */}
              <div onClick={() => setRoutineSlot3Pick('__none__')} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 6,
                borderRadius: 10, cursor: 'pointer',
                background: routineSlot3Pick === '__none__' ? 'rgba(91,141,239,0.15)' : 'rgba(255,255,255,0.04)',
                border: routineSlot3Pick === '__none__' ? '1px solid var(--blue)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: '1.1rem' }}>🕊️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>자유시간</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>쉬면서 멘탈 회복 + 피로 감소</div>
                </div>
                {routineSlot3Pick === '__none__' && <span>✓</span>}
              </div>

              <ActivityPicker
                activities={activities.filter(a => a.slots === 1 && a.category !== 'rest' && a.id !== (routineSlot2Pick ?? state.routineSlot2))}
                selected={routineSlot3Pick && routineSlot3Pick !== '__none__' ? [routineSlot3Pick] : state.routineSlot3 ? [state.routineSlot3] : []}
                onToggle={(id) => setRoutineSlot3Pick(id)}
                maxSlots={1} currentSlots={0} state={state} compact
              />

              <button className="btn btn-primary" style={{ marginTop: 12 }}
                disabled={!(routineSlot2Pick ?? state.routineSlot2)}
                onClick={() => {
                  const s3 = routineSlot3Pick ?? state.routineSlot3;
                  setRoutine(routineSlot2Pick ?? state.routineSlot2, s3 === '__none__' ? null : s3);
                  setRoutineConfirmed(false);
                  setRoutineStep(1);
                }}>
                루틴 확정하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 활동 선택 */}
      <div data-tutorial="weekend" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{state.isVacation ? '🏖️ 이번 주 활동' : '🗓️ 주말 활동'}</span>
          <span style={{
            fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: currentSlots >= maxSlots ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.08)',
            color: currentSlots >= maxSlots ? 'var(--green)' : 'var(--text-muted)',
          }}>
            {currentSlots}/{maxSlots} 선택
          </span>
        </div>

        <ActivityPicker
          activities={activities}
          selected={selectedActivities}
          onToggle={toggleActivity}
          maxSlots={maxSlots}
          currentSlots={currentSlots}
          state={state}
          npcChoices={npcChoices}
          availableMoney={state.money - (
            (state.routineSlot2 ? (ACTIVITIES.find(a => a.id === state.routineSlot2)?.moneyCost || 0) : 0) +
            (state.routineSlot3 ? (ACTIVITIES.find(a => a.id === state.routineSlot3)?.moneyCost || 0) : 0) +
            selectedActivities.reduce((sum, id) => sum + (ACTIVITIES.find(a => a.id === id)?.moneyCost || 0), 0)
          )}
        />
      </div>

      {/* NPC 관계 — 만난 친구만 표시 */}
      {state.npcs.some(n => n.met) && (
        <div data-tutorial="npc" style={{ background: 'rgba(15,52,96,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>👥 친구</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {state.npcs.filter(n => n.met).map(n => {
              const intimacyColor = n.intimacy >= 70 ? 'var(--accent-soft)' : n.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
              const intimacyLabel = n.intimacy >= 70 ? '친함' : n.intimacy >= 40 ? '보통' : '어색';
              return (
                <div key={n.id}
                  onClick={() => setNpcDetailFor(n.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px',
                    transition: 'background 0.15s',
                  }}
                >
                  <Portrait characterId={n.id} size={36} expression="neutral" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{n.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${n.intimacy}%`, background: intimacyColor, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', color: intimacyColor, whiteSpace: 'nowrap' }}>
                        {intimacyLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NPC 선택 모달 */}
      {npcSelectFor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>누구와 {npcSelectFor === 'hang-out' ? '놀까' : npcSelectFor === 'study-group' ? '공부할까' : '활동할까'}?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>함께하는 친구에 따라 친밀도가 올라갑니다</div>
            {state.npcs.filter(n => n.met).map(npc => (
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

      {/* NPC 상세 모달 */}
      {npcDetailFor && (() => {
        const npc = state.npcs.find(n => n.id === npcDetailFor);
        if (!npc) return null;
        const intimacyColor = npc.intimacy >= 70 ? 'var(--accent-soft)' : npc.intimacy >= 40 ? 'var(--yellow)' : 'var(--text-muted)';
        const intimacyLabel = npc.intimacy >= 70 ? '절친' : npc.intimacy >= 40 ? '친구' : '아는 사이';
        return (
          <div onClick={() => setNpcDetailFor(null)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(15,52,96,0.98), rgba(26,26,46,0.98))',
              borderRadius: 16, padding: 24, width: '85%', maxWidth: 340, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <Portrait characterId={npc.id} size={72} expression="neutral" />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 12 }}>{npc.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{npc.description}</div>

              {/* 인사말 */}
              <div style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px',
                marginTop: 14, fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.6,
              }}>
                "{npc.greeting || '...'}"
              </div>

              {/* 성격 설명 */}
              {npc.personality && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                  {npc.personality}
                </div>
              )}

              {/* 친밀도 */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: intimacyColor }}>{intimacyLabel}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀도 {Math.round(npc.intimacy)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${npc.intimacy}%`, background: intimacyColor, borderRadius: 3 }} />
                </div>
              </div>

              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setNpcDetailFor(null)}>닫기</button>
            </div>
          </div>
        );
      })()}

      {/* 확정 버튼 */}
      <div data-tutorial="confirm" style={{ paddingBottom: 20 }}>
        <button className="btn btn-primary"
          disabled={(!state.isVacation && !state.routineSlot2) || !!routineTooExpensive}
          onClick={handleConfirm}
        >
          {routineTooExpensive
            ? '⬆ 돈이 부족해요 — 루틴을 변경하세요'
            : !state.isVacation && !state.routineSlot2
              ? '⬆ 먼저 방과후 루틴을 설정하세요'
              : currentSlots === 0
                ? (state.isVacation ? '이번 주는 쉰다' : '주말 그냥 보내기')
                : '이번 주 확정 →'}
        </button>
      </div>

    </BgWrapper>
    {/* 상점 */}
    {showShop && state && (
      <Shop
        state={state}
        onBuy={(item: ShopItem, npcId?: string) => buyItem(item, npcId)}
        onClose={() => setShowShop(false)}
      />
    )}
    {/* 튜토리얼 — BgWrapper 밖에서 렌더 (리렌더 시 언마운트 방지) */}
    {showTutorial && (
      <Tutorial
        routineSet={!!state.routineSlot2}
        onComplete={() => {
          setShowTutorial(false);
          localStorage.setItem('lifetrack_tutorial_done', '1');
          // 튜토리얼 중 선택한 것 전부 리셋 — 진짜 게임 시작
          setRoutine(null, null);
          setRoutineSlot2Pick(null);
          setRoutineSlot3Pick(null);
          setSelectedActivities([]);
          setNpcChoices({});
          setRoutineConfirmed(false);
          setRoutineStep(1);
          setLastReaction(null);
        }}
      />
    )}
    </>
  );
}
