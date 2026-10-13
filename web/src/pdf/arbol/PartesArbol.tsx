/* Lo que la ficha, la tarjeta y la fila del listado pintan igual, cada una con sus estilos. */
import { Image, Text, View, type Styles } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { SIN_DATO } from '../../lib/formato';
import type { CodigoNombre } from '../../queries/fichasQueries';
import { ESTADO_FOTO, esFotoLista, type FotoPdf } from '../estadoFoto';
import type { GpsArbol, ModeloArbol, RotuloEspecie } from './datosArbol';
import { partesArbolStyles as propios } from './PartesArbol.styles';
import { TEXTO_ARBOL } from './textosArbol';

/** Los estilos que pide cada pieza, por nombre: los pone el documento. */
type Estilos<Nombre extends string> = Record<Nombre, Styles[string]>;

const TEXTO_FOTO_FALTANTE = {
  [ESTADO_FOTO.sinFoto]: TEXTO_ARBOL.sinFoto,
  [ESTADO_FOTO.noDisponible]: TEXTO_ARBOL.fotoNoDisponible,
} as const;

type RenglonEspecieProps = {
  especie: RotuloEspecie;
  styles: Estilos<'filaEspecie' | 'punto' | 'nombreEspecie'>;
};

/** El punto de color y el rótulo; N/N va en ámbar. */
export function RenglonEspecie({ especie, styles }: RenglonEspecieProps) {
  return (
    <View style={styles.filaEspecie}>
      {/* El color sale del dato, no del tema. */}
      <View style={[styles.punto, { backgroundColor: especie.color }]} />
      <Text style={[styles.nombreEspecie, especie.sinIdentificar ? propios.sinIdentificar : {}]}>
        {especie.titulo}
      </Text>
    </View>
  );
}

type ConCodigoProps = { entidad: CodigoNombre | null; styles: Estilos<'codigo'> };

/** Va dentro de un `Text`: el código en mono y el nombre a continuación. */
export function ConCodigo({ entidad, styles }: ConCodigoProps) {
  if (!entidad) return SIN_DATO;
  return (
    <>
      <Text style={styles.codigo}>{entidad.codigo}</Text> {entidad.nombre}
    </>
  );
}

type GpsProps = { gps: GpsArbol | null; styles: Estilos<'mono'>; sinPunto?: ReactNode };

/** Va dentro de un `Text`: coordenadas en mono y la precisión apagada. */
export function Gps({ gps, styles, sinPunto = SIN_DATO }: GpsProps) {
  if (!gps) return sinPunto;
  return (
    <>
      <Text style={styles.mono}>{gps.coordenadas}</Text>
      {gps.precision && <Text style={propios.apagado}> {gps.precision}</Text>}
    </>
  );
}

type EstilosDato = Estilos<'dato' | 'rotulo' | 'valor'>;

type DatoProps = { rotulo: string; styles: EstilosDato; children: ReactNode };

export function Dato({ rotulo, styles, children }: DatoProps) {
  return (
    <View style={styles.dato}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{children}</Text>
    </View>
  );
}

type DatosDeUbicacionProps = {
  modelo: Pick<ModeloArbol, 'parcela' | 'grupo' | 'posicion'>;
  styles: EstilosDato & Estilos<'codigo'>;
};

/** Parcela, grupo y posición, en ese orden. */
export function DatosDeUbicacion({ modelo, styles }: DatosDeUbicacionProps) {
  return (
    <>
      <Dato rotulo={TEXTO_ARBOL.parcela} styles={styles}>
        <ConCodigo entidad={modelo.parcela} styles={styles} />
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.grupo} styles={styles}>
        <ConCodigo entidad={modelo.grupo} styles={styles} />
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.posicion} styles={styles}>
        {modelo.posicion}
      </Dato>
    </>
  );
}

type EstilosVacio = Estilos<'vacio' | 'textoVacio'>;

type VacioProps = { texto: string; styles: EstilosVacio; icono?: ReactNode };

/** El recuadro de una foto o un mapa que falta, con el porqué. */
export function Vacio({ texto, styles, icono }: VacioProps) {
  return (
    <View style={styles.vacio}>
      {icono}
      <Text style={styles.textoVacio}>{texto}</Text>
    </View>
  );
}

type FotoProps = { foto: FotoPdf; styles: EstilosVacio & Estilos<'foto'>; icono?: ReactNode };

export function Foto({ foto, styles, icono }: FotoProps) {
  if (esFotoLista(foto)) return <Image style={styles.foto} src={foto.src} />;
  return <Vacio texto={TEXTO_FOTO_FALTANTE[foto.estado]} styles={styles} icono={icono} />;
}
