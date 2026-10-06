import { Document, Image, Text, View } from '@react-pdf/renderer';
import { AtribucionSatelite } from '../mapa/AtribucionSatelite';
import { esMapaListo } from '../mapa/estadoMapa';
import { Hoja } from '../plantilla/Hoja';
import { TEXTO_PLANTILLA, type EncabezadoPdf } from '../plantilla/textos';
import type { ItemLeyenda, ModeloInforme } from './datosInforme';
import { informeStyles as styles } from './Informe.styles';
import type { Caja, MapaInformePdf } from './mapaInforme';
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

/** La atribución va en la línea de la leyenda, a la derecha, solo si hay satélite. */
function PieMapa({ items, conSatelite }: { items: readonly ItemLeyenda[]; conSatelite: boolean }) {
  return (
    <View style={styles.pieMapa}>
      <Leyenda items={items} />
      {conSatelite && <AtribucionSatelite style={styles.atribucion} />}
    </View>
  );
}

type MapaListo = { src: string; caja: Caja; conSatelite: boolean };

function ImagenMapa({ mapa }: { mapa: MapaListo }) {
  const { ancho, alto } = mapa.caja;
  return <Image style={[styles.mapa, { width: ancho, height: alto }]} src={mapa.src} />;
}

type MapaProps = { modelo: ModeloInforme; mapa: MapaListo };

/** Hoja propia al final: título y nota arriba, como un capítulo aparte. */
function MapaEnHojaCompleta({ modelo, mapa }: MapaProps) {
  return (
    <View break wrap={false}>
      <Text style={styles.tituloMapa}>{TEXTO_INFORME.mapa}</Text>
      <Text style={styles.notaTitulo}>{modelo.mapa.nota}</Text>
      <ImagenMapa mapa={mapa} />
      <PieMapa items={modelo.mapa.leyenda} conSatelite={mapa.conSatelite} />
    </View>
  );
}

function MapaAlPie({ modelo, mapa }: MapaProps) {
  return (
    <View style={styles.bloqueMapa} wrap={false}>
      <EncabezadoBloque>{TEXTO_INFORME.mapa}</EncabezadoBloque>
      <ImagenMapa mapa={mapa} />
      <PieMapa items={modelo.mapa.leyenda} conSatelite={mapa.conSatelite} />
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
  if (modelo.mapa.vacio) return <SinMapa motivo={modelo.mapa.vacio} />;
  // Si el canvas falló, el aviso va en el flujo: no merece una hoja propia.
  if (!mapa || !esMapaListo(mapa.mapa)) return <SinMapa motivo={TEXTO_INFORME.mapaNoDisponible} />;
  const { src, conSatelite } = mapa.mapa;
  const listo = { src, conSatelite, caja: mapa.caja };
  if (esMapaEnHojaCompleta(plan)) return <MapaEnHojaCompleta modelo={modelo} mapa={listo} />;
  return <MapaAlPie modelo={modelo} mapa={listo} />;
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
