/**
 * Desplegable con buscador para elegir la especie de un árbol (#679). Solo las
 * especies de la plantación; la actual va marcada. Tocar una la elige.
 */
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import { selectorDeEspecieStyles as styles } from './SelectorDeEspecie.styles';

export const PLACEHOLDER_BUSCAR_ESPECIE = 'Buscar por nombre común o científico';
export const TEXTO_SIN_COINCIDENCIAS = 'Ninguna especie coincide.';
export const ETIQUETA_ESPECIE_ACTUAL = 'actual';

type Especie = Pick<PlantationSpeciesItem, 'especieId' | 'nombre' | 'nombreCientifico'>;

interface Props {
  especies: Especie[];
  especieActualId: string | null;
  busqueda: string;
  onBuscar: (texto: string) => void;
  onElegir: (especieId: string) => void;
  onCancelar: () => void;
}

function MarcaActual() {
  return (
    <View style={styles.actual}>
      <Ionicons name="checkmark" size={iconSizes.action} color={colors.plantationDark} />
      <Text style={styles.actualTexto}>{ETIQUETA_ESPECIE_ACTUAL}</Text>
    </View>
  );
}

function Opcion({ especie, actual, onElegir }: { especie: Especie; actual: boolean; onElegir: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.opcion, actual && styles.opcionActual, pressed && styles.opcionPresionada]}
      onPress={onElegir}
      accessibilityRole="button"
      accessibilityState={{ selected: actual }}
    >
      <View style={styles.opcionTexto}>
        <Text style={styles.nombre}>{especie.nombre}</Text>
        {especie.nombreCientifico ? <Text style={styles.cientifico}>{especie.nombreCientifico}</Text> : null}
      </View>
      {actual && <MarcaActual />}
    </Pressable>
  );
}

export default function SelectorDeEspecie({ especies, especieActualId, busqueda, onBuscar, onElegir, onCancelar }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.buscador}>
        <Ionicons name="search" size={iconSizes.action} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={busqueda}
          onChangeText={onBuscar}
          placeholder={PLACEHOLDER_BUSCAR_ESPECIE}
          placeholderTextColor={colors.textPlaceholder}
          autoFocus
          autoCorrect={false}
        />
      </View>
      <ScrollView style={styles.lista} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {especies.length === 0 ? (
          <Text style={styles.vacio}>{TEXTO_SIN_COINCIDENCIAS}</Text>
        ) : (
          especies.map((especie) => (
            <Opcion
              key={especie.especieId}
              especie={especie}
              actual={especie.especieId === especieActualId}
              onElegir={() => onElegir(especie.especieId)}
            />
          ))
        )}
      </ScrollView>
      <Pressable style={styles.cancelar} onPress={onCancelar} accessibilityRole="button">
        <Text style={styles.cancelarTexto}>Cancelar</Text>
      </Pressable>
    </View>
  );
}
