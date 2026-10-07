process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';

import puppeteer from 'puppeteer';

async function run() {
  console.log('Launching Puppeteer with SwiftShader WebGL...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--remote-debugging-port=9222',
      '--no-zygote',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    } else {
      console.log('[Browser Log]', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
    console.error('[Browser PageError]', err);
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Waiting for title screen button...');
  await page.waitForSelector('button', { timeout: 15000 });
  await page.screenshot({ path: 'step1_title.png' });
  console.log('Saved step1_title.png');

  // Click Start Adventure
  console.log('Clicking START ADVENTURE...');
  await page.click('button');

  // Wait 2s for 3D world & HUD
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: 'step2_overworld.png' });
  console.log('Saved step2_overworld.png');

  // Check state in HUD
  const hudInfo = await page.evaluate(() => {
    const areaEl = document.querySelector('span.text-zinc-200');
    const rupeesEl = document.querySelector('span.text-emerald-300');
    return {
      area: areaEl ? areaEl.textContent : 'none',
      rupees: rupeesEl ? rupeesEl.textContent : 'none',
    };
  });
  console.log('HUD Info:', hudInfo);

  // Press D key (move right) for 1000ms
  console.log('Pressing D to move right...');
  await page.keyboard.down('KeyD');
  await new Promise((r) => setTimeout(r, 1000));
  await page.keyboard.up('KeyD');
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'step3_moved_right.png' });
  console.log('Saved step3_moved_right.png');

  // Press Space to attack
  console.log('Pressing Space to swing sword...');
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 80));
  await page.screenshot({ path: 'step4_sword_attack.png' });
  console.log('Saved step4_sword_attack.png');

  console.log('Total Page/Console Errors:', consoleErrors.length);
  await browser.close();
  console.log('Browser tests completed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
