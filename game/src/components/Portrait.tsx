import { useState, useEffect } from 'react';
import { portraitCandidates, pickExisting } from '../engine/characterAssets';
import { CHARACTER_MANIFEST } from '../character-manifest.generated';
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
  /** 배경 사진 위에 맨몸으로 놓일 때의 액자 처리.
   *  neutral 초상은 **투명 누끼가 아니라 불투명 파스텔 배경**이 규약이라(누끼 금지),
   *  배경 사진이 진해지면 분홍 사각형이 사진 위에 뜬 것처럼 보인다. 테두리와 그림자를
   *  줘서 "사진을 세워둔 것"으로 읽히게 한다.
   *  카드(유리 바닥) 안에 있는 초상은 사진과 직접 닿지 않으므로 필요 없다. */
  framed?: boolean;
}

export function Portrait({ characterId, expression, size = 80, label, mental, mentalState, year, framed }: Props) {
  // `?? 'neutral'`이 필요하다 — mentalToExpression의 반환 타입이 `AvatarExpression | undefined`라
  // (CharacterAvatar Props의 expression이 optional) 이대로 두면 `string | undefined`가 된다.
  // 예전엔 템플릿 문자열에 바로 꽂아서 타입이 안 걸렸다.
  const expr: string = expression || (mental !== undefined && mentalState
    ? mentalToExpression(mental, mentalState)
    : 'neutral') || 'neutral';

  // **없는 파일을 먼저 두드리지 않는다.** mentalToExpression은 happy/sad/tired/burnout을
  // 돌려주는데 실물은 (부모 happy 2장을 빼면) 전부 neutral뿐이라, 예전엔 멘탈이 바뀔 때마다
  // 없는 파일을 요청하고 실패한 뒤 neutral로 되돌아왔다. manifest로 먼저 고른다.
  // 표정 실물이 들어오면 manifest가 자동으로 잡아 코드 수정 없이 켜진다.
  const base = import.meta.env.BASE_URL;
  const picked = pickExisting(portraitCandidates(characterId, expr, year), CHARACTER_MANIFEST);
  const exactPath = picked ? `${base}images/characters/${picked}` : null;

  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 캐릭터/표정/학년이 바뀌면 폴백 상태 리셋(prop 동기화)
    setUseFallback(false);
  }, [exactPath]);

  // manifest가 stale하면(dev에서 파일을 넣고 predev를 안 돌린 경우) onError가 받아 준다.
  if (exactPath && !useFallback) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <img
          src={webpSrc(exactPath)}
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
            // outline은 레이아웃을 안 건드린다 — border를 쓰면 box-sizing:border-box라
            // 그림이 들어갈 자리가 줄고, #443이 잠근 aspectRatio 계산에도 끼어든다.
            ...(framed ? {
              outline: '2px solid rgba(255,255,255,0.18)',
              outlineOffset: '-2px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.38)',
            } : {}),
          }}
          onError={() => setUseFallback(true)}
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
