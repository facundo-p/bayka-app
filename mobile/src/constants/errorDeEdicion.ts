/** Rechazos de un repositorio que la UI ya evita pero el repo igual tiene que hacer cumplir. */
export const ERROR_DE_EDICION = {
  plantacionNoEditable: 'plantacion_no_editable',
} as const;

export type ErrorDeEdicion = (typeof ERROR_DE_EDICION)[keyof typeof ERROR_DE_EDICION];
