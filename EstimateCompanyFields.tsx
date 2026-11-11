import React from 'react';
import { CompanyDetails } from '../types';

interface EstimateCompanyFieldsProps {
  invoiceCompany: Required<CompanyDetails>;
  setInvoiceCompany: React.Dispatch<React.SetStateAction<Required<CompanyDetails>>>;
  isDark: boolean;
  theme: Record<string, string>;
}

export default function EstimateCompanyFields({
  invoiceCompany,
  setInvoiceCompany,
  isDark,
  theme: t,
}: EstimateCompanyFieldsProps) {
  const baseFieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 9px',
    borderRadius: 2,
    border: `1px solid ${t.border}`,
    background: t.inputBg,
    color: t.text,
    fontSize: 12.5,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 600,
    color: t.subText,
    marginBottom: 4,
  };

  return (
    <div
      data-testid="staff-company-details-fields"
      style={{
        padding: 12,
        borderRadius: 2,
        background: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4',
        border: `1px solid ${isDark ? '#10B981' : '#A7F3D0'}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
      }}
    >
      <div>
        <label style={labelStyle}>Наименование компании / ИП *</label>
        <input
          type="text"
          data-testid="staff-company-name-input"
          value={invoiceCompany.company_name}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              company_name: e.target.value,
            }))
          }
          placeholder="ООО «Альфа»"
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>ИНН *</label>
        <input
          type="text"
          data-testid="staff-company-inn-input"
          value={invoiceCompany.inn}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              inn: e.target.value,
            }))
          }
          placeholder="7701234567"
          style={{
            ...baseFieldStyle,
            border: `1px solid ${invoiceCompany.inn.trim() ? t.border : '#C02721'}`,
          }}
        />
      </div>

      <div>
        <label style={labelStyle}>КПП</label>
        <input
          type="text"
          data-testid="staff-company-kpp-input"
          value={invoiceCompany.kpp}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              kpp: e.target.value,
            }))
          }
          placeholder="770101001"
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Юридический адрес</label>
        <input
          type="text"
          data-testid="staff-company-address-input"
          value={invoiceCompany.legal_address}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              legal_address: e.target.value,
            }))
          }
          placeholder="г. Москва, ул. Примерная, д. 1"
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Наименование банка</label>
        <input
          type="text"
          data-testid="staff-company-bank-input"
          value={invoiceCompany.bank_name}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              bank_name: e.target.value,
            }))
          }
          placeholder="ПАО Сбербанк"
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>БИК</label>
        <input
          type="text"
          data-testid="staff-company-bik-input"
          value={invoiceCompany.bik}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              bik: e.target.value,
            }))
          }
          placeholder="044525225"
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Расчётный счёт (Р/С)</label>
        <input
          type="text"
          data-testid="staff-company-checking-input"
          value={invoiceCompany.checking_account}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              checking_account: e.target.value,
            }))
          }
          placeholder="40702810..."
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Корр. счёт (К/С)</label>
        <input
          type="text"
          data-testid="staff-company-correspondent-input"
          value={invoiceCompany.correspondent_account}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              correspondent_account: e.target.value,
            }))
          }
          placeholder="30101810..."
          style={baseFieldStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Телефон компании</label>
        <input
          type="tel"
          data-testid="staff-company-phone-input"
          value={invoiceCompany.phone}
          onChange={(e) =>
            setInvoiceCompany((prev) => ({
              ...prev,
              phone: e.target.value,
            }))
          }
          placeholder="+7 (495) 000-00-00"
          style={baseFieldStyle}
        />
      </div>
    </div>
  );
}
