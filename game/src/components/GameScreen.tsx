import { useState, useEffect } from 'react';
import { useGameStore } from '../engine/store';
import { getWeekLabel, getMonthLabel, calculateEnding } from '../engine/gameEngine';
import { getAvailableActivities, ACTIVITIES } from '../engine/activities';
import { StatKey, STAT_LABELS, getGrade, SubjectKey, SUBJECT_LABELS, ExamResult } from '../engine/types';
import { Portrait } from './Portrait';
import { NPC_APPEARANCES } from './CharacterAvatar';
import { STAT_DESCRIPTIONS } from '../engine/statDescriptions';
import { ActivityPicker } from './ActivityPicker';
import { getBackground, getEventBackground, getSchoolLevel } from '../engine/backgrounds';
import { getCharacterDialogue, getActivityReaction, getNpcDialogue } from '../engine/dialogues';
import { Tutorial } from './Tutorial';
import { Shop } from './Shop';
import { ShopItem } from '../engine/shopSystem';
import { EventScene } from './EventScene';

const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};


export function GameScreen() {
  const { state, setWeekendChoices, setVacationChoices, setRoutine, advanceWeek, resolveEvent, setNpcActivityMap, buyItem } = useGameStore();

  // 뒤로가기/새로고침 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    // 브라우저 뒤로가기 방지: history에 더미 항목 추가
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 엔딩 도달 시 클리어 플래그 저장 (다음 플레이부터 도전 모드 해금)
  useEffect(() => {
    if (state?.phase === 'ending') {
      try { localStorage.setItem('lifetrack_has_cleared', '1'); } catch { /* storage unavailable */ }
    }
  }, [state?.phase]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showNpc, setShowNpc] = useState(false);
  const [routineSlot2Pick, setRoutineSlot2Pick] = useState<string | null>(null);
  const [routineSlot3Pick, setRoutineSlot3Pick] = useState<string | null>(null);
  const [routineConfirmed, setRoutineConfirmed] = useState(false);
  const [routineStep, setRoutineStep] = useState<1 | 2>(1); // 슬롯 1 먼저, 그 다음 슬롯 2
  const [eventResultData, setEventResultData] = useState<{ message: string; effects: Record<string, string>[]; event?: any; choiceIndex?: number } | null>(null);
  const [cgLoaded, setCgLoaded] = useState(false);
  const [npcSelectFor, setNpcSelectFor] = useState<string | null>(null);
  const [npcDetailFor, setNpcDetailFor] = useState<string | null>(null);
  const [npcChoices, setNpcChoices] = useState<Record<string, string>>({});
  const [expandedStat, setExpandedStat] = useState<StatKey | null>(null);
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('lifetrack_tutorial_done');
  });

  if (!state) return null;

  const bg = getBackground(state.week, state.isVacation, state.mentalState, state.year);
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

  // ===== v1.2 학년말 일기장 (Y1~Y6) =====
  if (state.phase === 'year-end') {
    const finishedYear = state.year;  // 방금 끝난 학년 (advance 전)
    const yearNames = ['초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년', '고등학교 1학년', '고등학교 2학년', '고등학교 3학년'];
    const yearName = yearNames[finishedYear - 1] || `${finishedYear}학년`;
    const slotsThisYear = state.memorySlots.filter(m => m.year === finishedYear);
    const milestone = state.milestoneScenes.find(m => m.year === finishedYear);
    const { advanceFromYearEnd } = useGameStore.getState();

    return (
      <BgWrapper>
        <div className="fade-in" style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: 8 }}>
            YEAR-END
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {yearName}이 끝났다
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 28 }}>
            이 한 해를 조용히 돌아본다
          </div>

          {/* 해당 학년에 쌓인 memorySlots */}
          {slotsThisYear.length > 0 && (
            <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '18px 22px', marginBottom: 16, borderLeft: '2px solid var(--accent-soft)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 12, textAlign: 'center' }}>
                이 해에 남은 장면
              </div>
              {slotsThisYear
                .sort((a, b) => a.week - b.week)
                .map((slot, i) => (
                  <div key={slot.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: i === slotsThisYear.length - 1 ? 0 : 10, fontStyle: 'italic' }}>
                    {slot.recallText}
                  </div>
                ))}
            </div>
          )}

          {/* 해당 학년 milestone 요약 */}
          {milestone?.summaryText && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 10 }}>
                돌아보면
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                {milestone.summaryText}
              </div>
            </div>
          )}

          {/* 아무 기억도 없으면 조용히 */}
          {slotsThisYear.length === 0 && !milestone?.summaryText && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 28, lineHeight: 1.7 }}>
              특별히 기억에 남는 일은 없었다.<br />그래도 한 해가 지나갔다.
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ maxWidth: 280 }}
            onClick={advanceFromYearEnd}
          >
            다음 학년으로 →
          </button>
        </div>
      </BgWrapper>
    );
  }

  // ===== 엔딩 =====
  if (state.phase === 'ending') {
    const ending = calculateEnding(state);
    const trackLabel = state.track === 'humanities' ? '문과' : state.track === 'science' ? '이과' : null;
    return (
      <BgWrapper>
        <div className="ending-screen fade-in" style={{ minHeight: 'auto', padding: 0 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>7년의 여정이 끝났습니다</div>
          <div className="ending-title">{ending.title}</div>
          <div className="ending-desc">{ending.description}</div>

          {/* 수능 등급 + 진로 카드 */}
          {ending.suneungGrade && (
            <div style={{
              background: 'rgba(224,138,91,0.1)', border: '1px solid rgba(224,138,91,0.3)',
              borderRadius: 12, padding: '12px 16px', margin: '12px auto 16px', maxWidth: 360,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>수능 결과</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: ending.suneungGrade <= 2 ? 'var(--gold)' : ending.suneungGrade <= 4 ? 'var(--green)' : ending.suneungGrade <= 6 ? 'var(--blue)' : 'var(--red)' }}>
                {ending.suneungGrade}등급
              </div>
              {trackLabel && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{trackLabel}</div>
              )}
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 8, color: 'var(--accent-soft)' }}>
                {ending.career}
              </div>
            </div>
          )}

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

          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto 16px' }}>
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

          {/* v1.2 회상 — 결정적 장면들 */}
          {ending.memorialHighlights && ending.memorialHighlights.length > 0 && (
            <div style={{ maxWidth: 420, margin: '0 auto 16px', padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: '2px solid var(--accent-soft)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.15em' }}>돌아보면</div>
              {ending.memorialHighlights.map((h, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: h.isFallback ? 'var(--text-muted)' : 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 6, fontStyle: 'italic' }}>
                  {h.recallText}
                </div>
              ))}
            </div>
          )}

          {/* v1.2 7년 요약 — 학년별 클로저 */}
          {ending.yearClosings && ending.yearClosings.length > 0 && (
            <div style={{ maxWidth: 420, margin: '0 auto 16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.15em' }}>7년의 마디</div>
              {ending.yearClosings.map((t, i) => (
                <div key={i} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent-soft)', fontWeight: 600, marginRight: 8 }}>Y{i + 1}</span>{t}
                </div>
              ))}
            </div>
          )}

          {/* NPC 근황 */}
          {ending.npcStories.length > 0 && (
            <div style={{ maxWidth: 360, margin: '0 auto 16px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>그리고 그 후</div>
              {ending.npcStories.map((s, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center' }}>
                  {s}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
            총합 {Math.round(Object.values(state.stats).reduce((a, b) => a + b, 0))}점 · 번아웃 {state.burnoutCount}회
          </div>

          {/* 다회차 유도 문구 */}
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', marginBottom: 16, textAlign: 'center', fontStyle: 'italic' }}>
            다른 길은 어땠을까?
          </div>

          <button className="btn btn-primary" style={{ maxWidth: 280 }} onClick={() => window.location.reload()}>
            다시 시작하기
          </button>
        </div>
      </BgWrapper>
    );
  }

  // ===== 이벤트 화면 (비주얼 노벨 스타일) =====
  if (state.currentEvent && state.phase === 'event') {
    return (
      <EventScene
        event={state.currentEvent}
        gender={state.gender}
        year={state.year}
        npcs={state.npcs.map(n => ({ id: n.id, name: n.name, met: n.met }))}
        onChoice={(index: number) => {
          const evt = state.currentEvent!;
          const choice = ((state.gender === 'female' && evt.femaleChoices) ? evt.femaleChoices : evt.choices)[index];
          const effects: Record<string, string>[] = [];
          for (const [k, v] of Object.entries(choice.effects)) {
            const val = v as number;
            if (val !== 0) effects.push({ text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`, color: val > 0 ? 'var(--green)' : 'var(--red)' });
          }
          if (choice.fatigueEffect) effects.push({ text: `피로 ${choice.fatigueEffect > 0 ? '+' : ''}${choice.fatigueEffect}`, color: choice.fatigueEffect > 0 ? 'var(--red)' : 'var(--green)' });
          if (choice.moneyEffect) effects.push({ text: `💰 ${choice.moneyEffect > 0 ? '+' : ''}${choice.moneyEffect}만`, color: choice.moneyEffect > 0 ? 'var(--green)' : 'var(--red)' });
          // NPC 첫 만남 체크
          const newMeets: string[] = [];
          if (choice.npcEffects) for (const ne of choice.npcEffects) {
            const npc = state.npcs.find(n => n.id === ne.npcId);
            if (npc) {
              effects.push({ text: `${npc.emoji} ${npc.name} ${ne.intimacyChange > 0 ? '♥' : '💔'}`, color: ne.intimacyChange > 0 ? 'var(--blue)' : 'var(--red)' });
              if (!npc.met) newMeets.push(npc.name);
            }
          }
          // 첫 만남 알림 추가
          for (const name of newMeets) {
            effects.unshift({ text: `🤝 ${name}와(과) 알게 되었다!`, color: 'var(--yellow)' });
          }
          setEventResultData({ message: choice.message, effects, event: evt, choiceIndex: index });
          resolveEvent(index);
        }}
      />
    );
  }

  // ===== 이벤트 결과 — 비주얼 노벨 배경 유지 =====
  if (eventResultData) {
    const resultEvent = eventResultData.event;
    const resultLocation = resultEvent?.location;
    const BASE = import.meta.env.BASE_URL;
    const gradients: Record<string, string> = {
      classroom: 'linear-gradient(180deg, #3a2f42 0%, #241a2a 100%)',
      home: 'linear-gradient(180deg, #3d2b1f 0%, #2a1f15 100%)',
      park: 'linear-gradient(180deg, #1e3a26 0%, #13281a 100%)',
      hallway: 'linear-gradient(180deg, #3a3342 0%, #241f28 100%)',
      rooftop: 'linear-gradient(180deg, #4a5a85 0%, #2c3a58 100%)',
      street: 'linear-gradient(180deg, #4a3f5c 0%, #2a2535 100%)',
      gym: 'linear-gradient(180deg, #5c3a2a 0%, #3a2518 100%)',
      school_gate: 'linear-gradient(180deg, #3a5c4a 0%, #1a3a28 100%)',
      cafe: 'linear-gradient(180deg, #5c4a3a 0%, #3a2f20 100%)',
      music_room: 'linear-gradient(180deg, #3a2f5c 0%, #2a1f3a 100%)',
      beach: 'linear-gradient(180deg, #4a8ab5 0%, #2a5a80 100%)',
      auditorium: 'linear-gradient(180deg, #5c4a4a 0%, #3a2a2a 100%)',
    };
    const bgGradient = resultLocation ? (gradients[resultLocation] || 'linear-gradient(180deg, #1f1a25 0%, #17151c 100%)') : 'linear-gradient(180deg, #1f1a25 0%, #17151c 100%)';
    // 배경 이미지: event.background 우선, 없으면 location 기반 폴백
    const resolvedEventBg = resultEvent?.background ? getEventBackground(resultEvent.background, state.year) : undefined;
    const bgImgCandidates = resolvedEventBg
      ? [`${BASE}${resolvedEventBg.replace(/^\//, '')}`]
      : resultLocation ? [
        `${BASE}images/backgrounds/${resultLocation}_afternoon.png`,
        `${BASE}images/backgrounds/${resultLocation}_evening.png`,
        `${BASE}images/backgrounds/${resultLocation}_spring.png`,
        `${BASE}images/backgrounds/${resultLocation}.png`,
      ] : [];
    const bgImgUrl = bgImgCandidates.length > 0 ? bgImgCandidates[0] : null;

    // 이벤트 결과 이미지 폴백 체인:
    // {schoolLevel}/{eventId}_c{ci}_{gender} → {sl}/{eventId}_{gender} → {sl}/{eventId}_c{ci} → {sl}/{eventId}
    //   → common/{eventId}_c{ci}_{gender} → common/{eventId}_{gender} → common/{eventId}_c{ci} → common/{eventId}
    // 각 학년대별 다른 CG가 가능하도록 schoolLevel 디렉토리 우선, 없으면 학교급-무관 common 폴백.
    const eventId = resultEvent?.id;
    const ci = eventResultData.choiceIndex ?? 0;
    const genderSuffix = state.gender === 'male' ? 'm' : 'f';
    const schoolLevel = getSchoolLevel(state.year);
    const buildCandidates = (dir: string): string[] => eventId ? [
      `${BASE}images/events/${dir}/${eventId}_c${ci}_${genderSuffix}.png`,
      `${BASE}images/events/${dir}/${eventId}_${genderSuffix}.png`,
      `${BASE}images/events/${dir}/${eventId}_c${ci}.png`,
      `${BASE}images/events/${dir}/${eventId}.png`,
    ] : [];
    const eventImgCandidates: string[] = [
      ...buildCandidates(schoolLevel),
      ...buildCandidates('common'),
    ];
    const eventImgPrimary = eventImgCandidates[0] ?? null;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#0d0b12' }}>
        {/* 배경 — CG 로드 안 됐을 때 표시 */}
        {!cgLoaded && (
          <div style={{ position: 'absolute', inset: 0, background: bgGradient }}>
            {bgImgUrl && <img src={bgImgUrl} alt="" data-bg-idx="0" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} onError={e => {
              const img = e.target as HTMLImageElement;
              const idx = parseInt(img.dataset.bgIdx || '0') + 1;
              if (idx < bgImgCandidates.length) {
                img.dataset.bgIdx = String(idx);
                img.src = bgImgCandidates[idx];
              } else {
                img.style.display = 'none';
              }
            }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          </div>
        )}
        {/* CG 없을 때: 화면 중앙에 주인공 전신 */}
        {!cgLoaded && (
          <div style={{
            position: 'absolute', top: '5%', left: 0, right: 0, bottom: '35%',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 5, pointerEvents: 'none',
          }}>
            <img
              src={`${BASE}images/characters/${state.gender === 'male' ? 'player_m' : 'player_f'}${state.year === 1 ? '_elementary' : ''}_fullbody.png`}
              alt=""
              style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
        {/* 결과 내용 — CG 있으면 중앙, 없으면 하단 */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10, padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: cgLoaded ? 'center' : 'flex-end' }} className="fade-in">
          {/* 이벤트 결과 이미지 (CG) — 인덱스 기반 cascade 폴백 */}
          {eventImgPrimary && (
            <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
              <img
                src={eventImgPrimary}
                alt=""
                data-cg-idx="0"
                style={{ width: '100%', display: 'block', borderRadius: 12 }}
                onLoad={() => setCgLoaded(true)}
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  const idx = parseInt(img.dataset.cgIdx || '0') + 1;
                  if (idx < eventImgCandidates.length) {
                    img.dataset.cgIdx = String(idx);
                    img.src = eventImgCandidates[idx];
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />
            </div>
          )}
          {/* 결과 메시지 */}
          <div style={{
            background: 'rgba(22,19,27,0.92)', backdropFilter: 'blur(12px)',
            borderRadius: 16, padding: '24px 20px', marginBottom: 20,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: '1.15rem', lineHeight: 1.8, fontStyle: 'italic', whiteSpace: 'pre-line', color: 'rgba(255,255,255,0.95)', textAlign: 'center' }}>
              "{eventResultData.message}"
            </div>
          </div>
          {/* 효과 배지 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            {eventResultData.effects.map((eff, i) => (
              <div key={i} style={{
                background: eff.text.includes('알게 되었다') ? 'rgba(229,192,123,0.15)' : 'rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 16px', fontSize: eff.text.includes('알게 되었다') ? '1.0rem' : '0.9rem',
                fontWeight: 600, color: eff.color,
                border: eff.text.includes('알게 되었다') ? '1px solid rgba(229,192,123,0.3)' : 'none',
              }}>
                {eff.text}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setEventResultData(null); setCgLoaded(false); setShowResult(true); }}>
            계속 →
          </button>
        </div>
      </div>
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

  // 루틴 콤보 표시
  const routineComboLabel = !state.isVacation && state.routineWeeks >= 3
    ? (state.routineWeeks >= 8 ? '🔥 ' : state.routineWeeks >= 6 ? '⭐ ' : '✨ ')
    : '';
  const routineComboWeeks = !state.isVacation && state.routineWeeks >= 3 ? state.routineWeeks : 0;

  // 슬롯 렌더 헬퍼
  const renderSlot = (
    emoji: string, timeLabel: string, activityName: string | null,
    onClick: (() => void) | null, isFixed = false, isRoutine = false,
    moneyCost?: number, withNpc?: string,
  ) => {
    const isEmpty = !activityName;
    const isClickable = !isFixed && onClick;
    const shouldHighlight = isEmpty && !isFixed; // 빈 선택 슬롯은 항상 강조
    return (
      <div
        onClick={() => isClickable && onClick!()}
        className={shouldHighlight ? 'slot-pulse' : ''}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 4, borderRadius: 10,
          cursor: isClickable ? 'pointer' : 'default',
          background: isFixed ? 'rgba(255,255,255,0.03)' :
                      isEmpty ? 'rgba(224,138,91,0.08)' :
                      isRoutine ? 'rgba(125,163,217,0.12)' : 'rgba(224,138,91,0.12)',
          border: isEmpty && !isFixed ? '1px dashed rgba(224,138,91,0.4)' :
                  isRoutine && routineComboWeeks >= 3 ? '1px solid rgba(224,179,84,0.4)' :
                  isRoutine ? '1px solid rgba(125,163,217,0.2)' :
                  !isEmpty && !isFixed ? '1px solid rgba(224,138,91,0.2)' :
                  '1px solid rgba(255,255,255,0.04)',
          boxShadow: isRoutine && routineComboWeeks >= 6 ? '0 0 8px rgba(224,179,84,0.2)' :
                     isEmpty && !isFixed ? '0 0 6px rgba(224,138,91,0.15)' : 'none',
          transition: 'all 0.15s',
          opacity: isFixed ? 0.6 : 1,
          animation: shouldHighlight ? 'slotPulse 2s ease-in-out infinite' : 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
          <span style={{ fontSize: '1rem' }}>{emoji}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>{timeLabel}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {activityName ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{activityName}</span>
                {isRoutine && <span style={{ fontSize: '0.55rem', color: 'var(--blue)', background: 'rgba(125,163,217,0.15)', padding: '1px 4px', borderRadius: 3 }}>매주</span>}
                {isRoutine && routineComboWeeks >= 3 && <span style={{ fontSize: '0.55rem', color: 'var(--yellow)', background: 'rgba(224,179,84,0.15)', padding: '1px 4px', borderRadius: 3 }}>{routineComboLabel}{routineComboWeeks}주 연속</span>}
              </div>
              {(moneyCost !== undefined && moneyCost > 0 || withNpc) && (
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  {moneyCost !== undefined && moneyCost > 0 && <span style={{ color: 'var(--yellow)' }}>{moneyCost}만원 </span>}
                  {withNpc && <span style={{ color: 'var(--accent-soft)' }}>with {withNpc}</span>}
                </div>
              )}
            </div>
          ) : isFixed ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>수업</span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-soft)', fontWeight: 500 }}>탭하여 활동 선택</span>
          )}
        </div>
        {/* 선택 가능한 슬롯에 변경 아이콘 표시 */}
        {isClickable && (
          <div style={{ flexShrink: 0, fontSize: '0.7rem', color: isEmpty ? 'var(--accent-soft)' : 'rgba(255,255,255,0.3)', padding: '2px 4px' }}>
            {isEmpty ? '▶' : '✎'}
          </div>
        )}
      </div>
    );
  };

  // 다가오는 이벤트 계산 (학교급별 시험 스케줄)
  const upcomingEvents: string[] = [];
  const examScheduleMap: Record<number, string> = {};
  if (state.year <= 1) {
    // 초등: 단원평가
    examScheduleMap[17] = '단원평가';
    examScheduleMap[38] = '단원평가';
  } else if (state.year <= 4) {
    // 중등
    examScheduleMap[8] = '중간고사'; examScheduleMap[17] = '기말고사';
    examScheduleMap[30] = '중간고사'; examScheduleMap[38] = '기말고사';
  } else {
    // 고등: 내신 + 모의
    examScheduleMap[8] = '중간고사'; examScheduleMap[12] = '모의고사';
    examScheduleMap[17] = '기말고사'; examScheduleMap[30] = '중간고사';
    examScheduleMap[33] = '모의고사';
    if (state.year === 7) { examScheduleMap[35] = '수능'; }
    else { examScheduleMap[38] = '기말고사'; }
  }
  for (const [weekStr, name] of Object.entries(examScheduleMap)) {
    const diff = Number(weekStr) - state.week;
    if (diff > 0 && diff <= 4) upcomingEvents.push(`${name}까지 ${diff}주`);
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
    // 주말 활동 미선택 시 확인 팝업
    if (!state.isVacation && selectedActivities.length === 0) {
      if (!window.confirm('주말 활동을 선택하지 않았어요!\n정말 이번 주말은 쉴까요?')) {
        return;
      }
    }
    if (state.isVacation) setVacationChoices(selectedActivities);
    else setWeekendChoices(selectedActivities);
    // npcChoices를 그대로 전달 (슬롯 키 포함 — store에서 npcId만 추출)
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
            <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} year={state.year} />
            <div style={{
              flex: 1, background: 'rgba(42,34,48,0.9)', backdropFilter: 'blur(6px)',
              borderRadius: '4px 12px 12px 12px', padding: '10px 14px', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.6,
            }}>
              {state.weekLog.messages.find(m => m.startsWith('📖')) || `"${dialogue}"`}
            </div>
          </div>

          {/* 성장 달성 — 여러 개 동시 지원 */}
          {(state.weekLog.milestoneMessages || []).map((msg, i) => (
            <div key={i} className="milestone-box">⭐ 성장! — {msg}</div>
          ))}
          {state.weekLog.messages.filter(m => m.includes('⚠') || m.includes('🔥') || m.includes('💪')).map((msg, i) => (
            <div key={i} className="message-box">{msg}</div>
          ))}

          {/* 스탯 변화 — 정확한 수치 */}
          <div style={{ background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
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
              <span>💰 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원</span>
            </div>
          </div>

          {/* 시험 결과 (학교급별 분기) */}
          {state.weekLog?.examResult && (() => {
            const exam = state.weekLog.examResult!;
            const gradeColors: Record<string, string> = { S: '#e5c07b', A: '#8fb573', B: '#7da3d9', C: '#e0a15e', D: '#d96458' };
            const examTitle = exam.examType === 'unit-test' ? '단원평가'
              : exam.examType === 'mock' ? '모의고사'
              : exam.examType === 'suneung' ? '수능'
              : exam.examType === 'midterm' ? '중간고사' : '기말고사';
            const isMockOrSuneung = exam.examType === 'mock' || exam.examType === 'suneung';

            return (
              <div style={{
                background: isMockOrSuneung ? 'rgba(62,28,42,0.92)' : 'rgba(42,34,48,0.92)',
                backdropFilter: 'blur(6px)', borderRadius: 14,
                padding: '16px 16px', marginBottom: 16,
                border: isMockOrSuneung ? '1px solid rgba(224,138,91,0.35)' : '1px solid rgba(224,138,91,0.2)',
              }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
                  {isMockOrSuneung ? '📊' : '📝'} {examTitle} {exam.examType === 'unit-test' ? '결과' : '성적표'}
                </div>

                {/* 모의고사/수능: 등급 크게 표시 */}
                {isMockOrSuneung && exam.mockGrade != null && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: exam.mockGrade <= 2 ? 'var(--gold)' : exam.mockGrade <= 4 ? 'var(--green)' : exam.mockGrade <= 6 ? 'var(--blue)' : 'var(--red)' }}>
                      {exam.mockGrade}등급
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>전국 기준</div>
                  </div>
                )}

                {/* 과목별 — 초등은 3단계, 중등/고등은 점수+등급. 모의/수능은 예체능 제외 */}
                {(Object.keys(exam.subjects) as SubjectKey[])
                  .filter(key => !(isMockOrSuneung && key === 'artsPhysical'))
                  .map(key => {
                  const s = exam.subjects[key];
                  const isElementary = exam.schoolLevel === 'elementary';
                  const elemGrade = s.elementaryGrade;
                  const elemColor = elemGrade === '잘함' ? '#8fb573' : elemGrade === '보통' ? '#7da3d9' : '#e0a15e';
                  // socialScience 라벨: 고등 + track에 따라 분기
                  const subjectLabel = (key === 'socialScience' && exam.schoolLevel === 'high')
                    ? (state.track === 'humanities' ? '사회탐구' : state.track === 'science' ? '과학탐구' : '탐구')
                    : SUBJECT_LABELS[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ width: 70, fontSize: '0.8rem', fontWeight: 600 }}>{subjectLabel}</span>
                      {isElementary ? (
                        <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: elemColor, textAlign: 'center' }}>
                          {elemGrade}
                        </span>
                      ) : (
                        <>
                          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, margin: '0 8px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.score}%`, background: gradeColors[s.grade], borderRadius: 4, transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ width: 22, fontSize: '0.82rem', fontWeight: 700, color: gradeColors[s.grade], textAlign: 'center' }}>{s.grade}</span>
                          {s.delta !== 0 && (
                            <span style={{ width: 36, fontSize: '0.65rem', fontWeight: 600, textAlign: 'right', color: s.delta > 0 ? 'var(--green)' : 'var(--red)' }}>
                              {s.delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(s.delta))}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* 석차 — 중등/고등 내신만 표시 */}
                {exam.rank != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>반 석차</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{exam.rank}등</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ 30명</span>
                      {exam.prevRank != null && (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          color: exam.rank < exam.prevRank ? 'var(--green)' : exam.rank > exam.prevRank ? 'var(--red)' : 'var(--text-muted)',
                        }}>
                          {exam.rank < exam.prevRank ? `▲${exam.prevRank - exam.rank}` : exam.rank > exam.prevRank ? `▼${exam.rank - exam.prevRank}` : '→'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

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
            <div style={{ background: 'rgba(224,138,91,0.1)', borderRadius: 10, padding: '8px 12px', marginBottom: 16, fontSize: '0.78rem', textAlign: 'center' }}>
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
        <Portrait characterId={state.gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={state.stats.mental} mentalState={state.mentalState} year={state.year} />
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
            💰 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원 <span style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>🛒</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>매주 용돈 +{state.parents.includes('wealth') ? 8 : 3}만원</div>
        </div>
      </div>

      {/* 이벤트 배너는 주간 플래너 안으로 이동 */}

      {/* 독백 말풍선 */}
      <div style={{
        background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)',
        borderRadius: '4px 12px 12px 12px', padding: '8px 14px', marginBottom: 10,
        fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)',
      }}>
        {lastReaction ? `"${lastReaction}"` : `"${dialogue}"`}
      </div>

      {/* 다가오는 이벤트 배너 */}
      {upcomingEvents.length > 0 && (
        <div style={{
          background: 'rgba(224,138,91,0.15)', border: '1px solid rgba(224,138,91,0.3)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 10,
          fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
          color: 'var(--accent-soft)',
        }}>
          {upcomingEvents.map((e, i) => (
            <div key={i}>📌 {e}</div>
          ))}
        </div>
      )}

      {/* 스탯 (접기/펼치기) */}
      <div data-tutorial="stats" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: showStats ? '8px 12px' : '8px 12px', marginBottom: 10 }}>
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

      {/* ===== 주간 플래너 ===== */}
      <div data-tutorial="routine" style={{
        background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
        border: routineTooExpensive ? '1px solid var(--red)' : '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>
          📅 이번 주 일과
          {!state.isVacation && state.routineWeeks >= 3 && (
            <span style={{ color: 'var(--yellow)', marginLeft: 8, fontSize: '0.68rem' }}>
              {routineComboLabel}루틴 보너스 활성
            </span>
          )}
        </div>

        {/* 돈 부족 경고 */}
        {routineTooExpensive && (
          <div style={{
            background: 'rgba(217,100,88,0.15)', border: '1px solid rgba(217,100,88,0.3)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem',
            textAlign: 'center', color: 'var(--red)',
          }}>
            💰 돈이 부족해요! 방과후 활동을 변경해 주세요 (현재 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원, 필요 {routineCost}만원)
          </div>
        )}

        {/* 학기 중: 주중 | 주말 가로 2단 */}
        {!state.isVacation && (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* 왼쪽: 주중 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>주중 (월~금)</div>
              {renderSlot('🏫', '오전', '학교', null, true)}
              {renderSlot('🏫', '오후', '학교', null, true)}
              {renderSlot(
                state.routineSlot2 ? '📚' : '❓',
                '방과후',
                state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2)?.name || null : null,
                () => setEditingSlot('routine1'),
                false, true,
                state.routineSlot2 ? ACTIVITIES.find(a => a.id === state.routineSlot2)?.moneyCost : undefined,
              )}
              {renderSlot(
                state.routineSlot3 ? '🌙' : '🕊️',
                '저녁',
                state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.name || null : (state.routineSlot2 ? '자유시간' : null),
                () => setEditingSlot('routine2'),
                false, !!state.routineSlot2,
                state.routineSlot3 ? ACTIVITIES.find(a => a.id === state.routineSlot3)?.moneyCost : undefined,
              )}
            </div>

            {/* 오른쪽: 주말 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>주말 (토~일)</div>
              {renderSlot(
                selectedActivities[0] ? '🌟' : '☀️',
                '토요일',
                selectedActivities[0] ? ACTIVITIES.find(a => a.id === selectedActivities[0])?.name || null : null,
                () => {
                  // slots=2 활동이 선택되어 있으면 전체 초기화 후 선택 패널 열기
                  const act = ACTIVITIES.find(a => a.id === selectedActivities[0]);
                  if (act && act.slots >= 2) {
                    setSelectedActivities([]);
                  }
                  setEditingSlot('weekend1');
                },
                false, false,
                selectedActivities[0] ? ACTIVITIES.find(a => a.id === selectedActivities[0])?.moneyCost : undefined,
                (npcChoices[`${selectedActivities[0]}:0`] || npcChoices[selectedActivities[0]])
                  ? state.npcs.find(n => n.id === (npcChoices[`${selectedActivities[0]}:0`] || npcChoices[selectedActivities[0]]))?.name : undefined,
              )}
              {(() => {
                const slot0Act = ACTIVITIES.find(a => a.id === selectedActivities[0]);
                const isSlot0TwoSlot = slot0Act && slot0Act.slots >= 2;
                return renderSlot(
                  isSlot0TwoSlot ? '💤' : selectedActivities[1] ? '🌟' : '☀️',
                  '일요일',
                  isSlot0TwoSlot ? '(연속 활동)' : selectedActivities[1] ? ACTIVITIES.find(a => a.id === selectedActivities[1])?.name || null : null,
                  isSlot0TwoSlot ? null : () => setEditingSlot('weekend2'),
                  isSlot0TwoSlot, false,
                  isSlot0TwoSlot ? undefined : selectedActivities[1] ? ACTIVITIES.find(a => a.id === selectedActivities[1])?.moneyCost : undefined,
                  isSlot0TwoSlot ? undefined :
                    (npcChoices[`${selectedActivities[1]}:1`] || npcChoices[selectedActivities[1]])
                      ? state.npcs.find(n => n.id === (npcChoices[`${selectedActivities[1]}:1`] || npcChoices[selectedActivities[1]]))?.name : undefined,
                );
              })()}

              {/* 주말 미선택 경고 */}
              {selectedActivities.length === 0 && state.routineSlot2 && (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(224,179,84,0.15)', border: '1px solid rgba(224,179,84,0.3)',
                  fontSize: '0.72rem', color: 'var(--yellow)', lineHeight: 1.4,
                  textAlign: 'center', animation: 'pulse-soft 2s ease-in-out infinite',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>주말 활동이 비어있어요!</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>토/일 슬롯을 탭해서 활동을 선택하세요</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 방학: 자유 슬롯 */}
        {state.isVacation && (
          <>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              🏖️ 방학 — 자유 시간
            </div>
            {Array.from({ length: maxSlots }, (_, i) => (
              <div key={i}>
                {renderSlot(
                  selectedActivities[i] ? '🌟' : '☀️',
                  `활동 ${i + 1}`,
                  selectedActivities[i] ? ACTIVITIES.find(a => a.id === selectedActivities[i])?.name || null : null,
                  () => setEditingSlot(`weekend${i + 1}` as any),
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* 슬롯 편집 팝업 */}
      {editingSlot && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 250,
        }} onClick={() => setEditingSlot(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'linear-gradient(180deg, rgba(42,34,48,0.99), rgba(23,21,28,0.99))',
            borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600,
            maxHeight: '92vh', minHeight: '70vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
          }}>
            {/* 헤더 — 크고 명확하게 */}
            <div style={{
              padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {editingSlot === 'routine1' ? '📚 방과후 활동' :
                   editingSlot === 'routine2' ? '🌙 저녁 활동' :
                   '☀️ 주말 활동'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {editingSlot?.startsWith('routine') ? '매주 반복되는 루틴을 골라주세요' : '이번 주말에 할 활동을 골라주세요'}
                </div>
              </div>
              <span onClick={() => setEditingSlot(null)} style={{
                fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
              }}>✕ 닫기</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
              {/* 루틴 슬롯 2(저녁)에 자유시간 옵션 */}
              {editingSlot === 'routine2' && (
                <div onClick={() => {
                  const slot1 = routineSlot2Pick ?? state.routineSlot2;
                  if (slot1) { setRoutine(slot1, null); }
                  setEditingSlot(null);
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 6,
                  borderRadius: 10, cursor: 'pointer',
                  background: !state.routineSlot3 ? 'rgba(125,163,217,0.15)' : 'rgba(255,255,255,0.04)',
                  border: !state.routineSlot3 ? '1px solid var(--blue)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>🕊️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>자유시간</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>쉬면서 멘탈 회복 + 피로 감소</div>
                  </div>
                </div>
              )}
              <ActivityPicker
                activities={
                  editingSlot === 'routine1' || editingSlot === 'routine2'
                    ? activities.filter(a => a.slots === 1 && a.category !== 'rest' &&
                        (editingSlot === 'routine2' ? a.id !== (state.routineSlot2) : true))
                    : activities
                }
                selected={
                  editingSlot === 'routine1' ? (state.routineSlot2 ? [state.routineSlot2] : []) :
                  editingSlot === 'routine2' ? (state.routineSlot3 ? [state.routineSlot3] : []) :
                  (() => {
                    // 주말/방학: 현재 편집 중인 슬롯의 활동만 하이라이트
                    const idx = editingSlot === 'weekend1' ? 0 :
                                editingSlot === 'weekend2' ? 1 :
                                parseInt((editingSlot || '').replace('weekend', '')) - 1;
                    return selectedActivities[idx] ? [selectedActivities[idx]] : [];
                  })()
                }
                onToggle={(id) => {
                  if (editingSlot === 'routine1') {
                    setRoutine(id, state.routineSlot3 === id ? null : state.routineSlot3);
                    // routine1 설정 후 → routine2가 비어있으면 자동으로 열기
                    if (!state.routineSlot3) {
                      setEditingSlot('routine2');
                    } else {
                      setEditingSlot(null);
                    }
                  } else if (editingSlot === 'routine2') {
                    setRoutine(state.routineSlot2, id);
                    setEditingSlot(null);
                  } else {
                    // 주말/방학 슬롯 — 인덱스 기반 할당 (같은 활동 중복 가능)
                    const slotIdx = editingSlot === 'weekend1' ? 0 :
                                    editingSlot === 'weekend2' ? 1 :
                                    parseInt(editingSlot.replace('weekend', '')) - 1;
                    const SOCIAL_IDS = ['hang-out', 'club', 'study-group'];
                    if (SOCIAL_IDS.includes(id)) {
                      // NPC 선택 필요 — slotKey 저장 후 NPC 모달 열기
                      setNpcSelectFor(`slot:${slotIdx}:${id}`);
                    } else {
                      const act = ACTIVITIES.find(a => a.id === id);
                      const newArr = [...selectedActivities];
                      if (act && act.slots >= 2) {
                        // slots=2 활동: 모든 슬롯을 채움
                        for (let i = 0; i < maxSlots; i++) newArr[i] = id;
                        setSelectedActivities(newArr.slice(0, maxSlots));
                      } else {
                        newArr[slotIdx] = id;
                        setSelectedActivities(newArr);
                      }
                      setLastReaction(getActivityReaction(id));
                    }
                    setEditingSlot(null);
                  }
                }}
                maxSlots={editingSlot?.startsWith('routine') ? 1 : maxSlots}
                currentSlots={editingSlot?.startsWith('routine') ? 0 : (() => {
                  // 편집 중인 슬롯의 활동을 제외한 슬롯 수 계산
                  const idx = editingSlot === 'weekend1' ? 0 :
                              editingSlot === 'weekend2' ? 1 :
                              parseInt((editingSlot || '').replace('weekend', '')) - 1;
                  const editingAct = selectedActivities[idx];
                  const editingSlots = editingAct ? (activities.find(x => x.id === editingAct)?.slots || 0) : 0;
                  return currentSlots - editingSlots;
                })()}
                state={state}
                npcChoices={npcChoices}
                compact={false}
                availableMoney={state.money - routineCost -
                  selectedActivities.reduce((sum, id) => sum + (ACTIVITIES.find(a => a.id === id)?.moneyCost || 0), 0)
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* NPC 관계 — 만난 친구만 표시 */}
      {state.npcs.some(n => n.met) && (
        <div data-tutorial="npc" style={{ background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
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
                  <Portrait characterId={n.id} size={36} expression="neutral" year={state.year} />
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
      {npcSelectFor && (() => {
        // slot:idx:activityId 형태 파싱
        const isSlotBased = npcSelectFor.startsWith('slot:');
        const slotIdx = isSlotBased ? parseInt(npcSelectFor.split(':')[1]) : -1;
        const activityId = isSlotBased ? npcSelectFor.split(':')[2] : npcSelectFor;
        const modalLabel = activityId === 'hang-out' ? '놀까' : activityId === 'study-group' ? '공부할까' : '활동할까';
        return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>누구와 {modalLabel}?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>함께하는 친구에 따라 친밀도가 올라갑니다</div>
            {state.npcs.filter(n => n.met).map(npc => (
              <div key={npc.id} onClick={() => {
                if (isSlotBased) {
                  // 슬롯 기반: 해당 인덱스에 활동 할당 + NPC 기록
                  const newArr = [...selectedActivities];
                  newArr[slotIdx] = activityId;
                  setSelectedActivities(newArr);
                  setNpcChoices({ ...npcChoices, [`${activityId}:${slotIdx}`]: npc.id });
                } else {
                  // 레거시: 기존 방식
                  setNpcChoices({ ...npcChoices, [npcSelectFor]: npc.id });
                  setSelectedActivities([...selectedActivities, npcSelectFor]);
                }
                setLastReaction(getActivityReaction(activityId));
                setNpcSelectFor(null);
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Portrait characterId={npc.id} size={40} expression="neutral" year={state.year} />
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
        );
      })()}

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
              background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
              borderRadius: 16, padding: 24, width: '85%', maxWidth: 340, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <Portrait characterId={npc.id} size={72} expression="neutral" year={state.year} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 12 }}>{npc.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {npc.intimacy >= 30 ? npc.description : '같은 학교 친구'}
              </div>

              {/* 인사말 — 친밀도/상황에 따라 다양한 대사 */}
              <div style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px',
                marginTop: 14, fontStyle: 'italic', fontSize: '0.85rem', lineHeight: 1.6,
              }}>
                "{getNpcDialogue(npc.id, npc.intimacy, state)}"
              </div>

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

      {/* 상점 버튼 */}
      <div
        onClick={() => { setShowShop(true); setNpcDetailFor(null); setNpcSelectFor(null); }}
        style={{
          background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', border: '1px solid rgba(224,179,84,0.15)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🛒</span>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>상점</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--yellow)' }}>💰 {Number.isInteger(state.money) ? state.money : state.money.toFixed(1)}만원</div>
          {(state.activeBuffs || []).length > 0 && (
            <div style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>
              버프 {state.activeBuffs.length}개 활성
            </div>
          )}
        </div>
      </div>

      {/* 선택 안내 메시지 */}
      {currentSlots === 0 && !routineTooExpensive && (state.isVacation || state.routineSlot2) && (
        <div style={{
          textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)',
          padding: '6px 12px', marginBottom: 4,
          background: 'rgba(255,255,255,0.08)', borderRadius: 8,
        }}>
          {state.isVacation
            ? '위의 빈 슬롯을 탭해서 방학 활동을 선택하세요!'
            : '주말 활동을 선택하지 않으면 자동으로 휴식합니다.'}
        </div>
      )}

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
                ? (state.isVacation ? '이번 주는 쉰다' : '주말은 쉰다')
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
    {/* 튜토리얼 — 슬롯 편집 중엔 CSS로만 숨김 (언마운트하면 step 리셋됨) */}
    {showTutorial && (
      <div style={{ display: editingSlot ? 'none' : 'contents' }}>
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
      </div>
    )}
    </>
  );
}
