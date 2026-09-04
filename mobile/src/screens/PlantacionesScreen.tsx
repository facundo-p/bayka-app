import { View, Text, FlatList } from 'react-native';
import { colors } from '../theme';
import { plantacionesScreenStyles as styles } from './PlantacionesScreen.styles';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import ExpandablePlantationCard from '../components/ExpandablePlantationCard';
import FilterCards from '../components/FilterCards';
import CustomHeader from '../components/CustomHeader';
import HeaderActionButton from '../components/HeaderActionButton';
import TexturedBackground from '../components/TexturedBackground';
import PlantacionesModals from '../components/PlantacionesModals';
import { usePlantacionesScreen } from '../hooks/usePlantacionesScreen';
import type { Plantation } from '../components/PlantationConfigCard';

export default function PlantacionesScreen() {
  const s = usePlantacionesScreen();

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: s.estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: s.estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  return (
    <TexturedBackground>
      <CustomHeader
        title={s.headerTitle}
        subtitle={s.headerSubtitle}
        rightElement={
          <View style={styles.headerButtons}>
            {s.isOnline && (
              <HeaderActionButton
                icon="sync-outline"
                onPress={() => s.showSyncConfirm('global')}
                variant={s.hasAnyPending ? 'pending' : 'default'}
                disabled={s.isSyncing}
                accessibilityLabel="Sincronizar todas las plantaciones"
              />
            )}
            <HeaderActionButton
              icon="download-outline"
              onPress={() => { if (s.isOnline) s.router.push(`/${s.routePrefix}/plantation/catalog` as any); }}
              variant={s.isOnline ? 'default' : 'offline'}
              disabled={!s.isOnline}
              accessibilityLabel="Gestionar plantaciones descargadas"
            />
            {s.isAdmin && (
              <HeaderActionButton icon="add" onPress={() => s.setShowCreateModal(true)} accessibilityLabel="Nueva plantacion" />
            )}
          </View>
        }
      />

      {s.plantationList && s.plantationList.length > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.filterBar}>
            <FilterCards
              filters={filterConfigs}
              activeFilter={s.activeFilter}
              onToggleFilter={(key) => s.setActiveFilter((prev: string | null) => prev === key ? null : key)}
            />
          </Animated.View>

          <FlatList
            data={s.filteredList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            testID="plantaciones-list"
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(index * 80).duration(300)}
                layout={LinearTransition.duration(220)}
                testID={`plantation-card-${item.id}`}
              >
                <ExpandablePlantationCard
                  plantacionId={item.id}
                  expanded={s.expandedPlantationId === item.id}
                  onToggleExpanded={() => s.handleToggleExpand(item.id)}
                  onParcelaPress={(parcelaId) => s.handleParcelaInlinePress(item.id, parcelaId)}
                  onParcelaLongPress={(p) => s.handleParcelaInlineLongPress(item.id, p)}
                  cardProps={{
                    lugar: item.lugar,
                    periodo: item.periodo,
                    totalCount: s.totalCountMap.get(item.id) ?? 0,
                    syncedCount: s.syncedCountMap.get(item.id) ?? 0,
                    todayCount: s.todayCountMap.get(item.id) ?? 0,
                    pendingSync: s.pendingSyncMap.get(item.id) ?? 0,
                    estado: item.estado,
                    hasPendingSync: (s.pendingSyncBoolMap.get(item.id) ?? 0) > 0,
                    nnCount: s.nnCountMap.get(item.id) ?? 0,
                    visibleInApp: item.visibleInApp,
                    onPress: () => s.router.push(`/${s.routePrefix}/plantation/parcelas?plantacionId=${item.id}` as any),
                    // Long-press abre la edición, como en las demás cards (#94).
                    onLongPress: s.isAdmin ? () => s.handleEditPress(item as Plantation) : undefined,
                    onDelete: () => s.handleDeletePlantation(item.id),
                    isAdmin: s.isAdmin,
                    // Sync por plantación en la card (#94); oculto sin conexión
                    // o con un sync en curso, como el botón global del header.
                    onSync: s.isOnline && !s.isSyncing ? () => s.showSyncConfirm('plantation', item.id) : undefined,
                    // El gear es admin-only: sin el ítem Sincronizar (movido a
                    // la card), el menú de un técnico quedaría vacío.
                    onGear: s.isAdmin ? () => s.handleOpenGear(item as Plantation) : undefined,
                  }}
                />
              </Animated.View>
            )}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay plantaciones disponibles</Text>
          <Text style={styles.emptySubtext}>Las plantaciones asignadas apareceran aqui</Text>
        </View>
      )}

      {/* All modal state/handlers come from usePlantacionesScreen; the hook's
          return shape is a superset of PlantacionesModals' props. */}
      <PlantacionesModals {...s} />
    </TexturedBackground>
  );
}
