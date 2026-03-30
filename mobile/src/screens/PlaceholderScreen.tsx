import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
}

export default function PlaceholderScreen({ title, subtitle = 'Proximamente disponible' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.heading,
    fontFamily: fonts.heading,
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSubtle,
    marginTop: spacing.md,
  },
});
