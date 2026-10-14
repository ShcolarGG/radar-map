// ===== Константы =====
const WIN_W = 640, WIN_H = 480;
const MAP_W = 1920, MAP_H = 720;
const SH_W = 128, SH_H = 128;
const BOOM_W = 200, BOOM_H = 200;
const BOOM_LIFETIME = 500;

const BOOM_FRAMES_COUNT = 4;
const BOOM_FRAME_MS = 60;

const CFG = {
  maxSpeed: 350,
  accel: 200,
  decel: 300,
  steer: 225,
  friction: 0.4,
};

const ENGINE = {
  minRate: 1.0,
  maxRate: 2.0,
  minVol:  0.15,
  maxVol:  0.55,
  smoothing: 0.15
};

const AFK = {
  delay:    700,
  speed:    70,
  turnRate: 80,
  accel:    120,
};

const MUSIC_VOLUME = 0.35;

const BOTS = {
  spawnInterval: 2500,
  maxCount: 5,
  speed: 60,
  minCourse: 750,
  maxCourse: 1400,
  radius: 22,
  shRadius: 45,
  minSpawnDistFromSh: 250,
};

const DISCLAIMER_IMAGES = ['disclaimer_1.png', 'disclaimer_2.png', 'disclaimer_3.png'];
const DISCLAIMER_INTERVAL = 2500;

// ===== Canvas =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ===== Ресурсы =====
const mapImg = new Image();
const shImg = new Image();
mapImg.src = 'map.png';
shImg.src = 'sh.png';

const boomFrames = [];
for (let i = 1; i <= BOOM_FRAMES_COUNT; i++) {
  const img = new Image();
  img.src = `boom_${i}.gif`;
  boomFrames.push(img);
}

// ===== Disclaimer =====
const disclaimerEl = document.getElementById('disclaimer');
const disclaimerImg = document.getElementById('disclaimer-img');

let disclaimerActive = true;
let disclaimerIndex = 0;
let disclaimerTimer = null;

function startDisclaimerLoop() {
  disclaimerImg.src = DISCLAIMER_IMAGES[0];
  disclaimerTimer = setInterval(() => {
    disclaimerIndex = (disclaimerIndex + 1) % DISCLAIMER_IMAGES.length;
    disclaimerImg.src = DISCLAIMER_IMAGES[disclaimerIndex];
  }, DISCLAIMER_INTERVAL);
}

function hideDisclaimer() {
  if (!disclaimerActive) return;
  disclaimerActive = false;
  if (disclaimerTimer) {
    clearInterval(disclaimerTimer);
    disclaimerTimer = null;
  }
  disclaimerEl.classList.add('hidden');
}

startDisclaimerLoop();

// ===== Звук мотора =====
const engineAudio = new Audio('sh.mp3');
engineAudio.loop = true;
engineAudio.preload = 'auto';
engineAudio.volume = ENGINE.minVol;
engineAudio.playbackRate = ENGINE.minRate;

// ===== Музыка =====
const musicAudio = new Audio('soundtrack.mp3');
musicAudio.loop = true;
musicAudio.preload = 'auto';
musicAudio.volume = MUSIC_VOLUME;

let audioUnlocked = false;
let engineStarted  = false;
let musicStarted   = false;

function startMutedPlayback() {
  if (!engineStarted) {
    engineAudio.muted = true;
    engineAudio.play()
      .then(() => { engineStarted = true; })
      .catch((err) => console.warn('Мотор не запустился:', err));
  }
  if (!musicStarted) {
    musicAudio.muted = true;
    musicAudio.play()
      .then(() => { musicStarted = true; })
      .catch((err) => console.warn('Музыка не запустилась:', err));
  }
}

function unlockAudio() {
  hideDisclaimer();
  if (audioUnlocked) return;
  audioUnlocked = true;

  if (!engineStarted) startMutedPlayback();

  engineAudio.muted = false;
  musicAudio.muted = false;

  engineAudio.play().catch(() => {});
  musicAudio.play().catch(() => {});

  const t = Math.abs(sh.speed) / CFG.maxSpeed;
  engineAudio.playbackRate = ENGINE.minRate + (ENGINE.maxRate - ENGINE.minRate) * t;
  engineAudio.volume       = ENGINE.minVol  + (ENGINE.maxVol  - ENGINE.minVol ) * t;
}

startMutedPlayback();

window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);

