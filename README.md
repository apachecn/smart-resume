# Smart Resume

Smart Resume is a local-first resume editor built with React, Vite, and TypeScript. It provides an A4 canvas-style editing experience for structured resume data, with export support for images and PDF.

## Features

- Structured resume data rendered into a polished A4 layout
- Direct canvas text editing with automatic reflow for multiline content
- Drag, duplicate, delete, undo, and redo support for canvas elements
- Local persistence and history tracking
- Image and PDF export
- Optional AI-assisted resume parsing through Gemini
- Upload-safe sample data separated from private local resume data

## Getting Started

### Prerequisites

- Node.js
- npm

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env.local` and set your Gemini API key if you want to use AI parsing.

```bash
GEMINI_API_KEY=your_api_key_here
```

The editor can still run without AI parsing as a local resume editor.

### Development

```bash
npm run dev
```

The Vite dev server starts on port `3000` by default and automatically tries the next available port if needed.

### Build

```bash
npm run build
```

### Type Check

```bash
npm run lint
```

## Resume Data

Resume content is stored separately from application code:

- `src/data/resume.public.json` contains sanitized sample data and is safe to upload.
- `src/data/resume.local.json` contains private local resume data and is ignored by `.gitignore`.
- `src/constants.ts` imports the public JSON by default, so production builds do not bundle private resume content.

To work with your private data locally, copy values from `resume.local.json` into the editor or temporarily switch the import in `src/constants.ts` during local-only work. Switch it back to `resume.public.json` before building or uploading.

## Privacy Notes

This project is designed to keep private resume content out of uploadable source files. Before publishing or sharing the project, check that:

- `src/data/resume.local.json` is not included.
- `src/constants.ts` imports `resume.public.json`.
- Generated files in `dist/` are rebuilt from sanitized data if you plan to publish them.

## Tech Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- localForage
- html2canvas
- jsPDF
- Gemini API client
