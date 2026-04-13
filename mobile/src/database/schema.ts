import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
});

export const subgroups = sqliteTable('subgroups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default('linea'),
  estado: text('estado').notNull().default('activa'),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueCode: uniqueIndex('subgroups_plantation_code_unique').on(t.plantacionId, t.codigo),
  uniqueName: uniqueIndex('subgroups_plantation_name_unique').on(t.plantacionId, t.nombre),
}));

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  subgrupoId: text('subgrupo_id').notNull().references(() => subgroups.id),
  especieId: text('especie_id').references(() => species.id),
  posicion: integer('posicion').notNull(),
  subId: text('sub_id').notNull(),
  fotoUrl: text('foto_url'),
  fotoSynced: integer('foto_synced', { mode: 'boolean' }).notNull().default(false),
  plantacionId: integer('plantacion_id'),
  globalId: integer('global_id'),
  usuarioRegistro: text('usuario_registro').notNull(),
  createdAt: text('created_at').notNull(),
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
