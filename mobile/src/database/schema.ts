import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../constants/photoCapture';
import { VISIBLE_IN_APP_DEFAULT } from '../constants/visibilidad';
import { GROUP_TIPO_DEFAULT } from '../constants/groupTipo';
import { ESTADO_GRUPO, ESTADO_PLANTACION } from '../constants/estados';
import type { CamposDePlantacion } from '../utils/camposDePlantacion';
import type { ConflictoDeCampo } from '../utils/conflictosDeEdicion';
import type { MotivoVarado } from '../constants/motivoVarado';

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
  estado: text('estado').notNull().default(ESTADO_PLANTACION.activa),
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
  // Técnicos no ven plantaciones ocultas; el sync no se ve afectado.
  visibleInApp: integer('visible_in_app', { mode: 'boolean' }).notNull().default(VISIBLE_IN_APP_DEFAULT),
  // Foto en todos los botones de la botonera (#439). Default duplicado en 0019 (local) y 035 (Supabase).
  photoCaptureAllTrees: integer('photo_capture_all_trees', { mode: 'boolean' })
    .notNull()
    .default(PHOTO_CAPTURE_ALL_TREES_DEFAULT),
  // Snapshots *Server de foto y visibilidad: editables offline desde #633, como lugar/periodo.
  photoCaptureAllTreesServer: integer('photo_capture_all_trees_server', { mode: 'boolean' }),
  visibleInAppServer: integer('visible_in_app_server', { mode: 'boolean' }),
  descripcion: text('descripcion'),
  // YYYY-MM-DD, espejo del `date` de Supabase.
  fechaInicio: text('fecha_inicio'),
  // Entero >= 1 o null; el CHECK vive en Supabase.
  objetivoArboles: integer('objetivo_arboles'),
  descripcionServer: text('descripcion_server'),
  fechaInicioServer: text('fecha_inicio_server'),
  objetivoArbolesServer: integer('objetivo_arboles_server'),
  // Archivada desde la web (#477): null = no archivada. Ver esArchivada.
  archivadaEn: text('archivada_en'),
  // Solo local (#478): cuándo el server respondió por primera vez que la plantación fue eliminada. Null = existe.
  eliminadaEnServidorEn: text('eliminada_en_servidor_en'),
  // Solo local (#634): lo que el server tenía al entrar en edición offline. El pull no la toca.
  baseDeEdicion: text('base_de_edicion', { mode: 'json' }).$type<Partial<CamposDePlantacion>>(),
  editadaLocalmenteEn: text('editada_localmente_en'),
  // Solo local (#634): campos que chocaron con la web, hasta que el usuario elija. Null = ninguno.
  conflictosDeEdicion: text('conflictos_de_edicion', { mode: 'json' }).$type<ConflictoDeCampo[]>(),
  // Solo local (#638): por qué lo pendiente no puede subir. Null = nada varado.
  motivoVarado: text('motivo_varado').$type<MotivoVarado>(),
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
  // Los dos de arriba son PARCIALES: solo sirven si la query filtra deleted_at.
  // El pull no lo hace (#449).
  porPlantacion: index('parcelas_plantacion_id_idx').on(t.plantacionId),
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
  estado: text('estado').notNull().default(ESTADO_GRUPO.activa),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueCode: uniqueIndex('groups_parcela_code_unique').on(t.parcelaId, t.codigo),
  uniqueName: uniqueIndex('groups_parcela_name_unique').on(t.parcelaId, t.nombre),
  // parcelaId no necesita índice propio: es la columna izquierda de los dos de arriba.
  porPlantacion: index('groups_plantacion_id_idx').on(t.plantacionId),
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
}, (t) => ({
  // La tabla más grande, y todo la consulta por grupo: el pull, las pantallas y
  // la bajada de fotos. SQLite no indexa las FK solo (#449).
  porGrupo: index('trees_group_id_idx').on(t.groupId),
}));

export const plantationSpecies = sqliteTable('plantation_species', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  especieId: text('especie_id').notNull().references(() => species.id),
  ordenVisual: integer('orden_visual').notNull().default(0),
}, (t) => ({
  porPlantacion: index('plantation_species_plantacion_id_idx').on(t.plantacionId),
}));

export const userSpeciesOrder = sqliteTable('user_species_order', {
  userId: text('user_id').notNull(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  especieId: text('especie_id').notNull().references(() => species.id),
  ordenVisual: integer('orden_visual').notNull(),
}, (t) => ({
  pk: uniqueIndex('user_species_order_pk').on(t.userId, t.plantacionId, t.especieId),
}));

/**
 * Altas y bajas de especies de una plantación que todavía no llegaron al server (#635).
 * Una fila por par: el último cambio gana. Una plantación sin subir (pendingSync) anota
 * solo las bajas: su alta sube todas sus especies como altas, junto con esas bajas.
 */
export const cambiosEspeciesPendientes = sqliteTable('cambios_especies_pendientes', {
  plantacionId: text('plantacion_id').notNull(),
  especieId: text('especie_id').notNull(),
  /** `CAMBIO_DE_ESPECIE`. */
  tipo: text('tipo').notNull(),
  cambiadoEn: text('cambiado_en').notNull(),
}, (t) => ({
  pk: uniqueIndex('cambios_especies_pendientes_pk').on(t.plantacionId, t.especieId),
}));

/**
 * Técnicos activos de la organización, para asignarlos sin conexión (#636). Lo
 * refresca el sync de un admin; se reemplaza entero.
 */
export const tecnicosDeOrganizacion = sqliteTable('tecnicos_de_organizacion', {
  id: text('id').primaryKey(),
  organizacionId: text('organizacion_id').notNull(),
  nombre: text('nombre').notNull(),
});

/**
 * Asignaciones de técnicos hechas en el teléfono que todavía no llegaron al server
 * (#636). Ya están aplicadas en `plantation_users`; quitar es solo online.
 */
export const altasDeTecnicosPendientes = sqliteTable('altas_de_tecnicos_pendientes', {
  plantacionId: text('plantacion_id').notNull(),
  userId: text('user_id').notNull(),
  /** El que tenía al asignarlo: si sale del caché (dado de baja), la fila sigue mostrándose. */
  nombre: text('nombre').notNull().default(''),
  asignadoEn: text('asignado_en').notNull(),
}, (t) => ({
  pk: uniqueIndex('altas_de_tecnicos_pendientes_pk').on(t.plantacionId, t.userId),
}));

/**
 * Borrados hechos localmente que todavía no llegaron al server (#467). El pull los
 * excluye y el push los propaga; al confirmar el server, la fila se va de acá.
 *
 * Registro y no un `deleted_at` en `trees`: un tombstone obligaría a filtrar en
 * todas las lecturas de árboles, que están por todo el código.
 */
export const borradosPendientes = sqliteTable('borrados_pendientes', {
  /** El id del árbol o del grupo borrado. */
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  /** Solo árboles: permite excluirlos del pull sin tocar la tabla `trees`. */
  grupoId: text('grupo_id'),
  plantacionId: text('plantacion_id').notNull(),
  borradoEn: text('borrado_en').notNull(),
}, (t) => ({
  porPlantacion: index('borrados_pendientes_plantacion_idx').on(t.plantacionId),
}));

export const plantationUsers = sqliteTable('plantation_users', {
  plantationId: text('plantation_id').notNull().references(() => plantations.id),
  userId: text('user_id').notNull(),
  rolEnPlantacion: text('rol_en_plantacion').notNull().default('tecnico'),
  assignedAt: text('assigned_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('plantation_users_pk').on(t.plantationId, t.userId),
}));
