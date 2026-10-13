/*
 * Especie, parcela y grupo cortados al ancho de su renglón antes del render
 * (#876): si los corta textkit, achica los espacios hasta pegar las palabras.
 * Corre en el worker, con las fuentes ya registradas.
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
import { ANCHO_TEXTO_REPORTE } from '../plantilla/tokens';
import type { ModeloArbolReporte, ModeloTarjeta } from './datosReporte';
import type { Reparto } from './planReporte';
import { LETRA_REPORTE } from './Reporte.styles';

type Letra = keyof typeof LETRA_REPORTE;

/** Un medidor por cada letra de renglón que se corta. */
export type MedidasReporte = Record<Letra, Medidor>;

export async function leerMedidasReporte(): Promise<MedidasReporte> {
  const letras = Object.keys(LETRA_REPORTE) as Letra[];
  const medidores = await Promise.all(
    letras.map((letra) => medidorRegistrado(LETRA_REPORTE[letra])),
  );
  return Object.fromEntries(
    letras.map((letra, indice) => [letra, medidores[indice]]),
  ) as MedidasReporte;
}

/** Cómo se corta el nombre de un renglón, detrás de su código en mono. */
type Renglon = { cortar: Cortador; medirCodigo: Medidor; anchoSeparador: number };

type AnchosArbol = Record<'especie' | 'parcela' | 'grupo', number>;

function renglon(medir: Medidor, medirCodigo: Medidor): Renglon {
  const anchoSeparador = medir(TEXTO_ARBOL.separadorCodigo);
  return { cortar: cortadorConMemoria(medir), medirCodigo, anchoSeparador };
}

/** El nombre se corta en lo que dejan el código y el separador. */
function conCodigoAlAncho(entidad: CodigoNombre, ancho: number, renglon: Renglon): CodigoNombre {
  const libre = ancho - renglon.medirCodigo(entidad.codigo) - renglon.anchoSeparador;
  return { ...entidad, nombre: renglon.cortar(entidad.nombre, libre) };
}

function cortarArbol<T extends ModeloArbolReporte>(
  arbol: T,
  anchos: AnchosArbol,
  renglon: Renglon,
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
  medidas: MedidasReporte,
): Reparto<ModeloTarjeta, ModeloArbolReporte> {
  const medirCodigo = conMemoria(medidas.codigo);
  const enFila = renglon(medidas.fila, medirCodigo);
  const enDato = renglon(medidas.dato, medirCodigo);
  const especieTarjeta = cortadorConMemoria(medidas.especieTarjeta);
  const { tarjeta: anchosTarjeta, listado: anchosFila } = ANCHO_TEXTO_REPORTE;
  return {
    tarjetas: tarjetas.map((tarjeta) =>
      cortarArbol(tarjeta, anchosTarjeta, enDato, especieTarjeta),
    ),
    listado: listado.map((fila) => cortarArbol(fila, anchosFila, enFila, enFila.cortar)),
  };
}
