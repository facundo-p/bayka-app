/**
 * Datos de mentira para el servidor de demo (`npm run dev:demo`). Números y
 * nombres verosímiles a propósito: el punto es ver la app con anchos de columna
 * y conteos reales, que es donde aparecen los problemas de layout.
 *
 * Para cubrir una pantalla nueva, agregá su tabla a `TABLAS` y, si otra la
 * embebe, la FK a `COLUMNA_QUE_APUNTA_A`.
 */

export type FilaDemo = Record<string, unknown>;

/** Cuántas filas comparten los valores de `fila`: cuenta miles de árboles sin
 *  materializarlos. `fila` se filtra igual que una fila real. */
export type ConteoDemo = { fila: FilaDemo; cantidad: number };

/** Una tabla del backend falso. Si tiene `conteos`, responden los
 *  `select(head, count)` en lugar de `filas`. */
export type TablaDemo = {
  filas: FilaDemo[];
  conteos?: ConteoDemo[];
};

type Especie = { id: string; codigo: string; nombre: string; nombre_cientifico: string | null };

export const SESION_DEMO = { user: { id: 'u1', email: 'demo@bayka.app' } };

const ORGANIZACION = { id: 'org-1', nombre: 'Bayka' };

const PERFILES: FilaDemo[] = [
  { id: 'u1', nombre: 'Facundo Pichinini', rol: 'superadmin', email: 'demo@bayka.app', activo: true, created_at: '2024-01-18T12:00:00Z' },
  { id: 'u2', nombre: 'Sofía Bianchi', rol: 'admin', email: 'sofia@bayka.app', activo: true, created_at: '2024-04-18T12:00:00Z' },
  { id: 'u3', nombre: 'Martín Oyola', rol: 'tecnico', email: 'martin@bayka.app', activo: true, created_at: '2024-06-02T12:00:00Z' },
  { id: 'u4', nombre: 'Lucía Ferreyra', rol: 'tecnico', email: 'lucia@bayka.app', activo: true, created_at: '2024-09-11T12:00:00Z' },
  { id: 'u5', nombre: 'Ramiro Ledesma', rol: 'tecnico', email: 'ramiro@bayka.app', activo: false, created_at: '2025-02-27T12:00:00Z' },
  { id: 'u6', nombre: 'Valentina Cáceres', rol: 'tecnico', email: 'valentina@bayka.app', activo: true, created_at: '2025-05-06T12:00:00Z' },
].map((perfil) => ({ ...perfil, organizacion_id: ORGANIZACION.id }));

const PLANTACIONES: FilaDemo[] = [
  { id: 'p1', lugar: 'San Sebastián', periodo: '2025-2026', estado: 'activa', created_at: '2025-03-12T12:00:00Z', visible_in_app: true },
  { id: 'p2', lugar: 'Estancia La Escondida', periodo: '2025-2026', estado: 'activa', created_at: '2025-04-04T12:00:00Z', visible_in_app: true },
  { id: 'p3', lugar: 'Campo Los Molles', periodo: '2025-2026', estado: 'activa', created_at: '2025-05-19T12:00:00Z', visible_in_app: true },
  { id: 'p4', lugar: 'Puerto Valle', periodo: '2024-2025', estado: 'finalizada', created_at: '2024-02-08T12:00:00Z', visible_in_app: true },
  { id: 'p5', lugar: 'Rincón del Socorro', periodo: '2024-2025', estado: 'finalizada', created_at: '2024-03-22T12:00:00Z', visible_in_app: false },
  { id: 'p6', lugar: 'La Carolina', periodo: '2024-2025', estado: 'activa', created_at: '2024-07-30T12:00:00Z', visible_in_app: true },
  { id: 'p7', lugar: 'Arroyo Ceibo', periodo: '2023-2024', estado: 'finalizada', created_at: '2023-01-15T12:00:00Z', visible_in_app: false },
];

/**
 * Árboles por plantación y especie. De acá salen qué especies habilita cada
 * plantación y todos los totales de árboles, así la tabla de especies, su panel
 * y las tarjetas de plantación cierran entre sí.
 */
