import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import type { SubGroup, SubGroupTipo } from '../hooks/usePlantationDetail';
import SubGroupStateChip from '../components/SubGroupStateChip';
import SubgrupoForm from '../components/SubgrupoForm';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import TreeIcon from '../components/TreeIcon';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { getDisplayName } from '../hooks/useUserNames';
import ConfirmModal from '../components/ConfirmModal';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import ScreenContainer from '../components/ScreenContainer';
import PlantationDetailHeader from '../components/PlantationDetailHeader';
import { usePlantationDetail } from '../hooks/usePlantationDetail';
import OrangeDot from '../components/OrangeDot';

export default function PlantationDetailScreen() {
  const { id: plantacionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const routePrefix = useRoutePrefix();
  const pid = plantacionId ?? '';

  const {
    plantationRows,
    filteredSubgroups,
    nnCountMap,
    treeCountMap,
    totalNN,
    subgroupEstadoCounts,
    estadoLoaded,
    isFinalizada,
    userNames,
    deletingId,
    editingSubGroup,
    subgroupFilter,
    confirmProps,
    confirmShow,
    userId,
    setSubgroupFilter,
    setEditingSubGroup,
    handleLongPress,
    handleDeleteSubGroup,
    handleEditSubmit,
  } = usePlantationDetail(pid);

  const { blockedByNN } = usePendingSyncCount(plantacionId);

  const subgroupFilterConfigs = [
    { key: 'activa', label: 'Activas', count: subgroupEstadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: subgroupEstadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  useEffect(() => {
    const lugar = plantationRows?.[0]?.lugar;
    if (lugar) navigation.setOptions({ title: lugar, headerTitleAlign: 'center' });
  }, [plantationRows, navigation]);

  function handleSubGroupPress(subgroup: SubGroup) {
    router.push(`/${routePrefix}/plantation/subgroup/${subgroup.id}?plantacionId=${plantacionId}&subgrupoCodigo=${subgroup.codigo}&subgrupoNombre=${encodeURIComponent(subgroup.nombre)}` as any);
  }

  function renderSubGroup({ item, index }: { item: SubGroup; index: number }) {
    const nnCount = nnCountMap.get(item.id) ?? 0;
    const treeCount = treeCountMap.get(item.id) ?? 0;
    const isOwner = userId ? item.usuarioCreador === userId : false;
    const showDelete = isOwner && item.estado === 'activa';
    const creatorName = userNames[item.usuarioCreador];

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(250)}>
        <Pressable
          testID={`subgroup-card-${item.id}`}
          style={({ pressed }) => [styles.card, !isOwner && styles.cardOtherUser, item.estado !== 'activa' && styles.cardReadOnly, pressed && styles.cardPressed]}
          onPress={() => handleSubGroupPress(item)}
          onLongPress={() => handleLongPress(item)}
        >
          <View style={styles.cardRow}>
            <Text style={[styles.cardName, !isOwner && styles.cardNameOther]} numberOfLines={1}>{item.nombre}</Text>
            {item.pendingSync && <OrangeDot style={styles.pendingSyncDot} />}
            {nnCount > 0 && <View style={styles.nnBadge}><Text style={styles.nnBadgeText}>{nnCount} N/N</Text></View>}
            <SubGroupStateChip estado={item.estado} />
            <Text style={styles.treeCountText}>{treeCount}</Text>
            <TreeIcon size={13} />
            {showDelete && (
              <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteSubGroup(item); }} hitSlop={8} style={styles.deleteCardButton} disabled={deletingId === item.id}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </Pressable>
            )}
          </View>
          {creatorName && <Text style={styles.cardCreator}>{getDisplayName(creatorName)}</Text>}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <ScreenContainer withTexture>
      <PlantationDetailHeader
        blockedByNN={blockedByNN}
        totalNN={totalNN}
        estadoLoaded={estadoLoaded}
        isFinalizada={isFinalizada}
        subgroupFilter={subgroupFilter}
        subgroupFilterConfigs={subgroupFilterConfigs as any}
        onResolveAllNN={() => router.push(`/${routePrefix}/plantation/subgroup/nn-resolution?plantacionId=${plantacionId}` as any)}
        onToggleFilter={(key) => setSubgroupFilter(prev => prev === key ? null : key)}
      />

      <FlatList
        testID="subgroup-list"
        data={filteredSubgroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay subgrupos aun</Text><Text style={styles.emptySubtext}>Toca &quot;+&quot; para crear el primero</Text></View>}
        renderItem={renderSubGroup}
      />

      {estadoLoaded && !isFinalizada && (
        <View style={styles.fabContainer}>
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => router.push(`/${routePrefix}/plantation/nuevo-subgrupo?plantacionId=${plantacionId}` as any)}
          >
            <Text style={styles.fabLabel}>+ Nuevo subgrupo</Text>
          </Pressable>
        </View>
      )}

      <ConfirmModal {...confirmProps} />

      <Modal visible={!!editingSubGroup} animationType="slide" transparent onRequestClose={() => setEditingSubGroup(null)}>
        <KeyboardAvoidingView style={styles.editModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.editModalDismiss} onPress={() => setEditingSubGroup(null)} />
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Editar subgrupo</Text>
            {editingSubGroup && (
              <SubgrupoForm
                mode="edit"
                plantacionId={pid}
                initialValues={{ nombre: editingSubGroup.nombre, codigo: editingSubGroup.codigo, tipo: editingSubGroup.tipo as SubGroupTipo }}
                onSubmit={(values) => handleEditSubmit(values)}
                onCancel={() => setEditingSubGroup(null)}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xl, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  cardOtherUser: { backgroundColor: colors.otherUserBg, opacity: 0.55 },
  cardReadOnly: { opacity: 0.75 },
  cardPressed: { opacity: 0.7 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardName: { fontSize: fontSize.xl, fontFamily: fonts.bold, color: colors.text, flex: 1 },
  cardNameOther: { color: colors.textMuted, fontFamily: fonts.medium },
  cardCreator: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: colors.textMuted, marginTop: spacing.xs },
  treeCountText: { fontSize: fontSize.base, color: colors.plantation, fontFamily: fonts.semiBold },
  deleteCardButton: { padding: 2 },
  pendingSyncDot: { marginLeft: spacing.xs },
  nnBadge: { backgroundColor: colors.secondaryYellowLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.secondaryYellowMedium },
  nnBadgeText: { color: colors.secondaryYellowDark, fontSize: fontSize.xs, fontFamily: fonts.bold },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: fontSize.xl, color: colors.textSecondary, fontFamily: fonts.semiBold },
  emptySubtext: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.sm, fontFamily: fonts.regular },
  fabContainer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  fab: { backgroundColor: colors.plantationHeaderBg, paddingVertical: spacing.xl, borderRadius: borderRadius.lg, alignItems: 'center', elevation: 4, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  fabPressed: { opacity: 0.85 },
  fabLabel: { color: colors.white, fontSize: fontSize.xl, fontFamily: fonts.bold },
  editModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  editModalDismiss: { flex: 1 },
  editModalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.round, borderTopRightRadius: borderRadius.round, padding: spacing.xxxl, paddingBottom: spacing['6xl'] },
  editModalTitle: { fontSize: fontSize.title, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.xxxl },
});
