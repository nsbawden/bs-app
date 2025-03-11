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
const MAX_STORAGE_PERCENTAGE = 0.9; // 90% threshold
const STORAGE_CHECK_INTERVAL = 60000; // Check every minute (in milliseconds)
const DEFAULT_MAX_STORAGE = 10485760; // 10MB in bytes, common localStorage limit

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

// Combined books array with bookMap codes
let books = [
    { key: 'Genesis', label: 'Genesis (old)', chapters: 50, handler: 'api', code: 'GEN' },
    { key: 'Exodus', label: 'Exodus (old)', chapters: 40, handler: 'api', code: 'EXO' },
    { key: 'Leviticus', label: 'Leviticus (old)', chapters: 27, handler: 'api', code: 'LEV' },
    { key: 'Numbers', label: 'Numbers (old)', chapters: 36, handler: 'api', code: 'NUM' },
    { key: 'Deuteronomy', label: 'Deuteronomy (old)', chapters: 34, handler: 'api', code: 'DEU' },
    { key: 'Joshua', label: 'Joshua (old)', chapters: 24, handler: 'api', code: 'JOS' },
    { key: 'Judges', label: 'Judges (old)', chapters: 21, handler: 'api', code: 'JDG' },
    { key: 'Ruth', label: 'Ruth (old)', chapters: 4, handler: 'api', code: 'RUT' },
    { key: '1 Samuel', label: '1 Samuel (old)', chapters: 31, handler: 'api', code: '1SA' },
    { key: '2 Samuel', label: '2 Samuel (old)', chapters: 24, handler: 'api', code: '2SA' },
    { key: '1 Kings', label: '1 Kings (old)', chapters: 22, handler: 'api', code: '1KI' },
    { key: '2 Kings', label: '2 Kings (old)', chapters: 25, handler: 'api', code: '2KI' },
    { key: '1 Chronicles', label: '1 Chronicles (old)', chapters: 29, handler: 'api', code: '1CH' },
    { key: '2 Chronicles', label: '2 Chronicles (old)', chapters: 36, handler: 'api', code: '2CH' },
    { key: 'Ezra', label: 'Ezra (old)', chapters: 10, handler: 'api', code: 'EZR' },
    { key: 'Nehemiah', label: 'Nehemiah (old)', chapters: 13, handler: 'api', code: 'NEH' },
    { key: 'Esther', label: 'Esther (old)', chapters: 10, handler: 'api', code: 'EST' },
    { key: 'Job', label: 'Job (old)', chapters: 42, handler: 'api', code: 'JOB' },
    { key: 'Psalms', label: 'Psalms (old)', chapters: 150, handler: 'api', code: 'PSA' },
    { key: 'Proverbs', label: 'Proverbs (old)', chapters: 31, handler: 'api', code: 'PRO' },
    { key: 'Ecclesiastes', label: 'Ecclesiastes (old)', chapters: 12, handler: 'api', code: 'ECC' },
    { key: 'Song of Solomon', label: 'Song of Solomon (old)', chapters: 8, handler: 'api', code: 'SNG' },
    { key: 'Isaiah', label: 'Isaiah (old)', chapters: 66, handler: 'api', code: 'ISA' },
    { key: 'Jeremiah', label: 'Jeremiah (old)', chapters: 52, handler: 'api', code: 'JER' },
    { key: 'Lamentations', label: 'Lamentations (old)', chapters: 5, handler: 'api', code: 'LAM' },
    { key: 'Ezekiel', label: 'Ezekiel (old)', chapters: 48, handler: 'api', code: 'EZK' },
    { key: 'Daniel', label: 'Daniel (old)', chapters: 12, handler: 'api', code: 'DAN' },
    { key: 'Hosea', label: 'Hosea (old)', chapters: 14, handler: 'api', code: 'HOS' },
    { key: 'Joel', label: 'Joel (old)', chapters: 3, handler: 'api', code: 'JOL' },
    { key: 'Amos', label: 'Amos (old)', chapters: 9, handler: 'api', code: 'AMO' },
    { key: 'Obadiah', label: 'Obadiah (old)', chapters: 1, handler: 'api', code: 'OBA' },
    { key: 'Jonah', label: 'Jonah (old)', chapters: 4, handler: 'api', code: 'JON' },
    { key: 'Micah', label: 'Micah (old)', chapters: 7, handler: 'api', code: 'MIC' },
    { key: 'Nahum', label: 'Nahum (old)', chapters: 3, handler: 'api', code: 'NAM' },
    { key: 'Habakkuk', label: 'Habakkuk (old)', chapters: 3, handler: 'api', code: 'HAB' },
    { key: 'Zephaniah', label: 'Zephaniah (old)', chapters: 3, handler: 'api', code: 'ZEP' },
    { key: 'Haggai', label: 'Haggai (old)', chapters: 2, handler: 'api', code: 'HAG' },
    { key: 'Zechariah', label: 'Zechariah (old)', chapters: 14, handler: 'api', code: 'ZEC' },
    { key: 'Malachi', label: 'Malachi (old)', chapters: 4, handler: 'api', code: 'MAL' },
    { key: 'Matthew', label: 'Matthew (new)', chapters: 28, handler: 'api', code: 'MAT' },
    { key: 'Mark', label: 'Mark (new)', chapters: 16, handler: 'api', code: 'MRK' },
    { key: 'Luke', label: 'Luke (new)', chapters: 24, handler: 'api', code: 'LUK' },
    { key: 'John', label: 'John (new)', chapters: 21, handler: 'api', code: 'JHN' },
    { key: 'Acts', label: 'Acts (new)', chapters: 28, handler: 'api', code: 'ACT' },
    { key: 'Romans', label: 'Romans (new)', chapters: 16, handler: 'api', code: 'ROM' },
    { key: '1 Corinthians', label: '1 Corinthians (new)', chapters: 16, handler: 'api', code: '1CO' },
    { key: '2 Corinthians', label: '2 Corinthians (new)', chapters: 13, handler: 'api', code: '2CO' },
    { key: 'Galatians', label: 'Galatians (new)', chapters: 6, handler: 'api', code: 'GAL' },
    { key: 'Ephesians', label: 'Ephesians (new)', chapters: 6, handler: 'api', code: 'EPH' },
    { key: 'Philippians', label: 'Philippians (new)', chapters: 4, handler: 'api', code: 'PHP' },
    { key: 'Colossians', label: 'Colossians (new)', chapters: 4, handler: 'api', code: 'COL' },
    { key: '1 Thessalonians', label: '1 Thessalonians (new)', chapters: 5, handler: 'api', code: '1TH' },
    { key: '2 Thessalonians', label: '2 Thessalonians (new)', chapters: 3, handler: 'api', code: '2TH' },
    { key: '1 Timothy', label: '1 Timothy (new)', chapters: 6, handler: 'api', code: '1TI' },
    { key: '2 Timothy', label: '2 Timothy (new)', chapters: 4, handler: 'api', code: '2TI' },
    { key: 'Titus', label: 'Titus (new)', chapters: 3, handler: 'api', code: 'TIT' },
    { key: 'Philemon', label: 'Philemon (new)', chapters: 1, handler: 'api', code: 'PHM' },
    { key: 'Hebrews', label: 'Hebrews (new)', chapters: 13, handler: 'api', code: 'HEB' },
    { key: 'James', label: 'James (new)', chapters: 5, handler: 'api', code: 'JAS' },
    { key: '1 Peter', label: '1 Peter (new)', chapters: 5, handler: 'api', code: '1PE' },
    { key: '2 Peter', label: '2 Peter (new)', chapters: 3, handler: 'api', code: '2PE' },
    { key: '1 John', label: '1 John (new)', chapters: 5, handler: 'api', code: '1JN' },
    { key: '2 John', label: '2 John (new)', chapters: 1, handler: 'api', code: '2JN' },
    { key: '3 John', label: '3 John (new)', chapters: 1, handler: 'api', code: '3JN' },
    { key: 'Jude', label: 'Jude (new)', chapters: 1, handler: 'api', code: 'JUD' },
    { key: 'Revelation', label: 'Revelation (new)', chapters: 22, handler: 'api', code: 'REV' },
    { key: '1 Enoch', label: '1 Enoch (old)', chapters: 108, handler: 'localJson', url: './1enoch.json', notes: 'R.H. Charles’s 1917 translation', code: 'ENO' }
];



