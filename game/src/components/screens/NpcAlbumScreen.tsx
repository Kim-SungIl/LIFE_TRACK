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
export function NpcAlbumScreen({ npcId, story, seenCgFiles, onBack }: {
  npcId: string;
  /**
   * 기록실 줄이 **방금 보여준 그 수**를 그대로 받는다(다시 계산하지 않는다).
   * 두 화면이 각자 세면 조용히 어긋나고, 실제로 그게 "줄엔 3인데 앨범엔 0장" 신고의 정체였다.
   */
  story: { seen: number; total: number };
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

  // 이 화면의 두 수는 **다른 축**이다. 이야기는 겪은 장면 수라 판본과 무관하고, 그림은
  // 이 탭에서 모은 칸 수다. 한 이벤트가 학교급·그림서명마다 칸이 되고 CG 없는 이벤트는
  // 칸이 아예 없으므로 둘은 어느 방향으로도 갈린다(하은 이야기 18 / 그림 13, 예린 6 / 14).
  // 그래서 수를 맞추는 대신 **이름표를 붙여** 각자 무엇인지 밝힌다.
  const shotTotal = buckets.reduce((n, b) => n + b.slots.length, 0);
  const shotFilled = buckets.reduce(
    (n, b) => n + b.slots.filter(s => isSlotFilled(s, seenCgFiles, gender)).length, 0);

  // 반대 판본의 채움 수. 이게 없으면 "그림이 없다"와 "이 판본을 안 해봤다"를 구별하지 못한다
  // (3자 검수 전원 지적). 칸 수는 11개 뿌리 전부 male/female이 같고 277칸 중 195칸이
  // 판본별로 다른 파일이라, **탭을 바꾸면 분모는 그대로인데 분자만 통째로 0이 된다** —
  // 흔한 상태다. 탭을 누르지 않아도 걸린다: dominantGender는 기록 전체로 첫 탭을 고르므로
  // 남주로 도윤 그림을 모은 뒤 여주 판을 많이 하면 도윤 앨범이 빈 여주 탭으로 열린다(실측).
  const otherGender: Gender = gender === 'male' ? 'female' : 'male';
  const otherFilled = albumFor(npcId, otherGender).reduce(
    (n, b) => n + b.slots.filter(s => isSlotFilled(s, seenCgFiles, otherGender)).length, 0);

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
          {/* 판본과 무관한 수라 얼굴 옆(정체성 자리)에 둔다. 아래 그림 수는 탭 밑에 둬서
              "이건 탭에 따라 달라진다"가 위치로 읽히게 한다. */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>
            이야기 {story.seen} / {story.total}
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

      {/* 학교급별 칸을 머릿속으로 더하지 않아도 되게 합계를 낸다(초6 1/8 + 중학교 0/3 = 1/11).
          탭 바로 아래에 두는 것이 요점이다 — 판본을 바꾸면 이 수가 따라 바뀐다. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: '0.76rem', marginBottom: 12,
      }}>
        <span style={{ color: 'var(--text-muted)' }}>이 판본에서 모은 그림</span>
        <span style={{ color: shotTotal > 0 && shotFilled === shotTotal ? 'var(--gold)' : 'var(--text-secondary)' }}>
          {shotFilled} / {shotTotal}
        </span>
      </div>

      {/* 이야기는 봤는데 그림이 0장이면 빈 칸 벽만 보여 고장으로 읽힌다. 그런데 0장인 이유가
          둘이라 한 문장으로 쓰면 거짓말이 된다:
            · 그 장면들에 애초에 CG가 없다 — 주인 없는 장면 43종 중 24종(개학·시험·번아웃…)
            · 그림은 있는데 **이 판본에서 안 모았다** — 반대 탭에 있다
          `story.seen > 0` 가드는 장식이 아니다. everMet은 만나기만 해도 참이라 이야기를
          하나도 못 본 사람(서아 0/9)의 줄이 실제로 보이고, 가드가 없으면 그 앨범에
          "본 장면들은 그림 없이 지나갔다"가 뜬다 — 본 장면이 하나도 없는데. */}
      {story.seen > 0 && shotFilled === 0 && (
        <div style={{
          fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic',
          lineHeight: 1.6, marginBottom: 14,
        }}>
          {otherFilled > 0 ? '이 판본에서는 아직 모은 그림이 없다.' : '본 장면들은 그림 없이 지나갔다.'}
        </div>
      )}

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
