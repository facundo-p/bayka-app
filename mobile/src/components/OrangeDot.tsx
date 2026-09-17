import React from 'react';
import { View, ViewStyle } from 'react-native';
import { orangeDotStyles as styles } from './OrangeDot.styles';

type Props = { size?: number; style?: ViewStyle };

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