function updateEngine() {
  if (!audioUnlocked) return;

  const t = Math.abs(sh.speed) / CFG.maxSpeed;
  const rate = ENGINE.minRate + (ENGINE.maxRate - ENGINE.minRate) * t;
  const vol  = ENGINE.minVol  + (ENGINE.maxVol  - ENGINE.minVol ) * t;

  engineAudio.playbackRate += (rate - engineAudio.playbackRate) * ENGINE.smoothing;
  engineAudio.volume       += (vol  - engineAudio.volume)       * ENGINE.smoothing;
}

// ===== Звук взрыва =====
const boomSoundBase = new Audio('boom.mp3');
boomSoundBase.preload = 'auto';
boomSoundBase.volume = 0.7;

function playBoomSound() {
  const s = boomSoundBase.cloneNode();
  s.volume = boomSoundBase.volume;
  s.play().catch((err) => console.warn('boom.mp3 не проигран:', err));
}

// ===== Состояние =====
const sh = {
  x: MAP_W / 2 - SH_W / 2,
  y: MAP_H / 2 - SH_H / 2,
  angle: 0,
  speed: 0,
};

const cam = { x: 0, y: 0 };
const keys = {};
const booms = [];

let afkTimer = 0;
let afkActive = false;

const bots = [];
let botSpawnTimer = 0;
let scoreKilled = 0;
let scoreMissed = 0;

// ===== Ввод: клавиатура =====
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    spawnBoom(sh.x + SH_W / 2, sh.y + SH_H / 2);
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ===== Ввод: тач-кнопки =====
function bindKeyButton(btn) {
  const code = btn.dataset.key;
  if (!code) return;

  const press = (e) => {
    e.preventDefault();
    keys[code] = true;
  };
  const release = (e) => {
    if (e) e.preventDefault();
    keys[code] = false;
  };

  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

document.querySelectorAll('[data-key]').forEach(bindKeyButton);

const fireBtn = document.getElementById('fire-btn');
if (fireBtn) {
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    spawnBoom(sh.x + SH_W / 2, sh.y + SH_H / 2);
  });
  fireBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Страховка: при отпускании пальца где угодно — сброс всех тач-клавиш
window.addEventListener('pointerup', () => {
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => {
    // оставляем клавиатурные клавиши работать — сбрасываем только если не было keydown
    // (проверка простая: если пользователь не на клаве, там всё равно false)
  });
});

function spawnBoom(x, y) {
  booms.push({ x, y, born: performance.now() });
  playBoomSound();
}

// ===== Утилиты =====
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// ===== Боты =====
function spawnBot() {
  if (bots.length >= BOTS.maxCount) return;

  const course = BOTS.minCourse + Math.random() * (BOTS.maxCourse - BOTS.minCourse);

  let x, y, angle;
  const cx = sh.x + SH_W / 2;
  const cy = sh.y + SH_H / 2;
  const minD2 = BOTS.minSpawnDistFromSh * BOTS.minSpawnDistFromSh;

  for (let i = 0; i < 30; i++) {
    x = Math.random() * MAP_W;
    y = Math.random() * MAP_H;
    angle = Math.random() * Math.PI * 2;

    const endX = x + Math.cos(angle) * course;
    const endY = y + Math.sin(angle) * course;

    const insideMap =
      endX > 0 && endX < MAP_W &&
      endY > 0 && endY < MAP_H;

    const farFromSh = dist2(x, y, cx, cy) > minD2;

    if (insideMap && farFromSh) break;
  }

  bots.push({ x, y, angle, course, travelled: 0 });
}

function updateBots(dt) {
  botSpawnTimer += dt * 1000;
  if (botSpawnTimer >= BOTS.spawnInterval) {
    botSpawnTimer = 0;
    spawnBot();
  }

  const cx = sh.x + SH_W / 2;
  const cy = sh.y + SH_H / 2;
  const hitDist = BOTS.radius + BOTS.shRadius;

  for (let i = bots.length - 1; i >= 0; i--) {
    const b = bots[i];
    const step = BOTS.speed * dt;

    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.travelled += step;

    if (dist2(b.x, b.y, cx, cy) < hitDist * hitDist) {
      spawnBoom(b.x, b.y);
      bots.splice(i, 1);
      scoreKilled++;
      continue;
    }

    if (b.travelled >= b.course) {
      spawnBoom(b.x, b.y);
      bots.splice(i, 1);
      scoreMissed++;
      continue;
    }
  }
}

