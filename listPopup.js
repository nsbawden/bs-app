// listPopup.js

document.getElementById('show-list').addEventListener('click', async () => {
    const tabs = constructTabs();
    const result = await showListPopup(tabs, true); // Main popup, persist tab
    if (result.itemIndex >= 0) {
        console.log(`Selected tab ${result.tabIndex}, item ${result.itemIndex}: ${tabs[result.tabIndex].items[result.itemIndex].label}`);
        const selectedTab = tabs[result.tabIndex];
        const selectedItem = selectedTab.items[result.itemIndex];
        if (selectedItem.handler) {
            selectedItem.handler();
        }
    }
});

function collectTags() {
    const notes = getNotes();
    let tagStorage = {}; // Always start fresh

    const tagCaseMap = {};
    Object.entries(notes).forEach(([key, note]) => {
        const tags = (note.match(/#\w+\b/g) || []);
        tags.forEach(tag => {
            const lowerTag = tag.toLowerCase();
            if (!tagCaseMap[lowerTag]) {
                tagCaseMap[lowerTag] = tag;
                tagStorage[tag] = [];
            }
            const preferredTag = tagCaseMap[lowerTag];
            if (!tagStorage[preferredTag].includes(key)) {
                tagStorage[preferredTag].push(key);
            }
        });
    });
    localStorage.setItem('tagStorage', JSON.stringify(tagStorage));
    return tagStorage;
}

function constructTabs() {
    const notes = getNotes();
    let tagStorage = collectTags();

    return [
        {
            label: "questions",
            items: getStoredLabels("savedOutputs").map(label => ({
                label,
                handler: function () {
                    const item = getStoredItem("savedOutputs", this.label);
                    if (item) {
                        displayResult(item.label, convertToMarkdown(item.text), true);
                    }
                },
                editHandler: (oldLabel, newLabel) => {
                    const item = getStoredItem("savedOutputs", oldLabel);
                    if (item) {
                        storeTextItem({
                            text: item.text,
                            label: newLabel,
                            maxSize: 0,
                            storageKey: "savedOutputs"
                        });
                        if (oldLabel !== newLabel) {
                            removeStoredItem("savedOutputs", oldLabel);
                        }
                    }
                }
            })),
            editable: true,
            sorted: true,
            useTextarea: true
        },
        {
            label: "notes",
            items: Object.entries(notes).map(([key, text], index) => ({
                label: `${key.replace(/\//g, ' ')}: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`,
                handler: () => goToNote(index)
            })),
            editable: false
        },
        {
            label: "tags",
            items: Object.keys(tagStorage).map(tag => ({
                label: tag,
                locations: tagStorage[tag],
                handler: function () {
                    goToTag(this.label); // Use current label dynamically
                },
                editHandler: (oldName, newName) => renameTag(oldName, newName)
            })),
            editable: true,
            sorted: true
        },
        {
            label: "writings",
            items: writings.map(writing => ({
                label: writing.author ? `${writing.label} - ${writing.author}` : writing.label,
                handler: () => {
                    fetch(writing.filename)
                        .then(response => response.ok ? response.text() : Promise.reject(`Failed to load ${writing.filename}`))
                        .then(content => showBook(writing.label, content))
                        .catch(error => showBook(writing.label, `# Error\nCould not load ${writing.filename}: ${error}`));
                }
            })),
            editable: false
        }
    ];
}

function showListPopup(tabData, persistTab = true) {
    return new Promise((resolve) => {
        const existingPopup = document.querySelector('.list-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.className = 'list-popup';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.className = 'close-btn';
        closeButton.onclick = () => {
            cleanupAndRemove();
            resolve({ tabIndex: -1, itemIndex: -1 });
        };

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        const tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container';

        const listContainer = document.createElement('div');
        listContainer.className = 'list-container';

        let activeTabIndex = parseInt(sessionStorage.getItem('lastActiveTab')) || 0;
        if (activeTabIndex >= tabData.length || activeTabIndex < 0) {
            activeTabIndex = 0;
            if (persistTab) {
                sessionStorage.setItem('lastActiveTab', '0');
            }
        }

        tabData.forEach((tab, index) => {
            const tabButton = document.createElement('button');
            tabButton.textContent = tab.label;
            tabButton.className = 'tab-btn' + (index === activeTabIndex ? ' active' : '');
            tabButton.onclick = () => switchTab(index);
            tabContainer.appendChild(tabButton);
        });

        const activeTab = tabData[activeTabIndex];
        const displayItems = prepareDisplayItems(activeTab);
        renderList(listContainer, activeTab, activeTabIndex, resolve, cleanupAndRemove, displayItems);

        // Assemble the structure
        popup.appendChild(closeButton);
        contentWrapper.appendChild(tabContainer);
        contentWrapper.appendChild(listContainer);
        popup.appendChild(contentWrapper);
        document.body.appendChild(popup);

        function switchTab(index) {
            activeTabIndex = index;
            if (persistTab && tabData.length > 1) {
                sessionStorage.setItem('lastActiveTab', index);
            }
            const tabButtons = tabContainer.querySelectorAll('.tab-btn');
            tabButtons.forEach((btn, i) => {
                btn.className = 'tab-btn' + (i === index ? ' active' : '');
            });
            listContainer.innerHTML = '';
            const tab = tabData[index];
            const displayItems = prepareDisplayItems(tab);
            renderList(listContainer, tab, index, resolve, cleanupAndRemove, displayItems);
        }

        function handleEscape(event) {
            if (event.key === 'Escape') {
                cleanupAndRemove();
                resolve({ tabIndex: -1, itemIndex: -1 });
            }
        }
        document.addEventListener('keydown', handleEscape);

        function cleanupAndRemove() {
            document.removeEventListener('keydown', handleEscape);
            popup.remove();
        }

        // Rest of the functions remain unchanged (prepareDisplayItems, renderList, etc.)
        function prepareDisplayItems(tab) {
            if (!tab.items) return [];
            const itemsWithIndex = tab.items.map((item, index) => ({
                ...item,
                originalIndex: index
            }));
            if (tab.sorted) {
                itemsWithIndex.sort((a, b) =>
                    (a.label || a.toString()).localeCompare(b.label || b.toString(), undefined, { sensitivity: 'base' })
                );
            }
            return itemsWithIndex;
        }

        function refreshTagList() {
            const tabs = constructTabs();
            if (!popup) return;
            listContainer.innerHTML = '';
            const activeTab = tabs[2];
            const displayItems = prepareDisplayItems(activeTab);
            renderList(listContainer, activeTab, 2, resolve, cleanupAndRemove, displayItems);
        }

        function renderList(container, tab, tabIndex, resolve, cleanup, displayItems) {
            const list = document.createElement('div');
            list.className = 'list-items';

            if (displayItems && displayItems.length > 0) {
                displayItems.forEach((item, displayIndex) => {
                    const itemDiv = createListItem(item, displayIndex, tab, tabIndex, resolve, cleanup);
                    list.appendChild(itemDiv);
                });
            } else {
                const placeholder = document.createElement('div');
                placeholder.textContent = 'Empty';
                placeholder.className = 'list-placeholder';
                list.appendChild(placeholder);
            }

            container.appendChild(list);
            listPopupMakeSortable(list, displayItems || []);

            function createListItem(item, displayIndex, tab, tabIndex, resolve, cleanup) {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.index = displayIndex;
                div.draggable = true;

                const textSpan = document.createElement('span');
                const fullText = item.label || item.toString();
                textSpan.textContent = fullText.length > 80 ? fullText.slice(0, 80) + '…' : fullText;
                textSpan.className = 'list-text';
                textSpan.onclick = () => {
                    item.handler.call(item);
                    cleanup();
                };

                div.appendChild(textSpan);

                if (tab.editable) {
                    const editBtn = document.createElement('span');
                    editBtn.textContent = '✎';
                    editBtn.className = 'edit-btn';
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleEditMode(div, item, tab.items, tabIndex, resolve, cleanup);
                    };
                    div.appendChild(editBtn);
                }

                return div;
            }

            function toggleEditMode(div, item, items, tabIndex, resolve, cleanup) {
                const editBtn = div.querySelector('.edit-btn');
                let isExiting = false;

                if (div.className.includes('editing')) {
                    const input = div.querySelector('.edit-input');
                    if (!input) return;
                    const oldLabel = item.label;
                    item.label = input.value.trim();
                    if (item.editHandler) {
                        item.editHandler(oldLabel, item.label);
                    }
                    const newTextSpan = document.createElement('span');
                    newTextSpan.textContent = item.label;
                    newTextSpan.className = 'list-text';
                    newTextSpan.onclick = () => {
                        item.handler.call(item);
                        cleanup();
                    };
                    div.insertBefore(newTextSpan, input);
                    div.removeChild(input);
                    div.className = div.className.replace(' editing', '');
                    isExiting = true;

                    if (tabIndex === 2) {
                        refreshTagList();
                    }
                } else if (!isExiting) {
                    const textSpan = div.querySelector('.list-text');
                    const isTextarea = tab.useTextarea || false;
                    const input = document.createElement(isTextarea ? 'textarea' : 'input');
                    if (!isTextarea) input.type = 'text';
                    else input.rows = 4;
                    input.value = item.label || item.toString();
                    input.className = 'edit-input';
                    div.insertBefore(input, textSpan);
                    div.removeChild(textSpan);
                    div.className += ' editing';
                    input.focus();

                    const handleExit = () => {
                        input.onblur = null;
                        input.onkeydown = null;
                        toggleEditMode(div, item, items, tabIndex, resolve, cleanup);
                    };

                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleExit();
                    };

                    input.onblur = handleExit;
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) handleExit();
                        else if (e.key === 'Escape') handleExit();
                    };
                }

                if (isExiting) {
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleEditMode(div, item, items, tabIndex, resolve, cleanup);
                    };
                }
            }
        }
    });
} function showListPopup(tabData, persistTab = true) {
    return new Promise((resolve) => {
        const existingPopup = document.querySelector('.list-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.className = 'list-popup';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.className = 'close-btn';
        closeButton.onclick = () => {
            cleanupAndRemove();
            resolve({ tabIndex: -1, itemIndex: -1 });
        };

        const tabContainer = document.createElement('div');
        tabContainer.className = 'tab-container';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';

        const listContainer = document.createElement('div');
        listContainer.className = 'list-container';

        let activeTabIndex = parseInt(sessionStorage.getItem('lastActiveTab')) || 0;
        if (activeTabIndex >= tabData.length || activeTabIndex < 0) {
            activeTabIndex = 0;
            if (persistTab) {
                sessionStorage.setItem('lastActiveTab', '0');
            }
        }

        tabData.forEach((tab, index) => {
            const tabButton = document.createElement('button');
            tabButton.textContent = tab.label;
            tabButton.className = 'tab-btn' + (index === activeTabIndex ? ' active' : '');
            tabButton.onclick = () => switchTab(index);
            tabContainer.appendChild(tabButton);
        });

        const activeTab = tabData[activeTabIndex];
        const displayItems = prepareDisplayItems(activeTab);
        renderList(listContainer, activeTab, activeTabIndex, resolve, cleanupAndRemove, displayItems);

        // Assemble the structure
        popup.appendChild(closeButton);
        popup.appendChild(tabContainer);
        contentWrapper.appendChild(listContainer);
        popup.appendChild(contentWrapper);
        document.body.appendChild(popup);

        function switchTab(index) {
            activeTabIndex = index;
            if (persistTab && tabData.length > 1) {
                sessionStorage.setItem('lastActiveTab', index);
            }
            const tabButtons = tabContainer.querySelectorAll('.tab-btn');
            tabButtons.forEach((btn, i) => {
                btn.className = 'tab-btn' + (i === index ? ' active' : '');
            });
            listContainer.innerHTML = '';
            const tab = tabData[index];
            const displayItems = prepareDisplayItems(tab);
            renderList(listContainer, tab, index, resolve, cleanupAndRemove, displayItems);
        }

        function handleEscape(event) {
            if (event.key === 'Escape') {
                cleanupAndRemove();
                resolve({ tabIndex: -1, itemIndex: -1 });
            }
        }
        document.addEventListener('keydown', handleEscape);

        function cleanupAndRemove() {
            document.removeEventListener('keydown', handleEscape);
            popup.remove();
        }

        // Rest of the functions remain unchanged
        function prepareDisplayItems(tab) {
            if (!tab.items) return [];
            const itemsWithIndex = tab.items.map((item, index) => ({
                ...item,
                originalIndex: index
            }));
            if (tab.sorted) {
                itemsWithIndex.sort((a, b) =>
                    (a.label || a.toString()).localeCompare(b.label || b.toString(), undefined, { sensitivity: 'base' })
                );
            }
            return itemsWithIndex;
        }

        function refreshTagList() {
            const tabs = constructTabs();
            if (!popup) return;
            listContainer.innerHTML = '';
            const activeTab = tabs[2];
            const displayItems = prepareDisplayItems(activeTab);
            renderList(listContainer, activeTab, 2, resolve, cleanupAndRemove, displayItems);
        }

        function renderList(container, tab, tabIndex, resolve, cleanup, displayItems) {
            const list = document.createElement('div');
            list.className = 'list-items';

            if (displayItems && displayItems.length > 0) {
                displayItems.forEach((item, displayIndex) => {
                    const itemDiv = createListItem(item, displayIndex, tab, tabIndex, resolve, cleanup);
                    list.appendChild(itemDiv);
                });
            } else {
                const placeholder = document.createElement('div');
                placeholder.textContent = 'Empty';
                placeholder.className = 'list-placeholder';
                list.appendChild(placeholder);
            }

            container.appendChild(list);
            listPopupMakeSortable(list, displayItems || []);

            function createListItem(item, displayIndex, tab, tabIndex, resolve, cleanup) {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.dataset.index = displayIndex;
                div.draggable = true;

                const textSpan = document.createElement('span');
                const fullText = item.label || item.toString();
                textSpan.textContent = fullText.length > 80 ? fullText.slice(0, 80) + '…' : fullText;
                textSpan.className = 'list-text';
                textSpan.onclick = () => {
                    item.handler.call(item);
                    cleanup();
                };

                div.appendChild(textSpan);

                if (tab.editable) {
                    const editBtn = document.createElement('span');
                    editBtn.textContent = '✎';
                    editBtn.className = 'edit-btn';
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleEditMode(div, item, tab.items, tabIndex, resolve, cleanup);
                    };
                    div.appendChild(editBtn);
                }

                return div;
            }

            function toggleEditMode(div, item, items, tabIndex, resolve, cleanup) {
                const editBtn = div.querySelector('.edit-btn');
                let isExiting = false;

                if (div.className.includes('editing')) {
                    const input = div.querySelector('.edit-input');
                    if (!input) return;
                    const oldLabel = item.label;
                    item.label = input.value.trim();
                    if (item.editHandler) {
                        item.editHandler(oldLabel, item.label);
                    }
                    const newTextSpan = document.createElement('span');
                    newTextSpan.textContent = item.label;
                    newTextSpan.className = 'list-text';
                    newTextSpan.onclick = () => {
                        item.handler.call(item);
                        cleanup();
                    };
                    div.insertBefore(newTextSpan, input);
                    div.removeChild(input);
                    div.className = div.className.replace(' editing', '');
                    isExiting = true;

                    if (tabIndex === 2) {
                        refreshTagList();
                    }
                } else if (!isExiting) {
                    const textSpan = div.querySelector('.list-text');
                    const isTextarea = tab.useTextarea || false;
                    const input = document.createElement(isTextarea ? 'textarea' : 'input');
                    if (!isTextarea) input.type = 'text';
                    else input.rows = 4;
                    input.value = item.label || item.toString();
                    input.className = 'edit-input';
                    div.insertBefore(input, textSpan);
                    div.removeChild(textSpan);
                    div.className += ' editing';
                    input.focus();

                    const handleExit = () => {
                        input.onblur = null;
                        input.onkeydown = null;
                        toggleEditMode(div, item, items, tabIndex, resolve, cleanup);
                    };

                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleExit();
                    };

                    input.onblur = handleExit;
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) handleExit();
                        else if (e.key === 'Escape') handleExit();
                    };
                }

                if (isExiting) {
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleEditMode(div, item, items, tabIndex, resolve, cleanup);
                    };
                }
            }
        }
    });
}

