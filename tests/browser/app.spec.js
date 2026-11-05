import { test, expect } from '@playwright/test';
import { EMOTIONS } from '../../src/model.js';

test('el rostro responde a presets, sliders, Russell, resolución, imagen y pantalla completa', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Las emociones, a la vista/ })).toBeVisible();
  await expect(page.locator('#face')).toHaveJSProperty('width', 800);
  await page.getByRole('button', { name: 'Miedo', exact: true }).click();
  await expect(page.locator('#value-2')).toHaveText('−0.80');
  await expect(page.locator('#face-emotion')).toHaveText('Miedo');
  await page.locator('#pad-0').fill('0.33');
  await expect(page.locator('#value-0')).toHaveText('+0.33');
  await expect(page.locator('#face-emotion')).toHaveText('Expresión libre');
  await page.getByRole('button', { name: 'Russell 2D' }).click();
  await expect(page.locator('#pad-2')).toBeDisabled();
  await expect(page.locator('#value-2')).toHaveText('+0.00');
  await page.getByRole('button', { name: 'Modelo PAD 3D' }).click();
  await expect(page.locator('#pad-2')).toBeEnabled();
  await page.getByRole('button', { name: '1024 × 600' }).click();
  await expect(page.locator('#face')).toHaveJSProperty('width', 1024);
  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar imagen del rostro' }).click();
  expect((await imageDownload).suggestedFilename()).toBe('rofee-1024x600.png');
  await page.getByRole('switch', { name: 'Animaciones naturales' }).click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Restablecer controles a neutral' }).click();
  await expect(page.locator('#face-emotion')).toHaveText('Neutral');
  await page.getByRole('button', { name: 'Recorrer emociones' }).click();
  await expect(page.getByRole('button', { name: 'Pausar recorrido' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar recorrido' }).click();
  await page.getByRole('button', { name: 'Mostrar solo el rostro en pantalla completa' }).click();
  await expect(page.locator('#face-stage')).toHaveClass(/is-fullscreen|simulated-fullscreen/);
  await page.keyboard.press('Escape');
  // En Chromium headless Escape no siempre emite la salida nativa de fullscreen.
  await page.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null);
  await expect(page.locator('#face-stage')).not.toHaveClass(/is-fullscreen|simulated-fullscreen/);
  expect(errors).toEqual([]);
});

test('guía, FACS y estado vacío son funcionales y no contienen resultados ficticios', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Guía de la práctica' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Modelo FACS', exact: true }).click();
  await expect(page.locator('.facs-table tbody tr')).toHaveCount(8);
  expect(await page.locator('.facs-table img').evaluateAll((images) => images.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: 'Probar Ira en el laboratorio' }).click();
  await expect(page.locator('#face-emotion')).toHaveText('Ira');
  await page.getByRole('link', { name: 'Resultados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aún no hay resultados. Vamos a descubrirlos.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  const report = page.waitForEvent('download');
  await page.getByRole('button', { name: /Reporte IEEE/ }).click();
  expect((await report).suggestedFilename()).toBe('rofee-reporte-IEEE.tex');
});

