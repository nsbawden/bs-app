// ui.js
const bookSelect = document.getElementById('book-select');
const chapterSelect = document.getElementById('chapter-select');
const verseSelect = document.getElementById('verse-select');
const versionSelect = document.getElementById('version-select');
const verseDisplay = document.getElementById('verse-display');
const aiPrompt = document.getElementById('ai-prompt');
const aiSubmit = document.getElementById('ai-submit');
const aiTranslate = document.getElementById('ai-translate');
const aiSave = document.getElementById('ai-save');
const aiOutput = document.getElementById('ai-output');
const aiToggle = document.getElementById('ai-toggle');
const aiPopup = document.getElementById('ai-popup');
const aiResponseInput = document.getElementById('ai-response-input');
const aiResponseSubmit = document.getElementById('ai-response-submit');
const topBarToggle = document.getElementById('top-bar-toggle');
const topBarControls = document.querySelector('.top-bar-controls');
const topBarSummary = document.getElementById('top-bar-summary');
const topBar = document.querySelector('.top-bar');

// General utility function for temporary notifications
function showTempNotification(message, duration = 333) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = 'temp-notification'; // Use a class instead of inline styles
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300); // Remove after fade
    }, duration); // Display for 333ms, then fade
}

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
    switch (versionSelect.value) {
        case 'custom':
            state.bookSource = 'custom';
            state.bibleVersion = state.bibleVersion || 'kjv';
            break;
        default:
            state.bookSource = 'bible';
            state.bibleVersion = versionSelect.value;
            break;
    }
    getApiSource();
    loadBooks().then(() => {
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

// djb2 hash
function hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) + char; // hash * 33 + char
    }
    return hash >>> 0; // Ensure positive number
}

function translationCacheKey(context, question) {
    return `${context.model}-${context.book}-${context.chapter}-${context.verse}-${context.temperature}-${hash(question)}`;
}

