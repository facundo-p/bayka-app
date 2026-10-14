import { Image, Text, View } from '@react-pdf/renderer';
import type { EspecieArbol } from '../arbol/datosArbol';
import { Dato, DatosDeUbicacion, Foto, Gps, RenglonEspecie, Vacio } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { LlamadaSatelite } from '../mapa/LlamadaSatelite';
import { ESTADO_MAPA, esMapaListo, type MapaPdf } from '../mapa/estadoMapa';
import type { ModeloFicha } from './datosFicha';
import { fichaStyles as styles } from './Ficha.styles';
import { ICONO_FICHA, IconoFicha } from './IconoFicha';
import { tamanoIdArbol } from './tamanoIdArbol';
import { TEXTO_FICHA } from './textosFicha';

const TEXTO_MAPA_FALTANTE = {
  [ESTADO_MAPA.sinGps]: TEXTO_FICHA.sinPuntoGps,
  [ESTADO_MAPA.noDisponible]: TEXTO_FICHA.mapaNoDisponible,
} as const;

function Especie({ especie }: { especie: EspecieArbol }) {
  return (
    <View>
      <RenglonEspecie especie={especie} styles={styles} />
      {especie.cientifico && <Text style={styles.cientifico}>{especie.cientifico}</Text>}
      {especie.clasificacion && <Text style={styles.clasificacion}>{especie.clasificacion}</Text>}
    </View>
  );
}

function IdArbol({ idArbol }: { idArbol: string }) {
  return (
    <View style={styles.id}>
      <Text style={styles.rotulo}>{TEXTO_ARBOL.idArbol}</Text>
      {/* El tamaño sale del largo del ID. */}
      <Text style={[styles.idArbol, { fontSize: tamanoIdArbol(idArbol) }]}>{idArbol}</Text>
    </View>
  );
}

function Mapa({ mapa }: { mapa: MapaPdf }) {
  if (!esMapaListo(mapa)) {
    const texto = TEXTO_MAPA_FALTANTE[mapa.estado];
    return <Vacio texto={texto} styles={styles} icono={<IconoFicha icono={ICONO_FICHA.pin} />} />;
  }
  return (
    <View>
      <Image style={styles.mapa} src={mapa.src} />
      {mapa.conSatelite && <LlamadaSatelite style={styles.llamada} />}
    </View>
  );
}

/** Junto a la foto: qué árbol es, cuándo y quién lo registró. */
function Identidad({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.texto}>
      <Especie especie={ficha.especie} />
      <IdArbol idArbol={ficha.idArbol} />
      <View style={styles.registro}>
        <Dato rotulo={TEXTO_ARBOL.registrado} styles={styles}>
          {ficha.registrado}
        </Dato>
        <Dato rotulo={TEXTO_FICHA.tecnico} styles={styles}>
          {ficha.tecnico}
        </Dato>
      </View>
    </View>
  );
}

function SinPunto() {
  return <Text style={styles.tenue}>{TEXTO_FICHA.sinPunto}</Text>;
}

/** Junto al mapa: dónde está. */
function Ubicacion({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.texto}>
      <DatosDeUbicacion modelo={ficha} styles={styles} />
      <Dato rotulo={TEXTO_ARBOL.gps} styles={styles}>
        <Gps gps={ficha.gps} styles={styles} sinPunto={<SinPunto />} />
      </Dato>
    </View>
  );
}

/** La ficha de un árbol a hoja entera: cada bloque de datos junto a la foto o al mapa. */
export function Ficha({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View wrap={false}>
      <View style={[styles.fila, styles.filaFoto]}>
        <Identidad ficha={ficha} />
        <Foto foto={ficha.foto} styles={styles} icono={<IconoFicha icono={ICONO_FICHA.camara} />} />
      </View>
      <View style={styles.fila}>
        <Ubicacion ficha={ficha} />
        <Mapa mapa={ficha.mapa} />
      </View>
    </View>
  );
}
