import { Document, Image, Text, View } from '@react-pdf/renderer';
import { esMapaListo } from '../mapa/estadoMapa';
import { Hoja } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EncabezadoPdf } from '../plantilla/textos';
import type { ItemLeyenda, ModeloInforme } from './datosInforme';
import { informeStyles as styles } from './Informe.styles';
import type { MapaInformePdf } from './mapaInforme';
import { esMapaEnHojaCompleta, type PlanInforme } from './planificarInforme';
import {
  BloqueEspecies,
  EncabezadoBloque,
  FilaIndicadores,
  TablaParcelas,
  Titulo,
} from './SeccionesInforme';
import { TEXTO_INFORME } from './textosInforme';

export type DocumentoInformeProps = {
  encabezado: EncabezadoPdf;
  emitido: string;
  modelo: ModeloInforme;
  plan: PlanInforme;
  /** null si no hay puntos que dibujar. */
  mapa: MapaInformePdf | null;
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

function ImagenMapa({ mapa }: { mapa: MapaInformePdf }) {
  if (!esMapaListo(mapa.mapa)) {
    return <Text style={styles.mensaje}>{TEXTO_INFORME.mapaNoDisponible}</Text>;
  }
  const { ancho, alto } = mapa.caja;
  return <Image style={[styles.mapa, { width: ancho, height: alto }]} src={mapa.mapa.src} />;
}

type MapaProps = { modelo: ModeloInforme; mapa: MapaInformePdf };

/** Hoja propia al final: título y nota arriba, como un capítulo aparte. */
function MapaEnHojaCompleta({ modelo, mapa }: MapaProps) {
  return (
    <View break wrap={false}>
      <Text style={styles.tituloMapa}>{TEXTO_INFORME.mapa}</Text>
      <Text style={styles.notaTitulo}>{modelo.mapa.nota}</Text>
      <ImagenMapa mapa={mapa} />
      <Leyenda items={modelo.mapa.leyenda} />
    </View>
  );
}

function MapaAlPie({ modelo, mapa }: MapaProps) {
  return (
    <View style={styles.bloqueMapa} wrap={false}>
      <EncabezadoBloque>{TEXTO_INFORME.mapa}</EncabezadoBloque>
      <ImagenMapa mapa={mapa} />
      <Leyenda items={modelo.mapa.leyenda} />
      <Text style={styles.notaMapa}>{modelo.mapa.nota}</Text>
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

function BloqueMapa({ modelo, plan, mapa }: Omit<DocumentoInformeProps, 'encabezado' | 'emitido'>) {
  if (!mapa || modelo.mapa.vacio) {
    return <SinMapa motivo={modelo.mapa.vacio ?? TEXTO_INFORME.mapaNoDisponible} />;
  }
  if (esMapaEnHojaCompleta(plan)) return <MapaEnHojaCompleta modelo={modelo} mapa={mapa} />;
  return <MapaAlPie modelo={modelo} mapa={mapa} />;
}

/** Resumen, especies y parcelas fluyen; el mapa va al pie o en hoja propia según `plan`. */
export function DocumentoInforme({ encabezado, emitido, ...contenido }: DocumentoInformeProps) {
  const { modelo } = contenido;
  return (
    <Document
      title={`${TEXTO_INFORME.documento}${TEXTO_PLANTILLA.separador}${encabezado.titulo}`}
      creator={TEXTO_PLANTILLA.marca}
      producer={TEXTO_PLANTILLA.marca}
    >
      <Hoja encabezado={encabezado} documento={TEXTO_INFORME.documento} emitido={emitido}>
        <Titulo linea={modelo.linea} />
        <FilaIndicadores indicadores={modelo.indicadores} />
        <BloqueEspecies especies={modelo.especies} />
        <TablaParcelas parcelas={modelo.parcelas} />
        <BloqueMapa {...contenido} />
      </Hoja>
    </Document>
  );
}
