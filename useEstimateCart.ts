import { useEffect, useState } from 'react';
import { EstimateItem } from '../../types';

type DraftEstimateItem = Omit<EstimateItem, 'id' | 'createdAt'>;

type Toast = (message: string) => void;

function newEstimateId() {
  return `est_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useEstimateCart(showToast: Toast) {
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>(() => {
    try {
      const raw = localStorage.getItem('print_calc_estimate_items');
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('print_calc_estimate_items', JSON.stringify(estimateItems));
    } catch {
      // Ignore storage quota and unavailable-storage errors.
    }
  }, [estimateItems]);

  const addEstimateItem = (draft: DraftEstimateItem) => {
    setEstimateItems((previous) => [
      ...previous,
      { ...draft, id: newEstimateId(), createdAt: new Date().toISOString() },
    ]);
    showToast('Товар добавлен в корзину');
  };

  const removeEstimateItem = (id: string) => {
    setEstimateItems((previous) => previous.filter((item) => item.id !== id));
  };

  const duplicateEstimateItem = (id: string) => {
    setEstimateItems((previous) => {
      const index = previous.findIndex((item) => item.id === id);
      if (index < 0) return previous;
      const source = previous[index];
      const copy = { ...source, id: newEstimateId(), createdAt: new Date().toISOString() };
      const next = [...previous];
      next.splice(index + 1, 0, copy);
      return next;
    });
    showToast('Позиция продублирована в корзине');
  };

  const updateEstimateItemNote = (id: string, note: string) => {
    setEstimateItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, customNote: note || undefined } : item))
    );
  };

  const clearEstimate = () => {
    setEstimateItems([]);
    showToast('Корзина очищена');
  };

  const clearEstimateSilently = () => setEstimateItems([]);

  const replaceEstimateItems = (nextItems: EstimateItem[]) => {
    const nowIso = new Date().toISOString();
    const normalized = (Array.isArray(nextItems) ? nextItems : []).map((item) => ({
      ...item,
      id: item.id || newEstimateId(),
      createdAt: item.createdAt || nowIso,
    }));
    setEstimateItems(normalized);
  };

  const addMultipleEstimateItems = (
    drafts: Array<DraftEstimateItem | EstimateItem>
  ) => {
    const validDrafts = Array.isArray(drafts) ? drafts : [];
    if (validDrafts.length === 0) return;
    const nowIso = new Date().toISOString();
    setEstimateItems((previous) => [
      ...previous,
      ...validDrafts.map((draft) => ({
        ...draft,
        id: newEstimateId(),
        createdAt: nowIso,
      })),
    ]);
    showToast('Все позиции добавлены в вашу корзину');
  };

  return {
    estimateItems,
    addEstimateItem,
    addMultipleEstimateItems,
    removeEstimateItem,
    duplicateEstimateItem,
    updateEstimateItemNote,
    clearEstimate,
    clearEstimateSilently,
    replaceEstimateItems,
  };
}
