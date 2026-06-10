import FormField from './FormField';
import TipoSegmentedControl from './TipoSegmentedControl';
import type { useGrupoForm } from '../hooks/useGrupoForm';

interface Props {
  form: ReturnType<typeof useGrupoForm>;
  lastGroupName?: string | null;
}

/** Campos del formulario de grupo (nombre, código, tipo). Presentacional (#89). */
export default function GrupoFields({ form, lastGroupName }: Props) {
  return (
    <>
      <FormField
        label="Nombre"
        value={form.nombre}
        onChangeText={form.handleNombreChange}
        placeholder="Ej: Linea 1"
        error={form.nombreError}
        autoCapitalize="words"
        helperText={lastGroupName ? `Último grupo: ${lastGroupName}` : null}
      />
      <FormField
        label="Código"
        value={form.codigo}
        onChangeText={form.handleCodigoChange}
        placeholder="Ej: L1"
        error={form.codigoError}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TipoSegmentedControl value={form.tipo} onChange={form.setTipo} />
    </>
  );
}
