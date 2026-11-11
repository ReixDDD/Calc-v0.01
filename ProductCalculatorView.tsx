import React, { useEffect, useRef, useState } from 'react';
import {
  BlockPrintModeType,
  CalculationResult,
  CatalogItemPublic,
  CatalogLimits,
  CoverPrintModeType,
  EstimateItem,
  MarkupTier,
  ProductCostParam,
  ProductItem,
} from '../types';
import { resolveImageUrl } from '../constants';
import { ProductSchematicSVG, resolveBindingType } from './ProductSchematicSVG';
import SearchableMaterialSelect from './SearchableMaterialSelect';
import {
  BANNER_MARGIN_OPTIONS,
  buildEstimateDraftFromSelection,
  cmToMm,
  computeSra3Layout,
  computeWideFormatStripBreakdown,
  DEFAULT_EYELET_SPACING,
  EYELET_SPACING_OPTIONS,
  formatDimensionsTextInCm,
  formatMmAsCm,
  formatWideFormatStripsBreakdown,
  getDefaultBannerMarginCm,
  getMaterialFieldMeta,
  getPagesStepAndMin,
  getQuickQuantityTiers,
  isBannerProduct,
  isEyeletCostParam,
  isWideFormatSectionOrCategory,
  MAX_WIDE_FORMAT_PRINT_WIDTH_MM,
  mmToCm,
  normalizePagesForBinding,
  resolveBannerMarginCm,
  resolveEyeletSpacing,
} from '../calculatorUtils';

export interface ProductCalculatorViewProps {
  currentProduct: ProductItem;
  adminCurrentProd: ProductItem;
  filteredFormatProducts: ProductItem[];
  allowedPapersForCurrentProduct: CatalogItemPublic[];
  allowedCoverPapersForCurrentProduct: CatalogItemPublic[];
  allowedLaminationsForCurrentProduct: CatalogItemPublic[];
  usableLimits: CatalogLimits;
  mainCategoryId?: string;
  categoryMarkupTiers?: MarkupTier[];
  categoryQtyTiers?: number[];
  activeImageIndex: number;
  setActiveImageIndex: React.Dispatch<React.SetStateAction<number>>;
  setLightboxUrl: (url: string | null) => void;
  customWidth: number;
  setCustomWidth: React.Dispatch<React.SetStateAction<number>>;
  customHeight: number;
  setCustomHeight: React.Dispatch<React.SetStateAction<number>>;
  pagesCount: number;
  setPagesCount: React.Dispatch<React.SetStateAction<number>>;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  selectedPaperId: number;
  setSelectedPaperId: React.Dispatch<React.SetStateAction<number>>;
  selectedCoverPaperId: number;
  setSelectedCoverPaperId: React.Dispatch<React.SetStateAction<number>>;
  printSides: number;
  setPrintSides: React.Dispatch<React.SetStateAction<number>>;
  blockPrintMode: BlockPrintModeType;
  setBlockPrintMode: React.Dispatch<React.SetStateAction<BlockPrintModeType>>;
  coverPrintMode: CoverPrintModeType;
  setCoverPrintMode: React.Dispatch<React.SetStateAction<CoverPrintModeType>>;
  selectedLaminationId: number | null;
  setSelectedLaminationId: React.Dispatch<React.SetStateAction<number | null>>;
  laminationSides: number;
  setLaminationSides: React.Dispatch<React.SetStateAction<number>>;
  selectedClientParams: Record<string, string | number | boolean>;
  setSelectedClientParams: React.Dispatch<
    React.SetStateAction<Record<string, string | number | boolean>>
  >;
  disabledInternalParamIds: string[];
  setDisabledInternalParamIds: React.Dispatch<React.SetStateAction<string[]>>;
  calcResult: CalculationResult | null;
  isCalculating: boolean;
  handleProductChange: (prodId: number) => void;
  categoryName?: string;
  onAddEstimateItem?: (draft: Omit<EstimateItem, 'id' | 'createdAt'>) => void;
  showToast?: (msg: string) => void;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
}