function listPopupMakeSortable(container, items) {
    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.list-item');
        if (draggedItem) {
            draggedItem.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    container.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.style.opacity = '1';
            draggedItem = null;
        }
    });

    container.addEventListener('dragover', (e) => e.preventDefault());

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('.list-item');
        if (draggedItem && target && draggedItem !== target) {
            const allItems = [...container.querySelectorAll('.list-item')];
            const fromIndex = parseInt(draggedItem.dataset.index);
            const toIndex = parseInt(target.dataset.index);
            const [movedItem] = items.splice(fromIndex, 1);
            items.splice(toIndex, 0, movedItem);
            allItems.forEach((item, idx) => (item.dataset.index = idx));
            if (fromIndex < toIndex) {
                target.after(draggedItem);
            } else {
                target.before(draggedItem);
            }
        }
    });

    let touchItem = null;
    let touchStartY = 0;

    container.addEventListener('touchstart', (e) => {
        touchItem = e.target.closest('.list-item');
        if (touchItem) {
            touchStartY = e.touches[0].clientY;
            touchItem.style.opacity = '0.5';
        }
    });

    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (touchItem) {
            const touchY = e.touches[0].clientY;
            const offset = touchY - touchStartY;
            touchItem.style.transform = `translateY(${offset}px)`;
            const target = document.elementFromPoint(e.touches[0].clientX, touchY)?.closest('.list-item');
            if (target && target !== touchItem) {
                const allItems = [...container.querySelectorAll('.list-item')];
                const fromIndex = parseInt(touchItem.dataset.index);
                const toIndex = parseInt(target.dataset.index);
                const [movedItem] = items.splice(fromIndex, 1);
                items.splice(toIndex, 0, movedItem);
                allItems.forEach((item, idx) => (item.dataset.index = idx));
                if (fromIndex < toIndex) {
                    target.after(touchItem);
                } else {
                    target.before(touchItem);
                }
                touchStartY = touchY;
            }
        }
    });

    container.addEventListener('touchend', () => {
        if (touchItem) {
            touchItem.style.opacity = '1';
            touchItem.style.transform = '';
            touchItem = null;
        }
    });
}

