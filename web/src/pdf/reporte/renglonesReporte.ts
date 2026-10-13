/*
 * Los textos del reporte que vienen del usuario (ID, especie, parcela y grupo),
 * en los renglones de su caja antes del render (#876): enteros o cortados con
 * «…», según `CORTAR_TEXTO_LARGO`. Si los partiera o los cortara textkit,
 * achicaría los espacios hasta pegar las palabras. Corre en el worker, con las
 * fuentes ya registradas.
 */
import type { CodigoNombre } from '../../queries/fichasQueries';
import type { RotuloEspecie } from '../arbol/datosArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { conMemoria, type Medidor } from '../plantilla/medirTexto';
import { leerMedidores } from '../plantilla/medidores';
import type { Partidor, TextoEnRenglones } from '../plantilla/partirTexto';
import { renglonador } from '../plantilla/renglonador';
import { ANCHO_TEXTO_REPORTE, LETRA_REPORTE } from '../plantilla/tokens';
import type { ModeloArbolReporte, ModeloTarjeta } from './datosReporte';
import type { Reparto } from './planReporte';

/** Un medidor por cada letra de texto que se parte o se corta. */
export type MedidoresReporte = Record<keyof typeof LETRA_REPORTE, Medidor>;

export const leerMedidoresReporte = (): Promise<MedidoresReporte> => leerMedidores(LETRA_REPORTE);

/** Una parcela o un grupo: el primer renglón del nombre va detrás del código. */
export type CodigoEnRenglones = { codigo: string; nombre: TextoEnRenglones };

/** Los textos del usuario, que se parten o se cortan. */
export type CampoEnRenglones = 'idArbol' | 'especie' | 'parcela' | 'grupo';

type EnRenglones<T extends ModeloArbolReporte> = Omit<T, CampoEnRenglones> & {
  idArbol: TextoEnRenglones;
  especie: Omit<RotuloEspecie, 'titulo'> & { titulo: TextoEnRenglones };
  parcela: CodigoEnRenglones | null;
  grupo: CodigoEnRenglones;
};

export type FilaEnRenglones = EnRenglones<ModeloArbolReporte>;
export type TarjetaEnRenglones = EnRenglones<ModeloTarjeta>;
export type RepartoEnRenglones = Reparto<TarjetaEnRenglones, FilaEnRenglones>;

/** Cómo se arman los textos de un árbol en un bloque, cada uno con su letra. */
type Armado = {
  idArbol: Partidor;
  especie: Partidor;
  nombre: Partidor;
  medirCodigo: Medidor;
  anchoSeparador: number;
};

type LetrasDeBloque = Record<'idArbol' | 'especie' | 'nombre', Medidor>;

function armadoDe(letras: LetrasDeBloque, medirCodigo: Medidor): Armado {
  return {
    idArbol: renglonador(letras.idArbol),
    especie: renglonador(letras.especie),
    nombre: renglonador(letras.nombre),
    medirCodigo,
    anchoSeparador: letras.nombre(TEXTO_ARBOL.separadorCodigo),
  };
}

/** El primer renglón descuenta el código y el separador; los siguientes tienen todo el ancho. */
function conCodigo(entidad: CodigoNombre, ancho: number, armado: Armado): CodigoEnRenglones {
  const primero = ancho - armado.medirCodigo(entidad.codigo) - armado.anchoSeparador;
  return { codigo: entidad.codigo, nombre: armado.nombre(entidad.nombre, ancho, primero) };
}

type AnchosArbol = Record<keyof typeof ANCHO_TEXTO_REPORTE.tarjeta, number>;

function arbolEnRenglones<T extends ModeloArbolReporte>(
  arbol: T,
  anchos: AnchosArbol,
  armado: Armado,
): EnRenglones<T> {
  const { idArbol, especie, parcela, grupo } = arbol;
  return {
    ...arbol,
    idArbol: armado.idArbol(idArbol, anchos.idArbol),
    especie: { ...especie, titulo: armado.especie(especie.titulo, anchos.especie) },
    parcela: parcela && conCodigo(parcela, anchos.parcela, armado),
    grupo: conCodigo(grupo, anchos.grupo, armado),
  };
}

/** El reparto con los textos del usuario en los renglones de su caja; lo demás, igual. */
export function repartoEnRenglones(
  { tarjetas, listado }: Reparto<ModeloTarjeta, ModeloArbolReporte>,
  medidores: MedidoresReporte,
): RepartoEnRenglones {
  const medirCodigo = conMemoria(medidores.codigo);
  const { fila, dato, especieTarjeta, idFila, idTarjeta } = medidores;
  const enTarjeta = armadoDe(
    { idArbol: idTarjeta, especie: especieTarjeta, nombre: dato },
    medirCodigo,
  );
  const enFila = armadoDe({ idArbol: idFila, especie: fila, nombre: fila }, medirCodigo);
  const { tarjeta: anchosTarjeta, listado: anchosFila } = ANCHO_TEXTO_REPORTE;
  return {
    tarjetas: tarjetas.map((tarjeta) => arbolEnRenglones(tarjeta, anchosTarjeta, enTarjeta)),
    listado: listado.map((filaListado) => arbolEnRenglones(filaListado, anchosFila, enFila)),
  };
}
