import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { GROUP_TIPO_DEFAULT } from '../constants/groupTipo';

export const species = sqliteTable('species', {
  id: text('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  nombreCientifico: text('nombre_cientifico'),
  createdAt: text('created_at').notNull(),
});

export const plantations = sqliteTable('plantations', {
  id: text('id').primaryKey(),
  organizacionId: text('organizacion_id').notNull(),
  lugar: text('lugar').notNull(),
  periodo: text('periodo').notNull(),
  estado: text('estado').notNull().default('activa'),
  creadoPor: text('creado_por').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
  pendingEdit: integer('pending_edit', { mode: 'boolean' }).notNull().default(false),
  lugarServer: text('lugar_server'),
  periodoServer: text('periodo_server'),
  // Default duplicado en migraciones 0015 (local) y 023 (Supabase); revisar los tres lugares si cambia.
  gpsCaptureFrequency: integer('gps_capture_frequency')
    .notNull()
    .default(GPS_CAPTURE_FREQUENCY_DEFAULT),
  gpsCaptureRequired: integer('gps_capture_required', { mode: 'boolean' })
    .notNull()
    .default(GPS_CAPTURE_REQUIRED_DEFAULT),
  // Snapshot del server (como lugarServer/periodoServer) para que discardPlantationEdit
  // revierta ediciones offline de la config GPS. Null = sin snapshot todavía (migración 0016).
  gpsCaptureFrequencyServer: integer('gps_capture_frequency_server'),
  gpsCaptureRequiredServer: integer('gps_capture_required_server', { mode: 'boolean' }),
  // Visibilidad administrada desde la web de gestión: técnicos no ven plantaciones ocultas; el sync no se ve afectado.
  visibleInApp: integer('visible_in_app', { mode: 'boolean' }).notNull().default(true),
});

export const parcelas = sqliteTable('parcelas', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  descripcion: text('descripcion'),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  // PARTIAL unique indexes: tombstones (deleted_at NOT NULL) quedan excluidos del
  // uniqueness check, para poder reusar nombre/codigo de parcelas borradas.
  uniqueCode: uniqueIndex('parcelas_plantation_code_unique')
    .on(t.plantacionId, t.codigo)
    .where(sql`deleted_at IS NULL`),
  uniqueName: uniqueIndex('parcelas_plantation_name_unique')
    .on(t.plantacionId, t.nombre)
    .where(sql`deleted_at IS NULL`),
}));

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  // #90: todo grupo tiene parcela — la ausencia es dato inválido, no caso
  // válido (los datos legacy ya se migraron).
  parcelaId: text('parcela_id').notNull().references(() => parcelas.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default(GROUP_TIPO_DEFAULT),
  estado: text('estado').notNull().default('activa'),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueCode: uniqueIndex('groups_parcela_code_unique').on(t.parcelaId, t.codigo),
  uniqueName: uniqueIndex('groups_parcela_name_unique').on(t.parcelaId, t.nombre),
}));

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),
  especieId: text('especie_id').references(() => species.id),
  posicion: integer('posicion').notNull(),
  subId: text('sub_id').notNull(),
  fotoUrl: text('foto_url'),
  fotoSynced: integer('foto_synced', { mode: 'boolean' }).notNull().default(false),
  plantacionId: integer('plantacion_id'),
  globalId: integer('global_id'),
  usuarioRegistro: text('usuario_registro').notNull(),
  createdAt: text('created_at').notNull(),
  conflictEspecieId: text('conflict_especie_id'),
  conflictEspecieNombre: text('conflict_especie_nombre'),
  // Punto GPS capturado al registrar el árbol; null en árboles históricos o
  // cuando por frecuencia/señal no correspondió capturar.
  latitude: real('latitude'),
  longitude: real('longitude'),
  gpsAccuracy: real('gps_accuracy'),
  gpsCapturedAt: text('gps_captured_at'),
});

export const plantationSpecies = sqliteTable('plantation_species', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  especieId: text('especie_id').notNull().references(() => species.id),
  ordenVisual: integer('orden_visual').notNull().default(0),
});

export const userSpeciesOrder = sqliteTable('user_species_order', {
  userId: text('user_id').notNull(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  especieId: text('especie_id').notNull().references(() => species.id),
  ordenVisual: integer('orden_visual').notNull(),
}, (t) => ({
  pk: uniqueIndex('user_species_order_pk').on(t.userId, t.plantacionId, t.especieId),
}));

export const plantationUsers = sqliteTable('plantation_users', {
  plantationId: text('plantation_id').notNull().references(() => plantations.id),
  userId: text('user_id').notNull(),
  rolEnPlantacion: text('rol_en_plantacion').notNull().default('tecnico'),
  assignedAt: text('assigned_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('plantation_users_pk').on(t.plantationId, t.userId),
}));
