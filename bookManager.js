// bookManager.js

if (typeof idb === 'undefined') {
    throw new Error('idb library is required. Include it via <script src="https://unpkg.com/idb@7.1.1/build/umd.js"></script>');
}

const QB = {};

const dbPromise = idb.openDB('QuantumBibleDB', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
            db.createObjectStore('books');
        }
    }
});

QB.generateBookKey = function (bookName) {
    if (!bookName || typeof bookName !== 'string') {
        throw new Error('Book name must be a non-empty string');
    }
    return bookName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 50);
};

QB.validateBookName = function (bookName) {
    if (!bookName || typeof bookName !== 'string') {
        throw new Error('Book name must be a non-empty string');
    }
    if (/[\0-\x1F\x7F]/.test(bookName)) {
        throw new Error('Book name cannot contain control characters');
    }
    return bookName;
};

QB.createBook = async function (bookName, metadata = {}) {
    try {
        const displayName = QB.validateBookName(bookName);
        const key = QB.generateBookKey(bookName);
        const db = await dbPromise;
        const existingBook = await db.get('books', key);
        if (existingBook) {
            throw new Error(`Book with key '${key}' already exists`);
        }

        const now = new Date().toISOString();
        const bookData = {
            version: '1.0',
            metadata: {
                title: displayName,
                author: metadata.author || 'Unknown',
                createdAt: now,
                updatedAt: now
            },
            chapters: []
        };

        await db.put('books', bookData, key);
        console.log(`Created book '${displayName}' with key '${key}'`);
        return key;
    } catch (error) {
        console.log('Error creating book:', error);
        throw error;
    }
};

QB.saveChapter = async function (bookKey, chapterName, content) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }
        if (typeof content !== 'string') {
            throw new Error('Content must be a string');
        }

        const db = await dbPromise;
        let bookData = await db.get('books', key);
        if (!bookData) {
            await QB.createBook(bookKey);
            bookData = await db.get('books', key);
        }

        const now = new Date().toISOString();
        const chapterIndex = bookData.chapters.findIndex(ch => ch.name === chapterName);
        if (chapterIndex === -1) {
            bookData.chapters.push({
                name: chapterName,
                content: content,
                createdAt: now,
                updatedAt: now
            });
        } else {
            bookData.chapters[chapterIndex].content = content;
            bookData.chapters[chapterIndex].updatedAt = now;
        }

        bookData.metadata.updatedAt = now;
        await db.put('books', bookData, key);
        console.log(`Saved chapter '${chapterName}' in book with key '${key}'`);
    } catch (error) {
        console.log('Error saving chapter:', error);
        throw error;
    }
};

QB.loadChapter = async function (bookKey, chapterName) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }

        const db = await dbPromise;
        const bookData = await db.get('books', key);
        if (!bookData) {
            console.log(`Book with key '${key}' not found`);
            return null;
        }

        const chapter = bookData.chapters.find(ch => ch.name === chapterName);
        return chapter ? chapter.content : null;
    } catch (error) {
        console.error('Error loading chapter:', error);
        throw error;
    }
};

QB.hasBooks = async function () {
    try {
        const db = await dbPromise;
        const bookNames = await db.getAllKeys('books');
        return bookNames.length > 0;
    } catch (error) {
        console.error('Error checking for books:', error);
        return false;
    }
};

QB.listBooks = async function () {
    try {
        const db = await dbPromise;
        const keys = await db.getAllKeys('books');
        const books = await Promise.all(keys.map(key => db.get('books', key)));
        return books.map((book, i) => ({
            key: keys[i],
            title: book.metadata.title
        }));
    } catch (error) {
        console.error('Error listing books:', error);
        throw error;
    }
};

QB.deleteBook = async function (bookKey) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        const db = await dbPromise;
        await db.delete('books', key);
        console.log(`Deleted book with key '${key}'`);
    } catch (error) {
        console.error('Error deleting book:', error);
        throw error;
    }
};

QB.listChapters = async function (bookKey) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        const db = await dbPromise;
        const bookData = await db.get('books', key);
        if (!bookData) {
            console.log(`Book with key '${key}' not found`);
            return [];
        }

        return bookData.chapters.map(ch => ch.name);
    } catch (error) {
        console.error('Error listing chapters:', error);
        throw error;
    }
};

QB.getChapterCount = async function (bookKey) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        const db = await dbPromise;
        const bookData = await db.get('books', key);
        return bookData?.chapters?.length || 0;
    } catch (error) {
        console.error('Error getting chapter count:', error);
        return 0;
    }
};

QB.deleteChapter = async function (bookKey, chapterName) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }

        const db = await dbPromise;
        const bookData = await db.get('books', key);
        if (!bookData) {
            console.log(`Book with key '${key}' not found`);
            return;
        }

        bookData.chapters = bookData.chapters.filter(ch => ch.name !== chapterName);
        bookData.metadata.updatedAt = new Date().toISOString();
        await db.put('books', bookData, key);
        console.log(`Deleted chapter '${chapterName}' from book with key '${key}'`);
    } catch (error) {
        console.error('Error deleting chapter:', error);
        throw error;
    }
};

