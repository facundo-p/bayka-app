import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { treeActionBarStyles as styles } from './TreeActionBar.styles';
import type { useFotoDelSeleccionado } from '../hooks/useFotoDelSeleccionado';

const TAMANO_ICONO = 20;

type FotoDelSeleccionado = ReturnType<typeof useFotoDelSeleccionado>;

interface Props {
  deleting: boolean;
  finalizing: boolean;
  foto: FotoDelSeleccionado;
  /** ID visible del árbol seleccionado, para el label accesible de la foto. */
  seleccionadoSubId: string | null;
  onDeleteGroup: () => void;
  onOpenConfig: () => void;
  onFinalizar: () => void;
}

function DeleteGroupButton({ deleting, onPress }: { deleting: boolean; onPress: () => void }) {
  return (
    <Pressable testID="delete-group-button" style={[styles.deleteButton, deleting && styles.buttonDisabled]}
      onPress={onPress} disabled={deleting}>
      {deleting ? <ActivityIndicator size="small" color={colors.danger} />
        : <Ionicons name="trash-outline" size={TAMANO_ICONO} color={colors.danger} />}
    </Pressable>
  );
}

function FotoButton({ foto, subId }: { foto: FotoDelSeleccionado; subId: string | null }) {
  return (
    <Pressable
      testID="foto-seleccionado-button"
      style={[styles.iconButton, foto.deshabilitado && styles.buttonDisabled]}
      onPress={foto.fotografiar}
      disabled={foto.deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={subId != null ? `Foto de ${subId}` : 'Foto del árbol seleccionado'}
      accessibilityState={{ busy: foto.capturando }}
    >
      {foto.capturando ? <ActivityIndicator size="small" color={colors.plantation} />
        : <Ionicons name="camera-outline" size={TAMANO_ICONO} color={colors.textMuted} />}
    </Pressable>
  );
}

function FinalizarButton({ finalizing, onPress }: { finalizing: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID="finalize-button"
      style={[styles.finalizarButton, finalizing && styles.buttonDisabled]}
      onPress={onPress}
      disabled={finalizing}
    >
      {finalizing ? <ActivityIndicator size="small" color={colors.white} />
        : <Text style={styles.finalizarButtonText}>Finalizar</Text>}
    </Pressable>
  );
}

/** Barra inferior de la registración: eliminar grupo, configuración, foto del seleccionado y Finalizar. */
export default function TreeActionBar(props: Props) {
  return (
    <View style={styles.actionBar}>
      <DeleteGroupButton deleting={props.deleting} onPress={props.onDeleteGroup} />
      <Pressable style={styles.iconButton} onPress={props.onOpenConfig}>
        <Ionicons name="settings-outline" size={TAMANO_ICONO} color={colors.textMuted} />
      </Pressable>
      <FotoButton foto={props.foto} subId={props.seleccionadoSubId} />
      <View style={styles.spacer} />
      <FinalizarButton finalizing={props.finalizing} onPress={props.onFinalizar} />
    </View>
  );
}
