// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;

// Camera variables
let video = null;
let canvas = null;
let context = null;

// Permission state tracking
let cachedStream = null;
let cameraPermissionGranted = false;
let userDeniedPermission = false;
let currentFacingMode = 'user'; // Track facing mode

// IndexedDB for browser-local photo storage (not device gallery)
let db;
const dbRequest = indexedDB.open('MiniAppPhotos', 1);
dbRequest.onupgradeneeded = (event) => {
  event.target.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
};
dbRequest.onsuccess = () => { db = dbRequest.result; };
dbRequest.onerror = () => { console.error('Storage setup failed'); }; // avoid calling showMessage before it exists

// DOM elements (resolved after DOMContentLoaded, but safe to reference by id after load)
let startCameraBtn, capturePhotoBtn, stopCameraBtn, capturedPhoto, cameraStatus, telegramStatus;

document.addEventListener('DOMContentLoaded', function () {
  // Resolve elements
  startCameraBtn = document.getElementById('startCamera');
  capturePhotoBtn = document.getElementById('capturePhoto');
  stopCameraBtn = document.getElementById('stopCamera');
  capturedPhoto = document.getElementById('capturedPhoto');
  cameraStatus = document.getElementById('cameraStatus');
  telegramStatus = document.getElementById('telegramStatus');

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

    // Configure MainButton but hide until a photo exists
    tg.MainButton.setText('Share Photo');
    tg.MainButton.onClick(sharePhoto);
    tg.MainButton.hide();

    console.log('Telegram WebApp initialized');
    console.log('User:', tg.initDataUnsafe?.user);
    console.log('Theme:', tg.themeParams);
  } else {
    telegramStatus.textContent = 'Not in Telegram ❌';
    console.log('Not running in Telegram WebApp');
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
      userDeniedPermission = true;
      cameraStatus.textContent = 'Camera access denied ❌';
      startCameraBtn.textContent = 'Camera Denied - Check Settings';
    } else {
      cameraStatus.textContent = 'Camera permission prompt required';
    }
  } catch (err) {
    console.log('Permission query not supported:', err);
    cameraStatus.textContent = 'Permission check unavailable ⚠️';
  }
}

function setupEventListeners() {
  startCameraBtn.addEventListener('click', startCamera);
  capturePhotoBtn.addEventListener('click', capturePhoto);
  stopCameraBtn.addEventListener('click', stopCamera);
  document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);
  document.getElementById('savePhotoBtn').addEventListener('click', savePhoto);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && cachedStream && cachedStream.active) {
      console.log('Page hidden, pausing camera');
      stopCamera();
    } else if (!document.hidden && cameraPermissionGranted) {
      console.log('Page visible, resuming camera');
      startCamera().catch(() => {});
    }
  });

  window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
  });

  window.addEventListener('beforeunload', () => {
    if (tg && tg.MainButton) tg.MainButton.offClick();
    stopCamera();
  });
}

async function startCamera() {
  try {
    if (cachedStream && cachedStream.active) {
      video.srcObject = cachedStream;
      setupVideoSuccess();
      return;
    }

    cameraStatus.textContent = 'Requesting camera access... ⏳';
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: currentFacingMode
      },
      audio: false
    };

    cachedStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cachedStream;
    cameraPermissionGranted = true;
    setupVideoSuccess();
  } catch (error) {
    handleCameraError(error);
  }
}

function setupVideoSuccess() {
  video.onloadedmetadata = function () {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    cameraStatus.textContent = 'Camera active 🟢';
    startCameraBtn.disabled = true;
    capturePhotoBtn.disabled = false;
    stopCameraBtn.disabled = false;
    document.getElementById('switchCameraBtn').style.display = 'inline-block';
  };
}

function handleCameraError(error) {
  cameraStatus.textContent = 'Camera error ❌';
  if (error.name === 'NotAllowedError') {
    userDeniedPermission = true;
    alert('Camera access denied. Check settings and refresh.');
  } else {
    alert('Error: ' + error.message);
  }
}

function capturePhoto() {
  if (!video || !canvas || !context) {
    alert('Camera not initialized');
    return;
  }

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    capturedPhoto.src = imageDataUrl;
    capturedPhoto.style.display = 'block';

    const saveBtn = document.getElementById('savePhotoBtn');
    saveBtn.disabled = false;
    saveBtn.style.display = 'inline-block';

    if (tg) tg.MainButton.show();

    console.log('Photo captured successfully');

    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
  } catch (error) {
    console.error('Error capturing photo:', error);
    alert('Error capturing photo: ' + error.message);
  }
}

function savePhoto() {
  if (!capturedPhoto.src) {
    showMessage('No photo to save', 'error');
    return;
  }
  if (!db) {
    showMessage('Storage not ready', 'error');
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      showMessage('Failed to get image blob', 'error');
      return;
    }
    try {
      const transaction = db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      const request = store.add({ blob, ts: Date.now() });

      request.onsuccess = (e) => {
        showMessage(`Photo stored locally in browser (ID: ${e.target.result}).`, 'success');
      };
      request.onerror = (e) => {
        showMessage('Local storage failed: ' + (e.target.error?.message || 'Unknown'), 'error');
      };
    } catch (error) {
      showMessage('Local storage failed: ' + error.message, 'error');
    }
  }, 'image/png');
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
  document.getElementById('switchCameraBtn').style.display = 'none';
  console.log('Camera stopped');
}

function showMessage(message, type = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
  if (tg && tg.showAlert) {
    tg.showAlert(message);
    return;
  }
  const messageEl = document.createElement('div');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;
  document.body.appendChild(messageEl);
  setTimeout(() => {
    if (document.body.contains(messageEl)) {
      document.body.removeChild(messageEl);
    }
  }, 3000);
}

// Supported sharing method in Telegram Mini Apps
function sharePhoto() {
  if (!tg || !capturedPhoto.src) {
    showMessage('Cannot share', 'error');
    return;
  }

  // Try to send compressed data URL (must be <= 4096 bytes), else require server upload.
  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

  if (dataUrl.length > 4000) {
    showMessage('Photo too large to send directly. Upload to your server and send a token via sendData.', 'error');
    return;
  }

  try {
    tg.sendData(JSON.stringify({ type: 'photo_dataurl', dataUrl }));
    showMessage('Photo sent to bot.', 'success');
    // Optionally close the app:
    // tg.close();
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
  const switchBtn = document.getElementById('switchCameraBtn');
  switchBtn.disabled = true;

  try {
    stopCamera();
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await startCamera();
  } catch (error) {
    showMessage('Camera switch failed: ' + error.message, 'error');
  } finally {
    startCameraBtn.disabled = true; // camera running
    capturePhotoBtn.disabled = false;
    stopCameraBtn.disabled = false;
    switchBtn.disabled = false;
  }
}
