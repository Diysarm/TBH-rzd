// Back-compat re-exports — prefer `core/inventory/*` modules.

export {
  parseInventory,
  resolveInventory,
  ownedMarketNames,
  type PriceLookup,
} from "./inventory/index";
