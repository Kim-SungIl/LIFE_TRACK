import { EndingData } from '../../engine/ending';
import { useEffect, useRef } from 'react';
import { playSfx } from '../../audio/sfx';
import { getBgmTrackId, setBgmTrack } from '../../audio/bgm';
import { AudioToggle } from '../AudioToggle';
import { Stats, StatKey, STAT_LABELS, Track, ParentStrength, Gender, MemorySlot, getGrade } from '../../engine/types';
import { resolveEventCgUrl } from '../../engine/eventCg';
import { BgWrapper, ScreenBgProps } from './BgWrapper';
import { STAT_ICONS } from './shared';
import { RunArchiveSummary } from './RunArchiveSummary';
import { CgItem, catOf } from './memoryTokens';
import { HeroGallery, MemoryThumb } from './memoryVisuals';
import type { RunDelta } from '../../engine/archive';

interface EndingScreenProps {
  ending: EndingData;
  track: Track | null;
  stats: Stats;
  parents: readonly ParentStrength[];
  burnoutCount: number;
  bgProps: ScreenBgProps;
  runDelta: RunDelta | null;
  // 회상 CG의 성별 판본(_m/_f)을 고른다. **required로 두는 게 안전장치다** —
  // resolveEventCgUrl은 gender!=='male'을 전부 여성으로 접으므로(eventCg.ts), optional로 두면
  // 배선을 빠뜨려도 에러 없이 남주 런에 여주 CG가 뜬다. required면 tsc -b가 호출부를 막는다
  // (tsconfig.scripts.json이 src/**/__tests__까지 훑으므로 테스트 호출부도 함께 걸린다).
  gender: Gender;
}

const YEAR_LABELS = ['초6', '중1', '중2', '중3', '고1', '고2', '고3'];
// 7년을 가로지르는 회상이라 주차만으론 어느 해인지 알 수 없다 — 학년 라벨을 앞에 붙인다.
// (학년말 화면은 한 해 안이라 "W12 · 성장"으로 충분했다.)
const recallCaption = (slot: MemorySlot): string =>
  `${YEAR_LABELS[slot.year - 1] ?? `Y${slot.year}`} · ${catOf(slot.category).label}`;

const PARENT_RECALL_MAP: Record<string, { icon: string; label: string; recall: string }> = {
  emotional:  { icon: '🫂', label: '정서적 지지', recall: '엄마가 현관에서 기다리던 노란 불빛.' },
  wealth:     { icon: '🏠', label: '여유 있는 집', recall: '책상 위, 말없이 놓여있던 흰 봉투.' },
  info:       { icon: '📱', label: '정보가 있는 집', recall: '식탁에 펼쳐진, 빨갛게 밑줄 쳐진 입시설명회 자료.' },
  strict:     { icon: '📐', label: '엄격한 집', recall: '11시, 스탠드를 끄러 오던 슬리퍼 소리.' },
  resilience: { icon: '⭐', label: '다시 일어나는 집', recall: '혼자 일어설 때까지, 한 발 떨어져 지켜보던 자리.' },
  freedom:    { icon: '🌿', label: '자유로운 집', recall: '"네가 정해" 하고는, 끝까지 안 닫던 안방 문.' },
};

