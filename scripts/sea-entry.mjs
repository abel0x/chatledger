import { getAsset, getAssetKeys } from 'node:sea';
import { launch } from './launch.mjs';
import { assetSource } from './serve.mjs';

// The single executable carries the built app inside itself and stops on its own when no tab is left.
void launch({
  source: assetSource(getAssetKeys(), key => getAsset(key)),
  idleExit: 3 * 60_000,
  argv: process.argv.slice(2),
});