const ARBOLES_POR_PLANTACION: Record<string, Record<string, number>> = {
  p1: { s1: 1002, s2: 774, s3: 2100, s4: 1408 },
  p2: { s1: 2018, s2: 1500, s5: 400 },
  p3: { s1: 2382, s6: 258 },
  p4: { s3: 1136, s4: 1336 },
  p5: { s2: 1844 },
  p6: { s5: 1406 },
  p7: { s6: 878 },
};

const TOTALES_DE_ARBOLES = Object.entries(ARBOLES_POR_PLANTACION).flatMap(
  ([plantation_id, porEspecie]) =>
    Object.entries(porEspecie).map(([species_id, arboles]) => ({ plantation_id, species_id, arboles })),
);

function arbolesDePlantacion(plantationId: string): number {
  const porEspecie = Object.values(ARBOLES_POR_PLANTACION[plantationId] ?? {});
  return porEspecie.reduce((total, arboles) => total + arboles, 0);
}

/** Devuelto por el RPC agregado `stats_plantaciones` (migración 027). */
const STATS_PLANTACIONES: FilaDemo[] = [
  { plantation_id: 'p1', parcelas: 14, usuarios: 6 },
  { plantation_id: 'p2', parcelas: 11, usuarios: 4 },
  { plantation_id: 'p3', parcelas: 9, usuarios: 3 },
  { plantation_id: 'p4', parcelas: 12, usuarios: 5 },
  { plantation_id: 'p5', parcelas: 6, usuarios: 2 },
  { plantation_id: 'p6', parcelas: 7, usuarios: 3 },
  { plantation_id: 'p7', parcelas: 5, usuarios: 2 },
].map((stats) => ({ ...stats, arboles: arbolesDePlantacion(stats.plantation_id) }));

const ESPECIES: Especie[] = [
  { id: 's1', codigo: 'ANC', nombre: 'Anchico', nombre_cientifico: 'Parapiptadenia rigida' },
  { id: 's2', codigo: 'IBI', nombre: 'Ibirá Pitá', nombre_cientifico: 'Peltophorum dubium' },
  { id: 's3', codigo: 'LAP', nombre: 'Lapacho rosado', nombre_cientifico: 'Handroanthus impetiginosus' },
  { id: 's4', codigo: 'TIM', nombre: 'Timbó', nombre_cientifico: 'Enterolobium contortisiliquum' },
  { id: 's5', codigo: 'GUA', nombre: 'Guatambú', nombre_cientifico: 'Balfourodendron riedelianum' },
  { id: 's6', codigo: 'CED', nombre: 'Cedro misionero', nombre_cientifico: 'Cedrela fissilis' },
  { id: 's7', codigo: 'PET', nombre: 'Petiribí', nombre_cientifico: null },
  { id: 's8', codigo: 'URU', nombre: 'Urunday', nombre_cientifico: 'Astronium balansae' },
];

function especiePorId(id: string): Especie {
  const especie = ESPECIES.find((candidata) => candidata.id === id);
  if (!especie) throw new Error(`Especie de demo inexistente: ${id}`);
  return especie;
}

const PLANTACION_ESPECIES: FilaDemo[] = TOTALES_DE_ARBOLES.map(({ plantation_id, species_id }) => ({
  plantation_id,
  species_id,
}));

/** Con la forma en que las consultas filtran árboles: por especie y por `groups.plantation_id`. */
const CONTEOS_DE_ARBOLES: ConteoDemo[] = TOTALES_DE_ARBOLES.map(
  ({ plantation_id, species_id, arboles }) => ({
    fila: { species_id, groups: { plantation_id } },
    cantidad: arboles,
  }),
);

/** Técnico → plantación → día de la asignación (los admins son miembros
 *  automáticos, #67). */
const ASIGNACIONES_POR_TECNICO: Record<string, Record<string, string>> = {
  u3: { p1: '2025-03-14', p2: '2025-04-06' },
  u4: { p1: '2025-03-14', p3: '2025-05-20', p6: '2024-08-01' },
  u6: { p2: '2025-05-08' },
};

