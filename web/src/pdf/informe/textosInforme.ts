import { SIN_DATO } from '../../lib/formato';
import { ESPECIE_NO_RESUELTA } from '../../queries/especiesConstantes';
import { TEXTO_PLANTILLA } from '../plantilla/textos';

/** Textos visibles del informe de plantación. */
export const TEXTO_INFORME = {
  documento: 'Informe de plantación',
  periodo: 'Período',
  plantacion: TEXTO_PLANTILLA.plantacion,
  estado: 'Estado:',
  arboles: 'Árboles registrados',
  de: TEXTO_PLANTILLA.de,
  deLaMeta: 'de la meta',
  conGps: 'Con GPS',
  conFoto: 'Con foto',
  pendientes: 'N/N pendientes',
  sinEspecie: 'Sin especie identificada',
  especies: 'Distribución por especie',
  parcelas: 'Árboles por parcela',
  columnaParcela: 'Parcela',
  columnaGrupos: 'Grupos',
  columnaArboles: 'Árboles',
  columnaPorcentaje: '%',
  total: 'Total',
  sinParcela: 'Sin parcela',
  sinDato: SIN_DATO,
  mapa: 'Puntos GPS por especie',
  sinArboles: 'Todavía no hay árboles registrados.',
  sinParcelas: 'La plantación no tiene parcelas.',
  sinGps: 'Ningún árbol tiene coordenadas GPS: no hay puntos para mostrar en el mapa.',
  mapaNoDisponible: 'Mapa no disponible.',
  tienenCoordenadas: 'tienen coordenadas',
  restanteUno: 'el restante no aparece en el mapa',
  restantesPrefijo: 'los',
  restantesSufijo: 'restantes no aparecen en el mapa',
  nn: ESPECIE_NO_RESUELTA,
  separador: TEXTO_PLANTILLA.separador,
} as const;
