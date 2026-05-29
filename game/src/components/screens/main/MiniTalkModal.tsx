import { useState, useEffect } from 'react';
import { MiniTalkEvent } from '../../../engine/talkSystem';
import { StatKey, STAT_LABELS } from '../../../engine/types';
import { STAT_ICONS } from '../shared';
import { Portrait } from '../../Portrait';

type Props = {
  result: MiniTalkEvent;
  year: number;
  // 오버레이 클릭 — 미니 결과만 닫고 하단 모달(NPC/가정)은 유지
  onDismiss: () => void;
  // 닫기 버튼 — 미니 결과 + 하단 모달까지 모두 닫기
  onCloseAll: () => void;
};

// 티어 파생: 명시적 tier 필드가 없으므로 memorySlotDraft.importance + intimacyMin 으로 추론.
//  90 = 결정적 코어(importance 5) / 70 = 속마음(메모리 슬롯 존재) / 50·30 = intimacyMin
function deriveTier(result: MiniTalkEvent): 30 | 50 | 70 | 90 {
  if (result.memorySlotDraft?.importance === 5) return 90;
  if (result.memorySlotDraft) return 70;
  return (result.intimacyMin ?? 30) >= 50 ? 50 : 30;
}

const HEADER: Record<number, { text: string; color: string }> = {
  30: { text: '💬 잠깐의 대화', color: 'var(--accent-soft)' },
  50: { text: '🤝 둘만 아는 일', color: 'var(--accent-soft)' },
  70: { text: '· 속마음 한 조각 ·', color: 'var(--gold)' },
  90: { text: '✨ 잊지 못할 순간', color: 'var(--gold)' },
};

