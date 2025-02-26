// config.js
const BIBLE_API_BASE = 'https://bible-api.com';

const defaults = {
    currentVerse: { book: 'John', chapter: 1, verse: 1 },
    bibleVersion: 'asv',
    maxHistoryLength: 10,
    openaiSettings: {
        temperature: 1.0,
        model: 'gpt-4o-mini',
        maxTokens: 1000
    }
};

let state = { ...defaults };
let aiHistory = [];
let openaiSettings = state.openaiSettings;

const books = [
    { key: 'Genesis', label: 'Genesis', chapters: 50, handler: 'api' },
    { key: 'Exodus', label: 'Exodus', chapters: 40, handler: 'api' },
    { key: 'Leviticus', label: 'Leviticus', chapters: 27, handler: 'api' },
    { key: 'Numbers', label: 'Numbers', chapters: 36, handler: 'api' },
    { key: 'Deuteronomy', label: 'Deuteronomy', chapters: 34, handler: 'api' },
    { key: 'Joshua', label: 'Joshua', chapters: 24, handler: 'api' },
    { key: 'Judges', label: 'Judges', chapters: 21, handler: 'api' },
    { key: 'Ruth', label: 'Ruth', chapters: 4, handler: 'api' },
    { key: '1 Samuel', label: '1 Samuel', chapters: 31, handler: 'api' },
    { key: '2 Samuel', label: '2 Samuel', chapters: 24, handler: 'api' },
    { key: '1 Kings', label: '1 Kings', chapters: 22, handler: 'api' },
    { key: '2 Kings', label: '2 Kings', chapters: 25, handler: 'api' },
    { key: '1 Chronicles', label: '1 Chronicles', chapters: 29, handler: 'api' },
    { key: '2 Chronicles', label: '2 Chronicles', chapters: 36, handler: 'api' },
    { key: 'Ezra', label: 'Ezra', chapters: 10, handler: 'api' },
    { key: 'Nehemiah', label: 'Nehemiah', chapters: 13, handler: 'api' },
    { key: 'Esther', label: 'Esther', chapters: 10, handler: 'api' },
    { key: 'Job', label: 'Job', chapters: 42, handler: 'api' },
    { key: 'Psalms', label: 'Psalms', chapters: 150, handler: 'api' },
    { key: 'Proverbs', label: 'Proverbs', chapters: 31, handler: 'api' },
    { key: 'Ecclesiastes', label: 'Ecclesiastes', chapters: 12, handler: 'api' },
    { key: 'Song of Solomon', label: 'Song of Solomon', chapters: 8, handler: 'api' },
    { key: 'Isaiah', label: 'Isaiah', chapters: 66, handler: 'api' },
    { key: 'Jeremiah', label: 'Jeremiah', chapters: 52, handler: 'api' },
    { key: 'Lamentations', label: 'Lamentations', chapters: 5, handler: 'api' },
    { key: 'Ezekiel', label: 'Ezekiel', chapters: 48, handler: 'api' },
    { key: 'Daniel', label: 'Daniel', chapters: 12, handler: 'api' },
    { key: 'Hosea', label: 'Hosea', chapters: 14, handler: 'api' },
    { key: 'Joel', label: 'Joel', chapters: 3, handler: 'api' },
    { key: 'Amos', label: 'Amos', chapters: 9, handler: 'api' },
    { key: 'Obadiah', label: 'Obadiah', chapters: 1, handler: 'api' },
    { key: 'Jonah', label: 'Jonah', chapters: 4, handler: 'api' },
    { key: 'Micah', label: 'Micah', chapters: 7, handler: 'api' },
    { key: 'Nahum', label: 'Nahum', chapters: 3, handler: 'api' },
    { key: 'Habakkuk', label: 'Habakkuk', chapters: 3, handler: 'api' },
    { key: 'Zephaniah', label: 'Zephaniah', chapters: 3, handler: 'api' },
    { key: 'Haggai', label: 'Haggai', chapters: 2, handler: 'api' },
    { key: 'Zechariah', label: 'Zechariah', chapters: 14, handler: 'api' },
    { key: 'Malachi', label: 'Malachi', chapters: 4, handler: 'api' },
    { key: 'Matthew', label: 'Matthew', chapters: 28, handler: 'api' },
    { key: 'Mark', label: 'Mark', chapters: 16, handler: 'api' },
    { key: 'Luke', label: 'Luke', chapters: 24, handler: 'api' },
    { key: 'John', label: 'John', chapters: 21, handler: 'api' },
    { key: 'Acts', label: 'Acts', chapters: 28, handler: 'api' },
    { key: 'Romans', label: 'Romans', chapters: 16, handler: 'api' },
    { key: '1 Corinthians', label: '1 Corinthians', chapters: 16, handler: 'api' },
    { key: '2 Corinthians', label: '2 Corinthians', chapters: 13, handler: 'api' },
    { key: 'Galatians', label: 'Galatians', chapters: 6, handler: 'api' },
    { key: 'Ephesians', label: 'Ephesians', chapters: 6, handler: 'api' },
    { key: 'Philippians', label: 'Philippians', chapters: 4, handler: 'api' },
    { key: 'Colossians', label: 'Colossians', chapters: 4, handler: 'api' },
    { key: '1 Thessalonians', label: '1 Thessalonians', chapters: 5, handler: 'api' },
    { key: '2 Thessalonians', label: '2 Thessalonians', chapters: 3, handler: 'api' },
    { key: '1 Timothy', label: '1 Timothy', chapters: 6, handler: 'api' },
    { key: '2 Timothy', label: '2 Timothy', chapters: 4, handler: 'api' },
    { key: 'Titus', label: 'Titus', chapters: 3, handler: 'api' },
    { key: 'Philemon', label: 'Philemon', chapters: 1, handler: 'api' },
    { key: 'Hebrews', label: 'Hebrews', chapters: 13, handler: 'api' },
    { key: 'James', label: 'James', chapters: 5, handler: 'api' },
    { key: '1 Peter', label: '1 Peter', chapters: 5, handler: 'api' },
    { key: '2 Peter', label: '2 Peter', chapters: 3, handler: 'api' },
    { key: '1 John', label: '1 John', chapters: 5, handler: 'api' },
    { key: '2 John', label: '2 John', chapters: 1, handler: 'api' },
    { key: '3 John', label: '3 John', chapters: 1, handler: 'api' },
    { key: 'Jude', label: 'Jude', chapters: 1, handler: 'api' },
    { key: 'Revelation', label: 'Revelation', chapters: 22, handler: 'api' },
    { key: '1 Enoch', label: '1 Enoch (1917 translation)', chapters: 108, handler: 'localJson', url: './1enoch.json', notes: 'R.H. Charles’s 1917 translation' }
];

function loadAiHistory() {
    const saved = localStorage.getItem('aiHistory');
    if (saved) {
        aiHistory = JSON.parse(saved);
    }
}

function loadState() {
    const savedState = localStorage.getItem('bibleState');
    if (savedState) {
        state = JSON.parse(savedState);
    }
    openaiSettings = state.openaiSettings;
    loadAiHistory();
}

function saveState() {
    localStorage.setItem('bibleState', JSON.stringify(state));
    localStorage.setItem('aiHistory', JSON.stringify(aiHistory));
}

function getNotes() {
    return JSON.parse(localStorage.getItem('bibleNotes')) || {};
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

