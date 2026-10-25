const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
const METERS_PER_INCH = 0.0254;

/**
 * HealthKit and Health Connect report length in different unit strings.
 * Both readers convert to meters before the dedupe planner sees a sample.
 */
export function quantityToMeters(quantity: { unit: string; quantity: number } | null | undefined): number {
  if (!quantity || !Number.isFinite(quantity.quantity)) return 0;
  switch (quantity.unit) {
    case 'm':
    case 'meter':
    case 'meters':
      return quantity.quantity;
    case 'km':
    case 'kilometer':
    case 'kilometers':
      return quantity.quantity * 1000;
    case 'mi':
    case 'mile':
    case 'miles':
      return quantity.quantity * METERS_PER_MILE;
    case 'ft':
    case 'foot':
    case 'feet':
      return quantity.quantity * METERS_PER_FOOT;
    case 'in':
    case 'inch':
    case 'inches':
      return quantity.quantity * METERS_PER_INCH;
    case 'cm':
      return quantity.quantity / 100;
    default:
      return quantity.quantity;
  }
}

export function lengthToMeters(length: { unit?: string; value?: number; inMeters?: number } | null | undefined): number {
  if (!length) return 0;
  if (typeof length.inMeters === 'number' && Number.isFinite(length.inMeters)) return length.inMeters;
  if (typeof length.value === 'number' && length.unit) {
    return quantityToMeters({ unit: length.unit, quantity: length.value });
  }
  return 0;
}
