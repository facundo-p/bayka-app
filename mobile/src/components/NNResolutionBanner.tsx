/**
 * NNResolutionBanner — acceso a la resolución de N/N de una plantación.
 * Plantation-wide: se muestra al entrar a la plantación (listado de parcelas).
 * Si hay grupos finalizados con N/N pendientes, lo avisa (no navega: `blockedByNN`).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { nnResolutionBannerStyles as styles } from './NNResolutionBanner.styles';

type Props = {
  totalNN: number;
  blockedByNN: number;
  onResolve: () => void;
};

export default function NNResolutionBanner({ totalNN, blockedByNN, onResolve }: Props) {
  if (totalNN === 0 && blockedByNN === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.banner, totalNN > 0 && pressed && styles.bannerPressed]}
        onPress={totalNN > 0 ? onResolve : undefined}
        disabled={totalNN === 0}
      >
        <Ionicons name="alert-circle-outline" size={18} color={colors.secondary} />
        <View style={styles.content}>
          {totalNN > 0 && (
            <Text style={styles.text}>
              Resolver {totalNN} N/N pendiente{totalNN > 1 ? 's' : ''}
            </Text>
          )}
          {blockedByNN > 0 && (
            <Text style={styles.blockedText}>
              {blockedByNN} grupo{blockedByNN > 1 ? 's' : ''} finalizado{blockedByNN > 1 ? 's' : ''} con N/N pendientes
            </Text>
          )}
        </View>
        {totalNN > 0 && <Ionicons name="chevron-forward" size={16} color={colors.secondary} />}
      </Pressable>
    </View>
  );
}
