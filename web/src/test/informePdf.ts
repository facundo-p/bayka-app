/*
 * Entradas del informe PDF de N parcelas y M especies, determinísticas: los
 * conteos del dashboard y los puntos del mapa cuentan lo mismo.
 */
import type { EntradaInforme } from '../pdf/informe/datosInforme';
import type { DashboardData, DistribucionEspecie } from '../queries/dashboardQueries';
import type { PuntoGps } from '../queries/mapaQueries';

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
};

function especies(cantidad: number, nn: number): DistribucionEspecie[] {
  const codigos = [...CODIGOS_ESPECIE, ...CODIGOS_ESPECIE_EXTRA].slice(0, cantidad);
  const lista = codigos.map((codigo, indice) => ({
    codigo,
    nombre: `Especie ${codigo}`,
    cantidad: (cantidad - indice) * 10,
  }));
  return nn > 0
    ? [...lista, { codigo: CODIGO_NN, nombre: 'Sin identificar', cantidad: nn }]
    : lista;
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
    parcelas: Array.from({ length: opciones.parcelas }, (_, indice) => ({
      id: `parc-${indice}`,
      codigo: `P${indice + 1}`,
      grupos: 2,
    })),
    plantacion: { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26', estado: 'Activa' },
    objetivo: opciones.objetivo === undefined ? 8000 : opciones.objetivo,
    organizacion: 'Bayka',
  };
}
