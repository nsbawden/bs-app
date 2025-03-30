// bible.js

// Main chapter retrieval dispatcher function with caching
async function fetchChapter(book, chapter, version) {
    let result;

    // Handle custom version first
    if (bookSource() === 'custom') {
        const chapterContent = await QB.loadChapter(book, chapter.toString());
        if (!chapterContent) {
            throw new Error(`Chapter ${chapter} not found in custom book ${book}`);
        }
        // Parse markdown content into verses format
        result = QB.parseVerses(book, parseInt(chapter), chapterContent);
        // Add translation metadata
        result.translation_id = 'custom';
        result.translation_name = 'Custom Version';
        result.translation_note = 'User-created content';
        return result;
    }

    // API Bible versions
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
    const maxRetries = 5;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            chapterCache[cacheKey] = {
                data: result,
                lastLoaded: Date.now()
            };
            saveChapterCache();
            console.log(`Cache miss - stored ${cacheKey}`);
            break;
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                retries++;
                console.log(`Cache write failed (attempt ${retries}/${maxRetries}): ${error.message}`);
                if (retries < maxRetries) {
                    console.log('Pruning 5 chapters to free space...');
                    pruneOldChapters(5);
                    saveChapterCache();
                } else {
                    console.error('Max retries reached, unable to cache chapter');
                    throw new Error(`Failed to cache ${cacheKey} after ${maxRetries} attempts: ${error.message}`);
                }
            } else {
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

function hasBibleBook(key) {
    return books.some(book => book.key === key);
}

function bookProperty(bookName, property) {
    const book = books.find(book => book.key === bookName);
    return book ? book[property] : undefined;
}

function goToVerse(verse, chapter, book) {
    chapter = chapter ? parseInt(chapter) : null;
    verse = verse ? parseInt(verse) : null;

    if (book) {
        state.bookSource = hasBibleBook(book) ? 'bible' : 'custom';
        state.currentVerse.book = book;
    }

    if (chapter && chapter > 0) {
        if (state.bookSource === 'bible') {
            // Only validate chapter for Bible books using static structure
            const maxChapters = bookProperty(state.currentVerse.book, 'chapters');
            if (maxChapters >= chapter) {
                state.currentVerse.chapter = chapter;
            }
        } else {
            // For custom books, accept the chapter without validation
            state.currentVerse.chapter = chapter;
        }
    }

    if (verse && verse > 0) {
        state.currentVerse.verse = verse;
    }

    loadBooks(); // Refresh UI
}

function updateMy(hasBooks) {
    const cbo = document.getElementById('custom-books-option');
    if (hasBooks) {
        cbo.style.visibility = 'visible';
    } else {
        cbo.style.visibility = 'hidden';
    }
}

async function validateBook() {
    const hasBooks = (await QB.hasBooks());
    if (bookSource() === 'bible') {
        state.bibleVersion = state.bibleVersion === 'custom' ? 'kjv' : state.bibleVersion;
    }
    else {
        if (!hasBooks) {
            state.bookSource = 'bible';
            state.bibleVersion = state.bibleVersion === 'custom' ? 'kjv' : state.bibleVersion;
        } else {
            state.bookSource = 'custom';
        }
    }
    updateMy(hasBooks);
}

async function loadBooks() {
    await validateBook();
    if (bookSource() === 'custom') {
        const customBooks = await QB.listBooks();
        if (customBooks.length === 0) {
            bookSelect.innerHTML = '<option value="">No custom books available</option>';
        } else {
            bookSelect.innerHTML = customBooks.map(book =>
                `<option value="${book.title}">${book.title}</option>` // Use title instead of key
            ).join('');
            if (!customBooks.some(b => b.title === state.currentVerse.book)) {
                state.currentVerse.book = customBooks[0].title; // Set to title
            }
        }
    } else {
        bookSelect.innerHTML = books.map(b =>
            `<option value="${b.key}">${b.label}</option>`
        ).join('');
        if (!books.some(b => b.key === state.currentVerse.book)) {
            state.currentVerse.book = books[0].key;
        }
    }

    bookSelect.value = state.currentVerse.book;
    versionSelect.value = bookSource() === 'custom' ? 'custom' : state.bibleVersion;
    await updateChapters();
}

async function updateChapters() {
    verseDisplay.innerHTML = ''; // Clear display while loading

    if (bookSource() === 'custom') {
        // Get chapter list for custom book
        const chapters = await QB.listChapters(state.currentVerse.book);
        if (chapters.length === 0) {
            chapterSelect.innerHTML = '<option value="">No chapters available</option>';
        } else {
            // Chapters are stored as strings, convert to numbers for sorting
            const chapterNumbers = chapters.map(ch => parseInt(ch)).sort((a, b) => a - b);
            chapterSelect.innerHTML = chapterNumbers.map(num =>
                `<option value="${num}">${num}</option>`
            ).join('');
            // Validate current chapter
            if (!chapterNumbers.includes(state.currentVerse.chapter)) {
                state.currentVerse.chapter = chapterNumbers[0];
            }
        }
    } else {
        // Standard Bible book chapters
        const book = books.find(b => b.key === state.currentVerse.book);
        const chapterCount = book ? book.chapters : 0;
        if (chapterCount === 0) {
            chapterSelect.innerHTML = '<option value="">No chapters available</option>';
        } else {
            chapterSelect.innerHTML = Array.from({ length: chapterCount }, (_, i) =>
                `<option value="${i + 1}">${i + 1}</option>`
            ).join('');
            // Validate current chapter
            if (state.currentVerse.chapter > chapterCount || state.currentVerse.chapter < 1) {
                state.currentVerse.chapter = 1;
            }
        }
    }

    chapterSelect.value = state.currentVerse.chapter;
    await refreshDisplay();
}

async function refreshDisplay() {
    verseDisplay.innerHTML = '';
    let data = await fetchChapter(state.currentVerse.book, state.currentVerse.chapter, state.bibleVersion);
    window.currentData = data;
    const verseCount = data.verses.length;

    // Populate verse selector
    verseSelect.innerHTML = Array.from({ length: verseCount }, (_, i) =>
        `<option value="${i + 1}">${i + 1}</option>`
    ).join('');
    verseSelect.value = state.currentVerse.verse;
    let nextLabel = '';
    let prevLabel = '';

    if (bookSource() === 'custom') {
        const chapterCount = QB.getChapterCount(state.currentVerse.book);
        prevLabel = state.currentVerse.chapter > 1 ? 'Previous Chapter' : '';
        nextLabel = state.currentVerse.chapter < chapterCount ? 'Next Chapter' : '';
    } else {
        const currentBook = books.find(b => b.key === state.currentVerse.book);
        const currentBookIndex = books.indexOf(currentBook);
        const chapterCount = currentBook.chapters;
        prevLabel = state.currentVerse.chapter > 1 ? 'Previous Chapter' : (currentBookIndex > 0 ? 'Previous Book' : '');
        nextLabel = state.currentVerse.chapter < chapterCount ? 'Next Chapter' : (currentBookIndex < books.length - 1 ? 'Next Book' : '');
    }

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

        // const verseText = `<span class="verse-num${bookmarkedClass}" title="${addOrEdit} note" data-reference="${reference}">${verseNum}</span><span class="verse-text">${v.text.trim()}</span>`;
        // currentParagraph += `<span class="verse ${selected} ${hasNoteClass}" data-verse="${verseNum}">${verseText}</span> `;

        const verseText = `<span class="verse-num${bookmarkedClass}" title="${addOrEdit} note" data-reference="${reference}">${verseNum}</span><div class="verse-text">${v.text.trim()}</div>`;
        currentParagraph += `<div class="verse ${selected} ${hasNoteClass}" data-verse="${verseNum}">${verseText}</div> `;

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
    loadBooks();
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
    loadBooks();
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

/*
 * askUser(config)
 * Displays a popup with one or two textareas and an action button.
 *
 * Config Options:
 * - buttonText (string, required): Text for the submit button.
 * - action (function, required): Function to call with the first textarea's value.
 * - text (string, optional): Default value for the first textarea.
 * - prompt (string, optional): Placeholder text for the first textarea.
 * - rows (number, optional): Number of rows for the first textarea (default: 3).
 * - prompt2 (string, optional): If provided, a second textarea is added.
 * - rows2 (number, optional): Number of rows for the second textarea (default: 3).
 * - action2 (function, optional): Function to call with the second textarea's value.
 *   - If omitted, `action` will receive an array `[text1, text2]` instead.
 *
 * Behavior:
 * - Pressing Enter in the first textarea moves focus to the second (if present).
 * - Clicking the submit button calls `action` (and `action2` if provided).
 * - Pressing Escape or clicking the close button removes the popup.
 */

/*
 * askUser(config)
 * Displays a popup with one or two textareas and an action button.
 *
 * Config Options:
 * - buttonText (string, required): Text for the submit button.
 * - action (function, required): Function to call with the first textarea's value.
 * - text (string, optional): Default value for the first textarea.
 * - prompt (string, optional): Placeholder text for the first textarea.
 * - rows (number, optional): Number of rows for the first textarea (default: 3).
 * - prompt2 (string, optional): If provided, a second textarea is added.
 * - rows2 (number, optional): Number of rows for the second textarea (default: 3).
 * - action2 (function, optional): Function to call with the second textarea's value.
 *   - If omitted, `action` will receive an array `[text1, text2]` instead.
 *
 * Behavior:
 * - Pressing Enter in the first textarea moves focus to the second (if present).
 * - Clicking the submit button calls `action` (and `action2` if provided).
 * - Pressing Escape or clicking the close button removes the popup.
 */

function askUser(config) {
    // Validate required config properties
    if (!config.buttonText || !config.action) {
        throw new Error('Missing required config property: buttonText or action');
    }

    // Remove any existing popup
    document.querySelector('.note-popup')?.remove();

    // Create popup elements
    const popup = document.createElement('div');
    popup.className = 'note-popup';

    const textarea1 = document.createElement('textarea');
    textarea1.className = 'ask-popup-textarea';
    textarea1.value = config.text || '';
    textarea1.placeholder = config.prompt || '';
    textarea1.rows = config.rows || 3;

    let textarea2 = null;
    if (config.prompt2) {
        textarea2 = document.createElement('textarea');
        textarea2.className = 'ask-popup-textarea';
        textarea2.placeholder = config.prompt2;
        textarea2.rows = config.rows2 || 3;
    }

    const actionButton = document.createElement('button');
    actionButton.className = 'note-popup-button';
    actionButton.textContent = config.buttonText;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.className = 'note-popup-close';
    closeButton.title = 'Close';

    // Setup action handler
    actionButton.addEventListener('click', () => {
        if (config.prompt2) {
            if (config.action2) {
                config.action(textarea1.value);
                config.action2(textarea2.value);
            } else {
                config.action([textarea1.value, textarea2.value]);
            }
        } else {
            config.action(textarea1.value);
        }
        cleanupAndRemove();
    });

    // Move focus to second textarea on Enter
    textarea1.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && textarea2) {
            e.preventDefault();
            textarea2.focus();
        }
    });

    // Append elements
    popup.appendChild(closeButton);
    popup.appendChild(textarea1);
    if (textarea2) popup.appendChild(textarea2);
    popup.appendChild(actionButton);
    document.body.appendChild(popup);

    // Center the popup in the viewport
    popup.style.position = 'fixed';
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';

    // Cleanup function
    const cleanupAndRemove = () => {
        document.removeEventListener('keydown', handleKeyPress);
        popup.remove();
    };

    // Escape key handler
    const handleKeyPress = (e) => {
        if (e.key === 'Escape') cleanupAndRemove();
    };

    // Event listeners
    closeButton.addEventListener('click', cleanupAndRemove);
    document.addEventListener('keydown', handleKeyPress);

    // Focus first textarea
    textarea1.focus();
}

