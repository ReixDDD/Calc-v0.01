import React, { useState } from 'react';
import { MainCategory, ProductCategory } from '../types';
import { resolveImageUrl } from '../constants';

export interface StudioPalette {
  readonly isDark: boolean;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly surfaceDeep: string;
  readonly stroke: string;
  readonly detail: string;
  readonly shadow: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly onAccent: string;
}

export function getStudioPalette(isDark: boolean): StudioPalette {
  if (isDark) {
    return {
      isDark: true,
      surface: '#2A2F3A',
      surfaceAlt: '#222630',
      surfaceDeep: '#343B48',
      stroke: '#8A97AC',
      detail: '#525C6E',
      shadow: 'rgba(0, 0, 0, 0.36)',
      accent: '#E54D47',
      accentSoft: 'rgba(229, 77, 71, 0.18)',
      onAccent: '#FFFFFF',
    };
  }

  return {
    isDark: false,
    surface: '#FFFFFF',
    surfaceAlt: '#EDF2F7',
    surfaceDeep: '#DCE4EE',
    stroke: '#475569',
    detail: '#CBD5E1',
    shadow: 'rgba(15, 23, 42, 0.065)',
    accent: '#C02721',
    accentSoft: '#FEE2E2',
    onAccent: '#FFFFFF',
  };
}

