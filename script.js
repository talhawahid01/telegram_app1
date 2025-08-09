// Telegram WebApp init
let tg = window.Telegram?.WebApp;

// Camera state
let video = null;
let canvas = null;
let context = null;
let cachedStream = null;
let cameraPermissionGranted = false;
let currentFacingMode = 'user';

// Device switching helpers
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
let videoDevices = [];
let deviceIndex = 0;

// IndexedDB (kept only for local cache, not device gallery)
let db;
const dbRequest = indexedDB.open('MiniAppPhotos', 1);
dbRequest.onupgradeneeded = (event) => {
  event.target.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
};
dbRequest.onsuccess = () => { db = dbRequest.result; };
dbRequest.onerror = () => { console.error('Storage setup failed'); };

// DOM refs
let startCameraBtn, capturePhotoBtn, stopCameraBtn, capturedPhoto, cameraStatus, telegramStatus, switchBtn, saveBtn;

document.addEventListener('DOMContentLoaded', () => {
  startCameraBtn   = document.getElementById('startCamera');
  capturePhotoBtn  = document.getElementById('capturePhoto');
  stopCameraBtn    = document.getElementById('stopCamera');
  capturedPhoto    = document.getElementById('capturedPhoto');
  cameraStatus     = document.getElementById('cameraStatus');
  telegramStatus   = document.getElementById('telegramStatus');
  switchBtn        = document.getElementById('switchCameraBtn');
  saveBtn          = document.getElementById('savePhotoBtn');

  initializeTelegramWebApp();
  initializeCamera();
  setupEventListeners();
});

function initializeTelegramWebApp() {
  if (tg) {
    tg.ready();
    tg.expand();

    if (tg.themeParams && tg.themeParams.bg_color) {
      tg.setHeaderColor(tg.themeParams.bg_color);
    }

    telegramStatus.textContent = 'Connected ✅';

    tg.MainButton.setText('Share Photo');
    tg.MainButton.onClick(sharePhoto);
    tg.MainButton.hide();

    console.log('Telegram WebApp initialized');
  } else {
    telegramStatus.textContent = 'Not in Telegram ❌';
  }
}

function initializeCamera() {
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  context = canvas.getContext('2d');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = 'Camera not supported ❌';
    startCameraBtn.disabled = true;
    return;
  }

  cameraStatus.textContent = 'Ready to start 📷';
  checkInitialCameraAccess().catch(() => {
    cameraStatus.textContent = 'Permission check unavailable ⚠️';
  });
}

async function checkInitialCameraAccess() {
  if (!navigator.permissions) return;
  try {
    const permission = await navigator.permissions.query({ name: 'camera' });
    if (permission.state === 'granted') {
      cameraPermissionGranted = true;
      cameraStatus.textContent = 'Camera access granted 🟢';
      startCameraBtn.textContent = 'Start Camera (Permission Granted)';
    } else if (permission.state === 'denied') {
      cameraStatus.textContent = 'Camera access denied ❌';
      startCameraBtn.textContent = 'Camera Denied - Check Settings';
    } else {
      cameraStatus.textContent = 'Camera permission prompt required';
    }
  } catch (err) {
    console.log('Permission query not supported:', err);
  }
}

function setupEventListeners() {
  startCameraBtn.addEventListener('click', startCamera);
  capturePhotoBtn.addEventListener('click', capturePhoto);
  stopCameraBtn.addEventListener('click', stopCamera);
  switchBtn.addEventListener('click', switchCamera);
  saveBtn.addEventListener('click', savePhoto);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && cachedStream && cachedStream.active) {
      stopCamera();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (tg && tg.MainButton) tg.MainButton.offClick();
    stopCamera();
  });
}

async function initVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
  } catch (e) {
    console.warn('enumerateDevices failed:', e);
    videoDevices = [];
  }
}

async function startCamera() {
  try {
    if (cachedStream && cachedStream.active) {
      video.srcObject = cachedStream;
      setupVideoSuccess();
      return;
    }

    cameraStatus.textContent = 'Requesting camera access... ⏳';
    const constraints = isIOS
      ? { video: { facingMode: currentFacingMode }, audio: false }
      : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode }, audio: false };

    cachedStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cachedStream;
    cameraPermissionGranted = true;

    await initVideoDevices();
    setupVideoSuccess();
  } catch (error) {
    handleCameraError(error);
  }
}

function setupVideoSuccess() {
  video.onloadedmetadata = function () {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    cameraStatus.textContent = 'Camera active 🟢';

    startCameraBtn.disabled = true;
    capturePhotoBtn.disabled = false;
    stopCameraBtn.disabled = false;

    switchBtn.style.display = 'inline-block';
    switchBtn.disabled = false;
  };
}

