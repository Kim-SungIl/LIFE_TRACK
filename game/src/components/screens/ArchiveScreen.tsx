import { loadArchive } from '../../engine/archive';
import { isBarelyTouched, npcStoryRows } from '../../engine/npcStoryPool';
import { Portrait } from '../Portrait';

// 관계 패널의 색 언어를 그대로 쓴다 — 많이 본 쪽이 골드.
function coverageColor(ratio: number): string {
  if (ratio >= 0.8) return '#e5c07b';
  if (ratio >= 0.4) return '#8fb573';
  if (ratio > 0) return '#8a8078';
  return 'rgba(255,255,255,0.2)';
}

/**
 * 기록실 — 여러 판에 걸친 흔적. 타이틀 화면에서 진입한다.
 *
 * 사람 줄에만 분모를 둔다. NPC별 이벤트 수는 정의에서 정확히 셀 수 있고(reach.npc·speakers),
 * 그게 이 게임에서 판을 가르는 유일한 축이기 때문이다 — 첫 판(공부형) 실측에서 서아 1/9,
 * 시우 1/8, 예린 1/6로 남는다. 반대로 엔딩·전체 이벤트에는 분모를 두지 않는다:
 * 엔딩 타이틀은 진로에 수식어가 붙는 조합이라 고정 목록이 없고, 없는 총계를 만들면
 * 달성률 게임이 된다.
 */
export function ArchiveScreen({ onBack }: { onBack: () => void }) {
  const archive = loadArchive();
  const rows = npcStoryRows(archive.events);
  const barelyCount = rows.filter(isBarelyTouched).length;

  return (
    <div className="screen fade-in" style={{ padding: '20px 16px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>기록실</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        {archive.runs > 0 ? `지금까지 ${archive.runs}번의 학창시절` : '아직 끝까지 간 학창시절이 없다'}
      </div>

      <section style={{ marginBottom: 22 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>👥 함께한 사람들</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          그 사람과 얽힌 이야기를 얼마나 봤는지
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const faded = r.seen === 0;
            const color = coverageColor(r.ratio);
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px',
                opacity: faded ? 0.45 : 1,
              }}>
                <div style={{ filter: faded ? 'grayscale(1)' : 'none', flexShrink: 0, display: 'flex' }}>
                  <Portrait characterId={r.id} size={34} expression="neutral" year={7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{r.name}</div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(r.ratio * 100)}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color, whiteSpace: 'nowrap', width: 46, textAlign: 'right', flexShrink: 0 }}>
                  {r.seen} / {r.total}
                </span>
              </div>
            );
          })}
        </div>
        {barelyCount > 0 && (
          <div style={{ fontSize: '0.76rem', color: 'var(--accent-soft)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.6 }}>
            거의 스치기만 한 이름이 있다. 그 사람의 이야기는 그 학년에 곁에 있어야만 열린다.
          </div>
        )}
      </section>

      <section style={{ marginBottom: 22 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>
          🎓 도달한 결말 <span style={{ color: 'var(--gold)' }}>{archive.endings.length}</span>
        </div>
        {archive.endings.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>아직 없다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {archive.endings.map(t => (
              <div key={t} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>· {t}</div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>본 이야기</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{archive.events.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>나눈 대화</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{archive.talks.length}</div>
          </div>
        </div>
      </section>

      <button className="btn btn-secondary" onClick={onBack}>돌아가기</button>
    </div>
  );
}
