# Habit Heatmap

A GitHub-contributions-style heatmap for tracking any personal habit — reading, running, practicing an instrument, whatever you want to stay consistent with.

No build step, no backend, no dependencies. Everything is plain HTML/CSS/JS and stored in `localStorage`, so your data never leaves your browser.

## Features

- Track multiple habits, each with its own color
- Click any day to cycle it through 5 intensity levels
- Auto-calculated stats: current streak, longest streak, total days logged, last-30-day completion rate
- Export the current heatmap as a PNG
- Fully local — no accounts, no server, no tracking

## Running it

Just open `index.html` in a browser, or serve the folder with any static file server:

```bash
npx serve .
```

## Tech

Vanilla HTML, CSS, and JavaScript. The heatmap grid, streak math, and PNG export are all hand-rolled — no charting library.

## License

MIT — do whatever you want with it.
