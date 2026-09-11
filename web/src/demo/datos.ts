/**
 * Datos de mentira para el servidor de demo (`npm run dev:demo`). Números y
 * nombres verosímiles a propósito: el punto es ver la app con anchos de columna
 * y conteos reales, que es donde aparecen los problemas de layout.
 *
 * Para cubrir una pantalla nueva, agregá su tabla a `TABLAS` y, si otra la
 * embebe, la FK a `COLUMNA_QUE_APUNTA_A`.
 */
import type { TipoGrupo } from '../queries/dataExplorerQueries';
import type { EstadoPlantacion } from '../queries/plantationQueries';

export type FilaDemo = Record<string, unknown>;

/** Cuántas filas comparten los valores de `fila`: cuenta miles de árboles sin
 *  materializarlos. `fila` se filtra igual que una fila real. */
export type ConteoDemo = { fila: FilaDemo; cantidad: number };

/** Una tabla del backend falso. Si tiene `conteos`, los `select(head, count)`
 *  que filtran solo por columnas de `conteos` responden con ellos; el resto
 *  cuenta `filas`. */
export type TablaDemo = {
  filas: FilaDemo[];
  conteos?: ConteoDemo[];
};

type Plantacion = {
  id: string;
  lugar: string;
  periodo: string;
  estado: EstadoPlantacion;
  created_at: string;
  visible_in_app: boolean;
};

type Especie = { id: string; codigo: string; nombre: string; nombre_cientifico: string | null };

type Parcela = {
  id: string;
  plantation_id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  created_at: string;
  deleted_at: null;
};

type Grupo = {
  id: string;
  parcela_id: string;
  plantation_id: string;
  nombre: string;
  codigo: string;
  tipo: TipoGrupo;
  estado: EstadoPlantacion;
  created_at: string;
};

const TIPO_GRUPO = { linea: 'linea', bosquete: 'bosquete' } as const satisfies Record<
  string,
  TipoGrupo
>;

export const SESION_DEMO = { user: { id: 'u1', email: 'demo@bayka.app' } };

const ORGANIZACION = { id: 'org-1', nombre: 'Bayka' };

const PERFILES: FilaDemo[] = [
  {
    id: 'u1',
    nombre: 'Facundo Pichinini',
    rol: 'superadmin',
    email: 'demo@bayka.app',
    activo: true,
    created_at: '2024-01-18T12:00:00Z',
  },
  {
    id: 'u2',
    nombre: 'Sofía Bianchi',
    rol: 'admin',
    email: 'sofia@bayka.app',
    activo: true,
    created_at: '2024-04-18T12:00:00Z',
  },
  {
    id: 'u3',
    nombre: 'Martín Oyola',
    rol: 'tecnico',
    email: 'martin@bayka.app',
    activo: true,
    created_at: '2024-06-02T12:00:00Z',
  },
  {
    id: 'u4',
    nombre: 'Lucía Ferreyra',
    rol: 'tecnico',
    email: 'lucia@bayka.app',
    activo: true,
    created_at: '2024-09-11T12:00:00Z',
  },
  {
    id: 'u5',
    nombre: 'Ramiro Ledesma',
    rol: 'tecnico',
    email: 'ramiro@bayka.app',
    activo: false,
    created_at: '2025-02-27T12:00:00Z',
  },
  {
    id: 'u6',
    nombre: 'Valentina Cáceres',
    rol: 'tecnico',
    email: 'valentina@bayka.app',
    activo: true,
    created_at: '2025-05-06T12:00:00Z',
  },
].map((perfil) => ({ ...perfil, organizacion_id: ORGANIZACION.id }));

/** Carga los árboles de las plantaciones sin técnicos asignados. */
const ADMIN_DEMO = 'u2';

