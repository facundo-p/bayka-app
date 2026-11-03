/**
 * NNResolutionBanner — acceso a la resolución de N/N de una plantación.
 * Plantation-wide: se muestra al entrar a la plantación (listado de parcelas).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { nnResolutionBannerStyles as styles } from './NNResolutionBanner.styles';

type Props = {
  totalNN: number;
  onResolve: () => void;
};

export default function NNResolutionBanner({ totalNN, onResolve }: Props) {
  if (totalNN === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
        onPress={onResolve}
      >
        <Ionicons name="alert-circle-outline" size={18} color={colors.secondary} />
        <Text style={styles.text}>
          Resolver {totalNN} N/N pendiente{totalNN > 1 ? 's' : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
      </Pressable>
    </View>
  );
}
