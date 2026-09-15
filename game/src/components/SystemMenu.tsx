// 인게임 시스템 메뉴 — **플레이 중 나가는 유일한 길**. (#445)
//
// 예전에는 나갈 방법이 없었다. GameScreen이 마운트되는 순간 popstate마다 무조건 history를
// 다시 push해서 뒤로가기가 전 구간(주차·이벤트·결산·학년말)에서 먹혔고, `exitToTitle`은
// 엔딩 화면에만 연결돼 있었다. 모바일에서 뒤로가기는 1급 제스처라 "먹통 앱"으로 읽힌다.
//
// **오디오는 새로 만들지 않고 AudioToggle을 그대로 쓴다.** 그 컴포넌트 주석이 이미
// "오디오 항목 하나 때문에 화면을 늘리면 절제 원칙에 어긋난다"고 적어 뒀다 —
// 이 메뉴의 존재 이유는 나가는 길이고, 오디오는 이미 있는 것을 같은 자리에 모아 둔 것뿐이다.
//
// **aria-modal을 선언했으면 실제로 가둬야 한다.** 이 리포에는 선언만 해 놓고 뒤 요소가
// 전부 탭 순서에 남아 있는 자리가 있다(EventScene의 선택 안내) — 스크린리더에 거짓말을 하는
// 최악의 조합이다. 여기서는 열릴 때 포커스를 옮기고, Tab을 가두고, Escape로 닫는다.
import { useEffect, useRef } from 'react';
import { AudioToggle } from './AudioToggle';
import { playSfx } from '../audio/sfx';

type Props = {
  /** 타이틀로 나간다. 세이브는 남는다(store.exitToTitle) — 라벨이 그렇게 약속한다. */
  onExit: () => void;
  onClose: () => void;
};

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function SystemMenu({ onExit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 열릴 때 포커스를 안으로 옮긴다. 안 하면 키보드 사용자는 오버레이 뒤의
    // 보이지 않는 버튼들 사이를 헤매게 된다.
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      // 양 끝에서 감아 준다 — 이게 없으면 Tab이 오버레이 밖으로 빠져나간다.
      if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
      else if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(12,10,16,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600,
          background: 'var(--bg-card)',
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          padding: '18px 20px calc(18px + env(safe-area-inset-bottom, 0px))',
          border: '1px solid rgba(255,242,225,0.12)', borderBottom: 'none',
        }}
      >
        <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>
          메뉴
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 4px', marginBottom: 6,
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>소리</span>
          <AudioToggle />
        </div>

        <button
          type="button" className="btn btn-secondary"
          onClick={() => { playSfx('tap'); onExit(); }}
          style={{ marginBottom: 10 }}
        >
          🚪 타이틀로 나가기
          {/* 이 문장이 참이려면 exitToTitle이 세이브를 남겨야 한다 — 계약으로 잠가 둔다. */}
          <span className="btn__sub">진행은 저장돼 있어요</span>
        </button>

        <button type="button" className="btn btn-secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
