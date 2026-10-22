import Phaser from 'phaser';

/** Game-wide event bus shared by scenes and systems. */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  minute: 'time:minute',
  newDay: 'time:new-day',
  periodChanged: 'time:period',
  goldChanged: 'gold:changed',
  started: 'game:started',
  /** The player picked another farmer (Settings). */
  heroChanged: 'game:hero-changed',
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
  /** Energy, hunger, thirst or alertness changed. */
  needsChanged: 'needs:changed',
  /** 2:00 came before bed: the scene runs the pass-out sequence. */
  passOut: 'time:pass-out',
  /** (DialogRequest) show a text box, optionally with choices. */
  dialog: 'ui:dialog',
  /** (shopId) open a shop menu. */
  shop: 'ui:shop',
  /** (DaySummary) show the overnight summary; the UI emits dayDone when closed. */
  daySummary: 'ui:day-summary',
  dayDone: 'ui:day-done',
} as const;
