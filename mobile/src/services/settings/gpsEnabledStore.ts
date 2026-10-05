import { crearPreferenciaBooleana } from './preferencia';

// Fuente de verdad compartida entre Ajustes y el registro de árboles.
export const preferenciaGps = crearPreferenciaBooleana({ clave: 'gps_enabled_in_app', porDefecto: true });

export const getGpsEnabled = preferenciaGps.get;
export const subscribeGpsEnabled = preferenciaGps.subscribe;
export const hydrateGpsEnabled = preferenciaGps.hydrate;
export const setGpsEnabled = preferenciaGps.set;

/** Solo para tests: resetea el singleton entre casos. */
export const __resetGpsEnabledStore = preferenciaGps.reset;
