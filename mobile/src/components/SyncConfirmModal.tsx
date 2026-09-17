import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { syncConfirmModalStyles as styles } from './SyncConfirmModal.styles';
import BaseModal from './BaseModal';
import CheckboxRow from './CheckboxRow';
import { useSyncSetting } from '../hooks/useSyncSetting';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { formatPendingBreakdown } from '../utils/pendingBreakdown';

type Props = {
  visible: boolean;
  title?: string;
  /** Sin plantacionId el desglose de pendientes es global (sync general). */
  plantacionId?: string;
  onConfirm: (incluirFotos: boolean) => void;
  onClose: () => void;
};

export default function SyncConfirmModal({ visible, title = 'Sincronizar', plantacionId, onConfirm, onClose }: Props) {
  const { incluirFotos, toggleIncluirFotos } = useSyncSetting();
  // #71: desglosar qué está pendiente (no solo el total) hace diagnosticable
  // un indicador naranja residual.
  const { pendingGroupsCount, pendingParcelasCount, pendingPhotosCount } = usePendingSyncCount(plantacionId);
  const breakdown = formatPendingBreakdown({
    grupos: pendingGroupsCount,
    parcelas: pendingParcelasCount,
    fotos: pendingPhotosCount,
  });

  function handleConfirm() {
    onConfirm(incluirFotos);
  }

  return (
    <BaseModal visible={visible} onRequestClose={onClose} dismissOnBackdrop>
      <Ionicons name="sync-outline" size={28} color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.pendingInfo}>
        {breakdown ? `Pendiente de subir: ${breakdown}` : 'No hay cambios locales pendientes de subir'}
      </Text>
      <View style={styles.checkboxContainer}>
        <CheckboxRow
          label="Incluir fotos"
          checked={incluirFotos}
          onToggle={() => toggleIncluirFotos(!incluirFotos)}
        />
      </View>
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed]}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmBtnText}>Sincronizar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          onPress={onClose}
        >
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}
