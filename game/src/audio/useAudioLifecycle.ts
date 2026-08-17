// 탭을 떠나면 오디오를 재우고, 돌아오면 깨운다.
//
// v8.3까지 이 배선은 아예 없었다. 단발 효과음만 있을 땐 티가 안 났지만 — 짧아서 백그라운드에
// 걸릴 일이 드물다 — 지속음(BGM)이 들어오는 순간 바로 드러나는 공백이다: 탭을 옮겨도 계속 흐르고,
// 창을 여러 개 열면 서로 겹쳐 울린다.
//
// **두 계열을 다 듣는 이유**가 이 파일의 핵심이다. 하나로는 안 덮인다:
// - `visibilitychange` — 탭 전환·창 최소화. 데스크톱의 주된 경로.
// - `pagehide`/`pageshow` — 페이지를 떠나거나 bfcache에서 되살아날 때. iOS 사파리는 앱 전환·
//   화면 잠금에서 visibilitychange를 주지 않는 경우가 있어, 이걸 빼면 모바일에서 계속 울린다.
//   반대로 bfcache 복귀는 pageshow만 오고 visibilitychange가 안 오기도 한다.
//
// 겹쳐 불리는 건 문제가 되지 않는다 — suspend/resume 양쪽 다 현재 상태를 먼저 보고 필요할 때만 움직인다.
//
// document/window를 나눠 거는 것도 의도다. visibilitychange는 document 이벤트고,
// pagehide/pageshow는 window 이벤트다(document에 걸면 브라우저에 따라 안 온다).
import { useEffect } from 'react';
import { resumeAudioFromBackground, suspendAudioForBackground } from './audioEngine';

export function useAudioLifecycle(): void {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') suspendAudioForBackground();
      else resumeAudioFromBackground();
    };
    const onHide = () => suspendAudioForBackground();
    const onShow = () => resumeAudioFromBackground();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
}
