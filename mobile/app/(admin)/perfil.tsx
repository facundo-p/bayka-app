import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';

export default function AdminPerfil() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.label}>Administrador</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  label: { fontSize: 14, color: '#777', marginBottom: 40 },
  logoutButton: { backgroundColor: '#c00', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
