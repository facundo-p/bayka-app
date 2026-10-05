import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import {
  ESTILO_BOTONERA_ORIGINAL,
  ORDEN_BOTONERA,
  ORDEN_BOTONERA_LABELS,
  TAMANO_LETRA_BOTONERA,
  type CampoDeTamano,
  type EstiloBotonera,
} from '../constants/estiloBotonera';
import { BOTON_NN } from '../constants/especies';
import { esEstiloOriginal, especiesDeMuestra } from '../utils/estiloBotonera';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import CabeceraDeOpcion from './CabeceraDeOpcion';
import SegmentedControl from './SegmentedControl';
import StepperNumerico from './StepperNumerico';
import SpeciesButton from './SpeciesButton';
import { anchoDeCelda } from './SpeciesButtonGrid.styles';
import { treeConfigModalStyles as modalStyles } from './TreeConfigModal.styles';
import { tamanoBotoneraSectionStyles as styles, TAMANO_ICONO_RESTABLECER } from './TamanoBotoneraSection.styles';

const OPCIONES_DE_ORDEN = Object.values(ORDEN_BOTONERA).map((orden) => ({
  valor: orden,
  etiqueta: ORDEN_BOTONERA_LABELS[orden],
}));

const RANGO = { min: TAMANO_LETRA_BOTONERA.min, max: TAMANO_LETRA_BOTONERA.max };

const sinAccion = () => {};

interface Props {
  estilo: EstiloBotonera;
  especies: readonly PlantationSpeciesItem[];
  onChange: (estilo: EstiloBotonera) => void;
}

/** Sección de Opciones para elegir tamaño y orden del código y el nombre en la botonera. */
export default function TamanoBotoneraSection({ estilo, especies, onChange }: Props) {
  const cambiarTamano = (campo: CampoDeTamano) => (valor: number) => onChange({ ...estilo, [campo]: valor });

  return (
    <View style={[modalStyles.option, styles.seccion]}>
      <View style={styles.cabecera}>
        <CabeceraDeOpcion icono="text-outline" color={colors.plantationDark}
          titulo="Tamaño de la botonera" descripcion="Tamaño y orden del código y del nombre" />
      </View>
      <SegmentedControl opciones={OPCIONES_DE_ORDEN} valor={estilo.orden} onChange={(orden) => onChange({ ...estilo, orden })} />
      <StepperNumerico etiqueta="Código" descripcion="Letra del código de especie" valor={estilo.tamanoCodigo}
        {...RANGO} onChange={cambiarTamano('tamanoCodigo')} testID="tamano-codigo" />
      <StepperNumerico etiqueta="Nombre" descripcion="Letra del nombre de especie" valor={estilo.tamanoNombre}
        {...RANGO} onChange={cambiarTamano('tamanoNombre')} testID="tamano-nombre" />
      <VistaPrevia estilo={estilo} especies={especies} />
      <Restablecer deshabilitado={esEstiloOriginal(estilo)} onPress={() => onChange({ ...ESTILO_BOTONERA_ORIGINAL })} />
    </View>
  );
}

/** Las especies de nombre más corto y más largo, al ancho real de la grilla; con menos de dos, completa el N/N. */
function VistaPrevia({ estilo, especies }: Pick<Props, 'estilo' | 'especies'>) {
  const celda = { width: anchoDeCelda(useWindowDimensions().width) };
  const muestras = especiesDeMuestra(especies);
  return (
    <>
      <Text style={styles.vistaPreviaTitulo}>Vista previa</Text>
      {/* Es una muestra: tocarla no carga nada ni vibra. */}
      <View style={styles.vistaPrevia} pointerEvents="none" testID="vista-previa-botonera">
        {muestras.map((especie) => (
          <View key={especie.especieId} style={celda}>
            <SpeciesButton codigo={especie.codigo} nombre={especie.nombre} estilo={estilo} onPress={sinAccion} />
          </View>
        ))}
        {muestras.length < 2 && (
          <View style={celda}>
            <SpeciesButton {...BOTON_NN} isNN estilo={estilo} onPress={sinAccion} />
          </View>
        )}
      </View>
    </>
  );
}

function Restablecer({ deshabilitado, onPress }: { deshabilitado: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={styles.restablecer}
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      testID="restablecer-botonera"
    >
      <Ionicons name="refresh-outline" size={TAMANO_ICONO_RESTABLECER}
        color={deshabilitado ? colors.textMuted : colors.plantationDark} />
      <Text style={[styles.restablecerTexto, deshabilitado && styles.restablecerTextoDeshabilitado]}>
        Restablecer el diseño original
      </Text>
    </Pressable>
  );
}
