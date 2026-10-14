/** Grupos de rutas de expo-router: el primer segmento de la ruta decide la app por rol. */
export const GRUPO_DE_RUTAS = {
  auth: '(auth)',
  admin: '(admin)',
  tecnico: '(tecnico)',
} as const;

export type GrupoDeRutas = (typeof GRUPO_DE_RUTAS)[keyof typeof GRUPO_DE_RUTAS];

/** Admin y superadmin navegan bajo `(admin)`. */
export const esRutaAdmin = (prefijo: string) => prefijo === GRUPO_DE_RUTAS.admin;
