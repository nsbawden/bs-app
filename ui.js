// ui.js
const bookSelect = document.getElementById('book-select');
const chapterSelect = document.getElementById('chapter-select');
const verseSelect = document.getElementById('verse-select');
const versionSelect = document.getElementById('version-select');
const verseDisplay = document.getElementById('verse-display');
const aiPrompt = document.getElementById('ai-prompt');
const aiSubmit = document.getElementById('ai-submit');
const aiOutput = document.getElementById('ai-output');
const aiToggle = document.getElementById('ai-toggle');
const aiPopup = document.getElementById('ai-popup');
const aiResponseInput = document.getElementById('ai-response-input');
const aiResponseSubmit = document.getElementById('ai-response-submit');
const settingsBtn = document.getElementById('settings-btn');
const settingsPopup = document.getElementById('settings-popup');
const maxHistoryInput = document.getElementById('max-history-length');
const temperatureInput = document.getElementById('temperature');
const openaiModelSelect = document.getElementById('openai-model');
const openaiApiKeyInput = document.getElementById('openai-api-key');
const maxTokensInput = document.getElementById('max-tokens');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');

settingsBtn.addEventListener('click', () => {
    // Set initial values from config.js
    maxHistoryInput.value = parseInt(localStorage.getItem('maxHistoryLength')) || defaults.maxHistoryLength;
    temperatureInput.value = openaiSettings.temperature;
    openaiModelSelect.value = openaiSettings.model;
    maxTokensInput.value = openaiSettings.maxTokens;
    openaiApiKeyInput.value = localStorage.getItem('openAI_apiKey');

    settingsPopup.classList.toggle('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    const newMaxHistoryLength = parseInt(maxHistoryInput.value) || defaults.maxHistoryLength;
    openaiSettings.temperature = parseFloat(temperatureInput.value) || defaults.openaiSettings.temperature;
    openaiSettings.model = openaiModelSelect.value;
    openaiSettings.maxTokens = parseInt(maxTokensInput.value) || defaults.openaiSettings.maxTokens;

    let apikey = openaiApiKeyInput.value.trim();
    if (apikey) {
        localStorage.setItem('openAI_apiKey', apikey);
    }

    // Clamp values to valid ranges
    openaiSettings.temperature = Math.max(0, Math.min(2, openaiSettings.temperature));
    openaiSettings.maxTokens = Math.max(50, Math.min(4096, openaiSettings.maxTokens));

    // Trim history if needed
    if (state.aiHistory.length > newMaxHistoryLength) {
        state.aiHistory = state.aiHistory.slice(-newMaxHistoryLength);
    }
    localStorage.setItem('maxHistoryLength', newMaxHistoryLength);

    saveState();
    settingsPopup.classList.add('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsPopup.classList.add('hidden');
});

bookSelect.addEventListener('change', () => {
    state.currentVerse.book = bookSelect.value;
    state.currentVerse.chapter = 1;
    state.currentVerse.verse = 1;
    updateChapters();
});

chapterSelect.addEventListener('change', () => {
    state.currentVerse.chapter = parseInt(chapterSelect.value);
    state.currentVerse.verse = 1;
    updateChapters();
});

verseSelect.addEventListener('change', () => {
    state.currentVerse.verse = parseInt(verseSelect.value);
    refreshDisplay();
});

versionSelect.addEventListener('change', () => {
    state.bibleVersion = versionSelect.value;
    fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion).then(data => {
        if (state.currentVerse.verse > data.verses.length) {
            state.currentVerse.verse = 1;
        }
        refreshDisplay();
    });
});

verseDisplay.addEventListener('click', (e) => {
    const verseSpan = e.target.closest('.verse');
    if (verseSpan) {
        document.querySelectorAll('.verse').forEach(v => v.classList.remove('selected'));
        verseSpan.classList.add('selected');
        state.currentVerse.verse = parseInt(verseSpan.dataset.verse);
        verseSelect.value = state.currentVerse.verse;
        saveState();
    }
});

function submitAIQuery() {
    const question = aiPrompt.value.trim();
    if (question) {
        queryAI(question);
        aiPrompt.value = '';
    }
}

aiSubmit.addEventListener('click', submitAIQuery);

aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitAIQuery();
    }
});

aiToggle.addEventListener('click', () => {
    if (aiOutput.classList.contains('expanded')) {
        aiOutput.classList.remove('expanded');
        aiToggle.textContent = 'Expand';
    } else {
        aiOutput.classList.add('expanded');
        aiToggle.textContent = 'Collapse';
    }
});

if (aiOutput.innerHTML) {
    aiOutput.classList.add('expanded');
    aiToggle.textContent = 'Collapse';
} else {
    aiOutput.classList.remove('expanded');
    aiToggle.textContent = 'Expand';
}

function showNotePopup(reference, verseDiv, existingNote) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.note-popup');
    if (existingPopup) existingPopup.remove();

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'note-popup';
    popup.style.position = 'absolute';
    popup.style.left = `${verseDiv.offsetLeft}px`;
    popup.style.top = `${verseDiv.offsetTop + verseDiv.offsetHeight}px`;
    popup.style.background = '#2A2A2A';
    popup.style.color = '#F0F0F0';
    popup.style.padding = '10px';
    popup.style.border = '1px solid #4A704A';
    popup.style.zIndex = '1000';
    popup.style.maxWidth = '400px';

    // Textarea for note
    const textarea = document.createElement('textarea');
    textarea.value = existingNote;
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.background = '#1A1A1A';
    textarea.style.color = '#F0F0F0';
    textarea.style.border = '1px solid #4A704A';

    // Save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.background = '#4A704A';
    saveButton.style.color = '#F0F0F0';
    saveButton.style.border = 'none';
    saveButton.style.padding = '5px 10px';
    saveButton.style.marginRight = '5px';
    saveButton.onclick = () => {
        const note = textarea.value.trim();
        if (note) {
            saveNote(reference, note); // Save non-empty note
        } else {
            deleteNote(reference); // Remove note if empty
        }
        popup.remove();
        refreshDisplay(); // Refresh the display to update styling
    };

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.background = '#4A704A';
    cancelButton.style.color = '#F0F0F0';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '5px 10px';
    cancelButton.onclick = () => popup.remove();

    // Assemble popup
    popup.appendChild(textarea);
    popup.appendChild(saveButton);
    popup.appendChild(cancelButton);
    document.body.appendChild(popup);

    // Focus textarea
    textarea.focus();
}