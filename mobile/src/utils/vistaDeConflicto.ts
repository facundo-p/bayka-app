/** Lo que muestra una tarjeta de "Resolver cambios": un dato y sus dos valores. */

/** La foto de una opción: local, o un path de Storage que se baja al mostrarla. */
export interface FotoDeOpcion {
  treeId: string;
  uri: string;
  /** Sin conexión, una foto que no está en el teléfono no se puede bajar. */
  enLinea: boolean;
  /** Para lectores de pantalla. */
  descripcion: string;
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
  /** Lo que se pierde al guardar: se muestra como advertencia. */
  advertencia?: string | null;
  /** Por qué no se puede conservar lo propio: esa opción queda deshabilitada. */
  motivo?: string | null;
  /** El último guardado no se aplicó: cambió de nuevo o falló. */
  aviso?: string | null;
}
