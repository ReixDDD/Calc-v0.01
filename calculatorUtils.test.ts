import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_QUICK_TIERS,
  POLYGRAPHY_UNIT_TIERS,
  WIDE_FORMAT_TIERS,
  SOUVENIRS_TIERS,
  STAMPS_TIERS,
  DESIGN_TIERS,
  getQuickQuantityTiers,
  getMaterialFieldMeta,
  getPagesStepAndMin,
  normalizePagesForBinding,
  computeSra3Layout,
  BANNER_MARGIN_OPTIONS,
  buildEstimateDraftFromSelection,
  cmToMm,
  computeEyeletsCountPerUnit,
  EYELET_SPACING_OPTIONS,
  formatDimensionsTextInCm,
  formatEyeletParamLabel,
  formatMmAsCm,
  formatSingleQuoteText,
  formatFullEstimateText,
  calculateEstimateTotal,
  calculateEstimatePricing,
  getDefaultBannerMarginCm,
  isBannerProduct,
  isEyeletCostParam,
  isWideFormatSectionOrCategory,
  mmToCm,
  resolveBannerMarginCm,
  resolveEyeletSpacing,
} from './calculatorUtils';
import { EstimateItem } from './types';

describe('calculatorUtils', () => {
  it('returns standard quick quantity tiers by default and section-specific tiers for all main categories', () => {
    assert.deepEqual(getQuickQuantityTiers('business_cards', undefined, 'polygraphy'), [
      ...STANDARD_QUICK_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('calendars', undefined, 'polygraphy'), [
      ...POLYGRAPHY_UNIT_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('notepads', undefined, 'polygraphy'), [
      ...POLYGRAPHY_UNIT_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('wf_banners_cat', undefined, 'wide_format'), [
      ...WIDE_FORMAT_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('souv_mugs_cat', undefined, 'souvenirs'), [
      ...SOUVENIRS_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('stamps_orgs_cat', undefined, 'stamps'), [
      ...STAMPS_TIERS,
    ]);
    assert.deepEqual(getQuickQuantityTiers('design_poly_cat', undefined, 'design'), [
      ...DESIGN_TIERS,
    ]);

    assert.deepEqual(
      getQuickQuantityTiers('flyers', [
        { min_qty: 1, coefficient: 5 },
        { min_qty: 50, coefficient: 4 },
        { min_qty: 100, coefficient: 3 },
        { min_qty: 250, coefficient: 2.5 },
        { min_qty: 500, coefficient: 2 },
      ]),
      [50, 100, 250, 500]
    );

    // Public catalog number[] tiers
    assert.deepEqual(
      getQuickQuantityTiers('flyers', [1, 50, 100, 300, 1000], 'polygraphy'),
      [50, 100, 300, 1000]
    );
    assert.deepEqual(
      getQuickQuantityTiers('wf_banners_cat', [1, 5, 10, 50], 'wide_format'),
      [1, 5, 10, 50]
    );
  });

  it('returns dynamic material field labels for polygraphy, wide_format, souvenirs, and stamps', () => {
    assert.equal(getMaterialFieldMeta('polygraphy').label, 'Бумага');
    assert.equal(
      getMaterialFieldMeta('wide_format').label,
      'Материал (баннер / плёнка / холст)'
    );
    assert.equal(getMaterialFieldMeta('souvenirs').label, 'Заготовка / Изделие');
    assert.equal(getMaterialFieldMeta('stamps').label, 'Оснастка');
  });

  it('enforces step=4 and min=8 for staple binding in multi_page_mode=pages', () => {
    const stapleCfg = getPagesStepAndMin('pages', 'staple');
    assert.equal(stapleCfg.step, 4);
    assert.equal(stapleCfg.min, 8);
    assert.equal(stapleCfg.isStaple, true);

    const spiralCfg = getPagesStepAndMin('pages', 'spiral_side');
    assert.equal(spiralCfg.step, 2);
    assert.equal(spiralCfg.min, 4);
    assert.equal(spiralCfg.min, 4);
    assert.equal(spiralCfg.isStaple, false);

    const kbsCfg = getPagesStepAndMin('pages', 'kbs');
    assert.equal(kbsCfg.step, 2);
    assert.equal(kbsCfg.min, 4);
    assert.equal(kbsCfg.isStaple, false);

    assert.deepEqual(normalizePagesForBinding(4, 'pages', 'staple'), {
      normalized: 8,
      wasAdjusted: true,
    });
    assert.deepEqual(normalizePagesForBinding(10, 'pages', 'staple'), {
      normalized: 12,
      wasAdjusted: true,
    });
    assert.deepEqual(normalizePagesForBinding(12, 'pages', 'staple'), {
      normalized: 12,
      wasAdjusted: false,
    });
    assert.deepEqual(normalizePagesForBinding(10, 'pages', 'spiral_side'), {
      normalized: 10,
      wasAdjusted: false,
    });
  });

  it('computes SRA3 layout for standard 90x50 business card (24 items per sheet)', () => {
    const layout = computeSra3Layout(90, 50);
    assert.equal(layout.sra3WidthMm, 320);
    assert.equal(layout.sra3HeightMm, 450);
    assert.equal(layout.usableWidthMm, 310);
    assert.equal(layout.usableHeightMm, 440);
    assert.equal(layout.itemsPerSheet, 24);
    assert.equal(layout.rects.length, 24);
  });

  it('computes SRA3 layout for A4 210x297 (2 items per sheet, rotated)', () => {
    const layout = computeSra3Layout(210, 297);
    assert.equal(layout.itemsPerSheet, 2);
    assert.equal(layout.rotated, true);
    assert.equal(layout.cols, 1);
    assert.equal(layout.rows, 2);
  });

  it('formats single quote text and full estimate commercial proposal text accurately and omits disabled paper/lamination for design', () => {
    const draft = {
      categoryName: 'Визитки',
      productName: 'Стандартная (90 × 50 мм)',
      formatLabel: '90 × 50 мм',
      paperLabel: 'Плотная матовая бумага 300 г/м²',
      printLabel: 'Односторонняя (4+0)',
      laminationLabel: 'Нет',
      extraParamsLabel: 'Скругление углов',
      quantity: 100,
      unitPrice: 5,
      totalPrice: 500,
    };

    const singleText = formatSingleQuoteText(draft);
    assert.match(singleText, /Изделие: Визитки — Стандартная \(90 × 50 мм\)/);
    assert.match(singleText, /Формат: 90 × 50 мм/);
    assert.match(singleText, /Бумага\/Материал: Плотная матовая бумага 300 г\/м²/);
    assert.match(singleText, /Печать: Односторонняя \(4\+0\)/);
    assert.match(singleText, /Ламинация: Нет/);
    assert.match(singleText, /Доп\. работы: Скругление углов/);
    assert.match(singleText, /Тираж: 100 шт\./);
    assert.match(singleText, /Цена за шт\.: 5 ₽\/шт\./);
    assert.match(singleText, /Итоговая стоимость: 500 ₽/);

    // Проверка для услуг дизайна (без бумаги, печати и ламинации)
    const designDraft = buildEstimateDraftFromSelection({
      mainCategoryId: 'design',
      categoryName: 'Дизайн полиграфии',
      currentProduct: {
        id: 2301,
        category: 'design_poly_cat',
        name: 'Дизайн визитки / листовки',
        width_mm: 90,
        height_mm: 50,
        allow_custom_size: false,
        multi_page_mode: 'none',
        default_pages: 1,
        allowed_sides: 'single_only',
        show_paper_select: false,
        show_print_sides: false,
        show_lamination_select: false,
        allowed_paper_ids: [],
        allowed_lamination_ids: [],
      },
      effectiveW: 90,
      effectiveH: 50,
      pagesCount: 1,
      quantity: 1,
      selectedPaperId: 0,
      selectedCoverPaperId: 0,
      allowedPapers: [],
      allowedCoverPapers: [],
      printSides: 1,
      blockPrintMode: '4+4',
      coverPrintMode: '4+0',
      laminationSides: 0,
      selectedLaminationId: null,
      allowedLaminations: [],
      selectedClientParams: {},
      calcResult: { client_price: 1500, unit_price: 1500, quantity: 1 },
    });

    const designQuote = formatSingleQuoteText(designDraft);
    assert.ok(!designQuote.includes('Бумага'));
    assert.ok(!designQuote.includes('Ламинация'));

    const items: EstimateItem[] = [
      { id: '1', createdAt: '2026-11-01', customNote: 'Срочный тираж', ...draft },
      {
        id: '2',
        createdAt: '2026-11-01',
        categoryName: 'Листовки',
        productName: 'А6 (105 × 148 мм)',
        formatLabel: '105 × 148 мм',
        paperLabel: 'Мелованная 150 г/м²',
        printLabel: 'Двусторонняя (4+4)',
        laminationLabel: 'Нет',
        extraParamsLabel: 'Нет',
        quantity: 250,
        unitPrice: 6,
        totalPrice: 1500,
      },
    ];

    assert.equal(calculateEstimateTotal(items), 2000);
    assert.equal(calculateEstimateTotal(items, 10), 1800);

    const pricingWithDiscount = calculateEstimatePricing(items, 15);
    assert.equal(pricingWithDiscount.subtotal, 2000);
    assert.equal(pricingWithDiscount.discountPercent, 15);
    assert.equal(pricingWithDiscount.discountAmount, 300);
    assert.equal(pricingWithDiscount.finalTotal, 1700);

    const fullText = formatFullEstimateText(items, {
      customerName: 'ООО «Вектор»',
      comment: 'Срок изготовления 2 рабочих дня',
      discountPercent: 10,
    });
    assert.match(fullText, /КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ/);
    assert.match(fullText, /Заказчик: ООО «Вектор»/);
    assert.match(fullText, /Условия \/ комментарий: Срок изготовления 2 рабочих дня/);
    assert.match(fullText, /1\. Визитки — Стандартная/);
    assert.match(fullText, /Примечание: Срочный тираж/);
    assert.match(fullText, /2\. Листовки — А6/);
    assert.match(fullText, /Сумма без скидки:/);
    assert.match(fullText, /Скидка \(10%\)/);
    assert.match(fullText, /ИТОГО К ОПЛАТЕ \(2 поз\.\)/);

    const shareUrl = 'https://calc.example.ru/cart?share=a1b2c3d4e5f60718';
    const fullTextWithLink = formatFullEstimateText(
      items,
      {
        customerName: 'ООО «Вектор»',
        comment: 'Срок изготовления 2 рабочих дня',
        discountPercent: 10,
      },
      shareUrl
    );
    assert.match(
      fullTextWithLink,
      /🔗 Ссылка на корзину: https:\/\/calc\.example\.ru\/cart\?share=a1b2c3d4e5f60718/
    );
  });

  it('converts millimeters and centimeters cleanly and formats wide-format estimate items in cm while keeping polygraphy in mm', () => {
    assert.equal(isWideFormatSectionOrCategory('wide_format', 'custom_cat'), true);
    assert.equal(isWideFormatSectionOrCategory('polygraphy', 'wf_banners_cat'), true);
    assert.equal(isWideFormatSectionOrCategory('polygraphy', 'flyers'), false);
    assert.equal(isWideFormatSectionOrCategory('souvenirs', 'souv_mugs_cat'), false);

    assert.equal(mmToCm(2000), 200);
    assert.equal(mmToCm(594), 59.4);
    assert.equal(mmToCm(841), 84.1);
    assert.equal(cmToMm(250), 2500);
    assert.equal(cmToMm(59.4), 594);
    assert.equal(cmToMm(120.5), 1205);
    assert.equal(formatMmAsCm(1600), '160');
    assert.equal(formatMmAsCm(594), '59.4');

    assert.equal(
      formatDimensionsTextInCm('Баннер с люверсами (2000 × 1000 мм)'),
      'Баннер с люверсами (200 × 100 см)'
    );
    assert.equal(
      formatDimensionsTextInCm('Широкоформатный плакат / Холст А1 (594 × 841 мм)'),
      'Широкоформатный плакат / Холст А1 (59.4 × 84.1 см)'
    );
    assert.equal(formatDimensionsTextInCm('2010 × 1010 мм'), '201 × 101 см');
    assert.equal(
      formatDimensionsTextInCm('Печать на пластике ПВХ 5 мм (1000 × 700 мм)'),
      'Печать на пластике ПВХ 5 мм (100 × 70 см)'
    );

    const wfDraft = buildEstimateDraftFromSelection({
      mainCategoryId: 'wide_format',
      categoryName: 'Баннеры и растяжки',
      currentProduct: {
        id: 2001,
        category: 'wf_banners_cat',
        name: 'Баннер с люверсами (2000 × 1000 мм)',
        width_mm: 2000,
        height_mm: 1000,
        allow_custom_size: true,
        multi_page_mode: 'none',
        default_pages: 1,
        allowed_sides: 'single_only',
        show_paper_select: true,
        show_print_sides: false,
        show_lamination_select: false,
        allowed_paper_ids: [101],
        allowed_lamination_ids: [],
      },
      effectiveW: 2500,
      effectiveH: 1800,
      pagesCount: 1,
      quantity: 2,
      selectedPaperId: 101,
      selectedCoverPaperId: 101,
      allowedPapers: [{ id: 101, name: 'Баннер ламинированный 340 г/м²' }],
      allowedCoverPapers: [],
      printSides: 1,
      blockPrintMode: '4+4',
      coverPrintMode: '4+0',
      laminationSides: 0,
      selectedLaminationId: null,
      allowedLaminations: [],
      selectedClientParams: {},
      calcResult: { client_price: 4200, unit_price: 2100, quantity: 2 },
    });

    assert.equal(wfDraft.formatLabel, '250 × 180 см');
    assert.equal(wfDraft.productName, 'Баннер с люверсами (200 × 100 см)');
    assert.equal(wfDraft.widthMm, 2500);
    assert.equal(wfDraft.heightMm, 1800);

    const polyDraft = buildEstimateDraftFromSelection({
      mainCategoryId: 'polygraphy',
      categoryName: 'Листовки',
      currentProduct: {
        id: 101,
        category: 'flyers',
        name: 'Листовка А5 (148 × 210 мм)',
        width_mm: 148,
        height_mm: 210,
        allow_custom_size: true,
        multi_page_mode: 'none',
        default_pages: 1,
        allowed_sides: 'both',
        show_paper_select: true,
        show_print_sides: true,
        show_lamination_select: false,
        allowed_paper_ids: [1],
        allowed_lamination_ids: [],
      },
      effectiveW: 148,
      effectiveH: 210,
      pagesCount: 1,
      quantity: 100,
      selectedPaperId: 1,
      selectedCoverPaperId: 1,
      allowedPapers: [{ id: 1, name: 'Мелованная 130 г/м²' }],
      allowedCoverPapers: [],
      printSides: 1,
      blockPrintMode: '4+4',
      coverPrintMode: '4+0',
      laminationSides: 0,
      selectedLaminationId: null,
      allowedLaminations: [],
      selectedClientParams: {},
      calcResult: { client_price: 900, unit_price: 9, quantity: 100 },
    });

    assert.equal(polyDraft.formatLabel, '148 × 210 мм');
    assert.equal(polyDraft.productName, 'Листовка А5 (148 × 210 мм)');
  });

  it('supports eyelet spacing choices (15, 20, 25, 30, 50 cm and corners) and formats cart extra params cleanly', () => {
    assert.deepEqual(
      EYELET_SPACING_OPTIONS.map((o) => `${o.id}:${o.label}`),
      [
        '15:15 см',
        '20:20 см',
        '25:25 см',
        '30:30 см',
        '50:50 см',
        'corners:По углам',
      ]
    );

    assert.equal(
      isEyeletCostParam(
        { id: 'eyelets', name: 'Установка люверсов', input_type: 'checkbox' },
        'wide_format',
        'wf_banners_cat'
      ),
      true
    );
    assert.equal(
      isEyeletCostParam(
        { id: 'trio_blocks', name: 'Комплект + люверс + курсор', input_type: 'checkbox' },
        'polygraphy',
        'calendars'
      ),
      false
    );

    assert.equal(resolveEyeletSpacing({}), '30');
    assert.equal(resolveEyeletSpacing({ eyelets_step: '15' }), '15');
    assert.equal(resolveEyeletSpacing({ eyelets_step: 'corners' }), 'corners');

    // 200 × 100 cm => perimeter 6000 mm
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, '15'), 40);
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, '20'), 30);
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, '25'), 24);
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, '30'), 20);
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, '50'), 12);
    assert.equal(computeEyeletsCountPerUnit(2000, 1000, 'corners'), 4);

    assert.equal(
      formatEyeletParamLabel('Установка люверсов по периметру', 'corners'),
      'Установка люверсов (по углам)'
    );
    assert.equal(
      formatEyeletParamLabel('Установка люверсов', '20'),
      'Установка люверсов (шаг 20 см)'
    );

    const draftCorners = buildEstimateDraftFromSelection({
      mainCategoryId: 'wide_format',
      categoryName: 'Баннеры и растяжки',
      currentProduct: {
        id: 2001,
        category: 'wf_banners_cat',
        name: 'Баннер с люверсами (2000 × 1000 мм)',
        width_mm: 2000,
        height_mm: 1000,
        allow_custom_size: true,
        multi_page_mode: 'none',
        default_pages: 1,
        allowed_sides: 'single_only',
        show_paper_select: true,
        show_print_sides: false,
        show_lamination_select: false,
        allowed_paper_ids: [101],
        allowed_lamination_ids: [],
        cost_params: [
          {
            id: 'eyelets',
            name: 'Установка люверсов',
            cost: 2.5,
            mode: 'per_unit',
            is_enabled: true,
            is_client_facing: true,
            input_type: 'checkbox',
            default_value: true,
          },
        ],
      },
      effectiveW: 2000,
      effectiveH: 1000,
      pagesCount: 1,
      quantity: 1,
      selectedPaperId: 101,
      selectedCoverPaperId: 101,
      allowedPapers: [{ id: 101, name: 'Баннер ламинированный 340 г/м²' }],
      allowedCoverPapers: [],
      printSides: 1,
      blockPrintMode: '4+4',
      coverPrintMode: '4+0',
      laminationSides: 0,
      selectedLaminationId: null,
      allowedLaminations: [],
      selectedClientParams: { eyelets: true, eyelets_step: 'corners' },
      calcResult: { client_price: 900, unit_price: 900, quantity: 1 },
    });

    assert.equal(draftCorners.extraParamsLabel, 'Установка люверсов (по углам)');
  });

  it('defaults banner margins to 5 cm up to 3 m and 10 cm above 3 m, with 5/10/15/20 cm choices', () => {
    assert.deepEqual(
      BANNER_MARGIN_OPTIONS.map((o) => `${o.id}:${o.label}:${o.marginCm}`),
      ['5:5 см:5', '10:10 см:10', '15:15 см:15', '20:20 см:20']
    );

    assert.equal(
      isBannerProduct(
        { category: 'wf_banners_cat', name: 'Баннер с люверсами', schematic_type: 'flat' },
        'wide_format'
      ),
      true
    );
    assert.equal(
      isBannerProduct(
        { category: 'wf_films_cat', name: 'Самоклеящаяся плёнка', schematic_type: 'flat' },
        'wide_format'
      ),
      false
    );
    assert.equal(
      isBannerProduct(
        { category: 'flyers', name: 'Листовка А5', schematic_type: 'flat' },
        'polygraphy'
      ),
      false
    );

    // Up to and including 3 meters (3000 mm) => 5 cm
    assert.equal(getDefaultBannerMarginCm(2000, 1000), '5');
    assert.equal(getDefaultBannerMarginCm(3000, 2000), '5');
    assert.equal(getDefaultBannerMarginCm(1500, 3000), '5');

    // Greater than 3 meters (> 3000 mm) in width OR height => 10 cm
    assert.equal(getDefaultBannerMarginCm(3010, 2000), '10');
    assert.equal(getDefaultBannerMarginCm(4000, 1500), '10');
    assert.equal(getDefaultBannerMarginCm(2000, 3500), '10');

    assert.equal(resolveBannerMarginCm({}, 2000, 1000), '5');
    assert.equal(resolveBannerMarginCm({}, 3500, 1000), '10');
    assert.equal(resolveBannerMarginCm({ banner_margin_cm: '15' }, 2000, 1000), '15');
    assert.equal(resolveBannerMarginCm({ banner_margin_cm: '20' }, 4000, 2000), '20');
    assert.equal(resolveBannerMarginCm({ banner_margin_cm: '999' }, 2000, 1000), '5');

    const draftWithMargin = buildEstimateDraftFromSelection({
      mainCategoryId: 'wide_format',
      categoryName: 'Баннеры и растяжки',
      currentProduct: {
        id: 2001,
        category: 'wf_banners_cat',
        name: 'Баннер с люверсами (2000 × 1000 мм)',
        width_mm: 2000,
        height_mm: 1000,
        allow_custom_size: true,
        multi_page_mode: 'none',
        default_pages: 1,
        allowed_sides: 'single_only',
        show_paper_select: true,
        show_print_sides: false,
        show_lamination_select: false,
        allowed_paper_ids: [101],
        allowed_lamination_ids: [],
        cost_params: [
          {
            id: 'eyelets',
            name: 'Установка люверсов',
            cost: 2.5,
            mode: 'per_unit',
            is_enabled: true,
            is_client_facing: true,
            input_type: 'checkbox',
            default_value: true,
          },
        ],
      },
      effectiveW: 4000,
      effectiveH: 2000,
      pagesCount: 1,
      quantity: 1,
      selectedPaperId: 101,
      selectedCoverPaperId: 101,
      allowedPapers: [{ id: 101, name: 'Баннер литой 440 г/м²' }],
      allowedCoverPapers: [],
      printSides: 1,
      blockPrintMode: '4+4',
      coverPrintMode: '4+0',
      laminationSides: 0,
      selectedLaminationId: null,
      allowedLaminations: [],
      selectedClientParams: { banner_margin_cm: '10', eyelets: true, eyelets_step: '30' },
      calcResult: { client_price: 2500, unit_price: 2500, quantity: 1 },
    });

    assert.equal(
      draftWithMargin.extraParamsLabel,
      'Поля: 10 см; Установка люверсов (шаг 30 см)'
    );
  });
});



