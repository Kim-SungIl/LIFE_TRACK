import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { STEPS } from './tutorialSteps';
import { focusFirst, isTopLayer, popLayer, pushLayer, trapTab } from './focusTrap';

interface Props {
  onComplete: () => void;
  routineSet?: boolean; // 루틴 설정 완료 여부
}

export function Tutorial({ onComplete, routineSet = false }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [waitDone, setWaitDone] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const updateRect = useCallback(() => {
    const el = document.querySelector(`[data-tutorial="${current.target}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [current.target]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM 측정값(rect) 동기화, 외부 레이아웃 읽기
    updateRect();
    const timer = setTimeout(updateRect, 100);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    // DOM 변화 감지 — 콘텐츠가 펼쳐지거나 접힐 때 rect 연속 재계산
    const el = document.querySelector(`[data-tutorial="${current.target}"]`);
    let observer: MutationObserver | null = null;
    let rafId = 0;
    if (el) {
      observer = new MutationObserver(() => {
        // 변화 감지 후 여러 프레임에 걸쳐 재계산 (애니메이션/펼침 대응)
        updateRect();
        setTimeout(updateRect, 50);
        setTimeout(updateRect, 150);
        setTimeout(updateRect, 300);
      });
      observer.observe(el, { childList: true, subtree: true, attributes: true });

      // 인터랙티브 스텝에서는 지속적으로 rect 체크 (ResizeObserver 대용)
      if (current.interactive) {
        const pollRect = () => {
          updateRect();
          rafId = requestAnimationFrame(pollRect);
        };
        rafId = requestAnimationFrame(pollRect);
      }
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      observer?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [updateRect, current.target, current.interactive]);

  // 타겟으로 스크롤
  useEffect(() => {
    const el = document.querySelector(`[data-tutorial="${current.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(updateRect, 400);
    }
  }, [current.target, updateRect]);

  // 인터랙티브 스텝에서 DOM 변화 감지 (루틴 설정 등)
  useEffect(() => {
    if (!current.waitFor) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- waitFor 스텝 진입 시 대기상태 1회 리셋
    setWaitDone(false);

    // routineSet prop으로 감지
    if (current.waitFor === 'routine-done' && routineSet) {
      setWaitDone(true);
      return;
    }

    // MutationObserver로 DOM 변화 감지 (rect 업데이트용)
    const interval = setInterval(() => {
      updateRect();
      if (current.waitFor === 'routine-done' && routineSet) {
        setWaitDone(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [current.waitFor, routineSet, updateRect]);

  // routineSet이 변하면 자동으로 다음 스텝으로
  useEffect(() => {
    if (current.waitFor === 'routine-done' && routineSet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 루틴 완료 감지 시 대기 해제
      setWaitDone(true);
      updateRect();
      // 1.5초 후 자동으로 다음 스텝
      const timer = setTimeout(() => {
        if (step < STEPS.length - 1) setStep(step + 1);
        setWaitDone(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [routineSet, current.waitFor, updateRect, step]);

  const pad = 8;
  const isInteractive = current.interactive && !waitDone;

  // ===== 키보드 접근성 =====
  // 마우스로 막히는 것은 키보드로도 막고, 마우스로 통하는 것은 키보드로도 통해야 한다.
  // 비인터랙티브 스텝은 오버레이(pointerEvents:'auto')가 뒤 화면 클릭을 전부 먹으므로
  // Tab도 말풍선 안에 가둔다. 인터랙티브 스텝은 오버레이가 pointerEvents:'none'이라
  // 뒤 화면을 그대로 누를 수 있으니(그게 이 스텝의 과제다) Tab도 풀어 둔다.
  const overlayRef = useRef<HTMLDivElement>(null);
  const trapTabRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    trapTabRef.current = !isInteractive;
    onCompleteRef.current = onComplete;
  });

  // **바깥을 inert로 덮지 않는다.** 이건 모달이 아니라 뒤 UI를 가리키는 코치마크라,
  // 배경을 접근성 트리에서 빼면 "이게 이번 주 시간표예요"가 가리키는 대상이 스크린리더에서
  // 사라진다. 인터랙티브 스텝은 그 대상을 직접 눌러야 하는데 inert가 클릭까지 막는다.
  // 그래서 Dialog와 달리 트랩만 쓰고 inert는 안 건다. 스택은 공유한다 —
  // 슬롯 편집 Dialog가 위에 열렸을 때 Escape가 튜토리얼까지 건너뛰면 안 되기 때문.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    pushLayer(el);
    focusFirst(el);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopLayer(el)) return;
      if (e.key === 'Escape') {
        // 건너뛰기와 같은 출구. 마지막 스텝은 건너뛰기가 없지만 onComplete가 곧 "완료"라
        // 어느 스텝에서 눌러도 "튜토리얼을 끝낸다"로 일관된다(ever_seen까지 호출부가 세팅).
        e.stopPropagation();
        e.preventDefault();
        onCompleteRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!trapTabRef.current) return;
      trapTab(el, e);
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      popLayer(el);
      if (prevFocus?.isConnected) prevFocus.focus?.();
    };
  }, []);

  // 포커스를 쥐고 있던 버튼이 사라지면 body로 떨어진다. 실제로 **마운트 직후에 그렇다** —
  // 첫 렌더는 rect=null이라 중앙 폴백 카드를 그리고, rect를 측정한 뒤 말풍선으로 갈아끼운다.
  // 스텝 이동(이전 버튼 등장/퇴장)도 같은 경로다. 트랩이 도는 스텝에서만 다시 끌어온다 —
  // 인터랙티브 스텝은 포커스가 밖(하이라이트 대상)에 있는 게 정상이라 뺏으면 안 된다.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el || isInteractive || !isTopLayer(el)) return;
    if (!el.contains(document.activeElement)) focusFirst(el);
  });

  return (
    <div ref={overlayRef} tabIndex={-1} style={{
      outline: 'none',
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      // 인터랙티브 스텝이면 오버레이 자체는 클릭 불가, 하이라이트 영역만 통과
      pointerEvents: isInteractive ? 'none' : 'auto',
    }}>
      {/* 어두운 오버레이 */}
      <svg style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: isInteractive ? 'none' : 'auto',
      }}>
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad} y={rect.top - pad}
                width={rect.width + pad * 2} height={rect.height + pad * 2}
                rx={12} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill={isInteractive ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)'}
          mask="url(#tutorial-mask)"
        />
      </svg>

      {/* 하이라이트 테두리 */}
      {rect && (
        <div style={{
          position: 'absolute',
          top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 12,
          border: `2px solid ${isInteractive ? 'var(--yellow)' : 'var(--accent)'}`,
          boxShadow: isInteractive
            ? '0 0 20px rgba(224,179,84,0.4), 0 0 40px rgba(224,179,84,0.1)'
            : '0 0 20px rgba(224,138,91,0.3)',
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
          animation: isInteractive && !reducedMotion ? 'tutorial-pulse 1.5s ease-in-out infinite' : 'none',
        }} />
      )}

      {/* 말풍선 툴팁 */}
      {rect && (
        <div style={{
          position: 'absolute',
          left: '50%', transform: 'translateX(-50%)',
          ...(current.position === 'bottom'
            ? { top: rect.bottom + pad + 16 }
            : { bottom: window.innerHeight - rect.top + pad + 16 }
          ),
          width: 'calc(100% - 40px)', maxWidth: 360,
          background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
          borderRadius: 16, padding: '18px 20px',
          border: '1px solid rgba(224,138,91,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 201,
          pointerEvents: 'auto', // 툴팁은 항상 클릭 가능
        }}>
          {/* 진행 표시 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>
            {current.title}
          </div>
          <div style={{
            fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)',
            whiteSpace: 'pre-line', marginBottom: 16,
          }}>
            {waitDone && current.doneDesc ? current.doneDesc : current.desc}
          </div>

          {/* 인터랙티브 + 아직 미완료: 안내 텍스트 */}
          {isInteractive && !waitDone && (
            <div style={{
              fontSize: '0.78rem', color: 'var(--yellow)',
              textAlign: 'center', marginBottom: 12,
              animation: reducedMotion ? 'none' : 'tutorial-pulse 1.5s ease-in-out infinite',
            }}>
              👆 위 영역을 직접 눌러 보세요!
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {step > 0 && (
                <button
                  onClick={() => { setStep(step - 1); setWaitDone(false); }}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, padding: '8px 20px', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.82rem', height: 38,
                  }}
                >
                  이전
                </button>
              )}
              {/* waitFor가 있는 인터랙티브: 완료 전엔 다음 숨김, 완료 후 표시 */}
              {/* waitFor가 없는 인터랙티브(주말): 항상 다음 표시 */}
              {(!current.interactive || waitDone || !current.waitFor) && (
                <button
                  onClick={() => { setWaitDone(false); if (isLast) { onComplete(); } else { setStep(step + 1); } }}
                  style={{
                    background: 'var(--accent)', border: 'none',
                    // accent 위 흰 글자는 2.64:1로 AA(4.5) 아래다. --btn-ink는 6.35:1.
                    // CSS의 .btn-primary는 #417에서 이미 이 토큰으로 갔는데 인라인이라 못 받았다.
                    borderRadius: 8, padding: '8px 24px', color: 'var(--btn-ink)',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, height: 38,
                  }}
                >
                  {isLast ? '시작!' : '다음'}
                </button>
              )}
            </div>
            {!isLast && (
              <button
                type="button"
                className="btn-reset"
                onClick={onComplete}
                style={{
                  fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer',
                  // span일 때 38.7×14px이라 Tab으로도 못 닿고 손가락으로도 작았다.
                  // 시각 톤(배경 없음·muted·작은 글씨)은 그대로 두고 패딩으로만 히트 영역을 키운다.
                  padding: '6px 8px', minWidth: 24, minHeight: 24, lineHeight: 1.6,
                }}
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
      )}

      {/* rect 없을 때 */}
      {!rect && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
          borderRadius: 16, padding: '24px 28px', maxWidth: 360,
          border: '1px solid rgba(224,138,91,0.3)', textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>{current.title}</div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-line', marginBottom: 16 }}>
            {current.desc}
          </div>
          <button onClick={() => isLast ? onComplete() : setStep(step + 1)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            {isLast ? '시작!' : '다음'}
          </button>
        </div>
      )}

      {/* 펄스 애니메이션 */}
      <style>{`
        @keyframes tutorial-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
