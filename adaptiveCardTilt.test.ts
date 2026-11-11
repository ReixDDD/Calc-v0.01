import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdaptiveCardTilt,
  formatAdaptiveCardTiltCssVars,
  isTrueCardPointerLeave,
  shouldUseFlatCardHover,
} from './adaptiveCardTilt';

test('computeAdaptiveCardTilt returns null for non-positive or non-finite dimensions', () => {
  assert.equal(computeAdaptiveCardTilt(0, 200), null);
  assert.equal(computeAdaptiveCardTilt(220, -10), null);
  assert.equal(computeAdaptiveCardTilt(Number.NaN, 200), null);
  assert.equal(computeAdaptiveCardTilt(200, Number.POSITIVE_INFINITY), null);
});

test('computeAdaptiveCardTilt applies -0.5deg subtle tilt for catalog cards and 0deg for flat header cards while keeping scale', () => {
  const homeMainCat = computeAdaptiveCardTilt(363, 229);
  const subcatSquare = computeAdaptiveCardTilt(218, 223);
  const sidebarKind = computeAdaptiveCardTilt(200, 211);
  const megaMenuFlat = computeAdaptiveCardTilt(240, 88, { flat: true });
  const megaMenu3dRef = computeAdaptiveCardTilt(240, 88, { flat: false });

  assert.ok(homeMainCat && subcatSquare && sidebarKind && megaMenuFlat && megaMenu3dRef);

  assert.equal(homeMainCat.tiltAngleDeg, -0.5);
  assert.equal(subcatSquare.tiltAngleDeg, -0.5);
  assert.equal(sidebarKind.tiltAngleDeg, -0.5);

  // Header mega-menu cards have zero 3D tilt (0deg) while preserving exact hover enlargement
  assert.equal(megaMenuFlat.tiltAngleDeg, 0);
  assert.equal(megaMenuFlat.scale, megaMenu3dRef.scale);
  assert.equal(megaMenuFlat.visualScale, megaMenu3dRef.visualScale);
  assert.ok(megaMenuFlat.scale > 1.018 && megaMenuFlat.scale <= 1.024);

  // Wider cards use a gentler scale factor so pixel expansion (~2.6px per side) stays consistent
  assert.ok(homeMainCat.scale >= 1.014 && homeMainCat.scale <= 1.018);
  assert.ok(subcatSquare.scale > homeMainCat.scale && subcatSquare.scale <= 1.024);
  assert.ok(sidebarKind.scale >= subcatSquare.scale && sidebarKind.scale <= 1.024);
});

test('shouldUseFlatCardHover detects header cards and explicit data-flat-card markers', () => {
  assert.equal(shouldUseFlatCardHover({}), false);
  assert.equal(shouldUseFlatCardHover({ flatDatasetValue: 'false', isInsideHeader: false }), false);
  assert.equal(shouldUseFlatCardHover({ flatDatasetValue: 'true', isInsideHeader: false }), true);
  assert.equal(shouldUseFlatCardHover({ isInsideHeader: true }), true);
});

test('computeAdaptiveCardTilt clamps extreme card sizes safely and formats CSS vars', () => {
  const tiny = computeAdaptiveCardTilt(90, 90);
  const huge = computeAdaptiveCardTilt(800, 400);
  const flatHeader = computeAdaptiveCardTilt(240, 88, { flat: true });

  assert.ok(tiny && huge && flatHeader);
  assert.equal(tiny.scale, 1.024);
  assert.equal(huge.scale, 1.014);

  const vars = formatAdaptiveCardTiltCssVars(tiny);
  assert.equal(vars['--card-tilt-angle'], '-0.5deg');
  assert.equal(vars['--card-hover-scale'], '1.024');
  assert.ok(Number(vars['--card-visual-scale']) > 1.024);

  const flatVars = formatAdaptiveCardTiltCssVars(flatHeader);
  assert.equal(flatVars['--card-tilt-angle'], '0deg');
  assert.ok(Number(flatVars['--card-hover-scale']) > 1.02);
});

test('isTrueCardPointerLeave distinguishes internal child traversal from true card boundary crossing', () => {
  const cardA = { id: 'A' };
  const cardB = { id: 'B' };

  assert.equal(isTrueCardPointerLeave(null, cardA), false);
  assert.equal(isTrueCardPointerLeave(cardA, cardA), false);
  assert.equal(isTrueCardPointerLeave(cardA, cardB), true);
  assert.equal(isTrueCardPointerLeave(cardA, null), true);
});
