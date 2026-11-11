import React from 'react';
import { ProductItem } from '../types';
import { resolveImageUrl } from '../constants';
import { ProductSchematicSVG } from './ProductSchematicSVG';

interface ProductKindsSidebarProps {
  currentProduct: ProductItem;
  categoryProducts: ProductItem[];
  categoryKindsList: string[];
  activeKind: string;
  onSelectProduct: (prodId: number) => void;
  isDark: boolean;
  theme: Record<string, string>;
  customWidth?: number;
  customHeight?: number;
  pagesCount?: number;
  selectedClientParams?: Record<string, string | number | boolean>;
}

export default function ProductKindsSidebar({
  currentProduct,
  categoryProducts,
  categoryKindsList,
  activeKind,
  onSelectProduct,
  isDark,
  theme: t,
  customWidth,
  customHeight,
  pagesCount,
  selectedClientParams,
}: ProductKindsSidebarProps) {
  return (
    <aside className="ui-kinds-sidebar" aria-label="Виды изделий">
      <div
        className="ui-sidebar-sticky-inner"
        style={{
          background: 'transparent',
          padding: 0,
          border: 'none',
          boxShadow: 'none',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="ui-column-header-box"
          style={{
            padding: '0 2px 2px',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 15,
            fontWeight: 700,
            color: t.text,
          }}
        >
          <span>Вид изделия</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: t.subText }}>
            {categoryKindsList.length}{' '}
            {(() => {
              const mod100 = categoryKindsList.length % 100;
              const mod10 = categoryKindsList.length % 10;
              if (mod100 >= 11 && mod100 <= 14) return 'видов';
              if (mod10 === 1) return 'вид';
              if (mod10 >= 2 && mod10 <= 4) return 'вида';
              return 'видов';
            })()}
          </span>
        </div>

        <div className="ui-kinds-sidebar-list">
          {categoryKindsList.map((kindName) => {
            const isSelectedKind = kindName === activeKind;
            const kindProds = categoryProducts.filter(
              (p) => ((p.product_kind || '').trim() || 'Прочие форматы') === kindName
            );
            const repProd = kindProds[0] || currentProduct;
            const repCustomImg =
              kindProds.map((kp) => kp.images?.[0] || kp.image_url || '').find((u) => Boolean(u)) ||
              '';

            return (
              <button
                key={kindName}
                type="button"
                className="ui-kind-card"
                aria-pressed={isSelectedKind}
                onClick={() => {
                  if (repProd && repProd.id !== currentProduct.id) {
                    onSelectProduct(repProd.id);
                  }
                }}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 3,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: isSelectedKind
                    ? `2px solid ${isDark ? '#E54D47' : '#C02721'}`
                    : `1px solid ${t.border}`,
                  overflow: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div
                  className="ui-kind-card-visual"
                  style={{
                    width: '100%',
                    height: 144,
                    borderRadius: 3,
                    overflow: 'visible',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {repCustomImg ? (
                    <img
                      src={resolveImageUrl(repCustomImg)}
                      alt={kindName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <ProductSchematicSVG
                      prod={isSelectedKind ? currentProduct : repProd}
                      widthMm={
                        isSelectedKind
                          ? currentProduct.allow_custom_size && customWidth
                            ? customWidth
                            : currentProduct.width_mm
                          : repProd.width_mm
                      }
                      heightMm={
                        isSelectedKind
                          ? currentProduct.allow_custom_size && customHeight
                            ? customHeight
                            : currentProduct.height_mm
                          : repProd.height_mm
                      }
                      pagesCount={
                        isSelectedKind
                          ? pagesCount || currentProduct.pages_default || 1
                          : repProd.pages_default || 1
                      }
                      isDark={isDark}
                      selectedParams={isSelectedKind ? selectedClientParams : undefined}
                      hideDimensions={true}
                    />
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 2px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: isSelectedKind ? (isDark ? '#E54D47' : '#C02721') : t.text,
                      lineHeight: 1.25,
                    }}
                  >
                    {kindName}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: isSelectedKind ? (isDark ? '#E54D47' : '#C02721') : t.subText,
                      background: isSelectedKind
                        ? isDark
                          ? 'rgba(229, 77, 71, 0.18)'
                          : '#FEE2E2'
                        : isDark
                        ? 'rgba(148, 163, 184, 0.12)'
                        : 'rgba(148, 163, 184, 0.15)',
                      padding: '2px 7px',
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  >
                    {kindProds.length} разм.
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
