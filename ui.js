// ui.js
const bookSelect = document.getElementById('book-select');
const chapterSelect = document.getElementById('chapter-select');
const verseSelect = document.getElementById('verse-select');
const versionSelect = document.getElementById('version-select');
const verseDisplay = document.getElementById('verse-display');
const aiPrompt = document.getElementById('ai-prompt');
const aiSubmit = document.getElementById('ai-submit');
const aiTranslate = document.getElementById('ai-translate');
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
    if (aiHistory.length > newMaxHistoryLength) {
        aiHistory = aiHistory.slice(-newMaxHistoryLength);
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
    getApiSource();
    fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion).then(data => {
        if (state.currentVerse.verse > data.verses.length) {
            state.currentVerse.verse = 1;
        }
        refreshDisplay();
    });
});

verseDisplay.addEventListener('click', (e) => {
    aiCollapse();
    const verseSpan = e.target.closest('.verse');
    if (verseSpan) {
        document.querySelectorAll('.verse').forEach(v => v.classList.remove('selected'));
        verseSpan.classList.add('selected');
        state.currentVerse.verse = parseInt(verseSpan.dataset.verse);
        verseSelect.value = state.currentVerse.verse;
        saveState();
    }
});

aiOutput.addEventListener('click', (e) => {
    aiExpand();
});

function submitAIQuery() {
    const question = aiPrompt.value.trim();
    const context = {
        book: state.currentVerse.book,
        chapter: state.currentVerse.chapter,
        verse: state.currentVerse.verse,
        version: state.bibleVersion.toUpperCase(),
        system: "Answer from Bible with multiple verses and explanations, formatted in Markdown."
    };
    const fullQuestion = `In ${context.book} ${context.chapter}:${context.verse} (${context.version}): ${question}`;

    if (question) {
        // Initialize the timer display
        let secondsElapsed = 0;
        aiOutput.textContent = `asking... (${secondsElapsed}) ${fullQuestion}`;

        // Start a timer to update the display every second
        const timer = setInterval(() => {
            secondsElapsed++;
            aiOutput.textContent = `asking... (${secondsElapsed}) ${fullQuestion}`;
        }, 1000);

        // Query the AI and clear the timer when done
        queryAI(fullQuestion, context, timer);
        aiPrompt.value = '';
    }
}

aiSubmit.addEventListener('click', submitAIQuery);

function submitAITranslate() {
    const context = {
        book: state.currentVerse.book,
        chapter: state.currentVerse.chapter,
        verse: state.currentVerse.verse,
        version: state.bibleVersion.toUpperCase(),
        system: "format answer in Markdown",
        temperature: 1
    };

    const verseReference = `${context.book} ${context.chapter}:${context.verse}`;
    const fullQuestion = constructTranslationPrompt(verseReference);

    // Create a unique cache key based on book, chapter, verse, and temperature
    const cacheKey = `${context.book}-${context.chapter}-${context.verse}-${context.temperature}`;

    // Check the cache first
    loadTranslationCache(); // Ensure cache is loaded
    if (translationCache[cacheKey]) {
        console.log(`Cache hit for translation: ${cacheKey}`);
        // Use displayResult to process cached response consistently
        displayResult(fullQuestion, translationCache[cacheKey].response);
        return; // Exit early after displaying cached result
    }

    // Initialize the timer display for uncached queries
    let secondsElapsed = 0;
    aiOutput.textContent = `translating... (${secondsElapsed} sec)`;

    // Start a timer to update the display every second
    const timer = setInterval(() => {
        secondsElapsed++;
        aiOutput.textContent = `translating... (${secondsElapsed} sec)`;
    }, 1000);

    // Query the AI with caching flag
    queryAI(fullQuestion, context, timer, true); // true indicates translation caching
}

// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, use root meanings and consider the verse’s broader context within the original passage or book, based solely on the literal terms of the original language and content; if idiomatic, note the literal roots but adapt the readable version to reflect the phrase’s natural sense in context. Avoid doctrinal bias; use neutral swaps (e.g., 'children' for 'things born') for readability. Give both literal and easily readable final translations ensuring the readable version is clear, grammatically complete, and flows naturally in English while remaining as close as possible to the literal root meanings.`;
// }

