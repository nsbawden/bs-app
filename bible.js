// bible.js

// Main dispatcher function with caching
async function fetchChapter(book, chapter, version) {
    const bookData = books.find(b => b.key === book);
    if (!bookData) throw new Error(`Book ${book} not found in books array`);

    const cacheKey = `${version}-${book}-${chapter}`;

    // Check cache first
    if (chapterCache[cacheKey]) {
        console.log(`Cache hit for ${cacheKey}`);
        chapterCache[cacheKey].lastLoaded = Date.now();
        saveChapterCache(); // Update cache timestamp in storage
        return chapterCache[cacheKey].data;
    }

    let result;
    switch (bookData.handler) {
        case 'localJson':
            const response = await fetch(bookData.url);
            const data = await response.json();
            const chapterData = data.chapters.find(ch => ch.chapter === parseInt(chapter));
            result = chapterData || { verses: [] };
            break;
        case 'api':
            switch (state.apiSource) {
                case 'bible-api.com':
                    result = await fetchBibleApiCom(book, chapter, version);
                    break;
                case 'api.bible':
                    result = await fetchApiBible(book, chapter, version, bookData);
                    break;
                case 'api.esv.org':
                    result = await fetchApiEsv(book, chapter);
                    break;
                default:
                    throw new Error(`Unknown apiSource: ${state.apiSource}`);
            }
            break;
        default:
            throw new Error(`Unknown handler type: ${bookData.handler} for book ${book}`);
    }

    // Store in cache with retry logic on failure
    const maxRetries = 5; // Limit retries to prevent infinite loops
    let retries = 0;
    while (retries < maxRetries) {
        try {
            chapterCache[cacheKey] = {
                data: result,
                lastLoaded: Date.now()
            };
            saveChapterCache(); // This might throw QuotaExceededError
            console.log(`Cache miss - stored ${cacheKey}`);
            break; // Success, exit loop
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                retries++;
                console.log(`Cache write failed (attempt ${retries}/${maxRetries}): ${error.message}`);
                if (retries < maxRetries) {
                    console.log('Pruning 5 chapters to free space...');
                    pruneOldChapters(5); // Prune 5 chapters
                    saveChapterCache(); // Update storage after pruning
                } else {
                    console.error('Max retries reached, unable to cache chapter');
                    throw new Error(`Failed to cache ${cacheKey} after ${maxRetries} attempts: ${error.message}`);
                }
            } else {
                // Non-quota error (e.g., JSON.stringify failure), rethrow immediately
                throw error;
            }
        }
    }

    return result;
}

// Fetch function for bible-api.com
async function fetchBibleApiCom(book, chapter, version) {
    const apiResponse = await fetch(`${BIBLE_API_BASE}/${book}+${chapter}?translation=${version}`);
    const apiData = await apiResponse.json();
    return apiData;
}

