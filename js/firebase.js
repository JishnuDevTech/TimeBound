

class FirebaseService {
    constructor() {
        this.currentUser = null;
        this.unsubscribe = null;
        
        // DOM elements
        this.loginBtn = document.getElementById('loginBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.loginModal = document.getElementById('loginModal');
        this.closeModal = document.getElementById('closeModal');
        this.authForm = document.getElementById('authForm');
        this.authSubmit = document.getElementById('authSubmit');
        this.authError = document.getElementById('authError');
        this.googleSignIn = document.getElementById('googleSignIn');
        this.userInfo = document.getElementById('userInfo');
        this.userEmail = document.getElementById('userEmail');
        this.syncStatus = document.getElementById('syncStatus');
        
        // Auth tabs
        this.authTabs = document.querySelectorAll('.auth-tab');
        this.isSignUp = false;
        
        this.init();
    }
    
    init() {
        // Listen to auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI();
            
            if (user) {
                console.log('User signed in:', user.email);
                this.syncData();
            } else {
                console.log('User signed out');
            }
        });
        
        // Event listeners
        this.loginBtn.addEventListener('click', () => this.showLoginModal());
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.closeModal.addEventListener('click', () => this.hideLoginModal());
        this.googleSignIn.addEventListener('click', () => this.signInWithGoogle());
        
        // Close modal on outside click
        this.loginModal.addEventListener('click', (e) => {
            if (e.target === this.loginModal) {
                this.hideLoginModal();
            }
        });
        
        // Auth form submit
        this.authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });
        
        // Auth tabs
        this.authTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.authTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.isSignUp = e.target.dataset.tab === 'signup';
                this.authSubmit.textContent = this.isSignUp ? 'Sign Up' : 'Sign In';
                this.authError.textContent = '';
            });
        });
    }
    
    showLoginModal() {
        this.loginModal.classList.add('active');
        this.authError.textContent = '';
    }
    
    hideLoginModal() {
        this.loginModal.classList.remove('active');
        this.authForm.reset();
        this.authError.textContent = '';
    }
    
    async handleAuth() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        
        this.authError.textContent = '';
        this.authSubmit.disabled = true;
        this.authSubmit.textContent = 'Please wait...';
        
        try {
            if (this.isSignUp) {
                await firebase.auth().createUserWithEmailAndPassword(email, password);
            } else {
                await firebase.auth().signInWithEmailAndPassword(email, password);
            }
            
            this.hideLoginModal();
        } catch (error) {
            console.error('Auth error:', error);
            this.authError.textContent = this.getErrorMessage(error.code);
        } finally {
            this.authSubmit.disabled = false;
            this.authSubmit.textContent = this.isSignUp ? 'Sign Up' : 'Sign In';
        }
    }
    
    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        try {
            await firebase.auth().signInWithPopup(provider);
            this.hideLoginModal();
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.authError.textContent = this.getErrorMessage(error.code);
        }
    }
    
    async logout() {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    updateUI() {
        if (this.currentUser) {
            this.loginBtn.style.display = 'none';
            this.userInfo.style.display = 'flex';
            this.userEmail.textContent = this.currentUser.email;
        } else {
            this.loginBtn.style.display = 'block';
            this.userInfo.style.display = 'none';
        }
    }
    
    getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/too-many-requests': 'Too many attempts. Try again later',
            'auth/network-request-failed': 'Network error. Check your connection'
        };
        
        return messages[code] || 'An error occurred. Please try again';
    }
    
    // ========== Database Operations ==========
    
    async saveTimerData(data) {
        if (!this.currentUser) {
            return false;
        }
        
        this.updateSyncStatus('syncing');
        
        try {
            await firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('timer')
                .doc('data')
                .set({
                    ...data,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            
            this.updateSyncStatus('synced');
            return true;
        } catch (error) {
            console.error('Error saving timer data:', error);
            this.updateSyncStatus('error');
            return false;
        }
    }
    
    async loadTimerData() {
        if (!this.currentUser) {
            return null;
        }
        
        try {
            const doc = await firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('timer')
                .doc('data')
                .get();
            
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error loading timer data:', error);
            return null;
        }
    }
    
    async saveTasks(tasks) {
        if (!this.currentUser) {
            return false;
        }
        
        this.updateSyncStatus('syncing');
        
        try {
            const batch = firebase.firestore().batch();
            const tasksRef = firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('tasks');
            
            // Delete all existing tasks
            const snapshot = await tasksRef.get();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Add new tasks
            tasks.forEach(task => {
                const taskRef = tasksRef.doc(task.id.toString());
                batch.set(taskRef, {
                    ...task,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
            this.updateSyncStatus('synced');
            return true;
        } catch (error) {
            console.error('Error saving tasks:', error);
            this.updateSyncStatus('error');
            return false;
        }
    }
    
    async loadTasks() {
        if (!this.currentUser) {
            return [];
        }
        
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .collection('tasks')
                .orderBy('createdAt', 'desc')
                .get();
            
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: parseInt(doc.id),
                    text: data.text,
                    completed: data.completed,
                    createdAt: data.createdAt
                };
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }
    
    syncData() {
        // This will be called when user logs in
        // The timer and task managers will handle the actual syncing
        if (window.timer) {
            window.timer.syncWithFirebase();
        }
        if (window.taskManager) {
            window.taskManager.syncWithFirebase();
        }
    }
    
    updateSyncStatus(status) {
        const indicator = this.syncStatus.querySelector('.sync-indicator');
        const icon = this.syncStatus.querySelector('.sync-icon');
        const text = this.syncStatus.querySelector('.sync-text');
        
        indicator.classList.remove('syncing', 'error');
        
        if (status === 'syncing') {
            indicator.classList.add('syncing');
            icon.textContent = '🔄';
            text.textContent = 'Syncing...';
        } else if (status === 'synced') {
            icon.textContent = '☁️';
            text.textContent = 'Synced';
        } else if (status === 'error') {
            indicator.classList.add('error');
            icon.textContent = '⚠️';
            text.textContent = 'Sync failed';
        }
    }
}

// Export for use in app.js
window.FirebaseService = FirebaseService;