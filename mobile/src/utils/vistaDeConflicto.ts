/** Lo que muestra una tarjeta de "Resolver cambios": un dato y sus dos valores. */

/** La foto de una opción: local, o un path de Storage que se baja al mostrarla. */
export interface FotoDeOpcion {
  treeId: string;
  uri: string;
  /** Sin conexión, una foto que no está en el teléfono no se puede bajar. */
  enLinea: boolean;
}

export interface OpcionDeConflicto {
  origen: string;
  valor: string;
  detalle?: string | null;
  foto?: FotoDeOpcion | null;
}

export interface VistaDeConflicto {
  titulo: string;
  mio: OpcionDeConflicto;
  otro: OpcionDeConflicto;
  nota?: string | null;
  /** Por qué no se puede conservar lo propio: esa opción queda deshabilitada. */
  motivo?: string | null;
}
