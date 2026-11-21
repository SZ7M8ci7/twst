import { getInputMaxLevel } from '@/constants/levels';
import type { RosterCard } from '@/domain/examSearch/types';

export function maxSkillsCard(name: string, level: number, totsu: number): RosterCard {
  return { name, level, totsu, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true };
}

export function fullyTrainedCard(card: { name: string; rare: string }): RosterCard {
  return maxSkillsCard(card.name, getInputMaxLevel(card.rare), 4);
}
