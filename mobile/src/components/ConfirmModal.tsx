import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.card}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    padding: spacing['4xl'],
    marginHorizontal: spacing['5xl'],
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    maxWidth: 340,
    width: '100%',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['4xl'],
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl + 2,
    borderRadius: borderRadius.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonCancel: {
    backgroundColor: colors.background,
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.white,
  },
  buttonTextCancel: {
    color: colors.textMuted,
  },
});
