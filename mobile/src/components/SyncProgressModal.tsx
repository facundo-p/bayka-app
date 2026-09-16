import { Text, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { SYNC_STATE, SYNC_ERROR, getErrorMessage } from '../services/SyncService';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncGroupResult, SyncParcelaResult, SyncPlantationResult, PhotoSyncProgress, DownloadPhaseProgress } from '../services/SyncService';
import BaseModal from './BaseModal';
import FailureList from './FailureList';
import ProgressBar from './ProgressBar';
import { PHASE_LABEL, contadorDeFase, fraccionDeFase } from './syncPhaseLabels';
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
  /** La membresía fue revocada: la copia local queda para consulta (#317). */
  sinAcceso: boolean;
  authExpired: boolean;
  photoProgress: PhotoSyncProgress | null;
  /** Fase del pull en curso; sin esto el pull es un spinner mudo (#447). */
  phaseProgress: DownloadPhaseProgress | null;
  photoResult: { uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number } | null;
  globalProgress?: { plantationName: string; done: number; total: number } | null;
  /** 45s sin ninguna señal de avance: recién ahí se ofrece cancelar (#451). */
  estancado: boolean;
  /** El usuario canceló: no es un error y no se reporta como tal. */
  cancelado: boolean;
  /** La corrida murió por timeout, no por falta de señal: el mensaje es otro. */
  huboTimeout: boolean;
  onCancelar: () => void;
  onDismiss: () => void;
}

type GlobalProgress = { plantationName: string; done: number; total: number } | null | undefined;

/**
 * Cuerpo común de las cuatro fases en curso. El spinner dice "sigue vivo" aunque no
 * haya denominador; la barra aparece solo cuando se conoce el total.
 */
function FaseEnCurso({
  titulo, detalle, subdetalle, fraccion, color, globalProgress,
}: {
  titulo: string;
  detalle: string;
  subdetalle?: string;
  fraccion: number;
  color: string;
  globalProgress: GlobalProgress;
}) {
  return (
    <>
      <ActivityIndicator size="large" color={color} />
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.progressText}>{detalle}</Text>
      {subdetalle ? <Text style={styles.currentName}>{subdetalle}</Text> : null}
      {fraccion > 0 ? <ProgressBar fraction={fraccion} /> : null}
      {globalProgress && (
        <Text style={styles.plantationProgress}>
          Sincronizando {globalProgress.plantationName}... ({globalProgress.done + 1} de {globalProgress.total} plantaciones)
        </Text>
      )}
    </>
  );
}

const TEXTO_PREPARANDO = 'Preparando...';

/** Un timeout no es falta de conexión: hay señal, el que no contesta es el server (#451). */
function mensajeDeFalla(huboTimeout: boolean): string {
  return huboTimeout
    ? getErrorMessage(SYNC_ERROR.TIMEOUT)
    : 'No se pudo conectar con el servidor. Verifica tu conexión.';
}

function detalleDeFotos(photoProgress: PhotoSyncProgress | null): string {
  return photoProgress ? `${photoProgress.completed} de ${photoProgress.total} fotos` : TEXTO_PREPARANDO;
}

function fraccionDeConteo(hecho: number | undefined, total: number | undefined): number {
  return total && total > 0 ? (hecho ?? 0) / total : 0;
}

/**
 * Qué se está fotografiando: la plantación en el sync global, el grupo en el de una
 * sola. Sin esto el contador de fotos se reinicia entre grupos sin explicación.
 */
