import React, { useEffect, useMemo, useState } from 'react';

export interface ThemeTokens {
  readonly pageBg: string;
  readonly cardBg: string;
  readonly subCardBg: string;
  readonly elevatedBg: string;
  readonly text: string;
  readonly subText: string;
  readonly mutedText: string;
  readonly border: string;
  readonly softBorder: string;
  readonly inputBg: string;
  readonly inputText: string;
  readonly selectedBg: string;
  readonly selectedBorder: string;
  readonly selectedText: string;
  readonly tableHeaderBg: string;
  readonly secondaryBtnBg: string;
  readonly secondaryBtnText: string;
  readonly activeTabBg: string;
  readonly activeTabText: string;
  readonly inactiveTabBg: string;
  readonly inactiveTabText: string;
  readonly clientInputBg: string;
  readonly clientInputBorder: string;
  readonly infoBoxBg: string;
  readonly infoBoxBorder: string;
  readonly shadow: string;
  readonly brandPrimary: string;
  readonly brandHover: string;
  readonly brandText: string;
  readonly [key: string]: string;
}

export function buildTheme(isDark: boolean): ThemeTokens {
  return {
    pageBg: isDark ? '#121316' : '#F8FAFC',
    cardBg: isDark ? '#1E2024' : '#FFFFFF',
    subCardBg: isDark ? '#282B30' : '#F1F5F9',
    elevatedBg: isDark ? '#1E2024' : '#FFFFFF',
    text: isDark ? '#F1F5F9' : '#0F172A',
    subText: isDark ? '#94A3B8' : '#475569',
    mutedText: isDark ? '#94A3B8' : '#475569',
    border: isDark ? '#454A54' : '#CBD5E1',
    softBorder: isDark ? '#32363E' : '#E2E8F0',
    inputBg: isDark ? '#1E2024' : '#FFFFFF',
    inputText: isDark ? '#F1F5F9' : '#0F172A',
    selectedBg: isDark ? '#2C1517' : '#FEF2F2',
    selectedBorder: isDark ? '#E54D47' : '#C02721',
    selectedText: isDark ? '#E54D47' : '#C02721',
    tableHeaderBg: isDark ? '#282B30' : '#F1F5F9',
    secondaryBtnBg: isDark ? '#282B30' : '#F1F5F9',
    secondaryBtnText: isDark ? '#F1F5F9' : '#0F172A',
    activeTabBg: '#C02721',
    activeTabText: '#FFFFFF',
    inactiveTabBg: isDark ? '#282B30' : '#FFFFFF',
    inactiveTabText: isDark ? '#F1F5F9' : '#0F172A',
    clientInputBg: isDark ? '#2C1517' : '#FEF2F2',
    clientInputBorder: isDark ? '#5C1F22' : '#FECACA',
    infoBoxBg: isDark ? '#2C1517' : '#FEF2F2',
    infoBoxBorder: isDark ? '#5C1F22' : '#FECACA',
    shadow: 'none',
    brandPrimary: '#C02721',
    brandHover: isDark ? '#D93832' : '#9E1E19',
    brandText: isDark ? '#E54D47' : '#C02721',
  };
}

export function buildInputStyle(t: ThemeTokens | Record<string, string>): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 2,
    fontSize: 13,
    border: `1px solid ${t.border}`,
    background: t.inputBg,
    color: t.inputText,
    boxSizing: 'border-box',
  };
}

export function buildSmallInputStyle(t: ThemeTokens | Record<string, string>): React.CSSProperties {
  return {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 2,
    fontSize: 12.5,
    border: `1px solid ${t.border}`,
    background: t.inputBg,
    color: t.inputText,
    boxSizing: 'border-box',
  };
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved === 'dark';
    }
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const mode = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = mode;
  }, [isDark]);

  const t = useMemo(() => buildTheme(isDark), [isDark]);
  const inputStyle = useMemo(() => buildInputStyle(t), [t]);
  const smallInputStyle = useMemo(() => buildSmallInputStyle(t), [t]);

  return {
    isDark,
    setIsDark,
    t,
    inputStyle,
    smallInputStyle,
  };
}
