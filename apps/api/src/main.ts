import { createApp } from './app.js';
import { loadConfig } from './platform/index.js';

const config = loadConfig(process.env);
const app = await createApp(config);
await app.listen(config.PORT);
