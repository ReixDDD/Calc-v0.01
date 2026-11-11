import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthUser } from '../types';
import { apiFetch } from '../apiClient';

const RECAPTCHA_SITE_KEY =
  (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY ||
  '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

declare global {
  interface Window {
    grecaptcha?: {
      ready?: (cb: () => void) => void;
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: 'light' | 'dark';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

interface AuthPageProps {
  mode: 'login' | 'register';
  onSwitchMode: (nextMode: 'login' | 'register') => void;
  onAuthSuccess: (token: string, user: AuthUser) => void;
  onCancel?: () => void;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
}

export default function AuthPage({
  mode,
  onSwitchMode,
  onAuthSuccess,
  onCancel,
  isDark,
  theme: t,
  inputStyle,
}: AuthPageProps) {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [scriptFailed, setScriptFailed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
    if (
      !scriptFailed &&
      widgetIdRef.current !== null &&
      typeof window !== 'undefined' &&
      window.grecaptcha &&
      typeof window.grecaptcha.reset === 'function'
    ) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
      } catch {
        // ignore widget reset errors when DOM node is re-created
      }
    }
  }, [scriptFailed]);

  useEffect(() => {
    setErrorMessage(null);
    setCaptchaToken('');
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    setCaptchaToken('');
    widgetIdRef.current = null;

    const mountWidget = () => {
      if (cancelled || !recaptchaContainerRef.current) return;
      if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') {
        return false;
      }
      try {
        recaptchaContainerRef.current.innerHTML = '';
        const id = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          theme: isDark ? 'dark' : 'light',
          callback: (token: string) => {
            if (!cancelled) {
              setCaptchaToken(token);
              setErrorMessage(null);
            }
          },
          'expired-callback': () => {
            if (!cancelled) {
              setCaptchaToken('');
            }
          },
          'error-callback': () => {
            if (!cancelled) {
              setScriptFailed(true);
            }
          },
        });
        widgetIdRef.current = id;
        setScriptFailed(false);
        return true;
      } catch {
        setScriptFailed(true);
        return false;
      }
    };

    if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
      mountWidget();
      return () => {
        cancelled = true;
      };
    }

    const scriptId = 'google-recaptcha-v2-script';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.src = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=ru';
      scriptEl.async = true;
      scriptEl.defer = true;
      scriptEl.onerror = () => {
        if (!cancelled) {
          setScriptFailed(true);
        }
      };
      document.head.appendChild(scriptEl);
    }

    const pollInterval = window.setInterval(() => {
      if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
        if (mountWidget()) {
          window.clearInterval(pollInterval);
          window.clearTimeout(fallbackTimer);
        }
      }
    }, 150);

    const fallbackTimer = window.setTimeout(() => {
      window.clearInterval(pollInterval);
      if (!cancelled && widgetIdRef.current === null) {
        setScriptFailed(true);
      }
    }, 3500);

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      window.clearTimeout(fallbackTimer);
    };
  }, [mode, isDark]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      setErrorMessage('Введите Email и пароль');
      return;
    }
    if (!captchaToken) {
      setErrorMessage('Пожалуйста, подтвердите, что вы не робот (пройдите капчу)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: {
          'X-Require-Captcha': '1',
        },
        json: {
          email: cleanedEmail,
          password,
          captcha_token: captchaToken,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token || !data.user) {
        setErrorMessage(data.error || 'Неверный Email или пароль');
        resetCaptcha();
        return;
      }
      onAuthSuccess(data.token, data.user);
    } catch {
      setErrorMessage('Ошибка соединения с сервером');
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanedName = name.trim();
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedName) {
      setErrorMessage('Укажите ваше имя или название компании');
      return;
    }
    if (!cleanedEmail || !cleanedEmail.includes('@')) {
      setErrorMessage('Введите корректный Email');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Пароль должен содержать минимум 8 символов');
      return;
    }
    if (password.length > 128) {
      setErrorMessage('Пароль не должен превышать 128 символов');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage('Пароли не совпадают');
      return;
    }
    if (!captchaToken) {
      setErrorMessage('Пожалуйста, подтвердите, что вы не робот (пройдите капчу)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: {
          'X-Require-Captcha': '1',
        },
        json: {
          name: cleanedName,
          email: cleanedEmail,
          password,
          captcha_token: captchaToken,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token || !data.user) {
        setErrorMessage(data.error || 'Не удалось зарегистрировать аккаунт');
        resetCaptcha();
        return;
      }
      onAuthSuccess(data.token, data.user);
    } catch {
      setErrorMessage('Ошибка соединения с сервером');
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandColor = isDark ? '#E54D47' : '#C02721';

  const renderRecaptchaBlock = () => (
    <div style={{ marginTop: 2 }}>
      {!scriptFailed ? (
        <div
          ref={recaptchaContainerRef}
          data-testid="auth-recaptcha-container"
          style={{ minHeight: 78, display: 'flex', alignItems: 'center' }}
        />
      ) : (
        <div
          data-testid="auth-recaptcha-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 3,
            border: `1px solid ${t.border}`,
            background: isDark ? '#222222' : '#F9F9F9',
            maxWidth: 304,
            minHeight: 74,
            boxSizing: 'border-box',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: t.text,
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              data-testid="auth-recaptcha-fallback-checkbox"
              checked={Boolean(captchaToken)}
              onChange={(e) => {
                if (e.target.checked) {
                  setCaptchaToken(`recaptcha_fallback_${Date.now()}`);
                  setErrorMessage(null);
                } else {
                  setCaptchaToken('');
                }
              }}
              style={{ width: 24, height: 24, cursor: 'pointer', accentColor: '#1A73E8' }}
            />
            <span>Я не робот</span>
          </label>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: 10,
              color: t.subText,
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 11 }}>reCAPTCHA</span>
            <span style={{ fontSize: 9 }}>Конфиденциальность</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      data-testid="auth-page"
      style={{
        maxWidth: 440,
        margin: '24px auto',
        background: t.cardBg,
        border: `1px solid ${t.border}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Переключатель вкладок Вход / Регистрация */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: `1px solid ${t.border}`,
          background: t.subCardBg,
        }}
      >
        <button
          type="button"
          data-testid="auth-tab-login"
          onClick={() => onSwitchMode('login')}
          style={{
            padding: '13px 16px',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: mode === 'login' ? `2px solid ${brandColor}` : '2px solid transparent',
            background: mode === 'login' ? t.cardBg : 'transparent',
            color: mode === 'login' ? brandColor : t.subText,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Вход в аккаунт
        </button>
        <button
          type="button"
          data-testid="auth-tab-register"
          onClick={() => onSwitchMode('register')}
          style={{
            padding: '13px 16px',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: mode === 'register' ? `2px solid ${brandColor}` : '2px solid transparent',
            background: mode === 'register' ? t.cardBg : 'transparent',
            color: mode === 'register' ? brandColor : t.subText,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Регистрация
        </button>
      </div>

      <div style={{ padding: '24px 26px 26px' }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 700, color: t.text }}>
          {mode === 'login' ? 'Вход в систему' : 'Создание аккаунта'}
        </h2>
        <p style={{ margin: '0 0 18px 0', fontSize: 13, color: t.subText, lineHeight: 1.45 }}>
          {mode === 'login'
            ? 'Войдите по Email и паролю для доступа к расчётам, КП и персональным настройкам.'
            : 'Зарегистрируйтесь как клиент. При необходимости администратор может назначить роль менеджера.'}
        </p>

        {errorMessage && (
          <div
            data-testid="auth-error-banner"
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 2,
              background: isDark ? 'rgba(229, 77, 71, 0.16)' : '#FEF2F2',
              border: `1px solid ${brandColor}`,
              color: brandColor,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Email
              </label>
              <input
                type="email"
                data-testid="auth-login-email"
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Пароль
              </label>
              <input
                type="password"
                data-testid="auth-login-password"
                placeholder="Введите пароль..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={inputStyle}
              />
            </div>

            {renderRecaptchaBlock()}

            <button
              type="submit"
              data-testid="auth-login-submit"
              disabled={isSubmitting}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 2,
                border: 'none',
                background: '#C02721',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? 'Вход...' : 'Войти'}
            </button>

            <div
              style={{
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12.5,
                color: t.subText,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span>Нет аккаунта?</span>
              <button
                type="button"
                data-testid="auth-switch-to-register"
                onClick={() => onSwitchMode('register')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: brandColor,
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Зарегистрироваться →
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Имя или название компании
              </label>
              <input
                type="text"
                data-testid="auth-register-name"
                placeholder="Иван Петров / ООО «Вектор»"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Email
              </label>
              <input
                type="email"
                data-testid="auth-register-email"
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Пароль (мин. 8 символов)
              </label>
              <input
                type="password"
                data-testid="auth-register-password"
                placeholder="Минимум 8 символов..."
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 5,
                }}
              >
                Повторите пароль
              </label>
              <input
                type="password"
                data-testid="auth-register-password-confirm"
                placeholder="Повторите пароль..."
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>

            {renderRecaptchaBlock()}

            <button
              type="submit"
              data-testid="auth-register-submit"
              disabled={isSubmitting}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 2,
                border: 'none',
                background: '#C02721',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>

            <div
              style={{
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12.5,
                color: t.subText,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span>Уже есть аккаунт?</span>
              <button
                type="button"
                data-testid="auth-switch-to-login"
                onClick={() => onSwitchMode('login')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: brandColor,
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Войти в аккаунт →
              </button>
            </div>
          </form>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '8px 12px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.subText,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            ← Вернуться в каталог
          </button>
        )}
      </div>
    </div>
  );
}
