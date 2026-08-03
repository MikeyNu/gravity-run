import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface AssetEntry {
  id: string;
  type: 'model' | 'texture' | 'audio' | 'module' | 'vfx';
  source: string;
  runtime: string;
  requiredForCoreLoad: boolean;
  budget: {
    transferKilobytes: number;
    gpuMegabytes?: number;
  };
}

interface AssetManifest {
  version: number;
  assets: AssetEntry[];
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error('Usage: validateManifest <manifest.json>');
}

const absolutePath = resolve(process.cwd(), manifestPath);
const manifest = JSON.parse(await readFile(absolutePath, 'utf8')) as AssetManifest;
const errors: string[] = [];
const ids = new Set<string>();

if (manifest.version !== 1) errors.push('Manifest version must be 1.');
if (!Array.isArray(manifest.assets)) errors.push('Manifest assets must be an array.');

for (const asset of manifest.assets ?? []) {
  if (!asset.id || !/^[a-z0-9][a-z0-9-/.]+$/.test(asset.id)) {
    errors.push(`Invalid asset id: ${asset.id}`);
  }
  if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
  ids.add(asset.id);

  if (!asset.source.startsWith('content/source/')) {
    errors.push(`${asset.id}: source must be under content/source/.`);
  }
  if (!asset.runtime.startsWith('content/exported/')) {
    errors.push(`${asset.id}: runtime output must be under content/exported/.`);
  }
  if (asset.budget.transferKilobytes <= 0) {
    errors.push(`${asset.id}: transfer budget must be positive.`);
  }
}

const coreTransferKilobytes = manifest.assets
  .filter((asset) => asset.requiredForCoreLoad)
  .reduce((sum, asset) => sum + asset.budget.transferKilobytes, 0);

if (coreTransferKilobytes > 3500) {
  errors.push(`Core transfer budget is ${coreTransferKilobytes} KB; limit is 3500 KB.`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${manifest.assets.length} assets. Core transfer: ${coreTransferKilobytes} KB.`);
}
