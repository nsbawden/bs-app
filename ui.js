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

// Book/Chapter/Verse selection
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

aiOutput.addEventListener('click', () => {
    aiExpand();
});

// AI Query Submission
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
        let secondsElapsed = 0;
        aiOutput.textContent = `asking... (${secondsElapsed}) ${fullQuestion}`;
        const timer = setInterval(() => {
            secondsElapsed++;
            aiOutput.textContent = `asking... (${secondsElapsed}) ${fullQuestion}`;
        }, 1000);
        queryAI(fullQuestion, context, timer);
        aiPrompt.value = '';
    }
}

aiSubmit.addEventListener('click', submitAIQuery);

// AI Translation
function submitAITranslate() {
    const context = {
        book: state.currentVerse.book,
        chapter: state.currentVerse.chapter,
        verse: state.currentVerse.verse,
        version: state.bibleVersion.toUpperCase(),
        system: "format answer in Markdown",
        temperature: 1
    };
    const verseReference = `${context.book} ${context.chapter}:${context.verse} (${context.version})`;
    const fullQuestion = constructTranslationPrompt(verseReference);
    const cacheKey = `${context.book}-${context.chapter}-${context.verse}-${context.temperature}`;

    loadTranslationCache();
    if (translationCache[cacheKey]) {
        console.log(`Cache hit for translation: ${cacheKey}`);
        displayResult(fullQuestion, translationCache[cacheKey].response);
        return;
    }

    let secondsElapsed = 0;
    aiOutput.textContent = `translating... (${secondsElapsed} sec)`;
    const timer = setInterval(() => {
        secondsElapsed++;
        aiOutput.textContent = `translating... (${secondsElapsed} sec)`;
    }, 1000);
    queryAI(fullQuestion, context, timer, true);
}

function constructTranslationPrompt(verseReference) {
    return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, use root meanings and consider the verse’s broader context within the original passage or book, based solely on the literal terms of the original language and content; if idiomatic, note the literal roots explicitly in the literal translation and adapt the readable version to reflect the phrase’s natural sense in context. Avoid doctrinal and modern bias; use neutral swaps (e.g., 'children' for 'things born') for readability. At end give original English verse and both literal and easily readable final translations; ensure the literal version is grammatically coherent using root meanings, and the readable version is clear, grammatically complete, and flows naturally in English while remaining as close as possible to the literal root meanings.`;
}

aiTranslate.addEventListener('click', submitAITranslate);

aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitAIQuery();
    }
});

// AI Output Expand/Collapse
function aiExpand() {
    const footer = document.querySelector('footer');
    footer.classList.add('expanded');
    document.getElementById('ai-toggle').textContent = '▼';

    const topBar = document.querySelector('.top-bar');
    const topBarHeight = topBar.offsetHeight; // Dynamic height
    const mainVisibleHeight = 100; // Desired visible main height when footer expands
    const footerPadding = 20;
    const aiInputHeight = document.querySelector('.ai-input-container').offsetHeight;
    const tabsHeight = document.querySelector('.tabs-container').offsetHeight;
    const availableHeight = window.innerHeight - topBarHeight - mainVisibleHeight - footerPadding - aiInputHeight - tabsHeight;

    aiOutput.style.setProperty('--ai-output-max-height', `${availableHeight}px`);
    aiOutput.style.setProperty('--ai-output-overflow', 'auto');
    setTimeout(() => scrollToSelectedVerse(false), 200);
}

function aiCollapse() {
    const footer = document.querySelector('footer');
    footer.classList.remove('expanded');
    document.getElementById('ai-toggle').textContent = '▲';

    aiOutput.style.setProperty('--ai-output-max-height', '3em');
    aiOutput.style.setProperty('--ai-output-overflow', 'hidden');
}

aiToggle.addEventListener('click', () => {
    document.querySelector('footer').classList.contains('expanded') ? aiCollapse() : aiExpand();
});

window.addEventListener('resize', () => {
    if (document.querySelector('footer').classList.contains('expanded')) {
        aiExpand(); // Recalculate heights on resize
    }
    adjustContainerMargin(); // Sync container position
});

function scrollToSelectedVerse(topBuffer = true) {
    const selectedVerse = document.querySelector('.verse.selected');
    if (!selectedVerse || !verseDisplay) return;
    const lineHeight = parseInt(window.getComputedStyle(selectedVerse).lineHeight) || 20;
    const bufferLines = topBuffer ? 3 : 0;
    const offset = lineHeight * bufferLines;
    const rect = selectedVerse.getBoundingClientRect();
    const containerRect = verseDisplay.getBoundingClientRect();
    const topPosition = rect.top - containerRect.top + verseDisplay.scrollTop;
    verseDisplay.scrollTo({ top: topPosition - offset, behavior: 'smooth' });
}

// Tab Management
function adjustTabCount() {
    const tabCount = Math.min(aiHistory.length, 10);
    document.querySelectorAll('.tab').forEach((tab, index) => {
        tab.style.display = index < tabCount ? 'block' : 'none';
    });
}

function setActiveTab(tabNum) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabNum}"]`).classList.add('active');
    aiExpand();
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabNum = parseInt(tab.dataset.tab);
        setActiveTab(tabNum);
        if (aiHistory[tabNum - 1]) {
            displayResult(aiHistory[tabNum - 1].question, aiHistory[tabNum - 1].answer);
        } else {
            console.log(`Tab ${tabNum} clicked without content`);
        }
    });
});

