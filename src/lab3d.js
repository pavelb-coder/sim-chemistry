import * as THREE from '../vendor/three.module.min.js';
import { REAGENTS } from './reagents.js';
import { VESSELS } from './chemistry.js';

const CAMERA_PRESETS = {
  all:    { pos: [0.35, 2.48, 7.15], target: [0.32, 1.42, 0], fov: 35 },
  vessel: { pos: [-0.35, 2.08, 4.15], target: [-0.35, 1.62, 0], fov: 30 },
  equip:  { pos: [-0.82, 2.22, 4.85], target: [-0.68, 1.50, 0], fov: 32 },
  gas:    { pos: [1.15, 2.0, 4.65], target: [1.05, 1.45, 0], fov: 32 },
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

    // Физика живой жидкости, горения и частиц
    this.slosh = { angle: 0, vel: 0 };
    this.bubbles = [];
    this.flakes = [];
    this.steamClouds = [];
    this.sparks = [];
    this.troughBubbles = [];
    this.ripples = [];
    this.emberHeat = 0;
    this.gauzeHeat = 0;
    this.prevHeatLvl = 0;
    this.pourAnim = { active: false, t: 0, dur: 1.0, color: '#cfe8f7', solid: false, formula: '' };
    this.dripAnim = { active: false, t: 0, dur: 0.55, color: '#dff2fc' };
    this.filterAnim = { active: false, t: 0, dur: 2.1, cakeColor: '#f8fafc' };
    this.titrantColor = '#dff2fc';
    this.lastMassKey = '';
    this.lastPsuKey = '';
    this.iceCubes = [];
    this.toolAnim = { kind: '', t: 0, dur: 0, extra: {}, burstDone: false };
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
    this._buildLabEquipment();
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

    // Асбестовая / керамическая рассекательная сетка + пятно накала от пламени
    const gauze = new THREE.Mesh(
      new THREE.CylinderGeometry(0.53, 0.53, 0.012, 32),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, metalness: 0.25, transparent: true, opacity: 0.84 })
    );
    gauze.position.y = this.vesselBaseY - 0.01;
    gauze.receiveShadow = true;
    this.tripodGroup.add(gauze);

    this.gauzeGlowMat = new THREE.MeshBasicMaterial({
      map: this._createHotSpotTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const gauzeGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), this.gauzeGlowMat);
    gauzeGlow.rotation.x = -Math.PI / 2;
    gauzeGlow.position.y = this.vesselBaseY - 0.002;
    this.tripodGroup.add(gauzeGlow);

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
      new THREE.CylinderGeometry(0.026, 0.032, 0.11, 14),
      new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.95 })
    );
    wick.position.y = 0.65;
    this.burnerGroup.add(wick);

    // Обугленный кончик фитиля с тлеющим жаром после гашения
    this.wickEmberMat = new THREE.MeshStandardMaterial({
      color: '#1c1917',
      emissive: '#ff4500',
      emissiveIntensity: 0,
      roughness: 0.9
    });
    const wickChar = new THREE.Mesh(
      new THREE.SphereGeometry(0.030, 14, 12),
      this.wickEmberMat
    );
    wickChar.scale.set(0.92, 1.35, 0.92);
    wickChar.position.y = 0.71;
    this.burnerGroup.add(wickChar);

    // Стеклянный колпачок спиртовки (стоит рядом на столе во время горения)
    this.snufferCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.128, 0.24, 22),
      this._createGlassMaterial(0.24)
    );
    this.snufferCap.position.set(0.54, 0.12, 0.16);
    this.burnerGroup.add(this.snufferCap);

    // Невидимый хитбокс спиртовки для удобного клика мышью/пальцем
    const burnerHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.85, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    burnerHit.position.y = 0.42;
    burnerHit.userData = { action: 'burner', tip: 'Спиртовка: нажмите, чтобы переключить силу пламени' };
    this.burnerGroup.add(burnerHit);
    this.interactables.push(burnerHit);

    // Органическое живое 3D-пламя (каплевидная геометрия + турбулентный GLSL-шейдер)
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, 0.695, 0);
    this.flameGroup.visible = false;

    const outerGeo = this._createTeardropFlameGeo(0.148, 0.56, 28);
    this.flameShaderMat = this._createOrganicFlameMaterial(0.56);
    this.flameOuter = new THREE.Mesh(outerGeo, this.flameShaderMat);
    this.flameOuter.renderOrder = 7;

    // Второй внутренний светящийся язычок в противофазе для живой многослойности огня
    const midGeo = this._createTeardropFlameGeo(0.098, 0.41, 24);
    this.flameMidMat = this._createOrganicFlameMaterial(0.41);
    this.flameMid = new THREE.Mesh(midGeo, this.flameMidMat);
    this.flameMid.position.y = 0.025;
    this.flameMid.renderOrder = 6;

    // Внутренний голубоватый конус паров спирта у фитиля
    const coreGeo = this._createTeardropFlameGeo(0.058, 0.17, 18);
    this.flameInnerMat = new THREE.MeshBasicMaterial({
      color: '#2563eb',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false
    });
    this.flameCore = new THREE.Mesh(coreGeo, this.flameInnerMat);
    this.flameCore.position.y = 0.008;
    this.flameCore.renderOrder = 5;

    // Мягкий тепловой ореол вокруг языка пламени
    this.flameHaloMat = new THREE.SpriteMaterial({
      map: this._createHotSpotTexture(),
      color: '#ff8c24',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      toneMapped: false
    });
    this.flameHalo = new THREE.Sprite(this.flameHaloMat);
    this.flameHalo.position.set(0, 0.23, 0);
    this.flameHalo.scale.set(0.68, 0.78, 1);

    this.flameGroup.add(this.flameHalo, this.flameCore, this.flameMid, this.flameOuter);
    this.burnerGroup.add(this.flameGroup);
    this.scene.add(this.burnerGroup);
  }

  _createHotSpotTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 3, 64, 64, 62);
    gr.addColorStop(0.0, 'rgba(255, 245, 200, 0.95)');
    gr.addColorStop(0.28, 'rgba(255, 132, 24, 0.72)');
    gr.addColorStop(0.62, 'rgba(220, 38, 38, 0.28)');
    gr.addColorStop(1.0, 'rgba(220, 38, 38, 0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createTeardropFlameGeo(maxR = 0.14, height = 0.56, steps = 26) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Естественный каплевидный профиль: узкое основание у фитиля -> пузатая середина -> тонкий язычок
      let r;
      if (t < 0.26) {
        const k = t / 0.26;
        r = maxR * (0.24 + 0.76 * Math.sin(k * Math.PI * 0.5));
      } else {
        const k = (t - 0.26) / 0.74;
        r = maxR * Math.pow(1 - k, 1.32) * (1 + 0.12 * Math.sin(k * Math.PI));
      }
      pts.push(new THREE.Vector2(Math.max(0.0015, r), t * height));
    }
    return new THREE.LatheGeometry(pts, 28);
  }

  _createOrganicFlameMaterial(flameHeight = 0.56) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uFlameH: { value: flameHeight },
        uPower: { value: 1.0 },
        uFlicker: { value: 1.0 },
        uCapWorldY: { value: 10.0 },
        uTint: { value: new THREE.Color('#ff7b00') },
        uTintMix: { value: 0.0 },
        uOpacity: { value: 0.96 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uFlameH;
        uniform float uPower;
        uniform float uFlicker;
        uniform float uCapWorldY;

        varying float vH;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vSpread;

        void main() {
          vH = clamp(position.y / uFlameH, 0.0, 1.0);
          vec3 pos = position;

          // Основание пламени закреплено на фитиле, верхний язычок колеблется конвекцией
          float pin = smoothstep(0.0, 0.22, vH);
          float w1 = sin(vH * 8.2 - uTime * 13.5);
          float w2 = sin(vH * 15.5 - uTime * 21.0 + pos.z * 10.0);
          float wz = cos(vH * 9.5 - uTime * 11.8 + pos.x * 8.0);
          float waist = 1.0 + 0.075 * sin(vH * 10.5 - uTime * 17.0) * pin;

          pos.x = pos.x * waist + (w1 * 0.025 + w2 * 0.011) * pin * uPower;
          pos.z = pos.z * waist + (wz * 0.019) * pin * uPower;
          pos.y *= uFlicker;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);

          // Естественное обтекание дна колбы / пробирки / рассекательной сетки
          vSpread = 0.0;
          if (worldPos.y > uCapWorldY) {
            float over = worldPos.y - uCapWorldY;
            vSpread = clamp(over * 3.0, 0.0, 1.0);
            worldPos.y = uCapWorldY - 0.004 * vSpread;
            vec3 originWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec2 rad = worldPos.xz - originWorld.xz;
            float rLen = length(rad);
            vec2 dir = rLen > 0.0001 ? rad / rLen : vec2(1.0, 0.0);
            worldPos.xz += dir * over * 0.68;
          }

          vec4 mvPos = viewMatrix * worldPos;
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uTint;
        uniform float uTintMix;
        uniform float uOpacity;

        varying float vH;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying float vSpread;

        void main() {
          float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
          float rim = smoothstep(0.02, 0.46, ndv);

          float turb = 0.06 * sin(vH * 17.0 - uTime * 18.5 + vNormalView.x * 3.5);
          float h = clamp(vH + turb, 0.0, 1.0);

          // Зоны пламени спиртовки: голубая зона у фитиля -> соломенно-золотое ядро -> насыщенный огненно-янтарный язычок
          vec3 cBlue   = vec3(0.15, 0.46, 0.98);
          vec3 cHot    = vec3(1.00, 0.92, 0.45);
          vec3 cGold   = vec3(1.00, 0.62, 0.04);
          vec3 cOrange = vec3(0.98, 0.34, 0.02);
          vec3 cTip    = vec3(0.90, 0.16, 0.02);

          vec3 col = mix(cBlue, cHot, smoothstep(0.03, 0.22, h));
          col = mix(col, cGold, smoothstep(0.22, 0.52, h));
          col = mix(col, cOrange, smoothstep(0.52, 0.82, h));
          col = mix(col, cTip, smoothstep(0.82, 0.99, h));

          // Раскалённое светлое ядро в средней трети
          float coreGlow = pow(ndv, 2.0) * smoothstep(0.08, 0.30, h) * (1.0 - smoothstep(0.58, 0.94, h));
          col = mix(col, vec3(1.0, 0.98, 0.78), coreGlow * 0.62);

          // Окрашивание пламени катионами металлов с сохранением голубой зоны у фитиля
          if (uTintMix > 0.01) {
            float ionMask = smoothstep(0.09, 0.26, h);
            vec3 ionCol = mix(uTint, vec3(1.0, 0.98, 0.90), coreGlow * 0.48);
            col = mix(col, ionCol, ionMask * uTintMix);
          }

          float baseFade = smoothstep(0.0, 0.07, vH);
          float tipFade  = 1.0 - smoothstep(0.82, 1.0, vH);
          float spreadFade = 1.0 - vSpread * 0.25;
          float alpha = rim * baseFade * tipFade * spreadFade * uOpacity;

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.97));
        }
      `
    });
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
    if (kind === 'round') {
      const pts = [];
      const R = 0.46 + offset;
      // Сферическое тело круглодонной колбы до горлышка
      for (let i = 0; i <= 12; i++) {
        const phi = (i / 12) * Math.PI * 0.78; // от нижнего полюса до плечиков
        const rr = Math.max(0.001, Math.sin(phi) * R);
        const yy = (1 - Math.cos(phi)) * R;
        pts.push([rr, yy]);
      }
      pts.push([0.185 + offset, 0.92], [0.18 + offset, 1.34], [0.22 + offset, 1.39]);
      return pts;
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
    if (kind === 'evap') {
      // Фарфоровая выпарительная чашка (широкая открытая полусферическая чаша)
      return [
        [0.001, 0.0 + offset],
        [0.19 + offset, 0.01 + offset],
        [0.34 + offset, 0.09],
        [0.46 + offset, 0.23],
        [0.54 + offset, 0.40],
        [0.58 + offset, 0.52],
        [0.62 + offset, 0.56]
      ];
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
    if (kind === 'round') {
      if (yLocal < 0.82) {
        const R = 0.445;
        const dy = yLocal - R;
        return Math.max(0.17, Math.sqrt(Math.max(0.02, R * R - dy * dy)));
      }
      return 0.174;
    }
    if (kind === 'evap') {
      const t = Math.max(0, Math.min(1, yLocal / 0.52));
      return 0.18 + t * 0.37;
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
    if (kind === 'round') return 0.86;
    if (kind === 'evap') return 0.43;
    if (kind === 'beaker') return 0.98;
    return 0.82; // flask 100 ml
  }

  _mouthHeight(kind) {
    if (kind === 'tube') return 1.38;
    if (kind === 'round') return 1.39;
    if (kind === 'evap') return 0.56;
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

    const marksMap = {
      tube: [5, 10, 15, 20, 25],
      evap: [20, 40, 60, 80],
      flask: [20, 40, 60, 80, 100],
      round: [30, 60, 90, 120, 150],
      beaker: [50, 100, 150, 200]
    };
    const marks = marksMap[kind] || marksMap.flask;
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
    wb.position.set(-2.12, 0, 0.26);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.84, 26),
      new THREE.MeshPhysicalMaterial({ color: '#f8fafc', transparent: true, opacity: 0.72, roughness: 0.35 })
    );
    body.position.y = 0.42;
    body.castShadow = true;
    wb.add(body);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.56, 22),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.55 })
    );
    water.position.y = 0.29;
    wb.add(water);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.12, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 })
    );
    cap.position.y = 0.90;
    wb.add(cap);

    const nozzleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.95, 0),
      new THREE.Vector3(0.05, 1.16, 0),
      new THREE.Vector3(0.26, 1.10, 0)
    ]);
    const nozzle = new THREE.Mesh(
      new THREE.TubeGeometry(nozzleCurve, 16, 0.017, 8, false),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 })
    );
    wb.add(nozzle);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.2, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.6;
    hit.userData = { action: 'water', tip: 'Промывалка H₂O: нажмите, чтобы долить 5 мл дистиллированной воды' };
    wb.add(hit);
    this.interactables.push(hit);

    this.scene.add(wb);
  }

  _drawLcdCanvas(ctx, bg, fg, topText, mainText, subText = '') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 120);

    ctx.fillStyle = fg;
    ctx.font = '700 20px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(topText, 16, 32);

    ctx.font = '800 44px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(mainText, 240, 84);

    if (subText) {
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(subText, 16, 112);
    }
  }

  _buildLabEquipment() {
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.75, roughness: 0.38 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.22 });

    // 1. Магнитный фторопластовый якорь-мешалка на дне сосуда
    this.stirBarMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.017, 0.085, 8, 14),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.05 })
    );
    this.stirBarMesh.rotation.z = Math.PI / 2;
    this.stirBarMesh.position.set(0, 0.028, 0);
    this.stirBarMesh.visible = false;
    this.vesselRoot.add(this.stirBarMesh);

    // 2. Ледяная баня (кристаллизатор со льдом вокруг сосуда)
    this.iceBathGroup = new THREE.Group();
    this.iceBathGroup.visible = false;
    const basinGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.60, 0.44, 36, 1, true),
      this._createGlassMaterial(0.24)
    );
    basinGlass.position.y = 0.20;
    const basinBottom = new THREE.Mesh(
      new THREE.CircleGeometry(0.60, 32),
      this._createGlassMaterial(0.22)
    );
    basinBottom.rotation.x = -Math.PI / 2;
    basinBottom.position.y = 0.005;
    const iceWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.58, 0.34, 32),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transparent: true, opacity: 0.46, roughness: 0.08 })
    );
    iceWater.position.y = 0.17;
    this.iceBathGroup.add(basinGlass, basinBottom, iceWater);

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.76,
      roughness: 0.12,
      ior: 1.31
    });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const rr = 0.50 + (i % 2) * 0.05;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.095), iceMat);
      cube.position.set(Math.cos(ang) * rr, 0.28 + (i % 3) * 0.015, Math.sin(ang) * rr);
      cube.rotation.set(i * 0.4, ang, i * 0.25);
      this.iceBathGroup.add(cube);
      this.iceCubes.push({ mesh: cube, baseY: cube.position.y, ph: i * 0.9 });
    }
    this.scene.add(this.iceBathGroup);

    // 3. Титровальная бюретка 25 мл на высоком штативе над сосудом
    this.buretteGroup = new THREE.Group();
    this.buretteGroup.visible = false;

    const bStandBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.36), darkMetal);
    bStandBase.position.set(-1.02, 0.022, -0.16);
    const bStandRod = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 3.65, 14), chrome);
    bStandRod.position.set(-1.02, 1.84, -0.16);
    this.buretteGroup.add(bStandBase, bStandRod);

    // Подвижная каретка бюретки (центрируется над горлышком активного сосуда)
    this.buretteColumn = new THREE.Group();
    const bClampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.72, 10), darkMetal);
    bClampArm.rotation.z = Math.PI / 2;
    bClampArm.position.set(-0.34, 0.52, -0.08);

    const bGlassTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 1.05, 22, 1, true),
      this._createGlassMaterial(0.24)
    );
    bGlassTube.position.y = 0.62;

    const bTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.009, 0.16, 16),
      this._createGlassMaterial(0.28)
    );
    bTip.position.y = 0.02;

    this.buretteLiqMat = new THREE.MeshPhysicalMaterial({
      color: '#dff2fc',
      transparent: true,
      opacity: 0.68,
      roughness: 0.08
    });
    this.buretteLiqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.96, 18), this.buretteLiqMat);
    this.buretteLiqMesh.position.y = 0.60;

    // Поворотный ПТФЭ-кран бюретки
    this.buretteValve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35 })
    );
    this.buretteValve.rotation.x = Math.PI / 2;
    this.buretteValve.position.set(0, 0.09, 0.02);

    const bHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 1.25, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bHit.position.y = 0.55;
    bHit.userData = { action: 'buretteDrop', tip: 'Бюретка 25 мл: нажмите на кран, чтобы прикапать +1,0 мл титранта' };
    this.interactables.push(bHit);

    this.buretteColumn.add(bClampArm, bGlassTube, bTip, this.buretteLiqMesh, this.buretteValve, bHit);
    this.buretteGroup.add(this.buretteColumn);

    this.buretteDropMat = new THREE.MeshPhysicalMaterial({ color: '#dff2fc', transparent: true, opacity: 0.85, roughness: 0.05 });
    this.buretteDropMesh = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), this.buretteDropMat);
    this.buretteDropMesh.visible = false;
    this.scene.add(this.buretteDropMesh);
    this.scene.add(this.buretteGroup);

    // 4. Электролизная установка: источник постоянного тока 12 В + графитовые электроды в сосуде
    this.electrolysisGroup = new THREE.Group();
    this.electrolysisGroup.visible = false;

    const psuX = -1.36;
    const psuZ = -0.14;
    const psuBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.38, 0.42),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45, metalness: 0.35 })
    );
    psuBox.position.set(psuX, 0.19, psuZ);
    psuBox.castShadow = true;

    this.psuCanvas = document.createElement('canvas');
    this.psuCanvas.width = 256;
    this.psuCanvas.height = 128;
    this.psuCtx = this.psuCanvas.getContext('2d');
    this._drawLcdCanvas(this.psuCtx, '#062e22', '#34d399', 'DC 12.0 В', '0.00 А', 'ЭЛЕКТРОЛИЗ');
    this.psuTex = new THREE.CanvasTexture(this.psuCanvas);
    this.psuTex.colorSpace = THREE.SRGBColorSpace;

    const psuScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.21),
      new THREE.MeshBasicMaterial({ map: this.psuTex })
    );
    psuScreen.position.set(psuX, 0.23, psuZ + 0.212);

    const termBlack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 })
    );
    termBlack.rotation.x = Math.PI / 2;
    termBlack.position.set(psuX - 0.13, 0.08, psuZ + 0.22);

    const termRed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 })
    );
    termRed.rotation.x = Math.PI / 2;
    termRed.position.set(psuX + 0.13, 0.08, psuZ + 0.22);

    const psuHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.45, 0.48),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    psuHit.position.set(psuX, 0.22, psuZ);
    psuHit.userData = { action: 'electrolysis', tip: 'Источник постоянного тока 12 В (нажмите для вкл/выкл электролиза)' };
    this.interactables.push(psuHit);

    // Держатель и два погружных графитовых электрода (катод − слева, анод + справа)
    this.electrodeRig = new THREE.Group();
    const elBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.045, 0.09),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6 })
    );
    this.cathodeMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.55, metalness: 0.35 });
    this.anodeMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.65, metalness: 0.25 });

    this.cathodeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.85, 16), this.cathodeMat);
    this.cathodeMesh.position.set(-0.075, -0.42, 0);
    this.anodeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.85, 16), this.anodeMat);
    this.anodeMesh.position.set(0.075, -0.42, 0);

    const pinBlack = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#0f172a' }));
    pinBlack.position.set(-0.075, 0.04, 0);
    const pinRed = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 12), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
    pinRed.position.set(0.075, 0.04, 0);

    this.electrodeRig.add(elBridge, this.cathodeMesh, this.anodeMesh, pinBlack, pinRed);

    this.wireCathodeMesh = null;
    this.wireAnodeMesh = null;
    this.electrolysisGroup.add(psuBox, psuScreen, termBlack, termRed, psuHit, this.electrodeRig);
    this.scene.add(this.electrolysisGroup);
    this._rebuildElectrodeWires('flask');

    // 5. Стойка с фильтровальной воронкой на столе + активная воронка над сосудом при фильтровании
    this.funnelStandGroup = new THREE.Group();
    this.funnelStandGroup.position.set(0.66, 0, -0.36);

    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 24), darkMetal);
    fBase.position.y = 0.02;
    const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.86, 12), chrome);
    fPost.position.set(-0.12, 0.44, 0);
    const fRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.014, 10, 28), darkMetal);
    fRing.rotation.x = Math.PI / 2;
    fRing.position.set(0, 0.72, 0);

    const funnelConePts = [
      new THREE.Vector2(0.022, 0.0),
      new THREE.Vector2(0.025, 0.22),
      new THREE.Vector2(0.19, 0.50)
    ];
    const restFunnelGlass = new THREE.Mesh(
      new THREE.LatheGeometry(funnelConePts, 32),
      this._createGlassMaterial(0.24)
    );
    restFunnelGlass.position.set(0, 0.42, 0);

    this.restFilterPaperMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, side: THREE.DoubleSide });
    const restPaper = new THREE.Mesh(
      new THREE.ConeGeometry(0.165, 0.25, 18, 1, true),
      this.restFilterPaperMat
    );
    restPaper.rotation.x = Math.PI;
    restPaper.position.set(0, 0.78, 0);

    const fHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 1.0, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    fHit.position.y = 0.52;
    fHit.userData = { action: 'filter', tip: 'Воронка с бумажным фильтром: нажмите, чтобы отфильтровать осадок' };
    this.interactables.push(fHit);

    this.funnelStandGroup.add(fBase, fPost, fRing, restFunnelGlass, restPaper, fHit);
    this.scene.add(this.funnelStandGroup);

    // Активная воронка над горлышком сосуда во время фильтрования
    this.filterActiveGroup = new THREE.Group();
    this.filterActiveGroup.visible = false;
    const actFunnelGlass = new THREE.Mesh(new THREE.LatheGeometry(funnelConePts, 32), this._createGlassMaterial(0.26));
    this.actFilterPaperMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, side: THREE.DoubleSide });
    const actPaper = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.25, 18, 1, true), this.actFilterPaperMat);
    actPaper.rotation.x = Math.PI;
    actPaper.position.y = 0.36;
    this.filterFiltrateStream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.009, 0.36, 10),
      new THREE.MeshPhysicalMaterial({ color: '#dff2fc', transparent: true, opacity: 0.72, roughness: 0.05 })
    );
    this.filterFiltrateStream.position.y = -0.16;
    this.filterActiveGroup.add(actFunnelGlass, actPaper, this.filterFiltrateStream);
    this.scene.add(this.filterActiveGroup);

    // 6. Лабораторные электронные весы (0,01 г) справа на столе
    this.balanceGroup = new THREE.Group();
    const balX = 2.34;
    const balZ = 0.22;
    const balBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.14, 0.56),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.32, metalness: 0.06 })
    );
    balBody.position.set(balX, 0.07, balZ);
    balBody.castShadow = true;

    const balNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 18), darkMetal);
    balNeck.position.set(balX, 0.155, balZ - 0.03);

    const balPan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.21, 0.022, 32), chrome);
    balPan.position.set(balX, 0.185, balZ - 0.03);
    balPan.castShadow = true;

    this.balCanvas = document.createElement('canvas');
    this.balCanvas.width = 256;
    this.balCanvas.height = 128;
    this.balCtx = this.balCanvas.getContext('2d');
    this._drawLcdCanvas(this.balCtx, '#0f172a', '#38bdf8', 'МАССА НЕТТО', '0,00 г', 'TARE OK');
    this.balTex = new THREE.CanvasTexture(this.balCanvas);
    this.balTex.colorSpace = THREE.SRGBColorSpace;

    const balScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.11),
      new THREE.MeshBasicMaterial({ map: this.balTex })
    );
    balScreen.rotation.x = -Math.PI / 5;
    balScreen.position.set(balX, 0.115, balZ + 0.265);

    const balHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.32, 0.62),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    balHit.position.set(balX, 0.16, balZ);
    balHit.userData = { action: 'weigh', tip: 'Электронные весы (0,01 г): нажмите, чтобы записать массу смеси в журнал' };
    this.interactables.push(balHit);

    this.balanceGroup.add(balBody, balNeck, balPan, balScreen, balHit);
    this.scene.add(this.balanceGroup);
  }

  _rebuildElectrodeWires(kind) {
    if (this.wireCathodeMesh) {
      this.electrolysisGroup.remove(this.wireCathodeMesh);
      this.wireCathodeMesh.geometry.dispose();
    }
    if (this.wireAnodeMesh) {
      this.electrolysisGroup.remove(this.wireAnodeMesh);
      this.wireAnodeMesh.geometry.dispose();
    }
    const vY = kind === 'tube' ? 0.92 : this.vesselBaseY;
    const topY = vY + this._mouthHeight(kind) + 0.05;
    const elH = kind === 'evap' ? 0.48 : 0.88;
    this.cathodeMesh.scale.y = elH / 0.85;
    this.cathodeMesh.position.y = -elH / 2;
    this.anodeMesh.scale.y = elH / 0.85;
    this.anodeMesh.position.y = -elH / 2;
    this.electrodeRig.position.set(this.vesselX, topY, 0);

    const cCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.49, 0.08, 0.08),
      new THREE.Vector3(-1.25, topY + 0.22, 0.06),
      new THREE.Vector3(this.vesselX - 0.075, topY + 0.06, 0)
    ]);
    const aCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.23, 0.08, 0.08),
      new THREE.Vector3(-0.92, topY + 0.28, -0.04),
      new THREE.Vector3(this.vesselX + 0.075, topY + 0.06, 0)
    ]);
    this.wireCathodeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cCurve, 28, 0.011, 8, false),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 })
    );
    this.wireAnodeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(aCurve, 28, 0.011, 8, false),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 })
    );
    this.electrolysisGroup.add(this.wireCathodeMesh, this.wireAnodeMesh);
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

    // 2. Три детализированных инструмента для горения: лучина, нихромовая петля и тигельные щипцы
    this.propGroup = new THREE.Group();
    this.propGroup.visible = false;
    this.scene.add(this.propGroup);

    // 2а. Деревянная лучина с обугленным тлеющим кончиком и вертикальным язычком пламени
    this.splintGroup = new THREE.Group();
    const woodStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.016, 0.92, 10),
      new THREE.MeshStandardMaterial({ color: '#deb887', roughness: 0.78 })
    );
    woodStick.rotation.z = -Math.PI / 3.1;
    woodStick.position.set(0.39, 0.24, 0);

    const splintChar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.0135, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.92 })
    );
    splintChar.rotation.z = -Math.PI / 3.1;
    splintChar.position.set(0.04, 0.025, 0);

    this.splintEmberMat = new THREE.MeshStandardMaterial({
      color: '#292524',
      emissive: '#ff3b00',
      emissiveIntensity: 1.4,
      roughness: 0.85
    });
    const splintEmber = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), this.splintEmberMat);
    splintEmber.position.set(0, 0, 0);

    this.splintFlameMat = this._createOrganicFlameMaterial(0.22);
    this.splintFlameMesh = new THREE.Mesh(this._createTeardropFlameGeo(0.048, 0.22, 20), this.splintFlameMat);
    this.splintFlameMesh.position.set(0, -0.01, 0);
    this.splintFlameMesh.renderOrder = 7;

    this.splintGroup.add(woodStick, splintChar, splintEmber, this.splintFlameMesh);
    this.propGroup.add(this.splintGroup);

    // 2б. Нихромовая петля в стеклянном держателе
    this.loopGroup = new THREE.Group();
    const glassRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.020, 0.68, 12),
      this._createGlassMaterial(0.32)
    );
    glassRod.rotation.z = -Math.PI / 2.35;
    glassRod.position.set(0.48, 0.12, 0);

    this.loopWireMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.85,
      roughness: 0.3,
      emissive: '#ff4d00',
      emissiveIntensity: 0
    });
    const wireShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 8), this.loopWireMat);
    wireShaft.rotation.z = -Math.PI / 2.35;
    wireShaft.position.set(0.09, 0.022, 0);

    const wireRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0055, 8, 20), this.loopWireMat);
    wireRing.position.set(0, 0, 0);

    this.loopGroup.add(glassRod, wireShaft, wireRing);
    this.propGroup.add(this.loopGroup);

    // 2в. Стальные тигельные щипцы с раскаляемым образцом металла и ореолом горения
    this.tongsGroup = new THREE.Group();
    const tongSteel = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.82, roughness: 0.32 });
    const jawA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.78, 10), tongSteel);
    jawA.rotation.z = -Math.PI / 2.3 + 0.06;
    jawA.position.set(0.42, 0.11, 0.012);
    const jawB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.78, 10), tongSteel);
    jawB.rotation.z = -Math.PI / 2.3 - 0.06;
    jawB.position.set(0.42, 0.08, -0.012);

    this.tongsSampleMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.78,
      roughness: 0.32,
      emissive: '#ffffff',
      emissiveIntensity: 0
    });
    this.tongsSampleMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 10, 22, Math.PI * 1.65),
      this.tongsSampleMat
    );
    this.tongsSampleMesh.position.set(0, 0, 0);

    this.tongsFlameMat = this._createOrganicFlameMaterial(0.28);
    this.tongsFlameMesh = new THREE.Mesh(this._createTeardropFlameGeo(0.075, 0.28, 20), this.tongsFlameMat);
    this.tongsFlameMesh.position.set(0, -0.02, 0);
    this.tongsFlameMesh.renderOrder = 7;

    this.tongsGlareMat = new THREE.SpriteMaterial({
      map: this._createHotSpotTexture(),
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.tongsGlareSprite = new THREE.Sprite(this.tongsGlareMat);
    this.tongsGlareSprite.scale.set(0.75, 0.75, 1);

    this.tongsGroup.add(jawA, jawB, this.tongsSampleMesh, this.tongsFlameMesh, this.tongsGlareSprite);
    this.propGroup.add(this.tongsGroup);

    // 2г. Расширяющаяся голубая волна хлопка водорода H₂
    this.h2PopMat = new THREE.MeshBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.h2PopMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), this.h2PopMat);
    this.h2PopMesh.visible = false;
    this.scene.add(this.h2PopMesh);
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

    // 4. Клубы пара / бурого газа NO₂ / дыма горения
    const steamTex = this._createSoftCircleTexture();
    for (let i = 0; i < 26; i++) {
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
      this.steamClouds.push({ sprite: sp, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0.42, size: 0.2, color: '#f1f5f9' });
    }

    // 5. Искры и раскалённые микрочастицы горения (Mg, O₂, Fe + Cl₂, калий на воде)
    const sparkTex = this._createHotSpotTexture();
    for (let i = 0; i < 34; i++) {
      const mat = new THREE.SpriteMaterial({
        map: sparkTex,
        color: '#fde047',
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      sp.renderOrder = 8;
      this.scene.add(sp);
      this.sparks.push({ sprite: sp, life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.05, color: '#fde047' });
    }

    // 6. Фиолетовый язычок пламени для калия, бегающего по воде
    this.alkaliFlameMat = this._createOrganicFlameMaterial(0.18);
    this.alkaliFlameMesh = new THREE.Mesh(this._createTeardropFlameGeo(0.045, 0.18, 16), this.alkaliFlameMat);
    this.alkaliFlameMesh.visible = false;
    this.alkaliFlameMesh.renderOrder = 7;
    this.vesselRoot.add(this.alkaliFlameMesh);

    this._dummy = new THREE.Object3D();
  }

  _spawnSmokePuff(x, y, z, color = '#e2e8f0', size = 0.14, vy = 0.36) {
    const free = this.steamClouds.find((c) => c.life <= 0);
    if (!free) return;
    free.life = 1.0;
    free.x = x + (Math.random() - 0.5) * 0.04;
    free.y = y;
    free.z = z + (Math.random() - 0.5) * 0.04;
    free.vx = (Math.random() - 0.5) * 0.09;
    free.vy = vy;
    free.size = size;
    free.color = color;
  }

  _spawnSparks(x, y, z, count = 10, color = '#fde047', speed = 1.0) {
    let spawned = 0;
    for (const sp of this.sparks) {
      if (sp.life > 0) continue;
      const ang = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.22) * Math.PI * 0.7;
      const v = (0.35 + Math.random() * 0.95) * speed;
      sp.maxLife = 0.45 + Math.random() * 0.55;
      sp.life = sp.maxLife;
      sp.x = x + (Math.random() - 0.5) * 0.03;
      sp.y = y + (Math.random() - 0.5) * 0.03;
      sp.z = z + (Math.random() - 0.5) * 0.03;
      sp.vx = Math.cos(ang) * Math.cos(elev) * v;
      sp.vy = Math.sin(elev) * v + 0.35 * speed;
      sp.vz = Math.sin(ang) * Math.cos(elev) * v;
      sp.size = 0.038 + Math.random() * 0.042;
      sp.color = color;
      if (++spawned >= count) break;
    }
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
    this.toolAnim = { kind, t: 0, dur: extra.dur || 2.25, extra, burstDone: false };
    if (extra.flashColor) {
      this.flashEffect = { intensity: extra.flashPower || 8, color: extra.flashColor };
    }
    this.wake(3200);
  }

  setTitrantColor(hexColor) {
    this.titrantColor = hexColor && hexColor !== '#F8FAFC' ? hexColor : '#dff2fc';
    if (this.buretteLiqMat) {
      this.buretteLiqMat.color.set(this.titrantColor);
    }
    this.wake(600);
  }

  triggerBuretteDrop(hexColor) {
    const col = hexColor && hexColor !== '#F8FAFC' ? hexColor : (this.titrantColor || '#dff2fc');
    this.dripAnim = { active: true, t: 0, dur: 0.52, color: col };
    this.triggerSplash(0.28);
    this.wake(1800);
  }

  triggerFiltration(cakeColor = '#f8fafc') {
    this.filterAnim = { active: true, t: 0, dur: 2.1, cakeColor: cakeColor || '#f8fafc' };
    this.wake(2800);
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
      this._rebuildElectrodeWires(state.vessel);
    }

    // Обновляем цифровое ЖК-табло электронных весов при изменении массы смеси
    const massStr = `${(analysis.netMassG || 0).toFixed(2).replace('.', ',')} г`;
    if (massStr !== this.lastMassKey && this.balCtx) {
      this.lastMassKey = massStr;
      this._drawLcdCanvas(this.balCtx, '#0f172a', '#38bdf8', 'МАССА НЕТТО', massStr, state.vessel.toUpperCase());
      this.balTex.needsUpdate = true;
    }

    // Обновляем цифровое табло блока питания электролизёра
    const ampStr = `${(analysis.currentAmp || 0).toFixed(2).replace('.', ',')} А`;
    const psuSub = !analysis.wet ? 'ЦЕПЬ РАЗОМКНУТА' : (analysis.isElectrolyte ? 'ЭЛЕКТРОЛИТ' : 'НЕЭЛЕКТРОЛИТ');
    const psuKey = `${ampStr}|${psuSub}`;
    if (psuKey !== this.lastPsuKey && this.psuCtx) {
      this.lastPsuKey = psuKey;
      const fg = analysis.currentAmp > 0 ? '#34d399' : '#f59e0b';
      this._drawLcdCanvas(this.psuCtx, '#062e22', fg, 'DC 12,0 В', ampStr, psuSub);
      this.psuTex.needsUpdate = true;
    }

    // Цвет осадка на покоящемся бумажном фильтре
    if (this.restFilterPaperMat) {
      if (Array.isArray(state.filteredSolids) && state.filteredSolids.length > 0) {
        this.restFilterPaperMat.color.set(state.filteredSolids[0].color || '#f8fafc');
      } else {
        this.restFilterPaperMat.color.set('#ffffff');
      }
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
      state.iceBathOn ||
      state.stirrerOn ||
      state.electrolysisOn ||
      simInfo.gasRate > 0.01 ||
      simInfo.boiling ||
      simInfo.volcanoErupting ||
      simInfo.goldenRainSparkle ||
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
        const ag = Math.round((state.coatings.silverPlated || 0) * 10);
        const ch = Math.round((state.coatings.carbonFoam || 0) * 10);
        const vo = Math.round((state.coatings.volcanoAsh || 0) * 10);
        const km = Math.round((state.prog.dry_kmno4 || 0) * 10);
        const ce = Math.round((state.prog.cuo_eth || 0) * 10);
        const wh = Math.round((state.coatings.anhydrousWhite || 0) * 10);
        return `${id}:${q}:${p}:${cu}:${ag}:${ch}:${vo}:${km}:${ce}:${wh}`;
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
      let isMetallic = (r.category || r.cat) === 'met' && state.coatings.carbonFoam < 0.2;

      if (state.coatings.silverPlated > 0.2 && ['cu', 'fe', 'zn', 'mg', 'al'].includes(id)) {
        col = '#f8fafc';
        isMetallic = true;
      } else if (state.coatings.copperPlated > 0.2 && ['fe', 'zn', 'mg', 'al'].includes(id)) {
        col = '#c8753c';
        isMetallic = true;
      }
      if (id === 'cuo' && (state.prog.cuo_eth || 0) > 0.45) {
        col = '#c8753c';
        isMetallic = true;
      }
      if (id === 'cuso4s' && state.coatings.anhydrousWhite > 0.4) {
        col = '#f1f5f9';
      }
      if (id === 'malach' && (state.prog.dry_malach || 0) > 0.5) {
        col = '#1c1917';
      }
      if (id === 'kmno4s' && (state.prog.dry_kmno4 || 0) > 0.45) {
        col = '#1f2937';
      }
      if (id === 'sucrose' && state.coatings.carbonFoam > 0.25) {
        col = '#18181b';
      }
      if (id === 'nh4cr2o7' && state.coatings.volcanoAsh > 0.15) {
        col = state.coatings.volcanoAsh > 0.45 ? '#166534' : '#65a30d';
      }

      const mat = new THREE.MeshStandardMaterial({
        color: col,
        metalness: isMetallic ? 0.82 : 0.08,
        roughness: isMetallic ? 0.26 : 0.85
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
        } else if (id === 'nh4cr2o7' && state.coatings.volcanoAsh > 0.15) {
          const grow = 1 + state.coatings.volcanoAsh * 2.9;
          mesh.scale.set(grow * 1.5, grow * 2.3, grow * 1.5);
          mesh.position.y = 0.06 + state.coatings.volcanoAsh * 0.14 * (1 - i / (piecesCount + 1));
        } else {
          mesh.scale.setScalar(scaleLeft);
        }

        mesh.userData = { float: !!r.float, waterFlame: r.waterFlame || '', baseAng: ang, rad };
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

    // 2. Посуда, штатив/треножник, ледяная баня, мешалка, бюретка, электролизёр и уровень жидкости
    const kind = s.vessel;
    const vesselY = kind === 'tube' ? 0.92 : this.vesselBaseY;
    this.vesselRoot.position.set(this.vesselX, vesselY, 0);
    for (const k of ['flask', 'round', 'tube', 'beaker', 'evap']) {
      if (this.vesselMeshes[k]) this.vesselMeshes[k].visible = k === kind;
    }
    this.tripodGroup.visible = kind !== 'tube';
    this.retortGroup.visible = kind === 'tube' || kind === 'round';
    this.gasRigGroup.visible = !!s.tubeOn && VESSELS[kind].allowTube;

    const cap = VESSELS[kind].cap;
    const maxH = this._liquidMaxHeight(kind);
    const liqFrac = Math.min(1.04, a.volume / cap);
    const liqLocalY = a.wet ? Math.max(0.045, liqFrac * maxH) : -0.2;
    const liqWorldY = vesselY + liqLocalY;
    const mouthLocalY = this._mouthHeight(kind);
    const mouthWorldY = vesselY + mouthLocalY;

    // 2а. Ледяная баня вокруг сосуда
    this.iceBathGroup.visible = !!s.iceBathOn;
    if (s.iceBathOn) {
      busy = true;
      this.iceBathGroup.position.set(this.vesselX, vesselY - 0.04, 0);
      const tIce = ts / 1000;
      for (const ic of this.iceCubes) {
        ic.mesh.position.y = ic.baseY + Math.sin(tIce * 2.1 + ic.ph) * 0.012;
        ic.mesh.rotation.y += dt * 0.18;
      }
    }

    // 2б. Магнитная мешалка (вращающийся фторопластовый якорь + вихревое покачивание мениска)
    this.stirBarMesh.visible = !!s.stirrerOn;
    if (s.stirrerOn) {
      busy = true;
      this.stirBarMesh.rotation.y += dt * 22.0;
      if (a.wet) {
        this.slosh.angle = 0.065 * Math.sin(ts / 95);
      }
    }

    // 2в. Титровальная бюретка 25 мл над сосудом
    this.buretteGroup.visible = !!s.buretteOn;
    if (s.buretteOn) {
      this.buretteColumn.position.set(this.vesselX, mouthWorldY + 0.18, 0);
      const remFrac = Math.max(0.06, 1 - ((s.buretteUsedMl || 0) % 25) / 25);
      const bH = 0.96 * remFrac;
      this.buretteLiqMesh.scale.set(1, remFrac, 1);
      this.buretteLiqMesh.position.y = 0.12 + bH / 2;
    }

    // 2г. Электролизная установка и покрытие катода металлом (Cu⁰ / Ag⁰)
    this.electrolysisGroup.visible = !!s.electrolysisOn;
    if (s.electrolysisOn) {
      if ((s.coatings.copperPlated || 0) > 0.12) {
        this.cathodeMat.color.set('#c8753c');
        this.cathodeMat.metalness = 0.85;
      } else if ((s.coatings.silverPlated || 0) > 0.12) {
        this.cathodeMat.color.set('#f8fafc');
        this.cathodeMat.metalness = 0.92;
      } else {
        this.cathodeMat.color.set('#27272a');
        this.cathodeMat.metalness = 0.35;
      }

      // Генерация струек мелких пузырьков непосредственно на катоде и аноде
      if (a.wet && a.currentAmp > 0 && this.bubbles.length < 210) {
        busy = true;
        if (sim.cathodeGas && Math.random() < 0.72) {
          this.bubbles.push({
            x: -0.075 + (Math.random() - 0.5) * 0.025,
            y: Math.max(0.05, liqLocalY * (0.25 + Math.random() * 0.55)),
            z: (Math.random() - 0.5) * 0.025,
            r: 0.006 + Math.random() * 0.008,
            vy: 0.36 + Math.random() * 0.25,
            ph: Math.random() * 6.28
          });
        }
        if (sim.anodeGas && Math.random() < 0.65) {
          this.bubbles.push({
            x: 0.075 + (Math.random() - 0.5) * 0.025,
            y: Math.max(0.05, liqLocalY * (0.25 + Math.random() * 0.55)),
            z: (Math.random() - 0.5) * 0.025,
            r: 0.006 + Math.random() * 0.008,
            vy: 0.34 + Math.random() * 0.24,
            ph: Math.random() * 6.28
          });
        }
      }
    }

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

    // Плавающие щелочные металлы бегают по поверхности воды (+ фиолетовое пламя калия)
    const tSec = ts / 1000;
    let alkaliFlamePos = null;
    let alkaliFlameColor = '';
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
        if (child.userData.waterFlame && !alkaliFlamePos) {
          alkaliFlamePos = child.position;
          alkaliFlameColor = child.userData.waterFlame;
        }
      }
    }
    if (alkaliFlamePos && a.wet) {
      this.alkaliFlameMesh.visible = true;
      this.alkaliFlameMesh.position.set(alkaliFlamePos.x, alkaliFlamePos.y + 0.01, alkaliFlamePos.z);
      const uA = this.alkaliFlameMat.uniforms;
      uA.uTime.value = tSec * 1.25;
      uA.uFlicker.value = 0.9 + 0.25 * Math.sin(tSec * 31);
      uA.uTint.value.set(alkaliFlameColor);
      uA.uTintMix.value = 0.88;
      if (Math.random() < 0.22) {
        this._spawnSparks(this.vesselX + alkaliFlamePos.x, vesselY + alkaliFlamePos.y + 0.05, alkaliFlamePos.z, 1, alkaliFlameColor, 0.55);
      }
    } else if (this.alkaliFlameMesh) {
      this.alkaliFlameMesh.visible = false;
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

    // 3. Естественное пламя спиртовки, накал сетки, тление фитиля и окрашивание катионами
    if (this.prevHeatLvl > 0 && s.heatLvl === 0) {
      // При задувании/гашении спиртовки от тлеющего фитиля поднимается лёгкий струящийся дымок
      this._spawnSmokePuff(this.vesselX, 0.74, 0, '#e2e8f0', 0.11, 0.28);
      this._spawnSmokePuff(this.vesselX + 0.02, 0.77, 0.01, '#cbd5e1', 0.13, 0.32);
    }
    this.prevHeatLvl = s.heatLvl;

    const targetEmber = s.heatLvl > 0 ? 1.0 : 0.0;
    this.emberHeat += (targetEmber - this.emberHeat) * Math.min(1, dt * (s.heatLvl > 0 ? 4.5 : 0.65));
    if (this.emberHeat > 0.015) busy = true;
    this.wickEmberMat.emissiveIntensity = this.emberHeat * (1.35 + 0.25 * Math.sin(tSec * 15));

    const targetGauze = kind !== 'tube' && s.heatLvl > 0 ? [0, 0.36, 0.68, 0.96][s.heatLvl] : 0;
    this.gauzeHeat += (targetGauze - this.gauzeHeat) * Math.min(1, dt * (targetGauze > this.gauzeHeat ? 0.85 : 0.55));
    if (this.gauzeHeat > 0.01) busy = true;
    this.gauzeGlowMat.opacity = this.gauzeHeat * (0.72 + 0.08 * Math.sin(tSec * 19));

    if (s.heatLvl > 0) {
      busy = true;
      this.flameGroup.visible = true;
      this.snufferCap.position.set(0.54, 0.12, 0.16);
      this.snufferCap.rotation.set(0, 0, 0);

      const scaleH = [0, 0.68, 1.00, 1.34][s.heatLvl] || 1;
      const scaleR = [0, 0.84, 1.02, 1.18][s.heatLvl] || 1;
      const flicker = 1 + 0.075 * Math.sin(tSec * 19.3) + 0.045 * Math.sin(tSec * 33.7) + 0.03 * Math.cos(tSec * 47.1);
      this.flameGroup.scale.set(scaleR, scaleH, scaleR);

      const tinted = ts < this.flameTint.until && !!this.flameTint.color;
      const u = this.flameShaderMat.uniforms;
      const capY = vesselY - (kind === 'tube' ? 0.005 : 0.014);
      u.uTime.value = tSec;
      u.uPower.value = 0.75 + s.heatLvl * 0.24;
      u.uFlicker.value = flicker;
      u.uCapWorldY.value = capY;
      if (tinted) {
        u.uTint.value.lerp(new THREE.Color(this.flameTint.color), Math.min(1, dt * 10));
        u.uTintMix.value = Math.min(0.92, u.uTintMix.value + dt * 5.0);
      } else {
        u.uTintMix.value = Math.max(0.0, u.uTintMix.value - dt * 2.5);
      }

      const uM = this.flameMidMat.uniforms;
      uM.uTime.value = tSec * 1.28 + 1.9;
      uM.uPower.value = (0.65 + s.heatLvl * 0.2) * 0.9;
      uM.uFlicker.value = 1 + 0.09 * Math.cos(tSec * 25.1);
      uM.uCapWorldY.value = capY;
      uM.uTint.value.copy(u.uTint.value);
      uM.uTintMix.value = u.uTintMix.value * 0.85;

      const activeColor = u.uTintMix.value > 0.2 ? u.uTint.value : new THREE.Color('#ff9329');
      this.flameHaloMat.color.copy(activeColor);
      this.flameHaloMat.opacity = (0.17 + s.heatLvl * 0.05) * flicker;
      this.flameHalo.scale.set(0.58 * scaleR, 0.68 * scaleH * flicker, 1);

      // Живое подрагивание источника света от пламени
      this.flameLight.color.copy(activeColor);
      this.flameLight.position.set(
        this.vesselX + 0.02 * Math.sin(tSec * 14),
        0.92 + 0.08 * scaleH,
        0.22 + 0.015 * Math.cos(tSec * 11)
      );
      this.flameLight.intensity = (1.55 + s.heatLvl * 0.78) * flicker;

      if ((s.heatLvl === 3 || tinted) && Math.random() < (tinted ? 0.16 : 0.05)) {
        this._spawnSparks(
          this.vesselX,
          0.88 + 0.12 * scaleH,
          0,
          1,
          tinted ? this.flameTint.color : '#fde047',
          0.45
        );
      }
    } else {
      this.flameGroup.visible = false;
      this.flameLight.intensity = this.emberHeat * 0.25;
      // Когда фитиль полностью остыл — колпачок закрывает спиртовку
      if (this.emberHeat < 0.08) {
        this.snufferCap.position.set(0, 0.66, 0);
      }
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

    // 5. Движение хлопьев осадка (вкл. искрящийся листопад перекристаллизованного PbI₂ «золотой дождь»)
    if (sim.goldenRainSparkle && a.wet) {
      busy = true;
      for (const f of this.flakes) {
        if (f.y <= 0.05 && Math.random() < 0.08) {
          f.y = Math.max(0.08, liqLocalY - 0.04);
          f.vy = -0.045 - Math.random() * 0.04;
        }
      }
      if (Math.random() < 0.16) {
        this._spawnSparks(
          this.vesselX + (Math.random() - 0.5) * 0.16,
          vesselY + 0.08 + Math.random() * Math.max(0.06, liqLocalY - 0.1),
          (Math.random() - 0.5) * 0.16,
          1,
          '#fde047',
          0.22
        );
      }
    }
    for (const f of this.flakes) {
      if (f.y > 0.045) {
        busy = true;
        f.y = Math.max(0.035, f.y + f.vy * dt);
        f.x += Math.sin(tSec * 2.5 + f.rot) * 0.015 * dt;
        f.rot += dt * (sim.goldenRainSparkle ? 2.4 : 0.8);
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

    // 7. Пар, бурый газ, извержение «химического вулкана» и струйки дыма горения
    const mouthY = vesselY + this._mouthHeight(kind);
    if (sim.volcanoErupting) {
      busy = true;
      if (Math.random() < 0.85) {
        this._spawnSparks(this.vesselX, vesselY + 0.18, 0, 3, Math.random() < 0.5 ? '#fb923c' : '#fde047', 1.35);
      }
      if (Math.random() < 0.42) {
        this._spawnSmokePuff(this.vesselX, mouthY + 0.02, 0, '#3f6212', 0.18 + Math.random() * 0.09, 0.55);
      }
      this.flashLight.color.set('#f97316');
      this.flashLight.intensity = Math.max(this.flashLight.intensity, 3.2 + Math.sin(tSec * 37) * 1.1);
    }
    const emitPlume = (a.wet && s.temp > 72 && !s.tubeOn) || (s.headspace?.gas === 'NO2' && !s.tubeOn) || (s.headspace?.gas === 'SO2' && !s.tubeOn);
    if (emitPlume && Math.random() < 0.25) {
      this._spawnSmokePuff(
        this.vesselX,
        mouthY + 0.03,
        0,
        s.headspace?.gas === 'NO2' ? '#b45309' : '#f1f5f9',
        0.16 + Math.random() * 0.08,
        0.42
      );
    }
    for (const c of this.steamClouds) {
      if (c.life <= 0) {
        c.sprite.visible = false;
        continue;
      }
      busy = true;
      c.life -= dt * 0.52;
      c.y += dt * (c.vy || 0.42);
      c.x += c.vx * dt + Math.sin(tSec * 4.5 + c.y * 5) * 0.025 * dt;
      const prog = 1 - Math.max(0, c.life);
      const sc = c.size * (1 + prog * 2.2);
      c.sprite.visible = true;
      c.sprite.position.set(c.x, c.y, c.z);
      c.sprite.scale.set(sc, sc, 1);
      c.sprite.material.color.set(c.color);
      c.sprite.material.opacity = Math.sin(Math.min(1, c.life) * Math.PI) * 0.34;
    }

    // 7б. Полёт и остывание искр горения
    for (const sp of this.sparks) {
      if (sp.life <= 0) {
        sp.sprite.visible = false;
        continue;
      }
      busy = true;
      sp.life -= dt;
      sp.vy -= 0.85 * dt; // лёгкая гравитация после выброса
      sp.vx *= Math.pow(0.25, dt);
      sp.vz *= Math.pow(0.25, dt);
      sp.x += (sp.vx + 0.12 * Math.sin(tSec * 14 + sp.y * 9)) * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;

      const lifeFrac = Math.max(0, sp.life / sp.maxLife);
      sp.sprite.visible = true;
      sp.sprite.position.set(sp.x, sp.y, sp.z);
      const sc = sp.size * (0.45 + 0.75 * lifeFrac);
      sp.sprite.scale.set(sc, sc, 1);
      sp.sprite.material.color.set(sp.color).lerp(new THREE.Color('#ffffff'), lifeFrac * 0.45);
      sp.sprite.material.opacity = Math.min(1, lifeFrac * 1.35);
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

    // 8б. Капля титранта из крана бюретки и поворот вентиля крана
    if (this.dripAnim.active && s.buretteOn) {
      busy = true;
      this.dripAnim.t += dt;
      const dp = this.dripAnim.t / this.dripAnim.dur;
      if (dp >= 1) {
        this.dripAnim.active = false;
        this.buretteDropMesh.visible = false;
        this.buretteValve.rotation.z = 0;
      } else {
        this.buretteValve.rotation.z = Math.sin(dp * Math.PI) * 1.1;
        const startY = mouthY + 0.18;
        const endY = a.wet ? liqWorldY : vesselY + 0.05;
        this.buretteDropMesh.visible = true;
        this.buretteDropMat.color.set(this.dripAnim.color);
        this.buretteDropMesh.position.set(this.vesselX, startY - (startY - endY) * (dp * dp), 0);
      }
    } else {
      this.buretteDropMesh.visible = false;
    }

    // 8в. Анимация фильтрования осадка через стеклянную воронку со складчатым бумажным фильтром
    if (this.filterAnim.active) {
      busy = true;
      this.filterAnim.t += dt;
      const fp = this.filterAnim.t / this.filterAnim.dur;
      if (fp >= 1) {
        this.filterAnim.active = false;
        this.filterActiveGroup.visible = false;
      } else {
        this.filterActiveGroup.visible = true;
        this.filterActiveGroup.position.set(this.vesselX, mouthY + 0.04, 0);
        this.actFilterPaperMat.color.set('#ffffff').lerp(new THREE.Color(this.filterAnim.cakeColor), Math.min(1, fp * 1.5));
        this.filterFiltrateStream.visible = fp > 0.12 && fp < 0.90;
        this.filterFiltrateStream.material.color.set(a.liquidColor || '#dff2fc');
      }
    }

    // 9. Реалистичное горение и накал на инструментах (лучина, нихромовая петля, тигельные щипцы)
    if (this.toolAnim.kind) {
      busy = true;
      this.toolAnim.t += dt;
      const p = this.toolAnim.t / this.toolAnim.dur;
      if (p >= 1) {
        this.toolAnim.kind = '';
        this.propGroup.visible = false;
        this.h2PopMesh.visible = false;
      } else {
        this.propGroup.visible = true;
        const k = this.toolAnim.kind;
        const ex = this.toolAnim.extra || {};
        this.splintGroup.visible = k === 'splint';
        this.loopGroup.visible = k === 'loop';
        this.tongsGroup.visible = k === 'tongs';

        const swing = Math.sin(p * Math.PI);

        if (k === 'splint') {
          const tx = s.tubeOn ? 1.55 : this.vesselX;
          const ty = s.tubeOn ? 1.52 : mouthY + 0.05;
          const px = tx + (1 - swing) * 0.42;
          const py = ty + (1 - swing) * 0.24;
          this.propGroup.position.set(px, py, 0.08);

          const snuffed = !!ex.extinguish && p > 0.40;
          const isH2Pop = ex.flashColor === '#60a5fa';
          const isSootyC2H2 = !!ex.sootyFlare;
          const isO2Flare = !!ex.flare && !isH2Pop;

          this.splintFlameMesh.visible = !snuffed;
          const uS = this.splintFlameMat.uniforms;
          uS.uTime.value = tSec * 1.15;
          uS.uFlicker.value = 0.92 + 0.14 * Math.sin(tSec * 27);
          uS.uPower.value = (isO2Flare || isSootyC2H2) && p > 0.30 ? 1.55 : 0.85;
          uS.uTint.value.set(isO2Flare && p > 0.30 ? '#fef08a' : (isSootyC2H2 && p > 0.30 ? '#f97316' : '#ff9e2c'));
          uS.uTintMix.value = (isO2Flare || isSootyC2H2) && p > 0.30 ? 0.84 : 0.0;

          const flareScale = (isO2Flare || isSootyC2H2) && p > 0.32 ? 1.95 + 0.28 * Math.sin(tSec * 35) : (isH2Pop && p > 0.34 && p < 0.55 ? 0.35 : 1.0);
          this.splintFlameMesh.scale.set(flareScale * 0.95, flareScale * 1.15, flareScale * 0.95);
          this.splintEmberMat.emissiveIntensity = snuffed
            ? Math.max(0.15, 2.0 * (1 - (p - 0.40) / 0.60))
            : ((isO2Flare || isSootyC2H2) && p > 0.32 ? 3.2 : 1.4);

          // Эффекты в момент контакта с газом (p ≈ 0.36)
          if (p > 0.34 && !this.toolAnim.burstDone) {
            this.toolAnim.burstDone = true;
            if (isO2Flare) {
              this._spawnSparks(px, py + 0.06, 0.08, 20, '#fde047', 1.15);
            } else if (isSootyC2H2) {
              this._spawnSparks(px, py + 0.06, 0.08, 12, '#fb923c', 0.95);
              this._spawnSmokePuff(px, py + 0.12, 0.08, '#18181b', 0.20, 0.46);
              this._spawnSmokePuff(px - 0.03, py + 0.16, 0.08, '#27272a', 0.22, 0.50);
            } else if (isH2Pop) {
              this._spawnSparks(tx, ty, 0.04, 12, '#93c5fd', 1.25);
              this._spawnSmokePuff(tx, ty + 0.04, 0, '#e0f2fe', 0.22, 0.35);
            } else if (ex.extinguish) {
              this._spawnSmokePuff(px, py + 0.03, 0.08, '#cbd5e1', 0.11, 0.30);
              this._spawnSmokePuff(px + 0.02, py + 0.06, 0.08, '#94a3b8', 0.13, 0.34);
            }
          }
          if (isSootyC2H2 && p > 0.34 && p < 0.85 && Math.random() < 0.38) {
            this._spawnSmokePuff(px, py + 0.14, 0.08, '#18181b', 0.16, 0.48);
          }
          if (snuffed && Math.random() < 0.22) {
            this._spawnSmokePuff(px, py + 0.02, 0.08, '#cbd5e1', 0.09, 0.28);
          }

          // Волна хлопка водорода H₂
          if (isH2Pop && p > 0.32 && p < 0.66) {
            const kp = (p - 0.32) / 0.34;
            this.h2PopMesh.visible = true;
            this.h2PopMesh.position.set(tx, ty, 0.04);
            this.h2PopMesh.scale.setScalar(0.6 + kp * 3.4);
            this.h2PopMat.opacity = (1 - kp) * 0.55;
          } else {
            this.h2PopMesh.visible = false;
          }
        } else if (k === 'loop') {
          this.h2PopMesh.visible = false;
          const px = this.vesselX + (1 - swing) * 0.46;
          const py = 0.90 + (1 - swing) * 0.12;
          this.propGroup.position.set(px, py, 0.05);
          // Нихромовая петля раскаляется докрасна при входе в пламя
          const glow = Math.pow(swing, 1.4);
          this.loopWireMat.emissive.set(ex.color || '#ff5d00');
          this.loopWireMat.emissiveIntensity = glow * 2.4;
          if (swing > 0.72 && Math.random() < 0.28) {
            this._spawnSparks(px, py + 0.04, 0.05, 1, ex.color || '#ffb703', 0.6);
          }
        } else if (k === 'tongs') {
          this.h2PopMesh.visible = false;
          const isClBurn = !!ex.clBurn;
          const isSulfur = !!ex.sulfurBurn;
          const targetY = (isClBurn || isSulfur) ? vesselY + 0.38 : 0.94;
          const px = this.vesselX + (1 - swing) * 0.52;
          const py = targetY + (1 - swing) * 0.32;
          this.propGroup.position.set(px, py, 0.06);

          const isMg = ex.metal === 'mg';
          const isCu = ex.metal === 'cu';
          const heat = Math.min(1, swing * 1.35);

          // Изменение цвета образца: Mg белеет в пепел, S плавится и горит голубым, Cu чернеет оксидом CuO
          if (isSulfur) {
            this.tongsSampleMat.color.set(p > 0.35 ? '#b45309' : '#facc15');
            this.tongsSampleMat.emissive.set('#38bdf8');
            this.tongsSampleMat.emissiveIntensity = p > 0.20 && p < 0.88 ? 2.2 : 0.4;
          } else if (isMg) {
            this.tongsSampleMat.color.set(p > 0.55 ? '#f8fafc' : '#cbd5e1');
            this.tongsSampleMat.emissive.set('#ffffff');
            this.tongsSampleMat.emissiveIntensity = p > 0.24 && p < 0.84 ? 3.5 : heat * 0.6;
          } else if (isCu) {
            this.tongsSampleMat.color.set(p > 0.52 ? '#1c1917' : '#c8753c');
            this.tongsSampleMat.emissive.set(isClBurn ? '#f97316' : '#ef4444');
            this.tongsSampleMat.emissiveIntensity = heat * (isClBurn ? 2.2 : 1.35);
          } else {
            this.tongsSampleMat.color.set('#57534e');
            this.tongsSampleMat.emissive.set('#f97316');
            this.tongsSampleMat.emissiveIntensity = heat * 2.1;
          }

          // Ослепительное пламя магния, голубое пламя серы или вспышка в хлоре
          const showSampleFlame = (isMg && p > 0.22 && p < 0.86) || (isClBurn && p > 0.26 && p < 0.82) || (isSulfur && p > 0.20 && p < 0.88);
          this.tongsFlameMesh.visible = showSampleFlame;
          if (showSampleFlame) {
            const uT = this.tongsFlameMat.uniforms;
            uT.uTime.value = tSec * 1.4;
            uT.uFlicker.value = 0.9 + 0.25 * Math.sin(tSec * 38);
            uT.uPower.value = isSulfur ? 1.15 : 1.4;
            uT.uTint.value.set(isMg ? '#ffffff' : (isSulfur ? '#38bdf8' : '#f97316'));
            uT.uTintMix.value = 0.95;
            const fSc = isMg ? 1.55 : (isSulfur ? 1.1 : 1.15);
            this.tongsFlameMesh.scale.set(fSc, fSc * 1.25, fSc);
          }

          this.tongsGlareSprite.visible = isMg && p > 0.22 && p < 0.86;
          if (this.tongsGlareSprite.visible) {
            const pulse = 0.85 + 0.22 * Math.sin(tSec * 44);
            this.tongsGlareMat.opacity = 0.82 * Math.sin(((p - 0.22) / 0.64) * Math.PI);
            this.tongsGlareSprite.scale.set(1.05 * pulse, 1.05 * pulse, 1);
          }

          if (isMg && p > 0.25 && p < 0.80) {
            if (Math.random() < 0.55) this._spawnSparks(px, py + 0.03, 0.06, 2, '#ffffff', 1.15);
            if (Math.random() < 0.30) this._spawnSmokePuff(px, py + 0.08, 0.06, '#f8fafc', 0.16, 0.44);
          } else if (isSulfur && p > 0.24 && p < 0.84) {
            if (Math.random() < 0.35) this._spawnSmokePuff(px, py + 0.06, 0.04, '#e0f2fe', 0.17, 0.38);
          } else if (isClBurn && p > 0.28 && p < 0.80) {
            if (Math.random() < 0.50) this._spawnSparks(px, py, 0.04, 2, '#fb923c', 0.95);
            if (Math.random() < 0.35) this._spawnSmokePuff(px, py + 0.06, 0.04, '#b45309', 0.19, 0.36);
          }
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
