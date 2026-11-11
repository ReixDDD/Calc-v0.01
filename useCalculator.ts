import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../apiClient';
import { BlockPrintModeType, CalculationResult, CatalogItemPublic, CoverPrintModeType, ProductItem } from '../../types';
import { normalizePagesForBinding } from '../../calculatorUtils';
import { resolveBindingType } from '../../components/ProductSchematicSVG';

type CalculatorInput = {
  currentProduct?: ProductItem;
  activeProduct?: ProductItem;
  selectedPaperId: number;
  selectedCoverPaperId: number;
  printSides: number;
  blockPrintMode: BlockPrintModeType;
  coverPrintMode: CoverPrintModeType;
  laminationSides: number;
  selectedLaminationId: number | null;
  customWidth: number;
  customHeight: number;
  quantity: number;
  pagesCount: number;
  selectedClientParams: Record<string, string | number | boolean>;
  disabledInternalParamIds: string[];
  allowedLaminations: CatalogItemPublic[];
  isAdminUnlocked: boolean;
  canViewInternalMetrics?: boolean;
  authToken: string;
};

export function useCalculator(input: CalculatorInput) {
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const cacheRef = useRef<Map<string, CalculationResult>>(new Map());

  useEffect(() => {
    const { currentProduct, activeProduct } = input;
    if (!currentProduct || !activeProduct) return;
    if (activeProduct.show_paper_select !== false && !input.selectedPaperId) return;

    const effectiveSides = currentProduct.allowed_sides === 'single_only' ? 1 :
      currentProduct.allowed_sides === 'duplex_only' || currentProduct.multi_page_mode === 'pages' ? 2 :
        input.printSides === 2 ? 2 : 1;
    const effectiveLamSides = activeProduct.show_lamination_select !== false && input.allowedLaminations.length > 0
      ? input.laminationSides : 0;
    const effectiveBlockPrintMode = activeProduct.allowed_block_print_modes === '4+4' ? '4+4' :
      activeProduct.allowed_block_print_modes === '1+1' ? '1+1' :
        activeProduct.allowed_block_print_modes === '0+0' ? '0+0' : input.blockPrintMode;
    const effectiveCoverPrintMode = activeProduct.allowed_cover_print_modes === '4+4' ? '4+4' :
      activeProduct.allowed_cover_print_modes === '4+0' ? '4+0' : input.coverPrintMode;
    const binding = resolveBindingType(currentProduct, input.selectedClientParams);
    const { normalized: effectivePages } = normalizePagesForBinding(input.pagesCount, currentProduct.multi_page_mode, binding);
    const payload = {
      product_id: currentProduct.id,
      paper_id: input.selectedPaperId,
      cover_paper_id: input.selectedCoverPaperId || input.selectedPaperId,
      print_sides: effectiveSides,
      block_print_mode: effectiveBlockPrintMode,
      cover_print_mode: effectiveCoverPrintMode,
      lamination_id: effectiveLamSides > 0 ? input.selectedLaminationId : null,
      lamination_sides: effectiveLamSides,
      width_mm: activeProduct.allow_custom_size ? input.customWidth : currentProduct.width_mm,
      height_mm: activeProduct.allow_custom_size ? input.customHeight : currentProduct.height_mm,
      quantity: Math.max(1, input.quantity),
      pages_count: Math.max(1, effectivePages),
      selected_params: input.selectedClientParams,
      disabled_internal_param_ids: input.disabledInternalParamIds,
    };
    const payloadJson = JSON.stringify(payload);
    const showInternal = Boolean(input.isAdminUnlocked || input.canViewInternalMetrics);
    const cacheKey = `${showInternal ? 'adm' : 'pub'}:${input.authToken || 'anon'}:${payloadJson}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setCalcResult(cached);
      setIsCalculating(false);
      return;
    }
    const controller = new AbortController();
    setIsCalculating(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch('/calculate', {
          method: 'POST',
          token: input.authToken,
          headers: { 'Content-Type': 'application/json' },
          body: payloadJson,
          signal: controller.signal,
        });
        if (response.ok) {
          const result: CalculationResult = await response.json();
          if (cacheRef.current.size > 300) cacheRef.current.clear();
          cacheRef.current.set(cacheKey, result);
          setCalcResult(result);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error(error);
      } finally {
        if (!controller.signal.aborted) setIsCalculating(false);
      }
    }, 80);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [input.currentProduct?.id, input.activeProduct?.id, input.activeProduct?.show_paper_select, input.activeProduct?.show_lamination_select, input.activeProduct?.allow_custom_size, input.activeProduct?.allowed_block_print_modes, input.activeProduct?.allowed_cover_print_modes, input.selectedPaperId, input.selectedCoverPaperId, input.printSides, input.blockPrintMode, input.coverPrintMode, input.laminationSides, input.selectedLaminationId, input.customWidth, input.customHeight, input.quantity, input.pagesCount, input.selectedClientParams, input.disabledInternalParamIds, input.isAdminUnlocked, input.canViewInternalMetrics, input.authToken, input.allowedLaminations.length]);

  return { calcResult, setCalcResult, isCalculating, clearCalculationCache: () => cacheRef.current.clear() };
}
