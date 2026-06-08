import { View, Text } from 'react-native';
import { getErrorMessage } from '../services/SyncService';
import type { SyncGroupResult, SyncParcelaResult } from '../services/SyncService';
import { failureListStyles as styles } from './FailureList.styles';

type SyncFailable = SyncGroupResult | SyncParcelaResult;
type Failed<T extends SyncFailable> = Extract<T, { success: false }>;

/** Type-guard that narrows a sync result to its failure variant. */
function isFailure<T extends SyncFailable>(result: T): result is Failed<T> {
  return !result.success;
}

interface FailureListProps<T extends SyncFailable> {
  /** Singular noun for the section title (e.g. 'parcela', 'grupo'). */
  label: string;
  results: T[];
  getKey: (failure: Failed<T>) => string;
}

/**
 * Renders a "N <label>(s) con error:" section listing each failed sync result
 * with its human-readable error message. Returns null when there are no
 * failures, so callers can render it unconditionally.
 */
export default function FailureList<T extends SyncFailable>({
  label,
  results,
  getKey,
}: FailureListProps<T>) {
  const failures = results.filter(isFailure);
  if (failures.length === 0) return null;

  return (
    <View style={styles.failureSection}>
      <Text style={styles.failureTitle}>
        {failures.length} {label}{failures.length > 1 ? 's' : ''} con error:
      </Text>
      {failures.map((failure) => (
        <View key={getKey(failure)} style={styles.failureItem}>
          <Text style={styles.failureName}>{failure.nombre}</Text>
          <Text style={styles.failureMessage}>{getErrorMessage(failure.error)}</Text>
        </View>
      ))}
    </View>
  );
}
