import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CodigoEspecieDuplicadoError,
  crearEspecie,
  editarEspecie,
  MENSAJE_CODIGO_DUPLICADO,
  type EspecieInput,
} from '../repositories/especieRepository';
import {
  aEspecieInput,
  hayErroresEspecie,
  validarEspecie,
  type ErroresEspecie,
  type EspecieFormValues,
} from '../services/especieValidaciones';
import type { EspecieEditable } from '../queries/especieQueries';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import styles from './EspecieFormModal.module.css';

interface EspecieFormModalProps {
  /** Con especie es edición; con null, creación. */
  especie: EspecieEditable | null;
  onClose: () => void;
}

/** Clave de la query del catálogo con uso (listado de EspeciesScreen). */
const QUERY_CATALOGO = ['especies-catalogo-uso'] as const;

const MENSAJE_ERROR_GUARDADO =
  'No se pudo guardar la especie. Revisá tu conexión y probá de nuevo.';
const NOTA_CODIGO_EDICION =
  'El código es el identificador global de la especie: cambiarlo afecta su etiqueta y color en toda la app.';

function valoresIniciales(especie: EspecieEditable | null): EspecieFormValues {
  return {
    codigo: especie?.codigo ?? '',
    nombre: especie?.nombre ?? '',
    nombreCientifico: especie?.nombreCientifico ?? '',
  };
}

type CamposProps = {
  valores: EspecieFormValues;
  errores: ErroresEspecie;
  editando: boolean;
  onCambiar: (campo: keyof EspecieFormValues, valor: string) => void;
};

function campoProps(campo: keyof EspecieFormValues, props: CamposProps) {
  return {
    value: props.valores[campo],
    error: campo === 'codigo' || campo === 'nombre' ? props.errores[campo] : undefined,
    onChange: (event: { target: { value: string } }) => props.onCambiar(campo, event.target.value),
  };
}

/** Campos del formulario: código y nombre común obligatorios; científico opcional. */
function CamposEspecie(props: CamposProps) {
  return (
    <>
      <Input label="Código *" {...campoProps('codigo', props)} />
      {props.editando && (
        <p className={styles.nota} role="note">
          {NOTA_CODIGO_EDICION}
        </p>
      )}
      <Input label="Nombre común *" {...campoProps('nombre', props)} />
      <Input label="Nombre científico" {...campoProps('nombreCientifico', props)} />
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
          {MENSAJE_CODIGO_DUPLICADO}
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

/** Modal compartido de creación y edición de especies del catálogo global. */
export function EspecieFormModal({ especie, onClose }: EspecieFormModalProps) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState(() => valoresIniciales(especie));
  const [errores, setErrores] = useState<ErroresEspecie>({});
  const [duplicado, setDuplicado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const editando = especie !== null;

  const mutacion = useMutation({
    mutationFn: async (input: EspecieInput) => {
      if (especie) return editarEspecie(especie.id, input);
      await crearEspecie(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_CATALOGO });
      onClose();
    },
    onError: (error) => {
      if (error instanceof CodigoEspecieDuplicadoError) setDuplicado(true);
      else setErrorEnvio(MENSAJE_ERROR_GUARDADO);
    },
  });

  function cambiarCampo(campo: keyof EspecieFormValues, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    // Al cambiar el código, el aviso de duplicado queda viejo.
    if (campo === 'codigo') setDuplicado(false);
  }

  function manejarEnvio(event: FormEvent) {
    event.preventDefault();
    setErrorEnvio(null);
    const nuevosErrores = validarEspecie(valores);
    setErrores(nuevosErrores);
    if (hayErroresEspecie(nuevosErrores)) return;
    mutacion.mutate(aEspecieInput(valores));
  }

  const camposProps: CamposProps = { valores, errores, editando, onCambiar: cambiarCampo };
  return (
    <Modal open title={editando ? 'Editar especie' : 'Nueva especie'} onClose={onClose}>
      <form className={styles.form} onSubmit={manejarEnvio} noValidate>
        <CamposEspecie {...camposProps} />
        <AvisosFormulario duplicado={duplicado} errorEnvio={errorEnvio} />
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutacion.isPending}>
            {editando ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
