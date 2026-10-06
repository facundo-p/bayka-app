import { Image, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { CodigoNombre } from '../../queries/fichasQueries';
import { SIN_DATO } from '../../lib/formato';
import { ESTADO_FOTO, esFotoLista, type FotoPdf } from '../estadoFoto';
import { AtribucionSatelite } from '../mapa/AtribucionSatelite';
import { ESTADO_MAPA, esMapaListo, type MapaPdf } from '../mapa/estadoMapa';
import type { EspecieFicha, GpsFicha, ModeloFicha } from './datosFicha';
import { fichaStyles as styles } from './Ficha.styles';
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
    <View style={styles.especie}>
      <View style={styles.filaEspecie}>
        {/* El color sale del dato, no del tema: única propiedad de estilo en el componente. */}
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

function Identificador({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.identificador}>
      <Text style={styles.idArbol}>{ficha.idArbol}</Text>
      {ficha.idGlobal ? (
        <Text style={styles.idGlobal}>
          {TEXTO_FICHA.idGlobal} <Text style={styles.idGlobalNumero}>{ficha.idGlobal}</Text>
        </Text>
      ) : (
        <View style={styles.marca}>
          <Text style={styles.marcaTexto}>{TEXTO_FICHA.idGlobalSinGenerar}</Text>
        </View>
      )}
    </View>
  );
}

function Foto({ foto }: { foto: FotoPdf }) {
  if (esFotoLista(foto)) return <Image style={styles.foto} src={foto.src} />;
  return (
    <View style={styles.fotoVacia}>
      <Text style={styles.textoVacio}>{TEXTO_FOTO_FALTANTE[foto.estado]}</Text>
    </View>
  );
}

function Mapa({ mapa }: { mapa: MapaPdf }) {
  if (esMapaListo(mapa)) {
    return (
      <View>
        <Image style={styles.mapa} src={mapa.src} />
        {mapa.conSatelite && <AtribucionSatelite style={styles.atribucion} />}
      </View>
    );
  }
  return (
    <View style={styles.mapaVacio}>
      <Text style={styles.textoVacio}>{TEXTO_MAPA_FALTANTE[mapa.estado]}</Text>
    </View>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View style={styles.filaDato}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
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

function Datos({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.datos}>
      <Dato etiqueta={TEXTO_FICHA.parcela}>
        <ConCodigo entidad={ficha.parcela} />
      </Dato>
      <Dato etiqueta={TEXTO_FICHA.grupo}>
        <ConCodigo entidad={ficha.grupo} />
      </Dato>
      <Dato etiqueta={TEXTO_FICHA.posicion}>{ficha.posicion}</Dato>
      <Dato etiqueta={TEXTO_FICHA.registrado}>{ficha.registrado}</Dato>
      <Dato etiqueta={TEXTO_FICHA.tecnico}>{ficha.tecnico}</Dato>
      <Dato etiqueta={TEXTO_FICHA.gps}>
        <Gps gps={ficha.gps} />
      </Dato>
    </View>
  );
}

/** Ficha compacta de un árbol; nunca se parte entre dos hojas. */
export function Ficha({ ficha }: { ficha: ModeloFicha }) {
  return (
    <View style={styles.ficha} wrap={false}>
      <View style={styles.superior}>
        <Especie especie={ficha.especie} />
        <Identificador ficha={ficha} />
      </View>
      <View style={styles.cuerpo}>
        <Foto foto={ficha.foto} />
        <Datos ficha={ficha} />
        <Mapa mapa={ficha.mapa} />
      </View>
    </View>
  );
}
