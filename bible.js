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

    // Store in cache
    chapterCache[cacheKey] = {
        data: result,
        lastLoaded: Date.now()
    };
    console.log(`Cache miss - stored ${cacheKey}`);
    saveChapterCache();

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

function populateSelectors() {
    bookSelect.innerHTML = books.map(b => `<option value="${b.key}">${b.label}</option>`).join('');
    bookSelect.value = state.currentVerse.book;
    versionSelect.value = state.bibleVersion;
    updateChapters();
}

async function updateChapters() {
    const book = books.find(b => b.key === state.currentVerse.book);
    const chapterCount = book.chapters;
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
        const url = `/index.html?book=${book}&chapter=${chapter}&verse=${verse}`;
        return `<a href="${url}" class="bookmark-item">${displayText}</a>`;
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
    populateSelectors();
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
    populateSelectors();
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
    popup.style.position = 'absolute';
    popup.style.background = '#2A2A2A';
    popup.style.color = '#F0F0F0';
    popup.style.padding = '10px';
    popup.style.border = '1px solid #4A704A';
    popup.style.zIndex = '1000';
    popup.style.maxWidth = '400px';

    const textarea = document.createElement('textarea');
    textarea.value = existingNote;
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.background = '#1A1A1A';
    textarea.style.color = '#F0F0F0';
    textarea.style.border = '1px solid #4A704A';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.background = '#4A704A';
    saveButton.style.color = '#F0F0F0';
    saveButton.style.border = 'none';
    saveButton.style.padding = '5px 10px';
    saveButton.style.marginRight = '5px';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.background = '#4A704A';
    cancelButton.style.color = '#F0F0F0';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '5px 10px';
    cancelButton.style.marginRight = '5px';

    const bookmarks = getBookmarks();
    const isBookmarked = bookmarks.includes(reference);
    const bookmarkButton = document.createElement('button');
    bookmarkButton.textContent = isBookmarked ? 'Remove Bookmark' : 'Bookmark';
    bookmarkButton.style.background = '#4A704A';
    bookmarkButton.style.color = '#F0F0F0';
    bookmarkButton.style.border = 'none';
    bookmarkButton.style.padding = '5px 10px';

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
        const desiredTop = numRect.bottom; // Position below the verse number
        const desiredLeft = numRect.left;  // Align with verse number's left edge

        // Check if popup fits at desired position
        const fitsBelow = (desiredTop + popupHeight) <= viewportHeight;
        const fitsHorizontally = (desiredLeft >= 0) && ((desiredLeft + popupWidth) <= viewportWidth);

        if (fitsBelow && fitsHorizontally) {
            // Position below verse number and aligned with its left edge
            popup.style.top = `${desiredTop}px`;
            popup.style.left = `${desiredLeft}px`;
        } else {
            // Center on screen as fallback
            popup.style.position = 'fixed';
            popup.style.left = `${(viewportWidth - popupWidth) / 2}px`;
            popup.style.top = `${(viewportHeight - popupHeight) / 2}px`;
        }
    } else {
        // Fallback to center if no verseSpan (shouldn't happen in current use cases)
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
            removeBookmark(reference); // Remove the bookmark
        } else {
            addBookmark(reference); // Add the bookmark
        }
        cleanupAndRemove(); // Close the popup
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

function linkVerses(text) {
    // Extract book names from the books array
    const bookNames = books.map(book => book.key);

    // Create the regex pattern
    const bookPattern = bookNames.join('|');
    const regex = new RegExp(`(${bookPattern})\\s+(\\d+):(\\d+)(?:-(\\d+))?`, 'g');

    // Replace references with links in the provided text
    const linkedText = text.replace(regex, (match, book, chapter, startVerse, endVerse) => {
        const encodedBook = encodeURIComponent(book);
        const url = `/index.html?book=${encodedBook}&chapter=${chapter}&verse=${startVerse}`;
        return `<a href="${url}">${match}</a>`;
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

function showBook(label, content) {
    displayResult("", content, true);
}

// Initialize
loadQueryString();
populateSelectors();
adjustTabCount();
setActiveTab(1);