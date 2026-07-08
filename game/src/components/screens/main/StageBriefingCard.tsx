import { GameState } from '../../../engine/types';

// 진학 브리핑 — 스테이지 전환 학년(Y2/Y5/Y7) 첫 2주간 "올해부터 달라지는 것"을 또렷이 고지.
// 엔진에 이미 있는 규칙 변화(examSystem 일정, activities 비용/해금, 주간 자연감쇠)의 노출 전용.
// 수치는 비공개 — 존재와 방향만 전달한다. 입학식 이벤트(school.ts)는 정서 담당, 규칙 고지는 이 카드 담당.
const BRIEFINGS: Record<number, { title: string; lines: string[] }> = {
  2: {
    title: '🏫 중학교에서 달라지는 것',
    lines: [
      '시험이 1년에 4번 — 중간·기말 각 2번',
      '성적표에 등급과 등수가 나온다',
      '컨디션이 나쁜 채로 시험을 보면 실력이 안 나온다',
      '손을 놓으면 배운 걸 더 빨리 잊는다',
    ],
  },
  5: {
    title: '🎓 고등학교에서 달라지는 것',
    lines: [
      '전국 모의고사까지, 시험이 1년에 6번',
      '성적 유지가 훨씬 어렵다 — 특히 방학이 무섭다',
      '과외가 열렸고, 알바 시급이 올랐다',
      '학원비도 한 단계 더 올랐다',
    ],
  },
  7: {
    title: '⏳ 고3 — 마지막 해',
    lines: [
      '2학기 W35, 수능이 기다린다',
      '모의고사 2번이 마지막 리허설',
      '컨디션 관리가 그 어느 때보다 중요하다',
    ],
  },
};

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
      {briefing.lines.map((line, i) => (
        <div key={i} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          · {line}
        </div>
      ))}
    </div>
  );
}
