import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import CustomHeader from '../components/CustomHeader';
import FormActions from '../components/FormActions';
import ScreenContainer from '../components/ScreenContainer';
import TarjetaDeConflicto from '../components/TarjetaDeConflicto';
import { eleccionDe, useResolverCambios, type TarjetaDeSync } from '../hooks/useResolverCambios';
import { vistaDeConflictoDeCampo } from '../utils/textoDeConflicto';
import type { SeccionDeConflictos } from '../utils/seccionesDeConflictos';
import type { Eleccion } from '../utils/conflictosDeEdicion';
import { resolverCambiosScreenStyles as styles } from './ResolverCambiosScreen.styles';

const TITULO = 'Resolver cambios';
const NOTA = 'Estos datos cambiaron también en otro celular o en la web desde tu última sincronización. '
  + 'Lo demás ya se subió. Elegí qué valor queda: el otro se descarta.';

function SinCambios({ onVolver }: { onVolver: () => void }) {
  return (
    <View style={styles.vacio}>
      <Text style={styles.vacioTexto}>No hay cambios por resolver.</Text>
      <Pressable style={styles.volver} onPress={onVolver}>
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>
    </View>
  );
}

type SeccionProps = { seccion: SeccionDeConflictos<TarjetaDeSync>; onElegir: (clave: string, eleccion: Eleccion) => void };

/** Los conflictos de un grupo o de un árbol. */
function Seccion({ seccion, onElegir }: SeccionProps) {
  return (
    <View style={styles.seccion}>
      <View style={styles.encabezado}>
        <Text style={styles.seccionTitulo}>{seccion.titulo}</Text>
        {seccion.sub ? <Text style={styles.seccionSub}>{seccion.sub}</Text> : null}
      </View>
      {seccion.conflictos.map(({ clave, vista, eleccion }) => (
        <TarjetaDeConflicto key={clave} vista={vista} eleccion={eleccion} onElegir={(e) => onElegir(clave, e)} />
      ))}
    </View>
  );
}

const subtitulo = (lugar: string, cantidad: number) => {
  if (cantidad === 0) return lugar || undefined;
  const pendientes = cantidad === 1 ? '1 cambio por resolver' : `${cantidad} cambios por resolver`;
  return lugar ? `${lugar} · ${pendientes}` : pendientes;
};

/**
 * Datos que cambiaron en el teléfono y en otro lado a la vez: campos de la plantación
 * (#634) y, por grupo y por árbol, conflictos de sincronización (#804). Por cada uno
 * el usuario elige cuál queda.
 */
export default function ResolverCambiosScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const r = useResolverCambios(plantacionId ?? '');

  return (
    <ScreenContainer>
      <CustomHeader title={TITULO} subtitle={subtitulo(r.lugar, r.cantidad)} onBack={r.despues} />
      {!r.cargando && !r.guardando && r.cantidad === 0 && <SinCambios onVolver={r.despues} />}
      {r.cantidad > 0 && (
        <>
          <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
            <Text style={styles.nota}>{NOTA}</Text>
            {r.conflictos.map((conflicto) => (
              <TarjetaDeConflicto
                key={conflicto.campo}
                vista={vistaDeConflictoDeCampo(conflicto)}
                eleccion={eleccionDe(r.elecciones, conflicto.campo)}
                onElegir={(eleccion) => r.elegir(conflicto.campo, eleccion)}
              />
            ))}
            {r.secciones.map((seccion) => <Seccion key={seccion.clave} seccion={seccion} onElegir={r.elegirEnSync} />)}
          </ScrollView>
          {r.error ? <Text style={styles.error}>{r.error}</Text> : null}
          <View style={styles.pie}>
            <FormActions
              submitLabel="Guardar elección"
              onSubmit={() => void r.guardar()}
              loading={r.guardando}
              submitDisabled={r.guardando}
              onCancel={r.despues}
              cancelLabel="Después"
            />
          </View>
        </>
      )}
    </ScreenContainer>
  );
}
