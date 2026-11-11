import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  computeBannerGrommetLayout,
  computeBannerGrommetPoints,
  computeBannerSeamLayout,
  MAX_WIDE_FORMAT_PRINT_WIDTH_MM,
  ProductSchematicSVG,
  resolveBindingType,
  resolveSchematicType,
} from './ProductSchematicSVG';
import { ProductItem } from '../types';

const makeMockProduct = (overrides: Partial<ProductItem>): ProductItem => ({
  id: 999,
  category: 'notepads',
  name: 'Блокнот А5',
  width_mm: 148,
  height_mm: 210,
  allow_custom_size: false,
  multi_page_mode: 'pages',
  default_pages: 80,
  allowed_sides: 'both',
  allowed_paper_ids: [17],
  allowed_lamination_ids: [27],
  ...overrides,
});

test('resolveBindingType switches between spiral_top, spiral_side, kbs, staple, bolts, rings, cord', () => {
  const notepad = makeMockProduct({ category: 'notepads', name: 'Блокнот А5' });
  assert.equal(resolveBindingType(notepad, { notepad_bind: 'wire_top' }), 'spiral_top');
  assert.equal(resolveBindingType(notepad, { notepad_bind: 'wire_side' }), 'spiral_side');
  assert.equal(resolveBindingType(notepad, { notepad_bind: 'glue_kbs' }), 'kbs');

  const catalog = makeMockProduct({ category: 'catalogs', name: 'Каталог А4' });
  assert.equal(resolveBindingType(catalog, { mag_binding: 'staple' }), 'staple');
  assert.equal(resolveBindingType(catalog, { mag_binding: 'spiral' }), 'spiral_side');
  assert.equal(resolveBindingType(catalog, { mag_binding: 'pur' }), 'kbs');

  const menu = makeMockProduct({ category: 'menus', name: 'Многостраничное меню А4' });
  assert.equal(resolveBindingType(menu, { menu_fastener: 'bolts' }), 'bolts');
  assert.equal(resolveBindingType(menu, { menu_fastener: 'rings' }), 'rings');
  assert.equal(resolveBindingType(menu, { menu_fastener: 'cord' }), 'cord');
});

test('resolveSchematicType dynamically adapts to menu folding options', () => {
  const foldMenu = makeMockProduct({
    category: 'menus',
    name: 'Меню со сгибом',
    multi_page_mode: 'none',
    schematic_type: 'booklet_1fold',
  });
  assert.equal(resolveSchematicType(foldMenu, { creasing_menu: 'half' }), 'booklet_1fold');
  assert.equal(resolveSchematicType(foldMenu, { creasing_menu: 'two' }), 'booklet_2fold');
});

test('ProductSchematicSVG renders distinct SVG elements when binding changes', () => {
  const notepad = makeMockProduct({ category: 'notepads', name: 'Блокнот А5' });

  const svgTop = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: notepad,
      widthMm: 148,
      heightMm: 210,
      pagesCount: 80,
      isDark: false,
      selectedParams: { notepad_bind: 'wire_top' },
    })
  );
  assert.ok(svgTop.includes('data-binding="spiral_top"'));
  assert.ok(svgTop.includes('На пружине сверху'));

  const svgSide = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: notepad,
      widthMm: 148,
      heightMm: 210,
      pagesCount: 80,
      isDark: false,
      selectedParams: { notepad_bind: 'wire_side' },
    })
  );
  assert.ok(svgSide.includes('data-binding="spiral_side"'));
  assert.ok(svgSide.includes('На пружине сбоку'));

  const svgKbs = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: notepad,
      widthMm: 148,
      heightMm: 210,
      pagesCount: 80,
      isDark: false,
      selectedParams: { notepad_bind: 'glue_kbs' },
    })
  );
  assert.ok(svgKbs.includes('data-binding="kbs"'));
  assert.ok(svgKbs.includes('КБС (клеевой корешок)'));
});

test('ProductSchematicSVG renders Trio 3-block calendar schematic for Календарь Трио', () => {
  const trio = makeMockProduct({
    id: 409,
    category: 'calendars',
    product_kind: 'Календарь «Трио»',
    name: 'Квартальный «Трио Стандарт»',
    width_mm: 297,
    height_mm: 420,
    multi_page_mode: 'sheets',
    default_pages: 4,
    schematic_type: 'calendar_wall',
  });
  const svgTrio = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: trio,
      widthMm: 297,
      heightMm: 420,
      pagesCount: 4,
      isDark: false,
    })
  );
  assert.ok(svgTrio.includes('Трио: 3 блока + курсор'));
  assert.ok(svgTrio.includes('Шпигель (шапка)'));
});

