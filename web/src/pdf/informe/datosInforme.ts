/*
 * Dashboard de la plantación entera + puntos GPS → modelo del informe, con todo
 * ya formateado: el documento solo pinta. Puro y testeable sin react-pdf.
 */
import {
  etiquetaEspecie,
  formatearEntero,
  PORCENTAJE_COMPLETO,
  porcentaje,
  porcentajeDeObjetivo,
  pluralizar,
} from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type {
  DashboardData,
  DistribucionEspecie,
  DistribucionParcela,
} from '../../queries/dashboardQueries';
import { esSinIdentificar } from '../../queries/especiesConstantes';
import type { PuntoGps } from '../../queries/mapaQueries';
import type { EtiquetaMapa, PuntoMapa } from '../mapa/planMapa';
import { asignarColoresInforme, type ColoresInforme } from './coloresInforme';
import { etiquetasDeParcelas } from './mapaInforme';
import { TEXTO_INFORME } from './textosInforme';

/** Lo que el informe necesita de cada parcela además de sus árboles. */
export type ParcelaDelInforme = { id: string; grupos: number };

export type EntradaInforme = {
  /** `calcularDashboard(fuente)`: siempre la plantación entera. */
  dashboard: DashboardData;
  /** null si no se pudieron leer: el informe sale con «Mapa no disponible». */
  puntos: readonly PuntoGps[] | null;
  /** null si no se pudieron leer: la columna Grupos sale «—». */
  parcelas: readonly ParcelaDelInforme[] | null;
  plantacion: { lugar: string; periodo: string; codigo: string; estado: string };
  objetivo: number | null;
  organizacion: string | null;
};

export type Indicador = { valor: string; detalle: string };

export type IndicadorArboles = {
  valor: string;
  /** «de 8.000»; null sin meta. */
  meta: string | null;
  /** Relleno de la barra, de 0 a 1; null sin meta. */
  avance: number | null;
  /** «106% de la meta»: el texto no se acota, la barra sí. */
  textoAvance: string | null;
};

export type Indicadores = {
  arboles: IndicadorArboles;
  gps: Indicador;
  foto: Indicador;
  pendientes: Indicador & { alerta: boolean };
};

export type FilaEspecie = {
  codigo: string;
  titulo: string;
  color: string;
  /** Largo de la barra respecto de la especie con más árboles, de 0 a 1. */
  fraccion: number;
  cantidad: string;
  porcentaje: string;
};

export type FilaParcela = {
  /** null en la fila «Sin parcela». */
  codigo: string | null;
  nombre: string;
  grupos: string;
  arboles: string;
  fraccion: number;
  porcentaje: string;
};

/** «Total · 17 parcelas», con las sumas de las filas. */
export type TotalParcelas = Pick<FilaParcela, 'grupos' | 'arboles' | 'porcentaje'> & {
  titulo: string;
};

export type ItemLeyenda = { texto: string; color: string };

export type MapaDelInforme = {
  puntos: PuntoMapa[];
  etiquetas: EtiquetaMapa[];
  leyenda: ItemLeyenda[];
  /** «X de N árboles tienen coordenadas; …»; null si no hay puntos. */
  nota: string | null;
  /** Por qué no hay mapa; null si lo hay. */
  vacio: string | null;
};

export type ModeloInforme = {
  linea: string;
  indicadores: Indicadores;
  especies: { titulo: string; filas: FilaEspecie[]; vacio: string | null };
  parcelas: { filas: FilaParcela[]; total: TotalParcelas | null; vacio: string | null };
  mapa: MapaDelInforme;
};

const conPorciento = (valor: number | string) => `${valor}%`;

const formatearGrupos = (grupos: number | null) =>
  grupos === null ? TEXTO_INFORME.sinDato : formatearEntero(grupos);

function fraccionDe(parte: number, maximo: number): number {
  return maximo === 0 ? 0 : parte / maximo;
}

/** «San Sebastián · Período 2025-2026 · Plantación SS26 · Bayka · Estado: Activa». */
function lineaDelTitulo({ plantacion, organizacion }: EntradaInforme): string {
  const { periodo, plantacion: rotulo, estado, separador } = TEXTO_INFORME;
  const partes = [
    plantacion.lugar,
    `${periodo} ${plantacion.periodo}`,
    `${rotulo} ${plantacion.codigo}`,
    ...(organizacion ? [organizacion] : []),
    `${estado} ${plantacion.estado}`,
  ];
  return partes.join(separador);
}

