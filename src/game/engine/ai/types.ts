import { PlayerState, EnemyState, BreakableState, MapId } from '@/types/game';
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
