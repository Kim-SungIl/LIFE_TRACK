import { calculateHappinessGrade, HAPPINESS_LABELS, happinessTrajectoryForYear } from '../../engine/ending';
import { josa } from '../../engine/korean';
import { MemorySlot, MilestoneScene, Stats, Gender, ExamResult, EXAM_TYPE_LABELS } from '../../engine/types';
import { resolveEventCgUrl } from '../../engine/eventCg';
import { BgWrapper, ScreenBgProps } from './BgWrapper';
// 기억 시각 언어(엠블럼·톤 필터·갤러리·썸네일)는 엔딩 화면과 공유 — memoryVisuals.tsx.
import { CgItem, PANEL, TEXT_SHADOW, TONE_GLOW, catOf } from './memoryTokens';
import { HeroGallery, MemoryThumb } from './memoryVisuals';

interface YearEndScreenProps {
  // 방금 끝난 학년 (advance 전 state.year)
  year: number;
  gender: Gender;
  memorySlots: MemorySlot[];
  milestoneScenes: MilestoneScene[];
  stats: Stats;
  // 그 해의 궤적 — 누적 burnoutCount·totalTiredWeeks는 학년말에 못 쓴다.
  lowMentalWeeksByYear?: number[];
  veryLowMentalWeeksByYear?: number[];
  burnoutCountByYear?: number[];
  bgProps: ScreenBgProps;
  onAdvance: () => void;
  // ===== 기록장(읽기 전용 과거 열람) 모드 — 같은 카드를 지난 학년 회상용으로 재활용 =====
  // readonly면: 학년 탭으로 넘겨보기, "올해의 마음"(현재 stats 종속 → 시점 오염) 숨김,
  //             그 해 성적표 한 줄 추가, CTA를 "닫기"로 교체.
  readonly?: boolean;
  examResults?: ExamResult[];     // 전체 시험 기록(그 해만 필터해서 표시)
  reachedYears?: number[];        // 학년 탭에 띄울 도달 학년 목록
  onSelectYear?: (y: number) => void;
  onClose?: () => void;
}

const YEAR_NAMES = [
  '초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년',
  '고등학교 1학년', '고등학교 2학년', '고등학교 3학년',
];

// 학년별 부제 — 같은 화면이 (Y1~Y6) 최대 6번 반복되므로, 고정 한 줄은 "또 그 화면"으로 학습돼 스킵된다.
const YEAR_SUBTITLES = [
  '초등학교의 마지막을, 천천히 넘겨본다',   // Y1
  '교복이 익숙해진 한 해를 돌아본다',       // Y2
  '중학교의 한가운데를 지나왔다',           // Y3
  '졸업이 가까워진 해를 닫는다',            // Y4
  '고등학교의 첫 페이지를 덮는다',          // Y5
  '입시가 가까워진 해를 돌아본다',          // Y6
];

const MAX_CARDS = 4;  // 회고는 "전부 나열"이 아니라 "추려보기" — 초과분은 한 줄로 암시
// 갤러리도 동일 철학 — 너무 많은 CG를 넘기는 건 "감상"이 아니라 "작업"이 된다. 초과 CG는 썸네일 카드로 강등(유실X).
const MAX_GALLERY = 5;

