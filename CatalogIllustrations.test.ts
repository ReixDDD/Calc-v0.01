import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getStudioPalette,
  MainCategoryIllustration,
  ResilientCatalogImage,
  SubcategoryCardIllustration,
} from './CatalogIllustrations';
import { MainCategory, ProductCategory } from '../types';

const SEEDED_MAIN_CATEGORIES: MainCategory[] = [
  { id: 'polygraphy', name: 'Полиграфическая продукция' },
  { id: 'wide_format', name: 'Широкоформатная печать' },
  { id: 'souvenirs', name: 'Сувенирная продукция' },
  { id: 'stamps', name: 'Печати и штампы' },
  { id: 'design', name: 'Дизайн и вёрстка' },
  { id: 'custom_unknown_main', name: 'Нестандартная категория' },
];

const SEEDED_SUBCATEGORIES: ProductCategory[] = [
  { id: 'business_cards', name: 'Визитки', icon: '', parent_id: 'polygraphy' },
  { id: 'flyers', name: 'Листовки и флаеры', icon: '', parent_id: 'polygraphy' },
  { id: 'booklets', name: 'Буклеты и лифлеты', icon: '', parent_id: 'polygraphy' },
  { id: 'catalogs', name: 'Многостраничные каталоги', icon: '', parent_id: 'polygraphy' },
  { id: 'stickers', name: 'Наклейки и стикеры', icon: '', parent_id: 'polygraphy' },
  { id: 'stickers_3d', name: '3D Стикеры со смолой', icon: '', parent_id: 'polygraphy' },
  { id: 'notepads', name: 'Блокноты на пружине', icon: '', parent_id: 'polygraphy' },
  { id: 'planners', name: 'Планеры и ежедневники', icon: '', parent_id: 'polygraphy' },
  { id: 'menus', name: 'Меню для ресторанов', icon: '', parent_id: 'polygraphy' },
  { id: 'table_tents', name: 'Тейбл-тенты', icon: '', parent_id: 'polygraphy' },
  { id: 'postcards', name: 'Открытки и пригласительные', icon: '', parent_id: 'polygraphy' },
  { id: 'certificates', name: 'Сертификаты и дипломы', icon: '', parent_id: 'polygraphy' },
  { id: 'blanks', name: 'Фирменные бланки', icon: '', parent_id: 'polygraphy' },
  { id: 'folders', name: 'Папки вырубные и адресные', icon: '', parent_id: 'polygraphy' },
  { id: 'packaging_boxes', name: 'Коробки упаковочные', icon: '', parent_id: 'polygraphy' },
  { id: 'card_decks', name: 'Колоды карт (МАК / Таро)', icon: '', parent_id: 'polygraphy' },
  { id: 'posters', name: 'Плакаты и афиши', icon: '', parent_id: 'polygraphy' },
  { id: 'calendars', name: 'Календари', icon: '', parent_id: 'polygraphy' },
  { id: 'wf_banners_cat', name: 'Баннеры и растяжки', icon: '', parent_id: 'wide_format' },
  { id: 'wf_films_cat', name: 'Самоклеящаяся плёнка', icon: '', parent_id: 'wide_format' },
  { id: 'wf_posters_cat', name: 'Широкоформатные плакаты и холсты', icon: '', parent_id: 'wide_format' },
  { id: 'souv_mugs_cat', name: 'Кружки с печатью', icon: '', parent_id: 'souvenirs' },
  { id: 'souv_textile_cat', name: 'Футболки и текстиль', icon: '', parent_id: 'souvenirs' },
  { id: 'stamps_orgs_cat', name: 'Печати организаций и ИП', icon: '', parent_id: 'stamps' },
  { id: 'design_makets_cat', name: 'Разработка макетов и ретушь', icon: '', parent_id: 'design' },
  { id: 'custom_unknown_subcat', name: 'Спецзаказ', icon: '', parent_id: 'polygraphy' },
];

