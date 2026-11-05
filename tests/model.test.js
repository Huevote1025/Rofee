import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOTIONS, geometry, interpolate, makeTrials, nearestEmotion, summarize, readSessions, validSession, exportCSV } from '../src/model.js';
import { technicalReport } from '../src/report.js';

function session() {
  return { id: 'session-1', participant: 'P01', date: '2026-11-04T12:00:00.000Z', trials: EMOTIONS.slice(0, 6).map((e) => ({ pad: [...e.pad], expected: e.id, perceived: e.id, sam: [7, 5, 3], durationMs: 5000 })) };
}

test('el mapeo continuo permanece finito y acotado en el dominio PAD completo', () => {
  for (let p = -1; p <= 1; p += 0.25) for (let a = -1; a <= 1; a += 0.25) for (let d = -1; d <= 1; d += 0.25) {
    const g = geometry([p, a, d]);
    assert.ok(Number.isFinite(g.eyeHeight) && g.eyeHeight > 0);
    assert.ok(g.color.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    assert.ok(Math.abs(Object.values(g.weights).reduce((sum, v) => sum + v, 0) - 1) < 1e-10);
    assert.ok(Object.values(g.aus).every((v) => Number.isFinite(v) && v >= 0 && v <= 1.0000000001));
  }
  assert.deepEqual(geometry([-1, 0, 0]).color, [207, 223, 239]);
  assert.deepEqual(geometry([1, 0, 0]).color, [229, 237, 207]);
});
test('la dominancia diferencia ira y miedo con igual P y A', () => {
  const anger = geometry(EMOTIONS.find((e) => e.id === 'anger').pad);
  const fear = geometry(EMOTIONS.find((e) => e.id === 'fear').pad);
  assert.ok(anger.browAngle > 0 && fear.browAngle < 0);
  assert.ok(anger.aus[4] > fear.aus[4]);
  assert.ok(fear.aus[26] > anger.aus[26]);
});
test('la interpolación exponencial es independiente de la frecuencia de cuadros', () => {
  const start = [0, -0.5, -0.7], target = [0.8, 0.6, 0.5];
  const one = interpolate(start, target, 1, 5);
  let many = start;
  for (let i = 0; i < 60; i++) many = interpolate(many, target, 1 / 60, 5);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(one[i] - many[i]) < 1e-10);
  assert.deepEqual(interpolate(start, target, 0), start);
  assert.ok(one.every((v, i) => v < target[i]));
});
test('cada protocolo contiene seis estímulos distintos, aleatorios y etiquetados por cercanía PAD', () => {
  let seed = 7;
  const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 200; i++) {
    const trials = makeTrials(random);
    assert.equal(trials.length, 6);
    assert.equal(new Set(trials.map((t) => t.expected)).size, 6);
    for (const t of trials) {
      assert.ok(t.pad.every((v) => v >= -1 && v <= 1));
      assert.equal(t.expected, nearestEmotion(t.pad).id);
      const anchor = EMOTIONS.find((e) => e.id === t.expected);
      assert.ok(t.pad.every((v, index) => Math.abs(v - anchor.pad[index]) <= 0.060001));
    }
  }
});
test('la matriz y SAM provienen de respuestas reales y conservan su orientación', () => {
  const s = session(); s.trials[0].perceived = 'sadness';
  const result = summarize([s]);
  assert.equal(result.total, 6); assert.equal(result.participants, 1);
  assert.equal(result.accuracy, 5 / 6);
  assert.equal(result.matrix[0][3], 1); assert.equal(result.matrix[3][0], 0);
  assert.deepEqual(result.sam[0].mean, [7, 5, 3]);
  assert.deepEqual(result.sam[7].mean, [null, null, null]);
  assert.equal(summarize([]).accuracy, null);
  assert.equal(summarize([s, { ...s, participant: 'p01' }]).participants, 1);
});
test('no se aceptan sesiones corruptas, escalas inválidas ni exposiciones menores a 5 s', () => {
  const s = session(); assert.ok(validSession(s));
  assert.equal(readSessions({ getItem: () => '{' }).length, 0);
  assert.equal(readSessions({ getItem: () => JSON.stringify([s, {}]) }).length, 1);
  s.trials[0].sam[1] = 10; assert.ok(!validSession(s));
  s.trials[0].sam[1] = 4; s.trials[0].durationMs = 4999; assert.ok(!validSession(s));
  s.trials[0].durationMs = 5000; s.participant = '<script>'; assert.ok(!validSession(s));
});
test('CSV, plantilla IEEE y resultados exportados respetan los datos disponibles', () => {
  const s = session();
  assert.equal(exportCSV([s]).split('\r\n').length, 7);
  assert.ok(exportCSV([s]).includes('"SAM_valencia"'));
  const empty = technicalReport([]);
  assert.ok(empty.includes('Recolección pendiente'));
  assert.ok(!empty.includes('\\addplot+'));
  const report = technicalReport([s]);
  assert.ok(report.includes('100.0\\%'));
  assert.ok(report.includes('\\addplot+'));
  assert.ok(report.includes('muestra aún no cumple'));
  assert.ok(report.includes('Alegría & 1 & 7.00 & 5.00 & 3.00'));
});