QB.renameBook = async function (oldName, newName) {
    try {
        const validatedOldName = QB.validateBookName(oldName);
        const validatedNewName = QB.validateBookName(newName);
        const oldKey = QB.generateBookKey(validatedOldName);
        const newKey = QB.generateBookKey(validatedNewName);

        const db = await dbPromise;
        const tx = db.transaction('books', 'readwrite');
        const store = tx.objectStore('books');

        const bookData = await store.get(oldKey);
        if (!bookData) {
            throw new Error(`Book '${validatedOldName}' (key: '${oldKey}') not found`);
        }

        // Check if new key already exists (avoid overwriting)
        const existingNewBook = await store.get(newKey);
        if (existingNewBook && oldKey !== newKey) {
            throw new Error(`Book with key '${newKey}' already exists`);
        }

        // Update metadata.title
        bookData.metadata.title = validatedNewName;
        bookData.metadata.updatedAt = new Date().toISOString();

        if (oldKey !== newKey) {
            // Move to new key and delete old
            await store.put(bookData, newKey);
            await store.delete(oldKey);
            console.log(`Renamed book from '${oldKey}' to '${newKey}' with title '${validatedNewName}'`);
        } else {
            // Just update the existing entry
            await store.put(bookData, oldKey);
            console.log(`Updated book title to '${validatedNewName}' at key '${oldKey}'`);
        }

        await tx.done;
        return true; // Success
    } catch (error) {
        console.error('Error renaming book:', error);
        throw error;
    }
};

