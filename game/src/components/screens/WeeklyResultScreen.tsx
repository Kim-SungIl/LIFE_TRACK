import { GameState, Stats, StatKey, STAT_LABELS, SubjectKey, SUBJECT_LABELS, Track, WeekLog, getGrade } from '../../engine/types';
import { getFatigueLabel } from '../../engine/dialogues';
import { Portrait } from '../Portrait';
import { BgWrapper, ScreenBgProps } from './BgWrapper';
import { STAT_ICONS, PARENT_ICONS, breakSentences } from './shared';

interface WeeklyResultScreenProps {
  // 부모(GameScreen)가 showResult && state.weekLog 가드로 non-null 보장 후 주입.
  weekLog: WeekLog;
  stats: Stats;
  fatigue: number;
  money: number;
  gender: GameState['gender'];
  year: number;
  mentalState: GameState['mentalState'];
  track: Track | null;
  bgProps: ScreenBgProps;
  weekInfo: string;
  resultDialogue: string;
  fatigueColor: string;
  upcomingEvents: string[];
  onContinue: () => void;
}

// 주말 활동 처리 후 보여주는 한 주 결산 일기 화면
export function WeeklyResultScreen({
  weekLog, stats, fatigue, money, gender, year, mentalState, track,
  bgProps, weekInfo, resultDialogue, fatigueColor, upcomingEvents, onContinue,
}: WeeklyResultScreenProps) {
  // Hero — 이번 주의 핵심 한 줄. 마지막 📖 > milestone[0] 순.
  // 이벤트가 그 주의 "사건"이고 milestone은 누적 스탯 임계치 이벤트라 사건 우선이 자연스러움.
  // milestone은 어차피 아래 ⭐ 성장 영역에 따로 표시되므로 hero에서 빠져도 정보 손실 없음.
  // examResult는 별도 성적표 블록이 있어서 hero에 또 넣으면 중복이라 제외.
  const narrationMsgs = weekLog.messages.filter(m => m.startsWith('📖'));
  const heroFromNarration = narrationMsgs.length > 0
    ? narrationMsgs[narrationMsgs.length - 1].replace(/^📖\s*/, '')
    : null;
  const heroFromMilestone = !heroFromNarration && (weekLog.milestoneMessages?.[0])
    ? weekLog.milestoneMessages[0]
    : null;
  const heroMsg = heroFromNarration || heroFromMilestone;
  // hero에 들어간 narration/milestone은 아래 영역에서 빼서 중복 방지
  const narrationToShow = heroFromNarration
    ? narrationMsgs.slice(0, -1)
    : narrationMsgs;
  const milestonesToShow = heroFromMilestone
    ? (weekLog.milestoneMessages || []).slice(1)
    : (weekLog.milestoneMessages || []);

  // 잃은 것 칩 — 큰 음수 스탯 변화(절댓값 ≥ 0.5) 상위 2개 + 피로 누적
  const losses: { icon: string; text: string }[] = [];
  const negativeChanges = (Object.entries(weekLog.statChanges) as [StatKey, number | undefined][])
    .filter(([, v]) => (v ?? 0) <= -0.5)
    .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))
    .slice(0, 2);
  for (const [k, v] of negativeChanges) {
    losses.push({ icon: STAT_ICONS[k], text: `${STAT_LABELS[k]} ${Math.round((v ?? 0) * 10) / 10}` });
  }
  if ((weekLog.fatigueChange ?? 0) >= 25) losses.push({ icon: '🥱', text: '피로 누적' });

  const resultFatigueLabel = getFatigueLabel(fatigue);

  return (
    <BgWrapper {...bgProps}>
      <div className="fade-in">
        {/* 일기 스타일 결산 */}
        <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 8 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bgProps.bg.mood} {weekInfo}</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>이번 주의 기록</div>
        </div>

        {/* Hero — 이번 주의 핵심 한 줄 */}
        {heroMsg && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(229,192,123,0.18), rgba(224,138,91,0.10))',
            border: '1px solid rgba(229,192,123,0.32)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 14,
            textAlign: 'center',
            fontSize: '0.95rem',
            fontWeight: 600,
            lineHeight: 1.5,
            color: '#f3d99e',
            whiteSpace: 'pre-line',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}>
            {breakSentences(heroMsg)}
          </div>
        )}

        {/* 주인공 + 독백 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Portrait characterId={gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={stats.mental} mentalState={mentalState} year={year} />
          <div style={{
            flex: 1, background: 'rgba(42,34,48,0.9)', backdropFilter: 'blur(6px)',
            borderRadius: '4px 12px 12px 12px', padding: '10px 14px', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.6,
            whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
          }}>
            {`"${breakSentences(resultDialogue)}"`}
          </div>
        </div>

        {/* 이번 주에 있었던 일 — 이벤트 내레이션 (hero에 올라간 한 줄은 제외) */}
        {narrationToShow.map((msg, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(229,192,123,0.4)',
            borderRadius: '0 8px 8px 0', padding: '10px 14px', marginBottom: 12,
            fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-secondary)',
            whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
          }}>
            {breakSentences(msg)}
          </div>
        ))}

        {/* 성장 달성 — hero로 올라간 첫 항목 제외 */}
        {milestonesToShow.map((msg, i) => (
          <div key={i} className="milestone-box">⭐ 성장! — {msg}</div>
        ))}
        {weekLog.messages.filter(m => m.includes('⚠') || m.includes('🔥') || m.includes('💪')).map((msg, i) => (
          <div key={i} className="message-box">{msg}</div>
        ))}

        {/* 부모 보너스 발동 — 상황 발동형만 표시.
            wealth("용돈이 넉넉했다")와 resilience-체질("피로 증가 -15%")은 부모 strength가 있는 한
            매주 동일하게 발동되어 결산 칩으로는 노이즈라 제외. 항시형은 HUD 부모 칩 + 툴팁으로 노출. */}
        {(() => {
          const applied = weekLog.parentBonusesApplied || [];
          const filtered = applied.filter(b =>
            !(b.parent === 'wealth' && b.what === '용돈이 넉넉했다')
            && !(b.parent === 'resilience' && b.what === '체질 — 피로 증가 -15%'),
          );
          if (filtered.length === 0) return null;
          return (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(224,138,91,0.06)', border: '1px solid rgba(224,138,91,0.2)',
            }}>
              {filtered.map((b, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.72rem', color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 8,
                  animation: 'parentBonusPulse 0.6s ease',
                }}>
                  <span style={{ fontSize: '0.85rem' }}>{PARENT_ICONS[b.parent] || '🎓'}</span>
                  <span>{b.what}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* 잃은 것 — 큰 음수 변화 / 피로 누적. 부모 보너스가 "얻은 것"이면 이 줄이 트레이드오프의 반대편 */}
        {losses.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(217,100,88,0.06)', border: '1px solid rgba(217,100,88,0.2)',
          }}>
            {losses.map((loss, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.72rem', color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 8,
              }}>
                <span style={{ fontSize: '0.85rem' }}>{loss.icon}</span>
                <span>{loss.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* 스탯 변화 — 정확한 수치 */}
        <div style={{ background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {(Object.keys(stats) as StatKey[]).map(key => {
            const change = weekLog.statChanges[key] || 0;
            const grade = getGrade(stats[key]);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ width: 20, fontSize: '0.8rem' }}>{STAT_ICONS[key]}</span>
                <span style={{ width: 32, fontSize: '0.78rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, margin: '0 6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(stats[key])}%`, background: grade.color, borderRadius: 6, transition: 'width 0.5s' }} />
                </div>
                <span style={{ width: 20, fontSize: '0.72rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                <span style={{ width: 28, fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(stats[key])}</span>
                <span style={{ width: 40, fontSize: '0.68rem', fontWeight: 600, textAlign: 'right',
                  color: change > 0.1 ? 'var(--green)' : change < -0.1 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {change > 0 ? '+' : ''}{Math.round(change * 10) / 10}
                </span>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: fatigueColor }}>피로 {Math.round(fatigue)} · {resultFatigueLabel}</span>
            <span>
              💰 {Number.isInteger(money) ? money : money.toFixed(1)}만원
              {(() => {
                const delta = weekLog.moneyChange ?? 0;
                if (Math.abs(delta) < 0.05) return null;
                const isPositive = delta > 0;
                const formatted = Math.round(delta * 10) / 10;
                return (
                  <span style={{ marginLeft: 6, color: isPositive ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    ({isPositive ? '+' : ''}{formatted})
                  </span>
                );
              })()}
            </span>
          </div>
        </div>

        {/* 시험 결과 (학교급별 분기) */}
        {weekLog.examResult && (() => {
          const exam = weekLog.examResult!;
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
                  ? (track === 'humanities' ? '사회탐구' : track === 'science' ? '과학탐구' : '탐구')
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

        <button className="btn btn-primary" onClick={onContinue}>다음 주로 →</button>
      </div>
    </BgWrapper>
  );
}
