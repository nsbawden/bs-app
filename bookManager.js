// bookManager.js

// Ensure the idb library is loaded
if (typeof idb === 'undefined') {
    throw new Error('idb library is required. Include it via <script src="https://unpkg.com/idb@7.1.1/build/umd.js"></script>');
}

// Define the QB namespace
const QB = {};

// Initialize IndexedDB using the idb library
const dbPromise = idb.openDB('QuantumBibleDB', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
            db.createObjectStore('books');
        }
    }
});

// Validate book name (disallow special characters that might break keys or filenames)
QB.validateBookName = function (bookName) {
    if (!bookName || typeof bookName !== 'string') {
        throw new Error('Book name must be a non-empty string');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(bookName)) {
        throw new Error('Book name can only contain letters, numbers, underscores, or hyphens');
    }
    return bookName;
};

// Create a new book with metadata
QB.createBook = async function (bookName, metadata = {}) {
    try {
        QB.validateBookName(bookName);
        const db = await dbPromise;
        const existingBook = await db.get('books', bookName);
        if (existingBook) {
            throw new Error(`Book '${bookName}' already exists`);
        }

        const now = new Date().toISOString();
        const bookData = {
            version: '1.0',
            metadata: {
                title: metadata.title || bookName,
                author: metadata.author || 'Unknown',
                createdAt: now,
                updatedAt: now
            },
            chapters: []
        };

        await db.put('books', bookData, bookName);
        console.log(`Created book '${bookName}'`);
    } catch (error) {
        console.log('Error creating book:', error);
        // throw error;
    }
};

// Save or update a chapter in a book
QB.saveChapter = async function (bookName, chapterName, content) {
    try {
        QB.validateBookName(bookName);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }
        if (typeof content !== 'string') {
            throw new Error('Content must be a string');
        }

        const db = await dbPromise;
        let bookData = await db.get('books', bookName);
        if (!bookData) {
            // Create the book if it doesn't exist
            await QB.createBook(bookName);
            bookData = await db.get('books', bookName);
        }

        const now = new Date().toISOString();
        const chapterIndex = bookData.chapters.findIndex(ch => ch.name === chapterName);
        if (chapterIndex === -1) {
            // Add new chapter
            bookData.chapters.push({
                name: chapterName,
                content: content,
                createdAt: now,
                updatedAt: now
            });
        } else {
            // Update existing chapter
            bookData.chapters[chapterIndex].content = content;
            bookData.chapters[chapterIndex].updatedAt = now;
        }

        bookData.metadata.updatedAt = now;
        await db.put('books', bookData, bookName);
        console.log(`Saved chapter '${chapterName}' in '${bookName}'`);
    } catch (error) {
        console.log('Error saving chapter:', error);
        // throw error;
    }
};

// Load a chapter's content from a book
QB.loadChapter = async function (bookName, chapterName) {
    try {
        QB.validateBookName(bookName);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }

        const db = await dbPromise;
        const bookData = await db.get('books', bookName);
        if (!bookData) {
            console.log(`Book '${bookName}' not found`);
            return null;
        }

        const chapter = bookData.chapters.find(ch => ch.name === chapterName);
        if (!chapter) {
            console.log(`Chapter '${chapterName}' not found in '${bookName}'`);
            return null;
        }

        return chapter.content;
    } catch (error) {
        console.error('Error loading chapter:', error);
        throw error;
    }
};

// Check if any books exist in the database, returns false on any failure
QB.hasBooks = async function () {
    try {
        const db = await dbPromise;
        const bookNames = await db.getAllKeys('books');
        return bookNames.length > 0;
    } catch (error) {
        return false;
    }
};

// List all books in IndexedDB
QB.listBooks = async function () {
    try {
        const db = await dbPromise;
        const bookNames = await db.getAllKeys('books');
        return bookNames;
    } catch (error) {
        console.error('Error listing books:', error);
        throw error;
    }
};

// Delete a book from IndexedDB
QB.deleteBook = async function (bookName) {
    try {
        QB.validateBookName(bookName);
        const db = await dbPromise;
        await db.delete('books', bookName);
        console.log(`Deleted book '${bookName}'`);
    } catch (error) {
        console.error('Error deleting book:', error);
        throw error;
    }
};

