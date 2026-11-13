import { REAGENTS, FLAME_COLORS } from './reagents.js';

export const VESSELS = {
  flask: {
    id: 'flask',
    name: 'Коническая колба',
    short: 'Колба 100 мл',
    cap: 100,
    glassHeatCap: 14,
    allowTube: true
  },
  tube: {
    id: 'tube',
    name: 'Пробирка',
    short: 'Пробирка 25 мл',
    cap: 25,
    glassHeatCap: 3.5,
    allowTube: true
  },
  beaker: {
    id: 'beaker',
    name: 'Химический стакан',
    short: 'Стакан 200 мл',
    cap: 200,
    glassHeatCap: 24,
    allowTube: false
  }
};

export const GAS_INFO = {
  H2:   { formula: 'H₂',   name: 'водород',         soluble: false, color: '#ffffff', smell: '' },
  O2:   { formula: 'O₂',   name: 'кислород',        soluble: false, color: '#ffffff', smell: '' },
  N2:   { formula: 'N₂',   name: 'азот',            soluble: false, color: '#ffffff', smell: '' },
  CO2:  { formula: 'CO₂',  name: 'углекислый газ',  soluble: false, color: '#ffffff', smell: '' },
  C2H2: { formula: 'C₂H₂', name: 'ацетилен',        soluble: false, color: '#ffffff', smell: 'характерный запах технического ацетилена' },
  NO:   { formula: 'NO',   name: 'оксид азота(II)', soluble: false, color: '#d97706', smell: 'резкий запах оксидов азота' },
  NO2:  { formula: 'NO₂',  name: 'оксид азота(IV)', soluble: true,  color: '#b45309', smell: 'резкий удушливый запах бурого газа NO₂' },
  SO2:  { formula: 'SO₂',  name: 'сернистый газ',   soluble: true,  color: '#ffffff', smell: 'резкий запах жжёной серы (SO₂)' },
  H2S:  { formula: 'H₂S',  name: 'сероводород',     soluble: true,  color: '#ffffff', smell: 'неприятный запах тухлых яиц (H₂S)' },
  NH3:  { formula: 'NH₃',  name: 'аммиак',          soluble: true,  color: '#ffffff', smell: 'резкий запах нашатырного спирта (NH₃)' },
  Cl2:  { formula: 'Cl₂',  name: 'хлор',            soluble: true,  color: '#bef264', smell: 'резкий удушливый запах хлора' }
};

export function createInitialLabState(vessel = 'flask') {
  return {
    vessel,
    amt: {},
    addedOrder: [],
    prog: {},
    temp: 22.0,
    heatLvl: 0,
    tubeOn: false,
    collectedGas: {},
    evapMl: 0,
    headspace: { gas: '', amount: 0 },
    coatings: {
      silverMirror: 0,
      sublimedRing: 0,
      copperPlated: 0,
      silverPlated: 0,
      anhydrousWhite: 0,
      carbonFoam: 0,
      volcanoAsh: 0
    },
    seen: {
      gases: {},
      precipitates: {},
      complexes: {},
      splint: {},
      flames: {},
      smelled: false,
      redox: {},
      mirror: false,
      sublimed: false,
      charred: false,
      volcano: false,
      clBurn: false,
      displacedCu: false,
      displacedAg: false,
      rehydratedCu: false,
      coHydrolysis: false,
      manganate: false,
      ester: false,
      xantho: false,
      hotPbI2: false,
      goldenRainRecryst: false
    },
    simTime: 0
  };
}

export function cloneLabState(state) {
  return JSON.parse(JSON.stringify(state));
}

function hexToRgb(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, 'f');
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0
  ];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

export function mixColors(entries) {
  const valid = entries.filter((e) => e && e[1] > 0.0001);
  if (!valid.length) return '#dff2fc';
  let totalW = 0;
  const sum = [0, 0, 0];
  for (const [hex, w] of valid) {
    const [r, g, b] = hexToRgb(hex);
    sum[0] += r * w;
    sum[1] += g * w;
    sum[2] += b * w;
    totalW += w;
  }
  return rgbToHex([sum[0] / totalW, sum[1] / totalW, sum[2] / totalW]);
}

function lerpColor(h1, h2, t) {
  const k = Math.max(0, Math.min(1, t));
  return mixColors([[h1, 1 - k], [h2, k]]);
}

export function computeLiquidVolume(state) {
  let raw = 0;
  for (const [id, q] of Object.entries(state.amt || {})) {
    if (q <= 0) continue;
    const r = REAGENTS[id];
    if (!r) continue;
    if (r.state === 'l') raw += q;
    else if (r.state === 'd') raw += q * 0.25;
  }
  return Math.max(0, raw - (state.evapMl || 0));
}

export function computeHeatCapacity(state) {
  const v = VESSELS[state.vessel] || VESSELS.flask;
  return computeLiquidVolume(state) + v.glassHeatCap;
}

/**
 * Полный физико-химический расчёт равновесий в сосуде
 */
