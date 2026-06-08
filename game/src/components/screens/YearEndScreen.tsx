import { calculateHappinessGrade, HAPPINESS_LABELS } from '../../engine/ending';
import { MemorySlot, MilestoneScene, MemoryCategory, Stats, Gender } from '../../engine/types';
import { resolveEventCgUrl } from '../../engine/eventCg';
import { Portrait } from '../Portrait';
import { BgWrapper, ScreenBgProps } from './BgWrapper';

interface YearEndScreenProps {
  // 방금 끝난 학년 (advance 전 state.year)
  year: number;
  gender: Gender;
  memorySlots: MemorySlot[];
  milestoneScenes: MilestoneScene[];
  stats: Stats;
  bgProps: ScreenBgProps;
  onAdvance: () => void;
}

const YEAR_NAMES = [
  '초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년',
  '고등학교 1학년', '고등학교 2학년', '고등학교 3학년',
];

// 학년별 부제 — 같은 화면이 (Y1~Y6) 최대 6번 반복되므로, 고정 한 줄은 "또 그 화면"으로 학습돼 스킵된다.
const YEAR_SUBTITLES = [
  '초등학교의 마지막을, 천천히 넘겨본다',   // Y1
  '교복이 익숙해진 한 해를 돌아본다',       // Y2
  '중학교의 한가운데를 지나왔다',           // Y3
  '졸업이 가까워진 해를 닫는다',            // Y4
  '고등학교의 첫 페이지를 덮는다',          // Y5
  '입시가 가까워진 해를 돌아본다',          // Y6
];

// 카테고리별 엠블럼(플레이스홀더) + 한글 라벨.
// CG도 NPC 초상도 없는 기억의 최후 폴백 — 전용 아트 세트(P1b)가 나오면 emoji→이미지로 교체.
// 색은 STAT_GRADES 색 언어와 통일(gold/green/amber/red/grey 계열). reconciliation은 growth(초록)와
// 색이 겹치지 않게 청록 쪽으로 분리. failure ☔는 VS16 없는 코드포인트(구버전 기기 □ 깨짐 회피).
type CatInfo = { emoji: string; label: string; color: string };
const CATEGORY: Record<MemoryCategory, CatInfo> = {
  courage:        { emoji: '🔥', label: '용기',     color: '#e0a45e' },
  betrayal:       { emoji: '💔', label: '상처',     color: '#d96458' },
  reconciliation: { emoji: '🤝', label: '화해',     color: '#6fa890' },
  failure:        { emoji: '☔', label: '실패',     color: '#7c89a8' },
  discovery:      { emoji: '💡', label: '깨달음',   color: '#e0b354' },
  growth:         { emoji: '🌱', label: '성장',     color: '#8fb573' },
  bypass:         { emoji: '💸', label: '우회',     color: '#a89888' },
  unspoken_debt:  { emoji: '✉️', label: '말없는 빚', color: '#caa17a' },
};
const CATEGORY_FALLBACK: CatInfo = { emoji: '🕊️', label: '기억', color: '#a89888' };
// 레거시/마이그레이션 세이브에 미지 카테고리가 들어와도 화면 전체가 죽지 않게 폴백.
const catOf = (c: string): CatInfo => CATEGORY[c as MemoryCategory] ?? CATEGORY_FALLBACK;

// 회상 카드/마무리 블록 공통 다크 스크림 패널 (교실 배경 위 가독성)
const PANEL: React.CSSProperties = {
  background: 'rgba(20,17,26,0.55)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
};
const TEXT_SHADOW = '0 1px 4px rgba(0,0,0,0.55)';
// 세 이미지 타입(hero CG·NPC 초상·엠블럼)을 "바랜 일기장" 한 톤으로 묶는 공통 필터 — 패치워크 방지.
const DIARY_FILTER = 'saturate(0.82) sepia(0.12) brightness(0.98)';
const MAX_CARDS = 4;  // 회고는 "전부 나열"이 아니라 "추려보기" — 초과분은 한 줄로 암시

