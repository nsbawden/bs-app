// storage.js

// Function to generate bookMap from books array
function generateBookMap(booksArray) {
    const bookMap = {};
    booksArray.forEach(book => {
        bookMap[book.key] = book.code;
    });
    return bookMap;
}

const bookMap = generateBookMap(books);

// Function to sort the books array
function sortBooks(booksArray, sortBy = 'key', ascending = true) {
    // Helper function to extract base name without leading numbers
    function getBaseName(value) {
        return value.replace(/^\d+\s*/, '').toLowerCase();
    }

    // Return a new sorted array
    return [...booksArray].sort((a, b) => {
        const baseA = getBaseName(a[sortBy]);
        const baseB = getBaseName(b[sortBy]);
        const fullA = a[sortBy].toLowerCase();
        const fullB = b[sortBy].toLowerCase();

        // Primary sort by base name (without leading numbers)
        if (baseA < baseB) return ascending ? -1 : 1;
        if (baseA > baseB) return ascending ? 1 : -1;

        // Secondary sort by full name (including numbers) for ties
        if (fullA < fullB) return ascending ? -1 : 1;
        if (fullA > fullB) return ascending ? 1 : -1;
        return 0; // Equal values preserve original order
    });
}

function loadAiHistory() {
    const saved = localStorage.getItem('aiHistory');
    if (saved) {
        aiHistory = JSON.parse(saved);
    }
}

function getApiSource() {
    switch (state.bibleVersion) {
        case 'kjv':
        case 'asv':
        case 'web':
        case 'bbe':
        case 'dra':
        case 'ylt':
            state.apiSource = 'bible-api.com';
            // state.apiSource = 'api.esv.org';
            break;
        case 'esv':
            state.apiSource = 'api.esv.org';
            break;
        case 'NONE':
            state.apiSource = 'api.bible';
            break;
        default:
            state.apiSource = 'bible-api.com';
            break;
    }
}

function saveState() {
    // Ensure openaiSettings is fully merged into state before saving
    state.openaiSettings = { ...state.openaiSettings, ...openaiSettings };
    localStorage.setItem('bibleState', JSON.stringify(state));
    localStorage.setItem('aiHistory', JSON.stringify(aiHistory));
}

function loadState() {
    const savedState = localStorage.getItem('bibleState');
    let mergedState;

    if (savedState) {
        state = JSON.parse(savedState);
    } else {
        state = {};
    }

    // Merge defaults into state, ensuring openaiSettings is properly nested
    mergedState = {
        ...defaults,
        ...state,
        openaiSettings: {
            ...defaults.openaiSettings,
            ...(state.openaiSettings || {})
        }
    };

    state = mergedState;
    openaiSettings = state.openaiSettings; // Sync global openaiSettings

    // Rest of loadState remains unchanged
    books = sortBooks(books);
    getApiSource();
    loadAiHistory();
    loadChapterCache();
}


// Load chapter cache from localStorage directly into chapterCache
function loadChapterCache() {
    const cachedData = localStorage.getItem('chapterCache');
    if (cachedData) {
        chapterCache = JSON.parse(cachedData);
    } else {
        chapterCache = {};
    }
}

// Generalized function to prune a specific number of oldest chapters
function pruneOldChapters(count) {
    const keys = Object.keys(chapterCache);
    if (keys.length === 0) return 0; // Nothing to prune if cache is empty

    const sortedKeys = keys.sort((a, b) => {
        return (chapterCache[a].lastLoaded || 0) - (chapterCache[b].lastLoaded || 0);
    });

    // Prune up to 'count' chapters, or all if fewer than 'count' exist
    const pruneCount = Math.min(count, keys.length);
    const toRemove = sortedKeys.slice(0, pruneCount);
    toRemove.forEach(key => delete chapterCache[key]);

    console.log(`Pruned ${toRemove.length} chapters, now at ${Object.keys(chapterCache).length}`);
    return toRemove.length;
}

