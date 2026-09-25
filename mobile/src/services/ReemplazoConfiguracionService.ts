/**
 * Rechazos de los RPC de configuración de la plantación: especies (#635) y
 * técnicos (#636).
 */
import { esMotivoNoEscribible, PlantacionNoEscribibleError } from './PlantacionEscribibleService';

/** Rechazos de los RPC que no son un motivo de `motivo_no_escribible`. */
export const RECHAZO_CONFIGURACION = {
  sinPermiso: 'NOT_AUTHORIZED',
  especieInexistente: 'ESPECIE_INEXISTENTE',
  especieConArboles: 'ESPECIE_CON_ARBOLES',
  usuarioDeOtraOrganizacion: 'USUARIO_DE_OTRA_ORGANIZACION',
  tecnicoInactivo: 'TECNICO_INACTIVO',
} as const;

type RechazoConfiguracion = (typeof RECHAZO_CONFIGURACION)[keyof typeof RECHAZO_CONFIGURACION];

const NO_SE_GUARDARON = 'Los cambios no se guardaron.';

const MENSAJE_POR_RECHAZO: Record<RechazoConfiguracion, string> = {
  [RECHAZO_CONFIGURACION.sinPermiso]: `No tenés permiso para cambiar esta plantación. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.especieInexistente]:
    `Alguna de las especies elegidas ya no existe en el servidor. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.especieConArboles]:
    `Alguna de las especies que quitaste ya tiene árboles registrados en el servidor. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.usuarioDeOtraOrganizacion]:
    `Alguno de los técnicos elegidos no pertenece a tu organización. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.tecnicoInactivo]: `Alguno de los técnicos elegidos está dado de baja. ${NO_SE_GUARDARON}`,
};

export class ReemplazoRechazadoError extends Error {
  constructor(readonly rechazo: string) {
    super(MENSAJE_POR_RECHAZO[rechazo as RechazoConfiguracion] ?? `El servidor rechazó el cambio. ${NO_SE_GUARDARON}`);
    this.name = 'ReemplazoRechazadoError';
  }
}

export function errorDeRechazo(codigo: string): Error {
  return esMotivoNoEscribible(codigo) ? new PlantacionNoEscribibleError(codigo) : new ReemplazoRechazadoError(codigo);
}
