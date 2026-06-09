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
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Group, GroupTipo } from '../hooks/usePlantationDetail';
import CustomHeader from '../components/CustomHeader';
import HeaderActionButton from '../components/HeaderActionButton';
import GroupStateChip from '../components/GroupStateChip';
import GrupoForm from '../components/GrupoForm';
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
  const { id: plantacionId, parcelaId } = useLocalSearchParams<{ id: string; parcelaId?: string }>();
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  const pid = plantacionId ?? '';

  const {
    plantationRows,
    parcela,
    filteredGroups,
    nnCountMap,
    treeCountMap,
    totalNN,
    groupEstadoCounts,
    estadoLoaded,
    isFinalizada,
    userNames,
    deletingId,
    editingGroup,
    groupFilter,
    confirmProps,
    confirmShow,
    userId,
    setGroupFilter,
    setEditingGroup,
    handleLongPress,
    handleDeleteGroup,
    handleEditSubmit,
  } = usePlantationDetail(pid, parcelaId);

  const { blockedByNN } = usePendingSyncCount(plantacionId);

  const groupFilterConfigs = [
    { key: 'activa', label: 'Activas', count: groupEstadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: groupEstadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  // Defensive navigation — without parcelaId we cannot scope the screen.
  // Redirect to ParcelasScreen so the user picks one explicitly.
  useEffect(() => {
    if (!parcelaId && pid) {
      router.replace(`/${routePrefix}/plantation/parcelas?plantacionId=${pid}` as any);
    }
  }, [parcelaId, pid, router, routePrefix]);

  if (!parcelaId) return null;

  // Title shows "{parcela.nombre} — Grupos"; fallback to plantation lugar.
  const headerTitle = parcela?.nombre
    ? `${parcela.nombre} — Grupos`
    : (plantationRows?.[0]?.lugar ?? 'Grupos');
  // El "+" para crear grupo solo se muestra si la plantación no está finalizada.
  // parcelaId ya es truthy acá (hay un early-return arriba si falta).
  const canAddGroup = estadoLoaded && !isFinalizada;

  function handleGroupPress(subgroup: Group) {
    router.push(`/${routePrefix}/plantation/subgroup/${subgroup.id}?plantacionId=${plantacionId}&parcelaId=${parcelaId}&grupoCodigo=${subgroup.codigo}&grupoNombre=${encodeURIComponent(subgroup.nombre)}` as any);
  }

  function renderGroup({ item, index }: { item: Group; index: number }) {
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
          onPress={() => handleGroupPress(item)}
          onLongPress={() => handleLongPress(item)}
        >
          <View style={styles.cardRow}>
            <Text style={[styles.cardName, !isOwner && styles.cardNameOther]} numberOfLines={1}>{item.nombre}</Text>
            {item.pendingSync && <OrangeDot style={styles.pendingSyncDot} />}
            {nnCount > 0 && <View style={styles.nnBadge}><Text style={styles.nnBadgeText}>{nnCount} N/N</Text></View>}
            <GroupStateChip estado={item.estado} />
            <Text style={styles.treeCountText}>{treeCount}</Text>
            <TreeIcon size={13} />
            {showDelete && (
              <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteGroup(item); }} hitSlop={8} style={styles.deleteCardButton} disabled={deletingId === item.id}>
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
      <CustomHeader
        title={headerTitle}
        onBack={() => router.navigate(`/${routePrefix}/plantation/parcelas?plantacionId=${pid}` as any)}
        rightElement={
          canAddGroup ? (
            <HeaderActionButton
              testID="grupos-header-add"
              icon="add"
              onPress={() => router.push(`/${routePrefix}/plantation/nuevo-grupo?plantacionId=${pid}&parcelaId=${parcelaId}` as any)}
              accessibilityLabel="Nuevo grupo"
            />
          ) : undefined
        }
      />
      <PlantationDetailHeader
        blockedByNN={blockedByNN}
        totalNN={totalNN}
        estadoLoaded={estadoLoaded}
        isFinalizada={isFinalizada}
        groupFilter={groupFilter}
        groupFilterConfigs={groupFilterConfigs as any}
        onResolveAllNN={() => router.push(`/${routePrefix}/plantation/subgroup/nn-resolution?plantacionId=${plantacionId}` as any)}
        onToggleFilter={(key) => setGroupFilter(prev => prev === key ? null : key)}
      />

      <FlatList
        testID="subgroup-list"
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay grupos aún</Text><Text style={styles.emptySubtext}>Toca &quot;+&quot; para crear el primero</Text></View>}
        renderItem={renderGroup}
      />

      <ConfirmModal {...confirmProps} />

      <Modal visible={!!editingGroup} animationType="slide" transparent onRequestClose={() => setEditingGroup(null)}>
        <KeyboardAvoidingView style={styles.editModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.editModalDismiss} onPress={() => setEditingGroup(null)} />
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Editar grupo</Text>
            {editingGroup && (
              <GrupoForm
                mode="edit"
                plantacionId={pid}
                initialValues={{ nombre: editingGroup.nombre, codigo: editingGroup.codigo, tipo: editingGroup.tipo as GroupTipo }}
                onSubmit={(values) => handleEditSubmit(values)}
                onCancel={() => setEditingGroup(null)}
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
  cardName: { fontSize: fontSize.xl, fontFamily: fonts.heading, color: colors.text, flex: 1 },
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
  editModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  editModalDismiss: { flex: 1 },
  editModalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.round, borderTopRightRadius: borderRadius.round, padding: spacing.xxxl, paddingBottom: spacing['6xl'] },
  editModalTitle: { fontSize: fontSize.title, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.xxxl },
});
