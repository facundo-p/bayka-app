import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import type { DownloadResult, DownloadProgress, DownloadPhase } from '../services/SyncService';
import BaseModal from './BaseModal';
import { downloadProgressModalStyles as styles } from './DownloadProgressModal.styles';

interface Props {
  state: 'idle' | 'downloading' | 'done';
  progress: DownloadProgress | null;
  results: DownloadResult[];
  onDismiss: () => void;
}

const PHASE_LABEL: Record<DownloadPhase, string> = {
  species: 'Catálogo de especies',
  parcelas: 'Parcelas',
  groups: 'Grupos',
  usuarios: 'Usuarios',
  especies_plantacion: 'Especies asignadas',
  arboles: 'Árboles',
  fotos: 'Fotos',
  finalizando: 'Finalizando',
};

function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function DownloadProgressModal({ state, progress, results, onDismiss }: Props) {
  if (state === 'idle') return null;

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const allSuccess = failureCount === 0 && results.length > 0;
  const allFailed = successCount === 0 && results.length > 0;

  return (
    <BaseModal visible onRequestClose={state === 'done' ? onDismiss : undefined}>
      {state === 'downloading' && (
        <DownloadingView progress={progress} />
      )}

      {state === 'done' && allSuccess && (
        <>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.title}>Descarga completa</Text>
          <Text style={styles.progressText}>{successCount} plantación(es) descargada(s)</Text>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Cerrar resumen</Text>
          </Pressable>
        </>
      )}

      {state === 'done' && !allSuccess && !allFailed && (
        <>
          <Ionicons name="alert-circle" size={48} color={colors.secondary} />
          <Text style={styles.title}>Descarga parcial</Text>
          <Text style={styles.successText}>{successCount} descargada(s) correctamente</Text>
          <View style={styles.failureSection}>
            <Text style={styles.failureTitle}>{failureCount} con error:</Text>
            {results.filter((r) => !r.success).map((r) => (
              <View key={r.id} style={styles.failureItem}>
                <Text style={styles.failureName}>{r.nombre}</Text>
                <Text style={styles.failureMessage}>No se pudo descargar. Reintenta desde el catálogo.</Text>
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
          <Text style={styles.progressText}>No se pudo descargar ninguna plantación. Verificá tu conexión.</Text>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Cerrar resumen</Text>
          </Pressable>
        </>
      )}
    </BaseModal>
  );
}

function DownloadingView({ progress }: { progress: DownloadProgress | null }) {
  if (!progress) {
    return (
      <>
        <Text style={styles.title}>Preparando...</Text>
        <ProgressBar fraction={0} />
      </>
    );
  }
  const { plantationIndex, plantationTotal, currentName, phase } = progress;
  const phaseLabel = phase ? PHASE_LABEL[phase.phase] : '';
  const counter = phase && phase.phaseTotal > 0 ? `${phase.phaseDone} de ${phase.phaseTotal}` : '';
  const phaseFraction = phase && phase.phaseTotal > 0 ? phase.phaseDone / phase.phaseTotal : 0;

  return (
    <>
      <Text style={styles.title}>Descargando</Text>
      <Text style={styles.plantationCounter}>
        Plantación {plantationIndex} de {plantationTotal}
      </Text>
      <Text style={styles.currentName}>{currentName}</Text>
      <View style={styles.phaseBlock}>
        <View style={styles.phaseRow}>
          <Text style={styles.phaseLabel}>{phaseLabel || '...'}</Text>
          <Text style={styles.phaseCounter}>{counter}</Text>
        </View>
        <ProgressBar fraction={phaseFraction} />
      </View>
    </>
  );
}

