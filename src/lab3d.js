import * as THREE from '../vendor/three.module.min.js';
import { REAGENTS } from './reagents.js';
import { VESSELS } from './chemistry.js';

const CAMERA_PRESETS = {
  all:    { pos: [0.4, 2.35, 6.6], target: [0.35, 1.45, 0], fov: 34 },
  vessel: { pos: [-0.35, 2.05, 4.15], target: [-0.35, 1.62, 0], fov: 30 },
  gas:    { pos: [1.05, 2.0, 4.65], target: [0.95, 1.45, 0], fov: 32 },
  lamp:   { pos: [-0.35, 1.25, 3.65], target: [-0.35, 0.92, 0], fov: 30 }
};

const BENCH_THEMES = {
  classic: {
    name: 'Светлая плитка',
    bg: '#dce8f2',
    tileBase: '#e4f0ec',
    tileAlt: '#d8e8e2',
    grout: '#a7c4bc',
    bench: '#f1f5f9'
  },
  slate: {
    name: 'Тёмный графит',
    bg: '#0f172a',
    tileBase: '#1e293b',
    tileAlt: '#172033',
    grout: '#334155',
    bench: '#cbd5e1'
  },
  warm: {
    name: 'Тёплая аудитория',
    bg: '#efe8dc',
    tileBase: '#f5efe6',
    tileAlt: '#ebe2d5',
    grout: '#cbbba6',
    bench: '#e7dfd3'
  }
};

