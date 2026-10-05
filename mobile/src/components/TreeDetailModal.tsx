/**
 * TreeDetailModal — detalle/edición de un árbol del listado de un grupo.
 * Foto y punto GPS se editan según el gating de `canEdit`/`canDelete`; la especie,
 * según `cambioDeEspecie` (#679).
 */
import { useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import { useTreeDetail } from '../hooks/useTreeDetail';
import PhotoViewer from './PhotoViewer';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import type { ErrorSink } from '../hooks/useTreeRegistration';
import { confirmarQuitarFoto } from '../utils/avisoQuitarFoto';
import { confirmarReemplazarFoto } from '../utils/avisoReemplazarFoto';
import FotoRemota from './FotoRemota';
import { isRemoteUri } from '../utils/photoUri';
import type { CambioDeEspecie } from '../utils/permisosDeEdicion';
import SeccionEspecie from './SeccionEspecie';
import { treeDetailModalStyles as styles } from './TreeDetailModal.styles';

const MENSAJE_GPS_ERROR = 'No se pudo capturar el punto GPS.';

interface Props {
  visible: boolean;
  treeId: string | null;
  plantacionId: string;
  canEdit: boolean;
  canDelete: boolean;
  cambioDeEspecie: CambioDeEspecie;
  onClose: () => void;
  /** Reabre el grupo finalizado para poder cambiar la especie; true si quedó activo. */
  onReabrirGrupo: () => Promise<boolean>;
  /** Los errores se reportan por `onError`: el diálogo de la pantalla queda detrás de este Modal. */
  onCapturePhoto: (treeId: string, onError: ErrorSink) => Promise<void>;
  onRemovePhoto: (treeId: string, onError: ErrorSink) => Promise<void>;
  onCaptureGps: (treeId: string) => Promise<boolean>;
  onDelete: (treeId: string, posicion: number) => void;
}

export default function TreeDetailModal({
  visible,
  treeId,
  plantacionId,
  canEdit,
  canDelete,
  cambioDeEspecie,
  onClose,
  onReabrirGrupo,
  onCapturePhoto,
  onRemovePhoto,
  onCaptureGps,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const tree = useTreeDetail(treeId);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [busyGps, setBusyGps] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const confirm = useConfirm();
  // Ampliar la foto es solo lectura; abierto desde «Ver actual» del aviso, ofrece Reemplazar.
  const [visor, setVisor] = useState<{ uri: string; reemplazable: boolean } | null>(null);

  const showError: ErrorSink = (mensaje) =>
    showInfoDialog(confirm.show, 'Error', mensaje, 'alert-circle-outline', colors.danger);

  async function accionDeFoto(accion: Props['onCapturePhoto'], id: string) {
    setBusyPhoto(true);
    try { await accion(id, showError); } finally { setBusyPhoto(false); }
  }

  function handleCapturePhoto() {
    if (!tree) return;
    const fotoActual = tree.fotoUrl;
    if (!fotoActual) { void accionDeFoto(onCapturePhoto, tree.id); return; }
    confirmarReemplazarFoto(confirm.show, { subId: tree.subId, fotoSynced: tree.fotoSynced ?? true }, {
      onVerActual: () => setVisor({ uri: fotoActual, reemplazable: true }),
      onConfirm: () => { void accionDeFoto(onCapturePhoto, tree.id); },
    });
  }

  function reemplazarDesdeVisor() {
    setVisor(null);
    if (tree) void accionDeFoto(onCapturePhoto, tree.id);
  }

  function handleRemovePhoto() {
    if (!tree) return;
    confirmarQuitarFoto(confirm.show, tree.fotoSynced ?? true, () => accionDeFoto(onRemovePhoto, tree.id));
  }

  async function handleCaptureGps() {
    if (!tree) return;
    setBusyGps(true);
    setGpsFailed(false);
    try {
      const ok = await onCaptureGps(tree.id);
      if (!ok) setGpsFailed(true);
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : MENSAJE_GPS_ERROR);
    } finally {
      setBusyGps(false);
    }
  }

  const hasPhoto = !!tree?.fotoUrl;
  const hasGps = tree?.latitude != null && tree?.longitude != null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.title}>{tree ? `Árbol ${tree.posicion}` : 'Árbol'}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={24} color={colors.textMedium} />
          </Pressable>
        </View>

        {!tree ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.plantation} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SeccionEspecie
              tree={tree}
              plantacionId={plantacionId}
              cambio={cambioDeEspecie}
              onReabrirGrupo={onReabrirGrupo}
              confirmar={confirm.show}
            />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Foto</Text>
              {isRemoteUri(tree.fotoUrl) ? (
                <FotoRemota treeId={tree.id} storagePath={tree.fotoUrl} style={styles.photo} />
              ) : hasPhoto ? (
                <Pressable onPress={() => setVisor({ uri: tree.fotoUrl!, reemplazable: false })} accessibilityLabel="Ampliar foto">
                  <Image source={{ uri: tree.fotoUrl! }} style={styles.photo} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="image-outline" size={28} color={colors.textLight} />
                  <Text style={styles.emptyText}>Sin foto</Text>
                </View>
              )}
              {canEdit && (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.btn} onPress={handleCapturePhoto} disabled={busyPhoto}>
                    {busyPhoto ? (
                      <ActivityIndicator size="small" color={colors.plantation} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={18} color={colors.plantation} />
                        <Text style={styles.btnText}>{hasPhoto ? 'Cambiar foto' : 'Tomar foto'}</Text>
                      </>
                    )}
                  </Pressable>
                  {hasPhoto && (
                    <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleRemovePhoto} disabled={busyPhoto}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      <Text style={[styles.btnText, styles.btnTextDanger]}>Quitar</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Punto GPS</Text>
              {hasGps ? (
                <View style={styles.gpsBox}>
                  <Ionicons name="location" size={18} color={colors.plantation} />
                  <View style={styles.gpsInfo}>
                    <Text style={styles.gpsCoords}>
                      {tree.latitude!.toFixed(6)}, {tree.longitude!.toFixed(6)}
                    </Text>
                    {tree.gpsAccuracy != null && (
                      <Text style={styles.gpsAccuracy}>Precisión ±{Math.round(tree.gpsAccuracy)} m</Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="location-outline" size={28} color={colors.textLight} />
                  <Text style={styles.emptyText}>Sin punto GPS</Text>
                </View>
              )}
              {canEdit && (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.btn} onPress={handleCaptureGps} disabled={busyGps}>
                    {busyGps ? (
                      <ActivityIndicator size="small" color={colors.plantation} />
                    ) : (
                      <>
                        <Ionicons name="locate-outline" size={18} color={colors.plantation} />
                        <Text style={styles.btnText}>{hasGps ? 'Recapturar punto' : 'Capturar punto'}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
              {gpsFailed && (
                <Text style={styles.gpsError}>
                  No se pudo capturar el punto. Verificá señal y permiso de GPS, y reintentá.
                </Text>
              )}
            </View>

            {canDelete && (
              <Pressable style={styles.deleteBtn} onPress={() => onDelete(tree.id, tree.posicion)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteText}>Eliminar árbol</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
        <PhotoViewer
          uri={visor?.uri ?? null}
          treeId={treeId ?? undefined}
          onClose={() => setVisor(null)}
          onReplace={visor?.reemplazable ? reemplazarDesdeVisor : undefined}
        />
        <ConfirmModal {...confirm.confirmProps} />
      </View>
    </Modal>
  );
}
