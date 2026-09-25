import { Text, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { SYNC_STATE, SYNC_ERROR, getErrorMessage } from '../services/SyncService';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncGroupResult, SyncParcelaResult, SyncPlantationResult, PhotoSyncProgress, DownloadPhaseProgress, PlantacionesOmitidas } from '../services/SyncService';
import BaseModal from './BaseModal';
import FailureList from './FailureList';
import PlantacionesOmitidasAviso from './PlantacionesOmitidasAviso';
import PlantacionesDuplicadasAviso from './PlantacionesDuplicadasAviso';
import CambiosPorResolverAviso from './CambiosPorResolverAviso';
import EspeciesConArbolesAviso from './EspeciesConArbolesAviso';
import ProgressBar from './ProgressBar';
import { PHASE_LABEL, contadorDeFase, fraccionDeFase } from './syncPhaseLabels';
import { syncProgressModalStyles as styles } from './SyncProgressModal.styles';
import { formatearVelocidad } from '../utils/velocidadDeTransferencia';

type PhotoResult = { uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number };

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
  /** La plantación fue eliminada en el server (#478). */
  eliminada: boolean;
  /** Sync global: plantaciones salteadas por sin acceso o eliminadas (#478). */
  omitidas: PlantacionesOmitidas;
  authExpired: boolean;
  photoProgress: PhotoSyncProgress | null;
  /** Fase del pull en curso; sin esto el pull es un spinner mudo (#447). */
  phaseProgress: DownloadPhaseProgress | null;
  photoResult: PhotoResult | null;
  globalProgress?: { plantationName: string; done: number; total: number } | null;
  /** 45s sin ninguna señal de avance: recién ahí se ofrece cancelar (#451). */
  estancado: boolean;
  /** El usuario canceló: no es un error y no se reporta como tal. */
  cancelado: boolean;
  /** La corrida murió por timeout, no por falta de señal: el mensaje es otro. */
  huboTimeout: boolean;
  onCancelar: () => void;
  onDismiss: () => void;
  /** Abre "Resolver cambios" de una plantación (#634); sin esto el aviso no ofrece el botón. */
  onResolverCambios?: (plantacionId: string) => void;
}

type GlobalProgress = { plantationName: string; done: number; total: number } | null | undefined;

type FaseProps = {
  titulo: string;
  detalle: string;
  subdetalle?: string;
  fraccion: number;
  color: string;
  globalProgress: GlobalProgress;
};

type Avance = Pick<Props, 'progress' | 'photoProgress' | 'phaseProgress' | 'globalProgress'>;

const TEXTO_PREPARANDO = 'Preparando...';

/**
 * Cuerpo común de las cuatro fases en curso. El spinner dice "sigue vivo" aunque no
 * haya denominador; la barra aparece solo cuando se conoce el total.
 */
