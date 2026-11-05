# Rofee
# proyecto Rofee

## Emotion Lab

Laboratorio web de comunicación no verbal para la **Práctica 7: Interfaces facial-gráficas 2D y expresión emocional vectorial para robots socialmente asistenciales**. Interfaz en español, adaptable a computadora y móvil. No requiere cuentas, claves de API ni servidor de datos.

## Ejecutar

Requisitos: Node.js **22.12 o posterior** y npm. En este entorno se comprobó con Node 24.22.1.

```bash
cd /workspace/Rofee
npm ci
npm run dev -- --port 5173
```

El servidor de desarrollo escucha en el puerto 5173. En una instalación local, abre ese puerto en tu navegador.

### Usar un GitHub Codespace existente

No necesitas crear otro Codespace. En el que pertenece a este repositorio, abre la terminal y comprueba que no tengas cambios propios pendientes antes de cambiar de rama. Para obtener esta versión:

```bash
git fetch origin
git switch codex/rofee-web
npm ci
npm run dev
```

En la pestaña **Ports / Puertos**, abre el puerto **5173** con **Open in Browser**. `vite.config.js` permite los dominios de los puertos 5173 y 4173 de la instancia identificada por `CODESPACE_NAME`; no desactiva globalmente la validación de hosts. Los Codespaces son entornos de GitHub independientes de la máquina de este chat.

Para generar una versión estática:

```bash
npm run build
npm run preview
```

`dist/` contiene los archivos para un hosting estático. Publicarlos en un servicio externo es un paso separado. Fuentes DM Sans y emojis están incluidos localmente: la aplicación compilada no necesita servicios externos para funcionar. No se utiliza IA ni reconocimiento de las emociones de la persona: se **representa** una emoción del robot.

### Sitio público con GitHub Pages

El workflow `.github/workflows/deploy.yml` instala las dependencias del lockfile, comprueba el modelo, compila y publica `dist/` cuando cambia `main`. También se puede iniciar desde **Actions → Publicar Rofee en GitHub Pages → Run workflow**.

La primera vez, el repositorio debe tener **Settings → Pages → Build and deployment → Source → GitHub Actions** seleccionado. Esta es una configuración de GitHub y no de Codespaces. Si la ejecución muestra que Pages no está habilitado, activa esa opción y vuelve a ejecutar el workflow.

La dirección prevista para este repositorio es **https://huevote1025.github.io/Rofee/**. La publicación está confirmada cuando el trabajo `deploy` termina correctamente y el sitio responde. El Codespace puede estar apagado.

En GitHub Actions se usa la base `/Rofee/`; durante el desarrollo local y en Codespaces se conserva `/`. Las imágenes de emociones y el favicon usan la misma base para que no fallen al publicar en una subcarpeta. No hace falta un dominio personalizado ni un archivo `CNAME` para usar la dirección de GitHub Pages.

## Las cuatro secciones

1. **Laboratorio:** rostro vectorial dibujado en HTML5 Canvas, ocho presets, controles continuos PAD, plano Russell interactivo, animaciones naturales, velocidad de transición, pantalla completa y exportación PNG. El restablecimiento lleva a neutralidad estricta `(0, 0, 0)`; el preset Calma es un estado agradable de baja activación.
2. **Modelo FACS:** deconstrucción de ocho emojis de Twitter/Twemoji 14.0.2; intensidades propuestas de cejas, ojos, boca/nariz, colores de referencia y del robot, y coordenadas PAD. Las intensidades son decisiones de diseño, no anotaciones validadas por especialistas FACS.
3. **Evaluación:** seis estímulos aleatorios por participante, cinco segundos cada uno, sin etiquetas ni controles; elección de una emoción y tres escalas ilustradas de nueve puntos inspiradas en SAM. La prueba pausa si se oculta la pestaña y permite continuar el tiempo restante. No se guardan sesiones incompletas.
4. **Resultados:** matriz de confusión de conteos, porcentaje de reconocimiento, medias SAM por emoción, sesiones completas y exportaciones CSV, JSON y reporte IEEE/LaTeX. Inicialmente no hay datos ni resultados simulados.

### Demostración en vivo

