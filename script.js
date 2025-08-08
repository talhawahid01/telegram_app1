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

// DOM elements
const startCameraBtn = document.getElementById('startCamera');
const capturePhotoBtn = document.getElementById('capturePhoto');
const stopCameraBtn = document.getElementById('stopCamera');
const capturedPhoto = document.getElementById('capturedPhoto');
const cameraStatus = document.getElementById('cameraStatus');
const telegramStatus = document.getElementById('telegramStatus');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeTelegramWebApp();
    initializeCamera();
    setupEventListeners();
});

function initializeTelegramWebApp() {
    if (tg) {
        // Configure Telegram WebApp
        tg.ready();
        tg.expand();
        
        // Set header color to match theme
        if (tg.themeParams.bg_color) {
            tg.setHeaderColor(tg.themeParams.bg_color);
        }
        
        telegramStatus.textContent = 'Connected ✅';
        
        // Show main button for sharing photos
        tg.MainButton.setText('Share Photo');
        tg.MainButton.onClick(sharePhoto);
        tg.MainButton.show(); // Show only after photo capture if needed

        
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
    
    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraStatus.textContent = 'Camera not supported ❌';
        startCameraBtn.disabled = true;
        return;
    }
    
    cameraStatus.textContent = 'Ready to start 📷';
    
    // Check initial camera access
    checkInitialCameraAccess();
}
// Check if we can access camera without explicit permission request
async function checkInitialCameraAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }
    
    try {
        // Try to check camera permissions without requesting
        if (navigator.permissions) {
            const permission = await navigator.permissions.query({name: 'camera'});
            if (permission.state === 'granted') {
                cameraPermissionGranted = true;
                cameraStatus.textContent = 'Camera access granted 🟢';
                startCameraBtn.textContent = 'Start Camera (Permission Granted)';
            } else if (permission.state === 'denied') {
                userDeniedPermission = true;
                cameraStatus.textContent = 'Camera access denied ❌';
                startCameraBtn.textContent = 'Camera Denied - Check Settings';
            }
        }
    } catch (error) {
        console.log('Permission query not supported:', error);
        // Fallback: Assume prompt needed
    cameraStatus.textContent = 'Permission check unavailable ⚠️';
    }
}

function setupEventListeners() {
    startCameraBtn.addEventListener('click', startCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    stopCameraBtn.addEventListener('click', stopCamera);
    document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);
    document.getElementById('savePhotoBtn').addEventListener('click', savePhoto);

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
    video.onloadedmetadata = function() {
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
        // Draw the current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to image data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        // Display the captured photo
        capturedPhoto.src = imageDataUrl;
        tg.MainButton.show();
        capturedPhoto.style.display = 'block';
        document.getElementById('savePhotoBtn').disabled = false;
        document.getElementById('savePhotoBtn').style.display = 'inline-block';

        
        // Show Telegram main button for sharing
        if (tg) {
            tg.MainButton.show();
        }
        
        console.log('Photo captured successfully');
        
        // Provide haptic feedback if available
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
    
    canvas.toBlob(async (blob) => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                showMessage('Copied to clipboard. Paste in photos app to save—direct save impossible in MiniApp.', 'success');
            } else {
                showMessage('Clipboard unsupported. Long-press photo to save manually.', 'info');
            }
        } catch (error) {
            showMessage('Save failed: ' + error.message + '. Use long-press.', 'error');
        }
    }, 'image/png');
}

function stopCamera() {
    if (cachedStream) {
        cachedStream.getTracks().forEach(track => track.stop());
        cachedStream = null;
        video.srcObject = null;
        cameraStatus.textContent = 'Camera stopped 🔴';
        startCameraBtn.disabled = false;
        capturePhotoBtn.disabled = true;
        stopCameraBtn.disabled = true;
        document.getElementById('switchCameraBtn').style.display = 'none';
        console.log('Camera stopped');
    }
}

// Enhanced messaging system
function showMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    } else {
        // Create a temporary message element
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
}
function sharePhoto() {
    if (!tg || !capturedPhoto.src) {
        showMessage('Cannot share', 'error');
        return;
    }
    
    canvas.toBlob((blob) => {
        try {
            const url = URL.createObjectURL(blob);
            tg.showPopup({
                title: 'Share Photo',
                message: 'Select where to share:',
                buttons: [{type: 'default', text: 'Share to Chat'}]
            }, () => {
                tg.openTelegramLink(`tg://msg?url=${encodeURIComponent(url)}&text=Check this photo!`);
            });
            showMessage('Share popup opened—select contacts/chats manually.', 'success');
        } catch (error) {
            showMessage('Share failed: ' + error.message + '. Copy and share via clipboard.', 'error');
        }
    }, 'image/jpeg');
}

// Handle camera switching (front/back)
function switchCamera() {
    if (!cachedStream || !cachedStream.active) {
        showMessage('Camera not active', 'error');
        return;
    }
    // Disable buttons to prevent race conditions
    startCameraBtn.disabled = true;
    capturePhotoBtn.disabled = true;
    stopCameraBtn.disabled = true;
    document.getElementById('switchCameraBtn').disabled = true;

    stopCamera();
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCamera().catch(error => {
        showMessage('Camera switch failed: ' + error.message, 'error');
    }).finally(() => {
        // Re-enable buttons
        startCameraBtn.disabled = false;
        capturePhotoBtn.disabled = false;
        stopCameraBtn.disabled = false;
        document.getElementById('switchCameraBtn').disabled = false;
    });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden && cachedStream && cachedStream.active) {
        // Pause camera when page is hidden
        console.log('Page hidden, pausing camera');
        stopCamera();
    } else if (!document.hidden && cameraPermissionGranted) {
        // Resume camera when page is visible, only if permission was granted
        console.log('Page visible, resuming camera');
        startCamera();
    }
});


// Handle errors
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

// Event cleanup on unload
window.addEventListener('beforeunload', () => {
    if (tg && tg.MainButton) {
        tg.MainButton.offClick(); // Remove handler if set
    }
    stopCamera();
});
