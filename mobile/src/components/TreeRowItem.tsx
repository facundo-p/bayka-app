import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';
import { treeRowItemStyles as styles } from './TreeRowItem.styles';

export interface TreeItemData {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  fotoSynced?: boolean;
  createdAt: string;
  grupoId: string;
  usuarioRegistro: string;
  /** Punto GPS capturado; null/ausente = árbol sin coordenadas. */
  latitude?: number | null;
}

interface Props {
  item: TreeItemData;
  isReadOnly: boolean;
  isDeleting?: boolean;
  onViewPhoto: (treeId: string, uri: string) => void;
  onAttachPhoto?: (treeId: string) => void;
  onDeleteTree?: (treeId: string, posicion: number) => void;
}

export default function TreeRowItem({ item, isReadOnly, isDeleting, onViewPhoto, onAttachPhoto, onDeleteTree }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.pos}>{item.posicion}</Text>
      <Text style={[styles.name, item.especieId === null && styles.nameNN]} numberOfLines={1}>
        {getSpeciesName(item)}
      </Text>
      <Text style={styles.code} numberOfLines={1}>{getSpeciesCode(item)}</Text>
      <View style={styles.actions}>
        {item.latitude != null && (
          <View testID="gps-pin" style={styles.gpsPin}>
            <Ionicons name="location" size={16} color={colors.plantation} />
          </View>
        )}
        {item.fotoUrl
          ? <Pressable onPress={() => onViewPhoto(item.id, item.fotoUrl!)} hitSlop={8} style={styles.btn}>
              <View>
                <Ionicons name="image" size={18} color={colors.plantation} />
                {item.fotoUrl && !item.fotoSynced && (
                  <View style={styles.syncDot} />
                )}
              </View>
            </Pressable>
          : !isReadOnly && onAttachPhoto
            ? <Pressable onPress={() => onAttachPhoto(item.id)} hitSlop={8} style={styles.btn}>
                <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
              </Pressable>
            : null}
        {!isReadOnly && onDeleteTree && (
          <Pressable onPress={() => onDeleteTree(item.id, item.posicion)}
            hitSlop={8} style={styles.btn} disabled={isDeleting}>
            {isDeleting
              ? <ActivityIndicator size="small" color={colors.danger} />
              : <Ionicons name="trash-outline" size={18} color={colors.danger} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

