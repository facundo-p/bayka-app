/**
 * ConfigureSpeciesScreen — species toggle list; enable/disable species for
 * a plantation. Species with existing trees are locked. Reordering lives in
 * ReorderSpeciesScreen.
 */
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import ConfirmModal from '../components/ConfirmModal';
import { useSpeciesConfig } from '../hooks/useSpeciesConfig';
import { configureSpeciesScreenStyles as styles } from './ConfigureSpeciesScreen.styles';

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onPress }: { checked: boolean; indeterminate?: boolean; onPress: () => void }) {
  const iconName = indeterminate ? 'remove' : checked ? 'checkmark' : undefined;
  const isActive = checked || indeterminate;
  return (
    <Pressable
      style={[styles.checkbox, isActive && styles.checkboxActive]}
      onPress={onPress}
      hitSlop={6}
    >
      {iconName && <Ionicons name={iconName} size={14} color={colors.white} />}
    </Pressable>
  );
}

type Props = {
  plantacionIdProp?: string;
  onClose?: () => void;
  pendingSync?: boolean;
};

export default function ConfigureSpeciesScreen({ plantacionIdProp, onClose, pendingSync }: Props = {}) {
  const params = useLocalSearchParams<{ plantacionId: string }>();
  const plantacionId = plantacionIdProp ?? params.plantacionId;
  const router = useRouter();

  const {
    items,
    loading,
    saving,
    enabledCount,
    allEnabled,
    someEnabled,
    confirmProps,
    handleToggle,
    handleSelectAll,
    handleSave,
  } = useSpeciesConfig(plantacionId, pendingSync);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando especies...</Text>
      </View>
    );
  }

  return (
    <ScreenContainer withTexture>
      <FlatList
        data={items}
        keyExtractor={(item) => item.especieId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            <Text style={styles.listHeader}>
              {enabledCount} especie{enabledCount !== 1 ? 's' : ''} seleccionada{enabledCount !== 1 ? 's' : ''}
            </Text>
            <Pressable style={styles.selectAllRow} onPress={handleSelectAll}>
              <Checkbox
                checked={allEnabled}
                indeterminate={someEnabled}
                onPress={handleSelectAll}
              />
              <Text style={styles.selectAllText}>Seleccionar todos</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(250)}>
            <Pressable
              style={[styles.row, item.enabled && styles.rowEnabled]}
              onPress={() => handleToggle(item.especieId, !item.enabled)}
            >
              <Checkbox
                checked={item.enabled}
                onPress={() => handleToggle(item.especieId, !item.enabled)}
              />
              <Text style={[styles.rowCode, styles.rowCodeBold]}>{item.codigo}</Text>
              <Text style={[styles.rowName, !item.enabled && styles.rowNameDisabled]} numberOfLines={1}>
                {item.nombre}
              </Text>
              {item.hasExistingTrees && (
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              )}
            </Pressable>
          </Animated.View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
          onPress={() => handleSave(onClose, () => router.back())}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </>
          )}
        </Pressable>
      </View>

      <ConfirmModal {...confirmProps} />
    </ScreenContainer>
  );
}
