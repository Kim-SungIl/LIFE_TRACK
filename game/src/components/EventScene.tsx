import { useState, useEffect, useRef } from 'react';
import { GameEvent, EventChoice, StatKey, STAT_LABELS, EventLocation } from '../engine/types';
import { CharacterAvatar, NPC_APPEARANCES } from './CharacterAvatar';

const BASE_URL = import.meta.env.BASE_URL;

// ===== Constants =====

const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};

const NPC_COLORS: Record<string, string> = {
  jihun: '#4A90D9',
  subin: '#D4A574',
  minjae: '#E8834A',
  yuna: '#9B7EC8',
  haeun: '#D4A03C',
};

const LOCATION_GRADIENTS: Record<string, string> = {
  classroom: 'linear-gradient(180deg, #2a3a5c 0%, #1a2744 100%)',
  home: 'linear-gradient(180deg, #3d2b1f 0%, #2a1f15 100%)',
  park: 'linear-gradient(180deg, #1a3a2a 0%, #0f2a1a 100%)',
  hallway: 'linear-gradient(180deg, #2c3e50 0%, #1a2530 100%)',
  rooftop: 'linear-gradient(180deg, #4a6fa5 0%, #2a4060 100%)',
  street: 'linear-gradient(180deg, #4a3f5c 0%, #2a2535 100%)',
  gym: 'linear-gradient(180deg, #5c3a2a 0%, #3a2518 100%)',
  school_gate: 'linear-gradient(180deg, #3a5c4a 0%, #1a3a28 100%)',
  cafe: 'linear-gradient(180deg, #5c4a3a 0%, #3a2f20 100%)',
  music_room: 'linear-gradient(180deg, #3a2a5c 0%, #251a3a 100%)',
  beach: 'linear-gradient(180deg, #4a8ab5 0%, #2a5a80 100%)',
  convenience_store: 'linear-gradient(180deg, #4a5c3a 0%, #2a3a20 100%)',
  library: 'linear-gradient(180deg, #3a4a5c 0%, #1a2a3a 100%)',
  auditorium: 'linear-gradient(180deg, #5c4a4a 0%, #3a2a2a 100%)',
};

const DEFAULT_GRADIENT = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)';

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
  npcs?: { id: string; name: string; met: boolean }[];
  onChoice: (index: number) => void;
}

// ===== Subcomponents =====

interface CharacterImageProps {
  npcId: string;
  height: number;
  isActive: boolean;
  delay: number;
}

