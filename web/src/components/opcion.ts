/** Una opción de un selector: la comparten `Select` y `SegmentedControl`. */
export interface Opcion<T extends string | number> {
  value: T;
  label: string;
}
