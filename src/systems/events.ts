import Phaser from 'phaser';

/** Game-wide event bus shared by scenes and systems. */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  minute: 'time:minute',
  newDay: 'time:new-day',
  periodChanged: 'time:period',
  goldChanged: 'gold:changed',
  started: 'game:started',
} as const;
