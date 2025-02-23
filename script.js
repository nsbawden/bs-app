// Bible-API.com config
const BIBLE_API_BASE = 'https://bible-api.com';

// Load or initialize state with AI history, merging with defaults
const defaultState = {
    bibleVersion: 'web',
    currentVerse: { book: 'john', chapter: 3, verse: 16 },
    notes: {},
    highlights: {},
    recentSearches: [],
    aiHistory: []
};
let state = { ...defaultState, ...JSON.parse(localStorage.getItem('bibleState')) };

// DOM elements
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

// Bible-API.com book list with chapter counts
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
    'jude': 1, 'revelation': 22
};

// Book order for navigation
const bookOrder = [
    'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth',
    '1 samuel', '2 samuel', '1 kings', '2 kings', '1 chronicles', '2 chronicles', 'ezra',
    'nehemiah', 'esther', 'job', 'psalms', 'proverbs', 'ecclesiastes', 'song of solomon',
    'isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos',
    'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah',
    'malachi', 'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1 corinthians',
    '2 corinthians', 'galatians', 'ephesians', 'philippians', 'colossians', '1 thessalonians',
    '2 thessalonians', '1 timothy', '2 timothy', 'titus', 'philemon', 'hebrews', 'james',
    '1 peter', '2 peter', '1 john', '2 john', '3 john', 'jude', 'revelation'
];

// Fetch chapter data
async function fetchChapter(book, chapter, version) {
    const response = await fetch(`${BIBLE_API_BASE}/${book}+${chapter}?translation=${version}`);
    const data = await response.json();
    return data;
}

// AI Modules
const aiModules = {
    grokManual: {
        async query(question, context) {
            const fullQuery = `${context}: ${question}`;
            navigator.clipboard.writeText(fullQuery)
                .then(() => console.log('Query copied to clipboard:', fullQuery))
                .catch(err => console.error('Clipboard failed:', err));
            aiPopup.classList.remove('hidden');
            aiResponseInput.value = '';
            return new Promise(resolve => {
                aiResponseSubmit.onclick = () => {
                    const response = aiResponseInput.value.trim();
                    if (response) {
                        aiPopup.classList.add('hidden');
                        resolve(response);
                    }
                };
            });
        }
    }
};

// Current AI module
const currentAIModule = aiModules.grokManual;

async function queryAI(question) {
    const context = `${state.currentVerse.book} ${state.currentVerse.chapter}:${state.currentVerse.verse} (${state.bibleVersion.toUpperCase()})`;
    aiOutput.textContent = 'Query copied to clipboard. Paste it to Grok/ChatGPT, then paste the answer in the popup.';
    const response = await currentAIModule.query(question, context);
    if (typeof marked !== 'undefined') {
        aiOutput.innerHTML = marked.parse(response);
        aiOutput.classList.add('expanded'); // Expand on new answer
        aiToggle.textContent = 'Collapse';
    } else {
        console.error('Marked.js not loaded; displaying plain text');
        aiOutput.textContent = response;
    }
    state.aiHistory.push({ question, answer: response, context });
    saveState();
}

// Populate selectors
function populateSelectors() {
    bookSelect.innerHTML = bookOrder.map(b => `<option value="${b}">${b}</option>`).join('');
    bookSelect.value = state.currentVerse.book;
    versionSelect.value = state.bibleVersion;
    updateChapters();
}

async function updateChapters() {
    const chapterCount = books[state.currentVerse.book];
    chapterSelect.innerHTML = Array.from({ length: chapterCount }, (_, i) =>
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    chapterSelect.value = state.currentVerse.chapter;
    await refreshDisplay();
}

async function refreshDisplay() {
    const data = await fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion);
    const verseCount = data.verses.length;

    verseSelect.innerHTML = Array.from({ length: verseCount }, (_, i) =>
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    verseSelect.value = state.currentVerse.verse;

    const currentBookIndex = bookOrder.indexOf(state.currentVerse.book);
    const chapterCount = books[state.currentVerse.book];
    let prevLabel = state.currentVerse.chapter > 1 ? 'Previous Chapter' : (currentBookIndex > 0 ? 'Previous Book' : '');
    let nextLabel = state.currentVerse.chapter < chapterCount ? 'Next Chapter' : (currentBookIndex < bookOrder.length - 1 ? 'Next Book' : '');

    let content = prevLabel ? `<button class="nav-button" onclick="goToPrevious()">${prevLabel}</button>` : '';

    let paragraphs = [];
    let currentParagraph = '';
    data.verses.forEach((v, i) => {
        const verseNum = i + 1;
        const selected = verseNum === state.currentVerse.verse ? 'selected' : '';
        const verseText = `<span class="verse-num">${verseNum}</span> ${v.text}`;

        currentParagraph += `<span class="verse ${selected}" data-verse="${verseNum}">${verseText}</span> `;
        if ((i + 1) % 5 === 0 || i === data.verses.length - 1) {
            paragraphs.push(`<p>${currentParagraph.trim()}</p>`);
            currentParagraph = '';
        }
    });
    content += paragraphs.join('');

    if (nextLabel) content += `<button class="nav-button" onclick="goToNext()">${nextLabel}</button>`;

    verseDisplay.innerHTML = content;
    saveState();
}

// Navigation functions
window.goToNext = function () {
    const currentBookIndex = bookOrder.indexOf(state.currentVerse.book);
    const chapterCount = books[state.currentVerse.book];

    if (state.currentVerse.chapter < chapterCount) {
        state.currentVerse.chapter++;
    } else if (currentBookIndex < bookOrder.length - 1) {
        state.currentVerse.book = bookOrder[currentBookIndex + 1];
        state.currentVerse.chapter = 1;
    } else {
        return;
    }
    state.currentVerse.verse = 1;
    populateSelectors();
};

window.goToPrevious = function () {
    const currentBookIndex = bookOrder.indexOf(state.currentVerse.book);

    if (state.currentVerse.chapter > 1) {
        state.currentVerse.chapter--;
    } else if (currentBookIndex > 0) {
        state.currentVerse.book = bookOrder[currentBookIndex - 1];
        state.currentVerse.chapter = books[state.currentVerse.book];
    } else {
        return;
    }
    state.currentVerse.verse = 1;
    populateSelectors();
};

// Event listeners
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

function saveState() {
    localStorage.setItem('bibleState', JSON.stringify(state));
}

// Initialize
populateSelectors();

// Ensure toggle starts in correct state
if (aiOutput.innerHTML) {
    aiOutput.classList.add('expanded');
    aiToggle.textContent = 'Collapse';
} else {
    aiOutput.classList.remove('expanded');
    aiToggle.textContent = 'Expand';
}