test('ProductSchematicSVG renders thematic schematics for banners, mugs, t-shirts, and round stamps', () => {
  const bannerProd = makeMockProduct({
    id: 1801,
    category: 'wf_banners_cat',
    name: 'Баннер 3 × 2 м (3000 × 2000 мм)',
    width_mm: 3000,
    height_mm: 2000,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });
  assert.equal(resolveSchematicType(bannerProd), 'banner');
  const svgBanner = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 3000,
      heightMm: 2000,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgBanner.includes('data-schematic="banner"'));
  assert.ok(svgBanner.includes('Баннер + люверсы по периметру'));

  const mugProd = makeMockProduct({
    id: 2001,
    category: 'souv_mugs_cat',
    name: 'Кружка с принтом 330 мл',
    width_mm: 200,
    height_mm: 95,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });
  assert.equal(resolveSchematicType(mugProd), 'mug');
  const svgMug = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: mugProd,
      widthMm: 200,
      heightMm: 95,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgMug.includes('data-schematic="mug"'));
  assert.ok(svgMug.includes('200×95 мм'));

  const tshirtProd = makeMockProduct({
    id: 2101,
    category: 'souv_textile_cat',
    name: 'Футболка с нанесением А4',
    width_mm: 210,
    height_mm: 297,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });
  assert.equal(resolveSchematicType(tshirtProd), 'tshirt');
  const svgTshirt = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: tshirtProd,
      widthMm: 210,
      heightMm: 297,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgTshirt.includes('data-schematic="tshirt"'));
  assert.ok(svgTshirt.includes('210×297 мм'));

  const stampProd = makeMockProduct({
    id: 2201,
    category: 'stamps_orgs_cat',
    name: 'Круглая печать организации Ø 40 мм',
    width_mm: 40,
    height_mm: 40,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });
  assert.equal(resolveSchematicType(stampProd), 'stamp_round');
  const svgStamp = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: stampProd,
      widthMm: 40,
      heightMm: 40,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgStamp.includes('data-schematic="stamp_round"'));
  assert.ok(svgStamp.includes('Ø 40 мм'));
});

test('ProductSchematicSVG bounds text and dimensions on narrow formats (148x440 table-tent)', () => {
  const narrowTent = makeMockProduct({
    id: 3001,
    category: 'table_tents',
    name: 'Тейбл-тент Домик 148×210 (развертка 148×440)',
    width_mm: 148,
    height_mm: 440,
    base_mm: 30,
    multi_page_mode: 'none',
    schematic_type: 'calendar_house',
  });
  const svgTent = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: narrowTent,
      widthMm: 148,
      heightMm: 440,
      pagesCount: 1,
      isDark: true,
    })
  );
  assert.ok(svgTent.includes('clipPath id="schematic-rect-clip"'));
  assert.ok(svgTent.includes('Дно 148×30'));
  assert.ok(svgTent.includes('Замок 148×30'));
  assert.ok(svgTent.includes('30 мм'));
  assert.ok(svgTent.includes('#25282E'));
  assert.ok(svgTent.includes('#32363E'));
  assert.ok(!svgTent.includes('#FEF2E2'));

  const svgTentLight = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: narrowTent,
      widthMm: 148,
      heightMm: 440,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgTentLight.includes('#FFFFFF'));
  assert.ok(svgTentLight.includes('#C02721'));
  assert.ok(svgTentLight.includes('#E2E8F0'));
  assert.ok(!svgTentLight.includes('#FEF2E2'));
});

test('ProductSchematicSVG displays dimensions in centimeters for wide-format products and millimeters for polygraphy', () => {
  const wfPoster = makeMockProduct({
    id: 2004,
    category: 'wf_posters_cat',
    name: 'Широкоформатный плакат / Холст А1 (594 × 841 мм)',
    width_mm: 594,
    height_mm: 841,
    multi_page_mode: 'none',
    schematic_type: 'flat',
  });
  const svgWfPoster = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: wfPoster,
      widthMm: 594,
      heightMm: 841,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgWfPoster.includes('59.4 см'));
  assert.ok(svgWfPoster.includes('84.1 см'));
  assert.ok(!svgWfPoster.includes('594 мм'));

  const polyFlyer = makeMockProduct({
    id: 101,
    category: 'flyers',
    name: 'Листовка А5 (148 × 210 мм)',
    width_mm: 148,
    height_mm: 210,
    multi_page_mode: 'none',
    schematic_type: 'flat',
  });
  const svgPolyFlyer = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: polyFlyer,
      widthMm: 148,
      heightMm: 210,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.ok(svgPolyFlyer.includes('148 мм'));
  assert.ok(svgPolyFlyer.includes('210 мм'));
});