const PLANTACIONES: Plantacion[] = [
  {
    id: 'p1',
    lugar: 'San Sebastián',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2025-03-12T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'p2',
    lugar: 'Estancia La Escondida',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2025-04-04T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'p3',
    lugar: 'Campo Los Molles',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2025-05-19T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'p4',
    lugar: 'Puerto Valle',
    periodo: '2024-2025',
    estado: 'finalizada',
    created_at: '2024-02-08T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'p5',
    lugar: 'Rincón del Socorro',
    periodo: '2024-2025',
    estado: 'finalizada',
    created_at: '2024-03-22T12:00:00Z',
    visible_in_app: false,
  },
  {
    id: 'p6',
    lugar: 'La Carolina',
    periodo: '2024-2025',
    estado: 'activa',
    created_at: '2024-07-30T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'p7',
    lugar: 'Arroyo Ceibo',
    periodo: '2023-2024',
    estado: 'finalizada',
    created_at: '2023-01-15T12:00:00Z',
    visible_in_app: false,
  },
];

function plantacionPorId(id: string): Plantacion {
  const plantacion = PLANTACIONES.find((candidata) => candidata.id === id);
  if (!plantacion) throw new Error(`Plantación de demo inexistente: ${id}`);
  return plantacion;
}

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

const PLANTACIONES_CON_ARBOLES = Object.keys(ARBOLES_POR_PLANTACION);

const TOTALES_DE_ARBOLES = Object.entries(ARBOLES_POR_PLANTACION).flatMap(
  ([plantation_id, porEspecie]) =>
    Object.entries(porEspecie).map(([species_id, arboles]) => ({
      plantation_id,
      species_id,
      arboles,
    })),
);

function arbolesDePlantacion(plantationId: string): number {
  const porEspecie = Object.values(ARBOLES_POR_PLANTACION[plantationId] ?? {});
  return porEspecie.reduce((total, arboles) => total + arboles, 0);
}