// Navigation Functions
function goToNote(index) {
    const notes = getNotes();
    const noteKeys = Object.keys(notes);
    if (index >= 0 && index < noteKeys.length) {
        const [book, chapter, verse] = noteKeys[index].split('/');
        document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
    } else {
        console.error("Invalid note index:", index);
    }
}

function goToTag(tag) {
    const tags = JSON.parse(localStorage.getItem('tagStorage') || '{}');
    const noteKeys = tags[tag];
    if (!noteKeys) {
        console.error(`Tag "${tag}" not found in tagStorage`);
        return;
    }
    if (noteKeys.length === 1) {
        const [book, chapter, verse] = noteKeys[0].split('/');
        document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
    } else {
        const tagTab = [{
            label: `${tag} Locations`,
            items: noteKeys.map(key => {
                const [book, chapter, verse] = key.split('/');
                return {
                    label: `${tag} ${book} ${chapter}:${verse}`,
                    handler: () => {
                        document.location = `index.html?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}`;
                    }
                };
            }),
            editable: false
        }];
        showListPopup(tagTab, false).then(result => { // Secondary popup, don’t persist tab
            if (result.itemIndex >= 0) {
                tagTab[0].items[result.itemIndex].handler();
            }
        });
    }
}

function renameTag(oldTag, newTag) {
    if (oldTag === newTag || !newTag.startsWith('#')) {
        console.log("Invalid rename:", oldTag, newTag);
        return false;
    }
    const notes = getNotes();
    let tagFound = false;
    const tagRegex = new RegExp(`${oldTag}\\b`, 'gi');
    Object.entries(notes).forEach(([key, note]) => {
        if (tagRegex.test(note)) {
            tagFound = true;
            notes[key] = note.replaceAll(tagRegex, newTag);
        }
    });
    if (!tagFound) {
        console.log(`Tag '${oldTag}' not found`);
        return false;
    }
    localStorage.setItem('bibleNotes', JSON.stringify(notes));

    // Update tagStorage
    const tagStorage = JSON.parse(localStorage.getItem('tagStorage') || '{}');
    if (tagStorage[oldTag]) {
        tagStorage[newTag] = tagStorage[oldTag];
        delete tagStorage[oldTag];
        localStorage.setItem('tagStorage', JSON.stringify(tagStorage));
    }
    return true;
}