// Fetch function for api.bible
async function fetchApiBible(book, chapter, version, bookData) {
    // Map version to api.bible Bible ID (e.g., KJV)
    const bibleIdMap = {
        'kjv': 'de4e12af7f28f599-01', // Adjust based on your available IDs
        // Add other versions as needed
    };
    const bibleId = bibleIdMap[version] || version; // Fallback to passed version if unmapped
    const apiKey = localStorage.getItem('bibleApiKey');
    if (!apiKey) throw new Error('API key not found in localStorage');

    // Convert full book name to abbreviation
    const bookAbbr = bookMap[book];
    if (!bookAbbr) throw new Error(`Book ${book} not found in bookMap`);
    const chapterId = `${bookAbbr}.${chapter}`; // e.g., "MAT.7"
    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`;
    const apiBibleResponse = await fetch(url, {
        headers: {
            'api-key': apiKey
        }
    });
    if (!apiBibleResponse.ok) throw new Error(`API Bible request failed: ${apiBibleResponse.statusText}`);
    const apiBibleData = await apiBibleResponse.json();
    const rawData = apiBibleData.data;

    // Convert api.bible data to bible-api.com format
    const convertedData = {
        reference: rawData.reference,
        verses: [],
        text: '',
        translation_id: version,
        translation_name: bibleId === 'de4e12af7f28f599-01' ? 'King James Version' : 'Unknown Translation',
        translation_note: rawData.copyright || 'Public Domain'
    };

    // Helper function to extract text from nested items
    function extractText(items, currentVerse = null, verseText = '', skipVerseNumber = false) {
        items.forEach(item => {
            if (item.type === 'tag' && item.name === 'verse' && item.attrs?.number) {
                if (currentVerse && verseText) {
                    convertedData.verses.push({
                        book_id: rawData.bookId,
                        book_name: bookData.name || book,
                        chapter: parseInt(rawData.number),
                        verse: parseInt(currentVerse),
                        text: verseText.trim()
                    });
                }
                currentVerse = item.attrs.number;
                verseText = '';
                if (item.items) {
                    extractText(item.items, currentVerse, verseText, true);
                }
            } else if (item.type === 'text' && !skipVerseNumber) {
                if (item.text !== '¶') {
                    verseText += item.text;
                }
            } else if (item.type === 'tag' && item.items) {
                const nestedResult = extractText(item.items, currentVerse, verseText, false);
                verseText = nestedResult.verseText;
            }
        });
        if (currentVerse && verseText) {
            convertedData.verses.push({
                book_id: rawData.bookId,
                book_name: bookData.name || book,
                chapter: parseInt(rawData.number),
                verse: parseInt(currentVerse),
                text: verseText.trim()
            });
        }
        return { currentVerse, verseText };
    }

    // Process the content array
    rawData.content.forEach(paragraph => {
        if (paragraph.items) {
            extractText(paragraph.items);
        }
    });

    // Build the full chapter text
    convertedData.text = convertedData.verses.map(v => `${v.verse} ${v.text}`).join(' ');
    return convertedData;
}

// Fetch function for api.esv.org
async function fetchApiEsv(book, chapter) {
    const esvApiKey = localStorage.getItem('esvApiKey');
    if (!esvApiKey) throw new Error('ESV API key not found in localStorage');
    const esvUrl = `https://api.esv.org/v3/passage/text/?q=${book}+${chapter}&include-verse-numbers=true&include-chapter-numbers=false&include-footnotes=false&include-headings=false`;
    const esvResponse = await fetch(esvUrl, {
        headers: {
            'Authorization': `Token ${esvApiKey}`
        }
    });
    if (!esvResponse.ok) throw new Error(`ESV API request failed: ${esvResponse.statusText}`);
    const esvData = await esvResponse.json();

    // Convert ESV data to bible-api.com format
    const convertedData = {
        reference: `${book} ${chapter}`,
        verses: [],
        text: esvData.passages[0].replace(/^.*\n\n\s*/, '').replace(/\s*\(ESV\)$/, '').trim(),
        translation_id: 'esv',
        translation_name: 'English Standard Version',
        translation_note: 'Copyright © 2001 by Crossway'
    };

    // Parse the passage text into individual verses
    const passageText = esvData.passages[0].replace(/^.*\n\n\s*/, '').replace(/\s*\(ESV\)$/, '');
    const verseMatches = passageText.match(/\[(\d+)\](.*?)(?=\[\d+\]|$)/gs) || [];

    let quoteOpen = false; // Track if a quote is open going into the next verse
    verseMatches.forEach((match, index) => {
        const [, verseNum, verseText] = match.match(/\[(\d+)\]\s*(.+)/s);
        if (verseNum && verseText) {
            let cleanedText = verseText.trim();
            let adjustedText = cleanedText;

            // Count quotes in the current verse
            const openingQuotes = (cleanedText.match(/“/g) || []).length;
            const closingQuotes = (cleanedText.match(/”/g) || []).length;

            // Apply opening quote if continuing from a previous verse
            if (quoteOpen && openingQuotes === 0) {
                adjustedText = `“${cleanedText}`;
            }

            // Determine quote state
            if (openingQuotes > closingQuotes) {
                // Quote opens and doesn’t close in this verse
                adjustedText = `${adjustedText}”`;
                quoteOpen = true;
            } else if (closingQuotes > openingQuotes) {
                // Quote closes in this verse
                quoteOpen = false;
            } else if (quoteOpen && openingQuotes === 0 && index < verseMatches.length - 1) {
                // Continuation verse, close and signal next verse to open
                adjustedText = `${adjustedText}”`;
                quoteOpen = true;
            } else {
                // No change in quote state, or self-contained quote
                quoteOpen = false;
            }

            convertedData.verses.push({
                book_id: bookMap[book] || book.toUpperCase().slice(0, 3),
                book_name: book,
                chapter: parseInt(chapter),
                verse: parseInt(verseNum),
                text: adjustedText
            });
        }
    });

    return convertedData;
}

