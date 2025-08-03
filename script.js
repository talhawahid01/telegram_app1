// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;

// Camera variables
let video = null;
let canvas = null;
let context = null;
let stream = null;

// DOM elements
const startCameraBtn = document.getElementById('startCamera');
const capturePhotoBtn = document.getElementById('capturePhoto');
const stopCameraBtn = document.getElementById('stopCamera');
const capturedPhoto = document.getElementById('capturedPhoto');
const downloadPhotoBtn = document.getElementById('downloadPhoto');
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
        tg.MainButton.hide();
        
        // Handle main button click
        tg.MainButton.onClick(function() {
            if (capturedPhoto.src && capturedPhoto.src !== window.location.href) {
                sharePhoto();
            }
        });
        
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
}

function setupEventListeners() {
    startCameraBtn.addEventListener('click', startCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    stopCameraBtn.addEventListener('click', stopCamera);
    downloadPhotoBtn.addEventListener('click', downloadPhoto);
}

async function startCamera() {
    try {
        cameraStatus.textContent = 'Starting camera... ⏳';
        
        // Request camera access with specific constraints
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user' // Front camera by default
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        video.onloadedmetadata = function() {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            cameraStatus.textContent = 'Camera active 🟢';
            startCameraBtn.disabled = true;
            capturePhotoBtn.disabled = false;
            stopCameraBtn.disabled = false;
            
            console.log('Camera started successfully');
            console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        };
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        cameraStatus.textContent = 'Camera access denied ❌';
        
        // Show user-friendly error messages
        if (error.name === 'NotAllowedError') {
            alert('Camera access was denied. Please allow camera permissions and try again.');
        } else if (error.name === 'NotFoundError') {
            alert('No camera found on this device.');
        } else if (error.name === 'NotSupportedError') {
            alert('Camera is not supported in this browser.');
        } else {
            alert('Error accessing camera: ' + error.message);
        }
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
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Display the captured photo
        capturedPhoto.src = imageDataUrl;
        capturedPhoto.style.display = 'block';
        downloadPhotoBtn.style.display = 'inline-block';
        
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

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        
        cameraStatus.textContent = 'Camera stopped 🔴';
        startCameraBtn.disabled = false;
        capturePhotoBtn.disabled = true;
        stopCameraBtn.disabled = true;
        
        console.log('Camera stopped');
    }
}

function downloadPhoto() {
    if (!capturedPhoto.src || capturedPhoto.src === window.location.href) {
        alert('No photo to download');
        return;
    }
    
    try {
        // Create download link
        const link = document.createElement('a');
        link.download = 'telegram-miniapp-photo-' + new Date().getTime() + '.jpg';
        link.href = capturedPhoto.src;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Photo download initiated');
        
    } catch (error) {
        console.error('Error downloading photo:', error);
        alert('Error downloading photo: ' + error.message);
    }
}

function sharePhoto() {
    if (!tg) {
        alert('Sharing is only available in Telegram');
        return;
    }
    
    if (!capturedPhoto.src || capturedPhoto.src === window.location.href) {
        alert('No photo to share');
        return;
    }
    
    try {
        // Convert image to blob and share
        canvas.toBlob(function(blob) {
            if (blob) {
                // Create a temporary URL for the blob
                const url = URL.createObjectURL(blob);
                
                // Use Telegram's sharing functionality
                if (tg.shareMessage) {
                    tg.shareMessage({
                        text: 'Check out this photo I took with the Camera MiniApp! 📸',
                        media: {
                            type: 'photo',
                            url: url
                        }
                    });
                } else {
                    // Fallback: close the app and let user share manually
                    tg.close();
                }
            }
        }, 'image/jpeg', 0.8);
        
    } catch (error) {
        console.error('Error sharing photo:', error);
        alert('Error sharing photo: ' + error.message);
    }
}

// Handle camera switching (front/back)
function switchCamera() {
    if (!stream) {
        alert('Camera not active');
        return;
    }
    
    // Stop current stream
    stopCamera();
    
    // Toggle between front and back camera
    const currentFacingMode = stream.getVideoTracks()[0].getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    // Restart with new facing mode
    setTimeout(() => {
        startCameraWithFacingMode(newFacingMode);
    }, 100);
}

async function startCameraWithFacingMode(facingMode) {
    try {
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: facingMode
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        video.onloadedmetadata = function() {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            cameraStatus.textContent = 'Camera active 🟢';
            startCameraBtn.disabled = true;
            capturePhotoBtn.disabled = false;
            stopCameraBtn.disabled = false;
        };
        
    } catch (error) {
        console.error('Error switching camera:', error);
        cameraStatus.textContent = 'Camera switch failed ❌';
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden && stream) {
        // Pause camera when page is hidden
        console.log('Page hidden, pausing camera');
    } else if (!document.hidden && stream) {
        // Resume camera when page is visible
        console.log('Page visible, resuming camera');
    }
});

// Handle errors
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

// Export functions for debugging
window.cameraApp = {
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    sharePhoto
};

