import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTheme, buildInputStyle, buildSmallInputStyle, ThemeTokens } from './theme';

const REQUIRED_THEME_KEYS: Array<keyof ThemeTokens> = [
  'pageBg',
  'cardBg',
  'subCardBg',
  'elevatedBg',
  'text',
  'subText',
  'mutedText',
  'border',
  'softBorder',
  'inputBg',
  'inputText',
  'selectedBg',
  'selectedBorder',
  'selectedText',
  'tableHeaderBg',
  'secondaryBtnBg',
  'secondaryBtnText',
  'activeTabBg',
  'activeTabText',
  'inactiveTabBg',
  'inactiveTabText',
  'clientInputBg',
  'clientInputBorder',
  'infoBoxBg',
  'infoBoxBorder',
  'shadow',
  'brandPrimary',
  'brandHover',
  'brandText',
];

describe('theme utilities', () => {
  it('builds light and dark themes with complete non-empty ThemeTokens', () => {
    const light = buildTheme(false);
    const dark = buildTheme(true);

    for (const key of REQUIRED_THEME_KEYS) {
      assert.equal(typeof light[key], 'string', `light.${String(key)} should be string`);
      assert.ok(light[key].length > 0, `light.${String(key)} should be non-empty`);
      assert.equal(typeof dark[key], 'string', `dark.${String(key)} should be string`);
      assert.ok(dark[key].length > 0, `dark.${String(key)} should be non-empty`);
    }

    assert.equal(light.brandPrimary, '#C02721');
    assert.equal(dark.brandPrimary, '#C02721');
    assert.equal(light.selectedBorder, '#C02721');
    assert.equal(dark.selectedBorder, '#E54D47');
    assert.equal(light.pageBg, '#F8FAFC');
    assert.equal(dark.pageBg, '#121316');
    assert.notEqual(light.cardBg, dark.cardBg);
    assert.notEqual(light.text, dark.text);
    assert.equal(light.shadow, 'none');
    assert.equal(dark.shadow, 'none');
  });

  it('builds input styles based on theme tokens', () => {
    const light = buildTheme(false);
    const dark = buildTheme(true);
    const inputStyle = buildInputStyle(light);
    const smallStyle = buildSmallInputStyle(dark);

    assert.equal(inputStyle.background, light.inputBg);
    assert.equal(inputStyle.color, light.inputText);
    assert.equal(smallStyle.background, dark.inputBg);
    assert.equal(smallStyle.color, dark.inputText);
    assert.equal(inputStyle.borderRadius, 2);
    assert.equal(smallStyle.borderRadius, 2);
    assert.equal(smallStyle.fontSize, 12.5);
  });
});
