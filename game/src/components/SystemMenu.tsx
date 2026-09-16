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
// **공용 Dialog를 쓴다.** 처음에는 포커스 트랩·Escape를 여기서 직접 구현했는데, 그러면
// 이 메뉴가 `Dialog`의 `dialogStack` 밖에 서게 된다. 상점이 열린 채 뒤로가기를 누르면
// 상점의 **캡처 단계** 핸들러(Dialog.tsx:116)가 먼저 받아 `stopPropagation`으로 끊으므로
// 이 메뉴의 버블 리스너는 아예 실행되지 않았다 — 실측: Tab이 보이지 않는 상점으로 새고,
// Escape가 메뉴가 아니라 **상점을 닫았다**(두 번 눌러야 메뉴가 닫혔다). 게다가 aria-modal
// 다이얼로그 둘이 동시에 뜬 채 둘 다 inert가 아니었다 — 스크린리더에 거짓말을 하는 조합이다.
// 스택·inert·캡처 Escape/Tab·포커스 복귀가 전부 Dialog에 있으므로 거기에 태우는 것이 답이다.
import { Dialog } from './Dialog';
import { AudioToggle } from './AudioToggle';
import { playSfx } from '../audio/sfx';

type Props = {
  /** 타이틀로 나간다. 세이브는 남는다(store.exitToTitle) — 라벨이 그렇게 약속한다. */
  onExit: () => void;
  onClose: () => void;
  /**
   * 마지막 저장이 실패한 상태인가(용량 초과·사파리 프라이빗 등).
   *
   * 이때 "진행은 저장돼 있어요"는 **거짓말이다.** `exitToTitle`은 메모리 state를 버리므로
   * 마지막 성공 저장 이후의 진행이 사라진다. 페이지 언로드가 아니라 상태 전환이라
   * `beforeunload` 경고도 안 뜬다 — 여기서 말하지 않으면 아무 데서도 안 말한다.
   */
  saveFailed?: boolean;
};

export function SystemMenu({ onExit, onClose, saveFailed = false }: Props) {
  return (
    <Dialog
      onClose={onClose}
      ariaLabel="메뉴"
      align="bottom"
      maxWidth={600}
      zIndex={300}
      overlayStyle={{ background: 'rgba(12,10,16,0.72)' }}
      contentStyle={{
        width: '100%',
        background: 'var(--bg-card)',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: '18px 20px calc(18px + env(safe-area-inset-bottom, 0px))',
        border: '1px solid rgba(255,242,225,0.12)',
        borderBottom: 'none',
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
        {/* 이 문장이 참이려면 exitToTitle이 세이브를 남겨야 한다 — 계약으로 잠가 둔다.
            저장이 죽은 환경에서는 참이 아니므로 문구를 바꾼다(경고를 상시로 두면 경고가 아니다). */}
        <span className="btn__sub" style={saveFailed ? { color: 'var(--red)' } : undefined}>
          {saveFailed
            ? '저장이 안 되는 중이에요 — 나가면 최근 진행이 사라져요'
            : '진행은 저장돼 있어요'}
        </span>
      </button>

      <button type="button" className="btn btn-secondary" onClick={onClose}>
        닫기
      </button>
    </Dialog>
  );
}
