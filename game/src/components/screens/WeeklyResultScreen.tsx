import { GameState, Stats, StatKey, STAT_LABELS, SubjectKey, SUBJECT_LABELS, Track, WeekLog, getGrade, SemesterGoalRecord } from '../../engine/types';
import { goalOutcomeLine, goalTitle, OUTCOME_SHORT } from '../../engine/semesterGoal';
import { useEffect, useRef } from 'react';
import { playSfx } from '../../audio/sfx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { Portrait } from '../Portrait';
import { BgWrapper, ScreenBgProps } from './BgWrapper';
import { GLASS_BASE, chipSurface, tintedGlass } from './surface';
import { PARENT_ICONS, breakSentences, getFatigueDisplay, pickStatDirection, type UpcomingEvent } from './shared';
import { StatIcon } from '../icons/icons';
import { STAT_BAR_HEIGHT, STAT_ICON_SIZE } from './main/StatsPanel';
import { growthReasonLine } from '../../engine/growthReasonText';
import { visibleGrowthReason } from '../../engine/growthDrag';

interface WeeklyResultScreenProps {
  // 부모(GameScreen)가 phase==='result' && state.weekLog 가드로 non-null 보장 후 주입.
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
  upcomingEvents: UpcomingEvent[];
  /** T68 — 학기 마지막 주면 그 학기 목표의 판정(GameScreen이 goalRecordForWeekLog로 만든다). 아니면 null/생략. */
  goalRecord?: SemesterGoalRecord | null;
  onContinue: () => void;
}

