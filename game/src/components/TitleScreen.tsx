import { useState } from 'react';
import { ParentStrength } from '../engine/types';
import { useGameStore } from '../engine/store';
import { loadFromStorage } from '../engine/store';
import { Portrait } from './Portrait';

// 부모 선택 = 어린 시절 기억 장면
const MEMORIES: { id: ParentStrength; scene: string; detail: string; icon: string }[] = [
  {
    id: 'wealth',
    icon: '🏠',
    scene: '넓은 아파트, 냉장고에 항상 가득한 간식',
    detail: '학원차가 매일 데리러 왔고, 용돈 걱정은 해본 적이 없었다.',
  },
  {
    id: 'info',
    icon: '📱',
    scene: '"엄마가 알아봤는데, 이 학원이 좋대"',
    detail: '엄마는 항상 뭔가를 조사하고 계셨다. 좋은 학원, 좋은 선생님, 좋은 방법.',
  },
  {
    id: 'gene',
    icon: '⭐',
    scene: '"너는 원래 잘하잖아"',
    detail: '공부를 크게 안 해도 성적이 나쁘지 않았고, 달리기도 반에서 빠른 편이었다.',
  },
  {
    id: 'emotional',
    icon: '🫂',
    scene: '"오늘 학교 어땠어?" 매일 저녁 식탁에서',
    detail: '시험을 못 봐도 혼나지 않았다. 대신 "괜찮아, 다음에" 라는 말을 들었다.',
  },
  {
    id: 'freedom',
    icon: '🌿',
    scene: '"알아서 해, 믿으니까"',
    detail: '부모님은 간섭하지 않았다. 자유로웠지만, 뭘 해야 할지는 스스로 찾아야 했다.',
  },
  {
    id: 'strict',
    icon: '📐',
    scene: '"공부 먼저, 놀기는 나중에"',
    detail: '매일 정해진 시간에 책상에 앉았다. 힘들었지만, 습관은 확실히 잡혔다.',
  },
];

type Phase = 'title' | 'intro' | 'gender' | 'select';
type Gender = 'male' | 'female';

