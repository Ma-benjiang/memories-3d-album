import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { calculateAge } from "../domain/memories";

const FRAME_DIMS = {
  landscape: [2.05, 1.52],
  portrait: [1.5, 2.15],
  square: [1.82, 1.82],
};

const FRAME_STYLE = {
  walnut: {
    outer: 0x5a321e,
    inner: 0xb9854d,
    mat: 0xeee4ce,
    roughness: 0.48,
    metalness: 0.04,
    rail: 0.14,
    depth: 0.2,
  },
  titanium: {
    outer: 0x17191d,
    inner: 0xa84f42,
    mat: 0x27282b,
    roughness: 0.22,
    metalness: 0.75,
    rail: 0.055,
    depth: 0.095,
  },
  oak: {
    outer: 0xbc9362,
    inner: 0x66715f,
    mat: 0xd9d0bb,
    roughness: 0.72,
    metalness: 0.02,
    rail: 0.18,
    depth: 0.135,
  },
};

const FRAME_INSET = {
  walnut: [0.92, 0.86],
  titanium: [0.95, 0.91],
  oak: [0.9, 0.82],
};

function makeMaterial(options) {
  return new THREE.MeshStandardMaterial({ metalness: 0.02, ...options });
}

function roundedCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeSoftShadowTexture() {
  const canvas = roundedCanvas(256, 256);
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 124);
  gradient.addColorStop(0, "rgba(0,0,0,.72)");
  gradient.addColorStop(0.48, "rgba(0,0,0,.4)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeWoodGrainTexture() {
  const canvas = roundedCanvas(768, 256);
  const context = canvas.getContext("2d");
  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#3b2115");
  base.addColorStop(0.42, "#805238");
  base.addColorStop(1, "#2b1710");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 150; index += 1) {
    const y = (index * 43) % canvas.height;
    context.strokeStyle =
      index % 5 === 0 ? "rgba(238,191,125,.15)" : "rgba(30,10,5,.2)";
    context.lineWidth = 0.7 + (index % 4) * 0.45;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(
      190,
      y + Math.sin(index) * 11,
      540,
      y - Math.cos(index * 0.7) * 9,
      canvas.width,
      y + Math.sin(index * 1.7) * 6,
    );
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 1.35);
  return texture;
}

function roundedRectangle(path, width, height, radius, reverse = false) {
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  if (!reverse) {
    path.moveTo(left + r, bottom);
    path.lineTo(right - r, bottom);
    path.quadraticCurveTo(right, bottom, right, bottom + r);
    path.lineTo(right, top - r);
    path.quadraticCurveTo(right, top, right - r, top);
    path.lineTo(left + r, top);
    path.quadraticCurveTo(left, top, left, top - r);
    path.lineTo(left, bottom + r);
    path.quadraticCurveTo(left, bottom, left + r, bottom);
  } else {
    path.moveTo(left + r, bottom);
    path.quadraticCurveTo(left, bottom, left, bottom + r);
    path.lineTo(left, top - r);
    path.quadraticCurveTo(left, top, left + r, top);
    path.lineTo(right - r, top);
    path.quadraticCurveTo(right, top, right, top - r);
    path.lineTo(right, bottom + r);
    path.quadraticCurveTo(right, bottom, right - r, bottom);
    path.lineTo(left + r, bottom);
  }
}

