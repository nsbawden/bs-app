**At the beginning of any session, AI will retrieve all of the project files using the below raw url base, so that all content is in sync for the session, and confirm to user that the files have been successfully read.**

# Bible Study Browser App

A web-based application for exploring and studying the Bible and related texts, built collaboratively with Grok 3 by xAI.

**Repository**: [https://github.com/nsbawden/bs-app](https://github.com/nsbawden/bs-app)  
**Raw Base URL**: [https://raw.githubusercontent.com/nsbawden/bs-app/main/](https://raw.githubusercontent.com/nsbawden/bs-app/main/)

**Note for Collaboration**: This document serves dual purposes: it describes the app for human users and provides a comprehensive starting point for future work sessions with Grok 3. Hand this README to Grok 3 to resume development seamlessly.

## Project Goals
- Deliver an intuitive, feature-rich tool for casual readers and serious scholars of the Bible and apocryphal texts like 1 Enoch.
- Operate as a web app with a clean, accessible interface, with potential for future mobile expansion.

## Key Features
- **Navigation**: Browse books, chapters, and verses via dropdown selectors or "Next/Previous Chapter/Book" buttons, with state (last viewed location) persisted in `localStorage`. Now includes 1 Enoch alongside canonical Bible books.
- **Bible Versions**: Switch between translations (WEB, KJV, ASV, BBE, DRA, YLT) via a selector, with 1 Enoch available in R.H. Charles’s 1917 translation. Plans to add ESV support.
- **Verse Interaction**: Click any verse to highlight it and update the current location.
- **Notes**: Click a verse number to add/edit a note in a hovering popup. Notes saved in `localStorage` under `bibleNotes` as a JSON object, indexed by `book/chapter/verse` (e.g., `Genesis/1/1`). Verses with notes show a blue number (`#1997FB`), underlined text, and a notepad icon (`📝`) with "Add note" tooltip on hover for noted verses, or just "Add note" for others.
- **AI Assistance**: Query an integrated OpenAI API (e.g., `gpt-4o-mini`) about the selected verse, with responses rendered in Markdown and an expand/collapse toggle. Supports manual fallback (copy to clipboard, paste from external AI).
- **Settings**: Customize AI behavior via a top-bar gear button popup, controlling:
  - **Max AI History Length**: Limits stored question/answer pairs (default: 10).
  - **Temperature**: Adjusts response creativity (0-2).
  - **OpenAI Model**: Selects model (`gpt-3.5-turbo`, `gpt-4o-mini`, `gpt-4o`).
  - **Max Tokens**: Sets output length limit (50-4096).
- **Responsive UI**: Dark background (`#1A1A1A`) with light text (`#F0F0F0`) and green accents (`#4A704A`) for interactive elements, optimized for readability.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla, with `marked.js` for Markdown rendering).
- **Data**: Bible-API.com for canonical verse text, `1enoch.json` (local file) for 1 Enoch, OpenAI API for AI queries, `localStorage` for state, settings, and notes persistence.
- **Tools**: VS Code, GitHub for version control, local server (e.g., VS Code Live Server) for development.

## File Structure
- **`index.html`**: Primary app HTML.
- **`apikey.html`**: Help screen for creating API Key.
- **`styles.css`**: App HTML styles, including note popup and tooltip styles.
- **`config.js`**: Centralized defaults, state management, constants (e.g., `books`, `bookOrder`), and notes management functions (`getNotes`, `saveNote`, `deleteNote`).
- **`ui.js`**: DOM elements, event listeners, settings popup, and note popup logic (`showNotePopup`).
- **`bible.js`**: Bible and 1 Enoch navigation, verse fetching, and display rendering with note styling.
- **`ai.js`**: OpenAI integration, AI query handling, and token usage tracking.
- **`1enoch.json`**: Full text of 1 Enoch (108 chapters) in JSON format, based on R.H. Charles’s 1917 translation.

## Progress Log
- **2025-02-22**: Initial setup with navigation, version switching, and manual AI query system.
- **2025-02-23**: Major updates:
  - Refactored single `script.js` into four files (`config.js`, `ui.js`, `bible.js`, `ai.js`) for modularity.
  - Integrated OpenAI API (`gpt-3.5-turbo` initially, now defaults to `gpt-4o-mini`) with dynamic cost tracking.
  - Added settings popup in top bar (gear button) for `maxHistoryLength`, `temperature`, `model`, and `maxTokens`.
  - Centralized defaults in `config.js`, removing redundancy.
  - Optimized top bar layout: select boxes grouped left, gear button right, all on one line.
- **2025-02-24**: Updates in this session:
  - Added note-taking: Users can click verse numbers to add/edit notes in a popup, stored in `localStorage` as `bibleNotes`. Verses with notes styled with blue numbers (`#1997FB`), underlined text, and a notepad icon (`📝`) with "Add note" tooltip on hover (via `.has-note` class); verses without notes show "Add note" on hover.
  - Integrated 1 Enoch: Added `1enoch.json` (108 chapters, R.H. Charles’s 1917 translation) to the app, accessible via navigation. Updated `fetchChapter` in `bible.js` to fetch from `/1enoch.json` for "1 Enoch", with `bookOrder` and `books` in `config.js` expanded to include it (108 chapters).
  - Enhanced UI: Added CSS for note popups and tooltips in `styles.css`, ensuring visual consistency.

## Future Goals
- Add ESV support via API with section headings.
- Enhance AI prompts for richer responses (e.g., custom system messages via settings).
- Expand study tools (highlights persistence, cross-references).
- Integrate multimedia (audio readings, images).
- Optimize `1enoch.json` loading (e.g., lazy loading or splitting into smaller files).

---
*Last Updated: 2025-02-24*

---

### Notes on Changes
- **Notes Feature**: Added under "Key Features" with details on functionality, styling, and storage. Updated `config.js`, `ui.js`, `bible.js`, and `styles.css` in "File Structure" to reflect their roles.
- **1 Enoch Integration**: Expanded "Project Goals," "Key Features," "Tech Stack," and "File Structure" to include 1 Enoch. Noted its addition in navigation, data sourcing (`1enoch.json`), and local server requirement in "Workflow Notes."
- **Progress Log**: Added a detailed entry for February 24, 2025, summarizing note-taking and 1 Enoch integration.