- Mueve P, A y D para cambiar el rostro. La lectura inferior muestra el vector interpolado; los sliders muestran el objetivo.
- Compara **Ira** y **Miedo**: comparten P = −0.6 y A = +0.8, pero D cambia de +0.8 a −0.8.
- En **Russell 2D**, P equivale a valencia y D se fija a cero; los presets se proyectan en ese plano. Para observar la expresión PAD completa, vuelve a **Modelo PAD 3D** y elige el preset.
- Haz clic, arrastra o usa las flechas en el mapa para cambiar valencia y activación.
- «Recorrer emociones» cambia el objetivo cada 3.5 segundos. Editar un control interrumpe el recorrido.
- Selecciona **800 × 480** o **1024 × 600** y usa pantalla completa para proyectar el rostro sin los controles. Esc permite salir. Si el navegador impide fullscreen, se usa una vista de solo rostro dentro de la página.
- «Guardar imagen» descarga el lienzo actual con la resolución seleccionada, sin los controles.
- El interruptor desactiva parpadeos y micromovimientos. Se inicia apagado si el sistema solicita movimiento reducido.

## Modelo matemático

Todas las dimensiones están acotadas a `[−1, +1]`. Sobre el lienzo canónico de 800 × 480:

| Parámetro base | Ecuación |
| --- | --- |
| Control de curvatura Bézier de la boca | `C = 58P` |
| Inclinación de cejas | `θ = 0.35D − 0.25P` |
| Apertura vertical ocular base | `H = 54(1 + 0.55A)` |
| Fondo RGB | `((1−P)/2)·(207,223,239) + ((1+P)/2)·(229,237,207)` |
| Transición por cuadro | `E ← E + (Eobjetivo−E)·(1−exp(−λΔt))` |

`Δt` se mide en segundos. λ vale 2, 5 o 10 s⁻¹ (Pausada, Suave, Ágil). La transición usa tiempo real, no una cantidad fija por cuadro; se limita Δt a 0.1 s al volver de una pausa para evitar saltos.

Las expresiones incorporan rasgos FACS adicionales mediante una **mezcla gaussiana continua**, con σ = 0.3:

```text
wᵢ = exp(−||E−μᵢ||² / (2σ²)) / Σⱼ exp(−||E−μⱼ||² / (2σ²))
AUₖ(E) = Σᵢ wᵢ · AUₖ(μᵢ)
```

Las anclas μ están en `src/model.js`. Las AU mezcladas modulan apertura de boca, tensión labial, nariz y mejillas. Por ello las ecuaciones base no son la geometría final completa: `Hfinal = max(5, H·(1−0.5AU6−0.55AU43−0.3AU7))`, antes del parpadeo. Para cejas, la diferencia de altura entre extremos es `60θ−15AU1+5AU4`, con signo reflejado entre lados; θ es un parámetro de inclinación, no una rotación rígida en radianes. D también modifica la escala del rostro en `1+0.035D`. Los desplazamientos de controles Bézier definen la curvatura, no la curvatura diferencial de la curva.

El ciclo de parpadeo dura 150 ms, con intervalos estocásticos de 3–6 s entre ciclos; el desplazamiento de las pupilas oscuras incorpora microsacadas suavizadas. El rostro es estilizado: no reproduce anatomía muscular ni implementa todas las AU existentes.

## Recolección de datos de la práctica

1. Invita a **al menos cinco personas distintas y ajenas al equipo**. Usa un identificador anónimo único para cada una, por ejemplo P01 a P05. La página impide repetir identificadores, pero no puede verificar la identidad ni la independencia de una persona.
2. Abre Evaluación. Cada sesión elige seis anclas distintas sin reemplazo, en orden aleatorio. Se agrega ruido uniforme `U(−0.06, +0.06)` a cada dimensión PAD. La etiqueta esperada es el ancla euclidiana más cercana: representa intención de diseño, no una verdad psicológica universal.
3. Cada expresión se presenta directamente, sin transición de otro estado, durante cinco segundos con la pestaña visible. Luego se retira y aparecen las preguntas. Las respuestas no tienen límite de tiempo. No muestres a los siguientes participantes las etiquetas o resultados de quienes terminaron.
4. Registra emoción percibida, valencia, activación y dominancia (1–9). Los pictogramas son una **adaptación web ilustrada de SAM**, no una reproducción del instrumento estandarizado. Describe esta adaptación en tu reporte y confirma con tu docente si exige el instrumento original.
5. Al terminar los seis ensayos, la sesión se agrega al almacenamiento local. En Resultados, las filas de la matriz son emociones esperadas y las columnas percibidas. Las gráficas agrupan SAM por emoción esperada; `n` señala cuántas respuestas forman cada media. Un guion significa que aún no hay observaciones para esa emoción.
6. Exporta CSV y JSON como respaldo. Para juntar dispositivos, usa identificadores diferentes e **Importar JSON**. Se validan rangos, integridad, duración, participantes repetidos y sesiones duplicadas. Una sesión ya importada no se vuelve a agregar.