// 7년의 여정을 마친 후 — phase === 'ending'
export function EndingScreen({ ending, track, stats, parents, burnoutCount, bgProps, runDelta, gender }: EndingScreenProps) {
  const trackLabel = track === 'humanities' ? '문과' : track === 'science' ? '이과' : null;

  // ===== 회상의 그림 =====
  // 학년말 회고와 같은 2단 규칙: CG 있는 회상은 큰 갤러리, 나머지는 초상/엠블럼 썸네일.
  // 작은 칸에 CG를 줄여 넣지 않는 이유는 memoryVisuals.tsx 주석 참조(판독 불가).
  //
  // ⚠️ **year는 반드시 슬롯의 year를 쓴다.** 엔딩 시점의 state.year는 7이 아니라 **8**이다
  //   (gameEngine.applyYearTransition이 Y7 마감에서 year++ 후 phase='ending'). 학교급-무관
  //   common/ 폴백을 가진 슬롯 이벤트는 0개라, state.year를 쓰면 초·중 회상의 그림이
  //   "엉뚱한 CG"가 되는 게 아니라 **전부 사라진다**. 같은 함정의 선례: archiveWiring.test.tsx.
  const recalls = ending.memorialHighlights ?? [];
  const cgAll: CgItem[] = recalls
    .map(h => (h.slot
      ? { slot: h.slot, cg: resolveEventCgUrl(h.slot.sourceEventId, h.slot.choiceIndex, gender, h.slot.year) }
      : null))
    .filter((x): x is CgItem => !!x && !!x.cg);
  // 학년말과 같은 하이브리드 정렬: 1번=대표(최고 importance — 첫 장만 봐도 그 판의 핵심),
  // 2번~ = 시간순(7년을 다시 걷는 흐름).
  const anchor = cgAll.length
    ? [...cgAll].sort((a, b) => (b.slot.importance - a.slot.importance)
      || (a.slot.year - b.slot.year) || (a.slot.week - b.slot.week))[0]
    : undefined;
  const galleryItems: CgItem[] = anchor
    ? [anchor, ...cgAll.filter(x => x.slot.id !== anchor.slot.id)
      .sort((a, b) => (a.slot.year - b.slot.year) || (a.slot.week - b.slot.week))]
    : [];
  const galleryIds = new Set(galleryItems.map(x => x.slot.id));
  // 갤러리에 안 들어간 회상 = CG 없는 슬롯 + 슬롯 자체가 없는 항목(milestone 승격·폴백 시드).
  // 슬롯이 있으면 초상/엠블럼이라도 붙어 그림 0장인 엔딩이 나오지 않는다.
  const restRecalls = recalls.filter(h => !(h.slot && galleryIds.has(h.slot.id)));

  // 엔딩 진입음 — 7년의 끝. 가장 길고 낮은 소리로, 화면이 뜨는 순간 한 번만.
  // ref 가드는 StrictMode 이중 호출로 화음이 겹쳐 울리는 것을 막는다(2.2초짜리라 특히 티가 난다).
  const endingPlayedRef = useRef(false);
  useEffect(() => {
    if (endingPlayedRef.current) return;
    endingPlayedRef.current = true;
    playSfx('ending');
  }, []);

  // 회상 테마로 갈아탄다. 진입음(A3→E4→C5→E5 상행)과 같은 조성이라 그 아르페지오가
  // 테마의 도입부처럼 이어진다.
  //
  // **떠날 때 원래 곡으로 되돌린다.** 되돌리지 않으면 타이틀로 나가서 새 판을 시작해도
  // 엔딩 곡이 계속 흐른다. 들어올 때의 곡을 기억해 두는 이유는, 나중에 화면별 곡이 늘어나도
  // "직전 곡"이 항상 main이라고 가정하지 않기 위해서다.
  useEffect(() => {
    const previous = getBgmTrackId();
    setBgmTrack('endingRecall');
    return () => setBgmTrack(previous);
  }, []);

  return (
    <BgWrapper {...bgProps}>
      <div className="ending-screen fade-in" style={{ minHeight: 'auto', padding: 0, position: 'relative' }}>
        {/* 이 화면에만 오디오 진입점이 없었다(타이틀·HUD에는 있다). 배경음이 흐르는데
            끌 방법이 화면에 없으면 게임을 나가야 끌 수 있다. */}
        <AudioToggle style={{ position: 'absolute', top: 0, right: 4, zIndex: 5 }} />
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

        {/* v1.2 회상 — 결정적 장면들. 이 층만 그림을 진다(아래 후회 층은 텍스트 유지). */}
        {recalls.length > 0 && (
          <div style={{ maxWidth: 420, margin: '0 auto 16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.15em' }}>돌아보면</div>
            {/* CG 있는 회상 — 큰 갤러리(여러 장이면 스와이프) */}
            {galleryItems.length > 0 && (
              <div style={{ marginBottom: restRecalls.length > 0 ? 12 : 0 }}>
                <HeroGallery items={galleryItems} caption={recallCaption} />
              </div>
            )}
            {/* 나머지 — 슬롯이 있으면 초상/엠블럼 썸네일, 없으면(milestone 승격·폴백) 문장만 */}
            {restRecalls.length > 0 && (
              <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: '2px solid var(--accent-soft)' }}>
                {restRecalls.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    marginBottom: i === restRecalls.length - 1 ? 0 : 10,
                  }}>
                    {h.slot && <MemoryThumb slot={h.slot} year={h.slot.year} size={40} />}
                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: h.isFallback ? 'var(--text-muted)' : 'var(--text-secondary)', lineHeight: 1.7, fontStyle: 'italic' }}>
                      {h.recallText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 후회카드 — "미처 닿지 못한 것" (0장이면 미표시)
            **의도적으로 텍스트만 남긴다.** regretHighlights도 위 회상과 같은 MemorialHighlight
            타입이라 slot을 갖고 있어(실측 60~75%가 CG 보유) 그림을 붙일 수 있지만, 자책 층에
            그림이 붙으면 회한이 전시가 된다. 재료가 없어서가 아니라 안 붙이는 것 — 위 회상
            블록을 복사해 오면 조용히 깨지므로 계약 테스트로 "이 블록에 img 0개"를 잠가 뒀다. */}
        {ending.regretHighlights && ending.regretHighlights.length > 0 && (
          <div style={{ maxWidth: 420, margin: '0 auto 16px', padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: '2px solid rgba(160,160,180,0.35)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.15em' }}>미처 닿지 못한 것</div>
            {ending.regretHighlights.map((h, i) => (
              <div key={i} style={{ fontSize: '0.82rem', color: h.isClosing ? 'var(--accent-soft)' : 'var(--text-muted)', lineHeight: 1.7, marginBottom: 6, fontStyle: 'italic', marginTop: h.isClosing ? 10 : 0 }}>
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
          {/* Phase 4A: 친밀도 tier 전반 회고 (warm/normal/distant) */}
          {ending.parentEpilogue?.intro && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12, textAlign: 'center', fontStyle: 'italic' }}>
              {ending.parentEpilogue.intro}
            </div>
          )}
          {parents.map(p => {
            const r = PARENT_RECALL_MAP[p];
            if (!r) return null;
            // Phase 4A: 친밀도 tier별 강점 서사 (없으면 기존 고정 앵커만)
            const beat = ending.parentEpilogue?.beats.find(b => b.strength === p)?.text;
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
                  {beat && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                      {beat}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
          총합 {Math.round(Object.values(stats).reduce((a, b) => a + b, 0))}점 · 번아웃 {burnoutCount}회
        </div>

        {/* 다회차 유도 — 막연한 "다른 길은 어땠을까?" 대신 실제로 남아 있는 것을 이름으로 가리킨다 */}
        <RunArchiveSummary runDelta={runDelta} />

        <button className="btn btn-primary" style={{ maxWidth: 280 }} onClick={() => window.location.reload()}>
          다시 시작하기
        </button>
      </div>
    </BgWrapper>
  );
}
