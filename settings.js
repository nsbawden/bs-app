// settings.js
class SettingsManager {
    constructor(defaults, state, openaiSettingsRef) {
        this.defaults = defaults;
        this.state = state; // Reference to the state from config.js
        this.openaiSettings = openaiSettingsRef; // Reference to global openaiSettings from config.js
        this.elements = new Map();
        this.settingsConfig = {
            'settings-btn': { events: { 'click': this.openPopup.bind(this) } },
            'settings-close': { events: { 'click': this.closePopup.bind(this) } },
            'theme-select': {
                type: 'select',
                defaultKey: 'theme',
                setter: (val) => val || 'dark', // Default to 'dark' if invalid
                storage: 'local',
                apply: (val) => this.applyTheme(val) // Apply theme immediately
            },
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
        this.applyInitialTheme(); // Apply theme on page load
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
            current = current[parts[i]] = current[parts[i]] || {};
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

            // Apply settings that need immediate effect
            if (config.apply) {
                config.apply(element.value);
            }
        });
    }

    saveSettings() {
        Object.entries(this.settingsConfig).forEach(([id, config]) => {
            if (!config.type) return;

            const element = this.getElement(id);
            if (!element) return;

            let value = config.setter ? config.setter(element.value) : element.value;

            if (config.storage === 'local') {
                if (value) {
                    localStorage.setItem(id, value);
                    if (config.apply) config.apply(value); // Apply immediately if needed
                }
            } else if (config.storage === 'state') {
                this.setNestedValue(this.state, config.defaultKey, value);
                if (config.defaultKey.startsWith('openaiSettings')) {
                    this.setNestedValue(this.openaiSettings, config.defaultKey.split('.')[1], value);
                }
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

            // Add Escape key listener when popup is opened
            this.handleEscape = (event) => {
                if (event.key === 'Escape' && !popup.classList.contains('hidden')) {
                    this.closePopup();
                }
            };
            document.addEventListener('keydown', this.handleEscape);
        } else {
            console.error('Cannot open popup: settings-popup element not found');
        }
    }

    closePopup() {
        const popup = document.getElementById('settings-popup');
        if (popup) {
            popup.classList.add('hidden');

            // Remove Escape key listener when popup is closed
            if (this.handleEscape) {
                document.removeEventListener('keydown', this.handleEscape);
                this.handleEscape = null; // Clear reference
            }
        } else {
            console.error('Cannot close popup: settings-popup element not found');
        }
    }

    applyTheme(theme) {
        document.body.className = `sans-serif-1 ${theme}-theme`; // Preserve sans-serif-1, set theme
    }

    applyInitialTheme() {
        const savedTheme = localStorage.getItem('theme-select') || 'dark'; // Default to dark
        this.applyTheme(savedTheme);
        const themeSelect = this.getElement('theme-select');
        if (themeSelect) themeSelect.value = savedTheme;
    }
}

function exportLocalUser() {
    const excludeKeys = ['chapterCache']; // Keys to exclude from export
    const storageData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!excludeKeys.includes(key)) { // Only include keys not in excludeKeys
            storageData[key] = localStorage.getItem(key);
        }
    }
    const jsonString = JSON.stringify(storageData); // Tightest JSON
    const compressed = pako.gzip(jsonString); // Compress with gzip
    return btoa(String.fromCharCode.apply(null, compressed)); // Convert binary to Base64
}

function importLocalUser(encodedData) {
    try {
        // Trim leading/trailing whitespace and remove all internal whitespace
        const cleanedData = encodedData.trim().replace(/\s+/g, '');
        const binaryString = atob(cleanedData); // Decode Base64 to binary
        const compressed = new Uint8Array(binaryString.split('').map(char => char.charCodeAt(0))); // Convert to byte array
        const jsonString = pako.ungzip(compressed, { to: 'string' }); // Decompress to string
        const storageData = JSON.parse(jsonString);
        if (typeof storageData !== 'object' || storageData === null) {
            throw new Error('Invalid JSON: Must be an object');
        }
        Object.entries(storageData).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    } catch (error) {
        console.error('Failed to import user data from compressed Base64:', error.message);
    }
}

// Usage (assuming config.js is loaded first)
loadState(); // Initialize state and openaiSettings
const settingsManager = new SettingsManager(defaults, state, openaiSettings); // Ensure defaults includes theme if needed
startStorageMonitoring(); // Periodically monitor and prune caches