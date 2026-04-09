import { View, Text, StyleSheet } from 'react-native';
import CustomHeader from './CustomHeader';
import TreeIcon from './TreeIcon';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  treeCount: number;
  unresolvedNN: number;
  onBack: () => void;
}

export default function TreeRegistrationHeader({
  title,
  subtitle,
  treeCount,
  unresolvedNN,
  onBack,
}: Props) {
  return (
    <CustomHeader
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      rightElement={
        <View style={styles.right}>
          <Text testID="tree-count" style={styles.count}>{treeCount}</Text>
          <TreeIcon size={14} />
          {unresolvedNN > 0 && (
            <View style={styles.nnBadge}>
              <Text style={styles.nnText}>{unresolvedNN} N/N</Text>
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  count: {
    color: colors.plantationCountFaded,
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
  },
  nnBadge: {
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
  },
  nnText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontFamily: fonts.bold,
  },
});
