import { BgInfo } from '../../engine/backgrounds';

interface BgWrapperProps {
  bg: BgInfo;
  bgImgError: boolean;
  onImgError: () => void;
  children: React.ReactNode;
  extraStyle?: React.CSSProperties;
}

// 모듈 레벨 컴포넌트 — 부모 렌더마다 새 함수 참조 생성을 피해 자식 트리 unmount/remount 방지
export function BgWrapper({ bg, bgImgError, onImgError, children, extraStyle }: BgWrapperProps) {
  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: bg.gradient,
      ...extraStyle,
    }}>
      {bg.image && !bgImgError && (
        <img
          src={`${import.meta.env.BASE_URL}${bg.image.replace(/^\//, '')}`} alt=""
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25, pointerEvents: 'none' }}
          onError={onImgError}
        />
      )}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.overlay, pointerEvents: 'none' }} />
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
