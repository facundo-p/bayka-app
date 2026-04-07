import { Modal, View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import type { DownloadResult } from '../services/SyncService';

interface Props {
  state: 'idle' | 'downloading' | 'done';
  progress: { total: number; completed: number; currentName: string } | null;
  results: DownloadResult[];
  onDismiss: () => void;
}

export default function DownloadProgressModal({ state, progress, results, onDismiss }: Props) {
  if (state === 'idle') return null;

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const allSuccess = failureCount === 0 && results.length > 0;
  const allFailed = successCount === 0 && results.length > 0;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={state === 'done' ? onDismiss : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {state === 'downloading' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.title}>Descargando...</Text>
              <Text style={styles.progressText}>
                {progress ? `${progress.completed} de ${progress.total}` : 'Preparando...'}
              </Text>
              {progress?.currentName ? (
                <Text style={styles.currentName}>{progress.currentName}</Text>
              ) : null}
            </>
          )}

          {state === 'done' && allSuccess && (
            <>
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
              <Text style={styles.title}>Descarga completa</Text>
              <Text style={styles.progressText}>
                {successCount} plantacion(es) descargada(s)
              </Text>
              <Pressable style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissText}>Cerrar resumen</Text>
              </Pressable>
            </>
          )}

          {state === 'done' && !allSuccess && !allFailed && (
            <>
              <Ionicons name="alert-circle" size={48} color={colors.secondary} />
              <Text style={styles.title}>Descarga parcial</Text>
              <Text style={styles.successText}>
                {successCount} descargada(s) correctamente
              </Text>
              <View style={styles.failureSection}>
                <Text style={styles.failureTitle}>{failureCount} con error:</Text>
                {results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <View key={r.id} style={styles.failureItem}>
                      <Text style={styles.failureName}>{r.nombre}</Text>
                      <Text style={styles.failureMessage}>
                        No se pudo descargar. Reintenta desde el catalogo.
                      </Text>
                    </View>
                  ))}
              </View>
              <Pressable style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissText}>Cerrar resumen</Text>
              </Pressable>
            </>
          )}

          {state === 'done' && allFailed && (
            <>
              <Ionicons name="alert-circle" size={48} color={colors.danger} />
              <Text style={styles.title}>Error en la descarga</Text>
              <Text style={styles.progressText}>
                No se pudo descargar ninguna plantacion. Verifica tu conexion.
              </Text>
              <Pressable style={styles.dismissButton} onPress={onDismiss}>
                <Text style={styles.dismissText}>Cerrar resumen</Text>
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
    backgroundColor: colors.overlay,
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
    fontSize: fontSize.base,
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