function hasBook(key) {
    return books.some(book => book.key === key);
}

function bookProperty(bookName, property) {
    const book = books.find(book => book.key === bookName);
    return book ? book[property] : undefined;
}

function goToVerse(verse, chapter, book) {
    chapter = chapter ? parseInt(chapter) : null;
    verse = verse ? parseInt(verse) : null;
    if (book && hasBook(book)) {
        state.currentVerse.book = book;
    }
    if (chapter && chapter > 0 && bookProperty(state.currentVerse.book, 'chapters') >= chapter) {
        state.currentVerse.chapter = chapter;
    }
    if (verse && verse > 0) {
        state.currentVerse.verse = verse;
    }
    loadVerse();
}

function loadVerse() {
    // Populate the books selector
    bookSelect.innerHTML = books.map(b => `<option value="${b.key}">${b.label}</option>`).join('');
    bookSelect.value = state.currentVerse.book;
    versionSelect.value = state.bibleVersion;
    updateChapters();
}

async function updateChapters() {
    // Populate the chapters selector
    const book = books.find(b => b.key === state.currentVerse.book);
    const chapterCount = book.chapters;
    chapterSelect.innerHTML = Array.from({ length: chapterCount }, (_, i) =>
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    chapterSelect.value = state.currentVerse.chapter;
    await refreshDisplay();
}

async function refreshDisplay() {
    verseDisplay.innerHTML = '';
    const data = await fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion);
    const verseCount = data.verses.length;

    // Populate verse selector
    verseSelect.innerHTML = Array.from({ length: verseCount }, (_, i) =>
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    verseSelect.value = state.currentVerse.verse;

    const currentBook = books.find(b => b.key === state.currentVerse.book);
    const currentBookIndex = books.indexOf(currentBook);
    const chapterCount = currentBook.chapters;
    let prevLabel = state.currentVerse.chapter > 1 ? 'Previous Chapter' : (currentBookIndex > 0 ? 'Previous Book' : '');
    let nextLabel = state.currentVerse.chapter < chapterCount ? 'Next Chapter' : (currentBookIndex < books.length - 1 ? 'Next Book' : '');

    let content = prevLabel ? `<button class="nav-button" onclick="goToPrevious()">${prevLabel}</button>` : '';
    // Always include the bookmark-list span, even if empty
    content += `<span class="bookmark-list"></span>`;

    let notes = getNotes();
    let paragraphs = [];
    let currentParagraph = '';
    data.verses.forEach((v, i) => {
        const verseNum = i + 1;
        const selected = verseNum === state.currentVerse.verse ? 'selected' : '';
        const reference = `${state.currentVerse.book}/${state.currentVerse.chapter}/${verseNum}`;
        const hasNote = notes[reference];
        const bookmarkedClass = hasBookmark(reference) ? ' bookmarked' : '';
        const addOrEdit = hasNote ? 'edit' : 'add';
        const hasNoteClass = hasNote ? 'has-note' : '';
        const verseText = `<span class="verse-num${bookmarkedClass}" title="${addOrEdit} note" data-reference="${reference}">${verseNum}</span><span class="verse-text">${v.text.trim()}</span>`;

        currentParagraph += `<span class="verse ${selected} ${hasNoteClass}" data-verse="${verseNum}">${verseText}</span> `;
        if ((i + 1) % 5 === 0 || i === data.verses.length - 1) {
            paragraphs.push(`<p>${currentParagraph.trim()}</p>`);
            currentParagraph = '';
        }
    });
    content += paragraphs.join('');

    if (nextLabel) content += `<button class="nav-button" onclick="goToNext()">${nextLabel}</button>`;

    verseDisplay.innerHTML = content;
    saveState();
    scrollToSelectedVerse();

    // Populate the bookmark list after rendering
    rebuildBookmarksList();

    document.querySelectorAll('.verse-num').forEach(verseNum => {
        verseNum.addEventListener('click', (e) => {
            e.stopPropagation();
            const reference = verseNum.dataset.reference;
            const verseSpan = verseNum.parentElement;
            showNotePopup(reference, verseSpan);
        });
    });
}

function rebuildBookmarksList() {
    const bookmarkList = document.querySelector('.bookmark-list');
    if (!bookmarkList) return; // Exit if not found (shouldn’t happen after refreshDisplay)

    const bookmarks = getBookmarks();
    const bookmarkLinks = bookmarks.map(ref => {
        const [book, chapter, verse] = ref.split('/');
        const displayText = `${book} ${chapter}:${verse}`;
        return `<a href="#" onclick="goToVerse('${verse}', '${chapter}', '${book}'); return false;" class="bookmark-item">${displayText}</a>`;
    }).join(' ');

    bookmarkList.innerHTML = bookmarkLinks || ''; // Empty string if no bookmarks
}

window.goToNext = function () {
    const currentBook = books.find(b => b.key === state.currentVerse.book);
    const currentBookIndex = books.indexOf(currentBook);
    const chapterCount = currentBook.chapters;

    if (state.currentVerse.chapter < chapterCount) {
        state.currentVerse.chapter++;
    } else if (currentBookIndex < books.length - 1) {
        state.currentVerse.book = books[currentBookIndex + 1].key;
        state.currentVerse.chapter = 1;
    } else {
        return;
    }
    state.currentVerse.verse = 1;
    loadVerse();
};

window.goToPrevious = function () {
    const currentBook = books.find(b => b.key === state.currentVerse.book);
    const currentBookIndex = books.indexOf(currentBook);

    if (state.currentVerse.chapter > 1) {
        state.currentVerse.chapter--;
    } else if (currentBookIndex > 0) {
        state.currentVerse.book = books[currentBookIndex - 1].key;
        state.currentVerse.chapter = books[currentBookIndex - 1].chapters;
    } else {
        return;
    }
    state.currentVerse.verse = 1;
    loadVerse();
};

function getSelectedVerseText() {
    const selectedVerse = document.querySelector('.verse.selected');
    if (!selectedVerse) {
        return "";
    }
    const verseTextElement = selectedVerse.querySelector('.verse-text');
    if (!verseTextElement) {
        return "";
    }
    return verseTextElement.textContent.trim();
}

function showNotePopup(reference, verseSpan = null, event = null) {
    const existingNote = getNotes()[reference] || '';
    const existingPopup = document.querySelector('.note-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'note-popup';

    const textarea = document.createElement('textarea');
    textarea.value = existingNote;
    textarea.className = 'note-popup-textarea';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'note-popup-button note-popup-save';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'note-popup-button note-popup-cancel';

    const bookmarks = getBookmarks();
    const isBookmarked = bookmarks.includes(reference);
    const bookmarkButton = document.createElement('button');
    bookmarkButton.textContent = isBookmarked ? 'Remove Bookmark' : 'Bookmark';
    bookmarkButton.className = 'note-popup-button note-popup-bookmark';

    popup.appendChild(textarea);
    popup.appendChild(saveButton);
    popup.appendChild(cancelButton);
    popup.appendChild(bookmarkButton);
    document.body.appendChild(popup);

    // Positioning logic using the verse-num element
    const verseNum = verseSpan ? verseSpan.querySelector('.verse-num') : null;
    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (verseNum) {
        const numRect = verseNum.getBoundingClientRect();
        const desiredTop = numRect.bottom;
        const desiredLeft = numRect.left;

        const fitsBelow = (desiredTop + popupHeight) <= viewportHeight;
        const fitsHorizontally = (desiredLeft >= 0) && ((desiredLeft + popupWidth) <= viewportWidth);

        if (fitsBelow && fitsHorizontally) {
            popup.style.position = 'absolute';
            popup.style.top = `${desiredTop}px`;
            popup.style.left = `${desiredLeft}px`;
        } else {
            popup.style.position = 'fixed';
            popup.style.left = `${(viewportWidth - popupWidth) / 2}px`;
            popup.style.top = `${(viewportHeight - popupHeight) / 2}px`;
        }
    } else {
        popup.style.position = 'fixed';
        popup.style.left = `${(viewportWidth - popupWidth) / 2}px`;
        popup.style.top = `${(viewportHeight - popupHeight) / 2}px`;
    }

    // Event handlers
    const saveAndClose = () => {
        const note = textarea.value.trim();
        if (note) {
            saveNote(reference, note);
        } else {
            deleteNote(reference);
        }
        cleanupAndRemove();
        refreshDisplay();
    };

    const bookmarkAndClose = () => {
        if (isBookmarked) {
            removeBookmark(reference);
        } else {
            addBookmark(reference);
        }
        cleanupAndRemove();
    };

    const cleanupAndRemove = () => {
        document.removeEventListener('keydown', handleKeyPress);
        popup.remove();
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Escape') {
            cleanupAndRemove();
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            saveAndClose();
        }
    };

    saveButton.addEventListener('click', saveAndClose);
    cancelButton.addEventListener('click', cleanupAndRemove);
    bookmarkButton.addEventListener('click', bookmarkAndClose);
    document.addEventListener('keydown', handleKeyPress);

    // Close when clicking outside
    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            cleanupAndRemove();
            document.removeEventListener('click', closePopup);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closePopup);
    }, 0);

    // Set cursor and focus
    textarea.focus();
    if (textarea.value) {
        textarea.setSelectionRange(0, 0);
        textarea.scrollTop = 0;
    }
}

