/**
 * Filtros de PostgREST que encadena la web, evaluados contra las fixtures. Una
 * columna con punto (`groups.plantation_id`) se lee dentro del embebido.
 */
import type { FilaDemo } from './datos';
import { desentrecomillar, partirNivelSuperior } from './gramatica';

export const OPERADOR = {
  eq: 'eq',
  neq: 'neq',
  is: 'is',
  in: 'in',
  like: 'like',
  ilike: 'ilike',
} as const;

export type Operador = (typeof OPERADOR)[keyof typeof OPERADOR];

export type Condicion = { columna: string; operador: Operador; valor: unknown; negada?: boolean };

/** `.or()`: la fila entra si cumple alguna. */
export type Alternativas = { alternativas: Condicion[] };

export type FiltroDemo = Condicion | Alternativas;

type Comparador = (celda: unknown, valor: unknown) => boolean;

/** Una columna que las fixtures no modelan no filtra: la fila pasa. */
const NO_MODELADA = Symbol('columna no modelada');

const SEPARADOR_DE_RUTA = '.';
/** `columna.operador.valor` de una condición de `.or()`. */
const PATRON_CONDICION = /^(\w+)\.(\w+)\.(.*)$/s;
/** Sin comillas, `null` es el literal: `foto_url.is.null`. */
const LITERAL_NULL = 'null';
/** Un carácter escapado con `\` o uno suelto. */
const PIEZA_LIKE = /\\(.)|./gs;
const COMODIN_LIKE: Readonly<Record<string, string | undefined>> = { '%': '.*', _: '.' };
const ESPECIAL_REGEX = /[.*+?^${}()|[\]\\]/g;

function escaparRegex(texto: string): string {
  return texto.replace(ESPECIAL_REGEX, '\\$&');
}

function regexLike(patron: string, sinMayusculas: boolean): RegExp {
  const cuerpo = patron.replace(PIEZA_LIKE, (pieza, escapado?: string) =>
    escapado === undefined ? (COMODIN_LIKE[pieza] ?? escaparRegex(pieza)) : escaparRegex(escapado),
  );
  return new RegExp(`^${cuerpo}$`, sinMayusculas ? 'is' : 's');
}

const iguales: Comparador = (celda, valor) => celda === valor;

/** Como en SQL, NULL no cumple ningún LIKE. */
const coincideLike =
  (sinMayusculas: boolean): Comparador =>
  (celda, valor) =>
    typeof celda === 'string' && regexLike(String(valor), sinMayusculas).test(celda);

const COMPARADORES: Record<Operador, Comparador> = {
  eq: iguales,
  neq: (celda, valor) => celda !== valor,
  is: iguales,
  in: (celda, valor) => Array.isArray(valor) && valor.includes(celda),
  like: coincideLike(false),
  ilike: coincideLike(true),
};

function esOperador(texto: string): texto is Operador {
  return Object.values<string>(OPERADOR).includes(texto);
}

/** Tira en vez de ignorarlo: un filtro que no filtra devolvería todo y engañaría al revisar. */
export function operadorSoportado(operador: string): Operador {
  if (esOperador(operador)) return operador;
  throw new Error(`El cliente demo no soporta el operador de PostgREST "${operador}"`);
}

export function negacion(columna: string, operador: string, valor: unknown): Condicion {
  return { columna, operador: operadorSoportado(operador), valor, negada: true };
}

function condicionDeOr(texto: string): Condicion {
  const partes = PATRON_CONDICION.exec(texto);
  if (!partes) throw new Error(`El cliente demo no entiende la condición de or(): ${texto}`);
  const [, columna, operador, crudo] = partes;
  const valor = crudo === LITERAL_NULL ? null : desentrecomillar(crudo);
  return { columna, operador: operadorSoportado(operador), valor };
}

export function alternativasDe(condiciones: string): Alternativas {
  return { alternativas: partirNivelSuperior(condiciones).map(condicionDeOr) };
}

/** Un embebido null (FK null) da null en sus columnas, así un `eq` no lo deja pasar. */
function leerRuta(fila: FilaDemo, columna: string): unknown {
  return columna.split(SEPARADOR_DE_RUTA).reduce<unknown>((actual, clave) => {
    if (actual === NO_MODELADA || actual === null) return actual;
    const objeto = actual as FilaDemo;
    return typeof actual === 'object' && clave in objeto ? objeto[clave] : NO_MODELADA;
  }, fila);
}

function cumpleCondicion(fila: FilaDemo, { columna, operador, valor, negada }: Condicion): boolean {
  const celda = leerRuta(fila, columna);
  if (celda === NO_MODELADA) return true;
  const cumple = COMPARADORES[operador](celda, valor);
  return negada ? !cumple : cumple;
}

function cumpleFiltro(fila: FilaDemo, filtro: FiltroDemo): boolean {
  if (!('alternativas' in filtro)) return cumpleCondicion(fila, filtro);
  return filtro.alternativas.some((condicion) => cumpleCondicion(fila, condicion));
}

export function cumpleTodos(fila: FilaDemo, filtros: FiltroDemo[]): boolean {
  return filtros.every((filtro) => cumpleFiltro(fila, filtro));
}