// AI Translation
function submitAITranslate() {
    const context = {
        book: state.currentVerse.book,
        chapter: state.currentVerse.chapter,
        verse: state.currentVerse.verse,
        version: state.bibleVersion.toUpperCase(),
        system: "format answer in Markdown",
        model: openaiSettings.model,
        temperature: 1
    };
    const verseReference = `${context.book} ${context.chapter}:${context.verse} (${context.version})`;
    const fullQuestion = constructTranslationPrompt(verseReference);
    const cacheKey = translationCacheKey(context, fullQuestion);

    loadTranslationCache();
    if (translationCache[cacheKey]) {
        console.log(`Cache hit for translation: ${cacheKey}`);
        translationCache[cacheKey].timestamp = Date.now(); // Update timestamp
        saveTranslationCache(); // Persist the updated cache
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

// Original
// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, use root meanings and consider the verse’s broader context within the original passage or book, based solely on the literal terms of the original language and content; if idiomatic, note the literal roots explicitly in the literal translation and adapt the readable version to reflect the phrase’s natural sense in context. Avoid doctrinal and modern bias; use neutral swaps (e.g., 'children' for 'things born') for readability. At end give original English verse and both literal and easily readable final translations; ensure the literal version is grammatically coherent using root meanings, and the readable version is clear, grammatically complete, and flows naturally in English while remaining as close as possible to the literal root meanings.`;
// }

// Good with heed emphasis
// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', 'listen under' for 'hypakouete', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, provide two versions: 1. A literal translation that strictly uses root meanings, ensuring grammatical coherence. 2. A readable translation that adapts the literal meanings into natural English, using neutral swaps for clarity (e.g., 'children' for 'things born'), while staying close to the literal roots. If idiomatic, note literal roots in the literal version and adapt the readable version for natural sense. Avoid doctrinal and modern bias. At end, give the original English verse, the literal translation, and the readable translation.`;
//     // return `Translate the Bible verse ${verseReference} from its original language to English using literal root meanings (e.g., 'to listen' for 'ἀκούω', 'listen under' or 'heed' for 'hypakouete', not 'obey'). Break down each word: prefix, stem, suffix (treat compound words as single units if historically recognized as such). List root meaning (include primary options if ambiguous) and grammatical role. For the final translation, provide two versions: 1. A literal translation that strictly uses root meanings, ensuring grammatical coherence. 2. A readable translation that adapts the literal meanings into natural English, using neutral swaps for clarity (e.g., 'children' for 'things born'), while staying close to the literal roots. If idiomatic, note literal roots in the literal version and adapt the readable version for natural sense. Avoid doctrinal and modern bias. At end, give the original English verse, the literal translation, and the readable translation.`;
// }

// Ask for multiple translations (Good but poor English)
// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original Greek to English using literal root meanings from pre-biblical Greek (before biblical influence). For each word, break down prefix, stem, suffix (treat compounds as units if historically recognized). List all primary pre-biblical root meanings (excluding biblical redefinitions, e.g., 'hypakouete' as 'listen under,' not 'obey'), with grammatical role. For each listed sense: 1. Provide a literal translation using that root meaning, grammatically coherent. 2. Provide a readable translation preserving that root meaning in clear English, using neutral swaps (e.g., 'children' for 'things born'). Avoid biblical or modern bias. If idiomatic, note roots in literal version, adapt readable version to pre-biblical sense. End with literal and readable translations for each root sense. Goal is to uncover spoken Greek BEFORE biblical translation influence.`;
// }

// Very good multiple translate
// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original Greek to English using literal root meanings from pre-biblical Greek (before biblical influence). For each word, break down prefix, stem, suffix (treat compounds as units if historically recognized). List all primary pre-biblical root meanings (excluding biblical redefinitions, e.g., 'hypakouete' as 'listen under,' not 'obey'), with grammatical role. For each listed sense: 1. Provide a literal translation using that root meaning, grammatically coherent. 2. Provide a readable translation preserving that root meaning in modern, conversational English, using neutral swaps (e.g., 'children' for 'things born'). Avoid biblical or modern bias. If idiomatic, note roots in literal version, adapt readable version to pre-biblical sense. End with literal and readable translations for each root sense. Goal is to uncover spoken Greek BEFORE biblical translation influence.`;
// }

function constructTranslationPrompt(verseReference) {
    return `Translate the Bible verse ${verseReference} from its original Greek to English using literal root meanings from pre-biblical Greek (before biblical influence). For each word, break down prefix, stem, suffix (treat compounds as units if historically recognized). List all primary pre-biblical root meanings (excluding biblical redefinitions, e.g., 'hypakouete' as 'listen under,' not biblical 'obey'), with grammatical role. For each listed sense: 1. Provide a literal translation using that root meaning, grammatically coherent. 2. Provide a readable translation preserving that root meaning in regular, modern English (e.g., 'listen under' as 'listen attentively'), using natural swaps (e.g., 'children' for 'things born'). Avoid biblical or modern bias. If idiomatic, note roots in literal version, adapt readable version to pre-biblical sense. End with literal and readable translations. Goal is to uncover spoken Greek BEFORE biblical translation influence.`;
}

// function constructTranslationPrompt(verseReference) {
//     return `Translate the Bible verse ${verseReference} from its original Greek to English using literal root meanings from pre-biblical Greek (before biblical influence). For each word, break down prefix, stem, suffix (treat compounds as units if historically recognized). List root meaning (with options if ambiguous) and grammatical role. Provide: 1. Literal translation using root meanings, grammatically coherent. 2. Readable translation that strictly preserves pre-biblical root meanings in clear English (e.g., 'hypakouete' from 'listen under' stays 'listen attentively'), using neutral swaps (e.g., 'children' for 'things born'). Avoid biblical or modern bias. If idiomatic, note roots in literal version, adapt readable version to pre-biblical sense. End with original English verse, literal translation, and readable translation.`;
// }

aiTranslate.addEventListener('click', submitAITranslate);

aiSave.addEventListener('click', () => {
    if (!currentAiOutput?.answer) {
        console.log('Skipping save: No text to save');
        return;
    }

    const saveWithLabel = (label) => {
        storeTextItem({
            text: currentAiOutput.answer,
            label,
            maxSize: 0,
            storageKey: "savedOutputs"
        });
        showTempNotification('Saving...'); // Add feedback here
    };

    const question = currentAiOutput?.question;
    if (!question) {
        askUser({
            prompt: 'Enter description of text...',
            buttonText: 'Save',
            action: (text) => {
                if (!text) {
                    console.log('Skipping save: No label provided');
                    return;
                }
                saveWithLabel(text);
            }
        });
    } else {
        saveWithLabel(question);
    }
});

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
    const availableHeight = window.innerHeight - topBarHeight - mainVisibleHeight - footerPadding - aiInputHeight;

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

    // Add Escape key handler
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            popup.remove();
            document.removeEventListener('click', closePopup);
            document.removeEventListener('keydown', handleEscape);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closePopup);
        document.addEventListener('keydown', handleEscape);
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

function hasBookmark(reference) {
    return getBookmarks().includes(reference);
}

// Function to test a verse if bookmarked
function isBookmarked(book, chapter, verse) {
    const reference = `${book}/${chapter}/${verse}`;
    return hasBookmark(reference);
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
    container.style.marginTop = '0';
    container.style.paddingTop = `${topBarHeight}px`;
    container.style.height = `calc(100vh - ${topBarHeight}px)`;
}

// Run on load and resize
window.addEventListener('DOMContentLoaded', () => {
    adjustContainerMargin();
    updateTopBarSummary();

    // Menu configuration
    const menuConfig = {
        'Paste text': () => console.log('Option 1 selected'),
        '🗎 Add custom book': () => importBook(),
        '⍈ Add custom chapter': () => importChapter(), // drop-menu-item-3
        '✎ Edit custom chapter': () => editChapter(), // drop-menu-item-4
        '⚙️ Settings': () => settingsManager.openPopup()
    };

    // Create the menu
    const dropdown = createDropdownMenu(menuConfig, 'drop-menu-item');
    document.body.appendChild(dropdown.element);

    // Button handler
    const showMenuBtn = document.getElementById('show-menu');
    if (showMenuBtn) {
        showMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Position menu below the button
            const rect = showMenuBtn.getBoundingClientRect();
            const x = rect.left;
            const y = rect.bottom + window.scrollY;

            dropdown.show(x, y);
        });
    }

});

