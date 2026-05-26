import { useGameStore } from '../../engine/store';
import { calculateHappinessGrade, HAPPINESS_LABELS } from '../../engine/gameEngine';
import { GameState } from '../../engine/types';
import { BgInfo } from '../../engine/backgrounds';
import { BgWrapper } from './BgWrapper';

interface YearEndScreenProps {
  state: GameState;
  bgProps: { bg: BgInfo; bgImgError: boolean; onImgError: () => void };
}

const YEAR_NAMES = [
  '초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년',
  '고등학교 1학년', '고등학교 2학년', '고등학교 3학년',
];

// v1.2 학년말 일기장 (Y1~Y6) — phase === 'year-end'
export function YearEndScreen({ state, bgProps }: YearEndScreenProps) {
  const finishedYear = state.year;  // 방금 끝난 학년 (advance 전)
  const yearName = YEAR_NAMES[finishedYear - 1] || `${finishedYear}학년`;
  const slotsThisYear = state.memorySlots.filter(m => m.year === finishedYear);
  const milestone = state.milestoneScenes.find(m => m.year === finishedYear);
  const happinessGrade = calculateHappinessGrade(state.stats.mental, state.stats.social);
  const happinessInfo = HAPPINESS_LABELS[happinessGrade];
  const { advanceFromYearEnd } = useGameStore.getState();

  return (
    <BgWrapper {...bgProps}>
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
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 10 }}>
              돌아보면
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              {milestone.summaryText}
            </div>
          </div>
        )}

        {/* 올해의 행복 등급 (mental + social 기반) */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px 20px', marginBottom: 28, borderLeft: '2px solid var(--accent-soft)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 8 }}>
            올해의 행복
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {happinessInfo.title}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
            {happinessInfo.desc}
          </div>
        </div>

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
