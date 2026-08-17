// 배경음을 현실에 맞추는 훅.
//
// 얇은 래퍼지만 따로 두는 이유가 있다: 재생을 켜고 끄는 주체가 **컴포넌트 수명에 묶여야**
// 한다. App이 살아 있는 동안만 구독하고, 언마운트하면 구독을 뗀다.
// 판단 로직은 전부 bgm.ts가 갖는다(여기서 조건을 다시 쓰면 두 곳이 어긋난다).
import { useEffect } from 'react';
import { syncBgmWithSettings } from './bgm';

export function useBgm(): void {
  useEffect(() => syncBgmWithSettings(), []);
}
