import { StyleSheet } from 'react-native';
import { colors, borderRadius, headerActionButton } from '../theme';

export const headerActionButtonStyles = StyleSheet.create({
  button: {
    width: headerActionButton.size,
    height: headerActionButton.size,
    borderRadius: borderRadius.full,
    borderWidth: headerActionButton.borderWidth,
    borderColor: headerActionButton.borderColor,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Estado: el outline base se mantiene; sólo cambia el color del borde.
  borderPending: { borderColor: colors.syncPending },
  borderOffline: { borderColor: colors.offline },
  pressed: { backgroundColor: headerActionButton.pressedFill },
});
