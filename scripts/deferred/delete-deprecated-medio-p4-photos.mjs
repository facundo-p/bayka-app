/**
 * DEFERRED — NO ejecutar como parte del window v1.1.
 *
 * Borra archivos físicos en bucket `tree-photos` bajo la carpeta
 * `plantations/51fea9e5-2537-4cef-82fd-c07d6375dbf0/trees/` correspondientes
 * a la plantación "SSS-Medio-P4-deprecated".
 *
 * Uso:
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<service_role> \
 *     node scripts/deferred/delete-deprecated-medio-p4-photos.mjs [--dry-run]
 *
 * Debe correrse ANTES de `delete-deprecated-medio-p4.sql` (cuando la fila
 * de la plantación sigue viva), porque usa el plantation_id para construir
 * el path del bucket.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PLANT_ID = '51fea9e5-2537-4cef-82fd-c07d6375dbf0';
const BUCKET = 'tree-photos';
const FOLDER = `plantations/${PLANT_ID}/trees`;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Listar archivos en la carpeta del bucket.
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 1000 });

  if (listError) {
    console.error('List error:', listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log(`No files in ${FOLDER}. Nothing to delete.`);
    return;
  }

  console.log(`Found ${files.length} files under ${FOLDER}\n`);

  const paths = files.map((f) => `${FOLDER}/${f.name}`);

  if (dryRun) {
    console.log('--- DRY RUN ---');
    paths.forEach((p) => console.log(`  would delete: ${p}`));
    console.log(`\nTotal: ${paths.length} files would be deleted.`);
    return;
  }

  // 2. Borrar en batch.
  const { data: deleted, error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(paths);

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted ${deleted?.length ?? 0} files.`);
}

main();
