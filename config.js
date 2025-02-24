// config.js
const BIBLE_API_BASE = 'https://bible-api.com';

// Centralized defaults for the entire app
const defaults = {
    bibleVersion: 'web',
    currentVerse: { book: 'john', chapter: 1, verse: 1 },
    notes: {},
    highlights: {},
    recentSearches: [],
    aiHistory: [],
    maxHistoryLength: 10,
    openaiSettings: {
        temperature: 1.0,       // Range: 0-2
        model: 'gpt-4o-mini',   // Default to gpt-4o-mini for new users
        maxTokens: 1000         // Range: 50-4096
    }
};

// Load state from localStorage, merging with defaults
let state = {
    bibleVersion: localStorage.getItem('bibleVersion') || defaults.bibleVersion,
    currentVerse: JSON.parse(localStorage.getItem('currentVerse')) || defaults.currentVerse,
    notes: JSON.parse(localStorage.getItem('notes')) || defaults.notes,
    highlights: JSON.parse(localStorage.getItem('highlights')) || defaults.highlights,
    recentSearches: JSON.parse(localStorage.getItem('recentSearches')) || defaults.recentSearches,
    aiHistory: JSON.parse(localStorage.getItem('aiHistory')) || defaults.aiHistory
};

// Load OpenAI settings separately to avoid nesting in state
const openaiSettings = {
    temperature: parseFloat(localStorage.getItem('temperature')) || defaults.openaiSettings.temperature,
    model: localStorage.getItem('openaiModel') || defaults.openaiSettings.model,
    maxTokens: parseInt(localStorage.getItem('maxTokens')) || defaults.openaiSettings.maxTokens
};

const books = {
    'genesis': 50, 'exodus': 40, 'leviticus': 27, 'numbers': 36, 'deuteronomy': 34,
    'joshua': 24, 'judges': 21, 'ruth': 4, '1 samuel': 31, '2 samuel': 24,
    '1 kings': 22, '2 kings': 25, '1 chronicles': 29, '2 chronicles': 36,
    'ezra': 10, 'nehemiah': 13, 'esther': 10, 'job': 42, 'psalms': 150,
    'proverbs': 31, 'ecclesiastes': 12, 'song of solomon': 8, 'isaiah': 66,
    'jeremiah': 52, 'lamentations': 5, 'ezekiel': 48, 'daniel': 12, 'hosea': 14,
    'joel': 3, 'amos': 9, 'obadiah': 1, 'jonah': 4, 'micah': 7, 'nahum': 3,
    'habakkuk': 3, 'zephaniah': 3, 'haggai': 2, 'zechariah': 14, 'malachi': 4,
    'matthew': 28, 'mark': 16, 'luke': 24, 'john': 21, 'acts': 28, 'romans': 16,
    '1 corinthians': 16, '2 corinthians': 13, 'galatians': 6, 'ephesians': 6,
    'philippians': 4, 'colossians': 4, '1 thessalonians': 5, '2 thessalonians': 3,
    '1 timothy': 6, '2 timothy': 4, 'titus': 3, 'philemon': 1, 'hebrews': 13,
    'james': 5, '1 peter': 5, '2 peter': 3, '1 john': 5, '2 john': 1, '3 john': 1,
    'jude': 1, 'revelation': 22, '1 enoch': 2
};

const bookOrder = [
    'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth',
    '1 samuel', '2 samuel', '1 kings', '2 kings', '1 chronicles', '2 chronicles', 'ezra',
    'nehemiah', 'esther', 'job', 'psalms', 'proverbs', 'ecclesiastes', 'song of solomon',
    'isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos',
    'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah',
    'malachi', 'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1 corinthians',
    '2 corinthians', 'galatians', 'ephesians', 'philippians', 'colossians', '1 thessalonians',
    '2 thessalonians', '1 timothy', '2 timothy', 'titus', 'philemon', 'hebrews', 'james',
    '1 peter', '2 peter', '1 john', '2 john', '3 john', 'jude', 'revelation', '1 enoch'
];

function saveState() {
    localStorage.setItem('bibleState', JSON.stringify(state));
    // Save OpenAI settings separately
    localStorage.setItem('temperature', openaiSettings.temperature);
    localStorage.setItem('openaiModel', openaiSettings.model);
    localStorage.setItem('maxTokens', openaiSettings.maxTokens);
}

// Notes management
const getNotes = () => {
    const notes = localStorage.getItem('bibleNotes');
    return notes ? JSON.parse(notes) : {};
};

const saveNote = (reference, note) => {
    const notes = getNotes();
    notes[reference] = note;
    localStorage.setItem('bibleNotes', JSON.stringify(notes));
};

const deleteNote = (reference) => {
    const notes = getNotes();
    delete notes[reference];
    localStorage.setItem('bibleNotes', JSON.stringify(notes));
};