function indicadorArboles(total: number, objetivo: number | null): IndicadorArboles {
  const avance = porcentajeDeObjetivo(total, objetivo);
  const valor = formatearEntero(total);
  if (avance === null || objetivo === null) {
    return { valor, meta: null, avance: null, textoAvance: null };
  }
  return {
    valor,
    meta: `${TEXTO_INFORME.de} ${formatearEntero(objetivo)}`,
    avance: avance / PORCENTAJE_COMPLETO,
    textoAvance: `${conPorciento(porcentaje(total, objetivo))} ${TEXTO_INFORME.deLaMeta}`,
  };
}

function indicadores({ dashboard, objetivo }: EntradaInforme): Indicadores {
  return {
    arboles: indicadorArboles(dashboard.totalArboles, objetivo),
    gps: {
      valor: conPorciento(dashboard.porcentajeConGps),
      detalle: pluralizar(dashboard.arbolesConGps, SUSTANTIVO.arbol),
    },
    foto: {
      valor: conPorciento(dashboard.porcentajeConFoto),
      detalle: pluralizar(dashboard.arbolesConFoto, SUSTANTIVO.arbol),
    },
    pendientes: {
      valor: formatearEntero(dashboard.arbolesNN),
      detalle: TEXTO_INFORME.sinEspecie,
      alerta: dashboard.arbolesNN > 0,
    },
  };
}

/** «ANC · Anchico» o «N/N · Sin identificar». */
function tituloEspecie({ codigo, nombre }: DistribucionEspecie): string {
  if (esSinIdentificar(codigo))
    return etiquetaEspecie({ especieCodigo: null, especieNombre: null });
  return etiquetaEspecie({ especieCodigo: codigo, especieNombre: nombre });
}

function filasEspecies(dashboard: DashboardData, colores: ColoresInforme): FilaEspecie[] {
  const maximo = dashboard.porEspecie[0]?.cantidad ?? 0;
  return dashboard.porEspecie.map((especie) => ({
    codigo: especie.codigo,
    titulo: tituloEspecie(especie),
    color: colores(especie.codigo),
    fraccion: fraccionDe(especie.cantidad, maximo),
    cantidad: formatearEntero(especie.cantidad),
    porcentaje: conPorciento(porcentaje(especie.cantidad, dashboard.totalArboles)),
  }));
}

function especies(dashboard: DashboardData, colores: ColoresInforme) {
  const { especies: rotulo, separador, sinArboles } = TEXTO_INFORME;
  return {
    titulo: `${rotulo}${separador}${pluralizar(dashboard.especiesUsadas, SUSTANTIVO.especie)}`,
    filas: filasEspecies(dashboard, colores),
    vacio: dashboard.totalArboles === 0 ? sinArboles : null,
  };
}

/** Lo que va en una fila de la tabla, antes de formatear. */
type ConteoFila = { codigo: string | null; nombre: string; grupos: number | null; arboles: number };

const sumar = (valores: readonly number[]) => valores.reduce((suma, valor) => suma + valor, 0);

/** Grupos de cada parcela, por id; null si no se pudieron leer o la parcela no figura. */
function gruposPorParcela({ parcelas }: EntradaInforme) {
  const porId = new Map((parcelas ?? []).map((parcela) => [parcela.id, parcela.grupos]));
  return ({ id }: DistribucionParcela) => porId.get(id) ?? null;
}

/**
 * Árboles de grupos sin parcela, o de una parcela borrada: van en una fila
 * propia para que el total cierre con el del dashboard. Sus grupos son los que
 * no son de ninguna parcela activa.
 */
function filaSinParcela({ dashboard, parcelas }: EntradaInforme): ConteoFila | null {
  const arboles =
    dashboard.totalArboles - sumar(dashboard.porParcela.map((parcela) => parcela.cantidad));
  if (arboles <= 0) return null;
  const grupos = parcelas
    ? Math.max(0, dashboard.totalGrupos - sumar(parcelas.map((parcela) => parcela.grupos)))
    : null;
  return { codigo: null, nombre: TEXTO_INFORME.sinParcela, grupos, arboles };
}

function conteosDeFilas(entrada: EntradaInforme): ConteoFila[] {
  const grupos = gruposPorParcela(entrada);
  const filas = entrada.dashboard.porParcela.map((parcela) => ({
    codigo: parcela.codigo,
    nombre: parcela.nombre,
    grupos: grupos(parcela),
    arboles: parcela.cantidad,
  }));
  const sinParcela = filaSinParcela(entrada);
  return sinParcela ? [...filas, sinParcela] : filas;
}