// Generalized function to prune a specific number of oldest chapters from chapter cache
function pruneOldChapters(count) {
    const keys = Object.keys(chapterCache);
    if (keys.length === 0) return 0;

    const sortedKeys = keys.sort((a, b) => {
        return (chapterCache[a].lastLoaded || 0) - (chapterCache[b].lastLoaded || 0);
    });

    const pruneCount = Math.min(count, keys.length);
    const toRemove = sortedKeys.slice(0, pruneCount);
    toRemove.forEach(key => delete chapterCache[key]);

    console.log(`Pruned ${toRemove.length} chapters, now at ${Object.keys(chapterCache).length}`);
    return toRemove.length;
}

function saveChapterCache() {
    const keys = Object.keys(chapterCache);
    if (keys.length > MAX_CHAPTERS) {
        console.log(`Cache exceeds ${MAX_CHAPTERS} chapters (${keys.length}), pruning oldest...`);
        pruneOldChapters(5);
    }
    localStorage.setItem('chapterCache', JSON.stringify(chapterCache));
}

// Estimate localStorage usage in bytes
function estimateLocalStorageUsage() {
    let totalSize = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            const keySize = ((key || '').length * 2); // UTF-16, 2 bytes per char
            const valueSize = ((localStorage[key] || '').length * 2);
            totalSize += keySize + valueSize;
        }
    }
    return totalSize;
}

// Determine localStorage quota based on browser detection
function getStorageQuota() {
    const ua = navigator.userAgent.toLowerCase();

    // Check for Opera (5MB default)
    if (ua.includes('opr') || ua.includes('opera')) {
        return RESTRICTED_MAX_STORAGE; // 5MB
    }

    // Default to 10MB for Chrome, Firefox, Edge, Safari, etc.
    return DEFAULT_MAX_STORAGE;
}

// Check storage and prune if near limit
async function checkAndPruneStorage() {
    try {
        const localQuota = getStorageQuota(); // Detect quota based on browser
        const localUsage = estimateLocalStorageUsage();
        const usagePercentage = localUsage / localQuota;

        console.log(`localStorage: ${(usagePercentage * 100).toFixed(2)}% (${(localUsage / (1024 * 1024)).toFixed(2)} of ${(localQuota / (1024 * 1024)).toFixed(2)} MB)`);

        if (usagePercentage > MAX_STORAGE_PERCENTAGE) {
            const keys = Object.keys(chapterCache);
            if (keys.length > 0) {
                const chaptersToPrune = Math.max(5, Math.floor(keys.length * 0.1));
                console.log(`localStorage usage above ${MAX_STORAGE_PERCENTAGE * 100}%, pruning ${chaptersToPrune} chapters...`);
                pruneOldChapters(chaptersToPrune);
                saveChapterCache();
            }
        }
    } catch (error) {
        console.log('Error in checkAndPruneStorage:', error);
    }
}

// Set up periodic checking
function startStorageMonitoring() {
    checkAndPruneStorage();
    setInterval(checkAndPruneStorage, STORAGE_CHECK_INTERVAL);
}

// Load translation cache from localStorage
function loadTranslationCache() {
    const cachedData = localStorage.getItem('translationCache');
    if (cachedData) {
        translationCache = JSON.parse(cachedData);
    } else {
        translationCache = {};
    }
}

