import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Navigating to SportyBet...');
  await page.goto('https://www.sportybet.com/ng/');
  await page.waitForTimeout(2000);
  
  const result = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/ng/orders/share/BC58MTRK', {
        headers: { Accept: 'application/json' }
      });
      return { status: resp.status, body: await resp.json() };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('Result status:', result.status);
  console.log('Result body:', JSON.stringify(result.body, null, 2));
  await browser.close();
}

run().catch(console.error);
