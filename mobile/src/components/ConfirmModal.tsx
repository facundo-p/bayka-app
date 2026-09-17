import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import BaseModal from './BaseModal';
import { confirmModalStyles as styles } from './ConfirmModal.styles';

export type ConfirmModalButton = {
  label: string;
  onPress: () => void;
  style?: 'primary' | 'danger' | 'cancel';
  icon?: string;
};

type Props = {
  visible: boolean;
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
  onDismiss: () => void;
};

export default function ConfirmModal({
  visible,
  icon,
  iconColor,
  title,
  message,
  buttons,
  onDismiss,
}: Props) {
  return (
    <BaseModal
      visible={visible}
      onRequestClose={onDismiss}
      dismissOnBackdrop
      cardStyle={styles.card}
    >
      {icon && (
        <View style={[styles.iconCircle, { backgroundColor: (iconColor ?? colors.primary) + '18' }]}>
          <Ionicons name={icon as any} size={28} color={iconColor ?? colors.primary} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttonGroup}>
        {buttons.map((btn, i) => {
          const btnStyle = btn.style ?? 'primary';
          const isCancel = btnStyle === 'cancel';
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.button,
                isCancel ? styles.buttonCancel : btnStyle === 'danger' ? styles.buttonDanger : styles.buttonPrimary,
                pressed && { opacity: 0.8 },
              ]}
              onPress={btn.onPress}
            >
              {btn.icon && (
                <Ionicons
                  name={btn.icon as any}
                  size={16}
                  color={isCancel ? colors.textMuted : colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={[styles.buttonText, isCancel && styles.buttonTextCancel]}>
                {btn.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BaseModal>
  );
}
