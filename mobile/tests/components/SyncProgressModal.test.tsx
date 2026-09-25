import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SyncProgressModal from '../../src/components/SyncProgressModal';

type Props = React.ComponentProps<typeof SyncProgressModal>;

const BASE: Props = {
  state: 'done',
  progress: null,
  results: [],
  parcelaResults: [],
  plantationResults: [],
  successCount: 0,
  failureCount: 0,
  parcelaFailureCount: 0,
  plantationFailureCount: 0,
  pullSuccess: true,
  sinAcceso: false,
  eliminada: false,
  omitidas: { eliminadas: [], sinAcceso: [] },
  authExpired: false,
  photoProgress: null,
  phaseProgress: null,
  photoResult: null,
  globalProgress: null,
  estancado: false,
  cancelado: false,
  huboTimeout: false,
  onCancelar: jest.fn(),
  onDismiss: jest.fn(),
};

function renderModal(overrides: Partial<Props>) {
  return render(<SyncProgressModal {...BASE} {...overrides} />);
}

const FALLA_DE_GRUPO = { success: false, groupId: 'g1', nombre: 'Grupo 1', error: 'UNKNOWN' } as const;
const FALLA_DE_PLANTACION = { success: false, plantacionId: 'p1', nombre: 'Norte', error: 'UNKNOWN' } as const;

