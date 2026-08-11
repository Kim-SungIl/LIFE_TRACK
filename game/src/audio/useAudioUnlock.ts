// 첫 사용자 제스처에서 오디오를 해제한다.
//
// 브라우저 자동재생 정책상 AudioContext는 사용자 제스처 없이는 running이 되지 않는다.
// 개별 버튼마다 unlockAudio()를 부르면 빠뜨리는 곳이 생기므로, 문서 레벨에서 한 번만 잡는다.
//
// capture: true — 앱이 stopPropagation을 쓰는 곳이 있어도 해제는 반드시 통과시킨다.
// once 대신 수동 해제를 쓰는 이유: pointerdown/keydown/touchend 중 **먼저 오는 것 하나**로
// 끝내야 하는데, once는 이벤트 종류별로 각각 한 번씩 남아 나머지가 계속 붙어 있게 된다.
//
// 리스너를 떼는 조건이 "한 번 불렀다"가 아니라 **"실제로 running이 됐다"**인 점이 중요하다.
// unlockAudio() 호출과 해제 성립은 같은 사건이 아니다 — resume()은 비동기고, 컨텍스트 생성이
// 실패할 수도 있다. 호출 직후 무조건 떼면 그 한 번의 실패가 세션 전체의 영구 무음이 된다.
import { useEffect } from 'react';
import { isAudioRunning, isAudioUnsupported, unlockAudio } from './audioEngine';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export function useAudioUnlock(): void {
  useEffect(() => {
    const detach = () => {
      for (const g of GESTURES) document.removeEventListener(g, onGesture, true);
    };
    const onGesture = () => {
      unlockAudio();
      // 성공했거나(running) 재시도가 무의미한 환경(AudioContext 없음)일 때만 뗀다.
      // 그 외에는 리스너를 남겨 다음 제스처가 다시 시도하게 한다. 보통 두 번째
      // 제스처에서 running이 확인돼 떨어진다(첫 제스처 시점엔 resume이 아직 반영 전).
      if (isAudioRunning() || isAudioUnsupported()) detach();
    };
    for (const g of GESTURES) document.addEventListener(g, onGesture, true);
    return detach;
  }, []);
}