// 주말 활동 처리 후 보여주는 한 주 결산 일기 화면
export function WeeklyResultScreen({
  weekLog, stats, fatigue, money, gender, year, mentalState, track,
  bgProps, weekInfo, resultDialogue, fatigueColor, upcomingEvents, goalRecord, onContinue,
}: WeeklyResultScreenProps) {
  const reducedMotion = usePrefersReducedMotion();

  // 주간 결산 등장음 — "변화는 또렷이" 축. 시험이 있는 주는 성적표가 그 주의 사건이므로
  // examResult가 우선하고, 아니면 스탯 변화의 방향으로 한 번만 울린다.
  // 스탯별로 각각 울리면 최대 5개가 겹쳐 시끄러워지므로 방향 하나로 접는다.
  // 접는 규칙(합이 아니라 최대 변화 축)의 근거는 pickStatDirection 주석에 있다.
  const lastLoggedRef = useRef<WeekLog | null>(null);
  useEffect(() => {
    if (lastLoggedRef.current === weekLog) return;   // StrictMode 이중 호출 방어
    lastLoggedRef.current = weekLog;
    if (weekLog.examResult) { playSfx('examResult'); return; }
    const dir = pickStatDirection(weekLog.statChanges);
    if (dir) playSfx(dir === 'up' ? 'statUp' : 'statDown');
  }, [weekLog]);
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
  //
  // **아이콘을 문자열 한 필드로 섞지 않는다.** 예전엔 `icon: string`에 `STAT_ICONS[k]`와 `'🥱'`가
  // 같이 들어갔고, 그래서 이 칩은 20줄 아래 스탯 표가 선화로 바뀐 뒤에도 이모지로 남았다 —
  // 같은 화면에서 학업이 책 선화와 📚로 한 번씩 나왔다. 데이터는 **무엇인지**(스탯이냐 피로냐)만
  // 들고, 어떤 그림으로 그릴지는 렌더가 정한다. 피로는 스탯 축이 아니라 이모지가 맞다.
  type Loss = { kind: 'stat'; stat: StatKey; text: string } | { kind: 'fatigue'; text: string };
  const losses: Loss[] = [];
  const negativeChanges = (Object.entries(weekLog.statChanges) as [StatKey, number | undefined][])
    .filter(([, v]) => (v ?? 0) <= -0.5)
    .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))
    .slice(0, 2);
  for (const [k, v] of negativeChanges) {
    losses.push({ kind: 'stat', stat: k, text: `${STAT_LABELS[k]} ${Math.round((v ?? 0) * 10) / 10}` });
  }
  if ((weekLog.fatigueChange ?? 0) >= 25) losses.push({ kind: 'fatigue', text: '피로 누적' });

  // T67 성장 둔화 한 줄 — 원인 판정은 엔진이 로그에 박았다(pickGrowthReason). 보일지 말지는
  // visibleGrowthReason 하나가 정한다(같은 주 이벤트 몫이 접힌 **최종** 변화량으로 잘 는 주를 다시 묻는다
  // — 결산 독백도 같은 함수를 쓴다). 학교급은 로그가 박은 학년을 쓴다(제목과 같은 이유).
  const visibleReason = visibleGrowthReason(weekLog);
  const growthReason = visibleReason ? growthReasonLine(visibleReason, weekLog.year ?? year) : null;

  // 피로 라벨/색 단일 SSOT — HUD와 동일하게 getFatigueDisplay 사용 (color는 부모가 이미 같은 함수로 계산해 prop 주입).
  const resultFatigueLabel = getFatigueDisplay(fatigue).label;

  return (
    <BgWrapper {...bgProps}>
      <div className="fade-in">
        {/* 일기 스타일 결산 */}
        {/* 사진 위 맨몸이었다 — 배경을 올리자 "이번 주의 기록"이 6.54:1에서 3.54:1로 AA를 넘어갔다.
            주간 화면 HUD와 같은 유리 바닥을 준다. */}
        <div style={{
          textAlign: 'center', marginBottom: 16, marginTop: 8,
          background: GLASS_BASE, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          borderRadius: 12, padding: '8px 12px',
        }}>
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
          {/* frame="photo" — 여기는 카드 밖, **배경 사진 위**에 맨몸으로 선다. 테두리는 HUD와
              같은 2px이고 그림자는 여기만 켠다. 두 화면이 완전히 같은 처리였던 적이 있는데
              (#496), 그때 카드 안에서도 그림자가 돌았다. 근거는 `Portrait.tsx`의 frame 주석에. */}
          <Portrait characterId={gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={stats.mental} mentalState={mentalState} year={year} frame="photo" />
          <div style={{
            flex: 1, background: 'rgba(42,34,48,0.9)', backdropFilter: 'blur(6px)',
            borderRadius: '4px 12px 12px 12px', padding: '10px 14px', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.6,
            whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
          }}>
            {`"${breakSentences(resultDialogue)}"`}
          </div>
        </div>

        {/* T68 학기 목표 돌아보기 — 학기 마지막 주 결산에만. 보상 없이 문장이 목표의 끝이다. */}
        {goalRecord && (
          <div data-testid="semester-goal-result" style={{
            background: GLASS_BASE, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(229,192,123,0.25)', borderRadius: 12,
            padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🎯 이번 학기 목표</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{goalTitle(goalRecord)}</span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                color: goalRecord.outcome === 'achieved' ? 'var(--green)' : 'var(--text-secondary)',
              }}>{OUTCOME_SHORT[goalRecord.outcome]}</span>
            </div>
            <div style={{
              fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6,
              whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
            }}>
              {breakSentences(goalOutcomeLine(goalRecord))}
            </div>
          </div>
        )}

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
                  animation: reducedMotion ? 'none' : 'parentBonusPulse 0.6s ease',
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
            background: tintedGlass('rgba(217,100,88,0.06)'), border: '1px solid rgba(217,100,88,0.2)',
          }}>
            {losses.map((loss, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.72rem', color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 8,
              }}>
                {loss.kind === 'stat'
                  ? <span style={{ display: 'inline-flex', color: 'var(--text-secondary)' }}><StatIcon stat={loss.stat} size={STAT_ICON_SIZE} /></span>
                  : <span style={{ fontSize: '0.85rem' }}>🥱</span>}
                <span>{loss.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* 왜 덜 늘었나 — 그 주 성장을 가장 크게 깎은 원인 한 줄(T67). 숫자는 안 쓴다(hide-numbers).
            바로 아래 변화량 표의 **해설**이라 표 바로 위에 붙인다 — 변화 신호는 또렷이. 잃은 것 칩이
            "무엇이 내려갔나"라면 이 줄은 "왜 덜 올랐나"다. 사진 위에 서고 글자와 배경이 한 객체라
            불투명 바닥(chipSurface)을 깐다 — tintedGlass는 0.85라 대비 게이트가 판정을 못 한다. */}
        {growthReason && (
          <div data-testid="growth-reason" style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10,
            padding: '8px 12px', borderRadius: 10,
            background: chipSurface('rgba(125,163,217,0.08)'), border: '1px solid rgba(125,163,217,0.28)',
            fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-secondary)',
            whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
          }}>
            <span aria-hidden="true" style={{ fontSize: '0.9rem' }}>💭</span>
            <span>{breakSentences(growthReason)}</span>
          </div>
        )}

        {/* 스탯 변화 — 정확한 수치 */}
        <div style={{ background: 'rgba(42,34,48,0.88)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {(Object.keys(stats) as StatKey[]).map(key => {
            const change = weekLog.statChanges[key] || 0;
            const grade = getGrade(stats[key]);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                {/* 메인 화면 StatsPanel과 **같은 목록**이다 — 한 번의 클릭 거리에 있는 같은
                    5행이라, 한쪽만 선화로 바꾸면 매주 두 화면을 오가며 그림이 바뀐다. */}
                <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-secondary)' }}><StatIcon stat={key} size={STAT_ICON_SIZE} /></span>
                <span style={{ width: 32, fontSize: '0.78rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                {/* 주간 화면과 **같은 상수**를 쓴다. 아이콘만 맞추고 막대를 12로 두면
                    한 번의 클릭 거리에서 같은 5행이 여전히 다르게 보인다(3자 검수). */}
                <div style={{ flex: 1, height: STAT_BAR_HEIGHT, background: 'rgba(255,255,255,0.08)', borderRadius: STAT_BAR_HEIGHT / 2, margin: '0 6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(stats[key])}%`, background: grade.color, borderRadius: STAT_BAR_HEIGHT / 2, transition: 'width 0.5s' }} />
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
        {(() => {
          const exam = weekLog.examResult;
          if (!exam) return null;
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
          <div style={{ background: tintedGlass('rgba(224,138,91,0.1)'), borderRadius: 10, padding: '8px 12px', marginBottom: 16, fontSize: '0.78rem', textAlign: 'center' }}>
            📅 {upcomingEvents.map(e => e.text).join(' · ')}
          </div>
        )}

        <button className="btn btn-primary" onClick={onContinue}>다음 주로 →</button>
      </div>
    </BgWrapper>
  );
}
