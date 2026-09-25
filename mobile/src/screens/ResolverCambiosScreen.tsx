import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import CustomHeader from '../components/CustomHeader';
import FormActions from '../components/FormActions';
import ScreenContainer from '../components/ScreenContainer';
import TarjetaDeConflicto from '../components/TarjetaDeConflicto';
import { eleccionDe, useResolverCambios } from '../hooks/useResolverCambios';
import { resolverCambiosScreenStyles as styles } from './ResolverCambiosScreen.styles';

const TITULO = 'Resolver cambios';

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

/**
 * Campos que cambiaron en el teléfono y en la web a la vez (#634): por cada uno, el usuario
 * elige cuál queda. Mientras tanto la plantación muestra el de la web.
 */
export default function ResolverCambiosScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const r = useResolverCambios(plantacionId ?? '');
  const hayConflictos = r.conflictos.length > 0;

  return (
    <ScreenContainer>
      <CustomHeader title={TITULO} subtitle={r.lugar || undefined} onBack={r.despues} />
      {!r.cargando && !hayConflictos && <SinCambios onVolver={r.despues} />}
      {hayConflictos && (
        <>
          <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
            <Text style={styles.nota}>
              Esto cambió también en la web. Lo demás ya se subió. Elegí qué valor queda: el otro se descarta.
            </Text>
            {r.conflictos.map((conflicto) => (
              <TarjetaDeConflicto
                key={conflicto.campo}
                conflicto={conflicto}
                eleccion={eleccionDe(r.elecciones, conflicto.campo)}
                onElegir={(eleccion) => r.elegir(conflicto.campo, eleccion)}
              />
            ))}
            {r.error ? <Text style={styles.error}>{r.error}</Text> : null}
          </ScrollView>
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
