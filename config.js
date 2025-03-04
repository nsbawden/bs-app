// config.js
const BIBLE_API_BASE = 'https://bible-api.com';

const defaults = {
    currentVerse: { book: 'John', chapter: 1, verse: 1 },
    bibleVersion: 'asv',
    maxHistoryLength: 10,
    apiSource: 'api.bible', /* api.bible or bible-api.com */
    openaiSettings: {
        temperature: 1.0,
        model: 'gpt-4o-mini',
        maxTokens: 1000
    }
};

let state = { ...defaults };
let aiHistory = [];
let openaiSettings = state.openaiSettings;
const savedQuestions = [
    {
        label: "Against Harmful Secrets & Deception",
        data: "### Against Harmful Secrets & Deception\n1. ** Luke 12:2-3 ** – * There is nothing concealed that will not be disclosed, or hidden that will not be made known. What you have said in the dark will be heard in the daylight, and what you have whispered in the ear in the inner rooms will be proclaimed from the roofs.*\n2. ** Ecclesiastes 12:14 ** – * For God will bring every deed into judgment, including every hidden thing, whether it is good or evil.*\n3. ** Proverbs 10:18 ** – * Whoever conceals hatred with lying lips and spreads slander is a fool.*\n4. ** 1 Corinthians 4:5 ** – * He will bring to light what is hidden in darkness and will expose the motives of the heart.*\n5. ** Mark 4:22 ** – * For whatever is hidden is meant to be disclosed, and whatever is concealed is meant to be brought out into the open.*\n\nThese verses show that the Bible strongly warns against gossip, backbiting, and keeping secrets that are intended for harm. It also reminds us that all things will ultimately be revealed by God. Let me know if you need more!"
    }
];

// In-memory cache object to store retrieved chapters
// For production, set MAX_CHAPTERS to 15 and use sessionStorage in functions to conformm to esv.org policy
const MAX_CHAPTERS = 500; // Chapter cache size (max 500 avoids filling memory)
let chapterCache = {};

// Translation cache stored in localStorage
const MAX_TRANSLATION_CACHE_SIZE = 50; // Limit to 50 translations
let translationCache = {};

// Hard-coded list of writings
const writings = [
    {
        label: "Creation of the Bible Canon",
        author: "d'Artagnan Ferrari",
        filename: "Cannonization.md"
    }
    // Add more writings here as needed, e.g.:
    // {
    //     label: "Another Writing Title",
    //     filename: "AnotherFile.md"
    // }
];