test('getStudioPalette returns distinct Light and Dark minimalist studio tokens', () => {
  const light = getStudioPalette(false);
  const dark = getStudioPalette(true);

  assert.equal(light.isDark, false);
  assert.equal(dark.isDark, true);
  assert.notEqual(light.surface, dark.surface);
  assert.notEqual(light.surfaceAlt, dark.surfaceAlt);
  assert.notEqual(light.stroke, dark.stroke);
  assert.notEqual(light.accent, dark.accent);
  assert.notEqual(light.shadow, dark.shadow);
});

test('MainCategoryIllustration renders distinct Light and Dark SVGs for all 5 main categories + fallback', () => {
  for (const mc of SEEDED_MAIN_CATEGORIES) {
    const lightHtml = renderToStaticMarkup(
      React.createElement(MainCategoryIllustration, { category: mc, isDark: false })
    );
    const darkHtml = renderToStaticMarkup(
      React.createElement(MainCategoryIllustration, { category: mc, isDark: true })
    );
    const compactHtml = renderToStaticMarkup(
      React.createElement(MainCategoryIllustration, { category: mc, isDark: true, compact: true })
    );

    assert.ok(lightHtml.startsWith('<svg'), `Expected <svg> for ${mc.id} light`);
    assert.ok(darkHtml.startsWith('<svg'), `Expected <svg> for ${mc.id} dark`);
    assert.ok(lightHtml.includes('data-theme-mode="light"'));
    assert.ok(darkHtml.includes('data-theme-mode="dark"'));
    assert.notEqual(lightHtml, darkHtml, `Light and Dark SVG must differ for ${mc.id}`);
    assert.ok(compactHtml.includes('width="52"'), `Compact width expected for ${mc.id}`);
  }
});

test('SubcategoryCardIllustration renders distinct Light and Dark SVGs for all 25 subcategories + fallback', () => {
  for (const sc of SEEDED_SUBCATEGORIES) {
    const lightHtml = renderToStaticMarkup(
      React.createElement(SubcategoryCardIllustration, { cat: sc, isDark: false })
    );
    const darkHtml = renderToStaticMarkup(
      React.createElement(SubcategoryCardIllustration, { cat: sc, isDark: true })
    );
    const compactHtml = renderToStaticMarkup(
      React.createElement(SubcategoryCardIllustration, { cat: sc, isDark: false, compact: true })
    );

    assert.ok(lightHtml.startsWith('<svg'), `Expected <svg> for ${sc.id} light`);
    assert.ok(darkHtml.startsWith('<svg'), `Expected <svg> for ${sc.id} dark`);
    assert.ok(lightHtml.includes('data-theme-mode="light"'));
    assert.ok(darkHtml.includes('data-theme-mode="dark"'));
    assert.notEqual(lightHtml, darkHtml, `Light and Dark SVG must differ for ${sc.id}`);
    assert.ok(compactHtml.includes('width="84"'), `Compact width expected for ${sc.id}`);
  }
});

test('ResilientCatalogImage renders SVG fallback when imageUrl is empty and img with no-referrer when set', () => {
  const fallbackHtml = renderToStaticMarkup(
    React.createElement(ResilientCatalogImage, {
      imageUrl: '',
      alt: 'Визитки',
      fallback: React.createElement('span', { className: 'svg-fb' }, 'FB'),
    })
  );
  assert.equal(fallbackHtml, '<span class="svg-fb">FB</span>');

  const imgHtml = renderToStaticMarkup(
    React.createElement(ResilientCatalogImage, {
      imageUrl: '/uploads/custom.png',
      alt: 'Визитки',
      fallback: React.createElement('span', { className: 'svg-fb' }, 'FB'),
    })
  );
  assert.ok(imgHtml.startsWith('<img'));
  assert.ok(imgHtml.includes('referrerPolicy="no-referrer"') || imgHtml.includes('referrerpolicy="no-referrer"'));
  assert.ok(imgHtml.includes('alt="Визитки"'));
});
