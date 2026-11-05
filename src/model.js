/** PAD y FACS: valores de diseño, no mediciones clínicas ni codificación humana validada. */
export const EMOTIONS = [
  { id: 'joy', name: 'Alegría', emoji: '1f604', pad: [0.8, 0.6, 0.5], color: '#eef0d8', aus: { 1: 0.1, 2: 0.1, 6: 0.9, 12: 1, 25: 0.5 }, brows: 'AU 1 · 0.1 / AU 2 · 0.1', eyes: 'AU 6 · 0.9', mouth: 'AU 12 · 1.0 / AU 25 · 0.5', detail: 'Mejillas elevadas y comisuras hacia arriba.' },
  { id: 'surprise', name: 'Sorpresa', emoji: '1f62e', pad: [0.2, 0.9, -0.1], color: '#f5e9cf', aus: { 1: 0.9, 2: 1, 5: 1, 26: 0.9 }, brows: 'AU 1 · 0.9 / AU 2 · 1.0', eyes: 'AU 5 · 1.0', mouth: 'AU 26 · 0.9', detail: 'Cejas elevadas, ojos amplios y mandíbula abierta.' },
  { id: 'anger', name: 'Ira', emoji: '1f620', pad: [-0.6, 0.8, 0.8], color: '#f5ded6', aus: { 4: 1, 5: 0.6, 7: 0.5, 23: 0.8, 15: 0.6 }, brows: 'AU 4 · 1.0', eyes: 'AU 5 · 0.6 / AU 7 · 0.5', mouth: 'AU 15 · 0.6 / AU 23 · 0.8', detail: 'Cejas fruncidas y labios tensos; dominancia alta.' },
  { id: 'sadness', name: 'Tristeza', emoji: '1f622', pad: [-0.8, -0.6, -0.6], color: '#dfe9f4', aus: { 1: 0.8, 4: 0.4, 7: 0.2, 15: 0.9, 17: 0.5 }, brows: 'AU 1 · 0.8 / AU 4 · 0.4', eyes: 'AU 7 · 0.2', mouth: 'AU 15 · 0.9 / AU 17 · 0.5', detail: 'Cejas elevadas en el centro y comisuras caídas.' },
  { id: 'disgust', name: 'Asco', emoji: '1f922', pad: [-0.75, 0.25, 0.35], color: '#e0e9d9', aus: { 4: 0.5, 7: 0.7, 9: 0.9, 10: 0.8, 17: 0.4 }, brows: 'AU 4 · 0.5', eyes: 'AU 7 · 0.7', mouth: 'AU 9 · 0.9 / AU 10 · 0.8 / AU 17 · 0.4', detail: 'Nariz arrugada y labio superior elevado.' },
  { id: 'fear', name: 'Miedo', emoji: '1f628', pad: [-0.6, 0.8, -0.8], color: '#e2e2f0', aus: { 1: 0.9, 2: 0.8, 4: 0.4, 5: 1, 20: 0.8, 26: 0.7 }, brows: 'AU 1 · 0.9 / AU 2 · 0.8 / AU 4 · 0.4', eyes: 'AU 5 · 1.0', mouth: 'AU 20 · 0.8 / AU 26 · 0.7', detail: 'Ojos abiertos y labios estirados; dominancia baja.' },
  { id: 'calm', name: 'Calma', emoji: '1f60c', pad: [0.5, -0.7, 0.2], color: '#e0ede8', aus: { 43: 0.55, 12: 0.25 }, brows: 'Neutrales · 0.0', eyes: 'AU 43 · 0.55', mouth: 'AU 12 · 0.25', detail: 'Párpados relajados y sonrisa leve. Preset de calma, no neutralidad estricta.' },
  { id: 'frustration', name: 'Frustración', emoji: '1f624', pad: [-0.65, 0.2, -0.15], color: '#ede3db', aus: { 4: 0.8, 7: 0.8, 17: 0.5, 23: 0.8 }, brows: 'AU 4 · 0.8', eyes: 'AU 7 · 0.8', mouth: 'AU 17 · 0.5 / AU 23 · 0.8', detail: 'Cejas contraídas, ojos tensos y labios comprimidos.' },
].map((e) => ({ ...e, emojiColor: e.id === 'disgust' ? '#77B255' : '#FFCC4D' }));

