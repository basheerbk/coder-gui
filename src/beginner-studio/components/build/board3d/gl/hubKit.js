/*
 * The 3D component kit in module-test/: the RJ11 Hub, the module models, cables and the
 * mesh/texture helpers. The studio builds its WebGL scene from these so both share one design.
 */
export {default as Kit, at, disposeTree} from '../../../../../../module-test/lib/kit.js';
export {default as TextureBank} from '../../../../../../module-test/lib/textures.js';
export {default as buildCable, TABLE_Z} from '../../../../../../module-test/lib/cable.js';
export {buildModule, placeModule} from '../../../../../../module-test/lib/pcb.js';
export {buildJack, glowDecal, glowTexture, ownCopy} from '../../../../../../module-test/lib/parts.js';
export {JACK_H, PCB_H} from '../../../../../../module-test/lib/board-data.js';
export {OPEN_ROT, buildBoard} from '../../../../../../module-test/components/esp32-board.js';
export {default as MODELS} from '../../../../../../module-test/components/models.js';