export class Lab3DScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.webglSupported = true;
    this.sleeping = false;
    this.awakeUntil = performance.now() + 3000;
    this.themeId = 'classic';
    this.presetId = 'all';

    // Относительные координаты вокруг ключевого узла: сосуд стоит в X = -0.35
    this.vesselX = -0.35;
    this.vesselBaseY = 1.18;

    this.camSpherical = { yaw: 0, pitch: 0, zoom: 1 };
    this.camTargetCur = new THREE.Vector3(0.35, 1.45, 0);
    this.camPosCur = new THREE.Vector3(0.4, 2.35, 6.6);

    // Физика живой жидкости и частиц
    this.slosh = { angle: 0, vel: 0 };
    this.bubbles = [];
    this.flakes = [];
    this.steamClouds = [];
    this.troughBubbles = [];
    this.ripples = [];
    this.pourAnim = { active: false, t: 0, dur: 1.0, color: '#cfe8f7', solid: false, formula: '' };
    this.toolAnim = { kind: '', t: 0, dur: 0, extra: {} };
    this.flameTint = { color: '', until: 0 };
    this.flashEffect = { intensity: 0, color: '#ffffff' };

    this.lastState = null;
    this.lastAnalysis = null;
    this.lastSimInfo = { activeGases: [], gasRate: 0, boiling: false };

    this._init();
  }

  _init() {
    const canvas = document.createElement('canvas');
    canvas.className = 'lab3d-canvas';
    this.container.appendChild(canvas);
    this.canvas = canvas;

    // Плашка-подсказка при наведении на 3D-объекты стола
    const tip = document.createElement('div');
    tip.className = 'lab3d-tip';
    this.container.appendChild(tip);
    this.tipEl = tip;

    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false }) ||
           canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      this.webglSupported = false;
      this._renderFallbackBanner();
      return;
    }

    const R = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: true,
      powerPreference: 'high-performance'
    });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.04;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.localClippingEnabled = true;
    this.renderer = R;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 40);

    this._buildEnvironment();
    this._buildLights();
    this._buildRoomAndBench();
    this._buildStandAndBurner();
    this._buildVessels();
    this._buildGasCollector();
    this._buildWashBottle();
    this._buildAnimatedProps();
    this._buildParticles();
    this._bindInteractions();

    this.setBenchTheme(this.themeId);
    this.resize();

    this.lastTs = performance.now();
    this._tick(this.lastTs);
  }

  _renderFallbackBanner() {
    const msg = document.createElement('div');
    msg.className = 'webgl-fallback';
    msg.innerHTML = `
      <div class="webgl-fallback-card">
        <b>Режим без аппаратного 3D (WebGL отключён в браузере)</b>
        <p>Физико-химическая симуляция, приборы, «Микромир», уравнения и лабораторный журнал полностью работают.</p>
      </div>`;
    this.container.appendChild(msg);
  }

  _buildEnvironment() {
    const envScene = new THREE.Scene();
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(16, 10, 16),
      new THREE.MeshBasicMaterial({ color: '#cbd5e1', side: THREE.BackSide })
    );
    envScene.add(room);

    const addPanel = (w, h, x, y, z, rx, ry, col) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
      );
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      envScene.add(m);
    };
    // Окно слева и световые панели на потолке для реалистичных бликов на стекле
    addPanel(5, 6, -7.8, 1.5, 2.0, 0, Math.PI / 2, '#ffffff');
    addPanel(6, 1.6, 0, 4.8, 1.5, Math.PI / 2, 0, '#fffbeb');
    addPanel(6, 1.6, 0, 4.8, -2.2, Math.PI / 2, 0, '#f0f9ff');

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
  }

  _buildLights() {
    this.hemiLight = new THREE.HemisphereLight('#ffffff', '#94a3b8', 0.95);
    this.scene.add(this.hemiLight);

    const dir = new THREE.DirectionalLight('#fffaf0', 1.45);
    dir.position.set(-2.8, 5.6, 4.8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 16;
    dir.shadow.camera.left = -4.5;
    dir.shadow.camera.right = 4.5;
    dir.shadow.camera.top = 4.5;
    dir.shadow.camera.bottom = -2.5;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);
    this.dirLight = dir;

    this.flameLight = new THREE.PointLight('#ff9e44', 0, 4.5, 1.6);
    this.flameLight.position.set(this.vesselX, 0.95, 0.2);
    this.scene.add(this.flameLight);

    this.flashLight = new THREE.PointLight('#ffffff', 0, 7.0, 1.3);
    this.flashLight.position.set(this.vesselX, 1.85, 0.4);
    this.scene.add(this.flashLight);
  }

  _buildRoomAndBench() {
    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.02 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), this.wallMat);
    wall.position.set(0, 3.2, -1.55);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Столешница лабораторного стола
    this.benchMat = new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      roughness: 0.32,
      metalness: 0.04
    });
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 3.6), this.benchMat);
    benchTop.position.set(0, -0.07, 0.15);
    benchTop.receiveShadow = true;
    this.scene.add(benchTop);

    // Передняя кромка стола (химстойкий кант)
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.05, 0.06),
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.45, metalness: 0.3 })
    );
    trim.position.set(0, -0.03, 1.96);
    this.scene.add(trim);

    // Тумба под столом
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.4, 3.3),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.65 })
    );
    cabinet.position.set(0, -1.34, 0.02);
    this.scene.add(cabinet);

    this.interactables = [];
  }

  _buildStandAndBurner() {
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.72, roughness: 0.42 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.92, roughness: 0.22 });
    const brass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.85, roughness: 0.28 });

    // 1. Треножник с сеткой (для колбы и стакана)
    this.tripodGroup = new THREE.Group();
    this.tripodGroup.position.set(this.vesselX, 0, 0);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.032, 14, 40), darkMetal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = this.vesselBaseY - 0.02;
    ring.castShadow = true;
    this.tripodGroup.add(ring);

    // Асбестовая / керамическая рассекательная сетка
    const gauze = new THREE.Mesh(
      new THREE.CylinderGeometry(0.53, 0.53, 0.012, 32),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, metalness: 0.25, transparent: true, opacity: 0.82 })
    );
    gauze.position.y = this.vesselBaseY - 0.01;
    gauze.receiveShadow = true;
    this.tripodGroup.add(gauze);

    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + 0.4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.22, 10), darkMetal);
      leg.position.set(Math.cos(ang) * 0.58, 0.58, Math.sin(ang) * 0.58);
      leg.rotation.z = Math.cos(ang) * 0.14;
      leg.rotation.x = -Math.sin(ang) * 0.14;
      leg.castShadow = true;
      this.tripodGroup.add(leg);
    }
    this.scene.add(this.tripodGroup);

    // 2. Лабораторный штатив с лапкой (для пробирки)
    this.retortGroup = new THREE.Group();
    this.retortGroup.position.set(this.vesselX, 0, 0);
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.65), darkMetal);
    basePlate.position.set(-0.68, 0.025, -0.15);
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    this.retortGroup.add(basePlate);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.75, 14), chrome);
    rod.position.set(-0.88, 1.4, -0.15);
    rod.castShadow = true;
    this.retortGroup.add(rod);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 12), chrome);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-0.44, 2.15, -0.06);
    this.retortGroup.add(arm);

    const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 10, 26, Math.PI * 1.65), darkMetal);
    clamp.rotation.x = Math.PI / 2;
    clamp.rotation.z = 0.4;
    clamp.position.set(0, 2.15, 0);
    this.retortGroup.add(clamp);
    this.retortGroup.visible = false;
    this.scene.add(this.retortGroup);

    // 3. Спиртовка (интерактивная)
    this.burnerGroup = new THREE.Group();
    this.burnerGroup.position.set(this.vesselX, 0, 0);

    const lampPts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.38, 0.0),
      new THREE.Vector2(0.41, 0.08),
      new THREE.Vector2(0.34, 0.36),
      new THREE.Vector2(0.14, 0.48),
      new THREE.Vector2(0.14, 0.56),
      new THREE.Vector2(0.10, 0.56)
    ];
    const lampGlass = new THREE.Mesh(
      new THREE.LatheGeometry(lampPts, 32),
      this._createGlassMaterial(0.16)
    );
    lampGlass.castShadow = true;
    this.burnerGroup.add(lampGlass);

    // Спирт внутри резервуара спиртовки
    const alc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.36, 0.26, 26),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transparent: true, opacity: 0.48, roughness: 0.1 })
    );
    alc.position.y = 0.16;
    this.burnerGroup.add(alc);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.1, 20), brass);
    collar.position.y = 0.59;
    this.burnerGroup.add(collar);

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 0.13, 12),
      new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.95 })
    );
    wick.position.y = 0.66;
    this.burnerGroup.add(wick);

    // Невидимый хитбокс спиртовки для удобного клика мышью/пальцем
    const burnerHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.85, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    burnerHit.position.y = 0.42;
    burnerHit.userData = { action: 'burner', tip: 'Спиртовка: нажмите, чтобы переключить силу пламени' };
    this.burnerGroup.add(burnerHit);
    this.interactables.push(burnerHit);

    // Многослойное 3D-пламя с отсечением по дну сосуда
    this.flameClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.vesselBaseY - 0.01);
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.70, 0);
    this.flameGroup.visible = false;

    const makeFlameCone = (r, h, col, op) => {
      const geo = new THREE.ConeGeometry(r, h, 24, 1, false);
      geo.translate(0, h * 0.46, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: op,
        depthWrite: false,
        clippingPlanes: [this.flameClipPlane]
      });
      return new THREE.Mesh(geo, mat);
    };

    this.flameOuter = makeFlameCone(0.145, 0.50, '#ff5d00', 0.78);
    this.flameMid = makeFlameCone(0.095, 0.36, '#ffb703', 0.88);
    this.flameCore = makeFlameCone(0.050, 0.18, '#3b82f6', 0.85);
    this.flameGroup.add(this.flameOuter, this.flameMid, this.flameCore);

    this.burnerGroup.add(this.flameGroup);
    this.scene.add(this.burnerGroup);
  }

  _createGlassMaterial(opacity = 0.18) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#eef8ff',
      transparent: true,
      opacity,
      roughness: 0.05,
      metalness: 0.0,
      reflectivity: 0.95,
      ior: 1.48,
      envMapIntensity: 1.35,
      depthWrite: false,
      side: THREE.FrontSide
    });
    // Усиление краевого блика Френеля для выразительных стеклянных стенок
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.6);
         gl_FragColor.rgb += vec3(0.78, 0.88, 0.96) * fres * 0.55;
         gl_FragColor.a = clamp(gl_FragColor.a + fres * 0.46, 0.0, 0.92);`
      );
    };
    return mat;
  }

  _vesselProfile(kind, offset = 0) {
    // Профиль в метрах сцены: [radius, yFromVesselBottom]
    if (kind === 'flask') {
      return [
        [0.001, 0.0 + offset],
        [0.44 + offset, 0.0 + offset],
        [0.50 + offset, 0.08],
        [0.47 + offset, 0.22],
        [0.20 + offset, 0.88],
        [0.18 + offset, 1.24],
        [0.22 + offset, 1.28]
      ];
    }
    if (kind === 'tube') {
      const pts = [];
      const R = 0.175 + offset;
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * (Math.PI / 2);
        pts.push([Math.max(0.001, Math.sin(a) * R), (1 - Math.cos(a)) * R]);
      }
      pts.push([R, 1.34], [R + 0.03, 1.38]);
      return pts;
    }
    // beaker
    return [
      [0.001, 0.0 + offset],
      [0.48 + offset, 0.0 + offset],
      [0.51 + offset, 0.05],
      [0.51 + offset, 1.16],
      [0.55 + offset, 1.21]
    ];
  }

  _innerRadiusAt(kind, yLocal) {
    if (kind === 'tube') {
      if (yLocal < 0.17) {
        const dy = 0.17 - yLocal;
        return Math.sqrt(Math.max(0.001, 0.17 * 0.17 - dy * dy)) * 0.94;
      }
      return 0.168;
    }
    if (kind === 'beaker') {
      return 0.495;
    }
    // flask
    if (yLocal <= 0.22) return 0.46;
    if (yLocal >= 0.88) return 0.18;
    const t = (yLocal - 0.22) / (0.88 - 0.22);
    return 0.46 * (1 - t) + 0.18 * t;
  }

  _liquidMaxHeight(kind) {
    if (kind === 'tube') return 1.08;
    if (kind === 'beaker') return 0.98;
    return 0.82; // flask 100 ml
  }

  _mouthHeight(kind) {
    if (kind === 'tube') return 1.38;
    if (kind === 'beaker') return 1.21;
    return 1.28;
  }

  _buildScaleTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 512);
    g.strokeStyle = 'rgba(255,255,255,0.82)';
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.lineWidth = 3;
    g.font = '700 22px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';

    const marks = kind === 'tube' ? [5, 10, 15, 20, 25] : (kind === 'beaker' ? [50, 100, 150, 200] : [20, 40, 60, 80, 100]);
    const cap = VESSELS[kind].cap;
    marks.forEach((ml) => {
      const frac = ml / cap;
      const y = 460 - frac * 370;
      g.beginPath();
      g.moveTo(85, y);
      g.lineTo(132, y);
      g.stroke();
      g.fillText(String(ml), 140, y);
    });
    g.font = '600 18px system-ui, sans-serif';
    g.fillText('мл', 140, 52);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildVessels() {
    this.vesselRoot = new THREE.Group();
    this.vesselRoot.position.set(this.vesselX, this.vesselBaseY, 0);
    this.scene.add(this.vesselRoot);

    this.liqClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.5);
    this.gasClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
    this.sedClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2);
    this.mirrorClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.2);

    this.liqMat = new THREE.MeshPhysicalMaterial({
      color: '#dff2fc',
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.0,
      ior: 1.33,
      side: THREE.DoubleSide,
      clippingPlanes: [this.liqClipPlane]
    });

    this.meniscusMat = new THREE.MeshPhysicalMaterial({
      color: '#dff2fc',
      transparent: true,
      opacity: 0.62,
      roughness: 0.04,
      metalness: 0.05,
      envMapIntensity: 1.4
    });

    this.sedimentMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.9,
      transparent: true,
      opacity: 0,
      clippingPlanes: [this.sedClipPlane]
    });

    this.mirrorMat = new THREE.MeshStandardMaterial({
      color: '#f1f5f9',
      metalness: 1.0,
      roughness: 0.06,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      clippingPlanes: [this.mirrorClipPlane]
    });

    this.sublMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });

    this.headGasMat = new THREE.MeshBasicMaterial({
      color: '#b45309',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      clippingPlanes: [this.gasClipPlane]
    });

    this.vesselMeshes = {};
    for (const kind of ['flask', 'tube', 'beaker']) {
      const grp = new THREE.Group();
      const outerPts = this._vesselProfile(kind, 0.014).map(([r, y]) => new THREE.Vector2(r, y));
      const innerPts = this._vesselProfile(kind, 0).slice(0, -1).map(([r, y]) => new THREE.Vector2(Math.max(0.001, r * 0.96), y + 0.01));

      const glassBack = new THREE.Mesh(
        new THREE.LatheGeometry(outerPts, 44),
        new THREE.MeshPhysicalMaterial({
          color: '#dceefb',
          transparent: true,
          opacity: 0.08,
          roughness: 0.08,
          side: THREE.BackSide,
          depthWrite: false
        })
      );
      const glassFront = new THREE.Mesh(new THREE.LatheGeometry(outerPts, 44), this._createGlassMaterial(0.17));
      glassFront.renderOrder = 6;

      const liqMesh = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 40), this.liqMat);
      liqMesh.renderOrder = 3;

      const sedMesh = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 36), this.sedimentMat);
      sedMesh.scale.set(0.985, 1, 0.985);
      sedMesh.renderOrder = 4;

      const mirMesh = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 36), this.mirrorMat);
      mirMesh.scale.set(0.995, 1, 0.995);
      mirMesh.renderOrder = 5;

      const headGasMesh = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 32), this.headGasMat);
      headGasMesh.renderOrder = 4;

      // Кольцо возгонки у горлышка
      const mouthY = this._mouthHeight(kind);
      const neckR = this._innerRadiusAt(kind, mouthY - 0.22);
      const sublRing = new THREE.Mesh(
        new THREE.CylinderGeometry(neckR * 0.99, neckR * 0.99, 0.26, 32, 1, true),
        this.sublMat
      );
      sublRing.position.y = mouthY - 0.26;
      sublRing.renderOrder = 5;

      // Градуировка на передней стенке
      const scaleR = kind === 'tube' ? 0.192 : (kind === 'beaker' ? 0.528 : 0.36);
      const scaleGeo = new THREE.CylinderGeometry(scaleR, kind === 'flask' ? 0.48 : scaleR, this._liquidMaxHeight(kind) * 1.05, 24, 1, true, -0.35, 0.7);
      const scaleMesh = new THREE.Mesh(
        scaleGeo,
        new THREE.MeshBasicMaterial({
          map: this._buildScaleTexture(kind),
          transparent: true,
          depthWrite: false
        })
      );
      scaleMesh.position.y = this._liquidMaxHeight(kind) * 0.52 + 0.04;
      scaleMesh.renderOrder = 7;

      // Невидимый хитбокс сосуда для добавления выбранного реактива по клику
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 1.35, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.68;
      hit.userData = { action: 'vessel', tip: 'Нажмите на сосуд, чтобы добавить выбранный реактив' };
      this.interactables.push(hit);

      grp.add(glassBack, liqMesh, sedMesh, mirMesh, headGasMesh, sublRing, glassFront, scaleMesh, hit);
      grp.visible = kind === 'flask';
      this.vesselRoot.add(grp);
      this.vesselMeshes[kind] = grp;
    }

    // Диск мениска жидкости
    this.meniscusMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.meniscusMat);
    this.meniscusMesh.rotation.x = -Math.PI / 2;
    this.meniscusMesh.renderOrder = 4;
    this.meniscusMesh.visible = false;
    this.vesselRoot.add(this.meniscusMesh);

    // Группа кусочков твёрдых веществ в сосуде
    this.solidsGroup = new THREE.Group();
    this.vesselRoot.add(this.solidsGroup);
    this.solidsSig = '';
  }

  _buildGasCollector() {
    // Кристаллизатор с водой + перевёрнутая градуированная пробирка справа + газоотводная трубка
    this.gasRigGroup = new THREE.Group();
    this.scene.add(this.gasRigGroup);

    const troughX = 1.55;
    // Стеклянная ванна (кристаллизатор)
    const troughGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.58, 0.52, 36, 1, true),
      this._createGlassMaterial(0.20)
    );
    troughGlass.position.set(troughX, 0.26, 0);
    this.gasRigGroup.add(troughGlass);

    const troughWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.59, 0.56, 0.40, 32),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transparent: true, opacity: 0.45, roughness: 0.08 })
    );
    troughWater.position.set(troughX, 0.20, 0);
    this.gasRigGroup.add(troughWater);

    // Перевёрнутый цилиндр-газометр (до 25 мл)
    const invTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.35, 28),
      this._createGlassMaterial(0.20)
    );
    invTube.position.set(troughX, 0.92, 0);
    this.gasRigGroup.add(invTube);

    // Столбик воды в газометре, опускающийся по мере сбора газа
    this.collectorWaterMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.168, 0.168, 1.0, 24),
      new THREE.MeshPhysicalMaterial({ color: '#93c5fd', transparent: true, opacity: 0.52, roughness: 0.06 })
    );
    this.collectorWaterMesh.position.set(troughX, 0.90, 0);
    this.gasRigGroup.add(this.collectorWaterMesh);

    // Хитбокс пробирки-газометра (проверка собранного газа лучиной)
    const gasHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.45, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    gasHit.position.set(troughX, 0.92, 0);
    gasHit.userData = { action: 'splint', tip: 'Пробирка-приёмник газа: нажмите, чтобы проверить газ лучиной' };
    this.gasRigGroup.add(gasHit);
    this.interactables.push(gasHit);

    // Резиновая пробка и изогнутая стеклянная газоотводная трубка (перестраиваются под высоту посуды)
    this.stopperMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.16, 0.16, 22),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.85 })
    );
    this.gasRigGroup.add(this.stopperMesh);

    this.deliveryTubeMesh = null;
    this.deliveryTubeMat = new THREE.MeshPhysicalMaterial({
      color: '#e2f1fb',
      transparent: true,
      opacity: 0.52,
      roughness: 0.08
    });
    this._rebuildDeliveryTube('flask');
  }

  _rebuildDeliveryTube(kind) {
    if (this.deliveryTubeMesh) {
      this.gasRigGroup.remove(this.deliveryTubeMesh);
      this.deliveryTubeMesh.geometry.dispose();
    }
    const mouthWorldY = (kind === 'tube' ? 0.92 : this.vesselBaseY) + this._mouthHeight(kind);
    const neckR = kind === 'tube' ? 0.18 : 0.19;
    this.stopperMesh.scale.set(neckR / 0.18, 1, neckR / 0.18);
    this.stopperMesh.position.set(this.vesselX, mouthWorldY - 0.02, 0);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(this.vesselX, mouthWorldY - 0.08, 0),
      new THREE.Vector3(this.vesselX, mouthWorldY + 0.25, 0),
      new THREE.Vector3(0.55, mouthWorldY + 0.22, 0),
      new THREE.Vector3(1.22, 0.55, 0),
      new THREE.Vector3(1.55, 0.24, 0)
    ]);
    const geo = new THREE.TubeGeometry(curve, 44, 0.024, 12, false);
    this.deliveryTubeMesh = new THREE.Mesh(geo, this.deliveryTubeMat);
    this.gasRigGroup.add(this.deliveryTubeMesh);
  }

  _buildWashBottle() {
    // Пластиковая промывалка с дистиллированной водой H₂O слева на столе
    const wb = new THREE.Group();
    wb.position.set(-1.75, 0, 0.18);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.86, 26),
      new THREE.MeshPhysicalMaterial({ color: '#f8fafc', transparent: true, opacity: 0.72, roughness: 0.35 })
    );
    body.position.y = 0.43;
    body.castShadow = true;
    wb.add(body);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.58, 22),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.55 })
    );
    water.position.y = 0.30;
    wb.add(water);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 })
    );
    cap.position.y = 0.91;
    wb.add(cap);

    const nozzleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.96, 0),
      new THREE.Vector3(0.05, 1.18, 0),
      new THREE.Vector3(0.28, 1.12, 0)
    ]);
    const nozzle = new THREE.Mesh(
      new THREE.TubeGeometry(nozzleCurve, 16, 0.018, 8, false),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 })
    );
    wb.add(nozzle);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.2, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.6;
    hit.userData = { action: 'water', tip: 'Промывалка H₂O: нажмите, чтобы долить 5 мл дистиллированной воды' };
    wb.add(hit);
    this.interactables.push(hit);

    this.scene.add(wb);
  }

  _buildAnimatedProps() {
    // 1. Наклоняющаяся склянка со струёй жидкости при приливании
    this.pourBottleGroup = new THREE.Group();
    this.pourBottleGroup.visible = false;

    const bBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.48, 22),
      new THREE.MeshPhysicalMaterial({ color: '#92400e', transparent: true, opacity: 0.68, roughness: 0.18 })
    );
    const bNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.10, 0.16, 18),
      new THREE.MeshPhysicalMaterial({ color: '#92400e', transparent: true, opacity: 0.68, roughness: 0.18 })
    );
    bNeck.position.y = 0.30;
    this.pourBottleGroup.add(bBody, bNeck);
    this.scene.add(this.pourBottleGroup);

    this.streamMat = new THREE.MeshPhysicalMaterial({
      color: '#dff2fc',
      transparent: true,
      opacity: 0.72,
      roughness: 0.05
    });
    this.streamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 1, 12), this.streamMat);
    this.streamMesh.visible = false;
    this.scene.add(this.streamMesh);

    // 2. Анимируемый инструмент (лучина / петля / щипцы)
    this.propGroup = new THREE.Group();
    this.propGroup.visible = false;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: '#d6a87c', roughness: 0.75 })
    );
    stick.rotation.z = Math.PI / 3;
    stick.position.set(-0.38, 0.24, 0);
    this.propStick = stick;

    this.propTipFlame = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 14, 14),
      new THREE.MeshBasicMaterial({ color: '#ffae34', transparent: true, opacity: 0.9 })
    );
    this.propTipFlame.scale.set(0.8, 1.7, 0.8);
    this.propGroup.add(stick, this.propTipFlame);
    this.scene.add(this.propGroup);
  }

  _buildParticles() {
    // 1. Пузырьки газа и кипения в сосуде (InstancedMesh)
    const bubGeo = new THREE.SphereGeometry(1, 12, 12);
    const bubMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.58,
      roughness: 0.05,
      ior: 1.1,
      envMapIntensity: 1.6
    });
    this.bubbleInst = new THREE.InstancedMesh(bubGeo, bubMat, 220);
    this.bubbleInst.count = 0;
    this.bubbleInst.renderOrder = 5;
    this.scene.add(this.bubbleInst);

    // 2. Хлопья осадка (InstancedMesh)
    const flkGeo = new THREE.DodecahedronGeometry(1, 0);
    this.flakeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
    this.flakeInst = new THREE.InstancedMesh(flkGeo, this.flakeMat, 120);
    this.flakeInst.count = 0;
    this.flakeInst.renderOrder = 4;
    this.scene.add(this.flakeInst);

    // 3. Пузырьки в пробирке-газометре
    this.troughBubbleInst = new THREE.InstancedMesh(bubGeo, bubMat, 40);
    this.troughBubbleInst.count = 0;
    this.scene.add(this.troughBubbleInst);

    // 4. Клубы пара / бурого газа NO₂ / дыма над горлышком
    const steamTex = this._createSoftCircleTexture();
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({
        map: steamTex,
        color: '#f1f5f9',
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.scene.add(sp);
      this.steamClouds.push({ sprite: sp, life: 0, x: 0, y: 0, z: 0, vx: 0, size: 0.2, color: '#f1f5f9' });
    }

    this._dummy = new THREE.Object3D();
  }

  _createSoftCircleTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  _bindInteractions() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;

    const updatePointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return rect;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      this.wake(1500);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.webglSupported) return;
      const rect = updatePointer(e);
      if (dragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > 4) moved = true;
        startX = e.clientX;
        startY = e.clientY;
        this.camSpherical.yaw = Math.max(-0.52, Math.min(0.52, this.camSpherical.yaw - dx * 0.0045));
        this.camSpherical.pitch = Math.max(-0.22, Math.min(0.32, this.camSpherical.pitch + dy * 0.0035));
        this.wake(1200);
        this.tipEl.classList.remove('on');
        return;
      }

      // Проверка наведения только внутри холста
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactables, false)
          .filter((h) => this._isObjectVisible(h.object));
        if (hits.length > 0) {
          const info = hits[0].object.userData;
          this.canvas.style.cursor = 'pointer';
          this.tipEl.textContent = info.tip || '';
          this.tipEl.style.left = `${e.clientX - rect.left}px`;
          this.tipEl.style.top = `${e.clientY - rect.top - 14}px`;
          this.tipEl.classList.add('on');
        } else {
          this.canvas.style.cursor = 'grab';
          this.tipEl.classList.remove('on');
        }
      } else {
        this.tipEl.classList.remove('on');
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        updatePointer(e);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactables, false)
          .filter((h) => this._isObjectVisible(h.object));
        if (hits.length > 0) {
          const act = hits[0].object.userData.action;
          if (act && this.callbacks.onObjectClick) {
            this.callbacks.onObjectClick(act);
          }
        }
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camSpherical.zoom = Math.max(0.68, Math.min(1.38, this.camSpherical.zoom + e.deltaY * 0.0007));
      this.wake(1200);
    }, { passive: false });

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  _isObjectVisible(obj) {
    let cur = obj;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  }

  setBenchTheme(themeId) {
    if (!this.webglSupported) return;
    const T = BENCH_THEMES[themeId] || BENCH_THEMES.classic;
    this.themeId = themeId;
    this.scene.background = new THREE.Color(T.bg);
    this.benchMat.color.set(T.bench);

    // Рисуем текстуру кафельной плитки и карту рельефа
    const size = 512;
    const makeTex = (bump) => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = bump ? '#303030' : T.grout;
      g.fillRect(0, 0, size, size);
      const N = 4;
      const step = size / N;
      for (let ix = 0; ix < N; ix++) {
        for (let iy = 0; iy < N; iy++) {
          g.fillStyle = bump ? '#e5e5e5' : ((ix + iy) % 2 === 0 ? T.tileBase : T.tileAlt);
          g.beginPath();
          g.roundRect(ix * step + 4, iy * step + 4, step - 8, step - 8, 8);
          g.fill();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(9, 4.5);
      if (!bump) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    if (this.wallMat.map) this.wallMat.map.dispose();
    if (this.wallMat.bumpMap) this.wallMat.bumpMap.dispose();
    this.wallMat.map = makeTex(false);
    this.wallMat.bumpMap = makeTex(true);
    this.wallMat.bumpScale = 0.015;
    this.wallMat.needsUpdate = true;
    this.wake(800);
  }

  setCameraPreset(presetId) {
    if (CAMERA_PRESETS[presetId]) {
      this.presetId = presetId;
      this.camSpherical = { yaw: 0, pitch: 0, zoom: 1 };
      this.wake(2000);
    }
  }

  triggerPour(reagent, isSolid = false) {
    this.pourAnim = {
      active: true,
      t: 0,
      dur: isSolid ? 0.75 : 1.05,
      color: reagent.color || '#dff2fc',
      solid: isSolid,
      formula: reagent.formula || ''
    };
    this.triggerSplash(isSolid ? 0.85 : 0.55);
    this.wake(3200);
  }

  triggerSplash(strength = 0.6) {
    this.slosh.vel += (Math.random() < 0.5 ? -1 : 1) * strength * 3.8;
    this.wake(3000);
  }

  triggerFlameTint(hexColor, durationMs = 4500) {
    this.flameTint = { color: hexColor, until: performance.now() + durationMs };
    this.wake(durationMs + 600);
  }

  triggerToolAnimation(kind, extra = {}) {
    this.toolAnim = { kind, t: 0, dur: extra.dur || 2.1, extra };
    if (extra.flashColor) {
      this.flashEffect = { intensity: extra.flashPower || 8, color: extra.flashColor };
    }
    this.wake(3000);
  }

  wake(ms = 2200) {
    this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms);
    if (this.sleeping && this.webglSupported) {
      this.sleeping = false;
      this.lastTs = performance.now();
      this._tick(this.lastTs);
    }
  }

  isSleeping() {
    return this.sleeping;
  }

  syncState(state, analysis, simInfo = {}) {
    const prevVessel = this.lastState?.vessel;
    const prevPrCount = this.lastAnalysis?.precipitates?.length || 0;
    this.lastState = state;
    this.lastAnalysis = analysis;
    this.lastSimInfo = simInfo;

    if (!this.webglSupported) return;

    if (prevVessel !== state.vessel) {
      this._rebuildDeliveryTube(state.vessel);
    }

    // Если выпал новый осадок — рождаем свежую порцию оседающих хлопьев
    if (analysis.precipitates.length > prevPrCount && analysis.wet) {
      const pr = analysis.precipitates[0];
      const maxH = this._liquidMaxHeight(state.vessel);
      const cap = VESSELS[state.vessel].cap;
      const liqH = Math.min(maxH, (analysis.volume / cap) * maxH);
      for (let i = 0; i < 65; i++) {
        const rMax = this._innerRadiusAt(state.vessel, liqH * 0.5) * 0.85;
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * rMax;
        this.flakes.push({
          x: Math.cos(ang) * rr,
          y: 0.08 + Math.random() * Math.max(0.08, liqH - 0.1),
          z: Math.sin(ang) * rr,
          vy: -0.06 - Math.random() * 0.09,
          size: 0.012 + Math.random() * 0.014,
          rot: Math.random() * 6.28,
          color: pr.color
        });
      }
      if (this.flakes.length > 120) this.flakes.splice(0, this.flakes.length - 120);
    } else if (analysis.precipitates.length === 0) {
      this.flakes.length = 0;
    }

    this._syncSolidMeshes(state, analysis);

    if (
      state.heatLvl > 0 ||
      simInfo.gasRate > 0.01 ||
      simInfo.boiling ||
      Math.abs(state.temp - 22) > 0.25
    ) {
      this.wake(1800);
    } else {
      this.wake(450);
    }
  }

  _syncSolidMeshes(state, analysis) {
    const sig = Object.entries(state.amt || {})
      .filter(([id, q]) => q > 0 && REAGENTS[id]?.state === 's')
      .map(([id, q]) => {
        const p = Math.round((state.prog[id] || 0) * 25);
        const cu = Math.round((state.coatings.copperPlated || 0) * 10);
        const ch = Math.round((state.coatings.carbonFoam || 0) * 10);
        const wh = Math.round((state.coatings.anhydrousWhite || 0) * 10);
        return `${id}:${q}:${p}:${cu}:${ch}:${wh}`;
      })
      .join('|');

    if (sig === this.solidsSig) return;
    this.solidsSig = sig;

    while (this.solidsGroup.children.length) {
      const m = this.solidsGroup.children.pop();
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }

    let slotIdx = 0;
    for (const [id, q] of Object.entries(state.amt || {})) {
      if (q <= 0) continue;
      const r = REAGENTS[id];
      if (!r || r.state !== 's') continue;
      const p = Math.min(1, state.prog[id] || 0);
      if (p >= 0.99 && !r.catalyst && !r.adsorbent) continue;

      const scaleLeft = r.catalyst || r.adsorbent ? 1 : Math.max(0.18, 1 - p * 0.85);
      let col = r.color || '#cbd5e1';
      if (state.coatings.copperPlated > 0.2 && ['fe', 'zn', 'mg', 'al'].includes(id)) {
        col = '#c8753c';
      }
      if (id === 'cuso4s' && state.coatings.anhydrousWhite > 0.4) {
        col = '#f1f5f9';
      }
      if (id === 'malach' && (state.prog.dry_malach || 0) > 0.5) {
        col = '#1c1917';
      }
      if (id === 'sucrose' && state.coatings.carbonFoam > 0.25) {
        col = '#18181b';
      }

      const mat = new THREE.MeshStandardMaterial({
        color: col,
        metalness: r.cat === 'met' && state.coatings.carbonFoam < 0.2 ? 0.78 : 0.08,
        roughness: r.cat === 'met' ? 0.32 : 0.85
      });

      const piecesCount = r.shape === 'powder' ? 9 : (r.shape === 'wire' ? 2 : 4);
      for (let i = 0; i < piecesCount; i++) {
        let geo;
        if (r.shape === 'wire') {
          geo = new THREE.TorusGeometry(0.065, 0.014, 8, 20, Math.PI * 1.5);
        } else if (r.shape === 'pellet' || r.float) {
          geo = new THREE.SphereGeometry(0.042, 14, 14);
        } else {
          geo = new THREE.DodecahedronGeometry(r.shape === 'powder' ? 0.026 : 0.046, 0);
        }

        const mesh = new THREE.Mesh(geo, mat);
        const ang = (slotIdx * 1.7 + i * 2.1);
        const rad = (state.vessel === 'tube' ? 0.06 : 0.18) * ((i + 1) / piecesCount);
        mesh.position.set(Math.cos(ang) * rad, 0.04 + (i % 2) * 0.02, Math.sin(ang) * rad);

        if (id === 'sucrose' && state.coatings.carbonFoam > 0.2) {
          const grow = 1 + state.coatings.carbonFoam * 3.2;
          mesh.scale.set(grow * 1.4, grow * 2.6, grow * 1.4);
          mesh.position.y = 0.08 + state.coatings.carbonFoam * 0.18;
        } else {
          mesh.scale.setScalar(scaleLeft);
        }

        mesh.userData = { float: !!r.float, baseAng: ang, rad };
        this.solidsGroup.add(mesh);
      }
      slotIdx++;
    }
  }

  resize() {
    if (!this.webglSupported || !this.renderer) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(200, rect.width);
    const h = Math.max(200, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wake(400);
  }

  captureSnapshotDataURL() {
    if (!this.webglSupported || !this.renderer) return '';
    this.renderer.render(this.scene, this.camera);
    try {
      return this.canvas.toDataURL('image/jpeg', 0.86);
    } catch (e) {
      return '';
    }
  }

  _tick(ts) {
    if (!this.webglSupported) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;

    const stillActive = this._stepFrame(dt, ts);
    this.renderer.render(this.scene, this.camera);

    if (stillActive || ts < this.awakeUntil) {
      this.sleeping = false;
      this.raf = requestAnimationFrame((t) => this._tick(t));
    } else {
      this.sleeping = true;
      if (this.callbacks.onSleepChange) this.callbacks.onSleepChange(true);
    }
  }

  _stepFrame(dt, ts) {
    const s = this.lastState;
    const a = this.lastAnalysis;
    const sim = this.lastSimInfo || {};
    let busy = false;

    // 1. Плавное движение камеры к выбранному ракурсу + орбита мышью
    const P = CAMERA_PRESETS[this.presetId] || CAMERA_PRESETS.all;
    const targetGoal = new THREE.Vector3(...P.target);
    const baseOffset = new THREE.Vector3(...P.pos).sub(targetGoal).multiplyScalar(this.camSpherical.zoom);
    const cosY = Math.cos(this.camSpherical.yaw);
    const sinY = Math.sin(this.camSpherical.yaw);
    const rx = baseOffset.x * cosY - baseOffset.z * sinY;
    const rz = baseOffset.x * sinY + baseOffset.z * cosY;
    const ry = baseOffset.y + this.camSpherical.pitch * 2.2;
    const posGoal = new THREE.Vector3(targetGoal.x + rx, Math.max(0.35, targetGoal.y + ry), targetGoal.z + rz);

    if (this.camPosCur.distanceTo(posGoal) > 0.002 || this.camTargetCur.distanceTo(targetGoal) > 0.002) {
      busy = true;
    }
    this.camPosCur.lerp(posGoal, Math.min(1, dt * 8));
    this.camTargetCur.lerp(targetGoal, Math.min(1, dt * 8));
    if (Math.abs(this.camera.fov - P.fov) > 0.05) {
      this.camera.fov += (P.fov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
      busy = true;
    }
    this.camera.position.copy(this.camPosCur);
    this.camera.lookAt(this.camTargetCur);

    if (!s || !a) return busy;

    // 2. Посуда, штатив/треножник и уровень жидкости
    const kind = s.vessel;
    const vesselY = kind === 'tube' ? 0.92 : this.vesselBaseY;
    this.vesselRoot.position.set(this.vesselX, vesselY, 0);
    for (const k of ['flask', 'tube', 'beaker']) {
      this.vesselMeshes[k].visible = k === kind;
    }
    this.tripodGroup.visible = kind !== 'tube';
    this.retortGroup.visible = kind === 'tube';
    this.gasRigGroup.visible = !!s.tubeOn && VESSELS[kind].allowTube;

    const cap = VESSELS[kind].cap;
    const maxH = this._liquidMaxHeight(kind);
    const liqFrac = Math.min(1.04, a.volume / cap);
    const liqLocalY = a.wet ? Math.max(0.045, liqFrac * maxH) : -0.2;
    const liqWorldY = vesselY + liqLocalY;

    // Колебания мениска жидкости (маятник с затуханием)
    this.slosh.vel += (-28 * this.slosh.angle - 3.6 * this.slosh.vel) * dt;
    this.slosh.angle += this.slosh.vel * dt;
    if (Math.abs(this.slosh.angle) > 0.002 || Math.abs(this.slosh.vel) > 0.005) busy = true;

    const sloshNormal = new THREE.Vector3(Math.sin(this.slosh.angle * 0.25), -1, 0).normalize();
    this.liqClipPlane.setFromNormalAndCoplanarPoint(sloshNormal, new THREE.Vector3(this.vesselX, liqWorldY, 0));
    this.gasClipPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(this.vesselX, a.wet ? liqWorldY : vesselY + 0.02, 0)
    );

    this.liqMat.color.lerp(new THREE.Color(a.liquidColor || '#dff2fc'), Math.min(1, dt * 6));
    this.liqMat.opacity = a.wet ? a.liquidOpacity : 0;
    this.meniscusMat.color.copy(this.liqMat.color);
    this.meniscusMat.opacity = a.wet ? Math.min(0.85, a.liquidOpacity + 0.16) : 0;

    if (a.wet) {
      const rMen = this._innerRadiusAt(kind, liqLocalY) * 0.965;
      this.meniscusMesh.visible = true;
      this.meniscusMesh.position.set(0, liqLocalY, 0);
      this.meniscusMesh.scale.set(rMen, rMen, 1);
      this.meniscusMesh.rotation.set(-Math.PI / 2, 0, this.slosh.angle * 0.25);
    } else {
      this.meniscusMesh.visible = false;
    }

    // Плавающие щелочные металлы бегают по поверхности воды
    const tSec = ts / 1000;
    for (const child of this.solidsGroup.children) {
      if (child.userData.float && a.wet) {
        busy = true;
        const rMax = this._innerRadiusAt(kind, liqLocalY) * 0.65;
        const a1 = child.userData.baseAng + tSec * 3.4;
        child.position.set(
          Math.cos(a1) * rMax * Math.sin(tSec * 2.1),
          liqLocalY + 0.01,
          Math.sin(a1 * 1.3) * rMax * 0.7
        );
      }
    }

    // Донный слой осадка, серебряное зеркало, кольцо возгонки и газ над раствором
    if (a.precipitates.length > 0) {
      const pr = a.precipitates[0];
      this.sedimentMat.color.lerp(new THREE.Color(pr.color), Math.min(1, dt * 6));
      this.sedimentMat.opacity = Math.min(0.92, this.sedimentMat.opacity + dt * 1.4);
      const sedTop = vesselY + (a.wet ? Math.min(liqLocalY * 0.35, 0.14) : 0.08);
      this.sedClipPlane.constant = sedTop;
    } else {
      this.sedimentMat.opacity = Math.max(0, this.sedimentMat.opacity - dt * 2.5);
    }

    this.mirrorMat.opacity = (s.coatings.silverMirror || 0) * 0.92;
    this.mirrorClipPlane.constant = vesselY + Math.max(0.35, liqLocalY + 0.05);
    this.sublMat.opacity = (s.coatings.sublimedRing || 0) * 0.88;

    if (s.headspace?.gas && s.headspace.amount > 0.02) {
      const gCol = s.headspace.gas === 'Cl2' ? '#bef264' : '#b45309';
      this.headGasMat.color.set(gCol);
      this.headGasMat.opacity = Math.min(0.55, s.headspace.amount * 0.52);
    } else {
      this.headGasMat.opacity = Math.max(0, this.headGasMat.opacity - dt * 1.5);
    }

    // 3. Пламя спиртовки и окрашивание катионами
    if (s.heatLvl > 0) {
      busy = true;
      this.flameGroup.visible = true;
      const scaleH = [0, 0.72, 1.05, 1.42][s.heatLvl] || 1;
      const flicker = 1 + 0.09 * Math.sin(tSec * 21) + 0.05 * Math.sin(tSec * 37);
      const sway = 0.06 * Math.sin(tSec * 8.5) + 0.03 * Math.cos(tSec * 14.2);
      this.flameGroup.scale.set(0.9 + 0.1 * scaleH, scaleH * flicker, 0.9 + 0.1 * scaleH);
      this.flameGroup.rotation.z = sway;
      this.flameClipPlane.constant = vesselY - 0.01;

      const tinted = ts < this.flameTint.until && this.flameTint.color;
      this.flameOuter.material.color.set(tinted ? this.flameTint.color : '#ff5d00');
      this.flameMid.material.color.set(tinted ? this.flameTint.color : '#ffb703');
      this.flameLight.color.set(tinted ? this.flameTint.color : '#ff9e44');
      this.flameLight.intensity = (1.6 + s.heatLvl * 0.75) * flicker;
    } else {
      this.flameGroup.visible = false;
      this.flameLight.intensity = 0;
    }

    // Затухание вспышек (хлопок H₂, вспышка Mg)
    if (this.flashEffect.intensity > 0.02) {
      busy = true;
      this.flashLight.color.set(this.flashEffect.color);
      this.flashLight.intensity = this.flashEffect.intensity;
      this.flashEffect.intensity *= Math.pow(0.03, dt);
    } else {
      this.flashLight.intensity = 0;
    }

    // 4. Пузырьки реакции и кипения в сосуде
    const gasIntensity = (sim.gasRate || 0) * 0.8 + (sim.boiling ? 16 : 0);
    if (a.wet && gasIntensity > 0.05) {
      busy = true;
      const spawnCount = Math.min(6, Math.floor(gasIntensity * dt * 8 + (Math.random() < (gasIntensity * dt * 8) % 1 ? 1 : 0)));
      for (let i = 0; i < spawnCount && this.bubbles.length < 210; i++) {
        const rBot = this._innerRadiusAt(kind, 0.05) * 0.72;
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * rBot;
        this.bubbles.push({
          x: Math.cos(ang) * rr,
          y: 0.04 + Math.random() * 0.04,
          z: Math.sin(ang) * rr,
          r: 0.008 + Math.random() * 0.016,
          vy: 0.32 + Math.random() * 0.42,
          ph: Math.random() * 6.28
        });
      }
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.vy * dt;
      b.x += Math.sin(tSec * 9 + b.ph) * 0.04 * dt;
      if (!a.wet || b.y >= liqLocalY - 0.01) {
        this.bubbles.splice(i, 1);
      }
    }
    if (this.bubbles.length > 0) busy = true;

    let bIdx = 0;
    for (const b of this.bubbles) {
      this._dummy.position.set(this.vesselX + b.x, vesselY + b.y, b.z);
      this._dummy.scale.setScalar(b.r);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.bubbleInst.setMatrixAt(bIdx++, this._dummy.matrix);
    }
    this.bubbleInst.count = bIdx;
    this.bubbleInst.instanceMatrix.needsUpdate = true;

    // 5. Движение хлопьев осадка
    for (const f of this.flakes) {
      if (f.y > 0.045) {
        busy = true;
        f.y = Math.max(0.035, f.y + f.vy * dt);
        f.x += Math.sin(tSec * 2.5 + f.rot) * 0.015 * dt;
        f.rot += dt * 0.8;
      }
    }
    if (this.flakes.length > 0) {
      this.flakeMat.color.set(this.flakes[0].color || '#ffffff');
    }
    let fIdx = 0;
    for (const f of this.flakes) {
      if (!a.wet) break;
      this._dummy.position.set(this.vesselX + f.x, vesselY + Math.min(f.y, liqLocalY - 0.02), f.z);
      this._dummy.scale.setScalar(f.size);
      this._dummy.rotation.set(f.rot, f.rot * 0.7, 0);
      this._dummy.updateMatrix();
      this.flakeInst.setMatrixAt(fIdx++, this._dummy.matrix);
    }
    this.flakeInst.count = fIdx;
    this.flakeInst.instanceMatrix.needsUpdate = true;

    // 6. Уровень воды и пузырьки в пробирке-газометре
    if (this.gasRigGroup.visible) {
      const totalColl = Math.min(25, Object.values(s.collectedGas || {}).reduce((p, c) => p + c, 0));
      const waterFrac = Math.max(0.06, 1 - totalColl / 25);
      const hCol = 1.25 * waterFrac;
      this.collectorWaterMesh.scale.set(1, hCol, 1);
      this.collectorWaterMesh.position.set(1.55, 0.28 + hCol / 2, 0);

      if ((sim.gasRate || 0) > 0.1 && totalColl < 25) {
        busy = true;
        if (Math.random() < 0.35 && this.troughBubbles.length < 35) {
          this.troughBubbles.push({
            x: 1.55 + (Math.random() - 0.5) * 0.08,
            y: 0.25,
            z: (Math.random() - 0.5) * 0.08,
            r: 0.014 + Math.random() * 0.012,
            vy: 0.55 + Math.random() * 0.25,
            maxY: 0.28 + hCol
          });
        }
      }
      for (let i = this.troughBubbles.length - 1; i >= 0; i--) {
        const tb = this.troughBubbles[i];
        tb.y += tb.vy * dt;
        if (tb.y >= tb.maxY) this.troughBubbles.splice(i, 1);
      }
      let tbIdx = 0;
      for (const tb of this.troughBubbles) {
        this._dummy.position.set(tb.x, tb.y, tb.z);
        this._dummy.scale.setScalar(tb.r);
        this._dummy.updateMatrix();
        this.troughBubbleInst.setMatrixAt(tbIdx++, this._dummy.matrix);
      }
      this.troughBubbleInst.count = tbIdx;
      this.troughBubbleInst.instanceMatrix.needsUpdate = true;
    } else {
      this.troughBubbleInst.count = 0;
    }

    // 7. Пар и бурый газ над горлышком
    const mouthY = vesselY + this._mouthHeight(kind);
    const emitPlume = (a.wet && s.temp > 72 && !s.tubeOn) || (s.headspace?.gas === 'NO2' && !s.tubeOn);
    if (emitPlume && Math.random() < 0.25) {
      const free = this.steamClouds.find((c) => c.life <= 0);
      if (free) {
        free.life = 1.0;
        free.x = this.vesselX + (Math.random() - 0.5) * 0.08;
        free.y = mouthY + 0.03;
        free.z = (Math.random() - 0.5) * 0.08;
        free.vx = (Math.random() - 0.5) * 0.08;
        free.size = 0.16 + Math.random() * 0.08;
        free.color = s.headspace?.gas === 'NO2' ? '#b45309' : '#f1f5f9';
      }
    }
    for (const c of this.steamClouds) {
      if (c.life <= 0) {
        c.sprite.visible = false;
        continue;
      }
      busy = true;
      c.life -= dt * 0.52;
      c.y += dt * 0.42;
      c.x += c.vx * dt;
      const prog = 1 - Math.max(0, c.life);
      const sc = c.size * (1 + prog * 2.2);
      c.sprite.visible = true;
      c.sprite.position.set(c.x, c.y, c.z);
      c.sprite.scale.set(sc, sc, 1);
      c.sprite.material.color.set(c.color);
      c.sprite.material.opacity = Math.sin(Math.min(1, c.life) * Math.PI) * 0.34;
    }

    // 8. Анимация наливания реактива из склянки
    if (this.pourAnim.active) {
      busy = true;
      this.pourAnim.t += dt;
      const p = this.pourAnim.t / this.pourAnim.dur;
      if (p >= 1) {
        this.pourAnim.active = false;
        this.pourBottleGroup.visible = false;
        this.streamMesh.visible = false;
      } else {
        this.pourBottleGroup.visible = true;
        this.pourBottleGroup.position.set(this.vesselX + 0.32, mouthY + 0.28, 0);
        const tilt = Math.sin(Math.min(1, p * 1.25) * Math.PI) * 1.95;
        this.pourBottleGroup.rotation.z = tilt;

        if (!this.pourAnim.solid && p > 0.18 && p < 0.84) {
          const topY = mouthY + 0.12;
          const botY = a.wet ? liqWorldY : vesselY + 0.04;
          const h = Math.max(0.1, topY - botY);
          this.streamMesh.visible = true;
          this.streamMat.color.set(this.pourAnim.color);
          this.streamMesh.scale.set(1, h, 1);
          this.streamMesh.position.set(this.vesselX + 0.02, botY + h / 2, 0);
        } else {
          this.streamMesh.visible = false;
        }
      }
    }

    // 9. Анимация лучины / нихромовой петли / щипцов
    if (this.toolAnim.kind) {
      busy = true;
      this.toolAnim.t += dt;
      const p = this.toolAnim.t / this.toolAnim.dur;
      if (p >= 1) {
        this.toolAnim.kind = '';
        this.propGroup.visible = false;
      } else {
        this.propGroup.visible = true;
        const swing = Math.sin(p * Math.PI);
        if (this.toolAnim.kind === 'splint') {
          const tx = s.tubeOn ? 1.55 : this.vesselX;
          const ty = s.tubeOn ? 1.52 : mouthY + 0.06;
          this.propGroup.position.set(tx + (1 - swing) * 0.45, ty + (1 - swing) * 0.25, 0.08);
          this.propTipFlame.visible = !(this.toolAnim.extra.extinguish && p > 0.45);
          this.propTipFlame.material.color.set(this.toolAnim.extra.flare ? '#ffffff' : '#ffae34');
          const sc = this.toolAnim.extra.flare && p > 0.35 ? 2.1 : 1.0;
          this.propTipFlame.scale.set(0.8 * sc, 1.7 * sc, 0.8 * sc);
        } else if (this.toolAnim.kind === 'loop' || this.toolAnim.kind === 'tongs') {
          this.propGroup.position.set(this.vesselX + (1 - swing) * 0.5, 0.92, 0.08);
          this.propTipFlame.visible = true;
          this.propTipFlame.material.color.set(this.toolAnim.extra.color || '#ffffff');
          const sc = this.toolAnim.kind === 'tongs' ? 2.2 : 1.3;
          this.propTipFlame.scale.set(sc, sc * 1.4, sc);
        }
      }
    }

    return busy;
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.renderer) this.renderer.dispose();
  }
}