export const clamp = (v, min = -1, max = 1) => Math.min(max, Math.max(min, v));
export const signed = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
export const emotionById = (id) => EMOTIONS.find((e) => e.id === id);
export const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
export function nearestEmotion(pad) {
  return EMOTIONS.reduce((best, e) => distance(pad, e.pad) < distance(pad, best.pad) ? e : best);
}

// Exponencial independiente de FPS: dt en segundos, lambda en s⁻¹.
export function interpolate(current, target, dt, lambda = 5) {
  const alpha = 1 - Math.exp(-lambda * Math.max(0, dt));
  return current.map((v, i) => v + (target[i] - v) * alpha);
}

/** Base paramétrica de la práctica + mezcla RBF continua de rasgos FACS. */
export function geometry(pad) {
  const [p, a, d] = pad.map((v) => clamp(v));
  const raw = EMOTIONS.map((e) => Math.exp(-(distance([p, a, d], e.pad) ** 2) / (2 * 0.3 ** 2)));
  const sum = raw.reduce((n, v) => n + v, 0);
  const weights = Object.fromEntries(EMOTIONS.map((e, i) => [e.id, raw[i] / sum]));
  const aus = {};
  for (const e of EMOTIONS) for (const [au, v] of Object.entries(e.aus)) aus[au] = (aus[au] || 0) + v * weights[e.id];
  const cold = [207, 223, 239], warm = [229, 237, 207];
  return {
    p, a, d, weights, aus,
    mouthCurve: p * 58,
    browAngle: 0.35 * d - 0.25 * p,
    eyeHeight: 54 * (1 + 0.55 * a),
    color: cold.map((v, i) => Math.round((1 - p) / 2 * v + (1 + p) / 2 * warm[i])),
  };
}

/** Seis estímulos PAD aleatorios cerca de anclas conocidas; etiqueta = ancla más cercana. */
export function makeTrials(random = Math.random) {
  const shuffled = [...EMOTIONS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 6).map((emotion) => {
    const pad = emotion.pad.map((v) => Number(clamp(v + (random() - 0.5) * 0.12).toFixed(3)));
    return { pad, expected: nearestEmotion(pad).id };
  });
}

export const STORAGE_KEY = 'rofee.sessions.v1';
export function validSession(s) {
  return s && typeof s.participant === 'string' && /^[a-zA-Z0-9_-]{1,24}$/.test(s.participant)
    && typeof s.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s.id)
    && typeof s.date === 'string' && !Number.isNaN(Date.parse(s.date))
    && Array.isArray(s.trials) && s.trials.length === 6 && s.trials.every((t) =>
      emotionById(t.expected) && emotionById(t.perceived)
      && Array.isArray(t.pad) && t.pad.length === 3 && t.pad.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)
      && Array.isArray(t.sam) && t.sam.length === 3 && t.sam.every((v) => Number.isInteger(v) && v >= 1 && v <= 9)
      && Number.isFinite(t.durationMs) && t.durationMs >= 5000);
}
export function readSessions(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(validSession) : [];
  } catch { return []; }
}

export function summarize(sessions) {
  const matrix = EMOTIONS.map(() => Array(EMOTIONS.length).fill(0));
  const rows = sessions.flatMap((s) => s.trials);
  const sam = EMOTIONS.map((e) => {
    const trials = rows.filter((t) => t.expected === e.id);
    return { id: e.id, n: trials.length, mean: [0, 1, 2].map((i) => trials.length ? trials.reduce((v, t) => v + t.sam[i], 0) / trials.length : null) };
  });
  for (const t of rows) matrix[EMOTIONS.findIndex((e) => e.id === t.expected)][EMOTIONS.findIndex((e) => e.id === t.perceived)]++;
  const correct = matrix.reduce((sum, row, i) => sum + row[i], 0);
  return { matrix, sam, total: rows.length, participants: new Set(sessions.map((s) => s.participant.toLowerCase())).size, accuracy: rows.length ? correct / rows.length : null };
}

const csvCell = (v) => `"${String(v).replaceAll('"', '""')}"`;
export function exportCSV(sessions) {
  const header = ['participante', 'sesion', 'fecha', 'estimulo', 'P', 'A', 'D', 'esperada', 'percibida', 'SAM_valencia', 'SAM_activacion', 'SAM_dominancia', 'duracion_ms'];
  const rows = sessions.flatMap((s) => s.trials.map((t, i) => [s.participant, s.id, s.date, i + 1, ...t.pad, emotionById(t.expected).name, emotionById(t.perceived).name, ...t.sam, Math.round(t.durationMs)]));
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
