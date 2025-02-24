// bible.js
async function fetchChapter(book, chapter, version) {
    const response = await fetch(`${BIBLE_API_BASE}/${book}+${chapter}?translation=${version}`);
    const data = await response.json();
    return data;
}

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

    const notes = getNotes(); // Get notes from localStorage
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

// Initialize
populateSelectors();