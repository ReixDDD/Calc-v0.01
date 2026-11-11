import React from 'react';
import { CompanyDetails, EstimateHeaderMeta, EstimateItem } from '../types';
import { getMaterialFieldMeta } from '../calculatorUtils';

interface EstimatePrintableKpProps {
  items: EstimateItem[];
  formattedDate: string;
  orderClientName: string;
  orderComment: string;
  meta: EstimateHeaderMeta;
  invoiceCompany: Required<CompanyDetails>;
  resolvedManagerName: string;
  resolvedManagerPhone: string;
  resolvedManagerEmail: string;
  pricing: {
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    finalTotal: number;
  };
}

export default function EstimatePrintableKp({
  items,
  formattedDate,
  orderClientName,
  orderComment,
  meta,
  invoiceCompany,
  resolvedManagerName,
  resolvedManagerPhone,
  resolvedManagerEmail,
  pricing,
}: EstimatePrintableKpProps) {
  return (
    <div className="ui-print-only-kp" aria-hidden="true">
      <div className="ui-print-kp-header">
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 22 }}>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Расчёт стоимости продукции от {formattedDate}
          </div>
          {(orderClientName.trim() || meta.customerName?.trim()) && (
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: '#0F172A' }}>
              Заказчик: {orderClientName.trim() || meta.customerName?.trim()}
            </div>
          )}
          {(invoiceCompany.company_name || invoiceCompany.inn) && (
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3, color: '#0F172A' }}>
              Плательщик (Заказчик):{' '}
              {invoiceCompany.company_name ||
                orderClientName.trim() ||
                meta.customerName?.trim() ||
                '—'}
              {invoiceCompany.inn ? `, ИНН ${invoiceCompany.inn}` : ''}
              {invoiceCompany.kpp ? `, КПП ${invoiceCompany.kpp}` : ''}
            </div>
          )}
          {(orderComment.trim() || meta.comment?.trim()) && (
            <div style={{ fontSize: 12.5, marginTop: 2, color: '#334155' }}>
              Условия / комментарий: {orderComment.trim() || meta.comment?.trim()}
            </div>
          )}
          {(resolvedManagerName || resolvedManagerPhone || resolvedManagerEmail) && (
            <div
              data-testid="kp-print-manager-contacts"
              style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: '#0F172A' }}
            >
              Менеджер проекта: {resolvedManagerName || '—'} | Тел.: {resolvedManagerPhone || '—'} |
              Email: {resolvedManagerEmail || '—'}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
          Позиций: {items.length}
        </div>
      </div>

      <table className="ui-print-kp-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>№</th>
            <th>Наименование и параметры изделия</th>
            <th style={{ width: 95, textAlign: 'right' }}>Тираж</th>
            <th style={{ width: 105, textAlign: 'right' }}>Цена за шт.</th>
            <th style={{ width: 120, textAlign: 'right' }}>Стоимость</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const title = item.categoryName
              ? `${item.categoryName} — ${item.productName}`
              : item.productName;
            const matMeta = getMaterialFieldMeta(item.mainCategoryId);
            const detailParts: string[] = [
              `Формат: ${item.formatLabel}${item.pagesLabel ? ` (${item.pagesLabel})` : ''}`,
            ];
            if (
              item.showPaper !== false &&
              item.paperLabel &&
              item.paperLabel !== 'По спецификации изделия'
            ) {
              detailParts.push(`${matMeta.quoteTitle}: ${item.paperLabel}`);
            }
            if (item.showPrint !== false && item.printLabel && item.printLabel !== 'Без печати') {
              const printTitle =
                item.mainCategoryId === 'souvenirs' ? 'Нанесение принта' : 'Печать';
              detailParts.push(`${printTitle}: ${item.printLabel}`);
            }
            if (
              item.showLamination !== false &&
              item.laminationLabel &&
              item.laminationLabel !== 'Нет'
            ) {
              detailParts.push(`Ламинация: ${item.laminationLabel}`);
            }
            if (item.extraParamsLabel && item.extraParamsLabel !== 'Нет') {
              detailParts.push(`Доп. работы: ${item.extraParamsLabel}`);
            }

            return (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{title}</div>
                  {item.customNote && item.customNote.trim() && (
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 2 }}>
                      Примечание: {item.customNote.trim()}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.4 }}>
                    {detailParts.join(' • ')}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {item.quantity.toLocaleString('ru-RU')} шт.
                </td>
                <td style={{ textAlign: 'right' }}>{item.unitPrice.toLocaleString('ru-RU')} ₽</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {item.totalPrice.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {pricing.discountPercent > 0 && (
            <>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  Сумма без скидки:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  {pricing.subtotal.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  Скидка ({pricing.discountPercent}%):
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  −{pricing.discountAmount.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            </>
          )}
          <tr>
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
              {pricing.discountPercent > 0
                ? `ИТОГО К ОПЛАТЕ (${items.length} поз.):`
                : `ИТОГО ПО СМЕТЕ (${items.length} поз.):`}
            </td>
            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15 }}>
              {pricing.finalTotal.toLocaleString('ru-RU')} ₽
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
