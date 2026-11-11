import React from 'react';
import {
  CategoryType,
  CostItem,
  MainCategory,
  MaterialCategory,
  MaterialCategoryKind,
  ProductCategory,
} from '../types';
import { getMaterialCategoryMeta, PAPER_COLOR_PRESETS } from '../constants';
import { AdminSectionType } from '../routing';
import {
  applyWideFormatDirectRollPriceEdit,
  applyWideFormatRollDimensionsEdit,
  applyWideFormatSqmCostEdit,
  computeRollAreaM2,
  computeRollPriceFromSqmCost,
  computeSqmCostFromRoll,
  formatEditableDecimal,
  isWideFormatRollMaterialCategory,
  resolveItemSqmCost,
  resolveRollDimensions,
} from '../utils/wideFormatPricing';

interface AdminMaterialsSectionProps {
  adminSection: AdminSectionType;
  adminMainCategories: MainCategory[];
  adminCategories: ProductCategory[];
  adminMaterialCategories: MaterialCategory[];
  adminItems: CostItem[];
  setAdminItems: React.Dispatch<React.SetStateAction<CostItem[]>>;
  activeMatMainCategoryId: string;
  setActiveMatMainCategoryId: (id: string) => void;
  activeMaterialCategory: CategoryType;
  setActiveMaterialCategory: (cat: CategoryType) => void;
  materialTableSearch: string;
  setMaterialTableSearch: (val: string) => void;
  materialTableGroupFilter: string;
  setMaterialTableGroupFilter: (val: string) => void;
  materialGroupsInTable: string[];
  filteredAdminMaterials: CostItem[];
  showAddMatCategoryForm: boolean;
  setShowAddMatCategoryForm: React.Dispatch<React.SetStateAction<boolean>>;
  newMatCatMainId: string;
  setNewMatCatMainId: (id: string) => void;
  newMatCatTitle: string;
  setNewMatCatTitle: (val: string) => void;
  newMatCatKind: MaterialCategoryKind;
  setNewMatCatKind: (val: MaterialCategoryKind) => void;
  newMatCatPreset: string;
  handleApplyMatCatPreset: (presetKey: string, kindOverride?: MaterialCategoryKind) => void;
  newMatCatResourceLabel: string;
  setNewMatCatResourceLabel: (val: string) => void;
  newMatCatUnitLabel: string;
  setNewMatCatUnitLabel: (val: string) => void;
  newMatCatHasClientName: boolean;
  setNewMatCatHasClientName: (val: boolean) => void;
  handleAddMaterialCategory: (e: React.FormEvent) => Promise<void>;
  editingMatCategory: MaterialCategory | null;
  setEditingMatCategory: React.Dispatch<React.SetStateAction<MaterialCategory | null>>;
  handleSaveEditedMatCategory: (e: React.FormEvent) => Promise<void>;
  handleDeleteMaterialCategory: (mc: MaterialCategory) => Promise<void>;
  showAddMaterialForm: boolean;
  setShowAddMaterialForm: React.Dispatch<React.SetStateAction<boolean>>;
  newMatCategory: CategoryType;
  setNewMatCategory: (cat: CategoryType) => void;
  newName: string;
  setNewName: (val: string) => void;
  newClientName: string;
  setNewClientName: (val: string) => void;
  newMatGroup: string;
  setNewMatGroup: (val: string) => void;
  newMatColorName: string;
  setNewMatColorName: (val: string) => void;
  newMatColorHex: string;
  setNewMatColorHex: (val: string) => void;
  newMatInStock: boolean;
  setNewMatInStock: (val: boolean) => void;
  newPrice: string;
  setNewPrice: (val: string) => void;
  newResource: string;
  setNewResource: (val: string) => void;
  newRollWidth: string;
  setNewRollWidth: (val: string) => void;
  newRollLength: string;
  setNewRollLength: (val: string) => void;
  newSqmCost: string;
  setNewSqmCost: (val: string) => void;
  newMatEnabledCats: string[];
  setNewMatEnabledCats: React.Dispatch<React.SetStateAction<string[]>>;
  handleAddItemFromPage: (e: React.FormEvent) => Promise<void>;
  isEditingMaterials: boolean;
  setIsEditingMaterials: (val: boolean) => void;
  setDirtyMaterialIds: React.Dispatch<React.SetStateAction<number[]>>;
  markMaterialDirty: (id: number) => void;
  handleSaveAllEditedMaterials: () => Promise<void>;
  handleUpdateItem: (item: CostItem) => Promise<void>;
  handleDeleteItem: (id: number) => Promise<void>;
  loadAdminData: (pinToUse?: string, silent?: boolean) => Promise<void>;
  adminPin: string;
  renderMainCategoryPicker: (
    selectedMainCatId: string,
    onSelectMainCat: (mcId: string) => void,
    mode: 'materials' | 'markups'
  ) => React.ReactNode;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  smallInputStyle: React.CSSProperties;
}

