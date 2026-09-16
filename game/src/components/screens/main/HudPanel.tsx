import { memo, useState } from 'react';
import { playSfx } from '../../../audio/sfx';
import { GameState, ParentStrength, ParentBonusApplied } from '../../../engine/types';
import { getParentMods, getWeeklyIncome } from '../../../engine/parentModifiers';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { Portrait } from '../../Portrait';
import { PARENT_ICONS } from '../shared';
import { AudioToggle } from '../../AudioToggle';

type Props = {
  parents: readonly ParentStrength[];
  gender: GameState['gender'];
  mentalStat: number;
  mentalState: GameState['mentalState'];
  year: number;
  fatigue: number;
  money: number;
  isVacation: boolean;
  // 부모 보너스가 이번 주 발동했는지(칩 펄스) — null/undefined 면 발동 없음
  parentBonusesApplied?: ParentBonusApplied[];
  mood: string;
  weekInfo: string;
  month: string;
  fatigueColor: string;
  fatigueLabel: string;
  weeklyActivityCost: number;
  weeklyOverBudget: boolean;
  // Y7 수능까지 남은 주 — null이면 비표시 (Y7 외 학년 / 수능 이후)
  suneungWeeksLeft?: number | null;
  onOpenHome: () => void;
  // 기록장(지난 학년 회상) 진입 — 1학년(완료 학년 없음)엔 "약속" 빈 상태를 띄운다. undefined면 버튼 숨김.
  onOpenAlbum?: () => void;
  // 시스템 메뉴 — 플레이 중 나가는 길의 **보이는** 진입점(#445).
  // 뒤로가기 제스처도 같은 메뉴를 열지만, 데스크톱엔 그 제스처가 없다.
  onOpenMenu?: () => void;
};

// 부모 칩 hover/탭 popover 라벨·설명 — HUD 전용(메인 화면 한정 카피).
// 아이콘은 shared PARENT_ICONS 재사용, 라벨 텍스트만 별도 보유 (SSOT).
const PARENT_TIP_SHORT: Record<string, string> = {
  emotional: '정서', wealth: '여유', info: '정보',
  strict: '엄격', resilience: '체질', freedom: '자유',
};
const PARENT_TIP_DESC: Record<string, string> = {
  emotional: '엄마/아빠가 자주 물어봐주고 안아준다. 지친 주에 피로 회복 보조.',
  // 절대액이 아니라 가산분으로 쓴다 — 용돈이 학교급 곡선(4/5/5)이라 절대액은 학년마다 달라진다.
  // (v8.0의 "+6만원"이 v8.1 하향 뒤에도 남아 있던 걸 v8.2에서 정정)
  wealth: '용돈이 풍족해 학원·도구를 부담 없이 쓸 수 있다. 매주 용돈 +2만원.',
  info: '엄마가 학원·인강 정보를 잘 안다. 학원·자습 효율 +10%.',
  strict: '정해진 시간에 책상 — 루틴이 한 주 더 길게 유지된다.',
  resilience: '타고난 체력 — 피로 증가 -15%.',
  freedom: '"알아서 해" 분위기 — 노는 주의 idle 페널티 -50%.',
};

