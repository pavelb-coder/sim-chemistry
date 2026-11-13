import { CATEGORIES, REAGENTS, FLAME_COLORS, ACTIVITY_SERIES, PERIODIC_TABLE } from './reagents.js';
import {
  VESSELS,
  GAS_INFO,
  createInitialLabState,
  cloneLabState,
  analyzeChemistry,
  stepSimulation
} from './chemistry.js';
import { TASKS } from './tasks.js';
import { SoundEngine } from './audio.js';
import { MicroWorld } from './micro.js';
import { Lab3DScene } from './lab3d.js';
import { buildReportHTML } from './report.js';
import { getReagentIconSVG, getCategoryIconSVG, getReagentHazardKind } from './icons.js';

const STORAGE_DONE_KEY = 'chemlab3d.done.v1';
const THEMES = ['classic', 'slate', 'warm'];

class ChemLabApp {
  constructor() {
    this.labState = createInitialLabState('flask');
    this.undoStack = [];
    this.redoStack = [];
    this.actionLog = [];

    this.completedTasks = this._loadDone();
    this.currentTaskId = 'free';
    this.eqParts = [];

    this.selectedReagent = 'hcl';
    this.portionMl = 10;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.speedX = 1;
    this.themeIdx = 0;
    this.microOpen = false;
    this.pickedElementZ = 29;

    this.sound = new SoundEngine();
    this.lastSimInfo = { activeGases: [], gasRate: 0, boiling: false };

    this._cacheDom();
    this._init3D();
    this._initMicro();
    this._bindEvents();
    this._renderCategoryPills();
    this._renderReagentGrid();
    this._renderSelectedReagent();
    this._renderTaskDropdown();
    this._applyUrlParams();
    this._syncAllUI();

    // Дискретный физико-химический цикл (4 раза в секунду для плавной термодинамики)
    this.simInterval = setInterval(() => this._onSimTick(), 250);
  }

  _loadDone() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_DONE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  _saveDone() {
    try {
      localStorage.setItem(STORAGE_DONE_KEY, JSON.stringify(this.completedTasks));
    } catch (e) {}
  }

  _cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      brandReset: $('brandReset'),
      btnTaskPicker: $('btnTaskPicker'),
      curTaskNum: $('curTaskNum'),
      curTaskTitle: $('curTaskTitle'),
      taskDropdown: $('taskDropdown'),
      taskDropdownHead: $('taskDropdownHead'),
      taskOptionsList: $('taskOptionsList'),
      btnPrepTask: $('btnPrepTask'),
      gpuBadge: $('gpuBadge'),
      gpuBadgeText: $('gpuBadgeText'),
      progressText: $('progressText'),
      btnSaveJson: $('btnSaveJson'),
      btnLoadJson: $('btnLoadJson'),
      fileInputJson: $('fileInputJson'),
      btnOpenPT: $('btnOpenPT'),
      btnOpenAct: $('btnOpenAct'),
      btnOpenReport: $('btnOpenReport'),

      vesselGroup: $('vesselGroup'),
      btnUndo: $('btnUndo'),
      btnRedo: $('btnRedo'),
      btnWash: $('btnWash'),
      cameraGroup: $('cameraGroup'),
      speedGroup: $('speedGroup'),
      btnTheme: $('btnTheme'),
      btnSound: $('btnSound'),
      btnHint: $('btnHint'),

      vesselCapBadge: $('vesselCapBadge'),
      vesselNameLabel: $('vesselNameLabel'),
      reagentCountLabel: $('reagentCountLabel'),
      vesselContentsList: $('vesselContentsList'),
      precipitatesList: $('precipitatesList'),
      taskStepsProgress: $('taskStepsProgress'),
      taskDescription: $('taskDescription'),
      taskStepsList: $('taskStepsList'),
      equationSection: $('equationSection'),
      eqDisplay: $('eqDisplay'),
      eqTokens: $('eqTokens'),
      btnEqBack: $('btnEqBack'),
      btnEqClear: $('btnEqClear'),
      btnCheckTask: $('btnCheckTask'),
      logCountBadge: $('logCountBadge'),
      actionLogList: $('actionLogList'),

      stageDropZone: $('stageDropZone'),
      stage3d: $('stage3d'),
      envStateTag: $('envStateTag'),
      gaugeTemp: $('gaugeTemp'),
      gaugeVol: $('gaugeVol'),
      gaugeMass: $('gaugeMass'),
      gaugeCurrent: $('gaugeCurrent'),
      gaugeTitrantRow: $('gaugeTitrantRow'),
      gaugeTitrant: $('gaugeTitrant'),
      gaugeGas: $('gaugeGas'),
      gaugePh: $('gaugePh'),
      phMarker: $('phMarker'),
      safetyAlerts: $('safetyAlerts'),

      microOverlay: $('microOverlay'),
      microCanvas: $('microCanvas'),
      microTitle: $('microTitle'),
      microEq: $('microEq'),
      microCaption: $('microCaption'),
      btnCloseMicro: $('btnCloseMicro'),

      btnBurner: $('btnBurner'),
      burnerBtnText: $('burnerBtnText'),
      btnIceBath: $('btnIceBath'),
      btnStirrer: $('btnStirrer'),
      btnBurette: $('btnBurette'),
      btnBuretteDrop: $('btnBuretteDrop'),
      btnElectrolysis: $('btnElectrolysis'),
      btnFilter: $('btnFilter'),
      btnGasTube: $('btnGasTube'),
      tubeBtnText: $('tubeBtnText'),
      btnSplint: $('btnSplint'),
      btnFlameLoop: $('btnFlameLoop'),
      btnTongs: $('btnTongs'),
      btnSmell: $('btnSmell'),
      btnMicro: $('btnMicro'),

      reagentTotalBadge: $('reagentTotalBadge'),
      reagentSearch: $('reagentSearch'),
      catPills: $('catPills'),
      selIconBox: $('selIconBox'),
      selFormula: $('selFormula'),
      selHazard: $('selHazard'),
      selName: $('selName'),
      selDesc: $('selDesc'),
      portionRow: $('portionRow'),
      portionValLabel: $('portionValLabel'),
      portionSlider: $('portionSlider'),
      btnAddSelected: $('btnAddSelected'),
      reagentGrid: $('reagentGrid'),

