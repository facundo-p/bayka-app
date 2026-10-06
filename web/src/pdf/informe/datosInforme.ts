/*
 * Dashboard de la plantación entera + puntos GPS → modelo del informe, con todo
 * ya formateado: el documento solo pinta. Puro y testeable sin react-pdf.
 */
import {
  etiquetaEspecie,
  formatearConDecimal,
  formatearEntero,
  PORCENTAJE_COMPLETO,
  porcentaje,
  porcentajeDeObjetivo,
  pluralizar,
} from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { DashboardData, DistribucionEspecie } from '../../queries/dashboardQueries';
import type { PuntoGps } from '../../queries/mapaQueries';
import type { EtiquetaMapa, PuntoMapa } from '../mapa/planMapa';
import { asignarColoresInforme, esSinIdentificar, type ColoresInforme } from './coloresInforme';
import { etiquetasDeParcelas } from './mapaInforme';
import { TEXTO_INFORME } from './textosInforme';

/** Lo que el informe necesita de cada parcela además de sus árboles. */
export type ParcelaDelInforme = { id: string; codigo: string; grupos: number };

export type EntradaInforme = {
  /** `calcularDashboard(fuente, null)`: siempre la plantación entera. */
  dashboard: DashboardData;
  /** null si no se pudieron leer: el informe sale con «Mapa no disponible». */
  puntos: readonly PuntoGps[] | null;
  parcelas: readonly ParcelaDelInforme[];
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
  codigo: string;
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

function porcentajeDecimal(parte: number, total: number): string {
  return conPorciento(formatearConDecimal(total === 0 ? 0 : (parte / total) * PORCENTAJE_COMPLETO));
}

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

/** Grupos de cada fila, por código de parcela. */
function gruposDeLasFilas({ dashboard, parcelas }: EntradaInforme): number[] {
  const gruposPorCodigo = new Map(parcelas.map((parcela) => [parcela.codigo, parcela.grupos]));
  return dashboard.porParcela.map((parcela) => gruposPorCodigo.get(parcela.codigo) ?? 0);
}

function filasParcelas(entrada: EntradaInforme): FilaParcela[] {
  const { dashboard } = entrada;
  const grupos = gruposDeLasFilas(entrada);
  const maximo = Math.max(0, ...dashboard.porParcela.map((parcela) => parcela.cantidad));
  return dashboard.porParcela.map((parcela, indice) => ({
    codigo: parcela.codigo,
    nombre: parcela.nombre,
    grupos: formatearEntero(grupos[indice]),
    arboles: formatearEntero(parcela.cantidad),
    fraccion: fraccionDe(parcela.cantidad, maximo),
    porcentaje: porcentajeDecimal(parcela.cantidad, dashboard.totalArboles),
  }));
}

/** Suma de las filas: un árbol de un grupo sin parcela no entra en ninguna. */
function filaTotal(entrada: EntradaInforme): TotalParcelas {
  const { dashboard } = entrada;
  const arboles = dashboard.porParcela.reduce((suma, parcela) => suma + parcela.cantidad, 0);
  const grupos = gruposDeLasFilas(entrada).reduce((suma, cantidad) => suma + cantidad, 0);
  const { total, separador } = TEXTO_INFORME;
  return {
    titulo: `${total}${separador}${pluralizar(dashboard.porParcela.length, SUSTANTIVO.parcela)}`,
    grupos: formatearEntero(grupos),
    arboles: formatearEntero(arboles),
    porcentaje: conPorciento(porcentaje(arboles, dashboard.totalArboles)),
  };
}

function tablaParcelas(entrada: EntradaInforme) {
  const { totalArboles, porParcela } = entrada.dashboard;
  if (totalArboles === 0) return { filas: [], total: null, vacio: TEXTO_INFORME.sinArboles };
  if (porParcela.length === 0) return { filas: [], total: null, vacio: TEXTO_INFORME.sinParcelas };
  return { filas: filasParcelas(entrada), total: filaTotal(entrada), vacio: null };
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

function vacioDelMapa(total: number, puntos: readonly PuntoGps[] | null): string | null {
  if (total === 0) return TEXTO_INFORME.sinArboles;
  if (!puntos) return TEXTO_INFORME.mapaNoDisponible;
  return puntos.length === 0 ? TEXTO_INFORME.sinGps : null;
}

function mapa({ dashboard, puntos: leidos, parcelas }: EntradaInforme, colores: ColoresInforme) {
  const vacio = vacioDelMapa(dashboard.totalArboles, leidos);
  const puntos = leidos ?? [];
  return {
    puntos: puntos.map(({ lat, lng, codigo }) => ({ lat, lng, color: colores(codigo) })),
    etiquetas: etiquetasDeParcelas(puntos, parcelas),
    leyenda: leyenda(dashboard, colores),
    // La cuenta del indicador «Con GPS»: los puntos solo dibujan.
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