function CharacterImage({ npcId, height, isActive, delay }: CharacterImageProps) {
  const [src, setSrc] = useState(`${BASE_URL}images/characters/${npcId}_fullbody.png`);
  const [useFallback, setUseFallback] = useState(false);
  const neutralPath = `${BASE_URL}images/characters/${npcId}_neutral.png`;

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
            if (src !== neutralPath) {
              setSrc(neutralPath);
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

// ===== Helper: build effect badges =====

interface EffectBadge {
  text: string;
  color: string;
}

function buildEffectBadges(choice: EventChoice, npcNames: Record<string, { name: string; emoji: string }>): EffectBadge[] {
  const badges: EffectBadge[] = [];
  for (const [k, v] of Object.entries(choice.effects)) {
    const val = v as number;
    if (val !== 0) {
      badges.push({
        text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`,
        color: val > 0 ? 'var(--green)' : 'var(--red)',
      });
    }
  }
  if (choice.fatigueEffect) {
    badges.push({
      text: `피로 ${choice.fatigueEffect > 0 ? '+' : ''}${choice.fatigueEffect}`,
      color: choice.fatigueEffect > 0 ? 'var(--red)' : 'var(--green)',
    });
  }
  if (choice.moneyEffect) {
    badges.push({
      text: `💰 ${choice.moneyEffect > 0 ? '+' : ''}${choice.moneyEffect}만`,
      color: choice.moneyEffect > 0 ? 'var(--green)' : 'var(--red)',
    });
  }
  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = npcNames[ne.npcId];
      if (npc) {
        badges.push({
          text: `${npc.emoji} ${npc.name} ${ne.intimacyChange > 0 ? '♥' : '💔'}`,
          color: ne.intimacyChange > 0 ? 'var(--blue)' : 'var(--red)',
        });
      }
    }
  }
  return badges;
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

export function EventScene({ event, gender, npcs, onChoice }: EventSceneProps) {
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Reset state when event changes
  useEffect(() => {
    setChosenIndex(null);
    setShowResult(false);
    setBgLoaded(false);
    setBgError(false);
  }, [event.id]);

  // Gender-specific description/choices
  const isFemale = gender === 'female';
  const eventDesc = (isFemale && event.femaleDescription) ? event.femaleDescription : event.description;
  const eventChoices = (isFemale && event.femaleChoices) ? event.femaleChoices : event.choices;

  // Extract NPC IDs from speakers or choices
  const speakerIds: string[] = event.speakers && event.speakers.length > 0
    ? event.speakers
    : (() => {
        const ids = new Set<string>();
        eventChoices.forEach(c => c.npcEffects?.forEach(ne => ids.add(ne.npcId)));
        return Array.from(ids);
      })();

  // Primary speaker (first in array)
  const primarySpeaker = speakerIds.length > 0 ? speakerIds[0] : null;

  // Background
  const location = event.location;
  const bgCandidates = location ? [
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
  }, [location]);

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

  // Handle choice
  const handleChoice = (index: number) => {
    setChosenIndex(index);
    setShowResult(true);
    onChoice(index);
  };

  // Handle continue after result
  const handleContinue = () => {
    // The parent already processed the choice via onChoice
    // This is handled by the parent component
  };

  const chosenChoice = chosenIndex !== null ? eventChoices[chosenIndex] : null;

  // Build NPC name map for effect badges
  // We don't have access to full NpcState here, so we use IDs and known names
  const NPC_NAMES: Record<string, { name: string; emoji: string }> = {
    jihun: { name: '지훈', emoji: '📘' },
    subin: { name: '수빈', emoji: '🎨' },
    minjae: { name: '민재', emoji: '⚽' },
    yuna: { name: '유나', emoji: '📖' },
    haeun: { name: '해은', emoji: '🎵' },
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
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
          const label = npc ? (npc.met ? npc.name : '???') : (NPC_NAMES[npcId]?.name || npcId);
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
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '35%',
        minHeight: 220,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Text box */}
        <div style={{
          flex: 1,
          background: 'rgba(10, 20, 40, 0.92)',
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
          {!showResult ? (
            /* ===== Event Content ===== */
            <>
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

              {/* Description — 대사에 화자 이름 표시, 크게 */}
              <div style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                maxHeight: '6em',
                overflowY: 'auto',
                marginBottom: 12,
                flex: '0 1 auto',
              }}>
                {renderDescription(eventDesc, speakerIds, npcs)}
              </div>

              {/* Choices */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: '1 1 auto',
                overflowY: 'auto',
              }}>
                {eventChoices.map((choice, i) => (
                  <div
                    key={i}
                    onClick={() => handleChoice(i)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      animation: `es-choice-fade-up 0.3s ease ${0.1 + i * 0.08}s both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(233,69,96,0.12)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                      {choice.text}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ===== Result Content ===== */
            <>
              {/* Chosen message in italic quotes */}
              {chosenChoice && (
                <div style={{
                  fontSize: '0.92rem',
                  lineHeight: 1.8,
                  fontStyle: 'italic',
                  whiteSpace: 'pre-line',
                  color: 'rgba(255,255,255,0.9)',
                  marginBottom: 14,
                  animation: 'es-fade-in 0.4s ease',
                }}>
                  &ldquo;{chosenChoice.message}&rdquo;
                </div>
              )}

              {/* Effect badges */}
              {chosenChoice && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 14,
                  animation: 'es-fade-in 0.4s ease 0.1s both',
                }}>
                  {buildEffectBadges(chosenChoice, NPC_NAMES).map((eff, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: eff.color,
                    }}>
                      {eff.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={handleContinue}
                className="btn btn-primary"
                style={{
                  alignSelf: 'stretch',
                  animation: 'es-fade-in 0.4s ease 0.2s both',
                }}
              >
                계속 →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventScene;
