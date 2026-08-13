import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '../theme';
import { checkFinalizationGate, hasIdsGenerated } from '../queries/adminQueries';
import PlantationEstadoChip from './PlantationEstadoChip';
import { AVISO_IDS_DESDE_WEB } from './AdminBottomSheet';
import { plantationConfigCardStyles as styles } from './PlantationConfigCard.styles';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
  createdAt: string;
  pendingSync?: boolean;  // true for offline-created, not yet uploaded
  pendingEdit?: boolean;  // true for offline-edited lugar/periodo, not yet uploaded
  gpsCaptureFrequency?: number;
  gpsCaptureRequired?: boolean;
};

type Props = {
  item: Plantation;
  onFinalize: (id: string) => void;
  onExportCsv: (id: string) => void;
  onExportExcel: (id: string) => void;
  onConfigSpecies: (id: string) => void;
  onAssignTech: (id: string) => void;
  onEdit: (item: Plantation) => void;
};

export default function PlantationConfigCard({
  item,
  onFinalize,
  onExportCsv,
  onExportExcel,
  onConfigSpecies,
  onAssignTech,
  onEdit,
}: Props) {
  const [idsGenerated, setIdsGenerated] = useState(false);
  const [canFinalize, setCanFinalize] = useState(false);

  useEffect(() => {
    if (item.estado === 'finalizada') {
      hasIdsGenerated(item.id).then(setIdsGenerated).catch(console.error);
    }
    if (item.estado === 'activa') {
      checkFinalizationGate(item.id)
        .then((gate) => setCanFinalize(gate.canFinalize))
        .catch(console.error);
    }
  }, [item.id, item.estado]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle}>{item.lugar}</Text>
          <Text style={styles.cardSubtitle}>{item.periodo}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {item.pendingSync === true && (
            <View style={styles.pendingSyncBadge}>
              <Ionicons name="cloud-upload-outline" size={11} color={colors.white} />
              <Text style={styles.pendingSyncText}>Pendiente de sync</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.editIconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => onEdit(item)}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </Pressable>
          <PlantationEstadoChip estado={item.estado} />
        </View>
      </View>

      {item.estado === 'activa' && (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onConfigSpecies(item.id)}
          >
            <Ionicons name="list-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Configurar especies</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onAssignTech(item.id)}
          >
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Asignar técnicos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnDanger,
              pressed && { opacity: 0.7 },
              !canFinalize && styles.actionBtnDisabled,
            ]}
            onPress={() => onFinalize(item.id)}
            disabled={!canFinalize}
          >
            <Ionicons name="lock-closed-outline" size={14} color={colors.white} />
            <Text style={styles.actionBtnDangerText}>Finalizar</Text>
          </Pressable>
        </View>
      )}

      {item.estado === 'finalizada' && (
        <View style={styles.actionRow}>
          {/* #232: los IDs finales se generan desde la web; acá solo se informa. */}
          {!idsGenerated && (
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoNoteText}>{AVISO_IDS_DESDE_WEB}</Text>
            </View>
          )}
          {idsGenerated && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onExportCsv(item.id)}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar CSV</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onExportExcel(item.id)}
              >
                <Ionicons name="grid-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar Excel</Text>
              </Pressable>
            </>
          )}
          <View style={styles.lockedBadge}>
            <Ionicons name="lock-closed" size={12} color={colors.stateFinalizada} />
            <Text style={styles.lockedText}>Bloqueada</Text>
          </View>
        </View>
      )}
    </View>
  );
}
