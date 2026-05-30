import { useState, useEffect, useRef, useMemo } from 'react';
import { GameEvent, EventChoice, GameState } from '../engine/types';
import { getEventBackground, getSchoolLevel, LOCATION_GRADIENTS, DEFAULT_GRADIENT } from '../engine/backgrounds';
import { characterStagePrefix, characterFallbackPrefix } from '../engine/characterAssets';
import { CharacterAvatar, NPC_APPEARANCES } from './CharacterAvatar';
import { prefetchAssets } from '../engine/assetPrefetch';
import { CG_MANIFEST } from '../cg-manifest.generated';

const BASE_URL = import.meta.env.BASE_URL;

// ===== Constants =====

const NPC_COLORS: Record<string, string> = {
  jihun: '#4A90D9',
  subin: '#D4A574',
  minjae: '#E8834A',
  yuna: '#9B7EC8',
  haeun: '#D4A03C',
};

// LOCATION_GRADIENTS / DEFAULT_GRADIENT 는 engine/backgrounds.ts 로 이동 (SSOT).

// ===== Keyframes injection =====

const KEYFRAMES_ID = 'event-scene-keyframes';

function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes es-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes es-slide-up {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes es-choice-fade-up {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ===== Props =====

export interface EventSceneProps {
  event: GameEvent;
  gender: 'male' | 'female';
  year: number;
  npcs?: { id: string; name: string; met: boolean }[];
  onChoice: (index: number) => void;
  /** EventChoice.condition 평가용 — 없으면 모든 선택지 노출 */
  state?: GameState;
}

// ===== Subcomponents =====

interface CharacterImageProps {
  npcId: string;
  height: number;
  isActive: boolean;
  delay: number;
  year?: number;
  gender?: 'male' | 'female';
}

function CharacterImage({ npcId, height, isActive, delay, year, gender }: CharacterImageProps) {
  const isElementary = year === 1;
  const isHigh = year !== undefined && year >= 5;
  const isStaged = isElementary || isHigh;
  // 학년 분기 자산: elementary(Y1) / middle(Y2~4) / high(Y5+) — SSOT는 characterAssets.ts
  const prefix = characterStagePrefix(npcId, year);
  const basePrefix = characterFallbackPrefix(npcId); // 폴백 바닥 = _middle
  const g = gender === 'female' ? 'f' : 'm';
  // elementary/high 는 _f gendered 변주 가능
  const stagedFullbodyGendered = gender === 'female'
    ? `${BASE_URL}images/characters/${prefix}_fullbody_${g}.png`
    : null;
  const stagedFullbody = `${BASE_URL}images/characters/${prefix}_fullbody.png`;
  const stagedNeutral = `${BASE_URL}images/characters/${prefix}_neutral.png`;
  const baseFullbodyGendered = gender === 'female'
    ? `${BASE_URL}images/characters/${basePrefix}_fullbody_${g}.png`
    : null;
  const baseFullbody = `${BASE_URL}images/characters/${basePrefix}_fullbody.png`;
  const baseNeutral = `${BASE_URL}images/characters/${basePrefix}_neutral.png`;
  const [src, setSrc] = useState(stagedFullbodyGendered || stagedFullbody);
  const [useFallback, setUseFallback] = useState(false);

  if (!useFallback) {
    return (
      <div style={{
        animation: `es-slide-up 0.4s ease-out ${delay}s both`,
        filter: isActive ? 'drop-shadow(0 0 12px rgba(255,255,255,0.15))' : 'brightness(0.6)',
        transition: 'filter 0.3s',
      }}>
        <img
          src={src}
          alt={npcId}
          style={{
            height,
            width: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
          onError={() => {
            // 폴백 순서 (staged = elementary 또는 high):
            // (여자면) staged gendered → staged fullbody → staged neutral → base gendered → base fullbody → base neutral → CSS
            // (남자면) staged fullbody → staged neutral → base fullbody → base neutral → CSS
            if (isStaged && stagedFullbodyGendered && src === stagedFullbodyGendered) {
              setSrc(stagedFullbody);
            } else if (isStaged && src === stagedFullbody) {
              setSrc(stagedNeutral);
            } else if (isStaged && src === stagedNeutral) {
              setSrc(baseFullbodyGendered || baseFullbody);
            } else if (baseFullbodyGendered && src === baseFullbodyGendered) {
              setSrc(baseFullbody);
            } else if (src !== baseNeutral) {
              setSrc(baseNeutral);
            } else {
              setUseFallback(true);
            }
          }}
        />
      </div>
    );
  }

  const appearance = NPC_APPEARANCES[npcId] || { hair: '#2c2c3e', skin: '#fdd5b1', accent: '#3b5998' };
  return (
    <div style={{
      animation: `es-slide-up 0.4s ease-out ${delay}s both`,
      filter: isActive ? 'drop-shadow(0 0 12px rgba(255,255,255,0.15))' : 'brightness(0.6)',
      transition: 'filter 0.3s',
    }}>
      <CharacterAvatar
        size={height * 0.4}
        expression="neutral"
        hair={appearance.hair}
        skin={appearance.skin}
        accent={appearance.accent}
        isNpc={npcId !== 'player'}
      />
    </div>
  );
}

// ===== Main Component =====

// ===== 대사 파싱: "..." 부분에 화자 이름 붙이기 =====
function renderDescription(
  text: string,
  speakerIds: string[],
  npcs?: { id: string; name: string; met: boolean }[],
) {
  const lines = text.split('\n');
  const primaryId = speakerIds[0];
  const primaryNpc = npcs?.find(n => n.id === primaryId);
  // met 안 됐으면 ???, met 됐거나 이 이벤트에서 만나는 거면 이름 표시
  const speakerLabel = primaryNpc
    ? (primaryNpc.met ? primaryNpc.name : '???')
    : null;
  const speakerColor = primaryId ? (NPC_COLORS[primaryId] || '#aaa') : '#aaa';

  return lines.map((line, i) => {
    // "..." 패턴 찾기
    const quoteMatch = line.match(/^(.*?)"(.+)"(.*)$/);
    if (quoteMatch) {
      const [, before, dialogue, after] = quoteMatch;
      return (
        <div key={i} style={{ marginBottom: 4 }}>
          {before && <span style={{ color: 'rgba(255,255,255,0.7)' }}>{before}</span>}
          {before ? <br /> : null}
          {speakerLabel && (
            <span style={{ color: speakerColor, fontWeight: 700, fontSize: '0.85rem' }}>
              {speakerLabel}
            </span>
          )}
          {speakerLabel && <span style={{ color: 'rgba(255,255,255,0.4)' }}> : </span>}
          <span style={{ color: '#fff', fontWeight: 500 }}>"{dialogue}"</span>
          {after && <span style={{ color: 'rgba(255,255,255,0.7)' }}>{after}</span>}
        </div>
      );
    }
    return (
      <div key={i} style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
        {line}
      </div>
    );
  });
}

// 긴 description을 페이지로 분할 — 한 페이지가 maxCharsPerPage를 넘기 전까지 source 줄(`\n`)을 누적.
// 짧은 description(단일 페이지 분량)은 그대로 1페이지로 반환되어 기존 동작 보존.
// 모바일은 한 줄당 글자수가 적어 같은 임계값이면 description 박스 캡(6em)을 초과 →
// 호출부에서 화면 폭에 맞춰 더 작은 값(45)을 넘긴다.
function paginateDescription(text: string, maxCharsPerPage = 80): string[] {
  const lines = text.split('\n');
  const pages: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const line of lines) {
    const lineLen = line.length;
    if (currentLen + lineLen > maxCharsPerPage && current.length > 0) {
      pages.push(current);
      current = [line];
      currentLen = lineLen;
    } else {
      current.push(line);
      currentLen += lineLen;
    }
  }
  if (current.length > 0) pages.push(current);
  return pages.map(p => p.join('\n'));
}

export function EventScene({ event, gender, year, npcs, onChoice, state }: EventSceneProps) {
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgError, setBgError] = useState(false);
  // 긴 description의 페이지 분할 — 한 번이라도 마지막 페이지에 도달했으면 선택지 영구 노출
  const [pageIndex, setPageIndex] = useState(0);
  const [maxPageReached, setMaxPageReached] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Reset state when event changes
  useEffect(() => {
    setBgLoaded(false);
    setBgError(false);
    setPageIndex(0);
    setMaxPageReached(0);
  }, [event.id]);

  // 선택지 결과 CG prefetch — 사용자가 선택지 보는 동안 manifest에 존재하는
  // 모든 선택지의 결과 CG 후보를 백그라운드 로드. 결과 화면 진입 시 캐시 적중.
  useEffect(() => {
    const level = getSchoolLevel(year);
    const genderSuffix = gender === 'male' ? 'm' : 'f';
    const choiceCount = (gender === 'female' && event.femaleChoices)
      ? event.femaleChoices.length
      : event.choices.length;
    const candidates: string[] = [];
    for (let ci = 0; ci < choiceCount; ci++) {
      for (const dir of [level, 'common']) {
        const rels = [
          `${dir}/${event.id}_c${ci}_${genderSuffix}.png`,
          `${dir}/${event.id}_${genderSuffix}.png`,
          `${dir}/${event.id}_c${ci}.png`,
          `${dir}/${event.id}.png`,
        ];
        for (const rel of rels) {
          if (CG_MANIFEST.has(rel)) candidates.push(`images/events/${rel}`);
        }
      }
    }
    prefetchAssets(candidates);
  }, [event.id, gender, year]);

  // Gender-specific description/choices
  const isFemale = gender === 'female';
  const eventDesc = (isFemale && event.femaleDescription) ? event.femaleDescription : event.description;
  const eventChoices = (isFemale && event.femaleChoices) ? event.femaleChoices : event.choices;
  // condition이 있는 선택지는 만족하지 않으면 숨김 — 원본 인덱스 유지
  const visibleChoices: { choice: EventChoice; originalIndex: number }[] = eventChoices
    .map((choice, originalIndex) => ({ choice, originalIndex }))
    .filter(({ choice }) => !choice.condition || (state ? choice.condition(state) : true));

  // B-2 안전망: 모든 보이는 선택지가 비용 부족으로 잠겼는지 체크 → "지나친다" fallback 노출
  const allInsufficient = visibleChoices.length > 0 && visibleChoices.every(({ choice }) => {
    const c = choice.moneyEffect && choice.moneyEffect < 0 ? -choice.moneyEffect : 0;
    return c > 0 && state ? state.money < c : false;
  });

  // 모바일 폭(≤ 600px)에서는 한 줄에 들어가는 글자수가 데스크탑의 절반 이하 →
  // 페이지 분할 임계값과 description 박스 캡을 모바일에 맞춰 늘려준다.
  // 마운트 시점 한 번 측정 (charHeight도 같은 패턴) — 회전 시는 다음 이벤트부터 반영.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  // description 페이지 분할 — 짧으면 1페이지, 길면 여러 페이지로 자동 분할
  const pages = useMemo(
    () => paginateDescription(eventDesc, isMobile ? 45 : 80),
    [eventDesc, isMobile],
  );
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const currentPageText = pages[safePageIndex] ?? eventDesc;
  const isMultiPage = pages.length > 1;
  const isLastPage = safePageIndex >= pages.length - 1;
  const isFirstPage = safePageIndex <= 0;
  // 한 번이라도 마지막 페이지에 도달했으면 true — 이후 ◀ 이전으로 돌아가도 선택지 유지.
  // 단일 페이지 이벤트는 maxPageReached(0) >= pages.length-1(0)이라 즉시 true.
  const hasReachedEnd = maxPageReached >= pages.length - 1;
  const advancePage = () => {
    if (!isLastPage) {
      const next = safePageIndex + 1;
      setPageIndex(next);
      // 같은 핸들러에서 함께 set → React가 배치, flicker 없이 동시 반영
      setMaxPageReached(prev => Math.max(prev, next));
    }
  };
  const retreatPage = () => {
    if (!isFirstPage) setPageIndex(p => p - 1);
  };

  // speakers가 명시된 경우에만 캐릭터 표시 (npcEffects에서 자동 추출하지 않음)
  const speakerIds: string[] = event.speakers && event.speakers.length > 0
    ? event.speakers
    : [];

  // Primary speaker (first in array)
  const primarySpeaker = speakerIds.length > 0 ? speakerIds[0] : null;

  // Background: prefer event.background (new system), fall back to location-based
  const location = event.location;
  const resolvedEventBg = event.background ? getEventBackground(event.background, year) : undefined;
  const bgCandidates = resolvedEventBg
    ? [`${BASE_URL}${resolvedEventBg.replace(/^\//, '')}`]
    : location ? [
      `${BASE_URL}images/backgrounds/${location}_afternoon.png`,
      `${BASE_URL}images/backgrounds/${location}_evening.png`,
      `${BASE_URL}images/backgrounds/${location}_spring.png`,
      `${BASE_URL}images/backgrounds/${location}.png`,
    ] : [];
  const gradientBg = location
    ? (LOCATION_GRADIENTS[location] || DEFAULT_GRADIENT)
    : DEFAULT_GRADIENT;

  // Preload background image with fallback chain
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(bgCandidates[0] || null);
  useEffect(() => {
    if (bgCandidates.length === 0) {
      setBgError(true);
      return;
    }
    let found = false;
    const tryLoad = (idx: number) => {
      if (idx >= bgCandidates.length) { setBgError(true); return; }
      const img = new Image();
      img.onload = () => { setBgImageUrl(bgCandidates[idx]); setBgLoaded(true); setBgError(false); found = true; };
      img.onerror = () => { if (!found) tryLoad(idx + 1); };
      img.src = bgCandidates[idx];
    };
    tryLoad(0);
  }, [location, event.background]);

  // Character positions
  const getCharacterPositions = (count: number): string[] => {
    if (count === 1) return ['50%'];
    if (count === 2) return ['25%', '75%'];
    return Array.from({ length: count }, (_, i) =>
      `${((i + 1) / (count + 1)) * 100}%`
    );
  };

  const charPositions = getCharacterPositions(speakerIds.length);
  const charHeight = typeof window !== 'undefined' ? window.innerHeight * 0.65 : 500;

  // 선택 즉시 부모에 위임 — 결과 화면은 부모가 eventResultData 경로로 그림
  const handleChoice = (index: number) => {
    onChoice(index);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        // iOS Safari 주소창이 100vh를 가리는 문제 → 동적 viewport(dvh) 사용
        height: '100dvh',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* ===== Layer 1: Background ===== */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: gradientBg,
        zIndex: 0,
      }}>
        {bgImageUrl && !bgError && (
          <img
            src={bgImageUrl}
            alt={location || 'background'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: bgLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
          />
        )}
        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.2)',
        }} />
      </div>

      {/* ===== Layer 3: Focus/Mood overlay ===== */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.15)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* ===== Layer 2: Characters ===== */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        bottom: '30%', // 텍스트 박스 바로 위, 캐릭터 발이 여기에 닿음
        top: 0,
        zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end', // 하단 정렬 — 발이 바닥에 닿음
        justifyContent: 'center',
      }}>
        {speakerIds.map((npcId, i) => {
          const npc = npcs?.find(n => n.id === npcId);
          const label = npc ? (npc.met ? npc.name : '???') : npcId;
          const isSpeaking = npcId === primarySpeaker;
          return (
            <div
              key={npcId}
              style={{
                position: 'absolute',
                bottom: 0,
                left: charPositions[i],
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <CharacterImage
                npcId={npcId}
                height={charHeight * 0.95}
                isActive={isSpeaking}
                delay={i * 0.1}
                year={year}
                gender={gender}
              />
              {/* 캐릭터 아래 이름 태그 */}
              {NPC_COLORS[npcId] && (
                <div style={{
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: npc?.met === false ? '#666' : NPC_COLORS[npcId],
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#fff',
                  marginTop: -4,
                  opacity: isSpeaking ? 1 : 0.5,
                  transition: 'opacity 0.3s',
                }}>
                  {label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Layer 4: Text Box + Choices ===== */}
      {/* 모바일: 고정 35% 대신 콘텐츠에 맞춰 늘어나되 상한(80dvh)을 둠 — 작은 화면에서
          description(10em)이 공간을 다 먹어 선택지가 잘리던 문제 방지.
          데스크탑: 기존 고정 35% 유지. */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        ...(isMobile ? { maxHeight: '80dvh' } : { height: '35%' }),
        minHeight: 220,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Text box */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 19, 27, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 24px 16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'es-fade-in 0.3s ease',
        }}>
          {/* Event title — 작게 */}
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 6,
            letterSpacing: '0.5px',
          }}>
            {event.title}
          </div>

          {/* Description — 대사에 화자 이름 표시. 길면 페이지 분할, 마지막 페이지에서만 선택지 노출 */}
          <div
            onClick={isMultiPage && !isLastPage ? advancePage : undefined}
            style={{
              fontSize: '1rem',
              lineHeight: 1.7,
              maxHeight: isMobile ? '10em' : '6em',
              overflowY: 'auto',
              marginBottom: isMultiPage && !isLastPage ? 6 : 12,
              flex: '0 1 auto',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
              cursor: isMultiPage && !isLastPage ? 'pointer' : 'default',
            }}
          >
            {renderDescription(currentPageText, speakerIds, npcs)}
          </div>

          {/* 페이지 네비게이션 — 다중 페이지일 때 노출. ◀ 이전(실수 클릭 복구) / 카운터 / 다음 ▶ */}
          {isMultiPage && (
            <div
              style={{
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                marginBottom: 12,
                userSelect: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 18,
                animation: 'es-fade-in 0.4s ease',
              }}
            >
              <span
                onClick={isFirstPage ? undefined : retreatPage}
                style={{
                  cursor: isFirstPage ? 'not-allowed' : 'pointer',
                  opacity: isFirstPage ? 0.3 : 1,
                  padding: '4px 8px',
                  transition: 'opacity 0.15s',
                }}
              >
                ◀ 이전
              </span>
              <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                {safePageIndex + 1} / {pages.length}
              </span>
              <span
                onClick={isLastPage ? undefined : advancePage}
                style={{
                  cursor: isLastPage ? 'not-allowed' : 'pointer',
                  opacity: isLastPage ? 0.3 : 1,
                  padding: '4px 8px',
                  transition: 'opacity 0.15s',
                }}
              >
                다음 ▶
              </span>
            </div>
          )}

          {/* Choices — 한 번이라도 마지막 페이지 도달 후 영구 노출 (재읽기 시 사라지지 않게) */}
          <div style={{
            display: hasReachedEnd ? 'flex' : 'none',
            flexDirection: 'column',
            gap: 8,
            flex: '1 1 auto',
            overflowY: 'auto',
          }}>
            {visibleChoices.map(({ choice, originalIndex }, i) => {
              // 돈 부족 시 비활성화 — moneyEffect가 음수인데 잔돈이 모자라면 잠금
              const cost = choice.moneyEffect && choice.moneyEffect < 0 ? -choice.moneyEffect : 0;
              const insufficient = cost > 0 && state ? state.money < cost : false;
              return (
              <div
                key={originalIndex}
                onClick={() => { if (!insufficient) handleChoice(originalIndex); }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: insufficient ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${insufficient ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: insufficient ? 'not-allowed' : 'pointer',
                  opacity: insufficient ? 0.45 : 1,
                  transition: 'all 0.2s',
                  animation: `es-choice-fade-up 0.3s ease ${0.1 + i * 0.08}s both`,
                }}
                onMouseEnter={e => {
                  if (insufficient) return;
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'rgba(224,138,91,0.14)';
                }}
                onMouseLeave={e => {
                  if (insufficient) return;
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                  {choice.text}
                </div>
                {insufficient && (
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--red, #d96a6a)', marginTop: 4 }}>
                    💰 돈이 부족합니다 (보유 {state?.money ?? 0}만 / 필요 {cost}만)
                  </div>
                )}
              </div>
              );
            })}
            {allInsufficient && (
              <div
                onClick={() => handleChoice(-1)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  animation: `es-choice-fade-up 0.3s ease ${0.1 + visibleChoices.length * 0.08}s both`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'rgba(224,138,91,0.14)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>지나친다</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  지금은 감당하기 어렵다. 조용히 자리를 뜬다.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

