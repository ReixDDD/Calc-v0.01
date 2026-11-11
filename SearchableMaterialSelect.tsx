import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CatalogItemPublic } from '../types';
import { extractDensity, PAPER_COLOR_PRESETS } from '../constants';

export { PAPER_COLOR_PRESETS };

interface SearchableMaterialSelectProps {
  items: CatalogItemPublic[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  placeholder?: string;
  showDensityFilter?: boolean;
  largePaperCard?: boolean;
  theme: Record<string, string>;
}

function PaperSheetGraphic({
  colorHex = '#f1f5f9',
  size = 38,
}: {
  colorHex?: string;
  size?: number;
}) {
  const isWhite =
    !colorHex ||
    colorHex.toLowerCase() === '#ffffff' ||
    colorHex.toLowerCase() === '#fff';
  const fill = isWhite ? '#eef2f6' : colorHex;
  const stroke = isWhite ? '#cbd5e1' : 'rgba(148, 163, 184, 0.55)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <polygon
        points="8,16 20,7 39,14 39,39 8,39"
        fill="rgba(15, 23, 42, 0.12)"
        transform="translate(1.5, 1.5)"
      />
      <polygon
        points="8,16 20,7 39,14 39,39 8,39"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polyline
        points="8,16 20,7 39,14"
        fill="none"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth="1"
      />
    </svg>
  );
}

function SearchableMaterialSelect({
  items,
  selectedId,
  onSelect,
  placeholder = 'Выберите материал...',
  largePaperCard = false,
  theme: t,
}: SearchableMaterialSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedItem =
    items.find((i) => i.id === selectedId) ||
    items.find((i) => i.in_stock !== false) ||
    items[0];

  const groups = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.group && i.group.trim()) set.add(i.group.trim());
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (activeGroup !== 'ALL' && (item.group || 'Основная') !== activeGroup) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.group || ''} ${item.color_name || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const da = extractDensity(a.name) ?? 9999;
      const db = extractDensity(b.name) ?? 9999;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [items, search, activeGroup]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, CatalogItemPublic[]>();
    filteredItems.forEach((item) => {
      const g = item.group && item.group.trim() ? item.group.trim() : 'Материалы';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredItems]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          height: 36,
          padding: '0 10px',
          borderRadius: 2,
          border: `1px solid ${isOpen ? t.selectedBorder : t.border}`,
          background: t.inputBg,
          color: t.inputText,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 8,
          }}
        >
          {selectedItem ? (
            <>
              {largePaperCard ? (
                <PaperSheetGraphic colorHex={selectedItem.color_hex} size={20} />
              ) : (
                selectedItem.color_hex && (
                  <span
                    title={`Цвет: ${selectedItem.color_name || 'Белый'}`}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: selectedItem.color_hex,
                      border: '1px solid rgba(148, 163, 184, 0.75)',
                      flexShrink: 0,
                    }}
                  />
                )
              )}
              <span
                style={{
                  fontWeight: largePaperCard ? 500 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedItem.name}
              </span>
            </>
          ) : (
            <span style={{ color: t.subText }}>{placeholder}</span>
          )}
        </div>
        <span style={{ color: t.subText, flexShrink: 0, opacity: 0.85, display: 'inline-flex', alignItems: 'center' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s ease',
            }}
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            boxShadow: 'none',
            overflow: 'hidden',
          }}
        >
          {(items.length > 5 || search.length > 0) && (
            <div
              style={{
                padding: '10px 10px 8px',
                borderBottom: groups.length > 1 ? 'none' : `1px solid ${t.softBorder}`,
                position: 'relative',
              }}
            >
              <input
                type="text"
                autoFocus
                placeholder="Поиск по названию, плотности или цвету..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 30px 8px 11px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: t.inputBg,
                  color: t.inputText,
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 18,
                    top: '50%',
                    transform: 'translateY(-45%)',
                    background: 'transparent',
                    border: 'none',
                    color: t.subText,
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: 2,
                  }}
                  title="Очистить поиск"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {groups.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                padding: '4px 10px 10px',
                borderBottom: `1px solid ${t.softBorder}`,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveGroup('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 2,
                  fontSize: 12,
                  fontWeight: activeGroup === 'ALL' ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: activeGroup === 'ALL' ? `1px solid ${t.selectedBorder}` : `1px solid transparent`,
                  background: activeGroup === 'ALL' ? t.selectedBg : t.subCardBg,
                  color: activeGroup === 'ALL' ? t.selectedText : t.mutedText,
                }}
              >
                Все
              </button>
              {groups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setActiveGroup(grp)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 2,
                    fontSize: 12,
                    fontWeight: activeGroup === grp ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: activeGroup === grp ? `1px solid ${t.selectedBorder}` : `1px solid transparent`,
                    background: activeGroup === grp ? t.selectedBg : t.subCardBg,
                    color: activeGroup === grp ? t.selectedText : t.mutedText,
                  }}
                >
                  {grp}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              maxHeight: 270,
              overflowY: 'auto',
              padding: 6,
            }}
          >
            {filteredItems.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: t.subText }}>
                Ничего не найдено
              </div>
            ) : (
              groupedSections.map(([groupTitle, sectionItems]) => (
                <div key={groupTitle} style={{ marginBottom: 4 }}>
                  {groupedSections.length > 1 && (
                    <div
                      style={{
                        padding: '6px 8px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: t.subText,
                      }}
                    >
                      {groupTitle}
                    </div>
                  )}
                  {sectionItems.map((item) => {
                    const isOutOfStock = item.in_stock === false;
                    const isSelected = item.id === selectedItem?.id && !isOutOfStock;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isOutOfStock) return;
                          onSelect(item.id);
                          setIsOpen(false);
                        }}
                        style={{
                          padding: '6px 9px',
                          borderRadius: 2,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isOutOfStock
                            ? 'transparent'
                            : isSelected
                            ? t.selectedBg
                            : 'transparent',
                          color: isOutOfStock ? t.subText : isSelected ? t.selectedText : t.text,
                          opacity: isOutOfStock ? 0.42 : 1,
                          fontSize: 13,
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {largePaperCard ? (
                            <PaperSheetGraphic colorHex={item.color_hex} size={20} />
                          ) : (
                            item.color_hex && (
                              <span
                                title={`Цвет: ${item.color_name || 'Белый'}`}
                                style={{
                                  width: 13,
                                  height: 13,
                                  borderRadius: '50%',
                                  background: item.color_hex,
                                  border: '1px solid rgba(148, 163, 184, 0.75)',
                                  flexShrink: 0,
                                }}
                              />
                            )
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                          {item.color_name && item.color_name !== 'Белый' && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '1px 6px',
                                borderRadius: 2,
                                background: t.subCardBg,
                                color: t.mutedText,
                                flexShrink: 0,
                              }}
                            >
                              {item.color_name}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                          {isOutOfStock ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 7px',
                                borderRadius: 2,
                                background: 'rgba(148, 163, 184, 0.18)',
                                color: t.subText,
                                fontWeight: 600,
                              }}
                            >
                              Нет в наличии
                            </span>
                          ) : isSelected ? (
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.selectedText }}>✓</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableMaterialSelect;
