import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { db } from '../../src/database/client';
import { plantations } from '../../src/database/schema';
import { desc } from 'drizzle-orm';

export default function TecnicoPlantaciones() {
  const router = useRouter();
  const { data: plantationList } = useLiveQuery(
    db.select().from(plantations).orderBy(desc(plantations.createdAt))
  );

  if (!plantationList || plantationList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay plantaciones disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plantationList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/(tecnico)/plantation/${item.id}`)}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>{item.lugar}</Text>
              <Text style={styles.cardSubtitle}>{item.periodo}</Text>
              <View style={styles.estadoChip}>
                <Text style={styles.estadoLabel}>{item.estado.toUpperCase()}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2d6a2d',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardInner: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  estadoChip: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  estadoLabel: {
    fontSize: 12,
    color: '#2d6a2d',
    fontWeight: '600',
  },
});