function handleCameraError(error) {
  cameraStatus.textContent = 'Camera error ❌';
  alert('Error: ' + (error?.message || String(error)));
}

function capturePhoto() {
  if (!video || !canvas || !context) {
    alert('Camera not initialized');
    return;
  }
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    capturedPhoto.src = imageDataUrl;
    capturedPhoto.style.display = 'block';

    saveBtn.disabled = false;
    saveBtn.style.display = 'inline-block';

    if (tg) tg.MainButton.show();

    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
  } catch (error) {
    console.error('Error capturing photo:', error);
    alert('Error capturing photo: ' + error.message);
  }
}

// Compress canvas to fit sendData limit (~4096 chars). Also shrink dimensions for reliability.
function dataUrlForSendData(maxChars = 3800) {
  // Downscale to fixed width (e.g., 320px) keeping aspect ratio
  const targetW = 320;
  const scale = targetW / canvas.width;
  const targetH = Math.round(canvas.height * scale);

  const tmp = document.createElement('canvas');
  tmp.width = targetW;
  tmp.height = targetH;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, targetW, targetH);

  let q = 0.5;
  let best = tmp.toDataURL('image/jpeg', q);
  for (let i = 0; i < 5; i++) {
    if (best.length <= maxChars) break;
    q = Math.max(0.2, q - 0.1);
    best = tmp.toDataURL('image/jpeg', q);
  }
  return best;
}

function sharePhoto() {
  if (!tg || !capturedPhoto.src) {
    showMessage('Capture a photo first', 'error');
    return;
  }

  // Must be launched via keyboard-based Mini App; otherwise sendData is not available.
  try {
    const dataUrl = dataUrlForSendData(3800);
    if (dataUrl.length > 4000) {
      showMessage('Photo too large for sendData; image will be low-res. Try again after retake.', 'error');
      return;
    }
    tg.sendData(JSON.stringify({ type: 'photo_dataurl', dataUrl }));
    showMessage('Photo sent to bot. Check chat to forward/save.', 'success');
  } catch (err) {
    showMessage('Share failed: ' + err.message, 'error');
  }
}

async function switchCamera() {
  if (!cachedStream || !cachedStream.active) {
    showMessage('Camera not active', 'error');
    return;
  }

  startCameraBtn.disabled = true;
  capturePhotoBtn.disabled = true;
  stopCameraBtn.disabled = true;
  switchBtn.disabled = true;

  try {
    // Stop current stream
    cachedStream.getTracks().forEach(t => t.stop());
    cachedStream = null;
    video.srcObject = null;

    if (isIOS) {
      // Toggle facing mode
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      await startCamera();
    } else {
      // Prefer deviceId cycle if multiple cameras; fallback to facingMode
      if (videoDevices.length > 1) {
        deviceIndex = (deviceIndex + 1) % videoDevices.length;
        const deviceId = videoDevices[deviceIndex].deviceId;
        cachedStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
        video.srcObject = cachedStream;
        setupVideoSuccess();
      } else {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        await startCamera();
      }
    }
  } catch (error) {
    showMessage('Camera switch failed: ' + (error?.message || String(error)), 'error');
  } finally {
    startCameraBtn.disabled = true;
    capturePhotoBtn.disabled = false;
    stopCameraBtn.disabled = false;
    switchBtn.disabled = false;
  }
}

function stopCamera() {
  if (cachedStream) {
    cachedStream.getTracks().forEach(track => track.stop());
    cachedStream = null;
  }
  if (video) video.srcObject = null;

  cameraStatus.textContent = 'Camera stopped 🔴';
  startCameraBtn.disabled = false;
  capturePhotoBtn.disabled = true;
  stopCameraBtn.disabled = true;
  switchBtn.style.display = 'none';
}

function savePhoto() {
  if (!capturedPhoto.src) {
    showMessage('No photo to save', 'error');
    return;
  }
  // No public server: instruct user to save from bot message
  showMessage('Saving from webview is blocked. We will send the photo in chat; save it from there.', 'info');

  // Optional: store locally (browser storage, not device gallery)
  if (!db) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    try {
      const tx = db.transaction(['photos'], 'readwrite');
      const store = tx.objectStore('photos');
      store.add({ blob, ts: Date.now() });
    } catch {}
  }, 'image/jpeg', 0.9);
}

function showMessage(message, type = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
  if (tg && tg.showAlert) {
    tg.showAlert(message);
    return;
  }
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
    color: white; padding: 10px 20px; border-radius: 8px; z-index: 1000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
  }, 2500);
}
