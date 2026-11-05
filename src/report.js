import { EMOTIONS, summarize } from './model.js';

const tex = (value) => String(value).replace(/[&%$#_{}~^\\]/g, (c) => ({ '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}', '\\': '\\textbackslash{}' })[c]);

/** Genera resultados exclusivamente a partir de sesiones completas almacenadas. */
export function technicalReport(sessions) {
  const s = summarize(sessions);
  const facs = EMOTIONS.map((e) => `${e.name} & ${tex(e.emojiColor)} & ${tex(e.brows)} & ${tex(e.eyes)} & ${tex(e.mouth)} & (${e.pad.join(', ')}) \\\\`).join('\n');
  const matrix = s.matrix.map((row, i) => `${EMOTIONS[i].name} & ${row.join(' & ')} \\\\`).join('\n');
  const sam = s.sam.map((r, i) => `${EMOTIONS[i].name} & ${r.n} & ${r.mean.map((v) => v === null ? '--' : v.toFixed(2)).join(' & ')} \\\\`).join('\n');
  const chartData = s.sam.map((r, i) => `${i + 1} ${r.mean.map((v) => v === null ? 'nan' : v.toFixed(3)).join(' ')}`).join('\n');
  return `\\documentclass[conference]{IEEEtran}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[spanish,es-noquoting]{babel}
\\usepackage{amsmath,booktabs,graphicx,url,pgfplots,pgfplotstable}
\\pgfplotsset{compat=1.18}
\\title{Rofee: interfaz facial vectorial y expresión emocional para robots de servicio}
\\author{\\IEEEauthorblockN{[Nombre del estudiante]}\\IEEEauthorblockA{Ingeniería en Robótica de Servicio\\\\ Universidad Iberoamericana}}
\\begin{document}
\\maketitle
\\begin{abstract}
Se presenta una interfaz facial 2D en HTML5 Canvas controlada por los modelos Russell y PAD. Se implementan ocho anclas emocionales, interpolación exponencial, parpadeo estocástico y una evaluación perceptual con escalas de nueve puntos inspiradas en SAM. ${s.total ? `Esta exportación contiene ${s.total} respuestas de ${s.participants} identificadores distintos de participantes.` : 'La recolección experimental está pendiente; no se presentan resultados simulados.'}
\\end{abstract}
\\section{Introducción y justificación HRI}
Las pantallas faciales permiten modificar expresiones sin actuadores mecánicos. Una representación estilizada puede comunicar estados afectivos y evitar expectativas de realismo propias de un rostro humano. El reconocimiento perceptual debe comprobarse con usuarios y no inferirse solamente de las ecuaciones.
\\section{Deconstrucción FACS}
Se seleccionaron ocho emojis de Twemoji 14.0.2 (Twitter). La Tabla~\\ref{tab:facs} representa una interpretación de diseño de unidades de acción, no una anotación validada por codificadores FACS. Los valores pertenecen a $[0,1]$. Se indica el color base del SVG de referencia; miedo incorpora además una frente azul \\texttt{\\#BDDDF4}. La paleta del robot se deriva de PAD. AU 23 representa tensión labial; AU 43, cierre ocular.
\\begin{table*}[t]
\\centering\\scriptsize
\\caption{Deconstrucción propuesta y anclas PAD.}\\label{tab:facs}
\\begingroup\\setlength{\\tabcolsep}{3pt}
\\begin{tabular}{p{0.10\\textwidth}p{0.11\\textwidth}p{0.14\\textwidth}p{0.12\\textwidth}p{0.24\\textwidth}p{0.16\\textwidth}}\\toprule
Emoción & Color base & Cejas & Ojos & Boca / nariz & $(P,A,D)$ \\\\\\midrule
${facs}
\\bottomrule\\end{tabular}\\endgroup
\\end{table*}
\\section{Mapeo paramétrico}
Las entradas se acotan a $[-1,1]^3$. En Russell se usa $P=V$ y $D=0$. En PAD la dominancia diferencia, entre otros estados, ira y miedo con igual placer y activación.
\\begin{align}
C_{boca} &= 58P,\\\\
\\theta_{ceja} &= 0.35D - 0.25P,\\\\
H_{ojo} &= 54(1+0.55A),\\\\
RGB(P) &= \\frac{1-P}{2}(207,223,239) \\\\
&\\quad+\\frac{1+P}{2}(229,237,207).
\\end{align}
La curvatura se aplica como desplazamiento del control Bézier en píxeles sobre el lienzo de referencia $800\\times480$. El ángulo es un parámetro de inclinación convertido a diferencia de altura entre extremos de la ceja, no una rotación rígida en radianes. La dominancia también cambia la escala del rostro en $1+0.035D$.
Para añadir rasgos de FACS sin discontinuidades se usa una mezcla gaussiana normalizada de las ocho anclas $\\mu_i$:
\\begin{equation}
w_i(E)=\\frac{\\exp(-\\|E-\\mu_i\\|^2/(2\\sigma^2))}{\\sum_j\\exp(-\\|E-\\mu_j\\|^2/(2\\sigma^2))},\\quad \\sigma=0.3.
\\end{equation}
Cada AU es la suma de sus intensidades de diseño ponderadas por $w_i$. Estas intensidades modulan apertura bucal, tensión y mejillas. Por ello, las ecuaciones base son parámetros intermedios; la geometría final incorpora rasgos adicionales. En particular, $H_{final}=\\max(5,H_{ojo}(1-0.5AU_6-0.55AU_{43}-0.3AU_7))$, multiplicada por el factor de parpadeo.
\\section{Dinámica y microgestos}
En cada cuadro, con $\\Delta t$ en segundos:
\\begin{equation}
E_{t+\\Delta t}=E_t+(E_{objetivo}-E_t)(1-e^{-\\lambda\\Delta t}).
\\end{equation}
El control permite $\\lambda=2,5,10$ s$^{-1}$. Un ciclo de parpadeo de 150 ms ocurre a intervalos aleatorios de 3 a 6 s. La mirada incorpora pequeños desplazamientos aleatorios suavizados. Para la evaluación, cada estímulo se presenta directamente, sin transición desde otro estado.
\\section{Método de evaluación}
Se requieren al menos cinco participantes ajenos al equipo. Cada uno recibe seis estímulos en orden aleatorio, sin etiquetas emocionales, de cinco segundos de exposición efectiva con la pestaña visible. Las anclas se seleccionan sin reemplazo y se agrega perturbación uniforme $U(-0.06,0.06)$ a cada componente, acotada al dominio. La emoción de referencia es el ancla PAD más cercana; es una intención de diseño y no una verdad psicológica objetiva.
Tras cada estímulo se registra una de ocho etiquetas percibidas y tres respuestas de 1 a 9: valencia, activación y dominancia. Se utiliza una adaptación web ilustrada de SAM, no una reproducción del instrumento estandarizado. No se muestran resultados hasta terminar los seis ensayos. Se conservan solo sesiones completas, con identificadores anónimos, en almacenamiento local. Un identificador distinto no verifica por sí mismo que la persona sea diferente o ajena al equipo.
\\section{Resultados experimentales}
${s.total ? `Se registraron ${s.total} ensayos completos correspondientes a ${s.participants} identificadores distintos. El porcentaje de coincidencia entre etiqueta esperada y percibida fue ${(s.accuracy * 100).toFixed(1)}\\%. ${s.participants < 5 ? 'La muestra aún no cumple el mínimo de cinco participantes.' : 'Debe confirmarse que estos identificadores corresponden a personas distintas y ajenas al equipo.'}` : 'Recolección pendiente. Las tablas con ceros o guiones son estructuras vacías, no resultados experimentales. Completar antes de entregar.'}
\\begin{table*}[t]
\\centering\\scriptsize
\\caption{Matriz de confusión. Filas: emoción esperada. Columnas: emoción percibida en el mismo orden.}
\\begin{tabular}{lrrrrrrrr}\\toprule
 & Alegría & Sorpresa & Ira & Tristeza & Asco & Miedo & Calma & Frustración \\\\\\midrule
${matrix}
\\bottomrule\\end{tabular}\\end{table*}
\\begin{table}[t]\\centering\\small
\\caption{Medias SAM por emoción esperada. Escala de 1 a 9.}
\\begin{tabular}{lrrrr}\\toprule
Emoción & $n$ & Valencia & Activación & Dominancia \\\\\\midrule
${sam}
\\bottomrule\\end{tabular}\\end{table}
${s.total ? `\\begin{figure*}[t]\\centering
\\begin{tikzpicture}
\\begin{axis}[width=0.92\\textwidth,height=6cm,ymin=1,ymax=9,xtick={1,2,3,4,5,6,7,8},xticklabels={Alegría,Sorpresa,Ira,Tristeza,Asco,Miedo,Calma,Frustración},x tick label style={rotate=20,anchor=east},ylabel={Media SAM},legend pos=outer north east,unbounded coords=jump,grid=major]
\\pgfplotstableread{
x P A D
${chartData}
}\\samdata
\\addplot+[mark=*] table[x=x,y=P] {\\samdata};\\addlegendentry{Valencia}
\\addplot+[mark=square*] table[x=x,y=A] {\\samdata};\\addlegendentry{Activación}
\\addplot+[mark=triangle*] table[x=x,y=D] {\\samdata};\\addlegendentry{Dominancia}
\\end{axis}\\end{tikzpicture}
\\caption{Evaluación afectiva media por emoción esperada. Los huecos corresponden a emociones sin respuestas.}\\end{figure*}` : '% La gráfica SAM se incluirá automáticamente al exportar después de recolectar datos.'}
\\section{Discusión y conclusiones}
[Completar tras la evaluación: interpretar confusiones, diferencias entre intención PAD y SAM percibido, influencia del color y limitaciones de la muestra. No afirmar eficacia sin datos.]
\\section*{Reproducibilidad}
Ejecutar \\texttt{npm ci}, \\texttt{npm run dev}. Exportar el CSV y JSON junto a este reporte. Comprobar \\texttt{npm test}, \\texttt{npm run test:e2e} y \\texttt{npm run build}. Los datos se almacenan en el navegador del dispositivo que realiza la prueba; no hay servidor de datos.
\\begin{thebibliography}{9}
\\bibitem{russell} J. A. Russell, “A circumplex model of affect,” \\emph{Journal of Personality and Social Psychology}, vol. 39, no. 6, pp. 1161--1178, 1980.
\\bibitem{pad} A. Mehrabian y J. A. Russell, \\emph{An Approach to Environmental Psychology}. MIT Press, 1974.
\\bibitem{facs} P. Ekman y W. V. Friesen, \\emph{Facial Action Coding System}. Consulting Psychologists Press, 1978.
\\bibitem{sam} M. M. Bradley y P. J. Lang, “Measuring emotion: the Self-Assessment Manikin and the Semantic Differential,” \\emph{Journal of Behavior Therapy and Experimental Psychiatry}, vol. 25, no. 1, pp. 49--59, 1994.
\\bibitem{twemoji} Twitter, Inc., “Twemoji 14.0.2,” gráficos CC BY 4.0, \\url{https://github.com/twitter/twemoji/tree/v14.0.2}.
\\end{thebibliography}
\\end{document}
`;
}
