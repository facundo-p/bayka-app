import { Document, Image, Text, View } from '@react-pdf/renderer';
import { LlamadaSatelite, NOTA_SATELITE } from '../mapa/LlamadaSatelite';
import { esMapaListo, esMapaSatelital } from '../mapa/estadoMapa';
import { Hoja, type NotaAlPie } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EncabezadoPdf } from '../plantilla/textos';
import { CAJA_MAPA_INFORME } from '../plantilla/tokens';
import type { ItemLeyenda, MapaDelInforme, ModeloInforme } from './datosInforme';
import { informeStyles as styles } from './Informe.styles';
import type { MapaInformePdf } from './mapaInforme';
import { esMapaEnHojaCompleta, type PlanInforme } from './planificarInforme';
import { BloqueEspecies, EncabezadoBloque, FilaIndicadores, Titulo } from './SeccionesInforme';
import { TEXTO_INFORME } from './textosInforme';

/** El mapa elegido: lo que lo acompaña, dónde va y su imagen. */
export type MapaDelDocumento = {
  contenido: MapaDelInforme;
  plan: PlanInforme;
  /** null si no hay puntos que dibujar. */
  imagen: MapaInformePdf | null;
};

export type DocumentoInformeProps = {
  encabezado: EncabezadoPdf;
  emitido: string;
  modelo: ModeloInforme;
  /** null si no se eligió el mapa. */
  mapa: MapaDelDocumento | null;
};

function Leyenda({ items }: { items: readonly ItemLeyenda[] }) {
  return (
    <View style={styles.leyenda}>
      {items.map((item) => (
        <View key={item.texto} style={styles.itemLeyenda}>
          <View style={[styles.punto, { backgroundColor: item.color }]} />
          <Text>{item.texto}</Text>
        </View>
      ))}
    </View>
  );
}

type MapaListo = { src: string; conSatelite: boolean };

/** Con satélite, la llamada a la nota al pie va bajo la esquina derecha de la imagen. */
function ImagenMapa({ mapa }: { mapa: MapaListo }) {
  const { ancho, alto } = CAJA_MAPA_INFORME;
  return (
    <View style={[styles.mapa, { width: ancho, height: alto }]}>
      <Image style={styles.imagenMapa} src={mapa.src} />
      {mapa.conSatelite && <LlamadaSatelite style={styles.llamada} />}
    </View>
  );
}

type MapaProps = { contenido: MapaDelInforme; mapa: MapaListo };

/** Hoja propia al final: título y nota arriba, como un capítulo aparte. */
function MapaEnHojaCompleta({ contenido, mapa }: MapaProps) {
  return (
    <View break wrap={false}>
      <Text style={styles.tituloMapa}>{TEXTO_INFORME.mapa}</Text>
      <Text style={styles.notaTitulo}>{contenido.nota}</Text>
      <ImagenMapa mapa={mapa} />
      <Leyenda items={contenido.leyenda} />
    </View>
  );
}

function MapaAlPie({ contenido, mapa }: MapaProps) {
  return (
    <View wrap={false}>
      <EncabezadoBloque>{TEXTO_INFORME.mapa}</EncabezadoBloque>
      <ImagenMapa mapa={mapa} />
      <Leyenda items={contenido.leyenda} />
      <Text style={styles.notaMapa}>{contenido.nota}</Text>
    </View>
  );
}

/** Sin puntos, el bloque explica por qué no hay mapa. */
function SinMapa({ motivo }: { motivo: string }) {
  return (
    <View wrap={false}>
      <EncabezadoBloque>{TEXTO_INFORME.mapa}</EncabezadoBloque>
      <Text style={styles.mensaje}>{motivo}</Text>
    </View>
  );
}

function BloqueMapa({ contenido, plan, imagen }: MapaDelDocumento) {
  if (contenido.vacio) return <SinMapa motivo={contenido.vacio} />;
  // Si el canvas falló, el aviso va en el flujo: no merece una hoja propia.
  if (!imagen || !esMapaListo(imagen.mapa)) {
    return <SinMapa motivo={TEXTO_INFORME.mapaNoDisponible} />;
  }
  const listo = { src: imagen.mapa.src, conSatelite: imagen.mapa.conSatelite };
  if (esMapaEnHojaCompleta(plan)) return <MapaEnHojaCompleta contenido={contenido} mapa={listo} />;
  return <MapaAlPie contenido={contenido} mapa={listo} />;
}

/** El mapa es lo último del informe: con satélite, la nota va al pie de la última hoja. */
function notaDelMapa(mapa: MapaDelDocumento | null): NotaAlPie | undefined {
  if (!mapa?.imagen || !esMapaSatelital(mapa.imagen.mapa)) return undefined;
  return { texto: NOTA_SATELITE, enHoja: (hoja, total) => hoja === total };
}

/** Resumen y especies fluyen; el mapa, si se eligió, va al pie o en hoja propia según su plan. */
export function DocumentoInforme({ encabezado, emitido, modelo, mapa }: DocumentoInformeProps) {
  return (
    <Document
      title={`${TEXTO_INFORME.documento}${TEXTO_PLANTILLA.separador}${encabezado.titulo}`}
      creator={TEXTO_PLANTILLA.marca}
      producer={TEXTO_PLANTILLA.marca}
    >
      <Hoja
        encabezado={encabezado}
        documento={TEXTO_INFORME.documento}
        emitido={emitido}
        notaAlPie={notaDelMapa(mapa)}
      >
        <Titulo linea={modelo.linea} />
        <FilaIndicadores indicadores={modelo.indicadores} />
        <BloqueEspecies especies={modelo.especies} />
        {mapa && <BloqueMapa {...mapa} />}
      </Hoja>
    </Document>
  );
}
