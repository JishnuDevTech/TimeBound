
class Timer {
    constructor() {
        // Timer state
        this.currentMode = 'focus';
        this.isRunning = false;
        this.isPaused = false;
        this.timeRemaining = 0;
        this.totalTime = 0;
        this.intervalId = null;
        
        // Session tracking
        this.completedSessions = 0;
        this.currentStreak = 0;
        this.totalFocusTime = 0; // in seconds
        
        // Settings
        this.settings = {
            focus: 25 * 60,
            shortBreak: 5 * 60,
            longBreak: 15 * 60,
            autoStart: false,
            soundEnabled: true
        };
        
        // DOM elements
        this.timeDisplay = document.getElementById('timeDisplay');
        this.sessionLabel = document.getElementById('sessionLabel');
        this.playBtn = document.getElementById('playBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.skipBtn = document.getElementById('skipBtn');
        this.progressCircle = document.getElementById('progressCircle');
        this.timerDisplay = document.querySelector('.timer-display');
        
        // Stats elements
        this.completedSessionsEl = document.getElementById('completedSessions');
        this.totalTimeEl = document.getElementById('totalTime');
        this.currentStreakEl = document.getElementById('currentStreak');
        
        // Mode buttons
        this.modeButtons = document.querySelectorAll('.mode-btn');
        
        this.init();
    }
    
    init() {
        // Load saved data
        this.loadFromStorage();
        
        // Set initial time
        this.timeRemaining = this.settings[this.currentMode];
        this.totalTime = this.timeRemaining;
        this.updateDisplay();
        this.updateStats();
        
        // Event listeners
        this.playBtn.addEventListener('click', () => {
            this.toggleTimer();
            if (this.settings.soundEnabled) this.playButtonSound();
        });
        this.resetBtn.addEventListener('click', () => {
            this.resetTimer();
            if (this.settings.soundEnabled) this.playButtonSound();
        });
        this.skipBtn.addEventListener('click', () => this.skipSession());
        
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // Visibility change handling (pause when tab is not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) {
                // Save the current timestamp when hidden
                this.lastUpdateTime = Date.now();
            } else if (!document.hidden && this.isRunning) {
                // Calculate elapsed time while hidden
                const now = Date.now();
                const elapsed = Math.floor((now - this.lastUpdateTime) / 1000);
                this.timeRemaining = Math.max(0, this.timeRemaining - elapsed);
                
                if (this.timeRemaining === 0) {
                    this.completeSession();
                } else {
                    this.updateDisplay();
                }
            }
        });
    }
    
    toggleTimer() {
        if (this.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }
    
    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.lastUpdateTime = Date.now();
        
        this.playBtn.classList.add('playing');
        this.timerDisplay.classList.add('running');
        document.body.classList.add('timer-running');
        
        this.intervalId = setInterval(() => this.tick(), 1000);
        
        // Request wake lock to prevent screen from sleeping
        this.requestWakeLock();
    }
    
    pause() {
        this.isRunning = false;
        this.isPaused = true;
        
        this.playBtn.classList.remove('playing');
        this.timerDisplay.classList.remove('running');
        document.body.classList.remove('timer-running');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.releaseWakeLock();
        this.saveToStorage();
    }
    
    tick() {
        this.timeRemaining--;
        
        if (this.timeRemaining <= 0) {
            this.completeSession();
        } else {
            this.updateDisplay();
        }
    }
    
    completeSession() {
        this.pause();
        this.timeRemaining = 0;
        this.updateDisplay();
        
        // Play completion sound
        if (this.settings.soundEnabled) {
            this.playCompletionSound();
        }
        
        // Show notification
        this.showNotification();
        
        // Update stats
        if (this.currentMode === 'focus') {
            this.completedSessions++;
            this.currentStreak++;
            this.totalFocusTime += this.settings.focus;
        }
        
        this.updateStats();
        this.saveToStorage();
        
        // Auto-switch to next mode
        setTimeout(() => {
            this.switchToNextMode();
        }, 1000);
    }
    
    switchToNextMode() {
        if (this.currentMode === 'focus') {
            // After focus, switch to break
            if (this.completedSessions % 4 === 0) {
                this.switchMode('long-break');
            } else {
                this.switchMode('short-break');
            }
        } else {
            // After break, switch to focus
            this.switchMode('focus');
        }
        
        // Auto-start if enabled
        if (this.settings.autoStart) {
            setTimeout(() => this.start(), 500);
        }
    }
    
    switchMode(mode) {
        if (this.isRunning) {
            this.pause();
        }
        
        this.currentMode = mode;
        this.timeRemaining = this.settings[this.getModeKey(mode)];
        this.totalTime = this.timeRemaining;
        
        // Update UI
        this.updateDisplay();
        this.updateModeButtons();
        this.updateBodyDataMode();
        this.saveToStorage();
        
        // Play sound for break sessions
        if (this.settings.soundEnabled && (mode === 'short-break' || mode === 'long-break')) {
            this.playCompletionSound();
        }
    }
    
    resetTimer() {
        this.pause();
        this.timeRemaining = this.settings[this.getModeKey(this.currentMode)];
        this.totalTime = this.timeRemaining;
        this.updateDisplay();
    }
    
    skipSession() {
        this.pause();
        this.switchToNextMode();
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        
        this.timeDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update session label
        const labels = {
            'focus': `Session ${this.completedSessions + 1}`,
            'short-break': 'Short Break',
            'long-break': 'Long Break'
        };
        this.sessionLabel.textContent = labels[this.currentMode];
        
        // Update progress ring
        const progress = 1 - (this.timeRemaining / this.totalTime);
        const circumference = 2 * Math.PI * 180; // 2πr where r=180
        const offset = circumference * (1 - progress);
        this.progressCircle.style.strokeDashoffset = offset;
        
        // Update page title
        document.title = `${this.timeDisplay.textContent} — CHRONOS`;
    }
    
    updateStats() {
        this.completedSessionsEl.textContent = this.completedSessions;
        
        const hours = Math.floor(this.totalFocusTime / 3600);
        const minutes = Math.floor((this.totalFocusTime % 3600) / 60);
        this.totalTimeEl.textContent = `${hours}h ${minutes}m`;
        
        this.currentStreakEl.textContent = this.currentStreak;
    }
    
    updateModeButtons() {
        this.modeButtons.forEach(btn => {
            if (btn.dataset.mode === this.currentMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    updateBodyDataMode() {
        document.body.setAttribute('data-mode', this.currentMode);
    }
    
    getModeKey(mode) {
        const modeMap = {
            'focus': 'focus',
            'short-break': 'shortBreak',
            'long-break': 'longBreak'
        };
        return modeMap[mode];
    }
    
    updateSettings(setting, value) {
        if (setting === 'autoStart' || setting === 'soundEnabled') {
            this.settings[setting] = value;
        } else {
            this.settings[setting] = value * 60; // Convert to seconds
            
            // Update current time if not running
            if (!this.isRunning && this.getModeKey(this.currentMode) === setting) {
                this.timeRemaining = this.settings[setting];
                this.totalTime = this.timeRemaining;
                this.updateDisplay();
            }
        }
        
        this.saveToStorage();
    }
    
    playCompletionSound() {
        try {
            const audio = new Audio('timer.wav');
            audio.play().catch(error => console.log('Audio play failed:', error));
        } catch (error) {
            console.log('Audio not available:', error);
        }
    }
    
    playButtonSound() {
        try {
            const audio = new Audio('notification.mp3');
            audio.play().catch(error => console.log('Audio play failed:', error));
        } catch (error) {
            console.log('Audio not available:', error);
        }
    }
    
    showNotification() {
        // Check if notifications are supported and permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            const messages = {
                'focus': '🎉 Great work! Time for a break.',
                'short-break': '💪 Break over! Ready to focus?',
                'long-break': '✨ Long break complete! Let\'s get back to it.'
            };
            
            new Notification('CHRONOS Timer', {
                body: messages[this.currentMode],
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ff6b6b"/></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ff6b6b"/></svg>'
            });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            // Request permission
            Notification.requestPermission();
        }
    }
    
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.log('Wake Lock error:', err);
            }
        }
    }
    
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }
    
    saveToStorage() {
        const data = {
            completedSessions: this.completedSessions,
            currentStreak: this.currentStreak,
            totalFocusTime: this.totalFocusTime,
            settings: this.settings,
            lastSaveDate: new Date().toDateString()
        };
        
        // Save to localStorage as backup
        localStorage.setItem('chronos-timer-data', JSON.stringify(data));
        
        // Save to Firebase if user is logged in
        if (window.firebaseService && window.firebaseService.currentUser) {
            window.firebaseService.saveTimerData(data);
        }
    }
    
    async loadFromStorage() {
        // Try to load from Firebase first if user is logged in
        if (window.firebaseService && window.firebaseService.currentUser) {
            const firebaseData = await window.firebaseService.loadTimerData();
            if (firebaseData) {
                this.applyLoadedData(firebaseData);
                return;
            }
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem('chronos-timer-data');
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.applyLoadedData(data);
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }
    
    applyLoadedData(data) {
        // Check if it's a new day, reset streak
        const today = new Date().toDateString();
        if (data.lastSaveDate !== today) {
            this.currentStreak = 0;
        } else {
            this.completedSessions = data.completedSessions || 0;
            this.currentStreak = data.currentStreak || 0;
            this.totalFocusTime = data.totalFocusTime || 0;
        }
        
        // Load settings
        if (data.settings) {
            this.settings = { ...this.settings, ...data.settings };
        }
    }
    
    async syncWithFirebase() {
        // Called when user logs in
        const firebaseData = await window.firebaseService.loadTimerData();
        
        if (firebaseData) {
            // Merge Firebase data with local data
            const localData = localStorage.getItem('chronos-timer-data');
            
            if (localData) {
                const local = JSON.parse(localData);
                
                // Use the data with more completed sessions
                if (firebaseData.completedSessions > local.completedSessions) {
                    this.applyLoadedData(firebaseData);
                } else if (local.completedSessions > firebaseData.completedSessions) {
                    // Local data is newer, upload it
                    this.saveToStorage();
                }
            } else {
                this.applyLoadedData(firebaseData);
            }
            
            this.updateStats();
            this.updateDisplay();
        }
    }
}

// Export for use in app.js
window.Timer = Timer;