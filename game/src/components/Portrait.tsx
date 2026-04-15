import { useState, useEffect } from 'react';
import { CharacterAvatar, NPC_APPEARANCES, mentalToExpression } from './CharacterAvatar';

interface Props {
  characterId: string;
  expression?: string;
  size?: number;
  label?: string;
  mental?: number;
  mentalState?: string;
  year?: number;
}

export function Portrait({ characterId, expression, size = 80, label, mental, mentalState, year }: Props) {
  const expr = expression || (mental !== undefined && mentalState
    ? mentalToExpression(mental, mentalState)
    : 'neutral');

  // year 1(초6)이면 elementary 프리픽스 추가
  const prefix = year === 1 ? `${characterId}_elementary` : characterId;

  // 폴백 체인: elementary 표정 → elementary neutral → 일반 표정 → 일반 neutral → CSS 아바타
  const base = import.meta.env.BASE_URL;
  const isElementary = year === 1;
  const exactPath = `${base}images/characters/${prefix}_${expr}.png`;
  const neutralPath = `${base}images/characters/${prefix}_neutral.png`;
  const baseExactPath = isElementary ? `${base}images/characters/${characterId}_${expr}.png` : null;
  const baseNeutralPath = `${base}images/characters/${characterId}_neutral.png`;

  const [src, setSrc] = useState(exactPath);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setSrc(exactPath);
    setUseFallback(false);
  }, [exactPath]);

  if (!useFallback) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <img
          src={src}
          alt={`${characterId} ${expr}`}
          style={{
            width: size,
            height: size * 1.25,
            objectFit: 'cover',
            borderRadius: size * 0.15,
          }}
          onError={() => {
            if (src === exactPath && expr !== 'neutral') {
              setSrc(neutralPath);
            } else if (src === neutralPath && baseExactPath) {
              // elementary neutral 없으면 일반 표정으로 폴백
              setSrc(baseExactPath);
            } else if (src === baseExactPath && expr !== 'neutral') {
              setSrc(baseNeutralPath);
            } else if (src !== baseNeutralPath && isElementary) {
              setSrc(baseNeutralPath);
            } else {
              setUseFallback(true);
            }
          }}
        />
        {label && (
          <div style={{ fontSize: Math.max(size * 0.15, 11), fontWeight: 600, textAlign: 'center' }}>
            {label}
          </div>
        )}
      </div>
    );
  }

  const appearance = NPC_APPEARANCES[characterId] || { hair: '#2c2c3e', skin: '#fdd5b1', accent: '#3b5998' };
  return (
    <CharacterAvatar
      size={size}
      expression={expr as any}
      hair={appearance.hair}
      skin={appearance.skin}
      accent={appearance.accent}
      label={label}
      isNpc={characterId !== 'player'}
    />
  );
}
