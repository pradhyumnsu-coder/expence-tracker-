import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const app = require('../backend/src/server.js');

export default app;
