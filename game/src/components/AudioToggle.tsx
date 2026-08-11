// 소리 켜기/끄기 토글 — 이 게임의 유일한 오디오 설정 진입점.
//
// 배치 원칙(memory: UI 절제는 크롬에만): 이건 크롬이므로 **조용해야 한다**.
// 고스트 톤 아이콘 버튼 하나로 두고, 켜짐 상태에서도 강조하지 않는다.
// 별도 설정 화면을 새로 만들지 않은 이유 — 현재 게임에 설정 화면 자체가 없고,
// 오디오 항목 하나 때문에 화면을 늘리면 그 자체가 절제 원칙에 어긋난다.
//
// 볼륨 슬라이더를 넣지 않은 것도 같은 이유다. 절차적 SFX는 이미 저음량으로 설계돼 있어
// 실사용 선택지는 "켠다/끈다"뿐이고, 세밀한 조절은 OS·브라우저 볼륨으로 충분하다.
// (엔진에는 setVolume이 있으므로 BGM이 들어오면 그때 슬라이더를 붙이면 된다.)
import { memo, useEffect, useState } from 'react';
import { getAudioSettings, setMuted, subscribeAudioSettings } from '../audio/audioEngine';
import { playSfx } from '../audio/sfx';

export const AudioToggle = memo(function AudioToggle({ style }: { style?: React.CSSProperties }) {
  const [muted, setMutedState] = useState(() => getAudioSettings().muted);

  useEffect(() => subscribeAudioSettings(s => setMutedState(s.muted)), []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    // 켜는 순간에만 소리로 확인시킨다 — 끄는 순간에 소리가 나면 앞뒤가 안 맞는다.
    if (!next) playSfx('tap');
  };

  return (
    <button
      type="button" className="btn-reset"
      onClick={toggle}
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
      aria-pressed={!muted}
      title={muted ? '소리 켜기' : '소리 끄기'}
      style={{
        fontSize: '0.8rem', lineHeight: 1, padding: 4, cursor: 'pointer',
        color: 'var(--text-secondary)',
        // 켜짐/꺼짐 차이는 아이콘 자체로 충분하다 — 색까지 바꾸면 크롬이 시끄러워진다.
        opacity: muted ? 0.5 : 0.85,
        ...style,
      }}
    >{muted ? '🔇' : '🔊'}</button>
  );
});