export default function AdminMaterialsSection({
  adminSection,
  adminMainCategories,
  adminCategories,
  adminMaterialCategories,
  adminItems,
  setAdminItems,
  activeMatMainCategoryId,
  setActiveMatMainCategoryId,
  activeMaterialCategory,
  setActiveMaterialCategory,
  materialTableSearch,
  setMaterialTableSearch,
  materialTableGroupFilter,
  setMaterialTableGroupFilter,
  materialGroupsInTable,
  filteredAdminMaterials,
  showAddMatCategoryForm,
  setShowAddMatCategoryForm,
  newMatCatMainId,
  setNewMatCatMainId,
  newMatCatTitle,
  setNewMatCatTitle,
  newMatCatKind,
  setNewMatCatKind,
  newMatCatPreset,
  handleApplyMatCatPreset,
  newMatCatResourceLabel,
  setNewMatCatResourceLabel,
  newMatCatUnitLabel,
  setNewMatCatUnitLabel,
  newMatCatHasClientName,
  setNewMatCatHasClientName,
  handleAddMaterialCategory,
  editingMatCategory,
  setEditingMatCategory,
  handleSaveEditedMatCategory,
  handleDeleteMaterialCategory,
  showAddMaterialForm,
  setShowAddMaterialForm,
  newMatCategory,
  setNewMatCategory,
  newName,
  setNewName,
  newClientName,
  setNewClientName,
  newMatGroup,
  setNewMatGroup,
  newMatColorName,
  setNewMatColorName,
  newMatColorHex,
  setNewMatColorHex,
  newMatInStock,
  setNewMatInStock,
  newPrice,
  setNewPrice,
  newResource,
  setNewResource,
  newRollWidth,
  setNewRollWidth,
  newRollLength,
  setNewRollLength,
  newSqmCost,
  setNewSqmCost,
  newMatEnabledCats,
  setNewMatEnabledCats,
  handleAddItemFromPage,
  isEditingMaterials,
  setIsEditingMaterials,
  setDirtyMaterialIds,
  markMaterialDirty,
  handleSaveAllEditedMaterials,
  handleUpdateItem,
  handleDeleteItem,
  loadAdminData,
  adminPin,
  renderMainCategoryPicker,
  theme: t,
  inputStyle,
  smallInputStyle,
}: AdminMaterialsSectionProps) {
  const defaultMainCatId = adminMainCategories[0]?.id || 'polygraphy';
  const effectiveMainCatId = adminMainCategories.some(
    (mc) => mc.id === activeMatMainCategoryId
  )
    ? activeMatMainCategoryId
    : defaultMainCatId;
  const currentMainCatObj = adminMainCategories.find(
    (mc) => mc.id === effectiveMainCatId
  );

  const matCatsForCurrentMain = adminMaterialCategories.filter(
    (c) => (c.main_category_id || defaultMainCatId) === effectiveMainCatId
  );

  const activeCatMeta = getMaterialCategoryMeta(
    activeMaterialCategory,
    adminMaterialCategories
  );
  const newMatCatMeta = getMaterialCategoryMeta(
    newMatCategory,
    adminMaterialCategories
  );
  const activeMatCatObj: MaterialCategory =
    adminMaterialCategories.find((c) => c.id === activeMaterialCategory) || {
      id: activeCatMeta.id,
      main_category_id: activeCatMeta.mainCategoryId || effectiveMainCatId,
      title: activeCatMeta.title,
      kind: activeCatMeta.kind,
      resource_label: activeCatMeta.resourceLabel,
      unit_label: activeCatMeta.unitLabel,
      default_unit: activeCatMeta.defaultUnit,
      has_client_name: activeCatMeta.hasClientName,
      is_system: activeCatMeta.isSystem,
    };

  const isWideFormatRollActive = isWideFormatRollMaterialCategory(activeCatMeta);
  const isNewMatWideFormatRoll = isWideFormatRollMaterialCategory(newMatCatMeta);

  const [sqmCostDrafts, setSqmCostDrafts] = React.useState<Record<number, string>>({});
  const [rollWidthDrafts, setRollWidthDrafts] = React.useState<Record<number, string>>({});
  const [rollLengthDrafts, setRollLengthDrafts] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    setSqmCostDrafts({});
    setRollWidthDrafts({});
    setRollLengthDrafts({});
  }, [isEditingMaterials, activeMaterialCategory]);

  return (
    <div>
      {renderMainCategoryPicker(
        effectiveMainCatId,
        (mcId) => {
          const catsInMain = adminMaterialCategories.filter(
            (c) => (c.main_category_id || defaultMainCatId) === mcId
          );
          setActiveMatMainCategoryId(mcId);
          setNewMatCatMainId(mcId);
          setMaterialTableGroupFilter('ALL');
          setEditingMatCategory(null);
          if (catsInMain.length > 0) {
            setActiveMaterialCategory(catsInMain[0].id);
            setNewMatCategory(catsInMain[0].id);
          }
        },
        'materials'
      )}

      <div
        style={{
          background: t.cardBg,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            background: t.subCardBg,
            borderBottom: `1px solid ${t.softBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {matCatsForCurrentMain.length === 0 ? (
              <span style={{ fontSize: 12.5, color: t.subText }}>
                В разделе «{currentMainCatObj?.name}» нет категорий.
              </span>
            ) : (
              <>
                <select
                  value={
                    matCatsForCurrentMain.some((c) => c.id === activeMaterialCategory)
                      ? activeMaterialCategory
                      : matCatsForCurrentMain[0]?.id || activeMaterialCategory
                  }
                  onChange={(e) => {
                    const nextCat = e.target.value as CategoryType;
                    setActiveMaterialCategory(nextCat);
                    setNewMatCategory(nextCat);
                    setMaterialTableGroupFilter('ALL');
                    setEditingMatCategory(null);
                  }}
                  style={{
                    ...inputStyle,
                    width: 'auto',
                    minWidth: 230,
                    height: 32,
                    padding: '3px 8px',
                    fontWeight: 600,
                    fontSize: 12.5,
                  }}
                >
                  {matCatsForCurrentMain.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title} ({adminItems.filter((i) => i.category === cat.id).length})
                    </option>
                  ))}
                </select>

                {materialGroupsInTable.length > 1 && (
                  <select
                    value={materialTableGroupFilter}
                    onChange={(e) => setMaterialTableGroupFilter(e.target.value)}
                    style={{
                      ...smallInputStyle,
                      width: 150,
                      height: 32,
                      padding: '3px 8px',
                      fontSize: 12.5,
                    }}
                  >
                    <option value="ALL">Все группы</option>
                    {materialGroupsInTable.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={materialTableSearch}
                  onChange={(e) => setMaterialTableSearch(e.target.value)}
                  style={{
                    ...smallInputStyle,
                    width: 175,
                    height: 32,
                    padding: '3px 8px',
                    fontSize: 12.5,
                  }}
                />
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() =>
                setEditingMatCategory((prev) =>
                  prev && prev.id === activeMatCatObj.id ? null : { ...activeMatCatObj }
                )
              }
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
              Настроить раздел
            </button>

            <button
              type="button"
              onClick={() => {
                setNewMatCatMainId(effectiveMainCatId);
                setShowAddMatCategoryForm((prev) => !prev);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 2,
                border: `1px solid ${showAddMatCategoryForm ? '#E11D48' : '#C02721'}`,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                background: showAddMatCategoryForm ? '#E11D48' : '#C02721',
                color: '#fff',
              }}
            >
              {showAddMatCategoryForm ? '✕ Раздел' : '+ Раздел'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  matCatsForCurrentMain.length > 0 &&
                  !matCatsForCurrentMain.some((c) => c.id === activeMaterialCategory)
                ) {
                  setNewMatCategory(matCatsForCurrentMain[0].id);
                } else {
                  setNewMatCategory(activeMaterialCategory);
                }
                setShowAddMaterialForm((prev) => !prev);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 2,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                background: showAddMaterialForm ? '#E11D48' : '#10B981',
                color: '#fff',
              }}
            >
              {showAddMaterialForm ? '✕ Позиция' : '+ Позиция'}
            </button>

            {!isEditingMaterials ? (
              <button
                type="button"
                onClick={() => setIsEditingMaterials(true)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 2,
                  border: `1px solid #C02721`,
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
                  onClick={handleSaveAllEditedMaterials}
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
                    setIsEditingMaterials(false);
                    setDirtyMaterialIds([]);
                    loadAdminData(adminPin, true);
                  }}
                  style={{
                    padding: '5px 9px',
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

        {/* Форма создания новой категории материалов / оборудования */}
        {showAddMatCategoryForm && (
          <form
            onSubmit={handleAddMaterialCategory}
            style={{
              padding: 14,
              background: t.subCardBg,
              borderBottom: `1px solid ${t.softBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>
              Новый раздел материалов или оборудования
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Направление:
                </label>
                <select
                  value={newMatCatMainId || effectiveMainCatId}
                  onChange={(e) => setNewMatCatMainId(e.target.value)}
                  style={smallInputStyle}
                >
                  {adminMainCategories.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Тип раздела:
                </label>
                <select
                  value={newMatCatKind}
                  onChange={(e) => {
                    const nextKind = e.target.value as MaterialCategoryKind;
                    setNewMatCatKind(nextKind);
                    handleApplyMatCatPreset(nextKind === 'equipment' ? 'unit_eq' : 'unit_pcs', nextKind);
                  }}
                  style={smallInputStyle}
                >
                  <option value="material">Материалы / заготовки</option>
                  <option value="equipment">Краска / Оборудование</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Название раздела:
                </label>
                <input
                  type="text"
                  placeholder="Напр.: Баннеры и сетка"
                  value={newMatCatTitle}
                  onChange={(e) => setNewMatCatTitle(e.target.value)}
                  style={smallInputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Шаблон единицы:
                </label>
                <select
                  value={newMatCatPreset}
                  onChange={(e) => handleApplyMatCatPreset(e.target.value)}
                  style={smallInputStyle}
                >
                  <option value="unit_pcs">Поштучно (₽ / шт.)</option>
                  <option value="unit_m2">Площадь (₽ / м²)</option>
                  <option value="unit_eq">Ресурс оборудования (₽ / ед.)</option>
                  <option value="unit_sheets">Листовой (₽ / лист)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Колонка ресурса:
                </label>
                <input
                  type="text"
                  value={newMatCatResourceLabel}
                  onChange={(e) => setNewMatCatResourceLabel(e.target.value)}
                  style={smallInputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Единица себестоимости:
                </label>
                <input
                  type="text"
                  value={newMatCatUnitLabel}
                  onChange={(e) => setNewMatCatUnitLabel(e.target.value)}
                  style={smallInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newMatCatHasClientName}
                  onChange={(e) => setNewMatCatHasClientName(e.target.checked)}
                />
                <span>Клиентское название, группа и статус наличия</span>
              </label>

              <button
                type="submit"
                style={{
                  padding: '6px 14px',
                  background: t.brandPrimary || 'var(--brand-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                Создать раздел
              </button>
            </div>
          </form>
        )}

        {/* Форма добавления новой позиции */}
        {(showAddMaterialForm || adminSection === 'add_material') && (
          <form
            onSubmit={handleAddItemFromPage}
            style={{
              padding: 14,
              background: t.subCardBg,
              borderBottom: `1px solid ${t.softBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>
              Новая позиция в базу материалов / оборудования
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Раздел:
                </label>
                <select
                  value={newMatCategory}
                  onChange={(e) => {
                    const nextCatId = e.target.value as CategoryType;
                    setNewMatCategory(nextCatId);
                    const nextMeta = getMaterialCategoryMeta(nextCatId, adminMaterialCategories);
                    if (isWideFormatRollMaterialCategory(nextMeta)) {
                      if (Number(newPrice) > 0 && Number(newResource) > 0) {
                        setNewSqmCost(
                          formatEditableDecimal(
                            computeSqmCostFromRoll(Number(newPrice), Number(newResource))
                          )
                        );
                      }
                    } else {
                      setNewSqmCost('');
                    }
                    const foundObj = adminMaterialCategories.find((c) => c.id === nextCatId);
                    if (foundObj?.main_category_id) {
                      setActiveMatMainCategoryId(foundObj.main_category_id);
                      setActiveMaterialCategory(nextCatId);
                    }
                  }}
                  style={smallInputStyle}
                >
                  {adminMainCategories.map((mc) => {
                    const groupCats = adminMaterialCategories.filter(
                      (c) => (c.main_category_id || defaultMainCatId) === mc.id
                    );
                    if (groupCats.length === 0) return null;
                    return (
                      <optgroup key={mc.id} label={mc.name}>
                        {groupCats.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                  Внутреннее название (склад):
                </label>
                <input
                  type="text"
                  placeholder={
                    isNewMatWideFormatRoll
                      ? 'Напр.: Баннер литой 510 г/м² (рулон 3.2×50м)'
                      : 'Напр.: NOW!PRINT - Gloss 200 гр.'
                  }
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={smallInputStyle}
                />
              </div>

              {newMatCatMeta.hasClientName && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                      Название для клиентов:
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isNewMatWideFormatRoll
                          ? 'Напр.: Баннерная ткань литая 510 г/м²'
                          : 'Напр.: Мелованная 200 г/м²'
                      }
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      style={smallInputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                      Группа / Тип:
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isNewMatWideFormatRoll ? 'Напр.: Баннерная ткань' : 'Напр.: Мелованная'
                      }
                      value={newMatGroup}
                      onChange={(e) => setNewMatGroup(e.target.value)}
                      style={smallInputStyle}
                    />
                  </div>
                </>
              )}

              {isNewMatWideFormatRoll ? (
                <>
                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      Ширина рулона (м):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="1.6"
                      aria-label="Ширина рулона (м)"
                      data-testid="wf-new-roll-width-input"
                      value={newRollWidth}
                      onChange={(e) => {
                        const nextW = e.target.value;
                        setNewRollWidth(nextW);
                        const area = computeRollAreaM2(Number(nextW), Number(newRollLength));
                        setNewResource(area > 0 ? String(area) : '');
                        if (
                          newSqmCost.trim() !== '' &&
                          Number.isFinite(Number(newSqmCost)) &&
                          area > 0
                        ) {
                          setNewPrice(
                            String(computeRollPriceFromSqmCost(Number(newSqmCost), area))
                          );
                        }
                      }}
                      className="tabular-nums"
                      style={smallInputStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      Длина рулона (м):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="50"
                      aria-label="Длина рулона (м)"
                      data-testid="wf-new-roll-length-input"
                      value={newRollLength}
                      onChange={(e) => {
                        const nextL = e.target.value;
                        setNewRollLength(nextL);
                        const area = computeRollAreaM2(Number(newRollWidth), Number(nextL));
                        setNewResource(area > 0 ? String(area) : '');
                        if (
                          newSqmCost.trim() !== '' &&
                          Number.isFinite(Number(newSqmCost)) &&
                          area > 0
                        ) {
                          setNewPrice(
                            String(computeRollPriceFromSqmCost(Number(newSqmCost), area))
                          );
                        }
                      }}
                      className="tabular-nums"
                      style={smallInputStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      Себестоимость за 1 м² (₽):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="95"
                      aria-label="Себестоимость за 1 м² (₽)"
                      data-testid="wf-new-sqm-cost-input"
                      value={newSqmCost}
                      onChange={(e) => {
                        const nextSqm = e.target.value;
                        setNewSqmCost(nextSqm);
                        const area = computeRollAreaM2(Number(newRollWidth), Number(newRollLength));
                        if (area > 0) {
                          setNewResource(String(area));
                        }
                        if (
                          nextSqm.trim() !== '' &&
                          Number.isFinite(Number(nextSqm)) &&
                          area > 0
                        ) {
                          setNewPrice(
                            String(computeRollPriceFromSqmCost(Number(nextSqm), area))
                          );
                        }
                      }}
                      className="tabular-nums"
                      style={{
                        ...smallInputStyle,
                        border: `1px solid ${t.clientInputBorder}`,
                        background: t.clientInputBg,
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      Цена рулона (₽):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="7600"
                      aria-label="Цена рулона (₽)"
                      data-testid="wf-new-roll-price-input"
                      value={newPrice}
                      onChange={(e) => {
                        const nextRollPrice = e.target.value;
                        setNewPrice(nextRollPrice);
                        const area = computeRollAreaM2(Number(newRollWidth), Number(newRollLength));
                        if (area > 0) {
                          setNewResource(String(area));
                        }
                        if (nextRollPrice.trim() === '') {
                          setNewSqmCost('');
                        } else if (Number.isFinite(Number(nextRollPrice)) && area > 0) {
                          setNewSqmCost(
                            formatEditableDecimal(
                              computeSqmCostFromRoll(Number(nextRollPrice), area)
                            )
                          );
                        }
                      }}
                      className="tabular-nums"
                      style={smallInputStyle}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      Стоимость закупки (₽):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1850"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="tabular-nums"
                      style={smallInputStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}
                    >
                      {newMatCatMeta.resourceLabel}:
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="250"
                      value={newResource}
                      onChange={(e) => setNewResource(e.target.value)}
                      className="tabular-nums"
                      style={smallInputStyle}
                    />
                  </div>
                </>
              )}
            </div>

            {newMatCatMeta.hasClientName && newMatCategory === 'papers' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                    Цвет бумаги:
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={newMatColorHex}
                      onChange={(e) => setNewMatColorHex(e.target.value)}
                      style={{
                        width: 32,
                        height: 32,
                        padding: 2,
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        cursor: 'pointer',
                      }}
                    />
                    <input
                      type="text"
                      list="paper-color-presets-global"
                      placeholder="Белый / Слоновая кость"
                      value={newMatColorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewMatColorName(val);
                        const preset = PAPER_COLOR_PRESETS.find(
                          (p) => p.name.toLowerCase() === val.toLowerCase()
                        );
                        if (preset) setNewMatColorHex(preset.hex);
                      }}
                      style={smallInputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 11.5, color: t.mutedText }}>
                    Наличие:
                  </label>
                  <select
                    value={newMatInStock ? '1' : '0'}
                    onChange={(e) => setNewMatInStock(e.target.value === '1')}
                    style={smallInputStyle}
                  >
                    <option value="1">В наличии</option>
                    <option value="0">Нет в наличии</option>
                  </select>
                </div>
              </div>
            )}

            {(newMatCategory === 'papers' || newMatCategory === 'laminations') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.mutedText, marginRight: 4 }}>
                  Включить для подкатегорий:
                </span>
                {adminCategories.map((cat) => {
                  const checked = newMatEnabledCats.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 8px',
                        borderRadius: 2,
                        fontSize: 12,
                        cursor: 'pointer',
                        border: checked ? `1px solid ${t.selectedBorder}` : `1px solid ${t.border}`,
                        background: checked ? t.selectedBg : t.cardBg,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewMatEnabledCats((prev) =>
                            prev.includes(cat.id)
                              ? prev.filter((id) => id !== cat.id)
                              : [...prev, cat.id]
                          )
                        }
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: t.subText }}>
                {isNewMatWideFormatRoll ? (
                  Number(newPrice) > 0 && Number(newRollWidth) > 0 && Number(newRollLength) > 0 ? (
                    <>
                      Расчёт рулона:{' '}
                      <b className="tabular-nums" style={{ color: t.selectedText }}>
                        {newRollWidth} м × {newRollLength} м (
                        {computeRollAreaM2(Number(newRollWidth), Number(newRollLength))} м²) ×{' '}
                        {(newSqmCost.trim() !== '' && Number.isFinite(Number(newSqmCost))
                          ? Number(newSqmCost)
                          : Number(newPrice) /
                            Math.max(
                              0.0001,
                              computeRollAreaM2(Number(newRollWidth), Number(newRollLength))
                            )
                        ).toFixed(2)}{' '}
                        ₽/м² = {Number(newPrice).toFixed(2)} ₽
                      </b>
                    </>
                  ) : null
                ) : Number(newPrice) > 0 && Number(newResource) > 0 ? (
                  <>
                    Себестоимость за 1 ед.:{' '}
                    <b className="tabular-nums" style={{ color: t.selectedText }}>
                      {(Number(newPrice) / Number(newResource)).toFixed(2)}{' '}
                      {newMatCatMeta.unitLabel}
                    </b>
                  </>
                ) : null}
              </span>
              <button
                type="submit"
                style={{
                  padding: '7px 16px',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                Добавить в «{newMatCatMeta.title}»
              </button>
            </div>
          </form>
        )}

        {/* Форма редактирования выбранного раздела материалов */}
        {editingMatCategory && editingMatCategory.id === activeMaterialCategory && (
          <form
            onSubmit={handleSaveEditedMatCategory}
            style={{
              padding: 14,
              background: t.subCardBg,
              borderBottom: `1px solid ${t.softBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              Настройка раздела «{activeCatMeta.title}»
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 11.5, color: t.mutedText, marginBottom: 4 }}>
                  Направление:
                </label>
                <select
                  value={editingMatCategory.main_category_id || effectiveMainCatId}
                  onChange={(e) =>
                    setEditingMatCategory({
                      ...editingMatCategory,
                      main_category_id: e.target.value,
                    })
                  }
                  style={smallInputStyle}
                >
                  {adminMainCategories.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, color: t.mutedText, marginBottom: 4 }}>
                  Название:
                </label>
                <input
                  type="text"
                  value={editingMatCategory.title}
                  onChange={(e) =>
                    setEditingMatCategory({ ...editingMatCategory, title: e.target.value })
                  }
                  style={smallInputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, color: t.mutedText, marginBottom: 4 }}>
                  Тип:
                </label>
                <select
                  value={editingMatCategory.kind || 'material'}
                  onChange={(e) =>
                    setEditingMatCategory({
                      ...editingMatCategory,
                      kind: e.target.value as MaterialCategoryKind,
                    })
                  }
                  style={smallInputStyle}
                >
                  <option value="material">Материалы и заготовки</option>
                  <option value="equipment">Краска / Оборудование</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, color: t.mutedText, marginBottom: 4 }}>
                  Колонка ресурса:
                </label>
                <input
                  type="text"
                  value={editingMatCategory.resource_label}
                  onChange={(e) =>
                    setEditingMatCategory({
                      ...editingMatCategory,
                      resource_label: e.target.value,
                    })
                  }
                  style={smallInputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, color: t.mutedText, marginBottom: 4 }}>
                  Единица себестоимости:
                </label>
                <input
                  type="text"
                  value={editingMatCategory.unit_label}
                  onChange={(e) =>
                    setEditingMatCategory({
                      ...editingMatCategory,
                      unit_label: e.target.value,
                    })
                  }
                  style={smallInputStyle}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(editingMatCategory.has_client_name)}
                  onChange={(e) =>
                    setEditingMatCategory({
                      ...editingMatCategory,
                      has_client_name: e.target.checked,
                    })
                  }
                />
                <span>Показывать колонки «Название для клиента», «Группа» и «Наличие»</span>
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                {!editingMatCategory.is_system && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMaterialCategory(editingMatCategory)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 2,
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    Удалить раздел
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingMatCategory(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 2,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.text,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 2,
                    border: 'none',
                    background: '#16a34a',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </form>
        )}

        <datalist id="paper-color-presets-global">
          {PAPER_COLOR_PRESETS.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>

        {isEditingMaterials && isWideFormatRollActive && (
          <div
            style={{
              padding: '7px 14px',
              background: t.subCardBg,
              borderBottom: `1px solid ${t.softBorder}`,
              fontSize: 12,
              color: t.subText,
            }}
          >
            Укажите ширину и длину рулона, а также себестоимость за 1 м² — цена рулона
            рассчитывается автоматически (ширина × длина × себест. за 1 м²).
          </div>
        )}

        <div className="ui-table-scroll">
          <table
            style={{
              width: '100%',
              minWidth: isEditingMaterials && isWideFormatRollActive ? 980 : undefined,
              borderCollapse: 'collapse',
            }}
          >
          <thead>
            <tr
              style={{
                background: t.tableHeaderBg,
                textAlign: 'left',
                fontSize: 12.5,
                borderBottom: `1px solid ${t.softBorder}`,
              }}
            >
              <th style={{ padding: '8px 10px', minWidth: isEditingMaterials ? 175 : undefined }}>
                Внутреннее название (склад)
              </th>
              {activeCatMeta.hasClientName && (
                <>
                  <th style={{ padding: '8px 10px', minWidth: isEditingMaterials ? 165 : undefined }}>
                    Название для клиента
                  </th>
                  <th style={{ padding: '8px 10px', width: isWideFormatRollActive ? 120 : 135 }}>
                    Группа
                  </th>
                </>
              )}
              {activeMaterialCategory === 'papers' && (
                <th style={{ padding: '8px 10px', width: 145 }}>Цвет</th>
              )}
              {isEditingMaterials && activeCatMeta.hasClientName && (
                <th style={{ padding: '8px 10px', width: isWideFormatRollActive ? 102 : 115 }}>
                  Наличие
                </th>
              )}
              <th style={{ padding: '8px 10px', width: isWideFormatRollActive ? 108 : 105 }}>
                {isWideFormatRollActive ? 'Цена рулона (₽)' : 'Закупка (₽)'}
              </th>
              {isWideFormatRollActive ? (
                <>
                  <th style={{ padding: '8px 10px', width: 92 }}>Ширина рулона (м)</th>
                  <th style={{ padding: '8px 10px', width: 92 }}>Длина рулона (м)</th>
                </>
              ) : (
                <th style={{ padding: '8px 10px', width: 110 }}>
                  {activeCatMeta.resourceLabel}
                </th>
              )}
              <th style={{ padding: '8px 10px', width: isWideFormatRollActive ? 114 : 110 }}>
                {isWideFormatRollActive
                  ? 'Себест. за 1 м² (₽)'
                  : `Себест. (${activeCatMeta.unitLabel})`}
              </th>
              {isEditingMaterials && <th style={{ padding: '8px 10px', width: 82 }}>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAdminMaterials.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: 18,
                    textAlign: 'center',
                    color: t.subText,
                    fontSize: 13,
                    borderBottom: `1px solid ${t.softBorder}`,
                  }}
                >
                  В разделе «{activeCatMeta.title}» нет позиций.
                </td>
              </tr>
            ) : (
              filteredAdminMaterials.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: `1px solid ${t.softBorder}`,
                    opacity: item.in_stock === false ? 0.65 : 1,
                  }}
                >
                  <td style={{ padding: '7px 10px' }}>
                    {isEditingMaterials ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          markMaterialDirty(item.id);
                          setAdminItems((prev) =>
                            prev.map((el) =>
                              el.id === item.id ? { ...el, name: e.target.value } : el
                            )
                          );
                        }}
                        style={{ ...smallInputStyle, padding: 5 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  {activeCatMeta.hasClientName && (
                    <>
                      <td style={{ padding: '7px 10px' }}>
                        {isEditingMaterials ? (
                          <input
                            type="text"
                            value={item.client_name || ''}
                            placeholder="Название для клиента..."
                            onChange={(e) => {
                              markMaterialDirty(item.id);
                              setAdminItems((prev) =>
                                prev.map((el) =>
                                  el.id === item.id
                                    ? { ...el, client_name: e.target.value }
                                    : el
                                )
                              );
                            }}
                            style={{
                              ...smallInputStyle,
                              padding: 5,
                              border: `1px solid ${t.clientInputBorder}`,
                              background: t.clientInputBg,
                              fontWeight: 500,
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, color: t.text }}>
                            {item.client_name || item.name}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {isEditingMaterials ? (
                          <input
                            type="text"
                            value={item.group || ''}
                            placeholder="Группа..."
                            onChange={(e) => {
                              markMaterialDirty(item.id);
                              setAdminItems((prev) =>
                                prev.map((el) =>
                                  el.id === item.id ? { ...el, group: e.target.value } : el
                                )
                              );
                            }}
                            style={{ ...smallInputStyle, padding: 5 }}
                          />
                        ) : (
                          <span style={{ fontSize: 12.5, color: t.subText }}>
                            {item.group || '—'}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  {activeMaterialCategory === 'papers' && (
                    <td style={{ padding: '7px 10px' }}>
                      {isEditingMaterials ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="color"
                            value={item.color_hex || '#ffffff'}
                            onChange={(e) => {
                              markMaterialDirty(item.id);
                              setAdminItems((prev) =>
                                prev.map((el) =>
                                  el.id === item.id ? { ...el, color_hex: e.target.value } : el
                                )
                              );
                            }}
                            style={{
                              width: 26,
                              height: 26,
                              padding: 0,
                              border: `1px solid ${t.border}`,
                              borderRadius: 2,
                              background: 'transparent',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          />
                          <input
                            type="text"
                            list="paper-color-presets-global"
                            value={item.color_name || 'Белый'}
                            onChange={(e) => {
                              const val = e.target.value;
                              const preset = PAPER_COLOR_PRESETS.find(
                                (p) => p.name.toLowerCase() === val.toLowerCase()
                              );
                              markMaterialDirty(item.id);
                              setAdminItems((prev) =>
                                prev.map((el) =>
                                  el.id === item.id
                                    ? {
                                        ...el,
                                        color_name: val,
                                        color_hex: preset ? preset.hex : el.color_hex || '#ffffff',
                                      }
                                    : el
                                )
                              );
                            }}
                            style={{ ...smallInputStyle, padding: 5 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 2,
                              border: `1px solid ${t.border}`,
                              background: item.color_hex || '#ffffff',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12.5, color: t.text }}>
                            {item.color_name || 'Белый'}
                          </span>
                        </div>
                      )}
                    </td>
                  )}
                  {isEditingMaterials && activeCatMeta.hasClientName && (
                    <td style={{ padding: '7px 10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const nextStock = item.in_stock === false ? true : false;
                          const updated = { ...item, in_stock: nextStock };
                          markMaterialDirty(item.id);
                          setAdminItems((prev) =>
                            prev.map((el) => (el.id === item.id ? updated : el))
                          );
                          handleUpdateItem(updated);
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 2,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                          background: item.in_stock === false ? '#ef4444' : '#16a34a',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.in_stock === false ? 'Нет в наличии' : 'В наличии'}
                      </button>
                    </td>
                  )}
                  <td style={{ padding: '7px 10px' }}>
                    {isEditingMaterials ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`${
                          isWideFormatRollActive ? 'Цена рулона' : 'Закупка'
                        } — ${item.name}`}
                        data-testid={
                          isWideFormatRollActive ? `wf-roll-price-input-${item.id}` : undefined
                        }
                        value={item.price}
                        onChange={(e) => {
                          const nextPrice = Number(e.target.value);
                          markMaterialDirty(item.id);
                          if (isWideFormatRollActive) {
                            setSqmCostDrafts((prev) => {
                              if (!(item.id in prev)) return prev;
                              const copy = { ...prev };
                              delete copy[item.id];
                              return copy;
                            });
                            setAdminItems((prev) =>
                              prev.map((el) =>
                                el.id === item.id
                                  ? applyWideFormatDirectRollPriceEdit(el, nextPrice)
                                  : el
                              )
                            );
                          } else {
                            setAdminItems((prev) =>
                              prev.map((el) =>
                                el.id === item.id ? { ...el, price: nextPrice } : el
                              )
                            );
                          }
                        }}
                        className="tabular-nums"
                        style={{ ...smallInputStyle, padding: 5 }}
                      />
                    ) : (
                      <span className="tabular-nums" style={{ fontSize: 13, color: t.text }}>
                        {item.price} ₽
                      </span>
                    )}
                  </td>
                  {isWideFormatRollActive ? (
                    (() => {
                      const rollDims = resolveRollDimensions(item);
                      const draftSqmRaw = sqmCostDrafts[item.id];
                      const draftSqmParsed =
                        draftSqmRaw !== undefined && draftSqmRaw.trim() !== ''
                          ? Number(draftSqmRaw)
                          : undefined;
                      return (
                        <>
                          <td style={{ padding: '7px 10px' }}>
                            {isEditingMaterials ? (
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                aria-label={`Ширина рулона (м) — ${item.name}`}
                                data-testid={`wf-roll-width-input-${item.id}`}
                                value={
                                  rollWidthDrafts[item.id] !== undefined
                                    ? rollWidthDrafts[item.id]
                                    : formatEditableDecimal(rollDims.widthM)
                                }
                                onChange={(e) => {
                                  const rawW = e.target.value;
                                  setRollWidthDrafts((prev) => ({ ...prev, [item.id]: rawW }));
                                  const parsedW = rawW.trim() === '' ? 0 : Number(rawW);
                                  if (Number.isFinite(parsedW) && parsedW >= 0) {
                                    markMaterialDirty(item.id);
                                    setAdminItems((prev) =>
                                      prev.map((el) => {
                                        if (el.id !== item.id) return el;
                                        const curDims = resolveRollDimensions(el);
                                        return applyWideFormatRollDimensionsEdit(
                                          el,
                                          parsedW,
                                          curDims.lengthM,
                                          draftSqmParsed
                                        );
                                      })
                                    );
                                  }
                                }}
                                className="tabular-nums"
                                style={{ ...smallInputStyle, padding: 5 }}
                              />
                            ) : (
                              <span className="tabular-nums" style={{ fontSize: 13, color: t.text }}>
                                {rollDims.widthM} м
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {isEditingMaterials ? (
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                aria-label={`Длина рулона (м) — ${item.name}`}
                                data-testid={`wf-roll-length-input-${item.id}`}
                                value={
                                  rollLengthDrafts[item.id] !== undefined
                                    ? rollLengthDrafts[item.id]
                                    : formatEditableDecimal(rollDims.lengthM)
                                }
                                onChange={(e) => {
                                  const rawL = e.target.value;
                                  setRollLengthDrafts((prev) => ({ ...prev, [item.id]: rawL }));
                                  const parsedL = rawL.trim() === '' ? 0 : Number(rawL);
                                  if (Number.isFinite(parsedL) && parsedL >= 0) {
                                    markMaterialDirty(item.id);
                                    setAdminItems((prev) =>
                                      prev.map((el) => {
                                        if (el.id !== item.id) return el;
                                        const curDims = resolveRollDimensions(el);
                                        return applyWideFormatRollDimensionsEdit(
                                          el,
                                          curDims.widthM,
                                          parsedL,
                                          draftSqmParsed
                                        );
                                      })
                                    );
                                  }
                                }}
                                className="tabular-nums"
                                style={{ ...smallInputStyle, padding: 5 }}
                              />
                            ) : (
                              <span className="tabular-nums" style={{ fontSize: 13, color: t.text }}>
                                {rollDims.lengthM} м
                              </span>
                            )}
                          </td>
                        </>
                      );
                    })()
                  ) : (
                    <td style={{ padding: '7px 10px' }}>
                      {isEditingMaterials ? (
                        <input
                          type="number"
                          min="1"
                          aria-label={`${activeCatMeta.resourceLabel} — ${item.name}`}
                          value={item.resource}
                          onChange={(e) => {
                            const nextResource = Number(e.target.value);
                            markMaterialDirty(item.id);
                            setAdminItems((prev) =>
                              prev.map((el) =>
                                el.id === item.id ? { ...el, resource: nextResource } : el
                              )
                            );
                          }}
                          className="tabular-nums"
                          style={{ ...smallInputStyle, padding: 5 }}
                        />
                      ) : (
                        <span className="tabular-nums" style={{ fontSize: 13, color: t.text }}>
                          {item.resource}
                        </span>
                      )}
                    </td>
                  )}
                  <td
                    className="tabular-nums"
                    style={{ padding: '7px 10px', fontWeight: 600, fontSize: 13 }}
                  >
                    {isEditingMaterials && isWideFormatRollActive ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Себестоимость за 1 м² — ${item.name}`}
                        data-testid={`wf-sqm-cost-input-${item.id}`}
                        value={
                          sqmCostDrafts[item.id] !== undefined
                            ? sqmCostDrafts[item.id]
                            : formatEditableDecimal(resolveItemSqmCost(item))
                        }
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          setSqmCostDrafts((prev) => ({ ...prev, [item.id]: rawVal }));
                          const parsedSqm = rawVal.trim() === '' ? 0 : Number(rawVal);
                          if (Number.isFinite(parsedSqm) && parsedSqm >= 0) {
                            markMaterialDirty(item.id);
                            setAdminItems((prev) =>
                              prev.map((el) =>
                                el.id === item.id ? applyWideFormatSqmCostEdit(el, parsedSqm) : el
                              )
                            );
                          }
                        }}
                        className="tabular-nums"
                        style={{
                          ...smallInputStyle,
                          padding: 5,
                          fontWeight: 600,
                          border: `1px solid ${t.clientInputBorder}`,
                          background: t.clientInputBg,
                        }}
                      />
                    ) : (
                      <>
                        {(isWideFormatRollActive
                          ? resolveItemSqmCost(item)
                          : item.price / (item.resource || 1)
                        ).toFixed(2)}{' '}
                        ₽
                      </>
                    )}
                  </td>
                  {isEditingMaterials && (
                    <td style={{ padding: '7px 10px' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          padding: '5px 9px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 2,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
