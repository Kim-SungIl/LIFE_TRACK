import { useEffect, useRef, ReactNode, CSSProperties } from 'react';

// Phase 1(UX 마찰 제거) — 전 모달 공통 다이얼로그 셸.
// 접근성: role=dialog + aria-modal, Escape 닫기, 포커스 트랩, 열기 전 포커스 복귀.
// 개별 모달은 오버레이/포커스 로직을 다시 짜지 말고 이 컴포넌트로 감싸기만 한다.

type Props = {
  onClose: () => void;
  children: ReactNode;
  /** 제목 텍스트가 없을 때 스크린리더용 라벨 */
  ariaLabel?: string;
  /** 모달 내부 제목 요소의 id (있으면 aria-labelledby로 연결) */
  labelledBy?: string;
  /** 배경(backdrop) 클릭으로 닫기 허용 (기본 true) */
  closeOnBackdrop?: boolean;
  /** 콘텐츠 박스 max-width (px 또는 CSS 값) */
  maxWidth?: number | string;
  /** 콘텐츠 박스 추가 스타일(그라디언트/보더/패딩 등 모달별 외형) */
  contentStyle?: CSSProperties;
  contentClassName?: string;
  zIndex?: number;
  /** 콘텐츠 정렬 — 'center'(기본) / 'bottom'(바텀시트) / 'top'(스크롤형 상단) */
  align?: 'center' | 'bottom' | 'top';
  /** 오버레이(backdrop) 추가 스타일(패딩/overflow 등) */
  overlayStyle?: CSSProperties;
};

// 포커스 가능한 요소 셀렉터
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  onClose,
  children,
  ariaLabel,
  labelledBy,
  closeOnBackdrop = true,
  maxWidth = 400,
  contentStyle,
  contentClassName,
  zIndex = 100,
  align = 'center',
  overlayStyle,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 열기 직전 포커스를 저장해두고, 닫힐 때 되돌린다.
    prevFocus.current = document.activeElement as HTMLElement | null;
    const el = contentRef.current;
    if (el) {
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? el).focus();
    }
    return () => {
      // 트리거 요소가 아직 문서에 있으면 포커스 복귀
      prevFocus.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    // 포커스 트랩 — 콘텐츠 밖으로 Tab 이 새지 않게 순환
    const el = contentRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      n => n.offsetParent !== null,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      el.focus();
      return;
    }
    const firstEl = nodes[0];
    const lastEl = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === firstEl || active === el)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <div
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: align === 'bottom' ? 'flex-end' : align === 'top' ? 'flex-start' : 'center',
        justifyContent: 'center',
        zIndex,
        ...overlayStyle,
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={contentClassName}
        style={{ width: '90%', maxWidth, outline: 'none', ...contentStyle }}
      >
        {children}
      </div>
    </div>
  );
}
