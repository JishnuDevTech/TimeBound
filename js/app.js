
class App {
    constructor() {
        this.firebaseService = null;
        this.timer = null;
        this.taskManager = null;
        this.settingsPanel = document.getElementById('settingsPanel');
        this.settingsToggle = document.getElementById('settingsToggle');
        
        this.init();
    }
    
    async init() {
        // Initialize Firebase service first
        this.firebaseService = new FirebaseService();
        window.firebaseService = this.firebaseService;
        
        // Wait a bit for Firebase auth to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Initialize timer and task manager
        this.timer = new Timer();
        this.taskManager = new TaskManager();
        
        // Make them globally accessible for Firebase sync
        window.timer = this.timer;
        window.taskManager = this.taskManager;
        
        // Settings panel toggle
        this.settingsToggle.addEventListener('click', () => {
            this.settingsPanel.classList.toggle('active');
        });
        
        // Settings inputs
        this.setupSettingsListeners();
        
        // Request notification permission on first interaction
        document.addEventListener('click', () => {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }, { once: true });
        
        // Initialize body data-mode
        document.body.setAttribute('data-mode', 'focus');
        
        // Add keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Service Worker for PWA (if available)
        this.registerServiceWorker();
    }
    
    setupSettingsListeners() {
        // Focus duration
        const focusDuration = document.getElementById('focusDuration');
        const focusValue = document.getElementById('focusValue');
        
        focusDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            focusValue.textContent = value;
            this.timer.updateSettings('focus', value);
        });
        
        focusDuration.value = this.timer.settings.focus / 60;
        focusValue.textContent = focusDuration.value;
        
        // Short break duration
        const shortBreakDuration = document.getElementById('shortBreakDuration');
        const shortBreakValue = document.getElementById('shortBreakValue');
        
        shortBreakDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            shortBreakValue.textContent = value;
            this.timer.updateSettings('shortBreak', value);
        });
        
        shortBreakDuration.value = this.timer.settings.shortBreak / 60;
        shortBreakValue.textContent = shortBreakDuration.value;
        
        // Long break duration
        const longBreakDuration = document.getElementById('longBreakDuration');
        const longBreakValue = document.getElementById('longBreakValue');
        
        longBreakDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            longBreakValue.textContent = value;
            this.timer.updateSettings('longBreak', value);
        });
        
        longBreakDuration.value = this.timer.settings.longBreak / 60;
        longBreakValue.textContent = longBreakDuration.value;
        
        // Auto-start toggle
        const autoStart = document.getElementById('autoStart');
        autoStart.addEventListener('change', (e) => {
            this.timer.updateSettings('autoStart', e.target.checked);
        });
        autoStart.checked = this.timer.settings.autoStart;
        
        // Sound enabled toggle
        const soundEnabled = document.getElementById('soundEnabled');
        soundEnabled.addEventListener('change', (e) => {
            this.timer.updateSettings('soundEnabled', e.target.checked);
        });
        soundEnabled.checked = this.timer.settings.soundEnabled;
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    this.timer.toggleTimer();
                    if (this.timer.settings.soundEnabled) this.timer.playButtonSound();
                    break;
                case 'r':
                    e.preventDefault();
                    this.timer.resetTimer();
                    if (this.timer.settings.soundEnabled) this.timer.playButtonSound();
                    break;
                case 's':
                    e.preventDefault();
                    this.timer.skipSession();
                    break;
                case '1':
                    e.preventDefault();
                    this.timer.switchMode('focus');
                    break;
                case '2':
                    e.preventDefault();
                    this.timer.switchMode('short-break');
                    break;
                case '3':
                    e.preventDefault();
                    this.timer.switchMode('long-break');
                    break;
                case 't':
                    e.preventDefault();
                    document.getElementById('addTaskBtn').click();
                    break;
            }
        });
    }
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Create an inline service worker for basic offline support
            const swCode = `
                self.addEventListener('install', (event) => {
                    self.skipWaiting();
                });
                
                self.addEventListener('activate', (event) => {
                    event.waitUntil(clients.claim());
                });
            `;
            
            const blob = new Blob([swCode], { type: 'application/javascript' });
            const swUrl = URL.createObjectURL(blob);
            
            navigator.serviceWorker.register(swUrl)
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }
    }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new App();
    });
} else {
    new App();
}

// Add install prompt for PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install hint (could be a banner or button)
    console.log('PWA install available');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
});