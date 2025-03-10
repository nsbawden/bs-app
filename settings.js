// settings.js
class SettingsManager {
    constructor(defaults, state) {
        this.defaults = defaults;
        this.state = state; // Reference to the state from config.js
        this.elements = new Map();
        this.settingsConfig = {
            'settings-btn': { events: { 'click': this.openPopup.bind(this) } },
            'settings-close': { events: { 'click': this.closePopup.bind(this) } },
            'max-history-length': {
                type: 'number',
                min: 1,
                max: 1000,
                defaultKey: 'maxHistoryLength',
                setter: (val) => parseInt(val) || this.defaults.maxHistoryLength,
                storage: 'state'
            },
            'temperature': {
                type: 'number',
                min: 0,
                max: 2,
                defaultKey: 'openaiSettings.temperature',
                setter: (val) => Math.max(0, Math.min(2, parseFloat(val) || this.defaults.openaiSettings.temperature)),
                storage: 'state'
            },
            'openai-model': {
                type: 'select',
                defaultKey: 'openaiSettings.model',
                storage: 'state'
            },
            'max-tokens': {
                type: 'number',
                min: 50,
                max: 4096,
                defaultKey: 'openaiSettings.maxTokens',
                setter: (val) => Math.max(50, Math.min(4096, parseInt(val) || this.defaults.openaiSettings.maxTokens)),
                storage: 'state'
            },
            'openAIApiKey': {
                type: 'text',
                setter: (val) => val.trim(),
                storage: 'local'
            },
            'bibleApiKey': {
                type: 'text',
                storage: 'local'
            },
            'esvApiKey': {
                type: 'text',
                storage: 'local'
            }
        };

        this.init();
    }

    init() {
        Object.entries(this.settingsConfig).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with ID '${id}' not found`);
                return;
            }

            this.elements.set(id, element);

            if (config.events) {
                Object.entries(config.events).forEach(([event, handler]) => {
                    element.addEventListener(event, handler);
                });
            } else if (config.type) {
                ['change', 'blur'].forEach(event => {
                    element.addEventListener(event, this.saveSettings.bind(this));
                });
            }
        });
    }

    getElement(id) {
        return this.elements.get(id);
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    loadSettings() {
        Object.entries(this.settingsConfig).forEach(([id, config]) => {
            if (!config.type) return;

            const element = this.getElement(id);
            if (!element) return;

            let value;
            if (config.storage === 'local') {
                value = localStorage.getItem(id) || '';
            } else if (config.storage === 'state') {
                value = this.getNestedValue(this.state, config.defaultKey);
            }
            element.value = value !== undefined ? value : this.getNestedValue(this.defaults, config.defaultKey);
        });
    }

    saveSettings() {
        Object.entries(this.settingsConfig).forEach(([id, config]) => {
            if (!config.type) return;

            const element = this.getElement(id);
            if (!element) return;

            let value = config.setter ? config.setter(element.value) : element.value;

            if (config.storage === 'local') {
                if (value) localStorage.setItem(id, value);
            } else if (config.storage === 'state') {
                this.setNestedValue(this.state, config.defaultKey, value);
            }
        });

        // Trim aiHistory if necessary
        const newMaxHistory = parseInt(this.getElement('max-history-length')?.value) || this.defaults.maxHistoryLength;
        if (aiHistory.length > newMaxHistory) {
            aiHistory = aiHistory.slice(-newMaxHistory);
        }

        saveState(); // Persist all changes to state and aiHistory
    }

    openPopup() {
        this.loadSettings();
        const popup = document.getElementById('settings-popup');
        if (popup) {
            popup.classList.remove('hidden');
        } else {
            console.error('Cannot open popup: settings-popup element not found');
        }
    }

    closePopup() {
        const popup = document.getElementById('settings-popup');
        if (popup) {
            popup.classList.add('hidden');
        } else {
            console.error('Cannot close popup: settings-popup element not found');
        }
    }
}

// Usage (assuming config.js is loaded first)
loadState(); // Initialize state and openaiSettings
const settingsManager = new SettingsManager(defaults, state);