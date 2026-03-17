import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
});

export const subgroups = sqliteTable('subgroups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default('linea'),
  estado: text('estado').notNull().default('recording'),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
});

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  subgrupoId: text('subgrupo_id').notNull().references(() => subgroups.id),
  especieId: text('especie_id').references(() => species.id),
  posicion: integer('posicion').notNull(),
  subId: text('sub_id').notNull(),
  fotoUrl: text('foto_url'),
  usuarioRegistro: text('usuario_registro').notNull(),
  createdAt: text('created_at').notNull(),
});
