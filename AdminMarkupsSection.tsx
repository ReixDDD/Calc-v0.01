import React from 'react';
import { MainCategory, ProductCategory, Settings } from '../types';
import { DEFAULT_TIERS } from '../constants';

interface AdminMarkupsSectionProps {
  adminMainCategories: MainCategory[];
  adminCategories: ProductCategory[];
  activeMarkupMainCategoryId: string;
  setActiveMarkupMainCategoryId: (id: string) => void;
  activeMarkupCategory: string;
  setActiveMarkupCategory: (id: string) => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  isEditingTechParams: boolean;
  setIsEditingTechParams: (val: boolean) => void;
  handleSaveSettings: () => Promise<void>;
  handleTierChange: (
    catId: string,
    idx: number,
    field: 'min_qty' | 'coefficient' | 'page_coefficient',
    val: number
  ) => void;
  handleAddTier: (catId: string) => void;
  handleRemoveTier: (catId: string, idx: number) => void;
  loadAdminData: (pinToUse?: string, silent?: boolean) => Promise<void>;
  adminPin: string;
  renderMainCategoryPicker: (
    selectedMainCatId: string,
    onSelectMainCat: (mcId: string) => void,
    mode: 'materials' | 'markups'
  ) => React.ReactNode;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  smallInputStyle: React.CSSProperties;
}

