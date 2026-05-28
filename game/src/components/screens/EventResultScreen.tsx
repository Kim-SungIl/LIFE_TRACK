import { GameState } from '../../engine/types';
import { LOCATION_GRADIENTS, DEFAULT_GRADIENT } from '../EventScene';
import { getEventBackground, getSchoolLevel } from '../../engine/backgrounds';
import { CG_MANIFEST } from '../../cg-manifest.generated';
import { breakSentences, EventResultData } from './shared';

interface EventResultScreenProps {
  gender: GameState['gender'];
  year: number;
  eventResultData: EventResultData;
  cgLoaded: boolean;
  cgError: boolean;
  onCgLoaded: () => void;
  onCgError: () => void;
  onContinue: () => void;
}

// 이벤트 선택 직후 결과 화면 — CG/배경/효과 배지 + "계속 →"
export function EventResultScreen({
  gender, year, eventResultData, cgLoaded, cgError,
  onCgLoaded, onCgError, onContinue,
}: EventResultScreenProps) {
  const resultEvent = eventResultData.event;
  const resultLocation = resultEvent?.location;
  const BASE = import.meta.env.BASE_URL;
  const bgGradient = resultLocation ? (LOCATION_GRADIENTS[resultLocation] || DEFAULT_GRADIENT) : DEFAULT_GRADIENT;
  // 배경 이미지: event.background 우선, 없으면 location 기반 폴백
  const resolvedEventBg = resultEvent?.background ? getEventBackground(resultEvent.background, year) : undefined;
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
  //
  // 자산 의도 SSOT는 docs/event-cg-prompts-y1.md 의 [🧭 CG 폴백 정책] 표 참조.
  // 변경 시 양쪽 동기화. 특히 생일 c2(카톡)는 jihun/subin/yuna 동일 이미지를
  // 각 이벤트 파일명으로 사본 저장하는 정책.
  const eventId = resultEvent?.id;
  const ci = eventResultData.choiceIndex ?? 0;
  const genderSuffix = gender === 'male' ? 'm' : 'f';
  const schoolLevel = getSchoolLevel(year);
  // manifest 키는 BASE prefix 없는 events/ 이하 상대경로 (예: 'elementary/foo_c0_m.png').
  // 후보를 manifest로 1차 필터링해 자산 부재 시 8개 직렬 404 비용을 제거.
  const buildCandidates = (dir: string): string[] => eventId ? [
    `${dir}/${eventId}_c${ci}_${genderSuffix}.png`,
    `${dir}/${eventId}_${genderSuffix}.png`,
    `${dir}/${eventId}_c${ci}.png`,
    `${dir}/${eventId}.png`,
  ] : [];
  const eventImgCandidates: string[] = [
    ...buildCandidates(schoolLevel),
    ...buildCandidates('common'),
  ]
    .filter(rel => CG_MANIFEST.has(rel))
    .map(rel => `${BASE}images/events/${rel}`);
  const eventImgPrimary = eventImgCandidates[0] ?? null;

  // CG 정상: 그라데이션 → CG 페이드인 (PR #76 — 모바일에서 fallback 깜빡임 회피)
  // CG 실패: cgError로 fallback 복원. cascade onError + 타임아웃 1500ms 둘 중 빠른 쪽 트리거.
  //   (일부 환경에서 8개 후보 onError가 끝까지 호출되지 않아 빈 화면으로 남던 문제 회피)
  const hasCg = !!eventImgPrimary;
  const showFallback = !hasCg || cgError;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: bgGradient }}>
      {/* 배경 이미지 + 주인공 — CG 없거나 모든 후보 실패한 경우만 표시 */}
      {showFallback && (
        <>
          <div style={{ position: 'absolute', inset: 0 }}>
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
          <div style={{
            position: 'absolute', top: '5%', left: 0, right: 0, bottom: '35%',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 5, pointerEvents: 'none',
          }}>
            <img
              src={`${BASE}images/characters/${gender === 'male' ? 'player_m' : 'player_f'}${year === 1 ? '_elementary' : year >= 5 ? '_high' : ''}_fullbody.png`}
              alt=""
              style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </>
      )}
      {/* 결과 내용 — CG 있고 로드 성공 시 중앙, 그 외(없음/실패) 하단 */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10, padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: hasCg && !cgError ? 'center' : 'flex-end' }} className="fade-in">
        {/* 이벤트 결과 이미지 (CG) — 인덱스 기반 cascade 폴백. 모두 실패(cgError)면 박스 자체 숨김 */}
        {eventImgPrimary && !cgError && (
          <div style={{
            marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)',
            opacity: cgLoaded ? 1 : 0, transition: 'opacity 0.25s ease',
          }}>
            <img
              src={eventImgPrimary}
              alt=""
              data-cg-idx="0"
              decoding="async"
              loading="eager"
              fetchPriority="high"
              style={{ width: '100%', display: 'block', borderRadius: 12 }}
              onLoad={onCgLoaded}
              onError={e => {
                const img = e.target as HTMLImageElement;
                const idx = parseInt(img.dataset.cgIdx || '0') + 1;
                if (idx < eventImgCandidates.length) {
                  img.dataset.cgIdx = String(idx);
                  img.src = eventImgCandidates[idx];
                } else {
                  img.style.display = 'none';
                  onCgError();
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
          <div style={{ fontSize: '1.15rem', lineHeight: 1.8, fontStyle: 'italic', whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word', color: 'rgba(255,255,255,0.95)', textAlign: 'center' }}>
            {breakSentences(eventResultData.message)}
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
        <button className="btn btn-primary" onClick={onContinue}>
          계속 →
        </button>
      </div>
    </div>
  );
}
