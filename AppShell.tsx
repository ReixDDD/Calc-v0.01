import React from 'react';

type AppShellProps = {
  isDark: boolean;
  textColor: string;
  children: React.ReactNode;
};

export default function AppShell({ isDark, textColor, children }: AppShellProps) {
  return (
    <div data-theme={isDark ? 'dark' : 'light'} style={{ color: textColor }}>
      {children}
    </div>
  );
}