Los datos permanecen en `localStorage` del mismo navegador y origen (host/puerto). Cambiar de navegador, puerto o dispositivo no los transfiere; borrar datos del sitio los elimina. No hay sincronización remota. El CSV contiene una fila por ensayo: participante, sesión, fecha ISO, vector PAD, emoción esperada/percibida, tres SAM y duración observada. Se almacenan solo identificadores anónimos, sin nombres.

### Reporte técnico

Desde Resultados, **Reporte IEEE / LaTeX** genera un `.tex` con introducción, justificación HRI, tabla FACS, ecuaciones, protocolo, bibliografía y resultados disponibles. Cuando hay respuestas incluye la matriz y una gráfica SAM en PGFPlots. Sin datos genera una plantilla explícitamente pendiente, no resultados inventados.

También se incluye la plantilla inicial en `docs/reporte-IEEE.tex`. En Overleaf selecciona pdfLaTeX o compila con una instalación TeX Live que incluya `IEEEtran`, español de Babel, Booktabs y PGFPlots/PGFPlotstable. Ejecuta pdfLaTeX dos veces para resolver referencias. Completa autoría, discusión, limitaciones y conclusiones después de recolectar datos reales. El reporte no sustituye esa parte del trabajo.

## Comprobar

```bash
npm test
npm run test:e2e
npm run build
```

- Las pruebas de Node comprueban el dominio PAD, la diferencia ira/miedo, la independencia de FPS, el protocolo aleatorio, matriz/SAM, almacenamiento y exportación IEEE/CSV.
- Playwright usa Chromium instalado en `/usr/bin/chromium` si existe. En otra computadora: `npx playwright install chromium`, o define `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con la ruta del navegador. El runner inicia su propio servidor en el puerto 4173.
- Las pruebas de navegador usan contextos aislados: sus respuestas automatizadas **no se incorporan a los resultados reales**. Verifican interacción, resolución y PNG, fullscreen, navegación, seis exposiciones de cinco segundos, pausa por visibilidad, persistencia, duplicados, exportaciones, eliminación confirmada y vista móvil.

## Estructura

```text
src/
  main.js       Interfaz, controles, evaluación y resultados
  face.js       Dibujo vectorial y animación
  model.js      PAD, FACS, interpolación, métricas y protocolo
  report.js     Generador IEEE/LaTeX con resultados locales
  icons.js      Iconos vectoriales propios
  style.css     Diseño adaptable
public/
  emojis/       Ocho SVG de Twemoji 14.0.2
docs/
  reporte-IEEE.tex
tests/
  model.test.js
  browser/app.spec.js
```

## Créditos y referencias

Emojis: **Twemoji 14.0.2**, © Twitter, Inc. y colaboradores. Gráficos bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), sin modificaciones a los SVG originales. Fuente: [twitter/twemoji, etiqueta v14.0.2](https://github.com/twitter/twemoji/tree/v14.0.2). Tipografía **DM Sans**, SIL Open Font License, incluida mediante `@fontsource-variable/dm-sans`.

- J. A. Russell, “A circumplex model of affect,” *Journal of Personality and Social Psychology*, 39(6), 1161–1178, 1980.
- A. Mehrabian y J. A. Russell, *An Approach to Environmental Psychology*, MIT Press, 1974.
- P. Ekman y W. V. Friesen, *Facial Action Coding System*, 1978.
- M. M. Bradley y P. J. Lang, “Measuring emotion: the Self-Assessment Manikin and the Semantic Differential,” *Journal of Behavior Therapy and Experimental Psychiatry*, 25(1), 49–59, 1994.
