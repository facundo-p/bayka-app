/**
 * TreeDetailModal — detalle/edición de un árbol del listado de un grupo.
 * Foto y punto GPS se editan según el gating de `canEdit`/`canDelete`.
 */
import { useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import { useTreeDetail } from '../hooks/useTreeDetail';
import { getSpeciesName } from '../utils/speciesHelpers';
import PhotoViewer from './PhotoViewer';
import { treeDetailModalStyles as styles } from './TreeDetailModal.styles';

interface Props {
  visible: boolean;
  treeId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCapturePhoto: (treeId: string) => Promise<void>;
  onRemovePhoto: (treeId: string) => Promise<void>;
  onCaptureGps: (treeId: string) => Promise<boolean>;
  onDelete: (treeId: string, posicion: number) => void;
}

export default function TreeDetailModal({
  visible,
  treeId,
  canEdit,
  canDelete,
  onClose,
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
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  async function handleCapturePhoto() {
    if (!tree) return;
    setBusyPhoto(true);
    try { await onCapturePhoto(tree.id); } finally { setBusyPhoto(false); }
  }

  async function handleRemovePhoto() {
    if (!tree) return;
    setBusyPhoto(true);
    try { await onRemovePhoto(tree.id); } finally { setBusyPhoto(false); }
  }

  async function handleCaptureGps() {
    if (!tree) return;
    setBusyGps(true);
    setGpsFailed(false);
    try {
      const ok = await onCaptureGps(tree.id);
      if (!ok) setGpsFailed(true);
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
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Especie</Text>
              <Text style={[styles.speciesName, tree.especieId === null && styles.speciesNN]}>
                {getSpeciesName(tree)}
              </Text>
              {tree.especieNombreCientifico ? (
                <Text style={styles.scientific}>{tree.especieNombreCientifico}</Text>
              ) : null}
              <Text style={styles.subId}>{tree.subId}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Foto</Text>
              {hasPhoto ? (
                <Pressable onPress={() => setZoomUri(tree.fotoUrl!)} accessibilityLabel="Ampliar foto">
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
        <PhotoViewer uri={zoomUri} onClose={() => setZoomUri(null)} />
      </View>
    </Modal>
  );
}
