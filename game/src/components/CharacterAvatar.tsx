// CSS 기반 캐릭터 아바타 — 나중에 AI 일러스트로 교체할 플레이스홀더

interface Props {
  size?: number;
  expression?: 'happy' | 'neutral' | 'sad' | 'angry' | 'tired' | 'burnout' | 'surprised' | 'shy';
  hair?: string;      // 머리 색상
  skin?: string;      // 피부 색상
  accent?: string;    // 악센트 색상 (교복 등)
  label?: string;     // 이름 표시
  isNpc?: boolean;
}

export function CharacterAvatar({
  size = 80,
  expression = 'neutral',
  hair = '#2c2c3e',
  skin = '#fdd5b1',
  accent = '#3b5998',
  label,
  isNpc = false,
}: Props) {
  const s = size;
  const eyeSize = s * 0.08;
  const mouthW = s * 0.18;

  // 표정별 눈/입
  const eyes: Record<string, React.ReactNode> = {
    happy: (
      <>
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 0.7, borderBottom: `${eyeSize * 0.5}px solid #333`, borderRadius: '0 0 50% 50%', transform: 'scaleY(-1)' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 0.7, borderBottom: `${eyeSize * 0.5}px solid #333`, borderRadius: '0 0 50% 50%', transform: 'scaleY(-1)' }} />
      </>
    ),
    neutral: (
      <>
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%' }} />
      </>
    ),
    sad: (
      <>
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%', transform: 'translateY(2px)' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%', transform: 'translateY(2px)' }} />
      </>
    ),
    angry: (
      <>
        <div style={{ width: eyeSize * 1.2, height: eyeSize, background: '#333', borderRadius: '50%', transform: 'rotate(-10deg)' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize * 1.2, height: eyeSize, background: '#333', borderRadius: '50%', transform: 'rotate(10deg)' }} />
      </>
    ),
    tired: (
      <>
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 0.5, background: '#555', borderRadius: '50%' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 0.5, background: '#555', borderRadius: '50%' }} />
      </>
    ),
    burnout: (
      <>
        <div style={{ width: eyeSize, height: 2, background: '#666', borderRadius: 1 }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize, height: 2, background: '#666', borderRadius: 1 }} />
      </>
    ),
    surprised: (
      <>
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 1.5, background: '#333', borderRadius: '50%' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize * 1.3, height: eyeSize * 1.5, background: '#333', borderRadius: '50%' }} />
      </>
    ),
    shy: (
      <>
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%', transform: 'translateX(2px)' }} />
        <div style={{ width: s * 0.12 }} />
        <div style={{ width: eyeSize, height: eyeSize * 1.2, background: '#333', borderRadius: '50%', transform: 'translateX(-2px)' }} />
      </>
    ),
  };

  const mouths: Record<string, React.ReactNode> = {
    happy: <div style={{ width: mouthW, height: mouthW * 0.5, borderBottom: `2px solid #c0392b`, borderRadius: '0 0 50% 50%' }} />,
    neutral: <div style={{ width: mouthW * 0.7, height: 2, background: '#c0392b', borderRadius: 1 }} />,
    sad: <div style={{ width: mouthW, height: mouthW * 0.4, borderTop: `2px solid #c0392b`, borderRadius: '50% 50% 0 0' }} />,
    angry: <div style={{ width: mouthW * 0.5, height: 2, background: '#c0392b', borderRadius: 1, transform: 'rotate(-5deg)' }} />,
    tired: <div style={{ width: mouthW * 0.6, height: mouthW * 0.3, borderTop: `2px solid #999`, borderRadius: '50% 50% 0 0' }} />,
    burnout: <div style={{ width: mouthW * 0.4, height: 2, background: '#999', borderRadius: 1 }} />,
    surprised: <div style={{ width: mouthW * 0.4, height: mouthW * 0.5, background: 'transparent', border: '2px solid #c0392b', borderRadius: '50%' }} />,
    shy: <div style={{ width: mouthW * 0.5, height: mouthW * 0.3, borderBottom: `2px solid #c0392b`, borderRadius: '0 0 50% 50%' }} />,
  };

  // 볼터치 (happy, shy)
  const showBlush = expression === 'happy' || expression === 'shy';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: s, height: s * 1.1,
        position: 'relative',
        filter: expression === 'burnout' ? 'grayscale(0.6) brightness(0.8)' : 'none',
      }}>
        {/* 머리카락 */}
        <div style={{
          position: 'absolute', top: 0, left: s * 0.1, width: s * 0.8, height: s * 0.55,
          background: hair, borderRadius: `${s * 0.4}px ${s * 0.4}px ${s * 0.1}px ${s * 0.1}px`,
        }} />

        {/* 얼굴 */}
        <div style={{
          position: 'absolute', top: s * 0.2, left: s * 0.15, width: s * 0.7, height: s * 0.7,
          background: skin, borderRadius: `${s * 0.3}px ${s * 0.3}px ${s * 0.35}px ${s * 0.35}px`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingTop: s * 0.1,
        }}>
          {/* 눈 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: s * 0.06 }}>
            {eyes[expression]}
          </div>

          {/* 볼터치 */}
          {showBlush && (
            <div style={{ display: 'flex', gap: s * 0.22, marginBottom: -s * 0.02 }}>
              <div style={{ width: s * 0.08, height: s * 0.04, background: '#ffb3b3', borderRadius: '50%', opacity: 0.6 }} />
              <div style={{ width: s * 0.08, height: s * 0.04, background: '#ffb3b3', borderRadius: '50%', opacity: 0.6 }} />
            </div>
          )}

          {/* 입 */}
          <div style={{ marginTop: s * 0.02 }}>
            {mouths[expression]}
          </div>
        </div>

        {/* 교복 (상단만) */}
        <div style={{
          position: 'absolute', bottom: 0, left: s * 0.1, width: s * 0.8, height: s * 0.25,
          background: accent, borderRadius: `0 0 ${s * 0.15}px ${s * 0.15}px`,
        }}>
          {/* 칼라 */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: s * 0.25, height: s * 0.08,
            background: 'white', borderRadius: `0 0 ${s * 0.05}px ${s * 0.05}px`,
          }} />
        </div>
      </div>

      {label && (
        <div style={{
          fontSize: s * 0.15, fontWeight: 600,
          color: isNpc ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// NPC별 외형 설정
export const NPC_APPEARANCES: Record<string, { hair: string; skin: string; accent: string }> = {
  player_m: { hair: '#2c2c3e', skin: '#fdd5b1', accent: '#3b5998' },  // 남주: 검은 단발
  player_f: { hair: '#3a2218', skin: '#fde0c8', accent: '#3b5998' },  // 여주: 갈색 긴 머리
  jihun: { hair: '#2c2c3e', skin: '#fdd5b1', accent: '#3b5998' },
  subin: { hair: '#4a3728', skin: '#fde0c8', accent: '#3b5998' },
  minjae: { hair: '#1a1a2e', skin: '#f5c7a1', accent: '#3b5998' },
  yuna: { hair: '#8B6914', skin: '#fde0c8', accent: '#3b5998' },  // 밝은 갈색 머리 (이미지 교환)
  haeun: { hair: '#2c1810', skin: '#fde8d0', accent: '#3b5998' },  // 어두운 갈색 머리 (이미지 교환)
};

// 멘탈 상태 → 표정 매핑
export function mentalToExpression(mental: number, mentalState: string): Props['expression'] {
  if (mentalState === 'burnout') return 'burnout';
  if (mentalState === 'tired') return 'tired';
  if (mental >= 80) return 'happy';
  if (mental >= 60) return 'neutral';
  if (mental >= 40) return 'neutral';
  if (mental >= 25) return 'sad';
  return 'tired';
}