test('un participante completa seis exposiciones de 5 s; persisten datos, matriz, SAM y exportaciones', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
  await page.goto('/#evaluacion');
  await page.clock.pauseAt(new Date('2026-11-04T12:00:10Z'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Comenzar prueba' }).click();
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('#observation-face')).toBeVisible();
    await expect(page.locator('#response-form')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText('Alegría');
    await page.clock.fastForward(4999);
    await expect(page.locator('#observation-face')).toBeVisible();
    await page.clock.fastForward(101);
    await expect(page.getByRole('heading', { name: '¿Qué te transmitió?' })).toBeVisible();
    await expect(page.locator('#observation-face')).toHaveCount(0);
    // Respuestas automatizadas únicamente para prueba; el contexto aislado se elimina al cerrar.
    await page.getByText('Alegría', { exact: true }).click();
    await page.locator('.sam-option').filter({ has: page.locator('input[name="sam-0"][value="7"]') }).click();
    await page.locator('.sam-option').filter({ has: page.locator('input[name="sam-1"][value="5"]') }).click();
    await page.locator('.sam-option').filter({ has: page.locator('input[name="sam-2"][value="3"]') }).click();
    await page.getByRole('button', { name: i === 5 ? 'Finalizar evaluación' : 'Siguiente expresión' }).click();
  }
  await expect(page.getByRole('heading', { name: /Gracias por tu mirada/ })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rofee.sessions.v1')));
  expect(stored).toHaveLength(1); expect(stored[0].trials).toHaveLength(6);
  expect(stored[0].trials.every((t) => t.durationMs >= 5000)).toBe(true);
  await page.getByRole('link', { name: 'Explorar los resultados' }).click();
  await expect(page.locator('.confusion-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.sam-chart-row')).toHaveCount(8);
  await expect(page.locator('.sessions-table tbody tr')).toHaveCount(1);
  for (const type of ['CSV', 'JSON']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: type, exact: true }).click();
    expect((await download).suggestedFilename()).toBe(`rofee-resultados.${type.toLowerCase()}`);
  }
  await page.reload();
  await expect(page.locator('.sessions-table tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Evaluación', exact: true }).click();
  await expect(page.locator('#participant-id')).toHaveValue('P02');
  await page.locator('#participant-id').fill('p01');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Comenzar prueba' }).click();
  await expect(page.getByRole('alert')).toContainText('ya completó');
  await page.getByRole('link', { name: 'Resultados', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar resultados locales' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar datos', exact: true }).click();
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('el protocolo pausa la observación si la pestaña deja de estar visible', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
  await page.goto('/#evaluacion');
  await page.clock.pauseAt(new Date('2026-11-04T12:00:10Z'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Comenzar prueba' }).click();
  await page.clock.fastForward(2000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(10000);
  await expect(page.getByRole('heading', { name: 'La prueba está en pausa.' })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Continuar observando' }).click();
  await page.clock.fastForward(2999);
  await expect(page.locator('#observation-face')).toBeVisible();
  await page.clock.fastForward(101);
  await expect(page.locator('#response-form')).toBeVisible();
});

test('la vista móvil no desborda y permite controles, FACS y evaluación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#face')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Tristeza', exact: true }).click();
  await expect(page.locator('#face-emotion')).toHaveText('Tristeza');
  await page.getByRole('link', { name: 'Modelo FACS', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Evaluación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comenzar prueba' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('importar sesiones valida el formato, agrega cinco participantes y evita duplicar datos', async ({ page }) => {
  await page.goto('/#resultados');
  const input = page.locator('#import-file');
  const samples = Array.from({ length: 5 }, (_, i) => ({
    id: `browser-test-${i}`, participant: `TEST${i + 1}`, date: '2026-11-04T12:00:00Z',
    trials: EMOTIONS.slice(0, 6).map((e) => ({ pad: [...e.pad], expected: e.id, perceived: e.id, sam: [7, 6, 5], durationMs: 5000 })),
  }));
  const upload = (sessions) => ({ name: 'prueba.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, sessions })) });
  const invalid = structuredClone(samples); invalid[0].trials[0].sam[0] = 10;
  await input.setInputFiles(upload(invalid));
  await expect(page.getByRole('status')).toContainText('datos no válidos');
  await expect(page.locator('.empty-state')).toBeVisible();
  await input.setInputFiles(upload(samples));
  await expect(page.locator('.sessions-table tbody tr')).toHaveCount(5);
  await expect(page.locator('.result-stat').nth(0)).toContainText('5');
  await expect(page.locator('.result-stat').nth(1)).toContainText('30');
  await expect(page.locator('.result-stat').nth(2)).toContainText('100.0%');
  await page.locator('#import-file').setInputFiles(upload(samples));
  await expect(page.getByRole('status')).toContainText('0 sesiones importadas');
  await expect(page.locator('.sessions-table tbody tr')).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