export function MainCategoryIllustration({
  category,
  isDark,
  compact = false,
}: {
  category: Pick<MainCategory, 'id' | 'name'>;
  isDark: boolean;
  compact?: boolean;
}) {
  const p = getStudioPalette(isDark);
  const idLower = `${category.id} ${category.name}`.toLowerCase();
  const sw = 1.35;

  const svgProps = {
    width: compact ? 52 : 252,
    height: compact ? 31 : 150,
    viewBox: '0 0 188 112',
    fill: 'none',
    shapeRendering: 'geometricPrecision' as const,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'data-theme-mode': isDark ? 'dark' : 'light',
    style: { display: 'block', overflow: 'visible' as const, flexShrink: 0 },
  };

  // 1. Полиграфическая продукция — минималистичная композиция листа и визитной карточки
  if (idLower.includes('polygraphy') || idLower.includes('полиграф')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(34, 8)">
          <rect x="4" y="4" width="66" height="88" rx="4" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="66"
            height="88"
            rx="4"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="12" y="14" width="24" height="24" rx="3" fill={p.accentSoft} />
          <circle cx="24" cy="26" r="6" fill={p.accent} />
          <line x1="12" y1="50" x2="46" y2="50" stroke={p.detail} strokeWidth="1.8" />
          <line x1="12" y1="59" x2="36" y2="59" stroke={p.detail} strokeWidth="1.8" />

          <g transform="translate(44, 48)">
            <rect x="4" y="4" width="72" height="44" rx="4" fill={p.shadow} />
            <rect
              x="0"
              y="0"
              width="72"
              height="44"
              rx="4"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <rect x="12" y="13" width="18" height="4" rx="2" fill={p.accent} />
            <line x1="12" y1="25" x2="54" y2="25" stroke={p.stroke} strokeWidth="1.6" />
            <line x1="12" y1="32" x2="38" y2="32" stroke={p.detail} strokeWidth="1.6" />
          </g>
        </g>
      </svg>
    );
  }

  // 2. Широкоформатная печать — минималистичный вал рулона и полотно с люверсами
  if (idLower.includes('wide') || idLower.includes('широкоформат')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(28, 10)">
          <rect x="14" y="20" width="108" height="72" rx="4" fill={p.shadow} />
          <rect
            x="10"
            y="14"
            width="112"
            height="74"
            rx="4"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="0"
            y="0"
            width="132"
            height="16"
            rx="8"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="18" y1="8" x2="114" y2="8" stroke={p.detail} strokeWidth="1.5" />

          <rect x="24" y="30" width="40" height="40" rx="3" fill={p.accentSoft} />
          <circle cx="44" cy="50" r="10" fill={p.accent} />
          <line x1="76" y1="38" x2="108" y2="38" stroke={p.stroke} strokeWidth="1.8" />
          <line x1="76" y1="48" x2="100" y2="48" stroke={p.detail} strokeWidth="1.8" />
          <line x1="76" y1="58" x2="92" y2="58" stroke={p.detail} strokeWidth="1.8" />

          {[
            [17, 22],
            [115, 22],
            [17, 81],
            [115, 81],
          ].map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="2.2" fill={p.surfaceAlt} stroke={p.stroke} strokeWidth="1.15" />
          ))}
        </g>
      </svg>
    );
  }

  // 3. Сувениры и подарки — лаконичный подарочный пакет и керамическая кружка
  if (idLower.includes('souvenir') || idLower.includes('сувенир') || idLower.includes('подар')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(33, 10)">
          {/* Подарочный пакет */}
          <rect x="4" y="20" width="56" height="70" rx="4" fill={p.shadow} />
          <path
            d="M 18 16 C 18 3, 38 3, 38 16"
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="0"
            y="16"
            width="56"
            height="70"
            rx="4"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="14" y1="68" x2="42" y2="68" stroke={p.detail} strokeWidth="1.6" />

          {/* Кружка спереди справа */}
          <g transform="translate(66, 30)">
            <path
              d="M 43 13 C 59 13, 59 41, 43 41"
              stroke={p.stroke}
              strokeWidth="4.4"
            />
            <path
              d="M 43 13 C 59 13, 59 41, 43 41"
              stroke={p.surfaceAlt}
              strokeWidth="1.8"
            />
            <rect x="4" y="4" width="46" height="54" rx="6" fill={p.shadow} />
            <rect
              x="0"
              y="0"
              width="46"
              height="54"
              rx="6"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle cx="23" cy="27" r="9" fill={p.accent} />
          </g>
        </g>
      </svg>
    );
  }

  // 4. Печати и штампы — минималистичный силуэт оснастки и чистое кольцо оттиска
  if (idLower.includes('stamp') || idLower.includes('печат') || idLower.includes('штамп')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(29, 12)">
          {/* Оснастка */}
          <g transform="translate(0, 4)">
            <rect x="3" y="66" width="48" height="12" rx="3" fill={p.shadow} />
            <path
              d="M 15 36 L 18 20 C 19 10, 31 10, 32 20 L 35 36"
              fill={p.surfaceAlt}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle cx="25" cy="12" r="10" fill={p.surface} stroke={p.stroke} strokeWidth={sw} />
            <rect
              x="4"
              y="36"
              width="42"
              height="24"
              rx="4"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <rect
              x="0"
              y="60"
              width="50"
              height="12"
              rx="3"
              fill={p.surfaceAlt}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <line x1="12" y1="48" x2="38" y2="48" stroke={p.accent} strokeWidth="2.2" />
          </g>

          {/* Круглый оттиск */}
          <g transform="translate(66, 12)">
            <circle cx="33" cy="34" r="32" fill={p.shadow} />
            <circle
              cx="30"
              cy="31"
              r="32"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle
              cx="30"
              cy="31"
              r="23"
              stroke={p.accent}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle cx="30" cy="31" r="15" stroke={p.accent} strokeWidth="1.2" />
            <circle cx="30" cy="31" r="5.5" fill={p.accent} />
          </g>
        </g>
      </svg>
    );
  }

  // 5. Дизайн и ретушь — чистый артборд и векторная кривая Безье
  if (idLower.includes('design') || idLower.includes('дизайн') || idLower.includes('ретуш')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(30, 12)">
          <rect x="4" y="4" width="124" height="84" rx="5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="124"
            height="84"
            rx="5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="0" y1="16" x2="124" y2="16" stroke={p.detail} strokeWidth="1.2" />
          <circle cx="11" cy="8" r="2" fill={p.accent} />
          <circle cx="19" cy="8" r="2" fill={p.detail} />
          <circle cx="27" cy="8" r="2" fill={p.detail} />

          <rect
            x="16"
            y="28"
            width="38"
            height="42"
            rx="3"
            fill={p.surfaceAlt}
            stroke={p.detail}
            strokeWidth="1.15"
          />
          <path
            d="M 66 64 C 74 34, 96 66, 106 34"
            stroke={p.accent}
            strokeWidth="2"
          />
          <line x1="66" y1="64" x2="80" y2="40" stroke={p.detail} strokeWidth="1.2" />
          <circle cx="80" cy="40" r="2.4" fill={p.surface} stroke={p.stroke} strokeWidth="1.2" />
          <rect x="63" y="61" width="6" height="6" rx="1.2" fill={p.surface} stroke={p.accent} strokeWidth="1.4" />
          <rect x="103" y="31" width="6" height="6" rx="1.2" fill={p.surface} stroke={p.accent} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // Универсальная минималистичная иллюстрация главной категории
  return (
    <svg {...svgProps}>
      <g transform="translate(46, 13)">
        <rect x="10" y="10" width="86" height="76" rx="4" fill={p.shadow} />
        <rect
          x="6"
          y="6"
          width="86"
          height="76"
          rx="4"
          fill={p.surfaceAlt}
          stroke={p.stroke}
          strokeWidth={sw}
        />
        <rect
          x="0"
          y="0"
          width="86"
          height="76"
          rx="4"
          fill={p.surface}
          stroke={p.stroke}
          strokeWidth={sw}
        />
        <rect x="14" y="14" width="24" height="24" rx="3" fill={p.accentSoft} />
        <circle cx="26" cy="26" r="6" fill={p.accent} />
        <line x1="14" y1="50" x2="66" y2="50" stroke={p.stroke} strokeWidth="1.8" />
        <line x1="14" y1="60" x2="46" y2="60" stroke={p.detail} strokeWidth="1.8" />
      </g>
    </svg>
  );
}

