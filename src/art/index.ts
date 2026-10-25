// Entry point for all generated art. Swap the sink (or replace this function
// with an atlas loader that registers the same keys) to move to PNG art.

import { PLAYER } from '../config';
import { HEROES } from '../data/heroes';
import { CHAR_FRAMES, buildCharacterFrames } from './characters';
import { registerBuildings } from './buildings';
import { registerDisco } from './disco';
import { registerExtras } from './extras';
import { registerFarmArt } from './farm';
import { registerFx } from './fx';
import { registerIntroArt } from './intro';
import { registerItemArt } from './items';
import { registerNpcArt } from './npcs';
import type { TextureSink } from './pixel';
import { registerProps } from './props';
import { registerTerrain } from './terrain';

export function registerAllArt(sink: TextureSink): void {
  registerTerrain(sink);
  registerProps(sink);
  registerBuildings(sink);
  registerFx(sink);
  registerItemArt(sink);
  for (const h of HEROES) {
    if (h.look) sink.sheet(h.texture, buildCharacterFrames(h.look), PLAYER.frameWidth, PLAYER.frameHeight, CHAR_FRAMES.perFacing);
  }
  registerNpcArt(sink);
  registerExtras(sink);
  registerDisco(sink);
  registerFarmArt(sink);
  registerIntroArt(sink);
}
