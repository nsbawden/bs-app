// listPopup.js

function constructTabs() {
    const notes = getNotes();
    const tagStorage = {};
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
    return [
        { label: "questions", items: savedQuestions, editable: true },
        { label: "notes", items: getNotesList(), editable: false },
        {
            label: "tags",
            items: Object.keys(tagStorage).map(tag => ({
                label: tag,
                locations: tagStorage[tag], // Optional for tags
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

function showListPopup(tabData) {
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

        const listContainer = document.createElement('div');
        listContainer.className = 'list-container';

        let activeTabIndex = parseInt(sessionStorage.getItem('lastActiveTab')) || 0;
        if (activeTabIndex >= tabData.length || activeTabIndex < 0) {
            activeTabIndex = 0;
            sessionStorage.setItem('lastActiveTab', '0');
        }

        tabData.forEach((tab, index) => {
            const tabButton = document.createElement('button');
            tabButton.textContent = tab.label;
            tabButton.className = 'tab-btn' + (index === activeTabIndex ? ' active' : '');
            tabButton.onclick = () => switchTab(index);
            tabContainer.appendChild(tabButton);
        });

        // Prepare items with original indices and sort if needed
        const activeTab = tabData[activeTabIndex];
        const displayItems = prepareDisplayItems(activeTab);
        renderList(listContainer, activeTab, activeTabIndex, resolve, cleanupAndRemove, displayItems);

        popup.appendChild(closeButton);
        popup.appendChild(tabContainer);
        popup.appendChild(listContainer);
        document.body.appendChild(popup);

        function switchTab(index) {
            activeTabIndex = index;
            if (tabData.length > 1) {
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

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                cleanupAndRemove();
                resolve({ tabIndex: -1, itemIndex: -1 });
            }
        };
        document.addEventListener('keydown', handleEscape);

        function cleanupAndRemove() {
            document.removeEventListener('keydown', handleEscape);
            popup.remove();
        }

        // Helper to prepare display items with original indices
        function prepareDisplayItems(tab) {
            if (!tab.items) return [];
            const itemsWithIndex = tab.items.map((item, index) => ({
                ...item, // Copy all properties
                originalIndex: index // Store original position
            }));
            if (tab.sorted) {
                itemsWithIndex.sort((a, b) =>
                    (a.label || a.toString()).localeCompare(b.label || b.toString(), undefined, { sensitivity: 'base' })
                );
            }
            return itemsWithIndex;
        }
    });
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
    makeSortable(list, displayItems || []);
}

function createListItem(item, displayIndex, tab, tabIndex, resolve, cleanup) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.dataset.index = displayIndex; // Display index for sorting/dragging
    div.draggable = true;

    const textSpan = document.createElement('span');
    textSpan.textContent = item.label || item.toString(); // Handle strings or objects
    textSpan.className = 'list-text';
    textSpan.onclick = () => {
        resolve({ tabIndex: tabIndex, itemIndex: item.originalIndex }); // Use original index
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
            resolve({ tabIndex: tabIndex, itemIndex: item.originalIndex });
            cleanup();
        };
        div.insertBefore(newTextSpan, input);
        div.removeChild(input);
        div.className = div.className.replace(' editing', '');
    } else {
        const textSpan = div.querySelector('.list-text');
        const input = document.createElement('input');
        input.type = 'text';
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

        input.onblur = handleExit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') handleExit();
        };
    }
}

function makeSortable(container, items) {
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