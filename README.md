# VinhVu CareerLen

Career guidance that runs entirely in your browser. No application backend, database, login, server actions, environment secrets, or deployment workflows.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. In **Settings**, enter your AI provider base URL, model name, and API key. The default URL is FPT Cloud; you can use another OpenAI-compatible chat completions provider. Your provider must allow browser requests through CORS. AI features require a working key and internet connection.

```sh
npm run build
```

Build produces static HTML, CSS, and JavaScript in `out/`. It needs only a static HTTP server; `next start` is unnecessary.

## Browser data

Profile, personality results, education and transcripts, certificates and attachments, CV import results, roadmaps and progress, journey entries, chat history, and AI settings are saved under `careerlens.workspace.v1` in localStorage. Language and theme preferences also stay in this browser.

Data belongs to this browser and origin. Another browser, device, or port has separate storage. Clearing site data deletes it. Settings offers JSON backup export without the API key. Binary certificate evidence is saved as a data URL; localStorage has limited capacity, and failed saves report an error without replacing the saved workspace. CV PDF files are processed in the browser; extracted text is sent to your chosen provider only when you request AI import. Original CV files are not retained.

**API keys are readable by anyone with access to this browser and by scripts running on the site.** Use a personal device and a restricted provider key. The app sends submitted data directly to the configured provider; it does not encrypt the key in localStorage or sync data elsewhere.

## Features

- Profile and personality assessment, CV PDF import, transcript Excel import and template download.
- AI career guidance with three paths, skill gaps, resources, and saved roadmaps.
- Follow a roadmap, mark tasks complete, and add roadmap steps to your journey.
- Journey editing with AI assistance and saved chat sessions.
- English/Vietnamese language selection and light/dark themes.

Job search opens LinkedIn search directly. There is no server scraping or live web research; market signals are bundled sample data, not current verified vacancies.

## Checks

```sh
npm run lint
npm test
npm run build
```
