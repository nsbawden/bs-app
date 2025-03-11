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
const topBarToggle = document.getElementById('top-bar-toggle');
const topBarControls = document.querySelector('.top-bar-controls');
const topBarSummary = document.getElementById('top-bar-summary');
const topBar = document.querySelector('.top-bar');

// Book/Chapter/Verse selection
bookSelect.addEventListener('change', () => {
    state.currentVerse.book = bookSelect.value;
    state.currentVerse.chapter = 1;
    state.currentVerse.verse = 1;
    updateChapters();
    updateTopBarSummary();
});

chapterSelect.addEventListener('change', () => {
    state.currentVerse.chapter = parseInt(chapterSelect.value);
    state.currentVerse.verse = 1;
    updateChapters();
    updateTopBarSummary();
});

verseSelect.addEventListener('change', () => {
    state.currentVerse.verse = parseInt(verseSelect.value);
    refreshDisplay();
    updateTopBarSummary();
});

versionSelect.addEventListener('change', () => {
    state.bibleVersion = versionSelect.value;
    getApiSource();
    fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion).then(data => {
        if (state.currentVerse.verse > data.verses.length) {
            state.currentVerse.verse = 1;
        }
        refreshDisplay();
        updateTopBarSummary();
    });
});

// Single click on a verse or the verse view
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

verseDisplay.addEventListener('contextmenu', (e) => {
    if (e.shiftKey) {
        // Clear any selection caused by Shift + right-click
        window.getSelection().removeAllRanges();
        // Allow default browser context menu without selection
        return;
    }
    e.preventDefault(); // Prevent the default context menu otherwise
    const verseSpan = e.target.closest('.verse');
    if (verseSpan) {
        showVerseMenu(verseSpan, e);
        setTimeout(() => {
            window.getSelection().removeAllRanges();
        }, 0);
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
    const topBarHeight = topBar.offsetHeight;
    const mainVisibleHeight = 100;
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
        aiExpand();
    }
    adjustContainerMargin();
});

// Top Bar Toggle for Mobile
function updateTopBarSummary() {
    topBarSummary.textContent = `${state.currentVerse.book} ${state.currentVerse.chapter}:${state.currentVerse.verse} (${state.bibleVersion.toUpperCase()})`;
}

function toggleTopBar(e) {
    // Prevent toggle if clicking the list button or settings btn or within expanded controls
    if (e.target.id === 'show-list' || e.target.id === 'settings-btn' || topBarControls.contains(e.target)) return;
    topBarControls.classList.toggle('expanded');
    topBarControls.classList.toggle('hidden');
    topBarToggle.textContent = topBarControls.classList.contains('expanded') ? '▶' : '▼';
    adjustContainerMargin();
}

topBar.addEventListener('click', toggleTopBar);

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

// Initial summary
updateTopBarSummary();

function scrollToSelectedVerse(topBuffer = true) {
    const selectedVerse = document.querySelector('.verse.selected');
    if (!selectedVerse || !verseDisplay) return;

    const lineHeight = parseInt(window.getComputedStyle(selectedVerse).lineHeight) || 20;
    const bufferLines = topBuffer ? 3 : 0;
    const bufferOffset = lineHeight * bufferLines;

    const rect = selectedVerse.getBoundingClientRect();
    const containerRect = verseDisplay.getBoundingClientRect();
    const currentScrollTop = verseDisplay.scrollTop;

    // Calculate visibility boundaries
    const verseTop = rect.top - containerRect.top + currentScrollTop;
    const verseBottom = verseTop + rect.height;
    const viewTop = currentScrollTop + bufferOffset;
    const viewBottom = currentScrollTop + containerRect.height;

    // Check if verse is fully visible (with buffer at top)
    const isFullyVisible =
        verseTop >= viewTop &&
        verseBottom <= viewBottom;

    // Only scroll if verse is not fully visible
    if (!isFullyVisible) {
        const targetPosition = verseTop - bufferOffset;
        verseDisplay.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
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

function showVerseMenu(verseSpan, event) {
    const existingPopup = document.querySelector('.verse-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'verse-popup';
    const verseNumber = verseSpan.dataset.verse;
    const reference = `${state.currentVerse.book}/${state.currentVerse.chapter}/${verseNumber}`;
    const bookmarks = getBookmarks();
    const isBookmarked = bookmarks.includes(reference);

    const menuItems = [
        {
            text: isBookmarked ? 'Remove Bookmark' : 'Bookmark',
            action: isBookmarked ? () => removeBookmark(reference) : () => addBookmark(reference)
        },
        { text: 'Add/Edit note', action: () => showNotePopup(reference, verseSpan) },
        { text: 'Copy to clipboard', action: () => copyVerseToClipboard(verseSpan) },
        { text: 'Clear All Bookmarks', action: () => clearBookmarks() }
    ];

    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'popup-item';
        menuItem.textContent = item.text;
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.action();
            popup.remove();
        });
        popup.appendChild(menuItem);
    });

    popup.style.position = 'absolute';
    popup.style.left = `${event.pageX}px`;
    popup.style.top = `${event.pageY}px`;

    document.body.appendChild(popup);
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
        popup.style.left = `${window.innerWidth - popupRect.width}px`;
    }
    if (popupRect.bottom > window.innerHeight) {
        popup.style.top = `${event.pageY - popupRect.height}px`;
    }

    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closePopup);
    }, 0);
}

function getBookmarks() {
    const bookmarks = localStorage.getItem('bookmarks');
    return bookmarks ? JSON.parse(bookmarks) : [];
}

function saveBookmarks(bookmarks) {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function addBookmark(reference) {
    const bookmarks = getBookmarks();
    if (!bookmarks.includes(reference)) {
        bookmarks.push(reference);
        saveBookmarks(bookmarks);
        console.log(`Bookmarked ${reference}`);
        rebuildBookmarksList(); // Update the list immediately
    } else {
        console.log(`${reference} is already bookmarked`);
    }
}

// Function to remove a bookmark
function removeBookmark(reference) {
    const bookmarks = getBookmarks();
    const updatedBookmarks = bookmarks.filter(b => b !== reference);
    saveBookmarks(updatedBookmarks);
    console.log(`Removed bookmark ${reference}`);
    rebuildBookmarksList(); // Update the list immediately
}

// Function to clear all bookmarks
function clearBookmarks() {
    saveBookmarks([]);
    console.log('Cleared all bookmarks');
    rebuildBookmarksList(); // Update the list immediately
}

function copyVerseToClipboard(verseSpan) {
    const verseTextSpan = verseSpan.querySelector('.verse-text');
    const text = verseTextSpan ? verseTextSpan.textContent : verseSpan.textContent;
    navigator.clipboard.writeText(text)
        .then(() => console.log(`Copied verse ${verseSpan.dataset.verse} to clipboard`))
        .catch(err => console.error('Failed to copy: ', err));
}

// Adjust container margin and height based on top bar
function adjustContainerMargin() {
    const topBar = document.querySelector('.top-bar');
    const container = document.querySelector('.container');
    const topBarHeight = topBar.offsetHeight;
    container.style.marginTop = `${topBarHeight}px`;
    container.style.height = `calc(100vh - ${topBarHeight}px)`;
}

// Run on load and resize
window.addEventListener('DOMContentLoaded', () => {
    adjustContainerMargin();
    updateTopBarSummary();
});
window.addEventListener('resize', adjustContainerMargin);