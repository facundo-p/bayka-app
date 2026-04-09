/**
 * useAssignTechnicians — all data logic for AssignTechniciansScreen.
 *
 * Encapsulates technician list loading, assignment toggle, and save logic.
 * Loads all org technicians from Supabase; assigned techs from local SQLite.
 */
import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useConfirm } from './useConfirm';
import { showInfoDialog, showConfirmDialog } from '../utils/alertHelpers';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { getAllTechnicians, getAssignedTechnicians, getTechnicianUnsyncedSubgroupCount } from '../queries/adminQueries';
import { assignTechnicians } from '../repositories/PlantationRepository';
import { colors } from '../theme';

type TechnicianItem = {
  id: string;
  nombre: string;
  assigned: boolean;
};

export function useAssignTechnicians(plantacionId: string | undefined) {
  const confirm = useConfirm();

  const [items, setItems] = useState<TechnicianItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [organizacionId, setOrganizacionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data?.user?.id) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('organizacion_id')
          .eq('id', data.user.id)
          .single();
        if (profile?.organizacion_id) {
          setOrganizacionId(profile.organizacion_id);
        }
      })
      .catch(console.error);
  }, []);

  const loadData = useCallback(async () => {
    if (!plantacionId || !organizacionId) return;
    setLoading(true);
    setNetworkError(false);
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        setNetworkError(true);
        setLoading(false);
        return;
      }

      const [allTechs, assigned] = await Promise.all([
        getAllTechnicians(organizacionId),
        getAssignedTechnicians(plantacionId),
      ]);

      const assignedSet = new Set(assigned.map((a) => a.userId));
      const merged: TechnicianItem[] = allTechs.map((tech) => ({
        id: tech.id,
        nombre: tech.nombre,
        assigned: assignedSet.has(tech.id),
      }));

      merged.sort((a, b) => {
        if (a.assigned && !b.assigned) return -1;
        if (!a.assigned && b.assigned) return 1;
        return a.nombre.localeCompare(b.nombre);
      });

      setItems(merged);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron cargar los técnicos.', 'alert-circle-outline', colors.danger);
    } finally {
      setLoading(false);
    }
  }, [plantacionId, organizacionId]);

  useEffect(() => {
    if (organizacionId) loadData();
  }, [loadData, organizacionId]);

  async function handleToggle(id: string, newValue: boolean) {
    if (!newValue && plantacionId) {
      const unsyncedCount = await getTechnicianUnsyncedSubgroupCount(plantacionId, id);
      if (unsyncedCount > 0) {
        showConfirmDialog(
          confirm.show,
          'Tecnico con subgrupos pendientes',
          `Este tecnico tiene ${unsyncedCount} subgrupo${unsyncedCount > 1 ? 's' : ''} sin sincronizar. Si lo desasignas, solo el podra sincronizarlos. Continuar?`,
          'Desasignar',
          () => {
            setItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, assigned: false } : item))
            );
          },
          { icon: 'warning-outline', iconColor: colors.secondary, style: 'danger' },
        );
        return;
      }
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, assigned: newValue } : item))
    );
  }

  async function handleSave(onClose?: () => void, onBack?: () => void) {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const assignedIds = items.filter((i) => i.assigned).map((i) => i.id);
      await assignTechnicians(plantacionId, assignedIds);
      if (onClose) onClose();
      else if (onBack) onBack();
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron asignar los técnicos.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  const assignedCount = items.filter((i) => i.assigned).length;

  return {
    items,
    loading,
    saving,
    networkError,
    assignedCount,
    confirmProps: confirm.confirmProps,
    loadData,
    handleToggle,
    handleSave,
  };
}
