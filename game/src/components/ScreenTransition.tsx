import { useEffect, useRef, type ReactNode } from 'react';

// 화면 전환 페이드.
//
// **왜 필요한가**: 주 넘김·이벤트 진입이 즉시 교체라 장면이 "튀었다". 배경·텍스트·버튼이
// 한 프레임에 전부 바뀌면 읽던 자리를 잃는다. 짧은 페이드 하나로 "장면이 바뀐다"가 읽힌다.
//
// **왜 리마운트가 아니라 애니메이션 재시작인가**: 래퍼에 key를 주면 화면 컴포넌트가 통째로
// 언마운트된다 — EventScene은 전신 이미지·CG를 다시 로드하고 내부 페이지 상태가 초기화되며,
// EventResultScreen은 효과음 가드 ref를 잃는다. 전환은 순전히 시각 효과이므로 DOM과 자식
// 트리는 그대로 두고 CSS 애니메이션만 다시 트리거한다(클래스 제거 → 리플로 강제 → 재부착).
// 덕분에 이 컴포넌트를 끼워도 화면들의 동작이 하나도 바뀌지 않는다.
//
// **속도를 두 단계로 나눈 이유 — 빈도다.** 이벤트는 한 판에 150~200회 등장한다(학기 사건
// 주율 66%, 8시드 실측). 여기에 긴 페이드를 붙이면 sfx.ts에서 eventAppear 게인을 내린 것과
// 똑같은 이유로 피로가 된다. 긴 전환은 학년말(한 판 6회)·엔딩(1회)처럼 드문 장면에만 쓴다.
// 즉 **느린 전환은 위로 올리는 게 아니라 아래로 내리는 방향으로만** 추가할 것.

export type TransitionPace = 'normal' | 'slow';

const CLASS: Record<TransitionPace, string> = {
  normal: 'screen-enter',
  slow: 'screen-enter-slow',
};

interface ScreenTransitionProps {
  /** 화면 정체성. 이 값이 바뀔 때만 페이드가 다시 돈다. */
  transitionKey: string;
  pace?: TransitionPace;
  children: ReactNode;
}

export function ScreenTransition({ transitionKey, pace = 'normal', children }: ScreenTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  const className = CLASS[pace];

  useEffect(() => {
    // 첫 렌더는 className이 이미 붙은 채로 마운트돼 애니메이션이 돈다 — 다시 흔들 필요가 없다.
    if (firstRun.current) { firstRun.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove(CLASS.normal, CLASS.slow);
    void el.offsetWidth;   // 리플로 강제 — 이게 없으면 브라우저가 제거·재부착을 합쳐버려 재시작이 안 된다
    el.classList.add(className);
  }, [transitionKey, className]);

  return <div ref={ref} className={className}>{children}</div>;
}
