/*
 * Entradas del informe PDF de N parcelas y M especies, determinísticas: los
 * conteos del dashboard y los puntos del mapa cuentan lo mismo.
 */
import { LISTA_OPCIONES_INFORME, opcionesCon, type OpcionesInforme } from '../lib/opcionesInforme';
import type { EntradaInforme } from '../pdf/informe/datosInforme';
import type { DashboardData, DistribucionEspecie } from '../queries/dashboardQueries';
import type { PuntoGps } from '../queries/mapaQueries';
import { coloresEnOrden } from './fabricas';

const CODIGOS_ESPECIE = ['LAP', 'TIM', 'ANC', 'IBI', 'GUA', 'CED', 'URU', 'PET', 'ALG', 'CAN'];
const CODIGOS_ESPECIE_EXTRA = ['ARA', 'YVY', 'KIR', 'PIN', 'TAT', 'CAÑ', 'GUY', 'LAU'];
const CODIGO_NN = 'NN';
const PUNTOS_POR_PARCELA = 3;
const PASO_GRADOS = 0.004;

type OpcionesEntrada = {
  parcelas: number;
  especies: number;
  /** Árboles N/N; van como especie aparte. */
  nn?: number;
  objetivo?: number | null;
  conGps?: boolean;
  /** Por defecto, todas marcadas. */
  opciones?: OpcionesInforme;
};

export const TODAS_LAS_OPCIONES = opcionesCon(LISTA_OPCIONES_INFORME);

/** Las 16 combinaciones de casillas, de ninguna a todas. */
export function combinacionesDeOpciones(): OpcionesInforme[] {
  const total = 2 ** LISTA_OPCIONES_INFORME.length;
  return Array.from({ length: total }, (_, bits) =>
    opcionesCon(LISTA_OPCIONES_INFORME.filter((_, indice) => bits & (1 << indice))),
  );
}

/** «meta + mapa», o «ninguna»: el nombre de la combinación en los tests. */
export function nombreCombinacion(opciones: OpcionesInforme): string {
  const marcadas = LISTA_OPCIONES_INFORME.filter((opcion) => opciones[opcion]);
  return marcadas.length === 0 ? 'ninguna' : marcadas.join(' + ');
}

/** Pasadas las 18 con nombre, los códigos siguen numerados: E19, E20… */
function codigosEspecie(cantidad: number): string[] {
  const conNombre = [...CODIGOS_ESPECIE, ...CODIGOS_ESPECIE_EXTRA];
  const numerados = Array.from(
    { length: Math.max(0, cantidad - conNombre.length) },
    (_, indice) => `E${conNombre.length + indice + 1}`,
  );
  return [...conNombre, ...numerados].slice(0, cantidad);
}

function especies(cantidad: number, nn: number): DistribucionEspecie[] {
  const codigos = codigosEspecie(cantidad);
  const lista = codigos.map((codigo, indice) => ({
    codigo,
    nombre: `Especie ${codigo}`,
    cantidad: (cantidad - indice) * 10,
  }));
  return nn > 0
    ? [...lista, { codigo: CODIGO_NN, nombre: 'Sin identificar', cantidad: nn }]
    : lista;
}

/** Cada especie en el lugar de su orden en la lista; N/N no ocupa lugar. */
function coloresDeLaLista(porEspecie: readonly DistribucionEspecie[]) {
  const identificadas = porEspecie.filter((especie) => especie.codigo !== CODIGO_NN);
  return coloresEnOrden(...identificadas.map(({ codigo }) => codigo));
}

function puntosDeParcela(indice: number, codigos: readonly string[]): PuntoGps[] {
  return Array.from({ length: PUNTOS_POR_PARCELA }, (_, orden) => ({
    lat: -27.47 - Math.floor(indice / 5) * PASO_GRADOS - orden * 0.0001,
    lng: -55.89 + (indice % 5) * PASO_GRADOS,
    codigo: codigos[orden % codigos.length],
    nombre: '',
    idArbol: `P${indice}-${orden}`,
    subId: `P${indice}-${orden}`,
    parcelaId: `parc-${indice}`,
  }));
}

function dashboard(porEspecie: DistribucionEspecie[], cantidadParcelas: number, gps: number) {
  const total = porEspecie.reduce((suma, especie) => suma + especie.cantidad, 0);
  const nn = porEspecie.find((especie) => especie.codigo === CODIGO_NN)?.cantidad ?? 0;
  const porParcela = Array.from({ length: cantidadParcelas }, (_, indice) => ({
    id: `parc-${indice}`,
    codigo: `P${indice + 1}`,
    nombre: `Parcela ${indice + 1}`,
    cantidad: Math.floor(total / cantidadParcelas) + (indice === 0 ? total % cantidadParcelas : 0),
  }));
  const datos: DashboardData = {
    totalArboles: total,
    arbolesNN: nn,
    especiesUsadas: porEspecie.length - (nn > 0 ? 1 : 0),
    arbolesConGps: gps,
    arbolesConFoto: Math.floor(total / 2),
    porcentajeConGps: total === 0 ? 0 : Math.round((gps / total) * 100),
    porcentajeConFoto: total === 0 ? 0 : 50,
    totalGrupos: cantidadParcelas * 2,
    totalParcelas: cantidadParcelas,
    porEspecie,
    porParcela,
    porMes: [],
  };
  return datos;
}

export function entradaInforme(opciones: OpcionesEntrada): EntradaInforme {
  const porEspecie = especies(opciones.especies, opciones.nn ?? 0);
  const codigos = porEspecie.map((especie) => especie.codigo);
  const puntos =
    opciones.conGps === false || codigos.length === 0
      ? []
      : Array.from({ length: opciones.parcelas }, (_, i) => puntosDeParcela(i, codigos)).flat();
  return {
    dashboard: dashboard(porEspecie, opciones.parcelas, puntos.length),
    puntos,
    plantacion: { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26', estado: 'Activa' },
    objetivo: opciones.objetivo === undefined ? 8000 : opciones.objetivo,
    organizacion: 'Bayka',
    colorDe: coloresDeLaLista(porEspecie),
    opciones: opciones.opciones ?? TODAS_LAS_OPCIONES,
  };
}
