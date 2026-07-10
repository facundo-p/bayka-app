/*
 * Búsqueda global multi-entidad para la paleta de comandos (⌘K).
 *
 * Estrategia: las listas chicas (plantaciones, especies, usuarios) reusan las
 * queries cacheables existentes y filtran en cliente; parcelas/grupos/árboles
 * se buscan server-side con `ilike` (la RLS acota a la organización) con un
 * tope por grupo. Todo corre en paralelo con Promise.all y se devuelve un
 * arreglo plano que el componente agrupa por `tipo`.
 *
 * Limitaciones documentadas:
 *  - Usuarios: no hay columna de email en `profiles`; se busca solo por nombre.
 *  - Árboles: no existe una columna "ID global Bayka" numérica conocida; se
 *    busca por `sub_id` (el SubID tipo "PAL23ANC12"), igual que ArbolesSection.
 */
import { supabase } from '../lib/supabase';
import { condicionIlikeOr, patronContiene } from './escaparBusqueda';
import { listarCatalogo } from './especieQueries';
import { listarPlantaciones } from './plantationQueries';
import { listarUsuariosConAsignaciones } from './usuarioQueries';

export type TipoResultado =
  | 'plantacion'
  | 'parcela'
  | 'grupo'
  | 'arbol'
  | 'especie'
  | 'usuario';

export type ResultadoBusqueda = {
  tipo: TipoResultado;
  id: string;
  titulo: string;
  meta?: string;
  /** Ruta de react-router a la que navegar al elegir el resultado. */
  to: string;
};

export type ScopeBusqueda = { plantationId: string };

/** Tope de resultados por grupo server-side (parcelas/grupos/árboles). */
const TOPE_POR_GRUPO = 8;

/** Tope de resultados por lista cacheada filtrada en cliente. */
const TOPE_LISTA = 6;

/** Mínimo de caracteres para disparar la búsqueda. */
const MINIMO_CARACTERES = 1;

/** ¿El texto (ya normalizado) aparece en alguno de los campos? */
function coincide(texto: string, ...campos: Array<string | null | undefined>): boolean {
  return campos.some((campo) => (campo ?? '').toLowerCase().includes(texto));
}

async function buscarPlantaciones(texto: string): Promise<ResultadoBusqueda[]> {
  const plantaciones = await listarPlantaciones();
  return plantaciones
    .filter((plantacion) => coincide(texto, plantacion.lugar, plantacion.periodo))
    .slice(0, TOPE_LISTA)
    .map((plantacion) => ({
      tipo: 'plantacion',
      id: plantacion.id,
      titulo: plantacion.lugar,
      meta: plantacion.periodo,
      to: `/plantaciones/${plantacion.id}`,
    }));
}

async function buscarEspecies(texto: string): Promise<ResultadoBusqueda[]> {
  const catalogo = await listarCatalogo();
  return catalogo
    .filter((especie) => coincide(texto, especie.codigo, especie.nombre, especie.nombreCientifico))
    .slice(0, TOPE_LISTA)
    .map((especie) => ({
      tipo: 'especie',
      id: especie.id,
      titulo: especie.nombre,
      meta: especie.nombreCientifico ?? especie.codigo,
      to: '/especies',
    }));
}

async function buscarUsuarios(texto: string): Promise<ResultadoBusqueda[]> {
  const usuarios = await listarUsuariosConAsignaciones();
  return usuarios
    .filter((usuario) => coincide(texto, usuario.nombre))
    .slice(0, TOPE_LISTA)
    .map((usuario) => ({
      tipo: 'usuario',
      id: usuario.id,
      titulo: usuario.nombre,
      meta: usuario.rol,
      to: '/usuarios',
    }));
}

type FilaParcelaBusqueda = {
  id: string;
  nombre: string;
  codigo: string;
  plantation_id: string;
  plantations: { lugar: string } | null;
};

