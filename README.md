# Bible Study Browser App

A web-based application for exploring and studying the Bible, built collaboratively with Grok 3 by xAI.

**Repository**: [https://github.com/nsbawden/bs-app](https://github.com/nsbawden/bs-app)  
**Raw Base URL**: [https://raw.githubusercontent.com/nsbawden/bs-app/main/](https://raw.githubusercontent.com/nsbawden/bs-app/main/)

## Project Goals
- Provide an intuitive, feature-rich tool for casual readers and serious Bible scholars.
- Launch as a web app with a clean, accessible interface, with potential for future mobile expansion.

## Key Features
- **Navigation**: Browse books, chapters, and verses via dropdown selectors or "Next/Previous Chapter/Book" buttons. Opens to the last viewed location stored in localStorage.
- **Bible Versions**: Switch between translations (e.g., WEB, KJV, ASV) via a selector, with plans to add ESV support.
- **Verse Interaction**: Click any verse to highlight it, updating the current location.
- **AI Assistance**: Ask questions about the selected verse with a manual query system (copy to clipboard, paste response from external AI like Grok or ChatGPT), displayed with Markdown rendering and an expand/collapse toggle.
- **Responsive UI**: Light text on a dark background with a green accent for interactive elements, designed for readability and usability.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla, with `marked.js` for Markdown rendering).
- **Data**: Bible-API.com for verse text (WEB, KJV, etc.), with localStorage for state persistence.
- **Tools**: VS Code, GitHub for version control.

## Workflow Notes
- **State**: Maintained in `localStorage` (current verse, version, AI history) and documented broadly here.
- **File Access**: Use the Raw Base URL + file path (e.g., `script.js`) to view source files.
- **Branch**: Development occurs on `main`.
- **Collaboration**: Features and updates driven by discussions with Grok 3, committed by nsbawden.

## Progress Log
- **2025-02-22**: Initial repo setup, core navigation, version switching, and AI query system implemented with manual Grok/ChatGPT integration.
- **Recent Updates**: Added chapter/book navigation buttons, AI output expand/collapse functionality.

## Future Goals
- Integrate ESV via API for additional translation support and section headings.
- Automate AI queries with xAI or OpenAI APIs when freely available.
- Enhance study tools (e.g., notes, highlights persistence, cross-references).
- Explore multimedia integration (audio readings, images).

---
*Last Updated: 2025-02-22*