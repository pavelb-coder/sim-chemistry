import { REAGENTS } from './reagents.js?v=2.2.1';

const ION_LABELS = {
  Li: ['Li⁺', '#fb7185'],
  Na: ['Na⁺', '#fbbf24'],
  K:  ['K⁺',  '#c084fc'],
  Ca: ['Ca²⁺', '#fb923c'],
  Sr: ['Sr²⁺', '#e11d48'],
  Ba: ['Ba²⁺', '#a3e635'],
  Mg: ['Mg²⁺', '#94a3b8'],
  Al: ['Al³⁺', '#cbd5e1'],
  Cr: ['Cr³⁺', '#10b981'],
  Zn: ['Zn²⁺', '#94a3b8'],
  Fe2:['Fe²⁺', '#4ade80'],
  Fe3:['Fe³⁺', '#f59e0b'],
  Ni: ['Ni²⁺', '#22c55e'],
  Co: ['Co²⁺', '#f472b6'],
  Cu: ['Cu²⁺', '#38bdf8'],
  Ag: ['Ag⁺',  '#e2e8f0'],
  Pb: ['Pb²⁺', '#9ca3af'],
  NH4:['NH₄⁺', '#2dd4bf'],
  Mn: ['Mn²⁺', '#fbcfe8'],
  Cl: ['Cl⁻',  '#4ade80'],
  Br: ['Br⁻',  '#facc15'],
  I:  ['I⁻',   '#f59e0b'],
  SO4:['SO₄²⁻','#60a5fa'],
  NO3:['NO₃⁻', '#818cf8'],
  NO2:['NO₂⁻', '#60a5fa'],
  PO4:['PO₄³⁻','#a78bfa'],
  CO3:['CO₃²⁻','#34d399'],
  HCO3:['HCO₃⁻','#5eead4'],
  SO3:['SO₃²⁻','#fcd34d'],
  S2O3:['S₂O₃²⁻','#fbbf24'],
  S:  ['S²⁻',  '#fde047'],
  SiO3:['SiO₃²⁻','#cbd5e1'],
  SCN:['SCN⁻', '#f87171'],
  FeCN6_4:['[Fe(CN)₆]⁴⁻','#fde047'],
  FeCN6_3:['[Fe(CN)₆]³⁻','#fb923c'],
  MnO4:['MnO₄⁻','#a855f7'],
  Cr2O7:['Cr₂O₇²⁻','#fb923c'],
  HCOO:['HCOO⁻','#cbd5e1'],
  Ac: ['CH₃COO⁻','#d6d3d1']
};

