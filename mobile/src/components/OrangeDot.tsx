import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme';

type Props = { size?: number; style?: ViewStyle };

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.syncPending,
  },
});

export default function OrangeDot({ size = 8, style }: Props) {
  const sizeStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.dot, sizeStyle, style]} />
  );
}
