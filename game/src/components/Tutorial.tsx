import { useState, useEffect, useCallback } from 'react';

interface TutorialStep {
  target: string;
  title: string;
  desc: string;
  position: 'top' | 'bottom';
  interactive?: boolean;  // true면 하이라이트 영역 클릭 가능
  waitFor?: string;       // 이 data-tutorial-done 값이 나타나면 자동 진행
  doneDesc?: string;      // waitFor 충족 후 보여줄 메시지
}

const STEPS: TutorialStep[] = [
  {
    target: 'hud',
    title: '내 상태',
    desc: '캐릭터, 날짜, 피로, 용돈이 표시돼요.\n💰을 누르면 상점에서 물건을 살 수 있어요.',
    position: 'bottom',
  },
  {
    target: 'stats',
    title: '능력치',
    desc: '학업, 인기, 특기, 멘탈, 체력 5가지예요.\n눌러서 펼치면 상세 내용을 볼 수 있어요!',
    position: 'bottom',
    interactive: true,
  },
  {
    target: 'routine',
    title: '평일 일과',
    desc: '이게 이번 주 시간표예요!\n주중엔 학교가 끝나면 방과후·저녁 시간이 있어요.\n\n왼쪽 빈 칸을 터치해서 방과후 활동을 골라 보세요!',
    position: 'bottom',
    interactive: true,
    waitFor: 'routine-done',
    doneDesc: '잘했어요! 방과후 루틴은 매주 자동 반복돼요.\n바꾸고 싶으면 언제든 터치하면 돼요.',
  },
  {
    target: 'routine',
    title: '주말 활동',
    desc: '이번엔 주말이에요!\n오른쪽 토요일·일요일 빈 칸을 터치해서\n주말에 할 활동도 골라 보세요!',
    position: 'bottom',
    interactive: true,
  },
  {
    target: 'confirm',
    title: '한 주 보내기',
    desc: '시간표를 다 채웠으면 이 버튼을 눌러\n한 주를 보내세요!\n\n정답은 없어요. 자유롭게 플레이하세요!',
    position: 'top',
  },
];

interface Props {
  onComplete: () => void;
  routineSet?: boolean; // 루틴 설정 완료 여부
}

export function Tutorial({ onComplete, routineSet = false }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [waitDone, setWaitDone] = useState(false);

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
  }, [updateRect, current.target]);

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

  return (
    <div style={{
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
            ? '0 0 20px rgba(255,193,7,0.4), 0 0 40px rgba(255,193,7,0.1)'
            : '0 0 20px rgba(233,69,96,0.3)',
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
          animation: isInteractive ? 'tutorial-pulse 1.5s ease-in-out infinite' : 'none',
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
          background: 'linear-gradient(135deg, rgba(15,52,96,0.98), rgba(26,26,46,0.98))',
          borderRadius: 16, padding: '18px 20px',
          border: '1px solid rgba(233,69,96,0.3)',
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
              animation: 'tutorial-pulse 1.5s ease-in-out infinite',
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
                  onClick={() => { setWaitDone(false); isLast ? onComplete() : setStep(step + 1); }}
                  style={{
                    background: 'var(--accent)', border: 'none',
                    borderRadius: 8, padding: '8px 24px', color: 'white',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, height: 38,
                  }}
                >
                  {isLast ? '시작!' : '다음'}
                </button>
              )}
            </div>
            {!isLast && (
              <span
                onClick={onComplete}
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                건너뛰기
              </span>
            )}
          </div>
        </div>
      )}

      {/* rect 없을 때 */}
      {!rect && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, rgba(15,52,96,0.98), rgba(26,26,46,0.98))',
          borderRadius: 16, padding: '24px 28px', maxWidth: 360,
          border: '1px solid rgba(233,69,96,0.3)', textAlign: 'center',
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
