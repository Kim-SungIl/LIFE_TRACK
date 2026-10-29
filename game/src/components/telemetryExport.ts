// 플레이 기록 내보내기 — SystemMenu의 버튼이 부른다(컴포넌트 파일은 컴포넌트만 export: react-refresh).
import { exportTelemetry } from '../engine/telemetry';

/** 내보낼 파일 이름 — 날짜·이름 같은 식별 정보는 안 붙인다. */
export const TELEMETRY_FILE_NAME = 'lifetrack-play-log.json';

/**
 * 플레이 기록(engine/telemetry.ts)을 파일로 받는다 — 피드백으로 건넬 때. 밖으로 보내는 길은 없다.
 * 파일 저장을 못 하는 환경(구형 브라우저·테스트)이면 false.
 */
export function downloadTelemetry(): boolean {
  try {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    const url = URL.createObjectURL(new Blob([exportTelemetry()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = TELEMETRY_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}
