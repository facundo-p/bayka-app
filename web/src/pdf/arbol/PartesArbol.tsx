/* Lo que la ficha, la tarjeta y la fila del listado pintan igual, cada una con sus estilos. */
import { Image, Text, View, type Styles } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { SIN_DATO } from '../../lib/formato';
import type { CodigoNombre } from '../../queries/fichasQueries';
import { ESTADO_FOTO, esFotoLista, type FotoPdf } from '../estadoFoto';
import { Renglones, Texto, type TextoPdf } from '../plantilla/Renglones';
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
  especie: Omit<RotuloEspecie, 'titulo'> & { titulo: TextoPdf };
  styles: Estilos<'filaEspecie' | 'punto' | 'nombreEspecie'>;
};

/** El punto de color y el rótulo; N/N va en ámbar. */
export function RenglonEspecie({ especie, styles }: RenglonEspecieProps) {
  const estilo = [styles.nombreEspecie, especie.sinIdentificar ? propios.sinIdentificar : {}];
  return (
    <View style={styles.filaEspecie}>
      {/* El color sale del dato, no del tema. */}
      <View style={[styles.punto, { backgroundColor: especie.color }]} />
      <Texto texto={especie.titulo} style={estilo} />
    </View>
  );
}

type ConCodigoProps = CodigoNombre & { styles: Estilos<'codigo'> };

/** Va dentro de un `Text`: el código en mono y el nombre, o su primer renglón, a continuación. */
function ConCodigo({ codigo, nombre, styles }: ConCodigoProps) {
  return (
    <>
      <Text style={styles.codigo}>{codigo}</Text>
      {TEXTO_ARBOL.separadorCodigo}
      {nombre}
    </>
  );
}

/** Una parcela o un grupo, con el nombre entero o ya partido en renglones. */
type ConNombre = Omit<CodigoNombre, 'nombre'> & { nombre: TextoPdf };

type NombreConCodigoProps = {
  entidad: ConNombre | null;
  style: Styles[string];
  styles: Estilos<'codigo'>;
};

/** En su caja, el código en mono y el nombre; partido, el código va en el primer renglón. */
export function NombreConCodigo({ entidad, style, styles }: NombreConCodigoProps) {
  if (!entidad) return <Text style={style}>{SIN_DATO}</Text>;
  const { codigo, nombre } = entidad;
  const conCodigo = (texto: string) => <ConCodigo codigo={codigo} nombre={texto} styles={styles} />;
  if (typeof nombre === 'string') return <Text style={style}>{conCodigo(nombre)}</Text>;
  return <Renglones renglones={nombre} style={style} primero={conCodigo} />;
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

type RotuladoProps = { rotulo: string; styles: EstilosDato; children: ReactNode };

/** El rótulo y, al lado, el valor ya armado. */
function Rotulado({ rotulo, styles, children }: RotuladoProps) {
  return (
    <View style={styles.dato}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      {children}
    </View>
  );
}

export function Dato({ rotulo, styles, children }: RotuladoProps) {
  return (
    <Rotulado rotulo={rotulo} styles={styles}>
      <Text style={styles.valor}>{children}</Text>
    </Rotulado>
  );
}

type EstilosUbicacion = EstilosDato & Estilos<'codigo'>;

type DatoConCodigoProps = { rotulo: string; entidad: ConNombre | null; styles: EstilosUbicacion };

function DatoConCodigo({ rotulo, entidad, styles }: DatoConCodigoProps) {
  return (
    <Rotulado rotulo={rotulo} styles={styles}>
      <NombreConCodigo entidad={entidad} style={styles.valor} styles={styles} />
    </Rotulado>
  );
}

type DatosDeUbicacionProps = {
  modelo: Pick<ModeloArbol, 'posicion'> & { parcela: ConNombre | null; grupo: ConNombre };
  styles: EstilosUbicacion;
};

/** Parcela, grupo y posición, en ese orden. */
export function DatosDeUbicacion({ modelo, styles }: DatosDeUbicacionProps) {
  return (
    <>
      <DatoConCodigo rotulo={TEXTO_ARBOL.parcela} entidad={modelo.parcela} styles={styles} />
      <DatoConCodigo rotulo={TEXTO_ARBOL.grupo} entidad={modelo.grupo} styles={styles} />
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
