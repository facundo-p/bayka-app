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
import type { OpcionesInforme } from '../../lib/opcionesInforme';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { DashboardData, DistribucionEspecie } from '../../queries/dashboardQueries';
import { esSinIdentificar } from '../../queries/especiesConstantes';
import type { PuntoGps } from '../../queries/mapaQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import type { PuntoMapa } from '../mapa/planMapa';
import { lugarYPeriodo, type PlantacionDelEncabezado } from '../plantilla/textos';
import { TEXTO_INFORME } from './textosInforme';

export type EntradaInforme = {
  /** `calcularDashboard(fuente)`: siempre la plantación entera. */
  dashboard: DashboardData;
  /** null si no se pudieron leer o no se pidió el mapa. */
  puntos: readonly PuntoGps[] | null;
  plantacion: PlantacionDelEncabezado;
  objetivo: number | null;
  /** Los colores de la plantación, los mismos del dashboard (#845). */
  colorDe: ColorEspecie;
  /** Lo que se eligió sumar a los árboles registrados y las especies. */
  opciones: OpcionesInforme;
};

/** Un recuadro chico de la fila: el % con GPS o con foto. */
export type Indicador = { rotulo: string; valor: string; detalle: string };

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
  /** Los elegidos, en el orden de la fila; vacío si van solo los árboles. */
  porcentajes: Indicador[];
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

export type MapaDelInforme = {
  puntos: PuntoMapa[];
  /** «X de N árboles tienen coordenadas; …»; null si no hay puntos. */
  nota: string | null;
  /** Por qué no hay mapa; null si lo hay. */
  vacio: string | null;
};

export type ModeloInforme = {
  linea: string;
  indicadores: Indicadores;
  especies: { titulo: string; filas: FilaEspecie[]; vacio: string | null };
  /** null si no se eligió el mapa. */
  mapa: MapaDelInforme | null;
};

/** Si se eligió el mapa, en el modelo o en el mismo con los textos en renglones. */
export const tieneMapa = <T extends { mapa: object | null }>(
  modelo: T,
): modelo is T & { mapa: NonNullable<T['mapa']> } => modelo.mapa !== null;

const conPorciento = (valor: number | string) => `${valor}%`;

function fraccionDe(parte: number, maximo: number): number {
  return maximo === 0 ? 0 : parte / maximo;
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

function porcentajeGps(dashboard: DashboardData): Indicador {
  return {
    rotulo: TEXTO_INFORME.conGps,
    valor: conPorciento(dashboard.porcentajeConGps),
    detalle: pluralizar(dashboard.arbolesConGps, SUSTANTIVO.arbol),
  };
}

function porcentajeFoto(dashboard: DashboardData): Indicador {
  return {
    rotulo: TEXTO_INFORME.conFoto,
    valor: conPorciento(dashboard.porcentajeConFoto),
    detalle: pluralizar(dashboard.arbolesConFoto, SUSTANTIVO.arbol),
  };
}

function indicadores({ dashboard, objetivo, opciones }: EntradaInforme): Indicadores {
  return {
    arboles: indicadorArboles(dashboard.totalArboles, opciones.meta ? objetivo : null),
    porcentajes: [
      ...(opciones.gps ? [porcentajeGps(dashboard)] : []),
      ...(opciones.foto ? [porcentajeFoto(dashboard)] : []),
    ],
  };
}

/** «ANC · Anchico» o «N/N · Sin identificar». */
function tituloEspecie({ codigo, nombre }: DistribucionEspecie): string {
  if (esSinIdentificar(codigo))
    return etiquetaEspecie({ especieCodigo: null, especieNombre: null });
  return etiquetaEspecie({ especieCodigo: codigo, especieNombre: nombre });
}

function filasEspecies(dashboard: DashboardData, colores: ColorEspecie): FilaEspecie[] {
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

function especies(dashboard: DashboardData, colores: ColorEspecie) {
  const { especies: rotulo, separador, sinArboles } = TEXTO_INFORME;
  return {
    titulo: `${rotulo}${separador}${pluralizar(dashboard.especiesUsadas, SUSTANTIVO.especie)}`,
    filas: filasEspecies(dashboard, colores),
    vacio: dashboard.totalArboles === 0 ? sinArboles : null,
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

function mapa({ dashboard, puntos: leidos }: EntradaInforme, colores: ColorEspecie) {
  const puntos = puntosDeLasEspecies(dashboard, leidos);
  const vacio = vacioDelMapa(dashboard, puntos);
  return {
    puntos: puntos.map(({ lat, lng, codigo }) => ({ lat, lng, color: colores(codigo) })),
    nota: vacio ? null : notaCoordenadas(dashboard.arbolesConGps, dashboard.totalArboles),
    vacio,
  };
}

export function datosInforme(entrada: EntradaInforme): ModeloInforme {
  return {
    linea: lugarYPeriodo(entrada.plantacion),
    indicadores: indicadores(entrada),
    especies: especies(entrada.dashboard, entrada.colorDe),
    mapa: entrada.opciones.mapa ? mapa(entrada, entrada.colorDe) : null,
  };
}
