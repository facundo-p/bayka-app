/**
 * Compile-time feature flags.
 *
 * AUTO_PARCELA_DEFAULT: when `true`, creating a plantation also creates a default
 * parcela (`nombre="Parcela 1"`, `codigo="P1"`) atomically — see
 * `PlantationCreationService.createPlantationWithDefaultParcela`. To disable, flip to
 * `false` and rebuild the APK. No backfill of legacy plantations.
 */
export const AUTO_PARCELA_DEFAULT: boolean = true;
