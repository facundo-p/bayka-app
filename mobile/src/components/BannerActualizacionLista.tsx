/**
 * Avisa que hay una actualización OTA ya descargada esperando el reinicio (#446).
 * Sin esto el update se aplica recién en el próximo arranque en frío, que puede
 * tardar días: el técnico no cierra la app.
 *
 * Va arriba, debajo de la franja de entorno y encima del header. Abajo quedaba por
 * debajo de la barra de tabs, pegado a la barra de gestos de Android: un botón que
 * descarta el trabajo en memoria no puede vivir donde el pulgar barre para volver.
 *
 * Nunca reinicia solo. `reloadAsync` se lleva el estado en memoria —un formulario
 * a medio llenar se pierde—, así que el reinicio siempre lo decide el usuario, y
 * queda bloqueado mientras hay una sincronización o descarga en curso.
 *
 * Quién lo muestra y quién lo descarta es `FranjasSuperiores`: el aviso cambia el
 * inset que aplica el header, así que esa decisión no puede vivir acá adentro.
 */
import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { reloadAsync } from 'expo-updates';

import { useActividadDeSync } from '../hooks/useActividadDeSync';
import { useInsetSuperior } from '../hooks/useInsetSuperior';
import { spacing } from '../theme';
import { syncLog } from '../utils/syncLogger';
import { OCUPANTE_DEL_INSET } from './insetSuperior';
import { bannerActualizacionListaStyles as styles } from './BannerActualizacionLista.styles';

// El reinicio cierra lo que el técnico tenga abierto: el texto lo dice (§15).
const TEXTO_DISPONIBLE = 'Hay una actualización lista. Al reiniciar se cierra lo que estés haciendo.';
const TEXTO_SINCRONIZANDO = 'Actualización lista · esperando que termine la sincronización';
const TEXTO_BOTON = 'Reiniciar';
const TEXTO_DESCARTAR = '✕';
const HIT_SLOP_DESCARTAR = 12;

export default function BannerActualizacionLista({ onDescartar }: { onDescartar: () => void }) {
  const sincronizando = useActividadDeSync();
  const insetTop = useInsetSuperior(OCUPANTE_DEL_INSET.aviso);
  const [reiniciando, setReiniciando] = useState(false);
  // `setReiniciando` recién surte efecto en el próximo render: sin esto, dos toques
  // en el mismo tick dispararían dos reinicios.
  const reinicioEnCurso = useRef(false);

  const bloqueado = sincronizando || reiniciando;

  const reiniciar = async () => {
    // La guarda vive acá y no solo en `disabled`: la prop es presentación, y esto
    // decide si se puede perder trabajo del técnico.
    if (bloqueado || reinicioEnCurso.current) return;
    reinicioEnCurso.current = true;
    setReiniciando(true);
    try {
      await reloadAsync();
    } catch (e) {
      // Si el reinicio falla la app sigue andando con el código viejo: se reintenta
      // solo en el próximo arranque en frío.
      syncLog.error('Reinicio para aplicar el update falló:', e);
      reinicioEnCurso.current = false;
      setReiniciando(false);
    }
  };

  return (
    <View
      testID="banner-actualizacion-lista"
      style={[styles.franja, { paddingTop: insetTop + spacing.sm }]}
    >
      <Text style={styles.texto} numberOfLines={3}>
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
        onPress={onDescartar}
        hitSlop={HIT_SLOP_DESCARTAR}
        style={styles.descartar}
      >
        <Text style={styles.descartarTexto}>{TEXTO_DESCARTAR}</Text>
      </TouchableOpacity>
    </View>
  );
}
