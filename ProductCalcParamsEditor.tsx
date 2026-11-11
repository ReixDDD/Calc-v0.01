import React, { useState } from 'react';
import {
  AllowedBlockPrintModesType,
  AllowedCoverPrintModesType,
  CostItem,
  CostParamInputType,
  CostParamModeType,
  CostParamOption,
  ProductCostParam,
  ProductItem,
} from '../types';
import { COST_PARAM_MODE_LABELS } from '../constants';

interface ProductCalcParamsEditorProps {
  prod: ProductItem;
  onChange: (changes: Partial<ProductItem>) => void;
  onSave?: () => void;
  onApplyToSubcategory?: () => void;
  subcategoryName?: string;
  theme: Record<string, string>;
  compact?: boolean;
  allItems?: CostItem[];
}

export default function ProductCalcParamsEditor({
  prod,
  onChange,
  onSave,
  onApplyToSubcategory,
  subcategoryName,
  theme: t,
  compact = false,
  allItems = [],
}: ProductCalcParamsEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEquipmentDetailExpanded, setIsEquipmentDetailExpanded] = useState(false);

  const allParams: ProductCostParam[] = prod.cost_params || [];
  const clientParams = allParams.filter((cp) => cp.is_client_facing);
  const internalParams = allParams.filter((cp) => !cp.is_client_facing);

  const showFormat = prod.show_format_select !== false;
  const showPrintSides = prod.show_print_sides !== false;
  const showPaper = prod.show_paper_select !== false && prod.include_paper_cost !== false;
  const showLam = prod.show_lamination_select !== false && prod.include_lamination_cost !== false;

  const includePrintCost = prod.include_print_cost !== false;
  const includeTonerCost = includePrintCost && prod.include_toner_cost !== false;
  const includeComponentsCost = includePrintCost && prod.include_components_cost !== false;
  const includeExtraParamsCost = prod.include_extra_params_cost !== false;
  const includeDefectCost = prod.include_defect_cost !== false;

  const hasCoverBlock = Boolean(
    prod.has_cover_block ?? (prod.category === 'catalogs' || prod.multi_page_mode === 'pages')
  );
  const allowedBlockPrintModes: AllowedBlockPrintModesType =
    prod.allowed_block_print_modes || 'both';
  const allowedCoverPrintModes: AllowedCoverPrintModesType =
    prod.allowed_cover_print_modes || 'both';

  const excludedEquipmentIds: number[] = prod.excluded_equipment_ids || [];
  const enabledEquipmentIds: number[] = prod.enabled_equipment_ids || [];

  const tonerItems = allItems.filter((i) => i.category === 'toners');
  const componentItems = allItems.filter((i) => i.category === 'components');
  const extraEquipmentItems = allItems.filter((i) =>
    [
      'extras',
      'wf_inks',
      'wf_equipment',
      'souv_inks',
      'souv_equipment',
      'stamps_consumables',
      'stamps_equipment',
    ].includes(i.category)
  );

  const activeCostCategoriesCount = [
    showPaper,
    includeTonerCost,
    includeComponentsCost,
    showLam,
    includeExtraParamsCost,
    includeDefectCost,
  ].filter(Boolean).length;

  const smallInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    borderRadius: 2,
    border: `1px solid ${t.border}`,
    background: t.inputBg,
    color: t.inputText,
    boxSizing: 'border-box',
    fontSize: 12,
  };

  const handleToggleExcludedEquipment = (itemId: number, include: boolean) => {
    const next = include
      ? excludedEquipmentIds.filter((id) => id !== itemId)
      : Array.from(new Set([...excludedEquipmentIds, itemId]));
    onChange({ excluded_equipment_ids: next });
  };

  const handleToggleEnabledExtraEquipment = (itemId: number, include: boolean) => {
    const next = include
      ? Array.from(new Set([...enabledEquipmentIds, itemId]))
      : enabledEquipmentIds.filter((id) => id !== itemId);
    onChange({ enabled_equipment_ids: next });
  };

  const handleToggleCoverBlock = (enabled: boolean) => {
    const changes: Partial<ProductItem> = {
      has_cover_block: enabled,
    };
    if (enabled) {
      if (!prod.allowed_block_print_modes) {
        changes.allowed_block_print_modes = 'both';
      }
      if (!prod.allowed_cover_print_modes) {
        changes.allowed_cover_print_modes = 'both';
      }
      if (!prod.allowed_cover_paper_ids || prod.allowed_cover_paper_ids.length === 0) {
        changes.allowed_cover_paper_ids = [...(prod.allowed_paper_ids || [])];
      }
    }
    onChange(changes);
  };

  const handleAddParam = () => {
    const newId = `param_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newParam: ProductCostParam = {
      id: newId,
      name: 'Новый параметр',
      cost: 2,
      mode: 'per_unit',
      is_client_facing: true,
      is_enabled: true,
      input_type: 'checkbox',
      default_value: false,
      options: [
        { id: 'opt_1', label: 'Нет', cost: 0 },
        { id: 'opt_2', label: 'Стандарт', cost: 2 },
      ],
    };
    onChange({
      include_extra_params_cost: true,
      cost_params: [...allParams, newParam],
    });
    setIsExpanded(true);
  };

  const handleUpdateParam = (paramId: string, changes: Partial<ProductCostParam>) => {
    const updated = allParams.map((cp) => {
      if (cp.id !== paramId) return cp;
      const merged = { ...cp, ...changes };
      if (changes.is_client_facing === false) {
        merged.default_value = true;
      } else if (changes.is_client_facing === true && cp.is_client_facing === false) {
        merged.default_value = false;
      }
      if (
        changes.input_type === 'select' &&
        (!merged.options || merged.options.length === 0)
      ) {
        merged.options = [
          { id: 'opt_1', label: 'Нет', cost: 0 },
          { id: 'opt_2', label: 'Вариант 1', cost: merged.cost || 2 },
        ];
      }
      return merged;
    });
    onChange({ cost_params: updated });
  };

  const handleRemoveParam = (paramId: string) => {
    onChange({ cost_params: allParams.filter((cp) => cp.id !== paramId) });
  };

  const handleAddOption = (param: ProductCostParam) => {
    const currentOpts: CostParamOption[] = param.options || [];
    const nextIdx = currentOpts.length + 1;
    const newOpt: CostParamOption = {
      id: `opt_${Date.now()}_${nextIdx}`,
      label: `Вариант ${nextIdx}`,
      cost: 0,
    };
    handleUpdateParam(param.id, { options: [...currentOpts, newOpt] });
  };

  const handleUpdateOption = (
    param: ProductCostParam,
    optId: string,
    changes: Partial<CostParamOption>
  ) => {
    const currentOpts: CostParamOption[] = param.options || [];
    handleUpdateParam(param.id, {
      options: currentOpts.map((o) => (o.id === optId ? { ...o, ...changes } : o)),
    });
  };

  const handleRemoveOption = (param: ProductCostParam, optId: string) => {
    const currentOpts: CostParamOption[] = param.options || [];
    handleUpdateParam(param.id, {
      options: currentOpts.filter((o) => o.id !== optId),
    });
  };

  const pillToggleStyle = (active: boolean, accent = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 2,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? (accent ? t.selectedBg : t.subCardBg) : 'transparent',
    border: `1px solid ${active ? (accent ? t.selectedText : t.border) : t.softBorder}`,
    color: active ? (accent ? t.selectedText : t.text) : t.subText,
    opacity: active ? 1 : 0.65,
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 3,
        border: `1px solid ${compact ? t.border : t.softBorder}`,
        overflow: 'hidden',
      }}
    >
      {/* Шапка единого блока */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{
          padding: '11px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          cursor: 'pointer',
          userSelect: 'none',
          background: isExpanded ? t.tableHeaderBg : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: t.subText }}>{isExpanded ? '▼' : '▶'}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
            Себестоимость и параметры калькулятора
          </span>
          <span
            style={{
              fontSize: 11.5,
              padding: '2px 8px',
              borderRadius: 2,
              background:
                activeCostCategoriesCount === 6 ? t.subCardBg : 'rgba(245, 158, 11, 0.16)',
              border: `1px solid ${
                activeCostCategoriesCount === 6 ? t.border : 'rgba(245, 158, 11, 0.45)'
              }`,
              color: activeCostCategoriesCount === 6 ? t.subText : '#f59e0b',
              fontWeight: 600,
            }}
          >
            Статей: {activeCostCategoriesCount}/6
            {excludedEquipmentIds.length > 0 ? ` • Искл. ЗИП: ${excludedEquipmentIds.length}` : ''}
            {enabledEquipmentIds.length > 0 ? ` • Доп. оборуд.: +${enabledEquipmentIds.length}` : ''}
          </span>
          {allParams.length > 0 && (
            <span
              style={{
                fontSize: 11.5,
                padding: '2px 8px',
                borderRadius: 2,
                background: t.subCardBg,
                border: `1px solid ${t.border}`,
                color: t.subText,
                fontWeight: 600,
              }}
            >
              Доп. параметров: {allParams.length}
            </span>
          )}
          {hasCoverBlock && (
            <span
              style={{
                fontSize: 11.5,
                padding: '2px 8px',
                borderRadius: 2,
                background: t.selectedBg,
                color: t.selectedText,
                fontWeight: 600,
              }}
            >
              Блок + Обложка
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: t.selectedText, fontWeight: 500 }}>
          {isExpanded ? 'Свернуть' : 'Развернуть'}
        </span>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: `1px solid ${t.softBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* 1. ЕДИНАЯ ПАНЕЛЬ СТАТЕЙ СЕБЕСТОИМОСТИ И БАЗОВЫХ ПОЛЕЙ КАЛЬКУЛЯТОРА (БЕЗ ДУБЛИКАТОВ) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <label style={pillToggleStyle(showPaper)}>
                <input
                  type="checkbox"
                  checked={showPaper}
                  onChange={(e) =>
                    onChange({
                      show_paper_select: e.target.checked,
                      include_paper_cost: e.target.checked,
                    })
                  }
                  style={{ margin: 0 }}
                />
                <span>Бумага / материал</span>
              </label>

              <label style={pillToggleStyle(showLam)}>
                <input
                  type="checkbox"
                  checked={showLam}
                  onChange={(e) =>
                    onChange({
                      show_lamination_select: e.target.checked,
                      include_lamination_cost: e.target.checked,
                    })
                  }
                  style={{ margin: 0 }}
                />
                <span>Ламинация</span>
              </label>

              <label style={pillToggleStyle(showPrintSides)}>
                <input
                  type="checkbox"
                  checked={showPrintSides}
                  onChange={(e) => onChange({ show_print_sides: e.target.checked })}
                  style={{ margin: 0 }}
                />
                <span>Вид печати</span>
              </label>

              <label style={pillToggleStyle(includeTonerCost)}>
                <input
                  type="checkbox"
                  checked={includeTonerCost}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChange({
                      include_toner_cost: checked,
                      include_print_cost: checked || includeComponentsCost,
                    });
                  }}
                  style={{ margin: 0 }}
                />
                <span>Тонеры</span>
              </label>

              <label style={pillToggleStyle(includeComponentsCost)}>
                <input
                  type="checkbox"
                  checked={includeComponentsCost}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChange({
                      include_components_cost: checked,
                      include_print_cost: checked || includeTonerCost,
                    });
                  }}
                  style={{ margin: 0 }}
                />
                <span>ЗИП и узлы</span>
              </label>

              <label style={pillToggleStyle(showFormat)}>
                <input
                  type="checkbox"
                  checked={showFormat}
                  onChange={(e) => onChange({ show_format_select: e.target.checked })}
                  style={{ margin: 0 }}
                />
                <span>Формат, мм</span>
              </label>

              <label style={pillToggleStyle(Boolean(prod.allow_custom_size))}>
                <input
                  type="checkbox"
                  checked={Boolean(prod.allow_custom_size)}
                  onChange={(e) => onChange({ allow_custom_size: e.target.checked })}
                  style={{ margin: 0 }}
                />
                <span>Свой размер (Ш×В)</span>
              </label>

              <label style={pillToggleStyle(hasCoverBlock, true)}>
                <input
                  type="checkbox"
                  checked={hasCoverBlock}
                  onChange={(e) => handleToggleCoverBlock(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span>Блок + Обложка</span>
              </label>

              <div
                style={{
                  ...pillToggleStyle(includeDefectCost),
                  padding: '2px 8px',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeDefectCost}
                    onChange={(e) => onChange({ include_defect_cost: e.target.checked })}
                    style={{ margin: 0 }}
                  />
                  <span>Брак %:</span>
                </label>
                {includeDefectCost && (
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Авто"
                    value={
                      prod.defect_percent !== null && prod.defect_percent !== undefined
                        ? prod.defect_percent
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      onChange({
                        defect_percent: raw === '' ? null : Math.max(0, Number(raw)),
                      });
                    }}
                    style={{
                      ...smallInputStyle,
                      width: 54,
                      padding: '1px 5px',
                      fontSize: 11,
                    }}
                    title="Индивидуальный % брака (пусто = из подкатегории)"
                  />
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginLeft: 'auto',
                }}
              >
                {(tonerItems.length > 0 ||
                  componentItems.length > 0 ||
                  extraEquipmentItems.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setIsEquipmentDetailExpanded((prev) => !prev)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 2,
                      border: `1px solid ${isEquipmentDetailExpanded ? t.selectedText : t.border}`,
                      background: isEquipmentDetailExpanded ? t.selectedBg : t.subCardBg,
                      color: isEquipmentDetailExpanded ? t.selectedText : t.text,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isEquipmentDetailExpanded ? '▼ Детально ЗИП' : '▶ Детально ЗИП'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      show_paper_select: true,
                      include_paper_cost: true,
                      show_lamination_select: true,
                      include_lamination_cost: true,
                      show_print_sides: true,
                      include_print_cost: true,
                      include_toner_cost: true,
                      include_components_cost: true,
                      include_extra_params_cost: true,
                      include_defect_cost: true,
                      excluded_equipment_ids: [],
                    })
                  }
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 2,
                    border: `1px solid ${t.border}`,
                    background: t.subCardBg,
                    color: t.text,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Вкл. всё
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      include_paper_cost: false,
                      include_lamination_cost: false,
                      include_print_cost: false,
                      include_toner_cost: false,
                      include_components_cost: false,
                      include_extra_params_cost: false,
                      include_defect_cost: false,
                    })
                  }
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 2,
                    border: `1px solid ${t.border}`,
                    background: t.subCardBg,
                    color: t.subText,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Откл. себест.
                </button>
              </div>
            </div>

            {hasCoverBlock && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 3,
                  background: t.subCardBg,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.subText, whiteSpace: 'nowrap' }}>
                    Печать блока:
                  </span>
                  <select
                    value={allowedBlockPrintModes}
                    onChange={(e) =>
                      onChange({
                        allowed_block_print_modes: e.target.value as AllowedBlockPrintModesType,
                      })
                    }
                    style={smallInputStyle}
                  >
                    <option value="both">4+4 / 1+1 / 0+0 (выбор)</option>
                    <option value="4+4">Только 4+4 (цвет)</option>
                    <option value="1+1">Только 1+1 (ч/б)</option>
                    <option value="0+0">Только 0+0 (без печати)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.subText, whiteSpace: 'nowrap' }}>
                    Печать обложки:
                  </span>
                  <select
                    value={allowedCoverPrintModes}
                    onChange={(e) =>
                      onChange({
                        allowed_cover_print_modes: e.target.value as AllowedCoverPrintModesType,
                      })
                    }
                    style={smallInputStyle}
                  >
                    <option value="both">4+4 или 4+0 (выбор)</option>
                    <option value="4+0">Только 4+0</option>
                    <option value="4+4">Только 4+4</option>
                  </select>
                </div>
              </div>
            )}

            {/* Раскрывающийся детальный список ЗИП и тонеров */}
            {isEquipmentDetailExpanded && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 3,
                  border: `1px solid ${t.border}`,
                  background: t.subCardBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {tonerItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.subText, marginBottom: 4 }}>
                      Тонеры:
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 5,
                      }}
                    >
                      {tonerItems.map((item) => {
                        const isIncluded =
                          includeTonerCost && !excludedEquipmentIds.includes(item.id);
                        const unitCost = item.resource > 0 ? item.price / item.resource : 0;
                        return (
                          <label
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 2,
                              background: t.cardBg,
                              border: `1px solid ${t.softBorder}`,
                              fontSize: 11.5,
                              cursor: includeTonerCost ? 'pointer' : 'not-allowed',
                              opacity: isIncluded ? 1 : 0.55,
                            }}
                          >
                            <input
                              type="checkbox"
                              disabled={!includeTonerCost}
                              checked={!excludedEquipmentIds.includes(item.id)}
                              onChange={(e) =>
                                handleToggleExcludedEquipment(item.id, e.target.checked)
                              }
                              style={{ margin: 0 }}
                            />
                            <span style={{ flex: 1, fontWeight: 500, color: t.text }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: t.subText }}>
                              {unitCost.toFixed(2)} ₽
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {componentItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.subText, marginBottom: 4 }}>
                      Комплектующие и машина:
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 5,
                      }}
                    >
                      {componentItems.map((item) => {
                        const isIncluded =
                          includeComponentsCost && !excludedEquipmentIds.includes(item.id);
                        const unitCost = item.resource > 0 ? item.price / item.resource : 0;
                        return (
                          <label
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 2,
                              background: t.cardBg,
                              border: `1px solid ${t.softBorder}`,
                              fontSize: 11.5,
                              cursor: includeComponentsCost ? 'pointer' : 'not-allowed',
                              opacity: isIncluded ? 1 : 0.55,
                            }}
                          >
                            <input
                              type="checkbox"
                              disabled={!includeComponentsCost}
                              checked={!excludedEquipmentIds.includes(item.id)}
                              onChange={(e) =>
                                handleToggleExcludedEquipment(item.id, e.target.checked)
                              }
                              style={{ margin: 0 }}
                            />
                            <span style={{ flex: 1, fontWeight: 500, color: t.text }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: t.subText }}>
                              {unitCost.toFixed(2)} ₽
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {extraEquipmentItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.subText, marginBottom: 4 }}>
                      Доп. оборудование и расходники (+ к 1 шт.):
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 5,
                      }}
                    >
                      {extraEquipmentItems.map((item) => {
                        const isChecked = enabledEquipmentIds.includes(item.id);
                        const unitCost = item.resource > 0 ? item.price / item.resource : 0;
                        return (
                          <label
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 2,
                              background: t.cardBg,
                              border: `1px solid ${isChecked ? t.selectedText : t.softBorder}`,
                              fontSize: 11.5,
                              cursor: 'pointer',
                              opacity: isChecked ? 1 : 0.75,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                handleToggleEnabledExtraEquipment(item.id, e.target.checked)
                              }
                              style={{ margin: 0 }}
                            />
                            <span style={{ flex: 1, fontWeight: 500, color: t.text }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: t.subText }}>
                              +{unitCost.toFixed(2)} ₽/шт.
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. ДОПОЛНИТЕЛЬНЫЕ ПАРАМЕТРЫ (КЛИЕНТСКИЕ И ВНУТРЕННИЕ В ОДНУ СТРОКУ) */}
          <div
            style={{
              paddingTop: 8,
              borderTop: `1px solid ${t.softBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: includeExtraParamsCost ? t.text : t.subText,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeExtraParamsCost}
                  onChange={(e) => onChange({ include_extra_params_cost: e.target.checked })}
                  style={{ margin: 0 }}
                />
                <span>
                  Доп. параметры и работы ({allParams.length} шт. — клиент.: {clientParams.length}, внутр.: {internalParams.length})
                </span>
              </label>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleAddParam}
                  style={{
                    padding: '4px 10px',
                    background: t.brandPrimary || 'var(--brand-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 2,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Добавить параметр
                </button>
                {onApplyToSubcategory && (
                  <button
                    type="button"
                    onClick={onApplyToSubcategory}
                    style={{
                      padding: '4px 9px',
                      background: t.subCardBg,
                      color: t.selectedText,
                      border: `1px solid ${t.border}`,
                      borderRadius: 2,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Применить ко всей подкатегории
                    {subcategoryName ? ` «${subcategoryName}»` : ''}
                  </button>
                )}
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    style={{
                      padding: '4px 10px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 2,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Сохранить
                  </button>
                )}
              </div>
            </div>

            {allParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allParams.map((cp) => {
                  const inputType: CostParamInputType = cp.input_type || 'checkbox';
                  const isParamEnabled = cp.is_enabled !== false;
                  const isClient = Boolean(cp.is_client_facing);
                  const showDirectCost = !isClient || inputType !== 'select';

                  return (
                    <div
                      key={cp.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 3,
                        background: t.subCardBg,
                        border: `1px solid ${t.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        opacity: isParamEnabled && includeExtraParamsCost ? 1 : 0.55,
                      }}
                    >
                      <div
                        className={
                          showDirectCost ? 'ui-admin-param-row-cost' : 'ui-admin-param-row-nocost'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isParamEnabled}
                          onChange={(e) =>
                            handleUpdateParam(cp.id, { is_enabled: e.target.checked })
                          }
                          style={{ margin: 0 }}
                          title="Учитывать этот параметр в расчёте"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateParam(cp.id, { is_client_facing: !isClient })
                          }
                          style={{
                            padding: '3px 7px',
                            borderRadius: 2,
                            fontSize: 11,
                            fontWeight: 700,
                            border: `1px solid ${isClient ? t.selectedBorder : t.border}`,
                            background: isClient ? t.selectedBg : t.cardBg,
                            color: isClient ? t.selectedText : t.subText,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="Нажмите, чтобы переключить: для клиента в калькуляторе / внутренний в админке"
                        >
                          {isClient ? 'Клиент' : 'Админ'}
                        </button>

                        <input
                          type="text"
                          placeholder="Название параметра"
                          value={cp.name}
                          onChange={(e) => handleUpdateParam(cp.id, { name: e.target.value })}
                          style={{ ...smallInputStyle, fontWeight: 600 }}
                        />

                        {isClient ? (
                          <select
                            value={inputType}
                            onChange={(e) =>
                              handleUpdateParam(cp.id, {
                                input_type: e.target.value as CostParamInputType,
                              })
                            }
                            style={smallInputStyle}
                            title="Тип поля в калькуляторе"
                          >
                            <option value="checkbox">Да / Нет</option>
                            <option value="select">Список</option>
                            <option value="number">Кол-во</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: t.subText,
                              textAlign: 'center',
                              padding: '4px 6px',
                              borderRadius: 2,
                              background: t.cardBg,
                              border: `1px solid ${t.softBorder}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Скрыт (всегда)
                          </span>
                        )}

                        {showDirectCost && (
                          <input
                            type="number"
                            step="0.05"
                            placeholder="Цена ₽"
                            value={cp.cost}
                            onChange={(e) =>
                              handleUpdateParam(cp.id, { cost: Number(e.target.value) })
                            }
                            style={smallInputStyle}
                            title="Себестоимость (₽)"
                          />
                        )}

                        <select
                          value={cp.mode}
                          onChange={(e) =>
                            handleUpdateParam(cp.id, {
                              mode: e.target.value as CostParamModeType,
                            })
                          }
                          style={smallInputStyle}
                        >
                          {(Object.keys(COST_PARAM_MODE_LABELS) as CostParamModeType[]).map(
                            (m) => (
                              <option key={m} value={m}>
                                {COST_PARAM_MODE_LABELS[m]}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveParam(cp.id)}
                          style={{
                            padding: '4px 8px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 2,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Удалить параметр"
                        >
                          ✕
                        </button>
                      </div>

                      {isClient && inputType === 'select' && (
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `2px solid ${t.selectedBorder}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 600, color: t.subText }}>
                              Варианты выпадающего списка (₽):
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddOption(cp)}
                              style={{
                                padding: '2px 7px',
                                background: t.cardBg,
                                color: t.selectedText,
                                border: `1px solid ${t.border}`,
                                borderRadius: 2,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              + Вариант
                            </button>
                          </div>
                          {(cp.options || []).map((opt) => (
                            <div
                              key={opt.id}
                              className="ui-admin-opt-row"
                            >
                              <input
                                type="text"
                                placeholder="Название варианта"
                                value={opt.label}
                                onChange={(e) =>
                                  handleUpdateOption(cp, opt.id, { label: e.target.value })
                                }
                                style={smallInputStyle}
                              />
                              <input
                                type="number"
                                step="0.05"
                                placeholder="Себестоимость (₽)"
                                value={opt.cost}
                                onChange={(e) =>
                                  handleUpdateOption(cp, opt.id, {
                                    cost: Number(e.target.value),
                                  })
                                }
                                style={smallInputStyle}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(cp, opt.id)}
                                disabled={(cp.options || []).length <= 1}
                                style={{
                                  padding: '4px 7px',
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 2,
                                  fontSize: 10.5,
                                  cursor: 'pointer',
                                  opacity: (cp.options || []).length <= 1 ? 0.4 : 1,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
