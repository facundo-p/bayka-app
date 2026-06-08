import { Text, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncGroupResult, SyncParcelaResult, SyncPlantationResult, PhotoSyncProgress } from '../services/SyncService';
import BaseModal from './BaseModal';
import FailureList from './FailureList';
import { syncProgressModalStyles as styles } from './SyncProgressModal.styles';

interface Props {
  state: SyncState;
  progress: SyncProgress | null;
  results: SyncGroupResult[];
  parcelaResults: SyncParcelaResult[];
  plantationResults: SyncPlantationResult[];
  successCount: number;
  failureCount: number;
  parcelaFailureCount: number;
  plantationFailureCount: number;
  pullSuccess: boolean | null;
  authExpired: boolean;
  photoProgress: PhotoSyncProgress | null;
  photoResult: { uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number } | null;
  globalProgress?: { plantationName: string; done: number; total: number } | null;
  onDismiss: () => void;
}

export default function SyncProgressModal({
  state,
  progress,
  results,
  parcelaResults,
  plantationResults,
  successCount,
  failureCount,
  parcelaFailureCount,
  plantationFailureCount,
  pullSuccess,
  authExpired,
  photoProgress,
  photoResult,
  globalProgress,
  onDismiss,
}: Props) {
  if (state === 'idle') return null;
  // Session expiry is surfaced by a dedicated ConfirmModal (re-login flow),
  // not here — suppress this modal so the two don't overlap.
  if (authExpired) return null;

  // Hay errores de cualquier tipo (grupo / parcela / plantación) — única fuente
  // de verdad para icono, color y título del resultado.
  const anyFailure = failureCount > 0 || parcelaFailureCount > 0 || plantationFailureCount > 0;

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
          <Text style={styles.title}>Subiendo grupos...</Text>
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

      {state === 'done' && pullSuccess !== null && results.length === 0 && !anyFailure && (
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

      {state === 'done' && (results.length > 0 || anyFailure || pullSuccess === null) && (
        <>
          <Ionicons
            name={anyFailure ? 'alert-circle' : 'checkmark-circle'}
            size={48}
            color={anyFailure ? colors.secondary : colors.primary}
          />
          <Text style={styles.title}>
            {anyFailure ? 'Sincronizacion parcial' : 'Sincronizacion completa'}
          </Text>
          {successCount > 0 && (
            <Text style={styles.successText}>
              {successCount} grupo{successCount > 1 ? 's' : ''} sincronizado
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
          {/* Plantación primero: si no se subió, FK-bloquea sus parcelas y
              grupos (la causa raíz más upstream). Luego parcela (bloquea grupos
              con PARCELA_PENDING), luego grupos. */}
          <FailureList label="plantacion" results={plantationResults} getKey={(r) => r.plantacionId} />
          <FailureList label="parcela" results={parcelaResults} getKey={(r) => r.parcelaId} />
          <FailureList label="grupo" results={results} getKey={(r) => r.groupId} />
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Cerrar</Text>
          </Pressable>
        </>
      )}
    </BaseModal>
  );
}
