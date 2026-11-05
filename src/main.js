import './style.css';
import '@fontsource-variable/dm-sans';
import { EMOTIONS, clamp, signed, geometry, distance, nearestEmotion, emotionById, makeTrials, readSessions, STORAGE_KEY, summarize, exportCSV } from './model.js';
import { FaceRenderer } from './face.js';
import { icon, logo } from './icons.js';
import { technicalReport } from './report.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const state = { pad: [...EMOTIONS[0].pad], model: 'pad', idle: !matchMedia('(prefers-reduced-motion: reduce)').matches, lambda: 5, resolution: [800, 480], cycling: false };
let storage;
try { storage = window.localStorage; } catch { /* Navegadores que bloquean almacenamiento: conservar en memoria. */ }
let sessions = readSessions(storage || { getItem: () => null });
let renderer, cycleTimer, experiment = null, observationTimer, countdownTimer;
let view = location.hash.slice(1) || 'laboratorio';
const views = ['laboratorio', 'facs', 'evaluacion', 'resultados'];
if (!views.includes(view)) view = 'laboratorio';

$('#app').innerHTML = `
  <header class="site-header">
    <div class="header-inner">
      <a href="#laboratorio" class="brand" aria-label="Rofee, inicio">${logo()}<span>rofee<span class="brand-dot">.</span></span><span class="brand-divider"></span><span class="brand-descriptor">emotion lab</span></a>
      <nav class="main-nav" aria-label="Navegación principal">
        <a href="#laboratorio">Laboratorio</a><a href="#facs">Modelo FACS</a><a href="#evaluacion">Evaluación</a><a href="#resultados">Resultados</a>
      </nav>
      <button class="guide-button" data-action="guide">${icon('book')}<span>Guía de la práctica</span>${icon('chevron')}</button>
    </div>
  </header>
  <main id="main" tabindex="-1"></main>
  <footer class="site-footer"><div><span class="footer-brand">rofee.</span><span>Una cara. Muchas formas de sentir.</span></div><span>Comunicación no verbal <span class="footer-dot">·</span> Práctica 07 ${icon('spark')}</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="guide-dialog" aria-labelledby="guide-title">
    <div class="dialog-heading"><span class="eyebrow">TU RUTA DE TRABAJO</span><button class="icon-button" data-action="close-dialog" aria-label="Cerrar guía">${icon('close')}</button></div>
    <h2 id="guide-title">De una expresión a un experimento.</h2>
    <p>Práctica 7 · Interfaces facial-gráficas 2D para robots socialmente asistenciales.</p>
    <ol class="guide-steps">
      <li><span>01</span><div><strong>Explora y deconstruye</strong><p>Compara ocho emojis de Twemoji con sus unidades de acción en Modelo FACS.</p></div></li>
      <li><span>02</span><div><strong>Construye una emoción</strong><p>Usa los controles PAD o Russell. Observa la interpolación, el parpadeo de 150 ms cada 3–6 s y los micromovimientos.</p></div></li>
      <li><span>03</span><div><strong>Evalúa con cinco personas</strong><p>Invita a participantes ajenos al equipo. Cada persona observará seis estímulos de cinco segundos y responderá una etiqueta y tres escalas inspiradas en SAM.</p></div></li>
      <li><span>04</span><div><strong>Analiza y entrega</strong><p>Exporta CSV, JSON y el reporte IEEE en LaTeX desde Resultados. Completa los nombres, la discusión y las conclusiones con datos reales.</p></div></li>
    </ol>
    <div class="info-note">${icon('info')}<p>Las intensidades FACS y coordenadas PAD son propuestas de diseño. La escala ilustrada es una adaptación web de SAM. El estudio permite evaluar si estas decisiones se reconocen.</p></div>
    <button class="button primary wide" data-action="close-dialog">Vamos al laboratorio ${icon('arrow')}</button>
  </dialog>
  <dialog id="clear-dialog" aria-labelledby="clear-title"><div class="dialog-heading"><span class="eyebrow">DATOS LOCALES</span><button class="icon-button" data-action="close-clear" aria-label="Cerrar">${icon('close')}</button></div><h2 id="clear-title">¿Eliminar los resultados?</h2><p>Se eliminarán las sesiones guardadas en este navegador. Exporta una copia antes de continuar.</p><div class="dialog-actions"><button class="button secondary" data-action="close-clear">Conservar datos</button><button class="button danger" data-action="confirm-clear">Eliminar datos</button></div></dialog>
`;

function heading(kicker, title, text, extra = '') {
  return `<section class="page-heading"><div><div class="eyebrow"><span class="tiny-spark">✳</span> ${kicker}</div><h1>${title}</h1><p>${text}</p></div>${extra}</section>`;
}
const emotionImage = (e, size = 32) => `<img src="${import.meta.env.BASE_URL}emojis/${e.emoji}.svg" width="${size}" height="${size}" alt="" loading="eager">`;

