import { memo, useState } from 'react';
import { GameState, ParentStrength, ParentBonusApplied } from '../../../engine/types';
import { getParentMods } from '../../../engine/parentModifiers';
import { Portrait } from '../../Portrait';
import { PARENT_ICONS } from '../shared';

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
};

// 부모 칩 hover/탭 popover 라벨·설명 — HUD 전용(메인 화면 한정 카피).
// 아이콘은 shared PARENT_ICONS 재사용, 라벨 텍스트만 별도 보유 (SSOT).
const PARENT_TIP_SHORT: Record<string, string> = {
  emotional: '정서', wealth: '여유', info: '정보',
  strict: '엄격', resilience: '체질', freedom: '자유',
};
const PARENT_TIP_DESC: Record<string, string> = {
  emotional: '엄마/아빠가 자주 물어봐주고 안아준다. 지친 주에 피로 회복 보조.',
  wealth: '용돈이 풍족해 학원·도구를 부담 없이 쓸 수 있다. 매주 용돈 +6만원.',
  info: '엄마가 학원·인강 정보를 잘 안다. 학원·자습 효율 +10%.',
  strict: '정해진 시간에 책상 — 루틴이 한 주 더 길게 유지된다.',
  resilience: '타고난 체력 — 피로 증가 -15%.',
  freedom: '"알아서 해" 분위기 — 노는 주의 idle 페널티 -50%.',
};

export const HudPanel = memo(function HudPanel({
  parents, gender, mentalStat, mentalState, year, fatigue, money, isVacation,
  parentBonusesApplied, mood, weekInfo, month, fatigueColor, fatigueLabel,
  weeklyActivityCost, weeklyOverBudget, suneungWeeksLeft, onOpenHome, onOpenAlbum,
}: Props) {
  // 부모 칩 hover/탭 시 보여줄 설명 — 모바일 대응 위해 클릭으로도 토글. HUD 전용 로컬 state.
  const [activeParentTip, setActiveParentTip] = useState<string | null>(null);
  const mods = getParentMods(parents);
  return (
    <div data-tutorial="hud" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <Portrait characterId={gender === 'male' ? 'player_m' : 'player_f'} size={52} mental={mentalStat} mentalState={mentalState} year={year} />
      <div style={{ flex: 1 }}>
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
        {/* 부모 칩 — 22×22 발동 시 펄스. 호버/탭하면 absolute popover로 설명 노출 (layout shift 방지) */}
        {/* 클릭하면 부모 모달 — 인라인 "💬 가정" 라벨로 클릭 가능 affordance 명시 */}
        <div style={{ marginTop: 4, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {parents.map(p => {
              const justFired = parentBonusesApplied?.some(b => b.parent === p);
              const isActive = activeParentTip === p;
              return (
                <button
                  key={p}
                  type="button" className="btn-reset"
                  aria-label={`가정 — ${PARENT_TIP_SHORT[p]}`}
                  onMouseEnter={() => setActiveParentTip(p)}
                  onMouseLeave={() => setActiveParentTip(prev => prev === p ? null : prev)}
                  onFocus={() => setActiveParentTip(p)}
                  onBlur={() => setActiveParentTip(prev => prev === p ? null : prev)}
                  onClick={() => { setActiveParentTip(null); onOpenHome(); }}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: isActive ? 'rgba(224,138,91,0.28)' : 'rgba(224,138,91,0.12)',
                    border: '1px solid rgba(224,138,91,0.4)',
                    display: 'inline-grid', placeItems: 'center', fontSize: '0.7rem',
                    cursor: 'pointer', userSelect: 'none',
                    animation: justFired ? 'parentChipPulse 0.6s ease' : 'none',
                  }}
                >{PARENT_ICONS[p]}</button>
              );
            })}
            {/* 클릭 가능 affordance — "💬 가정" 라벨로 진입점 명시 */}
            <button
              type="button" className="btn-reset"
              onClick={() => { setActiveParentTip(null); onOpenHome(); }}
              style={{
                marginLeft: 4, fontSize: '0.65rem', color: 'var(--accent-soft)',
                cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
              }}
            >💬 가정</button>
            {/* 기록장 — 지난 학년을 다시 넘겨본다(읽기 전용). 조용한 고스트 톤. */}
            {onOpenAlbum && (
              <button
                type="button" className="btn-reset"
                onClick={() => { setActiveParentTip(null); onOpenAlbum(); }}
                style={{
                  marginLeft: 8, fontSize: '0.65rem', color: 'var(--accent-soft)',
                  cursor: 'pointer', userSelect: 'none', fontWeight: 600, letterSpacing: '0.02em',
                }}
              >📖 기록장</button>
            )}
          </div>
          {activeParentTip && parents.includes(activeParentTip as ParentStrength) && (
            <div style={{
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
      <div style={{ textAlign: 'right', fontSize: '0.72rem', lineHeight: 1.6 }}>
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
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>주말 마감 시 +{mods.weeklyIncome - mods.livingCost}만원 입금</div>
      </div>
    </div>
  );
});