export function describeMicroState(state, analysis) {
  const amt = state.amt || {};
  const wet = analysis.wet;

  if (!wet) {
    if ((amt.nh4cr2o7 || 0) > 0 && ((state.prog.volcano || 0) > 0.05 || state.temp >= 155)) {
      return {
        title: 'Внутримолекулярная ОВР: «Химический вулкан»',
        equation: '(NH₄)₂Cr₂O₇ →(t°) Cr₂O₃ + N₂↑ + 4H₂O↑  + Q',
        caption: 'Катион NH₄⁺ (восстановитель, N⁻³) окисляется дихромат-ионом Cr₂O₇²⁻ (Cr⁺⁶) до молекулярного азота N₂⁰ и рыхлого зелёного оксида Cr₂O₃.',
        mode: 'sublime',
        species: [
          { label: 'N₂', color: '#93c5fd', count: 9, gas: true },
          { label: 'H₂O', color: '#e0f2fe', count: 6, gas: true }
        ],
        lattice: { label: 'Cr₂O₃', color: '#166534' }
      };
    }
    if ((amt.kmno4s || 0) > 0 && state.temp >= 190) {
      return {
        title: 'Термическое разложение перманганата калия',
        equation: '2KMnO₄ →(t°) K₂MnO₄ + MnO₂ + O₂↑',
        caption: 'При нагревании кристаллы отщепляют чистый кислород O₂, превращаясь в смесь манганата калия (+6) и диоксида марганца (+4).',
        mode: 'sublime',
        species: [{ label: 'O₂', color: '#60a5fa', count: 10, gas: true }],
        lattice: { label: 'K₂MnO₄·MnO₂', color: '#374151' }
      };
    }
    if ((amt.nh4cls || 0) > 0 && state.temp > 165) {
      return {
        title: 'Термическая диссоциация (возгонка) NH₄Cl',
        equation: 'NH₄Cl(тв.) ⇄ NH₃↑ + HCl↑',
        caption: 'Кристаллическая решётка на горячем дне распадается на летучие молекулы NH₃ и HCl, которые у холодного горлышка вновь соединяются.',
        mode: 'sublime',
        species: [
          { label: 'NH₃', color: '#38bdf8', count: 7, gas: true },
          { label: 'HCl', color: '#4ade80', count: 7, gas: true }
        ],
        lattice: { label: 'NH₄Cl', color: '#f1f5f9' }
      };
    }
    const drySolid = Object.keys(amt).find((k) => amt[k] > 0 && REAGENTS[k]?.state === 's');
    if (drySolid) {
      const r = REAGENTS[drySolid];
      return {
        title: `Кристаллическая решётка: ${r.formula}`,
        equation: `${r.formula}(тв.) — упорядоченные узлы решётки`,
        caption: 'В твёрдом веществе атомы или ионы совершают тепловые колебания вокруг узлов решётки. Добавьте растворитель или нагрейте сосуд.',
        mode: 'dry_solid',
        species: [],
        lattice: { label: r.formula, color: r.color }
      };
    }
    if (state.headspace?.gas === 'Cl2') {
      return {
        title: 'Газообразный хлор в сосуде',
        equation: 'Cl₂ (двухатомные молекулы газа)',
        caption: 'Тяжёлые жёлто-зелёные молекулы Cl₂ хаотично движутся в объёме колбы.',
        mode: 'gas_only',
        species: [{ label: 'Cl₂', color: '#bef264', count: 14, gas: true }]
      };
    }
    return {
      title: 'Сосуд пуст (воздух)',
      equation: 'N₂ (78 %), O₂ (21 %), Ar (1 %)',
      caption: 'Добавьте в сосуд раствор или твёрдый реактив, чтобы увидеть гидратированные ионы, кристаллическую решётку и столкновения частиц.',
      mode: 'empty',
      species: [
        { label: 'N₂', color: '#94a3b8', count: 8, gas: true },
        { label: 'O₂', color: '#60a5fa', count: 3, gas: true }
      ]
    };
  }

  // Жидкая фаза
  if ((amt.cac2 || 0) > 0 && (state.prog.cac2 || 0) < 0.99) {
    return {
      title: 'Гидролиз карбида кальция (получение ацетилена)',
      equation: 'CaC₂ + 2H₂O → Ca(OH)₂↓ + HC≡CH↑',
      caption: 'Ацетилид-ионы C₂²⁻ необратимо протонируются молекулами воды с выделением пузырьков ацетилена C₂H₂ и щелочной взвеси Ca(OH)₂.',
      mode: 'metal_gas',
      lattice: { label: 'CaC₂', color: '#57534e' },
      species: [
        { label: 'C₂H₂', color: '#fb923c', count: 7, gas: true },
        { label: 'Ca²⁺', color: '#fb923c', count: 5 },
        { label: 'OH⁻', color: '#38bdf8', count: 6 }
      ]
    };
  }

  if (analysis.displacedAg) {
    return {
      title: 'Цементация металлического серебра',
      equation: 'Cu⁰ + 2Ag⁺ → Cu²⁺ + 2Ag⁰↓',
      caption: 'Атомы меди передают электроны катионам серебра: на поверхности растут блестящие дендриты Ag⁰, а раствор голубеет от ионов Cu²⁺.',
      mode: 'displacement',
      lattice: { label: 'Cu⁰ / Ag⁰', color: '#f8fafc' },
      species: [
        { label: 'Ag⁺', color: '#e2e8f0', count: 4 },
        { label: 'Cu²⁺', color: '#38bdf8', count: 6 },
        { label: 'NO₃⁻', color: '#818cf8', count: 6 }
      ]
    };
  }

  if (analysis.displacedCu) {
    return {
      title: 'Контактное вытеснение меди металлом',
      equation: 'Fe⁰ + Cu²⁺ → Fe²⁺ + Cu⁰↓',
      caption: 'Атомы более активного металла отдают электроны катионам Cu²⁺: медь оседает красным слоем на поверхности, а ионы Fe²⁺ уходят в раствор.',
      mode: 'displacement',
      lattice: { label: 'Fe⁰ / Cu⁰', color: '#c8753c' },
      species: [
        { label: 'Cu²⁺', color: '#38bdf8', count: 5 },
        { label: 'Fe²⁺', color: '#4ade80', count: 7 },
        { label: 'SO₄²⁻', color: '#60a5fa', count: 6 }
      ]
    };
  }

  if (state.electrolysisOn) {
    if (!analysis.isElectrolyte) {
      return {
        title: 'Проверка электропроводности: НЕЭЛЕКТРОЛИТ (I = 0,00 А)',
        equation: 'Молекулярный раствор (ионная диссоциация отсутствует)',
        caption: 'В воде или растворе органического вещества (глюкоза, сахароза, этанол, глицерин) почти нет свободных гидратированных ионов — электрическая цепь разомкнута.',
        mode: 'solution',
        species: [
          { label: 'H₂O', color: '#93c5fd', count: 14 },
          { label: (amt.glucose || 0) > 0 ? 'C₆H₁₂O₆' : ((amt.ethanol || 0) > 0 ? 'C₂H₅OH' : 'Молек.'), color: '#fbbf24', count: 6 }
        ]
      };
    }
    const sumObj = state.electrolysisSummary;
    const eqText = sumObj && typeof sumObj === 'object'
      ? `К(−): ${sumObj.cathode} · А(+): ${sumObj.anode}`
      : (sumObj || 'Катод (−): восстановление · Анод (+): окисление');
    return {
      title: `Электролиз водного раствора (ток I = ${analysis.currentAmp.toFixed(2).replace('.', ',')} А)`,
      equation: eqText,
      caption: 'Под действием электрического поля катионы мигрируют к отрицательному катоду (−), а анионы — к положительному графитовому аноду (+).',
      mode: 'solution',
      species: [
        { label: 'Катод (−)', color: '#38bdf8', count: 5 },
        { label: 'Анод (+)', color: '#34d399', count: 5 },
        { label: 'e⁻', color: '#fde047', count: 8 }
      ]
    };
  }

  if ((state.prog.ester || 0) >= 0.35) {
    return {
      title: 'Реакция этерификации (синтез этилацетата)',
      equation: 'CH₃COOH + C₂H₅OH ⇄(H₂SO₄, t°) CH₃COOC₂H₅ + H₂O',
      caption: 'Концентрированная H₂SO₄ протонирует карбоксильную группу и связывает воду, смещая равновесие в сторону летучего фруктового эфира.',
      mode: 'solution',
      species: [
        { label: 'CH₃COOC₂H₅', color: '#fbbf24', count: 8 },
        { label: 'C₂H₅OH', color: '#93c5fd', count: 4 },
        { label: 'H₃O⁺', color: '#ef4444', count: 4 }
      ]
    };
  }

  if ((state.prog.cuo_eth || 0) >= 0.35) {
    return {
      title: 'Окисление первичного спирта оксидом меди(II)',
      equation: 'C₂H₅OH + CuO →(t°) CH₃CHO + Cu⁰↓ + H₂O',
      caption: 'Чёрный оксид меди(II) восстанавливается этанолом до розовой металлической меди с образованием уксусного альдегида.',
      mode: 'displacement',
      lattice: { label: 'Cu⁰', color: '#c8753c' },
      species: [
        { label: 'CH₃CHO', color: '#34d399', count: 7 },
        { label: 'C₂H₅OH', color: '#93c5fd', count: 5 }
      ]
    };
  }

  if (state.coatings.silverMirror > 0.1 || (analysis.complexes.agAmmonia && ((amt.glucose || 0) > 0 || (amt.hcooh || 0) > 0) && state.temp >= 50)) {
    return {
      title: 'Реакция «серебряного зеркала»',
      equation: 'R–CHO + 2[Ag(NH₃)₂]⁺ + 2OH⁻ → R–COO⁻ + 2Ag⁰↓ + 4NH₃ + H₂O',
      caption: 'Альдегидная группа глюкозы или муравьиной кислоты восстанавливает аммиачный комплекс серебра до зеркальной плёнки Ag⁰.',
      mode: 'solution',
      species: [
        { label: '[Ag(NH₃)₂]⁺', color: '#e2e8f0', count: 5 },
        { label: 'Ag⁰', color: '#f8fafc', count: 7 },
        { label: (amt.hcooh || 0) > 0 ? 'HCOOH' : 'C₆H₁₂O₆', color: '#fbbf24', count: 4 }
      ]
    };
  }

  // Растворение металла с выделением H₂
  const activeMetal = Object.keys(amt).find(
    (k) => amt[k] > 0 && (REAGENTS[k]?.category || REAGENTS[k]?.cat) === 'met' && (state.prog[k] || 0) > 0 && (state.prog[k] || 0) < 1
  );
  if (activeMetal) {
    const r = REAGENTS[activeMetal];
    const [ionLbl, ionCol] = ION_LABELS[r.ion] || [r.formula + '⁺', '#60a5fa'];
    const isWater = !!r.waterRate;
    return {
      title: isWater ? `Взаимодействие ${r.formula} с водой` : `Растворение металла ${r.formula} в кислоте`,
      equation: isWater
        ? `2${r.formula}⁰ + 2H₂O → 2${ionLbl} + 2OH⁻ + H₂↑`
        : `${r.formula}⁰ + 2H⁺ → ${ionLbl} + H₂↑`,
      caption: 'На границе раздела фаз атомы металла передают электроны протонам водорода: катионы переходят в раствор, а молекулы H₂ всплывают пузырьками.',
      mode: 'metal_gas',
      lattice: { label: r.formula + '⁰', color: r.color },
      species: [
        { label: ionLbl, color: ionCol, count: 6 },
        { label: isWater ? 'OH⁻' : 'H⁺', color: isWater ? '#60a5fa' : '#f87171', count: 6 },
        { label: 'H₂', color: '#ffffff', count: 6, gas: true }
      ]
    };
  }

  // Комплексы
  if (analysis.complexes.feSCN) {
    return {
      title: 'Роданидный комплекс железа(III)',
      equation: 'Fe³⁺ + nSCN⁻ ⇄ [Fe(SCN)ₙ]³⁻ⁿ (кроваво-красный)',
      caption: 'Тиоцианат-ионы координируются вокруг катиона Fe³⁺, вызывая интенсивное поглощение света в зелёно-синей области спектра.',
      mode: 'solution',
      species: [
        { label: '[Fe(SCN)]²⁺', color: '#e11d48', count: 9 },
        { label: 'K⁺', color: '#c084fc', count: 5 },
        { label: 'Cl⁻', color: '#4ade80', count: 5 }
      ]
    };
  }
  if (analysis.complexes.cuAmmonia) {
    return {
      title: 'Аммиакат меди(II)',
      equation: 'Cu(OH)₂↓ + 4NH₃ → [Cu(NH₃)₄]²⁺ + 2OH⁻',
      caption: 'Молекулы аммиака вытесняют воду и гидроксид-ионы из внутренней сферы меди, переводя осадок в ярко-синий комплексный катион.',
      mode: 'solution',
      species: [
        { label: '[Cu(NH₃)₄]²⁺', color: '#2563eb', count: 8 },
        { label: 'OH⁻', color: '#38bdf8', count: 5 },
        { label: 'SO₄²⁻', color: '#60a5fa', count: 4 }
      ]
    };
  }
  if (analysis.complexes.alHydroxo) {
    return {
      title: 'Растворение амфотерного осадка в избытке щёлочи',
      equation: 'Al(OH)₃↓ + OH⁻ → [Al(OH)₄]⁻',
      caption: 'Амфотерный гидроксид алюминия связывает дополнительный гидроксид-ион, превращаясь в растворимый тетрагидроксоалюминат-анион.',
      mode: 'solution',
      species: [
        { label: '[Al(OH)₄]⁻', color: '#38bdf8', count: 7 },
        { label: 'Na⁺', color: '#fbbf24', count: 8 },
        { label: 'Cl⁻', color: '#4ade80', count: 5 }
      ]
    };
  }
  if (analysis.complexes.fePhenol) {
    return {
      title: 'Качественная реакция на фенол с FeCl₃',
      equation: '6C₆H₅OH + Fe³⁺ ⇄ [Fe(OC₆H₅)₆]³⁻ + 6H⁺ (фиолетовый)',
      caption: 'Фенолят-лиганды образуют с катионом железа(III) интенсивно окрашенный фиолетовый комплекс.',
      mode: 'solution',
      species: [
        { label: '[Fe(OC₆H₅)₆]³⁻', color: '#7c3aed', count: 8 },
        { label: 'C₆H₅OH', color: '#f472b6', count: 4 }
      ]
    };
  }
  if (analysis.complexes.manganate) {
    return {
      title: '«Химический хамелеон» — манганат-ион в щёлочи',
      equation: '2MnO₄⁻ + SO₃²⁻ + 2OH⁻ → 2MnO₄²⁻(зел.) + SO₄²⁻ + H₂O',
      caption: 'В сильнощелочной среде фиолетовый MnO₄⁻ (+7) принимает всего 1 электрон, переходя в устойчивый изумрудно-зелёный манганат MnO₄²⁻ (+6).',
      mode: 'solution',
      species: [
        { label: 'MnO₄²⁻', color: '#059669', count: 9 },
        { label: 'OH⁻', color: '#38bdf8', count: 6 },
        { label: 'K⁺', color: '#c084fc', count: 5 }
      ]
    };
  }
  if (analysis.complexes.agThiosulfate) {
    return {
      title: 'Фиксажный комплекс тиосульфата серебра',
      equation: 'AgCl↓ + 2S₂O₃²⁻ → [Ag(S₂O₃)₂]³⁻ + Cl⁻',
      caption: 'Прочный дитиосульфатоаргентат-комплекс переводит галогенид серебра в прозрачный раствор (классический процесс фотографического фиксирования).',
      mode: 'solution',
      species: [
        { label: '[Ag(S₂O₃)₂]³⁻', color: '#bae6fd', count: 8 },
        { label: 'Na⁺', color: '#fbbf24', count: 6 }
      ]
    };
  }
  if (analysis.complexes.crHydroxo) {
    return {
      title: 'Амфотерный гидроксокомплекс хрома(III)',
      equation: 'Cr(OH)₃↓ + 3OH⁻ → [Cr(OH)₆]³⁻ (изумрудный)',
      caption: 'Серо-зелёный осадок Cr(OH)₃ растворяется в избытке концентрированной щёлочи с образованием гексагидроксохромата(III).',
      mode: 'solution',
      species: [
        { label: '[Cr(OH)₆]³⁻', color: '#059669', count: 8 },
        { label: 'Na⁺', color: '#fbbf24', count: 7 }
      ]
    };
  }
  if (analysis.complexes.starchIodine) {
    return {
      title: 'Клатратный комплекс иода с амилозой крахмала',
      equation: 'I₂ + (C₆H₁₀O₅)ₙ ⇄ [I₂·крахмал] (тёмно-синий)',
      caption: 'Молекулы I₂ встраиваются внутрь спиральных макромолекул амилозы. При нагревании выше 68 °C спирали раскручиваются и окраска обратимо исчезает.',
      mode: 'solution',
      species: [
        { label: 'I₂·Амилоза', color: '#312e81', count: 8 },
        { label: 'I₂', color: '#d97706', count: 4 }
      ]
    };
  }

  if (analysis.coHydrolysis && analysis.precipitates.length > 0) {
    const pr = analysis.precipitates[0];
    return {
      title: 'Необратимый совместный (взаимный) гидролиз',
      equation: `2${pr.formula.replace('(OH)₃', '³⁺')} + 3CO₃²⁻ + 3H₂O → 2${pr.formula}↓ + 3CO₂↑`,
      caption: 'Гидролиз катиона по кислотному типу и аниона по основному взаимно усиливают друг друга до полного распада на осадок гидроксида и газ.',
      mode: 'precipitate',
      precip: pr,
      species: [
        { label: 'CO₂', color: '#94a3b8', count: 6, gas: true },
        { label: 'Na⁺', color: '#fbbf24', count: 5 },
        { label: 'Cl⁻', color: '#4ade80', count: 5 }
      ]
    };
  }

  // Осадки
  if (analysis.precipitates.length > 0) {
    const pr = analysis.precipitates[0];
    const eqMap = {
      'AgCl': 'Ag⁺ + Cl⁻ → AgCl↓',
      'AgBr': 'Ag⁺ + Br⁻ → AgBr↓',
      'AgI': 'Ag⁺ + I⁻ → AgI↓',
      'BaSO₄': 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
      'SrSO₄': 'Sr²⁺ + SO₄²⁻ → SrSO₄↓',
      'BaCrO₄': 'Ba²⁺ + CrO₄²⁻ → BaCrO₄↓',
      'PbCrO₄': 'Pb²⁺ + CrO₄²⁻ → PbCrO₄↓',
      'Ag₂CrO₄': '2Ag⁺ + CrO₄²⁻ → Ag₂CrO₄↓ (кирпично-красный)',
      'Fe₄[Fe(CN)₆]₃': '4Fe³⁺ + 3[Fe(CN)₆]⁴⁻ → Fe₄[Fe(CN)₆]₃↓ («берлинская лазурь»)',
      'Fe₃[Fe(CN)₆]₂': '3Fe²⁺ + 2[Fe(CN)₆]³⁻ → Fe₃[Fe(CN)₆]₂↓ («турнбулева синь»)',
      'Cu₂[Fe(CN)₆]': '2Cu²⁺ + [Fe(CN)₆]⁴⁻ → Cu₂[Fe(CN)₆]↓',
      'PbI₂': 'Pb²⁺ + 2I⁻ ⇄ PbI₂↓ («золотой дождь»)',
      'CuI': '2Cu²⁺ + 4I⁻ → 2CuI↓ + I₂',
      'S(колл.)': 'S₂O₃²⁻ + 2H⁺ → S↓ + SO₂↑ + H₂O',
      'MnO₂': '2MnO₄⁻ + 3SO₃²⁻ + H₂O → 2MnO₂↓ + 3SO₄²⁻ + 2OH⁻',
      'C₆H₂Br₃OH': 'C₆H₅OH + 3Br₂ → C₆H₂Br₃OH↓ + 3HBr',
      'Cu(OH)₂': 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓',
      'CuO': 'Cu(OH)₂ →(t°) CuO↓ + H₂O',
      'Al(OH)₃': 'Al³⁺ + 3OH⁻ → Al(OH)₃↓',
      'Cr(OH)₃': 'Cr³⁺ + 3OH⁻ → Cr(OH)₃↓',
      'Fe(OH)₃': 'Fe³⁺ + 3OH⁻ → Fe(OH)₃↓',
      'Fe(OH)₂': 'Fe²⁺ + 2OH⁻ → Fe(OH)₂↓',
      'CaCO₃': 'Ca²⁺ + CO₃²⁻ → CaCO₃↓',
      'Cu₂O': '2Cu(OH)₂ + C₆H₁₂O₆ →(t°) Cu₂O↓ + C₆H₁₂O₇ + 2H₂O'
    };
    const sp = [];
    for (const [ck, cq] of Object.entries(analysis.cations)) {
      if (cq > 0.03 && ION_LABELS[ck]) sp.push({ label: ION_LABELS[ck][0], color: ION_LABELS[ck][1], count: 4 });
    }
    for (const [ak, aq] of Object.entries(analysis.anions)) {
      if (aq > 0.03 && ION_LABELS[ak]) sp.push({ label: ION_LABELS[ak][0], color: ION_LABELS[ak][1], count: 4 });
    }
    return {
      title: `Образование осадка: ${pr.formula}↓`,
      equation: eqMap[pr.formula] || `Ионная ассоциация → ${pr.formula}↓`,
      caption: `Ионы связываются в малорастворимую фазу (${pr.name}), оседающую на дно, а ионы-«зрители» остаются в гидратированном виде.`,
      mode: 'precipitate',
      precip: pr,
      species: sp.slice(0, 4)
    };
  }

  // ОВР обесцвечивания перманганата
  if (analysis.redox.mno4Decolorized) {
    return {
      title: 'Восстановление перманганат-иона в кислой среде',
      equation: 'MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O',
      caption: 'Фиолетовый ион MnO₄⁻ (степень окисления +7) принимает 5 электронов от восстановителя и переходит в почти бесцветный катион Mn²⁺ (+2).',
      mode: 'solution',
      species: [
        { label: 'Mn²⁺', color: '#fbcfe8', count: 6 },
        { label: 'SO₄²⁻', color: '#60a5fa', count: 7 },
        { label: 'K⁺', color: '#c084fc', count: 5 }
      ]
    };
  }

  // Нейтрализация или обычный раствор электролита
  const sp = [];
  if (analysis.pH !== null && analysis.pH < 5.5) sp.push({ label: 'H₃O⁺', color: '#ef4444', count: 6 });
  if (analysis.pH !== null && analysis.pH > 8.5) sp.push({ label: 'OH⁻', color: '#3b82f6', count: 6 });
  for (const [ck, cq] of Object.entries(analysis.cations)) {
    if (cq > 0.02 && ION_LABELS[ck]) sp.push({ label: ION_LABELS[ck][0], color: ION_LABELS[ck][1], count: 5 });
  }
  for (const [ak, aq] of Object.entries(analysis.anions)) {
    if (aq > 0.02 && ION_LABELS[ak]) sp.push({ label: ION_LABELS[ak][0], color: ION_LABELS[ak][1], count: 5 });
  }

  const neutralized = (amt.naoh || amt.koh) && (amt.hcl || amt.h2so4 || amt.hno3) && Math.abs(analysis.netEq) <= 0.05;
  return {
    title: neutralized ? 'Реакция нейтрализации завершена' : 'Водный раствор электролитов',
    equation: neutralized ? 'H⁺ + OH⁻ → H₂O  (pH ≈ 7,0)' : `Полярные молекулы H₂O и гидратированные ионы (pH = ${analysis.pH ?? '7,0'})`,
    caption: neutralized
      ? 'Ионы водорода и гидроксид-ионы связались в малодиссоциирующие молекулы воды; в растворе остались ионы соли.'
      : 'Диполи воды окружают ионы гидратными оболочками, обеспечивая электролитическую диссоциацию и электропроводность.',
    mode: 'solution',
    species: sp.slice(0, 5)
  };
}

