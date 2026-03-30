import { Modal, View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncSubGroupResult } from '../services/SyncService';
import { getErrorMessage } from '../services/SyncService';

interface Props {
  state: SyncState;
  progress: SyncProgress | null;
  results: SyncSubGroupResult[];
  successCount: number;
  failureCount: number;
  pullSuccess: boolean | null;
  onDismiss: () => void;
}

export default function SyncProgressModal({
  state,
  progress,
  results,
  successCount,
  failureCount,
  pullSuccess,
  onDismiss,
}: Props) {
  if (state === 'idle') return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={state === 'done' ? onDismiss : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {state === 'syncing' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.title}>Sincronizando...</Text>
              <Text style={styles.progressText}>
                {progress ? `${progress.completed} de ${progress.total}` : 'Preparando...'}
              </Text>
              {progress?.currentName ? (
                <Text style={styles.currentName}>{progress.currentName}</Text>
              ) : null}
            </>
          )}

          {state === 'pulling' && (
            <>
              <ActivityIndicator size="large" color={colors.info} />
              <Text style={styles.title}>Actualizando datos...</Text>
              <Text style={styles.progressText}>Descargando novedades del servidor</Text>
            </>
          )}

          {state === 'done' && pullSuccess !== null && results.length === 0 && (
            <>
              <Ionicons
                name={pullSuccess ? 'checkmark-circle' : 'alert-circle'}
                size={48}
                color={pullSuccess ? colors.primary : colors.secondary}
              />
              <Text style={styles.title}>
                {pullSuccess ? 'Datos actualizados' : 'Error al actualizar'}
              </Text>
              <Text style={styles.progressText}>
                {pullSuccess
                  ? 'Se descargaron los ultimos datos del servidor.'
                  : 'No se pudo conectar con el servidor. Verifica tu conexión.'}
              </Text>
              <Pressable style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissText}>Cerrar</Text>
              </Pressable>
            </>
          )}

          {state === 'done' && (results.length > 0 || pullSuccess === null) && (
            <>
              <Ionicons
                name={failureCount > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={48}
                color={failureCount > 0 ? colors.secondary : colors.primary}
              />
              <Text style={styles.title}>
                {failureCount === 0 ? 'Sincronización completa' : 'Sincronización parcial'}
              </Text>
              {successCount > 0 && (
                <Text style={styles.successText}>
                  {successCount} subgrupo{successCount > 1 ? 's' : ''} sincronizado
                  {successCount > 1 ? 's' : ''}
                </Text>
              )}
              {failureCount > 0 && (
                <View style={styles.failureSection}>
                  <Text style={styles.failureTitle}>
                    {failureCount} subgrupo{failureCount > 1 ? 's' : ''} con error:
                  </Text>
                  {results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <View key={r.subgroupId} style={styles.failureItem}>
                        <Text style={styles.failureName}>{r.nombre}</Text>
                        <Text style={styles.failureMessage}>
                          {!r.success ? getErrorMessage(r.error) : ''}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
              <Pressable style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissText}>Cerrar</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  progressText: {
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  currentName: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  successText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  failureSection: {
    width: '100%',
    gap: spacing.sm,
  },
  failureTitle: {
    fontSize: fontSize.base,
    color: colors.secondary,
    fontFamily: fonts.semiBold,
  },
  failureItem: {
    backgroundColor: colors.dangerBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  failureName: {
    fontSize: fontSize.base,
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  failureMessage: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  dismissButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['4xl'],
    marginTop: spacing.sm,
  },
  dismissText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
  },
});
