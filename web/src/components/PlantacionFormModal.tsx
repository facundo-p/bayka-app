import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import {
  crearPlantacion,
  editarPlantacion,
  existePlantacion,
  type PlantacionInput,
} from '../repositories/plantationRepository';
import {
  aPlantacionInput,
  hayErrores,
  validarPlantacion,
  type ErroresValidacion,
  type PlantacionFormValues,
} from '../services/plantacionValidaciones';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { Textarea } from './Textarea';
import styles from './PlantacionFormModal.module.css';

/** Campos editables de una plantación por el formulario web; los de la migración
 *  024 pueden venir null/ausentes si la migración no está aplicada → inputs
 *  vacíos. (Superficie/ubicación son columnas reales del modelo de lectura, pero
 *  el formulario web ya no las edita, así que no forman parte de este tipo.) */
export type PlantacionEditable = {
  id: string;
  lugar: string;
  periodo: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  objetivoArboles?: number | null;
};

interface PlantacionFormModalProps {
  /** Con plantación es edición; con null, creación. */
  plantacion: PlantacionEditable | null;
  onClose: () => void;
}

const MENSAJE_ERROR_GUARDADO =
  'No se pudo guardar la plantación. Revisá tu conexión y probá de nuevo.';
const MENSAJE_DUPLICADO = 'Ya existe una plantación con ese lugar y período.';

function aTexto(valor: number | string | null | undefined): string {
  return valor == null ? '' : String(valor);
}

function valoresIniciales(plantacion: PlantacionEditable | null): PlantacionFormValues {
  return {
    lugar: plantacion?.lugar ?? '',
    periodo: plantacion?.periodo ?? '',
    descripcion: plantacion?.descripcion ?? '',
    fechaInicio: plantacion?.fechaInicio ?? '',
    objetivoArboles: aTexto(plantacion?.objetivoArboles),
  };
}

type CamposProps = {
  valores: PlantacionFormValues;
  errores: ErroresValidacion;
  onCambiar: (campo: keyof PlantacionFormValues, valor: string) => void;
};

function campoProps(campo: keyof PlantacionFormValues, props: CamposProps) {
  return {
    value: props.valores[campo],
    error: campo === 'lugar' || campo === 'periodo' || campo === 'objetivoArboles'
      ? props.errores[campo]
      : undefined,
    onChange: (event: { target: { value: string } }) => props.onCambiar(campo, event.target.value),
  };
}

/** Campos del formulario: lugar y período obligatorios; descripción, fecha de
 *  inicio y objetivo opcionales. (Superficie/ubicación se quitaron de la web.) */
function CamposPlantacion(props: CamposProps) {
  return (
    <>
      <Input label="Lugar *" {...campoProps('lugar', props)} />
      <Input label="Período *" placeholder="2025-2026" {...campoProps('periodo', props)} />
      <Textarea label="Descripción" {...campoProps('descripcion', props)} />
      <Input label="Fecha de inicio" type="date" {...campoProps('fechaInicio', props)} />
      <Input
        label="Objetivo de árboles"
        type="number"
        min="1"
        step="1"
        {...campoProps('objetivoArboles', props)}
      />
    </>
  );
}

function AvisosFormulario({
  duplicado,
  errorEnvio,
}: {
  duplicado: boolean;
  errorEnvio: string | null;
}) {
  return (
    <>
      {duplicado && (
        <p className={styles.advertencia} role="status">
          {MENSAJE_DUPLICADO}
        </p>
      )}
      {errorEnvio && (
        <p className={styles.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      )}
    </>
  );
}

function etiquetaGuardar(editando: boolean, duplicado: boolean): string {
  const base = editando ? 'Guardar' : 'Crear';
  return duplicado ? `${base} igualmente` : base;
}

/** El chequeo de duplicado es solo una advertencia: si falla (red), no bloquea. */
async function esDuplicado(valores: PlantacionFormValues, excluirId?: string): Promise<boolean> {
  try {
    return await existePlantacion(valores.lugar, valores.periodo, excluirId);
  } catch {
    return false;
  }
}

/** Modal compartido de creación y edición de plantaciones. */
export function PlantacionFormModal({ plantacion, onClose }: PlantacionFormModalProps) {
  const { perfil } = useAuth();
  const queryClient = useQueryClient();
  const [valores, setValores] = useState(() => valoresIniciales(plantacion));
  const [errores, setErrores] = useState<ErroresValidacion>({});
  const [duplicado, setDuplicado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const editando = plantacion !== null;

  const mutacion = useMutation({
    mutationFn: async (input: PlantacionInput) => {
      if (plantacion) return editarPlantacion(plantacion.id, input);
      if (!perfil) throw new Error('Sesión sin perfil');
      await crearPlantacion(input, perfil);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plantaciones'] });
      // En edición, refrescar también el detalle abierto de esa plantación.
      if (plantacion) {
        await queryClient.invalidateQueries({ queryKey: ['plantacion', plantacion.id] });
      }
      onClose();
    },
    onError: () => setErrorEnvio(MENSAJE_ERROR_GUARDADO),
  });

  function cambiarCampo(campo: keyof PlantacionFormValues, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    // Si cambia lugar/período, la advertencia de duplicado queda vieja.
    if (campo === 'lugar' || campo === 'periodo') setDuplicado(false);
  }

  async function manejarEnvio(event: FormEvent) {
    event.preventDefault();
    setErrorEnvio(null);
    const nuevosErrores = validarPlantacion(valores);
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;
    if (!duplicado && (await esDuplicado(valores, plantacion?.id))) {
      setDuplicado(true);
      return;
    }
    mutacion.mutate(aPlantacionInput(valores));
  }

  const camposProps: CamposProps = { valores, errores, onCambiar: cambiarCampo };
  return (
    <Modal open title={editando ? 'Editar plantación' : 'Nueva plantación'} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void manejarEnvio(event)} noValidate>
        <CamposPlantacion {...camposProps} />
        <AvisosFormulario duplicado={duplicado} errorEnvio={errorEnvio} />
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutacion.isPending}>
            {etiquetaGuardar(editando, duplicado)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
