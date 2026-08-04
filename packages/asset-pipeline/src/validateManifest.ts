import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface AssetEntry {
  id: string;
  type: 'model' | 'texture' | 'audio' | 'module' | 'vfx';
  source: string;
  generator?: string;
  runtime: string;
  requiredForCoreLoad: boolean;
  license: string;
  budget: { transferKilobytes: number; gpuMegabytes?: number };
}

interface AssetManifest { version: number; assets: AssetEntry[] }
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: validateManifest <manifest.json>');
const repositoryRoot = process.cwd();
const absolutePath = resolve(repositoryRoot, manifestPath);
const manifest = JSON.parse(await readFile(absolutePath, 'utf8')) as AssetManifest;
const errors: string[] = [];
const ids = new Set<string>();
if (manifest.version !== 2) errors.push('Manifest version must be 2.');
if (!Array.isArray(manifest.assets)) errors.push('Manifest assets must be an array.');

async function sizeOf(path: string): Promise<number | null> {
  const absolute = resolve(repositoryRoot, path);
  try {
    const metadata = await stat(absolute);
    if (metadata.isFile()) return metadata.size;
    if (!metadata.isDirectory()) return null;
    const entries = await readdir(absolute, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const child = await sizeOf(`${path}/${entry.name}`);
      if (child !== null) total += child;
    }
    return total;
  } catch {
    return null;
  }
}

for (const asset of manifest.assets ?? []) {
  if (!asset.id || !/^[a-z0-9][a-z0-9-/.]+$/.test(asset.id)) errors.push(`Invalid asset id: ${asset.id}`);
  if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
  ids.add(asset.id);
  const validSource = ['content/source/', 'docs/reference/', 'apps/game/public/', 'tools/asset-authoring/'].some((prefix) => asset.source.startsWith(prefix));
  if (!validSource) errors.push(`${asset.id}: source must be in an approved source or authoring path.`);
  if (!asset.runtime.startsWith('content/exported/') && !asset.runtime.startsWith('apps/game/public/')) errors.push(`${asset.id}: runtime output must be under content/exported/ or apps/game/public/.`);
  if (asset.runtime.includes('://')) errors.push(`${asset.id}: runtime references must not be external URLs.`);
  if (!asset.license.trim()) errors.push(`${asset.id}: license provenance is required.`);
  if (asset.budget.transferKilobytes <= 0) errors.push(`${asset.id}: transfer budget must be positive.`);
  const sourceBytes = await sizeOf(asset.source);
  if (sourceBytes === null) errors.push(`${asset.id}: source does not exist: ${asset.source}`);
  const bytes = await sizeOf(asset.runtime);
  if (bytes === null) errors.push(`${asset.id}: runtime output does not exist: ${asset.runtime}`);
  else if (bytes > asset.budget.transferKilobytes * 1024) errors.push(`${asset.id}: ${Math.ceil(bytes / 1024)} KB exceeds ${asset.budget.transferKilobytes} KB budget.`);
  if (asset.generator && (await sizeOf(asset.generator)) === null) errors.push(`${asset.id}: generator does not exist: ${asset.generator}`);
}

const coreModelKilobytes = manifest.assets.filter((asset) => asset.requiredForCoreLoad && (asset.type === 'model' || asset.type === 'module')).reduce((sum, asset) => sum + asset.budget.transferKilobytes, 0);
if (coreModelKilobytes > 3500) errors.push(`Core model transfer budget is ${coreModelKilobytes} KB; limit is 3500 KB.`);
if (errors.length > 0) { console.error(errors.map((error) => `- ${error}`).join('\n')); process.exitCode = 1; }
else console.log(`Validated ${manifest.assets.length} assets. Core model budget: ${coreModelKilobytes} KB.`);
