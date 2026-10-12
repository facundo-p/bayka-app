import { Image, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { ESTADO_FOTO, esFotoLista, type FotoPdf } from '../estadoFoto';
import { MEDIDA_REPORTE } from '../plantilla/tokens';
import type { ModeloTarjeta } from './datosReporte';
import { ConCodigo, Especie, Gps } from './PartesArbol';
import { enTramos } from './planReporte';
import { reporteStyles as styles } from './Reporte.styles';
import { TEXTO_REPORTE } from './textosReporte';

const TEXTO_FOTO_FALTANTE = {
  [ESTADO_FOTO.sinFoto]: TEXTO_REPORTE.sinFoto,
  [ESTADO_FOTO.noDisponible]: TEXTO_REPORTE.fotoNoDisponible,
} as const;

function Foto({ foto }: { foto: FotoPdf }) {
  if (esFotoLista(foto)) return <Image style={styles.foto} src={foto.src} />;
  return (
    <View style={styles.fotoVacia}>
      <Text style={styles.textoVacio}>{TEXTO_FOTO_FALTANTE[foto.estado]}</Text>
    </View>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.valor}>{children}</Text>
    </View>
  );
}

function Datos({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <View style={styles.datos}>
      <Text style={styles.idArbol}>{tarjeta.idArbol}</Text>
      <Especie
        especie={tarjeta.especie}
        style={styles.especie}
        estiloTexto={styles.nombreEspecie}
      />
      <Dato etiqueta={TEXTO_REPORTE.parcela}>
        <ConCodigo entidad={tarjeta.parcela} />
      </Dato>
      <Dato etiqueta={TEXTO_REPORTE.grupo}>
        <ConCodigo entidad={tarjeta.grupo} />
      </Dato>
      <Dato etiqueta={TEXTO_REPORTE.posicion}>{tarjeta.posicion}</Dato>
      <Dato etiqueta={TEXTO_REPORTE.registrado}>{tarjeta.registrado}</Dato>
      <Dato etiqueta={TEXTO_REPORTE.gps}>
        <Gps gps={tarjeta.gps} />
      </Dato>
    </View>
  );
}

/** Alto fijo y texto de un renglón: nunca se parte ni empuja a la siguiente. */
export function Tarjeta({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <View style={styles.tarjeta} wrap={false}>
      <Foto foto={tarjeta.foto} />
      <Datos tarjeta={tarjeta} />
    </View>
  );
}

/** Las tarjetas de una hoja, en filas de a dos. */
export function GrillaTarjetas({ tarjetas }: { tarjetas: readonly ModeloTarjeta[] }) {
  return (
    <View style={styles.grilla}>
      {enTramos(tarjetas, MEDIDA_REPORTE.columnasTarjetas).map((fila, indiceFila) => (
        <View key={indiceFila} style={styles.filaTarjetas}>
          {fila.map((tarjeta, indice) => (
            <Tarjeta key={indice} tarjeta={tarjeta} />
          ))}
        </View>
      ))}
    </View>
  );
}
