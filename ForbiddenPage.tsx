import React from 'react';
import { AuthUser, MainCategory } from '../types';

export interface ForbiddenPageProps {
  mainCategories: MainCategory[];
  currentUser?: AuthUser | null;
  isDark: boolean;
  theme: Record<string, string>;
  onResetToHome: () => void;
  onSelectMainCategory: (mainCategoryId: string) => void;
  onNavigateToLogin?: () => void;
  onNavigateToProfile?: () => void;
}

export default function ForbiddenPage({
  mainCategories,
  currentUser,
  isDark,
  theme: t,
  onResetToHome,
  onSelectMainCategory,
  onNavigateToLogin,
  onNavigateToProfile,
}: ForbiddenPageProps) {
  return (
    <div
      data-testid="forbidden-page"
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 360,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 22px',
          borderRadius: 2,
          background: isDark ? '#2C1517' : '#FEF2F2',
          border: `1px solid ${isDark ? '#5C1F22' : '#FECACA'}`,
          color: isDark ? '#E54D47' : '#C02721',
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: '0.04em',
          lineHeight: 1.1,
          marginBottom: 18,
          boxShadow: 'none',
        }}
      >
        403
      </div>

      <h1
        style={{
          margin: '0 0 10px 0',
          fontSize: 24,
          fontWeight: 800,
          color: t.text,
        }}
      >
        Доступ к разделу ограничен
      </h1>

      <p
        style={{
          margin: '0 0 26px 0',
          maxWidth: 520,
          fontSize: 14.5,
          lineHeight: 1.55,
          color: t.subText,
        }}
      >
        {currentUser
          ? `У вашего аккаунта (${currentUser.name}) недостаточно прав для просмотра этой страницы. Перейдите в каталог продукции или в личный кабинет.`
          : 'Этот раздел предназначен только для сотрудников типографии с соответствующими правами доступа. Войдите в служебный аккаунт или вернитесь в каталог продукции.'}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <button
          type="button"
          data-testid="forbidden-home-btn"
          onClick={onResetToHome}
          className="btn-primary"
          style={{
            padding: '11px 22px',
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
          ← Перейти во все категории
        </button>

        {!currentUser && onNavigateToLogin && (
          <button
            type="button"
            data-testid="forbidden-login-btn"
            onClick={onNavigateToLogin}
            className="ui-action-btn"
            style={{
              padding: '11px 20px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Войти в аккаунт
          </button>
        )}

        {currentUser && onNavigateToProfile && (
          <button
            type="button"
            data-testid="forbidden-profile-btn"
            onClick={onNavigateToProfile}
            className="ui-action-btn"
            style={{
              padding: '11px 20px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Личный кабинет
          </button>
        )}
      </div>

      {mainCategories.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: 680,
            paddingTop: 22,
            borderTop: `1px solid ${t.softBorder}`,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: t.subText,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Доступные разделы каталога
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {mainCategories.map((mc) => (
              <button
                key={mc.id}
                type="button"
                className="ui-action-btn"
                onClick={() => onSelectMainCategory(mc.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: t.subCardBg,
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
