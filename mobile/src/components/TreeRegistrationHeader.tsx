import { View, Text } from 'react-native';
import CustomHeader from './CustomHeader';
import TreeIcon from './TreeIcon';
import { treeRegistrationHeaderStyles as styles } from './TreeRegistrationHeader.styles';

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
