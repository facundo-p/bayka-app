/**
 * Datos de mentira para el servidor de demo (`npm run dev:demo`). Números y
 * nombres verosímiles a propósito: el punto es ver la app con anchos de columna
 * y conteos reales, que es donde aparecen los problemas de layout.
 *
 * Para cubrir una pantalla nueva, agregá su tabla a `TABLAS`.
 */

export type FilaDemo = Record<string, unknown>;

export type FiltroDemo = {
  columna: string;
  valor: unknown;
  /** `not(col, 'is', null)`: la fila entra si NO coincide. */
  excluye?: boolean;
};

/** ¿La fila pasa el filtro? Una columna que los datos no modelan no filtra. */
export function cumpleFiltro(fila: FilaDemo, { columna, valor, excluye }: FiltroDemo): boolean {
  if (!(columna in fila)) return true;
  return excluye ? fila[columna] !== valor : fila[columna] === valor;
}

/**
 * Una tabla del backend falso. `contar` existe para los `select(head, count)`:
 * devuelve el total sin materializar miles de filas de árboles.
 */
export type TablaDemo = {
  filas: FilaDemo[];
  contar?: (filtros: FiltroDemo[]) => number;
};

export const SESION_DEMO = { user: { id: 'u1', email: 'demo@bayka.app' } };

const ORGANIZACION = { id: 'org-1', nombre: 'Bayka' };

const PERFILES: FilaDemo[] = [
  { id: 'u1', nombre: 'Facundo Pichinini', rol: 'superadmin', email: 'demo@bayka.app', activo: true, organizacion_id: 'org-1', created_at: '2024-01-18T12:00:00Z' },
  { id: 'u2', nombre: 'Sofía Bianchi', rol: 'admin', email: 'sofia@bayka.app', activo: true, organizacion_id: 'org-1', created_at: '2024-04-18T12:00:00Z' },
  { id: 'u3', nombre: 'Martín Oyola', rol: 'tecnico', email: 'martin@bayka.app', activo: true, organizacion_id: 'org-1', created_at: '2024-06-02T12:00:00Z' },
  { id: 'u4', nombre: 'Lucía Ferreyra', rol: 'tecnico', email: 'lucia@bayka.app', activo: true, organizacion_id: 'org-1', created_at: '2024-09-11T12:00:00Z' },
  { id: 'u5', nombre: 'Ramiro Ledesma', rol: 'tecnico', email: 'ramiro@bayka.app', activo: false, organizacion_id: 'org-1', created_at: '2025-02-27T12:00:00Z' },
  { id: 'u6', nombre: 'Valentina Cáceres', rol: 'tecnico', email: 'valentina@bayka.app', activo: true, organizacion_id: 'org-1', created_at: '2025-05-06T12:00:00Z' },
];

const PLANTACIONES: FilaDemo[] = [
  { id: 'p1', lugar: 'San Sebastián', periodo: '2025-2026', estado: 'activa', created_at: '2025-03-12T12:00:00Z', visible_in_app: true },
  { id: 'p2', lugar: 'Estancia La Escondida', periodo: '2025-2026', estado: 'activa', created_at: '2025-04-04T12:00:00Z', visible_in_app: true },
  { id: 'p3', lugar: 'Campo Los Molles', periodo: '2025-2026', estado: 'activa', created_at: '2025-05-19T12:00:00Z', visible_in_app: true },
  { id: 'p4', lugar: 'Puerto Valle', periodo: '2024-2025', estado: 'finalizada', created_at: '2024-02-08T12:00:00Z', visible_in_app: true },
  { id: 'p5', lugar: 'Rincón del Socorro', periodo: '2024-2025', estado: 'finalizada', created_at: '2024-03-22T12:00:00Z', visible_in_app: false },
  { id: 'p6', lugar: 'La Carolina', periodo: '2024-2025', estado: 'activa', created_at: '2024-07-30T12:00:00Z', visible_in_app: true },
  { id: 'p7', lugar: 'Arroyo Ceibo', periodo: '2023-2024', estado: 'finalizada', created_at: '2023-01-15T12:00:00Z', visible_in_app: false },
];

/** Devuelto por el RPC agregado `stats_plantaciones` (migración 027). */
const STATS_PLANTACIONES: FilaDemo[] = [
  { plantation_id: 'p1', arboles: 5284, parcelas: 14, usuarios: 6 },
  { plantation_id: 'p2', arboles: 3918, parcelas: 11, usuarios: 4 },
  { plantation_id: 'p3', arboles: 2640, parcelas: 9, usuarios: 3 },
  { plantation_id: 'p4', arboles: 2472, parcelas: 12, usuarios: 5 },
  { plantation_id: 'p5', arboles: 1844, parcelas: 6, usuarios: 2 },
  { plantation_id: 'p6', arboles: 1406, parcelas: 7, usuarios: 3 },
  { plantation_id: 'p7', arboles: 878, parcelas: 5, usuarios: 2 },
];

const ESPECIES: FilaDemo[] = [
  { id: 's1', codigo: 'ANC', nombre: 'Anchico', nombre_cientifico: 'Parapiptadenia rigida' },
  { id: 's2', codigo: 'IBI', nombre: 'Ibirá Pitá', nombre_cientifico: 'Peltophorum dubium' },
  { id: 's3', codigo: 'LAP', nombre: 'Lapacho rosado', nombre_cientifico: 'Handroanthus impetiginosus' },
  { id: 's4', codigo: 'TIM', nombre: 'Timbó', nombre_cientifico: 'Enterolobium contortisiliquum' },
  { id: 's5', codigo: 'GUA', nombre: 'Guatambú', nombre_cientifico: 'Balfourodendron riedelianum' },
  { id: 's6', codigo: 'CED', nombre: 'Cedro misionero', nombre_cientifico: 'Cedrela fissilis' },
  { id: 's7', codigo: 'PET', nombre: 'Petiribí', nombre_cientifico: null },
  { id: 's8', codigo: 'URU', nombre: 'Urunday', nombre_cientifico: 'Astronium balansae' },
];

