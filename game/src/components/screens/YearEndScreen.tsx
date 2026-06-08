import { calculateHappinessGrade, HAPPINESS_LABELS } from '../../engine/ending';
import { MemorySlot, MilestoneScene, Stats } from '../../engine/types';
import { BgWrapper, ScreenBgProps } from './BgWrapper';

interface YearEndScreenProps {
  // 방금 끝난 학년 (advance 전 state.year)
  year: number;
  memorySlots: MemorySlot[];
  milestoneScenes: MilestoneScene[];
  stats: Stats;
  bgProps: ScreenBgProps;
  onAdvance: () => void;
}

const YEAR_NAMES = [
  '초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년',
  '고등학교 1학년', '고등학교 2학년', '고등학교 3학년',
];

// 학년별 부제 — 같은 화면이 (Y1~Y6) 최대 6번 반복되므로, 고정 한 줄은 "또 그 화면"으로 학습돼 스킵된다.
// year로 변주해 매번 그 해의 무게가 다르게 읽히도록. (UX writer 패널 제안)
const YEAR_SUBTITLES = [
  '초등학교의 마지막을, 천천히 넘겨본다',   // Y1
  '교복이 익숙해진 한 해를 돌아본다',       // Y2
  '중학교의 한가운데를 지나왔다',           // Y3
  '졸업이 가까워진 해를 닫는다',            // Y4
  '고등학교의 첫 페이지를 덮는다',          // Y5
  '입시가 가까워진 해를 돌아본다',          // Y6
];

// 회상 카드/마무리 블록 공통 — 디테일 많은 교실 배경 위에서 글이 읽히도록 "다크 스크림 패널".
// (기존 rgba(255,255,255,0.04)는 배경과 섞여 가독성 붕괴의 1차 원인이었음)
const PANEL: React.CSSProperties = {
  background: 'rgba(20,17,26,0.55)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
};

// 패널 밖에 떠 있는 제목/부제는 배경 위 직접 노출 → 그림자로 대비 확보
const TEXT_SHADOW = '0 1px 4px rgba(0,0,0,0.55)';

// v1.3 학년말 회고 (Y1~Y6) — phase === 'year-end'
//   · 다크 스크림 패널 + 큰 제목 (가독성)
//   · 영문 eyebrow / 섹션 라벨 전부 제거 — 본문이 스스로 말함 (라벨은 동어반복 번역체)
//   · milestone + 행복을 "닫는 한 블록"으로 병합, 부모 친밀도 줄(\n)을 살려서 분리 렌더
//   · CTA는 정직한 "{다음 학년}으로" 고스트 버튼 + 다 읽은 뒤 조용히 fade-in
export function YearEndScreen({ year, memorySlots, milestoneScenes, stats, bgProps, onAdvance }: YearEndScreenProps) {
  const yearName = YEAR_NAMES[year - 1] || `${year}학년`;
  const subtitle = YEAR_SUBTITLES[year - 1] || '이 한 해를 조용히 돌아본다';
  const nextGradeName = YEAR_NAMES[year]; // 이 화면은 Y1~Y6만 뜸 → 다음 학년 이름 항상 존재
  const slotsThisYear = memorySlots
    .filter(m => m.year === year)
    .sort((a, b) => a.week - b.week);
  const milestone = milestoneScenes.find(m => m.year === year);
  const happinessGrade = calculateHappinessGrade(stats.mental, stats.social);
  const happinessInfo = HAPPINESS_LABELS[happinessGrade];

  // milestone.summaryText 에는 부모 친밀도 한 줄이 '\n'으로 append 될 수 있음 (memorySystem Phase 2.1).
  // HTML은 '\n'을 무시하므로 그대로 두면 두 줄이 한 덩어리로 뭉개짐 → 분리해서 뒷줄을 "뒤늦게 떠오른 한 줄"로.
  const [milestoneMain, ...milestoneRest] = (milestone?.summaryText || '').split('\n');
  const milestoneExtra = milestoneRest.join(' ').trim();

  const hasScenes = slotsThisYear.length > 0;
  // 블록 스태거 타임라인 (ms) — 기억이 한 박자씩 떠오르고, 버튼은 맨 마지막에 조용히
  const tScenes = 420;
  const tClosing = hasScenes ? 620 : 420;
  const tCta = tClosing + 800;

  return (
    <BgWrapper {...bgProps}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 40px', textAlign: 'center' }}>
        {/* 제목 — 화면의 유일한 강한 타이포 */}
        <div className="ye-stagger" style={{ animationDelay: '120ms', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', textShadow: TEXT_SHADOW, marginBottom: 6 }}>
          {yearName}이 끝났다
        </div>
        <div className="ye-stagger" style={{ animationDelay: '240ms', fontSize: '0.9rem', color: 'var(--text-secondary)', textShadow: TEXT_SHADOW, marginBottom: 26 }}>
          {subtitle}
        </div>

        {/* 이 해에 남은 장면 — 라벨 없이, 묶음임은 좌측 악센트 보더가 시그널 */}
        {hasScenes && (
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tScenes}ms`, padding: '18px 20px', marginBottom: 14, borderLeft: '2px solid var(--accent-soft)' }}>
            {slotsThisYear.map((slot, i) => (
              <div key={slot.id} style={{
                fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic',
                marginBottom: i === slotsThisYear.length - 1 ? 0 : 12,
              }}>
                {slot.recallText}
              </div>
            ))}
          </div>
        )}

        {/* 닫는 한 블록 — milestone(서사) + 부모 줄 + 올해의 마음 */}
        <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tClosing}ms`, padding: '18px 20px', marginBottom: 30 }}>
          {milestoneMain && (
            <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
              {milestoneMain}
            </div>
          )}
          {milestoneExtra && (
            // 7년간 조용히 쌓인 부모 관계가 연말에야 한 줄로 드러나는 자리 — 본문과 분리해 "뒤늦게"
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 8 }}>
              {milestoneExtra}
            </div>
          )}
          <div style={{ marginTop: milestoneMain ? 16 : 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {happinessInfo.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 4 }}>
              {happinessInfo.desc}
            </div>
          </div>
        </div>

        {/* 정직한 전환 — 이 버튼이 실제로 학년을 넘긴다(되돌릴 수 없음). "저장"이 아님.
            회상 화면에서 가장 밝은 픽셀이 '탈출 버튼'이면 안 되므로 고스트 톤 + 늦은 등장. */}
        <button
          className="btn ye-cta"
          style={{
            maxWidth: 280,
            margin: '0 auto',
            background: 'rgba(224,138,91,0.12)',
            border: '1px solid var(--accent-soft)',
            color: 'var(--accent-soft)',
            animationDelay: `${tCta}ms`,
          }}
          onClick={onAdvance}
        >
          {nextGradeName ? `${nextGradeName}으로` : '다음으로'}
        </button>
      </div>
    </BgWrapper>
  );
}