export const HudPanel = memo(function HudPanel({
  parents, gender, mentalStat, mentalState, year, fatigue, money, isVacation,
  parentBonusesApplied, mood, weekInfo, month, fatigueColor, fatigueLabel,
  weeklyActivityCost, weeklyOverBudget, suneungWeeksLeft, onOpenHome, onOpenAlbum, onOpenMenu }: Props) {
  // 부모 칩 hover/탭 시 보여줄 설명 — 모바일 대응 위해 클릭으로도 토글. HUD 전용 로컬 state.
  const [activeParentTip, setActiveParentTip] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const mods = getParentMods(parents);
  return (
    // 유리 바닥 — 배경 사진을 0.25에서 올리면(BG_IMAGE_OPACITY) HUD만 맨몸으로 사진 위에
    // 남는다. 이 화면에서 카드 밖에 있던 건 HUD와 자동저장 표시 둘뿐이라, 나머지 카드와
    // 같은 rgba(42,34,48,0.85)+blur(6px)를 준다. 파스텔 배경인 초상(neutral은 누끼가 아니라
    // 불투명 파스텔이 규약이다)도 이 바닥 위에 올라가면서 사진과 직접 부딪히지 않는다.
    //
    // **래퍼를 새로 감싸지 않는다** — #444 잠금이 이 요소의 children 인덱스(0=초상,
    // 1=가운데, last=우측)로 축소 거동을 본다. 배경은 이 div가 직접 받는다.
    <div data-tutorial="hud" style={{
      display: 'flex', alignItems: 'center', gap: 'clamp(6px, 3vw, 12px)', marginBottom: 10,
      background: 'rgba(42,34,48,0.85)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      borderRadius: 12, padding: '8px 10px',
    }}>
      <Portrait characterId={gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={mentalStat} mentalState={mentalState} year={year} />
      {/* minWidth:0 — flex 자식의 기본 min-width:auto는 콘텐츠보다 작아지지 않아
          축소 압력이 전부 우측 블록으로 갔다(320px에서 34px까지 찌그러짐). */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{mood} {weekInfo}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{month} {isVacation ? '· 방학' : ''}</div>
        {/* Y7 수능 카운트다운 — 교실 칠판 "D-xxx"(high3-start)의 상시 UI 짝. 정보라서 또렷하게(red). */}
        {suneungWeeksLeft != null && (
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red)' }}>
            {suneungWeeksLeft === 0 ? '🎯 이번 주, 수능' : `🎯 수능까지 ${suneungWeeksLeft}주`}
          </div>
        )}
        {mentalState !== 'normal' && (
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: mentalState === 'burnout' ? 'var(--red)' : 'var(--yellow)' }}>
            {mentalState === 'burnout' ? '🔥 번아웃' : '😩 피로 상태'}
          </div>
        )}
        {/* 부모 칩 — 22×22 발동 시 펄스. 칩의 역할은 '부모 강점 설명 노출'(정보). (Phase 4)
            데스크톱은 hover, 터치/키보드는 탭·포커스로 툴팁을 토글한다(layout shift 방지 absolute popover).
            Home 진입은 칩이 아니라 아래 "💬 가정" 버튼이 전담 — 터치에서 정보 보려다 Home으로 튕기던 문제 해소. */}
        <div style={{ marginTop: 4, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {parents.map(p => {
              const justFired = parentBonusesApplied?.some(b => b.parent === p);
              const isActive = activeParentTip === p;
              return (
                <button
                  key={p}
                  type="button" className="btn-reset"
                  aria-label={`${PARENT_TIP_SHORT[p]} 강점 설명`}
                  aria-expanded={isActive}
                  aria-controls={isActive ? 'parent-tip-popover' : undefined}
                  // 순수 탭/활성화 토글 — hover/focus 자동표시를 두면 클릭이 방금 세팅된 상태를
                  // 뒤집어 툴팁이 안 열리고(데스크톱·키보드), 터치 emulated-hover에서도 깨진다.
                  onClick={() => setActiveParentTip(prev => (prev === p ? null : p))}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: isActive ? 'rgba(224,138,91,0.28)' : 'rgba(224,138,91,0.12)',
                    border: '1px solid rgba(224,138,91,0.4)',
                    display: 'inline-grid', placeItems: 'center', fontSize: '0.7rem',
                    cursor: 'pointer', userSelect: 'none',
                    animation: justFired && !reducedMotion ? 'parentChipPulse 0.6s ease' : 'none',
                  }}
                >{PARENT_ICONS[p]}</button>
              );
            })}
            {/* 클릭 가능 affordance — "💬 가정" 라벨로 진입점 명시 */}
            <button
              type="button" className="btn-reset" data-tutorial="home"
              onClick={() => { playSfx('tap'); setActiveParentTip(null); onOpenHome(); }}
              style={{
                marginLeft: 4, fontSize: '0.65rem', color: 'var(--accent-soft)',
                cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
              }}
            >💬 가정</button>
            {/* 메뉴 — 나가는 길. 같은 고스트 톤이지만 라벨을 붙인다:
                아이콘만 두면 무엇을 여는지 알 수 없고, 이건 되돌릴 수 있는 동작이 아니다. */}
            {onOpenMenu && (
              <button
                type="button" className="btn-reset" aria-label="메뉴 열기"
                onClick={() => { playSfx('tap'); setActiveParentTip(null); onOpenMenu(); }}
                style={{
                  marginLeft: 8, fontSize: '0.65rem', color: 'var(--accent-soft)',
                  cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
                }}
              >🚪 메뉴</button>
            )}
            {/* 기록장 — 지난 학년을 다시 넘겨본다(읽기 전용). 조용한 고스트 톤. */}
            {onOpenAlbum && (
              <button
                type="button" className="btn-reset"
                onClick={() => { playSfx('tap'); setActiveParentTip(null); onOpenAlbum(); }}
                style={{
                  marginLeft: 8, fontSize: '0.65rem', color: 'var(--accent-soft)',
                  cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
                }}
              >📖 기록장</button>
            )}
            <AudioToggle style={{ marginLeft: 4 }} />
          </div>
          {activeParentTip && parents.includes(activeParentTip as ParentStrength) && (
            <div id="parent-tip-popover" role="tooltip" style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
              padding: '5px 8px', borderRadius: 6,
              background: 'rgba(20,16,28,0.92)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(224,138,91,0.35)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              fontSize: '0.66rem', lineHeight: 1.4, color: 'var(--text-secondary)',
              width: 'max-content', maxWidth: 240,
              wordBreak: 'keep-all', overflowWrap: 'break-word',
              pointerEvents: 'none',
            }}>
              <strong style={{ color: 'var(--accent-soft)' }}>{PARENT_ICONS[activeParentTip]} {PARENT_TIP_SHORT[activeParentTip]}</strong>
              {' — '}
              {PARENT_TIP_DESC[activeParentTip]}
            </div>
          )}
        </div>
      </div>
      {/* **flexShrink:0 + nowrap**. 없으면 320px에서 이 블록이 min-content(34px)까지 눌려
          한글이 음절 단위로 끊긴다 — 피로 2줄·💰 2줄·입금 4줄이 되고 HUD 높이가 76→145px로
          두 배가 됐다(1569만원 같은 큰 금액에선 우측이 HUD 밖 321px까지 나갔다).
          **남는 것**: 320px에서 가운데 제목이 2줄이 되어 HUD가 95px이다. 이 3단 레이아웃에서
          "☀️ 중2 1학기 12주차"(약 165px)를 97px에 한 줄로 넣을 방법은 없다 — 어절 단위로
          끊기므로(word-break:keep-all, game.css:52) 글자가 찢어지지는 않는다.
          우측 폰트를 줄이면 5px을 벌지만 가장 작은 화면의 글자가 10.2px가 되어 되돌렸다. */}
      <div style={{ textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.6, flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ color: fatigueColor }}>피로 {Math.round(fatigue)} · {fatigueLabel}</div>
        <div>
          💰 {Number.isInteger(money) ? money : money.toFixed(1)}만원
          {weeklyActivityCost > 0 && (
            <span style={{
              marginLeft: 6, fontSize: '0.66rem', fontWeight: 600,
              color: weeklyOverBudget ? 'var(--red)' : 'var(--text-secondary)',
            }}>
              (이번 주 -{weeklyActivityCost})
            </span>
          )}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>주말 마감 시 +{getWeeklyIncome(parents, year) - mods.livingCost}만원 입금</div>
      </div>
    </div>
  );
});
