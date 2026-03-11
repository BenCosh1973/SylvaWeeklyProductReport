/**
 * Dashboard Builder — reads the JSX template and produces a self-contained HTML file
 * with embedded React, data, and the dashboard component.
 */
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const REACT_CDN = 'https://unpkg.com/react@18/umd/react.production.min.js';
const REACT_DOM_CDN = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
const BABEL_CDN = 'https://unpkg.com/@babel/standalone/babel.min.js';

/**
 * Build a self-contained HTML dashboard file.
 */
export async function buildDashboard(analysisData, outputPath) {
  const jsxSource = await readFile(join(import.meta.dirname, 'dashboard.jsx'), 'utf-8');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sylva Trial → Subscription Analysis | ${analysisData.weekLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #020617; margin: 0; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #475569; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script>window.__ANALYSIS_DATA__ = ${JSON.stringify(analysisData)};</script>
  <script crossorigin src="${REACT_CDN}"></script>
  <script crossorigin src="${REACT_DOM_CDN}"></script>
  <script crossorigin src="${BABEL_CDN}"></script>
  <script type="text/babel">
${jsxSource}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App data={window.__ANALYSIS_DATA__} />);
  </script>
</body>
</html>`;

  await writeFile(outputPath, html);
  console.log(`Dashboard written to ${outputPath}`);
  return outputPath;
}