// v1.5 학년말 회고 (Y1~Y6) — phase === 'year-end'
//   P0: 스크림·라벨 정리·부모줄 부활·정직한 CTA
//   P1: CG 있는 기억 = 스와이프 갤러리(여러 장 넘겨보기), 나머지 = 초상/엠블럼 썸네일 카드.
export function YearEndScreen({ year, gender, memorySlots, milestoneScenes, stats, lowMentalWeeksByYear, veryLowMentalWeeksByYear, burnoutCountByYear, bgProps, onAdvance, readonly, examResults, reachedYears, onSelectYear, onClose }: YearEndScreenProps) {
  // 기록장을 열었지만 아직 마친 학년이 없다(1학년) — 회상할 과거가 없으니 연도별 렌더 대신 "약속" 빈 상태만.
  // reachedYears가 빈 배열인 건 이 경우뿐(진행 모드는 undefined, 2학년+는 length≥1).
  if (readonly && reachedYears && reachedYears.length === 0) {
    return (
      <BgWrapper {...bgProps}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 40px', textAlign: 'center' }}>
          <div className="ye-stagger" style={{ animationDelay: '120ms', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', textShadow: TEXT_SHADOW, marginBottom: 6 }}>
            📖 기록장
          </div>
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: '300ms', padding: '28px 22px', marginTop: 26, marginBottom: 26 }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 2 }}>
              아직 담긴 기억이 없어요.<br />한 학년을 마치면,<br />그 해의 순간들이 여기 쌓입니다. 📖
            </div>
          </div>
          <button
            className="btn ye-cta"
            style={{ maxWidth: 280, margin: '0 auto', background: 'rgba(224,138,91,0.12)', border: '1px solid var(--accent-soft)', color: 'var(--accent-soft)', animationDelay: '0ms' }}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </BgWrapper>
    );
  }

  const examsThisYear = (examResults ?? []).filter(e => e.year === year);
  // 성적표(기록장) — 단원평가는 접고 주요 시험 우선, 최대 4개. 등급/석차 숫자는 빼고 총평만(반-수치 회상 톤).
  // 초등처럼 주요 시험이 없는 해는 단원평가라도 보여준다(빈 성적표 방지).
  const majorExams = examsThisYear.filter(e => e.examType !== 'unit-test');
  const shownExams = (majorExams.length > 0 ? majorExams : examsThisYear).slice(0, 4);
  const hiddenExamCount = examsThisYear.length - shownExams.length;
  const yearName = YEAR_NAMES[year - 1] || `${year}학년`;
  const subtitle = YEAR_SUBTITLES[year - 1] || '이 한 해를 조용히 돌아본다';
  const nextGradeName = YEAR_NAMES[year];
  const slotsThisYear = memorySlots.filter(m => m.year === year);
  const milestone = milestoneScenes.find(m => m.year === year);
  const happinessGrade = calculateHappinessGrade(
    stats.mental,
    stats.social,
    stats.health,
    happinessTrajectoryForYear({ lowMentalWeeksByYear, veryLowMentalWeeksByYear, burnoutCountByYear }, year),
  );
  const happinessInfo = HAPPINESS_LABELS[happinessGrade];

  // 부모 친밀도 줄(\n append, Phase 2.1)을 본문과 분리해 "뒤늦게 떠오른 한 줄"로
  const [milestoneMain, ...milestoneRest] = (milestone?.summaryText || '').split('\n');
  const milestoneExtra = milestoneRest.join(' ').trim();

  // CG 있는 기억 → 갤러리. 정렬은 하이브리드: 1번=대표(최고 importance, 첫 장만 봐도 그 해의 핵심),
  // 2번~ = 시간순(그 해를 다시 걷는 흐름). 기획자 3명 합의 — 중요도 클로저 + 타임라인 둘 다 만족.
  const cgAll: CgItem[] = slotsThisYear
    .map(s => ({ slot: s, cg: resolveEventCgUrl(s.sourceEventId, s.choiceIndex, gender, year) }))
    .filter((x): x is CgItem => !!x.cg);
  const anchor = cgAll.length
    ? [...cgAll].sort((a, b) => (b.slot.importance - a.slot.importance) || (a.slot.week - b.slot.week))[0]
    : undefined;
  const ordered: CgItem[] = anchor
    ? [anchor, ...cgAll.filter(x => x.slot.id !== anchor.slot.id).sort((a, b) => a.slot.week - b.slot.week)]
    : [];
  // 상한 — 초과 CG는 버리지 않고 썸네일 카드로 강등(아래 cardSlots가 갤러리에 없는 기억을 자동 흡수).
  const galleryItems = ordered.slice(0, MAX_GALLERY);
  const galleryIds = new Set(galleryItems.map(x => x.slot.id));
  // 나머지(CG 없음 + 갤러리 초과 CG) → 썸네일 카드(시간순, 최대 MAX_CARDS).
  const cardSlots = slotsThisYear.filter(s => !galleryIds.has(s.id)).sort((a, b) => a.week - b.week);
  // CG 없는 해(Y2~Y6 현 상태)엔 갤러리=focal이 없어 카드만 나열돼 밋밋하다.
  // → 대표 기억(최고 importance, 동률이면 이른 주)을 큰 hero로 승격해 "그 해의 한 장면"을 만든다.
  // 갤러리가 있으면 그게 이미 focal이므로 승격하지 않음(중복 강조 방지).
  const heroCard = galleryItems.length === 0 && cardSlots.length > 0
    ? [...cardSlots].sort((a, b) => (b.importance - a.importance) || (a.week - b.week))[0]
    : undefined;
  const listSlots = heroCard ? cardSlots.filter(s => s.id !== heroCard.id) : cardSlots;
  const shownCards = listSlots.slice(0, MAX_CARDS);
  const hiddenCount = listSlots.length - shownCards.length;

  const hasScenes = slotsThisYear.length > 0;
  const hasFocal = galleryItems.length > 0 || !!heroCard;  // 갤러리 또는 hero 카드
  const tGallery = 420;  // focal 슬롯(갤러리/hero) 공통 등장 타이밍
  const tCards = hasFocal ? 560 : 420;
  const tClosing = hasScenes ? 700 : 420;
  // CTA는 콘텐츠를 다 읽을 즈음 조용히 등장 — 카드 수 비례(고정값이면 기억 많을 때 너무 일찍 뜸). 상한 클램프.
  const tCta = Math.min(tClosing + 600 + shownCards.length * 140, 2600);

  return (
    <BgWrapper {...bgProps}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 40px', textAlign: 'center' }}>
        {/* 기록장 모드 — 도달 학년 탭으로 넘겨본다 */}
        {readonly && reachedYears && reachedYears.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {reachedYears.map(y => (
              <button
                key={y}
                type="button"
                className="btn-reset"
                aria-pressed={y === year}
                onClick={() => onSelectYear?.(y)}
                style={{
                  fontSize: '0.74rem', padding: '4px 11px', borderRadius: 14, cursor: 'pointer',
                  border: '1px solid var(--accent-soft)',
                  background: y === year ? 'rgba(224,138,91,0.18)' : 'transparent',
                  color: y === year ? 'var(--accent-soft)' : 'var(--text-muted)',
                }}
              >{YEAR_NAMES[y - 1] || `${y}학년`}</button>
            ))}
          </div>
        )}
        {/* 학년 전환·진입 시 본문만 polite 안내 (탭 컨트롤은 라이브 리전 밖) */}
        <div aria-live="polite">
        <div className="ye-stagger" style={{ animationDelay: '120ms', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', textShadow: TEXT_SHADOW, marginBottom: 6 }}>
          {readonly ? yearName : `${josa(yearName, '이/가')} 끝났다`}
        </div>
        <div className="ye-stagger" style={{ animationDelay: '240ms', fontSize: '0.9rem', color: 'var(--text-secondary)', textShadow: TEXT_SHADOW, marginBottom: 26 }}>
          {subtitle}
        </div>

        {/* 기록장에서 기억이 흐려진(슬롯 축출) 학년 — 빈 화면 대신 한 줄. 진행 모드엔 항상 기억이 있어 안 뜸. */}
        {readonly && !hasScenes && (
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: '300ms', padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.75 }}>
              이 해의 장면들은 어느새 흐릿해졌다. 그래도, 그 시간을 지나왔다.
            </div>
          </div>
        )}

        {/* CG 기억 갤러리 — 여러 장이면 스와이프 */}
        {galleryItems.length > 0 && (
          <div className="ye-stagger" style={{ animationDelay: `${tGallery}ms`, marginBottom: 14 }}>
            <HeroGallery items={galleryItems} />
          </div>
        )}

        {/* CG 없는 해 대표 기억 — hero 카드(큰 초상/엠블럼 focal). 갤러리 없을 때만 */}
        {heroCard && (
          <div className="ye-stagger" style={{
            ...PANEL,
            // 정서 색온도 글로우 — 상단에서 옅게 번지는 따뜻/차가운 공기(toneTag 있을 때만)
            ...(heroCard.toneTag ? { background: `radial-gradient(120% 80% at 50% 0%, ${TONE_GLOW[heroCard.toneTag]}1f, transparent 62%), rgba(20,17,26,0.55)` } : {}),
            animationDelay: `${tGallery}ms`, padding: '22px 20px 20px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <MemoryThumb slot={heroCard} year={year} size={104} />
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic', marginTop: 16 }}>
              {heroCard.recallText}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
              {`W${heroCard.week} · ${catOf(heroCard.category).label}`}
            </div>
          </div>
        )}

        {/* 나머지 기억 — 썸네일 카드 (초상/엠블럼). 최대 MAX_CARDS개 + 초과분 암시 */}
        {shownCards.length > 0 && (
          <div className="ye-stagger" style={{ ...PANEL, animationDelay: `${tCards}ms`, padding: '12px 14px', marginBottom: 14, borderLeft: '2px solid var(--accent-soft)' }}>
            {shownCards.map((slot, i) => (
              <div key={slot.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'default',
                marginBottom: i === shownCards.length - 1 && hiddenCount === 0 ? 0 : 12,
              }}>
                <MemoryThumb slot={slot} year={year} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55, fontStyle: 'italic' }}>
                    {slot.recallText}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {`W${slot.week} · ${catOf(slot.category).label}`}
                  </div>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                그리고 {hiddenCount}개의 장면이 더 있었다
              </div>
            )}
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
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 8 }}>
              {milestoneExtra}
            </div>
          )}
          {/* "올해의 마음"은 현재 stats 종속이라 과거 회상(readonly)엔 시점 오염 → 진행 중에만 */}
          {!readonly && (
            <div style={{ marginTop: milestoneMain ? 16 : 0 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {happinessInfo.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 4 }}>
                {happinessInfo.desc}
              </div>
            </div>
          )}
        </div>

        {/* 그 해의 시험들 — 기록장 모드 전용. 등급/석차 숫자 없이 시험별 한 줄 총평(회고 톤). */}
        {readonly && shownExams.length > 0 && (
          <div style={{ ...PANEL, padding: '16px 18px', marginBottom: 30, textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center', letterSpacing: '0.15em' }}>그 해의 시험들</div>
            {shownExams.map((e, i) => (
              <div key={i} style={{ marginBottom: i === shownExams.length - 1 && hiddenExamCount === 0 ? 0 : 12 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {`${e.semester}학기 ${EXAM_TYPE_LABELS[e.examType]}`}
                </span>
                {e.comment && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 3 }}>
                    {e.comment}
                  </div>
                )}
              </div>
            ))}
            {hiddenExamCount > 0 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
                그리고 {hiddenExamCount}번의 시험이 더 있었다
              </div>
            )}
          </div>
        )}

        </div>

        {/* CTA — 진행 모드: 실제 학년 넘김 / 기록장 모드: 닫고 게임으로 복귀. 고스트 톤 + 늦은 등장. */}
        <button
          className="btn ye-cta"
          style={{
            maxWidth: 280,
            margin: '0 auto',
            background: 'rgba(224,138,91,0.12)',
            border: '1px solid var(--accent-soft)',
            color: 'var(--accent-soft)',
            animationDelay: readonly ? '0ms' : `${tCta}ms`,
          }}
          onClick={readonly ? onClose : onAdvance}
        >
          {readonly ? '닫기' : nextGradeName ? `${josa(nextGradeName, '으로/로')}` : '다음으로'}
        </button>
      </div>
    </BgWrapper>
  );
}