export class MicroWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.particles = [];
    this.waters = [];
    this.sig = '';
    this.info = null;
    this.raf = 0;
    this.lastTs = 0;
  }

  setActive(active) {
    this.active = !!active;
    if (this.active) {
      this.lastTs = performance.now();
      this._loop(this.lastTs);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  sync(state, analysis) {
    const info = describeMicroState(state, analysis);
    const nextSig = info.title + '|' + info.equation + '|' + info.species.map((s) => s.label + s.count).join(',');
    this.info = info;
    if (nextSig !== this.sig) {
      this.sig = nextSig;
      this._rebuild(info, analysis.wet);
    }
    return info;
  }

  _rebuild(info, wet) {
    const R = 118;
    this.waters = [];
    if (wet) {
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (R - 18);
        this.waters.push({
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          ang: Math.random() * Math.PI * 2,
          vang: (Math.random() - 0.5) * 1.4,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14
        });
      }
    }

    this.particles = [];
    for (const sp of info.species) {
      for (let i = 0; i < sp.count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (R - 26);
        this.particles.push({
          label: sp.label,
          color: sp.color,
          gas: !!sp.gas,
          x: Math.cos(a) * r,
          y: Math.sin(a) * r * 0.7,
          vx: (Math.random() - 0.5) * (sp.gas ? 52 : 34),
          vy: sp.gas ? -28 - Math.random() * 25 : (Math.random() - 0.5) * 34,
          rad: sp.label.length > 5 ? 16 : 12.5
        });
      }
    }
  }

  _loop(ts) {
    if (!this.active) return;
    this.raf = requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this._step(dt);
    this._draw();
  }

  _step(dt) {
    const R = 112;
    for (const w of this.waters) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.ang += w.vang * dt;
      const d = Math.hypot(w.x, w.y);
      if (d > R - 10) {
        w.vx *= -1;
        w.vy *= -1;
      }
    }

    const bottomLimit = this.info?.lattice || this.info?.precip ? 58 : R - 16;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gas && p.y < -R + 18) {
        p.y = bottomLimit - 8;
        p.x = (Math.random() - 0.5) * 110;
      }
      if (p.y > bottomLimit) {
        p.y = bottomLimit;
        p.vy = -Math.abs(p.vy) * 0.85;
      }
      const d = Math.hypot(p.x, p.y);
      if (d > R - p.rad) {
        const nx = p.x / d;
        const ny = p.y / d;
        p.x = nx * (R - p.rad);
        p.y = ny * (R - p.rad);
        const dot = p.vx * nx + p.vy * ny;
        p.vx -= 2 * dot * nx;
        p.vy -= 2 * dot * ny;
      }
    }
  }

  _draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 250;
    if (this.canvas.width !== size * dpr) {
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
    }
    const g = this.ctx;
    g.save();
    g.scale(dpr, dpr);
    g.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const R = 116;

    // Внутренний фон линзы
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();

    const bgGrad = g.createRadialGradient(cx - 25, cy - 35, 12, cx, cy, R);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, size, size);

    // Фоновые диполи воды H₂O
    for (const w of this.waters) {
      g.save();
      g.translate(cx + w.x, cy + w.y);
      g.rotate(w.ang);
      g.globalAlpha = 0.25;
      g.fillStyle = '#ef4444';
      g.beginPath();
      g.arc(0, 0, 4.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e2e8f0';
      g.beginPath();
      g.arc(-4.2, 3.3, 2.5, 0, Math.PI * 2);
      g.arc(4.2, 3.3, 2.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // Кристаллическая решётка или слой осадка внизу лупы
    if (this.info?.lattice) {
      const col = this.info.lattice.color || '#cbd5e1';
      for (let row = 0; row < 3; row++) {
        for (let colIdx = -4; colIdx <= 4; colIdx++) {
          const x = cx + colIdx * 21 + (row % 2 ? 10 : 0);
          const y = cy + 78 + row * 17;
          g.fillStyle = col;
          g.beginPath();
          g.arc(x, y, 8.5, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(15,23,42,0.5)';
          g.lineWidth = 1;
          g.stroke();
        }
      }
      this._badge(g, cx, cy + 94, this.info.lattice.label);
    } else if (this.info?.precip) {
      const col = this.info.precip.color || '#f8fafc';
      for (let i = 0; i < 26; i++) {
        const x = cx + ((i * 37) % 160) - 80;
        const y = cy + 72 + ((i * 19) % 36);
        g.fillStyle = col;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.arc(x, y, 7 + (i % 4), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      this._badge(g, cx, cy + 92, this.info.precip.formula + '↓');
    }

    // Подвижные ионы и молекулы
    for (const p of this.particles) {
      const px = cx + p.x;
      const py = cy + p.y;
      g.save();
      if (p.gas) {
        g.strokeStyle = 'rgba(255,255,255,0.65)';
        g.lineWidth = 1.4;
        g.fillStyle = 'rgba(255,255,255,0.14)';
      } else {
        g.fillStyle = p.color;
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 1.2;
      }
      g.beginPath();
      g.arc(px, py, p.rad, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Текст частицы
      g.fillStyle = p.gas ? '#f8fafc' : this._textContrast(p.color);
      g.font = `700 ${p.label.length > 6 ? 8.5 : 10.5}px system-ui, -apple-system, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.label, px, py + 0.5);
      g.restore();
    }

    // Световой блик стекла лупы
    const gloss = g.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.4);
    gloss.addColorStop(0, 'rgba(255,255,255,0.20)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.03)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, size, size);
    g.restore();

    // Оправа лупы
    g.strokeStyle = '#e2e8f0';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = '#3b82f6';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R + 3, 0, Math.PI * 2);
    g.stroke();

    g.restore();
  }

  _badge(g, x, y, text) {
    g.font = '800 11px system-ui, -apple-system, sans-serif';
    const w = g.measureText(text).width + 16;
    g.fillStyle = 'rgba(15, 23, 42, 0.82)';
    g.beginPath();
    g.roundRect(x - w / 2, y - 10, w, 20, 10);
    g.fill();
    g.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#f8fafc';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5);
  }

  _textContrast(hex) {
    const c = String(hex || '#ffffff').replace('#', '');
    if (c.length < 6) return '#0f172a';
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const gr = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    return lum > 0.62 ? '#0f172a' : '#ffffff';
  }

  destroy() {
    this.setActive(false);
  }
}