function FaseEnCurso({ titulo, detalle, subdetalle, fraccion, color, globalProgress }: FaseProps) {
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

/** Un timeout no es falta de conexión: hay señal, el que no contesta es el server (#451). */
function mensajeDeFalla(huboTimeout: boolean): string {
  return huboTimeout
    ? getErrorMessage(SYNC_ERROR.TIMEOUT)
    : 'No se pudo conectar con el servidor. Verificá tu conexión.';
}

/**
 * "12 de 40 fotos · ~180 KB/s". La velocidad aparece recién cuando hay una foto
 * completa con qué calcularla: el técnico necesita saber si la demora es la
 * conexión o el volumen (#450).
 */
function detalleDeFotos(photoProgress: PhotoSyncProgress | null): string {
  if (!photoProgress) return TEXTO_PREPARANDO;
  const contador = `${photoProgress.completed} de ${photoProgress.total} fotos`;
  const velocidad = formatearVelocidad(photoProgress, Date.now());
  return velocidad ? `${contador} · ${velocidad}` : contador;
}

function detalleDePull(phaseProgress: DownloadPhaseProgress | null): string {
  if (!phaseProgress) return 'Descargando novedades del servidor';
  return [PHASE_LABEL[phaseProgress.phase], contadorDeFase(phaseProgress)].filter(Boolean).join(' · ');
}

function fraccionDeConteo(hecho: number | undefined, total: number | undefined): number {
  return total && total > 0 ? (hecho ?? 0) / total : 0;
}

/**
 * Qué se está fotografiando: la plantación en el sync global, el grupo en el de una
 * sola. Sin esto el contador de fotos se reinicia entre grupos sin explicación.
 */
function contextoDeFotos(globalProgress: GlobalProgress, progress: SyncProgress | null): string | undefined {
  return globalProgress?.plantationName ?? progress?.currentName ?? undefined;
}

function faseDePull({ phaseProgress, globalProgress }: Avance): FaseProps {
  return {
    titulo: 'Actualizando datos...',
    detalle: detalleDePull(phaseProgress),
    fraccion: fraccionDeFase(phaseProgress),
    color: colors.info,
    globalProgress,
  };
}

function faseDePush({ progress, globalProgress }: Avance): FaseProps {
  return {
    titulo: 'Subiendo grupos...',
    detalle: progress ? `${progress.completed} de ${progress.total}` : TEXTO_PREPARANDO,
    subdetalle: progress?.currentName,
    fraccion: fraccionDeConteo(progress?.completed, progress?.total),
    color: colors.primary,
    globalProgress,
  };
}

/** En las fases de fotos el nombre de la plantación ya va como subdetalle. */
function faseDeFotos(titulo: string, color: string) {
  return ({ progress, photoProgress, globalProgress }: Avance): FaseProps => ({
    titulo,
    detalle: detalleDeFotos(photoProgress),
    subdetalle: contextoDeFotos(globalProgress, progress),
    fraccion: fraccionDeConteo(photoProgress?.completed, photoProgress?.total),
    color,
    globalProgress: null,
  });
}

const FASE_EN_CURSO: Partial<Record<SyncState, (avance: Avance) => FaseProps>> = {
  [SYNC_STATE.pulling]: faseDePull,
  [SYNC_STATE.pushing]: faseDePush,
  [SYNC_STATE.uploadingPhotos]: faseDeFotos('Subiendo fotos...', colors.primary),
  [SYNC_STATE.downloadingPhotos]: faseDeFotos('Descargando fotos...', colors.info),
};

function FaseActual(props: Props) {
  const fase = FASE_EN_CURSO[props.state];
  return fase ? <FaseEnCurso {...fase(props)} /> : null;
}

function AvisoEstancado({ onCancelar }: { onCancelar: () => void }) {
  return (
    <>
      <Text style={styles.estancadoText}>Hace un rato que no hay novedades. Puede ser la señal.</Text>
      <Pressable style={styles.cancelButton} onPress={onCancelar}>
        <Text style={styles.cancelText}>Cancelar sincronización</Text>
      </Pressable>
    </>
  );
}

function BotonCerrar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Pressable style={styles.dismissButton} onPress={onDismiss}>
      <Text style={styles.dismissText}>Cerrar</Text>
    </Pressable>
  );
}

type AvisoFinalProps = {
  icono: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  titulo: string;
  texto: string;
};

/** Resultados que reemplazan al resumen: la corrida no sincronizó nada que contar. */
function AvisoFinal({ icono, color, titulo, texto, onDismiss }: AvisoFinalProps & { onDismiss: () => void }) {
  return (
    <>
      <Ionicons name={icono} size={48} color={color} />
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.progressText}>{texto}</Text>
      <BotonCerrar onDismiss={onDismiss} />
    </>
  );
}

const AVISO_CANCELADA: AvisoFinalProps = {
  icono: 'stop-circle',
  color: colors.textSecondary,
  titulo: 'Sincronización cancelada',
  texto: 'Lo que alcanzó a sincronizarse quedó guardado. Podés reintentar cuando tengas mejor señal.',
};

const AVISO_ELIMINADA: AvisoFinalProps = {
  icono: 'trash',
  color: colors.stateEliminada,
  titulo: 'Plantación eliminada en el servidor',
  texto:
    'Un administrador la eliminó. Los datos del dispositivo quedan solo para consulta: lo que ' +
    'quedó sin subir ya no se puede sincronizar. Podés eliminarla del dispositivo cuando quieras.',
};

const AVISO_SIN_ACCESO: AvisoFinalProps = {
  icono: 'lock-closed',
  color: colors.secondary,
  titulo: 'Sin acceso a la plantación',
  texto: 'Un administrador te quitó el acceso. Los datos descargados quedan solo para consulta y no se van a sincronizar.',
};

