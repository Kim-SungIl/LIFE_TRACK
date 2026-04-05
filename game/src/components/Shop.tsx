import { useState } from 'react';
import { SHOP_ITEMS, SHOP_CATEGORIES, canBuyItem, ItemCategory, ShopItem } from '../engine/shopSystem';
import { GameState, STAT_LABELS, StatKey } from '../engine/types';

interface Props {
  state: GameState;
  onBuy: (item: ShopItem, targetNpcId?: string) => void;
  onClose: () => void;
}

// 효과 설명 생성
function describeEffects(item: ShopItem): string[] {
  const descs: string[] = [];
  for (const e of item.effects) {
    if (e.type === 'instant' && e.stat && e.value) {
      if (e.stat === 'fatigue') descs.push(`피로 ${e.value > 0 ? '+' : ''}${e.value}`);
      else if (e.stat === 'money') descs.push(`돈 ${e.value > 0 ? '+' : ''}${e.value}만`);
      else descs.push(`${STAT_LABELS[e.stat as StatKey]} ${e.value > 0 ? '+' : ''}${e.value}`);
    }
    if (e.type === 'buff' && e.buffDuration) {
      descs.push(`${e.buffDuration}주간 ${e.buffTarget === 'all' ? '전체' : e.buffTarget} +${Math.round((e.buffAmount || 0) * 100)}%`);
    }
    if (e.type === 'npc_intimacy' && e.npcBonus) {
      descs.push(`친밀도 +${e.npcBonus}`);
    }
    if (e.type === 'event_unlock') {
      descs.push('특별 기회 해금');
    }
  }
  return descs;
}

export function Shop({ state, onBuy, onClose }: Props) {
  const [selectedCat, setSelectedCat] = useState<ItemCategory>('consumable');
  const [buyMessage, setBuyMessage] = useState<string | null>(null);
  const [npcSelectItem, setNpcSelectItem] = useState<ShopItem | null>(null);

  const categories = Object.keys(SHOP_CATEGORIES) as ItemCategory[];
  const items = SHOP_ITEMS.filter(i => i.category === selectedCat);

  const handleBuy = (item: ShopItem) => {
    // 선물 아이템이면 NPC 선택 필요
    if (item.category === 'gift') {
      setNpcSelectItem(item);
      return;
    }
    onBuy(item);
    setBuyMessage(`${item.emoji} ${item.name} 구매 완료!`);
    setTimeout(() => setBuyMessage(null), 2000);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 150,
    }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(15,52,96,0.98), rgba(26,26,46,0.99))',
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>🛒 상점</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>현재 돈: {state.money}만원</div>
          </div>
          <span onClick={onClose} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px' }}>닫기 ✕</span>
        </div>

        {/* 카테고리 탭 */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px', overflowX: 'auto' }}>
          {categories.map(cat => {
            const info = SHOP_CATEGORIES[cat];
            const isActive = selectedCat === cat;
            return (
              <div key={cat} onClick={() => setSelectedCat(cat)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '0.78rem', fontWeight: isActive ? 700 : 400,
                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>
                {info.emoji} {info.name}
              </div>
            );
          })}
        </div>

        {/* 구매 메시지 */}
        {buyMessage && (
          <div style={{ padding: '6px 20px', fontSize: '0.8rem', color: 'var(--green)', textAlign: 'center', fontWeight: 600 }}>
            {buyMessage}
          </div>
        )}

        {/* 아이템 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {items.map(item => {
            const check = canBuyItem(item, state, state.weekPurchases || {});
            const effects = describeEffects(item);
            return (
              <div key={item.id} style={{
                padding: '12px 14px', marginBottom: 6, borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: check.ok ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.03)',
                opacity: check.ok ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '1.1rem' }}>{item.emoji}</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--yellow)' }}>{item.price}만원</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {item.description}
                    </div>
                    {/* 효과 태그 */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                      {effects.map((e, i) => (
                        <span key={i} style={{
                          fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(76,175,80,0.1)', color: 'var(--green)',
                        }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    disabled={!check.ok}
                    onClick={() => check.ok && handleBuy(item)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none', marginLeft: 10,
                      background: check.ok ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                      color: check.ok ? 'white' : 'var(--text-muted)',
                      cursor: check.ok ? 'pointer' : 'not-allowed',
                      fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
                    }}
                  >
                    {check.ok ? '구매' : check.reason}
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              아직 이 카테고리에 상품이 없어요
            </div>
          )}
        </div>

        {/* 활성 버프 표시 */}
        {state.activeBuffs && state.activeBuffs.length > 0 && (
          <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>활성 버프</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.activeBuffs.map(b => (
                <span key={b.id} style={{
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(91,141,239,0.15)', color: 'var(--blue)',
                }}>
                  {b.name} ({b.remainingWeeks}주)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* NPC 선택 모달 (선물용) */}
      {npcSelectItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 16, padding: 24,
            width: '85%', maxWidth: 360,
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>
              {npcSelectItem.emoji} {npcSelectItem.name} — 누구에게 줄까?
            </div>
            {state.npcs.filter(n => n.met).map(npc => (
              <div key={npc.id}
                onClick={() => {
                  onBuy(npcSelectItem, npc.id);
                  setBuyMessage(`${npcSelectItem.emoji} ${npc.name}에게 ${npcSelectItem.name}을 줬다!`);
                  setNpcSelectItem(null);
                  setTimeout(() => setBuyMessage(null), 2000);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 6,
                  cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <span style={{ fontSize: '1.2rem' }}>{npc.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{npc.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>친밀도 {Math.round(npc.intimacy)}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setNpcSelectItem(null)}
              style={{ marginTop: 8, width: '100%', padding: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
