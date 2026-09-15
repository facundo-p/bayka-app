/**
 * Avisa que hay una actualización OTA ya descargada esperando el reinicio (#446).
 * Sin esto el update se aplica recién en el próximo arranque en frío, que puede
 * tardar días: el técnico no cierra la app.
 *
 * Nunca reinicia solo. `reloadAsync` se lleva el estado en memoria —un formulario
 * a medio llenar se pierde—, así que el reinicio siempre lo decide el usuario, y
 * queda bloqueado mientras hay una sincronización o descarga en curso.
 */
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useUpdates, reloadAsync } from 'expo-updates';
import { useActividadDeSync } from '../hooks/useActividadDeSync';
import { syncLog } from '../utils/syncLogger';
import { bannerActualizacionListaStyles as styles } from './BannerActualizacionLista.styles';

const TEXTO_DISPONIBLE = 'Hay una actualización lista';
const TEXTO_SINCRONIZANDO = 'Actualización lista · esperando que termine la sincronización';
const TEXTO_BOTON = 'Reiniciar';
const TEXTO_DESCARTAR = '✕';

export default function BannerActualizacionLista() {
  const { isUpdatePending } = useUpdates();
  const sincronizando = useActividadDeSync();
  const [descartado, setDescartado] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);

  if (!isUpdatePending || descartado) return null;

  const bloqueado = sincronizando || reiniciando;

  const reiniciar = async () => {
    setReiniciando(true);
    try {
      await reloadAsync();
    } catch (e) {
      // Si el reinicio falla la app sigue andando con el código viejo: se reintenta
      // solo en el próximo arranque en frío.
      syncLog.error('Reinicio para aplicar el update falló:', e);
      setReiniciando(false);
    }
  };

  return (
    <View testID="banner-actualizacion-lista" style={styles.franja}>
      <Text style={styles.texto} numberOfLines={2}>
        {sincronizando ? TEXTO_SINCRONIZANDO : TEXTO_DISPONIBLE}
      </Text>
      <TouchableOpacity
        testID="banner-actualizacion-reiniciar"
        accessibilityRole="button"
        accessibilityState={{ disabled: bloqueado }}
        disabled={bloqueado}
        onPress={reiniciar}
        style={[styles.boton, bloqueado && styles.botonDeshabilitado]}
      >
        <Text style={styles.botonTexto}>{TEXTO_BOTON}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="banner-actualizacion-descartar"
        accessibilityRole="button"
        accessibilityLabel="Descartar aviso de actualización"
        onPress={() => setDescartado(true)}
        style={styles.descartar}
      >
        <Text style={styles.descartarTexto}>{TEXTO_DESCARTAR}</Text>
      </TouchableOpacity>
    </View>
  );
}
