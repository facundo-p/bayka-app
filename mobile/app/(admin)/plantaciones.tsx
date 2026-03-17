import { View, Text, StyleSheet } from 'react-native';

export default function AdminPlantaciones() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plantaciones</Text>
      <Text style={styles.subtitle}>Próximamente disponible</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2d6a2d' },
  subtitle: { fontSize: 14, color: '#777', marginTop: 8 },
});