// effects → 색상 배지. 변화량을 또렷이 보여주는 게 목적이라 전 티어 공통으로 노출.
// parentIntimacy 는 의도적으로 UI 미표시(숨겨진 부모 친밀도)라 제외.
function buildBadges(effects: MiniTalkEvent['effects']): { text: string; color: string; emphasize?: boolean }[] {
  const badges: { text: string; color: string; emphasize?: boolean }[] = [];
  if (effects.stats) {
    for (const [k, v] of Object.entries(effects.stats)) {
      const val = v as number;
      if (val !== 0) badges.push({
        text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`,
        color: val > 0 ? 'var(--green)' : 'var(--red)',
      });
    }
  }
  if (effects.fatigue) badges.push({
    text: `피로 ${effects.fatigue > 0 ? '+' : ''}${effects.fatigue}`,
    color: effects.fatigue > 0 ? 'var(--red)' : 'var(--green)',
  });
  if (effects.money) badges.push({
    text: `💰 ${effects.money > 0 ? '+' : ''}${effects.money}만`,
    color: effects.money > 0 ? 'var(--green)' : 'var(--red)',
  });
  // 친밀도는 관계 진척의 핵심이라 마지막 + 강조
  if (effects.intimacy) badges.push({
    text: `${effects.intimacy > 0 ? '♥' : '💔'} 친밀도 ${effects.intimacy > 0 ? '+' + effects.intimacy : effects.intimacy}`,
    color: effects.intimacy > 0 ? 'var(--blue)' : 'var(--red)',
    emphasize: true,
  });
  return badges;
}

export function MiniTalkModal({ result, year, onDismiss, onCloseAll }: Props) {
  const tier = deriveTier(result);
  const isMemory = tier >= 70;
  const header = HEADER[tier];
  const title = result.message.split(' — ')[0]; // 플레이버 제목(구분자 없으면 전체)
  const badges = buildBadges(result.effects);
  const portraitSize = isMemory ? 56 : 72;
  // 고티어는 더 느리게 — 등장 후 배지 reveal 시작도 늦춰 무게감을 준다.
  const baseDelay = isMemory ? 420 : 260;
  const step = isMemory ? 110 : 80;

  // tier90: 가장 무거운 순간이라 닫기를 잠깐 지연(반사적 스킵 방지).
  const [canClose, setCanClose] = useState(tier !== 90);
  useEffect(() => {
    if (tier === 90) {
      const t = setTimeout(() => setCanClose(true), 700);
      return () => clearTimeout(t);
    }
  }, [tier]);

  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 0', overflowY: 'auto', zIndex: 110,
    }}>
      <div
        onClick={e => e.stopPropagation()}
        className={isMemory ? 'mt-card mt-card--memory' : 'mt-card'}
        style={{
          background: isMemory
            ? 'linear-gradient(135deg, rgba(30,27,36,0.99), rgba(18,16,22,0.99))'
            : 'linear-gradient(135deg, rgba(42,34,48,0.98), rgba(23,21,28,0.98))',
          borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, textAlign: 'center',
          margin: 'auto', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
          border: isMemory ? '1px solid rgba(229,192,123,0.45)' : '1px solid rgba(224,138,91,0.4)',
        }}
      >
        <div style={{
          fontSize: '0.72rem', letterSpacing: '0.08em', color: header.color,
          fontWeight: 700, marginBottom: 12,
        }}>{header.text}</div>

        {result.npcId && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMemory ? 16 : 14 }}>
            <div style={{ opacity: isMemory ? 0.78 : 1, filter: isMemory ? 'grayscale(0.2)' : 'none' }}>
              <Portrait characterId={result.npcId} expression="neutral" size={portraitSize} year={year} />
            </div>
          </div>
        )}

        <div className={isMemory ? 'mt-fade' : undefined} style={{
          fontSize: isMemory ? '0.95rem' : '0.9rem', lineHeight: isMemory ? 1.85 : 1.7,
          whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'break-word',
          background: isMemory ? 'rgba(255,255,255,0.03)' : 'rgba(224,138,91,0.06)',
          borderRadius: 12, padding: isMemory ? '18px 18px' : '14px 16px',
        }}>{result.description}</div>

        {title && (
          <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
            {title}
          </div>
        )}

        {/* 관계 진척 프레이밍 — 고티어에서 수치 위에 의미를 얹는다 (수치 자체는 그대로 노출) */}
        {isMemory && (
          <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 600 }}>
            관계가 한 걸음 더 깊어졌어요
          </div>
        )}

        {/* 변화량 배지 — "조건이 변했다"를 또렷이. 전 티어 공통 + 스태거 등장 */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 10 }}>
            {badges.map((b, i) => (
              <div
                key={i}
                className="mt-badge"
                style={{
                  animationDelay: `${baseDelay + i * step}ms`,
                  background: b.emphasize ? 'rgba(125,163,217,0.16)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: b.emphasize ? '8px 16px' : '6px 12px',
                  fontSize: b.emphasize ? '0.95rem' : '0.82rem',
                  fontWeight: b.emphasize ? 700 : 600,
                  color: b.color,
                }}
              >{b.text}</div>
            ))}
          </div>
        )}

        {/* 회상 시스템 연계 — 앞을 가리키는 약속(졸업/엔딩에서 다시 떠오름) */}
        {isMemory && (
          <div
            className="mt-badge"
            style={{
              animationDelay: `${baseDelay + badges.length * step + 200}ms`,
              marginTop: 12, fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold)',
              background: 'rgba(229,192,123,0.13)', border: '1px solid rgba(229,192,123,0.3)',
              borderRadius: 8, padding: '8px 12px', lineHeight: 1.5,
            }}
          >{tier === 90
            ? '🌙 이 순간은 오래도록 남을 거예요'
            : '🌙 이 순간이 기억에 남았어요 — 언젠가 다시 떠오를 거예요'}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 18, width: '100%', opacity: canClose ? 1 : 0.5 }}
          disabled={!canClose}
          onClick={onCloseAll}
        >닫기</button>
      </div>
    </div>
  );
}
