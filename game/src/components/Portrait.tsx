import { useState, useEffect } from 'react';
import { CharacterAvatar, NPC_APPEARANCES, mentalToExpression } from './CharacterAvatar';

interface Props {
  characterId: string;
  expression?: string;
  size?: number;
  label?: string;
  mental?: number;
  mentalState?: string;
}

export function Portrait({ characterId, expression, size = 80, label, mental, mentalState }: Props) {
  const expr = expression || (mental !== undefined && mentalState
    ? mentalToExpression(mental, mentalState)
    : 'neutral');

  // 먼저 정확한 표정 파일을 시도, 실패하면 neutral, 그것도 실패하면 CSS 폴백
  const exactPath = `/images/characters/${characterId}_${expr}.png`;
  const neutralPath = `/images/characters/${characterId}_neutral.png`;

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
              // 정확한 표정 파일 없으면 neutral로 폴백
              setSrc(neutralPath);
            } else {
              // neutral도 없으면 CSS 아바타
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
