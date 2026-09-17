/**
 * ParcelasScreen — lista las parcelas de una plantación.
 * Tap → grupos scoped por parcela; long-press → editar; header `+` → crear.
 */
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenContainer from '../components/ScreenContainer';
import CustomHeader from '../components/CustomHeader';
import HeaderActionButton from '../components/HeaderActionButton';
import ParcelaRow from '../components/ParcelaRow';
import ParcelaFormModal from '../components/ParcelaFormModal';
import NNResolutionBanner from '../components/NNResolutionBanner';
import { useParcelas } from '../hooks/useParcelas';
import { usePlantationDetail } from '../hooks/usePlantationDetail';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useScreenBack } from '../hooks/useScreenBack';
import { colors, iconSizes } from '../theme';
import { parcelasScreenStyles as styles } from './ParcelasScreen.styles';
import type { ParcelaWithStats } from '../queries/parcelaQueries';
import type { Parcela } from '../repositories/ParcelaRepository';

type FormModalState = { mode: 'create'; parcela: null } | { mode: 'edit'; parcela: Parcela } | null;

function EmptyState({ onCreate, isArchivada }: { onCreate: (() => void) | null; isArchivada: boolean }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={44} color={colors.plantationDark} />
      </View>
      <Text style={styles.emptyTitle}>Esta plantación todavía no tiene parcelas</Text>
      <Text style={styles.emptySubtitle}>
        {onCreate
          ? 'Creá la primera parcela para empezar a organizar grupos y árboles.'
          : `La plantación está ${isArchivada ? 'archivada' : 'finalizada'}: no se pueden agregar parcelas.`}
      </Text>
      {onCreate && (
        <Pressable
          style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
          onPress={onCreate}
          accessibilityLabel="Crear primera parcela"
        >
          <Ionicons name="add" size={iconSizes.action} color={colors.white} />
          <Text style={styles.emptyCtaText}>Crear primera parcela</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ParcelasScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  const pid = plantacionId ?? '';
  const { parcelas } = useParcelas(pid);
  const { plantationRows, plantacionEditable, isArchivada, totalNN } = usePlantationDetail(pid);
  const { blockedByNN } = usePendingSyncCount(pid);
  const lugar = plantationRows?.[0]?.lugar ?? '';
  // Finalizada o archivada: tampoco se editan ni se borran sus parcelas, que el
  // push sube como tombstone (#469, #477).
  const goBack = useScreenBack(`/${routePrefix}/plantaciones`);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);

  function openCreate() {
    if (!plantacionEditable) return;
    setFormModalState({ mode: 'create', parcela: null });
  }
  function openEdit(p: ParcelaWithStats) {
    if (!plantacionEditable) return;
    setFormModalState({ mode: 'edit', parcela: p });
  }
  function closeModal() { setFormModalState(null); }

  function navigateToGrupos(parcelaId: string) {
    router.push(`/${routePrefix}/plantation/${pid}?parcelaId=${parcelaId}` as any);
  }

  function openNNResolution() {
    router.push(`/${routePrefix}/plantation/subgroup/nn-resolution?plantacionId=${pid}` as any);
  }

  function renderItem({ item }: { item: ParcelaWithStats }) {
    return (
      <ParcelaRow
        parcela={item}
        onPress={() => navigateToGrupos(item.id)}
        onLongPress={plantacionEditable ? () => openEdit(item) : undefined}
      />
    );
  }

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title="Parcelas"
        subtitle={lugar || undefined}
        onBack={goBack}
        rightElement={
          plantacionEditable ? (
            <HeaderActionButton
              icon="add"
              onPress={openCreate}
              accessibilityLabel="Nueva parcela"
            />
          ) : undefined
        }
      />
      <NNResolutionBanner totalNN={totalNN} blockedByNN={blockedByNN} onResolve={openNNResolution} />
      {parcelas.length === 0 ? (
        <EmptyState onCreate={plantacionEditable ? openCreate : null} isArchivada={isArchivada} />
      ) : (
        <FlatList
          data={parcelas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
        />
      )}
      {formModalState && (
        <ParcelaFormModal
          visible
          mode={formModalState.mode}
          plantacionId={pid}
          parcela={formModalState.mode === 'edit' ? formModalState.parcela : null}
          onClose={closeModal}
        />
      )}
    </ScreenContainer>
  );
}
