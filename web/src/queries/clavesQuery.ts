import type { QueryKey } from '@tanstack/react-query';

/**
 * Claves de TanStack Query de toda la web. El primer segmento identifica la
 * familia y es único: invalidar solo ese segmento (`['plantacion']`) alcanza a
 * todas sus variantes sin tocar otra familia.
 */
export const CLAVE_QUERY = {
  plantaciones: () => ['plantaciones'] as const,
  plantacion: (plantationId: string) => ['plantacion', plantationId] as const,
  temporadaActiva: () => ['temporada-activa'] as const,
  idsGenerados: (plantationId: string) => ['ids-generados', plantationId] as const,
  seedSugerido: () => ['seed-sugerido'] as const,

  dashboard: (plantationId: string) => ['dashboard', plantationId] as const,
  mapa: (plantationId: string) => ['mapa', plantationId] as const,
  datosParcelas: (plantationId: string) => ['datos-parcelas', plantationId] as const,
  datosGrupos: (plantationId: string, parcelaId: string) =>
    ['datos-grupos', plantationId, parcelaId] as const,
  datosArboles: (plantationId: string, filtros: Readonly<Record<string, string>>, pagina: number) =>
    ['datos-arboles', plantationId, filtros, pagina] as const,
  foto: (fotoUrl: string) => ['foto', fotoUrl] as const,

  especiesCatalogo: () => ['especies-catalogo'] as const,
  especiesCatalogoUso: () => ['especies-catalogo-uso'] as const,
  especiePlantaciones: (especieId: string) => ['especie-plantaciones', especieId] as const,
  plantacionEspecies: (plantationId: string) => ['plantacion-especies', plantationId] as const,

  perfiles: () => ['perfiles'] as const,
  usuarios: () => ['usuarios'] as const,
  usuarioPlantaciones: (userId: string) => ['usuario-plantaciones', userId] as const,
  plantacionUsuarios: (plantationId: string) => ['plantacion-usuarios', plantationId] as const,
} as const;

/** Prefijo que abarca todas las variantes de una fábrica, para invalidar la
 *  familia sin conocer sus parámetros. El primer segmento no depende de ellos. */
export function familia(fabrica: (...args: never[]) => QueryKey): QueryKey {
  return [(fabrica as () => QueryKey)()[0]];
}