async function buscarParcelas(texto: string, scope?: ScopeBusqueda): Promise<ResultadoBusqueda[]> {
  let consulta = supabase
    .from('parcelas')
    .select('id, nombre, codigo, plantation_id, plantations(lugar)')
    .is('deleted_at', null)
    .or(`${condicionIlikeOr('codigo', texto)},${condicionIlikeOr('nombre', texto)}`)
    .limit(TOPE_POR_GRUPO);
  if (scope) consulta = consulta.eq('plantation_id', scope.plantationId);
  const { data, error } = await consulta;
  if (error) return [];
  return ((data ?? []) as unknown as FilaParcelaBusqueda[]).map((fila) => ({
    tipo: 'parcela',
    id: fila.id,
    titulo: `${fila.codigo} · ${fila.nombre}`,
    meta: fila.plantations?.lugar ?? undefined,
    to: `/plantaciones/${fila.plantation_id}/datos/parcelas`,
  }));
}

type FilaGrupoBusqueda = {
  id: string;
  nombre: string;
  codigo: string;
  plantation_id: string;
  parcelas: { codigo: string } | null;
};

async function buscarGrupos(texto: string, scope?: ScopeBusqueda): Promise<ResultadoBusqueda[]> {
  let consulta = supabase
    .from('groups')
    .select('id, nombre, codigo, plantation_id, parcelas(codigo)')
    .or(`${condicionIlikeOr('codigo', texto)},${condicionIlikeOr('nombre', texto)}`)
    .limit(TOPE_POR_GRUPO);
  if (scope) consulta = consulta.eq('plantation_id', scope.plantationId);
  const { data, error } = await consulta;
  if (error) return [];
  return ((data ?? []) as unknown as FilaGrupoBusqueda[]).map((fila) => ({
    tipo: 'grupo',
    id: fila.id,
    titulo: `${fila.codigo} · ${fila.nombre}`,
    meta: fila.parcelas?.codigo ? `Parcela ${fila.parcelas.codigo}` : undefined,
    to: `/plantaciones/${fila.plantation_id}/datos/grupos`,
  }));
}

type FilaArbolBusqueda = {
  id: string;
  sub_id: string;
  species: { nombre: string } | null;
  groups: { plantation_id: string; codigo: string } | null;
};

async function buscarArboles(texto: string, scope?: ScopeBusqueda): Promise<ResultadoBusqueda[]> {
  let consulta = supabase
    .from('trees')
    .select('id, sub_id, species(nombre), groups!inner(plantation_id, codigo)')
    .ilike('sub_id', patronContiene(texto))
    .limit(TOPE_POR_GRUPO);
  if (scope) consulta = consulta.eq('groups.plantation_id', scope.plantationId);
  const { data, error } = await consulta;
  if (error) return [];
  return ((data ?? []) as unknown as FilaArbolBusqueda[])
    .filter((fila) => fila.groups !== null)
    .map((fila) => ({
      tipo: 'arbol',
      id: fila.id,
      titulo: fila.sub_id,
      meta: fila.species?.nombre ?? fila.groups?.codigo,
      // El listado de árboles lee la búsqueda del querystring `q` (filtrosUrl.ts):
      // deep-link que llega con el SubID ya pre-filtrado.
      to: `/plantaciones/${fila.groups!.plantation_id}/datos/arboles?q=${encodeURIComponent(fila.sub_id)}`,
    }));
}

/** Ejecuta un grupo tolerando fallos: si lanza, devuelve [] (no rompe la paleta). */
async function tolerante(
  promesa: Promise<ResultadoBusqueda[]>,
): Promise<ResultadoBusqueda[]> {
  try {
    return await promesa;
  } catch {
    return [];
  }
}

/**
 * Búsqueda combinada. Devuelve [] si el texto es muy corto. Cada grupo corre
 * en paralelo y tolera errores (devuelve [] en vez de romper la paleta).
 */
export async function buscar(
  texto: string,
  scope?: ScopeBusqueda,
): Promise<ResultadoBusqueda[]> {
  const normalizado = texto.trim().toLowerCase();
  if (normalizado.length < MINIMO_CARACTERES) return [];
  const grupos = await Promise.all([
    tolerante(buscarPlantaciones(normalizado)),
    tolerante(buscarParcelas(normalizado, scope)),
    tolerante(buscarGrupos(normalizado, scope)),
    tolerante(buscarArboles(normalizado, scope)),
    tolerante(buscarEspecies(normalizado)),
    tolerante(buscarUsuarios(normalizado)),
  ]);
  return grupos.flat();
}
