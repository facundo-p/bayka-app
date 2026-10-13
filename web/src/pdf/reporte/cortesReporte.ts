/*
 * Especie, parcela y grupo cortados al ancho de su renglón antes del render
 * (#876): si los corta textkit, achica los espacios hasta pegar las palabras.
 * Corre en el worker, con las fuentes ya registradas. Corta por carácter, como
 * el `text-overflow` de CSS.
 */
import type { CodigoNombre } from '../../queries/fichasQueries';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import {
  conMemoria,
  cortadorConMemoria,
  type Cortador,
  type Medidor,
} from '../plantilla/cortarTexto';
import { medidorRegistrado } from '../plantilla/fuentes';
import { ANCHO_TEXTO_REPORTE, LETRA_REPORTE } from '../plantilla/tokens';
import type { ModeloArbolReporte, ModeloTarjeta } from './datosReporte';
import type { Reparto } from './planReporte';

type Letra = keyof typeof LETRA_REPORTE;

/** Un medidor por cada letra de renglón que se corta. */
export type MedidoresReporte = Record<Letra, Medidor>;

export async function leerMedidoresReporte(): Promise<MedidoresReporte> {
  const letras = Object.keys(LETRA_REPORTE) as Letra[];
  const medidores = await Promise.all(
    letras.map((letra) => medidorRegistrado(LETRA_REPORTE[letra])),
  );
  return Object.fromEntries(
    letras.map((letra, indice) => [letra, medidores[indice]]),
  ) as MedidoresReporte;
}

/** Cómo se corta el nombre de un renglón, detrás de su código en mono. */
type RenglonConCodigo = { cortar: Cortador; medirCodigo: Medidor; anchoSeparador: number };

type AnchosArbol = Record<keyof typeof ANCHO_TEXTO_REPORTE.tarjeta, number>;

function renglonConCodigo(medir: Medidor, medirCodigo: Medidor): RenglonConCodigo {
  const anchoSeparador = medir(TEXTO_ARBOL.separadorCodigo);
  return { cortar: cortadorConMemoria(medir), medirCodigo, anchoSeparador };
}

/** El nombre se corta en lo que dejan el código y el separador. */
function conCodigoAlAncho(
  entidad: CodigoNombre,
  ancho: number,
  renglon: RenglonConCodigo,
): CodigoNombre {
  const libre = ancho - renglon.medirCodigo(entidad.codigo) - renglon.anchoSeparador;
  return { ...entidad, nombre: renglon.cortar(entidad.nombre, libre) };
}

function cortarArbol<T extends ModeloArbolReporte>(
  arbol: T,
  anchos: AnchosArbol,
  renglon: RenglonConCodigo,
  cortarEspecie: Cortador,
): T {
  const { especie, parcela, grupo } = arbol;
  return {
    ...arbol,
    especie: { ...especie, titulo: cortarEspecie(especie.titulo, anchos.especie) },
    parcela: parcela && conCodigoAlAncho(parcela, anchos.parcela, renglon),
    grupo: conCodigoAlAncho(grupo, anchos.grupo, renglon),
  };
}

/** El reparto con lo que no entra ya cortado con «…»; lo demás, igual. */
export function cortarReparto(
  { tarjetas, listado }: Reparto<ModeloTarjeta, ModeloArbolReporte>,
  medidores: MedidoresReporte,
): Reparto<ModeloTarjeta, ModeloArbolReporte> {
  const medirCodigo = conMemoria(medidores.codigo);
  const enFila = renglonConCodigo(medidores.fila, medirCodigo);
  const enDato = renglonConCodigo(medidores.dato, medirCodigo);
  const especieTarjeta = cortadorConMemoria(medidores.especieTarjeta);
  const { tarjeta: anchosTarjeta, listado: anchosFila } = ANCHO_TEXTO_REPORTE;
  return {
    tarjetas: tarjetas.map((tarjeta) =>
      cortarArbol(tarjeta, anchosTarjeta, enDato, especieTarjeta),
    ),
    listado: listado.map((fila) => cortarArbol(fila, anchosFila, enFila, enFila.cortar)),
  };
}