let books = [
    { key: 'Genesis', label: 'Genesis (old)', chapters: 50, handler: 'api' },
    { key: 'Exodus', label: 'Exodus (old)', chapters: 40, handler: 'api' },
    { key: 'Leviticus', label: 'Leviticus (old)', chapters: 27, handler: 'api' },
    { key: 'Numbers', label: 'Numbers (old)', chapters: 36, handler: 'api' },
    { key: 'Deuteronomy', label: 'Deuteronomy (old)', chapters: 34, handler: 'api' },
    { key: 'Joshua', label: 'Joshua (old)', chapters: 24, handler: 'api' },
    { key: 'Judges', label: 'Judges (old)', chapters: 21, handler: 'api' },
    { key: 'Ruth', label: 'Ruth (old)', chapters: 4, handler: 'api' },
    { key: '1 Samuel', label: '1 Samuel (old)', chapters: 31, handler: 'api' },
    { key: '2 Samuel', label: '2 Samuel (old)', chapters: 24, handler: 'api' },
    { key: '1 Kings', label: '1 Kings (old)', chapters: 22, handler: 'api' },
    { key: '2 Kings', label: '2 Kings (old)', chapters: 25, handler: 'api' },
    { key: '1 Chronicles', label: '1 Chronicles (old)', chapters: 29, handler: 'api' },
    { key: '2 Chronicles', label: '2 Chronicles (old)', chapters: 36, handler: 'api' },
    { key: 'Ezra', label: 'Ezra (old)', chapters: 10, handler: 'api' },
    { key: 'Nehemiah', label: 'Nehemiah (old)', chapters: 13, handler: 'api' },
    { key: 'Esther', label: 'Esther (old)', chapters: 10, handler: 'api' },
    { key: 'Job', label: 'Job (old)', chapters: 42, handler: 'api' },
    { key: 'Psalms', label: 'Psalms (old)', chapters: 150, handler: 'api' },
    { key: 'Proverbs', label: 'Proverbs (old)', chapters: 31, handler: 'api' },
    { key: 'Ecclesiastes', label: 'Ecclesiastes (old)', chapters: 12, handler: 'api' },
    { key: 'Song of Solomon', label: 'Song of Solomon (old)', chapters: 8, handler: 'api' },
    { key: 'Isaiah', label: 'Isaiah (old)', chapters: 66, handler: 'api' },
    { key: 'Jeremiah', label: 'Jeremiah (old)', chapters: 52, handler: 'api' },
    { key: 'Lamentations', label: 'Lamentations (old)', chapters: 5, handler: 'api' },
    { key: 'Ezekiel', label: 'Ezekiel (old)', chapters: 48, handler: 'api' },
    { key: 'Daniel', label: 'Daniel (old)', chapters: 12, handler: 'api' },
    { key: 'Hosea', label: 'Hosea (old)', chapters: 14, handler: 'api' },
    { key: 'Joel', label: 'Joel (old)', chapters: 3, handler: 'api' },
    { key: 'Amos', label: 'Amos (old)', chapters: 9, handler: 'api' },
    { key: 'Obadiah', label: 'Obadiah (old)', chapters: 1, handler: 'api' },
    { key: 'Jonah', label: 'Jonah (old)', chapters: 4, handler: 'api' },
    { key: 'Micah', label: 'Micah (old)', chapters: 7, handler: 'api' },
    { key: 'Nahum', label: 'Nahum (old)', chapters: 3, handler: 'api' },
    { key: 'Habakkuk', label: 'Habakkuk (old)', chapters: 3, handler: 'api' },
    { key: 'Zephaniah', label: 'Zephaniah (old)', chapters: 3, handler: 'api' },
    { key: 'Haggai', label: 'Haggai (old)', chapters: 2, handler: 'api' },
    { key: 'Zechariah', label: 'Zechariah (old)', chapters: 14, handler: 'api' },
    { key: 'Malachi', label: 'Malachi (old)', chapters: 4, handler: 'api' },
    { key: 'Matthew', label: 'Matthew (new)', chapters: 28, handler: 'api' },
    { key: 'Mark', label: 'Mark (new)', chapters: 16, handler: 'api' },
    { key: 'Luke', label: 'Luke (new)', chapters: 24, handler: 'api' },
    { key: 'John', label: 'John (new)', chapters: 21, handler: 'api' },
    { key: 'Acts', label: 'Acts (new)', chapters: 28, handler: 'api' },
    { key: 'Romans', label: 'Romans (new)', chapters: 16, handler: 'api' },
    { key: '1 Corinthians', label: '1 Corinthians (new)', chapters: 16, handler: 'api' },
    { key: '2 Corinthians', label: '2 Corinthians (new)', chapters: 13, handler: 'api' },
    { key: 'Galatians', label: 'Galatians (new)', chapters: 6, handler: 'api' },
    { key: 'Ephesians', label: 'Ephesians (new)', chapters: 6, handler: 'api' },
    { key: 'Philippians', label: 'Philippians (new)', chapters: 4, handler: 'api' },
    { key: 'Colossians', label: 'Colossians (new)', chapters: 4, handler: 'api' },
    { key: '1 Thessalonians', label: '1 Thessalonians (new)', chapters: 5, handler: 'api' },
    { key: '2 Thessalonians', label: '2 Thessalonians (new)', chapters: 3, handler: 'api' },
    { key: '1 Timothy', label: '1 Timothy (new)', chapters: 6, handler: 'api' },
    { key: '2 Timothy', label: '2 Timothy (new)', chapters: 4, handler: 'api' },
    { key: 'Titus', label: 'Titus (new)', chapters: 3, handler: 'api' },
    { key: 'Philemon', label: 'Philemon (new)', chapters: 1, handler: 'api' },
    { key: 'Hebrews', label: 'Hebrews (new)', chapters: 13, handler: 'api' },
    { key: 'James', label: 'James (new)', chapters: 5, handler: 'api' },
    { key: '1 Peter', label: '1 Peter (new)', chapters: 5, handler: 'api' },
    { key: '2 Peter', label: '2 Peter (new)', chapters: 3, handler: 'api' },
    { key: '1 John', label: '1 John (new)', chapters: 5, handler: 'api' },
    { key: '2 John', label: '2 John (new)', chapters: 1, handler: 'api' },
    { key: '3 John', label: '3 John (new)', chapters: 1, handler: 'api' },
    { key: 'Jude', label: 'Jude (new)', chapters: 1, handler: 'api' },
    { key: 'Revelation', label: 'Revelation (new)', chapters: 22, handler: 'api' },
    { key: '1 Enoch', label: '1 Enoch (old)', chapters: 108, handler: 'localJson', url: './1enoch.json', notes: 'R.H. Charles’s 1917 translation' }
];

