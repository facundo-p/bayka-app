import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import {
  ESTILO_BOTONERA_ORIGINAL,
  ORDEN_BOTONERA,
  TAMANO_LETRA_BOTONERA,
  type EstiloBotonera,
  type TamanoDeBotonera,
} from '../constants/estiloBotonera';
import { esEstiloOriginal, especiesDeMuestra, limitarTamano } from '../utils/estiloBotonera';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import SegmentedControl from './SegmentedControl';
import StepperNumerico from './StepperNumerico';
import SpeciesButton, { BOTON_NN } from './SpeciesButton';
import { anchoDeCelda } from './SpeciesButtonGrid.styles';
import { treeConfigModalStyles as modalStyles, TAMANO_ICONO_OPCION } from './TreeConfigModal.styles';
import { tamanoBotoneraSectionStyles as styles, TAMANO_ICONO_RESTABLECER } from './TamanoBotoneraSection.styles';

const OPCIONES_DE_ORDEN = [
  { valor: ORDEN_BOTONERA.codigoArriba, etiqueta: 'Código arriba' },
  { valor: ORDEN_BOTONERA.nombreArriba, etiqueta: 'Nombre arriba' },
] as const;

const sinAccion = () => {};

interface Props {
  estilo: EstiloBotonera;
  especies: readonly PlantationSpeciesItem[];
  onChange: (estilo: EstiloBotonera) => void;
}

/** Sección de Opciones para elegir tamaño y orden del código y el nombre en la botonera (#744). */
export default function TamanoBotoneraSection({ estilo, especies, onChange }: Props) {
  const cambiarTamano = (campo: TamanoDeBotonera) => (valor: number) =>
    onChange({ ...estilo, [campo]: limitarTamano(valor) });
  const rango = { min: TAMANO_LETRA_BOTONERA.min, max: TAMANO_LETRA_BOTONERA.max };

  return (
    <View style={[modalStyles.option, styles.seccion]}>
      <Cabecera />
      <SegmentedControl opciones={OPCIONES_DE_ORDEN} valor={estilo.orden} onChange={(orden) => onChange({ ...estilo, orden })} />
      <StepperNumerico etiqueta="Código" descripcion="Letra del código de especie" valor={estilo.tamanoCodigo}
        {...rango} onChange={cambiarTamano('tamanoCodigo')} testID="tamano-codigo" />
      <StepperNumerico etiqueta="Nombre" descripcion="Letra del nombre de especie" valor={estilo.tamanoNombre}
        {...rango} onChange={cambiarTamano('tamanoNombre')} testID="tamano-nombre" />
      <VistaPrevia estilo={estilo} especies={especies} />
      <Restablecer deshabilitado={esEstiloOriginal(estilo)} onPress={() => onChange({ ...ESTILO_BOTONERA_ORIGINAL })} />
    </View>
  );
}

function Cabecera() {
  return (
    <View style={styles.cabecera}>
      <Ionicons name="text-outline" size={TAMANO_ICONO_OPCION} color={colors.plantationDark} />
      <View style={modalStyles.optionInfo}>
        <Text style={modalStyles.optionLabel}>Tamaño de la botonera</Text>
        <Text style={modalStyles.optionDesc}>Tamaño y orden del código y del nombre</Text>
      </View>
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
      <View style={styles.vistaPrevia} testID="vista-previa-botonera">
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
