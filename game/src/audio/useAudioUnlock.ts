// 첫 사용자 제스처에서 오디오를 해제한다.
//
// 브라우저 자동재생 정책상 AudioContext는 사용자 제스처 없이는 running이 되지 않는다.
// 개별 버튼마다 unlockAudio()를 부르면 빠뜨리는 곳이 생기므로, 문서 레벨에서 한 번만 잡는다.
//
// capture: true — 앱이 stopPropagation을 쓰는 곳이 있어도 해제는 반드시 통과시킨다.
// once 대신 수동 해제를 쓰는 이유: pointerdown/keydown/touchend 중 **먼저 오는 것 하나**로
// 끝내야 하는데, once는 이벤트 종류별로 각각 한 번씩 남아 나머지가 계속 붙어 있게 된다.
import { useEffect } from 'react';
import { unlockAudio } from './audioEngine';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export function useAudioUnlock(): void {
  useEffect(() => {
    const onGesture = () => {
      unlockAudio();
      for (const g of GESTURES) document.removeEventListener(g, onGesture, true);
    };
    for (const g of GESTURES) document.addEventListener(g, onGesture, true);
    return () => { for (const g of GESTURES) document.removeEventListener(g, onGesture, true); };
  }, []);
}
