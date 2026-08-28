/** lazy 화면 청크를 기다리는 동안의 자리 — 기존 톤 배경만 유지한 조용한 빈 화면.
 *
 *  스피너를 두지 않는 건 의도다. 청크는 보통 한 프레임 안에 오고, 그때 스피너가 번쩍이면
 *  "느리다"는 인상만 남는다(화면 전환 페이드와 같은 판단).
 *
 *  라이브 리전은 **의도이지 확인된 동작이 아니다.** aria-live는 보통 "이미 있던 리전의
 *  내용이 바뀔 때" 읽는데, 여기선 리전과 문구가 같은 프레임에 함께 삽입되므로 리더가
 *  아무 말도 안 할 가능성이 있다(jsdom으로는 확인 불가 — 실제 스크린리더로 재봐야 한다).
 *  그래서 이 문구에 의존하는 UX를 새로 얹지 말 것. 다만 있어서 해가 되지도 않는다.
 *
 *  **스택 컨텍스트는 호출부 책임이다.** z-index를 주지 않았다 — position:fixed라 같은
 *  스택 컨텍스트의 뒷 형제 위에 그려지고, 현재 두 호출부(TitleScreen·GameScreen)는
 *  모두 화면을 통째로 갈아치우는 early return 자리라 겹칠 형제가 없다. 오버레이 위에
 *  띄우려면 감싸는 쪽에서 z-index를 줄 것. */
export function ScreenChunkFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)' }}
    >
      <span style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
      }}>불러오는 중…</span>
    </div>
  );
}
