import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../../../src/database/client';
import { plantations } from '../../../src/database/schema';
import { eq } from 'drizzle-orm';
import { useSubGroupsForPlantation, finalizeSubGroup, canEdit } from '../../../src/repositories/SubGroupRepository';
import type { SubGroup } from '../../../src/repositories/SubGroupRepository';
import SubGroupStateChip from '../../../src/components/SubGroupStateChip';
import { supabase, isSupabaseConfigured } from '../../../src/supabase/client';
import { useNavigation } from 'expo-router';

export default function PlantationSubGroupList() {
  const { id: plantacionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [userId, setUserId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  // Load plantation name for header
  const { data: plantationRows } = useLiveQuery(
    db.select({ lugar: plantations.lugar }).from(plantations).where(eq(plantations.id, plantacionId ?? ''))
  );

  // Load subgroups live
  const { subgroups } = useSubGroupsForPlantation(plantacionId ?? '');

  // Set header title
  useEffect(() => {
    const lugar = plantationRows?.[0]?.lugar;
    if (lugar) {
      navigation.setOptions({ title: lugar });
    }
  }, [plantationRows, navigation]);

  // Resolve userId
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  async function handleFinalizar(subgroup: SubGroup) {
    Alert.alert(
      'Finalizar SubGrupo',
      `¿Estás seguro que deseas finalizar "${subgroup.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizingId(subgroup.id);
            const result = await finalizeSubGroup(subgroup.id);
            setFinalizingId(null);
            if (!result.success && result.error === 'unresolved_nn') {
              Alert.alert(
                'No se puede finalizar',
                `Hay ${result.count} árbol${result.count > 1 ? 'es' : ''} con especie N/N sin resolver. Resolver árboles N/N antes de finalizar.`
              );
            }
          },
        },
      ]
    );
  }

  function handleSubGroupPress(subgroup: SubGroup) {
    if (subgroup.estado !== 'activa') return;
    router.push(
      `/(tecnico)/plantation/subgroup/${subgroup.id}?plantacionId=${plantacionId}&subgrupoCodigo=${subgroup.codigo}`
    );
  }

  function renderSubGroup({ item }: { item: SubGroup }) {
    const isOwner = userId ? canEdit(item, userId) : false;
    const isFinalizing = finalizingId === item.id;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          item.estado === 'activa' && pressed && styles.cardPressed,
          item.estado !== 'activa' && styles.cardReadOnly,
        ]}
        onPress={() => handleSubGroupPress(item)}
        disabled={item.estado !== 'activa'}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitles}>
            <Text style={styles.cardName}>{item.nombre}</Text>
            <Text style={styles.cardCode}>{item.codigo}</Text>
          </View>
          <SubGroupStateChip estado={item.estado} />
        </View>
        <Text style={styles.cardTipo}>{item.tipo === 'linea' ? 'Línea' : 'Parcela'}</Text>
        {isOwner && item.estado === 'activa' && (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.finalizarBtn, isFinalizing && styles.finalizarBtnDisabled]}
              onPress={() => handleFinalizar(item)}
              disabled={isFinalizing}
            >
              {isFinalizing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.finalizarBtnText}>Finalizar</Text>
              )}
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={subgroups as SubGroup[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay SubGrupos aún</Text>
            <Text style={styles.emptySubtext}>Toca "+" para crear el primero</Text>
          </View>
        }
        renderItem={renderSubGroup}
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push(`/(tecnico)/plantation/nuevo-subgrupo?plantacionId=${plantacionId}`)}
      >
        <Text style={styles.fabLabel}>+ Nuevo SubGrupo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2d6a2d',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardReadOnly: {
    borderLeftColor: '#ccc',
    opacity: 0.85,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitles: {
    flex: 1,
    marginRight: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  cardCode: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'monospace',
  },
  cardTipo: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  finalizarBtn: {
    backgroundColor: '#e65100',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  finalizarBtnDisabled: {
    backgroundColor: '#ffb74d',
  },
  finalizarBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    left: 16,
    backgroundColor: '#2d6a2d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
