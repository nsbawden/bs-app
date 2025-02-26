// bible.js
async function fetchChapter(book, chapter, version) {
    const bookData = books.find(b => b.key === book);
    if (!bookData) throw new Error(`Book ${book} not found in books array`);

    switch (bookData.handler) {
        case 'localJson':
            const response = await fetch(bookData.url);
            const data = await response.json();
            const chapterData = data.chapters.find(ch => ch.chapter === parseInt(chapter));
            return chapterData || { verses: [] };
        case 'api':
            const apiResponse = await fetch(`${BIBLE_API_BASE}/${book}+${chapter}?translation=${version}`);
            const apiData = await apiResponse.json();
            return apiData;
        default:
            throw new Error(`Unknown handler type: ${bookData.handler} for book ${book}`);
    }
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

    const notes = getNotes();
    let paragraphs = [];
    let currentParagraph = '';
    data.verses.forEach((v, i) => {
        const verseNum = i + 1;
        const selected = verseNum === state.currentVerse.verse ? 'selected' : '';
        const reference = `${state.currentVerse.book}/${state.currentVerse.chapter}/${verseNum}`;
        const hasNote = notes[reference];
        const addOrEdit = hasNote ? 'edit' : 'add';
        const hasNoteClass = hasNote ? 'has-note' : '';
        const verseText = `<span class="verse-num" onclick="showNotePopup('${reference}', this.parentElement, '${notes[reference] || ''}')" title="${addOrEdit} note">${verseNum}</span><span class="verse-text">${v.text.trim()}</span>`;

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

function showNotePopup(reference, verseDiv, existingNote) {
    const existingPopup = document.querySelector('.note-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'note-popup';
    popup.style.position = 'absolute';
    popup.style.top = `${verseDiv.offsetTop + verseDiv.offsetHeight}px`;
    popup.style.background = '#2A2A2A';
    popup.style.color = '#F0F0F0';
    popup.style.padding = '10px';
    popup.style.border = '1px solid #4A704A';
    popup.style.zIndex = '1000';
    popup.style.maxWidth = '400px';

    const textarea = document.createElement('textarea');
    textarea.value = existingNote || '';
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
    saveButton.onclick = () => {
        const note = textarea.value.trim();
        if (note) {
            saveNote(reference, note);
        } else {
            deleteNote(reference);
        }
        cleanupAndRemove();
        refreshDisplay();
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.background = '#4A704A';
    cancelButton.style.color = '#F0F0F0';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '5px 10px';
    cancelButton.onclick = cleanupAndRemove;

    popup.appendChild(textarea);
    popup.appendChild(saveButton);
    popup.appendChild(cancelButton);
    document.body.appendChild(popup);

    const verseLeft = verseDiv.offsetLeft;
    const popupWidth = popup.offsetWidth;
    const viewportWidth = window.innerWidth;
    let newLeft = verseLeft;
    if (verseLeft + popupWidth > viewportWidth) {
        newLeft = viewportWidth - popupWidth;
        newLeft = Math.max(0, newLeft);
    }
    popup.style.left = `${newLeft}px`;

    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            cleanupAndRemove();
        }
    };
    document.addEventListener('keydown', handleEscape);

    function cleanupAndRemove() {
        document.removeEventListener('keydown', handleEscape);
        popup.remove();
    }

    textarea.focus();
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

function displayResult(question, response, expand = true) {
    let htmlText = convertMarkdown(response);
    let linkedContent = linkVerses(htmlText);
    aiOutput.innerHTML = `<span class="question">QUESTION: ${question}</span>${linkedContent}`;
    if (expand) {
        aiOutput.classList.add('expanded');
        aiToggle.textContent = '▼';
    }
    else {
        aiOutput.classList.remove('expanded');
        aiToggle.textContent = '▲';
    }
}

// Initialize
loadState();
loadQueryString();
populateSelectors();
adjustTabCount();
setActiveTab(1);