export default function AdminMarkupsSection({
  adminMainCategories,
  adminCategories,
  activeMarkupMainCategoryId,
  setActiveMarkupMainCategoryId,
  activeMarkupCategory,
  setActiveMarkupCategory,
  settings,
  setSettings,
  isEditingTechParams,
  setIsEditingTechParams,
  handleSaveSettings,
  handleTierChange,
  handleAddTier,
  handleRemoveTier,
  loadAdminData,
  adminPin,
  renderMainCategoryPicker,
  isDark,
  theme: t,
  inputStyle,
  smallInputStyle,
}: AdminMarkupsSectionProps) {
  const defaultMainCatId = adminMainCategories[0]?.id || 'polygraphy';
  const effectiveMarkupMainCatId = adminMainCategories.some(
    (mc) => mc.id === activeMarkupMainCategoryId
  )
    ? activeMarkupMainCategoryId
    : defaultMainCatId;
  const currentMarkupMainCatObj = adminMainCategories.find(
    (mc) => mc.id === effectiveMarkupMainCatId
  );

  const subcatsForMarkupMain = adminCategories.filter(
    (c) => (c.parent_id || defaultMainCatId) === effectiveMarkupMainCatId
  );

  const effectiveMarkupTargetId =
    subcatsForMarkupMain.length > 0
      ? subcatsForMarkupMain.some((c) => c.id === activeMarkupCategory)
        ? activeMarkupCategory
        : subcatsForMarkupMain[0].id
      : effectiveMarkupMainCatId;

  const effectiveMarkupTargetName =
    subcatsForMarkupMain.length > 0
      ? subcatsForMarkupMain.find((c) => c.id === effectiveMarkupTargetId)?.name ||
        effectiveMarkupTargetId
      : currentMarkupMainCatObj?.name || effectiveMarkupTargetId;

  const isCatalogsCat = ['catalogs', 'notepads', 'planners', 'menus'].includes(
    effectiveMarkupTargetId
  );
  const tiers = settings.category_markups[effectiveMarkupTargetId] || DEFAULT_TIERS;

  interface TechFieldDef {
    key: string;
    label: string;
    unit: string;
    defaultValue: number;
    step: number;
    min?: number;
  }

  const getTechConfigForMainCategory = (
    mcId: string,
    mcName?: string
  ): { title: string; fields: TechFieldDef[] } => {
    if (mcId === 'polygraphy') {
      return {
        title: 'Параметры листа SRA3, тех. брак и налог',
        fields: [
          { key: 'bleed_mm', label: 'Вылеты (мм):', unit: ' мм', defaultValue: 4, step: 0.5, min: 0 },
          { key: 'sheet_length_m', label: 'Ламинация SRA3 (м):', unit: ' м', defaultValue: 0.5, step: 0.05, min: 0.05 },
          { key: 'usable_height_mm', label: 'Длина SRA3 (мм):', unit: ' мм', defaultValue: 440, step: 1, min: 50 },
          { key: 'usable_width_mm', label: 'Ширина SRA3 (мм):', unit: ' мм', defaultValue: 310, step: 1, min: 50 },
          { key: 'defect_percent', label: 'Брак (%):', unit: '%', defaultValue: 3, step: 0.5, min: 0 },
          { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
        ],
      };
    }
    if (mcId === 'wide_format') {
      return {
        title: 'Параметры широкоформатной печати, тех. брак и налог',
        fields: [
          { key: 'bleed_mm', label: 'Припуск обрезки (мм):', unit: ' мм', defaultValue: 10, step: 1, min: 0 },
          { key: 'roll_waste_m', label: 'Техотход рулона (м):', unit: ' м', defaultValue: 0.3, step: 0.05, min: 0 },
          { key: 'defect_percent', label: 'Брак (%):', unit: '%', defaultValue: 3, step: 0.5, min: 0 },
          { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
        ],
      };
    }
    if (mcId === 'souvenirs') {
      return {
        title: 'Параметры сувенирной продукции, тех. брак и налог',
        fields: [
          { key: 'setup_cost', label: 'Приладка тиража (₽):', unit: ' ₽', defaultValue: 300, step: 10, min: 0 },
          { key: 'print_area_mm', label: 'Поле нанесения (мм):', unit: ' мм', defaultValue: 200, step: 5, min: 10 },
          { key: 'packaging_cost', label: 'Упаковка за ед. (₽):', unit: ' ₽', defaultValue: 15, step: 1, min: 0 },
          { key: 'defect_percent', label: 'Брак (%):', unit: '%', defaultValue: 2, step: 0.5, min: 0 },
          { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
        ],
      };
    }
    if (mcId === 'stamps') {
      return {
        title: 'Параметры изготовления печатей, тех. брак и налог',
        fields: [
          { key: 'min_line_mm', label: 'Мин. линия клише (мм):', unit: ' мм', defaultValue: 0.15, step: 0.05, min: 0.05 },
          { key: 'engraving_depth_mm', label: 'Глубина гравировки (мм):', unit: ' мм', defaultValue: 1.2, step: 0.1, min: 0.1 },
          { key: 'urgency_percent', label: 'Срочность (%):', unit: '%', defaultValue: 50, step: 5, min: 0 },
          { key: 'defect_percent', label: 'Брак (%):', unit: '%', defaultValue: 2, step: 0.5, min: 0 },
          { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
        ],
      };
    }
    if (mcId === 'design') {
      return {
        title: 'Параметры дизайн-студии, верстки и налог',
        fields: [
          { key: 'hourly_rate', label: 'Ставка дизайнера (₽/ч):', unit: ' ₽/ч', defaultValue: 1500, step: 50, min: 0 },
          { key: 'free_revisions', label: 'Бесплатных правок (шт.):', unit: ' шт.', defaultValue: 2, step: 1, min: 0 },
          { key: 'extra_revision_cost', label: 'Доп. правка макета (₽):', unit: ' ₽', defaultValue: 350, step: 50, min: 0 },
          { key: 'prepress_cost', label: 'Предпечатная подг. (₽):', unit: ' ₽', defaultValue: 250, step: 50, min: 0 },
          { key: 'defect_percent', label: 'Резерв времени (%):', unit: '%', defaultValue: 0, step: 0.5, min: 0 },
          { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
        ],
      };
    }
    return {
      title: `Параметры раздела «${mcName || mcId}», тех. брак и налог`,
      fields: [
        { key: 'setup_cost', label: 'Приладка / старт (₽):', unit: ' ₽', defaultValue: 200, step: 10, min: 0 },
        { key: 'extra_waste_percent', label: 'Доп. расход (%):', unit: '%', defaultValue: 2, step: 0.5, min: 0 },
        { key: 'defect_percent', label: 'Брак (%):', unit: '%', defaultValue: 3, step: 0.5, min: 0 },
        { key: 'tax_percent', label: 'Налог (%):', unit: '%', defaultValue: 6, step: 0.5, min: 0 },
      ],
    };
  };

  const techConfig = getTechConfigForMainCategory(
    effectiveMarkupMainCatId,
    currentMarkupMainCatObj?.name
  );
  const currentMcParams = settings.main_category_params?.[effectiveMarkupMainCatId] || {};

  const getTechParamValue = (field: TechFieldDef): number => {
    if (effectiveMarkupMainCatId === 'polygraphy') {
      if (field.key === 'bleed_mm') return settings.bleed_mm ?? currentMcParams.bleed_mm ?? field.defaultValue;
      if (field.key === 'sheet_length_m') return settings.sheet_length_m ?? currentMcParams.sheet_length_m ?? field.defaultValue;
      if (field.key === 'usable_height_mm') return settings.usable_height_mm ?? currentMcParams.usable_height_mm ?? field.defaultValue;
      if (field.key === 'usable_width_mm') return settings.usable_width_mm ?? currentMcParams.usable_width_mm ?? field.defaultValue;
      if (field.key === 'defect_percent') return settings.defect_percent ?? currentMcParams.defect_percent ?? field.defaultValue;
      if (field.key === 'tax_percent') return settings.tax_percent ?? currentMcParams.tax_percent ?? field.defaultValue;
    }
    if (currentMcParams[field.key] !== undefined) {
      return Number(currentMcParams[field.key]);
    }
    if (field.key === 'tax_percent' && settings.tax_percent !== undefined) {
      return Number(settings.tax_percent);
    }
    return field.defaultValue;
  };

  const handleTechParamChange = (field: TechFieldDef, rawVal: number) => {
    const val = field.min !== undefined ? Math.max(field.min, rawVal) : rawVal;
    const prevAllMc = settings.main_category_params || {};
    const prevMc = prevAllMc[effectiveMarkupMainCatId] || {};
    const nextSettings: Settings = {
      ...settings,
      main_category_params: {
        ...prevAllMc,
        [effectiveMarkupMainCatId]: {
          ...prevMc,
          [field.key]: val,
        },
      },
    };
    if (effectiveMarkupMainCatId === 'polygraphy') {
      if (field.key === 'bleed_mm') nextSettings.bleed_mm = val;
      if (field.key === 'sheet_length_m') nextSettings.sheet_length_m = val;
      if (field.key === 'usable_height_mm') nextSettings.usable_height_mm = val;
      if (field.key === 'usable_width_mm') nextSettings.usable_width_mm = val;
      if (field.key === 'defect_percent') nextSettings.defect_percent = val;
      if (field.key === 'tax_percent') nextSettings.tax_percent = val;
    }
    setSettings(nextSettings);
  };

  return (
    <div>
      {renderMainCategoryPicker(
        effectiveMarkupMainCatId,
        (mcId) => {
          const subcatsInMain = adminCategories.filter(
            (c) => (c.parent_id || defaultMainCatId) === mcId
          );
          setActiveMarkupMainCategoryId(mcId);
          if (subcatsInMain.length > 0) {
            setActiveMarkupCategory(subcatsInMain[0].id);
          } else {
            setActiveMarkupCategory(mcId);
          }
        },
        'markups'
      )}

      <div
        style={{
          background: t.subCardBg,
          padding: 16,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
        }}
      >
        <div
          style={{
            paddingBottom: 14,
            marginBottom: 14,
            borderBottom: `1px solid ${t.softBorder}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
              {techConfig.title}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {!isEditingTechParams ? (
                <button
                  type="button"
                  onClick={() => setIsEditingTechParams(true)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 2,
                    border: '1px solid #C02721',
                    background: '#C02721',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Редактировать
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveSettings();
                      setIsEditingTechParams(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 2,
                      border: 'none',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTechParams(false);
                      loadAdminData(adminPin, true);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
              gap: 10,
              alignItems: 'end',
            }}
          >
            {techConfig.fields.map((field) => {
              const val = getTechParamValue(field);
              return (
                <div key={field.key}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      color: t.mutedText,
                      marginBottom: 4,
                    }}
                  >
                    {field.label}
                  </label>
                  {isEditingTechParams ? (
                    <input
                      type="number"
                      step={field.step}
                      min={field.min ?? 0}
                      value={val}
                      onChange={(e) => handleTechParamChange(field, Number(e.target.value))}
                      style={smallInputStyle}
                    />
                  ) : (
                    <div
                      className="tabular-nums"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 2,
                        background: t.cardBg,
                        border: `1px solid ${t.softBorder}`,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {val}
                      {field.unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
              Шкала наценки:
            </span>
            {subcatsForMarkupMain.length > 0 ? (
              <select
                value={effectiveMarkupTargetId}
                onChange={(e) => setActiveMarkupCategory(e.target.value)}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  minWidth: 230,
                  height: 34,
                  padding: '4px 10px',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {subcatsForMarkupMain.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 13.5, fontWeight: 600, color: t.selectedText }}>
                {effectiveMarkupTargetName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleAddTier(effectiveMarkupTargetId)}
              style={{
                padding: '6px 12px',
                background: t.secondaryBtnBg,
                color: t.secondaryBtnText,
                border: `1px solid ${t.border}`,
                borderRadius: 2,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12.5,
              }}
            >
              + Порог тиража
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              style={{
                padding: '6px 14px',
                background: '#C02721',
                color: '#fff',
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12.5,
              }}
            >
              Сохранить шкалу
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 8,
          }}
        >
          {tiers.map((tier, idx) => {
            const pageCoeff = tier.page_coefficient ?? tier.coefficient;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: 3,
                  background: t.cardBg,
                  border: `1px solid ${t.softBorder}`,
                }}
              >
                <span style={{ fontSize: 12, color: t.mutedText }}>от</span>
                <input
                  type="number"
                  min={1}
                  value={tier.min_qty}
                  onChange={(e) =>
                    handleTierChange(
                      effectiveMarkupTargetId,
                      idx,
                      'min_qty',
                      Math.max(1, Number(e.target.value))
                    )
                  }
                  style={{ ...smallInputStyle, width: 76, padding: '4px 6px' }}
                />
                <span style={{ fontSize: 12, color: t.mutedText }}>шт. → ×</span>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={tier.coefficient}
                  onChange={(e) =>
                    handleTierChange(
                      effectiveMarkupTargetId,
                      idx,
                      'coefficient',
                      Number(e.target.value)
                    )
                  }
                  style={{ ...smallInputStyle, width: 68, padding: '4px 6px', fontWeight: 700 }}
                />
                {isCatalogsCat && (
                  <>
                    <span style={{ fontSize: 11.5, color: t.mutedText }} title="Коэффициент для внутренних полос блока">
                      бл. ×
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min={0.1}
                      value={pageCoeff}
                      onChange={(e) =>
                        handleTierChange(
                          effectiveMarkupTargetId,
                          idx,
                          'page_coefficient',
                          Number(e.target.value)
                        )
                      }
                      style={{ ...smallInputStyle, width: 64, padding: '4px 6px', fontWeight: 700 }}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveTier(effectiveMarkupTargetId, idx)}
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 7px',
                    background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                    color: isDark ? '#f87171' : '#dc2626',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                  title="Удалить порог"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
