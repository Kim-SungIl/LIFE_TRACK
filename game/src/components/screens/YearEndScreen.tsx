import { useEffect, useRef, useState } from 'react';
import { calculateHappinessGrade, HAPPINESS_LABELS } from '../../engine/ending';
import { MemorySlot, MilestoneScene, MemoryCategory, Stats, Gender, ToneTag } from '../../engine/types';
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

// 카테고리별 엠블럼(전용 아트 P1b) + 한글 라벨.
// CG도 NPC 초상도 없는 기억의 최후 폴백 이미지. art = images/emblems/{key}.png (4:5, 480×600).
// emoji는 art 로드 실패 시 폴백(안전망) + 라벨 보조. 색은 STAT_GRADES 색 언어와 통일.
// reconciliation은 growth(초록)와 겹치지 않게 청록으로 분리. failure ☔는 VS16 없는 코드포인트(구버전 □ 회피).
type CatInfo = { emoji: string; label: string; color: string; art: string };
const EMB = (key: string): string => `${import.meta.env.BASE_URL}images/emblems/${key}.png`;
const CATEGORY: Record<MemoryCategory, CatInfo> = {
  courage:        { emoji: '🔥', label: '용기',     color: '#e0a45e', art: EMB('courage') },
  betrayal:       { emoji: '💔', label: '상처',     color: '#d96458', art: EMB('betrayal') },
  reconciliation: { emoji: '🤝', label: '화해',     color: '#6fa890', art: EMB('reconciliation') },
  failure:        { emoji: '☔', label: '실패',     color: '#7c89a8', art: EMB('failure') },
  discovery:      { emoji: '💡', label: '깨달음',   color: '#e0b354', art: EMB('discovery') },
  growth:         { emoji: '🌱', label: '성장',     color: '#8fb573', art: EMB('growth') },
  bypass:         { emoji: '💸', label: '우회',     color: '#a89888', art: EMB('bypass') },
  unspoken_debt:  { emoji: '✉️', label: '말없는 빚', color: '#caa17a', art: EMB('unspoken_debt') },
};
const CATEGORY_FALLBACK: CatInfo = { emoji: '🕊️', label: '기억', color: '#a89888', art: EMB('memory') };
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
// toneTag 없는 기억의 기본값이기도 하다.
const DIARY_FILTER = 'saturate(0.82) sepia(0.12) brightness(0.98)';
// 기억의 정서(toneTag)를 "색온도"로 — 같은 일기장 톤 안에서 따뜻함(sepia↑·밝게)↔차가움(채도↓·어둡게)만 미세 조정.
// hue-rotate는 sepia와 겹치면 탁해져서 안 씀(온도를 sepia·brightness·saturate 축으로만 표현).
const TONE_FILTER: Record<ToneTag, string> = {
  warm:         'saturate(0.88) sepia(0.24) brightness(1.02)',  // 따뜻·살아있음
  breakthrough: 'saturate(0.95) sepia(0.14) brightness(1.07)',  // 환하게 트임
  resolve:      'saturate(0.86) sepia(0.18) brightness(1.00)',  // 단단·약한 온기
  regret:       'saturate(0.72) sepia(0.06) brightness(0.94)',  // 식어감
  melancholy:   'saturate(0.66) sepia(0.04) brightness(0.91)',  // 가장 차갑게
  burden:       'saturate(0.70) sepia(0.12) brightness(0.88)',  // 무겁게 가라앉음
};
const toneFilter = (tone?: ToneTag): string => (tone ? TONE_FILTER[tone] : DIARY_FILTER);
// hero(큰 focal) 패널에만 얹는 옅은 색온도 글로우 — 이미지 필터 차이가 작아, 정서가 "공기"로도 느껴지게.
const TONE_GLOW: Record<ToneTag, string> = {
  warm: '#e0a86a', breakthrough: '#f0c060', resolve: '#d8a878',
  regret: '#8295b2', melancholy: '#7488aa', burden: '#8a8296',
};
const MAX_CARDS = 4;  // 회고는 "전부 나열"이 아니라 "추려보기" — 초과분은 한 줄로 암시
// 갤러리도 동일 철학 — 너무 많은 CG를 넘기는 건 "감상"이 아니라 "작업"이 된다. 초과 CG는 썸네일 카드로 강등(유실X).
const MAX_GALLERY = 5;

type CgItem = { slot: MemorySlot; cg: string };