function contextoDeFotos(
  globalProgress: GlobalProgress,
  progress: SyncProgress | null,
): string | undefined {
  return globalProgress?.plantationName ?? progress?.currentName ?? undefined;
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
  sinAcceso,
  authExpired,
  photoProgress,
  phaseProgress,
  photoResult,
  globalProgress,
  estancado,
  cancelado,
  huboTimeout,
  onCancelar,
  onDismiss,
}: Props) {
  if (state === SYNC_STATE.idle) return null;
  // Session expiry is surfaced by a dedicated ConfirmModal (re-login flow),
  // not here — suppress this modal so the two don't overlap.
  if (authExpired) return null;

  // Hay errores de cualquier tipo (grupo / parcela / plantación) — única fuente
  // de verdad para icono, color y título del resultado.
  const anyFailure = failureCount > 0 || parcelaFailureCount > 0 || plantationFailureCount > 0;

  return (
    <BaseModal
      visible
      onRequestClose={state === SYNC_STATE.done ? onDismiss : undefined}
    >
      {state === SYNC_STATE.pulling && (
        <FaseEnCurso
          titulo="Actualizando datos..."
          detalle={
            phaseProgress
              ? [PHASE_LABEL[phaseProgress.phase], contadorDeFase(phaseProgress)].filter(Boolean).join(' · ')
              : 'Descargando novedades del servidor'
          }
          fraccion={fraccionDeFase(phaseProgress)}
          color={colors.info}
          globalProgress={globalProgress}
        />
      )}

      {state === SYNC_STATE.pushing && (
        <FaseEnCurso
          titulo="Subiendo grupos..."
          detalle={progress ? `${progress.completed} de ${progress.total}` : TEXTO_PREPARANDO}
          subdetalle={progress?.currentName}
          fraccion={fraccionDeConteo(progress?.completed, progress?.total)}
          color={colors.primary}
          globalProgress={globalProgress}
        />
      )}

      {state === SYNC_STATE.uploadingPhotos && (
        <FaseEnCurso
          titulo="Subiendo fotos..."
          detalle={detalleDeFotos(photoProgress)}
          subdetalle={contextoDeFotos(globalProgress, progress)}
          fraccion={fraccionDeConteo(photoProgress?.completed, photoProgress?.total)}
          color={colors.primary}
          globalProgress={null}
        />
      )}

      {state === SYNC_STATE.downloadingPhotos && (
        <FaseEnCurso
          titulo="Descargando fotos..."
          detalle={detalleDeFotos(photoProgress)}
          subdetalle={contextoDeFotos(globalProgress, progress)}
          fraccion={fraccionDeConteo(photoProgress?.completed, photoProgress?.total)}
          color={colors.info}
          globalProgress={null}
        />
      )}

      {estancado && state !== SYNC_STATE.done && (
        <>
          <Text style={styles.estancadoText}>
            Hace un rato que no hay novedades. Puede ser la señal.
          </Text>
          <Pressable style={styles.cancelButton} onPress={onCancelar}>
            <Text style={styles.cancelText}>Cancelar sincronizacion</Text>
          </Pressable>
        </>
      )}

      {state === SYNC_STATE.done && cancelado && (
        <>
          <Ionicons name="stop-circle" size={48} color={colors.textSecondary} />
          <Text style={styles.title}>Sincronizacion cancelada</Text>
          <Text style={styles.progressText}>
            Lo que alcanzó a sincronizarse quedó guardado. Podés reintentar cuando tengas mejor señal.
          </Text>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Cerrar</Text>
          </Pressable>
        </>
      )}

      {state === SYNC_STATE.done && !cancelado && sinAcceso && (
        <>
          <Ionicons name="lock-closed" size={48} color={colors.secondary} />
          <Text style={styles.title}>Sin acceso a la plantacion</Text>
          <Text style={styles.progressText}>
            Un administrador te quito el acceso. Los datos descargados quedan solo para consulta
            y no se van a sincronizar.
          </Text>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Cerrar</Text>
          </Pressable>
        </>
      )}

      {state === SYNC_STATE.done && !cancelado && !sinAcceso && pullSuccess !== null && results.length === 0 && !anyFailure && (
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
              : mensajeDeFalla(huboTimeout)}
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

      {state === SYNC_STATE.done && !cancelado && !sinAcceso && (results.length > 0 || anyFailure || pullSuccess === null) && (
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
