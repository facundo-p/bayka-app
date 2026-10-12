import { Image, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { CodigoNombre } from '../../queries/fichasQueries';
import { SIN_DATO } from '../../lib/formato';
import { ESTADO_FOTO, esFotoLista, type FotoPdf } from '../estadoFoto';
import { LlamadaSatelite } from '../mapa/LlamadaSatelite';
import { ESTADO_MAPA, esMapaListo, type MapaPdf } from '../mapa/estadoMapa';
import type { EspecieFicha, GpsFicha, ModeloFicha } from './datosFicha';
import { fichaStyles as styles, tamanoIdArbol } from './Ficha.styles';
import { ICONO_FICHA, IconoFicha, type TrazosIcono } from './IconoFicha';
import { TEXTO_FICHA } from './textosFicha';

const TEXTO_FOTO_FALTANTE = {
  [ESTADO_FOTO.sinFoto]: TEXTO_FICHA.sinFoto,
  [ESTADO_FOTO.noDisponible]: TEXTO_FICHA.fotoNoDisponible,
} as const;

const TEXTO_MAPA_FALTANTE = {
  [ESTADO_MAPA.sinGps]: TEXTO_FICHA.sinPuntoGps,
  [ESTADO_MAPA.noDisponible]: TEXTO_FICHA.mapaNoDisponible,
} as const;

function Especie({ especie }: { especie: EspecieFicha }) {
  return (
    <View>
      <View style={styles.filaEspecie}>
        {/* El color sale del dato, no del tema. */}
        <View style={[styles.punto, { backgroundColor: especie.color }]} />
        <Text style={[styles.nombreEspecie, especie.sinIdentificar ? styles.sinIdentificar : {}]}>
          {especie.titulo}
        </Text>
      </View>
      {especie.cientifico && <Text style={styles.cientifico}>{especie.cientifico}</Text>}
      {especie.clasificacion && <Text style={styles.clasificacion}>{especie.clasificacion}</Text>}
    </View>
  );
}

function IdArbol({ idArbol }: { idArbol: string }) {
  return (
    <View style={styles.id}>
      <Text style={styles.rotulo}>{TEXTO_FICHA.idArbol}</Text>
      {/* El tamaño sale del largo del ID. */}
      <Text style={[styles.idArbol, { fontSize: tamanoIdArbol(idArbol) }]}>{idArbol}</Text>
    </View>
  );
}

function Vacio({ icono, texto }: { icono: TrazosIcono; texto: string }) {
  return (
    <View style={styles.vacio}>
      <IconoFicha icono={icono} />
      <Text style={styles.textoVacio}>{texto}</Text>
    </View>
  );
}

function Foto({ foto }: { foto: FotoPdf }) {
  if (esFotoLista(foto)) return <Image style={styles.foto} src={foto.src} />;
  return <Vacio icono={ICONO_FICHA.camara} texto={TEXTO_FOTO_FALTANTE[foto.estado]} />;
}

function Mapa({ mapa }: { mapa: MapaPdf }) {
  if (!esMapaListo(mapa)) {
    return <Vacio icono={ICONO_FICHA.pin} texto={TEXTO_MAPA_FALTANTE[mapa.estado]} />;
  }
  return (
    <View>
      <Image style={styles.mapa} src={mapa.src} />
      {mapa.conSatelite && <LlamadaSatelite style={styles.llamada} />}
    </View>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{children}</Text>
    </View>
  );
}

function ConCodigo({ entidad }: { entidad: CodigoNombre | null }) {
  if (!entidad) return SIN_DATO;
  return (
    <>
      <Text style={styles.codigo}>{entidad.codigo}</Text> {entidad.nombre}
    </>
  );
}

function Gps({ gps }: { gps: GpsFicha | null }) {
  if (!gps) return <Text style={styles.tenue}>{TEXTO_FICHA.sinPunto}</Text>;
  return (
    <>
      <Text style={styles.mono}>{gps.coordenadas}</Text>
      {gps.precision && <Text style={styles.apagado}> {gps.precision}</Text>}
    </>
  );
}

/** Junto a la foto: qué árbol es, cuándo y quién lo registró. */
function Identidad({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.texto}>
      <Especie especie={ficha.especie} />
      <IdArbol idArbol={ficha.idArbol} />
      <View style={styles.registro}>
        <Dato rotulo={TEXTO_FICHA.registrado}>{ficha.registrado}</Dato>
        <Dato rotulo={TEXTO_FICHA.tecnico}>{ficha.tecnico}</Dato>
      </View>
    </View>
  );
}

/** Junto al mapa: dónde está. */
function Ubicacion({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.texto}>
      <Dato rotulo={TEXTO_FICHA.parcela}>
        <ConCodigo entidad={ficha.parcela} />
      </Dato>
      <Dato rotulo={TEXTO_FICHA.grupo}>
        <ConCodigo entidad={ficha.grupo} />
      </Dato>
      <Dato rotulo={TEXTO_FICHA.posicion}>{ficha.posicion}</Dato>
      <Dato rotulo={TEXTO_FICHA.gps}>
        <Gps gps={ficha.gps} />
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
        <Foto foto={ficha.foto} />
      </View>
      <View style={styles.fila}>
        <Ubicacion ficha={ficha} />
        <Mapa mapa={ficha.mapa} />
      </View>
    </View>
  );
}