export function TitleScreen() {
  const [phase, setPhase] = useState<Phase>('title');
  const [gender, setGender] = useState<Gender | null>(null);
  const [selected, setSelected] = useState<ParentStrength[]>([]);
  const [useReducedRecovery, setUseReducedRecovery] = useState(false); // M6: 도전 모드
  const startGame = useGameStore(s => s.startGame);
  const loadSavedGame = useGameStore(s => s.loadSavedGame);
  const savedData = loadFromStorage();

  const toggle = (id: ParentStrength) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    }
  };

  const handleStart = () => {
    if (selected.length === 2 && gender) {
      startGame(gender, selected as [ParentStrength, ParentStrength], { useReducedRecovery });
    }
  };

  // 타이틀 화면
  if (phase === 'title') {
    return (
      <div className="title-screen fade-in">
        {/* 남녀 캐릭터 나란히 */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 32, alignItems: 'flex-end' }}>
          <Portrait characterId="player_m" size={100} expression="neutral" year={1} />
          <Portrait characterId="player_f" size={100} expression="neutral" year={1} />
        </div>

        <div className="title-logo">LIFE TRACK</div>
        <div className="title-sub">선택의 결과</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 40, lineHeight: 1.6 }}>
          초등학교 6학년부터 고등학교 3학년까지.<br />
          7년간의 선택이 인생을 만든다.
        </div>
        {savedData && (
          <>
            <button
              className="btn btn-primary"
              style={{ maxWidth: 280, marginBottom: 10 }}
              onClick={() => loadSavedGame()}
            >
              이어하기 — {savedData.state.year}년차 {savedData.state.week}주차
            </button>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              {new Date(savedData.savedAt).toLocaleString('ko-KR')} 저장됨
            </div>
          </>
        )}
        <button
          className="btn btn-primary"
          style={{ maxWidth: 280, ...(savedData ? { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' } : {}) }}
          onClick={() => setPhase('gender')}
        >
          새 게임
        </button>
      </div>
    );
  }

  // 인트로 — 감정 도입
  if (phase === 'intro') {
    return (
      <div className="screen fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            어렴풋한 기억
          </div>

          <div style={{
            fontSize: '1.1rem', lineHeight: 2, color: 'var(--text-primary)',
            marginBottom: 32,
          }}>
            눈을 감으면 떠오르는 것들이 있다.<br /><br />
            저녁 식탁의 냄새,<br />
            학원 차를 기다리던 교문 앞,<br />
            "잘 다녀와" 하던 목소리.<br /><br />
            <span style={{ color: 'var(--accent-soft)' }}>
              우리 집은 어떤 곳이었을까?
            </span>
          </div>

          <button className="btn btn-primary" onClick={() => setPhase('select')}>
            기억을 더듬어본다
          </button>
        </div>
      </div>
    );
  }

  // 성별 선택
  if (phase === 'gender') {
    return (
      <div className="screen fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '1.1rem', marginBottom: 32, color: 'var(--text-secondary)' }}>
            주인공을 선택해주세요
          </div>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <div
              onClick={() => { setGender('male'); setPhase('intro'); }}
              style={{
                width: 200, padding: '28px 20px 22px', borderRadius: 20,
                background: 'var(--bg-card)',
                border: '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--blue)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
            >
              <Portrait characterId="player_m" size={140} expression="neutral" year={1} />
            </div>

            <div
              onClick={() => { setGender('female'); setPhase('intro'); }}
              style={{
                width: 200, padding: '28px 20px 22px', borderRadius: 20,
                background: 'var(--bg-card)',
                border: '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
            >
              <Portrait characterId="player_f" size={140} expression="neutral" year={1} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 부모 선택 — 기억 장면으로
  return (
    <div className="screen fade-in">
      <div style={{ textAlign: 'center', marginBottom: 8, marginTop: 12 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          어릴 적 기억 속, 우리 집은...
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 4 }}>
          가장 선명한 기억 <span style={{ color: 'var(--accent)' }}>2가지</span>를 골라주세요
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {MEMORIES.map(m => {
          const isSelected = selected.includes(m.id);
          return (
            <div
              key={m.id}
              onClick={() => toggle(m.id)}
              style={{
                background: isSelected ? 'rgba(224,138,91,0.14)' : 'var(--bg-card)',
                border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.3rem' }}>{m.icon}</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {m.scene}
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 34 }}>
                {m.detail}
              </div>
              {isSelected && (
                <div style={{
                  fontSize: '0.68rem', color: 'var(--accent-soft)',
                  marginTop: 6, paddingLeft: 34,
                }}>
                  ✓ 선택됨
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 선택 요약 + 시작 */}
      <div style={{ position: 'sticky', bottom: 0, paddingBottom: 20, paddingTop: 12, background: 'var(--bg-primary)' }}>
        {selected.length === 2 && (
          <div style={{
            textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)',
            marginBottom: 10, lineHeight: 1.5, fontStyle: 'italic',
          }}>
            "{MEMORIES.find(m => m.id === selected[0])?.scene}"<br />
            그리고 "{MEMORIES.find(m => m.id === selected[1])?.scene}"<br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              그런 집이었다.
            </span>
          </div>
        )}

        {/* M6: 도전 모드 토글 */}
        {selected.length === 2 && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.78rem', color: 'var(--text-secondary)',
            marginBottom: 10, padding: '8px 12px',
            background: 'rgba(224,138,91,0.06)', borderRadius: 10,
            border: '1px solid rgba(224,138,91,0.2)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={useReducedRecovery}
              onChange={e => setUseReducedRecovery(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>
              <strong style={{ color: 'var(--accent)' }}>도전 모드</strong> — 자연 회복 감소.
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> 피로를 더 쉽게 느끼고, 상점·관계에 의지해야 한다.</span>
            </span>
          </label>
        )}

        <button
          className="btn btn-primary"
          disabled={selected.length !== 2}
          onClick={handleStart}
        >
          {selected.length < 2
            ? `기억을 더 떠올려보자 (${selected.length}/2)`
            : '그래, 그런 집이었지'
          }
        </button>
      </div>
    </div>
  );
}
