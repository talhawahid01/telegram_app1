// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;

// Camera variables
let video = null;
let canvas = null;
let context = null;
let stream = null;

// Permission state tracking
let cachedStream = null; // Cache stream during session
let cameraPermissionGranted = false;
let userDeniedPermission = false;

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
    }
}

function setupEventListeners() {
    startCameraBtn.addEventListener('click', startCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    stopCameraBtn.addEventListener('click', stopCamera);
    downloadPhotoBtn.addEventListener('click', downloadPhoto);
    
    // Add camera switch button functionality
    const switchBtn = document.getElementById('switchCameraBtn');
    if (switchBtn) {
        switchBtn.addEventListener('click', switchCamera);
    }
}

async function startCamera() {
    try {
        // If we have a cached stream, try to reuse it first
        if (cachedStream && cachedStream.active) {
            video.srcObject = cachedStream;
            stream = cachedStream;
            setupVideoSuccess();
            return;
        }
        
        cameraStatus.textContent = 'Requesting camera access... ⏳';
        
        // Enhanced constraints for better compatibility
        const constraints = {
            video: {
                width: { ideal: 1280, max: 1920, min: 640 },
                height: { ideal: 720, max: 1080, min: 480 },
                facingMode: 'user', // Start with front camera
                frameRate: { ideal: 30, max: 60 }
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        cachedStream = stream; // Cache the stream
        cameraPermissionGranted = true;
        userDeniedPermission = false;
        
        video.srcObject = stream;
        setupVideoSuccess();
        
    } catch (error) {
        handleCameraError(error);
    }
}
function setupVideoSuccess() {
    video.onloadedmetadata = function() {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        cameraStatus.textContent = 'Camera active 🟢';
        startCameraBtn.disabled = true;
        startCameraBtn.textContent = 'Camera Active';
        capturePhotoBtn.disabled = false;
        stopCameraBtn.disabled = false;
        
        // Show switch camera button
        const switchBtn = document.getElementById('switchCameraBtn');
        if (switchBtn) {
            switchBtn.style.display = 'inline-block';
        }
        
        console.log('Camera started successfully');
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    };
}

function handleCameraError(error) {
    console.error('Error accessing camera:', error);
    
    let errorMessage = 'Camera access failed';
    let statusMessage = 'Camera error ❌';
    
    if (error.name === 'NotAllowedError') {
        userDeniedPermission = true;
        errorMessage = 'Camera access was denied. Please allow camera permissions in your browser settings and refresh the page.';
        statusMessage = 'Permission denied ❌';
        startCameraBtn.textContent = 'Permission Denied - Check Settings';
    } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
        statusMessage = 'No camera found ❌';
    } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera is not supported in this browser environment.';
        statusMessage = 'Not supported ❌';
    } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
        statusMessage = 'Camera in use ❌';
    } else {
        errorMessage = 'Error accessing camera: ' + error.message;
    }
    
    cameraStatus.textContent = statusMessage;
    
    // Show user-friendly error with suggestions
    if (tg && tg.showAlert) {
        tg.showAlert(errorMessage);
    } else {
        alert(errorMessage);
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

// Enhanced download functionality for Telegram environment
function downloadPhoto() {
    if (!capturedPhoto.src || capturedPhoto.src === window.location.href) {
        showMessage('No photo to download', 'error');
        return;
    }
    
    // Try multiple download strategies
    if (tg) {
        // Strategy 1: Use Telegram's sharing mechanism
        sharePhotoAsFallback();
    } else {
        // Strategy 2: Standard download for web browsers
        downloadPhotoDirectly();
    }
}

function downloadPhotoDirectly() {
    try {
        // Create download link
        const link = document.createElement('a');
        link.download = `camera-photo-${new Date().getTime()}.jpg`;
        link.href = capturedPhoto.src;
        
        // Add to document, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Direct download initiated');
        showMessage('Download started 📥', 'success');
        
    } catch (error) {
        console.error('Error with direct download:', error);
        // Fallback to copy to clipboard
        copyImageToClipboard();
    }
}

function sharePhotoAsFallback() {
    try {
        // Convert canvas to blob for sharing
        canvas.toBlob(function(blob) {
            if (blob) {
                // Try to save to clipboard first
                copyImageToClipboard();
                
                // Then show sharing options
                if (tg.showPopup) {
                    tg.showPopup({
                        title: '📸 Photo Ready!',
                        message: 'Your photo has been copied to clipboard. You can also share it directly using the Share button below.',
                        buttons: [
                            {id: 'share', type: 'default', text: 'Share Photo'},
                            {id: 'close', type: 'cancel', text: 'Close'}
                        ]
                    }, function(buttonId) {
                        if (buttonId === 'share') {
                            sharePhoto();
                        }
                    });
                } else {
                    // Fallback to share directly
                    sharePhoto();
                }
            } else {
                showMessage('Error preparing photo for sharing', 'error');
            }
        }, 'image/jpeg', 0.95);
        
    } catch (error) {
        console.error('Error in photo sharing fallback:', error);
        copyImageToClipboard();
    }
}

async function copyImageToClipboard() {
    try {
        // Try modern clipboard API first
        if (navigator.clipboard && canvas.toBlob) {
            canvas.toBlob(async function(blob) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showMessage('Photo copied to clipboard! 📋', 'success');
                } catch (clipError) {
                    console.log('Clipboard write failed:', clipError);
                    fallbackCopyMethod();
                }
            }, 'image/png');
        } else {
            fallbackCopyMethod();
        }
    } catch (error) {
        console.error('Clipboard operation failed:', error);
        fallbackCopyMethod();
    }
}

function fallbackCopyMethod() {
    try {
        // Fallback: Create a text area with image data URL
        const textArea = document.createElement('textarea');
        textArea.value = capturedPhoto.src;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showMessage('Photo data copied to clipboard 📋', 'info');
    } catch (error) {
        console.error('Fallback copy failed:', error);
        showMessage('Unable to copy photo. Long-press on image to save manually.', 'info');
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

