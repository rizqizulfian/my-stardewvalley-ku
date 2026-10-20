// Entry point for all generated art. Swap the sink (or replace this function
// with an atlas loader that registers the same keys) to move to PNG art.

import { PLAYER } from '../config';
import { CHARACTERS } from '../data/characters';
import { buildCharacterFrames } from './characters';
import { registerFx } from './fx';
import type { TextureSink } from './pixel';
import { registerProps } from './props';
import { registerTerrain } from './terrain';

export function registerAllArt(sink: TextureSink): void {
  registerTerrain(sink);
  registerProps(sink);
  registerFx(sink);
  for (const c of CHARACTERS) {
    sink.sheet(c.texture, buildCharacterFrames(c.look), PLAYER.frameWidth, PLAYER.frameHeight, 6);
  }
}
