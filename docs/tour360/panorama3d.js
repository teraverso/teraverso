import * as THREE from 'three';

const container = document.getElementById('panorama-container');
const gyroButton = document.getElementById('gyro-permission-btn');

const MOBILE_BREAKPOINT = 768;
const isMobileViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070a, 1);
container.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(500, 60, 40);
geometry.scale(-1, 1, 1);

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const panoramaTexture = textureLoader.load(
  './textures/panorama.jpg',
  () => {
    console.log('Textura panorâmica carregada com sucesso.');
  },
  undefined,
  (error) => {
    console.error('Falha ao carregar a textura panorâmica. Verifique se o arquivo existe em ./textures/panorama.jpg', error);
  }
);
panoramaTexture.colorSpace = THREE.SRGBColorSpace;

const material = new THREE.MeshBasicMaterial({
  map: panoramaTexture
});

const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

let lon = 0;
let lat = 0;
let targetLon = 0;
let targetLat = 0;

const dampingFactor = 0.08;
const latLimit = 85;

/* ==========================================================
   MODO DESKTOP/TABLET: arraste com mouse ou toque
   ========================================================== */
function setupDragControls() {
  let isDragging = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let lonStart = 0;
  let latStart = 0;
  const dragSensitivity = 0.15;

  function onPointerDown(event) {
    isDragging = true;
    pointerStartX = event.clientX ?? event.touches[0].clientX;
    pointerStartY = event.clientY ?? event.touches[0].clientY;
    lonStart = targetLon;
    latStart = targetLat;
  }

  function onPointerMove(event) {
    if (!isDragging) return;

    const clientX = event.clientX ?? event.touches[0].clientX;
    const clientY = event.clientY ?? event.touches[0].clientY;

    const deltaX = clientX - pointerStartX;
    const deltaY = clientY - pointerStartY;

    targetLon = lonStart - deltaX * dragSensitivity;
    targetLat = latStart + deltaY * dragSensitivity;

    targetLat = Math.max(-latLimit, Math.min(latLimit, targetLat));
  }

  function onPointerUp() {
    isDragging = false;
  }

  container.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  container.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);
}

/* ==========================================================
   MODO MOBILE: giroscópio (deviceorientation)
   O toque na tela fica livre para rolar a página normalmente.
   ========================================================== */
function normalizeAngleDelta(delta) {
  return ((delta + 180) % 360 + 360) % 360 - 180;
}

function setupGyroControls() {
  let previousAlpha = null;
  let accumulatedLon = 0;

  function handleOrientation(event) {
    if (event.alpha === null || event.beta === null) return;

    if (previousAlpha === null) {
      previousAlpha = event.alpha;
    }

    const frameDelta = normalizeAngleDelta(event.alpha - previousAlpha);
    accumulatedLon -= frameDelta;
    previousAlpha = event.alpha;

    targetLon = accumulatedLon;
    targetLat = Math.max(-latLimit, Math.min(latLimit, event.beta - 90));
  }

  window.addEventListener('deviceorientation', handleOrientation);
}

function needsIOSPermission() {
  return typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';
}

function initMobileControls() {
  if (typeof DeviceOrientationEvent === 'undefined') {
    setupDragControls();
    return;
  }

  if (needsIOSPermission()) {
    if (gyroButton) {
      gyroButton.style.display = 'inline-flex';
      gyroButton.addEventListener('click', () => {
        DeviceOrientationEvent.requestPermission()
          .then((permissionState) => {
            if (permissionState === 'granted') {
              setupGyroControls();
              gyroButton.style.display = 'none';
            } else {
              console.warn('Permissão de giroscópio negada. Ativando controle por toque como alternativa.');
              setupDragControls();
              gyroButton.style.display = 'none';
            }
          })
          .catch((error) => {
            console.error('Erro ao solicitar permissão de giroscópio:', error);
            setupDragControls();
            gyroButton.style.display = 'none';
          });
      });
    }
  } else {
    setupGyroControls();
  }
}

if (isMobileViewport) {
  initMobileControls();
} else {
  setupDragControls();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

function animate() {
  requestAnimationFrame(animate);

  lon += (targetLon - lon) * dampingFactor;
  lat += (targetLat - lat) * dampingFactor;

  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);

  const target = new THREE.Vector3();
  target.x = 500 * Math.sin(phi) * Math.cos(theta);
  target.y = 500 * Math.cos(phi);
  target.z = 500 * Math.sin(phi) * Math.sin(theta);

  camera.lookAt(target);

  renderer.render(scene, camera);
}

animate();