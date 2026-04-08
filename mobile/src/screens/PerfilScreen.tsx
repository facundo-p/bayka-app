import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useProfileData } from '../hooks/useProfileData';
import { useNetStatus } from '../hooks/useNetStatus';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, borderRadius, spacing, fonts } from '../theme';
import TexturedBackground from '../components/TexturedBackground';

interface Props {
  roleLabel: string;
}

export default function PerfilScreen({ roleLabel }: Props) {
  const { signOut } = useAuth();
  const { profile, loading } = useProfileData();
  const { isOnline } = useNetStatus();

  return (
    <TexturedBackground>
      <View style={styles.innerContainer}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
        {/* Avatar placeholder: circle with initials */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.nombre
              ? profile.nombre.split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('')
              : '?'}
          </Text>
        </View>

        <Text style={styles.name}>{profile?.nombre ?? 'Cargando...'}</Text>
        <Text style={styles.email}>{profile?.email ?? ''}</Text>

        <View style={styles.divider} />

        <ProfileRow label="Rol" value={roleLabel} icon="pricetag-outline" />
        <ProfileRow
          label="Organización"
          value={profile?.organizacionNombre ?? (loading ? 'Cargando...' : '-')}
          icon="business-outline"
        />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Conexión</Text>
          <View style={styles.statusValue}>
            <Ionicons
              name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={16}
              color={isOnline ? colors.online : colors.offline}
            />
            <Text style={[styles.statusText, { color: isOnline ? colors.online : colors.offline }]}>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <TouchableOpacity onPress={signOut} style={styles.logoutLink}>
          <Text style={styles.logoutLinkText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </Animated.View>
      </View>
    </TexturedBackground>
  );
}

function ProfileRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <View style={styles.profileValueRow}>
        <Text style={styles.profileValue}>{value}</Text>
        {icon && (
          <Ionicons name={icon as any} size={16} color={colors.textMuted} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
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
    fontFamily: fonts.bold,
  },
  name: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  profileValue: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  profileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
  },
  statusLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
  },
  logoutLink: {
    marginTop: spacing['5xl'],
    padding: spacing.xl,
  },
  logoutLinkText: {
    color: colors.danger,
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
  },
});
