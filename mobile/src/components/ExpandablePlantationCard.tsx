import React from 'react';
import PlantationCard from './PlantationCard';
import { useParcelas } from '../hooks/useParcelas';
import type { ParcelaWithStats } from '../queries/parcelaQueries';

/**
 * ExpandablePlantationCard — wrapper that pulls parcelas per plantation via
 * `useParcelas` so `PlantationCard` can render "Parcelas: N" and the inline
 * expanded list.
 *
 * `useParcelas` is invoked unconditionally to honor the Rules of Hooks; the
 * cost is one indexed query per card. If scroll FPS regresses on long lists,
 * pivot to a lightweight `useParcelasCount` hook for collapsed cards.
 */
type Props = {
  plantacionId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onParcelaPress: (parcelaId: string) => void;
  onParcelaLongPress: (parcela: ParcelaWithStats) => void;
  // Pass-through to PlantationCard
  cardProps: Omit<
    React.ComponentProps<typeof PlantationCard>,
    'parcelasCount' | 'parcelas' | 'expanded' | 'onToggleExpanded' | 'onParcelaPress' | 'onParcelaLongPress'
  >;
};

export default function ExpandablePlantationCard({
  plantacionId,
  expanded,
  onToggleExpanded,
  onParcelaPress,
  onParcelaLongPress,
  cardProps,
}: Props) {
  const { parcelas } = useParcelas(plantacionId);
  return (
    <PlantationCard
      {...cardProps}
      parcelasCount={parcelas.length}
      parcelas={expanded ? parcelas : undefined}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
      onParcelaPress={onParcelaPress}
      onParcelaLongPress={onParcelaLongPress}
    />
  );
}