// Save translation cache to localStorage with multiple pruning strategies
function saveTranslationCache() {
    const keys = Object.keys(translationCache);
    const maxRetries = 5; // Limit retries
    const localQuota = getStorageQuota();
    const localUsage = estimateLocalStorageUsage();
    const usagePercentage = localUsage / localQuota;

    // 1. Prune if over 90% of localStorage capacity
    if (usagePercentage > MAX_STORAGE_PERCENTAGE) {
        console.log(`localStorage usage at ${(usagePercentage * 100).toFixed(2)}% (${(localUsage / (1024 * 1024)).toFixed(2)} of ${(localQuota / (1024 * 1024)).toFixed(2)} MB), pruning translation cache...`);
        const sortedKeys = keys.sort((a, b) => {
            return (translationCache[a].timestamp || 0) - (translationCache[b].timestamp || 0);
        });
        const toRemove = sortedKeys.slice(0, 5); // Prune 5 entries
        toRemove.forEach(key => delete translationCache[key]);
        console.log(`Pruned 5 translation entries, now at ${Object.keys(translationCache).length}`);
    }

    // 2. Prune if over MAX_TRANSLATION_CACHE_SIZE
    const updatedKeys = Object.keys(translationCache); // Refresh after potential pruning
    if (updatedKeys.length > MAX_TRANSLATION_CACHE_SIZE) {
        console.log(`Translation cache exceeds ${MAX_TRANSLATION_CACHE_SIZE} entries (${updatedKeys.length}), pruning oldest...`);
        const sortedKeys = updatedKeys.sort((a, b) => {
            return (translationCache[a].timestamp || 0) - (translationCache[b].timestamp || 0);
        });
        const toRemove = sortedKeys.slice(0, updatedKeys.length - MAX_TRANSLATION_CACHE_SIZE);
        toRemove.forEach(key => delete translationCache[key]);
        console.log(`Pruned ${toRemove.length} entries, now at ${Object.keys(translationCache).length}`);
    }

    // 3. Retry loop for quota errors
    let retries = 0;
    while (retries < maxRetries) {
        try {
            localStorage.setItem('translationCache', JSON.stringify(translationCache));
            break; // Success, exit loop
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                retries++;
                console.log(`Translation cache save failed (attempt ${retries}/${maxRetries}): ${error.message}`);
                if (retries < maxRetries) {
                    const sortedKeys = Object.keys(translationCache).sort((a, b) => {
                        return (translationCache[a].timestamp || 0) - (translationCache[b].timestamp || 0);
                    });
                    const toRemove = sortedKeys.slice(0, 5);
                    toRemove.forEach(key => delete translationCache[key]);
                    console.log(`Pruned 5 entries to free space, now at ${Object.keys(translationCache).length}`);
                } else {
                    console.error('Max retries reached, unable to save translation cache');
                    throw new Error(`Failed to save translation cache after ${maxRetries} attempts: ${error.message}`);
                }
            } else {
                throw error; // Non-quota error
            }
        }
    }
}

function getNotes() {
    return JSON.parse(localStorage.getItem('bibleNotes')) || {};
}

function getNotesList() {
    let obj = getNotes();
    return Object.entries(obj).map(([key, value]) => {
        // Convert key from "Book/chapter/verse" to "Book chapter:verse"
        const parts = key.split('/');
        const displayKey = `${parts[0]} ${parts[1]}:${parts[2]}`;

        // Truncate value at 80 characters and add ellipsis if needed
        let displayValue = value;
        if (value.length > 80) {
            displayValue = value.substring(0, 80) + '...';
        }

        return { label: `${displayKey} : ${displayValue}` };
    });
}

function saveNote(reference, note) {
    const notes = getNotes();
    notes[reference] = note;
    localStorage.setItem('bibleNotes', JSON.stringify(notes));
}

function deleteNote(reference) {
    const notes = getNotes();
    delete notes[reference];
    localStorage.setItem('bibleNotes', JSON.stringify(notes));
}

function loadQueryString() {
    // Parse URL query string and update state.currentVerse if parameters exist
    const queryParams = new URLSearchParams(window.location.search);

    // Check and update book
    const bookParam = queryParams.get('book');
    if (bookParam) {
        state.currentVerse.book = bookParam;
    }

    // Check and update chapter
    const chapterParam = queryParams.get('chapter');
    if (chapterParam) {
        state.currentVerse.chapter = parseInt(chapterParam, 10); // Convert to integer
    }

    // Check and update verse
    const verseParam = queryParams.get('verse');
    if (verseParam) {
        state.currentVerse.verse = parseInt(verseParam, 10); // Convert to integer
    }
}