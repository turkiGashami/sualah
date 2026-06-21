// Public surface of @sualah/game-core.

export * from "./types.js";
export * from "./rng.js";
export * from "./roles.js";
export {
  GameError,
  init,
  reduce,
  onPhaseTimeout,
  checkEnd,
  isPhaseComplete,
  phaseDurationMs,
  derivePublicState,
  derivePlayerSecret,
  deriveGhostView,
  type InitInput,
  type GameAction,
  type PlayerSecret,
} from "./module.js";

import {
  init,
  reduce,
  onPhaseTimeout,
  checkEnd,
  isPhaseComplete,
  phaseDurationMs,
  derivePublicState,
  derivePlayerSecret,
  deriveGhostView,
} from "./module.js";

/**
 * The module the brief (§4.3) asks game-core to export: init (role
 * distribution), reduce (night abilities / voting), onPhaseTimeout, checkEnd —
 * plus the projections and helpers Edge Functions need.
 */
export const sualahModule = {
  init,
  reduce,
  onPhaseTimeout,
  checkEnd,
  isPhaseComplete,
  phaseDurationMs,
  derivePublicState,
  derivePlayerSecret,
  deriveGhostView,
} as const;
