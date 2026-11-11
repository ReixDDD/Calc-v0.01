export interface MaterialCategoryScopeMeta {
  id: string;
  mainCategoryId?: string;
  main_category_id?: string;
  kind?: 'material' | 'equipment' | string;
}

export interface WideFormatPricedItem {
  name?: string;
  price: number;
  resource: number;
  roll_width_m?: number;
  roll_length_m?: number;
  cost_per_sqm?: number;
}

/**
 * Returns true strictly for wide-format printing roll material categories
 * (e.g. `wf_banners` or custom `material` categories under `wide_format`).
 * Returns false for all other sections (`polygraphy`, `souvenirs`, `stamps`, `design`)
 * and for equipment/ink categories (`wf_inks`, `wf_equipment`).
 */
export function isWideFormatRollMaterialCategory(
  meta: MaterialCategoryScopeMeta | null | undefined
): boolean {
  if (!meta) return false;
  if (meta.id === 'wf_banners') return true;
  const mainCategoryId = meta.mainCategoryId ?? meta.main_category_id ?? '';
  const kind = meta.kind || 'material';
  return mainCategoryId === 'wide_format' && kind === 'material';
}

export function computeRollAreaM2(rollWidthM: number, rollLengthM: number): number {
  const safeW = Number.isFinite(rollWidthM) ? Math.max(0, rollWidthM) : 0;
  const safeL = Number.isFinite(rollLengthM) ? Math.max(0, rollLengthM) : 0;
  return Math.round(safeW * safeL * 10000) / 10000;
}

export function inferRollDimensionsFromNameAndArea(
  name: string,
  areaM2: number
): { widthM: number; lengthM: number } {
  const safeArea = Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 : 0;
  const match = (name || '').match(/(\d+(?:[.,]\d+)?)\s*[×xх*]\s*(\d+(?:[.,]\d+)?)\s*м/i);
  if (match) {
    const parsedW = Number(match[1].replace(',', '.'));
    const parsedL = Number(match[2].replace(',', '.'));
    if (parsedW > 0 && parsedL > 0) {
      if (safeArea <= 0 || Math.abs(parsedW * parsedL - safeArea) <= 0.25) {
        return {
          widthM: Math.round(parsedW * 10000) / 10000,
          lengthM: Math.round(parsedL * 10000) / 10000,
        };
      }
    }
  }
  if (safeArea > 0) {
    const defaultWidth = safeArea >= 1.6 ? 1.6 : 1;
    return {
      widthM: defaultWidth,
      lengthM: Math.round((safeArea / defaultWidth) * 10000) / 10000,
    };
  }
  return { widthM: 1.6, lengthM: 50 };
}

export function resolveRollDimensions(item: WideFormatPricedItem): {
  widthM: number;
  lengthM: number;
  areaM2: number;
} {
  const rawW = Number(item.roll_width_m);
  const rawL = Number(item.roll_length_m);
  if (Number.isFinite(rawW) && rawW > 0 && Number.isFinite(rawL) && rawL > 0) {
    const widthM = Math.round(rawW * 10000) / 10000;
    const lengthM = Math.round(rawL * 10000) / 10000;
    return {
      widthM,
      lengthM,
      areaM2: computeRollAreaM2(widthM, lengthM),
    };
  }
  const inferred = inferRollDimensionsFromNameAndArea(item.name || '', Number(item.resource) || 0);
  const areaM2 =
    computeRollAreaM2(inferred.widthM, inferred.lengthM) ||
    (Number.isFinite(item.resource) ? Math.max(0, item.resource) : 0);
  return {
    widthM: inferred.widthM,
    lengthM: inferred.lengthM,
    areaM2,
  };
}

export function computeRollPriceFromSqmCost(sqmCost: number, rollAreaM2: number): number {
  const safeSqm = Number.isFinite(sqmCost) ? Math.max(0, sqmCost) : 0;
  const safeArea = Number.isFinite(rollAreaM2) ? Math.max(0, rollAreaM2) : 0;
  return Math.round(safeSqm * safeArea * 100) / 100;
}

