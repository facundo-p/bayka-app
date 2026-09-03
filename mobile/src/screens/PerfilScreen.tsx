import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useProfileData } from '../hooks/useProfileData';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import React from 'react';
import { perfilScreenStyles as styles } from './PerfilScreen.styles';

interface Props {
  roleLabel: string;
}

export default function PerfilScreen({ roleLabel }: Props) {
  const { signOut } = useAuth();
  const { profile, loading } = useProfileData();

  return (
    <ScreenContainer withTexture>
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <TouchableOpacity onPress={signOut} style={styles.logoutLink}>
          <Text style={styles.logoutLinkText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </Animated.View>
      </View>
    </ScreenContainer>
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