test('ProductSchematicSVG places grommets at all 4 corners and spaces interior grommets at the exact chosen physical step', () => {
  const modes = ['corners', '50', '30', '25', '20', '15'] as const;
  for (const mode of modes) {
    const layout = computeBannerGrommetLayout({
      x0: 46,
      y0: 65,
      rectW: 248,
      rectH: 129,
      widthMm: 2000,
      heightMm: 1000,
      eyeletsEnabled: true,
      spacingMode: mode,
      hemCenterInset: 5,
    });
    const cornersOnly = layout.points.filter((p) => p.isCorner);
    assert.equal(layout.radius, 1.75);
    assert.equal(layout.strokeWidth, 1.15);
    assert.deepEqual(cornersOnly, [
      { cx: 51, cy: 70, isCorner: true },
      { cx: 289, cy: 70, isCorner: true },
      { cx: 51, cy: 189, isCorner: true },
      { cx: 289, cy: 189, isCorner: true },
    ]);

    if (mode !== 'corners') {
      const stepCm = Number(mode);
      const stepMm = stepCm * 10;
      const spanX = 289 - 51; // 238 px for 2000 mm -> 1.19 px/cm
      const spanY = 189 - 70; // 119 px for 1000 mm -> 1.19 px/cm (exact isotropic scale)

      const topInteriorXs = layout.points
        .filter((p) => !p.isCorner && p.cy === 70)
        .map((p) => p.cx)
        .sort((a, b) => a - b);
      assert.ok(topInteriorXs.length >= 2);
      for (let i = 1; i < topInteriorXs.length; i += 1) {
        const gapPx = topInteriorXs[i] - topInteriorXs[i - 1];
        const gapMm = (gapPx / spanX) * 2000;
        assert.ok(
          Math.abs(gapMm - stepMm) < 0.5,
          `Expected X step ${stepMm}mm for mode ${mode}, got ${gapMm}mm`
        );
      }

      const leftInteriorYs = layout.points
        .filter((p) => !p.isCorner && p.cx === 51)
        .map((p) => p.cy)
        .sort((a, b) => a - b);
      if (leftInteriorYs.length >= 2) {
        const gapYPx = leftInteriorYs[1] - leftInteriorYs[0];
        const gapXPx = topInteriorXs[1] - topInteriorXs[0];
        assert.ok(
          Math.abs(gapXPx - gapYPx) < 0.1,
          `Expected isotropic X/Y step px (${gapXPx} vs ${gapYPx}) for mode ${mode}`
        );
      }

      assert.ok(layout.stepSegment !== null);
      assert.equal(layout.stepSegment?.stepCm, stepCm);
    }
  }

  // Verify 300 x 200 cm banner never caps 20 cm and 15 cm to identical counts
  const counts300x200 = (['50', '30', '25', '20', '15'] as const).map(
    (mode) =>
      computeBannerGrommetPoints({
        x0: 46,
        y0: 50,
        rectW: 248,
        rectH: 169,
        widthMm: 3000,
        heightMm: 2000,
        eyeletsEnabled: true,
        spacingMode: mode,
      }).length
  );
  assert.deepEqual(counts300x200, [20, 34, 40, 50, 66]);

  const bannerProd = makeMockProduct({
    id: 2001,
    category: 'wf_banners_cat',
    name: 'Баннер с люверсами (2000 × 1000 мм)',
    width_mm: 2000,
    height_mm: 1000,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });

  const svgCorners = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 2000,
      heightMm: 1000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: 'corners' },
    })
  );
  assert.ok(svgCorners.includes('Баннер + люверсы по углам'));
  assert.equal((svgCorners.match(/<circle /g) || []).length, 4);
  assert.equal((svgCorners.match(/data-corner-grommet="true"/g) || []).length, 4);
  assert.ok(!svgCorners.includes('data-grommet-step-dim='));

  const svgStep30 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 2000,
      heightMm: 1000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: '30' },
    })
  );
  assert.ok(svgStep30.includes('Баннер + люверсы (шаг 30 см)'));
  assert.ok(!svgStep30.includes('data-grommet-step-dim='));
  assert.equal((svgStep30.match(/data-corner-grommet="true"/g) || []).length, 4);
  assert.equal((svgStep30.match(/<circle /g) || []).length, 20);

  const svgStep15 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 2000,
      heightMm: 1000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: '15' },
    })
  );
  assert.ok(svgStep15.includes('Баннер + люверсы (шаг 15 см)'));
  assert.ok(!svgStep15.includes('data-grommet-step-dim='));
  assert.equal((svgStep15.match(/data-corner-grommet="true"/g) || []).length, 4);
  assert.equal((svgStep15.match(/<circle /g) || []).length, 40);

  const svgNoEyelets = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 2000,
      heightMm: 1000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: false, eyelets_step: '15' },
    })
  );
  assert.ok(svgNoEyelets.includes('Баннер без люверсов'));
  assert.equal((svgNoEyelets.match(/<circle /g) || []).length, 0);
  assert.ok(!svgNoEyelets.includes('data-grommet-step-dim='));
});

