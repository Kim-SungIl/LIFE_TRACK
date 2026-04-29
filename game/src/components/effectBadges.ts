// 이벤트 선택지의 결과 효과를 뱃지 배열로 변환 — GameScreen 결과 화면에서 사용.
// (EventScene은 결과 UI 제거 후 더 이상 필요 없어짐)

import type { EventChoice, StatKey } from '../engine/types';
import { STAT_LABELS, STAT_ICONS } from '../engine/types';

export interface EffectBadge {
  text: string;
  color: string;
}

export interface NpcDisplayInfo {
  id: string;
  name: string;
  emoji: string;
  met?: boolean;
}

/** 스탯/피로/돈/NPC 친밀도 변화 뱃지 */
export function buildEffectBadges(choice: EventChoice, npcs: NpcDisplayInfo[]): EffectBadge[] {
  const badges: EffectBadge[] = [];

  for (const [k, v] of Object.entries(choice.effects)) {
    const val = v as number;
    if (val !== 0) {
      badges.push({
        text: `${STAT_ICONS[k as StatKey]} ${STAT_LABELS[k as StatKey]} ${val > 0 ? '+' + val : val}`,
        color: val > 0 ? 'var(--green)' : 'var(--red)',
      });
    }
  }

  if (choice.fatigueEffect) {
    badges.push({
      text: `피로 ${choice.fatigueEffect > 0 ? '+' : ''}${choice.fatigueEffect}`,
      color: choice.fatigueEffect > 0 ? 'var(--red)' : 'var(--green)',
    });
  }

  if (choice.moneyEffect) {
    badges.push({
      text: `💰 ${choice.moneyEffect > 0 ? '+' : ''}${choice.moneyEffect}만`,
      color: choice.moneyEffect > 0 ? 'var(--green)' : 'var(--red)',
    });
  }

  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = npcs.find(n => n.id === ne.npcId);
      if (npc) {
        badges.push({
          text: `${npc.emoji} ${npc.name} ${ne.intimacyChange > 0 ? '♥' : '💔'}`,
          color: ne.intimacyChange > 0 ? 'var(--blue)' : 'var(--red)',
        });
      }
    }
  }

  return badges;
}

/** 첫 만남 알림 뱃지 — 결과 표시 시 buildEffectBadges 앞에 prepend */
export function buildNewMeetMessages(choice: EventChoice, npcs: NpcDisplayInfo[]): EffectBadge[] {
  const result: EffectBadge[] = [];
  if (!choice.npcEffects) return result;
  for (const ne of choice.npcEffects) {
    const npc = npcs.find(n => n.id === ne.npcId);
    if (npc && !npc.met) {
      result.push({ text: `🤝 ${npc.name}와(과) 알게 되었다!`, color: 'var(--yellow)' });
    }
  }
  return result;
}
