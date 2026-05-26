/**
 * migrate-photo-paths.mjs — Phase 15 v1.1 window.
 *
 * Mueve archivos de fotos en Supabase Storage del path viejo al path nuevo
 * (incluyendo el nivel `parcelas/` de v1.1) y actualiza trees.foto_url en DB.
 *
 * Path viejo: plantations/<OLD_plantation_id>/trees/<tree_id>.jpg
 * Path nuevo: plantations/<NEW_plantation_id>/parcelas/<parcela_id>/trees/<tree_id>.jpg
 *
 * Solo migra trees que están en las 3 plantations consolidadas (identificadas
 * porque su group.parcela_id IS NOT NULL — solo los grupos reasignados por 014
 * tienen parcela_id seteada).
 *
 * Idempotente:
 *   - Si el archivo ya está en el path nuevo → skip + update foto_url igual.
 *   - Si foto_url ya tiene el path nuevo → skip completo.
 *   - Si foto_url es file:// o content:// (URI local que nunca subió) → skip.
 *
 * NO borra el archivo viejo de Storage — eso lo hace cleanup-orphan-photos.mjs
 * después de que 015 elimine las 21 source plantations.
 *
 * Uso:
 *   SUPABASE_SERVICE_KEY=<service_role> node scripts/migrate-photo-paths.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://apktttwrmhamfudjeklu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'tree-photos';

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard)');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function buildNewPath(plantationId, parcelaId, treeId) {
  return `plantations/${plantationId}/parcelas/${parcelaId}/trees/${treeId}.jpg`;
}

function isLocalUri(uri) {
  return uri.startsWith('file://') || uri.startsWith('content://');
}

async function fetchCandidates() {
  // Trees con foto_url IS NOT NULL en grupos con parcela_id seteado.
  // PostgREST embedded select: groups(plantation_id, parcela_id) trae el FK.
  const { data, error } = await supabase
    .from('trees')
    .select('id, foto_url, group_id, groups!inner(plantation_id, parcela_id)')
    .not('foto_url', 'is', null)
    .not('groups.parcela_id', 'is', null);
  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }
  return data ?? [];
}

async function migrateOne(tree) {
  const oldPath = tree.foto_url;
  const newPath = buildNewPath(tree.groups.plantation_id, tree.groups.parcela_id, tree.id);

  if (isLocalUri(oldPath)) {
    return { status: 'skip_local', tree };
  }
  if (oldPath === newPath) {
    return { status: 'skip_already_new', tree };
  }

  if (dryRun) {
    return { status: 'would_copy', tree, oldPath, newPath };
  }

  // Intentar copiar del path viejo al nuevo.
  const { error: copyError } = await supabase.storage.from(BUCKET).copy(oldPath, newPath);

  if (copyError) {
    const msg = copyError.message ?? '';
    if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
      // Destination ya existe — ok, idempotente. Solo actualizamos foto_url.
    } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist')) {
      // Source no existe — foto_url apunta a archivo que nunca subió.
      return { status: 'missing_source', tree, oldPath, error: msg };
    } else {
      return { status: 'copy_error', tree, oldPath, newPath, error: msg };
    }
  }

  // Update foto_url en DB.
  const { error: updateError } = await supabase
    .from('trees')
    .update({ foto_url: newPath })
    .eq('id', tree.id);
  if (updateError) {
    return { status: 'update_error', tree, newPath, error: updateError.message };
  }

  return { status: 'migrated', tree, oldPath, newPath };
}

async function main() {
  const trees = await fetchCandidates();
  console.log(`Candidates: ${trees.length} trees in consolidated plantations with foto_url`);

  const counts = {
    migrated: 0,
    skip_local: 0,
    skip_already_new: 0,
    would_copy: 0,
    missing_source: 0,
    copy_error: 0,
    update_error: 0,
  };
  const failures = [];

  for (let i = 0; i < trees.length; i++) {
    const result = await migrateOne(trees[i]);
    counts[result.status]++;
    if (result.status === 'copy_error' || result.status === 'update_error' || result.status === 'missing_source') {
      failures.push(result);
    }
    if ((i + 1) % 50 === 0 || i === trees.length - 1) {
      console.log(`Progress: ${i + 1}/${trees.length}`);
    }
  }

  console.log(`\n--- Summary ${dryRun ? '(DRY RUN)' : ''} ---`);
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }

  if (failures.length > 0) {
    console.log(`\n--- Failures (${failures.length}) ---`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.status} | tree=${f.tree.id} | ${f.oldPath ?? f.newPath} | ${f.error ?? ''}`);
    }
    if (failures.length > 20) console.log(`  ...and ${failures.length - 20} more`);
  }
}

main();
