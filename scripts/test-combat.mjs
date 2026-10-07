process.env.DBUS_SESSION_BUS_ADDRESS = '/dev/null';
import puppeteer from 'puppeteer';

async function run() {
  console.log('Testing combat, breakables, and drops...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  await page.click('button');
  await new Promise(r => setTimeout(r, 1000));

  // Walk player northwest towards grass at (6.0, 7.5)
  console.log('Moving towards grass patch...');
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 350));
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 200));

  // Attack grass
  console.log('Swinging sword at grass...');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));

  // Check stats
  const combatState = await page.evaluate(() => {
    // Check if window has Zustand store or inspect HUD
    const hud = {
      rupees: document.querySelector('span.text-emerald-300')?.textContent,
      area: document.querySelector('span.text-zinc-200')?.textContent,
    };
    return hud;
  });
  console.log('HUD after cutting grass:', combatState);

  await page.screenshot({ path: 'test_combat_cut.png' });
  console.log('Saved test_combat_cut.png');

  await browser.close();
  console.log('Combat test done!');
}

run().catch(console.error);
