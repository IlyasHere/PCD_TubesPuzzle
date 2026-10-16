import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const alternateImage = '/tmp/puzzle-world-browser-alternate.png';
execFileSync('.venv/bin/python', [
  '-c',
  `from PIL import Image, ImageDraw
image = Image.new('RGB', (503, 407), '#d3b173')
draw = ImageDraw.Draw(image)
for x in range(0, 503, 40):
    draw.rectangle((x, 0, x + 19, 406), fill='#375e68')
image.save('${alternateImage}')`,
]);

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('http://127.0.0.1:5000', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('nav').count(), 0);
  assert.equal(await page.locator('footer').count(), 0);
  await page.screenshot({ path: '/tmp/puzzle-world-home.png', fullPage: true });

  await page.locator('#fileInput').setInputFiles(path.resolve('static/assets/texture.png'));
  await page.locator('#generateBtn').click();
  await page.locator('#playSection:not(.hidden)').waitFor({ state: 'visible' });
  await page.locator('.jigsaw-piece').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.jigsaw-piece').count(), 9);
  assert.match(await page.locator('#progressCount').innerText(), /^0\s*\/\s*9$/);
  assert.equal(await page.locator('#boardFrame').getAttribute('src') !== null, true);
  assert.equal(await page.locator('#guideOpacity').count(), 0);
  assert.equal(await page.locator('#toggleGuide').count(), 0);

  const selectedPiece = page.locator('.jigsaw-piece').nth(8);
  const beforeRotation = await selectedPiece.getAttribute('style');
  await selectedPiece.click();
  await page.keyboard.press('e');
  const afterRotation = await selectedPiece.getAttribute('style');
  assert.notEqual(afterRotation, beforeRotation);
  assert.match(afterRotation, /rotate\((90|180|270|0)deg\)/);

  const currentAngle = Number(afterRotation.match(/rotate\((\d+)deg\)/)[1]);
  for (let turn = currentAngle; turn !== 0; turn = (turn + 90) % 360) {
    await page.keyboard.press('e');
  }
  const pieceBox = await selectedPiece.boundingBox();
  const boardBox = await page.locator('#board').boundingBox();
  assert.ok(pieceBox && boardBox);
  const target = {
    x: boardBox.x + 7 + (boardBox.width - 14) * .7,
    y: boardBox.y + 7 + (boardBox.height - 14) * .7,
  };
  await page.mouse.move(pieceBox.x + pieceBox.width / 2, pieceBox.y + pieceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  assert.match(await page.locator('#progressCount').innerText(), /^1\s*\/\s*9$/);

  const lockedPosition = await selectedPiece.getAttribute('style');
  await page.locator('#shuffleBtn').click();
  assert.equal(await selectedPiece.getAttribute('style'), lockedPosition);

  await page.locator('#resetBtn').click();
  assert.match(await page.locator('#progressCount').innerText(), /^0\s*\/\s*9$/);

  await selectedPiece.click();
  const resetAngle = Number((await selectedPiece.getAttribute('style')).match(/rotate\((\d+)deg\)/)[1]);
  for (let turn = resetAngle; turn !== 90; turn = (turn + 90) % 360) {
    await page.keyboard.press('e');
  }
  const wrongPieceBox = await selectedPiece.boundingBox();
  await page.mouse.move(wrongPieceBox.x + wrongPieceBox.width / 2, wrongPieceBox.y + wrongPieceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  assert.match(await page.locator('#progressCount').innerText(), /^0\s*\/\s*9$/);
  await page.locator('#resetBtn').click();
  await page.screenshot({ path: '/tmp/puzzle-world-game.png', fullPage: true });
  await page.locator('#playSection').screenshot({ path: '/tmp/puzzle-world-game-section.png' });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://127.0.0.1:5000', { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: '/tmp/puzzle-world-mobile.png' });
  const bodyWidth = await mobile.locator('body').evaluate(element => element.scrollWidth);
  assert.ok(bodyWidth <= 390, `unexpected horizontal overflow: ${bodyWidth}px`);
  await mobile.close();

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#fileInput').setInputFiles(alternateImage);
  assert.match(await page.locator('#fileMeta').innerText(), /503 x 407 px/);
  await page.locator('#generateBtn').click();
  await page.locator('#playSection:not(.hidden)').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.jigsaw-piece').count(), 9);
  assert.deepEqual(consoleErrors, []);
  console.log('Browser smoke test passed: desktop, gameplay, mobile, reload, and second upload.');
} finally {
  await browser.close();
}
