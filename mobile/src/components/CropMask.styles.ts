import { StyleSheet } from 'react-native';
import { colors } from '../theme';

const FRAME_BORDER = 2;

export const cropMaskStyles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: colors.overlay },
  frame: { position: 'absolute', borderWidth: FRAME_BORDER, borderColor: colors.white },
});
