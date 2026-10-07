import { GameState } from '../../../engine/types';
import { BRIEFINGS } from './stageBriefings';

// 진학 브리핑 — 스테이지 전환 학년(Y2/Y5/Y7) 첫 2주간 "올해부터 달라지는 것"을 또렷이 고지.
// 엔진에 이미 있는 규칙 변화(examSystem 일정, activities 비용/해금, 주간 자연감쇠)의 노출 전용.
// 수치는 비공개 — 존재와 방향만 전달한다. 입학식 이벤트(school.ts)는 정서 담당, 규칙 고지는 이 카드 담당.
// 문구와 그 근거(claim)는 stageBriefings.ts가 SSOT — 문장을 바꾸면 claim도 같이 적어야 계약 테스트가 통과한다.

// W1~2 노출 — W1은 입학식 이벤트와 겹치므로 2주간 보여 최소 한 번은 온전히 읽히게 한다.
export function StageBriefingCard({ state }: { state: GameState }) {
  if (state.week > 2) return null;
  const briefing = BRIEFINGS[state.year];
  if (!briefing) return null;
  return (
    <div style={{
      background: 'rgba(125,163,217,0.12)',
      border: '1px solid rgba(125,163,217,0.35)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 10,
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>
        {briefing.title}
      </div>
      {briefing.lines.map(({ text }, i) => (
        <div key={i} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          · {text}
        </div>
      ))}
    </div>
  );
}
