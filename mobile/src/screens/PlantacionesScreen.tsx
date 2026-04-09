import { View, Text, FlatList, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PlantationCard from '../components/PlantationCard';
import FilterCards from '../components/FilterCards';
import ScreenHeader from '../components/ScreenHeader';
import TexturedBackground from '../components/TexturedBackground';
import { usePlantaciones } from '../hooks/usePlantaciones';

export default function PlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  const {
    plantationList,
    filteredList,
    estadoCounts,
    activeFilter,
    setActiveFilter,
    showFreshnessBanner,
    refreshing,
    headerTitle,
    isOnline,
    isAdmin,
    syncedCountMap,
    pendingSyncMap,
    todayCountMap,
    totalCountMap,
    handleRefresh,
  } = usePlantaciones();

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  return (
    <TexturedBackground>
      <ScreenHeader
        title={headerTitle}
        rightElement={
          <Pressable
            onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
            disabled={!isOnline}
            hitSlop={8}
            style={({ pressed }) => [
              styles.catalogButton,
              !isOnline && styles.catalogButtonDisabled,
              pressed && isOnline && styles.catalogButtonPressed,
            ]}
            accessibilityLabel="Gestionar plantaciones descargadas"
          >
            <Ionicons name="download-outline" size={18} color={isOnline ? colors.white : colors.offline} />
          </Pressable>
        }
      />

      {showFreshnessBanner && (
        <View style={styles.freshnessBanner}>
          <Text style={styles.freshnessText}>Hay datos nuevos disponibles</Text>
          <TouchableOpacity
            style={styles.freshnessButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.freshnessButtonText}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {plantationList && plantationList.length > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.xl }}>
            <FilterCards
              filters={filterConfigs}
              activeFilter={activeFilter}
              onToggleFilter={(key) => setActiveFilter(prev => prev === key ? null : key)}
            />
          </Animated.View>

          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            testID="plantaciones-list"
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 80).duration(300)} testID={`plantation-card-${item.id}`}>
                <PlantationCard
                  lugar={item.lugar}
                  periodo={item.periodo}
                  totalCount={totalCountMap.get(item.id) ?? 0}
                  syncedCount={syncedCountMap.get(item.id) ?? 0}
                  todayCount={todayCountMap.get(item.id) ?? 0}
                  pendingSync={pendingSyncMap.get(item.id) ?? 0}
                  estado={item.estado}
                  onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
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
    </TexturedBackground>
  );
}

const styles = StyleSheet.create({
  freshnessBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.infoBg, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.info + '30' },
  freshnessText: { flex: 1, fontSize: fontSize.sm, color: colors.info },
  freshnessButton: { backgroundColor: colors.info, paddingHorizontal: spacing.xxl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, marginLeft: spacing.md },
  freshnessButtonText: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.semiBold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted },
  emptySubtext: { fontSize: fontSize.base, color: colors.textLight },
  listContent: { padding: spacing.xxl, gap: spacing.xl },
  catalogButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  catalogButtonDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.offline },
  catalogButtonPressed: { opacity: 0.7 },
});
