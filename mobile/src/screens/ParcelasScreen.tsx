/**
 * ParcelasScreen — lists parcelas for a plantation (PUI-01..06).
 *
 * - Header `+` opens ParcelaFormModal in 'create' (D-17-08).
 * - Tap row → grupos scoped via ?parcelaId=... (PUI-03).
 * - Long-press → ParcelaFormModal in 'edit' (D-17-06).
 * - Empty state with CTA "Crear primera parcela" (D-17-07).
 *
 * CLAUDE.md §9: zero db.* calls — consumes useParcelas + usePlantationDetail.
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
import { useParcelas } from '../hooks/useParcelas';
import { usePlantationDetail } from '../hooks/usePlantationDetail';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { colors, iconSizes } from '../theme';
import { parcelasScreenStyles as styles } from './ParcelasScreen.styles';
import type { ParcelaWithStats } from '../queries/parcelaQueries';
import type { Parcela } from '../repositories/ParcelaRepository';

type FormModalState = { mode: 'create'; parcela: null } | { mode: 'edit'; parcela: Parcela } | null;

function EmptyState({ onCreate }: { onCreate: (() => void) | null }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={44} color={colors.plantationDark} />
      </View>
      <Text style={styles.emptyTitle}>Esta plantación todavía no tiene parcelas</Text>
      <Text style={styles.emptySubtitle}>
        {onCreate
          ? 'Creá la primera parcela para empezar a organizar grupos y árboles.'
          : 'La plantación está finalizada: no se pueden agregar parcelas.'}
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
  const { plantationRows, estadoLoaded, isFinalizada } = usePlantationDetail(pid);
  const lugar = plantationRows?.[0]?.lugar ?? '';
  const canAddParcela = estadoLoaded && !isFinalizada;
  const [formModalState, setFormModalState] = useState<FormModalState>(null);

  function openCreate() { setFormModalState({ mode: 'create', parcela: null }); }
  function openEdit(p: ParcelaWithStats) { setFormModalState({ mode: 'edit', parcela: p }); }
  function closeModal() { setFormModalState(null); }

  function navigateToGrupos(parcelaId: string) {
    router.push(`/${routePrefix}/plantation/${pid}?parcelaId=${parcelaId}` as any);
  }

  function renderItem({ item }: { item: ParcelaWithStats }) {
    return (
      <ParcelaRow
        parcela={item}
        onPress={() => navigateToGrupos(item.id)}
        onLongPress={() => openEdit(item)}
      />
    );
  }

  const title = lugar ? `Parcelas — ${lugar}` : 'Parcelas';

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title={title}
        onBack={() => router.navigate(`/${routePrefix}/plantaciones` as any)}
        rightElement={
          canAddParcela ? (
            <HeaderActionButton
              icon="add"
              onPress={openCreate}
              accessibilityLabel="Nueva parcela"
            />
          ) : undefined
        }
      />
      {parcelas.length === 0 ? (
        <EmptyState onCreate={canAddParcela ? openCreate : null} />
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
