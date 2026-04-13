/**
 * ConfigureSpeciesScreen — species toggle list.
 * Allows enabling/disabling species for a plantation.
 * Species with existing trees are locked (cannot be disabled).
 * Reordering is done in a separate screen (ReorderSpeciesScreen).
 *
 * Covers requirements: PLAN-02, PLAN-04
 */
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import ConfirmModal from '../components/ConfirmModal';
import { useSpeciesConfig } from '../hooks/useSpeciesConfig';

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onPress }: { checked: boolean; indeterminate?: boolean; onPress: () => void }) {
  const iconName = indeterminate ? 'remove' : checked ? 'checkmark' : undefined;
  const isActive = checked || indeterminate;
  return (
    <Pressable
      style={[styles.checkbox, isActive && styles.checkboxActive]}
      onPress={onPress}
      hitSlop={6}
    >
      {iconName && <Ionicons name={iconName} size={14} color={colors.white} />}
    </Pressable>
  );
}

type Props = {
  plantacionIdProp?: string;
  onClose?: () => void;
  pendingSync?: boolean;
};

export default function ConfigureSpeciesScreen({ plantacionIdProp, onClose, pendingSync }: Props = {}) {
  const params = useLocalSearchParams<{ plantacionId: string }>();
  const plantacionId = plantacionIdProp ?? params.plantacionId;
  const router = useRouter();

  const {
    items,
    loading,
    saving,
    enabledCount,
    allEnabled,
    someEnabled,
    confirmProps,
    handleToggle,
    handleSelectAll,
    handleSave,
  } = useSpeciesConfig(plantacionId, pendingSync);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando especies...</Text>
      </View>
    );
  }

  return (
    <ScreenContainer withTexture>
      <FlatList
        data={items}
        keyExtractor={(item) => item.especieId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            <Text style={styles.listHeader}>
              {enabledCount} especie{enabledCount !== 1 ? 's' : ''} seleccionada{enabledCount !== 1 ? 's' : ''}
            </Text>
            <Pressable style={styles.selectAllRow} onPress={handleSelectAll}>
              <Checkbox
                checked={allEnabled}
                indeterminate={someEnabled}
                onPress={handleSelectAll}
              />
              <Text style={styles.selectAllText}>Seleccionar todos</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
            <Pressable
              style={[styles.row, item.enabled && styles.rowEnabled]}
              onPress={() => handleToggle(item.especieId, !item.enabled)}
            >
              <Checkbox
                checked={item.enabled}
                onPress={() => handleToggle(item.especieId, !item.enabled)}
              />
              <Text style={[styles.rowCode, styles.rowCodeBold]}>{item.codigo}</Text>
              <Text style={[styles.rowName, !item.enabled && styles.rowNameDisabled]} numberOfLines={1}>
                {item.nombre}
              </Text>
              {item.hasExistingTrees && (
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              )}
            </Pressable>
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
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xxl },
  listHeaderContainer: { marginBottom: spacing.xxl, gap: spacing.xl },
  listHeader: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: fonts.medium },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  selectAllText: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  checkbox: {
    width: 22, height: 22, borderRadius: borderRadius.sm, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xl,
  },
  rowEnabled: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBgLight },
  rowName: { flex: 1, fontSize: fontSize.base, color: colors.text },
  rowNameDisabled: { color: colors.textMuted },
  rowCode: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: fonts.monospace },
  rowCodeBold: { fontFamily: fonts.bold, color: colors.text },
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontFamily: fonts.semiBold },
});