function makeFrameRingGeometry(outerWidth, outerHeight, innerWidth, innerHeight, depth) {
  const shape = new THREE.Shape();
  roundedRectangle(shape, outerWidth, outerHeight, Math.min(0.055, outerHeight * 0.05));
  const hole = new THREE.Path();
  roundedRectangle(hole, innerWidth, innerHeight, Math.min(0.028, innerHeight * 0.035), true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(0.018, depth * 0.18),
    bevelThickness: Math.min(0.02, depth * 0.22),
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const char of [...(text || "")]) {
    if (context.measureText(line + char).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line) lines.push(line);
  return lines;
}

function makeBackTexture(memory, profile, width, height) {
  const canvas = roundedCanvas(1024, Math.round((1024 * height) / width));
  const context = canvas.getContext("2d");
  context.fillStyle = "#a9855d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 700; index += 1) {
    context.fillStyle = `rgba(67,43,26,${0.018 + (index % 5) * 0.006})`;
    context.fillRect((index * 683) % canvas.width, (index * 977) % canvas.height, 2, 1);
  }
  context.fillStyle = "#f1e7cf";
  context.roundRect(52, 44, canvas.width - 104, canvas.height - 88, 20);
  context.fill();
  context.strokeStyle = "rgba(111,82,55,.18)";
  context.lineWidth = 2;
  for (let y = 230; y < canvas.height - 70; y += 62) {
    context.beginPath();
    context.moveTo(92, y);
    context.lineTo(canvas.width - 92, y);
    context.stroke();
  }
  context.fillStyle = "#49372a";
  context.font = "italic 700 48px Georgia, serif";
  context.fillText(memory.title || "未命名回忆", 92, 130);
  const age = calculateAge(profile?.birthDate, memory.capturedAt, memory.ageOverrideMonths);
  context.font = "italic 25px Georgia, serif";
  context.fillStyle = "#765b45";
  context.fillText(memory.capturedAt || "日期待补充", 92, 184);
  context.fillText(memory.location || "地点待补充", 350, 184);
  context.fillText(age.label, canvas.width - 250, 184);
  context.font = "italic 31px Georgia, serif";
  context.fillStyle = "#49372a";
  wrapCanvasText(context, memory.note || "寄语待补充", canvas.width - 190)
    .slice(0, 5)
    .forEach((line, index) => context.fillText(line, 96, 290 + index * 62));
  context.fillStyle = "rgba(144,91,55,.72)";
  const pawX = canvas.width - 132;
  const pawY = canvas.height - 110;
  [[-42, -40, 22], [0, -61, 19], [42, -40, 22]].forEach(([x, y, radius]) => {
    context.beginPath();
    context.arc(pawX + x, pawY + y, radius, 0, Math.PI * 2);
    context.fill();
  });
  context.beginPath();
  context.ellipse(pawX, pawY, 48, 36, 0, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function configurePhotoTexture(texture, memory, frameWidth, frameHeight) {
  const imageWidth = memory.photo.width || texture.image?.width || frameWidth;
  const imageHeight = memory.photo.height || texture.image?.height || frameHeight;
  const imageRatio = imageWidth / imageHeight;
  const frameRatio = frameWidth / frameHeight;
  const crop = memory.framing?.crop ?? { x: 0.5, y: 0.5, zoom: 1 };
  const zoom = Math.max(1, crop.zoom || 1);
  let repeatX = 1;
  let repeatY = 1;
  if (imageRatio > frameRatio) repeatX = frameRatio / imageRatio;
  else repeatY = imageRatio / frameRatio;
  repeatX /= zoom;
  repeatY /= zoom;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.offset.set(
    THREE.MathUtils.clamp((crop.x ?? 0.5) - repeatX / 2, 0, 1 - repeatX),
    THREE.MathUtils.clamp(1 - (crop.y ?? 0.5) - repeatY / 2, 0, 1 - repeatY),
  );
  texture.needsUpdate = true;
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => {
        material.map?.dispose?.();
        material.dispose?.();
      });
    } else {
      object.material?.map?.dispose?.();
      object.material?.dispose?.();
    }
  });
}

