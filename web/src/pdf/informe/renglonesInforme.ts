/*
 * Los textos del informe que vienen del usuario (la línea bajo el título, el
 * nombre de cada especie y su código en la leyenda del mapa), en los renglones
 * de su caja antes del render (#883): enteros o cortados con «…», según
 * `CORTAR_TEXTO_LARGO`. Si los partiera o los cortara textkit, achicaría los
 * espacios hasta pegar las palabras. Va adentro del turno de
 * `renderizarEnSerie`, con las fuentes ya registradas.
 */
import { leerMedidores, type MedidoresDe } from '../plantilla/medidores';
import type { Partidor, TextoEnRenglones } from '../plantilla/partirTexto';
import { renglonador } from '../plantilla/renglonador';
import { ANCHO_TEXTO_INFORME, LETRA_INFORME } from '../plantilla/tokens';
import type { FilaEspecie, ItemLeyenda, MapaDelInforme, ModeloInforme } from './datosInforme';

/** Un medidor por cada letra de texto que se parte o se corta. */
export type MedidoresInforme = MedidoresDe<typeof LETRA_INFORME>;

export const leerMedidoresInforme = (): Promise<MedidoresInforme> => leerMedidores(LETRA_INFORME);

export type FilaEspecieEnRenglones = Omit<FilaEspecie, 'titulo'> & { titulo: TextoEnRenglones };

export type ItemLeyendaEnRenglones = Omit<ItemLeyenda, 'texto'> & { texto: TextoEnRenglones };

export type MapaEnRenglones = Omit<MapaDelInforme, 'leyenda'> & {
  leyenda: ItemLeyendaEnRenglones[];
};

type EspeciesEnRenglones = Omit<ModeloInforme['especies'], 'filas'> & {
  filas: FilaEspecieEnRenglones[];
};

export type InformeEnRenglones = Omit<ModeloInforme, 'linea' | 'especies' | 'mapa'> & {
  linea: TextoEnRenglones;
  especies: EspeciesEnRenglones;
  /** null si no se eligió el mapa. */
  mapa: MapaEnRenglones | null;
};

export type InformeConMapa = InformeEnRenglones & { mapa: MapaEnRenglones };

type Partidores = Record<keyof typeof LETRA_INFORME, Partidor>;

function especiesEnRenglones(especies: ModeloInforme['especies'], { fila }: Partidores) {
  const enRenglones = (especie: FilaEspecie) => ({
    ...especie,
    titulo: fila(especie.titulo, ANCHO_TEXTO_INFORME.especie),
  });
  return { ...especies, filas: especies.filas.map(enRenglones) };
}

function mapaEnRenglones(mapa: MapaDelInforme, { leyenda }: Partidores): MapaEnRenglones {
  const enRenglones = (item: ItemLeyenda) => ({
    ...item,
    texto: leyenda(item.texto, ANCHO_TEXTO_INFORME.leyenda),
  });
  return { ...mapa, leyenda: mapa.leyenda.map(enRenglones) };
}

/** El modelo con los textos del usuario en los renglones de su caja; lo demás, igual. */
export function informeEnRenglones(
  modelo: ModeloInforme,
  medidores: MedidoresInforme,
): InformeEnRenglones {
  const partidores: Partidores = {
    linea: renglonador(medidores.linea),
    fila: renglonador(medidores.fila),
    leyenda: renglonador(medidores.leyenda),
  };
  return {
    ...modelo,
    linea: partidores.linea(modelo.linea, ANCHO_TEXTO_INFORME.linea),
    especies: especiesEnRenglones(modelo.especies, partidores),
    mapa: modelo.mapa && mapaEnRenglones(modelo.mapa, partidores),
  };
}