const bookMap = {
    "Genesis": "GEN",
    "Exodus": "EXO",
    "Leviticus": "LEV",
    "Numbers": "NUM",
    "Deuteronomy": "DEU",
    "Joshua": "JOS",
    "Judges": "JDG",
    "Ruth": "RUT",
    "1 Samuel": "1SA",
    "2 Samuel": "2SA",
    "1 Kings": "1KI",
    "2 Kings": "2KI",
    "1 Chronicles": "1CH",
    "2 Chronicles": "2CH",
    "Ezra": "EZR",
    "Nehemiah": "NEH",
    "Esther": "EST",
    "Job": "JOB",
    "Psalms": "PSA",
    "Proverbs": "PRO",
    "Ecclesiastes": "ECC",
    "Song of Solomon": "SNG",
    "Isaiah": "ISA",
    "Jeremiah": "JER",
    "Lamentations": "LAM",
    "Ezekiel": "EZK",
    "Daniel": "DAN",
    "Hosea": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obadiah": "OBA",
    "Jonah": "JON",
    "Micah": "MIC",
    "Nahum": "NAM",
    "Habakkuk": "HAB",
    "Zephaniah": "ZEP",
    "Haggai": "HAG",
    "Zechariah": "ZEC",
    "Malachi": "MAL",
    "Matthew": "MAT",
    "Mark": "MRK",
    "Luke": "LUK",
    "John": "JHN",
    "Acts": "ACT",
    "Romans": "ROM",
    "1 Corinthians": "1CO",
    "2 Corinthians": "2CO",
    "Galatians": "GAL",
    "Ephesians": "EPH",
    "Philippians": "PHP",
    "Colossians": "COL",
    "1 Thessalonians": "1TH",
    "2 Thessalonians": "2TH",
    "1 Timothy": "1TI",
    "2 Timothy": "2TI",
    "Titus": "TIT",
    "Philemon": "PHM",
    "Hebrews": "HEB",
    "James": "JAS",
    "1 Peter": "1PE",
    "2 Peter": "2PE",
    "1 John": "1JN",
    "2 John": "2JN",
    "3 John": "3JN",
    "Jude": "JUD",
    "Revelation": "REV"
};

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

function loadState() {
    const savedState = localStorage.getItem('bibleState');
    let mergedState;

    // If there's saved state, parse it; otherwise, start with an empty object
    if (savedState) {
        state = JSON.parse(savedState);
    } else {
        state = {};
    }

    // Merge defaults into state: defaults first, then overwrite with saved state
    mergedState = { ...defaults, ...state };

    // Update the global state with the merged result
    state = mergedState;

    // Assign openaiSettings from the merged state
    openaiSettings = state.openaiSettings || defaults.openaiSettings || {};

    // Sort the books
    books = sortBooks(books);

    getApiSource();
    loadAiHistory();
    loadChapterCache();

    // Save the merged state back to localStorage
    localStorage.setItem('bibleState', JSON.stringify(state));
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

// Save chapterCache to localStorage, pruning beyond 500 chapters
function saveChapterCache() {
    const keys = Object.keys(chapterCache);

    if (keys.length > MAX_CHAPTERS) {
        console.log(`Cache exceeds ${MAX_CHAPTERS} chapters (${keys.length}), pruning oldest...`);
        const sortedKeys = keys.sort((a, b) => {
            return (chapterCache[a].lastLoaded || 0) - (chapterCache[b].lastLoaded || 0);
        });
        const toRemove = sortedKeys.slice(0, keys.length - MAX_CHAPTERS);
        toRemove.forEach(key => delete chapterCache[key]);
        console.log(`Pruned ${toRemove.length} chapters, now at ${Object.keys(chapterCache).length}`);
    }

    localStorage.setItem('chapterCache', JSON.stringify(chapterCache));
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

// Save translation cache to localStorage with FIFO pruning
function saveTranslationCache() {
    const keys = Object.keys(translationCache);

    if (keys.length > MAX_TRANSLATION_CACHE_SIZE) {
        console.log(`Translation cache exceeds ${MAX_TRANSLATION_CACHE_SIZE} entries (${keys.length}), pruning oldest...`);
        // Sort by timestamp (oldest first) and remove excess
        const sortedKeys = keys.sort((a, b) => {
            return (translationCache[a].timestamp || 0) - (translationCache[b].timestamp || 0);
        });
        const toRemove = sortedKeys.slice(0, keys.length - MAX_TRANSLATION_CACHE_SIZE);
        toRemove.forEach(key => delete translationCache[key]);
        console.log(`Pruned ${toRemove.length} entries, now at ${Object.keys(translationCache).length}`);
    }

    localStorage.setItem('translationCache', JSON.stringify(translationCache));
}

function saveState() {
    localStorage.setItem('bibleState', JSON.stringify(state));
    localStorage.setItem('aiHistory', JSON.stringify(aiHistory));
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

