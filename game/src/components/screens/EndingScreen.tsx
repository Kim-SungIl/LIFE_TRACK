import { calculateEnding } from '../../engine/ending';
import { Stats, StatKey, STAT_LABELS, Track, ParentStrength, getGrade } from '../../engine/types';
import { BgWrapper, ScreenBgProps } from './BgWrapper';
import { STAT_ICONS } from './shared';

// calculateEnding 반환 타입 — 부모(GameScreen)가 계산해 prop 으로 주입.
export type EndingData = ReturnType<typeof calculateEnding>;

interface EndingScreenProps {
  ending: EndingData;
  track: Track | null;
  stats: Stats;
  parents: readonly ParentStrength[];
  burnoutCount: number;
  bgProps: ScreenBgProps;
}

const PARENT_RECALL_MAP: Record<string, { icon: string; label: string; recall: string }> = {
  emotional:  { icon: '🫂', label: '정서적 지지', recall: '엄마가 현관에서 기다리던 노란 불빛.' },
  wealth:     { icon: '🏠', label: '여유 있는 집', recall: '책상 위, 말없이 놓여있던 흰 봉투.' },
  info:       { icon: '📱', label: '정보가 있는 집', recall: '식탁에 펼쳐진, 빨갛게 밑줄 쳐진 신문.' },
  strict:     { icon: '📐', label: '엄격한 집', recall: '11시, 스탠드를 끄러 오던 슬리퍼 소리.' },
  resilience: { icon: '⭐', label: '타고난 체질', recall: '감기에도 멀쩡하게 들고 가던 가방끈.' },
  freedom:    { icon: '🌿', label: '자유로운 집', recall: '"알아서 해" 뒤에 닫히던 안방 문.' },
};

// 7년의 여정을 마친 후 — phase === 'ending'
export function EndingScreen({ ending, track, stats, parents, burnoutCount, bgProps }: EndingScreenProps) {
  const trackLabel = track === 'humanities' ? '문과' : track === 'science' ? '이과' : null;

  return (
    <BgWrapper {...bgProps}>
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
          {(Object.keys(stats) as StatKey[]).map(key => {
            const grade = getGrade(stats[key]);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ width: 24 }}>{STAT_ICONS[key]}</span>
                <span style={{ width: 32, fontSize: '0.8rem', fontWeight: 600 }}>{STAT_LABELS[key]}</span>
                <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 7, margin: '0 8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats[key]}%`, background: grade.color, borderRadius: 7 }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: grade.color }}>{grade.grade}</span>
                <span style={{ width: 28, fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{Math.round(stats[key])}</span>
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

        {/* 부모가 7년에 남긴 흔적 (§9-B 시각 앵커, 스탯 금지) */}
        <div style={{
          maxWidth: 420, margin: '0 auto 16px', padding: '14px 18px',
          background: 'rgba(224,138,91,0.06)', borderRadius: 10,
          border: '1px solid rgba(224,138,91,0.2)',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center', letterSpacing: '0.15em' }}>
            부모가 남긴 것
          </div>
          {parents.map(p => {
            const r = PARENT_RECALL_MAP[p];
            if (!r) return null;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '1.1rem', lineHeight: '1.4' }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-soft)', fontWeight: 600, marginBottom: 2 }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {r.recall}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
          총합 {Math.round(Object.values(stats).reduce((a, b) => a + b, 0))}점 · 번아웃 {burnoutCount}회
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
