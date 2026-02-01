

class TaskManager {
    constructor() {
        this.tasks = [];
        
        // DOM elements
        this.tasksList = document.getElementById('tasksList');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.taskInputContainer = document.getElementById('taskInputContainer');
        this.taskInput = document.getElementById('taskInput');
        this.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.cancelTaskBtn = document.getElementById('cancelTaskBtn');
        
        this.init();
    }
    
    init() {
        // Load tasks from storage
        this.loadTasks();
        
        // Event listeners
        this.addTaskBtn.addEventListener('click', () => this.showTaskInput());
        this.saveTaskBtn.addEventListener('click', () => this.saveTask());
        this.cancelTaskBtn.addEventListener('click', () => this.hideTaskInput());
        
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTask();
            } else if (e.key === 'Escape') {
                this.hideTaskInput();
            }
        });
        
        // Render initial tasks
        this.renderTasks();
    }
    
    showTaskInput() {
        this.taskInputContainer.classList.remove('hidden');
        this.taskInput.focus();
    }
    
    hideTaskInput() {
        this.taskInputContainer.classList.add('hidden');
        this.taskInput.value = '';
    }
    
    saveTask() {
        const text = this.taskInput.value.trim();
        
        if (text) {
            const task = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            
            this.tasks.unshift(task);
            this.saveTasks();
            this.renderTasks();
            this.hideTaskInput();
        }
    }
    
    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }
    
    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderTasks();
    }
    
    renderTasks() {
        if (this.tasks.length === 0) {
            this.tasksList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
                    <p style="font-size: 0.9rem;">No tasks yet. Add one to get started!</p>
                </div>
            `;
            return;
        }
        
        this.tasksList.innerHTML = this.tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox" data-action="toggle"></div>
                <div class="task-text">${this.escapeHtml(task.text)}</div>
                <button class="task-delete" data-action="delete" title="Delete task">✕</button>
            </div>
        `).join('');
        
        // Add event listeners to task items
        this.tasksList.querySelectorAll('.task-item').forEach(item => {
            const taskId = parseInt(item.dataset.taskId);
            
            item.querySelector('[data-action="toggle"]').addEventListener('click', () => {
                this.toggleTask(taskId);
            });
            
            item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                this.deleteTask(taskId);
            });
        });
    }
    
    saveTasks() {
        const data = {
            tasks: this.tasks,
            lastUpdate: new Date().toISOString()
        };
        
        // Save to localStorage as backup
        localStorage.setItem('chronos-tasks', JSON.stringify(data));
        
        // Save to Firebase if user is logged in
        if (window.firebaseService && window.firebaseService.currentUser) {
            window.firebaseService.saveTasks(this.tasks);
        }
    }
    
    async loadTasks() {
        // Try to load from Firebase first if user is logged in
        if (window.firebaseService && window.firebaseService.currentUser) {
            const firebaseTasks = await window.firebaseService.loadTasks();
            if (firebaseTasks && firebaseTasks.length > 0) {
                this.tasks = firebaseTasks;
                return;
            }
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem('chronos-tasks');
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Check if tasks are from today
                const today = new Date().toDateString();
                const lastUpdate = new Date(data.lastUpdate).toDateString();
                
                if (today === lastUpdate) {
                    this.tasks = data.tasks || [];
                } else {
                    // Clear completed tasks from previous days
                    this.tasks = (data.tasks || []).filter(task => !task.completed);
                    this.saveTasks();
                }
                
            } catch (error) {
                console.error('Error loading tasks:', error);
                this.tasks = [];
            }
        }
    }
    
    async syncWithFirebase() {
        // Called when user logs in
        const firebaseTasks = await window.firebaseService.loadTasks();
        
        if (firebaseTasks) {
            const localData = localStorage.getItem('chronos-tasks');
            
            if (localData) {
                const local = JSON.parse(localData);
                
                // Merge tasks - prefer Firebase if newer
                if (firebaseTasks.length > local.tasks.length) {
                    this.tasks = firebaseTasks;
                } else {
                    // Local has more tasks, upload them
                    this.saveTasks();
                }
            } else {
                this.tasks = firebaseTasks;
            }
            
            this.renderTasks();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in app.js
window.TaskManager = TaskManager;