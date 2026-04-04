import { useState } from 'react';
import { Activity, StatKey, STAT_LABELS, GameState } from '../engine/types';

const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};

const CAT_INFO: Record<string, { emoji: string; name: string; desc: string }> = {
  study:    { emoji: '📚', name: '공부',     desc: '학업 성적을 올린다' },
  exercise: { emoji: '💪', name: '운동',     desc: '체력과 멘탈을 키운다' },
  social:   { emoji: '👥', name: '관계',     desc: '친구를 만나고 인기를 올린다' },
  talent:   { emoji: '🎨', name: '자기계발', desc: '재능과 특기를 키운다' },
  rest:     { emoji: '😴', name: '휴식',     desc: '피로를 풀고 쉰다' },
  parent:   { emoji: '💝', name: '가족',     desc: '가족과 함께하는 시간' },
  work:     { emoji: '💼', name: '알바',     desc: '돈을 벌며 경험을 쌓는다' },
};

interface Props {
  activities: Activity[];
  selected: string[];
  onToggle: (id: string) => void;
  maxSlots: number;
  currentSlots: number;
  state: GameState;
  npcChoices?: Record<string, string>;
  compact?: boolean;
  availableMoney?: number; // 이미 쓴 돈을 뺀 실제 사용 가능한 금액
}

export function ActivityPicker({ activities, selected, onToggle, maxSlots, currentSlots, state, npcChoices = {}, compact = false, availableMoney }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const categories = ['study', 'exercise', 'social', 'talent', 'rest', 'parent', 'work'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {categories.map(cat => {
        const catActivities = activities.filter(a => a.category === cat);
        if (catActivities.length === 0) return null;

        const info = CAT_INFO[cat];
        const isExpanded = expandedCat === cat;
        const selectedInCat = catActivities.filter(a => selected.includes(a.id));

        return (
          <div key={cat} style={{
            background: 'rgba(15,52,96,0.9)',
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedInCat.length > 0 ? '1px solid rgba(233,69,96,0.3)' : '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* 카테고리 헤더 — 클릭하면 펼침/접기 */}
            <div
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', cursor: 'pointer',
                background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>{info.emoji}</span>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{info.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{info.desc}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 선택된 활동 표시 */}
                {selectedInCat.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-soft)', fontWeight: 600 }}>
                    {selectedInCat.map(a => a.name).join(', ')}
                  </span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* 펼쳐진 활동 목록 */}
            {isExpanded && (
              <div style={{ padding: '0 10px 10px' }}>
                {catActivities.map(a => {
                  const isSel = selected.includes(a.id);
                  const money = availableMoney !== undefined ? availableMoney : state.money;
                  const canAfford = (a.moneyCost <= 0 || money >= a.moneyCost) && (!a.requires || a.requires(state));
                  const canSelect = isSel || currentSlots + a.slots <= maxSlots;
                  const disabled = !canSelect || !canAfford;

                  return (
                    <div key={a.id}
                      onClick={() => !disabled && onToggle(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: compact ? '8px 10px' : '10px 12px',
                        marginTop: 4, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                        background: isSel ? 'rgba(233,69,96,0.25)' : 'rgba(255,255,255,0.06)',
                        border: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                        opacity: disabled && !isSel ? 0.4 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            {a.name}
                          </span>
                          {a.moneyCost > 0 && (
                            <span style={{ fontSize: '0.72rem', color: canAfford ? 'var(--yellow)' : 'var(--red)' }}>
                              ({a.moneyCost}만{compact ? '/주' : ''})
                            </span>
                          )}
                          {a.moneyCost < 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--green)' }}>
                              (+{-a.moneyCost}만)
                            </span>
                          )}
                          {npcChoices[a.id] && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-soft)' }}>
                              ({state.npcs.find(n => n.id === npcChoices[a.id])?.name})
                            </span>
                          )}
                        </div>
                        {!compact && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                            {a.flavor}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                        {/* 스탯 효과 */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Object.entries(a.effects).map(([k, v]) => (
                            <span key={k} style={{
                              fontSize: '0.7rem', color: (v as number) > 0 ? 'var(--green)' : 'var(--red)',
                              background: (v as number) > 0 ? 'rgba(76,175,80,0.1)' : 'rgba(255,87,34,0.1)',
                              padding: '1px 6px', borderRadius: 4,
                            }}>
                              {STAT_LABELS[k as StatKey]}{(v as number) > 0 ? '+' + v : v}
                            </span>
                          ))}
                          <span style={{
                            fontSize: '0.7rem',
                            color: a.fatigue > 0 ? 'var(--red)' : 'var(--green)',
                            background: a.fatigue > 0 ? 'rgba(255,87,34,0.1)' : 'rgba(76,175,80,0.1)',
                            padding: '1px 6px', borderRadius: 4,
                          }}>
                            피로{a.fatigue > 0 ? '+' : ''}{a.fatigue}
                          </span>
                        </div>
                        {/* 슬롯 */}
                        {a.slots > 1 && <span style={{ fontSize: '0.65rem', color: 'var(--purple)' }}>{a.slots}슬롯</span>}
                        {/* 돈 부족 */}
                        {a.moneyCost > 0 && money < a.moneyCost && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 600 }}>💰부족</span>
                        )}
                        {/* 선택 체크 */}
                        {isSel && <span style={{ fontSize: '0.9rem' }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