// CG가 있는 기억들의 스와이프 갤러리 — 한 해에 CG가 여러 장이면 좌우로 넘겨본다.
// 1장이면 단일 표시(점 없음), 2장+면 스크롤-스냅 캐러셀 + 하단 점 인디케이터. 자동진행 없음(넘김은 선택).
function HeroGallery({ items }: { items: CgItem[] }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const multi = items.length > 1;

  // 슬라이드 폭(88%)≠컨테이너 폭이므로 scrollLeft/clientWidth 반올림은 부정확.
  // 뷰포트 중앙에 가장 가까운 슬라이드를 실제 위치로 찾는다(peek/gap 무관하게 정확).
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    Array.from(el.children).forEach((k, i) => {
      const kid = k as HTMLElement;
      const d = Math.abs(kid.offsetLeft + kid.offsetWidth / 2 - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setIdx(prev => (prev === best ? prev : best));
  };
  const goTo = (i: number) => {
    const el = ref.current;
    const kid = el?.children[i] as HTMLElement | undefined;
    if (!el || !kid) return;
    el.scrollTo({ left: kid.offsetLeft - (el.clientWidth - kid.offsetWidth) / 2, behavior: 'smooth' });
  };

  // 첫 진입 1회 nudge — 점만으론 "넘길 수 있음"이 안 보인다(기획자 3명 일치). 살짝 밀었다 되돌려 swipe 가능을 암시.
  useEffect(() => {
    if (!multi) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    const t1 = setTimeout(() => el.scrollTo({ left: 36, behavior: 'smooth' }), 650);
    const t2 = setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 1150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [multi]);

  return (
    <div style={{ ...PANEL, overflow: 'hidden', textAlign: 'left' }}>
      <div ref={ref} className={multi ? 'ye-gallery ye-gallery-multi' : 'ye-gallery'} onScroll={multi ? onScroll : undefined}>
        {items.map(({ slot, cg }) => (
          <div key={slot.id}>
            <img src={cg} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', objectPosition: 'center 30%', display: 'block', filter: toneFilter(slot.toneTag) }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div style={{ padding: '12px 16px 14px' }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {slot.recallText}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {`W${slot.week} · ${catOf(slot.category).label}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {multi && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
          {items.map((_, i) => (
            <button key={i} aria-label={`${i + 1}번째 장면 보기`} onClick={() => goTo(i)} style={{
              width: i === idx ? 18 : 6, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
              background: i === idx ? 'var(--accent-soft)' : 'rgba(255,255,255,0.25)',
              transition: 'width 0.2s, background 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// 기억 썸네일 — NPC 초상(있으면) → 카테고리 엠블럼. (작은 썸네일에선 줄인 CG가 오히려 판독 어려워 제외;
// CG는 갤러리의 큰 자리에서만 사용). 초상/엠블럼 모두 동일 색 링 + 동일 바랜 필터로 한 시스템처럼.
function MemoryThumb({ slot, year, size }: { slot: MemorySlot; year: number; size: number }) {
  const npc = slot.npcIds?.[0];
  const radius = Math.round(size * 0.15);
  const cat = catOf(slot.category);
  if (npc) {
    return (
      <div style={{ flexShrink: 0, borderRadius: radius, boxShadow: `0 0 0 1.5px ${cat.color}88`, overflow: 'hidden', lineHeight: 0, filter: toneFilter(slot.toneTag) }}>
        <Portrait characterId={npc} size={size} expression="neutral" year={year} />
      </div>
    );
  }
  // 전용 엠블럼 아트(4:5). 로드 실패 시 이모지로 폴백(안전망 유지).
  return (
    <div style={{
      position: 'relative', flexShrink: 0, width: size, height: Math.round(size * 1.25), borderRadius: radius,
      overflow: 'hidden', background: `${cat.color}22`, boxShadow: `0 0 0 1.5px ${cat.color}88`,
      filter: toneFilter(slot.toneTag),
    }}>
      <img src={cat.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const fb = img.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }} />
      <div style={{
        display: 'none', position: 'absolute', inset: 0,
        alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.46),
      }}>
        {cat.emoji}
      </div>
    </div>
  );
}

// v1.5 학년말 회고 (Y1~Y6) — phase === 'year-end'
//   P0: 스크림·라벨 정리·부모줄 부활·정직한 CTA
//   P1: CG 있는 기억 = 스와이프 갤러리(여러 장 넘겨보기), 나머지 = 초상/엠블럼 썸네일 카드.
export function YearEndScreen({ year, gender, memorySlots, milestoneScenes, stats, bgProps, onAdvance }: YearEndScreenProps) {
  const yearName = YEAR_NAMES[year - 1] || `${year}학년`;
  const subtitle = YEAR_SUBTITLES[year - 1] || '이 한 해를 조용히 돌아본다';
  const nextGradeName = YEAR_NAMES[year];
  const slotsThisYear = memorySlots.filter(m => m.year === year);
  const milestone = milestoneScenes.find(m => m.year === year);
  const happinessGrade = calculateHappinessGrade(stats.mental, stats.social, stats.health);
  const happinessInfo = HAPPINESS_LABELS[happinessGrade];

  // 부모 친밀도 줄(\n append, Phase 2.1)을 본문과 분리해 "뒤늦게 떠오른 한 줄"로
  const [milestoneMain, ...milestoneRest] = (milestone?.summaryText || '').split('\n');
  const milestoneExtra = milestoneRest.join(' ').trim();

  // CG 있는 기억 → 갤러리. 정렬은 하이브리드: 1번=대표(최고 importance, 첫 장만 봐도 그 해의 핵심),
  // 2번~ = 시간순(그 해를 다시 걷는 흐름). 기획자 3명 합의 — 중요도 클로저 + 타임라인 둘 다 만족.
  const cgAll: CgItem[] = slotsThisYear
    .map(s => ({ slot: s, cg: resolveEventCgUrl(s.sourceEventId, s.choiceIndex, gender, year) }))
    .filter((x): x is CgItem => !!x.cg);
  const anchor = cgAll.length
    ? [...cgAll].sort((a, b) => (b.slot.importance - a.slot.importance) || (a.slot.week - b.slot.week))[0]
    : undefined;
  const ordered: CgItem[] = anchor
    ? [anchor, ...cgAll.filter(x => x.slot.id !== anchor.slot.id).sort((a, b) => a.slot.week - b.slot.week)]
    : [];
  // 상한 — 초과 CG는 버리지 않고 썸네일 카드로 강등(아래 cardSlots가 갤러리에 없는 기억을 자동 흡수).
  const galleryItems = ordered.slice(0, MAX_GALLERY);
  const galleryIds = new Set(galleryItems.map(x => x.slot.id));
  // 나머지(CG 없음 + 갤러리 초과 CG) → 썸네일 카드(시간순, 최대 MAX_CARDS).
  const cardSlots = slotsThisYear.filter(s => !galleryIds.has(s.id)).sort((a, b) => a.week - b.week);
  // CG 없는 해(Y2~Y6 현 상태)엔 갤러리=focal이 없어 카드만 나열돼 밋밋하다.
  // → 대표 기억(최고 importance, 동률이면 이른 주)을 큰 hero로 승격해 "그 해의 한 장면"을 만든다.
  // 갤러리가 있으면 그게 이미 focal이므로 승격하지 않음(중복 강조 방지).
  const heroCard = galleryItems.length === 0 && cardSlots.length > 0
    ? [...cardSlots].sort((a, b) => (b.importance - a.importance) || (a.week - b.week))[0]
    : undefined;
  const listSlots = heroCard ? cardSlots.filter(s => s.id !== heroCard.id) : cardSlots;
  const shownCards = listSlots.slice(0, MAX_CARDS);
  const hiddenCount = listSlots.length - shownCards.length;

  const hasScenes = slotsThisYear.length > 0;
  const hasFocal = galleryItems.length > 0 || !!heroCard;  // 갤러리 또는 hero 카드
  const tGallery = 420;  // focal 슬롯(갤러리/hero) 공통 등장 타이밍
  const tCards = hasFocal ? 560 : 420;
  const tClosing = hasScenes ? 700 : 420;
  // CTA는 콘텐츠를 다 읽을 즈음 조용히 등장 — 카드 수 비례(고정값이면 기억 많을 때 너무 일찍 뜸). 상한 클램프.
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

        {/* CG 기억 갤러리 — 여러 장이면 스와이프 */}
        {galleryItems.length > 0 && (
          <div className="ye-stagger" style={{ animationDelay: `${tGallery}ms`, marginBottom: 14 }}>
            <HeroGallery items={galleryItems} />
          </div>
        )}

        {/* CG 없는 해 대표 기억 — hero 카드(큰 초상/엠블럼 focal). 갤러리 없을 때만 */}
        {heroCard && (
          <div className="ye-stagger" style={{
            ...PANEL,
            // 정서 색온도 글로우 — 상단에서 옅게 번지는 따뜻/차가운 공기(toneTag 있을 때만)
            ...(heroCard.toneTag ? { background: `radial-gradient(120% 80% at 50% 0%, ${TONE_GLOW[heroCard.toneTag]}1f, transparent 62%), rgba(20,17,26,0.55)` } : {}),
            animationDelay: `${tGallery}ms`, padding: '22px 20px 20px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <MemoryThumb slot={heroCard} year={year} size={104} />
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic', marginTop: 16 }}>
              {heroCard.recallText}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
              {`W${heroCard.week} · ${catOf(heroCard.category).label}`}
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
