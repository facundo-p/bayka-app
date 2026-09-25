/**
 * useAssignTechnicians — el estado de AssignTechniciansScreen.
 *
 * Los técnicos salen del caché del teléfono (#636): la lista se pinta de ahí y se
 * refresca del server en segundo plano. Asignar funciona sin conexión; quitar a
 * alguien que ya está asignado en el servidor, no.
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
import {
  ICONO_TECNICOS,
  TITULO_TECNICOS_NO_ASIGNADOS,
  cambiosDeLaPantalla,
  conCambiosDeLaPantalla,
  mensajeTecnicosNoAsignados,
} from '../utils/tecnicosDePlantacion';
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

type Lista = { iniciales: TecnicoAsignable[]; items: TecnicoAsignable[] };
const LISTA_VACIA: Lista = { iniciales: [], items: [] };

/** Ya asignado en el servidor al abrir la pantalla: quitarlo necesita conexión. */
const asignadoEnServidor = (t: TecnicoAsignable) => t.assigned && !t.pendiente;

export function useAssignTechnicians(plantacionId: string | undefined) {
  const confirm = useConfirm();
  const { profile } = useProfileData();
  const { isOnline, conexionConocida } = useNetStatus();
  const organizacionId = profile?.organizacionId ?? null;

  const [{ iniciales, items }, setLista] = useState<Lista>(LISTA_VACIA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const avisarError = useCallback(
    (error: any, mensajePorDefecto: string) => {
      showInfoDialog(confirm.show, 'Error', error?.message ?? mensajePorDefecto, ICONO_ERROR, colors.danger);
    },
    [confirm.show],
  );

  const leer = useCallback(
    () => getTechniciansWithAssignment(organizacionId ?? '', plantacionId ?? ''),
    [organizacionId, plantacionId],
  );

  const loadData = useCallback(async () => {
    if (!plantacionId || !organizacionId) return;
    setLoading(true);
    try {
      const cargados = await leer();
      setLista({ iniciales: cargados, items: cargados });
    } catch (e: any) {
      avisarError(e, 'No se pudieron cargar los técnicos.');
    } finally {
      setLoading(false);
    }
  }, [plantacionId, organizacionId, leer, avisarError]);

  useEffect(() => {
    let montado = true;
    const refrescar = async () => {
      await loadData();
      if (!plantacionId || !organizacionId) return;
      await refrescarTecnicosDeOrganizacion();
      const nuevos = await leer();
      if (montado) setLista((previa) => ({ iniciales: nuevos, items: conCambiosDeLaPantalla(nuevos, previa) }));
    };
    refrescar().catch(() => {});
    return () => { montado = false; };
  }, [loadData, leer, plantacionId, organizacionId]);

  // Mientras NetInfo no respondió no se deshabilita nada: el servicio igual chequea al guardar.
  const puedeQuitar = (id: string) =>
    isOnline || !conexionConocida || !iniciales.some((t) => t.id === id && asignadoEnServidor(t));

  const marcarAsignado = (id: string, assigned: boolean) =>
    setLista((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, assigned } : item)) }));

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
    showInfoDialog(confirm.show, TITULO_TECNICOS_NO_ASIGNADOS, mensajeTecnicosNoAsignados(nombres), ICONO_TECNICOS, colors.info);
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
    sinConexion: conexionConocida && !isOnline,
    assignedCount: items.filter((item) => item.assigned).length,
    confirmProps: confirm.confirmProps,
    puedeQuitar,
    handleToggle,
    handleSave,
  };
}
