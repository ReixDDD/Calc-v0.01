import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWideFormatDirectRollPriceEdit,
  applyWideFormatRollDimensionsEdit,
  applyWideFormatSqmCostEdit,
  computeRollAreaM2,
  computeRollPriceFromSqmCost,
  computeSqmCostFromRoll,
  formatEditableDecimal,
  inferRollDimensionsFromNameAndArea,
  isWideFormatRollMaterialCategory,
  resolveItemSqmCost,
  resolveRollDimensions,
} from './wideFormatPricing';

test('isWideFormatRollMaterialCategory matches strictly wide-format roll materials', () => {
  assert.equal(
    isWideFormatRollMaterialCategory({
      id: 'wf_banners',
      mainCategoryId: 'wide_format',
      kind: 'material',
    }),
    true
  );
  assert.equal(
    isWideFormatRollMaterialCategory({
      id: 'custom_wf_mesh',
      main_category_id: 'wide_format',
      kind: 'material',
    }),
    true
  );
  assert.equal(
    isWideFormatRollMaterialCategory({
      id: 'wf_inks',
      mainCategoryId: 'wide_format',
      kind: 'equipment',
    }),
    false
  );
  assert.equal(
    isWideFormatRollMaterialCategory({
      id: 'papers',
      mainCategoryId: 'polygraphy',
      kind: 'material',
    }),
    false
  );
});

test('inferRollDimensionsFromNameAndArea and resolveRollDimensions extract exact roll width and length', () => {
  assert.deepEqual(
    inferRollDimensionsFromNameAndArea('Баннер литой Frontlit 440 г/м² (рулон 3.2×50м)', 160),
    { widthM: 3.2, lengthM: 50 }
  );
  assert.deepEqual(
    inferRollDimensionsFromNameAndArea(
      'Холст натуральный художественный 340 г/м² (рулон 1.27×18м)',
      22.86
    ),
    { widthM: 1.27, lengthM: 18 }
  );

  const explicit = resolveRollDimensions({
    price: 11970,
    resource: 63,
    roll_width_m: 1.26,
    roll_length_m: 50,
  });
  assert.deepEqual(explicit, { widthM: 1.26, lengthM: 50, areaM2: 63 });
});

test('computeRollAreaM2, computeRollPriceFromSqmCost and computeSqmCostFromRoll handle fractional dimensions', () => {
  const area = computeRollAreaM2(1.27, 18);
  assert.equal(area, 22.86);
  assert.equal(computeRollPriceFromSqmCost(400, area), 9144);
  assert.equal(computeSqmCostFromRoll(9144, area), 400);
});

test('applyWideFormatSqmCostEdit recalculates roll price from width × length × sq.m. cost', () => {
  const banner = {
    id: 101,
    price: 15200,
    resource: 160,
    roll_width_m: 3.2,
    roll_length_m: 50,
  };
  const updated = applyWideFormatSqmCostEdit(banner, 110);
  assert.equal(updated.cost_per_sqm, 110);
  assert.equal(updated.roll_width_m, 3.2);
  assert.equal(updated.roll_length_m, 50);
  assert.equal(updated.resource, 160);
  assert.equal(updated.price, 17600);
});

test('applyWideFormatRollDimensionsEdit updates width, length, area, and roll price while preserving sq.m. cost', () => {
  const banner = {
    id: 102,
    price: 5600,
    resource: 80,
    roll_width_m: 1.6,
    roll_length_m: 50,
  }; // 70 ₽/m²
  const updated = applyWideFormatRollDimensionsEdit(banner, 2.5, 50);
  assert.equal(updated.roll_width_m, 2.5);
  assert.equal(updated.roll_length_m, 50);
  assert.equal(updated.resource, 125);
  assert.equal(updated.cost_per_sqm, 70);
  assert.equal(updated.price, 8750);
});

test('applyWideFormatDirectRollPriceEdit updates roll price cleanly and syncs resolved sq.m. cost', () => {
  const banner = {
    id: 103,
    price: 17600,
    resource: 160,
    roll_width_m: 3.2,
    roll_length_m: 50,
    cost_per_sqm: 110,
  };
  const updated = applyWideFormatDirectRollPriceEdit(banner, 16000);
  assert.equal(updated.price, 16000);
  assert.equal('cost_per_sqm' in updated, false);
  assert.equal(resolveItemSqmCost(updated), 100);
});

test('formatEditableDecimal outputs clean numeric strings without trailing zeroes', () => {
  assert.equal(formatEditableDecimal(95), '95');
  assert.equal(formatEditableDecimal(1.26), '1.26');
  assert.equal(formatEditableDecimal(3.2), '3.2');
});
