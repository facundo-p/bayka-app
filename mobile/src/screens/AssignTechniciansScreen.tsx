/**
 * AssignTechniciansScreen — asignar técnicos a una plantación, también sin conexión
 * (#636). Una asignación sin subir dice "Se asignará al sincronizar"; quitar a alguien
 * ya asignado en el servidor requiere conexión.
 */
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import ConfirmModal from '../components/ConfirmModal';
import { useAssignTechnicians } from '../hooks/useAssignTechnicians';
import { assignTechniciansScreenStyles as styles } from './AssignTechniciansScreen.styles';
import {
  AYUDA_QUITAR_SIN_CONEXION,
  esAltaPendiente,
  SE_ASIGNARA_AL_SINCRONIZAR,
  SIN_TECNICOS,
} from '../utils/tecnicosDePlantacion';

type Props = {
  plantacionIdProp?: string;
  onClose?: () => void;
};

export default function AssignTechniciansScreen({ plantacionIdProp, onClose }: Props = {}) {
  const params = useLocalSearchParams<{ plantacionId: string }>();
  const plantacionId = plantacionIdProp ?? params.plantacionId;
  const router = useRouter();

  const {
    items,
    loading,
    saving,
    sinConexion,
    assignedCount,
    confirmProps,
    puedeQuitar,
    handleToggle,
    handleSave,
  } = useAssignTechnicians(plantacionId);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando técnicos...</Text>
      </View>
    );
  }

  return (
    <ScreenContainer withTexture>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            <Text style={styles.listHeader}>
              {assignedCount} técnico{assignedCount !== 1 ? 's' : ''} asignado{assignedCount !== 1 ? 's' : ''}
            </Text>
            {sinConexion && (
              <View style={styles.offlineNote}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
                <Text style={styles.offlineNoteText}>{AYUDA_QUITAR_SIN_CONEXION}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>{SIN_TECNICOS}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).duration(250)}>
            <View style={[styles.row, item.assigned && styles.rowAssigned]}>
              <Switch
                value={item.assigned}
                disabled={item.assigned && !puedeQuitar(item.id)}
                onValueChange={(val) => handleToggle(item.id, val)}
                trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
                thumbColor={item.assigned ? colors.primary : colors.disabled}
              />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, !item.assigned && styles.rowNameMuted]}>{item.nombre}</Text>
                <Text style={[styles.rowRole, esAltaPendiente(item) && styles.rowPendiente]}>
                  {esAltaPendiente(item) ? SE_ASIGNARA_AL_SINCRONIZAR : 'Técnico'}
                </Text>
              </View>
              {item.assigned && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </View>
          </Animated.View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
          onPress={() => handleSave(onClose, () => router.back())}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </>
          )}
        </Pressable>
      </View>

      <ConfirmModal {...confirmProps} />
    </ScreenContainer>
  );
}