describe('SyncProgressModal', () => {
  it('idle o sesión vencida no renderiza nada', () => {
    expect(renderModal({ state: 'idle' }).toJSON()).toBeNull();
    expect(renderModal({ authExpired: true }).toJSON()).toBeNull();
  });

  describe('fases en curso', () => {
    it('pull sin fase muestra el texto genérico', () => {
      const { getByText } = renderModal({ state: 'pulling' });
      expect(getByText('Actualizando datos...')).toBeTruthy();
      expect(getByText('Descargando novedades del servidor')).toBeTruthy();
    });

    it('push muestra el contador, el grupo y el progreso global', () => {
      const { getByText } = renderModal({
        state: 'pushing',
        progress: { total: 4, completed: 1, currentName: 'Grupo 2' },
        globalProgress: { plantationName: 'Norte', done: 0, total: 3 },
      });
      expect(getByText('Subiendo grupos...')).toBeTruthy();
      expect(getByText('1 de 4')).toBeTruthy();
      expect(getByText('Grupo 2')).toBeTruthy();
      expect(getByText('Sincronizando Norte... (1 de 3 plantaciones)')).toBeTruthy();
    });

    it('subida de fotos sin progreso muestra "Preparando..." y el contexto sin progreso global', () => {
      const { getByText, queryByText } = renderModal({
        state: 'uploading-photos',
        globalProgress: { plantationName: 'Norte', done: 0, total: 3 },
      });
      expect(getByText('Subiendo fotos...')).toBeTruthy();
      expect(getByText('Preparando...')).toBeTruthy();
      expect(getByText('Norte')).toBeTruthy();
      expect(queryByText(/plantaciones\)/)).toBeNull();
    });

    it('descarga de fotos', () => {
      expect(renderModal({ state: 'downloading-photos' }).getByText('Descargando fotos...')).toBeTruthy();
    });

    it('estancado ofrece cancelar', () => {
      const onCancelar = jest.fn();
      const { getByText } = renderModal({ state: 'pushing', estancado: true, onCancelar });
      fireEvent.press(getByText('Cancelar sincronización'));
      expect(onCancelar).toHaveBeenCalled();
    });

    it('estancado no se muestra al terminar', () => {
      expect(renderModal({ estancado: true }).queryByText('Cancelar sincronización')).toBeNull();
    });
  });

  describe('resultado', () => {
    it('cancelada', () => {
      const onDismiss = jest.fn();
      const { getByText, queryByText } = renderModal({ cancelado: true, eliminada: true, onDismiss });
      expect(getByText('Sincronización cancelada')).toBeTruthy();
      expect(queryByText('Plantación eliminada en el servidor')).toBeNull();
      fireEvent.press(getByText('Cerrar'));
      expect(onDismiss).toHaveBeenCalled();
    });

    it('eliminada en el servidor', () => {
      const { getByText, queryByText } = renderModal({ eliminada: true });
      expect(getByText('Plantación eliminada en el servidor')).toBeTruthy();
      expect(getByText(/Un administrador la eliminó\. .*Podés eliminarla del dispositivo/)).toBeTruthy();
      expect(queryByText('Datos actualizados')).toBeNull();
    });

    it('sin acceso', () => {
      const { getByText, queryByText } = renderModal({ sinAcceso: true });
      expect(getByText('Sin acceso a la plantación')).toBeTruthy();
      expect(getByText(/Un administrador te quitó el acceso/)).toBeTruthy();
      expect(queryByText('Datos actualizados')).toBeNull();
    });

    it('pull exitoso con fotos descargadas y omitidas', () => {
      const { getByText } = renderModal({
        photoResult: { downloaded: 2 },
        omitidas: { eliminadas: ['Sur'], sinAcceso: [] },
      });
      expect(getByText('Datos actualizados')).toBeTruthy();
      expect(getByText('Se descargaron los últimos datos del servidor.')).toBeTruthy();
      expect(getByText('2 fotos descargadas correctamente')).toBeTruthy();
      expect(getByText('Sur')).toBeTruthy();
    });

    it('avisa las plantaciones subidas que chocan con otra del server por lugar y periodo', () => {
      const { getByText, queryByText } = renderModal({
        plantationResults: [
          { success: true, plantacionId: 'p1', nombre: 'Lote Norte', duplicada: true },
          { success: true, plantacionId: 'p2', nombre: 'Campo Sur', duplicada: false },
        ],
      });
      expect(getByText('Datos actualizados')).toBeTruthy();
      expect(getByText('Mismo lugar y periodo')).toBeTruthy();
      expect(getByText('Lote Norte')).toBeTruthy();
      expect(queryByText('Campo Sur')).toBeNull();
    });

    it('avisa los cambios que chocaron con la web y "Resolver" cierra el resumen y abre la pantalla', () => {
      const onDismiss = jest.fn();
      const onResolverCambios = jest.fn();
      const { getByText } = renderModal({
        onDismiss,
        onResolverCambios,
        plantationResults: [{ success: true, plantacionId: 'p1', nombre: 'Lote Norte', cambiosPorResolver: 1 }],
      });
      expect(getByText('Un dato cambió también en la web. Elegí cuál queda.')).toBeTruthy();

      fireEvent.press(getByText('Resolver'));

      expect(onDismiss).toHaveBeenCalled();
      expect(onResolverCambios).toHaveBeenCalledWith('p1');
    });

    it('sin quien abra la pantalla, el aviso no ofrece "Resolver"', () => {
      const { getByText, queryByText } = renderModal({
        plantationResults: [{ success: true, plantacionId: 'p1', nombre: 'Lote Norte', cambiosPorResolver: 2 }],
      });
      expect(getByText('2 datos cambiaron también en la web. Elegí cuáles quedan.')).toBeTruthy();
      expect(queryByText('Resolver')).toBeNull();
    });

    it('sin duplicadas no muestra el aviso', () => {
      const { queryByText } = renderModal({
        plantationResults: [{ success: true, plantacionId: 'p1', nombre: 'Lote Norte' }],
      });
      expect(queryByText('Mismo lugar y periodo')).toBeNull();
    });

    it('pull fallido sin timeout pide verificar la conexión', () => {
      const { getByText } = renderModal({ pullSuccess: false });
      expect(getByText('Error al actualizar')).toBeTruthy();
      expect(getByText('No se pudo conectar con el servidor. Verificá tu conexión.')).toBeTruthy();
    });

    it('sync completa con grupos y fotos', () => {
      const { getByText } = renderModal({
        results: [{ success: true, groupId: 'g1', nombre: 'Grupo 1' } as never],
        successCount: 1,
        photoResult: { uploaded: 1, downloaded: 1 },
      });
      expect(getByText('Sincronización completa')).toBeTruthy();
      expect(getByText('1 grupo sincronizado')).toBeTruthy();
      expect(getByText('1 foto subida correctamente')).toBeTruthy();
      expect(getByText('1 foto descargada correctamente')).toBeTruthy();
    });

    it('sync sin pull (null) cae en el resultado de push', () => {
      expect(renderModal({ pullSuccess: null }).getByText('Sincronización completa')).toBeTruthy();
    });

    it('sync parcial lista las fallas y las fotos que no pasaron', () => {
      const { getByText } = renderModal({
        results: [FALLA_DE_GRUPO as never],
        plantationResults: [FALLA_DE_PLANTACION as never],
        successCount: 2,
        failureCount: 1,
        plantationFailureCount: 1,
        photoResult: { uploadFailed: 1, downloadFailed: 3 },
      });
      expect(getByText('Sincronización parcial')).toBeTruthy();
      expect(getByText('2 grupos sincronizados')).toBeTruthy();
      expect(getByText('1 foto no pudo subirse.')).toBeTruthy();
      expect(getByText('3 fotos no pudieron descargarse.')).toBeTruthy();
      expect(getByText('1 plantación con error:')).toBeTruthy();
      expect(getByText('1 grupo con error:')).toBeTruthy();
    });
  });
});
