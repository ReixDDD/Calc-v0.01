import React, { useMemo, useState } from 'react';
import { CostItem, ProductItem } from '../types';

interface AdminMaterialMatrixProps {
  prod: ProductItem;
  allItems: CostItem[];
  onUpdateAllowed: (paperIds: number[], lamIds: number[], coverPaperIds?: number[]) => void;
  onApplyToEntireCategory: (paperIds: number[], lamIds: number[], coverPaperIds?: number[]) => void;
  categoryName: string;
  theme: Record<string, string>;
}

function AdminMaterialMatrix({
  prod,
  allItems,
  onUpdateAllowed,
  onApplyToEntireCategory,
  categoryName,
  theme: t,
}: AdminMaterialMatrixProps) {
  const [activeTab, setActiveTab] = useState<'papers' | 'cover_papers' | 'laminations'>('papers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  const hasCoverBlock = Boolean(
    prod.has_cover_block ?? (prod.category === 'catalogs' || prod.multi_page_mode === 'pages')
  );
  const coverPaperIds = useMemo(
    () =>
      Array.isArray(prod.allowed_cover_paper_ids) && prod.allowed_cover_paper_ids.length > 0
        ? prod.allowed_cover_paper_ids
        : prod.allowed_paper_ids,
    [prod.allowed_cover_paper_ids, prod.allowed_paper_ids]
  );

  const effectiveTab = !hasCoverBlock && activeTab === 'cover_papers' ? 'papers' : activeTab;

  const BASE_MATERIAL_CATS = ['papers', 'wf_banners', 'souv_blanks', 'stamps_mounts'];

  const itemsOfType = useMemo(
    () =>
      allItems.filter((i) =>
        effectiveTab === 'laminations'
          ? i.category === 'laminations'
          : BASE_MATERIAL_CATS.includes(i.category)
      ),
    [allItems, effectiveTab]
  );

  const selectedIds =
    effectiveTab === 'papers'
      ? prod.allowed_paper_ids
      : effectiveTab === 'cover_papers'
      ? coverPaperIds
      : prod.allowed_lamination_ids;

  const groups = useMemo(() => {
    const s = new Set<string>();
    itemsOfType.forEach((i) => {
      if (i.group && i.group.trim()) s.add(i.group.trim());
    });
    return Array.from(s);
  }, [itemsOfType]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemsOfType.filter((item) => {
      const isChecked = selectedIds.includes(item.id);
      if (statusFilter === 'selected' && !isChecked) return false;
      if (statusFilter === 'unselected' && isChecked) return false;
      if (groupFilter !== 'ALL' && (item.group || '') !== groupFilter) return false;
      if (q) {
        const hay = `${item.name} ${item.client_name || ''} ${item.group || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [itemsOfType, selectedIds, statusFilter, groupFilter, search]);

  const handleToggleOne = (id: number) => {
    const exists = selectedIds.includes(id);
    const next = exists ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    if (effectiveTab === 'papers') {
      onUpdateAllowed(next, prod.allowed_lamination_ids, coverPaperIds);
    } else if (effectiveTab === 'cover_papers') {
      onUpdateAllowed(prod.allowed_paper_ids, prod.allowed_lamination_ids, next);
    } else {
      onUpdateAllowed(prod.allowed_paper_ids, next, coverPaperIds);
    }
  };

  // Массовое включение всех отфильтрованных позиций
  const handleSelectAllFiltered = () => {
    const filteredIds = filteredList.map((i) => i.id);
    const next = Array.from(new Set([...selectedIds, ...filteredIds]));
    if (effectiveTab === 'papers') {
      onUpdateAllowed(next, prod.allowed_lamination_ids, coverPaperIds);
    } else if (effectiveTab === 'cover_papers') {
      onUpdateAllowed(prod.allowed_paper_ids, prod.allowed_lamination_ids, next);
    } else {
      onUpdateAllowed(prod.allowed_paper_ids, next, coverPaperIds);
    }
  };

  // Массовое отключение всех отфильтрованных позиций
  const handleDeselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredList.map((i) => i.id));
    const next = selectedIds.filter((id) => !filteredIdSet.has(id));
    if (effectiveTab === 'papers') {
      onUpdateAllowed(next, prod.allowed_lamination_ids, coverPaperIds);
    } else if (effectiveTab === 'cover_papers') {
      onUpdateAllowed(prod.allowed_paper_ids, prod.allowed_lamination_ids, next);
    } else {
      onUpdateAllowed(prod.allowed_paper_ids, next, coverPaperIds);
    }
  };

  const totalPapers = allItems.filter((i) => BASE_MATERIAL_CATS.includes(i.category)).length;
  const totalLams = allItems.filter((i) => i.category === 'laminations').length;

  return (
    <div>
      {/* Верхняя панель: вкладки Бумага (Блок / Обложка) / Ламинация + кнопка применить ко всей подкатегории */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('papers');
              setGroupFilter('ALL');
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 2,
              border: `1px solid ${effectiveTab === 'papers' ? t.selectedBorder : t.border}`,
              background: effectiveTab === 'papers' ? t.selectedBg : t.subCardBg,
              color: effectiveTab === 'papers' ? t.selectedText : t.text,
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            {hasCoverBlock ? 'Бумага: Блок' : 'Бумага'} ({prod.allowed_paper_ids.length}/{totalPapers})
          </button>

          {hasCoverBlock && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('cover_papers');
                setGroupFilter('ALL');
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 2,
                border: `1px solid ${effectiveTab === 'cover_papers' ? t.selectedBorder : t.border}`,
                background: effectiveTab === 'cover_papers' ? t.selectedBg : t.subCardBg,
                color: effectiveTab === 'cover_papers' ? t.selectedText : t.text,
                fontWeight: 600,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              Бумага: Обложка ({coverPaperIds.length}/{totalPapers})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('laminations');
              setGroupFilter('ALL');
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 2,
              border: `1px solid ${effectiveTab === 'laminations' ? t.selectedBorder : t.border}`,
              background: effectiveTab === 'laminations' ? t.selectedBg : t.subCardBg,
              color: effectiveTab === 'laminations' ? t.selectedText : t.text,
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            Ламинация ({prod.allowed_lamination_ids.length}/{totalLams})
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            onApplyToEntireCategory(
              prod.allowed_paper_ids,
              prod.allowed_lamination_ids,
              coverPaperIds
            )
          }
          style={{
            padding: '5px 10px',
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            background: t.subCardBg,
            color: t.text,
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title={`Скопировать набор материалов во все товары подкатегории «${categoryName}»`}
        >
          Ко всей «{categoryName}»
        </button>
      </div>

      {/* Строка поиска + фильтр состояния + групповой фильтр + массовые действия */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr auto',
          gap: 6,
          marginBottom: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Поиск материала..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 9px',
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.inputText,
            fontSize: 11.5,
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'selected' | 'unselected')}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.inputText,
            fontSize: 11.5,
          }}
        >
          <option value="all">Все ({itemsOfType.length})</option>
          <option value="selected">Включенные ({selectedIds.length})</option>
          <option value="unselected">
            Выключенные ({itemsOfType.length - selectedIds.length})
          </option>
        </select>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.inputText,
            fontSize: 11.5,
          }}
        >
          <option value="ALL">Все группы</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            style={{
              padding: '6px 9px',
              borderRadius: 2,
              border: 'none',
              background: t.brandPrimary || 'var(--brand-primary)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Включить все найденные позиции"
          >
            Вкл. ({filteredList.length})
          </button>
          <button
            type="button"
            onClick={handleDeselectAllFiltered}
            style={{
              padding: '6px 9px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.text,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Отключить все найденные позиции"
          >
            Выкл.
          </button>
        </div>
      </div>

      {/* Компактная прокручиваемая сетка материалов */}
      <div
        style={{
          maxHeight: 230,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 5,
          padding: 4,
          background: t.subCardBg,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
        }}
      >
        {filteredList.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 14, textAlign: 'center', fontSize: 11.5, color: t.subText }}>
            Позиции не найдены
          </div>
        ) : (
          filteredList.map((item) => {
            const checked = selectedIds.includes(item.id);
            const unitCost = (item.price / (item.resource || 1)).toFixed(2);
            const displayTitle = item.client_name || item.name;
            const hasDistinctInternalName = item.client_name && item.client_name.trim() !== item.name.trim();
            const subLine = [
              hasDistinctInternalName ? item.name : '',
              item.group || '',
            ]
              .filter(Boolean)
              .join(' • ');

            return (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 2,
                  fontSize: 11.5,
                  cursor: 'pointer',
                  border: checked ? `1px solid ${t.selectedBorder}` : `1px solid ${t.border}`,
                  background: checked ? t.selectedBg : t.cardBg,
                  color: checked ? t.selectedText : t.text,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleOne(item.id)}
                  />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayTitle}
                    </div>
                    {subLine && (
                      <div style={{ fontSize: 10.5, color: t.subText, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {subLine}
                      </div>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: t.mutedText }}>
                  {unitCost} ₽
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
export default AdminMaterialMatrix;
