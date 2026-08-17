// 소리 켜기/끄기 토글 — 이 게임의 유일한 오디오 설정 진입점.
//
// 배치 원칙(memory: UI 절제는 크롬에만): 이건 크롬이므로 **조용해야 한다**.
// 고스트 톤 아이콘 버튼 하나로 두고, 켜짐 상태에서도 강조하지 않는다.
// 별도 설정 화면을 새로 만들지 않은 이유 — 현재 게임에 설정 화면 자체가 없고,
// 오디오 항목 하나 때문에 화면을 늘리면 그 자체가 절제 원칙에 어긋난다.
//
// 볼륨 슬라이더는 여전히 넣지 않는다. 절차적 SFX·BGM 모두 저음량으로 설계돼 있어 실사용
// 선택지는 "켠다/끈다"뿐이고, 세밀한 조절은 OS·브라우저 볼륨으로 충분하다. 슬라이더 두 개를
// 붙이면 크롬 하나 때문에 헤더가 설정 화면이 된다. (엔진에 setVolume/setBgmVolume은 있다.)
//
// **버튼이 둘인 이유**: 음소거는 전체(효과음+배경음)이고 배경음은 그 안의 선택이라, 하나로
// 합치면 "효과음만 켜기"가 불가능해진다. 지속음을 싫어하지만 효과음은 원하는 경우가 흔하다.
// 배경음은 기본 꺼짐이라 대부분의 사용자에게 이 버튼은 흐린 상태로 남는다.
import { memo, useEffect, useState } from 'react';
import {
  getAudioSettings, setMuted, setBgmEnabled, subscribeAudioSettings,
} from '../audio/audioEngine';
import { playSfx } from '../audio/sfx';

const ICON_STYLE: React.CSSProperties = {
  fontSize: '0.8rem', lineHeight: 1, padding: 4, cursor: 'pointer',
  color: 'var(--text-secondary)',
};

export const AudioToggle = memo(function AudioToggle({ style }: { style?: React.CSSProperties }) {
  const [muted, setMutedState] = useState(() => getAudioSettings().muted);
  const [bgmOn, setBgmOn] = useState(() => getAudioSettings().bgmEnabled);

  useEffect(() => subscribeAudioSettings(s => {
    setMutedState(s.muted);
    setBgmOn(s.bgmEnabled);
  }), []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    // 켜는 순간에만 소리로 확인시킨다 — 끄는 순간에 소리가 나면 앞뒤가 안 맞는다.
    if (!next) playSfx('tap');
  };

  // 배경음은 켜는 순간 스스로 들리므로 확인용 효과음을 따로 내지 않는다.
  const toggleBgm = () => setBgmEnabled(!bgmOn);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, ...style }}>
      <button
        type="button" className="btn-reset"
        onClick={toggleMute}
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={!muted}
        title={muted ? '소리 켜기' : '소리 끄기'}
        // 켜짐/꺼짐 차이는 아이콘 자체로 충분하다 — 색까지 바꾸면 크롬이 시끄러워진다.
        style={{ ...ICON_STYLE, opacity: muted ? 0.5 : 0.85 }}
      >{muted ? '🔇' : '🔊'}</button>
      <button
        type="button" className="btn-reset"
        onClick={toggleBgm}
        aria-label={bgmOn ? '배경음 끄기' : '배경음 켜기'}
        aria-pressed={bgmOn}
        title={bgmOn ? '배경음 끄기' : '배경음 켜기'}
        // 음소거면 배경음도 안 들리므로 조작할 의미가 없다.
        disabled={muted}
        style={{
          ...ICON_STYLE,
          opacity: muted ? 0.25 : (bgmOn ? 0.85 : 0.4),
          cursor: muted ? 'default' : 'pointer',
        }}
      >🎵</button>
    </span>
  );
});