window.addEventListener('resize', adjustContainerMargin);

// Function to create a dropdown menu
function createDropdownMenu(menuConfig, idPrefix) {
    let dropDownMenuId = 1;

    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu hidden';

    // Apply base styling from popup variables
    menu.style.position = 'absolute';
    menu.style.backgroundColor = 'var(--popup-bg)';
    menu.style.border = '1px solid var(--popup-border)';
    menu.style.color = 'var(--popup-text)';
    menu.style.zIndex = '1000';
    menu.style.padding = '5px 0';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    menu.style.minWidth = '150px';

    // Process menu items from config
    Object.entries(menuConfig).forEach(([label, action]) => {
        const item = document.createElement('div');
        item.id = `${idPrefix}-${dropDownMenuId++}`;
        item.className = 'dropdown-item';
        item.textContent = label;

        item.style.padding = '5px 10px';
        item.style.cursor = 'pointer';

        if (typeof action === 'function') {
            item.addEventListener('click', (e) => {
                action(e);
                menu.classList.add('hidden');
            });
        }

        menu.appendChild(item);
    });

    // Close handler for clicking outside
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeHandler);
        }
    };

    return {
        element: menu,
        show: function (x, y) {
            // Toggle: If menu is already visible, hide it and return
            if (!menu.classList.contains('hidden')) {
                this.hide(); // Use the hide method
                return;
            }

            // Temporarily show menu to get its dimensions
            menu.style.left = '0px';
            menu.style.top = '0px';
            menu.classList.remove('hidden');

            // Calculate position with edge detection
            const menuWidth = menu.offsetWidth;
            const windowWidth = window.innerWidth;
            const rightMargin = 10;

            // Adjust x position if menu would extend beyond right edge
            let adjustedX = x;
            if (x + menuWidth > windowWidth - rightMargin) {
                adjustedX = windowWidth - menuWidth - rightMargin;
                // Ensure it doesn't go negative
                adjustedX = Math.max(adjustedX, rightMargin);
            }

            // Set final position
            menu.style.left = `${adjustedX}px`;
            menu.style.top = `${y}px`;

            // Add close handler after slight delay
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 10);
        },
        hide: function () {
            menu.classList.add('hidden');
            document.removeEventListener('click', closeHandler);
        }
    };
}

