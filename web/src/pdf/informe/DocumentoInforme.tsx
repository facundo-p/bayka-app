import { Image, Text, View } from '@react-pdf/renderer';
import { LlamadaSatelite, NOTA_SATELITE } from '../mapa/LlamadaSatelite';
import { esMapaListo, esMapaSatelital } from '../mapa/estadoMapa';
import { DocumentoPdf } from '../plantilla/DocumentoPdf';
import { Hoja, type NotaAlPie } from '../plantilla/Hoja';
import type { EmisionPdf } from '../plantilla/textos';
import { Renglones } from '../plantilla/Renglones';
import { CAJA_MAPA_INFORME } from '../plantilla/tokens';
import { informeStyles as styles } from './Informe.styles';
import type { MapaInformePdf } from './mapaInforme';
import { esMapaEnHojaCompleta, type PlanInforme } from './planificarInforme';
import type {
  InformeEnRenglones,
  ItemLeyendaEnRenglones,
  MapaEnRenglones,
} from './renglonesInforme';
import { BloqueEspecies, EncabezadoBloque, FilaIndicadores, Titulo } from './SeccionesInforme';
import { TEXTO_INFORME } from './textosInforme';

/** El mapa elegido: lo que lo acompaña, dónde va y su imagen. */
export type MapaDelDocumento = {
  contenido: MapaEnRenglones;
  plan: PlanInforme;
  /** null si no hay puntos que dibujar. */
  imagen: MapaInformePdf | null;
};

export type DocumentoInformeProps = EmisionPdf & {
  modelo: InformeEnRenglones;
  /** null si no se eligió el mapa. */
  mapa: MapaDelDocumento | null;
};

/** Cada fila de la leyenda mide lo que su código más partido. */
export function Leyenda({ items }: { items: readonly ItemLeyendaEnRenglones[] }) {
  return (
    <View style={styles.leyenda}>
      {items.map((item, indice) => (
        <View key={indice} style={styles.itemLeyenda}>
          <View style={[styles.puntoLeyenda, { backgroundColor: item.color }]} />
          <Renglones renglones={item.texto} style={styles.codigoLeyenda} />
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

type MapaProps = { contenido: MapaEnRenglones; mapa: MapaListo };

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
    <View style={styles.bloqueMapa} wrap={false}>
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
    <View style={styles.bloqueMapa} wrap={false}>
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
    <DocumentoPdf documento={TEXTO_INFORME.documento} encabezado={encabezado}>
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
    </DocumentoPdf>
  );
}