QB.exportBook = async function (bookKey) {
    try {
        QB.validateBookName(bookKey);
        const key = QB.generateBookKey(bookKey);
        const db = await dbPromise;
        const bookData = await db.get('books', key);
        if (!bookData) {
            throw new Error(`Book with key '${key}' not found`);
        }

        const blob = new Blob([JSON.stringify(bookData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `book-${key}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`Exported book '${bookData.metadata.title}' to 'book-${key}.json'`);
    } catch (error) {
        console.error('Error exporting book:', error);
        throw error;
    }
};

QB.loadBookFromFile = function (file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.name.endsWith('.json')) {
            reject(new Error('File must be a .json file'));
            return;
        }

        const match = file.name.match(/^book-(.+)\.json$/);
        if (!match) {
            reject(new Error('File must be named "book-KEY.json"'));
            return;
        }
        const key = match[1];

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const bookData = JSON.parse(event.target.result);
                if (!bookData.metadata || !Array.isArray(bookData.chapters)) {
                    throw new Error('Invalid book data format');
                }

                const db = await dbPromise;
                await db.put('books', bookData, key);
                console.log(`Loaded book '${bookData.metadata.title}' with key '${key}'`);
                resolve(key);
            } catch (error) {
                console.error('Error loading book from file:', error);
                reject(error);
            }
        };
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            reject(error);
        };
        reader.readAsText(file);
    });
};

// Assuming detectMarkdown is defined elsewhere as a boolean-returning function
QB.parseVerses = function parseVerses(bookName, chapterNumber, text) {
    if (detectMarkdown(text)) {
        text = convertMarkdown(text);
        return this.parseHTMLVerses(bookName, chapterNumber, text);
    }
    return this.parseTextVerses(bookName, chapterNumber, text);
};

QB.parseTextVerses = function parseTextVerses(bookName, chapterNumber, text) {
    const bookId = bookName.slice(0, 3).toUpperCase();
    const lines = text.split('\n');
    let verses = [];
    let verseNumber = 1;

    const sentenceRegex = /(?<!\b(?:[A-Z][a-z]?\.){1,3})[.!?]\s+(?=\p{Lu})/gu;

    lines.forEach(line => {
        if (line.trim() === '' || line.trim().startsWith('#')) return;
        const sentences = line.split(sentenceRegex);
        sentences.forEach(sentence => {
            sentence = sentence.trim();
            if (sentence) {
                verses.push({
                    book_id: bookId,
                    book_name: bookName,
                    chapter: chapterNumber,
                    verse: verseNumber,
                    text: sentence
                });
                verseNumber++;
            }
        });
    });

    return {
        reference: `${bookName} ${chapterNumber}`,
        verses: verses,
        text: text
    };
};

QB.parseHTMLVerses = function parseHTMLVerses(bookName, chapterNumber, htmlText) {
    const bookId = bookName.slice(0, 3).toUpperCase();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    let verses = [];
    let verseNumber = 1;

    const processElement = (element) => {
        let verseText = element.outerHTML.trim();
        if (verseText) {
            verses.push({
                book_id: bookId,
                book_name: bookName,
                chapter: chapterNumber,
                verse: verseNumber,
                text: verseText
            });
            verseNumber++;
        }
    };

    const body = doc.body;
    Array.from(body.children).forEach((element) => {
        if (element.tagName === 'P' || element.tagName === 'OL' || element.tagName === 'UL') {
            processElement(element);
        }
    });

    return {
        reference: `${bookName} ${chapterNumber}`,
        verses: verses,
        text: htmlText
    };
};

QB.editChapter = async function (bookKey, chapterName, domElement, saveCallback) {
    try {
        // Validate inputs
        QB.validateBookName(bookKey);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }
        if (!(domElement instanceof HTMLElement)) {
            throw new Error('domElement must be an HTML element');
        }

        // Check for required libraries
        if (typeof Quill === 'undefined') {
            throw new Error('Quill library is required. Include it via <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>');
        }
        if (typeof marked === 'undefined') {
            throw new Error('Marked library is required for Markdown parsing. Include it via <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>');
        }
        if (typeof TurndownService === 'undefined') {
            throw new Error('Turndown library is required for Markdown conversion. Include it via <script src="https://cdn.jsdelivr.net/npm/turndown/dist/turndown.js"></script>');
        }

        // Get the current chapter content (assumed to be Markdown)
        const key = QB.generateBookKey(bookKey);

        let initialMarkdown = await QB.loadChapter(bookKey, chapterName) || '';
        initialMarkdown = initialMarkdown.replace('<p>', '');
        initialMarkdown = initialMarkdown.replace('</p>', '');
        console.log(initialMarkdown);

        const initialHtml = marked.parse(initialMarkdown); // Convert Markdown to HTML
        console.log(initialHtml);

        // Create a covering div
        const rect = domElement.getBoundingClientRect();
        const editorContainer = document.createElement('div');
        editorContainer.style.position = 'absolute';
        editorContainer.style.top = `${rect.top + window.scrollY}px`;
        editorContainer.style.left = `${rect.left + window.scrollX}px`;
        editorContainer.style.width = `${rect.width}px`;
        editorContainer.style.height = `${rect.height - 100}px`;
        editorContainer.style.backgroundColor = '#1e1e1e';
        editorContainer.style.color = '#ffffff';
        editorContainer.style.zIndex = '1000';
        document.body.appendChild(editorContainer);

        // Create a specific div for Quill
        const quillEditor = document.createElement('div');
        editorContainer.appendChild(quillEditor);

        // Initialize Quill editor with Snow theme
        const quill = new Quill(quillEditor, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    ['link', 'blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }]
                ]
            }
        });

        // Set initial content as HTML
        quill.root.innerHTML = initialHtml;

        // Add dark theme styles dynamically
        const style = document.createElement('style');
        style.textContent = `
            .ql-container.ql-snow {
                background-color: #1e1e1e;
                color: #ffffff;
                border: 1px solid #444;
            }
            .ql-toolbar.ql-snow {
                background-color: #2d2d2d;
                border: 1px solid #444;
            }
            .ql-toolbar.ql-snow .ql-picker-label,
            .ql-toolbar.ql-snow .ql-button {
                color: #ffffff;
            }
            .ql-toolbar.ql-snow .ql-picker-options {
                background-color: #2d2d2d;
                color: #ffffff;
            }
            .ql-editor {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            .ql-editor a {
                color: #1e90ff;
            }
        `;
        document.head.appendChild(style);

        // Add Save and Cancel buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.marginRight = '10px';
        saveButton.style.backgroundColor = '#4CAF50';
        saveButton.style.color = '#ffffff';
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.backgroundColor = '#f44336';
        cancelButton.style.color = '#ffffff';

        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(cancelButton);
        editorContainer.appendChild(buttonContainer);

        // Initialize Turndown for HTML-to-Markdown conversion
        const turndownService = new TurndownService({
            headingStyle: 'atx', // Use # for headings
            bulletListMarker: '-', // Use - for bullets
            codeBlockStyle: 'fenced', // Use ``` for code blocks
            linkStyle: 'inlined' // Inline links as [text](url)
        });

        // Cleanup function
        const cleanup = () => {
            if (editorContainer.parentNode) {
                document.body.removeChild(editorContainer);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
            quill.enable(false);
            quill.off('text-change');
            quill.off('selection-change');
        };

        // Save handler
        saveButton.onclick = async () => {
            const htmlContent = quill.root.innerHTML;
            const markdownContent = turndownService.turndown(htmlContent); // Convert HTML to Markdown
            await QB.saveChapter(bookKey, chapterName, markdownContent);
            cleanup();
            if (typeof saveCallback === 'function') {
                saveCallback(markdownContent);
            }
        };

        // Cancel handler
        cancelButton.onclick = () => {
            cleanup();
            if (typeof saveCallback === 'function') {
                saveCallback(null);
            }
        };

    } catch (error) {
        console.error('Error in editChapter:', error);
        throw error;
    }
};

window.QB = QB;