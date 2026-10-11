import {
  PlayerState,
  BreakableState,
  MapId,
  QuestState,
  ParticleState,
  ProjectileState,
} from '@/types/game';
import { MapData } from '../../worldData';

export interface EnemyAIContext {
  dt: number;
  player: PlayerState;
  currentMap: MapId;
  currentMapData: MapData;
  overworldMap: MapData;
  dungeonMap: MapData;
  breakables: BreakableState[];
  isGateOpen: boolean;
  applyPlayerDamage: (damage: number, knockX: number, knockZ: number) => void;
}

export interface BossAIContext extends EnemyAIContext {
  quest: QuestState;
  activeParticles: ParticleState[];
  projectiles: ProjectileState[];
  triggerScreenShake: (amount: number) => void;
  triggerDamageFlash: (amount: number) => void;
}
