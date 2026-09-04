/**
 * Borra en batch, vía Storage API, las carpetas `plantations/<uuid>/` del bucket `tree-photos`
 * cuyo uuid ya no existe en la tabla plantations. Borrar filas de storage.objects por SQL deja
 * los archivos físicos huérfanos; por eso va por API. Idempotente; no toca plantaciones vivas.
 *
 * Uso:
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<service_role> \
 *     node scripts/cleanup-orphan-photos.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'tree-photos';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listPlantationFolders() {
  const { data, error } = await supabase.storage.from(BUCKET).list('plantations', { limit: 1000 });
  if (error) {
    console.error('List plantations folder error:', error.message);
    process.exit(1);
  }
  // Folders aparecen como entries con id=null + metadata=null. Filtramos.
  return (data ?? []).filter((e) => !e.metadata).map((e) => e.name);
}

async function fetchLivePlantationIds() {
  const { data, error } = await supabase.from('plantations').select('id');
  if (error) {
    console.error('Query live plantations error:', error.message);
    process.exit(1);
  }
  return new Set((data ?? []).map((p) => p.id));
}

async function listFilesRecursive(prefix) {
  // Recorre recursivamente todos los archivos bajo `prefix/` en el bucket.
  // Devuelve array de paths completos.
  const out = [];
  async function walk(dir) {
    const { data, error } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (error) {
      console.error(`List ${dir} error:`, error.message);
      return;
    }
    for (const entry of data ?? []) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.metadata) {
        out.push(fullPath);
      } else {
        await walk(fullPath);
      }
    }
  }
  await walk(prefix);
  return out;
}

async function deleteBatch(paths) {
  if (paths.length === 0) return { deleted: 0, error: null };
  // Supabase Storage `remove()` acepta array de paths.
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  return { deleted: data?.length ?? 0, error };
}

async function main() {
  const folders = await listPlantationFolders();
  console.log(`Found ${folders.length} subfolders under plantations/`);

  const liveIds = await fetchLivePlantationIds();
  console.log(`Live plantation IDs in DB: ${liveIds.size}`);

  const orphanFolders = folders.filter((f) => !liveIds.has(f));
  console.log(`Orphan folders to clean: ${orphanFolders.length}`);
  if (orphanFolders.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let totalDeleted = 0;
  const failures = [];

  for (const folder of orphanFolders) {
    const prefix = `plantations/${folder}`;
    const files = await listFilesRecursive(prefix);
    console.log(`  ${folder}: ${files.length} files`);

    if (dryRun) {
      totalDeleted += files.length;
      continue;
    }

    // Borrar en chunks de 100 (límite seguro de Storage remove API).
    for (let i = 0; i < files.length; i += 100) {
      const chunk = files.slice(i, i + 100);
      const { deleted, error } = await deleteBatch(chunk);
      if (error) {
        failures.push({ folder, error: error.message });
        break;
      }
      totalDeleted += deleted;
    }
  }

  console.log(`\n--- Summary ${dryRun ? '(DRY RUN)' : ''} ---`);
  console.log(`Folders processed: ${orphanFolders.length}`);
  console.log(`Files ${dryRun ? 'would be deleted' : 'deleted'}: ${totalDeleted}`);
  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    failures.forEach((f) => console.log(`  ${f.folder}: ${f.error}`));
  }
}

main();