function showUserInteraction(config) {
    // Validate required config properties
    const requiredProps = ['buttonText', 'action'];
    for (const prop of requiredProps) {
        if (!(prop in config)) {
            throw new Error(`Missing required config property: ${prop}`);
        }
    }

    // Remove any existing popup
    const existingPopup = document.querySelector('.note-popup');
    if (existingPopup) existingPopup.remove();

    // Create popup elements
    const popup = document.createElement('div');
    popup.className = 'note-popup';

    const textarea = document.createElement('textarea');
    textarea.className = 'note-popup-textarea';
    textarea.value = config.text || ''; // Default to empty string if no text provided
    if (config.prompt) textarea.placeholder = config.prompt;

    const actionButton = document.createElement('button');
    actionButton.className = 'note-popup-button';
    actionButton.textContent = config.buttonText;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.className = 'note-popup-close';
    closeButton.title = 'Close';

    // Setup action handler
    actionButton.addEventListener('click', () => {
        config.action(textarea.value);
        cleanupAndRemove();
    });

    // Append elements
    popup.appendChild(closeButton);
    popup.appendChild(textarea);
    popup.appendChild(actionButton);
    document.body.appendChild(popup);

    // Center the popup
    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    popup.style.position = 'fixed';
    popup.style.left = `${(viewportWidth - popupWidth) / 2}px`;
    popup.style.top = `${(viewportHeight - popupHeight) / 2}px`;

    // Cleanup function
    const cleanupAndRemove = () => {
        document.removeEventListener('keydown', handleKeyPress);
        popup.remove();
    };

    // Escape key handler
    const handleKeyPress = (e) => {
        if (e.key === 'Escape') {
            cleanupAndRemove();
        }
    };

    // Event listeners
    closeButton.addEventListener('click', cleanupAndRemove);
    document.addEventListener('keydown', handleKeyPress);

    // Focus textarea
    textarea.focus();
}