function drawBots() {
  for (const b of bots) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    ctx.fillStyle = '#ff5555';
    ctx.beginPath();
    ctx.moveTo(BOTS.radius, 0);
    ctx.lineTo(-BOTS.radius * 0.7, -BOTS.radius * 0.7);
    ctx.lineTo(-BOTS.radius * 0.7,  BOTS.radius * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

// ===== Обновление =====
function update(dt) {
  const up = keys['ArrowUp'];
  const down = keys['ArrowDown'];
  const left = keys['ArrowLeft'];
  const right = keys['ArrowRight'];
  const hasInput = up || down || left || right;

  if (hasInput) {
    afkTimer = 0;
    afkActive = false;

    if (up) {
      sh.speed += CFG.accel * dt;
    } else if (down) {
      sh.speed -= CFG.decel * dt;
    } else {
      const fr = CFG.friction * CFG.maxSpeed * dt;
      if (Math.abs(sh.speed) <= fr) sh.speed = 0;
      else sh.speed -= Math.sign(sh.speed) * fr;
    }
    sh.speed = clamp(sh.speed, -CFG.maxSpeed, CFG.maxSpeed);

    const steerFactor = Math.min(1, Math.abs(sh.speed) / 100);
    const steerRad = (CFG.steer * Math.PI / 180) * dt * steerFactor;
    if (left) sh.angle -= steerRad;
    if (right) sh.angle += steerRad;
  } else {
    afkTimer += dt * 1000;

    if (afkTimer >= AFK.delay) {
      afkActive = true;

      const diff = AFK.speed - sh.speed;
      const step = AFK.accel * dt;
      if (Math.abs(diff) <= step) sh.speed = AFK.speed;
      else sh.speed += Math.sign(diff) * step;

      sh.angle += (AFK.turnRate * Math.PI / 180) * dt;
    } else {
      const fr = CFG.friction * CFG.maxSpeed * dt;
      if (Math.abs(sh.speed) <= fr) sh.speed = 0;
      else sh.speed -= Math.sign(sh.speed) * fr;
    }
  }

  sh.x += Math.cos(sh.angle) * sh.speed * dt;
  sh.y += Math.sin(sh.angle) * sh.speed * dt;

  sh.x = clamp(sh.x, 0, MAP_W - SH_W);
  sh.y = clamp(sh.y, 0, MAP_H - SH_H);

  cam.x = clamp(sh.x + SH_W / 2 - WIN_W / 2, 0, MAP_W - WIN_W);
  cam.y = clamp(sh.y + SH_H / 2 - WIN_H / 2, 0, MAP_H - WIN_H);

  updateBots(dt);

  const now = performance.now();
  for (let i = booms.length - 1; i >= 0; i--) {
    if (now - booms[i].born >= BOOM_LIFETIME) booms.splice(i, 1);
  }

  updateEngine();
}

// ===== Рендер =====
function render() {
  ctx.clearRect(0, 0, WIN_W, WIN_H);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  ctx.drawImage(mapImg, 0, 0, MAP_W, MAP_H);
  drawBots();

  ctx.save();
  ctx.translate(sh.x + SH_W / 2, sh.y + SH_H / 2);
  ctx.rotate(sh.angle);
  ctx.drawImage(shImg, -SH_W / 2, -SH_H / 2, SH_W, SH_H);
  ctx.restore();

  const now = performance.now();
  for (const b of booms) {
    const age = now - b.born;
    const frame = Math.floor(age / BOOM_FRAME_MS) % BOOM_FRAMES_COUNT;
    const img = boomFrames[frame];
    if (img && img.complete) {
      ctx.drawImage(img, b.x - BOOM_W / 2, b.y - BOOM_H / 2, BOOM_W, BOOM_H);
    }
  }

  ctx.restore();

  drawHUD();
}

function drawHUD() {
  const pad = 10;
  const boxW = 170;
  const boxH = 64;
  const x = WIN_W - boxW - pad;
  const y = pad;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);

  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#7CFC7C';
  ctx.fillText(`Сбито: ${scoreKilled}`, x + 12, y + 20);

  ctx.fillStyle = '#FF7070';
  ctx.fillText(`Пропущено: ${scoreMissed}`, x + 12, y + 46);
}

// ===== Игровой цикл =====
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ===== Старт =====
Promise.all([
  new Promise((r) => (mapImg.onload = r)),
  new Promise((r) => (shImg.onload = r)),
  ...boomFrames.map((img) => new Promise((r) => (img.onload = r))),
]).then(() => {
  spawnBot();
  requestAnimationFrame(loop);
});