// 기억 썸네일 — NPC 초상(있으면) → 카테고리 엠블럼. (작은 썸네일에선 줄인 CG가 오히려 판독 어려워 제외;
// CG는 표제(hero)의 큰 자리에서만 사용). 초상/엠블럼 모두 동일 색 링 + 동일 바랜 필터로 한 시스템처럼.
function MemoryThumb({ slot, year, size }: { slot: MemorySlot; year: number; size: number }) {
  const npc = slot.npcIds?.[0];
  const radius = Math.round(size * 0.15);
  const cat = catOf(slot.category);
  if (npc) {
    return (
      <div style={{ flexShrink: 0, borderRadius: radius, boxShadow: `0 0 0 1.5px ${cat.color}88`, overflow: 'hidden', lineHeight: 0, filter: DIARY_FILTER }}>
        <Portrait characterId={npc} size={size} expression="neutral" year={year} />
      </div>
    );
  }
  return (
    <div style={{
      flexShrink: 0, width: size, height: Math.round(size * 1.25), borderRadius: radius,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${cat.color}22`, boxShadow: `0 0 0 1.5px ${cat.color}88`,
      fontSize: Math.round(size * 0.46), filter: DIARY_FILTER,
    }}>
      {cat.emoji}
    </div>
  );
}

// v1.4 학년말 회고 (Y1~Y6) — phase === 'year-end'
//   P0: 스크림·라벨 정리·부모줄 부활·정직한 CTA
//   P1: 표제(최고 importance) 기억에 CG 있으면 hero로 크게, 나머지는 썸네일 카드.
//       CG 없으면 NPC 초상→카테고리 엠블럼 폴백. (CG는 깔리는 대로 자동 hero 승격)
export function YearEndScreen({ year, gender, memorySlots, milestoneScenes, stats, bgProps, onAdvance }: YearEndScreenProps) {
  const yearName = YEAR_NAMES[year - 1] || `${year}학년`;
  const subtitle = YEAR_SUBTITLES[year - 1] || '이 한 해를 조용히 돌아본다';
  const nextGradeName = YEAR_NAMES[year];
  const slotsThisYear = memorySlots.filter(m => m.year === year);
  const milestone = milestoneScenes.find(m => m.year === year);
  const happinessGrade = calculateHappinessGrade(stats.mental, stats.social);
  const happinessInfo = HAPPINESS_LABELS[happinessGrade];

  // 부모 친밀도 줄(\n append, Phase 2.1)을 본문과 분리해 "뒤늦게 떠오른 한 줄"로
  const [milestoneMain, ...milestoneRest] = (milestone?.summaryText || '').split('\n');
  const milestoneExtra = milestoneRest.join(' ').trim();

  // 표제 = 그 해 가장 중요한 기억. importance 동률 시 빠른 주차 우선(결정적 tiebreaker).
  const byImportance = [...slotsThisYear].sort((a, b) => (b.importance - a.importance) || (a.week - b.week));
  const anchor = byImportance[0] ?? null;
  const heroCg = anchor ? resolveEventCgUrl(anchor.sourceEventId, anchor.choiceIndex, gender, year) : null;
  // hero로 빠진 표제는 카드 목록에서 제외, 나머지는 시간순. 카드는 최대 MAX_CARDS개만 노출.
  const cardSlots = (heroCg && anchor ? slotsThisYear.filter(s => s.id !== anchor.id) : slotsThisYear)
    .sort((a, b) => a.week - b.week);
  const shownCards = cardSlots.slice(0, MAX_CARDS);
  const hiddenCount = cardSlots.length - shownCards.length;

  const hasScenes = slotsThisYear.length > 0;
  const tHero = 420;
  const tCards = heroCg ? 560 : 420;
  const tClosing = hasScenes ? 700 : 420;
  // CTA는 콘텐츠를 다 읽을 즈음 조용히 등장 — 카드 수에 비례(고정값이면 기억 많을 때 너무 일찍 뜸). 상한 클램프.
  const tCta = Math.min(tClosing + 600 + shownCards.length * 140, 2600);

  return (
    <BgWrapper {...bgProps}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 40px', textAlign: 'center' }}>
        <div className="ye-stagger" style={{ animationDelay: '120ms', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', textShadow: TEXT_SHADOW, marginBottom: 6 }}>
          {yearName}이 끝났다
        </div>
        <div className="ye-stagger" style={{ animationDelay: '240ms', fontSize: '0.9rem', color: 'var(--text-secondary)', textShadow: TEXT_SHADOW, marginBottom: 26 }}>
          {subtitle}
        </div>

        {/* 표제 기억 — CG 있을 때만 hero로 크게 */}
        {heroCg && anchor && (
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tHero}ms`, padding: 0, marginBottom: 14, overflow: 'hidden', textAlign: 'left' }}>
            <img src={heroCg} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', objectPosition: 'center 30%', display: 'block', filter: DIARY_FILTER }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div style={{ padding: '12px 16px 14px' }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {anchor.recallText}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {`W${anchor.week} · ${catOf(anchor.category).label}`}
              </div>
            </div>
          </div>
        )}

        {/* 나머지 기억 — 썸네일 카드 (초상/엠블럼). 최대 MAX_CARDS개 + 초과분 암시 */}
        {shownCards.length > 0 && (
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tCards}ms`, padding: '12px 14px', marginBottom: 14, borderLeft: '2px solid var(--accent-soft)' }}>
            {shownCards.map((slot, i) => (
              <div key={slot.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'default',
                marginBottom: i === shownCards.length - 1 && hiddenCount === 0 ? 0 : 12,
              }}>
                <MemoryThumb slot={slot} year={year} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55, fontStyle: 'italic' }}>
                    {slot.recallText}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {`W${slot.week} · ${catOf(slot.category).label}`}
                  </div>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                그리고 {hiddenCount}개의 장면이 더 있었다
              </div>
            )}
          </div>
        )}

        {/* 닫는 한 블록 — milestone(서사) + 부모 줄 + 올해의 마음 */}
        <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tClosing}ms`, padding: '18px 20px', marginBottom: 30 }}>
          {milestoneMain && (
            <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              {milestoneMain}
            </div>
          )}
          {milestoneExtra && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 8 }}>
              {milestoneExtra}
            </div>
          )}
          <div style={{ marginTop: milestoneMain ? 16 : 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {happinessInfo.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 4 }}>
              {happinessInfo.desc}
            </div>
          </div>
        </div>

        {/* 정직한 전환 — 실제로 학년을 넘김. 고스트 톤 + 늦은 등장. */}
        <button
          className="btn ye-cta"
          style={{
            maxWidth: 280,
            margin: '0 auto',
            background: 'rgba(224,138,91,0.12)',
            border: '1px solid var(--accent-soft)',
            color: 'var(--accent-soft)',
            animationDelay: `${tCta}ms`,
          }}
          onClick={onAdvance}
        >
          {nextGradeName ? `${nextGradeName}으로` : '다음으로'}
        </button>
      </div>
    </BgWrapper>
  );
}
