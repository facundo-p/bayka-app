import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useProfileData } from '../hooks/useProfileData';
import { useNetStatus } from '../hooks/useNetStatus';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, borderRadius, spacing } from '../theme';

interface Props {
  roleLabel: string;
}

export default function PerfilScreen({ roleLabel }: Props) {
  const { signOut } = useAuth();
  const { profile, loading } = useProfileData();
  const { isOnline } = useNetStatus();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Avatar placeholder: circle with initials */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <Text style={styles.name}>{profile?.nombre ?? 'Cargando...'}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>

        <View style={styles.divider} />

        <ProfileRow label="Rol" value={roleLabel} />
        <ProfileRow
          label="Organizacion"
          value={profile?.organizacionNombre ?? (loading ? 'Cargando...' : '-')}
        />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Conexion</Text>
          <View style={styles.statusValue}>
            <Ionicons
              name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={16}
              color={isOnline ? colors.online : colors.offline}
            />
            <Text style={[styles.statusText, { color: isOnline ? colors.online : colors.offline }]}>
              {isOnline ? 'En linea' : 'Sin conexion'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={signOut}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing['4xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSize.heading,
    fontWeight: 'bold',
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginBottom: spacing.xxl,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
  },
  profileLabel: {
    fontSize: fontSize.base,
    color: colors.textSubtle,
  },
  profileValue: {
    fontSize: fontSize.base,
    color: colors.textDark,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
  },
  statusLabel: {
    fontSize: fontSize.base,
    color: colors.textSubtle,
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: colors.dangerText,
    paddingVertical: 14,
    paddingHorizontal: spacing['5xl'],
    borderRadius: borderRadius.lg,
    marginTop: spacing['5xl'],
  },
  logoutText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
});
