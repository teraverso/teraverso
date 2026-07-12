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

/* ==========================================================
   TRANSIÇÃO ENTRE PANORAMAS (CROSSFADE)
   ==========================================================
   Estratégia: duas esferas concêntricas.
   - sphereOuter (raio 500): mostra o panorama ATUAL, sempre em opacidade 1.
   - sphereInner (raio 498, ligeiramente menor/mais perto da câmera):
     recebe o PRÓXIMO panorama e tem sua opacidade animada de 0 a 1.

   Como a câmera fica no centro, o raio de visão sempre encontra
   primeiro a esfera interna (mais próxima). Quando ela está com
   opacity 0, é "invisível" e a esfera externa aparece por trás.
   Conforme a opacity da esfera interna sobe até 1, ela vai
   cobrindo gradualmente a externa — esse é o efeito de crossfade.

   Ao final da transição, "gravamos" a nova textura também na
   esfera externa e resetamos a interna para opacity 0, deixando
   tudo pronto para a próxima troca.
   ========================================================== */

const geometryOuter = new THREE.SphereGeometry(500, 60, 40);
geometryOuter.scale(-1, 1, 1); // inverte para a textura aparecer na face interna

const geometryInner = new THREE.SphereGeometry(498, 60, 40);
geometryInner.scale(-1, 1, 1);

const materialOuter = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false, // evita que a transparência "esconda" o que está atrás por engano
  opacity: 1
});

const materialInner = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false,
  opacity: 0
});

const sphereOuter = new THREE.Mesh(geometryOuter, materialOuter);
sphereOuter.renderOrder = 0; // desenhada primeiro (fundo da transição)

const sphereInner = new THREE.Mesh(geometryInner, materialInner);
sphereInner.renderOrder = 1; // desenhada por cima (frente da transição)

scene.add(sphereOuter);
scene.add(sphereInner);

// Cache de texturas já carregadas, para não baixar a mesma imagem
// de novo toda vez que o usuário clicar no mesmo card outra vez.
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map();

function loadTexture(url) {
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url));
  }

  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (error) => reject(error)
    );
  });
}

const DEFAULT_PANORAMA_URL = './textures/panorama.jpg';
const TRANSITION_DURATION_MS = 1200;

let currentPanoramaUrl = null;
let isTransitioning = false;

// Suaviza o início e o fim da transição (easeInOutQuad), em vez de
// uma opacidade linear que pareceria mais "mecânica".
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function switchPanorama(url) {
  if (isTransitioning || url === currentPanoramaUrl) return;
  isTransitioning = true;

  loadTexture(url)
    .then((newTexture) => {
      materialInner.map = newTexture;
      materialInner.opacity = 0;
      materialInner.needsUpdate = true;

      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION_MS, 1);

        materialInner.opacity = easeInOutQuad(progress);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Transição concluída: "grava" a nova textura na esfera
          // externa e reseta a interna, deixando pronta para a próxima troca.
          materialOuter.map = newTexture;
          materialOuter.needsUpdate = true;
          materialInner.opacity = 0;

          currentPanoramaUrl = url;
          isTransitioning = false;
        }
      }

      requestAnimationFrame(step);
    })
    .catch((error) => {
      console.error(`Erro ao carregar o panorama "${url}":`, error);
      isTransitioning = false;
    });
}

// Carrega o panorama inicial (primeiro card / padrão de abertura do site).
loadTexture(DEFAULT_PANORAMA_URL).then((texture) => {
  materialOuter.map = texture;
  materialOuter.needsUpdate = true;
  materialInner.map = texture;
  materialInner.needsUpdate = true;
  currentPanoramaUrl = DEFAULT_PANORAMA_URL;
});

/* ==========================================================
   CLIQUE NOS CARDS DO PORTFÓLIO → TROCA DE PANORAMA
   ========================================================== */
const portfolioCards = document.querySelectorAll('.portfolio-card');

portfolioCards.forEach((card) => {
  card.addEventListener('click', () => {
    const url = card.dataset.panorama;
    if (!url) return;

    switchPanorama(url);

    portfolioCards.forEach((item) => item.classList.remove('active'));
    card.classList.add('active');
  });
});

/* ==========================================================
   ROTAÇÃO DA CÂMERA (lon/lat, iguais para ambas as esferas)
   ========================================================== */
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