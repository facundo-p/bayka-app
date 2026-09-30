import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useInvalidarConListado } from '../hooks/useInvalidarConListado';
import { CODIGO_PLANTACION, normalizarCodigoPlantacion } from '../lib/codigoPlantacion';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { codigoEsEditable, type Plantacion } from '../queries/plantationQueries';
import {
  crearPlantacion,
  editarPlantacion,
  existePlantacion,
  plantacionTrasConflicto,
  type PlantacionInput,
} from '../repositories/plantationRepository';
import {
  CodigoPlantacionDuplicadoError,
  ConflictoDeEdicionError,
  mensajeDeErrorDeEdicion,
} from '../repositories/edicionDePlantacion';
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
import styles from './Formulario.module.css';

/** Campos editables de una plantación por el formulario web; los de la migración
 *  024 pueden venir null/ausentes si la migración no está aplicada → inputs
 *  vacíos. (Superficie/ubicación son columnas reales del modelo de lectura, pero
 *  el formulario web ya no las edita, así que no forman parte de este tipo.) */
export type PlantacionEditable = Pick<Plantacion, 'estado' | 'archivadaEn'> & {
  id: string;
  lugar: string;
  periodo: string;
  codigo: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  objetivoArboles?: number | null;
};

interface PlantacionFormModalProps {
  /** Con plantación es edición; con null, creación. */
  plantacion: PlantacionEditable | null;
  onClose: () => void;
}

const ACCION_GUARDAR = 'guardar la plantación';
const MENSAJE_DUPLICADO = 'Ya existe una plantación con ese lugar y período.';
const AYUDA_CODIGO = 'Va en el ID de cada árbol. Único en la organización.';
const AYUDA_CODIGO_BLOQUEADO = 'Solo se cambia mientras la plantación está activa.';

function aTexto(valor: number | string | null | undefined): string {
  return valor == null ? '' : String(valor);
}

/** Los valores con que se abrió el formulario: contra esto se detecta si alguien más los cambió. */
function baseDe(plantacion: PlantacionEditable | null): PlantacionInput {
  return {
    lugar: plantacion?.lugar ?? '',
    periodo: plantacion?.periodo ?? '',
    codigo: plantacion?.codigo ?? '',
    descripcion: plantacion?.descripcion ?? undefined,
    fechaInicio: plantacion?.fechaInicio ?? undefined,
    objetivoArboles: plantacion?.objetivoArboles ?? undefined,
  };
}

function valoresIniciales(
  plantacion: Omit<PlantacionEditable, 'id' | 'estado' | 'archivadaEn'> | null,
): PlantacionFormValues {
  return {
    lugar: plantacion?.lugar ?? '',
    periodo: plantacion?.periodo ?? '',
    codigo: plantacion?.codigo ?? '',
    descripcion: plantacion?.descripcion ?? '',
    fechaInicio: plantacion?.fechaInicio ?? '',
    objetivoArboles: aTexto(plantacion?.objetivoArboles),
  };
}

type CamposProps = {
  valores: PlantacionFormValues;
  errores: ErroresValidacion;
  codigoBloqueado: boolean;
  onCambiar: (campo: keyof PlantacionFormValues, valor: string) => void;
};

function campoProps(campo: keyof PlantacionFormValues, props: CamposProps) {
  return {
    value: props.valores[campo],
    error:
      campo === 'lugar' || campo === 'periodo' || campo === 'codigo' || campo === 'objetivoArboles'
        ? props.errores[campo]
        : undefined,
    onChange: (event: { target: { value: string } }) => props.onCambiar(campo, event.target.value),
  };
}

/** Se tipea en mayúsculas y sin espacios: lo que se ve es lo que se guarda. */
function CampoCodigo(props: CamposProps) {
  return (
    <Input
      label="Código *"
      placeholder="SS26-1"
      maxLength={CODIGO_PLANTACION.longitudMaxima}
      autoComplete="off"
      spellCheck={false}
      disabled={props.codigoBloqueado}
      hint={props.codigoBloqueado ? AYUDA_CODIGO_BLOQUEADO : AYUDA_CODIGO}
      {...campoProps('codigo', props)}
      onChange={(event) =>
        props.onCambiar('codigo', normalizarCodigoPlantacion(event.target.value))
      }
    />
  );
}

/** Campos del formulario: lugar, período y código obligatorios; descripción, fecha de
 *  inicio y objetivo opcionales. (Superficie/ubicación se quitaron de la web.) */
function CamposPlantacion(props: CamposProps) {
  return (
    <>
      <Input label="Lugar *" {...campoProps('lugar', props)} />
      <Input label="Período *" placeholder="2025-2026" {...campoProps('periodo', props)} />
      <CampoCodigo {...props} />
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

type GuardadoProps = {
  plantacion: PlantacionEditable | null;
  onClose: () => void;
  alRecargar: (valores: PlantacionFormValues) => void;
  alFallar: (mensaje: string | null) => void;
  alRepetirCodigo: (mensaje: string) => void;
};

/** Crea o edita; en edición, tras un conflicto el form muestra lo que quedó en el server y lo toma como base nueva. */
function useGuardarPlantacion({
  plantacion,
  onClose,
  alRecargar,
  alFallar,
  alRepetirCodigo,
}: GuardadoProps) {
  const { perfil } = useAuth();
  const invalidar = useInvalidarConListado(
    plantacion ? CLAVE_QUERY.plantacion(plantacion.id) : undefined,
  );
  const [base, setBase] = useState(() => baseDe(plantacion));

  function recargarTrasConflicto(input: PlantacionInput, conflicto: ConflictoDeEdicionError) {
    const actual = plantacionTrasConflicto(input, conflicto);
    setBase(actual);
    alRecargar(valoresIniciales(actual));
    void invalidar();
  }

  return useMutation({
    mutationFn: async (input: PlantacionInput) => {
      if (plantacion) return editarPlantacion(plantacion.id, input, base);
      if (!perfil) throw new Error('Sesión sin perfil');
      await crearPlantacion(input, perfil);
    },
    onSuccess: async () => {
      await invalidar();
      onClose();
    },
    onError: (error, input) => {
      if (error instanceof CodigoPlantacionDuplicadoError) return alRepetirCodigo(error.message);
      if (error instanceof ConflictoDeEdicionError) recargarTrasConflicto(input, error);
      alFallar(mensajeDeErrorDeEdicion(error, ACCION_GUARDAR));
    },
  });
}

/** Modal compartido de creación y edición de plantaciones. */
export function PlantacionFormModal({ plantacion, onClose }: PlantacionFormModalProps) {
  const [valores, setValores] = useState(() => valoresIniciales(plantacion));
  const [errores, setErrores] = useState<ErroresValidacion>({});
  const [duplicado, setDuplicado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const editando = plantacion !== null;
  const mutacion = useGuardarPlantacion({
    plantacion,
    onClose,
    alRecargar: setValores,
    alFallar: setErrorEnvio,
    alRepetirCodigo: (mensaje) => setErrores((previos) => ({ ...previos, codigo: mensaje })),
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

  const camposProps: CamposProps = {
    valores,
    errores,
    codigoBloqueado: editando && !codigoEsEditable(plantacion),
    onCambiar: cambiarCampo,
  };
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
