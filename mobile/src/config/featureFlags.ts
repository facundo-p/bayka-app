/**
 * Compile-time feature flags for the v1.1 trial.
 *
 * FEATURE: auto-parcela trial — remove block if dropped
 *
 * AUTO_PARCELA_DEFAULT: when `true`, creating a plantation also creates a default
 * parcela `nombre="Parcela 1"`, `codigo="P1"` atomically (see
 * `PlantationCreationService.createPlantationWithDefaultParcela`). Default ON
 * for v1.1 field trial (D-18-02). To disable: flip to `false` and rebuild APK.
 * No backfill of legacy plantations (D-18-07): existing plantations stay as-is.
 */
export const AUTO_PARCELA_DEFAULT: boolean = true;