// Copy user data to clipboard
function exportUserData() {
    askUser({
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
    askUser({
        prompt: 'Paste user data here...',
        buttonText: 'Apply',
        action: (text) => {
            importLocalUser(text);
        }
    });
}

// Import AI area output text
function importAiOutput() {
    askUser({
        prompt: 'Paste text here...',
        buttonText: 'Apply',
        action: (text) => {
            showText(text);
        }
    });
}

// Import Custom Book
function importBook() {
    askUser({
        prompt: 'Book name',
        rows: 1,
        prompt2: 'Paste book text here...',
        buttonText: 'Save',
        action: async (texts) => {
            try {
                const bookName = texts[0].trim();
                await QB.createBook(bookName);
                await QB.saveChapter(bookName, "1", texts[1]);
                updateMy(true);
            } catch (error) {
                alert(`Error importing book: ${error.message}`);
            }
        }
    });
}

// Import Custom Chapter
function importChapter() {
    askUser({
        prompt: 'Paste chapter content here...',
        rows: 4,
        buttonText: 'Save',
        action: async (text) => {
            try {
                // Get the current number of chapters for the book
                const chapterCount = await QB.getChapterCount(state.currentVerse.book);
                // Next chapter number is count + 1
                const nextChapter = (chapterCount + 1).toString();
                await QB.saveChapter(state.currentVerse.book, nextChapter, text);
                updateMy(true);
            } catch (error) {
                alert(`Error importing chapter: ${error.message}`);
            }
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
        headings: /^#{1,6}\s+.+/m,
        bold: /\*\*.+?\*\*|__.+?__/g,
        italic: /\*[^*]+\*|_[^_]+_/g,
        lists: /^\s*([-*+]|\d+\.)\s+.+/m,
        blockquote: /^\s*>.+/m,
        inline_code: /`[^`]+`/g
    };

    return Object.values(markdownPatterns).some(regex => regex.test(text));
}

function xdetectMarkdown(text) {
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
loadBooks().then(() => {
    adjustTabCount();
    setActiveTab(1);
});