function constructTranslationPrompt(verseReference) {
    return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, use root meanings and consider the verse’s broader context within the original passage or book, based solely on the literal terms of the original language and content; if idiomatic, note the literal roots explicitly in the literal translation and adapt the readable version to reflect the phrase’s natural sense in context. Avoid doctrinal bias; use neutral swaps (e.g., 'children' for 'things born') for readability. Give both literal and easily readable final translations; ensure the literal version is grammatically coherent using root meanings, and the readable version is clear, grammatically complete, and flows naturally in English while remaining as close as possible to the literal root meanings.`;
}


aiTranslate.addEventListener('click', submitAITranslate);

aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitAIQuery();
    }
});

function aiExpand() {
    aiOutput.classList.add('expanded');
    aiToggle.textContent = '▼';
}

function aiCollapse() {
    aiOutput.classList.remove('expanded');
    aiToggle.textContent = '▲';
}

aiToggle.addEventListener('click', () => {
    if (aiOutput.classList.contains('expanded')) {
        aiCollapse();
    } else {
        aiExpand();
    }
});

// if (aiOutput.innerHTML) {
//     aiOutput.classList.add('expanded');
//     aiToggle.textContent = '▼';
// } else {
//     aiOutput.classList.remove('expanded');
//     aiToggle.textContent = '▲';
// }

// function showNotePopup(reference, verseDiv, existingNote) {
//     // Remove any existing popup
//     const existingPopup = document.querySelector('.note-popup');
//     if (existingPopup) existingPopup.remove();

//     // Create popup
//     const popup = document.createElement('div');
//     popup.className = 'note-popup';
//     popup.style.position = 'absolute';
//     popup.style.top = `${verseDiv.offsetTop + verseDiv.offsetHeight}px`;
//     popup.style.background = '#2A2A2A';
//     popup.style.color = '#F0F0F0';
//     popup.style.padding = '10px';
//     popup.style.border = '1px solid #4A704A';
//     popup.style.zIndex = '1000';
//     popup.style.maxWidth = '400px';

//     // Textarea for note
//     const textarea = document.createElement('textarea');
//     textarea.value = existingNote || '';
//     textarea.style.width = '100%';
//     textarea.style.height = '150px';
//     textarea.style.background = '#1A1A1A';
//     textarea.style.color = '#F0F0F0';
//     textarea.style.border = '1px solid #4A704A';

//     // Save button
//     const saveButton = document.createElement('button');
//     saveButton.textContent = 'Save';
//     saveButton.style.background = '#4A704A';
//     saveButton.style.color = '#F0F0F0';
//     saveButton.style.border = 'none';
//     saveButton.style.padding = '5px 10px';
//     saveButton.style.marginRight = '5px';
//     saveButton.onclick = () => {
//         const note = textarea.value.trim();
//         if (note) {
//             saveNote(reference, note);
//         } else {
//             deleteNote(reference);
//         }
//         cleanupAndRemove();
//         refreshDisplay();
//     };

//     // Cancel button
//     const cancelButton = document.createElement('button');
//     cancelButton.textContent = 'Cancel';
//     cancelButton.style.background = '#4A704A';
//     cancelButton.style.color = '#F0F0F0';
//     cancelButton.style.border = 'none';
//     cancelButton.style.padding = '5px 10px';
//     cancelButton.onclick = cleanupAndRemove;

//     // Assemble popup
//     popup.appendChild(textarea);
//     popup.appendChild(saveButton);
//     popup.appendChild(cancelButton);
//     document.body.appendChild(popup);

//     // Position adjustment: Ensure popup stays within viewport
//     const verseLeft = verseDiv.offsetLeft;
//     const popupWidth = popup.offsetWidth;
//     const viewportWidth = window.innerWidth;
//     let newLeft = verseLeft;
//     if (verseLeft + popupWidth > viewportWidth) {
//         newLeft = viewportWidth - popupWidth;
//         newLeft = Math.max(0, newLeft);
//     }
//     popup.style.left = `${newLeft}px`;

//     // Escape key listener
//     const handleEscape = (event) => {
//         if (event.key === 'Escape') {
//             cleanupAndRemove();
//         }
//     };
//     document.addEventListener('keydown', handleEscape);

//     // Cleanup function to remove popup and listener
//     function cleanupAndRemove() {
//         document.removeEventListener('keydown', handleEscape);
//         popup.remove();
//     }

//     // Focus textarea
//     textarea.focus();
// }

function scrollToSelectedVerse() {
    const selectedVerse = document.querySelector('.verse.selected');
    if (!selectedVerse) return;

    const verseDisplay = document.getElementById('verse-display');
    if (!verseDisplay) return; // Exit if the container isn't found

    const lineHeight = parseInt(window.getComputedStyle(selectedVerse).lineHeight) || 20;
    const bufferLines = 3;
    const offset = lineHeight * bufferLines;

    // Get position relative to the verse-display container
    const rect = selectedVerse.getBoundingClientRect();
    const containerRect = verseDisplay.getBoundingClientRect();
    const topPosition = rect.top - containerRect.top + verseDisplay.scrollTop;

    // Scroll the verse-display container
    verseDisplay.scrollTo({
        top: topPosition - offset,
        behavior: 'smooth'
    });
}

function adjustTabCount() {
    let tabCount = aiHistory.length;
    const tabs = document.querySelectorAll('.tab');

    // Ensure tabCount doesn't exceed 10
    tabCount = Math.min(tabCount, 10);

    // Show tabs up to tabCount and hide the rest
    tabs.forEach((tab, index) => {
        if (index < tabCount) {
            tab.style.display = 'block'; // Show tab
        } else {
            tab.style.display = 'none'; // Hide tab
        }
    });
}

function setActiveTab(tabNum) {
    let tabs = document.querySelectorAll('.tab');
    // Remove active class from all tabs
    tabs.forEach(t => t.classList.remove('active'));
    // Add active class to clicked tab
    tabs[tabNum - 1].classList.add('active');
}

// Add question Tab handlers
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        let tabNum = parseInt(tab.dataset.tab);
        setActiveTab(tabNum);
        // When tab is clicked
        if (aiHistory[tabNum - 1]) {
            displayResult(aiHistory[tabNum - 1].question, aiHistory[tabNum - 1].answer);
        } else {
            console.log(`Tab ${tabNum} clicked without content`);
        }
    });
});

function goToNote(index) {
    const notes = getNotes();
    const noteKeys = Object.keys(notes);
    if (index >= 0 && index < noteKeys.length) {
        const key = noteKeys[index];
        const parts = key.split('/');
        document.location = `index.html?book=${encodeURIComponent(parts[0])}&chapter=${parts[1]}&verse=${parts[2]}`;
    } else {
        console.error("Invalid note index:", index);
    }
}

function goToTag(index) {
    const tags = JSON.parse(localStorage.getItem('tagStorage') || '{}');
    const tagKeys = Object.keys(tags); // Original case tags
    const selectedTag = tagKeys[index]; // e.g., "#SermonOnTheMount"
    const noteKeys = tags[selectedTag];

    if (noteKeys.length === 1) {
        const parts = noteKeys[0].split('/');
        document.location = `index.html?book=${encodeURIComponent(parts[0])}&chapter=${parts[1]}&verse=${parts[2]}`;
    } else {
        const tagTab = [{
            label: `${selectedTag} Locations`,
            items: noteKeys.map(key => {
                const [book, chapter, verse] = key.split('/');
                return { label: `${selectedTag} ${book} ${chapter}:${verse}` };
            }),
            editable: false
        }];

        showListPopup(tagTab).then(result => {
            if (result.itemIndex >= 0) {
                const selectedNoteKey = noteKeys[result.itemIndex];
                const parts = selectedNoteKey.split('/');
                document.location = `index.html?book=${encodeURIComponent(parts[0])}&chapter=${parts[1]}&verse=${parts[2]}`;
            }
        });
    }
}

function renameTag(oldTag, newTag) {
    if (oldTag === newTag) {
        return false;
    }
    if (!newTag.startsWith('#')) {
        console.log("Invalid rename: new tag must start with '#'");
        return false;
    }
    const notes = getNotes(); // { "1 Corinthians/4/2": "This note #judgment", ... }
    let tagFound = false;
    const tagRegex = new RegExp(`${oldTag}\\b`, 'gi');

    Object.entries(notes).forEach(([key, note]) => {
        if (tagRegex.test(note)) {
            tagFound = true;
            notes[key] = note.replaceAll(tagRegex, newTag);
        }
    });

    if (!tagFound) {
        console.log(`Tag '${oldTag}' not found in any notes`);
        return false;
    }

    localStorage.setItem('bibleNotes', JSON.stringify(notes));
    return true;
}

function constructTabs() {
    const notes = getNotes();
    const tagStorage = {};
    const tagCaseMap = {}; // Maps lowercase tag to preferred case

    Object.entries(notes).forEach(([key, note]) => {
        const tags = (note.match(/#\w+\b/g) || []);
        tags.forEach(tag => {
            const lowerTag = tag.toLowerCase(); // For case-insensitive comparison
            if (!tagCaseMap[lowerTag]) {
                tagCaseMap[lowerTag] = tag; // Store first-seen case
                tagStorage[tag] = []; // Use original case as key
            }
            const preferredTag = tagCaseMap[lowerTag];
            if (!tagStorage[preferredTag].includes(key)) {
                tagStorage[preferredTag].push(key);
            }
        });
    });

    localStorage.setItem('tagStorage', JSON.stringify(tagStorage));

    return [
        {
            label: "questions",
            items: savedQuestions,
            editable: true
        },
        {
            label: "notes",
            items: getNotesList(),
            editable: false
        },
        {
            label: "tags",
            items: Object.keys(tagStorage).map(tag => ({
                label: tag,
                editHandler: (oldName, newName) => renameTag(oldName, newName)
            })),
            editable: true
        }
    ];
}

// Example: Update a note and rebuild tabs
// function updateNote(key, newText) {
//     const notes = getNotes();
//     notes[key] = newText;
//     localStorage.setItem('notes', JSON.stringify(notes)); // Persist notes
//     constructTabs(); // Rebuild tabs and tagStorage
// }

document.getElementById('show-list').addEventListener('click', async () => {
    const tabs = constructTabs();
    const result = await showListPopup(tabs);
    if (result.itemIndex >= 0) {
        console.log(`Selected tab ${result.tabIndex}, item ${result.itemIndex}: ${tabs[result.tabIndex].items[result.itemIndex].label}`);
        switch (result.tabIndex) {
            case 0: // Questions
                const question = savedQuestions[result.itemIndex];
                displayResult(question.label, question.data);
                break;
            case 1: // Notes
                goToNote(result.itemIndex);
                break;
            case 2: // Tags
                let newLabel = tabs[2].items[result.itemIndex].label;
                goToTag(result.itemIndex);
                break;
        }
    } else {
        console.log("Popup canceled");
    }
});