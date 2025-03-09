// settings.js
const settingsBtn = document.getElementById('settings-btn');
const settingsPopup = document.getElementById('settings-popup');
const settingsCloseBtn = document.getElementById('settings-close');
const maxHistoryInput = document.getElementById('max-history-length');
const temperatureInput = document.getElementById('temperature');
const openaiModelSelect = document.getElementById('openai-model');
const maxTokensInput = document.getElementById('max-tokens');
const openaiApiKeyInput = document.getElementById('openai-api-key');

function addSettingsListener(id) {
    const elem = document.getElemmentById(id);
    elem.addEventListener('change', saveSettings);
    elem.addEventListener('blur', saveSettings);
}

function getSettingsLocalValue(id) {
    document.getElementById(id).value = localStorage.getItem(id) || '';
}

function setSettingsLocalValue(id) {
    localStorage.setItem(id, document.getElementById(id).value || '');
}

// Open settings popup and load current values
settingsBtn.addEventListener('click', () => {
    loadSettings();
    settingsPopup.classList.remove('hidden');
});

// Close settings popup
settingsCloseBtn.addEventListener('click', () => {
    settingsPopup.classList.add('hidden');
});

// Load initial settings from storage/config
function loadSettings() {
    maxHistoryInput.value = parseInt(localStorage.getItem('maxHistoryLength')) || defaults.maxHistoryLength;
    temperatureInput.value = openaiSettings.temperature;
    openaiModelSelect.value = openaiSettings.model;
    maxTokensInput.value = openaiSettings.maxTokens;
    openaiApiKeyInput.value = localStorage.getItem('openAI_apiKey') || '';
    getSettingsLocalValue('bibleApiKey');
    getSettingsLocalValue('esvApiKey');
}

// Save settings and clamp values
function saveSettings() {
    const newMaxHistoryLength = parseInt(maxHistoryInput.value) || defaults.maxHistoryLength;
    openaiSettings.temperature = parseFloat(temperatureInput.value) || defaults.openaiSettings.temperature;
    openaiSettings.model = openaiModelSelect.value;
    openaiSettings.maxTokens = parseInt(maxTokensInput.value) || defaults.openaiSettings.maxTokens;
    const apiKey = openaiApiKeyInput.value.trim();

    // Clamp values
    openaiSettings.temperature = Math.max(0, Math.min(2, openaiSettings.temperature));
    openaiSettings.maxTokens = Math.max(50, Math.min(4096, openaiSettings.maxTokens));

    // Update storage and history
    if (apiKey) {
        localStorage.setItem('openAI_apiKey', apiKey);
    }
    if (aiHistory.length > newMaxHistoryLength) {
        aiHistory = aiHistory.slice(-newMaxHistoryLength);
    }
    localStorage.setItem('maxHistoryLength', newMaxHistoryLength);

    setSettingsLocalValue('bibleApiKey');
    setSettingsLocalValue('esvApiKey');

    saveState(); // Assuming this persists state elsewhere
}

// Event listeners for auto-saving on change/blur
maxHistoryInput.addEventListener('change', saveSettings);
maxHistoryInput.addEventListener('blur', saveSettings);

temperatureInput.addEventListener('change', saveSettings);
temperatureInput.addEventListener('blur', saveSettings);

openaiModelSelect.addEventListener('change', saveSettings);
openaiModelSelect.addEventListener('blur', saveSettings);

maxTokensInput.addEventListener('change', saveSettings);
maxTokensInput.addEventListener('blur', saveSettings);

openaiApiKeyInput.addEventListener('change', saveSettings);
openaiApiKeyInput.addEventListener('blur', saveSettings);

addSettingsListener('bibleApiKey');
addSettingsListener('esvApiKey');

