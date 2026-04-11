/**
 * AssignTechniciansScreen — technician toggle assignment for a plantation.
 *
 * Loads all technicians in the organization from Supabase (profiles table is server-only).
 * Loads currently assigned technicians from local SQLite.
 * Allows toggling assignment and saving atomically.
 *
 * Covers requirements: PLAN-03
 */
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import ConfirmModal from '../components/ConfirmModal';
import { useAssignTechnicians } from '../hooks/useAssignTechnicians';

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
    <ScreenContainer>
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

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.base, color: colors.textMuted },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, padding: spacing['4xl'], backgroundColor: colors.background },
  errorTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.text },
  errorText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing['4xl'], marginTop: spacing.md },
  retryButtonText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xxl },
  listHeader: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xxl, fontFamily: fonts.medium },
  emptyContainer: { alignItems: 'center', gap: spacing.xl, paddingTop: spacing['5xl'] },
  emptyText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xl },
  rowAssigned: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBgLight },
  rowInfo: { flex: 1, gap: spacing.xs },
  rowName: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  rowNameMuted: { color: colors.textMuted },
  rowRole: { fontSize: fontSize.sm, color: colors.textMuted },
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontFamily: fonts.semiBold },
});
