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
 * Cuerpo de formulario keyboard-aware con footer fijo de acciones. Extrae el
 * patrón correcto de ParcelaFormModal (el body sube y el footer flota sobre el
 * teclado) para reusarlo en todas las pantallas de creación (#89): con el
 * teclado abierto el botón de acción sigue visible y tocable.
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
