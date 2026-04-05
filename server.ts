import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import cron from 'node-cron';
import { runScreener } from './lib/screener';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Run screener every evening at 8:00 PM
  cron.schedule('0 20 * * *', async () => {
    console.log('[Screener] Starting nightly run...');
    await runScreener();
    console.log('[Screener] Complete.');
  });

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000, () => {
    console.log(`> OptionsFlow running on port ${process.env.PORT || 3000}`);
  });
});
