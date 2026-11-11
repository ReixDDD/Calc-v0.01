import React, { useState, useEffect, useRef } from 'react';
import {
  AuthUser,
  CompanyDetails,
  CrmOrder,
  EstimateHeaderMeta,
  EstimateItem,
  PaymentMethod,
} from '../types';
import { apiFetch } from '../apiClient';
import {
  calculateEstimatePricing,
  getMaterialFieldMeta,
} from '../calculatorUtils';
import { buildSharedCartUrl } from '../routing';
import { isCompleteCompanyDetails } from './ClientOrdersPage';
import EstimateCompanyFields from './EstimateCompanyFields';
import EstimatePrintableKp from './EstimatePrintableKp';

const ESTIMATE_META_STORAGE_KEY = 'print_calc_estimate_meta';

function loadEstimateMeta(): EstimateHeaderMeta {
  try {
    const raw = localStorage.getItem(ESTIMATE_META_STORAGE_KEY);
    if (!raw) return { customerName: '', comment: '', discountPercent: 0, discountComment: '' };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        customerName: typeof parsed.customerName === 'string' ? parsed.customerName : '',
        comment: typeof parsed.comment === 'string' ? parsed.comment : '',
        discountPercent:
          typeof parsed.discountPercent === 'number' && Number.isFinite(parsed.discountPercent)
            ? Math.max(0, Math.min(100, parsed.discountPercent))
            : 0,
        discountComment: typeof parsed.discountComment === 'string' ? parsed.discountComment : '',
        managerName: typeof parsed.managerName === 'string' ? parsed.managerName : undefined,
        managerPhone: typeof parsed.managerPhone === 'string' ? parsed.managerPhone : undefined,
        managerEmail: typeof parsed.managerEmail === 'string' ? parsed.managerEmail : undefined,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { customerName: '', comment: '', discountPercent: 0, discountComment: '' };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export interface EstimatePanelProps {
  items: EstimateItem[];
  onRemoveItem: (id: string) => void;
  onDuplicateItem?: (id: string) => void;
  onUpdateItemNote?: (id: string, note: string) => void;
  onClearAll: () => void;
  onCopySuccess: (msg: string) => void;
  isDark: boolean;
  theme: Record<string, string>;
  isHighlighted?: boolean;
  mode?: 'sidebar' | 'page';
  isAdminUnlocked?: boolean;
  canManageKp?: boolean;
  currentUser?: AuthUser | null;
  authToken?: string;
  onOrderCreated?: (order: CrmOrder) => void;
  onNavigateToOrdersCompanyTab?: () => void;
  onOpenCartPage?: () => void;
  onContinueShopping?: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
  isSharedView?: boolean;
  onAddSharedItemToMyCart?: (item: EstimateItem) => void;
  onAddAllSharedToMyCart?: () => void;
  ownCartCount?: number;
  onOpenOwnCart?: () => void;
}

export default function EstimatePanel({
  items,
  onRemoveItem,
  onDuplicateItem,
  onUpdateItemNote,
  onClearAll,
  onCopySuccess,
  isDark,
  theme: t,
  isHighlighted = false,
  mode = 'sidebar',
  isAdminUnlocked = false,
  canManageKp,
  currentUser,
  authToken,
  onOrderCreated,
  onNavigateToOrdersCompanyTab,
  onOpenCartPage,
  onContinueShopping,
  onNavigateToLogin,
  onNavigateToRegister,
  isSharedView = false,
  onAddSharedItemToMyCart,
  onAddAllSharedToMyCart,
  ownCartCount,
  onOpenOwnCart,
}: EstimatePanelProps) {
  const hasKpAccess =
    !isSharedView &&
    (canManageKp !== undefined ? Boolean(canManageKp) : Boolean(isAdminUnlocked));
  const [meta, setMeta] = useState<EstimateHeaderMeta>(loadEstimateMeta);
  const [isDiscountFormOpen, setIsDiscountFormOpen] = useState<boolean>(false);
  const [draftDiscountPercent, setDraftDiscountPercent] = useState<number>(
    () => loadEstimateMeta().discountPercent || 0
  );
  const [draftDiscountComment, setDraftDiscountComment] = useState<string>(
    () => loadEstimateMeta().discountComment || ''
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string>('');

  const isStaffOrderCreator = Boolean(
    currentUser && (currentUser.role !== 'client' || hasKpAccess)
  );
  const isLegalUser =
    isCompleteCompanyDetails(currentUser?.company_details) ||
    currentUser?.client_type === 'legal';
  const canUseBankTransfer = isLegalUser || isStaffOrderCreator;

  // Поля оформления заказа на странице /cart
  const [orderClientName, setOrderClientName] = useState<string>(() =>
    !isStaffOrderCreator
      ? currentUser?.company_details?.company_name ||
        currentUser?.name ||
        loadEstimateMeta().customerName ||
        ''
      : loadEstimateMeta().customerName || ''
  );
  const [orderClientPhone, setOrderClientPhone] = useState<string>(() =>
    !isStaffOrderCreator ? currentUser?.phone || currentUser?.company_details?.phone || '' : ''
  );
  const [orderClientEmail, setOrderClientEmail] = useState<string>(() =>
    !isStaffOrderCreator ? currentUser?.email || '' : ''
  );
  const [orderDesignLink, setOrderDesignLink] = useState<string>('');
  const [orderComment, setOrderComment] = useState<string>(
    () => loadEstimateMeta().comment || ''
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [invoiceCompany, setInvoiceCompany] = useState<Required<CompanyDetails>>(() => ({
    company_name: !isStaffOrderCreator ? currentUser?.company_details?.company_name || '' : '',
    inn: !isStaffOrderCreator ? currentUser?.company_details?.inn || '' : '',
    kpp: !isStaffOrderCreator ? currentUser?.company_details?.kpp || '' : '',
    legal_address: !isStaffOrderCreator ? currentUser?.company_details?.legal_address || '' : '',
    bank_name: !isStaffOrderCreator ? currentUser?.company_details?.bank_name || '' : '',
    bik: !isStaffOrderCreator ? currentUser?.company_details?.bik || '' : '',
    checking_account: !isStaffOrderCreator
      ? currentUser?.company_details?.checking_account || ''
      : '',
    correspondent_account: !isStaffOrderCreator
      ? currentUser?.company_details?.correspondent_account || ''
      : '',
    phone: !isStaffOrderCreator
      ? currentUser?.company_details?.phone || currentUser?.phone || ''
      : '',
  }));
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      idempotencyRef.current = null;
    }
  }, [items.length]);

  useEffect(() => {
    if (!canUseBankTransfer && paymentMethod === 'bank_transfer') {
      setPaymentMethod('cash');
    }
  }, [canUseBankTransfer, paymentMethod]);

  useEffect(() => {
    if (!currentUser || isStaffOrderCreator) {
      return;
    }
    if (currentUser.name && !orderClientName.trim()) {
      setOrderClientName(currentUser.company_details?.company_name || currentUser.name);
    }
    if (currentUser.email && !orderClientEmail.trim()) {
      setOrderClientEmail(currentUser.email);
    }
    const uPhone = currentUser.phone || currentUser.company_details?.phone || '';
    if (uPhone && !orderClientPhone.trim()) {
      setOrderClientPhone(uPhone);
    }
    if (currentUser.company_details) {
      const cd = currentUser.company_details;
      setInvoiceCompany((prev) => ({
        company_name: cd.company_name || prev.company_name || '',
        inn: cd.inn || prev.inn || '',
        kpp: cd.kpp || prev.kpp || '',
        legal_address: cd.legal_address || prev.legal_address || '',
        bank_name: cd.bank_name || prev.bank_name || '',
        bik: cd.bik || prev.bik || '',
        checking_account: cd.checking_account || prev.checking_account || '',
        correspondent_account: cd.correspondent_account || prev.correspondent_account || '',
        phone: cd.phone || currentUser.phone || prev.phone || '',
      }));
    }
  }, [currentUser, isStaffOrderCreator]);

  useEffect(() => {
    try {
      localStorage.setItem(ESTIMATE_META_STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // ignore storage errors
    }
  }, [meta]);

  useEffect(() => {
    setDraftDiscountPercent(meta.discountPercent || 0);
    setDraftDiscountComment(meta.discountComment || '');
  }, [meta.discountPercent, meta.discountComment]);

  const userFullName = currentUser
    ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim() ||
      currentUser.name ||
      ''
    : '';
  const userPhone = currentUser?.phone || currentUser?.company_details?.phone || '';
  const userEmail = currentUser?.email || '';

  const resolvedManagerName = hasKpAccess ? userFullName || meta.managerName || '' : '';
  const resolvedManagerPhone = hasKpAccess ? userPhone || meta.managerPhone || '' : '';
  const resolvedManagerEmail = hasKpAccess ? userEmail || meta.managerEmail || '' : '';

  const effectiveMeta: EstimateHeaderMeta = hasKpAccess
    ? {
        ...meta,
        managerName: resolvedManagerName,
        managerPhone: resolvedManagerPhone,
        managerEmail: resolvedManagerEmail,
      }
    : { customerName: '', comment: '', discountPercent: 0 };

  const pricing = calculateEstimatePricing(items, effectiveMeta.discountPercent);

  const createSharedCartLink = async (): Promise<string | null> => {
    try {
      const res = await apiFetch('/shared-carts', {
        method: 'POST',
        token: authToken,
        json: {
          items,
          meta: effectiveMeta,
        },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data && typeof data.token === 'string' && data.token.trim()) {
        return buildSharedCartUrl(window.location.origin, data.token);
      }
    } catch {
      // Fallback to text-only copy if network fails
    }
    return null;
  };

  const handleCopyCartLinkOnly = async () => {
    const shareUrl = await createSharedCartLink();
    if (!shareUrl) {
      onCopySuccess('Не удалось создать ссылку на корзину');
      return;
    }
    await copyTextToClipboard(shareUrl);
    onCopySuccess('Ссылка на корзину скопирована в буфер обмена');
  };

  const handlePrintKp = () => {
    window.print();
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !authToken) {
      onCopySuccess('Для оформления заказа необходимо войти в аккаунт');
      onNavigateToLogin?.();
      return;
    }
    const isBankTransfer = canUseBankTransfer && paymentMethod === 'bank_transfer';
    const cleanedName = isStaffOrderCreator
      ? orderClientName.trim() ||
        (isBankTransfer ? invoiceCompany.company_name.trim() : '') ||
        meta.customerName?.trim() ||
        ''
      : orderClientName.trim() ||
        (isBankTransfer ? invoiceCompany.company_name.trim() : '') ||
        meta.customerName?.trim() ||
        currentUser?.name ||
        '';
    if (!cleanedName) {
      onCopySuccess(
        isStaffOrderCreator
          ? 'Укажите имя клиента или название компании заказчика'
          : 'Пожалуйста, укажите ваше Имя или название компании'
      );
      return;
    }
    if (isBankTransfer && !invoiceCompany.inn.trim()) {
      onCopySuccess('Укажите ИНН компании для безналичного расчёта');
      return;
    }
    const cleanedDiscountComment = (meta.discountComment || '').trim();
    if (hasKpAccess && pricing.discountPercent > 0 && !cleanedDiscountComment) {
      onCopySuccess('Укажите комментарий: почему предоставляется скидка');
      setDraftDiscountPercent(pricing.discountPercent);
      setDraftDiscountComment(meta.discountComment || '');
      setIsDiscountFormOpen(true);
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const cleanedCompanyDetails: CompanyDetails = isBankTransfer
        ? {
            company_name: invoiceCompany.company_name.trim() || cleanedName,
            inn: invoiceCompany.inn.trim(),
            kpp: invoiceCompany.kpp.trim(),
            legal_address: invoiceCompany.legal_address.trim(),
            bank_name: invoiceCompany.bank_name.trim(),
            bik: invoiceCompany.bik.trim(),
            checking_account: invoiceCompany.checking_account.trim(),
            correspondent_account: invoiceCompany.correspondent_account.trim(),
            phone: invoiceCompany.phone.trim() || orderClientPhone.trim(),
          }
        : {};

      const payload = {
        client_name: cleanedName,
        client_phone: orderClientPhone.trim() || cleanedCompanyDetails.phone || '',
        client_email: orderClientEmail.trim(),
        client_type: isBankTransfer ? 'legal' : 'individual',
        design_link: orderDesignLink.trim(),
        comment: orderComment.trim() || (hasKpAccess ? meta.comment?.trim() || '' : ''),
        discount_percent: hasKpAccess ? pricing.discountPercent : 0,
        discount_comment:
          hasKpAccess && pricing.discountPercent > 0 ? cleanedDiscountComment : '',
        payment_method: isBankTransfer ? 'bank_transfer' : paymentMethod,
        need_invoice: isBankTransfer,
        company_details: cleanedCompanyDetails,
        items,
      };

      const payloadJson = JSON.stringify(payload);
      if (!idempotencyRef.current || idempotencyRef.current.signature !== payloadJson) {
        const nextKey =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        idempotencyRef.current = { signature: payloadJson, key: nextKey };
      }

      const res = await apiFetch('/orders', {
        method: 'POST',
        token: authToken,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyRef.current.key,
        },
        body: payloadJson,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onCopySuccess(data?.error || 'Не удалось отправить заказ в работу');
        return;
      }

      idempotencyRef.current = null;
      if (onOrderCreated) {
        onOrderCreated(data as CrmOrder);
      } else {
        onClearAll();
        onCopySuccess(`Заказ №${data.id} успешно отправлен в работу!`);
      }
    } catch {
      onCopySuccess('Ошибка сети при оформлении заказа');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const startEditNote = (item: EstimateItem) => {
    setEditingNoteId(item.id);
    setDraftNote(item.customNote || '');
  };

  const saveEditNote = (id: string) => {
    if (onUpdateItemNote) {
      onUpdateItemNote(id, draftNote.trim());
    }
    setEditingNoteId(null);
  };

  const isPageMode = mode === 'page';

  if (items.length === 0) {
    if (!isPageMode) {
      return null;
    }

    return (
      <section
        id="estimate-order-panel"
        data-testid="estimate-panel"
        className="ui-no-print ui-estimate-card"
        aria-label="Корзина"
        style={{
          padding: '40px 24px',
          background: t.cardBg,
          borderRadius: 4,
          border: `1px solid ${t.border}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: t.text,
          }}
        >
          Ваша корзина пуста
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: t.subText,
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          Добавьте интересующие вас изделия из калькулятора, чтобы сформировать общий заказ.
        </p>
        {onContinueShopping && (
          <button
            type="button"
            data-testid="continue-shopping-btn"
            onClick={onContinueShopping}
            style={{
              marginTop: 6,
              padding: '10px 18px',
              borderRadius: 2,
              border: 'none',
              background: t.brandPrimary || 'var(--brand-primary)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: 'none',
            }}
          >
            ← Перейти в каталог
          </button>
        )}
      </section>
    );
  }

  const formattedDate = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <>
      <section
        id="estimate-order-panel"
        data-testid="estimate-panel"
        className="ui-no-print ui-estimate-card"
        aria-label="Корзина"
        style={{
          padding: isPageMode ? 24 : 0,
          background: isPageMode ? t.cardBg : 'transparent',
          borderRadius: isPageMode ? 4 : 0,
          border: isPageMode ? `1px solid ${t.border}` : 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: isPageMode ? 16 : 0,
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* Шапка корзины */}
        <div
          className={isPageMode ? undefined : 'ui-column-header-box'}
          style={
            isPageMode
              ? {
                  height: 'auto',
                  marginBottom: 0,
                  paddingBottom: 14,
                  borderBottom: `1px solid ${t.softBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  gap: 12,
                  boxSizing: 'border-box',
                }
              : {
                  paddingBottom: 2,
                  gap: 8,
                }
          }
        >
          {isPageMode && onContinueShopping && (
            <div>
              <button
                type="button"
                data-testid="continue-shopping-btn"
                onClick={onContinueShopping}
                style={{
                  padding: '6px 12px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: t.subCardBg,
                  color: t.text,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ← Продолжить покупки
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: isPageMode ? 22 : 15,
                fontWeight: 700,
                color: t.text,
                lineHeight: 1.25,
              }}
            >
              {isSharedView
                ? `Общая корзина по ссылке (${items.length})`
                : `Корзина (${items.length})`}
            </h2>

            {isSharedView ? (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  data-testid="add-all-shared-btn"
                  onClick={() => onAddAllSharedToMyCart?.()}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 2,
                    border: 'none',
                    background: '#C02721',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: 'none',
                  }}
                >
                  + Добавить всё в мою корзину
                </button>
                {onOpenOwnCart && (
                  <button
                    type="button"
                    data-testid="open-own-cart-btn"
                    onClick={onOpenOwnCart}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: t.subCardBg,
                      color: t.text,
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Моя корзина ({ownCartCount ?? 0})
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                data-testid="clear-estimate-btn"
                onClick={onClearAll}
                style={{
                  padding: isPageMode ? '6px 12px' : '4px 9px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: 'transparent',
                  color: t.subText,
                  fontWeight: 500,
                  fontSize: isPageMode ? 12.5 : 11.5,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Очистить корзину"
              >
                Очистить
              </button>
            )}
          </div>

          {isSharedView && (
            <div
              data-testid="shared-cart-banner"
              style={{
                padding: '10px 12px',
                borderRadius: 2,
                background: t.selectedBg,
                border: `1px solid ${t.selectedBorder}`,
                color: t.selectedText,
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: 1.45,
              }}
            >
              Просмотр расчёта по ссылке. Вы можете добавить в свою корзину отдельные позиции или весь заказ целиком.
            </div>
          )}

          {/* Компактный блок скидки — только для менеджера и администратора */}
          {isPageMode && hasKpAccess && !isSharedView && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {pricing.discountPercent > 0 && !isDiscountFormOpen && (
                <div
                  data-testid="estimate-discount-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignSelf: 'flex-start',
                    padding: '4px 10px',
                    borderRadius: 2,
                    fontSize: 12,
                    background: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                    border: '1px solid #10B981',
                    color: t.text,
                  }}
                >
                  <div
                    onClick={() => {
                      setDraftDiscountPercent(pricing.discountPercent);
                      setDraftDiscountComment(meta.discountComment || '');
                      setIsDiscountFormOpen(true);
                    }}
                    title="Изменить скидку"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: isDark ? '#34D399' : '#047857' }}>
                      Скидка −{pricing.discountPercent}% (−{pricing.discountAmount.toLocaleString('ru-RU')} ₽):
                    </span>
                    {meta.discountComment && <span>{meta.discountComment}</span>}
                    {userFullName && (
                      <span style={{ color: t.subText, fontSize: 11.5 }}>
                        ({userFullName})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid="estimate-clear-discount-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMeta((prev) => ({ ...prev, discountPercent: 0, discountComment: '' }));
                      setDraftDiscountPercent(0);
                      setDraftDiscountComment('');
                      setIsDiscountFormOpen(false);
                      onCopySuccess('Скидка удалена');
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 2,
                      border: 'none',
                      background: isDark ? 'rgba(16, 185, 129, 0.24)' : '#D1FAE5',
                      color: isDark ? '#34D399' : '#047857',
                      fontWeight: 700,
                      fontSize: 13,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 4,
                      padding: 0,
                    }}
                    title="Удалить скидку"
                  >
                    ×
                  </button>
                </div>
              )}

              {pricing.discountPercent <= 0 && !isDiscountFormOpen && (
                <button
                  type="button"
                  data-testid="toggle-estimate-discount-btn"
                  onClick={() => {
                    setDraftDiscountPercent(meta.discountPercent || 0);
                    setDraftDiscountComment(meta.discountComment || '');
                    setIsDiscountFormOpen(true);
                  }}
                  style={{
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 2,
                    border: `1px dashed ${t.border}`,
                    background: t.subCardBg,
                    color: t.text,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Добавить скидку
                </button>
              )}

              {isDiscountFormOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
                    Скидка (%):
                  </span>
                  <input
                    type="number"
                    data-testid="estimate-discount-input"
                    min={0}
                    max={100}
                    value={draftDiscountPercent}
                    onChange={(e) => {
                      const nextDisc = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setDraftDiscountPercent(nextDisc);
                    }}
                    style={{
                      width: 68,
                      height: 30,
                      padding: '0 8px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: t.inputBg,
                      color: t.text,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'right',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="text"
                    data-testid="estimate-discount-comment-input"
                    value={draftDiscountComment}
                    placeholder="Причина скидки (обязательно)..."
                    onChange={(e) => setDraftDiscountComment(e.target.value)}
                    style={{
                      width: 240,
                      height: 30,
                      padding: '0 8px',
                      borderRadius: 2,
                      border:
                        draftDiscountPercent > 0 && !draftDiscountComment.trim()
                          ? '1px solid #C02721'
                          : `1px solid ${t.border}`,
                      background: t.inputBg,
                      color: t.text,
                      fontSize: 12,
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    data-testid="estimate-apply-discount-btn"
                    onClick={() => {
                      const nextDisc = Math.max(
                        0,
                        Math.min(100, Number(draftDiscountPercent) || 0)
                      );
                      const nextComment = draftDiscountComment.trim();
                      if (nextDisc > 0 && !nextComment) {
                        onCopySuccess('Укажите комментарий: почему предоставляется скидка');
                        return;
                      }
                      setMeta((prev) => ({
                        ...prev,
                        discountPercent: nextDisc,
                        discountComment: nextDisc > 0 ? nextComment : '',
                      }));
                      setIsDiscountFormOpen(false);
                      onCopySuccess(nextDisc > 0 ? 'Скидка применена' : 'Скидка сброшена');
                    }}
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: t.subCardBg,
                      color: t.text,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Применить скидку
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDiscountFormOpen(false)}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: t.subText,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Список карточек позиций */}
        <div
          className="ui-estimate-items-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isPageMode ? 10 : 8,
            maxHeight: isPageMode ? 'none' : 'calc(100vh - 240px)',
            overflowY: isPageMode ? 'visible' : 'auto',
            paddingRight: isPageMode ? 0 : 2,
          }}
        >
          {items.map((item, idx) => {
            const title = item.categoryName
              ? `${item.categoryName} — ${item.productName}`
              : item.productName;
            const matMeta = getMaterialFieldMeta(item.mainCategoryId);
            const hasPaperLine =
              item.showPaper !== false &&
              Boolean(item.paperLabel) &&
              item.paperLabel !== 'По спецификации изделия';
            const hasPrintLine =
              item.showPrint !== false &&
              Boolean(item.printLabel) &&
              item.printLabel !== 'Без печати';
            const hasLamLine =
              item.showLamination !== false &&
              Boolean(item.laminationLabel) &&
              item.laminationLabel !== 'Нет';

            return (
              <div
                key={item.id}
                data-testid="estimate-item-row"
                style={{
                  background: t.cardBg,
                  border: !isPageMode && isHighlighted
                    ? `1px solid ${isDark ? '#E54D47' : '#C02721'}`
                    : `1px solid ${t.border}`,
                  borderRadius: 3,
                  padding: isPageMode ? '12px 14px' : '10px 11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: isPageMode ? 14 : 13,
                      fontWeight: 700,
                      color: t.text,
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                      flex: 1,
                    }}
                  >
                    {idx + 1}. {title}
                  </div>

                  {isSharedView ? (
                    <button
                      type="button"
                      data-testid={`add-shared-item-${idx}`}
                      onClick={() => onAddSharedItemToMyCart?.(item)}
                      style={{
                        border: `1px solid ${t.selectedBorder}`,
                        background: t.selectedBg,
                        color: t.selectedText,
                        fontWeight: 600,
                        fontSize: 11.5,
                        padding: '4px 10px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + В мою корзину
                    </button>
                  ) : (
                    <div style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                      {onUpdateItemNote && (
                        <button
                          type="button"
                          data-testid={`edit-estimate-note-${idx}`}
                          onClick={() => startEditNote(item)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 2,
                            border: `1px solid ${t.border}`,
                            background: t.cardBg,
                            color: t.subText,
                            cursor: 'pointer',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Добавить / изменить примечание к позиции"
                        >
                          ✎
                        </button>
                      )}

                      {onDuplicateItem && (
                        <button
                          type="button"
                          data-testid={`duplicate-estimate-item-${idx}`}
                          onClick={() => onDuplicateItem(item.id)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 2,
                            border: `1px solid ${t.border}`,
                            background: t.cardBg,
                            color: t.subText,
                            cursor: 'pointer',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Дублировать позицию в корзине"
                        >
                          ⧉
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`remove-estimate-item-${idx}`}
                        aria-label="Удалить позицию"
                        onClick={() => onRemoveItem(item.id)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                          color: isDark ? '#FCA5A5' : '#DC2626',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 13,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                        }}
                        title="Удалить позицию из корзины"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {!isSharedView && editingNoteId === item.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="text"
                      data-testid={`estimate-note-input-${idx}`}
                      value={draftNote}
                      placeholder="Примечание к позиции (макет, вид и т.д.)"
                      onChange={(e) => setDraftNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditNote(item.id);
                        if (e.key === 'Escape') setEditingNoteId(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '4px 7px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 11.5,
                      }}
                    />
                    <button
                      type="button"
                      data-testid={`save-estimate-note-${idx}`}
                      onClick={() => saveEditNote(item.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 2,
                        border: 'none',
                        background: t.brandPrimary || 'var(--brand-primary)',
                        color: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ОК
                    </button>
                  </div>
                ) : (
                  item.customNote && (
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.selectedText,
                        background: t.selectedBg,
                        padding: '3px 7px',
                        borderRadius: 2,
                      }}
                    >
                      💬 {item.customNote}
                    </div>
                  )
                )}

                <div
                  style={{
                    fontSize: isPageMode ? 12.5 : 11.5,
                    color: t.subText,
                    lineHeight: 1.4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span>
                    {item.formatLabel}
                    {item.pagesLabel ? ` (${item.pagesLabel})` : ''}
                    {hasPaperLine ? ` • ${matMeta.quoteTitle}: ${item.paperLabel}` : ''}
                  </span>
                  {(hasPrintLine || hasLamLine) && (
                    <span>
                      {hasPrintLine
                        ? `${item.mainCategoryId === 'souvenirs' ? 'Нанесение' : 'Печать'}: ${item.printLabel}`
                        : ''}
                      {hasPrintLine && hasLamLine ? ' • ' : ''}
                      {hasLamLine ? `Лам.: ${item.laminationLabel}` : ''}
                    </span>
                  )}
                  {item.extraParamsLabel && item.extraParamsLabel !== 'Нет' && (
                    <span>Доп.: {item.extraParamsLabel}</span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    paddingTop: 5,
                    borderTop: `1px dashed ${t.softBorder}`,
                  }}
                >
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: isPageMode ? 12.5 : 11.5,
                      color: t.subText,
                    }}
                  >
                    {item.quantity.toLocaleString('ru-RU')} шт. ×{' '}
                    {item.unitPrice.toLocaleString('ru-RU')} ₽/шт.
                  </span>

                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: isPageMode ? 15 : 13.5,
                      fontWeight: 800,
                      color: t.text,
                    }}
                  >
                    {item.totalPrice.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Нижняя панель */}
        <div
          style={{
            marginTop: isPageMode ? 0 : 12,
            paddingTop: 10,
            borderTop: `1px solid ${t.softBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {pricing.discountPercent > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: isPageMode ? 12.5 : 11.5,
                  color: t.subText,
                }}
              >
                <span>Сумма без скидки:</span>
                <span className="tabular-nums">{pricing.subtotal.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: isPageMode ? 12.5 : 11.5,
                  color: isDark ? '#4ADE80' : '#16A34A',
                  fontWeight: 600,
                }}
              >
                <span>Скидка ({pricing.discountPercent}%):</span>
                <span className="tabular-nums">
                  −{pricing.discountAmount.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: isPageMode ? 13.5 : 12, color: t.subText }}>
              Итого ({items.length} поз.):
            </span>
            <span
              data-testid="estimate-final-total"
              className="tabular-nums"
              style={{ fontSize: isPageMode ? 18 : 16, fontWeight: 800, color: t.text }}
            >
              {pricing.finalTotal.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {isPageMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
              {isSharedView ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    data-testid="add-all-shared-footer-btn"
                    onClick={() => onAddAllSharedToMyCart?.()}
                    style={{
                      flex: '1 1 240px',
                      padding: '11px 18px',
                      borderRadius: 2,
                      border: 'none',
                      background: '#C02721',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: 'none',
                    }}
                  >
                    + Добавить весь заказ в мою корзину ({items.length} поз.)
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      data-testid="copy-cart-link-btn"
                      onClick={handleCopyCartLinkOnly}
                      style={{
                        flex: '1 1 200px',
                        padding: '10px 16px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.subCardBg,
                        color: t.text,
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: 'pointer',
                      }}
                    >
                      Скопировать ссылку на корзину
                    </button>

                    {hasKpAccess && (
                      <button
                        type="button"
                        data-testid="print-estimate-btn"
                        onClick={handlePrintKp}
                        style={{
                          flex: '1 1 200px',
                          padding: '10px 16px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: t.subCardBg,
                          color: t.text,
                          fontWeight: 600,
                          fontSize: 13.5,
                          cursor: 'pointer',
                        }}
                      >
                        Сохранить КП в PDF / Печать
                      </button>
                    )}
                  </div>

                  {/* Блок «Оформить заказ» с отправкой в CRM */}
                  {!currentUser || !authToken ? (
                <div
                  data-testid="checkout-auth-required"
                  style={{
                    padding: 18,
                    borderRadius: 3,
                    background: t.subCardBg,
                    border: `1px solid ${t.border}`,
                    borderLeft: '4px solid #C02721',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: t.text }}>
                      Оформление заказа доступно после входа в аккаунт
                    </h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: t.subText, lineHeight: 1.45 }}>
                      Войдите в свой аккаунт или зарегистрируйтесь — все позиции в корзине сохранятся, а после отправки вы сможете отслеживать статус заказа и скачать счёт в личном кабинете.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      data-testid="checkout-login-btn"
                      onClick={() => onNavigateToLogin?.()}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#C02721',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: 'pointer',
                        boxShadow: 'none',
                      }}
                    >
                      Войти в аккаунт
                    </button>
                    <button
                      type="button"
                      data-testid="checkout-register-btn"
                      onClick={() =>
                        onNavigateToRegister ? onNavigateToRegister() : onNavigateToLogin?.()
                      }
                      style={{
                        padding: '10px 18px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.cardBg,
                        color: t.text,
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: 'pointer',
                      }}
                    >
                      Регистрация
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitOrder}
                  data-testid="checkout-order-form"
                  style={{
                    padding: 18,
                    borderRadius: 3,
                    background: t.subCardBg,
                    border: `1px solid ${t.border}`,
                    borderLeft: '4px solid #C02721',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: t.text }}>
                      {isStaffOrderCreator
                        ? 'Оформление заказа клиента (менеджер)'
                        : 'Оформить заказ в типографии'}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: t.subText }}>
                      {isStaffOrderCreator
                        ? 'Укажите контакты заказчика, тип плательщика и параметры заказа для передачи в работу.'
                        : 'Заполните контактные данные и приложите ссылку на макет.'}
                    </p>
                  </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.subText,
                        marginBottom: 4,
                      }}
                    >
                      Имя *
                    </label>
                    <input
                      type="text"
                      required={
                        !(canUseBankTransfer && paymentMethod === 'bank_transfer') ||
                        !invoiceCompany.company_name.trim()
                      }
                      data-testid="checkout-name-input"
                      value={orderClientName}
                      onChange={(e) => setOrderClientName(e.target.value)}
                      placeholder="Иван Иванов"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.subText,
                        marginBottom: 4,
                      }}
                    >
                      Телефон
                    </label>
                    <input
                      type="tel"
                      data-testid="checkout-phone-input"
                      value={orderClientPhone}
                      onChange={(e) => setOrderClientPhone(e.target.value)}
                      placeholder="+7 (999) 000-00-00"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.subText,
                        marginBottom: 4,
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      data-testid="checkout-email-input"
                      value={orderClientEmail}
                      onChange={(e) => setOrderClientEmail(e.target.value)}
                      placeholder="client@example.com"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.subText,
                        marginBottom: 4,
                      }}
                    >
                      Ссылка на макет (Яндекс.Диск / Облако)
                    </label>
                    <input
                      type="text"
                      data-testid="checkout-design-link-input"
                      value={orderDesignLink}
                      onChange={(e) => setOrderDesignLink(e.target.value)}
                      placeholder="https://disk.yandex.ru/..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.subText,
                        marginBottom: 4,
                      }}
                    >
                      Комментарий к заказу
                    </label>
                    <input
                      type="text"
                      data-testid="checkout-comment-input"
                      value={orderComment}
                      onChange={(e) => setOrderComment(e.target.value)}
                      placeholder="Срок, доставка, пожелания к печати..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Способ оплаты и реквизиты компании при безналичном расчёте */}
                <div
                  style={{
                    paddingTop: 10,
                    borderTop: `1px dashed ${t.softBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: t.text,
                        marginBottom: 6,
                      }}
                    >
                      Способ оплаты
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        data-testid="checkout-payment-cash"
                        onClick={() => setPaymentMethod('cash')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 2,
                          border:
                            paymentMethod === 'cash'
                              ? '1px solid #C02721'
                              : `1px solid ${t.border}`,
                          background: paymentMethod === 'cash' ? '#C02721' : t.cardBg,
                          color: paymentMethod === 'cash' ? '#FFFFFF' : t.text,
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        Наличные
                      </button>
                      <button
                        type="button"
                        data-testid="checkout-payment-card"
                        onClick={() => setPaymentMethod('card_on_delivery')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 2,
                          border:
                            paymentMethod === 'card_on_delivery'
                              ? '1px solid #C02721'
                              : `1px solid ${t.border}`,
                          background:
                            paymentMethod === 'card_on_delivery' ? '#C02721' : t.cardBg,
                          color: paymentMethod === 'card_on_delivery' ? '#FFFFFF' : t.text,
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        Картой при получении
                      </button>
                      {canUseBankTransfer && (
                        <button
                          type="button"
                          data-testid="checkout-payment-bank-transfer"
                          onClick={() => setPaymentMethod('bank_transfer')}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 2,
                            border:
                              paymentMethod === 'bank_transfer'
                                ? '1px solid #C02721'
                                : `1px solid ${t.border}`,
                            background:
                              paymentMethod === 'bank_transfer' ? '#C02721' : t.cardBg,
                            color: paymentMethod === 'bank_transfer' ? '#FFFFFF' : t.text,
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          Безналичный расчёт
                        </button>
                      )}
                    </div>
                  </div>

                  {canUseBankTransfer && paymentMethod === 'bank_transfer' && (
                    <EstimateCompanyFields
                      invoiceCompany={invoiceCompany}
                      setInvoiceCompany={setInvoiceCompany}
                      isDark={isDark}
                      theme={t}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  data-testid="submit-order-btn"
                  disabled={isSubmittingOrder}
                  style={
                    isStaffOrderCreator
                      ? {
                          padding: '11px 18px',
                          borderRadius: 2,
                          border: `1px solid ${isDark ? '#34D399' : '#059669'}`,
                          background: isDark ? '#065F46' : '#059669',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: isSubmittingOrder ? 'wait' : 'pointer',
                          boxShadow: 'none',
                        }
                      : {
                          padding: '11px 18px',
                          borderRadius: 2,
                          border: 'none',
                          background: '#C02721',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: isSubmittingOrder ? 'wait' : 'pointer',
                          boxShadow: 'none',
                        }
                  }
                >
                  {isSubmittingOrder
                    ? 'Отправка заказа...'
                    : isStaffOrderCreator
                    ? paymentMethod === 'bank_transfer'
                      ? 'Создать заказ юр. лица в CRM (со счётом)'
                      : 'Создать заказ клиента в CRM'
                    : 'Отправить заказ в работу'}
                </button>
              </form>
              )}
              </>
              )}
            </div>
          ) : (
            onOpenCartPage && (
              <button
                type="button"
                data-testid="open-cart-page-btn"
                onClick={onOpenCartPage}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 2,
                  border: 'none',
                  background: t.brandPrimary || 'var(--brand-primary)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  boxShadow: 'none',
                }}
              >
                Перейти в корзину →
              </button>
            )
          )}
        </div>
      </section>

      {/* Печатная версия КП (@media print) — только на странице корзины и только для менеджера/администратора */}
      {isPageMode && hasKpAccess && (
        <EstimatePrintableKp
          items={items}
          formattedDate={formattedDate}
          orderClientName={orderClientName}
          orderComment={orderComment}
          meta={meta}
          invoiceCompany={invoiceCompany}
          resolvedManagerName={resolvedManagerName}
          resolvedManagerPhone={resolvedManagerPhone}
          resolvedManagerEmail={resolvedManagerEmail}
          pricing={pricing}
        />
      )}
    </>
  );
}