const PLANTACION_USUARIOS: FilaDemo[] = Object.entries(ASIGNACIONES_POR_TECNICO).flatMap(
  ([user_id, plantaciones]) =>
    Object.entries(plantaciones).map(([plantation_id, dia]) => ({
      user_id,
      plantation_id,
      rol_en_plantacion: 'tecnico',
      assigned_at: `${dia}T12:00:00Z`,
    })),
);

const PARCELAS: FilaDemo[] = [
  { id: 'pa1', plantation_id: 'p1', nombre: 'Loma-P12', codigo: 'LP12', descripcion: 'Loma alta, suelo arenoso', created_at: '2025-03-14T12:00:00Z', deleted_at: null },
  { id: 'pa2', plantation_id: 'p1', nombre: 'Bajo del Arroyo', codigo: 'BA03', descripcion: null, created_at: '2025-03-16T12:00:00Z', deleted_at: null },
];

const GRUPOS: FilaDemo[] = [
  { id: 'g1', parcela_id: 'pa1', plantation_id: 'p1', nombre: 'Línea 10', codigo: 'L10', tipo: 'linea', estado: 'activa', created_at: '2025-04-02T12:00:00Z' },
  { id: 'g2', parcela_id: 'pa1', plantation_id: 'p1', nombre: 'Línea 11', codigo: 'L11', tipo: 'linea', estado: 'activa', created_at: '2025-04-02T13:00:00Z' },
  { id: 'g3', parcela_id: 'pa2', plantation_id: 'p1', nombre: 'Bosquete 1', codigo: 'B01', tipo: 'bosquete', estado: 'finalizada', created_at: '2025-04-05T12:00:00Z' },
];

/** Especies de los árboles del grupo, en el orden en que se alternan. */
const ESPECIES_ARBOL = ['s1', 's2', 's4', 's3'].map(especiePorId);

/** 30 árboles de la parcela LP12 / grupo L10, como en la pantalla real. */
const ARBOLES: FilaDemo[] = Array.from({ length: 30 }, (_, indice) => {
  const especie = ESPECIES_ARBOL[indice % ESPECIES_ARBOL.length];
  const conGps = indice % 4 === 0;
  const foto = indice % 3;
  return {
    id: `t${indice + 1}`,
    sub_id: `LP12L10${especie.codigo}${indice + 1}`,
    posicion: indice + 1,
    group_id: 'g1',
    species_id: especie.id,
    // Una de cada tres subida, una local sin sincronizar, una sin foto.
    foto_url: foto === 0 ? `plantations/p1/trees/t${indice + 1}.jpg` : foto === 1 ? 'file:///data/foto.jpg' : null,
    usuario_registro: 'u4',
    created_at: '2026-04-10T12:00:00Z',
    latitude: conGps ? -27.36012 - indice * 0.0001 : null,
    longitude: conGps ? -55.89744 + indice * 0.0001 : null,
    gps_accuracy: conGps ? 4.2 : null,
    gps_captured_at: conGps ? '2026-04-10T12:00:05Z' : null,
  };
});

/** Columna con la que otra tabla apunta a cada una. Un nombre por destino
 *  alcanza porque las FK que embebe la web siguen esa convención. */
export const COLUMNA_QUE_APUNTA_A: Readonly<Record<string, string | undefined>> = {
  plantations: 'plantation_id',
  species: 'species_id',
  profiles: 'user_id',
  parcelas: 'parcela_id',
  groups: 'group_id',
};

export const TABLAS: Record<string, TablaDemo> = {
  organizations: { filas: [ORGANIZACION] },
  profiles: { filas: PERFILES },
  plantations: { filas: PLANTACIONES },
  stats_plantaciones: { filas: STATS_PLANTACIONES },
  species: { filas: ESPECIES },
  plantation_species: { filas: PLANTACION_ESPECIES },
  plantation_users: { filas: PLANTACION_USUARIOS },
  parcelas: { filas: PARCELAS },
  groups: { filas: GRUPOS },
  trees: { filas: ARBOLES, conteos: CONTEOS_DE_ARBOLES },
};

/** Respuestas de `supabase.rpc(...)`. */
export const RPC: Record<string, unknown> = {
  stats_plantaciones: STATS_PLANTACIONES,
};
