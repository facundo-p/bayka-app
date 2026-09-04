import { View, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { useKeyboardAwareModal } from '../hooks/useKeyboardAwareModal';
import { keyboardAwareFormBodyStyles as styles } from './KeyboardAwareFormBody.styles';

interface Props {
  children: React.ReactNode;
  /** Botonera de acciones; queda fija y flota sobre el teclado. */
  footer: React.ReactNode;
  scrollContentStyle?: StyleProp<ViewStyle>;
}

/**
 * Cuerpo de formulario keyboard-aware con footer fijo: el body sube y el
 * footer queda flotando sobre el teclado (#89).
 */
export default function KeyboardAwareFormBody({ children, footer, scrollContentStyle }: Props) {
  const keyboard = useKeyboardAwareModal();
  return (
    <View style={[styles.flex, keyboard.bodyPadding]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <View style={[styles.footer, keyboard.footerPadding]}>{footer}</View>
    </View>
  );
}