/** Árboles por especie: alimenta los `count` sin inventar 18.442 filas. */
const ARBOLES_POR_ESPECIE: Record<string, number> = {
  s1: 5402,
  s2: 4118,
  s3: 3236,
  s4: 2744,
  s5: 1806,
  s6: 1136,
  s7: 0,
  s8: 0,
};

/** Qué especies habilita cada plantación. */
const PLANTACION_ESPECIES: FilaDemo[] = [
  { plantation_id: 'p1', species_id: 's1' },
  { plantation_id: 'p1', species_id: 's2' },
  { plantation_id: 'p1', species_id: 's3' },
  { plantation_id: 'p1', species_id: 's4' },
  { plantation_id: 'p2', species_id: 's1' },
  { plantation_id: 'p2', species_id: 's2' },
  { plantation_id: 'p2', species_id: 's5' },
  { plantation_id: 'p3', species_id: 's1' },
  { plantation_id: 'p3', species_id: 's6' },
  { plantation_id: 'p4', species_id: 's3' },
  { plantation_id: 'p4', species_id: 's4' },
  { plantation_id: 'p5', species_id: 's2' },
  { plantation_id: 'p6', species_id: 's5' },
  { plantation_id: 'p7', species_id: 's6' },
];

/** Asignaciones técnico → plantación (los admins son miembros automáticos, #67). */
const PLANTACION_USUARIOS: FilaDemo[] = [
  { user_id: 'u3', plantation_id: 'p1', rol_en_plantacion: 'tecnico', assigned_at: '2025-03-14T12:00:00Z' },
  { user_id: 'u3', plantation_id: 'p2', rol_en_plantacion: 'tecnico', assigned_at: '2025-04-06T12:00:00Z' },
  { user_id: 'u4', plantation_id: 'p1', rol_en_plantacion: 'tecnico', assigned_at: '2025-03-14T12:00:00Z' },
  { user_id: 'u4', plantation_id: 'p3', rol_en_plantacion: 'tecnico', assigned_at: '2025-05-20T12:00:00Z' },
  { user_id: 'u4', plantation_id: 'p6', rol_en_plantacion: 'tecnico', assigned_at: '2024-08-01T12:00:00Z' },
  { user_id: 'u6', plantation_id: 'p2', rol_en_plantacion: 'tecnico', assigned_at: '2025-05-08T12:00:00Z' },
];

const PARCELAS: FilaDemo[] = [
  { id: 'pa1', plantation_id: 'p1', nombre: 'Loma-P12', codigo: 'LP12', descripcion: 'Loma alta, suelo arenoso', created_at: '2025-03-14T12:00:00Z' },
  { id: 'pa2', plantation_id: 'p1', nombre: 'Bajo del Arroyo', codigo: 'BA03', descripcion: null, created_at: '2025-03-16T12:00:00Z' },
];

const GRUPOS: FilaDemo[] = [
  { id: 'g1', parcela_id: 'pa1', plantation_id: 'p1', nombre: 'Línea 10', codigo: 'L10', tipo: 'linea', estado: 'activa', created_at: '2025-04-02T12:00:00Z', parcelas: { codigo: 'LP12' } },
  { id: 'g2', parcela_id: 'pa1', plantation_id: 'p1', nombre: 'Línea 11', codigo: 'L11', tipo: 'linea', estado: 'activa', created_at: '2025-04-02T13:00:00Z', parcelas: { codigo: 'LP12' } },
  { id: 'g3', parcela_id: 'pa2', plantation_id: 'p1', nombre: 'Bosquete 1', codigo: 'B01', tipo: 'bosquete', estado: 'finalizada', created_at: '2025-04-05T12:00:00Z', parcelas: { codigo: 'BA03' } },
];

const ESPECIES_ARBOL = [
  { id: 's1', codigo: 'ANC', nombre: 'Anchico Colorado' },
  { id: 's2', codigo: 'CBT', nombre: 'Cambota' },
  { id: 's4', codigo: 'TIM', nombre: 'Timbó' },
  { id: 's3', codigo: 'LAP', nombre: 'Lapacho rosado' },
];

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
    species: { codigo: especie.codigo, nombre: especie.nombre },
    groups: { codigo: 'L10', parcela_id: 'pa1', plantation_id: 'p1' },
  };
});

/** Cuenta filas de una tabla local aplicando los filtros de la consulta. */
function contarEn(filas: FilaDemo[], filtros: FiltroDemo[]): number {
  return filas.filter((fila) => filtros.every((filtro) => cumpleFiltro(fila, filtro))).length;
}

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
  trees: {
    filas: ARBOLES,
    contar: (filtros) => {
      const especie = filtros.find((filtro) => filtro.columna === 'species_id');
      if (especie) return ARBOLES_POR_ESPECIE[String(especie.valor)] ?? 0;
      const plantacion = filtros.find((filtro) => filtro.columna === 'plantation_id');
      if (plantacion) {
        const stats = STATS_PLANTACIONES.find((fila) => fila.plantation_id === plantacion.valor);
        return Number(stats?.arboles ?? 0);
      }
      return Object.values(ARBOLES_POR_ESPECIE).reduce((total, n) => total + n, 0);
    },
  },
};

/** Respuestas de `supabase.rpc(...)`. */
export const RPC: Record<string, unknown> = {
  stats_plantaciones: STATS_PLANTACIONES,
};

export { contarEn };
