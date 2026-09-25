/**
 * Campos de una edición offline que chocaron con un cambio hecho en la web (#634).
 * Mientras el usuario no elige, queda el valor de la web y el conflicto se guarda en
 * la plantación; lógica pura, sin acceso a datos.
 */
import {
  campoDeColumnaRemota,
  type CampoDePlantacion,
  type CamposDePlantacion,
} from './camposDePlantacion';

export type ValorDeCampo = CamposDePlantacion[CampoDePlantacion];

export interface ConflictoDeCampo {
  campo: CampoDePlantacion;
  /** Lo que cargó el usuario en el teléfono. */
  mio: ValorDeCampo;
  /** Lo que quedó en el server. */
  web: ValorDeCampo;
  /** Lo que había antes de los dos cambios. */
  anterior: ValorDeCampo;
  /** Nombre de quien lo cambió en el server, si se sabe. */
  editadoPor: string | null;
  editadoEn: string | null;
  /** Cuándo lo editó el usuario en el teléfono. */
  mioEn: string | null;
}

/** Un conflicto tal como lo devuelve `editar_plantacion`. */
export interface ConflictoRemoto {
  campo: string;
  valor_servidor: unknown;
  editado_por?: string | null;
  editado_en?: string | null;
}

export const ELECCION = {
  mio: 'mio',
  web: 'web',
} as const;

export type Eleccion = (typeof ELECCION)[keyof typeof ELECCION];

type EdicionEnviada = {
  cambios: Partial<CamposDePlantacion>;
  base: Partial<CamposDePlantacion>;
  mioEn: string | null;
};

/** Los conflictos que devolvió el server, con el valor propio y el anterior de cada campo. */
export function conflictosDesdeRemotos(remotos: ConflictoRemoto[], enviada: EdicionEnviada): ConflictoDeCampo[] {
  return remotos.flatMap((remoto) => {
    const campo = campoDeColumnaRemota(remoto.campo);
    if (!campo) return [];
    return [{
      campo,
      mio: enviada.cambios[campo] as ValorDeCampo,
      web: remoto.valor_servidor as ValorDeCampo,
      anterior: enviada.base[campo] as ValorDeCampo,
      editadoPor: remoto.editado_por ?? null,
      editadoEn: remoto.editado_en ?? null,
      mioEn: enviada.mioEn,
    }];
  });
}

/** Los valores del server de cada campo en conflicto: lo que queda mientras no se elige. */
export function valoresDeLaWeb(conflictos: ConflictoDeCampo[]): Partial<CamposDePlantacion> {
  return Object.fromEntries(conflictos.map((c) => [c.campo, c.web])) as Partial<CamposDePlantacion>;
}

/** Los campos de `cambios` que el server aplicó: todos menos los que chocaron. */
export function aplicados(
  cambios: Partial<CamposDePlantacion>,
  conflictos: ConflictoDeCampo[],
): Partial<CamposDePlantacion> {
  const enConflicto = new Set(conflictos.map((c) => c.campo));
  return Object.fromEntries(
    Object.entries(cambios).filter(([campo]) => !enConflicto.has(campo as CampoDePlantacion)),
  ) as Partial<CamposDePlantacion>;
}

/**
 * Los conflictos que siguen pendientes tras subir `subidos`: un campo que se volvió a subir
 * ya no está en conflicto (se aplicó o chocó de nuevo, y entonces viene en `nuevos`). Null si
 * no queda ninguno, que es lo que guarda la plantación.
 */
export function combinarConflictos(
  previos: ConflictoDeCampo[] | null | undefined,
  subidos: Partial<CamposDePlantacion>,
  nuevos: ConflictoDeCampo[],
): ConflictoDeCampo[] | null {
  const vigentes = (previos ?? []).filter((c) => subidos[c.campo] === undefined);
  const todos = [...vigentes, ...nuevos];
  return todos.length > 0 ? todos : null;
}

export function tieneCambiosPorResolver(p: { conflictosDeEdicion?: ConflictoDeCampo[] | null }): boolean {
  return (p.conflictosDeEdicion?.length ?? 0) > 0;
}

type ResultadoDeSync = { success: boolean; plantacionId: string; nombre: string; cambiosPorResolver?: number };

/** Las plantaciones de un sync que quedaron con cambios por resolver. */
export function cambiosPorResolverDe(
  resultados: ResultadoDeSync[],
): { plantacionId: string; nombre: string; cantidad: number }[] {
  return resultados
    .filter((r) => r.success && (r.cambiosPorResolver ?? 0) > 0)
    .map((r) => ({ plantacionId: r.plantacionId, nombre: r.nombre, cantidad: r.cambiosPorResolver ?? 0 }));
}
