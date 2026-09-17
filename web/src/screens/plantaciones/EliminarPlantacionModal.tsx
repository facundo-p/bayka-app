import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { Cargando } from '../../components/Cargando';
import { ConfirmarModal } from '../../components/ConfirmarModal';
import { ErrorEnvio } from '../../components/FormularioModal';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import styles from '../../components/Formulario.module.css';
import { useAuth } from '../../hooks/useAuth';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  previsualizarEliminacion,
  type PreviewEliminacion,
} from '../../queries/eliminacionQueries';
import { esArchivada, type Plantacion } from '../../queries/plantationQueries';
import {
  copyArchivarPrimero,
  copyConfirmarNombre,
  copySinDatos,
  copySoloSuperadmin,
  nombreCoincide,
  ofreceArchivar,
  permiteBorrar,
  puedeLimpiarFotos,
  textoEliminada,
  VISTA_ELIMINACION,
  vistaEliminacion,
  type VistaEliminacion,
} from './eliminacion';
import type { ResultadoEliminacion } from '../../services/adminPlantacionesService';
import { ReintentarLimpiezaFotos } from './ReintentarLimpiezaFotos';
import { useEliminarPlantacion } from './useEliminarPlantacion';

interface EliminarPlantacionModalProps {
  plantacion: Plantacion;
  onClose: () => void;
  /** Abre la confirmación de archivar, para las variantes que no pueden borrar. */
  onArchivar: () => void;
}

const titulo = (plantacion: Plantacion) => `Eliminar ${plantacion.lugar}`;

interface AvisoModalProps {
  plantacion: Plantacion;
  onClose: () => void;
  children: ReactNode;
}

/** Modal sin acción de borrado: carga, error o explicación de por qué no se puede. */
function AvisoModal({ plantacion, onClose, children }: AvisoModalProps) {
  return (
    <Modal open title={titulo(plantacion)} onClose={onClose}>
      <div className={styles.form}>{children}</div>
    </Modal>
  );
}

interface NoEliminableProps extends EliminarPlantacionModalProps {
  vista: VistaEliminacion;
}

function NoEliminable({ plantacion, vista, onClose, onArchivar }: NoEliminableProps) {
  const archivada = esArchivada(plantacion);
  const texto =
    vista === VISTA_ELIMINACION.soloSuperadmin
      ? copySoloSuperadmin(plantacion.lugar, archivada)
      : copyArchivarPrimero(plantacion.lugar);
  return (
    <AvisoModal plantacion={plantacion} onClose={onClose}>
      <p className={styles.info}>{texto}</p>
      <div className={styles.acciones}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {ofreceArchivar(vista, archivada) && (
          <Button type="button" onClick={onArchivar}>
            Archivar
          </Button>
        )}
      </div>
    </AvisoModal>
  );
}

interface CampoNombreProps {
  lugar: string;
  valor: string;
  onCambiar: (valor: string) => void;
}

function CampoNombre({ lugar, valor, onCambiar }: CampoNombreProps) {
  return (
    <Input
      label={`Escribí «${lugar}» para confirmar`}
      value={valor}
      autoComplete="off"
      onChange={(evento) => onCambiar(evento.target.value)}
    />
  );
}

interface ConfirmarEliminacionProps {
  plantacion: Plantacion;
  preview: PreviewEliminacion;
  onClose: () => void;
}

/** Con fotos pendientes, un superadmin puede reintentar la limpieza ahí mismo. */
function useReintentoDeLimpieza(plantacionId: string, resultado: ResultadoEliminacion | null) {
  const { perfil } = useAuth();
  if (!resultado?.fotosPendientes || !puedeLimpiarFotos(perfil)) return undefined;
  return <ReintentarLimpiezaFotos plantacionId={plantacionId} />;
}

/** Sin datos, confirmación simple; con datos, además hay que escribir el nombre. */
function ConfirmarEliminacion({ plantacion, preview, onClose }: ConfirmarEliminacionProps) {
  const [nombre, setNombre] = useState('');
  const eliminacion = useEliminarPlantacion(plantacion.id, onClose);
  const reintento = useReintentoDeLimpieza(plantacion.id, eliminacion.resultado);
  const { lugar } = plantacion;
  const pideNombre = preview.tieneDatos;
  return (
    <ConfirmarModal
      titulo={titulo(plantacion)}
      descripcion={pideNombre ? copyConfirmarNombre(lugar, preview) : copySinDatos(lugar)}
      confirmarEtiqueta="Eliminar"
      destructiva
      confirmarDeshabilitado={pideNombre && !nombreCoincide(nombre, lugar)}
      accion={() => eliminacion.eliminar(pideNombre ? nombre : undefined)}
      alCompletar={eliminacion.alCompletar}
      textoExito={textoEliminada(eliminacion.resultado?.fotosPendientes ?? false)}
      resultadoExtra={reintento}
      onClose={eliminacion.cerrar}
    >
      {pideNombre && <CampoNombre lugar={lugar} valor={nombre} onCambiar={setNombre} />}
    </ConfirmarModal>
  );
}

/** Eliminar de verdad: consulta qué tiene la plantación y ofrece lo que corresponde. */
export function EliminarPlantacionModal(props: EliminarPlantacionModalProps) {
  const { plantacion, onClose } = props;
  const preview = useQuery({
    queryKey: CLAVE_QUERY.previewEliminacion(plantacion.id),
    queryFn: () => previsualizarEliminacion(plantacion.id),
    gcTime: 0,
  });
  if (preview.isPending || preview.isError) {
    return (
      <AvisoModal plantacion={plantacion} onClose={onClose}>
        {preview.isError ? <ErrorEnvio mensaje={preview.error.message} /> : <Cargando />}
      </AvisoModal>
    );
  }
  const vista = vistaEliminacion(preview.data);
  if (!permiteBorrar(vista)) return <NoEliminable {...props} vista={vista} />;
  return <ConfirmarEliminacion plantacion={plantacion} preview={preview.data} onClose={onClose} />;
}
