/**
 * AssignTechniciansScreen — technician toggle assignment for a plantation.
 *
 * Loads all technicians in the organization from Supabase (profiles table is server-only).
 * Loads currently assigned technicians from local SQLite.
 * Allows toggling assignment and saving atomically.
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
    networkError,
    assignedCount,
    confirmProps,
    loadData,
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

  if (networkError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="wifi-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorTitle}>Sin conexión</Text>
        <Text style={styles.errorText}>Se necesita conexión a internet para gestionar técnicos.</Text>
        <Pressable style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]} onPress={loadData}>
          <Ionicons name="refresh-outline" size={16} color={colors.white} />
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
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
          <Text style={styles.listHeader}>
            {assignedCount} tecnico{assignedCount !== 1 ? 's' : ''} asignado{assignedCount !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay técnicos en la organización</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).duration(250)}>
            <View style={[styles.row, item.assigned && styles.rowAssigned]}>
              <Switch
                value={item.assigned}
                onValueChange={(val) => handleToggle(item.id, val)}
                trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
                thumbColor={item.assigned ? colors.primary : colors.disabled}
              />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, !item.assigned && styles.rowNameMuted]}>{item.nombre}</Text>
                <Text style={styles.rowRole}>Tecnico</Text>
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
