/**
 * useAssignTechnicians — el estado de AssignTechniciansScreen.
 *
 * Los técnicos de la organización salen de Supabase y la asignación del SQLite
 * local; las dos lecturas viven en `queries/adminQueries`, no acá.
 */
import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useConfirm } from './useConfirm';
import { useProfileData } from './useProfileData';
import { showInfoDialog, showConfirmDialog } from '../utils/alertHelpers';
import {
  getTechnicianUnsyncedGroupCount,
  getTechniciansWithAssignment,
  type TecnicoAsignable,
} from '../queries/adminQueries';
import { assignTechnicians } from '../repositories/PlantationRepository';
import { colors } from '../theme';

const ICONO_ERROR = 'alert-circle-outline';
const ICONO_AVISO = 'warning-outline';

/** Lo que pierde el admin si desasigna a alguien con trabajo sin subir. */
export function mensajeDeDesasignacion(gruposPendientes: number): string {
  const plural = gruposPendientes > 1 ? 's' : '';
  return (
    `Este técnico tiene ${gruposPendientes} grupo${plural} sin sincronizar. ` +
    'Si lo desasignás, solo él podrá sincronizarlos. ¿Continuar?'
  );
}

export function useAssignTechnicians(plantacionId: string | undefined) {
  const confirm = useConfirm();
  const { profile } = useProfileData();
  const organizacionId = profile?.organizacionId ?? null;

  const [items, setItems] = useState<TecnicoAsignable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const avisarError = useCallback(
    (error: any, mensajePorDefecto: string) => {
      showInfoDialog(
        confirm.show,
        'Error',
        error?.message ?? mensajePorDefecto,
        ICONO_ERROR,
        colors.danger,
      );
    },
    [confirm.show],
  );

  const loadData = useCallback(async () => {
    if (!plantacionId || !organizacionId) return;
    setLoading(true);
    setNetworkError(false);
    try {
      const { isConnected } = await NetInfo.fetch();
      if (!isConnected) return setNetworkError(true);
      setItems(await getTechniciansWithAssignment(organizacionId, plantacionId));
    } catch (e: any) {
      avisarError(e, 'No se pudieron cargar los técnicos.');
    } finally {
      setLoading(false);
    }
  }, [plantacionId, organizacionId, avisarError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const marcarAsignado = (id: string, assigned: boolean) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, assigned } : item)));

  /** Desasignar avisa si el técnico tiene grupos que solo él puede subir. */
  async function handleToggle(id: string, newValue: boolean) {
    if (newValue || !plantacionId) return marcarAsignado(id, newValue);
    const pendientes = await getTechnicianUnsyncedGroupCount(plantacionId, id);
    if (pendientes === 0) return marcarAsignado(id, false);
    showConfirmDialog(
      confirm.show,
      'Técnico con grupos pendientes',
      mensajeDeDesasignacion(pendientes),
      'Desasignar',
      () => marcarAsignado(id, false),
      { icon: ICONO_AVISO, iconColor: colors.secondary, style: 'danger' },
    );
  }

  async function handleSave(onClose?: () => void, onBack?: () => void) {
    if (!plantacionId) return;
    setSaving(true);
    try {
      await assignTechnicians(
        plantacionId,
        items.filter((item) => item.assigned).map((item) => item.id),
      );
      (onClose ?? onBack)?.();
    } catch (e: any) {
      avisarError(e, 'No se pudieron asignar los técnicos.');
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    loading,
    saving,
    networkError,
    assignedCount: items.filter((item) => item.assigned).length,
    confirmProps: confirm.confirmProps,
    loadData,
    handleToggle,
    handleSave,
  };
}
