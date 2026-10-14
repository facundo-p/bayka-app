import { View, Text, Switch, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import CustomHeader from '../components/CustomHeader';
import TexturedBackground from '../components/TexturedBackground';
import GpsSignalIndicator from '../components/GpsSignalIndicator';
import { useGpsWatcher } from '../hooks/useGpsWatcher';
import { useGpsEnabledSetting } from '../hooks/useGpsEnabledSetting';
import { useNetStatus } from '../hooks/useNetStatus';
import { useDescargaDeFotosSetting } from '../hooks/useDescargaDeFotosSetting';
import { useLiberarEspacio } from '../hooks/useLiberarEspacio';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { rotuloLiberarEspacio, textoSinSubir } from '../utils/avisoLiberarEspacio';
import { openGpsUnblockDialog } from '../services/gps/locationClient';
import { gpsLog } from '../utils/gpsLogger';
import { colors } from '../theme';
import { settingsScreenStyles as styles } from './SettingsScreen.styles';

export default function SettingsScreen() {
  const { gpsEnabled, setGpsEnabled } = useGpsEnabledSetting();
  const { isOnline } = useNetStatus();

  return (
    <TexturedBackground>
      <CustomHeader title="Ajustes" />
      <ScrollView contentContainerStyle={styles.innerContainer}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <Text style={styles.grupoTitulo}>Ajustes GPS</Text>

          <View style={styles.sectionRow}>
            <View style={styles.sectionLabelWrap}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.sectionLabel}>Medición de GPS</Text>
            </View>
            <Switch
              value={gpsEnabled}
              onValueChange={setGpsEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Habilitar o deshabilitar la medición de GPS"
            />
          </View>

          {gpsEnabled ? (
            <GpsDiagnostic />
          ) : (
            <Text style={styles.gpsDisabledHint}>
              La medición de GPS está desactivada. Habilitala para registrar árboles en
              plantaciones que la exigen.
            </Text>
          )}

          <View style={styles.divider} />

          <View style={styles.sectionRow}>
            <View style={styles.sectionLabelWrap}>
              <Ionicons
                name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
                size={18}
                color={isOnline ? colors.online : colors.offline}
              />
              <Text style={styles.sectionLabel}>Conexión</Text>
            </View>
            <Text style={[styles.statusText, { color: isOnline ? colors.online : colors.offline }]}>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <SeccionFotos />
        </Animated.View>
      </ScrollView>
    </TexturedBackground>
  );
}

/**
 * Diagnóstico de señal en vivo. Vive en su propio componente para que el watcher
 * arranque/se detenga al montar/desmontar (toggle de medición de GPS): así no hay
 * que reiniciar el watcher a mano ni consumir GPS con la medición desactivada.
 */
function GpsDiagnostic() {
  const { lastFix, permissionStatus, servicesEnabled, refresh } = useGpsWatcher();
  const needsEnable = permissionStatus !== 'otorgado' || servicesEnabled === false;

  async function handleEnable() {
    try {
      await openGpsUnblockDialog(permissionStatus !== 'otorgado' ? 'permiso' : 'gps-apagado');
      refresh();
    } catch (e) {
      gpsLog.error('no se pudo habilitar el GPS desde Ajustes', e);
    }
  }

  return (
    <View style={styles.gpsDiagnostic}>
      <GpsSignalIndicator
        lastFix={lastFix}
        permissionStatus={permissionStatus}
        servicesEnabled={servicesEnabled}
      />
      {needsEnable && (
        <TouchableOpacity style={styles.enableButton} onPress={handleEnable} accessibilityRole="button">
          <Ionicons name="navigate-outline" size={16} color={colors.white} />
          <Text style={styles.enableButtonText}>Habilitar GPS</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** La preferencia es la misma que el checkbox del modal de sincronización (#565). */
function SeccionFotos() {
  const { descargarFotos, setDescargarFotos } = useDescargaDeFotosSetting();

  return (
    <>
      <Text style={styles.grupoTitulo}>Fotos</Text>
      <View style={styles.sectionRow}>
        <View style={styles.sectionTextWrap}>
          <Text style={styles.sectionLabel}>Descargar fotos de otros celulares</Text>
          <Text style={styles.hint}>Las fotos sacadas en este celular se suben igual.</Text>
        </View>
        <Switch
          value={descargarFotos}
          onValueChange={setDescargarFotos}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Descargar fotos de otros celulares"
        />
      </View>
      <LiberarEspacio descargarFotos={descargarFotos} />
    </>
  );
}

function LiberarEspacio({ descargarFotos }: { descargarFotos: boolean }) {
  const confirm = useConfirm();
  const { resumen, ocupado, iniciar } = useLiberarEspacio(confirm.show, descargarFotos);
  const sinFotos = !resumen || resumen.fotos === 0;
  const nota = [sinFotos && 'No hay fotos descargadas para liberar.', textoSinSubir(resumen?.sinSubir ?? 0)];

  return (
    <>
      <TouchableOpacity
        style={[styles.liberarButton, (sinFotos || ocupado) && styles.liberarButtonDisabled]}
        onPress={iniciar}
        disabled={sinFotos || ocupado}
        accessibilityRole="button"
      >
        {ocupado
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={styles.liberarButtonText}>{rotuloLiberarEspacio(resumen?.fotos ?? 0, resumen?.bytes ?? 0)}</Text>}
      </TouchableOpacity>
      {resumen && <Text style={styles.hint}>{nota.filter(Boolean).join(' ')}</Text>}
      <ConfirmModal {...confirm.confirmProps} />
    </>
  );
}
