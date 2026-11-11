import React, { useEffect } from 'react';
import { ProductItem } from '../types';
import { resolveImageUrl } from '../constants';
import { ProductSchematicSVG } from './ProductSchematicSVG';
import { isWideFormatSectionOrCategory } from '../calculatorUtils';

interface ProductLightboxModalProps {
  lightboxUrl: string | null;
  onClose: () => void;
  currentProduct: ProductItem | null | undefined;
  mainCategoryId?: string;
  customWidth: number;
  customHeight: number;
  pagesCount: number;
  selectedClientParams: Record<string, string | number | boolean>;
  isDark: boolean;
  theme: Record<string, string>;
}

export default function ProductLightboxModal({
  lightboxUrl,
  onClose,
  currentProduct,
  mainCategoryId,
  customWidth,
  customHeight,
  pagesCount,
  selectedClientParams,
  isDark,
  theme: t,
}: ProductLightboxModalProps) {
  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxUrl, onClose]);

  if (!lightboxUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр товара"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        cursor: 'zoom-out',
      }}
    >
      <button
        type="button"
        aria-label="Закрыть просмотр"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'fixed',
          top: 20,
          right: 24,
          width: 40,
          height: 40,
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.25)',
          background: 'rgba(15, 23, 42, 0.75)',
          color: '#FFFFFF',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
      {lightboxUrl === '__SCHEMATIC__' && currentProduct ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(540px, 92vw)',
            height: 440,
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: 'none',
            background: isDark ? '#1E2024' : '#F8FAFC',
            border: `1px solid ${t.border}`,
            padding: 16,
          }}
        >
          <ProductSchematicSVG
            prod={currentProduct}
            widthMm={currentProduct.allow_custom_size ? customWidth : currentProduct.width_mm}
            heightMm={currentProduct.allow_custom_size ? customHeight : currentProduct.height_mm}
            pagesCount={pagesCount}
            isDark={isDark}
            selectedParams={selectedClientParams}
            dimensionUnit={
              isWideFormatSectionOrCategory(mainCategoryId, currentProduct.category) ? 'cm' : 'mm'
            }
          />
        </div>
      ) : (
        <img
          src={resolveImageUrl(lightboxUrl)}
          alt="Просмотр товара"
          style={{
            maxWidth: '92vw',
            maxHeight: '90vh',
            borderRadius: 4,
            border: `1px solid ${t.border}`,
            boxShadow: 'none',
            objectFit: 'contain',
            background: '#fff',
          }}
        />
      )}
    </div>
  );
}