// Copy user data to clipboard
function exportUserData() {
    showUserInteraction({
        text: exportLocalUser(),
        buttonText: 'Copy',
        action: (text) => {
            navigator.clipboard.writeText(text)
                .then(() => console.log('User data copied to clipboard'))
                .catch(err => console.error('Copy failed:', err));
        }
    });
}

// Import user data
function importUserData() {
    showUserInteraction({
        prompt: 'Paste user data here...',
        buttonText: 'Apply',
        action: (text) => {
            importLocalUser(text);
        }
    });
}

// Import AI area output text
function importAiOutput() {
    showUserInteraction({
        prompt: 'Paste text here...',
        buttonText: 'Apply',
        action: (text) => {
            showText(text);
        }
    });
}

function linkVerses(text) {
    // Extract book names from the books array
    const bookNames = books.map(book => book.key);

    // Create the regex pattern
    const bookPattern = bookNames.join('|');
    const regex = new RegExp(`(${bookPattern})\\s+(\\d+):(\\d+)(?:-(\\d+))?`, 'g');
    const linkedText = text.replace(regex, (match, book, chapter, startVerse, endVerse) => {
        return `<a href="#" onclick="goToVerse('${startVerse}', '${chapter}', '${book}'); return false;">${match}</a>`;
    });
    return linkedText;
}

