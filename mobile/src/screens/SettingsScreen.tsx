import { View, Text, Switch, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ScreenContainer from '../components/ScreenContainer';
import GpsSignalIndicator from '../components/GpsSignalIndicator';
import { useGpsWatcher } from '../hooks/useGpsWatcher';
import { useGpsEnabledSetting } from '../hooks/useGpsEnabledSetting';
import { useNetStatus } from '../hooks/useNetStatus';
import { openGpsUnblockDialog } from '../services/gps/locationClient';
import { gpsLog } from '../utils/gpsLogger';
import { colors } from '../theme';
import { settingsScreenStyles as styles } from './SettingsScreen.styles';

export default function SettingsScreen() {
  const { gpsEnabled, setGpsEnabled } = useGpsEnabledSetting();
  const { isOnline } = useNetStatus();

  return (
    <ScreenContainer withTexture>
      <View style={styles.innerContainer}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>Ajustes</Text>

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
      </View>
    </ScreenContainer>
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