function expLerp(current, target, speed, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

function shortestAngle(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export function createGalleryEngine(
  canvas,
  {
    onSelect = () => {},
    onBlankClick = () => {},
    onTableLayoutChange = () => {},
    onFocusChange = () => {},
    onHoverChange = () => {},
  } = {},
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(0, 0.1, 9.6);
  const cameraTarget = new THREE.Vector3(0, 0.1, 9.6);
  const lookTarget = new THREE.Vector3(0, 0, 0);
  const lookCurrent = new THREE.Vector3(0, 0, 0);
  const root = new THREE.Group();
  scene.add(root);
  const ambient = new THREE.HemisphereLight(0xf5dfba, 0x160f0b, 0.5);
  const key = new THREE.DirectionalLight(0xffe7c2, 1.3);
  key.position.set(3.6, 5.2, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.018;
  const fill = new THREE.DirectionalLight(0xb9cce5, 0.3);
  fill.position.set(-4, 1, 4);
  const rim = new THREE.DirectionalLight(0xf0b47a, 0.5);
  rim.position.set(-2, 3, -5);
  scene.add(ambient, key, fill, rim);
  const wallShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.ShadowMaterial({
      color: 0x100b08,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  wallShadow.position.set(0, 0, -1.18);
  wallShadow.receiveShadow = true;
  scene.add(wallShadow);

  const leaves = new THREE.Group();
  const leafPalette = [0x8a5941, 0xb37a55, 0xc79b6c, 0x6d7653];
  for (let index = 0; index < 34; index += 1) {
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09 + (index % 4) * 0.018, 0.16 + (index % 3) * 0.02),
      makeMaterial({
        color: leafPalette[index % leafPalette.length],
        roughness: 0.92,
        side: THREE.DoubleSide,
      }),
    );
    const angle = (index / 34) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * (2.2 + (index % 5) * 0.22), -1.8 + (index % 9) * 0.48, -0.6);
    leaf.rotation.set(index * 0.31, index * 0.47, angle);
    leaf.userData = {
      origin: leaf.position.clone(),
      phase: index * 0.57,
      speed: 0.35 + (index % 6) * 0.06,
    };
    leaves.add(leaf);
  }
  leaves.visible = false;
  scene.add(leaves);

  const woodGrainTexture = makeWoodGrainTexture();
  const frameWoodTexture = woodGrainTexture.clone();
  frameWoodTexture.repeat.set(1.2, 0.72);
  frameWoodTexture.needsUpdate = true;
  const tableMaterial = makeMaterial({
    color: 0x8b654b,
    map: woodGrainTexture,
    bumpMap: woodGrainTexture,
    bumpScale: 0.024,
    roughness: 0.64,
    metalness: 0.02,
  });
  const table = new THREE.Mesh(
    new RoundedBoxGeometry(11, 0.28, 7, 5, 0.08),
    tableMaterial,
  );
  table.position.set(0, -1.63, 0);
  table.receiveShadow = true;
  table.visible = false;
  scene.add(table);
  const tableEdge = new THREE.Mesh(
    new RoundedBoxGeometry(11.12, 0.22, 0.28, 4, 0.055),
    makeMaterial({ color: 0x2e190f, roughness: 0.74 }),
  );
  tableEdge.position.set(0, -1.47, 3.38);
  tableEdge.castShadow = tableEdge.receiveShadow = true;
  tableEdge.visible = false;
  scene.add(tableEdge);

  let environmentTexture = null;
  let pmrem = null;
  let mode = "gallery";
  let selectedId = null;
  let focusIndex = 1;
  let transition = null;
  let hoveredId = null;
  let frames = [];
  let disposed = false;
  let lightMode = "day";
  let resizeObserver;

  const pointer = {
    id: null,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    moved: 0,
    hit: null,
    orbiting: false,
    tableDragging: false,
    hoverX: 0,
    hoverY: 0,
  };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const clock = new THREE.Clock();
  const hitObjects = [];
  const softShadowTexture = makeSoftShadowTexture();

  function setEnvironment(nextMode) {
    const envCanvas = roundedCanvas(512, 256);
    const context = envCanvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    if (nextMode === "day") {
      gradient.addColorStop(0, "#cdb693");
      gradient.addColorStop(0.55, "#77604b");
      gradient.addColorStop(1, "#2a2019");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 256);
      context.fillStyle = "rgba(255,255,245,.92)";
      context.beginPath();
      context.arc(130, 62, 68, 0, Math.PI * 2);
      context.fill();
    } else {
      gradient.addColorStop(0, "#32384d");
      gradient.addColorStop(0.58, "#1b1d2b");
      gradient.addColorStop(1, "#090a0f");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 256);
      context.fillStyle = "rgba(255,184,100,.8)";
      context.beginPath();
      context.arc(395, 78, 52, 0, Math.PI * 2);
      context.fill();
    }
    const source = new THREE.CanvasTexture(envCanvas);
    source.mapping = THREE.EquirectangularReflectionMapping;
    pmrem?.dispose();
    pmrem = new THREE.PMREMGenerator(renderer);
    environmentTexture?.dispose();
    environmentTexture = pmrem.fromEquirectangular(source).texture;
    scene.environment = environmentTexture;
    source.dispose();
  }

  function createPolaroid(memory, texture, width, height, frame) {
    const group = new THREE.Group();
    const cardWidth = width * 0.93;
    const cardHeight = height * 1.1;
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(cardWidth, cardHeight, 0.055),
      makeMaterial({ color: 0xf5eddd, roughness: 0.92 }),
    );
    card.castShadow = card.receiveShadow = true;
    card.userData.frame = frame;
    group.add(card);
    hitObjects.push(card);
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(cardWidth * 0.88, cardHeight * 0.76),
      makeMaterial({ map: texture, roughness: 0.58, envMapIntensity: 0.18 }),
    );
    photo.position.set(0, cardHeight * 0.075, 0.031);
    group.add(photo);
    return group;
  }

  function addRails(group, width, height, z, style) {
    const rail = style.rail;
    const isWalnut = style === FRAME_STYLE.walnut;
    const outer = makeMaterial({
      color: isWalnut ? 0xb48868 : style.outer,
      map: isWalnut ? frameWoodTexture : null,
      bumpMap: isWalnut ? frameWoodTexture : null,
      bumpScale: isWalnut ? 0.012 : 0,
      roughness: style.roughness,
      metalness: style.metalness,
      envMapIntensity: 0.8,
    });
    const inner = makeMaterial({
      color: style.inner,
      roughness: Math.max(0.18, style.roughness - 0.15),
      metalness: Math.min(0.8, style.metalness + 0.12),
      envMapIntensity: 1,
    });
    const outerRing = new THREE.Mesh(
      makeFrameRingGeometry(
        width + rail * 2,
        height + rail * 2,
        width,
        height,
        style.depth,
      ),
      outer,
    );
    outerRing.position.z = z + style.depth * 0.34;
    outerRing.castShadow = outerRing.receiveShadow = true;
    group.add(outerRing);
    const lip = 0.025;
    const innerRing = new THREE.Mesh(
      makeFrameRingGeometry(width + lip * 2, height + lip * 2, width - lip, height - lip, 0.04),
      inner,
    );
    innerRing.position.z = z + style.depth * 0.72;
    innerRing.castShadow = true;
    group.add(innerRing);
  }

  function createFrame(memory, profile) {
    const frame = {
      id: memory.id,
      memory,
      root: new THREE.Group(),
      framed: new THREE.Group(),
      polaroid: null,
      target: {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        scale: 1,
        visible: true,
      },
      orbitY: 0,
      orbitVelocity: 0,
      forcedOrbitTarget: null,
      tableVelocity: new THREE.Vector2(),
      tableDirty: false,
      lastLayoutEmit: 0,
      glasses: [],
      hoverLocal: new THREE.Vector2(),
      dimensions: new THREE.Vector2(),
      stand: null,
      blob: null,
    };
    const [width, height] = FRAME_DIMS[memory.framing?.orientation] ?? FRAME_DIMS.landscape;
    const styleName = memory.framing?.style ?? "walnut";
    const style = FRAME_STYLE[styleName] ?? FRAME_STYLE.walnut;
    const [insetX, insetY] =
      memory.framing?.orientation === "landscape"
        ? (FRAME_INSET[styleName] ?? FRAME_INSET.walnut)
        : [0.9, 0.9];
    const framedWidth = width * insetX;
    const framedHeight = height * insetY;
    frame.dimensions.set(width, height);
    const texture = new THREE.TextureLoader().load(memory.imageUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      configurePhotoTexture(loaded, memory, width, height);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    configurePhotoTexture(texture, memory, width, height);
    const backTexture = makeBackTexture(memory, profile, width, height);
    const edge = makeMaterial({ color: style.outer, roughness: 0.68 });
    const front = makeMaterial({
      map: texture,
      roughness: 0.48,
      envMapIntensity: 0.34,
    });
    const back = makeMaterial({
      map: backTexture,
      roughness: 0.72,
      envMapIntensity: 0.2,
    });
    const board = new THREE.Mesh(new RoundedBoxGeometry(width + 0.04, height + 0.08, 0.12, 3, 0.022), [
      edge,
      edge,
      edge,
      edge,
      front,
      back,
    ]);
    board.castShadow = board.receiveShadow = true;
    board.userData.frame = frame;
    frame.framed.add(board);
    hitObjects.push(board);
    addRails(frame.framed, framedWidth, framedHeight, 0.06, style);
    if (styleName === "titanium") {
      const boltMaterial = makeMaterial({
        color: 0xc8cdd2,
        roughness: 0.16,
        metalness: 0.92,
      });
      [
        [-framedWidth / 2, -framedHeight / 2],
        [framedWidth / 2, -framedHeight / 2],
        [-framedWidth / 2, framedHeight / 2],
        [framedWidth / 2, framedHeight / 2],
      ].forEach(([x, y]) => {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.024, 18),
          boltMaterial,
        );
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(x, y, 0.06 + style.depth * 0.92);
        bolt.castShadow = true;
        frame.framed.add(bolt);
      });
    }
    if (styleName === "oak") {
      const pegMaterial = makeMaterial({ color: 0x9b724d, roughness: 0.78 });
      [-1, 1].forEach((side) => {
        const peg = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12), pegMaterial);
        peg.position.set(
          side * (framedWidth / 2 + style.rail * 0.5),
          0,
          0.06 + style.depth * 0.72,
        );
        peg.castShadow = true;
        frame.framed.add(peg);
      });
    }
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4ff,
      transparent: true,
      opacity: 0.14,
      transmission: 0,
      roughness: 0.035,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      specularIntensity: 1,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(
        framedWidth - style.rail * 0.35,
        framedHeight - style.rail * 0.35,
      ),
      glassMaterial,
    );
    glass.position.z = 0.165;
    frame.glasses.push(glassMaterial);
    frame.framed.add(glass);
    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(framedWidth * 0.19, framedHeight * 1.2),
      new THREE.MeshBasicMaterial({
        color: 0xfff4db,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    reflection.position.set(-framedWidth * 0.22, 0, 0.171);
    reflection.rotation.z = -0.2;
    frame.framed.add(reflection);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.7, height * 2.1),
      new THREE.MeshBasicMaterial({
        map: softShadowTexture,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
    );
    blob.position.set(0.08, -0.18, -0.42);
    blob.renderOrder = -2;
    frame.framed.add(blob);
    frame.blob = blob;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, height * 0.5, 0.075),
      makeMaterial({ color: style.outer, roughness: style.roughness }),
    );
    stand.position.set(width * 0.34, -height * 0.29, -0.16);
    stand.rotation.x = -0.32;
    frame.framed.add(stand);
    frame.stand = stand;
    frame.polaroid = createPolaroid(memory, texture, width, height, frame);
    frame.polaroid.visible = false;
    frame.root.add(frame.framed, frame.polaroid);
    root.add(frame.root);
    return frame;
  }

  function tableFootprint(frame) {
    const angle = frame.target.rotation.y;
    const scaledWidth = (frame.dimensions.x + 0.28) * frame.target.scale;
    const scaledDepth = 0.42 * frame.target.scale;
    return {
      halfX:
        (Math.abs(Math.cos(angle)) * scaledWidth +
          Math.abs(Math.sin(angle)) * scaledDepth) /
        2,
      halfZ:
        (Math.abs(Math.sin(angle)) * scaledWidth +
          Math.abs(Math.cos(angle)) * scaledDepth) /
        2,
    };
  }

  function resolveTableCollisions(movingFrame, bounce = false) {
    const moving = tableFootprint(movingFrame);
    frames.forEach((other) => {
      if (other === movingFrame || !other.target.visible) return;
      const fixed = tableFootprint(other);
      const dx = movingFrame.target.position.x - other.target.position.x;
      const dz = movingFrame.target.position.z - other.target.position.z;
      const overlapX = moving.halfX + fixed.halfX + 0.06 - Math.abs(dx);
      const overlapZ = moving.halfZ + fixed.halfZ + 0.06 - Math.abs(dz);
      if (overlapX <= 0 || overlapZ <= 0) return;
      if (overlapX < overlapZ) {
        const direction = Math.sign(dx || movingFrame.tableVelocity.x || 1);
        movingFrame.target.position.x += overlapX * direction;
        if (bounce) movingFrame.tableVelocity.x *= -0.42;
      } else {
        const direction = Math.sign(dz || movingFrame.tableVelocity.y || 1);
        movingFrame.target.position.z += overlapZ * direction;
        if (bounce) movingFrame.tableVelocity.y *= -0.42;
      }
      movingFrame.target.position.x = THREE.MathUtils.clamp(
        movingFrame.target.position.x,
        -4.3,
        4.3,
      );
      movingFrame.target.position.z = THREE.MathUtils.clamp(
        movingFrame.target.position.z,
        -2.6,
        2.6,
      );
    });
  }

  function separateTableTargets() {
    for (let pass = 0; pass < 4; pass += 1) {
      frames.forEach((frame) => resolveTableCollisions(frame));
    }
  }

  function relayout() {
    frames.forEach((frame, index) => {
      const target = frame.target;
      target.visible = true;
      if (mode === "table") {
        const tableLayout = frame.memory.table ?? {};
        const tableScale = 0.64;
        const rowStart = Math.floor(index / 5) * 5;
        const rowCount = Math.min(5, frames.length - rowStart);
        const column = index - rowStart;
        target.position.set(
          tableLayout.x ?? (column - (rowCount - 1) / 2) * 1.84,
          -1.49 + frame.dimensions.y * tableScale * 0.5 + 0.07,
          tableLayout.y ?? Math.floor(index / 5) * 0.72,
        );
        target.rotation.set(-0.035, tableLayout.rotation ?? 0, (index - 1) * -0.018);
        target.scale = tableScale;
      } else if (mode === "detail" || mode === "opening") {
        if (frame.id === selectedId) {
          if (mode === "opening" && transition?.phase === "clear") {
            target.position.copy(frame.openingSlot.position);
            target.rotation.copy(frame.openingSlot.rotation);
            target.scale = frame.openingSlot.scale;
          } else {
            target.position.set(innerWidth < 760 ? 0 : -1.95, innerWidth < 760 ? 0.75 : 0, 1.1);
            target.rotation.set(innerWidth < 760 ? -0.02 : 0.02, innerWidth < 760 ? -0.4 : -0.28, innerWidth < 760 ? 0.06 : 0.04);
            target.scale = innerWidth < 760 ? 1.04 : 1.38;
          }
        } else if (mode === "opening") {
          const origin = frame.openingSlot;
          const elapsed = transition?.elapsed ?? 0;
          const delay = frame.openingDelay ?? 0;
          const local = Math.max(0, elapsed - delay);
          let y = origin.position.y;
          if (local < 0.28) {
            const t = local / 0.28;
            y += 0.38 * (1 - (1 - t) * (1 - t));
          } else {
            const t = Math.min(1, (local - 0.28) / 0.9);
            y += 0.38 + (-4.2 - 0.38) * (-(Math.cos(Math.PI * t) - 1) / 2);
          }
          target.position.set(origin.position.x, y, origin.position.z);
          target.rotation.copy(origin.rotation);
          target.scale = origin.scale;
          target.visible = local < 1.18;
        } else target.visible = false;
      } else if (mode === "closing") {
        const diff = index - focusIndex;
        target.position.set(diff * 2.45, -0.35 - Math.abs(diff) * 0.18, -Math.abs(diff) * 0.62);
        target.rotation.set(-0.04, -diff * 0.22, diff * -0.06);
        target.scale = diff === 0 ? 1.22 : 0.94;
      } else if (mode === "timeline") {
        const diff = index - focusIndex;
        target.visible = Math.abs(diff) <= 3;
        target.position.set(
          diff === 0 ? (innerWidth < 760 ? 0 : -1.3) : diff % 2 ? 1.7 : -2.5,
          -diff * 1.9,
          -Math.abs(diff) * 1.3,
        );
        target.rotation.set(-0.03, diff * -0.22, diff * 0.08);
        target.scale = diff === 0 ? 1.32 : 0.72;
      } else {
        const diff = index - focusIndex;
        target.visible = Math.abs(diff) <= 1;
        if (diff === -1) {
          target.position.set(-2.35, -0.72, -0.12);
          target.rotation.set(-0.08, 0.38, 0.11);
          target.scale = 1.16;
        } else if (diff === 0) {
          target.position.set(0.05, -0.42, 0.62);
          target.rotation.set(-0.05, -0.05, -0.02);
          target.scale = 1.28;
        } else {
          target.position.set(2.35, -0.78, -0.25);
          target.rotation.set(-0.06, -0.38, -0.1);
          target.scale = 1.16;
        }
      }
      frame.framed.visible = true;
      frame.polaroid.visible = false;
      if (frame.stand) frame.stand.visible = true;
      if (frame.blob) frame.blob.visible = mode !== "table";
    });
    if (mode === "table") separateTableTargets();
    table.visible = mode === "table";
    tableEdge.visible = mode === "table";
    wallShadow.visible = mode !== "table";
    if (mode === "table") {
      cameraTarget.set(0, 1.2, 8.6);
      lookTarget.set(0, -0.92, 0);
    } else if (mode === "detail" || mode === "opening") {
      cameraTarget.set(innerWidth < 760 ? 0 : -0.35, 0.18, innerWidth < 760 ? 9.6 : 8.65);
      lookTarget.set(innerWidth < 760 ? 0 : -0.5, innerWidth < 760 ? 0.3 : 0.08, 0);
    } else {
      cameraTarget.set(0, 0.1, 9.6);
      lookTarget.set(0, 0, 0);
    }
  }

  function setMemories(memories, profile) {
    frames.forEach((frame) => {
      disposeTree(frame.root);
      root.remove(frame.root);
    });
    frames = [];
    hitObjects.length = 0;
    memories.forEach((memory) => frames.push(createFrame(memory, profile)));
    focusIndex = THREE.MathUtils.clamp(focusIndex, 0, Math.max(0, frames.length - 1));
    relayout();
    setLightMode(lightMode);
  }

  function setMode(nextMode) {
    if (nextMode === "detail" && mode !== "detail" && mode !== "opening") {
      mode = "opening";
      transition = { type: "opening", elapsed: 0, phase: "clear" };
      const chosen = frames.find((frame) => frame.id === selectedId);
      let exitIndex = 0;
      frames.forEach((frame) => {
        frame.openingSlot = {
          position: frame.target.position.clone(),
          rotation: frame.target.rotation.clone(),
          scale: frame.target.scale,
        };
        frame.openingDelay = frame === chosen ? 0 : exitIndex++ * 0.08;
      });
      leaves.visible = false;
    } else if (
      nextMode !== "detail" &&
      (mode === "detail" || mode === "opening") &&
      selectedId
    ) {
      mode = "closing";
      transition = { type: "closing", elapsed: 0, destination: nextMode };
      const chosen = frames.find((frame) => frame.id === selectedId);
      if (chosen) {
        chosen.forcedOrbitTarget =
          Math.round(chosen.orbitY / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2;
        chosen.orbitVelocity = 3.5;
      }
      frames.forEach((frame, index) => {
        frame.root.visible = true;
        if (frame.id !== selectedId) {
          frame.root.position.y = -5.4 - index * 0.28;
        }
      });
      leaves.visible = false;
    } else {
      mode = nextMode;
    }
    relayout();
  }

  function setSelected(id) {
    if (id === selectedId) return;
    selectedId = id;
    const frame = frames.find((candidate) => candidate.id === id);
    if (frame) {
      frame.orbitY = 0;
      frame.orbitVelocity = 0;
      frame.forcedOrbitTarget = null;
    }
    relayout();
  }

  function setFocus(index) {
    focusIndex = THREE.MathUtils.clamp(index, 0, Math.max(0, frames.length - 1));
    relayout();
  }

  function setLightMode(nextMode) {
    lightMode = nextMode;
    setEnvironment(nextMode);
    if (nextMode === "day") {
      scene.background = null;
      ambient.color.set(0xf2dfbd);
      ambient.groundColor.set(0x241710);
      ambient.intensity = 0.55;
      key.color.set(0xffe6be);
      key.intensity = 1.32;
      fill.color.set(0xc9def0);
      fill.intensity = 0.34;
      rim.color.set(0xf0b87a);
      rim.intensity = 0.42;
    } else {
      scene.background = null;
      ambient.color.set(0x8794c0);
      ambient.groundColor.set(0x07070a);
      ambient.intensity = 0.25;
      key.color.set(0xffae68);
      key.intensity = 1.05;
      fill.color.set(0x536996);
      fill.intensity = 0.2;
      rim.color.set(0xff8b50);
      rim.intensity = 0.72;
    }
    frames.forEach((frame) =>
      frame.glasses.forEach((glass) => {
        glass.opacity = nextMode === "day" ? 0.16 : 0.22;
        glass.roughness = nextMode === "day" ? 0.025 : 0.07;
        glass.color.set(nextMode === "day" ? 0xe8f4ff : 0xffc79c);
        glass.envMapIntensity = nextMode === "day" ? 1.3 : 1.8;
      }),
    );
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    const fit = THREE.MathUtils.clamp(camera.aspect / 1.75, 0.56, 1);
    root.scale.setScalar(fit);
    root.position.y = -(1 - fit) * 0.55;
    relayout();
  }

  function hitAt(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const intersection = raycaster
      .intersectObjects(hitObjects, false)
      .find((hit) => hit.object.visible);
    const frame = intersection?.object?.userData.frame;
    if (frame && intersection) {
      const local = intersection.object.worldToLocal(intersection.point.clone());
      frame.hoverLocal.set(
        THREE.MathUtils.clamp(local.x / Math.max(0.01, frame.dimensions.x * 0.5), -1, 1),
        THREE.MathUtils.clamp(local.y / Math.max(0.01, frame.dimensions.y * 0.5), -1, 1),
      );
    }
    return frame;
  }

  function onPointerDown(event) {
    if (pointer.id !== null) return;
    pointer.id = event.pointerId;
    pointer.downX = pointer.lastX = event.clientX;
    pointer.downY = pointer.lastY = event.clientY;
    pointer.moved = 0;
    pointer.hit = hitAt(event);
    pointer.orbiting = mode === "detail" && pointer.hit?.id === selectedId;
    pointer.tableDragging = mode === "table" && Boolean(pointer.hit);
    if (pointer.tableDragging) {
      const maxLayer = Math.max(0, ...frames.map((frame) => frame.memory.table?.layer ?? 0));
      pointer.hit.memory.table = {
        ...(pointer.hit.memory.table ?? {}),
        layer: maxLayer + 1,
      };
      pointer.hit.tableVelocity.set(0, 0);
    }
    if (pointer.orbiting || pointer.tableDragging) canvas.setPointerCapture(event.pointerId);
    if (pointer.orbiting && pointer.hit) pointer.hit.forcedOrbitTarget = null;
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.hoverX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.hoverY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    if (pointer.id === null) {
      const hovered = hitAt(event);
      const nextHoveredId = hovered?.id ?? null;
      if (nextHoveredId !== hoveredId) {
        hoveredId = nextHoveredId;
        onHoverChange(hoveredId, { x: event.clientX, y: event.clientY });
      } else if (hoveredId) {
        onHoverChange(hoveredId, { x: event.clientX, y: event.clientY });
      }
      canvas.style.cursor =
        mode === "detail" && hoveredId === selectedId
          ? "grab"
          : hoveredId && (mode === "gallery" || mode === "timeline")
            ? "pointer"
            : "default";
      return;
    }
    if (pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    if (pointer.orbiting && pointer.hit) {
      canvas.style.cursor = "grabbing";
      pointer.hit.orbitY += dx * 0.012;
      pointer.hit.orbitVelocity = dx * 0.45;
    } else if (pointer.tableDragging && pointer.hit) {
      const rect = canvas.getBoundingClientRect();
      pointer.hit.target.position.x = THREE.MathUtils.clamp(
        pointer.hit.target.position.x + (dx / rect.width) * 9,
        -4.3,
        4.3,
      );
      pointer.hit.target.position.z = THREE.MathUtils.clamp(
        pointer.hit.target.position.z + (dy / rect.height) * 6,
        -2.6,
        2.6,
      );
      pointer.hit.tableVelocity.set((dx / rect.width) * 145, (dy / rect.height) * 92);
      resolveTableCollisions(pointer.hit);
      pointer.hit.tableDirty = true;
    }
  }

  function emitTableLayout(frame) {
    const layout = {
      x: Number(frame.target.position.x.toFixed(3)),
      y: Number(frame.target.position.z.toFixed(3)),
      rotation: Number(frame.target.rotation.y.toFixed(3)),
      layer: frame.memory.table?.layer ?? 0,
    };
    frame.memory.table = layout;
    frame.tableDirty = false;
    onTableLayoutChange(frame.id, layout);
  }

  function onPointerUp(event) {
    if (pointer.id !== event.pointerId) return;
    const clicked = pointer.moved < 12;
    if (clicked && pointer.hit && (mode === "gallery" || mode === "timeline")) {
      onSelect(pointer.hit.id);
    } else if (clicked && !pointer.hit && mode === "gallery") {
      onBlankClick({ x: event.clientX, y: event.clientY });
    }
    if (pointer.tableDragging && pointer.hit) pointer.hit.tableDirty = true;
    pointer.id = null;
    pointer.hit = null;
    pointer.orbiting = false;
    pointer.tableDragging = false;
    canvas.style.cursor = "default";
  }

  function onPointerLeave() {
    if (pointer.id !== null) return;
    hoveredId = null;
    onHoverChange(null, null);
    canvas.style.cursor = "default";
  }

  function onWheel(event) {
    if (mode !== "gallery" || Math.abs(event.deltaY) < 4) return;
    const next = THREE.MathUtils.clamp(
      focusIndex + (event.deltaY > 0 ? 1 : -1),
      0,
      frames.length - 1,
    );
    if (next !== focusIndex) {
      focusIndex = next;
      relayout();
      onFocusChange(focusIndex);
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  setEnvironment(lightMode);

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    if (transition) {
      transition.elapsed += delta;
      if (
        transition.type === "opening" &&
        transition.phase === "clear" &&
        transition.elapsed > 0.76
      ) {
        transition.phase = "cross";
        const chosen = frames.find((frame) => frame.id === selectedId);
        if (chosen) {
          chosen.orbitY = -Math.PI * 2;
          chosen.forcedOrbitTarget = 0;
          chosen.orbitVelocity = 3;
        }
        leaves.visible = true;
        relayout();
      }
      if (transition.type === "opening" && transition.elapsed > 1.4) {
        const chosen = frames.find((frame) => frame.id === selectedId);
        if (chosen) {
          chosen.orbitY = 0;
          chosen.orbitVelocity = 0;
          chosen.forcedOrbitTarget = null;
        }
        mode = "detail";
        transition = null;
        relayout();
      } else if (transition.type === "closing" && transition.elapsed > 1.22) {
        mode = transition.destination;
        selectedId = null;
        transition = null;
        relayout();
      }
    }

    const selectedFrame = frames.find((frame) => frame.id === selectedId);
    if (leaves.visible && selectedFrame) {
      leaves.position.lerp(selectedFrame.root.position, 1 - Math.exp(-5 * delta));
      leaves.children.forEach((leaf) => {
        const data = leaf.userData;
        leaf.position.x =
          data.origin.x + Math.sin(elapsed * data.speed + data.phase) * 0.18;
        leaf.position.y =
          data.origin.y + Math.sin(elapsed * (data.speed + 0.2) + data.phase) * 0.22;
        leaf.rotation.x += delta * (0.18 + data.speed);
        leaf.rotation.y += delta * (0.25 + data.speed);
      });
    }

    const spatialMode = mode === "gallery" || mode === "timeline";
    root.rotation.y = expLerp(root.rotation.y, spatialMode ? pointer.hoverX * 0.018 : 0, 5, delta);
    root.rotation.x = expLerp(root.rotation.x, spatialMode ? -pointer.hoverY * 0.012 : 0, 5, delta);
    frames.forEach((frame, index) => {
      const target = frame.target;
      frame.root.visible = target.visible;
      if (!target.visible) return;
      if (mode === "table" && !pointer.tableDragging && frame.tableVelocity.lengthSq() > 0.0005) {
        frame.target.position.x += frame.tableVelocity.x * delta;
        frame.target.position.z += frame.tableVelocity.y * delta;
        if (Math.abs(frame.target.position.x) > 4.3) {
          frame.target.position.x = THREE.MathUtils.clamp(frame.target.position.x, -4.3, 4.3);
          frame.tableVelocity.x *= -0.45;
        }
        if (Math.abs(frame.target.position.z) > 2.6) {
          frame.target.position.z = THREE.MathUtils.clamp(frame.target.position.z, -2.6, 2.6);
          frame.tableVelocity.y *= -0.45;
        }
        frame.target.rotation.y += frame.tableVelocity.x * delta * 0.018;
        resolveTableCollisions(frame, true);
        frame.tableVelocity.multiplyScalar(Math.exp(-3.4 * delta));
        frame.tableDirty = true;
      } else if (
        mode === "table" &&
        frame.tableDirty &&
        !pointer.tableDragging &&
        frame.tableVelocity.lengthSq() <= 0.0005
      ) {
        emitTableLayout(frame);
      }
      const hoverActive =
        frame.id === hoveredId && (mode === "gallery" || mode === "timeline");
      const hoverDepth =
        mode === "gallery" && index !== focusIndex ? 0.035 : mode === "gallery" ? 0.12 : 0.08;
      frame.root.position.x = expLerp(frame.root.position.x, target.position.x, 8, delta);
      frame.root.position.y = expLerp(
        frame.root.position.y,
        target.position.y + (hoverActive ? 0.12 : 0),
        8,
        delta,
      );
      frame.root.position.z = expLerp(
        frame.root.position.z,
        target.position.z + (hoverActive ? hoverDepth : 0),
        8,
        delta,
      );
      frame.root.scale.setScalar(
        expLerp(frame.root.scale.x, target.scale * (hoverActive ? 1.02 : 1), 8, delta),
      );
      frame.root.rotation.x = expLerp(
        frame.root.rotation.x,
        target.rotation.x + (hoverActive ? -frame.hoverLocal.y * 0.1 : 0),
        8,
        delta,
      );
      frame.root.rotation.z = expLerp(frame.root.rotation.z, target.rotation.z, 8, delta);
      const orbitActive =
        frame.id === selectedId &&
        (mode === "detail" || mode === "opening" || mode === "closing");
      if (orbitActive) {
        if (frame.forcedOrbitTarget != null) {
          const acceleration =
            18 * (frame.forcedOrbitTarget - frame.orbitY) - 7 * frame.orbitVelocity;
          frame.orbitVelocity += acceleration * delta;
          frame.orbitY += frame.orbitVelocity * delta;
          if (
            Math.abs(frame.forcedOrbitTarget - frame.orbitY) < 0.003 &&
            Math.abs(frame.orbitVelocity) < 0.02
          ) {
            frame.orbitY = frame.forcedOrbitTarget;
            frame.orbitVelocity = 0;
            frame.forcedOrbitTarget = null;
          }
        } else if (!pointer.orbiting) {
          frame.orbitVelocity *= Math.exp(-2.2 * delta);
          frame.orbitY += frame.orbitVelocity * delta;
          if (Math.abs(frame.orbitVelocity) < 0.18) {
            const snap = Math.round(frame.orbitY / Math.PI) * Math.PI;
            frame.orbitY += shortestAngle(snap, frame.orbitY) * (1 - Math.exp(-7 * delta));
          }
        }
        frame.root.rotation.y = target.rotation.y + frame.orbitY;
      } else {
        const targetY = target.rotation.y + (hoverActive ? frame.hoverLocal.x * 0.15 : 0);
        frame.root.rotation.y += shortestAngle(targetY, frame.root.rotation.y) *
          (1 - Math.exp(-8 * delta));
      }
      if (mode === "gallery" && index === focusIndex) {
        frame.root.position.y += Math.sin(elapsed * 0.8) * 0.025;
      }
    });
    camera.position.lerp(cameraTarget, 1 - Math.exp(-5.5 * delta));
    lookCurrent.lerp(lookTarget, 1 - Math.exp(-5.5 * delta));
    camera.lookAt(lookCurrent);
    renderer.render(scene, camera);
  }
  animate();

  function dispose() {
    disposed = true;
    resizeObserver?.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    frames.forEach((frame) => disposeTree(frame.root));
    table.geometry.dispose();
    tableMaterial.dispose();
    tableEdge.geometry.dispose();
    tableEdge.material.dispose();
    wallShadow.geometry.dispose();
    wallShadow.material.dispose();
    woodGrainTexture.dispose();
    frameWoodTexture.dispose();
    environmentTexture?.dispose();
    softShadowTexture.dispose();
    pmrem?.dispose();
    renderer.dispose();
  }

  return {
    setMemories,
    setMode,
    setSelected,
    setFocus,
    setLightMode,
    dispose,
  };
}