function convertMarkdown(text) {
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    }
    return text;
}

function displayResult(question, answer, expand = true) {
    currentAiOutput.question = question;
    currentAiOutput.answer = answer;
    let htmlText = convertMarkdown(answer);
    let linkedContent = linkVerses(htmlText);
    if (question) {
        aiOutput.innerHTML = `<span class="question">TO AI: ${question}</span>${linkedContent}`;
    } else {
        aiOutput.innerHTML = linkedContent;
    }
    if (expand) {
        aiExpand();
    }
    else {
        aiCollapse();
    }
}

function detectMarkdown(text) {
    const markdownPatterns = {
        headings: /^#{1,6}\s+.+/m, // Matches lines that start with 1-6 '#' followed by text
        bold: /\*\*.+?\*\*|__.+?__/g, // Matches **bold** or __bold__
        italic: /\*[^*]+\*|_[^_]+_/g, // Matches *italic* or _italic_
        lists: /^\s*([-*+]|\d+\.)\s+.+/m, // Matches lists (- item, * item, 1. item)
        blockquote: /^\s*>.+/m, // Matches blockquotes starting with '>'
        inline_code: /`[^`]+`/g // Matches inline code `code`
    };

    let detected = {};
    for (const [key, regex] of Object.entries(markdownPatterns)) {
        detected[key] = regex.test(text);
    }
    return detected;
}

function convertToMarkdown(text) {
    if (detectMarkdown(text)) {
        return text;
    }

    // Split the text into lines and filter out empty ones
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    let markdown = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Handle header lines (ending with colon)
        if (line.endsWith(':')) {
            if (inList) {
                markdown += '\n'; // End previous list with extra newline
                inList = false;
            }
            markdown += `### ${line}\n\n`;
            continue;
        }

        // Treat any other line as a list item
        // Start a new list if not already in one
        if (!inList) {
            inList = true;
        }

        // Use unordered list with "- " prefix
        markdown += `- ${line}\n`;

        // Add a blank line if this is the last item before a header or end
        if (i + 1 < lines.length && lines[i + 1].endsWith(':')) {
            markdown += '\n';
            inList = false;
        }
    }

    return markdown.trim();
}

function showText(text) {
    displayResult('', convertToMarkdown(text), true);    
}

function showBook(label, content) {
    displayResult("", content, true);
}

// Initialize
loadQueryString();
loadVerse();
adjustTabCount();
setActiveTab(1);