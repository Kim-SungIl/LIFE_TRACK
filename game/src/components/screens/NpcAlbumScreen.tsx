import { useState } from 'react';
import { albumFor, isSlotFilled, filledPath, dominantGender, type AlbumSlot } from '../../engine/npcAlbum';
import { INITIAL_NPCS } from '../../engine/npcRoster';
import { SOLO_ROOT } from '../../engine/npcStoryPool';
import type { Gender } from '../../engine/types';
import { webpSrc } from '../../engine/assetWebp';
import { Portrait } from '../Portrait';

const CELL = 44;
const TABS: { gender: Gender; label: string; portrait: string }[] = [
  { gender: 'male', label: '남자 주인공', portrait: 'player_m' },
  { gender: 'female', label: '여자 주인공', portrait: 'player_f' },
];
const cgUrl = (rel: string) => webpSrc(`${import.meta.env.BASE_URL}images/events/${rel}`);
// 사람이 없는 뿌리의 얼굴 자리 — 초상 대신 엠블럼을 쓴다(YearEndScreen이 쓰는 자산과 같은 것).
const SOLO_EMBLEM = webpSrc(`${import.meta.env.BASE_URL}images/emblems/growth.png`);

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
 *
 * 판본(남주/여주)은 탭으로 가른다. 같은 칸 배치를 판본별로 따로 세는 것이고, 아직 해보지 않은
 * 판본은 전부 빈 칸으로 열린다 — 빈 칸을 드러내는 것이 이 화면의 규약이므로(#405) 일관된다.
 * 칸을 좌우로 두 개씩 놓는 안은 버렸다: 지훈이 92칸이 되어 스크롤이 두 배가 되고, 한 판본만
 * 해본 사람에게는 한 칸씩 건너 영구히 빈 칸이 되어 "고장난 앨범"으로 읽힌다.
 */
export function NpcAlbumScreen({ npcId, seenCgFiles, onBack }: {
  npcId: string;
  seenCgFiles: readonly string[];
  onBack: () => void;
}) {
  const [open, setOpen] = useState<AlbumSlot | null>(null);
  // 첫 탭은 실제로 더 많이 모은 판본. 탭을 바꾸는 순간부터는 사용자 선택이 이긴다.
  const [gender, setGender] = useState<Gender>(() => dominantGender(seenCgFiles));
  const solo = npcId === SOLO_ROOT;
  const npc = INITIAL_NPCS.find(n => n.id === npcId);
  const buckets = albumFor(npcId, gender);
  const openPath = open ? filledPath(open, seenCgFiles, gender) : null;

  return (
    <div className="screen fade-in" style={{ padding: '20px 16px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          {solo ? (
            <img
              src={SOLO_EMBLEM}
              alt="혼자 지나온 것"
              style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <Portrait characterId={npcId} size={40} expression="neutral" year={7} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            {solo ? '혼자 지나온 것' : (npc?.name ?? npcId)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {solo ? '개학과 시험, 졸업 준비 — 곁에 아무도 없던 시간' : npc?.description}
          </div>
        </div>
      </div>

      {/* 판본 탭 — 성별 선택 화면과 같은 순서(남 왼쪽)와 같은 초상을 쓴다. */}
      <div role="tablist" aria-label="주인공 판본" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => {
          const on = t.gender === gender;
          return (
            <button
              key={t.gender}
              role="tab"
              aria-selected={on}
              onClick={() => setGender(t.gender)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 8px', borderRadius: 9, cursor: 'pointer', font: 'inherit',
                fontSize: '0.76rem', fontWeight: on ? 700 : 400,
                background: on ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${on ? 'var(--accent-soft)' : 'rgba(255,255,255,0.1)'}`,
                color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: on ? 1 : 0.75,
              }}
            >
              <span style={{ display: 'flex', filter: on ? 'none' : 'grayscale(1)' }}>
                <Portrait characterId={t.portrait} size={22} expression="neutral" year={7} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {buckets.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>남은 장면이 없다.</div>
      ) : buckets.map(b => {
        const filled = b.slots.filter(s => isSlotFilled(s, seenCgFiles, gender)).length;
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
                const path = filledPath(s, seenCgFiles, gender);
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