export function analyzeChemistry(state) {
  const amt = state.amt || {};
  const prog = state.prog || {};
  const vol = computeLiquidVolume(state);
  const wet = vol > 0.15;

  let acidEq = 0;
  let baseEq = 0;
  let strongAcidEq = 0;
  let strongBaseEq = 0;
  let weakAcidPh = 5.0;
  let nh3Eq = 0;
  let concH2SO4 = (amt.h2so4k || 0) > 0 && (amt.h2so4k || 0) >= vol * 0.45;
  let concHNO3 = (amt.hno3k || 0) > 0 && (amt.hno3k || 0) >= vol * 0.4;

  const cations = {};
  const anions = {};
  const addCat = (c, q) => { if (c && q > 0) cations[c] = (cations[c] || 0) + q; };
  const addAn = (a, q) => { if (a && q > 0) anions[a] = (anions[a] || 0) + q; };

  // 1. Вклад налитых кислот, щелочей и растворов солей (10 мл ≈ 1 усл. экв.)
  for (const [id, q] of Object.entries(amt)) {
    if (q <= 0) continue;
    const r = REAGENTS[id];
    if (!r) continue;
    const eq = r.state === 'l' ? q / 10 : q;

    if (r.acid) {
      acidEq += eq * r.acid;
      if (r.strong) strongAcidEq += eq * r.acid;
      else weakAcidPh = Math.min(weakAcidPh, r.pH0 || 3.5);
      addAn(r.an, eq);
    }
    if (r.base) {
      baseEq += eq * r.base;
      if (r.strongBase) strongBaseEq += eq * r.base;
      if (r.nh3) nh3Eq += eq * 1.1;
      addCat(r.cat, eq);
    }
    if (r.cat === 'salt' || r.cat) {
      if (r.cat && !r.base) addCat(r.cat, eq);
      if (r.an && !r.acid) addAn(r.an, eq);
    }
  }

  // 2. Вклад растворившихся твёрдых веществ (металлы, оксиды, карбонаты, кристаллы)
  for (const [id, q] of Object.entries(amt)) {
    if (q <= 0) continue;
    const r = REAGENTS[id];
    if (!r || r.state !== 's') continue;
    const p = Math.min(1, prog[id] || 0);
    const pAlk = Math.min(1, prog[id + ':alk'] || 0);

    if (r.waterRate && wet) {
      // Щелочные и щёлочноземельные металлы с водой → OH⁻ + катион
      const reacted = q * p * 0.9;
      baseEq += reacted;
      strongBaseEq += reacted;
      addCat(r.ion, reacted);
    } else if (r.cat === 'met') {
      if (p > 0) {
        const reacted = q * p * 0.85;
        acidEq = Math.max(0, acidEq - reacted);
        strongAcidEq = Math.max(0, strongAcidEq - reacted);
        const ionKey = (r.ion === 'Fe2' && ((amt.hno3 || 0) + (amt.hno3k || 0) > 0)) ? 'Fe3' : r.ion;
        addCat(ionKey, reacted);
      }
      if (pAlk > 0 && r.amph) {
        const reactedAlk = q * pAlk * 0.7;
        baseEq = Math.max(0, baseEq - reactedAlk * 0.6);
        addCat(r.ion, reactedAlk);
      }
    }

    if (r.basicOxide) {
      if (r.slightBase && wet) {
        const sl = Math.min(0.28, q * r.slightBase);
        baseEq += sl;
        addCat(r.basicOxide, sl);
      }
      if (p > 0) {
        const reacted = q * p * 0.85;
        acidEq = Math.max(0, acidEq - reacted);
        strongAcidEq = Math.max(0, strongAcidEq - reacted);
        addCat(r.basicOxide, reacted);
      }
    }

    if (r.solidCarbonate && p > 0) {
      const reacted = q * p * 0.85;
      acidEq = Math.max(0, acidEq - reacted);
      strongAcidEq = Math.max(0, strongAcidEq - reacted);
      addCat(r.solidCarbonate, reacted);
    }

    if (r.hydrateOf && wet) {
      // Кристаллический купорос растворяется в воде
      const eq = q * 0.7;
      addCat('Cu', eq);
      addAn('SO4', eq);
    }
    if (r.dissolveAs && wet) {
      const eq = q * 0.8;
      addCat('NH4', eq);
      addAn('Cl', eq);
    }
    if (r.carbide && wet && p > 0) {
      // CaC₂ + 2H₂O → Ca(OH)₂ + C₂H₂↑
      const reacted = q * p * 0.9;
      baseEq += reacted;
      strongBaseEq += reacted;
      addCat('Ca', reacted);
    }
    if (r.volcano && wet && (prog.volcano || 0) < 0.45) {
      const eq = q * 0.75;
      addCat('NH4', eq);
      addAn('Cr2O7', eq);
    }
    if (r.dryO2 && wet && (prog.dry_kmno4 || 0) < 0.45) {
      const eq = q * 0.75;
      addCat('K', eq);
      addAn('MnO4', eq);
    }
  }

  // Объединяем хромат и дихромат в общий пул Cr(VI) (2CrO₄²⁻ + 2H⁺ ⇄ Cr₂O₇²⁻ + H₂O)
  if ((anions.CrO4 || 0) > 0) {
    addAn('Cr2O7', anions.CrO4);
    anions.CrO4 = 0;
  }

  // 3. Расходование кислоты карбонатами, сульфитами и сульфидами растворов
  const gasAnions = ['CO3', 'HCO3', 'SO3', 'S'];
  for (const ga of gasAnions) {
    if ((anions[ga] || 0) > 0 && acidEq > 0.02) {
      const used = Math.min(anions[ga], acidEq);
      anions[ga] -= used;
      acidEq = Math.max(0, acidEq - used);
      strongAcidEq = Math.max(0, strongAcidEq - used);
    }
  }

  // 3б. Необратимый совместный гидролиз Al³⁺ / Fe³⁺ / Cr³⁺ с карбонатами, сульфитами и сульфидами
  let coHydrolysis = false;
  let fe3SulfideRedox = false;
  if (wet) {
    // Особый случай ОВР: 2Fe³⁺ + 3S²⁻ → 2FeS↓ + S↓
    if ((cations.Fe3 || 0) > 0.04 && (anions.S || 0) > 0.04) {
      const used = Math.min(cations.Fe3, anions.S);
      cations.Fe3 -= used;
      anions.S -= used;
      addCat('Fe2', used * 0.5);
      fe3SulfideRedox = true;
    }
    const triCat = (cations.Al || 0) + (cations.Fe3 || 0) + (cations.Cr || 0);
    const weakGasAn = (anions.CO3 || 0) + (anions.HCO3 || 0) + (anions.SO3 || 0) + ((cations.Al || 0) + (cations.Cr || 0) > 0.03 ? (anions.S || 0) : 0);
    if (triCat > 0.04 && weakGasAn > 0.04 && Math.abs(baseEq - acidEq) < 0.35) {
      coHydrolysis = true;
      for (const ga of ['CO3', 'HCO3', 'SO3', 'S']) {
        if ((anions[ga] || 0) > 0) anions[ga] *= 0.15;
      }
      // Гидролиз создаёт нейтрально-слабощелочную область осаждения гидроксидов Me(OH)₃↓
      baseEq = Math.max(baseEq, acidEq + 0.06);
    }
  }

  // 4. Вытеснение меди и серебра более активными металлами (цементация)
  let displacedCu = false;
  let displacedAg = false;
  if (wet && (cations.Cu || 0) > 0.05) {
    const displacer = ['fe', 'zn', 'mg', 'al'].find((m) => (amt[m] || 0) > 0 && (prog[m + ':disp'] || 0) > 0.05);
    if (displacer) {
      const dp = Math.min(1, prog[displacer + ':disp'] || 0);
      const shift = Math.min(cations.Cu, dp * 1.1);
      cations.Cu -= shift;
      addCat(REAGENTS[displacer].ion, shift);
      displacedCu = dp > 0.2;
    }
  }
  if (wet && (cations.Ag || 0) > 0.04) {
    const agDisp = ['cu', 'fe', 'zn', 'mg', 'al'].find((m) => (amt[m] || 0) > 0 && (prog[m + ':ag'] || 0) > 0.05);
    if (agDisp) {
      const dp = Math.min(1, prog[agDisp + ':ag'] || 0);
      const shift = Math.min(cations.Ag, dp * 1.1);
      cations.Ag -= shift;
      addCat(REAGENTS[agDisp].ion, shift * 0.65);
      displacedAg = dp > 0.2;
    }
  }

  // 5. Окислительно-восстановительные реакции в растворе
  const redox = {};
  let freeIodine = (amt.i2 || 0) / 10;
  let freeBromine = (amt.br2 || 0) / 10;
  let manganateGreen = (wet && (amt.kmno4s || 0) > 0 && (prog.dry_kmno4 || 0) >= 0.45) ? 0.6 : 0;
  let cr3Green = (cations.Cr || 0);
  const netPre = baseEq - acidEq;

  if (fe3SulfideRedox) redox.fe3Sulfide = true;

  // Диспропорционирование зелёного манганата MnO₄²⁻ при подкислении → фиолетовый MnO₄⁻ + MnO₂↓
  if (manganateGreen > 0 && netPre < -0.03) {
    addAn('MnO4', manganateGreen * 0.65);
    manganateGreen = 0;
    redox.manganateDisprop = true;
  }

  const hasStrongReducer =
    (anions.SO3 || 0) > 0.03 ||
    (anions.S2O3 || 0) > 0.03 ||
    (anions.NO2 || 0) > 0.03 ||
    (amt.na2so3 || 0) > 0 ||
    (amt.na2s2o3 || 0) > 0 ||
    (amt.h2so3 || 0) > 0 ||
    (amt.hcooh || 0) > 0 ||
    (cations.Fe2 || 0) > 0.03 ||
    (anions.I || 0) > 0.04 ||
    (amt.h2s || 0) > 0 ||
    (amt.na2s || 0) > 0 ||
    (amt.h2o2 || 0) > 0;

  const hasOrganicReducer = (amt.glucose || 0) > 0 || ((amt.ethanol || 0) > 0 && state.temp >= 45);
  const hasReducer = hasStrongReducer || hasOrganicReducer;

  // Хлор Cl₂ или бромная вода Br₂ вытесняют свободный иод I₂ из иодида KI
  if ((state.headspace?.gas === 'Cl2' && state.headspace.amount > 0.2) && (anions.I || 0) > 0.05 && wet) {
    const ox = Math.min(anions.I, 0.5);
    anions.I -= ox;
    freeIodine += ox * 0.8;
    redox.clOxI = true;
  }
  if (wet && freeBromine > 0.02 && (anions.I || 0) > 0.04) {
    const ox = Math.min(freeBromine, anions.I * 0.7);
    freeBromine -= ox;
    anions.I -= ox;
    addAn('Br', ox);
    freeIodine += ox * 0.85;
    redox.brOxI = true;
  }

  // Нитрит натрия в кислой среде окисляет иодид до I₂ с выделением NO
  if (wet && (anions.NO2 || 0) > 0.03 && (anions.I || 0) > 0.04 && netPre < -0.04) {
    const ox = Math.min(anions.NO2, anions.I * 0.7);
    anions.NO2 -= ox;
    anions.I -= ox;
    freeIodine += ox * 0.8;
    redox.no2OxI = true;
  }

  // ОВР меди(II) с иодидом калия: 2Cu²⁺ + 4I⁻ → 2CuI↓(белый) + I₂
  let cuIodidePrecip = false;
  if (wet && (cations.Cu || 0) > 0.04 && (anions.I || 0) > 0.06 && nh3Eq < 0.05) {
    const ox = Math.min(cations.Cu, anions.I * 0.55);
    cations.Cu -= ox;
    anions.I -= ox * 1.6;
    freeIodine += ox * 0.75;
    cuIodidePrecip = true;
    redox.cuOxI = true;
  }

  // Перманганат калия KMnO₄ в 3 различных средах (кислая → Mn²⁺, нейтральная → MnO₂↓, щелочная → зелёный MnO₄²⁻)
  if (wet && (anions.MnO4 || 0) > 0.02 && hasReducer) {
    if (netPre < -0.04) {
      redox.mno4Decolorized = true;
      if ((cations.Fe2 || 0) > 0) {
        addCat('Fe3', cations.Fe2);
        cations.Fe2 = 0;
      }
      if ((anions.I || 0) > 0.04) {
        freeIodine += Math.min(anions.I, anions.MnO4 * 1.5);
      }
      anions.MnO4 = 0;
      addCat('Mn', 0.3);
    } else if (netPre > 0.18 && ((amt.na2so3 || 0) > 0 || (amt.glucose || 0) > 0 || (amt.ki || 0) > 0 || (amt.ethanol || 0) > 0 || (amt.na2s2o3 || 0) > 0)) {
      // Сильнощелочная среда: «химический хамелеон» — переход фиолетового MnO₄⁻ в изумрудно-зелёный манганат MnO₄²⁻
      redox.mno4Alkaline = true;
      manganateGreen += anions.MnO4 * 1.1;
      anions.MnO4 = 0;
    } else {
      // Нейтральная / слабощелочная среда: выпадение бурого осадка MnO₂↓
      redox.mno4Neutral = true;
      anions.MnO4 = 0;
    }
  }

  // Дихромат / хромат в кислой среде восстанавливается до изумрудно-зелёного Cr³⁺ (включая окисление этанола при нагреве)
  if (wet && (anions.Cr2O7 || 0) > 0.02 && hasReducer && netPre < -0.04 && (amt.h2o2 || 0) === 0) {
    redox.cr2o7Reduced = true;
    cr3Green += anions.Cr2O7;
    addCat('Cr', anions.Cr2O7 * 0.8);
    if ((cations.Fe2 || 0) > 0) {
      addCat('Fe3', cations.Fe2);
      cations.Fe2 = 0;
    }
    anions.Cr2O7 = 0;
  }

  // Окисление хрома(III) пероксидом водорода в щелочной среде → жёлтый хромат CrO₄²⁻
  if (wet && (cations.Cr || 0) > 0.03 && (amt.h2o2 || 0) > 0 && netPre > 0.18) {
    addAn('Cr2O7', cations.Cr);
    cr3Green = 0;
    cations.Cr = 0;
    redox.cr3ToCrO4 = true;
  }

  // Окисление Fe²⁺ пероксидом водорода (мгновенное побурение осадка Fe(OH)₂ → Fe(OH)₃)
  if (wet && (cations.Fe2 || 0) > 0.03 && (amt.h2o2 || 0) > 0) {
    addCat('Fe3', cations.Fe2);
    cations.Fe2 = 0;
    redox.fe2OxH2O2 = true;
  }

  // Fe³⁺ окисляет I⁻ до I₂
  if (wet && (cations.Fe3 || 0) > 0.04 && (anions.I || 0) > 0.06) {
    const ox = Math.min(cations.Fe3, anions.I * 0.6);
    cations.Fe3 -= ox;
    addCat('Fe2', ox);
    freeIodine += ox * 0.7;
    redox.feOxI = true;
  }

  // Обесцвечивание иодной и бромной воды тиосульфатом, сульфитом, муравьиной к-той, щёлочью, фенолом или ацетиленом
  const clearsHalogen =
    (amt.na2so3 || 0) > 0 ||
    (amt.na2s2o3 || 0) > 0 ||
    (amt.h2so3 || 0) > 0 ||
    netPre > 0.25;
  if (freeIodine > 0 && clearsHalogen) {
    freeIodine = 0;
    redox.iodineCleared = true;
  }
  if (freeBromine > 0 && (clearsHalogen || (amt.phenol || 0) > 0 || (amt.cac2 || 0) > 0 || (amt.hcooh || 0) > 0)) {
    freeBromine = 0;
    redox.bromineCleared = true;
  }

  // 6. Расчёт pH раствора (с учётом гидролиза солей и ацетатного буфера)
  let pH = null;
  const net = baseEq - acidEq;
  if (wet) {
    const effVol = Math.max(6, vol);
    // Ацетатный буфер (CH₃COOH + CH₃COONa без избытка сильных кислот/щелочей)
    if ((amt.ch3cooh || 0) > 0 && (amt.ch3coona || 0) > 0 && strongAcidEq < 0.02 && strongBaseEq < 0.02) {
      const ratio = (amt.ch3coona || 1) / Math.max(1, amt.ch3cooh || 1);
      pH = Math.max(3.6, Math.min(5.9, 4.75 + Math.log10(ratio)));
    } else if (coHydrolysis && Math.abs(net) < 0.2) {
      pH = 7.8;
    } else if (net < -0.035) {
      const conc = (-net * 10) / effVol;
      if (strongAcidEq > 0.02) {
        pH = Math.max(0.6, Math.min(3.6, 1.4 - Math.log10(Math.max(0.04, conc))));
      } else {
        pH = Math.max(2.3, Math.min(5.2, weakAcidPh - 0.4 * Math.log10(Math.max(0.1, conc))));
      }
    } else if (net > 0.035) {
      const conc = (net * 10) / effVol;
      if (strongBaseEq > 0.02) {
        pH = Math.min(13.6, Math.max(10.5, 12.6 + Math.log10(Math.max(0.05, conc))));
      } else {
        pH = Math.min(11.6, Math.max(9.0, 10.6 + 0.5 * Math.log10(Math.max(0.1, conc))));
      }
    } else {
      // Вблизи точки эквивалентности — учёт гидролиза солей
      if ((anions.CO3 || 0) > 0.04 || (anions.SiO3 || 0) > 0.04 || (anions.S || 0) > 0.04) pH = 10.7;
      else if ((anions.SO3 || 0) > 0.04 || (anions.Ac || 0) > 0.06) pH = 8.9;
      else if ((anions.HCO3 || 0) > 0.04 || (anions.NO2 || 0) > 0.04) pH = 8.3;
      else if ((cations.Al || 0) > 0.04 || (cations.Fe3 || 0) > 0.04 || (cations.Cr || 0) > 0.04) pH = 4.4;
      else if ((cations.Cu || 0) > 0.04 || (cations.Zn || 0) > 0.04 || (cations.Fe2 || 0) > 0.04 || (cations.NH4 || 0) > 0.04 || (cations.Pb || 0) > 0.04) pH = 5.4;
      else pH = 7.0;
    }
    pH = Math.round(pH * 10) / 10;
  }

  // 7. Комплексообразование и амфотерность
  const complexes = {};
  const hasPolyol = (amt.glycerol || 0) > 0 || (amt.glucose || 0) > 0;
  const hasProtein = (amt.protein || 0) > 0;

  if (wet && (cations.Fe3 || 0) > 0.02 && (anions.SCN || 0) > 0.02) {
    complexes.feSCN = true; // [Fe(SCN)]²⁺ кроваво-красный
  }
  if (wet && (cations.Fe3 || 0) > 0.02 && (amt.phenol || 0) > 0 && pH !== null && pH >= 2.2 && pH <= 8.5) {
    complexes.fePhenol = true; // Фиолетовый фенолят железа(III)
  }
  if (wet && hasProtein && (cations.Cu || 0) > 0.02 && pH !== null && pH >= 9.6) {
    complexes.biuret = true; // Биуретовая реакция (фиолетовый)
  }
  if (wet && (cations.Cu || 0) > 0.03 && nh3Eq > (cations.Cu || 0) * 1.15 && !complexes.biuret) {
    complexes.cuAmmonia = true; // [Cu(NH₃)₄]²⁺ ярко-васильковый
  }
  if (wet && (cations.Cu || 0) > 0.03 && hasPolyol && pH !== null && pH >= 9.0 && !complexes.cuAmmonia && !complexes.biuret) {
    complexes.cuPolyol = true; // Глицерат / глюконат меди(II) сапфирово-синий
  }
  if (wet && (cations.Ag || 0) > 0.02 && (anions.S2O3 || 0) > (cations.Ag || 0) * 1.35) {
    complexes.agThiosulfate = true; // Растворение AgCl/AgBr в тиосульфате [Ag(S₂O₃)₂]³⁻
  }
  if (wet && (cations.Ag || 0) > 0.02 && nh3Eq > (cations.Ag || 0) * 0.85) {
    complexes.agAmmonia = true; // Реактив Толленса [Ag(NH₃)₂]⁺
  }
  if (wet && (cations.Al || 0) > 0.03 && strongBaseEq > acidEq + (cations.Al || 0) * 1.45) {
    complexes.alHydroxo = true; // Натрия тетрагидроксоалюминат Na[Al(OH)₄]
  }
  if (wet && (cations.Cr || 0) > 0.03 && strongBaseEq > acidEq + (cations.Cr || 0) * 1.45) {
    complexes.crHydroxo = true; // Изумрудный гексагидроксохромат(III) Na₃[Cr(OH)₆]
  }
  if (wet && (cations.Zn || 0) > 0.03 && (strongBaseEq > acidEq + (cations.Zn || 0) * 1.45 || nh3Eq > (cations.Zn || 0) * 1.3)) {
    complexes.znComplex = true; // [Zn(OH)₄]²⁻ или [Zn(NH₃)₄]²⁺
  }
  if (wet && freeIodine > 0.02 && (amt.starch || 0) > 0 && state.temp < 68) {
    complexes.starchIodine = true; // Синий клатрат иод-крахмал
  }
  if (manganateGreen > 0.02) {
    complexes.manganate = true;
  }

  // 8. Осадки (с учётом кислотности среды, температуры и комплексов)
  const precipitates = [];
  const pushPr = (formula, name, color, amount = 0.6) => {
    if (!precipitates.some((p) => p.formula === formula)) {
      precipitates.push({ formula, name, color, amount });
    }
  };

  if (wet) {
    // Гексацианоферратные комплексы («берлинская лазурь», «турнбулева синь», гексацианоферрат меди)
    if ((cations.Fe3 || 0) > 0.02 && (anions.FeCN6_4 || 0) > 0.02) {
      pushPr('Fe₄[Fe(CN)₆]₃', 'тёмно-синий осадок «берлинской лазури»', '#1e3a8a', 0.95);
    }
    if ((cations.Fe2 || 0) > 0.02 && (anions.FeCN6_3 || 0) > 0.02) {
      pushPr('Fe₃[Fe(CN)₆]₂', 'тёмно-синий осадок «турнбулевой сини»', '#1d4ed8', 0.95);
    }
    if ((cations.Cu || 0) > 0.02 && (anions.FeCN6_4 || 0) > 0.02 && !complexes.cuAmmonia) {
      pushPr('Cu₂[Fe(CN)₆]', 'красно-бурый осадок гексацианоферрата(II) меди', '#7f1d1d', 0.9);
    }

    // Кислотонерастворимые сульфаты
    if ((cations.Ba || 0) > 0.03 && (anions.SO4 || 0) > 0.03) {
      pushPr('BaSO₄', 'белый мелкокристаллический осадок сульфата бария', '#ffffff', 0.9);
    }
    if ((cations.Sr || 0) > 0.03 && (anions.SO4 || 0) > 0.03) {
      pushPr('SrSO₄', 'белый осадок сульфата стронция', '#f8fafc', 0.85);
    }
    if ((cations.Pb || 0) > 0.03 && (anions.SO4 || 0) > 0.03) {
      pushPr('PbSO₄', 'белый осадок сульфата свинца(II)', '#f8fafc', 0.8);
    }

    // Малорастворимые хроматы (в нейтральной и слабокислой/щелочной среде)
    if ((anions.Cr2O7 || 0) > 0.03 && pH !== null && pH >= 5.2) {
      if ((cations.Ba || 0) > 0.03 && !precipitates.some((p) => p.formula === 'BaSO₄')) {
        pushPr('BaCrO₄', 'жёлтый осадок хромата бария', '#facc15', 0.88);
      }
      if ((cations.Pb || 0) > 0.03) {
        pushPr('PbCrO₄', 'ярко-жёлтый осадок хромата свинца(II)', '#eab308', 0.9);
      }
      if ((cations.Ag || 0) > 0.03 && !complexes.agAmmonia && !complexes.agThiosulfate) {
        pushPr('Ag₂CrO₄', 'кирпично-красный осадок хромата серебра(I)', '#b91c1c', 0.9);
      }
    }

    // Соли серебра (растворимы в тиосульфате и аммиаке сообразно прочности комплексов)
    if ((cations.Ag || 0) > 0.02 && !complexes.agAmmonia && !complexes.agThiosulfate) {
      if ((anions.S || 0) > 0.02 || (amt.h2s || 0) > 0) {
        pushPr('Ag₂S', 'чёрный осадок сульфида серебра(I)', '#18181b', 0.9);
      } else if ((anions.I || 0) > 0.02) {
        pushPr('AgI', 'жёлтый творожистый осадок иодида серебра', '#facc15', 0.9);
      } else if ((anions.Br || 0) > 0.02) {
        pushPr('AgBr', 'бледно-жёлтый осадок бромида серебра', '#fef08a', 0.85);
      } else if ((anions.Cl || 0) > 0.02) {
        pushPr('AgCl', 'белый творожистый осадок хлорида серебра', '#f8fafc', 0.9);
      } else if ((anions.PO4 || 0) > 0.03 && pH >= 5.5) {
        pushPr('Ag₃PO₄', 'жёлтый осадок ортофосфата серебра', '#fde047', 0.8);
      } else if (pH >= 8.2) {
        pushPr('Ag₂O', 'бурый осадок оксида серебра(I)', '#57534e', 0.75);
      }
    }

    // Осадок PbI₂ («золотой дождь») — растворяется в горячей воде (≥ 78 °C) и перекристаллизуется при охлаждении!
    if ((cations.Pb || 0) > 0.02) {
      if ((anions.S || 0) > 0.02 || (amt.h2s || 0) > 0) {
        pushPr('PbS', 'чёрный осадок сульфида свинца(II)', '#18181b', 0.9);
      } else if ((anions.I || 0) > 0.02 && state.temp < 78) {
        const recryst = !!state.seen?.hotPbI2;
        pushPr(
          'PbI₂',
          recryst
            ? 'крупные искрящиеся золотые чешуйки PbI₂ («золотой дождь» после перекристаллизации)'
            : 'золотисто-жёлтый осадок иодида свинца («золотой дождь»)',
          '#fbbf24',
          0.95
        );
      }
    }

    if (cuIodidePrecip) {
      pushPr('CuI', 'белый мелкокристаллический осадок иодида меди(I)', '#f5f5f4', 0.82);
    }
    if (fe3SulfideRedox) {
      pushPr('FeS', 'чёрный осадок сульфида железа(II) и серы', '#1c1917', 0.9);
    }
    if (redox.mno4Neutral || redox.manganateDisprop || ((amt.kmno4s || 0) > 0 && (prog.dry_kmno4 || 0) >= 0.45)) {
      pushPr('MnO₂', 'бурый осадок оксида марганца(IV)', '#451a03', 0.82);
    }
    if ((prog.thiosulf_s || 0) >= 0.32) {
      pushPr('S(колл.)', 'молочно-жёлтая муть коллоидной серы', '#fef08a', 0.85);
    }
    if ((amt.phenol || 0) > 0 && (amt.br2 || 0) > 0) {
      pushPr('C₆H₂Br₃OH', 'белый осадок 2,4,6-трибромфенола', '#f8fafc', 0.88);
    }
    if ((prog.xantho || 0) >= 0.4) {
      const alkOrange = pH !== null && pH >= 9.0;
      pushPr(
        'Нитробелок',
        alkOrange ? 'ярко-оранжевый сгусток белка (ксантопротеиновая реакция в щёлочи)' : 'жёлтый сгусток денатурированного белка (ксантопротеиновая реакция)',
        alkOrange ? '#ea580c' : '#facc15',
        0.88
      );
    } else if ((prog.prot_denat || 0) >= 0.5) {
      pushPr('Белок(свёрн.)', 'белые хлопья денатурированного при кипячении белка', '#f8fafc', 0.8);
    }

    if ((cations.Cu || 0) > 0.02 && ((anions.S || 0) > 0.02 || (amt.h2s || 0) > 0)) {
      pushPr('CuS', 'чёрный осадок сульфида меди(II)', '#171717', 0.9);
    }

    // Осадки карбонатов (вкл. помутнение известковой/баритовой воды от CO₂) и силикатов
    if (pH >= 6.8) {
      const limeWithCO2 = ((amt.caoh2 || 0) > 0 && (prog.lime_co2 || 0) > 0.2 && (prog.lime_co2 || 0) < 0.88);
      if (((cations.Ca || 0) > 0.03 && (anions.CO3 || 0) > 0.03) || limeWithCO2) {
        pushPr('CaCO₃', 'белое помутнение карбоната кальция', '#f8fafc', 0.8);
      }
      if ((cations.Sr || 0) > 0.03 && (anions.CO3 || 0) > 0.03 && !precipitates.some((p) => p.formula === 'SrSO₄')) {
        pushPr('SrCO₃', 'белый осадок карбоната стронция', '#f8fafc', 0.8);
      }
      if ((cations.Ba || 0) > 0.03 && (anions.CO3 || 0) > 0.03 && !precipitates.some((p) => p.formula === 'BaSO₄')) {
        pushPr('BaCO₃', 'белый осадок карбоната бария', '#f8fafc', 0.8);
      }
    }
    if ((anions.SiO3 || 0) > 0.04 && pH <= 8.6) {
      pushPr('H₂SiO₃', 'студенистый белый гель кремниевой кислоты', '#e2e8f0', 0.85);
    }

    // Гидроксиды металлов
    if (pH >= 7.4) {
      if ((cations.Cu || 0) > 0.03 && !complexes.cuAmmonia && !complexes.cuPolyol && !complexes.biuret && !precipitates.some((p) => p.formula === 'CuS' || p.formula === 'Cu₂[Fe(CN)₆]')) {
        if ((prog.cuoh2_dec || 0) >= 0.55) {
          pushPr('CuO', 'чёрный осадок оксида меди(II) (продукт разложения Cu(OH)₂)', '#1c1917', 0.85);
        } else {
          pushPr('Cu(OH)₂', 'голубой студенистый осадок гидроксида меди(II)', '#38bdf8', 0.85);
        }
      }
      if ((cations.Fe3 || 0) > 0.03 && !precipitates.some((p) => p.formula === 'Fe₄[Fe(CN)₆]₃')) {
        pushPr('Fe(OH)₃', 'бурый осадок гидроксида железа(III)', '#92400e', 0.88);
      }
      if ((cations.Fe2 || 0) > 0.03 && !precipitates.some((p) => p.formula === 'Fe₃[Fe(CN)₆]₂')) {
        pushPr('Fe(OH)₂', 'серо-зелёный осадок гидроксида железа(II)', '#65a30d', 0.82);
      }
      if ((cations.Al || 0) > 0.03 && !complexes.alHydroxo) {
        pushPr('Al(OH)₃', 'белый студенистый амфотерный осадок гидроксида алюминия', '#f1f5f9', 0.82);
      }
      if ((cations.Cr || 0) > 0.03 && !complexes.crHydroxo) {
        pushPr('Cr(OH)₃', 'серо-зелёный амфотерный осадок гидроксида хрома(III)', '#34d399', 0.84);
      }
      if ((cations.Zn || 0) > 0.03 && !complexes.znComplex) {
        pushPr('Zn(OH)₂', 'белый амфотерный осадок гидроксида цинка', '#f8fafc', 0.8);
      }
      if ((cations.Ni || 0) > 0.03 && nh3Eq <= (cations.Ni || 0) * 1.2) {
        pushPr('Ni(OH)₂', 'яблочно-зелёный осадок гидроксида никеля(II)', '#4ade80', 0.8);
      }
      if ((cations.Co || 0) > 0.03) {
        pushPr('Co(OH)₂', 'сине-розовый осадок гидроксида кобальта(II)', '#818cf8', 0.8);
      }
      if ((cations.Mg || 0) > 0.05 && pH >= 9.4) {
        pushPr('Mg(OH)₂', 'белый осадок гидроксида магния', '#f8fafc', 0.7);
      }
      if ((amt.cac2 || 0) > 0 && (prog.cac2 || 0) > 0.35) {
        pushPr('Ca(OH)₂', 'белая взвесь гашёной извести (гидролиз CaC₂)', '#f1f5f9', 0.75);
      }
    }

    // Оксид меди(I) при нагревании глюкозы с Cu(OH)₂
    if ((prog.cu2o || 0) >= 0.45) {
      pushPr('Cu₂O', 'кирпично-красный осадок оксида меди(I)', '#dc2626', 0.9);
    }
  }

  // Обугливание сахарозы конц. серной кислотой и «химический вулкан» Cr₂O₃
  if ((prog.char_sugar || 0) >= 0.35) {
    pushPr('C', 'чёрная пористая масса угля (обугливание сахарозы)', '#18181b', 1.0);
  }
  if ((prog.volcano || 0) >= 0.35) {
    pushPr('Cr₂O₃', 'тёмно-зелёный рыхлый кратер оксида хрома(III) («вулкан»)', '#166534', 1.0);
  }

  // Сухое разложение малахита, перманганата, медного купороса или нелетучие осадки после выкипания воды
  if (!wet && ((prog.dry_malach || 0) >= 0.6 || (prog.cuoh2_dec || 0) >= 0.55)) {
    pushPr('CuO', 'чёрный порошок оксида меди(II)', '#1c1917', 0.9);
  }
  if (!wet && (prog.dry_kmno4 || 0) >= 0.5) {
    pushPr('K₂MnO₄ + MnO₂', 'тёмный спек манганата калия и диоксида марганца', '#1f2937', 0.9);
  }
  if (!wet && (prog.cu2o || 0) >= 0.45) {
    pushPr('Cu₂O', 'кирпично-красный остаток оксида меди(I)', '#dc2626', 0.9);
  }
  if (!wet && (prog.dry_cuso4 || 0) >= 0.6) {
    pushPr('CuSO₄(безв.)', 'белый порошок безводного сульфата меди(II)', '#f8fafc', 0.85);
  }

  // 9. Окраска раствора (закон Бугера — Ламберта — Бера + индикаторы + адсорбция углём)
  let liquidColor = '#dff2fc';
  let liquidOpacity = 0.38;
  const hasCarbon = (amt.carbon || 0) > 0;
  const dyeFade = hasCarbon ? 0.18 : 1.0;

  if (wet) {
    const chromophores = [];
    const dil = Math.min(1.4, 25 / Math.max(8, vol));

    if (complexes.starchIodine) {
      chromophores.push(['#1e1b4b', 3.4 * dyeFade]);
      liquidOpacity = 0.88;
    } else if (complexes.feSCN) {
      chromophores.push(['#881337', 3.2]);
      liquidOpacity = 0.86;
    } else if (complexes.fePhenol) {
      chromophores.push(['#6d28d9', 2.8 * dyeFade]);
      liquidOpacity = 0.80;
    } else if (complexes.biuret) {
      chromophores.push(['#7c3aed', 2.4 * dyeFade]);
      liquidOpacity = 0.75;
    } else if (complexes.manganate) {
      chromophores.push(['#059669', 2.9]);
      liquidOpacity = 0.80;
    } else if (complexes.crHydroxo) {
      chromophores.push(['#047857', 2.4]);
      liquidOpacity = 0.74;
    } else if (complexes.cuAmmonia) {
      chromophores.push(['#1d4ed8', 2.6]);
      liquidOpacity = 0.78;
    } else if (complexes.cuPolyol) {
      if ((prog.cu2o || 0) > 0.2) {
        chromophores.push([lerpColor('#0284c7', '#ea580c', prog.cu2o), 2.3]);
      } else {
        chromophores.push(['#0284c7', 2.5]);
      }
      liquidOpacity = 0.76;
    } else {
      // Цветные ионы раствора
      if ((anions.MnO4 || 0) > 0.01) {
        chromophores.push(['#9333ea', anions.MnO4 * 3.2 * dil * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.78);
      }
      if ((anions.Cr2O7 || 0) > 0.01 && !precipitates.some((p) => p.formula === 'BaCrO₄' || p.formula === 'PbCrO₄')) {
        const crCol = pH >= 7.0 ? '#facc15' : '#f97316';
        chromophores.push([crCol, anions.Cr2O7 * 2.4 * dil]);
        liquidOpacity = Math.max(liquidOpacity, 0.72);
      }
      if (cr3Green > 0.01 && !precipitates.some((p) => p.formula === 'Cr(OH)₃')) {
        chromophores.push(['#059669', cr3Green * 2.2 * dil]);
        liquidOpacity = Math.max(liquidOpacity, 0.68);
      }
      if ((cations.Cu || 0) > 0.02 && !precipitates.some((p) => p.formula === 'Cu(OH)₂' || p.formula === 'CuO' || p.formula === 'CuS')) {
        const cuCol = concHNO3 ? '#10b981' : ((amt.cucl2 || 0) > (amt.cuso4 || 0) ? '#14b8a6' : '#38bdf8');
        chromophores.push([cuCol, cations.Cu * 1.8 * dil]);
        liquidOpacity = Math.max(liquidOpacity, 0.58);
      }
      if ((cations.Fe3 || 0) > 0.02 && !precipitates.some((p) => p.formula === 'Fe(OH)₃' || p.formula === 'Fe₄[Fe(CN)₆]₃')) {
        chromophores.push(['#d97706', cations.Fe3 * 1.9 * dil]);
        liquidOpacity = Math.max(liquidOpacity, 0.6);
      }
      if ((cations.Fe2 || 0) > 0.02 && !precipitates.some((p) => p.formula === 'Fe(OH)₂' || p.formula === 'Fe₃[Fe(CN)₆]₂')) {
        chromophores.push(['#86efac', cations.Fe2 * 1.1 * dil]);
      }
      if ((cations.Ni || 0) > 0.02 && !precipitates.some((p) => p.formula === 'Ni(OH)₂')) {
        chromophores.push(['#4ade80', cations.Ni * 1.6 * dil]);
      }
      if ((cations.Co || 0) > 0.02 && !precipitates.some((p) => p.formula === 'Co(OH)₂')) {
        chromophores.push(['#f472b6', cations.Co * 1.6 * dil]);
      }
      if ((anions.FeCN6_4 || 0) > 0.02 && precipitates.length === 0) {
        chromophores.push(['#fef08a', anions.FeCN6_4 * 1.2 * dil]);
      }
      if ((anions.FeCN6_3 || 0) > 0.02 && precipitates.length === 0) {
        chromophores.push(['#fb923c', anions.FeCN6_3 * 1.6 * dil]);
      }
      if (freeIodine > 0.015) {
        chromophores.push(['#b45309', freeIodine * 2.2 * dil * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.65);
      }
      if (freeBromine > 0.015) {
        chromophores.push(['#ea580c', freeBromine * 2.4 * dil * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.66);
      }
    }

    // Индикаторы
    if (pH !== null) {
      if ((amt.php || 0) > 0 && pH >= 8.2) {
        const strength = Math.min(1, (pH - 8.2) / 1.8);
        chromophores.push(['#ec4899', 2.4 * strength * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.66);
      }
      if ((amt.mo || 0) > 0) {
        const moCol = pH < 3.2 ? '#ef4444' : (pH > 4.5 ? '#eab308' : '#f97316');
        chromophores.push([moCol, 1.9 * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.6);
      }
      if ((amt.litmus || 0) > 0) {
        const litCol = pH < 5.0 ? '#ef4444' : (pH > 8.0 ? '#2563eb' : '#8b5cf6');
        chromophores.push([litCol, 1.9 * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.62);
      }
      if ((amt.univ || 0) > 0) {
        const scale = [
          '#b91c1c', '#dc2626', '#ea580c', '#f59e0b', '#eab308',
          '#84cc16', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6',
          '#6366f1', '#7c3aed', '#6d28d9'
        ];
        const idx = Math.max(0, Math.min(scale.length - 1, Math.round(pH - 1)));
        chromophores.push([scale[idx], 2.1 * dyeFade]);
        liquidOpacity = Math.max(liquidOpacity, 0.66);
      }
    }

    if (chromophores.length) {
      chromophores.push(['#e0f2fe', 0.65]);
      liquidColor = mixColors(chromophores);
    } else {
      liquidColor = '#dff2fc';
    }
  }

  // 10. Запахи и предупреждения ТБ
  const smells = [];
  const addSmell = (s) => { if (s && !smells.includes(s)) smells.push(s); };
  if ((prog.ester || 0) >= 0.45) {
    addSmell('приятный фруктово-грушевый аромат этилацетата (сложного эфира)');
  }
  if ((prog.cuo_eth || 0) >= 0.4 || ((amt.ethanol || 0) > 0 && redox.cr2o7Reduced)) {
    addSmell('характерный запах зелёного яблока (уксусного альдегида CH₃CHO)');
  }
  if ((amt.ch3coona || 0) > 0 && pH !== null && pH < 4.2) {
    addSmell('характерный запах вытесненной уксусной кислоты CH₃COOH');
  }
  if ((prog.thiosulf_s || 0) > 0.2) {
    addSmell(GAS_INFO.SO2.smell);
  }
  if ((amt.cac2 || 0) > 0 && wet) {
    addSmell(GAS_INFO.C2H2.smell);
  }
  for (const [id, q] of Object.entries(amt)) {
    if (q > 0 && REAGENTS[id]?.smell) {
      if (id === 'br2' && freeBromine <= 0.01) continue;
      addSmell(REAGENTS[id].smell);
    }
  }
  if (state.headspace?.gas && GAS_INFO[state.headspace.gas]?.smell && state.headspace.amount > 0.1) {
    addSmell(GAS_INFO[state.headspace.gas].smell);
  }
  if ((amt.hcl || 0) > 0 && state.temp > 55) addSmell('резкий запах хлороводорода HCl');
  if ((cations.NH4 || 0) > 0.04 && pH !== null && pH >= 9.2 && state.temp > 38) {
    addSmell(GAS_INFO.NH3.smell);
  }

  const warnings = [];
  if (concH2SO4 || concHNO3) warnings.push('Работа с концентрированными кислотами: защитные очки и перчатки обязательны');
  if (state.headspace?.gas === 'NO2' || state.headspace?.gas === 'Cl2' || freeBromine > 0.02) warnings.push('Токсичные пары галогена / оксидов азота — работать в вытяжном шкафу');
  if ((amt.k || 0) > 0 || (amt.na || 0) > 0) warnings.push('Щелочной металл: беречь от попадания брызг, работать за экраном');
  if ((amt.phenol || 0) > 0) warnings.push('Фенол ядовит и вызывает ожоги кожи — работать в перчатках');

  // 11. Катионы для окрашивания пламени (нихромовая петля)
  const flameCations = Object.keys(FLAME_COLORS).filter((c) => (cations[c] || 0) > 0.03);

  return {
    volume: Math.round(vol * 10) / 10,
    wet,
    pH,
    acidEq,
    baseEq,
    netEq: net,
    concH2SO4,
    concHNO3,
    cations,
    anions,
    precipitates,
    complexes,
    redox,
    coHydrolysis,
    displacedCu,
    displacedAg,
    liquidColor,
    liquidOpacity,
    smells,
    warnings,
    flameCations
  };
}

/**
 * Шаг динамической симуляции (теплообмен, кинетика реакций, выделение газов, кипение, сухой нагрев)
 */
export function stepSimulation(state, dt, speedX = 1) {
  const effDt = Math.min(0.25, dt) * speedX;
  if (effDt <= 0) return { events: [], activeGases: [], gasRate: 0, boiling: false };

  state.simTime += effDt;
  const events = [];
  const analysis = analyzeChemistry(state);
  const { wet, volume } = analysis;
  const amt = state.amt;
  const prog = state.prog;

  // 1. Тепловой баланс (нагрев спиртовкой + остывание по Ньютону)
  const heatCap = computeHeatCapacity(state);
  const targetAmbient = 22.0;
  if (state.heatLvl > 0) {
    if (wet) {
      // Мощность спиртовки: в пробирке закипает быстро, в стакане — плавно
      const power = [0, 38, 82, 145][state.heatLvl] || 0;
      const loss = (state.temp - targetAmbient) * 0.42;
      state.temp += ((power - loss) / Math.max(5, heatCap)) * effDt * 4.2;
      if (state.temp > 100.2) state.temp = 100.2;
    } else {
      // Сухой нагрев до ~360 °C
      const dryMax = [22, 165, 275, 370][state.heatLvl];
      state.temp += (dryMax - state.temp) * Math.min(1, effDt * 0.22);
    }
  } else {
    const coolRate = wet ? 0.055 : 0.085;
    state.temp += (targetAmbient - state.temp) * Math.min(1, effDt * coolRate * 2.2);
    if (Math.abs(state.temp - targetAmbient) < 0.08) state.temp = targetAmbient;
  }

  // Температурный коэффициент скорости Вант-Гоффа
  const tempFactor = Math.pow(1.28, Math.max(0, (state.temp - 22) / 10));

  const activeGases = [];
  let gasRate = 0; // усл. мл/с
  const emitGas = (formula, rateMlPerSec) => {
    if (rateMlPerSec <= 0.001) return;
    if (!activeGases.includes(formula)) activeGases.push(formula);
    gasRate += rateMlPerSec;
    state.seen.gases[formula] = true;
  };

  let volcanoErupting = false;
  let goldenRainSparkle = false;

  // 2. Реакции металлов и твёрдых веществ с водой, кислотами, щелочами и солями
  for (const [id, q] of Object.entries(amt)) {
    if (q <= 0) continue;
    const r = REAGENTS[id];
    if (!r || r.state !== 's') continue;
    const p = prog[id] || 0;

    // 2а. Щелочные / щёлочноземельные металлы с водой
    if (r.waterRate && wet && p < 1) {
      const rate = r.waterRate * (1.1 - 0.5 * p) * effDt * 2.4;
      prog[id] = Math.min(1, p + rate);
      emitGas('H2', rate * q * 28);
      state.temp = Math.min(100, state.temp + (rate * q * 180) / heatCap);
    }

    // 2а-2. Гидролиз карбида кальция CaC₂ + 2H₂O → Ca(OH)₂ + C₂H₂↑
    if (r.carbide && wet && p < 1) {
      const rate = 0.085 * (1.1 - 0.35 * p) * effDt * 2.4;
      prog[id] = Math.min(1, p + rate);
      emitGas('C2H2', rate * q * 34);
      state.temp = Math.min(100, state.temp + (rate * q * 95) / heatCap);
    }

    // 2б. Металлы с кислотами и солями
    if ((r.category || r.cat) === 'met' && !r.waterRate && wet && p < 1) {
      const hasOxAcid = (amt.hno3 || 0) + (amt.hno3k || 0) > 0 || analysis.concH2SO4;
      if (hasOxAcid) {
        // Пассивация Fe и Al в холодной конц. кислоте
        const passivated = r.passive && (analysis.concH2SO4 || analysis.concHNO3) && state.temp < 55;
        if (!passivated && (r.oxidizingAcidRate || r.acidRate) && analysis.acidEq > 0.03) {
          const baseR = r.oxidizingAcidRate || r.acidRate;
          const rate = baseR * tempFactor * effDt * 2.2;
          prog[id] = Math.min(1, p + rate);
          const oxGas = analysis.concHNO3 ? 'NO2' : ((amt.hno3 || 0) > 0 ? 'NO' : 'SO2');
          emitGas(oxGas, rate * q * 24);
          if (oxGas === 'NO2' || oxGas === 'NO') {
            state.headspace = { gas: 'NO2', amount: Math.min(1, (state.headspace.amount || 0) + rate * 2.8) };
          }
          state.temp = Math.min(100, state.temp + (rate * q * 120) / heatCap);
        }
      } else if (r.acidRate && analysis.netEq < -0.04) {
        const baseR = state.temp > 50 && r.acidRateHot ? r.acidRateHot : r.acidRate;
        // Гальваническая пара Zn–Cu при добавлении капель соли меди(II) ускоряет выделение H₂ в 2.6 раза!
        const galvanicBoost = (id === 'zn' && ((amt.cuso4 || 0) > 0 || (amt.cucl2 || 0) > 0 || state.coatings.copperPlated > 0.1)) ? 2.6 : 1.0;
        const acidStrength = Math.min(1.6, (-analysis.netEq) * 1.2);
        const rate = baseR * galvanicBoost * acidStrength * tempFactor * effDt * 2.4;
        prog[id] = Math.min(1, p + rate);
        emitGas('H2', rate * q * 26);
        if (galvanicBoost > 1.5 && !state.seen.galvanicZnCu) {
          state.seen.galvanicZnCu = true;
          events.push('Гальваническая пара Zn–Cu резко ускорила выделение водорода H₂↑');
        }
        if (r.exoAcid) {
          state.temp = Math.min(100, state.temp + (rate * q * r.exoAcid) / heatCap);
        }
      }

      // 2в. Амфотерные металлы со щёлочью
      const pAlk = prog[id + ':alk'] || 0;
      if (r.amph && r.baseRate && analysis.netEq > 0.08 && pAlk < 1) {
        const rate = r.baseRate * tempFactor * effDt * 2.2;
        prog[id + ':alk'] = Math.min(1, pAlk + rate);
        emitGas('H2', rate * q * 22);
      }

      // 2г. Вытеснение меди из раствора Cu²⁺
      const pDisp = prog[id + ':disp'] || 0;
      if (r.act > 2.5 && r.act < 8 && (analysis.cations.Cu || 0) > 0.04 && pDisp < 1) {
        const rate = 0.045 * tempFactor * effDt;
        prog[id + ':disp'] = Math.min(1, pDisp + rate);
        state.coatings.copperPlated = Math.min(1, prog[id + ':disp']);
        if (prog[id + ':disp'] > 0.25 && !state.seen.displacedCu) {
          state.seen.displacedCu = true;
          events.push('На поверхности металла выделился красно-медный налёт Cu');
        }
      }

      // 2г-2. Цементация серебра (Cu, Fe, Zn, Mg + AgNO₃ → блестящие дендриты серебра Ag⁰↓)
      const pAg = prog[id + ':ag'] || 0;
      if (r.act > 1.2 && r.act < 8 && (analysis.cations.Ag || 0) > 0.04 && pAg < 1) {
        const rate = 0.055 * tempFactor * effDt;
        prog[id + ':ag'] = Math.min(1, pAg + rate);
        state.coatings.silverPlated = Math.min(1, prog[id + ':ag']);
        if (prog[id + ':ag'] > 0.25 && !state.seen.displacedAg) {
          state.seen.displacedAg = true;
          events.push('Цементация серебра: металл покрылся пушистыми серебристыми кристаллами Ag⁰');
        }
      }
    }

    // 2д. Мрамор и малахит в кислоте → CO₂
    if (r.solidCarbonate && wet && analysis.netEq < -0.03 && p < 1) {
      const rate = 0.03 * tempFactor * effDt * 2.2;
      prog[id] = Math.min(1, p + rate);
      emitGas('CO2', rate * q * 30);
    }

    // 2е. Основные оксиды (CuO, MgO) в кислоте
    if (r.basicOxide && wet && analysis.netEq < -0.03 && p < 1) {
      if (!r.minTemp || state.temp >= r.minTemp) {
        const rate = 0.028 * tempFactor * effDt * 2.0;
        prog[id] = Math.min(1, p + rate);
      }
    }
  }

  // 3. Газообразование и кинетические процессы в растворах
  if (wet) {
    // Быстрое вскипание растворённых карбонатов/гидрокарбонатов/сульфитов/сульфидов с любой кислотой
    const hasAnyAcid = Object.entries(amt).some(([k, v]) => v > 0 && REAGENTS[k]?.acid);
    for (const cid of ['na2co3', 'nahco3', 'na2so3', 'na2s']) {
      if ((amt[cid] || 0) > 0 && hasAnyAcid) {
        const key = cid + ':gas';
        const gp = prog[key] || 0;
        if (gp < 1) {
          const rate = 0.22 * effDt * 2.0;
          prog[key] = Math.min(1, gp + rate);
          emitGas(REAGENTS[cid].gasAnion, rate * (amt[cid] / 5) * 18);
        }
      }
    }

    // Совместный гидролиз солей Al³⁺, Fe³⁺, Cr³⁺ с содой/сульфитом/сульфидом → осадок Me(OH)₃↓ + бурный газ!
    if (analysis.coHydrolysis && (prog.co_hyd_gas || 0) < 1) {
      const rate = 0.2 * effDt * 1.9;
      prog.co_hyd_gas = Math.min(1, (prog.co_hyd_gas || 0) + rate);
      const hydGas = (amt.na2s || 0) > 0 ? 'H2S' : ((amt.na2so3 || 0) > 0 ? 'SO2' : 'CO2');
      emitGas(hydGas, rate * 24);
      if (prog.co_hyd_gas >= 0.3 && !state.seen.coHydrolysis) {
        state.seen.coHydrolysis = true;
        events.push(`Совместный гидролиз: выпал студенистый гидроксид и вскипел газ ${GAS_INFO[hydGas]?.formula || hydGas}↑`);
      }
    }

    // Тиосульфат натрия + кислота → муть коллоидной серы S↓ + сернистый газ SO₂↑
    if ((amt.na2s2o3 || 0) > 0 && hasAnyAcid && analysis.netEq < -0.02 && (prog.thiosulf_s || 0) < 1) {
      const rate = 0.095 * tempFactor * effDt * 1.5;
      prog.thiosulf_s = Math.min(1, (prog.thiosulf_s || 0) + rate);
      emitGas('SO2', rate * 18);
      if (prog.thiosulf_s >= 0.35 && !state.seen.precipitates['S(колл.)']) {
        state.seen.precipitates['S(колл.)'] = true;
        events.push('Раствор тиосульфата помутнел: выделилась коллоидная сера S↓ и запах SO₂');
      }
    }

    // Нитрит натрия + сильная кислота → распад HNO₂ с выделением бурого газа NO₂ над раствором
    if ((amt.nano2 || 0) > 0 && hasAnyAcid && analysis.netEq < -0.03 && (prog.no2_dec || 0) < 1) {
      const rate = 0.14 * tempFactor * effDt;
      prog.no2_dec = Math.min(1, (prog.no2_dec || 0) + rate);
      emitGas('NO2', rate * 16);
      state.headspace = { gas: 'NO2', amount: Math.min(1, (state.headspace.amount || 0) + rate * 2.2) };
    }

    // Окисление муравьиной кислоты HCOOH или H₂O₂ подкисленным перманганатом → бурное выделение CO₂↑ / O₂↑
    if (((amt.kmno4 || 0) > 0 || (amt.kmno4s || 0) > 0) && analysis.netEq < -0.03) {
      if ((amt.h2o2 || 0) > 0 && (prog.mno4_h2o2 || 0) < 1) {
        const rate = 0.16 * effDt * 1.8;
        prog.mno4_h2o2 = Math.min(1, (prog.mno4_h2o2 || 0) + rate);
        emitGas('O2', rate * 24);
      }
      if ((amt.hcooh || 0) > 0 && state.temp >= 35 && (prog.mno4_hcooh || 0) < 1) {
        const rate = 0.12 * tempFactor * effDt;
        prog.mno4_hcooh = Math.min(1, (prog.mno4_hcooh || 0) + rate);
        emitGas('CO2', rate * 20);
      }
    }

    // Помутнение известковой воды Ca(OH)₂ при пропускании CO₂ и последующее просветление в избытке CO₂!
    if ((amt.caoh2 || 0) > 0 && activeGases.includes('CO2') && (prog.lime_co2 || 0) < 1) {
      prog.lime_co2 = Math.min(1, (prog.lime_co2 || 0) + 0.12 * effDt);
      if (prog.lime_co2 >= 0.25 && !state.seen.limeTurbid) {
        state.seen.limeTurbid = true;
        events.push('Известковая вода помутнела от CO₂ — выпал осадок CaCO₃↓');
      } else if (prog.lime_co2 >= 0.9 && !state.seen.limeCleared) {
        state.seen.limeCleared = true;
        events.push('В избытке CO₂ осадок CaCO₃ растворился с переходом в гидрокарбонат Ca(HCO₃)₂');
      }
    }

    // Фиксация щелочного манганата («химический хамелеон»)
    if (analysis.complexes.manganate && !state.seen.manganate) {
      state.seen.manganate = true;
      events.push('«Химический хамелеон»: раствор приобрёл изумрудно-зелёную окраску манганат-иона MnO₄²⁻');
    }

    // Перекристаллизация «золотого дождя» PbI₂: растворение при t ≥ 78 °C и искрящийся листопад при остывании!
    if ((analysis.cations.Pb || 0) > 0.02 && (analysis.anions.I || 0) > 0.02) {
      if (state.temp >= 78 && !state.seen.hotPbI2) {
        state.seen.hotPbI2 = true;
        events.push('В горячей воде жёлтый осадок PbI₂ полностью растворился — охладите сосуд для «золотого дождя»!');
      } else if (state.seen.hotPbI2 && state.temp < 72) {
        goldenRainSparkle = true;
        if (!state.seen.goldenRainRecryst) {
          state.seen.goldenRainRecryst = true;
          events.push('Кристаллизация «золотого дождя»: в остывающем растворе кружатся крупные золотые чешуйки PbI₂!');
        }
      }
    }

    // Разложение пероксида водорода с катализатором MnO₂
    if ((amt.h2o2 || 0) > 0 && (amt.mno2 || 0) > 0 && (prog.h2o2_dec || 0) < 1) {
      const rate = 0.085 * tempFactor * effDt * 1.8;
      prog.h2o2_dec = Math.min(1, (prog.h2o2_dec || 0) + rate);
      emitGas('O2', rate * (amt.h2o2 / 5) * 26);
      state.temp = Math.min(100, state.temp + (rate * 28) / heatCap);
    }

    // Соли аммония со щёлочью при нагревании → NH₃↑
    if ((analysis.cations.NH4 || 0) > 0.04 && analysis.pH !== null && analysis.pH >= 9.5 && state.temp >= 45 && (prog.nh3_evo || 0) < 1) {
      const rate = 0.045 * tempFactor * effDt;
      prog.nh3_evo = Math.min(1, (prog.nh3_evo || 0) + rate);
      emitGas('NH3', rate * 24);
    }

    // Термическое разложение голубого осадка Cu(OH)₂ → чёрный CuO + H₂O
    const hasCuOH2 = (analysis.cations.Cu || 0) > 0.03 && analysis.pH !== null && analysis.pH >= 7.8 &&
      !analysis.complexes.cuAmmonia && !analysis.complexes.cuPolyol && !analysis.complexes.biuret;
    if (hasCuOH2 && state.temp >= 72 && (prog.cuoh2_dec || 0) < 1) {
      prog.cuoh2_dec = Math.min(1, (prog.cuoh2_dec || 0) + 0.09 * effDt * tempFactor * 0.4);
      if (prog.cuoh2_dec >= 0.55 && !state.seen.precipitates['CuO']) {
        state.seen.precipitates['CuO'] = true;
        events.push('Голубой осадок Cu(OH)₂ при нагревании почернел — образовался оксид меди(II) CuO');
      }
    }

    // Реакция «серебряного зеркала» ([Ag(NH₃)₂]⁺ + глюкоза ИЛИ муравьиная кислота HCOOH при t ≥ 50 °C)
    if (analysis.complexes.agAmmonia && ((amt.glucose || 0) > 0 || (amt.hcooh || 0) > 0) && state.temp >= 50 && (prog.ag_mirror || 0) < 1) {
      const rate = 0.075 * effDt * (1 + (state.temp - 50) / 25);
      prog.ag_mirror = Math.min(1, (prog.ag_mirror || 0) + rate);
      state.coatings.silverMirror = prog.ag_mirror;
      if ((amt.hcooh || 0) > 0) emitGas('CO2', rate * 10);
      if (prog.ag_mirror >= 0.55 && !state.seen.mirror) {
        state.seen.mirror = true;
        events.push('Стенки сосуда покрылись блестящим налётом металлического серебра («серебряное зеркало»)');
      }
    }

    // Глюкоза + Cu(OH)₂ в щёлочи при нагревании → красный осадок Cu₂O
    if (analysis.complexes.cuPolyol && (amt.glucose || 0) > 0 && state.temp >= 64 && (prog.cu2o || 0) < 1) {
      prog.cu2o = Math.min(1, (prog.cu2o || 0) + 0.07 * effDt * (1 + (state.temp - 60) / 25));
      if (prog.cu2o >= 0.5 && !state.seen.precipitates['Cu₂O']) {
        state.seen.precipitates['Cu₂O'] = true;
        events.push('Синий раствор сменился жёлтым, а затем кирпично-красным осадком Cu₂O↓');
      }
    }

    // Окисление этанола чёрным оксидом меди(II) при нагревании → розовая медь Cu + запах уксусного альдегида!
    if ((amt.ethanol || 0) > 0 && (amt.cuo || 0) > 0 && state.temp >= 58 && (prog.cuo_eth || 0) < 1) {
      prog.cuo_eth = Math.min(1, (prog.cuo_eth || 0) + 0.08 * effDt * (1 + (state.temp - 55) / 30));
      state.coatings.copperPlated = Math.max(state.coatings.copperPlated || 0, prog.cuo_eth);
      if (prog.cuo_eth >= 0.5 && !state.seen.cuoEthanol) {
        state.seen.cuoEthanol = true;
        events.push('Чёрный порошок CuO восстановился этанолом до розовой меди Cu; появился яблочный запах альдегида CH₃CHO');
      }
    }

    // Реакция этерификации: этанол + уксусная кислота + конц. H₂SO₄ + нагрев → фруктовый аромат этилацетата!
    if ((amt.ethanol || 0) > 0 && (amt.ch3cooh || 0) > 0 && (amt.h2so4k || 0) > 0 && state.temp >= 58 && (prog.ester || 0) < 1) {
      prog.ester = Math.min(1, (prog.ester || 0) + 0.085 * effDt * (1 + (state.temp - 55) / 30));
      if (prog.ester >= 0.5 && !state.seen.ester) {
        state.seen.ester = true;
        events.push('Реакция этерификации: синтезирован этилацетат с приятным фруктово-грушевым ароматом!');
      }
    }

    // Ксантопротеиновая реакция белка с азотной кислотой и тепловая денатурация белка
    if ((amt.protein || 0) > 0) {
      if (((amt.hno3 || 0) > 0 || (amt.hno3k || 0) > 0) && (analysis.concHNO3 || state.temp >= 45) && (prog.xantho || 0) < 1) {
        prog.xantho = Math.min(1, (prog.xantho || 0) + 0.12 * effDt * tempFactor);
        if (prog.xantho >= 0.45 && !state.seen.xantho) {
          state.seen.xantho = true;
          events.push('Ксантопротеиновая реакция: белок свернулся в ярко-жёлтый сгусток (нитрование бензольных колец)');
        }
      } else if (state.temp >= 80 && (prog.prot_denat || 0) < 1) {
        prog.prot_denat = Math.min(1, (prog.prot_denat || 0) + 0.1 * effDt);
        if (prog.prot_denat >= 0.5 && !state.seen.protDenat) {
          state.seen.protDenat = true;
          events.push('Тепловая денатурация: при нагревании раствор белка свернулся белыми хлопьями');
        }
      }
    }
  }

  // 4. Обугливание сахарозы конц. H₂SO₄
  if ((amt.sucrose || 0) > 0 && (amt.h2so4k || 0) >= 3 && (prog.char_sugar || 0) < 1) {
    prog.char_sugar = Math.min(1, (prog.char_sugar || 0) + 0.11 * effDt * tempFactor);
    state.coatings.carbonFoam = prog.char_sugar;
    state.temp = Math.min(100, state.temp + 4.5 * effDt);
    emitGas('SO2', 6 * effDt);
    if (prog.char_sugar >= 0.45 && !state.seen.charred) {
      state.seen.charred = true;
      events.push('Сахароза обуглилась концентрированной H₂SO₄ с подъёмом пористой чёрной массы угля');
    }
  }

  // 5. Сухой нагрев кристаллов («химический вулкан», KMnO₄, малахит, медный купорос, возгонка NH₄Cl)
  // Самоподдерживающийся экзотермический «вулкан» дихромата аммония (после запуска при 155 °C идёт сам!)
  if (!wet && (amt.nh4cr2o7 || 0) > 0 && (state.temp >= 155 || (prog.volcano || 0) > 0.03) && (prog.volcano || 0) < 1) {
    const rate = 0.11 * effDt * 1.6;
    prog.volcano = Math.min(1, (prog.volcano || 0) + rate);
    state.coatings.volcanoAsh = prog.volcano;
    state.temp = Math.min(420, state.temp + 38 * effDt);
    volcanoErupting = true;
    emitGas('N2', 28 * effDt);
    if (prog.volcano >= 0.25 && !state.seen.volcano) {
      state.seen.volcano = true;
      events.push('«Химический вулкан»! Оранжевый (NH₄)₂Cr₂O₇ бурно разлагается со снопом искр, азотом N₂↑ и зелёным пеплом Cr₂O₃');
    }
  }

  if (!wet && state.temp > 105) {
    // Термическое разложение сухого перманганата калия: 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑
    if ((amt.kmno4s || 0) > 0 && state.temp >= 195 && (prog.dry_kmno4 || 0) < 1) {
      prog.dry_kmno4 = Math.min(1, (prog.dry_kmno4 || 0) + 0.095 * effDt);
      emitGas('O2', 22 * effDt);
      if (prog.dry_kmno4 >= 0.5 && !state.seen.dryKmno4) {
        state.seen.dryKmno4 = true;
        events.push('Разложение KMnO₄: выделяется чистый кислород O₂↑, на дне остаётся спек K₂MnO₄ и MnO₂');
      }
    }
    if ((amt.malach || 0) > 0 && state.temp >= 145 && (prog.dry_malach || 0) < 1) {
      prog.dry_malach = Math.min(1, (prog.dry_malach || 0) + 0.075 * effDt);
      emitGas('CO2', 12 * effDt);
      if (prog.dry_malach >= 0.6 && !state.seen.precipitates['CuO']) {
        state.seen.precipitates['CuO'] = true;
        events.push('Зелёный малахит разложился на чёрный порошок CuO, углекислый газ и капли воды на стенках');
      }
    }
    if ((amt.cuso4s || 0) > 0 && state.temp >= 115 && (prog.dry_cuso4 || 0) < 1) {
      prog.dry_cuso4 = Math.min(1, (prog.dry_cuso4 || 0) + 0.08 * effDt);
      state.coatings.anhydrousWhite = prog.dry_cuso4;
      if (prog.dry_cuso4 >= 0.6 && !state.seen.precipitates['CuSO₄(безв.)']) {
        state.seen.precipitates['CuSO₄(безв.)'] = true;
        events.push('Синие кристаллы CuSO₄·5H₂O побелели — образовался безводный сульфат меди(II)');
      }
    }
    if ((amt.nh4cls || 0) > 0 && state.temp >= 165 && (prog.subl_nh4cl || 0) < 1) {
      prog.subl_nh4cl = Math.min(1, (prog.subl_nh4cl || 0) + 0.085 * effDt);
      state.coatings.sublimedRing = prog.subl_nh4cl;
      if (prog.subl_nh4cl >= 0.5 && !state.seen.sublimed) {
        state.seen.sublimed = true;
        events.push('Возгонка NH₄Cl: кристаллы со дна испарились и осели белым кольцом у холодного горлышка');
      }
    }
  }

  // 6. Сбор газа через газоотводную трубку (вытеснением воды)
  if (state.tubeOn && activeGases.length > 0 && gasRate > 0) {
    for (const g of activeGases) {
      const info = GAS_INFO[g];
      if (info && !info.soluble) {
        const curTotal = Object.values(state.collectedGas).reduce((a, b) => a + b, 0);
        if (curTotal < 25) {
          const added = Math.min(25 - curTotal, gasRate * effDt * 0.45);
          state.collectedGas[g] = Math.round(((state.collectedGas[g] || 0) + added) * 10) / 10;
        }
      } else if (info && info.soluble && !state.seen['warnSol_' + g]) {
        state.seen['warnSol_' + g] = true;
        events.push(`Газ ${info.formula} хорошо растворим в воде — собрать его вытеснением воды нельзя`);
      }
    }
  }

  // Постепенное рассеивание газа в открытом сосуде (кроме закрытого трубкой)
  if (state.headspace.amount > 0 && !state.tubeOn && activeGases.length === 0) {
    state.headspace.amount = Math.max(0, state.headspace.amount - effDt * 0.015);
    if (state.headspace.amount < 0.02) state.headspace.gas = '';
  }

  // 7. Выкипание растворителя при кипении (~99–100 °C)
  const boiling = wet && state.temp >= 98.2 && state.heatLvl > 0;
  if (boiling && volume > 0) {
    state.evapMl = (state.evapMl || 0) + effDt * (0.16 + state.heatLvl * 0.12);
  }

  // 8. Фиксация наблюдений осадков, комплексов и ОВР
  const postAnalysis = analyzeChemistry(state);
  for (const pr of postAnalysis.precipitates) {
    state.seen.precipitates[pr.formula] = true;
  }
  for (const [ck, cv] of Object.entries(postAnalysis.complexes)) {
    if (cv) state.seen.complexes[ck] = true;
  }
  for (const [rk, rv] of Object.entries(postAnalysis.redox)) {
    if (rv) state.seen.redox[rk] = true;
  }

  return {
    events,
    activeGases,
    gasRate,
    boiling,
    volcanoErupting,
    goldenRainSparkle,
    analysis: postAnalysis
  };
}