export function computeSqmCostFromRoll(rollPrice: number, rollAreaM2: number): number {
  const safePrice = Number.isFinite(rollPrice) ? Math.max(0, rollPrice) : 0;
  const safeArea = Number.isFinite(rollAreaM2) ? rollAreaM2 : 0;
  if (safeArea <= 0) return 0;
  return Math.round((safePrice / safeArea) * 100) / 100;
}

export function resolveItemSqmCost(item: WideFormatPricedItem): number {
  const { areaM2 } = resolveRollDimensions(item);
  const effectiveArea = areaM2 > 0 ? areaM2 : Math.max(0, Number(item.resource) || 0);
  if (
    typeof item.cost_per_sqm === 'number' &&
    Number.isFinite(item.cost_per_sqm) &&
    item.cost_per_sqm >= 0
  ) {
    const expectedRollPrice = computeRollPriceFromSqmCost(item.cost_per_sqm, effectiveArea);
    const actualRollPrice = Math.round((Number(item.price) || 0) * 100) / 100;
    if (Math.abs(expectedRollPrice - actualRollPrice) <= 0.05) {
      return Math.round(item.cost_per_sqm * 100) / 100;
    }
  }
  return computeSqmCostFromRoll(item.price, effectiveArea);
}

export function applyWideFormatSqmCostEdit<T extends WideFormatPricedItem>(
  item: T,
  nextSqmCost: number
): T & { roll_width_m: number; roll_length_m: number; cost_per_sqm: number } {
  const { widthM, lengthM, areaM2 } = resolveRollDimensions(item);
  const safeSqm = Number.isFinite(nextSqmCost) ? Math.max(0, Math.round(nextSqmCost * 100) / 100) : 0;
  return {
    ...item,
    roll_width_m: widthM,
    roll_length_m: lengthM,
    resource: areaM2,
    cost_per_sqm: safeSqm,
    price: computeRollPriceFromSqmCost(safeSqm, areaM2),
  };
}

export function applyWideFormatRollDimensionsEdit<T extends WideFormatPricedItem>(
  item: T,
  nextWidthM: number,
  nextLengthM: number,
  currentSqmOverride?: number
): T & { roll_width_m: number; roll_length_m: number; cost_per_sqm: number } {
  const safeWidth = Number.isFinite(nextWidthM) ? Math.max(0, Math.round(nextWidthM * 10000) / 10000) : 0;
  const safeLength = Number.isFinite(nextLengthM) ? Math.max(0, Math.round(nextLengthM * 10000) / 10000) : 0;
  const nextArea = computeRollAreaM2(safeWidth, safeLength);
  const effectiveSqm =
    typeof currentSqmOverride === 'number' && Number.isFinite(currentSqmOverride)
      ? Math.max(0, Math.round(currentSqmOverride * 100) / 100)
      : resolveItemSqmCost(item);
  return {
    ...item,
    roll_width_m: safeWidth,
    roll_length_m: safeLength,
    resource: nextArea,
    cost_per_sqm: effectiveSqm,
    price: computeRollPriceFromSqmCost(effectiveSqm, nextArea),
  };
}

export function applyWideFormatDirectRollPriceEdit<T extends WideFormatPricedItem>(
  item: T,
  nextRollPrice: number
): T & { roll_width_m: number; roll_length_m: number } {
  const { widthM, lengthM, areaM2 } = resolveRollDimensions(item);
  const safePrice = Number.isFinite(nextRollPrice)
    ? Math.max(0, Math.round(nextRollPrice * 100) / 100)
    : 0;
  const nextItem: T & { roll_width_m: number; roll_length_m: number } = {
    ...item,
    roll_width_m: widthM,
    roll_length_m: lengthM,
    resource: areaM2,
    price: safePrice,
  };
  delete nextItem.cost_per_sqm;
  return nextItem;
}

export function formatEditableDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}
