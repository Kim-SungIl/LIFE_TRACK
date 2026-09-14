import { useState, useEffect } from 'react';
import { characterStagePrefix, characterFallbackPrefix } from '../engine/characterAssets';
import { webpSrc } from '../engine/assetWebp';
import { CharacterAvatar, NPC_APPEARANCES, mentalToExpression, type AvatarExpression } from './CharacterAvatar';

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

  // 학년 분기 프리픽스: Y1 → elementary, Y2~4 → middle, Y5+ → high (SSOT: characterAssets.ts)
  const isElementary = year === 1;
  const isHigh = year !== undefined && year >= 5;
  const isStaged = isElementary || isHigh;
  const prefix = characterStagePrefix(characterId, year);
  const basePrefix = characterFallbackPrefix(characterId); // 폴백 바닥 = _middle

  // 폴백 체인: staged 표정 → staged neutral → base(_middle) 표정 → base neutral → CSS 아바타
  // (staged 자산이 없는 NPC는 _middle로 자동 폴백되므로 안전)
  const base = import.meta.env.BASE_URL;
  const exactPath = `${base}images/characters/${prefix}_${expr}.png`;
  const neutralPath = `${base}images/characters/${prefix}_neutral.png`;
  const baseExactPath = isStaged ? `${base}images/characters/${basePrefix}_${expr}.png` : null;
  const baseNeutralPath = `${base}images/characters/${basePrefix}_neutral.png`;

  const [src, setSrc] = useState(exactPath);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 캐릭터/표정/학년 경로가 바뀌면 이미지 src 리셋(prop 동기화)
    setSrc(exactPath);
    setUseFallback(false);
  }, [exactPath]);

  if (!useFallback) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <img
          src={webpSrc(src)}
          alt={`${characterId} ${expr}`}
          decoding="async"
          style={{
            width: size,
            // **컨테이너보다 커지지 않는다.** 예전엔 width가 픽셀 고정이라 카드를 유동으로
            // 바꿔도 초상만 그대로 넘쳤다(320px 성별 선택에서 15.7% 잘림).
            // aspectRatio + height:auto라 줄어들 때도 1:1.25 비율을 지킨다 —
            // height를 고정한 채 width만 줄이면 objectFit:cover가 좌우를 잘라낸다.
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: '1 / 1.25',
            objectFit: 'cover',
            borderRadius: size * 0.15,
          }}
          onError={() => {
            if (src === exactPath && expr !== 'neutral') {
              setSrc(neutralPath);
            } else if (src === neutralPath && baseExactPath) {
              // staged(elementary/high) neutral 없으면 base 표정으로 폴백
              setSrc(baseExactPath);
            } else if (src === baseExactPath && expr !== 'neutral') {
              setSrc(baseNeutralPath);
            } else if (src !== baseNeutralPath && isStaged) {
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
      expression={expr as AvatarExpression}
      hair={appearance.hair}
      skin={appearance.skin}
      accent={appearance.accent}
      label={label}
      isNpc={characterId !== 'player'}
    />
  );
}