export function SubcategoryCardIllustration({
  cat,
  isDark = false,
  compact = false,
}: {
  cat: ProductCategory;
  isDark?: boolean;
  compact?: boolean;
}) {
  const p = getStudioPalette(isDark);
  const id = cat.id.toLowerCase();
  const name = cat.name.toLowerCase();
  const sw = 1.28;

  const svgProps = {
    width: compact ? 84 : 176,
    height: compact ? 65 : 136,
    viewBox: '0 0 96 74',
    fill: 'none',
    shapeRendering: 'geometricPrecision' as const,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'data-theme-mode': isDark ? 'dark' : 'light',
    style: { display: 'block', flexShrink: 0, overflow: 'visible' as const },
  };

  // 1. Визитки (business_cards) — пара чистых карточек 90×50 в сдвиге
  if (id.includes('business_card') || name.includes('визитк')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(10, 10)">
          <rect
            x="0"
            y="0"
            width="56"
            height="35"
            rx="3.5"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <g transform="translate(20, 18)">
            <rect x="3" y="3" width="56" height="35" rx="3.5" fill={p.shadow} />
            <rect
              x="0"
              y="0"
              width="56"
              height="35"
              rx="3.5"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle cx="13" cy="13" r="4.5" fill={p.accent} />
            <line x1="9" y1="24" x2="40" y2="24" stroke={p.stroke} strokeWidth="1.5" />
            <line x1="9" y1="29" x2="27" y2="29" stroke={p.detail} strokeWidth="1.4" />
          </g>
        </g>
      </svg>
    );
  }

  // 2. Листовки и флаеры (flyers) — чистый лист с лёгким подворотом второго листа
  if (id.includes('flyer') || name.includes('листов') || name.includes('флаер')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(22, 6)">
          <rect
            x="-4"
            y="2"
            width="46"
            height="60"
            rx="3.5"
            transform="rotate(-7 19 32)"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="6" y="4" width="46" height="60" rx="3.5" fill={p.shadow} />
          <rect
            x="3"
            y="1"
            width="46"
            height="60"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="10" y="8" width="32" height="24" rx="2.5" fill={p.accentSoft} />
          <circle cx="26" cy="20" r="6" fill={p.accent} />
          <line x1="10" y1="41" x2="38" y2="41" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="10" y1="48" x2="30" y2="48" stroke={p.detail} strokeWidth="1.4" />
          <line x1="10" y1="54" x2="22" y2="54" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 3. Каталоги, брошюры и журналы (catalogs) — открытый разворот книги
  if (id.includes('catalog') || name.includes('каталог') || name.includes('брошюр') || name.includes('журнал')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(10, 11)">
          <path d="M 3 8 L 38 12 L 73 8 L 73 53 L 38 57 L 3 53 Z" fill={p.shadow} />
          <path
            d="M 0 4 C 12 2, 26 4, 38 8 L 38 52 C 26 48, 12 46, 0 48 Z"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <path
            d="M 38 8 C 50 4, 64 2, 76 4 L 76 48 C 64 46, 50 48, 38 52 Z"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="8" y="13" width="21" height="16" rx="2" fill={p.accentSoft} />
          <circle cx="18.5" cy="21" r="4.5" fill={p.accent} />
          <line x1="8" y1="36" x2="28" y2="38" stroke={p.detail} strokeWidth="1.4" />
          <line x1="47" y1="16" x2="67" y2="14.5" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="47" y1="24" x2="67" y2="22.5" stroke={p.detail} strokeWidth="1.4" />
          <line x1="47" y1="32" x2="60" y2="31" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 4. Буклеты и лифлеты (booklets) — трёхполосная евро-фальцовка
  if (id.includes('booklet') || name.includes('буклет') || name.includes('лифлет')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(12, 7)">
          <polygon points="3,10 26,3 49,10 72,3 72,58 49,65 26,58 3,65" fill={p.shadow} />
          <polygon
            points="0,8 24,0 24,54 0,62"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="24,0 48,8 48,62 24,54"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="48,8 72,0 72,54 48,62"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <circle cx="12" cy="22" r="5" fill={p.accent} />
          <line x1="6" y1="36" x2="18" y2="32" stroke={p.detail} strokeWidth="1.4" />
          <line x1="30" y1="22" x2="42" y2="26" stroke={p.detail} strokeWidth="1.4" />
          <line x1="30" y1="30" x2="42" y2="34" stroke={p.detail} strokeWidth="1.4" />
          <line x1="54" y1="24" x2="66" y2="20" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="54" y1="32" x2="63" y2="29" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 5. Календари (calendars) — чистый перекидной календарь на пружине
  if (id.includes('calendar') || name.includes('календар')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(21, 6)">
          <rect x="3" y="8" width="54" height="56" rx="4" fill={p.shadow} />
          <rect
            x="0"
            y="5"
            width="54"
            height="56"
            rx="4"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <path
            d="M 0 9 C 0 6.8 1.8 5 4 5 L 50 5 C 52.2 5 54 6.8 54 9 L 54 19 L 0 19 Z"
            fill={p.accent}
          />
          {[12, 27, 42].map((lx) => (
            <line key={lx} x1={lx} y1="1" x2={lx} y2="9" stroke={p.stroke} strokeWidth="2" />
          ))}
          {[29, 40, 51].map((ry, rIdx) =>
            [13, 24, 35, 44].map((rx, cIdx) => {
              const active = rIdx === 1 && cIdx === 2;
              return (
                <circle
                  key={`${rx}-${ry}`}
                  cx={rx}
                  cy={ry}
                  r={active ? 3.2 : 2}
                  fill={active ? p.accent : p.detail}
                />
              );
            })
          )}
        </g>
      </svg>
    );
  }

  // 6. Фирменные бланки (blanks) — строгий бланк A4 с шапкой и оттиском
  if (id.includes('blank') || name.includes('бланк')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(24, 5)">
          <rect x="3" y="4" width="48" height="62" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="48"
            height="62"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="8" y="9" width="12" height="4" rx="2" fill={p.accent} />
          <line x1="8" y1="19" x2="40" y2="19" stroke={p.detail} strokeWidth="1.2" />
          <line x1="8" y1="28" x2="40" y2="28" stroke={p.detail} strokeWidth="1.4" />
          <line x1="8" y1="35" x2="40" y2="35" stroke={p.detail} strokeWidth="1.4" />
          <line x1="8" y1="42" x2="28" y2="42" stroke={p.detail} strokeWidth="1.4" />
          <circle cx="35" cy="51" r="4.5" stroke={p.accent} strokeWidth="1.25" />
        </g>
      </svg>
    );
  }

  // 7. Блокноты (notepads) — вертикальный блокнот на верхней пружине
  if (id.includes('notepad') || name.includes('блокнот')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(24, 5)">
          <rect x="3" y="7" width="48" height="59" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="4"
            width="48"
            height="59"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="37" y="4" width="4" height="59" fill={p.accent} />
          {[9, 18, 27, 36].map((lx) => (
            <line key={lx} x1={lx} y1="0.5" x2={lx} y2="7.5" stroke={p.stroke} strokeWidth="1.8" />
          ))}
          <line x1="9" y1="22" x2="29" y2="22" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="9" y1="29" x2="23" y2="29" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 8. Планеры и ежедневники (planners) — ежедневник с боковой пружиной и закладкой
  if (id.includes('planner') || name.includes('планер') || name.includes('ежедневник')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(21, 5)">
          <rect x="7" y="4" width="48" height="60" rx="3.5" fill={p.shadow} />
          <rect x="52" y="12" width="5" height="12" rx="1.5" fill={p.accent} />
          <rect x="52" y="28" width="5" height="12" rx="1.5" fill={p.surfaceAlt} stroke={p.stroke} strokeWidth="1.15" />
          <rect
            x="4"
            y="1"
            width="48"
            height="60"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          {[12, 23, 34, 45, 52].map((ly) => (
            <line key={ly} x1="0.5" y1={ly} x2="7.5" y2={ly} stroke={p.stroke} strokeWidth="1.7" />
          ))}
          <path d="M 14 21 L 17 24 L 22 18" stroke={p.accent} strokeWidth="1.7" />
          <line x1="27" y1="21" x2="43" y2="21" stroke={p.stroke} strokeWidth="1.5" />
          <circle cx="17.5" cy="34" r="3" stroke={p.detail} strokeWidth="1.3" />
          <line x1="27" y1="34" x2="41" y2="34" stroke={p.detail} strokeWidth="1.4" />
          <circle cx="17.5" cy="46" r="3" stroke={p.detail} strokeWidth="1.3" />
          <line x1="27" y1="46" x2="38" y2="46" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 9. Колоды карт (card_decks) — две скруглённые карты веером с лаконичным ромбом
  if (id.includes('card_deck') || name.includes('колод') || name.includes('карт')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(22, 7)">
          <rect
            x="0"
            y="3"
            width="38"
            height="54"
            rx="5"
            transform="rotate(-11 19 30)"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <g transform="translate(15, 2) rotate(6 19 27)">
            <rect x="3" y="3" width="38" height="54" rx="5" fill={p.shadow} />
            <rect
              x="0"
              y="0"
              width="38"
              height="54"
              rx="5"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <polygon points="19,18 26,27 19,36 12,27" fill={p.accent} />
          </g>
        </g>
      </svg>
    );
  }

  // 10. Коробки упаковочные (packaging_boxes) — чистый изометрический куб с лентой-пломбой
  if (id.includes('box') || name.includes('коробк') || name.includes('упаков')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(16, 5)">
          <polygon points="32,6 62,21 62,51 32,66 2,51 2,21" fill={p.shadow} transform="translate(2, 3)" />
          <polygon
            points="32,4 62,19 32,34 2,19"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="2,19 32,34 32,64 2,49"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,34 62,19 62,49 32,64"
            fill={p.surfaceDeep}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon points="16,12 23,8.5 53,23.5 46,27" fill={p.accent} />
          <polygon points="46,27 53,23.5 53,36 46,39.5" fill={p.accent} />
        </g>
      </svg>
    );
  }

  // 11. Меню для ресторанов (menus) — папка меню с корешком и минималистичным клошем
  if (id.includes('menu') || name.includes('меню')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(24, 5)">
          <rect x="4" y="4" width="46" height="62" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="46"
            height="62"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="8" y1="1" x2="8" y2="61" stroke={p.detail} strokeWidth="1.2" />
          <path d="M 17 33 A 9.5 9.5 0 0 1 36 33 Z" fill={p.accent} />
          <circle cx="26.5" cy="21.5" r="1.5" fill={p.accent} />
          <line x1="15" y1="35.5" x2="38" y2="35.5" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="19" y1="45" x2="34" y2="45" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 12. 3D Стикеры (stickers_3d) — объёмная смоляная линза-капсула с бликом
  if (id.includes('3d') || name.includes('3d')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(12, 13)">
          <rect x="3" y="6" width="72" height="44" rx="22" fill={p.shadow} />
          <rect
            x="0"
            y="4"
            width="72"
            height="44"
            rx="22"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="0"
            y="0"
            width="72"
            height="43"
            rx="21.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="18" y="14" width="36" height="15" rx="7.5" fill={p.accent} />
          <path d="M 14 9 C 24 4.5, 48 4.5, 58 9" stroke={p.detail} strokeWidth="1.6" />
        </g>
      </svg>
    );
  }

  // 13. Наклейки и стикеры (stickers) — круглый стикер с контурной насечкой и отгибом края
  if (id.includes('sticker') || name.includes('наклейк') || name.includes('стикер')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(18, 7)">
          <circle
            cx="30"
            cy="30"
            r="28"
            stroke={p.detail}
            strokeWidth="1.2"
            strokeDasharray="3.5 3"
          />
          <circle cx="32" cy="32" r="23" fill={p.shadow} />
          <path
            d="M 30 7 A 23 23 0 1 0 53 30 L 30 7 Z"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <circle cx="26" cy="34" r="6.5" fill={p.accent} />
          <path
            d="M 30 7 C 30 20, 40 30, 53 30 Z"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
        </g>
      </svg>
    );
  }

  // 14. Открытки и пригласительные (postcards) — конверт с карточкой и сургучной точкой
  if (id.includes('postcard') || name.includes('открытк') || name.includes('пригласит')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(14, 7)">
          <rect
            x="10"
            y="0"
            width="48"
            height="36"
            rx="3"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="20" y1="10" x2="44" y2="10" stroke={p.detail} strokeWidth="1.4" />
          <rect x="3" y="21" width="68" height="42" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="18"
            width="68"
            height="42"
            rx="3.5"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <path d="M 1 19 L 34 42 L 67 19" fill={p.surface} stroke={p.stroke} strokeWidth={sw} />
          <circle cx="34" cy="41" r="5" fill={p.accent} />
        </g>
      </svg>
    );
  }

  // 15. Папки вырубные и адресные (folders) — вырубная папка с карманом и вложенным листом
  if (id.includes('folder') || name.includes('папк')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(19, 5)">
          <rect x="4" y="4" width="54" height="62" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="54"
            height="62"
            rx="3.5"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="8"
            y="7"
            width="38"
            height="48"
            rx="2"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth="1.15"
          />
          <line x1="15" y1="17" x2="36" y2="17" stroke={p.detail} strokeWidth="1.4" />
          <line x1="15" y1="24" x2="29" y2="24" stroke={p.detail} strokeWidth="1.4" />
          <path
            d="M 0 34 L 24 34 L 31 41 L 54 41 L 54 58.5 C 54 60.4 52.4 62 50.5 62 L 3.5 62 C 1.6 62 0 60.4 0 58.5 Z"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="10" y="47" width="16" height="4" rx="2" fill={p.accent} />
        </g>
      </svg>
    );
  }

  // 16a. Широкоформатные плакаты и холсты (wf_posters_cat) — галерейный холст на подрамнике
  if (id === 'wf_posters_cat' || name.includes('холст')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(11, 9)">
          <polygon points="4,4 72,4 77,9 77,57 9,57 4,52" fill={p.shadow} />
          <polygon
            points="68,0 74,5 74,53 68,48"
            fill={p.surfaceDeep}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="0,48 68,48 74,53 6,53"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="0"
            y="0"
            width="68"
            height="48"
            rx="2"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <circle cx="48" cy="17" r="6" fill={p.accent} />
          <path d="M 8 40 L 26 22 L 41 35 L 52 26 L 60 40" stroke={p.stroke} strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // 16b. Плакаты и афиши (posters) — постер с мягким свитком внизу
  if (id.includes('poster') || name.includes('плакат') || name.includes('постер') || name.includes('афиш')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(23, 4)">
          <rect x="3" y="4" width="48" height="60" rx="3" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="48"
            height="58"
            rx="3"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <circle cx="24" cy="24" r="11" fill={p.accent} />
          <line x1="12" y1="43" x2="36" y2="43" stroke={p.stroke} strokeWidth="1.5" />
          <rect
            x="-3"
            y="55"
            width="54"
            height="9"
            rx="4.5"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
        </g>
      </svg>
    );
  }

  // 17. Сертификаты и дипломы (certificates) — горизонтальный бланк в рамке с розеткой
  if (id.includes('certificate') || name.includes('сертификат') || name.includes('диплом')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(10, 10)">
          <rect x="3" y="4" width="76" height="52" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="76"
            height="52"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect
            x="5.5"
            y="5.5"
            width="65"
            height="41"
            rx="2"
            stroke={p.detail}
            strokeWidth="1.15"
          />
          <line x1="22" y1="16" x2="54" y2="16" stroke={p.stroke} strokeWidth="1.6" />
          <line x1="16" y1="24" x2="60" y2="24" stroke={p.detail} strokeWidth="1.4" />
          <line x1="24" y1="31" x2="52" y2="31" stroke={p.detail} strokeWidth="1.4" />
          <polygon points="55,39 52,55 57,52 62,55 59,39" fill={p.accent} />
          <circle cx="57" cy="37" r="6" fill={p.accent} stroke={p.surface} strokeWidth="1.3" />
        </g>
      </svg>
    );
  }

  // 18. Тейбл-тенты (table_tents) — архитектурная настольная призма-домик
  if (id.includes('table_tent') || name.includes('тейбл') || name.includes('тент') || name.includes('домик')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(14, 7)">
          <polygon points="8,54 26,61 68,61 54,54" fill={p.shadow} />
          <polygon
            points="20,2 26,58 4,49"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon
            points="20,2 62,2 68,58 26,58"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <circle cx="43" cy="23" r="7.5" fill={p.accent} />
          <line x1="33" y1="39" x2="55" y2="39" stroke={p.stroke} strokeWidth="1.5" />
          <line x1="36" y1="46" x2="52" y2="46" stroke={p.detail} strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // 19. Баннеры и растяжки (wf_banners_cat) — полотно с четырьмя люверсами
  if (id.includes('wf_banners') || name.includes('баннер') || name.includes('растяж')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(8, 11)">
          <rect x="3" y="4" width="80" height="50" rx="3.5" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="80"
            height="50"
            rx="3.5"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="11" y="12" width="26" height="26" rx="3" fill={p.accentSoft} />
          <circle cx="24" cy="25" r="6.5" fill={p.accent} />
          <line x1="45" y1="19" x2="68" y2="19" stroke={p.stroke} strokeWidth="1.6" />
          <line x1="45" y1="27" x2="62" y2="27" stroke={p.detail} strokeWidth="1.4" />
          <line x1="45" y1="34" x2="55" y2="34" stroke={p.detail} strokeWidth="1.4" />
          {[
            [6, 6],
            [74, 6],
            [6, 44],
            [74, 44],
          ].map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="2" fill={p.surfaceAlt} stroke={p.stroke} strokeWidth="1.1" />
          ))}
        </g>
      </svg>
    );
  }

  // 20. Самоклеящаяся плёнка (wf_films_cat) — рулон винила с отделяемым углом
  if (id.includes('wf_films') || name.includes('плёнк') || name.includes('пленк') || name.includes('самоклей')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(11, 8)">
          <rect x="18" y="10" width="56" height="46" rx="3" fill={p.shadow} />
          <rect
            x="16"
            y="8"
            width="56"
            height="46"
            rx="3"
            stroke={p.detail}
            strokeWidth="1.2"
            strokeDasharray="3.5 2.5"
          />
          <path
            d="M 16 8 L 72 8 L 72 38 L 56 54 L 16 54 Z"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <polygon points="72,38 56,54 56,38" fill={p.accent} stroke={p.stroke} strokeWidth="1.15" />
          <rect
            x="0"
            y="3"
            width="18"
            height="54"
            rx="5"
            fill={p.surfaceAlt}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <ellipse cx="9" cy="5.5" rx="5" ry="1.8" fill={p.detail} />
        </g>
      </svg>
    );
  }

  // 21. Кружки с печатью (souv_mugs_cat) — лаконичная керамическая кружка
  if (id.includes('souv_mugs') || name.includes('кружк') || name.includes('чашк')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(22, 9)">
          <path d="M 41 13 C 57 13, 57 39, 41 39" stroke={p.stroke} strokeWidth="4.2" />
          <path d="M 41 13 C 57 13, 57 39, 41 39" stroke={p.surfaceAlt} strokeWidth="1.7" />
          <rect x="3" y="4" width="44" height="52" rx="6" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="44"
            height="52"
            rx="6"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="6" y1="8" x2="38" y2="8" stroke={p.detail} strokeWidth="1.15" />
          <circle cx="22" cy="27" r="8.5" fill={p.accent} />
        </g>
      </svg>
    );
  }

  // 22. Футболки и текстиль (souv_textile_cat) — чистый геометрический силуэт футболки
  if (id.includes('souv_textile') || name.includes('футболк') || name.includes('текстил') || name.includes('шоппер')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(12, 7)">
          <path
            d="M 24 4 C 28 10, 44 10, 48 4 L 68 15 L 61 29 L 52 24 L 52 58 C 52 59.7 50.7 61 49 61 L 23 61 C 21.3 61 20 59.7 20 58 L 20 24 L 11 29 L 4 15 Z"
            transform="translate(2.5, 3)"
            fill={p.shadow}
          />
          <path
            d="M 24 4 C 28 10, 44 10, 48 4 L 68 15 L 61 29 L 52 24 L 52 58 C 52 59.7 50.7 61 49 61 L 23 61 C 21.3 61 20 59.7 20 58 L 20 24 L 11 29 L 4 15 Z"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <rect x="28" y="21" width="16" height="16" rx="3" fill={p.accentSoft} />
          <circle cx="36" cy="29" r="4.5" fill={p.accent} />
        </g>
      </svg>
    );
  }

  // 23. Печати и штампы (stamps_orgs_cat) — оснастка и лаконичное кольцо оттиска
  if (id.includes('stamps_orgs') || id.includes('stamp') || name.includes('печат') || name.includes('штамп') || name.includes('факсимил')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(9, 8)">
          <g transform="translate(36, 12)">
            <circle cx="24" cy="24" r="21" fill={p.shadow} />
            <circle
              cx="22"
              cy="22"
              r="21"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle cx="22" cy="22" r="14.5" stroke={p.accent} strokeWidth="1.3" strokeDasharray="3.5 2.5" />
            <circle cx="22" cy="22" r="9.5" stroke={p.accent} strokeWidth="1.05" />
            <circle cx="22" cy="22" r="3.8" fill={p.accent} />
          </g>
          <g transform="translate(0, 2)">
            <path
              d="M 11 28 L 13 15 C 14 8, 24 8, 25 15 L 27 28"
              fill={p.surfaceAlt}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <circle cx="19" cy="9" r="7.5" fill={p.surface} stroke={p.stroke} strokeWidth={sw} />
            <rect
              x="3"
              y="28"
              width="32"
              height="18"
              rx="3.5"
              fill={p.surface}
              stroke={p.stroke}
              strokeWidth={sw}
            />
            <rect
              x="0"
              y="46"
              width="38"
              height="8"
              rx="2.5"
              fill={p.surfaceAlt}
              stroke={p.stroke}
              strokeWidth={sw}
            />
          </g>
        </g>
      </svg>
    );
  }

  // 24. Разработка макетов и ретушь (design_makets_cat) — артборд с узлами кривой Безье
  if (id.includes('design') || name.includes('макет') || name.includes('дизайн') || name.includes('верстк')) {
    return (
      <svg {...svgProps}>
        <g transform="translate(12, 10)">
          <rect x="3" y="4" width="72" height="52" rx="4" fill={p.shadow} />
          <rect
            x="0"
            y="0"
            width="72"
            height="52"
            rx="4"
            fill={p.surface}
            stroke={p.stroke}
            strokeWidth={sw}
          />
          <line x1="0" y1="11" x2="72" y2="11" stroke={p.detail} strokeWidth="1.15" />
          <circle cx="8" cy="5.5" r="1.5" fill={p.accent} />
          <circle cx="14" cy="5.5" r="1.5" fill={p.detail} />
          <path d="M 16 40 C 26 18, 46 44, 56 21" stroke={p.accent} strokeWidth="1.85" />
          <line x1="16" y1="40" x2="27" y2="23" stroke={p.detail} strokeWidth="1.15" />
          <circle cx="27" cy="23" r="2" fill={p.surface} stroke={p.stroke} strokeWidth="1.15" />
          <rect x="13.5" y="37.5" width="5" height="5" rx="1" fill={p.surface} stroke={p.accent} strokeWidth="1.3" />
          <rect x="53.5" y="18.5" width="5" height="5" rx="1" fill={p.surface} stroke={p.accent} strokeWidth="1.3" />
        </g>
      </svg>
    );
  }

  // Универсальная минималистичная иллюстрация подкатегории
  return (
    <svg {...svgProps}>
      <g transform="translate(24, 7)">
        <rect x="3" y="4" width="48" height="58" rx="4" fill={p.shadow} />
        <rect
          x="0"
          y="0"
          width="48"
          height="58"
          rx="4"
          fill={p.surface}
          stroke={p.stroke}
          strokeWidth={sw}
        />
        <rect x="10" y="10" width="16" height="16" rx="3" fill={p.accentSoft} />
        <circle cx="18" cy="18" r="4.5" fill={p.accent} />
        <line x1="10" y1="36" x2="38" y2="36" stroke={p.stroke} strokeWidth="1.5" />
        <line x1="10" y1="44" x2="28" y2="44" stroke={p.detail} strokeWidth="1.4" />
      </g>
    </svg>
  );
}

export function ResilientCatalogImage({
  imageUrl,
  alt,
  fallback,
  style,
}: {
  imageUrl?: string | null;
  alt: string;
  fallback: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const resolved = imageUrl ? resolveImageUrl(imageUrl) : '';

  if (!resolved || failedUrl === resolved) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(resolved)}
      style={style}
    />
  );
}