function filasParcelas(conteos: readonly ConteoFila[], total: number): FilaParcela[] {
  const maximo = Math.max(0, ...conteos.map((conteo) => conteo.arboles));
  return conteos.map(({ codigo, nombre, grupos, arboles }) => ({
    codigo,
    nombre,
    grupos: formatearGrupos(grupos),
    arboles: formatearEntero(arboles),
    fraccion: fraccionDe(arboles, maximo),
    porcentaje: conPorciento(porcentaje(arboles, total)),
  }));
}

/** «Total · 17 parcelas»: todos los árboles de la plantación, en 100%. */
function filaTotal(conteos: readonly ConteoFila[], dashboard: DashboardData): TotalParcelas {
  const grupos = conteos.map((conteo) => conteo.grupos);
  const sabidos = grupos.filter((cantidad): cantidad is number => cantidad !== null);
  const { total, separador } = TEXTO_INFORME;
  return {
    titulo: `${total}${separador}${pluralizar(dashboard.porParcela.length, SUSTANTIVO.parcela)}`,
    grupos: formatearGrupos(sabidos.length === grupos.length ? sumar(sabidos) : null),
    arboles: formatearEntero(dashboard.totalArboles),
    porcentaje: conPorciento(PORCENTAJE_COMPLETO),
  };
}

function tablaParcelas(entrada: EntradaInforme) {
  const { totalArboles, porParcela } = entrada.dashboard;
  if (totalArboles === 0) return { filas: [], total: null, vacio: TEXTO_INFORME.sinArboles };
  if (porParcela.length === 0) return { filas: [], total: null, vacio: TEXTO_INFORME.sinParcelas };
  const conteos = conteosDeFilas(entrada);
  return {
    filas: filasParcelas(conteos, totalArboles),
    total: filaTotal(conteos, entrada.dashboard),
    vacio: null,
  };
}

/** «7.959 de 8.467 árboles tienen coordenadas; los 508 restantes no aparecen en el mapa.» */
export function notaCoordenadas(conGps: number, total: number): string {
  const t = TEXTO_INFORME;
  const base = `${formatearEntero(conGps)} ${t.de} ${pluralizar(total, SUSTANTIVO.arbol)} ${t.tienenCoordenadas}`;
  const restantes = Math.max(0, total - conGps);
  if (restantes === 0) return `${base}.`;
  if (restantes === 1) return `${base}; ${t.restanteUno}.`;
  return `${base}; ${t.restantesPrefijo} ${formatearEntero(restantes)} ${t.restantesSufijo}.`;
}

function leyenda(dashboard: DashboardData, colores: ColoresInforme): ItemLeyenda[] {
  return dashboard.porEspecie.map(({ codigo }) => ({
    texto: esSinIdentificar(codigo) ? TEXTO_INFORME.nn : codigo,
    color: colores(codigo),
  }));
}

/** Los conteos mandan: los puntos solo dibujan. */
function vacioDelMapa(dashboard: DashboardData, puntos: readonly PuntoGps[]): string | null {
  if (dashboard.totalArboles === 0) return TEXTO_INFORME.sinArboles;
  if (dashboard.arbolesConGps === 0) return TEXTO_INFORME.sinGps;
  return puntos.length === 0 ? TEXTO_INFORME.mapaNoDisponible : null;
}

/** Un punto de una especie que no está en los conteos viene de una lectura más vieja. */
function puntosDeLasEspecies(dashboard: DashboardData, puntos: readonly PuntoGps[] | null) {
  const codigos = new Set(dashboard.porEspecie.map((especie) => especie.codigo));
  return (puntos ?? []).filter((punto) => codigos.has(punto.codigo));
}

function mapa({ dashboard, puntos: leidos }: EntradaInforme, colores: ColoresInforme) {
  const puntos = puntosDeLasEspecies(dashboard, leidos);
  const vacio = vacioDelMapa(dashboard, puntos);
  return {
    puntos: puntos.map(({ lat, lng, codigo }) => ({ lat, lng, color: colores(codigo) })),
    etiquetas: etiquetasDeParcelas(puntos, dashboard.porParcela),
    leyenda: leyenda(dashboard, colores),
    nota: vacio ? null : notaCoordenadas(dashboard.arbolesConGps, dashboard.totalArboles),
    vacio,
  };
}

export function datosInforme(entrada: EntradaInforme): ModeloInforme {
  const colores = asignarColoresInforme(entrada.dashboard.porEspecie);
  return {
    linea: lineaDelTitulo(entrada),
    indicadores: indicadores(entrada),
    especies: especies(entrada.dashboard, colores),
    parcelas: tablaParcelas(entrada),
    mapa: mapa(entrada, colores),
  };
}
