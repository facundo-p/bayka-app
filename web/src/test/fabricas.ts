/**
 * Fábricas de datos de prueba: defaults válidos y overrides por parámetro.
 * Un campo obligatorio nuevo se agrega acá, no en cada test (#712).
 * Lo que un test afirma va como override explícito, no como default.
 * Usa `ESTADO_PLANTACION` real: un `vi.mock` de plantationQueries que no
 * conserve el módulo original (`importOriginal`) rompe al importar esto.
 */
import { idDeArbol } from '../lib/codigoPlantacion';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../lib/gpsDefaults';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../lib/photoDefaults';
import type {
  ArbolDetalle,
  FilaArbol,
  FilaGrupo,
  FilaParcela,
} from '../queries/dataExplorerQueries';
import {
  ESTADO_PLANTACION,
  type FilaPlantacion,
  type Plantacion,
  type PlantacionConStats,
} from '../queries/plantationQueries';

const CREADO_EN = '2026-01-01T00:00:00Z';

/** Ids y códigos que encadenan plantación → parcela → grupo → árbol. */
const IDS_FABRICA = {
  plantacion: 'plant-1',
  codigoPlantacion: 'SS26',
  parcela: 'parc-1',
  codigoParcela: 'P1',
  grupo: 'gr-1',
  codigoGrupo: 'L1',
  arbol: 'tree-1',
  subIdArbol: 'A-001',
} as const;

const PLANTACION_BASE = {
  id: IDS_FABRICA.plantacion,
  lugar: 'San Sebastián',
  periodo: '2025-2026',
  codigo: IDS_FABRICA.codigoPlantacion,
  estado: ESTADO_PLANTACION.activa,
};

/** Plantación del dominio, como la devuelven las queries. */
export function plantacion(overrides: Partial<Plantacion> = {}): Plantacion {
  return {
    ...PLANTACION_BASE,
    visibleInApp: true,
    gpsCaptureFrequency: GPS_CAPTURE_FREQUENCY_DEFAULT,
    gpsCaptureRequired: GPS_CAPTURE_REQUIRED_DEFAULT,
    photoCaptureAllTrees: PHOTO_CAPTURE_ALL_TREES_DEFAULT,
    createdAt: CREADO_EN,
    descripcion: null,
    fechaInicio: null,
    objetivoArboles: null,
    archivadaEn: null,
    ...overrides,
  };
}

export function plantacionConStats(
  overrides: Partial<PlantacionConStats> = {},
): PlantacionConStats {
  return { ...plantacion(), arboles: 0, parcelas: 0, usuarios: 0, ...overrides };
}

/** Fila de `plantations` con las columnas obligatorias; las opcionales, por override. */
export function filaPlantacion(overrides: Partial<FilaPlantacion> = {}): FilaPlantacion {
  return { ...PLANTACION_BASE, created_at: CREADO_EN, ...overrides };
}

/** Fila de `parcelas` del explorador de datos. */
export function filaParcela(overrides: Partial<FilaParcela> = {}): FilaParcela {
  return {
    id: IDS_FABRICA.parcela,
    nombre: 'Norte',
    codigo: IDS_FABRICA.codigoParcela,
    descripcion: null,
    created_at: CREADO_EN,
    ...overrides,
  };
}

/** Fila de `groups` del explorador de datos, con su parcela embebida. */
export function filaGrupo(overrides: Partial<FilaGrupo> = {}): FilaGrupo {
  return {
    id: IDS_FABRICA.grupo,
    nombre: 'Línea 1',
    codigo: IDS_FABRICA.codigoGrupo,
    tipo: 'linea',
    estado: ESTADO_PLANTACION.activa,
    parcela_id: IDS_FABRICA.parcela,
    created_at: CREADO_EN,
    parcelas: { codigo: IDS_FABRICA.codigoParcela },
    ...overrides,
  };
}

type GrupoDeArbol = NonNullable<FilaArbol['groups']> & { plantation_id: string };

/** Lo que trae el `select('*, …, groups!inner(…, plantations(codigo))')` de trees. */
export type FilaArbolDatos = Omit<FilaArbol, 'groups'> & {
  species_id: string | null;
  groups: GrupoDeArbol;
};

type OverridesFilaArbol = Partial<Omit<FilaArbolDatos, 'groups'>> & {
  groups?: Partial<GrupoDeArbol>;
};

/** Fila de `trees` sin especie, GPS ni foto; `groups` se mergea con el default. */
export function filaArbol({ groups, ...overrides }: OverridesFilaArbol = {}): FilaArbolDatos {
  return {
    id: IDS_FABRICA.arbol,
    sub_id: IDS_FABRICA.subIdArbol,
    posicion: 1,
    group_id: IDS_FABRICA.grupo,
    species_id: null,
    foto_url: null,
    usuario_registro: null,
    created_at: CREADO_EN,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    gps_captured_at: null,
    species: null,
    ...overrides,
    groups: {
      codigo: IDS_FABRICA.codigoGrupo,
      parcela_id: IDS_FABRICA.parcela,
      plantation_id: IDS_FABRICA.plantacion,
      plantations: { codigo: IDS_FABRICA.codigoPlantacion },
      ...groups,
    },
  };
}

/** Árbol del dominio sin especie ni GPS. */
export function arbolDetalle(overrides: Partial<ArbolDetalle> = {}): ArbolDetalle {
  return {
    id: IDS_FABRICA.arbol,
    subId: IDS_FABRICA.subIdArbol,
    idArbol: idDeArbol(IDS_FABRICA.subIdArbol, IDS_FABRICA.codigoPlantacion),
    posicion: 1,
    especieCodigo: null,
    especieNombre: null,
    grupoId: IDS_FABRICA.grupo,
    grupoCodigo: IDS_FABRICA.codigoGrupo,
    parcelaId: IDS_FABRICA.parcela,
    fotoUrl: null,
    usuarioRegistro: null,
    createdAt: CREADO_EN,
    ...overrides,
  };
}
