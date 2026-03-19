import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { colors, fontSize, borderRadius, spacing } from '../theme';

interface Props {
  roleLabel: string;
}

export default function PerfilScreen({ roleLabel }: Props) {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.label}>{roleLabel}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing['4xl'],
  },
  title: {
    fontSize: fontSize.heading,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.base,
    color: colors.textSubtle,
    marginBottom: spacing['6xl'],
  },
  logoutButton: {
    backgroundColor: colors.dangerText,
    paddingVertical: 14,
    paddingHorizontal: spacing['5xl'],
    borderRadius: borderRadius.lg,
  },
  logoutText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
});
