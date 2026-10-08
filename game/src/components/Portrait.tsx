import { useState, useEffect } from 'react';
import { portraitCandidates, pickAllExisting } from '../engine/characterAssets';
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
  /**
   * 액자 처리 — **놓이는 자리**로 고른다. `'card'`는 유리 카드 안, `'photo'`는 배경 사진 위.
   *
   * 왜 액자가 필요한가: neutral 초상은 **투명 누끼가 아니라 불투명 파스텔 배경**이 규약이라
   * (누끼 금지), 아무 처리 없이 두면 파스텔 사각형이 바탕에 박힌 것처럼 보인다. 테두리를 줘서
   * "사진을 세워둔 것"으로 읽히게 한다.
   *
   * **테두리는 두 자리가 같고, 그림자만 다르다.** 예전엔 `framed` 불리언 하나였고 둘 다
   * 테두리+그림자였다. #455는 "배경 사진 위에 맨몸일 때만"이라 HUD를 제외했었고, #496은
   * "매주 오가는 두 화면에서 같은 초상이 한쪽만 액자"라는 이유로 HUD도 켰다. 둘 다 근거가
   * 있었지만 어느 쪽도 실측이 아니었다.
   *
   * **실측(T63).** 배포본을 390×844·DPR 3으로 띄워 같은 주차의 두 처리를 픽셀로 쟀다:
   *   · 그림자는 초상 바깥 **1~4px**에서 카드 바닥을 42.4 vs 51.0으로 만든다 — 상대 17%.
   *     4~10px에서는 −2.7로 떨어지고 그 밖은 0이다. "가장자리에만 닿는다"는 맞았지만,
   *     그 가장자리 안에서는 카드 위에 테두리가 한 겹 더 있는 것처럼 읽힐 만큼은 한다.
   *   · 테두리를 2px에서 1px로 낮추면 **0.6/255**밖에 안 바뀐다. 그래서 두께는 안 건드린다 —
   *     효과 없는 변경으로 두 화면을 갈라놓을 이유가 없다.
   * 그래서 카드 안에서는 **그림자만** 끈다. 사진 위(주간 결산)는 바탕이 사진이라 그대로 둔다.
   */
  frame?: 'card' | 'photo';
}

export function Portrait({ characterId, expression, size = 80, label, mental, mentalState, year, frame }: Props) {
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
  const existing = pickAllExisting(portraitCandidates(characterId, expr, year), CHARACTER_MANIFEST);
  const key = existing.join('|');

  // **실패했을 때만** 다음 후보로 넘어간다. 전부 manifest 소속이라 정상 경로의 요청은 1회다.
  // 이게 필요한 경우: manifest가 디스크보다 앞선 상태(파일을 지웠는데 predev 미실행).
  // 그때 첫 후보만 있으면 갈 곳이 CSS 아바타뿐이라, 실재하는 neutral을 두고도 그림이 사라진다.
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 캐릭터/표정/학년이 바뀌면 후보 커서 리셋(prop 동기화)
    setIdx(0);
  }, [key]);

  const picked = existing[idx] ?? null;
  const exactPath = picked ? `${base}images/characters/${picked}` : null;

  if (exactPath) {
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
            ...(frame ? {
              outline: '2px solid rgba(255,255,255,0.18)',
              outlineOffset: '-2px',
              // 사진 위에서만 띄운다 — 카드 안에서는 이 한 줄이 초상 둘레 4px을 17% 어둡게 한다.
              ...(frame === 'photo' ? { boxShadow: '0 2px 10px rgba(0,0,0,0.38)' } : {}),
            } : {}),
          }}
          onError={() => setIdx(i => i + 1)}
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
