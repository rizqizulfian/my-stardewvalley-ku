import Phaser from 'phaser';

/** Game-wide event bus shared by scenes and systems. */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  minute: 'time:minute',
  newDay: 'time:new-day',
  periodChanged: 'time:period',
  goldChanged: 'gold:changed',
  started: 'game:started',
  /** Inventory contents or selection changed. */
  inventoryChanged: 'inv:changed',
  /** (id, qty) an item entered the backpack. */
  itemGained: 'inv:gained',
  /** Soil or crops changed outside the farm view (e.g. overnight growth). */
  farmChanged: 'farm:changed',
  /** (open: boolean) a menu took or released the game. */
  menu: 'ui:menu',
  /** (text) short message near the hotbar. */
  notice: 'ui:notice',
} as const;
