import { BgInfo } from '../../engine/backgrounds';
import { webpSrc } from '../../engine/assetWebp';

// 배경 사진의 불투명도. **0.25였다** — 같은 교실 그림이 이벤트 장면(EventScene은 1.0)에선
// 무대였는데 주간 화면에선 희미한 텍스처였다. 플레이 시간의 대부분이 이 화면인데 그림이
// 4배 옅게 깔려 있었고, 그래서 "게임"이 아니라 "앱"으로 읽혔다.
//
// 올려도 글자가 안 죽는 이유: 이 래퍼 안의 카드는 전부 rgba(42,34,48,0.85)+blur(6px)로
// 자기 바닥을 갖는다(StatsPanel·ExamTimeline·독백 말풍선). 카드 밖에 맨몸으로 있던 둘
// (HUD·자동저장 표시)은 같은 유리 바닥을 받았다 — 배경을 올리는 일과 한 쌍이다.
//
// 최종 값은 **게임에서 눈으로 보고 정할 것**. 화면마다 다르게 하려면 bgOpacity로 넘긴다.
export const BG_IMAGE_OPACITY = 0.55;

interface BgWrapperProps {
  bg: BgInfo;
  bgImgError: boolean;
  onImgError: () => void;
  children: React.ReactNode;
  extraStyle?: React.CSSProperties;
  /** 배경 사진 불투명도. 기본 BG_IMAGE_OPACITY. */
  bgOpacity?: number;
}

// 모듈 레벨 컴포넌트 — 부모 렌더마다 새 함수 참조 생성을 피해 자식 트리 unmount/remount 방지
export function BgWrapper({ bg, bgImgError, onImgError, children, extraStyle, bgOpacity = BG_IMAGE_OPACITY }: BgWrapperProps) {
  return (
    <div style={{
      minHeight: '100dvh', position: 'relative', overflow: 'hidden',
      background: bg.gradient,
      ...extraStyle,
    }}>
      {bg.image && !bgImgError && (
        <img
          src={webpSrc(`${import.meta.env.BASE_URL}${bg.image.replace(/^\//, '')}`)} alt=""
          decoding="async"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: bgOpacity, pointerEvents: 'none' }}
          onError={onImgError}
        />
      )}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.overlay, pointerEvents: 'none' }} />
      {bg.levelOverlay && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.levelOverlay, pointerEvents: 'none' }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

export type { BgWrapperProps };

// 화면 컴포넌트가 BgWrapper 에 그대로 펼쳐 넘기는 prop 묶음.
// children/extraStyle 은 BgWrapper 내부 책임이라 제외.
export type ScreenBgProps = Pick<BgWrapperProps, 'bg' | 'bgImgError' | 'onImgError'>;
