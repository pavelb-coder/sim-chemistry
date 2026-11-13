// Генератор векторных лабораторных иконок для шкафа реактивов и панели сосуда
// Использует многослойные полупрозрачные контуры без дублирующихся SVG id

const CAT_ICONS = {
  all: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v5.4L5.2 17a2.5 2.5 0 0 0 2.2 3.7h9.2a2.5 2.5 0 0 0 2.2-3.7L14 8.4V3"/><path d="M7.5 14h9"/></svg>`,
  met: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7"/><path d="M12 22V12"/><path d="M21 7l-9 5-9-5"/></svg>`,
  acid: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M9 5h6v3l4 8.5A2.5 2.5 0 0 1 16.7 20H7.3A2.5 2.5 0 0 1 5 16.5L9 8V5z"/><path d="M7 15h10"/></svg>`,
  base: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="14" rx="2"/><path d="M9.5 3h5l-.6 4h-3.8z"/><path d="M7 13h10"/></svg>`,
  salt: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 9 12 22 5 9"/><path d="M5 9h14"/></svg>`,
  ind: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c3.5 4.5 6 7.8 6 11.2a6 6 0 1 1-12 0c0-3.4 2.5-6.7 6-11.2z"/></svg>`,
  oth: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><circle cx="16" cy="15" r="4"/><circle cx="12" cy="8" r="4"/></svg>`
};

export function getCategoryIconSVG(catId) {
  return CAT_ICONS[catId] || CAT_ICONS.all;
}

function isNearWhite(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r > 232 && g > 235 && b > 238;
}

function liquidVisualColor(id, r) {
  const grp = r.category || r.cat;
  if (id === 'php') return '#f472b6';
  if (id === 'mo') return '#f59e0b';
  if (id === 'litmus') return '#8b5cf6';
  if (id === 'univ') return '#10b981';
  if (r.ionColor) return r.ionColor;
  if (!isNearWhite(r.color)) return r.color;
  if (grp === 'acid') return r.conc ? '#fde68a' : '#bae6fd';
  if (grp === 'base') return '#c7d2fe';
  if (id === 'h2o') return '#7dd3fc';
  if (id === 'h2o2') return '#a5f3fc';
  if (r.starch || r.polyol || r.aldehyde) return '#cbd5e1';
  if (r.protein) return '#fde68a';
  return '#bae6fd';
}

export function getReagentHazardKind(r) {
  const h = (r?.hazard || '').toLowerCase();
  if (!h) return '';
  if (h.includes('огне') || h.includes('горюч')) return 'fire';
  if (h.includes('ядов')) return 'toxic';
  if (h.includes('опасно') || h.includes('едк')) return 'corrosive';
  if (h.includes('окисл')) return 'oxidizer';
  return 'warn';
}

export function getReagentIconSVG(id, r, size = 36) {
  if (!r) return '';
  const s = `width="${size}" height="${size}" viewBox="0 0 40 40"`;

  // 1. Дистиллированная вода — лабораторная промывалка с изогнутым носиком
  if (id === 'h2o') {
    return `<svg ${s} fill="none" aria-hidden="true">
      <rect x="11" y="14" width="16" height="21" rx="4" fill="#e0f2fe" stroke="#64748b" stroke-width="1.5"/>
      <path d="M12 22h14v10a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V22z" fill="#38bdf8" fill-opacity="0.65"/>
      <path d="M12 22c3 1.3 11 1.3 14 0" stroke="#0284c7" stroke-width="1.2"/>
      <rect x="15.5" y="10.5" width="7" height="3.8" rx="1.2" fill="#2563eb"/>
      <path d="M19 10.5V7c0-1.6 1.2-2.5 2.8-2.2L29 6.3" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
      <circle cx="31.2" cy="8.2" r="1.5" fill="#38bdf8"/>
      <path d="M14 17v14" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.8"/>
    </svg>`;
  }

  // 2. Газообразный хлор — баллон / газометр с жёлто-зелёным газом
  if (r.state === 'g') {
    const gCol = r.color || '#bef264';
    return `<svg ${s} fill="none" aria-hidden="true">
      <rect x="12" y="10" width="16" height="25" rx="6" fill="#f1f5f9" stroke="#475569" stroke-width="1.6"/>
      <rect x="13.2" y="11.5" width="13.6" height="22" rx="5" fill="${gCol}" fill-opacity="0.72"/>
      <circle cx="17.5" cy="19" r="3" fill="#ffffff" fill-opacity="0.35"/>
      <circle cx="22.5" cy="24.5" r="4" fill="#a3e635" fill-opacity="0.4"/>
      <rect x="17" y="6" width="6" height="4" rx="1" fill="#64748b"/>
      <path d="M15 5h10M20 4v2" stroke="#334155" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="25.5" cy="8" r="2.2" fill="#f8fafc" stroke="#475569" stroke-width="1.2"/>
      <path d="M15 14v16" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.65"/>
    </svg>`;
  }

  // 3. Индикаторы — флакон-капельница с резиновой грушей и цветной каплей
  if (r.state === 'd') {
    const dropCol = liquidVisualColor(id, r);
    const isUniv = id === 'univ';
    return `<svg ${s} fill="none" aria-hidden="true">
      <path d="M16.5 5.5c0-1.6 1.5-2.8 3.5-2.8s3.5 1.2 3.5 2.8v4.2h-7V5.5z" fill="#ef4444"/>
      <rect x="14.5" y="9.5" width="11" height="3.2" rx="1.2" fill="#334155"/>
      <path d="M15.5 12.7h9l2.8 4.8v14.5a3.2 3.2 0 0 1-3.2 3.2H15.9a3.2 3.2 0 0 1-3.2-3.2V17.5l2.8-4.8z" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>
      ${isUniv
        ? `<rect x="14" y="22" width="12" height="3" fill="#ef4444" fill-opacity="0.75"/>
           <rect x="14" y="25" width="12" height="3" fill="#22c55e" fill-opacity="0.75"/>
           <rect x="14" y="28" width="12" height="5.8" rx="1.8" fill="#6366f1" fill-opacity="0.75"/>`
        : `<path d="M14 22.5h12v9.8a1.8 1.8 0 0 1-1.8 1.8h-8.4A1.8 1.8 0 0 1 14 32.3v-9.8z" fill="${dropCol}" fill-opacity="0.78"/>`
      }
      <path d="M20 12.8v9" stroke="#475569" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M15.4 18v13" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.8"/>
      <path d="M32 10.5c1.8 2.4 2.8 4 2.8 5.5a2.8 2.8 0 1 1-5.6 0c0-1.5 1-3.1 2.8-5.5z" fill="${dropCol}" stroke="#ffffff" stroke-width="0.8"/>
    </svg>`;
  }

  const grp = r.category || r.cat;

  // 4. Металлы
  if (grp === 'met') {
    const mCol = r.color || '#cbd5e1';
    // Щелочные металлы под слоем керосина/вазелина в широкогорлой банке
    if (r.float) {
      return `<svg ${s} fill="none" aria-hidden="true">
        <rect x="12" y="6" width="16" height="3.5" rx="1.2" fill="#475569"/>
        <rect x="10" y="9.5" width="20" height="25.5" rx="3.5" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>
        <rect x="11.3" y="16" width="17.4" height="17.7" rx="2.4" fill="#fde68a" fill-opacity="0.58"/>
        <path d="M11.3 16c4 1.2 13.4 1.2 17.4 0" stroke="#f59e0b" stroke-width="1.1"/>
        <circle cx="16.5" cy="21.5" r="3.1" fill="${mCol}" stroke="#475569" stroke-width="1"/>
        <circle cx="22.8" cy="24.2" r="2.7" fill="${mCol}" stroke="#475569" stroke-width="1"/>
        <circle cx="17.8" cy="28.6" r="2.5" fill="${mCol}" stroke="#475569" stroke-width="1"/>
        <circle cx="15.6" cy="20.6" r="0.9" fill="#ffffff"/>
        <path d="M12.6 12v19" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.75"/>
      </svg>`;
    }

    // Медная / серебряная / золотая спираль или проволока
    if (r.shape === 'wire') {
      const strokeCol = id === 'cu' ? '#9a3412' : (id === 'au' ? '#a16207' : '#64748b');
      return `<svg ${s} fill="none" aria-hidden="true">
        <ellipse cx="20" cy="31.5" rx="13" ry="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.3"/>
        <path d="M12 28c0-3 16-3 16-6s-16-3-16-6 16-3 16-6-11-3-13-1" stroke="${strokeCol}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M12 28c0-3 16-3 16-6s-16-3-16-6 16-3 16-6-11-3-13-1" stroke="${mCol}" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    }

    // Магниевая лента / кальциевая стружка
    if (r.shape === 'curl') {
      return `<svg ${s} fill="none" aria-hidden="true">
        <ellipse cx="20" cy="31.5" rx="13" ry="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.3"/>
        <path d="M10 27c2-7 8-14 14-11 4 2 1 9-4 9-5 0-6-7-1-11 4-3 10-1 11 5" stroke="#475569" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M10 27c2-7 8-14 14-11 4 2 1 9-4 9-5 0-6-7-1-11 4-3 10-1 11 5" stroke="${mCol}" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`;
    }

    // Железные опилки (горка тёмного металлического порошка на часовом стекле)
    if (r.shape === 'powder') {
      return `<svg ${s} fill="none" aria-hidden="true">
        <path d="M6 29c4 5 24 5 28 0" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 28.5L19.5 15c.6-.8 1.5-.8 2.1 0L30 28.5H10z" fill="${mCol}" stroke="#292524" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="18" cy="23" r="1" fill="#d6d3d1"/>
        <circle cx="22" cy="25" r="1" fill="#d6d3d1"/>
        <circle cx="20" cy="19.5" r="0.9" fill="#ffffff"/>
      </svg>`;
    }

    // Гранулы металла (Zn, Al, Ni, Sn)
    return `<svg ${s} fill="none" aria-hidden="true">
      <path d="M6 29.5c4 4.8 24 4.8 28 0" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      <polygon points="11,27 14,20 20,21 19,28" fill="${mCol}" stroke="#475569" stroke-width="1.2" stroke-linejoin="round"/>
      <polygon points="19,28 22,18 29,21 28,28" fill="${mCol}" stroke="#475569" stroke-width="1.2" stroke-linejoin="round"/>
      <polygon points="15,22 19,14 25,16 22,22" fill="${mCol}" stroke="#475569" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M18.8 15.8l3.5 1.1" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  }

  // 5. Твёрдые соли, оксиды, кристаллогидраты, уголь, сахар
  if (r.state === 's') {
    const sCol = r.color || '#e2e8f0';
    const darkOutline = isNearWhite(sCol) ? '#64748b' : '#1e293b';

    // Кристаллы и кусочки (медный купорос, мрамор, нашатырь, сахар)
    if (r.shape === 'chunk' || r.shape === 'granule') {
      return `<svg ${s} fill="none" aria-hidden="true">
        <rect x="11" y="6.5" width="18" height="3.5" rx="1.2" fill="#64748b"/>
        <rect x="9.5" y="10" width="21" height="25" rx="3.5" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>
        <polygon points="12.5,32 15,23 21,25 20,32.5" fill="${sCol}" stroke="${darkOutline}" stroke-width="1.1" stroke-linejoin="round"/>
        <polygon points="19.5,32.5 22,21 27.8,24 27,32.5" fill="${sCol}" stroke="${darkOutline}" stroke-width="1.1" stroke-linejoin="round"/>
        <polygon points="15.5,25 19.5,17.5 24.5,20.5 21.5,26" fill="${sCol}" stroke="${darkOutline}" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M12 13v18" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.8"/>
      </svg>`;
    }

    // Сухие порошки (CuO, MnO₂, MgO, малахит, активированный уголь)
    return `<svg ${s} fill="none" aria-hidden="true">
      <path d="M7 26h26l-3.2 7.2a2.5 2.5 0 0 1-2.3 1.5H12.5a2.5 2.5 0 0 1-2.3-1.5L7 26z" fill="#f1f5f9" stroke="#64748b" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M10.5 26c2.5-8.5 6.8-12.5 9.5-12.5S27 17.5 29.5 26H10.5z" fill="${sCol}" stroke="${darkOutline}" stroke-width="1.2" stroke-linejoin="round"/>
      <circle cx="18" cy="20" r="1" fill="#ffffff" fill-opacity="0.55"/>
    </svg>`;
  }

  // 6. Органические растворы, галогены и пероксид водорода — коническая/круглодонная колба или склянка тёмного стекла
  if (grp === 'oth' && r.state === 'l') {
    const lCol = liquidVisualColor(id, r);
    const amber = id === 'i2' || id === 'br2' || id === 'h2o2' || id === 'phenol';
    const glassFill = amber ? '#fef3c7' : '#f8fafc';
    const glassStroke = amber ? '#92400e' : '#64748b';
    return `<svg ${s} fill="none" aria-hidden="true">
      ${id === 'br2' ? `<path d="M16 5c-1.2-1.2 1-2.5 0-3.6M24 5c1.2-1.2-1-2.5 0-3.6" stroke="#ea580c" stroke-width="1.3" stroke-linecap="round"/>` : ''}
      <path d="M16.5 7h7M17.5 7v6.5L10 29.2A3.2 3.2 0 0 0 12.9 34h14.2A3.2 3.2 0 0 0 30 29.2L22.5 13.5V7" fill="${glassFill}" stroke="${glassStroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.3 22.5h13.4l2.7 6.3a1.9 1.9 0 0 1-1.7 2.7H12.3a1.9 1.9 0 0 1-1.7-2.7l2.7-6.3z" fill="${lCol}" fill-opacity="0.84"/>
      ${id === 'h2o2' ? `<circle cx="17.5" cy="28" r="1.2" fill="#ffffff"/><circle cx="22" cy="26.5" r="1" fill="#ffffff"/><circle cx="20" cy="29.8" r="0.9" fill="#ffffff"/>` : ''}
      <path d="M16 18l-3.5 9" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.8"/>
    </svg>`;
  }

  // 7. Кислоты, щёлочи и растворы солей — классические реактивные склянки
  const liqCol = liquidVisualColor(id, r);
  const darkGlass = id === 'agno3' || id === 'hno3k' || id === 'kmno4';
  const bottleFill = darkGlass ? '#fef3c7' : '#f8fafc';
  const bottleStroke = darkGlass ? '#92400e' : '#64748b';
  const isBase = grp === 'base';
  const isAcid = grp === 'acid';
  const fuming = r.conc || id === 'hcl' || id === 'nh3' || id === 'h2s' || id === 'h2so3';
  const bandCol = isAcid ? '#ef4444' : (isBase ? '#2563eb' : '#0ea5e9');

  // Для щелочей — тёмная резиновая пробка, для кислот и солей — стеклянная притёртая пробка
  const stopperSVG = isBase
    ? `<path d="M16.2 6h7.6l-.7 4.5h-6.2L16.2 6z" fill="#1e293b"/>`
    : `<rect x="15.5" y="5" width="9" height="2.6" rx="1.1" fill="#cbd5e1" stroke="${bottleStroke}" stroke-width="1.1"/>
       <rect x="17.2" y="7.6" width="5.6" height="2.8" fill="#e2e8f0" stroke="${bottleStroke}" stroke-width="1"/>`;

  return `<svg ${s} fill="none" aria-hidden="true">
    ${fuming ? `<path d="M14 5.5c-1.5-1.5 1-3 0-4.2M26 5.5c1.5-1.5-1-3 0-4.2" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>` : ''}
    ${stopperSVG}
    <path d="M16.5 10.4h7v2.8l4.5 3.6v15.2a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V16.8l4.5-3.6v-2.8z" fill="${bottleFill}" stroke="${bottleStroke}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M13.3 21.5h13.4v10.2a1.8 1.8 0 0 1-1.8 1.8h-9.8a1.8 1.8 0 0 1-1.8-1.8V21.5z" fill="${liqCol}" fill-opacity="0.82"/>
    <path d="M13.3 21.5c3.2 1.1 10.2 1.1 13.4 0" stroke="${bottleStroke}" stroke-width="0.9" stroke-opacity="0.45"/>
    <rect x="14.6" y="17.2" width="10.8" height="3.2" rx="0.8" fill="#ffffff" stroke="${bandCol}" stroke-width="1"/>
    <path d="M14.6 16.8v14" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.78"/>
  </svg>`;
}
