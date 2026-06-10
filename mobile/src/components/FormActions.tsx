import { Text, Pressable, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { formActionsStyles as styles } from './FormActions.styles';

interface Props {
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  loading?: boolean;
  /** Si se omite, el botón de submit ocupa todo el ancho (sin Cancelar). */
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
}

/**
 * Botonera de acciones para formularios de entidad (#89). Va dentro del footer
 * de KeyboardAwareFormBody (una fila). Con onCancel: Cancelar (1) + Submit (2);
 * sin onCancel: Submit a ancho completo. minHeight 44 para accesibilidad.
 */
export default function FormActions({
  submitLabel,
  onSubmit,
  submitDisabled,
  loading,
  onCancel,
  cancelLabel = 'Cancelar',
  cancelDisabled,
}: Props) {
  return (
    <>
      {onCancel && (
        <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={cancelDisabled}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
      )}
      <Pressable
        style={[styles.submitBtn, !onCancel && styles.submitBtnFull, submitDisabled && styles.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitDisabled}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.submitText}>{submitLabel}</Text>
        )}
      </Pressable>
    </>
  );
}