/** "1 foto subida" / "3 fotos subidas". */
function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n > 1 ? plural : singular}`;
}

function Conteo({ n, singular, plural, falla }: { n?: number; singular: string; plural: string; falla?: boolean }) {
  if (n == null || n <= 0) return null;
  return <Text style={falla ? styles.failureMessage : styles.successText}>{cantidad(n, singular, plural)}</Text>;
}

function FotosDescargadas({ photoResult }: { photoResult: PhotoResult | null }) {
  return (
    <Conteo
      n={photoResult?.downloaded}
      singular="foto descargada correctamente"
      plural="fotos descargadas correctamente"
    />
  );
}

function IconoDeResultado({ ok }: { ok: boolean }) {
  return (
    <Ionicons
      name={ok ? 'checkmark-circle' : 'alert-circle'}
      size={48}
      color={ok ? colors.primary : colors.secondary}
    />
  );
}

/** Única fuente de verdad para ícono, color y título del resumen. */
function hayFallas(p: Props): boolean {
  return p.failureCount > 0 || p.parcelaFailureCount > 0 || p.plantationFailureCount > 0;
}

/** Cierra el resumen y abre la pantalla donde se elige. */
function AvisoDeCambiosPorResolver({ plantationResults, onDismiss, onResolverCambios }: Props) {
  const resolver = onResolverCambios
    ? (plantacionId: string) => { onDismiss(); onResolverCambios(plantacionId); }
    : undefined;
  return <CambiosPorResolverAviso resultados={plantationResults} onResolver={resolver} />;
}

/** Solo hubo pull: no se subió ni falló nada que listar. */
function esSoloPull(p: Props): boolean {
  return p.pullSuccess !== null && p.results.length === 0 && !hayFallas(p);
}

function ResultadoPull(p: Props) {
  return (
    <>
      <IconoDeResultado ok={!!p.pullSuccess} />
      <Text style={styles.title}>{p.pullSuccess ? 'Datos actualizados' : 'Error al actualizar'}</Text>
      <Text style={styles.progressText}>
        {p.pullSuccess ? 'Se descargaron los últimos datos del servidor.' : mensajeDeFalla(p.huboTimeout)}
      </Text>
      <FotosDescargadas photoResult={p.photoResult} />
      <PlantacionesOmitidasAviso omitidas={p.omitidas} />
      <PlantacionesDuplicadasAviso resultados={p.plantationResults} />
      <EspeciesConArbolesAviso resultados={p.plantationResults} />
      <AvisoDeCambiosPorResolver {...p} />
      <BotonCerrar onDismiss={p.onDismiss} />
    </>
  );
}

function ConteosDePush({ successCount, photoResult }: Pick<Props, 'successCount' | 'photoResult'>) {
  return (
    <>
      <Conteo n={successCount} singular="grupo sincronizado" plural="grupos sincronizados" />
      <Conteo n={photoResult?.uploaded} singular="foto subida correctamente" plural="fotos subidas correctamente" />
      <Conteo n={photoResult?.uploadFailed} singular="foto no pudo subirse." plural="fotos no pudieron subirse." falla />
      <Conteo
        n={photoResult?.downloadFailed}
        singular="foto no pudo descargarse."
        plural="fotos no pudieron descargarse."
        falla
      />
      <FotosDescargadas photoResult={photoResult} />
    </>
  );
}

function ResultadoPush(p: Props) {
  const conFallas = hayFallas(p);
  return (
    <>
      <IconoDeResultado ok={!conFallas} />
      <Text style={styles.title}>{conFallas ? 'Sincronización parcial' : 'Sincronización completa'}</Text>
      <ConteosDePush successCount={p.successCount} photoResult={p.photoResult} />
      {/* Plantación primero: si no se subió, FK-bloquea sus parcelas y grupos (la causa
          raíz más upstream). Luego parcela (bloquea grupos con PARCELA_PENDING), luego grupos. */}
      <FailureList label="plantación" plural="plantaciones" results={p.plantationResults} getKey={(r) => r.plantacionId} />
      <FailureList label="parcela" results={p.parcelaResults} getKey={(r) => r.parcelaId} />
      <FailureList label="grupo" results={p.results} getKey={(r) => r.groupId} />
      <PlantacionesOmitidasAviso omitidas={p.omitidas} />
      <PlantacionesDuplicadasAviso resultados={p.plantationResults} />
      <EspeciesConArbolesAviso resultados={p.plantationResults} />
      <AvisoDeCambiosPorResolver {...p} />
      <BotonCerrar onDismiss={p.onDismiss} />
    </>
  );
}

/** Cancelada gana sobre todo; eliminada o sin acceso reemplazan al resumen. */
function Resultado(p: Props) {
  if (p.cancelado) return <AvisoFinal {...AVISO_CANCELADA} onDismiss={p.onDismiss} />;
  if (p.eliminada) return <AvisoFinal {...AVISO_ELIMINADA} onDismiss={p.onDismiss} />;
  if (p.sinAcceso) return <AvisoFinal {...AVISO_SIN_ACCESO} onDismiss={p.onDismiss} />;
  return esSoloPull(p) ? <ResultadoPull {...p} /> : <ResultadoPush {...p} />;
}

export default function SyncProgressModal(props: Props) {
  const { state, authExpired, estancado, onCancelar, onDismiss } = props;
  if (state === SYNC_STATE.idle) return null;
  // La sesión vencida la muestra un ConfirmModal propio (re-login); no superponerlos.
  if (authExpired) return null;

  const terminada = state === SYNC_STATE.done;
  return (
    <BaseModal visible onRequestClose={terminada ? onDismiss : undefined}>
      <FaseActual {...props} />
      {estancado && !terminada && <AvisoEstancado onCancelar={onCancelar} />}
      {terminada && <Resultado {...props} />}
    </BaseModal>
  );
}