export default function ProductCalculatorView({
  currentProduct,
  adminCurrentProd,
  filteredFormatProducts,
  allowedPapersForCurrentProduct,
  allowedCoverPapersForCurrentProduct,
  allowedLaminationsForCurrentProduct,
  usableLimits,
  mainCategoryId = 'polygraphy',
  categoryMarkupTiers,
  categoryQtyTiers,
  activeImageIndex,
  setActiveImageIndex,
  setLightboxUrl,
  customWidth,
  setCustomWidth,
  customHeight,
  setCustomHeight,
  pagesCount,
  setPagesCount,
  quantity,
  setQuantity,
  selectedPaperId,
  setSelectedPaperId,
  selectedCoverPaperId,
  setSelectedCoverPaperId,
  printSides,
  setPrintSides,
  blockPrintMode,
  setBlockPrintMode,
  coverPrintMode,
  setCoverPrintMode,
  selectedLaminationId,
  setSelectedLaminationId,
  laminationSides,
  setLaminationSides,
  selectedClientParams,
  setSelectedClientParams,
  disabledInternalParamIds,
  setDisabledInternalParamIds,
  calcResult,
  isCalculating,
  handleProductChange,
  categoryName,
  onAddEstimateItem,
  showToast,
  isDark,
  theme: t,
  inputStyle,
}: ProductCalculatorViewProps) {
  const currentProductImages = currentProduct.images || [];
  const hasSchematic = (currentProduct.schematic_type || 'auto') !== 'none';
  const mediaSlides: string[] = [
    ...currentProductImages,
    ...(hasSchematic ? ['__SCHEMATIC__'] : []),
  ];
  const safeSlideIndex = activeImageIndex < mediaSlides.length ? activeImageIndex : 0;
  const activeSlide = mediaSlides[safeSlideIndex] || null;
  const effectiveW = currentProduct.allow_custom_size ? customWidth : currentProduct.width_mm;
  const effectiveH = currentProduct.allow_custom_size ? customHeight : currentProduct.height_mm;
  const isWideFormatCalc = isWideFormatSectionOrCategory(mainCategoryId, currentProduct.category);
  const isBannerCalc = isBannerProduct(currentProduct, mainCategoryId);

  const [wfWidthCmInput, setWfWidthCmInput] = useState<string>(() => formatMmAsCm(effectiveW));
  const [wfHeightCmInput, setWfHeightCmInput] = useState<string>(() => formatMmAsCm(effectiveH));

  useEffect(() => {
    const parsedCm = Number(wfWidthCmInput.replace(',', '.'));
    if (
      wfWidthCmInput.trim() === '' ||
      !Number.isFinite(parsedCm) ||
      Math.abs(cmToMm(parsedCm) - effectiveW) > 0.05
    ) {
      setWfWidthCmInput(formatMmAsCm(effectiveW));
    }
  }, [currentProduct.id, effectiveW]);

  useEffect(() => {
    const parsedCm = Number(wfHeightCmInput.replace(',', '.'));
    if (
      wfHeightCmInput.trim() === '' ||
      !Number.isFinite(parsedCm) ||
      Math.abs(cmToMm(parsedCm) - effectiveH) > 0.05
    ) {
      setWfHeightCmInput(formatMmAsCm(effectiveH));
    }
  }, [currentProduct.id, effectiveH]);

  useEffect(() => {
    if (!isBannerCalc) return;
    if (selectedClientParams.banner_margin_manual === true) return;
    const autoMarginCm = getDefaultBannerMarginCm(effectiveW, effectiveH);
    if (selectedClientParams.banner_margin_cm !== autoMarginCm) {
      setSelectedClientParams((prev) => {
        if (prev.banner_margin_manual === true || prev.banner_margin_cm === autoMarginCm) {
          return prev;
        }
        return {
          ...prev,
          banner_margin_cm: autoMarginCm,
        };
      });
    }
  }, [
    isBannerCalc,
    currentProduct.id,
    effectiveW,
    effectiveH,
    selectedClientParams.banner_margin_manual,
    selectedClientParams.banner_margin_cm,
    setSelectedClientParams,
  ]);

  const activeBindingType = resolveBindingType(currentProduct, selectedClientParams);
  const {
    step: pagesStep,
    min: pagesMin,
    isStaple: isStapleBinding,
  } = getPagesStepAndMin(currentProduct.multi_page_mode, activeBindingType);

  const [stapleRoundNotice, setStapleRoundNotice] = useState<{
    entered: number;
    rounded: number;
  } | null>(null);
  const roundTimerRef = useRef<number | null>(null);

  // Clear or update rounding notice when product or binding changes
  useEffect(() => {
    if (roundTimerRef.current) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (currentProduct.multi_page_mode !== 'pages' || !isStapleBinding) {
      setStapleRoundNotice(null);
      return;
    }
    const { normalized, wasAdjusted } = normalizePagesForBinding(
      pagesCount,
      currentProduct.multi_page_mode,
      activeBindingType
    );
    if (wasAdjusted) {
      setStapleRoundNotice({ entered: pagesCount, rounded: normalized });
      setPagesCount(normalized);
    }
  }, [currentProduct.id, currentProduct.multi_page_mode, activeBindingType]);

  useEffect(() => {
    return () => {
      if (roundTimerRef.current) {
        window.clearTimeout(roundTimerRef.current);
      }
    };
  }, []);

  const quickTiers = getQuickQuantityTiers(
    currentProduct.category,
    categoryMarkupTiers && categoryMarkupTiers.length > 0
      ? categoryMarkupTiers
      : categoryQtyTiers,
    mainCategoryId
  );
  const materialFieldMeta = getMaterialFieldMeta(mainCategoryId);

  const sra3Layout = computeSra3Layout(effectiveW, effectiveH, {
    sra3WidthMm: usableLimits.sra3_width_mm || 320,
    sra3HeightMm: usableLimits.sra3_height_mm || 450,
    usableWidthMm: usableLimits.usable_width_mm || 310,
    usableHeightMm: usableLimits.usable_height_mm || 440,
    bleedMm: usableLimits.bleed_mm ?? 4,
  });

  const fixedControlStyle: React.CSSProperties = {
    ...inputStyle,
    height: 36,
    padding: '0 10px',
    fontSize: 13,
    borderRadius: 2,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
    fontSize: 12.5,
    color: t.mutedText,
  };

  const hasLamOptions = allowedLaminationsForCurrentProduct.length > 0;
  const currentSidesValue =
    currentProduct.allowed_sides === 'single_only'
      ? 1
      : currentProduct.allowed_sides === 'duplex_only' || currentProduct.multi_page_mode === 'pages'
      ? 2
      : printSides === 2
      ? 2
      : 1;

  const showFormatSelect = adminCurrentProd.show_format_select !== false;
  const showPrintSidesSelect = adminCurrentProd.show_print_sides !== false;
  const showPaperSelect = adminCurrentProd.show_paper_select !== false;
  const showLaminationSelect =
    adminCurrentProd.show_lamination_select !== false && hasLamOptions;
  const activeCostParams: ProductCostParam[] =
    adminCurrentProd.cost_params || currentProduct.cost_params || [];
  const clientFacingParams = activeCostParams.filter(
    (cp) => cp.is_client_facing && cp.is_enabled !== false
  );
  const internalOnlyParams = activeCostParams.filter(
    (cp) => !cp.is_client_facing && cp.is_enabled !== false
  );

  const hasCoverBlock = Boolean(
    adminCurrentProd.has_cover_block ??
      (currentProduct.category === 'catalogs' || currentProduct.multi_page_mode === 'pages')
  );
  const allowedBlockModes = adminCurrentProd.allowed_block_print_modes || 'both';
  const allowedCoverModes = adminCurrentProd.allowed_cover_print_modes || 'both';
  const effectiveBlockMode: BlockPrintModeType =
    allowedBlockModes === '4+4'
      ? '4+4'
      : allowedBlockModes === '1+1'
      ? '1+1'
      : allowedBlockModes === '0+0'
      ? '0+0'
      : blockPrintMode;
  const effectiveCoverMode: CoverPrintModeType =
    allowedCoverModes === '4+4'
      ? '4+4'
      : allowedCoverModes === '4+0'
      ? '4+0'
      : coverPrintMode;

  const handlePagesInputChange = (rawNumber: number) => {
    const raw = Math.max(1, Number.isFinite(rawNumber) ? Math.round(rawNumber) : 1);
    if (roundTimerRef.current) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    if (currentProduct.multi_page_mode === 'pages' && isStapleBinding) {
      const { normalized, wasAdjusted } = normalizePagesForBinding(
        raw,
        currentProduct.multi_page_mode,
        activeBindingType
      );
      if (wasAdjusted) {
        setStapleRoundNotice({ entered: raw, rounded: normalized });
        setPagesCount(raw);
        roundTimerRef.current = window.setTimeout(() => {
          setPagesCount(normalized);
          roundTimerRef.current = null;
        }, 450);
      } else {
        setStapleRoundNotice(null);
        setPagesCount(normalized);
      }
      return;
    }

    setStapleRoundNotice(null);
    setPagesCount(raw);
  };

  const handlePagesBlur = () => {
    if (roundTimerRef.current) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (currentProduct.multi_page_mode === 'pages') {
      const { normalized, wasAdjusted } = normalizePagesForBinding(
        pagesCount,
        currentProduct.multi_page_mode,
        activeBindingType
      );
      if (wasAdjusted) {
        if (isStapleBinding) {
          setStapleRoundNotice({ entered: pagesCount, rounded: normalized });
        }
        setPagesCount(normalized);
      }
    }
  };

  return (
    <div className="ui-calc-interactive-area">
      <div
        className={activeSlide ? 'ui-calc-main-grid' : 'ui-calc-main-grid--single'}
        style={{
          gap: 22,
          alignItems: 'stretch',
        }}
      >
        {activeSlide && (
          <div
            style={{
              background: t.cardBg,
              padding: 16,
              borderRadius: 3,
              border: `1px solid ${t.border}`,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              onClick={() => setLightboxUrl(activeSlide)}
              style={{
                width: '100%',
                flex: 1,
                minHeight: 340,
                borderRadius: 3,
                overflow: 'hidden',
                cursor: 'zoom-in',
                border: `1px solid ${t.border}`,
                position: 'relative',
                background: isDark ? '#1E2024' : '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Нажмите, чтобы увеличить"
            >
              {activeSlide === '__SCHEMATIC__' ? (
                <ProductSchematicSVG
                  prod={currentProduct}
                  widthMm={effectiveW}
                  heightMm={effectiveH}
                  pagesCount={pagesCount}
                  isDark={isDark}
                  selectedParams={selectedClientParams}
                  dimensionUnit={isWideFormatCalc ? 'cm' : 'mm'}
                />
              ) : (
                <img
                  src={resolveImageUrl(activeSlide)}
                  alt={currentProduct.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  lineHeight: 1.2,
                  background: 'rgba(18, 19, 22, 0.82)',
                  color: '#fff',
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 2,
                }}
              >
                Увеличить
              </span>
            </div>

            {mediaSlides.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
                {mediaSlides.map((slide, idx) => {
                  const isSelectedSlide = safeSlideIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        width: 48,
                        height: 34,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelectedSlide
                          ? `2px solid ${t.selectedBorder}`
                          : `1px solid ${t.border}`,
                        background:
                          slide === '__SCHEMATIC__'
                            ? isDark
                              ? '#1E2024'
                              : '#F8FAFC'
                            : t.cardBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: t.text,
                      }}
                    >
                      {slide === '__SCHEMATIC__' ? (
                        <span>Схема</span>
                      ) : (
                        <img
                          src={resolveImageUrl(slide)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: t.cardBg,
            padding: 20,
            borderRadius: 3,
            border: `1px solid ${t.border}`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 14,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(() => {
              const showFixedBannerMarginInTopRow =
                isBannerCalc && !adminCurrentProd.allow_custom_size;
              const activeBannerMargin = isBannerCalc
                ? resolveBannerMarginCm(selectedClientParams, effectiveW, effectiveH)
                : '5';
              const bannerMarginSelectNode = isBannerCalc ? (
                <div style={{ minWidth: 0 }}>
                  <label
                    htmlFor="wf-banner-margin-select"
                    title="Поля по периметру баннера"
                    style={{
                      ...labelStyle,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Поля
                  </label>
                  <select
                    id="wf-banner-margin-select"
                    value={activeBannerMargin}
                    onChange={(e) => {
                      const nextMargin = e.target.value;
                      setSelectedClientParams((prev) => ({
                        ...prev,
                        banner_margin_cm: nextMargin,
                        banner_margin_manual: true,
                      }));
                    }}
                    style={fixedControlStyle}
                  >
                    {BANNER_MARGIN_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null;

              const topRowItemsCount =
                (showFormatSelect ? 1 : 0) +
                (!hasCoverBlock && showPrintSidesSelect ? 1 : 0) +
                (showFixedBannerMarginInTopRow ? 1 : 0);

              return (
                <>
                  {topRowItemsCount > 0 && (
                    <div
                      className={
                        topRowItemsCount === 3
                          ? 'ui-form-grid-wf-dims-3'
                          : topRowItemsCount === 2
                          ? 'ui-form-grid-2'
                          : undefined
                      }
                      style={{
                        display: 'grid',
                        gap: topRowItemsCount === 3 ? 12 : 16,
                      }}
                    >
                      {showFormatSelect && (
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="calc-format-select" style={labelStyle}>
                            {isWideFormatCalc ? 'Формат, см' : 'Формат, мм'}
                          </label>
                          <select
                            id="calc-format-select"
                            value={currentProduct.id}
                            onChange={(e) => handleProductChange(Number(e.target.value))}
                            style={fixedControlStyle}
                          >
                            {filteredFormatProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {isWideFormatCalc ? formatDimensionsTextInCm(p.name) : p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {!hasCoverBlock && showPrintSidesSelect && (
                        <div style={{ minWidth: 0 }}>
                          <label style={labelStyle}>
                            {mainCategoryId === 'souvenirs' ? 'Нанесение принта' : 'Вид печати'}
                          </label>
                          <select
                            value={currentSidesValue}
                            disabled={
                              currentProduct.allowed_sides !== 'both' ||
                              currentProduct.multi_page_mode === 'pages'
                            }
                            onChange={(e) => setPrintSides(Number(e.target.value))}
                            style={fixedControlStyle}
                          >
                            {currentProduct.allowed_sides !== 'duplex_only' &&
                              currentProduct.multi_page_mode !== 'pages' && (
                                <option value={1}>
                                  {mainCategoryId === 'souvenirs'
                                    ? 'С одной стороны (1+0)'
                                    : 'Односторонняя (4+0)'}
                                </option>
                              )}
                            {currentProduct.allowed_sides !== 'single_only' && (
                              <option value={2}>
                                {mainCategoryId === 'souvenirs'
                                  ? 'С двух сторон (1+1)'
                                  : 'Двусторонняя (4+4)'}
                              </option>
                            )}
                          </select>
                        </div>
                      )}

                      {showFixedBannerMarginInTopRow && bannerMarginSelectNode}
                    </div>
                  )}

                  {adminCurrentProd.allow_custom_size &&
                    (() => {
                      const sectionLim = usableLimits.by_main_category?.[mainCategoryId];
                      const isWideFormat = isWideFormatCalc;

                      if (isWideFormat) {
                        const maxWfW = sectionLim?.max_width_mm || 50000;
                        const maxWfH = sectionLim?.max_height_mm || 50000;
                        const maxWfWCm = mmToCm(maxWfW);
                        const maxWfHCm = mmToCm(maxWfH);
                        const selectedRollMat = allowedPapersForCurrentProduct.find(
                          (p) => p.id === selectedPaperId
                        );
                        const rollWidthMm =
                          selectedRollMat?.roll_width_m && selectedRollMat.roll_width_m > 0
                            ? Math.round(selectedRollMat.roll_width_m * 1000)
                            : sectionLim?.roll_width_mm || 1600;
                        const wfBleedMm = sectionLim?.bleed_mm ?? 10;
                        const bannerMarginBothSidesMm = isBannerCalc
                          ? cmToMm(Number(activeBannerMargin)) * 2
                          : 0;
                        const wfStripBreakdown = computeWideFormatStripBreakdown(
                          effectiveW,
                          effectiveH,
                          MAX_WIDE_FORMAT_PRINT_WIDTH_MM
                        );
                        const exceedsPrintMax = isWideFormatCalc && wfStripBreakdown.hasSeams;
                        const extraAllowanceMm = isBannerCalc
                          ? bannerMarginBothSidesMm
                          : wfBleedMm;
                        const exceedsRollWidth =
                          isWideFormatCalc &&
                          (exceedsPrintMax ||
                            Math.min(effectiveW, effectiveH) + extraAllowanceMm > rollWidthMm);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div
                              className={
                                isBannerCalc ? 'ui-form-grid-wf-dims-3' : 'ui-form-grid-2'
                              }
                              style={{ gap: isBannerCalc ? 12 : 16 }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <label
                                  htmlFor="wf-custom-width-cm"
                                  style={{
                                    ...labelStyle,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  Ширина изделия (см, макс. {maxWfWCm})
                                </label>
                                <input
                                  id="wf-custom-width-cm"
                                  type="number"
                                  className="tabular-nums"
                                  min={1}
                                  max={maxWfWCm}
                                  step="any"
                                  value={wfWidthCmInput}
                                  onChange={(e) => {
                                    const rawText = e.target.value;
                                    setWfWidthCmInput(rawText);
                                    const parsedCm = Number(rawText.replace(',', '.'));
                                    if (
                                      rawText.trim() !== '' &&
                                      Number.isFinite(parsedCm) &&
                                      parsedCm > 0
                                    ) {
                                      const clampedMm = Math.min(
                                        maxWfW,
                                        Math.max(1, cmToMm(parsedCm))
                                      );
                                      setCustomWidth(clampedMm);
                                    }
                                  }}
                                  onBlur={() => {
                                    const parsedCm = Number(wfWidthCmInput.replace(',', '.'));
                                    const safeMm =
                                      Number.isFinite(parsedCm) && parsedCm > 0
                                        ? Math.min(maxWfW, Math.max(10, cmToMm(parsedCm)))
                                        : Math.max(10, effectiveW);
                                    setCustomWidth(safeMm);
                                    setWfWidthCmInput(formatMmAsCm(safeMm));
                                  }}
                                  style={fixedControlStyle}
                                />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <label
                                  htmlFor="wf-custom-height-cm"
                                  style={{
                                    ...labelStyle,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  Высота изделия (см, макс. {maxWfHCm})
                                </label>
                                <input
                                  id="wf-custom-height-cm"
                                  type="number"
                                  className="tabular-nums"
                                  min={1}
                                  max={maxWfHCm}
                                  step="any"
                                  value={wfHeightCmInput}
                                  onChange={(e) => {
                                    const rawText = e.target.value;
                                    setWfHeightCmInput(rawText);
                                    const parsedCm = Number(rawText.replace(',', '.'));
                                    if (
                                      rawText.trim() !== '' &&
                                      Number.isFinite(parsedCm) &&
                                      parsedCm > 0
                                    ) {
                                      const clampedMm = Math.min(
                                        maxWfH,
                                        Math.max(1, cmToMm(parsedCm))
                                      );
                                      setCustomHeight(clampedMm);
                                    }
                                  }}
                                  onBlur={() => {
                                    const parsedCm = Number(wfHeightCmInput.replace(',', '.'));
                                    const safeMm =
                                      Number.isFinite(parsedCm) && parsedCm > 0
                                        ? Math.min(maxWfH, Math.max(10, cmToMm(parsedCm)))
                                        : Math.max(10, effectiveH);
                                    setCustomHeight(safeMm);
                                    setWfHeightCmInput(formatMmAsCm(safeMm));
                                  }}
                                  style={fixedControlStyle}
                                />
                              </div>

                              {isBannerCalc && bannerMarginSelectNode}
                            </div>

                            {exceedsRollWidth && (
                              <div
                                data-testid="wf-roll-warning"
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 3,
                                  fontSize: 12,
                                  lineHeight: 1.4,
                                  background: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
                                  border: `1px solid ${
                                    isDark ? 'rgba(245, 158, 11, 0.45)' : '#FCD34D'
                                  }`,
                                  color: isDark ? '#FCD34D' : '#92400E',
                                  fontWeight: 500,
                                }}
                              >
                                {exceedsPrintMax
                                  ? `⚠️ Ширина печати не более ${formatMmAsCm(
                                      MAX_WIDE_FORMAT_PRINT_WIDTH_MM
                                    )} см — печать со склейкой полотен (${formatWideFormatStripsBreakdown(
                                      wfStripBreakdown.stripSizesCm
                                    )})`
                                  : `⚠️ Размер превышает ширину рулона (${formatMmAsCm(
                                      rollWidthMm
                                    )} см) — печать выполняется в несколько полотен со сваркой/склейкой шва`}
                              </div>
                            )}
                          </div>
                        );
                      }

                const maxSra3Len = Math.max(
                  usableLimits.usable_width_mm,
                  usableLimits.usable_height_mm
                );
                const minSra3Side = Math.min(
                  usableLimits.usable_width_mm,
                  usableLimits.usable_height_mm
                );
                const maxAllowedW = customHeight > minSra3Side ? minSra3Side : maxSra3Len;
                const maxAllowedH = customWidth > minSra3Side ? minSra3Side : maxSra3Len;

                return (
                  <div className="ui-form-grid-2" style={{ gap: 16 }}>
                    <div>
                      <label style={labelStyle}>
                        Ширина изделия (мм, макс. {maxAllowedW})
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={maxAllowedW}
                        value={effectiveW}
                        onChange={(e) => {
                          const raw = Math.max(1, Number(e.target.value));
                          const clampedW = Math.min(maxSra3Len, raw);
                          setCustomWidth(clampedW);
                          if (clampedW > minSra3Side && customHeight > minSra3Side) {
                            setCustomHeight(minSra3Side);
                          }
                        }}
                        style={fixedControlStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Высота изделия (мм, макс. {maxAllowedH})
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={maxAllowedH}
                        value={effectiveH}
                        onChange={(e) => {
                          const raw = Math.max(1, Number(e.target.value));
                          const clampedH = Math.min(maxSra3Len, raw);
                          setCustomHeight(clampedH);
                          if (clampedH > minSra3Side && customWidth > minSra3Side) {
                            setCustomWidth(minSra3Side);
                          }
                        }}
                        style={fixedControlStyle}
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}

            {hasCoverBlock ? (
              (showPaperSelect || showPrintSidesSelect) && (
                <div
                  className="ui-form-grid-2"
                  style={{
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  {/* Левая колонка: Внутренний БЛОК */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    {showPaperSelect && (
                      <div>
                        <label style={labelStyle}>Бумага для блока</label>
                        <SearchableMaterialSelect
                          items={allowedPapersForCurrentProduct}
                          selectedId={selectedPaperId}
                          onSelect={(id) => setSelectedPaperId(id)}
                          placeholder="Выберите бумагу для блока..."
                          largePaperCard={true}
                          theme={t}
                        />
                      </div>
                    )}

                    {showPrintSidesSelect && (
                      <div>
                        <label style={labelStyle}>Печать блока</label>
                        <select
                          value={effectiveBlockMode}
                          disabled={allowedBlockModes !== 'both'}
                          onChange={(e) =>
                            setBlockPrintMode(e.target.value as BlockPrintModeType)
                          }
                          style={fixedControlStyle}
                        >
                          {allowedBlockModes !== '1+1' && allowedBlockModes !== '0+0' && (
                            <option value="4+4">Цветная двусторонняя (4+4)</option>
                          )}
                          {allowedBlockModes !== '4+4' && allowedBlockModes !== '0+0' && (
                            <option value="1+1">Чёрно-белая двусторонняя (1+1)</option>
                          )}
                          {(allowedBlockModes === '0+0' ||
                            (allowedBlockModes === 'both' &&
                              (currentProduct.category === 'notepads' ||
                                currentProduct.category === 'planners'))) && (
                            <option value="0+0">Без печати — чистые листы (0+0)</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Правая колонка: ОБЛОЖКА */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    {showPaperSelect && (
                      <div>
                        <label style={labelStyle}>Бумага для обложки</label>
                        <SearchableMaterialSelect
                          items={allowedCoverPapersForCurrentProduct}
                          selectedId={selectedCoverPaperId || selectedPaperId}
                          onSelect={(id) => setSelectedCoverPaperId(id)}
                          placeholder="Выберите бумагу для обложки..."
                          largePaperCard={true}
                          theme={t}
                        />
                      </div>
                    )}

                    {showPrintSidesSelect && (
                      <div>
                        <label style={labelStyle}>Печать обложки</label>
                        <select
                          value={effectiveCoverMode}
                          disabled={allowedCoverModes !== 'both'}
                          onChange={(e) =>
                            setCoverPrintMode(e.target.value as CoverPrintModeType)
                          }
                          style={fixedControlStyle}
                        >
                          {allowedCoverModes !== '4+4' && (
                            <option value="4+0">Цветная односторонняя (4+0)</option>
                          )}
                          {allowedCoverModes !== '4+0' && (
                            <option value="4+4">Цветная двусторонняя (4+4)</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              showPaperSelect && (
                <div>
                  <label style={labelStyle} data-testid="material-field-label">
                    {materialFieldMeta.label}
                  </label>
                  <SearchableMaterialSelect
                    items={allowedPapersForCurrentProduct}
                    selectedId={selectedPaperId}
                    onSelect={(id) => setSelectedPaperId(id)}
                    placeholder={materialFieldMeta.placeholder}
                    largePaperCard={true}
                    theme={t}
                  />
                </div>
              )
            )}

            {(showLaminationSelect || currentProduct.multi_page_mode !== 'none') && (
              <div
                className={
                  (showLaminationSelect && currentProduct.multi_page_mode !== 'none') ||
                  (showLaminationSelect && laminationSides > 0)
                    ? 'ui-form-grid-2'
                    : undefined
                }
                style={{
                  display: 'grid',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                {currentProduct.multi_page_mode !== 'none' && (
                  <div>
                    <label style={labelStyle}>
                      {currentProduct.multi_page_mode === 'pages'
                        ? `Количество страниц (полос) в блоке${
                            isStapleBinding ? ' (кратно 4, мин. 8)' : ''
                          }`
                        : currentProduct.category === 'card_decks'
                        ? 'Количество карт в колоде (шт.)'
                        : 'Количество листов в блоке'}
                    </label>
                    <input
                      type="number"
                      min={pagesMin}
                      step={pagesStep}
                      value={pagesCount}
                      onChange={(e) => handlePagesInputChange(Number(e.target.value))}
                      onBlur={handlePagesBlur}
                      style={fixedControlStyle}
                    />
                    {currentProduct.multi_page_mode === 'pages' &&
                      isStapleBinding &&
                      stapleRoundNotice && (
                        <div
                          data-testid="staple-pages-hint"
                          style={{
                            marginTop: 6,
                            padding: '5px 8px',
                            borderRadius: 2,
                            fontSize: 11.5,
                            lineHeight: 1.35,
                            background: t.selectedBg,
                            border: `1px solid ${t.clientInputBorder || t.selectedBorder}`,
                            color: t.selectedText,
                            fontWeight: 500,
                          }}
                        >
                          Для скрепления на скрепку число полос кратно 4 (мин. 8) — авто-округление:{' '}
                          <b>
                            {stapleRoundNotice.entered} → {stapleRoundNotice.rounded} стр.
                          </b>
                        </div>
                      )}
                  </div>
                )}

                {showLaminationSelect &&
                  (() => {
                    const filmSelectBlock =
                      laminationSides > 0 ? (
                        <div>
                          <label style={labelStyle}>Плёнка для ламинации</label>
                          <SearchableMaterialSelect
                            items={allowedLaminationsForCurrentProduct}
                            selectedId={selectedLaminationId}
                            onSelect={(id) => setSelectedLaminationId(id)}
                            placeholder="Выберите пленку..."
                            theme={t}
                          />
                        </div>
                      ) : null;

                    return (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <div>
                            <label style={labelStyle}>
                              {hasCoverBlock ? 'Ламинация обложки' : 'Ламинация'}
                            </label>
                            <select
                              value={laminationSides}
                              onChange={(e) => setLaminationSides(Number(e.target.value))}
                              style={fixedControlStyle}
                            >
                              <option value={0}>Нет</option>
                              <option value={1}>Односторонняя (1+0)</option>
                              <option value={2}>Двусторонняя (1+1)</option>
                            </select>
                          </div>
                          {currentProduct.multi_page_mode !== 'none' && filmSelectBlock}
                        </div>
                        {currentProduct.multi_page_mode === 'none' && filmSelectBlock}
                      </>
                    );
                  })()}
              </div>
            )}

            {/* Дополнительные параметры подсчета ДЛЯ КЛИЕНТОВ */}
            {clientFacingParams.length > 0 &&
              (() => {
                const clientFieldNodes: React.ReactNode[] = [];
                const singleLineClientLabelStyle: React.CSSProperties = {
                  ...labelStyle,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                };
                let hasExpandedEyeletSpacing = false;
                const inlinePairEyeletSpacing =
                  clientFacingParams.length >= 4 && clientFacingParams.length % 2 === 0;

                clientFacingParams.forEach((cp) => {
                  const inputType = cp.input_type || 'checkbox';
                  const currentVal = selectedClientParams[cp.id];
                  const fieldSelectId = `client-param-${cp.id}`;

                  if (inputType === 'select') {
                    const opts = cp.options || [];
                    const selectedOptId =
                      currentVal !== undefined ? String(currentVal) : opts[0]?.id || '';
                    clientFieldNodes.push(
                      <div key={cp.id} style={{ minWidth: 0 }}>
                        <label
                          htmlFor={fieldSelectId}
                          title={cp.name}
                          style={singleLineClientLabelStyle}
                        >
                          {cp.name}
                        </label>
                        <select
                          id={fieldSelectId}
                          value={selectedOptId}
                          onChange={(e) =>
                            setSelectedClientParams((prev) => ({
                              ...prev,
                              [cp.id]: e.target.value,
                            }))
                          }
                          style={fixedControlStyle}
                        >
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                    return;
                  }

                  if (inputType === 'number') {
                    clientFieldNodes.push(
                      <div key={cp.id} style={{ minWidth: 0 }}>
                        <label
                          htmlFor={fieldSelectId}
                          title={cp.name}
                          style={singleLineClientLabelStyle}
                        >
                          {cp.name}
                        </label>
                        <input
                          id={fieldSelectId}
                          type="number"
                          min={0}
                          value={currentVal !== undefined ? Number(currentVal) : 0}
                          onChange={(e) =>
                            setSelectedClientParams((prev) => ({
                              ...prev,
                              [cp.id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          style={fixedControlStyle}
                        />
                      </div>
                    );
                    return;
                  }

                  const isEyeletToggle = isEyeletCostParam(
                    cp,
                    mainCategoryId,
                    currentProduct.category
                  );
                  const isChecked = Boolean(currentVal);
                  const displayParamName =
                    isEyeletToggle && cp.name === 'Установка люверсов по периметру'
                      ? 'Установка люверсов'
                      : cp.name;

                  const toggleNode = (
                    <div key={cp.id} style={{ minWidth: 0 }}>
                      <label
                        htmlFor={fieldSelectId}
                        title={displayParamName}
                        style={singleLineClientLabelStyle}
                      >
                        {displayParamName}
                      </label>
                      <select
                        id={fieldSelectId}
                        value={isChecked ? 'true' : 'false'}
                        onChange={(e) => {
                          const nextEnabled = e.target.value === 'true';
                          setSelectedClientParams((prev) => ({
                            ...prev,
                            [cp.id]: nextEnabled,
                            ...(isEyeletToggle && nextEnabled && !prev.eyelets_step
                              ? { eyelets_step: DEFAULT_EYELET_SPACING }
                              : {}),
                          }));
                        }}
                        style={fixedControlStyle}
                      >
                        <option value="false">Нет</option>
                        <option value="true">Да</option>
                      </select>
                    </div>
                  );

                  if (isEyeletToggle && isChecked) {
                    hasExpandedEyeletSpacing = true;
                    const activeSpacing = resolveEyeletSpacing(selectedClientParams);
                    const spacingNode = (
                      <div key={`${cp.id}__spacing`} style={{ minWidth: 0 }}>
                        <label
                          htmlFor="wf-eyelets-step-select"
                          title="Расстояние между люверсами"
                          style={singleLineClientLabelStyle}
                        >
                          Расстояние между люверсами
                        </label>
                        <select
                          id="wf-eyelets-step-select"
                          value={activeSpacing}
                          onChange={(e) =>
                            setSelectedClientParams((prev) => ({
                              ...prev,
                              eyelets_step: e.target.value,
                            }))
                          }
                          style={fixedControlStyle}
                        >
                          {EYELET_SPACING_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );

                    if (inlinePairEyeletSpacing) {
                      clientFieldNodes.push(
                        <div
                          key={`${cp.id}__pair`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)',
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          {toggleNode}
                          {spacingNode}
                        </div>
                      );
                    } else {
                      clientFieldNodes.push(toggleNode, spacingNode);
                    }
                    return;
                  }

                  clientFieldNodes.push(toggleNode);
                });

                const useThreeColumnEyeletRow =
                  hasExpandedEyeletSpacing && clientFieldNodes.length === 3;

                return (
                  <div
                    className={
                      useThreeColumnEyeletRow
                        ? 'ui-form-grid-eyelets-3'
                        : clientFieldNodes.length > 1
                        ? 'ui-form-grid-2'
                        : undefined
                    }
                    style={{
                      display: 'grid',
                      gap: useThreeColumnEyeletRow ? 12 : 16,
                    }}
                  >
                    {clientFieldNodes}
                  </div>
                );
              })()}

            <div>
              <label style={labelStyle}>
                Тираж <span style={{ color: t.subText, fontWeight: 400 }}>(шт.)</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  style={{
                    ...fixedControlStyle,
                    paddingRight: 110,
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                />
                <span
                  className={`ui-unit-price ${isCalculating ? 'ui-unit-price-calculating' : ''}`}
                  style={{
                    position: 'absolute',
                    right: 14,
                    fontSize: 13,
                    color: t.subText,
                    pointerEvents: 'none',
                    fontWeight: 500,
                  }}
                >
                  {calcResult ? Math.round(calcResult.unit_price).toLocaleString('ru-RU') : 0} ₽/шт
                </span>
              </div>

              {/* Быстрые кнопки выбора тиража (Tier Pills) */}
              <div className="ui-tier-pills" role="group" aria-label="Быстрый выбор тиража">
                {quickTiers.map((tierQty) => {
                  const isActiveTier = quantity === tierQty;
                  return (
                    <button
                      key={tierQty}
                      type="button"
                      className="ui-tier-pill"
                      aria-pressed={isActiveTier}
                      onClick={() => setQuantity(tierQty)}
                      style={{
                        border: isActiveTier
                          ? `1px solid ${t.brandPrimary || 'var(--brand-primary)'}`
                          : `1px solid ${t.border}`,
                        background: isActiveTier
                          ? t.brandPrimary || 'var(--brand-primary)'
                          : t.cardBg,
                        color: isActiveTier ? '#FFFFFF' : t.text,
                        boxShadow: 'none',
                      }}
                    >
                      {tierQty.toLocaleString('ru-RU')} шт.
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 16,
              borderTop: `1px solid ${t.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'opacity 0.2s',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: t.mutedText, marginBottom: 4 }}>
                  Стоимость
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span
                    className={`ui-price-value ${isCalculating ? 'ui-price-calculating' : 'ui-price-ready'}`}
                    style={{
                      fontSize: 34,
                      fontWeight: 800,
                      color: t.text,
                      lineHeight: 1.1,
                    }}
                  >
                    {calcResult ? Math.round(calcResult.client_price).toLocaleString('ru-RU') : 0}{' '}
                    <span style={{ fontSize: 24, fontWeight: 700 }}>₽</span>
                  </span>
                  {Boolean(
                    calcResult?.discount_percent &&
                      calcResult.discount_percent > 0 &&
                      calcResult.original_client_price &&
                      calcResult.original_client_price > calcResult.client_price
                  ) && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: t.subText,
                          textDecoration: 'line-through',
                        }}
                      >
                        {Math.round(calcResult!.original_client_price!).toLocaleString('ru-RU')} ₽
                      </span>
                      <span
                        data-testid="calc-user-discount-badge"
                        style={{
                          padding: '3px 8px',
                          borderRadius: 2,
                          fontSize: 12,
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#10B981',
                          border: '1px solid #10B981',
                        }}
                      >
                        Ваша скидка −{calcResult!.discount_percent}%
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: t.subText, marginTop: 4 }}>
                  Стоимость в рублях за тираж ({calcResult ? calcResult.quantity : Math.max(1, quantity)} шт.)
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  data-testid="add-to-estimate-btn"
                  onClick={() => {
                    if (!onAddEstimateItem) return;
                    const draft = buildEstimateDraftFromSelection({
                      mainCategoryId,
                      categoryName,
                      currentProduct,
                      adminCurrentProd,
                      effectiveW,
                      effectiveH,
                      pagesCount,
                      quantity,
                      selectedPaperId,
                      selectedCoverPaperId,
                      allowedPapers: allowedPapersForCurrentProduct,
                      allowedCoverPapers: allowedCoverPapersForCurrentProduct,
                      printSides,
                      blockPrintMode: effectiveBlockMode,
                      coverPrintMode: effectiveCoverMode,
                      laminationSides,
                      selectedLaminationId,
                      allowedLaminations: allowedLaminationsForCurrentProduct,
                      selectedClientParams,
                      calcResult,
                    });
                    onAddEstimateItem(draft);
                  }}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 2,
                    border: 'none',
                    background: t.brandPrimary || 'var(--brand-primary)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>+ В корзину</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {calcResult?.internal &&
        (() => {
          const effectiveInternalMainCat =
            calcResult.internal.main_category_id || mainCategoryId || 'polygraphy';
          return (
            <div
              data-testid="admin-calc-breakdown"
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: t.cardBg,
                borderRadius: 3,
                border: `1px dashed ${t.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px 16px',
                  paddingBottom: 8,
                  marginBottom: 10,
                  borderBottom: `1px solid ${t.softBorder}`,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: isDark ? '#fbbf24' : '#b45309',
                  }}
                >
                  Детализация расчёта (админ)
                </div>

                {internalOnlyParams.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '6px 12px',
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: t.mutedText }}>
                      Внутренние работы:
                    </span>
                    {internalOnlyParams.map((ip) => {
                      const isEnabled = !disabledInternalParamIds.includes(ip.id);
                      return (
                        <label
                          key={ip.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11.5,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDisabledInternalParamIds((prev) =>
                                  prev.filter((id) => id !== ip.id)
                                );
                              } else {
                                setDisabledInternalParamIds((prev) => [...prev, ip.id]);
                              }
                            }}
                          />
                          <span>
                            {ip.name} ({ip.cost} ₽)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '10px 14px',
                  fontSize: 12.5,
                  paddingBottom: 10,
                  marginBottom: 10,
                  borderBottom: `1px dashed ${t.softBorder}`,
                  alignItems: 'center',
                }}
              >
                <div>
                  Себестоимость: <b>{calcResult.internal.total_cost.toFixed(2)} ₽</b>
                  <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                    {calcResult.internal.cost_per_unit.toFixed(2)} ₽ / шт.
                  </span>
                </div>
                <div>
                  Наценка: <b>×{calcResult.internal.coefficient}</b>
                  {calcResult.internal.has_cover_block &&
                    calcResult.internal.page_coefficient !== undefined && (
                      <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                        Полосы: ×{calcResult.internal.page_coefficient}
                      </span>
                    )}
                </div>
                <div>
                  Прибыль:{' '}
                  <b style={{ color: isDark ? '#4ade80' : '#16a34a' }}>
                    +{calcResult.internal.profit.toFixed(2)} ₽
                  </b>
                </div>

                {effectiveInternalMainCat === 'polygraphy' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      gridColumn: 'span 1',
                    }}
                  >
                    {/* Миниатюрная SVG-схема раскладки на листе SRA3 (320×450 мм, раб. поле 310×440 мм) */}
                    <div
                      title={`Схема раскладки на SRA3 (${sra3Layout.sra3WidthMm}×${sra3Layout.sra3HeightMm} мм, раб. зона ${sra3Layout.usableWidthMm}×${sra3Layout.usableHeightMm} мм): ${sra3Layout.cols}×${sra3Layout.rows} = ${sra3Layout.itemsPerSheet} шт./л. (${sra3Layout.utilizationPercent}% площади)`}
                      style={{
                        width: 52,
                        height: 72,
                        flexShrink: 0,
                        borderRadius: 3,
                        padding: 3,
                        background: isDark ? '#141619' : '#FFFFFF',
                        border: `1px solid ${t.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        data-testid="sra3-layout-svg"
                        viewBox={`0 0 ${sra3Layout.sra3WidthMm} ${sra3Layout.sra3HeightMm}`}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                      >
                        <rect
                          x={0}
                          y={0}
                          width={sra3Layout.sra3WidthMm}
                          height={sra3Layout.sra3HeightMm}
                          rx={6}
                          fill={isDark ? '#1E2024' : '#F8FAFC'}
                          stroke={isDark ? '#64748B' : '#94A3B8'}
                          strokeWidth={4}
                        />
                        <rect
                          x={sra3Layout.usableOffsetXMm}
                          y={sra3Layout.usableOffsetYMm}
                          width={sra3Layout.usableWidthMm}
                          height={sra3Layout.usableHeightMm}
                          fill="none"
                          stroke={isDark ? '#475569' : '#CBD5E1'}
                          strokeWidth={2.5}
                          strokeDasharray="10 6"
                        />
                        {sra3Layout.rects.map((r) => (
                          <g key={r.index}>
                            <rect
                              x={r.xMm}
                              y={r.yMm}
                              width={r.widthMm}
                              height={r.heightMm}
                              fill={isDark ? 'rgba(229, 77, 71, 0.24)' : 'rgba(192, 39, 33, 0.14)'}
                              stroke={isDark ? '#E54D47' : '#C02721'}
                              strokeWidth={2.5}
                            />
                            {r.trimWidthMm > 8 && r.trimHeightMm > 8 && (
                              <rect
                                x={r.trimXMm}
                                y={r.trimYMm}
                                width={r.trimWidthMm}
                                height={r.trimHeightMm}
                                fill="none"
                                stroke={
                                  isDark
                                    ? 'rgba(252, 165, 165, 0.55)'
                                    : 'rgba(153, 27, 27, 0.45)'
                                }
                                strokeWidth={1.2}
                                strokeDasharray="5 4"
                              />
                            )}
                          </g>
                        ))}
                      </svg>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div>
                        SRA3: <b>{calcResult.internal.sheets_needed} л.</b>{' '}
                        <span style={{ fontSize: 11.5, color: t.subText }}>
                          ({calcResult.internal.items_per_sheet} шт./л.)
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                        С вылетами: {calcResult.internal.size_with_bleed}
                      </span>
                      <span style={{ fontSize: 10.5, color: t.mutedText, display: 'block' }}>
                        Сетка {sra3Layout.cols}×{sra3Layout.rows} • {sra3Layout.utilizationPercent}% раб. поля
                      </span>
                    </div>
                  </div>
                )}

                {effectiveInternalMainCat === 'wide_format' && (
                  <div style={{ minWidth: 0 }}>
                    <div>
                      Площадь (с отходом): <b>~{calcResult.internal.sheets_needed} м²</b>
                    </div>
                    <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                      {isBannerCalc ? 'Размер с полями и припуском:' : 'Размер с припуском:'}{' '}
                      {formatDimensionsTextInCm(calcResult.internal.size_with_bleed)}
                    </span>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '8px 14px',
                  fontSize: 12.5,
                }}
              >
                {effectiveInternalMainCat === 'wide_format' ? (
                  <>
                    <div>
                      Материал (рулон):{' '}
                      <b className="tabular-nums">
                        {calcResult.internal.breakdown.paper_cost.toFixed(2)} ₽
                      </b>
                      {calcResult.internal.breakdown.paper_cost_per_m2 !== undefined &&
                        calcResult.internal.breakdown.total_area_m2 !== undefined && (
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 11, color: t.subText, display: 'block' }}
                          >
                            {calcResult.internal.breakdown.total_area_m2.toFixed(2)} м² ×{' '}
                            {calcResult.internal.breakdown.paper_cost_per_m2.toFixed(2)} ₽/м²
                          </span>
                        )}
                    </div>
                    <div>
                      Печать (чернила + плоттер):{' '}
                      <b>{calcResult.internal.breakdown.print_cost.toFixed(2)} ₽</b>
                      {calcResult.internal.breakdown.toner_cost !== undefined &&
                        calcResult.internal.breakdown.components_cost !== undefined && (
                          <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                            Чернила: {calcResult.internal.breakdown.toner_cost.toFixed(2)} ₽ •
                            Плоттер: {calcResult.internal.breakdown.components_cost.toFixed(2)} ₽
                          </span>
                        )}
                    </div>
                  </>
                ) : effectiveInternalMainCat === 'souvenirs' ? (
                  <>
                    <div>
                      Заготовки: <b>{calcResult.internal.breakdown.paper_cost.toFixed(2)} ₽</b>
                    </div>
                    <div>
                      Нанесение (сублимация + термопресс):{' '}
                      <b>{calcResult.internal.breakdown.print_cost.toFixed(2)} ₽</b>
                    </div>
                  </>
                ) : effectiveInternalMainCat === 'stamps' ? (
                  <>
                    <div>
                      Оснастки: <b>{calcResult.internal.breakdown.paper_cost.toFixed(2)} ₽</b>
                    </div>
                    <div>
                      Клише (резина + гравировка):{' '}
                      <b>{calcResult.internal.breakdown.print_cost.toFixed(2)} ₽</b>
                    </div>
                  </>
                ) : effectiveInternalMainCat === 'design' ? (
                  <div>
                    Работа дизайнера:{' '}
                    <b>{calcResult.internal.breakdown.print_cost.toFixed(2)} ₽</b>
                  </div>
                ) : (
                  <>
                    <div>
                      Печать: <b>{calcResult.internal.breakdown.print_cost.toFixed(2)} ₽</b>
                      {calcResult.internal.breakdown.toner_cost !== undefined &&
                        calcResult.internal.breakdown.components_cost !== undefined && (
                          <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                            Тонер: {calcResult.internal.breakdown.toner_cost.toFixed(2)} ₽ • ЗИП:{' '}
                            {calcResult.internal.breakdown.components_cost.toFixed(2)} ₽
                          </span>
                        )}
                      {calcResult.internal.has_cover_block &&
                        calcResult.internal.breakdown.block_print_cost !== undefined && (
                          <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                            Блок ({calcResult.internal.breakdown.block_print_mode}):{' '}
                            {calcResult.internal.breakdown.block_print_cost.toFixed(2)} ₽ • Обл. (
                            {calcResult.internal.breakdown.cover_print_mode}):{' '}
                            {(calcResult.internal.breakdown.cover_print_cost || 0).toFixed(2)} ₽
                          </span>
                        )}
                    </div>
                    <div>
                      Бумага: <b>{calcResult.internal.breakdown.paper_cost.toFixed(2)} ₽</b>
                      {calcResult.internal.has_cover_block &&
                      calcResult.internal.breakdown.block_paper_cost !== undefined ? (
                        <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                          Блок: {calcResult.internal.breakdown.block_paper_cost.toFixed(2)} ₽ (
                          {calcResult.internal.breakdown.block_sheets_needed} л.) • Обл.:{' '}
                          {(calcResult.internal.breakdown.cover_paper_cost || 0).toFixed(2)} ₽ (
                          {calcResult.internal.breakdown.cover_sheets_needed} л.)
                        </span>
                      ) : (
                        calcResult.internal.sheets_needed > 0 && (
                          <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                            {calcResult.internal.sheets_needed} л. ×{' '}
                            {(
                              calcResult.internal.breakdown.paper_cost /
                              calcResult.internal.sheets_needed
                            ).toFixed(2)}{' '}
                            ₽/л.
                          </span>
                        )
                      )}
                    </div>
                  </>
                )}

                {calcResult.internal.breakdown.lamination_cost > 0 && (
                  <div>
                    Ламинация: <b>{calcResult.internal.breakdown.lamination_cost.toFixed(2)} ₽</b>
                  </div>
                )}
                {calcResult.internal.breakdown.extra_cost > 0 && (
                  <div>
                    Доп. работы: <b>{calcResult.internal.breakdown.extra_cost.toFixed(2)} ₽</b>
                    {calcResult.internal.breakdown.params &&
                      calcResult.internal.breakdown.params.length > 0 && (
                        <span style={{ fontSize: 11, color: t.subText, display: 'block' }}>
                          {calcResult.internal.breakdown.params.length === 1
                            ? calcResult.internal.breakdown.params[0].name
                            : calcResult.internal.breakdown.params
                                .map((bp) => `${bp.name}: ${bp.total.toFixed(2)} ₽`)
                                .join(' • ')}
                        </span>
                      )}
                  </div>
                )}
                {calcResult.internal.defect_percent > 0 && (
                  <div>
                    Брак ({calcResult.internal.defect_percent}%):{' '}
                    <b>+{calcResult.internal.defect_cost.toFixed(2)} ₽</b>
                  </div>
                )}
                {(calcResult.internal.tax_percent ?? 0) > 0 && (
                  <div>
                    Налог ({calcResult.internal.tax_percent}%):{' '}
                    <b>+{(calcResult.internal.tax_cost ?? 0).toFixed(2)} ₽</b>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
