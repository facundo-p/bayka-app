import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncSubGroupResult, PhotoSyncProgress } from '../services/SyncService';
import { getErrorMessage } from '../services/SyncService';
import BaseModal from './BaseModal';

interface Props {
  state: SyncState;
  progress: SyncProgress | null;
  results: SyncSubGroupResult[];
  successCount: number;
  failureCount: number;
  pullSuccess: boolean | null;
  photoProgress: PhotoSyncProgress | null;
  photoResult: { uploaded?: number; failed?: number; downloaded?: number } | null;
  globalProgress?: { plantationName: string; done: number; total: number } | null;
  onDismiss: () => void;
}

export default function SyncProgressModal({
  state,
  progress,
  results,
  successCount,
  failureCount,
  pullSuccess,
  photoProgress,
  photoResult,
  globalProgress,
  onDismiss,
}: Props) {
  if (state === 'idle') return null;

  return (
    <BaseModal
      visible
      onRequestClose={state === 'done' ? onDismiss : undefined}
    >
      {state === 'pulling' && (
        <>
          <ActivityIndicator size="large" color={colors.info} />
          <Text style={styles.title}>Actualizando datos...</Text>
          <Text style={styles.progressText}>Descargando novedades del servidor</Text>
          {globalProgress && (
            <Text style={styles.plantationProgress}>
              Sincronizando {globalProgress.plantationName}... ({globalProgress.done + 1} de {globalProgress.total} plantaciones)
            </Text>
          )}
        </>
      )}

      {state === 'pushing' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Subiendo subgrupos...</Text>
          <Text style={styles.progressText}>
            {progress ? `${progress.completed} de ${progress.total}` : 'Preparando...'}
          </Text>
          {progress?.currentName ? (
            <Text style={styles.currentName}>{progress.currentName}</Text>
          ) : null}
          {globalProgress && (
            <Text style={styles.plantationProgress}>
              Sincronizando {globalProgress.plantationName}... ({globalProgress.done + 1} de {globalProgress.total} plantaciones)
            </Text>
          )}
        </>
      )}

      {state === 'uploading-photos' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Subiendo fotos...</Text>
          <Text style={styles.progressText}>
            {photoProgress
              ? `${photoProgress.completed} de ${photoProgress.total} fotos`
              : 'Preparando...'}
          </Text>
        </>
      )}

      {state === 'downloading-photos' && (
        <>
          <ActivityIndicator size="large" color={colors.info} />
          <Text style={styles.title}>Descargando fotos...</Text>
          <Text style={styles.progressText}>
            {photoProgress
              ? `${photoProgress.completed} de ${photoProgress.total} fotos`
              : 'Preparando...'}
          </Text>
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
          {photoResult?.downloaded != null && photoResult.downloaded > 0 && (
            <Text style={styles.successText}>
              {photoResult.downloaded} foto{photoResult.downloaded > 1 ? 's' : ''} descargada{photoResult.downloaded > 1 ? 's' : ''} correctamente
            </Text>
          )}
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
            {failureCount === 0 ? 'Sincronizacion completa' : 'Sincronizacion parcial'}
          </Text>
          {successCount > 0 && (
            <Text style={styles.successText}>
              {successCount} subgrupo{successCount > 1 ? 's' : ''} sincronizado
              {successCount > 1 ? 's' : ''}
            </Text>
          )}
          {photoResult?.uploaded != null && photoResult.uploaded > 0 && (
            <Text style={styles.successText}>
              {photoResult.uploaded} foto{photoResult.uploaded > 1 ? 's' : ''} subida{photoResult.uploaded > 1 ? 's' : ''} correctamente
            </Text>
          )}
          {photoResult?.uploadFailed != null && photoResult.uploadFailed > 0 && (
            <Text style={styles.failureMessage}>
              {photoResult.uploadFailed} foto{photoResult.uploadFailed > 1 ? 's' : ''} no pudieron subirse.
            </Text>
          )}
          {photoResult?.downloadFailed != null && photoResult.downloadFailed > 0 && (
            <Text style={styles.failureMessage}>
              {photoResult.downloadFailed} foto{photoResult.downloadFailed > 1 ? 's' : ''} no pudieron descargarse.
            </Text>
          )}
          {photoResult?.downloaded != null && photoResult.downloaded > 0 && (
            <Text style={styles.successText}>
              {photoResult.downloaded} foto{photoResult.downloaded > 1 ? 's' : ''} descargada{photoResult.downloaded > 1 ? 's' : ''} correctamente
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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
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
  plantationProgress: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
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
