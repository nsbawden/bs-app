**At the beginning of any session, AI will retrieve all of the project files using the below raw url base, so that all content is in sync for the session, and confirm to user that the files have been successfully read.**

# Bible Study Browser App

A web-based application for exploring and studying the Bible, built collaboratively with Grok 3 by xAI.

**Repository**: [https://github.com/nsbawden/bs-app](https://github.com/nsbawden/bs-app)  
**Raw Base URL**: [https://raw.githubusercontent.com/nsbawden/bs-app/main/](https://raw.githubusercontent.com/nsbawden/bs-app/main/)

**Note for Collaboration**: This document serves dual purposes: it describes the app for human users and provides a comprehensive starting point for future work sessions with Grok 3. Hand this README to Grok 3 to resume development seamlessly.

## Project Goals
- Deliver an intuitive, feature-rich tool for casual readers and serious Bible scholars.
- Operate as a web app with a clean, accessible interface, with potential for future mobile expansion.

## Key Features
- **Navigation**: Browse books, chapters, and verses via dropdown selectors or "Next/Previous Chapter/Book" buttons, with state (last viewed location) persisted in `localStorage`.
- **Bible Versions**: Switch between translations (WEB, KJV, ASV, BBE, DRA, YLT) via a selector, with plans to add ESV support.
- **Verse Interaction**: Click any verse to highlight it and update the current location.
- **AI Assistance**: Query an integrated OpenAI API (e.g., `gpt-4o-mini`) about the selected verse, with responses rendered in Markdown and an expand/collapse toggle. Supports manual fallback (copy to clipboard, paste from external AI).
- **Settings**: Customize AI behavior via a top-bar gear button popup, controlling:
  - **Max AI History Length**: Limits stored question/answer pairs (default: 10).
  - **Temperature**: Adjusts response creativity (0-2).
  - **OpenAI Model**: Selects model (`gpt-3.5-turbo`, `gpt-4o-mini`, `gpt-4o`).
  - **Max Tokens**: Sets output length limit (50-4096).
- **Responsive UI**: Dark background (`#1A1A1A`) with light text (`#F0F0F0`) and green accents (`#4A704A`) for interactive elements, optimized for readability.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla, with `marked.js` for Markdown rendering).
- **Data**: Bible-API.com for verse text, OpenAI API for AI queries, `localStorage` for state and settings persistence.
- **Tools**: VS Code, GitHub for version control.

## File Structure
- **`index.html`**: Primary app HTML.
- **`apikey.html`**: Help screen for creating API Key.
- **`styles.css`**: App HTML styles.
- **`config.js`**: Centralized defaults, state management, and constants (e.g., `books`, `bookOrder`).
- **`ui.js`**: DOM elements, event listeners, and settings popup logic.
- **`bible.js`**: Bible navigation, verse fetching, and display rendering.
- **`ai.js`**: OpenAI integration, AI query handling, and token usage tracking.

## Workflow Notes
- **State**: Persisted in `localStorage` (`bibleState` for verse data, separate keys for settings like `temperature`, `openaiModel`).
- **Defaults**: All defaults (e.g., `maxHistoryLength`, `openaiSettings`) defined in `config.js` under `defaults`.
- **File Access**: Use Raw Base URL + file path (e.g., `/config.js`) to view source files.
- **Branch**: Development on `main`.
- **Collaboration**: Features shaped via Grok 3 discussions, committed by nsbawden.

## Progress Log
- **2025-02-22**: Initial setup with navigation, version switching, and manual AI query system.
- **2025-02-23**: Major updates in this session:
  - Refactored single `script.js` into four files (`config.js`, `ui.js`, `bible.js`, `ai.js`) for modularity.
  - Integrated OpenAI API (`gpt-3.5-turbo` initially, now defaults to `gpt-4o-mini`) with dynamic cost tracking.
  - Added settings popup in top bar (gear button) for `maxHistoryLength`, `temperature`, `openaiModel`, and `maxTokens`.
  - Centralized defaults in `config.js`, removing redundancy.
  - Optimized top bar layout: select boxes grouped left, gear button right, all on one line.

## Future Goals
- Add ESV support via API with section headings.
- Enhance AI prompts for even richer responses (e.g., custom system messages via settings).
- Expand study tools (notes, highlights persistence, cross-references).
- Integrate multimedia (audio readings, images).

---
*Last Updated: 2025-02-23*