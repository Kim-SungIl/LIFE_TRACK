// 기억을 그림으로 보여주는 공통 컴포넌트 — 학년말 회고(YearEndScreen)와 7년의 끝(EndingScreen)이 공유.
//
// 원래 YearEndScreen 안에만 있었다. 엔딩 회상에 같은 형태가 필요해지면서 꺼냈다 —
// 복사하면 두 화면의 톤이 갈라지고(패치워크), 무엇보다 아래 "작은 칸엔 CG를 쓰지 않는다"는
// 판단이 한쪽에서만 지켜지는 상태가 된다. 동작 변경은 없다(순수 이동).
//
// 규칙 두 줄로 요약하면:
//   큰 자리(HeroGallery) = CG.        작은 자리(MemoryThumb) = NPC 초상 → 카테고리 엠블럼.
//   세 이미지 타입 전부 같은 "바랜 일기장" 필터로 묶어 한 시스템처럼 보이게 한다.
import { useEffect, useRef, useState } from 'react';
import { MemorySlot } from '../../engine/types';
import { webpSrc } from '../../engine/assetWebp';
import { Portrait } from '../Portrait';
import { CgItem, PANEL, catOf, toneFilter } from './memoryTokens';

// 엠블럼 아트 URL — 조립과 webpSrc 감싸기를 한 자리에 둔다(assetUrlContract 소스 스캔 규약).
const emblemSrc = (artKey: string): string =>
  webpSrc(`${import.meta.env.BASE_URL}images/emblems/${artKey}.png`);

// CG가 있는 기억들의 스와이프 갤러리 — CG가 여러 장이면 좌우로 넘겨본다.
// 1장이면 단일 표시(점 없음), 2장+면 스크롤-스냅 캐러셀 + 하단 점 인디케이터. 자동진행 없음(넘김은 선택).
//
// caption: 기본은 "W{주} · {카테고리}"(학년말 — 한 해 안이라 주차가 좌표다). 엔딩처럼 7년을
// 가로지르는 자리에선 주차만으론 어느 해인지 알 수 없어, 호출부가 학년을 포함한 문구를 넘긴다.
export function HeroGallery({ items, caption }: { items: CgItem[]; caption?: (slot: MemorySlot) => string }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const multi = items.length > 1;
  const captionOf = caption ?? ((slot: MemorySlot) => `W${slot.week} · ${catOf(slot.category).label}`);

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
            <img src={webpSrc(cg)} alt="" decoding="async" loading="lazy" style={{ width: '100%', height: 200, maxHeight: 200, objectFit: 'cover', objectPosition: 'center 30%', display: 'block', filter: toneFilter(slot.toneTag) }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div style={{ padding: '12px 16px 14px' }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {slot.recallText}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {captionOf(slot)}
              </div>
            </div>
          </div>
        ))}
      </div>
      {multi && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className="btn-reset"
              aria-label={`${i + 1}번째 장면 보기`}
              aria-pressed={i === idx}
              onClick={() => goTo(i)}
              style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                background: i === idx ? 'var(--accent-soft)' : 'rgba(255,255,255,0.25)',
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 기억 썸네일 — NPC 초상(있으면) → 카테고리 엠블럼. (작은 썸네일에선 줄인 CG가 오히려 판독 어려워 제외;
// CG는 갤러리의 큰 자리에서만 사용). 초상/엠블럼 모두 동일 색 링 + 동일 바랜 필터로 한 시스템처럼.
//
// year는 초상의 학교급을 정한다 — **슬롯의 학년을 넘길 것**(현재 학년이 아니다). 엔딩에서는
// state.year가 8이라 특히 위험하다(EndingScreen 주석 참조).
export function MemoryThumb({ slot, year, size }: { slot: MemorySlot; year: number; size: number }) {
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
      <img src={emblemSrc(cat.artKey)} alt="" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
