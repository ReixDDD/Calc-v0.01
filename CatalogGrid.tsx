import React from 'react';
import { MainCategory, ProductCategory, ProductItem } from '../types';
import {
  MainCategoryIllustration,
  ResilientCatalogImage,
  SubcategoryCardIllustration,
} from './CatalogIllustrations';

interface CatalogGridProps {
  mode: 'home' | 'main_category';
  publicMainCategories: MainCategory[];
  publicCategories: ProductCategory[];
  publicProducts: ProductItem[];
  currentMainCategoryObj?: MainCategory;
  selectedMainCategory: string;
  isDark: boolean;
  theme: Record<string, string>;
  onSelectMainCategory: (mainId: string, keepSubcat?: boolean, pushUrl?: boolean) => void;
  onSelectSubcategory: (catId: string) => void;
  onResetToHome: () => void;
}

export default function CatalogGrid({
  mode,
  publicMainCategories,
  publicCategories,
  publicProducts,
  currentMainCategoryObj,
  selectedMainCategory,
  isDark,
  theme: t,
  onSelectMainCategory,
  onSelectSubcategory,
  onResetToHome,
}: CatalogGridProps) {
  const defaultMain = publicMainCategories[0]?.id || 'polygraphy';

  if (mode === 'home') {
    return (
      <div>
        <div className="ui-column-header-box">
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: t.text,
              textWrap: 'balance',
            }}
          >
            Все категории продукции
          </h1>
        </div>

        <div
          className="ui-flush-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 0,
          }}
        >
          {publicMainCategories.map((mc) => (
              <button
                key={mc.id}
                type="button"
                className="ui-hover-card"
                onClick={() => onSelectMainCategory(mc.id, false, true)}
                style={{
                  appearance: 'none',
                  borderRadius: 0,
                  border: `1px solid ${t.border}`,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  textAlign: 'left',
                  gap: 12,
                  cursor: 'pointer',
                  overflow: 'visible',
                }}
              >
                <div
                  className="ui-card-banner"
                  style={{
                    width: '100%',
                    height: 164,
                    background: 'transparent',
                    borderRadius: 3,
                    overflow: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                  }}
                >
                  <ResilientCatalogImage
                    imageUrl={mc.image_url}
                    alt={mc.name}
                    fallback={<MainCategoryIllustration category={mc} isDark={isDark} />}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ padding: '2px 2px 0' }}>
                  <h2
                    className="ui-card-title"
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.text,
                      lineHeight: 1.3,
                      letterSpacing: isDark ? '0.01em' : 'normal',
                      textWrap: 'balance',
                    }}
                  >
                    {mc.name}
                  </h2>
                </div>
              </button>
          ))}
        </div>
      </div>
    );
  }

  const activeMainId = currentMainCategoryObj?.id || selectedMainCategory || defaultMain;
  const subcatsInCurrentMain = publicCategories.filter(
    (sc) => (sc.parent_id || defaultMain) === activeMainId
  );

  return (
    <div>
      <div className="ui-column-header-box">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            color: t.subText,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="ui-breadcrumb-link"
            onClick={onResetToHome}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              color: 'inherit',
              fontSize: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Все категории
          </button>
          <span aria-hidden="true">·</span>
          <span style={{ color: t.text, fontWeight: 600 }}>
            {currentMainCategoryObj?.name || 'Категория'}
          </span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: t.text,
            textWrap: 'balance',
          }}
        >
          {currentMainCategoryObj?.name || 'Подкатегории раздела'}
        </h1>
      </div>

      {subcatsInCurrentMain.length === 0 ? (
        <div style={{ padding: '16px 0', color: t.subText, fontSize: 13.5 }}>
          В категории «<b>{currentMainCategoryObj?.name}</b>» пока нет подкатегорий.
        </div>
      ) : (
        <div
          className="ui-flush-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 0,
          }}
        >
          {subcatsInCurrentMain.map((subcat) => {
            const firstProdWithImg = publicProducts.find(
              (p) => p.category === subcat.id && p.images && p.images.length > 0
            );
            const cardImgUrl = subcat.image_url || (firstProdWithImg?.images?.[0] ?? '');

            return (
              <button
                key={subcat.id}
                type="button"
                className="ui-hover-card-compact"
                onClick={() => onSelectSubcategory(subcat.id)}
                style={{
                  appearance: 'none',
                  aspectRatio: '1 / 1.02',
                  borderRadius: 0,
                  border: `1px solid ${t.border}`,
                  padding: '10px 10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  cursor: 'pointer',
                  overflow: 'visible',
                  gap: 8,
                }}
              >
                {subcat.badge === 'hit' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: '#C02721',
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      padding: '2px 6px',
                      borderRadius: 2,
                      zIndex: 3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ХИТ
                  </span>
                )}
                {subcat.badge === 'new' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: isDark ? '#2C303A' : '#0F172A',
                      color: '#FFFFFF',
                      border: isDark ? '1px solid #454A54' : 'none',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      padding: '2px 6px',
                      borderRadius: 2,
                      zIndex: 3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    NEW
                  </span>
                )}

                <div
                  className="ui-subcat-visual ui-subcat-square-visual"
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    background: 'transparent',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'visible',
                    padding: 2,
                  }}
                >
                  <ResilientCatalogImage
                    imageUrl={cardImgUrl}
                    alt={subcat.name}
                    fallback={<SubcategoryCardIllustration cat={subcat} isDark={isDark} />}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>

                <div
                  style={{
                    minHeight: 42,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                >
                  <span
                    className="ui-subcat-title"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: t.text,
                      lineHeight: 1.24,
                      letterSpacing: isDark ? '0.01em' : 'normal',
                      textWrap: 'balance',
                    }}
                  >
                    {subcat.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
