/**
 * Cómo se agrupan los conflictos de sincronización (#804): una sección por grupo y
 * por árbol, y el aviso dentro del grupo. Lógica pura.
 */
import { CAMPO_EN_CONFLICTO, esCampoDeGrupo, type CampoDeGrupo, type CampoEnConflicto } from '../constants/conflictoDeSync';
import type { ConflictoEnContexto } from '../types/conflictoDeSync';

export interface SeccionDeConflictos<T> {
  clave: string;
  titulo: string;
  sub: string | null;
  conflictos: T[];
}

const PREFIJO_DE_SECCION = { grupo: 'grupo', arbol: 'arbol' } as const;

/** Dentro de una sección, los campos en el orden en que se cargan. */
const ORDEN_DE_CAMPOS: readonly CampoEnConflicto[] = [
  CAMPO_EN_CONFLICTO.especie,
  CAMPO_EN_CONFLICTO.gps,
  CAMPO_EN_CONFLICTO.foto,
  CAMPO_EN_CONFLICTO.codigo,
  CAMPO_EN_CONFLICTO.nombre,
  CAMPO_EN_CONFLICTO.tipo,
  CAMPO_EN_CONFLICTO.estado,
];

const esDelGrupo = (c: ConflictoEnContexto) => esCampoDeGrupo(c.conflicto.campo);

const claveDeSeccion = (c: ConflictoEnContexto) => (esDelGrupo(c)
  ? `${PREFIJO_DE_SECCION.grupo}:${c.conflicto.grupoId}`
  : `${PREFIJO_DE_SECCION.arbol}:${c.conflicto.entidadId}`);

function encabezado(c: ConflictoEnContexto): Pick<SeccionDeConflictos<unknown>, 'titulo' | 'sub'> {
  const grupo = c.grupo ? `Grupo ${c.grupo.codigo}` : 'Grupo borrado';
  if (esDelGrupo(c)) return { titulo: grupo, sub: c.grupo?.nombre ?? null };
  return { titulo: c.arbol ? `Árbol ${c.arbol.subId}` : 'Árbol borrado', sub: grupo };
}

const comparar = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

/** Un grupo borrado no tiene código: va al final. */
const codigoDelGrupo = (c: ConflictoEnContexto) => c.grupo?.codigo ?? '\uffff';

/** Por código de grupo; dentro de cada grupo, sus datos primero y después los árboles por posición. */
function orden(a: ConflictoEnContexto, b: ConflictoEnContexto): number {
  return comparar(codigoDelGrupo(a), codigoDelGrupo(b))
    || comparar(a.conflicto.grupoId, b.conflicto.grupoId)
    || Number(esDelGrupo(b)) - Number(esDelGrupo(a))
    || (a.arbol?.posicion ?? 0) - (b.arbol?.posicion ?? 0)
    || comparar(a.conflicto.entidadId, b.conflicto.entidadId)
    || ORDEN_DE_CAMPOS.indexOf(a.conflicto.campo) - ORDEN_DE_CAMPOS.indexOf(b.conflicto.campo);
}

/** Varios conflictos del mismo árbol o del mismo grupo van en la misma sección. */
export function seccionesDeConflictos<T extends ConflictoEnContexto>(conflictos: T[]): SeccionDeConflictos<T>[] {
  const secciones = new Map<string, SeccionDeConflictos<T>>();
  for (const c of [...conflictos].sort(orden)) {
    const clave = claveDeSeccion(c);
    const seccion = secciones.get(clave) ?? { clave, ...encabezado(c), conflictos: [] };
    seccion.conflictos.push(c);
    secciones.set(clave, seccion);
  }
  return [...secciones.values()];
}

const DATO_DEL_GRUPO: Record<CampoDeGrupo, string> = {
  [CAMPO_EN_CONFLICTO.nombre]: 'el nombre del grupo',
  [CAMPO_EN_CONFLICTO.codigo]: 'el código del grupo',
  [CAMPO_EN_CONFLICTO.tipo]: 'el tipo del grupo',
  [CAMPO_EN_CONFLICTO.estado]: 'el estado del grupo',
};

export interface ConflictosDelGrupo {
  /** Los árboles con algún conflicto. */
  arboles: ReadonlySet<string>;
  camposDeGrupo: CampoDeGrupo[];
}

export function conflictosDelGrupo(filas: { entidadId: string; campo: CampoEnConflicto }[]): ConflictosDelGrupo {
  const camposDeGrupo = filas.map((f) => f.campo).filter(esCampoDeGrupo);
  const arboles = new Set(filas.filter((f) => !esCampoDeGrupo(f.campo)).map((f) => f.entidadId));
  return { arboles, camposDeGrupo };
}

function sujetoDelAviso({ arboles, camposDeGrupo }: ConflictosDelGrupo): string[] {
  const partes: string[] = [];
  if (arboles.size > 0) partes.push(arboles.size === 1 ? '1 árbol' : `${arboles.size} árboles`);
  if (camposDeGrupo.length === 1) partes.push(DATO_DEL_GRUPO[camposDeGrupo[0]]);
  if (camposDeGrupo.length > 1) partes.push('los datos del grupo');
  return partes;
}

/** "2 árboles y el nombre del grupo tienen cambios por resolver…". Null si no hay nada. */
export function textoDeAvisoDeGrupo(conflictos: ConflictosDelGrupo): string | null {
  const partes = sujetoDelAviso(conflictos);
  if (partes.length === 0) return null;
  const plural = partes.length > 1 || conflictos.arboles.size > 1 || conflictos.camposDeGrupo.length > 1;
  const sujeto = partes.join(' y ');
  const conMayuscula = sujeto.charAt(0).toUpperCase() + sujeto.slice(1);
  return `${conMayuscula} ${plural ? 'tienen' : 'tiene'} cambios por resolver. `
    + 'El grupo no termina de sincronizarse hasta que elijas.';
}