test('ProductSchematicSVG and computeBannerSeamLayout cut full 300 cm strips first and narrow remainder strip last', () => {
  assert.equal(MAX_WIDE_FORMAT_PRINT_WIDTH_MM, 3000);

  // Single-piece cases: at least one side <= 300 cm (3000 mm)
  for (const [wMm, hMm] of [
    [2000, 1000],
    [3000, 2000],
    [3000, 3000],
    [5000, 3000],
    [3000, 5000],
    [12000, 3000],
  ]) {
    const seam = computeBannerSeamLayout({
      x0: 46,
      y0: 40,
      rectW: 240,
      rectH: 180,
      widthMm: wMm,
      heightMm: hMm,
    });
    assert.equal(seam.hasSeams, false, `Expected no seams for ${wMm}x${hMm} mm`);
    assert.equal(seam.stripsCount, 1);
    assert.equal(seam.seamsCount, 0);
    assert.equal(seam.seamPositionsPx.length, 0);
  }

  // 450 x 350 cm -> 300 cm strip + 150 cm narrow strip (seam at 2/3, NOT 1/2)
  const seam450x350 = computeBannerSeamLayout({
    x0: 46,
    y0: 40,
    rectW: 240,
    rectH: 180,
    widthMm: 4500,
    heightMm: 3500,
  });
  assert.equal(seam450x350.hasSeams, true);
  assert.equal(seam450x350.orientation, 'vertical');
  assert.equal(seam450x350.stripsCount, 2);
  assert.equal(seam450x350.seamsCount, 1);
  assert.deepEqual(seam450x350.stripSizesCm, [300, 150]);
  assert.equal(seam450x350.lastStripSizeCm, 150);
  assert.deepEqual(seam450x350.seamPositionsPx, [206]);

  // 600 x 400 cm -> 2 full vertical strips of 300 cm each
  const seam600x400 = computeBannerSeamLayout({
    x0: 46,
    y0: 40,
    rectW: 240,
    rectH: 160,
    widthMm: 6000,
    heightMm: 4000,
  });
  assert.equal(seam600x400.hasSeams, true);
  assert.equal(seam600x400.orientation, 'vertical');
  assert.deepEqual(seam600x400.stripSizesCm, [300, 300]);
  assert.deepEqual(seam600x400.seamPositionsPx, [166]);

  // 700 x 400 cm -> 300 + 300 + 100 cm vertical strips (seams at 3/7 and 6/7)
  const seam700x400 = computeBannerSeamLayout({
    x0: 40,
    y0: 40,
    rectW: 240,
    rectH: 150,
    widthMm: 7000,
    heightMm: 4000,
  });
  assert.equal(seam700x400.hasSeams, true);
  assert.equal(seam700x400.orientation, 'vertical');
  assert.equal(seam700x400.stripsCount, 3);
  assert.equal(seam700x400.seamsCount, 2);
  assert.deepEqual(seam700x400.stripSizesCm, [300, 300, 100]);
  assert.deepEqual(seam700x400.seamPositionsPx, [142.86, 245.71]);

  // 400 x 700 cm (portrait) -> 300 + 300 + 100 cm horizontal strips
  const seam400x700 = computeBannerSeamLayout({
    x0: 60,
    y0: 30,
    rectW: 120,
    rectH: 180,
    widthMm: 4000,
    heightMm: 7000,
  });
  assert.equal(seam400x700.hasSeams, true);
  assert.equal(seam400x700.orientation, 'horizontal');
  assert.deepEqual(seam400x700.stripSizesCm, [300, 300, 100]);
  assert.deepEqual(seam400x700.seamPositionsPx, [107.14, 184.29]);

  // Near-threshold 305 x 302 cm (300 + 5 cm vertical) keeps narrow strip inside 10px perimeter hem
  const seam305x302 = computeBannerSeamLayout({
    x0: 60,
    y0: 40,
    rectW: 200,
    rectH: 198,
    widthMm: 3050,
    heightMm: 3020,
  });
  assert.equal(seam305x302.orientation, 'vertical');
  assert.deepEqual(seam305x302.stripSizesCm, [300, 5]);
  assert.ok(seam305x302.seamPositionsPx[0] <= 60 + 200 - 16);

  // Portrait 305 x 350 cm chooses horizontal seam (300 + 50 cm along height, less roll feed)
  const seam305x350 = computeBannerSeamLayout({
    x0: 60,
    y0: 40,
    rectW: 174,
    rectH: 200,
    widthMm: 3050,
    heightMm: 3500,
  });
  assert.equal(seam305x350.orientation, 'horizontal');
  assert.deepEqual(seam305x350.stripSizesCm, [300, 50]);

  const bannerProd = makeMockProduct({
    id: 2002,
    category: 'wf_banners_cat',
    name: 'Баннер произвольного размера',
    width_mm: 3000,
    height_mm: 2000,
    allow_custom_size: true,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });

  // 500 x 300 cm -> no seam in SVG
  const svg500x300 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 5000,
      heightMm: 3000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: '30' },
    })
  );
  assert.equal((svg500x300.match(/data-banner-seam="true"/g) || []).length, 0);
  assert.ok(!svg500x300.includes('Склейка:'));

  // 450 x 350 cm -> 1 vertical seam + "Склейка: 300 + 150 см"
  const svg450x350 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 4500,
      heightMm: 3500,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: '30' },
    })
  );
  assert.equal((svg450x350.match(/data-banner-seam="true"/g) || []).length, 1);
  assert.equal((svg450x350.match(/data-seam-orientation="vertical"/g) || []).length, 1);
  assert.ok(svg450x350.includes('Склейка: 300 + 150 см'));

  // 700 x 400 cm -> 2 vertical seams + "Склейка: 300 + 300 + 100 см"
  const svg700x400 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 7000,
      heightMm: 4000,
      pagesCount: 1,
      isDark: true,
      selectedParams: { eyelets: true, eyelets_step: '30' },
    })
  );
  assert.equal((svg700x400.match(/data-banner-seam="true"/g) || []).length, 2);
  assert.ok(svg700x400.includes('Склейка: 300 + 300 + 100 см'));

  // 950 x 400 cm -> 3 vertical seams + compact "Склейка: 3×300 + 50 см"
  const svg950x400 = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: bannerProd,
      widthMm: 9500,
      heightMm: 4000,
      pagesCount: 1,
      isDark: false,
      selectedParams: { eyelets: true, eyelets_step: '30' },
    })
  );
  assert.equal((svg950x400.match(/data-banner-seam="true"/g) || []).length, 3);
  assert.ok(svg950x400.includes('Склейка: 3×300 + 50 см'));

  // Wide-format flat product (e.g. film/poster) > 300 x 300 cm also renders 300 + narrow seam
  const wfFilmProd = makeMockProduct({
    id: 2010,
    category: 'wf_films_cat',
    name: 'Самоклеящаяся плёнка',
    width_mm: 4000,
    height_mm: 3500,
    allow_custom_size: true,
    multi_page_mode: 'none',
    schematic_type: 'auto',
  });
  const svgFilmSeam = renderToStaticMarkup(
    React.createElement(ProductSchematicSVG, {
      prod: wfFilmProd,
      widthMm: 4000,
      heightMm: 3500,
      pagesCount: 1,
      isDark: false,
    })
  );
  assert.equal((svgFilmSeam.match(/data-banner-seam="true"/g) || []).length, 1);
  assert.ok(svgFilmSeam.includes('Склейка: 300 + 100 см'));
});

