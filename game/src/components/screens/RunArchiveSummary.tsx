import { loadArchive, type RunDelta } from '../../engine/archive';
import { barelyTouchedNames } from '../../engine/npcStoryPool';

interface Props {
  // 이번 판의 적립 결과. 엔딩 화면에서 새로고침하면 null이 되므로(전이 시점에만 계산된다)
  // 그때는 누적 기록만으로 이정표를 그린다.
  runDelta: RunDelta | null;
}

/**
 * 엔딩 화면 하단 — 이번 판이 기록에 무엇을 더했는지, 그리고 다음 판의 이정표.
 *
 * 왜 사람 이름을 가리키나 (실측):
 *   같은 방식으로 한 판 더 하면 새로 보이는 이야기가 1~5개뿐인데, 키우는 방식을 바꾸면 +72개가
 *   열린다. 그 72개의 92%가 NPC와 얽힌 이벤트다. 그래서 "다른 길은 어땠을까?"라는 막연한 문구
 *   대신, 실제로 남아 있는 것을 사람 이름으로 가리킨다.
 *
 * 왜 "안 만난 사람"이 아니라 "거의 못 본 사람"인가:
 *   7년이면 어떤 빌드로도 10명 전원을 만나고 전원이 절친이 된다. 안 본 건 관계가 아니라
 *   그 사람의 이야기다(도달형 이벤트는 학년으로 게이트돼 그 학년이 지나면 다시 안 열린다).
 */
export function RunArchiveSummary({ runDelta }: Props) {
  const archive = loadArchive();
  const barely = barelyTouchedNames(archive.events);
  const newEvents = runDelta?.newEvents ?? 0;
  const runs = runDelta?.runs ?? archive.runs;

  // 첫 완주에 "처음 본 이야기 121개"는 의미가 없다(전부 처음이다) — 2회차부터 보여준다.
  const showNew = runs > 1 && newEvents > 0;

  if (!showNew && barely.length === 0) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--accent-soft)', marginBottom: 16, textAlign: 'center', fontStyle: 'italic' }}>
        다른 길은 어땠을까?
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px', margin: '0 auto 16px', maxWidth: 360,
    }}>
      {showNew && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: barely.length ? 12 : 0 }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>이번 판에서 처음 본 이야기</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)' }}>{newEvents}</span>
        </div>
      )}

      {barely.length > 0 && (
        <>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            스치기만 하고 지나간 사람
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {barely.join(' · ')}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--accent-soft)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.6 }}>
            그때 곁에 있었어야만 열리는 이야기가 있다.
          </div>
        </>
      )}
    </div>
  );
}