// List all chapters in a book
QB.listChapters = async function (bookName) {
    try {
        QB.validateBookName(bookName);
        const db = await dbPromise;
        const bookData = await db.get('books', bookName);
        if (!bookData) {
            console.log(`Book '${bookName}' not found`);
            return [];
        }

        return bookData.chapters.map(ch => ch.name);
    } catch (error) {
        console.error('Error listing chapters:', error);
        throw error;
    }
};

QB.getChapterCount = async function (bookName) {
    try {
        QB.validateBookName(bookName);
        const db = await dbPromise;
        const bookData = await db.get('books', bookName);
        return bookData?.chapters?.length || 0;
    } catch (error) {
        console.error('Error getting chapter count:', error);
        return 0;
    }
};

// Delete a chapter from a book
QB.deleteChapter = async function (bookName, chapterName) {
    try {
        QB.validateBookName(bookName);
        if (!chapterName || typeof chapterName !== 'string') {
            throw new Error('Chapter name must be a non-empty string');
        }

        const db = await dbPromise;
        const bookData = await db.get('books', bookName);
        if (!bookData) {
            console.log(`Book '${bookName}' not found`);
            return;
        }

        bookData.chapters = bookData.chapters.filter(ch => ch.name !== chapterName);
        bookData.metadata.updatedAt = new Date().toISOString();
        await db.put('books', bookData, bookName);
        console.log(`Deleted chapter '${chapterName}' from '${bookName}'`);
    } catch (error) {
        console.error('Error deleting chapter:', error);
        throw error;
    }
};

// Export a book to a file
QB.exportBook = async function (bookName) {
    try {
        QB.validateBookName(bookName);
        const db = await dbPromise;
        const bookData = await db.get('books', bookName);
        if (!bookData) {
            throw new Error(`Book '${bookName}' not found`);
        }

        const blob = new Blob([JSON.stringify(bookData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `book-${bookName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`Exported book '${bookName}' to 'book-${bookName}.json'`);
    } catch (error) {
        console.error('Error exporting book:', error);
        throw error;
    }
};

// Load a book from a file into IndexedDB
QB.loadBookFromFile = function (file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.name.endsWith('.json')) {
            reject(new Error('File must be a .json file'));
            return;
        }

        // Extract book name from filename (e.g., 'book-QuantumBible.json' -> 'QuantumBible')
        const match = file.name.match(/^book-(.+)\.json$/);
        if (!match) {
            reject(new Error('File must be named "book-NAME.json"'));
            return;
        }
        const bookName = match[1];
        QB.validateBookName(bookName);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const bookData = JSON.parse(event.target.result);
                // Basic validation of book data structure
                if (!bookData.metadata || !Array.isArray(bookData.chapters)) {
                    throw new Error('Invalid book data format');
                }

                const db = await dbPromise;
                await db.put('books', bookData, bookName);
                console.log(`Loaded book '${bookName}' from file`);
                resolve(bookName);
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

// Parse a markdown chapter into a JSON verses object
QB.parseVerses = function parseVerses(bookName, chapterNumber, markdownText) {
    // Generate a simple book ID (first 3 letters uppercase)
    const bookId = bookName.slice(0, 3).toUpperCase();

    // Split text into lines and process
    const lines = markdownText.split('\n');
    let verses = [];
    let verseNumber = 1;
    let currentText = '';

    // Process each line
    lines.forEach(line => {
        // Skip empty lines
        if (line.trim() === '') return;

        // Check if line is a header (starts with #)
        if (line.trim().startsWith('#')) return;

        // Split line into sentences (considering .!? as sentence endings)
        const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];

        sentences.forEach(sentence => {
            sentence = sentence.trim();
            if (sentence) {
                // Preserve markdown formatting and newlines
                currentText = sentence;

                verses.push({
                    book_id: bookId,
                    book_name: bookName,
                    chapter: chapterNumber,
                    verse: verseNumber,
                    text: currentText
                });

                verseNumber++;
            }
        });
    });

    // Construct the final JSON object
    const result = {
        reference: `${bookName} ${chapterNumber}`,
        verses: verses,
        text: markdownText
    };

    return result;
    // return JSON.stringify(result, null, 2);
};


// Attach the library to the global window object under a single namespace
window.QB = QB;