function render() {
  renderer?.destroy(); renderer = null;
  clearInterval(cycleTimer); clearTimeout(observationTimer); clearInterval(countdownTimer);
  state.cycling = false;
  $$('.main-nav a').forEach((a) => { const active = a.hash === `#${view}`; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (view === 'laboratorio') renderStudio();
  if (view === 'facs') renderFACS();
  if (view === 'evaluacion') renderEvaluation();
  if (view === 'resultados') renderResults();
}

function renderStudio() {
  $('#main').innerHTML = `
    ${heading('LABORATORIO DE EXPRESIÓN EMOCIONAL', 'Las emociones, a la vista<span class="accent-dot">.</span>', 'Explora cómo se siente un robot. Ajusta, observa y experimenta.', '<div class="practice-pill"><span class="live-dot"></span> Interfaz en tiempo real <span class="pill-divider"></span> P07</div>')}
    <div class="studio-grid">
      <section class="panel face-panel" aria-labelledby="face-heading">
        <div class="panel-heading"><h2 id="face-heading">${icon('eye')} Vista del robot</h2><div class="face-tools"><div class="resolution-switch" role="group" aria-label="Resolución del rostro"><button data-resolution="800,480" class="${state.resolution[0] === 800 ? 'selected' : ''}">800 × 480</button><button data-resolution="1024,600" class="${state.resolution[0] === 1024 ? 'selected' : ''}">1024 × 600</button></div><span class="tool-divider"></span><button class="icon-button" data-action="screenshot" aria-label="Guardar imagen del rostro" title="Guardar imagen">${icon('camera')}</button><button class="icon-button" data-action="fullscreen" aria-label="Mostrar solo el rostro en pantalla completa" title="Pantalla completa">${icon('expand')}</button></div></div>
        <div class="face-stage" id="face-stage"><canvas id="face" width="800" height="480" role="img" aria-label="Rostro vectorial de un robot expresando alegría"></canvas><div class="face-badge"><span class="live-dot"></span><span id="face-emotion">Alegría</span></div><span class="face-live">${icon('spark')} Un pequeño reflejo de lo que sentimos</span><button class="fullscreen-exit button secondary" data-action="exit-fullscreen">${icon('close')} Salir de pantalla completa</button></div>
        <div class="face-bottom"><span><span class="live-dot"></span> <span id="animation-state">Microgestos activos</span></span><div class="pad-readout"><span>P <b id="live-p">+0.80</b></span><span>A <b id="live-a">+0.60</b></span><span>D <b id="live-d">+0.50</b></span></div></div>
      </section>
      <section class="panel controls-panel" aria-labelledby="controls-heading">
        <div class="panel-heading"><h2 id="controls-heading">${icon('sliders')} Control emocional</h2><button class="icon-button" data-action="reset" title="Restablecer a neutral" aria-label="Restablecer controles a neutral">${icon('reset')}</button></div>
        <div class="controls-body"><div class="model-switch" role="group" aria-label="Modelo afectivo"><button data-model="russell" class="${state.model === 'russell' ? 'selected' : ''}">Russell <span>2D</span></button><button data-model="pad" class="${state.model === 'pad' ? 'selected' : ''}">Modelo PAD <span>3D</span></button></div>
        ${slider(0, 'Valencia', 'Cómo se siente', 'Desagradable', 'Agradable', 'P')}
        ${slider(1, 'Activación', 'Cuánta energía tiene', 'Relajado', 'Activado', 'A')}
        ${slider(2, 'Dominancia', 'Qué tan seguro se siente', 'Sumiso', 'Dominante', 'D')}
        <div class="dynamics-control"><div><label for="transition-speed">Transición</label><span>De una emoción a otra</span></div><select id="transition-speed" aria-label="Velocidad de transición"><option value="2" ${state.lambda === 2 ? 'selected' : ''}>Pausada</option><option value="5" ${state.lambda === 5 ? 'selected' : ''}>Suave</option><option value="10" ${state.lambda === 10 ? 'selected' : ''}>Ágil</option></select></div>
        <div class="idle-control"><div><label for="idle">Animaciones naturales</label><span>Parpadeo y micromovimientos</span></div><button id="idle" class="toggle ${state.idle ? 'on' : ''}" role="switch" aria-checked="${state.idle}" aria-label="Animaciones naturales"><span></span></button></div>
        </div>
      </section>
    </div>
    <section class="panel presets-panel" aria-labelledby="presets-heading"><div class="panel-heading"><div><h2 id="presets-heading">Una emoción para empezar</h2><p>Elige una expresión o encuentra la tuya con los controles.</p></div><button class="text-button" data-action="cycle" id="cycle-button">${icon('play')} Recorrer emociones</button></div><div class="emotion-grid">${EMOTIONS.map((e) => `<button class="emotion-card ${distance(state.pad, e.pad) < 0.01 ? 'active' : ''}" data-emotion="${e.id}" aria-pressed="${distance(state.pad, e.pad) < 0.01}" style="--emotion-color:${e.color}"><span class="emoji-circle">${emotionImage(e, 30)}</span><span>${e.name}</span><span class="emotion-card-dot"></span></button>`).join('')}</div></section>
    <div class="insights-grid"><section class="panel affect-panel"><div class="affect-copy"><span class="eyebrow">EL MAPA DETRÁS DEL GESTO</span><h2>Cada emoción tiene<br>sus coordenadas.</h2><p>Valencia y activación sitúan la emoción. La dominancia le da un matiz propio.</p><a href="#facs" class="text-link">Explorar el modelo ${icon('arrow')}</a></div>${russellMap()}</section><section class="evaluation-cta"><div class="cta-icon">${icon('users')}</div><div><span class="eyebrow">DE LA INTENCIÓN A LA PERCEPCIÓN</span><h2>¿Los demás ven lo mismo?</h2><p>Pon a prueba las expresiones con personas reales y descubre qué comunican.</p><a href="#evaluacion" class="button primary">Iniciar evaluación ${icon('arrow')}</a></div><div class="cta-foot"><span>${icon('users')} 5 participantes</span><span>${icon('clock')} 6 estímulos · 5 s</span></div></section></div>
  `;
  renderer = new FaceRenderer($('#face'), { pad: state.pad, idle: state.idle, lambda: state.lambda, onFrame: updateLive });
  renderer.setResolution(...state.resolution);
  $$('input[data-pad]').forEach((input) => input.addEventListener('input', () => {
    stopCycle();
    state.pad[Number(input.dataset.pad)] = Number(input.value);
    updateTarget();
  }));
  $('#transition-speed').addEventListener('change', (e) => { state.lambda = Number(e.target.value); renderer.lambda = state.lambda; });
  $('#idle').addEventListener('click', () => { state.idle = !state.idle; renderer.idle = state.idle; $('#idle').classList.toggle('on', state.idle); $('#idle').setAttribute('aria-checked', state.idle); $('#animation-state').textContent = state.idle ? 'Microgestos activos' : 'Microgestos en pausa'; });
  initMap(); updateTarget();
}

function slider(i, name, subtitle, low, high, letter) {
  return `<div class="slider-control ${i === 2 && state.model === 'russell' ? 'disabled' : ''}" id="control-${i}"><div class="slider-heading"><label for="pad-${i}"><span class="axis-label axis-${i}">${letter}</span>${name}<span class="control-hint" title="${subtitle}">${icon('info')}</span></label><output id="value-${i}" for="pad-${i}">${signed(state.pad[i])}</output></div><input type="range" min="-1" max="1" step="0.01" id="pad-${i}" data-pad="${i}" value="${state.pad[i]}" ${i === 2 && state.model === 'russell' ? 'disabled' : ''} style="--fill:${(state.pad[i] + 1) * 50}%"><div class="range-labels"><span>${low}</span><span>${high}</span></div></div>`;
}

function updateTarget() {
  renderer?.setTarget(state.pad);
  $$('input[data-pad]').forEach((input, i) => { input.value = state.pad[i]; input.style.setProperty('--fill', `${(state.pad[i] + 1) * 50}%`); $(`#value-${i}`).textContent = signed(state.pad[i]); });
  $$('[data-emotion]').forEach((button) => { const selected = distance(state.pad, emotionById(button.dataset.emotion).pad) < 0.02; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', selected); });
  const nearest = nearestEmotion(state.pad);
  const label = distance(state.pad, [0, 0, 0]) < 0.01 ? 'Neutral' : distance(state.pad, nearest.pad) < 0.08 ? nearest.name : 'Expresión libre';
  $('#face-emotion').textContent = label;
  $('#face').setAttribute('aria-label', `Rostro vectorial del robot. ${label}. Valencia ${signed(state.pad[0])}, activación ${signed(state.pad[1])}, dominancia ${signed(state.pad[2])}.`);
  const point = $('#map-point'); if (point) { point.setAttribute('cx', 125 + state.pad[0] * 82); point.setAttribute('cy', 112 - state.pad[1] * 82); }
}
function updateLive(pad) { if (view === 'laboratorio') for (let i = 0; i < 3; i++) { const element = $(`#live-${['p', 'a', 'd'][i]}`); if (element) element.textContent = signed(pad[i]); } }

function russellMap() {
  return `<svg id="russell-map" class="russell-map" viewBox="0 0 250 225" role="img" tabindex="0" aria-label="Mapa interactivo de Russell. Haz clic para cambiar valencia y activación, o usa las flechas."><defs><radialGradient id="map-gradient"><stop offset="0" stop-color="#e9eedd" stop-opacity=".3"/><stop offset="1" stop-color="#e9eedd" stop-opacity=".05"/></radialGradient></defs><circle cx="125" cy="112" r="82" fill="url(#map-gradient)" stroke="#e1e5dc" stroke-dasharray="3 4"/><circle cx="125" cy="112" r="41" fill="none" stroke="#eceee8"/><path d="M32 112h186M125 19v186" stroke="#daddd4"/><g class="map-label"><text x="125" y="13" text-anchor="middle">ACTIVACIÓN +</text><text x="125" y="222" text-anchor="middle">ACTIVACIÓN −</text><text x="9" y="116">−</text><text x="230" y="116">+</text><text x="160" y="105">Valencia</text></g>${EMOTIONS.map((e) => `<circle cx="${125 + e.pad[0] * 82}" cy="${112 - e.pad[1] * 82}" r="3" fill="#aeb8a5"><title>${e.name}</title></circle>`).join('')}<circle id="map-point" cx="125" cy="112" r="7" fill="#e96942" stroke="white" stroke-width="3"/></svg>`;
}
function initMap() {
  const map = $('#russell-map');
  const move = (e) => { const r = map.getBoundingClientRect(); const x = (e.clientX - r.left) * 250 / r.width; const y = (e.clientY - r.top) * 225 / r.height; state.pad[0] = Number(clamp((x - 125) / 82).toFixed(2)); state.pad[1] = Number(clamp((112 - y) / 82).toFixed(2)); stopCycle(); updateTarget(); };
  map.addEventListener('pointerdown', (e) => { map.setPointerCapture(e.pointerId); move(e); });
  map.addEventListener('pointermove', (e) => { if (map.hasPointerCapture(e.pointerId)) move(e); });
  map.addEventListener('keydown', (e) => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const index = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 0 : 1; state.pad[index] = Number(clamp(state.pad[index] + (['ArrowRight', 'ArrowUp'].includes(e.key) ? 0.05 : -0.05)).toFixed(2)); stopCycle(); updateTarget(); });
}

function stopCycle() { clearInterval(cycleTimer); state.cycling = false; const button = $('#cycle-button'); if (button) button.innerHTML = `${icon('play')} Recorrer emociones`; }

function renderFACS() {
  $('#main').innerHTML = `${heading('LA ANATOMÍA DE UNA EXPRESIÓN', 'Pequeños gestos. Grandes señales<span class="accent-dot">.</span>', 'Deconstruye ocho emojis y descubre cómo se traducen en el rostro del robot.')}
    <div class="facs-intro"><div>${icon('grid')} <span><strong>Unidades de acción · FACS</strong> Una forma de describir los movimientos del rostro.</span></div><span class="small-badge">Twemoji 14.0.2 · Twitter</span></div>
    <section class="panel table-panel"><div class="table-scroll"><table class="facs-table"><caption class="sr-only">Deconstrucción FACS e intensidades de diseño entre cero y uno para ocho emojis de Twemoji</caption><thead><tr><th>EMOCIÓN / EMOJI</th><th>COLOR DEL EMOJI</th><th>CEJAS</th><th>OJOS</th><th>BOCA Y NARIZ</th><th>ROSTRO · HEX</th><th>VECTOR PAD</th><th><span class="sr-only">Probar</span></th></tr></thead><tbody>${EMOTIONS.map((e) => `<tr><th scope="row"><span class="table-emotion">${emotionImage(e, 34)}<span>${e.name}</span></span></th><td><span class="swatch" style="background:${e.emojiColor}"></span><code>${e.emojiColor}</code></td><td>${e.brows.replaceAll(' / ', '<br>')}</td><td>${e.eyes.replaceAll(' / ', '<br>')}</td><td>${e.mouth.replaceAll(' / ', '<br>')}</td><td><span class="swatch" style="background:rgb(${geometry(e.pad).color.join(',')})"></span><code>#${geometry(e.pad).color.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}</code></td><td><code class="pad-code">${e.pad.map(signed).join(' / ')}</code></td><td><button class="icon-button" data-try="${e.id}" aria-label="Probar ${e.name} en el laboratorio">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div><div class="table-note">${icon('info')} Intensidades y vectores propuestos para esta interfaz; no son anotaciones FACS validadas. Se distinguen el color base del emoji y el fondo del robot. Miedo también incluye una frente azul #BDDDF4.</div></section>
    <div class="formula-heading"><div><span class="eyebrow">DEL VECTOR A LA GEOMETRÍA</span><h2>Las matemáticas detrás de la expresión.</h2></div><span class="small-badge">P, A, D ∈ [−1, +1]</span></div>
    <div class="formula-grid"><article class="panel formula-card"><span class="formula-number">01 / BOCA</span><h3>La valencia dibuja la sonrisa.</h3><div class="equation">C<sub>boca</sub> = P · 58</div><p>Desplazamiento del control Bézier: positivo para sonrisa, negativo para tristeza.</p></article><article class="panel formula-card"><span class="formula-number">02 / CEJAS</span><h3>La dominancia cambia la intención.</h3><div class="equation">θ<sub>ceja</sub> = 0.35D − 0.25P</div><p>El parámetro se traduce en inclinación de las cejas. Diferencia ira de miedo.</p></article><article class="panel formula-card"><span class="formula-number">03 / OJOS</span><h3>La energía abre la mirada.</h3><div class="equation">H<sub>ojo</sub> = 54(1 + 0.55A)</div><p>Apertura base antes de aplicar tensión de párpados, mejillas y parpadeo.</p></article><article class="panel formula-card"><span class="formula-number">04 / COLOR</span><h3>Una paleta que también siente.</h3><div class="equation small">RGB = <span class="fraction"><span>1 − P</span><span>2</span></span> C<sub>frío</sub> + <span class="fraction"><span>1 + P</span><span>2</span></span> C<sub>cálido</sub></div><p>Mezcla lineal entre #CFDFEF y #E5EDCF. La mezcla FACS gaussiana añade rasgos específicos.</p></article></div>
    <div class="info-note source-note">${icon('book')}<p>Los emojis son gráficos de <a href="https://github.com/twitter/twemoji/tree/v14.0.2" target="_blank" rel="noreferrer">Twemoji 14.0.2</a>, © Twitter, Inc. y colaboradores, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. AU 23: tensión labial. AU 43: cierre ocular. Consulta el README y el reporte para las ecuaciones completas y la bibliografía.</p></div>`;
}

function nextParticipant() {
  let n = 1;
  while (sessions.some((s) => s.participant.toLowerCase() === `p${String(n).padStart(2, '0')}`)) n++;
  return `P${String(n).padStart(2, '0')}`;
}
function renderEvaluation() {
  if (experiment?.phase === 'observe') return renderObservation();
  if (experiment?.phase === 'respond') return renderResponse();
  if (experiment?.phase === 'complete') return renderComplete();
  const s = summarize(sessions);
  $('#main').innerHTML = `${heading('EVALUACIÓN PERCEPTUAL', 'Lo que expresa. Lo que se percibe<span class="accent-dot">.</span>', 'Un pequeño experimento para descubrir si el rostro comunica lo que queremos.')}
    <div class="evaluation-grid"><section class="panel eval-intro"><span class="section-number">01 / EL EXPERIMENTO</span><h2>Seis rostros.<br>Tu primera impresión.</h2><p>Observarás seis expresiones, una a la vez. Después de cada rostro, elige la emoción que percibiste y cómo se sintió en tres dimensiones.</p><div class="protocol-cards"><div>${icon('eye')}<strong>6 estímulos</strong><span>PAD aleatorios, sin etiquetas</span></div><div>${icon('clock')}<strong>5 segundos</strong><span>Por cada expresión</span></div><div>${icon('sliders')}<strong>3 escalas SAM</strong><span>Respuestas del 1 al 9</span></div></div><div class="eval-note">${icon('info')}<p>No hay respuestas correctas para ti. Nos interesa tu percepción. Haz la prueba sin consultar los presets y mantén esta pestaña visible.</p></div><div class="participant-progress"><div><strong>${s.participants} <span>/ 5 participantes distintos</span></strong><span>${s.participants >= 5 ? 'Mínimo de identificadores alcanzado' : `Faltan ${5 - s.participants} para el mínimo de la práctica`}</span></div><div class="progress-track"><span style="width:${Math.min(100, s.participants / 5 * 100)}%"></span></div></div></section>
    <section class="panel eval-start"><div class="mini-face">${logo()}</div><span class="eyebrow">¿LISTO PARA OBSERVAR?</span><h2>Conoce a Rofee.</h2><p>Usa un identificador anónimo por persona. Los resultados se guardan en este navegador.</p><form id="participant-form"><label for="participant-id">Identificador del participante</label><input id="participant-id" name="participant" value="${nextParticipant()}" maxlength="24" pattern="[a-zA-Z0-9_-]{1,24}" required autocomplete="off" aria-describedby="participant-help"><small id="participant-help">Solo letras, números, guion y guion bajo. Sin nombres personales.</small><label class="checkbox-label"><input type="checkbox" name="independent" required><span>Soy participante ajeno al equipo de desarrollo.</span></label><button class="button primary wide" type="submit">Comenzar prueba ${icon('arrow')}</button><p class="form-error" id="participant-error" role="alert"></p></form><span class="eval-duration">${icon('clock')} Aproximadamente 3 minutos · sin registro</span></section></div>`;
  $('#participant-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const participant = $('#participant-id').value.trim();
    if (sessions.some((s) => s.participant.toLowerCase() === participant.toLowerCase())) { $('#participant-error').textContent = 'Este identificador ya completó la prueba. Usa uno distinto para una nueva persona.'; return; }
    experiment = { phase: 'observe', participant, trials: makeTrials(), index: 0, answers: [], elapsed: 0, remaining: 5000, paused: false };
    renderObservation();
  });
}

function observationHeader() {
  return `<div class="experiment-heading"><a href="#evaluacion" class="text-button" data-action="cancel-test">${icon('close')} Cancelar prueba</a><span class="experiment-participant">Participante ${esc(experiment.participant)}</span><span class="step-label">ESTÍMULO ${experiment.index + 1} DE 6</span></div><div class="step-dots">${Array.from({ length: 6 }, (_, i) => `<span class="${i < experiment.index ? 'done' : i === experiment.index ? 'current' : ''}"></span>`).join('')}</div>`;
}
function renderObservation() {
  renderer?.destroy(); clearTimeout(observationTimer); clearInterval(countdownTimer);
  $('#main').innerHTML = `<section class="experiment-container">${observationHeader()}<div class="experiment-title"><span class="eyebrow">MIRA, SIN BUSCAR UNA RESPUESTA TODAVÍA</span><h1>Observa este rostro.</h1><p>La expresión desaparecerá en <strong id="countdown">${Math.ceil(experiment.remaining / 1000)}</strong> segundos.</p></div><div class="observation-stage"><canvas id="observation-face" width="800" height="480" role="img" aria-label="Rostro emocional del estímulo ${experiment.index + 1}, sin etiqueta"></canvas><div id="pause-overlay" class="pause-overlay" ${experiment.paused ? '' : 'hidden'}><div>${icon('pause')}<h2>La prueba está en pausa.</h2><p>Continuaremos el tiempo de observación restante.</p><button class="button primary" data-action="resume-test">Continuar observando ${icon('arrow')}</button></div></div></div><div class="observation-progress"><span id="observation-bar" style="width:${experiment.remaining / 50}%"></span></div><p class="observation-note">${icon('eye')} Solo observa. Las preguntas aparecerán al terminar los cinco segundos.</p><p id="test-live" class="sr-only" role="status">Observación del estímulo ${experiment.index + 1} de seis</p></section>`;
  renderer = new FaceRenderer($('#observation-face'), { pad: experiment.trials[experiment.index].pad, idle: true });
  if (!experiment.paused) startObservationClock();
}
function startObservationClock() {
  experiment.startedAt = performance.now();
  experiment.paused = false;
  $('#pause-overlay').hidden = true;
  const update = () => {
    const remaining = Math.max(0, experiment.remaining - (performance.now() - experiment.startedAt));
    $('#countdown').textContent = Math.ceil(remaining / 1000);
    $('#observation-bar').style.width = `${remaining / 50}%`;
  };
  countdownTimer = setInterval(update, 100);
  observationTimer = setTimeout(finishObservation, experiment.remaining);
}
function finishObservation() {
  if (!experiment || experiment.phase !== 'observe' || experiment.paused) return;
  const passed = performance.now() - experiment.startedAt;
  if (passed + experiment.elapsed < 5000) { observationTimer = setTimeout(finishObservation, 5000 - passed - experiment.elapsed); return; }
  experiment.durationMs = experiment.elapsed + passed;
  experiment.phase = 'respond'; experiment.perceived = null; experiment.sam = [null, null, null];
  renderResponse();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && experiment?.phase === 'observe' && !experiment.paused) {
    const passed = performance.now() - experiment.startedAt;
    experiment.elapsed += passed;
    experiment.remaining = Math.max(0, experiment.remaining - passed);
    experiment.paused = true;
    clearTimeout(observationTimer); clearInterval(countdownTimer);
    const overlay = $('#pause-overlay'); if (overlay) overlay.hidden = false;
  }
});

// Pictogramas propios: adaptación ilustrada de las dimensiones SAM, escala de 9 puntos.
function manikin(dimension, value) {
  const n = (value - 5) / 4;
  const bodyScale = dimension === 2 ? 0.7 + (value - 1) / 8 * 0.55 : 1;
  const mouth = dimension === 0 ? n * 5 : 0;
  const activation = dimension === 1 ? (value - 1) / 8 : 0;
  return `<svg class="manikin" viewBox="0 0 38 46" aria-hidden="true"><g transform="translate(19 24) scale(${bodyScale}) translate(-19 -24)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="3" width="18" height="16" rx="6"/><path d="M15 9v1m8-1v1m-8 4q4 ${mouth} 8 0M11 22h16l3 10h-5v9h-4v-8h-4v8h-4v-9H8l3-10Z"/>${dimension === 1 ? `<path d="m15 ${28 + activation * 2} 3 ${-activation * 5} 3 ${activation * 7} 3 ${-activation * 5}"/>` : ''}</g>${activation > 0.5 ? '<path d="m3 8 3 1M33 9l3-1M19 0V-2" stroke="currentColor" stroke-width="1.5"/>' : ''}</svg>`;
}
function renderResponse() {
  renderer?.destroy(); renderer = null;
  clearTimeout(observationTimer); clearInterval(countdownTimer);
  const labels = [['Valencia', 'Desagradable', 'Agradable'], ['Activación', 'Relajado', 'Activado'], ['Dominancia', 'Sumiso', 'Dominante']];
  $('#main').innerHTML = `<section class="experiment-container response-container">${observationHeader()}<div class="experiment-title"><span class="eyebrow">TU PERCEPCIÓN ES LO QUE CUENTA</span><h1>¿Qué te transmitió?</h1><p>Piensa en el rostro que acabas de ver.</p></div><form id="response-form"><fieldset class="response-emotions"><legend><span class="question-number">1</span> ¿Qué emoción percibiste?</legend><div class="response-choices">${EMOTIONS.map((e) => `<label class="response-choice"><input type="radio" name="perceived" value="${e.id}" required><span>${e.name}</span></label>`).join('')}</div></fieldset><fieldset class="sam-fieldset"><legend><span class="question-number">2</span> ¿Cómo se sentía el rostro?</legend><p class="sam-description">Selecciona un valor en cada dimensión. 1 = extremo izquierdo, 9 = extremo derecho.</p>${labels.map(([label, low, high], i) => `<fieldset class="sam-scale"><legend>${label}</legend><div class="sam-options">${Array.from({ length: 9 }, (_, j) => `<label class="sam-option"><input type="radio" name="sam-${i}" value="${j + 1}" required aria-label="${label}: ${j + 1}"><span>${manikin(i, j + 1)}<b>${j + 1}</b></span></label>`).join('')}</div><div class="range-labels"><span>1 · ${low}</span><span>5 · Intermedio</span><span>9 · ${high}</span></div></fieldset>`).join('')}</fieldset><div class="response-footer"><span>${icon('info')} Responde las cuatro preguntas para continuar.</span><button type="submit" class="button primary">${experiment.index === 5 ? 'Finalizar evaluación' : 'Siguiente expresión'} ${icon('arrow')}</button></div></form></section>`;
  $('#response-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const perceived = data.get('perceived'); const sam = [0, 1, 2].map((i) => Number(data.get(`sam-${i}`)));
    if (!emotionById(perceived) || sam.some((v) => v < 1 || v > 9)) return;
    experiment.answers.push({ ...experiment.trials[experiment.index], perceived, sam, durationMs: experiment.durationMs });
    if (experiment.index < 5) {
      experiment.index++; experiment.phase = 'observe'; experiment.elapsed = 0; experiment.remaining = 5000; experiment.paused = false;
      renderObservation();
    } else {
      const session = { id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`, date: new Date().toISOString(), participant: experiment.participant, trials: experiment.answers };
      sessions.push(session);
      experiment.saved = saveSessions(); experiment.phase = 'complete'; renderComplete();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}
function saveSessions() {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(sessions)); return true; }
  catch { toast('No se pudo guardar en este navegador. Exporta los datos antes de salir.'); return false; }
}
function renderComplete() {
  $('#main').innerHTML = `<section class="complete-panel panel"><div class="complete-icon">${icon('check')}</div><span class="eyebrow">EVALUACIÓN COMPLETADA</span><h1>Gracias por tu mirada<span class="accent-dot">.</span></h1><p>Las seis respuestas de <strong>${esc(experiment.participant)}</strong> ${experiment.saved ? 'se guardaron en este navegador.' : 'están disponibles en esta sesión. Exporta una copia antes de cerrar.'}</p><div class="complete-stats"><div><strong>6 / 6</strong><span>Estímulos evaluados</span></div><div><strong>18</strong><span>Valoraciones SAM</span></div><div><strong>${summarize(sessions).participants} / 5</strong><span>Participantes distintos</span></div></div><div class="complete-actions"><a class="button primary" href="#resultados">Explorar los resultados ${icon('arrow')}</a><button class="button secondary" data-action="new-participant">Siguiente participante ${icon('users')}</button></div><p class="muted">No muestres las respuestas a quienes aún no han hecho la prueba.</p></section>`;
}

function renderResults() {
  const s = summarize(sessions);
  $('#main').innerHTML = `${heading('DE LA PERCEPCIÓN A LOS DATOS', 'Lo que el rostro nos cuenta<span class="accent-dot">.</span>', 'Respuestas reales para entender qué expresiones se reconocen y cuáles se confunden.', '<button class="button secondary" data-action="export-report">'+icon('download')+' Reporte IEEE / LaTeX</button>')}
    <div class="results-stats"><div class="panel result-stat"><span>${icon('users')} Participantes distintos</span><strong>${s.participants}<small> / 5 mínimo</small></strong><span class="stat-note">${s.participants >= 5 ? 'Confirma que sean personas ajenas al equipo' : 'Invita a personas ajenas al equipo'}</span></div><div class="panel result-stat"><span>${icon('eye')} Respuestas registradas</span><strong>${s.total}<small> estímulos</small></strong><span class="stat-note">${sessions.length} sesiones completas de 6 estímulos</span></div><div class="panel result-stat"><span>${icon('chart')} Reconocimiento emocional</span><strong>${s.accuracy === null ? '—' : (s.accuracy * 100).toFixed(1) + '%'}<small> de coincidencia</small></strong><span class="stat-note">Emoción esperada frente a emoción percibida</span></div></div>
    ${s.total ? resultsPanels(s) : `<section class="panel empty-state"><div class="empty-art">${icon('chart')}<span></span><span></span><span></span></div><span class="eyebrow">CADA RESPUESTA ES UN PUNTO DE PARTIDA</span><h2>Aún no hay resultados. Vamos a descubrirlos.</h2><p>Completa una evaluación para ver la matriz de confusión y las valoraciones SAM. Los datos aparecerán aquí, sin ejemplos simulados.</p><a href="#evaluacion" class="button primary">Iniciar primera evaluación ${icon('arrow')}</a></section>`}
    <section class="panel data-panel"><div><h2>${icon('download')} Tus datos, listos para analizar.</h2><p>Exporta una copia. Las respuestas solo se guardan en este navegador.</p></div><div class="data-actions"><button class="button secondary" data-action="export-csv" ${s.total ? '' : 'disabled'}>CSV ${icon('download')}</button><button class="button secondary" data-action="export-json" ${s.total ? '' : 'disabled'}>JSON ${icon('download')}</button><button class="button secondary" data-action="import-json">${icon('grid')} Importar JSON</button><input type="file" id="import-file" accept="application/json,.json" hidden>${s.total ? `<button class="icon-button delete-button" data-action="clear" aria-label="Eliminar resultados locales" title="Eliminar datos">${icon('trash')}</button>` : ''}</div></section><div class="info-note source-note">${icon('info')}<p>${s.participants >= 5 ? 'El mínimo numérico está alcanzado. Verifica que las sesiones correspondan a personas diferentes y ajenas al equipo.' : 'La práctica requiere al menos cinco participantes distintos ajenos al equipo. Los resultados parciales sirven para revisar el experimento.'} El reporte exportado incluye método, ecuaciones y datos disponibles; completa la discusión y las conclusiones antes de entregar.</p></div>`;
  $('#import-file').addEventListener('change', importSessions);
}
function resultsPanels(s) {
  const max = Math.max(1, ...s.matrix.flat());
  return `<section class="panel confusion-panel"><div class="panel-heading"><div><h2>Matriz de confusión</h2><p>Filas: emoción esperada · Columnas: emoción percibida · Valores: número de respuestas</p></div><span class="small-badge">${s.total} respuestas</span></div><div class="table-scroll"><table class="confusion-table"><caption class="sr-only">Matriz de confusión, conteos por emoción esperada y percibida</caption><thead><tr><th scope="col">Esperada ↓ / Percibida →</th>${EMOTIONS.map((e) => `<th scope="col">${e.name}</th>`).join('')}</tr></thead><tbody>${s.matrix.map((row, i) => `<tr><th scope="row">${EMOTIONS[i].name}</th>${row.map((n, j) => `<td style="--cell-color:${n ? i === j ? `rgba(117,153,107,${0.15 + n / max * 0.55})` : `rgba(233,105,66,${0.08 + n / max * 0.45})` : '#f7f8f4'}" aria-label="${EMOTIONS[i].name} percibida como ${EMOTIONS[j].name}: ${n}">${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="matrix-legend"><span><i class="legend-square correct"></i> Coincidencia</span><span><i class="legend-square confused"></i> Confusión</span><span>Más intensidad = más respuestas</span></div></section>
    <section class="panel sam-results"><div class="panel-heading"><div><h2>Cómo se perciben las emociones</h2><p>Medias de las valoraciones SAM por emoción esperada · Escala de 1 a 9</p></div><div class="chart-legend"><span><i style="background:#e96942"></i> Valencia</span><span><i style="background:#718c67"></i> Activación</span><span><i style="background:#7495b4"></i> Dominancia</span></div></div><div class="sam-chart">${s.sam.map((r, i) => `<div class="sam-chart-row"><span>${EMOTIONS[i].name}<small>n = ${r.n}</small></span><div class="sam-bars">${r.mean.map((v, j) => `<div class="sam-bar-track"><div class="sam-bar bar-${j}" style="width:${v === null ? 0 : (v - 1) / 8 * 100}%"></div><b style="left:${v === null ? 0 : (v - 1) / 8 * 100}%">${v === null ? '—' : v.toFixed(1)}</b><span class="sr-only">${['Valencia', 'Activación', 'Dominancia'][j]} ${v === null ? 'sin respuestas' : v.toFixed(1)}</span></div>`).join('')}</div></div>`).join('')}<div class="sam-chart-axis"><span></span><div><span>1</span><span>3</span><span>5</span><span>7</span><span>9</span></div></div></div></section>
    <section class="panel sessions-panel"><div class="panel-heading"><h2>Sesiones completas</h2><span class="small-badge">Almacenamiento local</span></div><div class="table-scroll"><table class="sessions-table"><thead><tr><th>Participante</th><th>Fecha local</th><th>Estímulos</th><th>Estado</th></tr></thead><tbody>${sessions.map((s) => `<tr><td><strong>${esc(s.participant)}</strong></td><td>${esc(new Date(s.date).toLocaleString('es-MX'))}</td><td>6 de 6</td><td><span class="session-complete">${icon('check')} Completa</span></td></tr>`).join('')}</tbody></table></div></section>`;
}

async function importSessions(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('Selecciona un JSON exportado por Rofee.');
    const checked = readSessions({ getItem: () => JSON.stringify(data.sessions) });
    if (checked.length !== data.sessions.length || !checked.length) throw new Error('El archivo contiene sesiones incompletas o datos no válidos.');
    if (new Set(checked.map((s) => s.id)).size !== checked.length) throw new Error('El archivo repite identificadores de sesión.');
    const newEntries = checked.filter((s) => !sessions.some((local) => local.id === s.id));
    // Evita contar como personas distintas dos sesiones con el mismo identificador.
    for (const incoming of newEntries) if (sessions.some((s) => s.participant.toLowerCase() === incoming.participant.toLowerCase())) throw new Error(`El identificador ${incoming.participant} ya existe. Usa identificadores únicos entre dispositivos.`);
    const unique = new Set([...sessions, ...newEntries].map((s) => s.participant.toLowerCase()));
    if (unique.size !== sessions.length + newEntries.length) throw new Error('Hay identificadores de participante repetidos en el archivo.');
    sessions.push(...newEntries);
    const saved = saveSessions(); renderResults();
    toast(`${newEntries.length} sesiones importadas.${saved ? '' : ' Exporta una copia antes de cerrar.'}`);
  } catch (error) { toast(error.message); event.target.value = ''; }
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 6000);
}

document.addEventListener('click', async (e) => {
  const preset = e.target.closest('[data-emotion]');
  if (preset) { stopCycle(); state.pad = [...emotionById(preset.dataset.emotion).pad]; if (state.model === 'russell') state.pad[2] = 0; updateTarget(); return; }
  const model = e.target.closest('[data-model]');
  if (model) { stopCycle(); state.model = model.dataset.model; if (state.model === 'russell') state.pad[2] = 0; $$('[data-model]').forEach((b) => b.classList.toggle('selected', b === model)); $('#control-2').classList.toggle('disabled', state.model === 'russell'); $('#pad-2').disabled = state.model === 'russell'; updateTarget(); return; }
  const resolution = e.target.closest('[data-resolution]');
  if (resolution) { state.resolution = resolution.dataset.resolution.split(',').map(Number); renderer.setResolution(...state.resolution); $$('[data-resolution]').forEach((b) => b.classList.toggle('selected', b === resolution)); return; }
  const tryEmotion = e.target.closest('[data-try]');
  if (tryEmotion) { state.model = 'pad'; state.pad = [...emotionById(tryEmotion.dataset.try).pad]; location.hash = 'laboratorio'; return; }
  const actionElement = e.target.closest('[data-action]'); if (!actionElement) return;
  const action = actionElement.dataset.action;
  if (action === 'guide') $('#guide-dialog').showModal();
  if (action === 'close-dialog') $('#guide-dialog').close();
  if (action === 'reset') { stopCycle(); state.pad = [0, 0, 0]; updateTarget(); toast('Controles restablecidos a neutral.'); }
  if (action === 'cycle') {
    if (state.cycling) return stopCycle();
    state.cycling = true; let i = 0;
    const next = () => { state.pad = [...EMOTIONS[i++ % EMOTIONS.length].pad]; if (state.model === 'russell') state.pad[2] = 0; updateTarget(); };
    next(); cycleTimer = setInterval(next, 3500); actionElement.innerHTML = `${icon('pause')} Pausar recorrido`;
  }
  if (action === 'fullscreen') {
    try { await $('#face-stage').requestFullscreen(); }
    catch { $('#face-stage').classList.add('simulated-fullscreen'); toast('Vista de solo rostro. Pulsa Esc para volver.'); }
  }
  if (action === 'exit-fullscreen') { if (document.fullscreenElement) await document.exitFullscreen(); $('#face-stage')?.classList.remove('simulated-fullscreen'); }
  if (action === 'screenshot') {
    const canvas = $('#face'); const a = document.createElement('a'); a.download = `rofee-${state.resolution.join('x')}.png`; a.href = canvas.toDataURL('image/png'); a.click(); toast('Imagen del rostro exportada.');
  }
  if (action === 'cancel-test') { e.preventDefault(); if (confirm('¿Cancelar esta evaluación? Las respuestas de esta sesión incompleta no se guardarán.')) { experiment = null; render(); } }
  if (action === 'resume-test') startObservationClock();
  if (action === 'new-participant') { experiment = null; renderEvaluation(); }
  if (action === 'export-csv') download('rofee-resultados.csv', exportCSV(sessions), 'text/csv;charset=utf-8');
  if (action === 'export-json') download('rofee-resultados.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), protocol: { stimuli: 6, exposureMs: 5000, padJitter: 0.06, samScale: [1, 9], reference: 'nearest PAD anchor', samInstrument: 'adaptación web ilustrada' }, sessions }, null, 2), 'application/json');
  if (action === 'export-report') { download('rofee-reporte-IEEE.tex', technicalReport(sessions), 'application/x-tex;charset=utf-8'); toast('Reporte exportado. Completa autoría, discusión y conclusiones.'); }
  if (action === 'import-json') $('#import-file').click();
  if (action === 'clear') $('#clear-dialog').showModal();
  if (action === 'close-clear') $('#clear-dialog').close();
  if (action === 'confirm-clear') { const previous = sessions; sessions = []; const saved = saveSessions(); if (saved) { if (experiment?.phase === 'complete') experiment = null; $('#clear-dialog').close(); renderResults(); toast('Resultados locales eliminados.'); } else sessions = previous; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#face-stage')?.classList.remove('simulated-fullscreen'); });
document.addEventListener('fullscreenchange', () => { $('#face-stage')?.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement)); });
window.addEventListener('hashchange', () => {
  let next = location.hash.slice(1); if (!views.includes(next)) next = 'laboratorio';
  if (view === 'evaluacion' && experiment && ['observe', 'respond'].includes(experiment.phase) && next !== 'evaluacion') {
    if (!confirm('¿Salir de la evaluación? Esta sesión incompleta no se guardará.')) { history.replaceState(null, '', '#evaluacion'); return; }
    experiment = null;
  }
  view = next; render(); window.scrollTo({ top: 0, behavior: 'instant' });
});
render();