// Navigation Functions
function goToNote(index) {
    const notes = getNotes();
    const noteKeys = Object.keys(notes);
    if (index >= 0 && index < noteKeys.length) {
        const [book, chapter, verse] = noteKeys[index].split('/');
        document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
    } else {
        console.error("Invalid note index:", index);
    }
}

function goToTag(index) {
    const tags = JSON.parse(localStorage.getItem('tagStorage') || '{}');
    const tagKeys = Object.keys(tags);
    const selectedTag = tagKeys[index];
    const noteKeys = tags[selectedTag];
    if (noteKeys.length === 1) {
        const [book, chapter, verse] = noteKeys[0].split('/');
        document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
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
                const [book, chapter, verse] = noteKeys[result.itemIndex].split('/');
                document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
            }
        });
    }
}

function renameTag(oldTag, newTag) {
    if (oldTag === newTag || !newTag.startsWith('#')) {
        console.log("Invalid rename:", oldTag, newTag);
        return false;
    }
    const notes = getNotes();
    let tagFound = false;
    const tagRegex = new RegExp(`${oldTag}\\b`, 'gi');
    Object.entries(notes).forEach(([key, note]) => {
        if (tagRegex.test(note)) {
            tagFound = true;
            notes[key] = note.replaceAll(tagRegex, newTag);
        }
    });
    if (!tagFound) {
        console.log(`Tag '${oldTag}' not found`);
        return false;
    }
    localStorage.setItem('bibleNotes', JSON.stringify(notes));
    return true;
}

function constructTabs() {
    const notes = getNotes();
    const tagStorage = {};
    const tagCaseMap = {};
    Object.entries(notes).forEach(([key, note]) => {
        const tags = (note.match(/#\w+\b/g) || []);
        tags.forEach(tag => {
            const lowerTag = tag.toLowerCase();
            if (!tagCaseMap[lowerTag]) {
                tagCaseMap[lowerTag] = tag;
                tagStorage[tag] = [];
            }
            const preferredTag = tagCaseMap[lowerTag];
            if (!tagStorage[preferredTag].includes(key)) {
                tagStorage[preferredTag].push(key);
            }
        });
    });
    localStorage.setItem('tagStorage', JSON.stringify(tagStorage));
    return [
        { label: "questions", items: savedQuestions, editable: true },
        { label: "notes", items: getNotesList(), editable: false },
        {
            label: "tags",
            items: Object.keys(tagStorage).map(tag => ({
                label: tag,
                editHandler: (oldName, newName) => renameTag(oldName, newName)
            })),
            editable: true
        },
        {
            label: "writings",
            items: writings.map(writing => ({
                label: writing.author ? `${writing.label} - ${writing.author}` : writing.label,
                handler: () => {
                    fetch(writing.filename)
                        .then(response => response.ok ? response.text() : Promise.reject(`Failed to load ${writing.filename}`))
                        .then(content => showBook(writing.label, content))
                        .catch(error => showBook(writing.label, `# Error\nCould not load ${writing.filename}: ${error}`));
                }
            })),
            editable: false
        }
    ];
}

document.getElementById('show-list').addEventListener('click', async () => {
    const tabs = constructTabs();
    const result = await showListPopup(tabs);
    if (result.itemIndex >= 0) {
        console.log(`Selected tab ${result.tabIndex}, item ${result.itemIndex}: ${tabs[result.tabIndex].items[result.itemIndex].label}`);
        switch (result.tabIndex) {
            case 0: displayResult(savedQuestions[result.itemIndex].label, savedQuestions[result.itemIndex].data); break;
            case 1: goToNote(result.itemIndex); break;
            case 2: goToTag(result.itemIndex); break;
            case 3: tabs[3].items[result.itemIndex].handler(); break;
            default: console.log("Unhandled tab index:", result.tabIndex);
        }
    }
});

// Adjust container margin and height based on top bar
function adjustContainerMargin() {
    const topBar = document.querySelector('.top-bar');
    const container = document.querySelector('.container');
    const topBarHeight = topBar.offsetHeight;
    container.style.marginTop = `${topBarHeight}px`;
    container.style.height = `calc(100vh - ${topBarHeight}px)`;
}

// Run on load and resize
window.addEventListener('DOMContentLoaded', adjustContainerMargin);
window.addEventListener('resize', adjustContainerMargin);