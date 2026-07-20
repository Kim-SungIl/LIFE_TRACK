import { useEffect, useRef, ReactNode, CSSProperties } from 'react';

// Phase 1(UX 마찰 제거) — 전 모달 공통 다이얼로그 셸.
// 접근성: role=dialog + aria-modal, Escape 닫기, 포커스 트랩, 열기 전 포커스 복귀.
// 개별 모달은 오버레이/포커스 로직을 다시 짜지 말고 이 컴포넌트로 감싸기만 한다.
//
// 중첩 대응(리뷰 반영): 열린 다이얼로그를 모듈 스택으로 추적한다.
//  - keydown(Escape/Tab)은 document 레벨에서 처리하되 **최상위 다이얼로그만** 반응
//    → 포커스가 자식 unmount로 body에 떨어져도 Escape가 살아 있고, 하위 레이어가
//      상위 대신 닫히는 오작동이 없다.
//  - 새 다이얼로그가 열리면 직전 최상위 콘텐츠에 `inert`를 걸어 배경 모달을
//    접근성 트리·조작에서 제외한다(aria-modal 중복 해소).

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
  /** 값이 바뀌면 첫 포커스 가능 요소로 재포커스 — 같은 Dialog 인스턴스 안에서
      내용이 통째로 교체되는 경우(예: SlotEditPopup 루틴1→루틴2) 포커스 유실 방지 */
  focusKey?: string | number;
};

// 포커스 가능한 요소 셀렉터
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 열린 다이얼로그 콘텐츠 스택(최상위 = 마지막). 중첩 시 최상위만 키보드에 반응.
const dialogStack: HTMLElement[] = [];

function focusFirst(el: HTMLElement) {
  const first = el.querySelector<HTMLElement>(FOCUSABLE);
  (first ?? el).focus();
}

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
  focusKey,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  // onClose를 ref로 잡아, 마운트 시 한 번 등록하는 document 리스너의 stale closure 방지.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // 열기 직전 포커스 저장 → 닫힐 때 복귀
    prevFocus.current = document.activeElement as HTMLElement | null;
    // 직전 최상위를 inert 처리(배경 모달 비활성)
    const prevTop = dialogStack[dialogStack.length - 1];
    if (prevTop) prevTop.inert = true;
    dialogStack.push(el);
    focusFirst(el);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 최상위 다이얼로그만 처리 — 포커스가 body로 떨어졌어도 Escape/Tab 유효
      if (dialogStack[dialogStack.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        n => n.offsetParent !== null,
      );
      const active = document.activeElement;
      // 포커스가 콘텐츠 밖(자식 unmount 등으로 body)으로 샜으면 다시 안으로
      if (!el.contains(active)) {
        e.preventDefault();
        (nodes[0] ?? el).focus();
        return;
      }
      if (nodes.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && (active === firstEl || active === el)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const i = dialogStack.indexOf(el);
      if (i >= 0) dialogStack.splice(i, 1);
      // 새 최상위 복원(inert 해제)
      const newTop = dialogStack[dialogStack.length - 1];
      if (newTop) newTop.inert = false;
      prevFocus.current?.focus?.();
    };
  }, []);

  // 내용 교체 시(focusKey 변경) 첫 요소로 재포커스 — 마운트 시엔 위 effect가 이미 처리.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const el = contentRef.current;
    if (el && dialogStack[dialogStack.length - 1] === el) focusFirst(el);
  }, [focusKey]);

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
        className={contentClassName}
        style={{ width: '90%', maxWidth, outline: 'none', ...contentStyle }}
      >
        {children}
      </div>
    </div>
  );
}
