/**
 * AdminBottomSheet — slide-up modal with plantation actions.
 *
 * Opens when any user taps the gear icon on a PlantationCard.
 * Shows sync options for ALL users, plus admin-only management actions.
 */
import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fonts, borderRadius } from '../theme';
import type { Plantation } from './PlantationConfigCard';
import type { ExpandedMeta } from '../hooks/usePlantationAdmin';

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminBottomSheetProps = {
  visible: boolean;
  plantation: Plantation | null;
  meta: ExpandedMeta;
  isAdmin: boolean;
  isOnline: boolean;
  onDismiss: () => void;
  onSync: () => void;
  onConfigSpecies: () => void;
  onAssignTech: () => void;
  onFinalize: () => void;
  onGenerateIds: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onDiscardEdit: () => void;
};

// ─── ActionItem ─────────────────────────────────────────────────────────────

function ActionItem({
  icon,
  label,
  onPress,
  color,
  disabled = false,
  helperText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  helperText?: string;
}) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [
          styles.actionItem,
          disabled && styles.actionItemDisabled,
          pressed && !disabled && { opacity: 0.7 },
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Ionicons
          name={icon}
          size={18}
          color={disabled ? colors.textMuted : (color ?? colors.textSecondary)}
        />
        <Text
          style={[
            styles.actionItemText,
            { color: disabled ? colors.textMuted : (color ?? colors.textSecondary) },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      {helperText && disabled && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
}

// ─── AdminBottomSheet ────────────────────────────────────────────────────────

export default function AdminBottomSheet({
  visible,
  plantation,
  meta,
  isAdmin,
  isOnline,
  onDismiss,
  onSync,
  onConfigSpecies,
  onAssignTech,
  onFinalize,
  onGenerateIds,
  onExportCsv,
  onExportExcel,
  onDiscardEdit,
}: AdminBottomSheetProps) {
  const insets = useSafeAreaInsets();

  if (!plantation) return null;

  const hasPendingIssues = !!(plantation.pendingSync || plantation.pendingEdit);
  const hasUnresolvedNN = (meta.unresolvedNNCount ?? 0) > 0;

  const finalizeDisabled = !meta.canFinalize || hasPendingIssues || hasUnresolvedNN;
  const finalizeColor =
    meta.canFinalize && !hasPendingIssues && !hasUnresolvedNN ? colors.danger : colors.textMuted;
  const finalizeHelperText = hasPendingIssues
    ? 'Sincroniza los cambios antes de finalizar'
    : hasUnresolvedNN
      ? `${meta.unresolvedNNCount} arbol${meta.unresolvedNNCount !== 1 ? 'es' : ''} N/N sin resolver en ${meta.unresolvedNNSubgroups} subgrupo${meta.unresolvedNNSubgroups !== 1 ? 's' : ''}`
      : !meta.canFinalize
        ? 'Para finalizar, todos los subgrupos deben estar sincronizados'
        : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.outerWrapper}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onDismiss} />

        {/* Sheet */}
        <View style={[styles.sheet, { paddingBottom: spacing['5xl'] + insets.bottom }]}>
          {/* Drag handle */}
          <View style={[styles.handleContainer, { paddingTop: spacing['4xl'] }]}>
            <View style={styles.handle} />
          </View>

          {/* Close button */}
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            onPress={onDismiss}
            accessibilityLabel="Cerrar menu de acciones"
          >
            <Ionicons name="close-outline" size={22} color={colors.textMuted} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>{plantation.lugar}</Text>
            <Text style={styles.headerSubtitle}>{plantation.periodo}</Text>
          </View>

          {/* Pending sync/edit banner */}
          {hasPendingIssues && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.secondary} />
              <Text style={styles.pendingBadgeText}>
                {plantation.pendingSync ? 'Pendiente de sync' : 'Cambios sin sincronizar'}
              </Text>
              {plantation.pendingEdit && (
                <Pressable
                  onPress={onDiscardEdit}
                  hitSlop={8}
                  style={({ pressed }) => [styles.discardBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="arrow-undo-outline" size={14} color={colors.danger} />
                  <Text style={styles.discardBtnText}>Descartar</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Action list */}
          <View style={styles.actionList}>
            {/* Sync — available for ALL users (bidirectional) */}
            <ActionItem
              icon="sync-outline"
              label="Sincronizar"
              color={colors.primary}
              onPress={onSync}
              disabled={!isOnline}
              helperText={!isOnline ? 'Necesitas conexion a internet' : undefined}
            />

            {/* Admin-only actions */}
            {isAdmin && plantation.estado === 'activa' && (
              <>
                <View style={styles.divider} />
                <ActionItem
                  icon="leaf-outline"
                  label="Configurar especies"
                  color={colors.primary}
                  onPress={onConfigSpecies}
                />
                <ActionItem
                  icon="people-outline"
                  label="Asignar tecnicos"
                  color={colors.primary}
                  onPress={onAssignTech}
                />
                <ActionItem
                  icon="lock-closed-outline"
                  label="Finalizar plantacion"
                  color={finalizeColor}
                  disabled={finalizeDisabled}
                  onPress={onFinalize}
                  helperText={finalizeHelperText}
                />
              </>
            )}

            {isAdmin && plantation.estado === 'finalizada' && (
              <>
                <View style={styles.divider} />
                {!meta.idsGenerated && (
                  <ActionItem
                    icon="key-outline"
                    label="Generar IDs"
                    color={colors.primary}
                    onPress={onGenerateIds}
                  />
                )}
                {meta.idsGenerated && (
                  <>
                    <ActionItem
                      icon="document-text-outline"
                      label="Exportar CSV"
                      color={colors.primary}
                      onPress={onExportCsv}
                    />
                    <ActionItem
                      icon="grid-outline"
                      label="Exportar Excel"
                      color={colors.primary}
                      onPress={onExportExcel}
                    />
                  </>
                )}
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={12} color={colors.stateFinalizada} />
                  <Text style={styles.lockedText}>Bloqueada</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xxl,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderMuted,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing['4xl'],
    right: spacing.xxl,
    padding: spacing.xs,
  },
  header: {
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textHeading,
  },
  headerSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xxl,
  },
  pendingBadgeText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    flex: 1,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  discardBtnText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontFamily: fonts.regular,
  },
  actionList: {
    gap: spacing.xxl,
  },
  actionItem: {
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItemDisabled: {
    opacity: 0.4,
  },
  actionItemText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
  },
});
