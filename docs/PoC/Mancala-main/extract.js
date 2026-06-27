const fs = require('fs');

const extractDest = 'src/locales/translations.json';

// We can extract simply by importing if we transpile, or just regex.
// Regex is fragile, I'll write a better one or just use ts-node?
// Better: the container has vite. I can just build a mock script.
