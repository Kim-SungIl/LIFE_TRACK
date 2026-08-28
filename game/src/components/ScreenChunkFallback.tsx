/** lazy 화면 청크를 기다리는 동안의 자리 — 기존 톤 배경만 유지한 조용한 빈 화면.
 *
 *  스피너를 두지 않는 건 의도다. 청크는 보통 한 프레임 안에 오고, 그때 스피너가 번쩍이면
 *  "느리다"는 인상만 남는다(화면 전환 페이드와 같은 판단).
 *  시각적으론 비어 있지만 청크 로딩을 스크린리더에 1회 알린다(로드 후 재-suspend 없어 무음). */
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
