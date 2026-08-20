import { useState } from 'react';
import { npcAlbum, isSlotFilled, filledPath, type AlbumSlot } from '../../engine/npcAlbum';
import { INITIAL_NPCS } from '../../engine/npcRoster';
import { webpSrc } from '../../engine/assetWebp';
import { Portrait } from '../Portrait';

const CELL = 44;
const cgUrl = (rel: string) => webpSrc(`${import.meta.env.BASE_URL}images/events/${rel}`);

/**
 * 인물 앨범 — 기록실에서 사람 줄을 누르면 목록을 대신해 열린다.
 *
 * 왜 아코디언(같은 화면에 펼치기)이 아닌가: 포화 상태의 지훈이 52칸이라, 다른 9명의 줄과
 * 결말·카운터 위에 그만큼이 얹히고 접으면 스크롤 위치를 잃는다. 목록을 **교체**하면
 * 기록실 목록은 항상 짧게 유지된다. 라우팅은 건드리지 않는다 — 부모의 상태 하나다.
 *
 * 왜 여기서는 "몇 개 중 몇 개"를 보여주나: 이 화면의 목적이 그것이다(프린세스메이커식 앨범).
 * 기록실 목록 쪽의 감춤 규약(#404)은 그대로다 — 앨범은 만난 사람의 줄 뒤에만 있으므로,
 * 만나지 않은 사람의 슬롯 지도는 여전히 열 수 없다.
 *
 * 그림은 **채운 칸만** 싣는다(빈 칸은 비용 0). 릴리즈 webp가 장당 105KB이므로 축소 썸네일이
 * 생기기 전까지는 이게 유일하게 감당되는 형태다 — 빈 칸까지 그림을 깔면 안 본 그림을
 * 받아오게 되므로 애초에 불가능하다.
 */
export function NpcAlbumScreen({ npcId, seenCgFiles, onBack }: {
  npcId: string;
  seenCgFiles: readonly string[];
  onBack: () => void;
}) {
  const [open, setOpen] = useState<AlbumSlot | null>(null);
  const npc = INITIAL_NPCS.find(n => n.id === npcId);
  const buckets = npcAlbum(npcId);
  const openPath = open ? filledPath(open, seenCgFiles) : null;

  return (
    <div className="screen fade-in" style={{ padding: '20px 16px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <Portrait characterId={npcId} size={40} expression="neutral" year={7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{npc?.name ?? npcId}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{npc?.description}</div>
        </div>
      </div>

      {buckets.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>남은 장면이 없다.</div>
      ) : buckets.map(b => {
        const filled = b.slots.filter(s => isSlotFilled(s, seenCgFiles)).length;
        const done = filled === b.slots.length;
        return (
          <section key={b.key} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{b.label}</span>
              <span style={{ fontSize: '0.72rem', color: done ? 'var(--gold)' : 'var(--text-muted)' }}>
                {filled} / {b.slots.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {b.slots.map(s => {
                const path = filledPath(s, seenCgFiles);
                if (!path) {
                  return (
                    <div
                      key={`${s.eventId}-${s.choiceIndex}-${s.level}`}
                      aria-label="아직 보지 않은 장면"
                      style={{
                        width: CELL, height: CELL, borderRadius: 6,
                        border: '1px dashed rgba(255,255,255,0.18)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    />
                  );
                }
                return (
                  <button
                    key={`${s.eventId}-${s.choiceIndex}-${s.level}`}
                    onClick={() => setOpen(s)}
                    title={s.title}
                    style={{
                      width: CELL, height: CELL, padding: 0, borderRadius: 6, overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.25)', background: 'none', cursor: 'pointer',
                    }}
                  >
                    <img
                      src={cgUrl(path)}
                      alt={s.title}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <button className="btn btn-secondary" onClick={onBack}>돌아가기</button>

      {open && openPath && (
        <div
          onClick={() => setOpen(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: 16, cursor: 'pointer',
          }}
        >
          {/* 조작 안내는 세계관 어투로 쓸 문장이 아니다("탭하면 닫힌다"는 사무적으로 읽힌다).
              문장을 지우고 컨트롤을 둔다 — 배경 어디를 눌러도 닫히는 동작은 그대로다. */}
          <button
            // stopPropagation은 장식이 아니다 — 없으면 배경의 닫기 핸들러가 버블링으로 대신
            // 처리해서 이 버튼의 핸들러를 지워도 화면이 똑같이 닫힌다(뮤테이션으로 확인).
            // 그러면 버튼이 자기 일을 하는지 아무도 확인할 수 없다.
            onClick={e => { e.stopPropagation(); setOpen(null); }}
            aria-label="닫기"
            style={{
              position: 'absolute', top: 12, right: 12, width: 36, height: 36,
              borderRadius: 18, border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.45)', color: 'var(--text-secondary)',
              fontSize: '1.1rem', lineHeight: 1, cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <img
            src={cgUrl(openPath)}
            alt={open.title}
            style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, textAlign: 'center' }}>{open.title}</div>
        </div>
      )}
    </div>
  );
}
