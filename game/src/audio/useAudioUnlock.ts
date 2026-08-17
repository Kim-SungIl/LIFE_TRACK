// 첫 사용자 제스처에서 오디오를 해제하고, 그 뒤 오디오의 수명을 관리한다.
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
//
// **탭 수명 관리는 배경음이 생기면서 필요해졌다.** 일회음만 있던 시절에는 탭을 떠나면 자연히
// 조용해졌다(소리가 상호작용에만 울리므로). 지속음은 그렇지 않아서, 떠날 때 명시적으로 끊고
// 돌아올 때 다시 켜야 한다. 안 그러면 다른 탭에서 작업하는 내내 음악이 흐른다.
import { useEffect } from 'react';
import { isAudioRunning, isAudioUnsupported, unlockAudio } from './audioEngine';
import { startBgm, syncBgmWithSettings } from './bgm';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export function useAudioUnlock(): void {
  useEffect(() => {
    const detach = () => {
      for (const g of GESTURES) document.removeEventListener(g, onGesture, true);
    };
    const onGesture = () => {
      unlockAudio();
      // 해제 직후 배경음을 켤 기회를 준다 — 설정이 켜져 있으면 여기가 첫 시작점이다.
      // (설정 구독은 컨텍스트가 없던 시점에 이미 한 번 시도해 실패했을 수 있다.)
      startBgm();
      // 성공했거나(running) 재시도가 무의미한 환경(AudioContext 없음)일 때만 뗀다.
      // 그 외에는 리스너를 남겨 다음 제스처가 다시 시도하게 한다. 보통 두 번째
      // 제스처에서 running이 확인돼 떨어진다(첫 제스처 시점엔 resume이 아직 반영 전).
      if (isAudioRunning() || isAudioUnsupported()) detach();
    };
    for (const g of GESTURES) document.addEventListener(g, onGesture, true);
    return detach;
  }, []);

  // 설정(음소거·배경음 켜짐) 변화를 배경음에 반영하는 주체. 이 구독이 없으면 음소거를 풀어도
  // 배경음을 다시 켜주는 사람이 없다 — 지속음에서 가장 빠지기 쉬운 배선이다.
  useEffect(() => syncBgmWithSettings(), []);

  // 탭 이탈/복귀는 여기서 다루지 않는다 — useAudioLifecycle이 유일한 주인이다.
  // (#393과 이 브랜치가 각자 수명 처리기를 만들어 둘 다 돌던 것을 한쪽으로 모았다.)
}