const ESPECIES: Especie[] = [
  { id: 's1', codigo: 'ANC', nombre: 'Anchico', nombre_cientifico: 'Parapiptadenia rigida' },
  { id: 's2', codigo: 'IBI', nombre: 'Ibirá Pitá', nombre_cientifico: 'Peltophorum dubium' },
  {
    id: 's3',
    codigo: 'LAP',
    nombre: 'Lapacho rosado',
    nombre_cientifico: 'Handroanthus impetiginosus',
  },
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

/** Modelan especie y plantación, que es por lo que filtran los conteos grandes.
 *  Un filtro por parcela o grupo cuenta las filas de muestra, así el total de
 *  una parcela coincide con la suma de sus grupos, que se cuentan fila a fila. */
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

/** Quien carga los árboles: un técnico de la plantación, o la admin si no tiene. */
function registradorDe(plantationId: string): string {
  const asignacion = PLANTACION_USUARIOS.find((fila) => fila.plantation_id === plantationId);
  return asignacion ? String(asignacion.user_id) : ADMIN_DEMO;
}

/** Escritas a mano por los casos que importan al layout: nombre largo, parcela
 *  sin descripción, bosquete finalizado. */
const PARCELAS_A_MANO: Parcela[] = [
  {
    id: 'pa1',
    plantation_id: 'p1',
    nombre: 'Loma-P12',
    codigo: 'LP12',
    descripcion: 'Loma alta, suelo arenoso',
    created_at: '2025-03-14T12:00:00Z',
    deleted_at: null,
  },
  {
    id: 'pa2',
    plantation_id: 'p1',
    nombre: 'Bajo del Arroyo',
    codigo: 'BA03',
    descripcion: null,
    created_at: '2025-03-16T12:00:00Z',
    deleted_at: null,
  },
];

const GRUPOS_A_MANO: Grupo[] = [
  {
    id: 'g1',
    parcela_id: 'pa1',
    plantation_id: 'p1',
    nombre: 'Línea 10',
    codigo: 'L10',
    tipo: TIPO_GRUPO.linea,
    estado: 'activa',
    created_at: '2025-04-02T12:00:00Z',
  },
  {
    id: 'g2',
    parcela_id: 'pa1',
    plantation_id: 'p1',
    nombre: 'Línea 11',
    codigo: 'L11',
    tipo: TIPO_GRUPO.linea,
    estado: 'activa',
    created_at: '2025-04-02T13:00:00Z',
  },
  {
    id: 'g3',
    parcela_id: 'pa2',
    plantation_id: 'p1',
    nombre: 'Bosquete 1',
    codigo: 'B01',
    tipo: TIPO_GRUPO.bosquete,
    estado: 'finalizada',
    created_at: '2025-04-05T12:00:00Z',
  },
];

/** Al resto de las plantaciones con árboles se les generan parcelas y líneas:
 *  las justas para que el explorador, el mapa y el dashboard tengan filas y
 *  una parcela sume más de un grupo. */
const PARCELAS_GENERADAS_POR_PLANTACION = 2;
const LINEAS_GENERADAS_POR_PARCELA = 2;

type ParcelaGenerada = { parcela: Parcela; grupos: Grupo[] };

function numerados(cantidad: number): number[] {
  return Array.from({ length: cantidad }, (_, indice) => indice + 1);
}

function lineaGenerada(parcela: Parcela, plantacion: Plantacion, numero: number): Grupo {
  return {
    id: `${parcela.id}-g${numero}`,
    parcela_id: parcela.id,
    plantation_id: plantacion.id,
    nombre: `Línea ${numero}`,
    codigo: `L${numero}`,
    tipo: TIPO_GRUPO.linea,
    estado: plantacion.estado,
    created_at: plantacion.created_at,
  };
}

/** Las líneas se numeran de corrido en la plantación, como en el campo. */
function parcelaGenerada(plantacion: Plantacion, numero: number): ParcelaGenerada {
  const parcela: Parcela = {
    id: `${plantacion.id}-pa${numero}`,
    plantation_id: plantacion.id,
    nombre: `Parcela ${numero}`,
    codigo: `P${numero}`,
    descripcion: null,
    created_at: plantacion.created_at,
    deleted_at: null,
  };
  const lineasAnteriores = (numero - 1) * LINEAS_GENERADAS_POR_PARCELA;
  const grupos = numerados(LINEAS_GENERADAS_POR_PARCELA).map((orden) =>
    lineaGenerada(parcela, plantacion, lineasAnteriores + orden),
  );
  return { parcela, grupos };
}

const CON_PARCELAS_A_MANO = new Set(PARCELAS_A_MANO.map((parcela) => parcela.plantation_id));

const GENERADAS: ParcelaGenerada[] = PLANTACIONES_CON_ARBOLES.filter(
  (id) => !CON_PARCELAS_A_MANO.has(id),
)
  .map(plantacionPorId)
  .flatMap((plantacion) =>
    numerados(PARCELAS_GENERADAS_POR_PLANTACION).map((numero) =>
      parcelaGenerada(plantacion, numero),
    ),
  );

const PARCELAS: Parcela[] = [...PARCELAS_A_MANO, ...GENERADAS.map(({ parcela }) => parcela)];

const GRUPOS: Grupo[] = [...GRUPOS_A_MANO, ...GENERADAS.flatMap(({ grupos }) => grupos)];

function parcelasDePlantacion(plantationId: string): number {
  return PARCELAS.filter((parcela) => parcela.plantation_id === plantationId).length;
}

/** Devuelto por el RPC agregado `stats_plantaciones` (migración 027). Los
 *  árboles salen de la matriz y las parcelas, de las que lista el explorador. */
const STATS_PLANTACIONES: FilaDemo[] = [
  { plantation_id: 'p1', usuarios: 6 },
  { plantation_id: 'p2', usuarios: 4 },
  { plantation_id: 'p3', usuarios: 3 },
  { plantation_id: 'p4', usuarios: 5 },
  { plantation_id: 'p5', usuarios: 2 },
  { plantation_id: 'p6', usuarios: 3 },
  { plantation_id: 'p7', usuarios: 2 },
].map((stats) => ({
  ...stats,
  parcelas: parcelasDePlantacion(stats.plantation_id),
  arboles: arbolesDePlantacion(stats.plantation_id),
}));

function parcelaPorId(id: string): Parcela {
  const parcela = PARCELAS.find((candidata) => candidata.id === id);
  if (!parcela) throw new Error(`Parcela de demo inexistente: ${id}`);
  return parcela;
}

/** Pocos por grupo: las filas son muestra para ver el layout, los totales salen de la matriz. */
const ARBOLES_DE_MUESTRA_POR_GRUPO = 8;
const CADA_CUANTOS_CON_GPS = 4;
const PRECISION_GPS_METROS = 4.2;
const ORIGEN_GPS = { latitud: -27.36012, longitud: -55.89744 };
/** Cada plantación en su zona; dentro, las líneas corren paralelas. */
const GRADOS_ENTRE_PLANTACIONES = 0.05;
const GRADOS_ENTRE_LINEAS = 0.0003;
const GRADOS_ENTRE_ARBOLES = 0.0001;
const FOTO_SIN_SINCRONIZAR = 'file:///data/foto.jpg';

const SIN_GPS = { latitude: null, longitude: null, gps_accuracy: null, gps_captured_at: null };

function gpsDeMuestra(grupo: Grupo, indiceGrupo: number, indice: number): FilaDemo {
  if (indice % CADA_CUANTOS_CON_GPS !== 0) return SIN_GPS;
  const zona = PLANTACIONES_CON_ARBOLES.indexOf(grupo.plantation_id);
  return {
    latitude: ORIGEN_GPS.latitud - zona * GRADOS_ENTRE_PLANTACIONES - indice * GRADOS_ENTRE_ARBOLES,
    longitude: ORIGEN_GPS.longitud + indiceGrupo * GRADOS_ENTRE_LINEAS,
    gps_accuracy: PRECISION_GPS_METROS,
    gps_captured_at: grupo.created_at,
  };
}

/** Se alternan: subida al bucket, local sin sincronizar y sin foto. */
function fotoDeMuestra(grupo: Grupo, arbolId: string, indice: number): string | null {
  const estados = [
    `plantations/${grupo.plantation_id}/trees/${arbolId}.jpg`,
    FOTO_SIN_SINCRONIZAR,
    null,
  ];
  return estados[indice % estados.length];
}

/** Rota las especies que la matriz habilita en la plantación, desfasada por grupo. */
function especieDeMuestra(grupo: Grupo, indiceGrupo: number, indice: number): Especie {
  const especies = Object.keys(ARBOLES_POR_PLANTACION[grupo.plantation_id] ?? {});
  return especiePorId(especies[(indiceGrupo + indice) % especies.length]);
}

function arbolDeMuestra(grupo: Grupo, indiceGrupo: number, indice: number): FilaDemo {
  const especie = especieDeMuestra(grupo, indiceGrupo, indice);
  const posicion = indice + 1;
  const id = `${grupo.id}-t${posicion}`;
  return {
    id,
    sub_id: `${parcelaPorId(grupo.parcela_id).codigo}${grupo.codigo}${especie.codigo}${posicion}`,
    posicion,
    group_id: grupo.id,
    species_id: especie.id,
    foto_url: fotoDeMuestra(grupo, id, indice),
    usuario_registro: registradorDe(grupo.plantation_id),
    created_at: grupo.created_at,
    ...gpsDeMuestra(grupo, indiceGrupo, indice),
  };
}

/** Los de p1 van primero: la "temporada activa" es la del primer árbol que entra. */
const ARBOLES: FilaDemo[] = GRUPOS.flatMap((grupo, indiceGrupo) =>
  numerados(ARBOLES_DE_MUESTRA_POR_GRUPO).map((posicion) =>
    arbolDeMuestra(grupo, indiceGrupo, posicion - 1),
  ),
);

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
