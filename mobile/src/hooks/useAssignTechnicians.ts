/**
 * useAssignTechnicians — el estado de AssignTechniciansScreen.
 *
 * Los técnicos salen del caché del teléfono (#636), refrescado si hay señal, y la
 * asignación del SQLite local. Asignar funciona sin conexión; quitar a alguien que
 * ya está asignado en el servidor, no.
 */
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from './useConfirm';
import { useProfileData } from './useProfileData';
import { useNetStatus } from './useNetStatus';
import { showInfoDialog, showConfirmDialog } from '../utils/alertHelpers';
import {
  getTechnicianUnsyncedGroupCount,
  getTechniciansWithAssignment,
  type TecnicoAsignable,
} from '../queries/adminQueries';
import { guardarTecnicosDePlantacion, refrescarTecnicosDeOrganizacion } from '../services/TecnicosDePlantacionService';
import { altasYBajasDeLaSeleccion } from '../utils/altasYBajas';
import { mensajeTecnicosNoAsignados } from '../utils/tecnicosDePlantacion';
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

async function cargarTecnicos(organizacionId: string, plantacionId: string): Promise<TecnicoAsignable[]> {
  await refrescarTecnicosDeOrganizacion();
  return getTechniciansWithAssignment(organizacionId, plantacionId);
}

/** Ya asignado en el servidor al abrir la pantalla: quitarlo necesita conexión. */
const asignadoEnServidor = (t: TecnicoAsignable) => t.assigned && !t.pendiente;

const cambiosDeLaPantalla = (iniciales: TecnicoAsignable[], actuales: TecnicoAsignable[]) =>
  altasYBajasDeLaSeleccion(iniciales, actuales, (t) => t.id, (t) => t.assigned);

export function useAssignTechnicians(plantacionId: string | undefined) {
  const confirm = useConfirm();
  const { profile } = useProfileData();
  const { isOnline } = useNetStatus();
  const organizacionId = profile?.organizacionId ?? null;

  const [items, setItems] = useState<TecnicoAsignable[]>([]);
  const [iniciales, setIniciales] = useState<TecnicoAsignable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const avisarError = useCallback(
    (error: any, mensajePorDefecto: string) => {
      showInfoDialog(confirm.show, 'Error', error?.message ?? mensajePorDefecto, ICONO_ERROR, colors.danger);
    },
    [confirm.show],
  );

  const loadData = useCallback(async () => {
    if (!plantacionId || !organizacionId) return;
    setLoading(true);
    try {
      const cargados = await cargarTecnicos(organizacionId, plantacionId);
      setItems(cargados);
      setIniciales(cargados);
    } catch (e: any) {
      avisarError(e, 'No se pudieron cargar los técnicos.');
    } finally {
      setLoading(false);
    }
  }, [plantacionId, organizacionId, avisarError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const puedeQuitar = (id: string) => isOnline || !iniciales.some((t) => t.id === id && asignadoEnServidor(t));

  const marcarAsignado = (id: string, assigned: boolean) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, assigned } : item)));

  /** Desasignar avisa si el técnico tiene grupos que solo él puede subir. */
  async function handleToggle(id: string, newValue: boolean) {
    if (newValue || !plantacionId) return marcarAsignado(id, newValue);
    if (!puedeQuitar(id)) return;
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

  async function avisarNoAsignados(nombres: string[]) {
    await loadData();
    showInfoDialog(confirm.show, 'Técnicos no asignados', mensajeTecnicosNoAsignados(nombres), 'people-outline', colors.info);
  }

  async function handleSave(onClose?: () => void, onBack?: () => void) {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const noAsignados = await guardarTecnicosDePlantacion(plantacionId, cambiosDeLaPantalla(iniciales, items));
      // La pantalla queda abierta: muestra que ya no están asignados.
      if (noAsignados.length > 0) return await avisarNoAsignados(noAsignados);
      (onClose ?? onBack)?.();
    } catch (e: any) {
      await loadData();
      avisarError(e, 'No se pudieron asignar los técnicos.');
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    loading,
    saving,
    sinConexion: !isOnline,
    assignedCount: items.filter((item) => item.assigned).length,
    confirmProps: confirm.confirmProps,
    puedeQuitar,
    handleToggle,
    handleSave,
  };
}