      toastBox: $('toastBox'),
      modalPT: $('modalPT'),
      ptSelectedInfo: $('ptSelectedInfo'),
      ptGrid: $('ptGrid'),
      modalAct: $('modalAct'),
      actSeriesRow: $('actSeriesRow'),
      modalReport: $('modalReport'),
      repStudentName: $('repStudentName'),
      repStudentClass: $('repStudentClass'),
      repSummaryBox: $('repSummaryBox'),
      btnPrintReport: $('btnPrintReport'),
      btnDownloadReport: $('btnDownloadReport')
    };
  }

  _init3D() {
    this.scene3d = new Lab3DScene(this.dom.stage3d, {
      onObjectClick: (action) => {
        if (action === 'vessel') this.addReagent(this.selectedReagent);
        else if (action === 'burner') this.toggleBurner();
        else if (action === 'water') this.addReagent('h2o', 5);
        else if (action === 'splint') this.runSplintTest();
        else if (action === 'buretteDrop') this.runBuretteDrop();
        else if (action === 'electrolysis') this.toggleElectrolysis();
        else if (action === 'filter') this.runFiltration();
        else if (action === 'weigh') this.runWeighCheck();
      },
      onSleepChange: () => this._updateGpuBadge()
    });
  }

  _initMicro() {
    this.micro = new MicroWorld(this.dom.microCanvas);
  }

  _bindEvents() {
    // Разблокировка Web Audio по первому клику
    document.addEventListener('pointerdown', () => this.sound.unlock(), { once: true });

    this.dom.brandReset.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectTask('free');
    });

    // Меню выбора практикума
    this.dom.btnTaskPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.taskDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.task-picker-wrap')) {
        this.dom.taskDropdown.classList.remove('open');
      }
    });

    this.dom.btnPrepTask.addEventListener('click', () => this.runTaskPrep());

    // Переключение посуды
    this.dom.vesselGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vessel]');
      if (!btn) return;
      this.switchVessel(btn.dataset.vessel);
    });

    // Undo / Redo / Вымыть
    this.dom.btnUndo.addEventListener('click', () => this.undo());
    this.dom.btnRedo.addEventListener('click', () => this.redo());
    this.dom.btnWash.addEventListener('click', () => this.washVessel());

    // Горячие клавиши Ctrl+Z / Ctrl+Y / Escape
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        this.redo();
      } else if (e.key === 'Escape') {
        this.dom.taskDropdown.classList.remove('open');
        document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
        if (this.microOpen) this.toggleMicro(false);
      }
    });

    // Ракурсы 3D-камеры
    this.dom.cameraGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cam]');
      if (!btn) return;
      this.dom.cameraGroup.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      this.scene3d.setCameraPreset(btn.dataset.cam);
    });

    // Скорость времени
    this.dom.speedGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-speed]');
      if (!btn) return;
      this.speedX = Number(btn.dataset.speed) || 1;
      this.dom.speedGroup.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      this.showToast(`Скорость течения времени: ×${this.speedX}`);
    });

    // Окружение, звук, подсказка
    this.dom.btnTheme.addEventListener('click', () => {
      this.themeIdx = (this.themeIdx + 1) % THEMES.length;
      const th = THEMES[this.themeIdx];
      this.scene3d.setBenchTheme(th);
      const names = { classic: 'Светлая плитка', slate: 'Тёмный графит', warm: 'Тёплая аудитория' };
      this.showToast(`Окружение: ${names[th]}`);
    });

    this.dom.btnSound.addEventListener('click', () => {
      const nextMuted = !this.sound.muted;
      this.sound.setMuted(nextMuted);
      this.dom.btnSound.textContent = nextMuted ? '🔇 Без звука' : '🔊 Звук';
      if (!nextMuted) this.sound.play('clink');
    });

    this.dom.btnHint.addEventListener('click', () => {
      const task = this._currentTask();
      this.showToast(task.hint || 'Выберите реактив в правой панели и добавьте его в сосуд.');
    });

    // Приборы и лабораторные установки на столе
    this.dom.btnBurner.addEventListener('click', () => this.toggleBurner());
    this.dom.btnIceBath.addEventListener('click', () => this.toggleIceBath());
    this.dom.btnStirrer.addEventListener('click', () => this.toggleStirrer());
    this.dom.btnBurette.addEventListener('click', () => this.toggleBurette());
    this.dom.btnBuretteDrop.addEventListener('click', () => this.runBuretteDrop());
    this.dom.btnElectrolysis.addEventListener('click', () => this.toggleElectrolysis());
    this.dom.btnFilter.addEventListener('click', () => this.runFiltration());
    this.dom.btnGasTube.addEventListener('click', () => this.toggleTube());
    this.dom.btnSplint.addEventListener('click', () => this.runSplintTest());
    this.dom.btnFlameLoop.addEventListener('click', () => this.runFlameLoopTest());
    this.dom.btnTongs.addEventListener('click', () => this.runTongsAction());
    this.dom.btnSmell.addEventListener('click', () => this.runSmellTest());
    this.dom.btnMicro.addEventListener('click', () => this.toggleMicro());
    this.dom.btnCloseMicro.addEventListener('click', () => this.toggleMicro(false));

    // Шкаф реактивов
    this.dom.reagentSearch.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this._renderReagentGrid();
    });

    this.dom.portionSlider.addEventListener('input', (e) => {
      this.portionMl = Number(e.target.value) || 10;
      this.dom.portionValLabel.textContent = `${this.portionMl} мл`;
    });

    this.dom.btnAddSelected.addEventListener('click', () => this.addReagent(this.selectedReagent));

    // Перетаскивание карточки реактива на 3D-стол
    this.dom.stageDropZone.addEventListener('dragover', (e) => e.preventDefault());
    this.dom.stageDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/reagent-id');
      if (id && REAGENTS[id]) {
        this.selectReagent(id);
        this.addReagent(id);
      }
    });

    // Конструктор уравнений и проверка работы
    this.dom.btnEqBack.addEventListener('click', () => {
      this.eqParts.pop();
      this._renderEquationBox();
    });
    this.dom.btnEqClear.addEventListener('click', () => {
      this.eqParts = [];
      this._renderEquationBox();
    });
    this.dom.btnCheckTask.addEventListener('click', () => this.verifyCurrentTask());

    // Сохранение / загрузка .chemlab.json
    this.dom.btnSaveJson.addEventListener('click', () => this.exportChemlabJson());
    this.dom.btnLoadJson.addEventListener('click', () => this.dom.fileInputJson.click());
    this.dom.fileInputJson.addEventListener('change', (e) => this.importChemlabJson(e));

    // Модальные окна
    this.dom.btnOpenPT.addEventListener('click', () => {
      this._renderPeriodicTableModal();
      this.dom.modalPT.classList.add('open');
    });
    this.dom.btnOpenAct.addEventListener('click', () => {
      this._renderActivitySeriesModal();
      this.dom.modalAct.classList.add('open');
    });
    this.dom.btnOpenReport.addEventListener('click', () => {
      this._updateReportModalSummary();
      this.dom.modalReport.classList.add('open');
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.close)?.classList.remove('open');
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach((bd) => {
      bd.addEventListener('click', (e) => {
        if (e.target === bd) bd.classList.remove('open');
      });
    });

    this.dom.btnDownloadReport.addEventListener('click', () => this._generateTeacherReport(true));
    this.dom.btnPrintReport.addEventListener('click', () => this._generateTeacherReport(false));
  }

  _applyUrlParams() {
    try {
      const p = new URLSearchParams(window.location.search);
      const tId = p.get('task');
      if (tId && TASKS.some((t) => t.id === tId)) {
        this.selectTask(tId, true);
        if (p.get('prep') === '1') {
          this.runTaskPrep();
        }
      }
      const mix = p.get('mix');
      if (mix) {
        mix.split(',').map((s) => s.trim()).filter((id) => REAGENTS[id]).slice(0, 4).forEach((id) => {
          this.addReagent(id, REAGENTS[id].state === 'l' ? 15 : 1);
        });
      }
    } catch (e) {}
  }

  _pushUndoSnapshot() {
    this.undoStack.push(cloneLabState(this.labState));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) {
      this.showToast('Нет действий для отмены');
      return;
    }
    this.redoStack.push(cloneLabState(this.labState));
    this.labState = this.undoStack.pop();
    this.sound.play('clink');
    this._log('↶ Действие полностью отменено (восстановлен снимок состояния)');
    this._syncAllUI();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(cloneLabState(this.labState));
    this.labState = this.redoStack.pop();
    this.sound.play('clink');
    this._log('↷ Отменённое действие возвращено');
    this._syncAllUI();
  }

  switchVessel(vesselId) {
    if (!VESSELS[vesselId] || this.labState.vessel === vesselId) return;
    const analysis = analyzeChemistry(this.labState);
    if (analysis.volume > VESSELS[vesselId].cap) {
      this.showToast(`Объём раствора (${analysis.volume} мл) не поместится в посуду «${VESSELS[vesselId].name}»`);
      return;
    }
    this._pushUndoSnapshot();
    this.labState.vessel = vesselId;
    if (!VESSELS[vesselId].allowTube) {
      this.labState.tubeOn = false;
    }
    this.sound.play('clink');
    this._log(`Выбрана посуда: ${VESSELS[vesselId].name}`);
    this._syncAllUI();
  }

  washVessel() {
    this._pushUndoSnapshot();
    const keepVessel = this.labState.vessel;
    const keepHeat = this.labState.heatLvl;
    this.labState = createInitialLabState(keepVessel);
    this.labState.heatLvl = keepHeat;
    this.sound.play('pour');
    this._log('Посуда вымыта дистиллированной водой');
    this._syncAllUI();
  }

  addReagent(id, customStep = null) {
    const r = REAGENTS[id];
    if (!r) return;
    const vInfo = VESSELS[this.labState.vessel];
    const preAnalysis = analyzeChemistry(this.labState);

    if (r.state === 'g') {
      if (preAnalysis.wet) {
        this.showToast('Газом Cl₂ заполняют сухой сосуд — сначала вымойте и осушите посуду');
        return;
      }
      this._pushUndoSnapshot();
      this.labState.headspace = { gas: r.gasFill || 'Cl2', amount: 1.0 };
      this.labState.addedOrder.push({ id, qty: 1, unit: 'объём' });
      this.sound.play('pour');
      this._log(`Сосуд заполнен газом: ${r.formula} (${r.name})`);
      this._syncAllUI();
      return;
    }

    if (r.state === 's') {
      const curPortions = this.labState.amt[id] || 0;
      if (curPortions >= 3) {
        this.showToast('В сосуде уже достаточно этого твёрдого реагента (3 порции)');
        return;
      }
      this._pushUndoSnapshot();
      this.labState.amt[id] = curPortions + 1;
      this.labState.addedOrder.push({ id, qty: 1, unit: 'порц.' });
      this.sound.play('dropSolid');
      this.scene3d.triggerPour(r, true);
      this._log(`Добавлено твёрдое вещество: ${r.formula} (${r.name})`);
      this._syncAllUI();
      return;
    }

    if (r.state === 'd') {
      this._pushUndoSnapshot();
      const drops = customStep || 2;
      this.labState.amt[id] = (this.labState.amt[id] || 0) + drops;
      this.labState.addedOrder.push({ id, qty: drops, unit: 'кап.' });
      this.sound.play('pour');
      this.scene3d.triggerPour(r, false);
      this._log(`Добавлен индикатор: ${r.name} (${drops} кап.)`);
      this._syncAllUI();
      return;
    }

    // Жидкий раствор
    const addMl = customStep || this.portionMl;
    if (preAnalysis.volume + addMl > vInfo.cap) {
      this.showToast(`Сосуд переполнится (максимум ${vInfo.cap} мл). Уменьшите дозу или возьмите стакан 200 мл.`);
      return;
    }

    this._pushUndoSnapshot();
    const prevVol = preAnalysis.volume;
    this.labState.amt[id] = (this.labState.amt[id] || 0) + addMl;
    this.labState.addedOrder.push({ id, qty: addMl, unit: 'мл' });

    // Смешение температур + экзотермический эффект нейтрализации / разбавления H₂SO₄(конц.)
    const cOld = prevVol + vInfo.glassHeatCap;
    this.labState.temp = (this.labState.temp * cOld + 22.0 * addMl) / (cOld + addMl);

    if ((id === 'h2so4k' && prevVol > 0) || (id === 'h2o' && (this.labState.amt.h2so4k || 0) > 0)) {
      this.labState.temp = Math.min(98, this.labState.temp + 18);
      if (id === 'h2o' && preAnalysis.concH2SO4) {
        this.showToast('Осторожно! Воду в концентрированную серную кислоту не льют — сильный разогрев!');
      }
    }

    // Гидратация белого безводного CuSO₄ водой
    if (this.labState.coatings.anhydrousWhite > 0.4) {
      this.labState.coatings.anhydrousWhite = 0;
      this.labState.prog.dry_cuso4 = 0;
      this.labState.temp = Math.min(95, this.labState.temp + 11);
      this.labState.seen.rehydratedCu = true;
      this.showToast('Безводный белый CuSO₄ при добавлении воды вновь стал голубым и разогрелся!');
    }

    // Теплота нейтрализации кислоты и щёлочи
    const postAnalysis = analyzeChemistry(this.labState);
    if (
      (r.acid && preAnalysis.netEq > 0.05) ||
      (r.base && preAnalysis.netEq < -0.05)
    ) {
      this.labState.temp = Math.min(95, this.labState.temp + 7.5);
    }

    this.sound.play('pour');
    this.scene3d.triggerPour(r, false);
    this._log(`Налито ${addMl} мл: ${r.formula} (${r.name})`);
    this._syncAllUI();
  }

  toggleBurner() {
    this._pushUndoSnapshot();
    this.labState.heatLvl = (this.labState.heatLvl + 1) % 4;
    if (this.labState.heatLvl > 0) {
      this.labState.iceBathOn = false;
      this.sound.play('ignite');
    }
    const labels = ['погашена', 'слабое пламя', 'среднее пламя', 'сильное пламя'];
    this._log(`Спиртовка: ${labels[this.labState.heatLvl]}`);
    this._syncAllUI();
  }

  toggleIceBath() {
    this._pushUndoSnapshot();
    this.labState.iceBathOn = !this.labState.iceBathOn;
    if (this.labState.iceBathOn) {
      this.labState.heatLvl = 0;
      this.sound.play('clink');
      this.showToast('❄️ Сосуд помещён в ледяную баню: температура плавно понижается к +2 °C (стабилизация неустойчивых соединений и замедление кинетики)');
    } else {
      this.sound.play('clink');
      this.showToast('Ледяная баня убрана');
    }
    this._log(this.labState.iceBathOn ? 'Установлена ледяная баня (0…+2 °C)' : 'Ледяная баня снята');
    this._syncAllUI();
  }

  toggleStirrer() {
    this._pushUndoSnapshot();
    this.labState.stirrerOn = !this.labState.stirrerOn;
    this.sound.play('switch');
    this.scene3d.triggerSplash(0.55);
    this.showToast(
      this.labState.stirrerOn
        ? '🌪 Магнитная мешалка включена: фторопластовый якорь ускоряет растворение и гетерогенные реакции в 1,65 раза'
        : 'Магнитная мешалка выключена'
    );
    this._log(this.labState.stirrerOn ? 'Магнитная мешалка включена' : 'Магнитная мешалка выключена');
    this._syncAllUI();
  }

  toggleBurette() {
    this._pushUndoSnapshot();
    this.labState.buretteOn = !this.labState.buretteOn;
    if (this.labState.buretteOn) {
      this.labState.tubeOn = false;
      const selR = REAGENTS[this.selectedReagent];
      if (selR && (selR.state === 'l' || selR.state === 'd')) {
        this.scene3d.setTitrantColor(selR.color);
      }
      this.sound.play('clink');
      this.showToast('💧 Титровальная бюретка 25 мл закреплена над сосудом. Выберите жидкий титрант и нажимайте «+1 мл» (или кликайте по крану бюретки)!');
    } else {
      this.sound.play('clink');
      this.showToast('Титровальная бюретка отведена');
    }
    this._log(this.labState.buretteOn ? 'Закреплена титровальная бюретка 25 мл' : 'Бюретка отведена');
    this._syncAllUI();
  }

  runBuretteDrop() {
    if (!this.labState.buretteOn) {
      this.toggleBurette();
      return;
    }
    const r = REAGENTS[this.selectedReagent];
    if (!r || (r.state !== 'l' && r.state !== 'd')) {
      this.showToast('Для капельного титрования из бюретки выберите раствор кислоты, щёлочи, соли или индикатор в шкафу справа');
      return;
    }
    const vInfo = VESSELS[this.labState.vessel];
    const preAnalysis = analyzeChemistry(this.labState);
    if (r.state === 'l' && preAnalysis.volume + 1 > vInfo.cap) {
      this.showToast(`Сосуд «${vInfo.name}» заполнен до краёв (${vInfo.cap} мл)!`);
      return;
    }
    this._pushUndoSnapshot();
    const stepQty = 1;
    this.labState.amt[this.selectedReagent] = (this.labState.amt[this.selectedReagent] || 0) + stepQty;
    this.labState.addedOrder.push({ id: this.selectedReagent, qty: stepQty, unit: r.state === 'd' ? 'кап.' : 'мл' });
    this.labState.buretteUsedMl = Math.round(((this.labState.buretteUsedMl || 0) + 1.0) * 10) / 10;
    this.labState.seen.titrated = true;

    const postAnalysis = analyzeChemistry(this.labState);
    if ((r.acid && preAnalysis.netEq > 0.02) || (r.base && preAnalysis.netEq < -0.02)) {
      this.labState.temp = Math.min(95, this.labState.temp + 0.9);
    }

    this.sound.play('drip');
    this.scene3d.setTitrantColor(r.color);
    this.scene3d.triggerBuretteDrop(r.color);
    const pHTxt = postAnalysis.pH !== null ? ` · pH = ${postAnalysis.pH.toFixed(1).replace('.', ',')}` : '';
    this.showToast(`💧 Из бюретки прикапано +1,0 мл ${r.formula} (всего израсходовано ${this.labState.buretteUsedMl.toFixed(1).replace('.', ',')} мл${pHTxt})`);
    this._log(`Титрование из бюретки: +1,0 мл ${r.formula} (расход ${this.labState.buretteUsedMl.toFixed(1).replace('.', ',')} мл${pHTxt})`);
    this._syncAllUI();
  }

  toggleElectrolysis() {
    this._pushUndoSnapshot();
    this.labState.electrolysisOn = !this.labState.electrolysisOn;
    if (this.labState.electrolysisOn) {
      this.labState.tubeOn = false;
    }
    this.sound.play('switch');
    const analysis = analyzeChemistry(this.labState);
    if (this.labState.electrolysisOn) {
      if (!analysis.wet) {
        this.showToast('⚡ Источник постоянного тока 12 В включён, но сосуд сухой (I = 0,00 А). Налейте раствор для проверки электропроводности или электролиза!');
      } else if (!analysis.isElectrolyte) {
        this.showToast('⚡ Источник 12 В включён: ток НЕ идёт (I = 0,00 А) — в сосуде неэлектролит (свободные ионы отсутствуют)!');
      } else {
        this.showToast(`⚡ Запущен электролиз на графитовых электродах (ток I = ${analysis.currentAmp.toFixed(2).replace('.', ',')} А)! Наблюдайте процессы у катода (−) и анода (+)`);
      }
    } else {
      this.showToast('Источник постоянного тока выключен, электроды подняты');
    }
    this._log(this.labState.electrolysisOn ? 'Включён электролизёр DC 12 В (графитовые электроды)' : 'Электролизёр выключен');
    this._syncAllUI();
  }

  runFiltration() {
    const analysis = analyzeChemistry(this.labState);
    if (!analysis.wet) {
      this.showToast('Для фильтрования в сосуде должна находиться жидкая смесь (суспензия с осадком или нерастворимым веществом)');
      return;
    }
    // Собираем выпавшие ионные осадки и нерастворимые твёрдые вещества
    const insolubleIds = Object.entries(this.labState.amt)
      .filter(([id, q]) => q > 0.04 && REAGENTS[id]?.state === 's' && !(REAGENTS[id]?.waterRate > 0) && !REAGENTS[id]?.soluble)
      .map(([id]) => id);

    if (analysis.precipitates.length === 0 && insolubleIds.length === 0) {
      this.showToast('Раствор прозрачен и гомогенен — твёрдого осадка для фильтрования на бумажном фильтре нет');
      return;
    }

    this._pushUndoSnapshot();
    const cakeItems = [];
    for (const pr of analysis.precipitates) {
      cakeItems.push({ formula: pr.formula, name: pr.name, color: pr.color });
    }
    for (const sid of insolubleIds) {
      const sr = REAGENTS[sid];
      cakeItems.push({ formula: sr.formula, name: sr.name, color: sr.color });
      delete this.labState.amt[sid];
    }

    this.labState.filteredSolids = [...(this.labState.filteredSolids || []), ...cakeItems];
    this.labState.filteredOrderLen = this.labState.addedOrder.length;
    this.labState.seen.filtered = true;

    const cakeColor = cakeItems[0]?.color || '#f8fafc';
    const formulas = cakeItems.map((c) => c.formula).join(', ');
    this.sound.play('pour');
    this.scene3d.triggerFiltration(cakeColor);
    this.showToast(`⏳ Смесь профильтрована через складчатый бумажный фильтр! На фильтре отделён осадок: ${formulas}; в сосуде — чистый фильтрат.`);
    this._log(`Фильтрование через воронку с бумажным фильтром: отделён осадок ${formulas}`);
    this._syncAllUI();
  }

  runWeighCheck() {
    const analysis = analyzeChemistry(this.labState);
    const vInfo = VESSELS[this.labState.vessel];
    const mStr = (analysis.netMassG || 0).toFixed(2).replace('.', ',');
    this.sound.play('switch');
    this.showToast(`⚖️ Электронные лабораторные весы (режим ТАРА скомпенсирован для «${vInfo.name}»): масса нетто содержимого = ${mStr} г`);
    this._log(`Контрольное взвешивание на электронных весах: масса нетто = ${mStr} г`);
  }

  toggleTube() {
    const vInfo = VESSELS[this.labState.vessel];
    if (!vInfo.allowTube) {
      this.showToast(`На «${vInfo.name}» пробку с газоотводной трубкой не надевают — выберите коническую/круглодонную колбу или пробирку`);
      return;
    }
    this._pushUndoSnapshot();
    this.labState.tubeOn = !this.labState.tubeOn;
    if (this.labState.tubeOn) {
      this.labState.buretteOn = false;
      this.labState.electrolysisOn = false;
    }
    this.sound.play('clink');
    this._log(this.labState.tubeOn ? 'Надета пробка с газоотводной трубкой' : 'Газоотводная трубка снята');
    this._syncAllUI();
  }

  runSplintTest() {
    // Определяем, какой газ проверяем: собранный в пробирке или выходящий из горлышка
    const coll = this.labState.collectedGas || {};
    let targetGas = '';
    if (this.labState.tubeOn) {
      targetGas = Object.keys(coll).find((g) => coll[g] >= 3) || '';
    }
    if (!targetGas) {
      targetGas = this.lastSimInfo.activeGases?.[0] || this.labState.headspace?.gas || '';
    }

    if (targetGas === 'H2') {
      this._pushUndoSnapshot();
      this.labState.seen.splint.H2 = true;
      if (this.labState.tubeOn && coll.H2) this.labState.collectedGas.H2 = Math.max(0, coll.H2 - 6);
      this.sound.play('popH2');
      this.scene3d.triggerToolAnimation('splint', { flare: true, flashColor: '#60a5fa', flashPower: 9 });
      this.showToast('Характерный хлопок! Водород H₂ сгорел с образованием водяного тумана.');
      this._log('Проба лучиной: хлопок чистого водорода H₂');
    } else if (targetGas === 'O2') {
      this._pushUndoSnapshot();
      this.labState.seen.splint.O2 = true;
      if (this.labState.tubeOn && coll.O2) this.labState.collectedGas.O2 = Math.max(0, coll.O2 - 5);
      this.sound.play('flare');
      this.scene3d.triggerToolAnimation('splint', { flare: true, flashColor: '#fde047', flashPower: 10 });
      this.showToast('Лучина ярко вспыхнула! Газ поддерживает горение — это кислород O₂.');
      this._log('Проба лучиной: яркая вспышка в кислороде O₂');
    } else if (targetGas === 'C2H2') {
      this._pushUndoSnapshot();
      this.labState.seen.splint.C2H2 = true;
      if (this.labState.tubeOn && coll.C2H2) this.labState.collectedGas.C2H2 = Math.max(0, coll.C2H2 - 5);
      this.sound.play('flare');
      this.scene3d.triggerToolAnimation('splint', { sootyFlare: true, flashColor: '#fb923c', flashPower: 9 });
      this.showToast('Ацетилен C₂H₂ вспыхнул ярким светящимся коптящим пламенем с хлопьями чёрной сажи!');
      this._log('Проба лучиной: яркое коптящее пламя ацетилена C₂H₂ (непредельный углеводород)');
    } else if (targetGas === 'CO2' || targetGas === 'N2' || targetGas === 'SO2') {
      this._pushUndoSnapshot();
      this.labState.seen.splint[targetGas] = true;
      this.scene3d.triggerToolAnimation('splint', { extinguish: true });
      const gasNames = {
        CO2: 'углекислый газ CO₂ не поддерживает горение',
        N2: 'инертный азот N₂ не поддерживает горение',
        SO2: 'сернистый газ SO₂ гасит пламя'
      };
      this.showToast(`Горящая лучина мгновенно погасла — ${gasNames[targetGas]}.`);
      this._log(`Проба лучиной: пламя погасло в газе ${GAS_INFO[targetGas]?.formula || targetGas}`);
    } else {
      this.scene3d.triggerToolAnimation('splint', {});
      this.showToast('Лучина горит спокойно, как в обычном воздухе (нет избытка H₂, O₂, C₂H₂, CO₂ или N₂).');
      this._log('Проба лучиной: изменений горения нет');
    }
    this._syncAllUI();
  }

  runFlameLoopTest() {
    const analysis = analyzeChemistry(this.labState);
    if (!analysis.wet) {
      this.showToast('Сначала налейте в сосуд раствор соли металла, чтобы смочить нихромовую петлю');
      return;
    }
    if (this.labState.heatLvl === 0) {
      this.showToast('Зажгите спиртовку, чтобы внести смоченную петлю в пламя');
      return;
    }
    const cat = analysis.flameCations[0];
    if (!cat) {
      this.scene3d.triggerToolAnimation('loop', { color: '#ff9e44' });
      this.showToast('В растворе нет катионов, окрашивающих пламя (попробуйте Li⁺, Na⁺, K⁺, Ca²⁺, Sr²⁺, Ba²⁺, Cu²⁺)');
      return;
    }
    this._pushUndoSnapshot();
    const fc = FLAME_COLORS[cat];
    this.labState.seen.flames[cat] = true;
    this.sound.play('ignite');
    this.scene3d.triggerFlameTint(fc.hex, 5200);
    this.scene3d.triggerToolAnimation('loop', { color: fc.hex });
    this.showToast(`Пламя спиртовки окрасилось: ${fc.name}!`);
    this._log(`Проба пламени нихромовой петлёй: ${fc.name}`);
    this._syncAllUI();
  }

  runTongsAction() {
    const sel = this.selectedReagent;
    if (!['mg', 'fe', 'cu', 's'].includes(sel)) {
      this.showToast('Выберите в шкафу реактивов магний (Mg), железо (Fe), медь (Cu) или серу (S) для прокаливания в щипцах');
      return;
    }
    if (this.labState.heatLvl === 0) {
      this.showToast('Сначала зажгите спиртовку для зажигания/прокаливания образца в щипцах');
      return;
    }

    this._pushUndoSnapshot();
    if (sel === 's') {
      const preA = analyzeChemistry(this.labState);
      this.sound.play('ignite');
      this.scene3d.triggerToolAnimation('tongs', { metal: 's', sulfurBurn: true, color: '#38bdf8', flashColor: '#38bdf8', flashPower: 7, dur: 2.6 });
      this.labState.seen.sulfurBurn = true;
      if (preA.wet) {
        this.labState.amt.h2so3 = (this.labState.amt.h2so3 || 0) + 5;
        this.showToast('Сера горит нежно-голубым пламенем (S + O₂ → SO₂↑)! Сернистый газ растворился в воде с образованием H₂SO₃.');
      } else {
        this.labState.headspace = { gas: 'SO2', amount: 0.9 };
        this.showToast('Сера горит голубым пламенем с резким запахом сернистого газа (S + O₂ → SO₂↑)!');
      }
      this._log('Горение серы в ложечке/щипцах: S + O₂ → SO₂↑ (голубое пламя)');
    } else if (sel === 'mg') {
      this.sound.play('flare');
      this.scene3d.triggerToolAnimation('tongs', { metal: 'mg', color: '#ffffff', flashColor: '#ffffff', flashPower: 14, dur: 2.5 });
      this.labState.amt.mgo = (this.labState.amt.mgo || 0) + 1;
      this.labState.addedOrder.push({ id: 'mgo', qty: 1, unit: 'порц.' });
      this.showToast('Магний сгорел ослепительным белым пламенем (2Mg + O₂ → 2MgO)! Белый пепел MgO перенесён в сосуд.');
      this._log('Горение магния в щипцах: 2Mg + O₂ → 2MgO, пепел помещён в сосуд');
    } else if (this.labState.headspace?.gas === 'Cl2' && this.labState.headspace.amount > 0.3) {
      this.sound.play('flare');
      this.scene3d.triggerToolAnimation('tongs', { metal: sel, clBurn: true, color: '#f97316', flashColor: '#ea580c', flashPower: 7, dur: 2.4 });
      this.labState.headspace = { gas: 'NO2', amount: 0.85 };
      const saltId = sel === 'fe' ? 'fecl3' : 'cucl2';
      this.labState.amt[saltId] = (this.labState.amt[saltId] || 0) + 5;
      this.labState.seen.clBurn = true;
      this.showToast(`Раскалённый металл (${REAGENTS[sel].formula}) бурно сгорел в хлоре с густым дымом хлорида!`);
      this._log(`Горение ${REAGENTS[sel].formula} в атмосфере хлора Cl₂`);
    } else {
      this.sound.play('ignite');
      this.scene3d.triggerToolAnimation('tongs', { metal: sel, color: '#fb7185', dur: 2.3 });
      if (sel === 'cu') {
        this.labState.amt.cuo = (this.labState.amt.cuo || 0) + 1;
        this.showToast('Медная проволока в пламени покрылась чёрным налётом оксида меди(II) CuO и опущена в сосуд.');
        this._log('Прокаливание меди на воздухе: 2Cu + O₂ → 2CuO');
      } else {
        this.showToast('Железо раскалилось в пламени. Попробуйте внести его в сухую колбу, заполненную хлором Cl₂!');
        this._log('Прокаливание железа в щипцах');
      }
    }
    this._syncAllUI();
  }

  runSmellTest() {
    const analysis = analyzeChemistry(this.labState);
    this.labState.seen.smelled = true;
    if (analysis.smells.length > 0) {
      const txt = analysis.smells.join('; ');
      this.showToast(`Осторожно направив воздух ладонью: ощущается ${txt}.`);
      this._log(`Определение запаха (по ТБ): ${txt}`);
    } else {
      this.showToast('Осторожно направив воздух ладонью к себе: ощутимого запаха нет.');
      this._log('Определение запаха: без запаха');
    }
  }

  runStir() {
    const analysis = analyzeChemistry(this.labState);
    if (!analysis.wet && Object.keys(this.labState.amt).length === 0) {
      this.showToast('Сосуд пуст');
      return;
    }
    this.sound.play('clink');
    this.scene3d.triggerSplash(0.9);
    this._log('Содержимое сосуда перемешано стеклянной палочкой');
  }

  toggleMicro(forceVal) {
    this.microOpen = typeof forceVal === 'boolean' ? forceVal : !this.microOpen;
    this.dom.microOverlay.classList.toggle('open', this.microOpen);
    this.dom.btnMicro.classList.toggle('active', this.microOpen);
    this.micro.setActive(this.microOpen);
    if (this.microOpen) {
      const analysis = analyzeChemistry(this.labState);
      this._updateMicroCard(analysis);
    }
  }

  _updateMicroCard(analysis) {
    const info = this.micro.sync(this.labState, analysis);
    this.dom.microTitle.textContent = info.title;
    this.dom.microEq.textContent = info.equation;
    this.dom.microCaption.textContent = info.caption;
  }

  selectReagent(id) {
    if (!REAGENTS[id]) return;
    this.selectedReagent = id;
    this._renderSelectedReagent();
    this.dom.reagentGrid.querySelectorAll('.reagent-card').forEach((el) => {
      el.classList.toggle('selected', el.dataset.id === id);
    });
  }

  selectTask(taskId, silent = false) {
    const task = TASKS.find((t) => t.id === taskId) || TASKS[0];
    this.currentTaskId = task.id;
    this.eqParts = [];
    this.dom.taskDropdown.classList.remove('open');
    if (!silent) {
      this._log(`Выбрана работа: ${task.num} «${task.title}»`);
    }
    this._renderTaskDropdown();
    this._renderEquationBox();
    this._syncAllUI();
  }

  runTaskPrep() {
    const task = this._currentTask();
    if (!task?.prep) return;
    this._pushUndoSnapshot();
    const P = task.prep;
    this.labState = createInitialLabState(P.vessel || 'flask');
    if (P.tubeOn) this.labState.tubeOn = true;
    if (P.heatLvl) this.labState.heatLvl = P.heatLvl;
    if (P.iceBathOn) this.labState.iceBathOn = true;
    if (P.stirrerOn) this.labState.stirrerOn = true;
    if (P.buretteOn) this.labState.buretteOn = true;
    if (P.electrolysisOn) this.labState.electrolysisOn = true;
    for (const [rid, qty] of P.add || []) {
      this.labState.amt[rid] = (this.labState.amt[rid] || 0) + qty;
      const r = REAGENTS[rid];
      const unit = r?.state === 's' ? 'порц.' : (r?.state === 'd' ? 'кап.' : 'мл');
      this.labState.addedOrder.push({ id: rid, qty, unit });
    }
    if (P.sel && REAGENTS[P.sel]) {
      this.selectReagent(P.sel);
    }
    this.sound.play('pour');
    this.scene3d.triggerSplash(0.7);
    this.showToast('Исходная установка собрана! Выполните ключевой шаг опыта по подсказке.');
    this._log(`Собрана демонстрационная заготовка для опыта «${task.title}»`);
    this._syncAllUI();
  }

  verifyCurrentTask() {
    const task = this._currentTask();
    if (task.id === 'free') return;
    const analysis = analyzeChemistry(this.labState);
    const steps = task.steps(this.labState, analysis);
    const allStepsOk = steps.every((st) => st.ok);

    let eqOk = true;
    if (task.answers && task.answers.length > 0) {
      const assembled = this.eqParts.join('');
      eqOk = task.answers.includes(assembled);
    }

    if (allStepsOk && eqOk) {
      this.completedTasks[task.id] = true;
      this._saveDone();
      this.sound.play('success');
      this.showToast(`🎉 Отлично! Лабораторная работа №${task.num} «${task.title}» успешно зачтена!`);
      this._log(`✓ Работа №${task.num} «${task.title}» успешно проверена и зачтена`);
      this._renderTaskDropdown();
      this._syncAllUI();
    } else if (!allStepsOk) {
      this.showToast('Пока выполнены не все практические шаги опыта — сверьтесь с чек-листом слева.');
    } else {
      this.showToast('Практическая часть верна, но в уравнении реакции есть неточность. Проверьте коэффициенты!');
    }
  }

  _onSimTick() {
    const res = stepSimulation(this.labState, 0.25, this.speedX);
    this.lastSimInfo = res;
    if (res.events && res.events.length > 0) {
      res.events.forEach((ev) => {
        this.showToast(ev);
        this._log(ev);
      });
    }

    // Звуковые петли шипения газа и горения спиртовки
    const fizzLvl = Math.max(
      res.gasRate > 0 ? Math.min(1, 0.25 + res.gasRate / 35) : 0,
      res.boiling ? 0.45 : 0
    );
    const flameLvl = this.labState.heatLvl > 0 ? 0.25 + this.labState.heatLvl * 0.22 : 0;
    this.sound.updateLoops({ fizz: fizzLvl, flame: flameLvl });

    this._syncDynamicUI(res.analysis);
  }

  _currentTask() {
    return TASKS.find((t) => t.id === this.currentTaskId) || TASKS[0];
  }

  _log(text) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    this.actionLog.unshift({ time, text });
    if (this.actionLog.length > 60) this.actionLog.pop();
    this._renderLog();
  }

  showToast(text) {
    clearTimeout(this._toastTimer);
    this.dom.toastBox.textContent = text;
    this.dom.toastBox.classList.add('show');
    this._toastTimer = setTimeout(() => {
      this.dom.toastBox.classList.remove('show');
    }, 4200);
  }

  _renderCategoryPills() {
    this.dom.catPills.innerHTML = CATEGORIES.map((c) => `
      <button type="button" class="cat-pill ${c.id === this.activeCategory ? 'active' : ''}" data-cat="${c.id}" title="${c.name}">
        ${getCategoryIconSVG(c.id)}
        <span>${c.short}</span>
      </button>
    `).join('');

    this.dom.catPills.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      this.activeCategory = btn.dataset.cat;
      this.dom.catPills.querySelectorAll('.cat-pill').forEach((b) => b.classList.toggle('active', b === btn));
      this._renderReagentGrid();
    });
  }

  _renderReagentGrid() {
    const entries = Object.entries(REAGENTS).filter(([id, r]) => {
      const grp = r.category || r.cat;
      if (this.activeCategory !== 'all' && grp !== this.activeCategory) return false;
      if (!this.searchQuery) return true;
      const hay = `${id} ${r.formula} ${r.name} ${r.sub}`.toLowerCase();
      return hay.includes(this.searchQuery);
    });

    this.dom.reagentTotalBadge.textContent = `${entries.length} в-в`;
    const stateLabels = { s: 'тв.', l: 'р-р', d: 'инд.', g: 'газ' };

    this.dom.reagentGrid.innerHTML = entries.map(([id, r]) => {
      const hazKind = getReagentHazardKind(r);
      const hazDot = hazKind ? `<span class="rc-haz-dot ${hazKind}" title="${r.hazard}"></span>` : '';
      return `
      <button type="button" class="reagent-card ${id === this.selectedReagent ? 'selected' : ''}"
              data-id="${id}" draggable="true" title="${r.name} (${r.sub}) — клик: выбрать, двойной клик или перетаскивание: добавить">
        <div class="rc-icon-wrap">
          ${getReagentIconSVG(id, r, 30)}
          ${hazDot}
        </div>
        <div class="rc-body">
          <div class="rc-top">
            <span class="rc-formula">${r.formula}</span>
            <span class="rc-state">${stateLabels[r.state] || ''}</span>
          </div>
          <div class="rc-name">${r.name}</div>
        </div>
      </button>`;
    }).join('');

    this.dom.reagentGrid.querySelectorAll('.reagent-card').forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener('click', () => this.selectReagent(id));
      card.addEventListener('dblclick', () => {
        this.selectReagent(id);
        this.addReagent(id);
      });
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/reagent-id', id);
      });
    });
  }

  _renderSelectedReagent() {
    const r = REAGENTS[this.selectedReagent];
    if (!r) return;
    if (this.dom.selIconBox) {
      this.dom.selIconBox.innerHTML = getReagentIconSVG(this.selectedReagent, r, 38);
    }
    this.dom.selFormula.textContent = r.formula;
    this.dom.selHazard.textContent = r.hazard || `M = ${r.molar}`;
    this.dom.selHazard.style.display = (r.hazard || r.molar !== '—') ? 'inline-block' : 'none';
    this.dom.selName.textContent = `${r.name} (${r.sub})`;
    this.dom.selDesc.textContent = r.desc;

    const isLiq = r.state === 'l';
    if (this.scene3d && (r.state === 'l' || r.state === 'd')) {
      this.scene3d.setTitrantColor(r.color);
    }
    this.dom.portionRow.style.display = isLiq ? 'flex' : 'none';
    const actionLabel = r.state === 's'
      ? `+ Насыпать порцию (${r.formula})`
      : (r.state === 'd' ? `+ Капнуть индикатор (${r.formula})` : (r.state === 'g' ? `+ Наполнить сосуд газом ${r.formula}` : `+ Налить в сосуд (${r.formula})`));
    this.dom.btnAddSelected.textContent = actionLabel;
  }

  _renderTaskDropdown() {
    const realTasks = TASKS.filter((t) => t.id !== 'free');
    const doneCount = realTasks.filter((t) => this.completedTasks[t.id]).length;
    this.dom.progressText.textContent = `${doneCount} из ${realTasks.length}`;
    this.dom.taskDropdownHead.textContent = `Лабораторный практикум · выполнено ${doneCount} из ${realTasks.length}`;

    const cur = this._currentTask();
    this.dom.curTaskNum.textContent = cur.num;
    this.dom.curTaskTitle.textContent = cur.title;
    this.dom.btnPrepTask.style.display = cur.prep ? 'inline-flex' : 'none';

    this.dom.taskOptionsList.innerHTML = TASKS.map((t) => {
      const done = !!this.completedTasks[t.id];
      const active = t.id === this.currentTaskId;
      return `
        <button type="button" class="task-option ${active ? 'active' : ''}" data-tid="${t.id}">
          <span class="num">${t.num}</span>
          <span class="meta">
            <b>${t.title}</b>
            <small>${t.grade}</small>
          </span>
          ${done ? '<span class="done-mark" title="Зачтено">✓</span>' : ''}
        </button>
      `;
    }).join('');

    this.dom.taskOptionsList.querySelectorAll('.task-option').forEach((btn) => {
      btn.addEventListener('click', () => this.selectTask(btn.dataset.tid));
    });
  }

  _renderEquationBox() {
    const task = this._currentTask();
    const hasEq = task.tokens && task.tokens.length > 0;
    this.dom.equationSection.style.display = hasEq ? 'block' : 'none';
    this.dom.btnCheckTask.style.display = task.id === 'free' ? 'none' : 'inline-flex';

    if (!hasEq) return;

    if (this.eqParts.length === 0) {
      this.dom.eqDisplay.innerHTML = '<span class="eq-placeholder">Нажимайте на формулы и знаки ниже…</span>';
    } else {
      this.dom.eqDisplay.textContent = this.eqParts.join(' ');
    }

    this.dom.eqTokens.innerHTML = task.tokens.map((tok, i) => `
      <button type="button" class="token-chip" data-tok-idx="${i}">${tok}</button>
    `).join('');

    this.dom.eqTokens.querySelectorAll('.token-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const tok = task.tokens[Number(chip.dataset.tokIdx)];
        this.eqParts.push(tok);
        this._renderEquationBox();
      });
    });
  }

  _renderLog() {
    this.dom.logCountBadge.textContent = String(this.actionLog.length);
    if (this.actionLog.length === 0) {
      this.dom.actionLogList.innerHTML = '<div style="font-size:12px;color:var(--muted)">Ваши действия будут записываться здесь.</div>';
      return;
    }
    this.dom.actionLogList.innerHTML = this.actionLog.slice(0, 25).map((item) => `
      <div class="log-entry"><b>${item.time}</b><span>${item.text}</span></div>
    `).join('');
  }

  _syncAllUI() {
    const analysis = analyzeChemistry(this.labState);
    const vInfo = VESSELS[this.labState.vessel];

    // Кнопки посуды и Undo/Redo
    this.dom.vesselGroup.querySelectorAll('[data-vessel]').forEach((b) => {
      b.classList.toggle('active', b.dataset.vessel === this.labState.vessel);
    });
    this.dom.btnUndo.disabled = this.undoStack.length === 0;
    this.dom.btnRedo.disabled = this.redoStack.length === 0;

    // Дерево содержимого сосуда
    this.dom.vesselNameLabel.textContent = vInfo.name;
    const activeEntries = Object.entries(this.labState.amt).filter(([, q]) => q > 0);
    this.dom.reagentCountLabel.textContent = activeEntries.length ? `${activeEntries.length} комп.` : 'пусто';

    if (activeEntries.length === 0 && !this.labState.headspace?.gas) {
      this.dom.vesselContentsList.innerHTML = '<div style="font-size:12px;color:var(--muted)">Сосуд пуст. Выберите реактив справа или кликните по колбе на столе.</div>';
    } else {
      let html = activeEntries.map(([id, q]) => {
        const r = REAGENTS[id];
        if (!r) return '';
        const unit = r.state === 's' ? 'порц.' : (r.state === 'd' ? 'кап.' : 'мл');
        return `
          <div class="vessel-item">
            <span class="vi-icon">${getReagentIconSVG(id, r, 21)}</span>
            <b>${r.formula}</b>
            <span style="color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
            <span class="qty">${q} ${unit}</span>
          </div>`;
      }).join('');
      if (this.labState.headspace?.gas) {
        const gInfo = GAS_INFO[this.labState.headspace.gas];
        html += `<div class="vessel-item"><span class="swatch" style="background:${gInfo?.color || '#bef264'}"></span><b>${gInfo?.formula || this.labState.headspace.gas}</b><span>газ в сосуде</span></div>`;
      }
      this.dom.vesselContentsList.innerHTML = html;
    }

    this._syncDynamicUI(analysis);
  }

  _syncDynamicUI(analysis) {
    const vInfo = VESSELS[this.labState.vessel];

    // Осадки, отфильтрованный осадок и покрытия
    const badges = [];
    for (const pr of analysis.precipitates) {
      badges.push(`<div class="precip-badge"><span>↓</span><span><b>${pr.formula}</b> — ${pr.name}</span></div>`);
    }
    if (Array.isArray(this.labState.filteredSolids) && this.labState.filteredSolids.length > 0) {
      const fNames = this.labState.filteredSolids.map((f) => f.formula).join(', ');
      badges.push(`<div class="precip-badge"><span>⏳</span><span>На бумажном фильтре: <b>${fNames}</b></span></div>`);
    }
    if (this.labState.coatings.copperPlated > 0.12) {
      badges.push(`<div class="precip-badge"><span>⚡</span><span><b>Cu⁰</b> — слой красной меди на катоде (−)</span></div>`);
    }
    if (this.labState.coatings.silverPlated > 0.12) {
      badges.push(`<div class="precip-badge"><span>⚡</span><span><b>Ag⁰</b> — блестящий слой серебра на катоде (−)</span></div>`);
    }
    if (this.labState.coatings.silverMirror > 0.4) {
      badges.push(`<div class="precip-badge"><span>✨</span><span><b>Ag⁰</b> — зеркальный налёт серебра на стекле</span></div>`);
    }
    if (this.labState.coatings.sublimedRing > 0.4) {
      badges.push(`<div class="precip-badge"><span>❄</span><span><b>NH₄Cl</b> — белый налёт возгонки у горлышка</span></div>`);
    }
    this.dom.precipitatesList.innerHTML = badges.join('');

    // Показания приборов
    const tempStr = this.labState.temp.toFixed(1).replace('.', ',') + ' °C';
    const volStr = `${analysis.volume} / ${vInfo.cap} мл`;
    const massStr = `${(analysis.netMassG || 0).toFixed(2).replace('.', ',')} г`;
    const totalGas = Math.round(Object.values(this.labState.collectedGas).reduce((a, b) => a + b, 0) * 10) / 10;
    const gasNames = Object.entries(this.labState.collectedGas)
      .filter(([, v]) => v >= 0.5)
      .map(([k]) => GAS_INFO[k]?.formula || k)
      .join(', ');

    this.dom.vesselCapBadge.textContent = volStr;
    this.dom.gaugeTemp.textContent = tempStr;
    this.dom.gaugeVol.textContent = volStr;
    if (this.dom.gaugeMass) this.dom.gaugeMass.textContent = massStr;

    if (this.dom.gaugeCurrent) {
      if (!analysis.wet) {
        this.dom.gaugeCurrent.textContent = this.labState.electrolysisOn ? '0,00 А (сухо)' : '—';
      } else if (this.labState.electrolysisOn) {
        this.dom.gaugeCurrent.textContent = analysis.isElectrolyte
          ? `${analysis.currentAmp.toFixed(2).replace('.', ',')} А (ток идёт)`
          : '0,00 А (неэлектр.)';
      } else {
        this.dom.gaugeCurrent.textContent = analysis.isElectrolyte ? 'Электролит' : 'Неэлектролит';
      }
    }

    if (this.dom.gaugeTitrantRow && this.dom.gaugeTitrant) {
      const showBur = !!this.labState.buretteOn || (this.labState.buretteUsedMl || 0) > 0;
      this.dom.gaugeTitrantRow.style.display = showBur ? 'flex' : 'none';
      this.dom.gaugeTitrant.textContent = `${(this.labState.buretteUsedMl || 0).toFixed(1).replace('.', ',')} мл`;
    }

    this.dom.gaugeGas.textContent = totalGas > 0 ? `${totalGas} мл (${gasNames})` : '0 мл';

    if (analysis.pH !== null) {
      const envName = analysis.pH < 6.4 ? 'Кислая' : (analysis.pH > 7.6 ? 'Щелочная' : 'Нейтральная');
      this.dom.gaugePh.textContent = `${analysis.pH.toFixed(1).replace('.', ',')} (${envName})`;
      this.dom.phMarker.style.left = `${Math.max(2, Math.min(98, (analysis.pH / 14) * 100))}%`;
      this.dom.phMarker.style.opacity = '1';
    } else {
      this.dom.gaugePh.textContent = '—';
      this.dom.phMarker.style.opacity = '0.3';
    }

    this.dom.envStateTag.textContent = this.labState.electrolysisOn && analysis.currentAmp > 0
      ? 'Электролиз'
      : (this.lastSimInfo.boiling
        ? 'Кипение'
        : (this.labState.iceBathOn ? 'Охлаждение' : (this.lastSimInfo.gasRate > 0.2 ? 'Идёт газ' : 'Норма')));

    // Предупреждения ТБ
    this.dom.safetyAlerts.innerHTML = analysis.warnings
      .map((w) => `<div class="safety-pill">⚠ ${w}</div>`)
      .join('');

    // Нижняя док-панель приборов
    const burnerLabels = ['Спиртовка', 'Слабое', 'Среднее', 'Сильное'];
    this.dom.burnerBtnText.textContent = burnerLabels[this.labState.heatLvl];
    this.dom.btnBurner.classList.toggle('flame-on', this.labState.heatLvl > 0);
    this.dom.btnIceBath?.classList.toggle('ice-on', !!this.labState.iceBathOn);
    this.dom.btnStirrer?.classList.toggle('active', !!this.labState.stirrerOn);
    this.dom.btnBurette?.classList.toggle('active', !!this.labState.buretteOn);
    if (this.dom.btnBuretteDrop) {
      this.dom.btnBuretteDrop.style.display = this.labState.buretteOn ? 'inline-flex' : 'none';
    }
    this.dom.btnElectrolysis?.classList.toggle('elec-on', !!this.labState.electrolysisOn);
    this.dom.tubeBtnText.textContent = this.labState.tubeOn ? 'Трубка ✓' : 'Трубка';
    this.dom.btnGasTube.classList.toggle('active', this.labState.tubeOn);

    // Шаги текущего задания
    const task = this._currentTask();
    this.dom.taskDescription.textContent = task.desc;
    const steps = task.steps(this.labState, analysis);
    const doneSteps = steps.filter((st) => st.ok).length;
    this.dom.taskStepsProgress.textContent = `${doneSteps} / ${steps.length}`;
    this.dom.taskStepsList.innerHTML = steps.map((st, idx) => `
      <div class="step-row ${st.ok ? 'done' : ''}">
        <span class="step-dot">${st.ok ? '✓' : idx + 1}</span>
        <span>${st.text}</span>
      </div>
    `).join('');

    // Синхронизация 3D и Микромира
    this.scene3d.syncState(this.labState, analysis, this.lastSimInfo);
    if (this.microOpen) this._updateMicroCard(analysis);
    this._updateGpuBadge();
  }

  _updateGpuBadge() {
    const sleeping = this.scene3d.isSleeping();
    this.dom.gpuBadge.classList.toggle('idle', sleeping);
    this.dom.gpuBadgeText.textContent = sleeping ? '3D Эко-сон' : '3D 60 FPS';
  }

  // ── Ленивая отрисовка модалки Таблицы Менделеева (только при открытии!) ──
  _renderPeriodicTableModal() {
    const selF = REAGENTS[this.selectedReagent]?.formula || '';
    const inReagent = new Set(selF.match(/[A-Z][a-z]?/g) || []);
    const picked = PERIODIC_TABLE.find((e) => e.z === this.pickedElementZ) || PERIODIC_TABLE[0];

    this.dom.ptSelectedInfo.innerHTML = `
      <div>
        <span style="display:inline-block;padding:3px 9px;border-radius:7px;background:${picked.bg};color:${picked.fg};font-weight:800;margin-right:8px">
          ${picked.z} · ${picked.sym}
        </span>
        <b>${picked.name}</b> — атомная масса <b>${picked.mass}</b> · период ${picked.period}, группа ${picked.group} (${picked.label})
      </div>
      <div style="font-size:12px;color:#c2410c;font-weight:700">
        Оранжевой рамкой отмечены элементы выбранного реактива (${selF})
      </div>
    `;

    this.dom.ptGrid.innerHTML = PERIODIC_TABLE.map((el) => `
      <button type="button"
              class="pt-cell ${inReagent.has(el.sym) ? 'in-reagent' : ''} ${el.z === this.pickedElementZ ? 'picked' : ''}"
              data-z="${el.z}"
              style="grid-column:${el.col};grid-row:${el.row};background:${el.bg};color:${el.fg}">
        <div class="z">${el.z}</div>
        <div class="sym">${el.sym}</div>
        <div class="nm">${el.name}</div>
      </button>
    `).join('');

    this.dom.ptGrid.querySelectorAll('.pt-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        this.pickedElementZ = Number(cell.dataset.z);
        this._renderPeriodicTableModal();
      });
    });
  }

  // ── Ленивая отрисовка Ряда активности металлов ──
  _renderActivitySeriesModal() {
    const presentMetals = new Set(
      Object.entries(this.labState.amt)
        .filter(([id, q]) => q > 0 && REAGENTS[id]?.cat === 'met')
        .map(([id]) => REAGENTS[id].formula)
    );

    const zoneColors = {
      alkali: { bg: '#fee2e2', fg: '#991b1b' },
      active: { bg: '#dbeafe', fg: '#1e40af' },
      h2:     { bg: '#ffffff', fg: '#2563eb' },
      noble:  { bg: '#fef3c7', fg: '#92400e' }
    };

    this.dom.actSeriesRow.innerHTML = ACTIVITY_SERIES.map((item) => {
      const zc = zoneColors[item.zone];
      const inV = presentMetals.has(item.sym);
      return `
        <div class="act-chip ${inV ? 'in-vessel' : ''}"
             style="background:${zc.bg};color:${zc.fg};${item.zone === 'h2' ? 'border:2px dashed #2563eb' : ''}">
          <div style="font-size:16px;font-weight:800">${item.sym}</div>
          <div style="font-size:10px">${item.name}</div>
        </div>
      `;
    }).join('');
  }

  // ── Сохранение и открытие файла .chemlab.json ──
  exportChemlabJson() {
    const payload = {
      app: 'chemlab3d',
      version: 1,
      savedAt: new Date().toISOString(),
      taskId: this.currentTaskId,
      eqParts: this.eqParts,
      labState: this.labState
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `опыт-${this.currentTaskId}.chemlab.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast('Файл опыта (.chemlab.json) сохранён на устройство');
  }

  importChemlabJson(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      this.showToast('Файл слишком велик');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        if (!data || data.app !== 'chemlab3d' || !data.labState) {
          this.showToast('Неверный формат файла опыта');
          return;
        }
        this._pushUndoSnapshot();
        const clean = createInitialLabState(VESSELS[data.labState.vessel] ? data.labState.vessel : 'flask');
        for (const [id, q] of Object.entries(data.labState.amt || {})) {
          if (REAGENTS[id] && typeof q === 'number' && q > 0 && q <= 200) {
            clean.amt[id] = q;
          }
        }
        clean.temp = Math.max(15, Math.min(380, Number(data.labState.temp) || 22));
        clean.heatLvl = [0, 1, 2, 3].includes(data.labState.heatLvl) ? data.labState.heatLvl : 0;
        clean.tubeOn = !!data.labState.tubeOn;
        clean.prog = typeof data.labState.prog === 'object' ? data.labState.prog : {};
        clean.collectedGas = typeof data.labState.collectedGas === 'object' ? data.labState.collectedGas : {};
        clean.coatings = Object.assign(clean.coatings, data.labState.coatings || {});
        clean.seen = Object.assign(clean.seen, data.labState.seen || {});
        this.labState = clean;

        if (data.taskId && TASKS.some((t) => t.id === data.taskId)) {
          this.currentTaskId = data.taskId;
        }
        this.eqParts = Array.isArray(data.eqParts) ? data.eqParts.map(String).slice(0, 20) : [];
        this._renderTaskDropdown();
        this._renderEquationBox();
        this._syncAllUI();
        this.showToast(`Опыт «${file.name}» успешно загружен на стол!`);
      } catch (err) {
        this.showToast('Не удалось прочитать JSON-файл опыта');
      }
    };
    reader.readAsText(file);
  }

  // ── Честный лабораторный отчёт для учителя ──
  _updateReportModalSummary() {
    const realTasks = TASKS.filter((t) => t.id !== 'free');
    const doneCount = realTasks.filter((t) => this.completedTasks[t.id]).length;
    this.dom.repSummaryBox.innerHTML = `
      <div>Зачтено практикумов: <b>${doneCount} из ${realTasks.length}</b></div>
      <div style="margin-top:4px;color:var(--muted)">Записей в протоколе действий: <b>${this.actionLog.length}</b> · Снимок 3D-сцены прикладывается автоматически.</div>
    `;
  }

  _generateTeacherReport(downloadAsFile) {
    const snapshotUrl = this.scene3d.captureSnapshotDataURL();
    const html = buildReportHTML({
      studentName: this.dom.repStudentName.value.trim(),
      studentClass: this.dom.repStudentClass.value.trim(),
      completedIds: this.completedTasks,
      tasks: TASKS,
      log: this.actionLog,
      currentEq: this.eqParts.join(' '),
      snapshotUrl
    });

    if (downloadAsFile) {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'лабораторный-отчет-химлаб3d.html';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.showToast('Отчёт сохранён в файл .html!');
    } else {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        this.showToast('Всплывающее окно заблокировано браузером — используйте кнопку «Скачать файл отчёта»');
      }
    }
  }
}

window.chemLabApp = new ChemLabApp();
