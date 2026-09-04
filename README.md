# Certificación en Claude Code — Landing page

Landing page cinematográfica para el programa **Certificación en Claude Code · 4 meses** de AI LAB.

Sitio estático sin dependencias: `index.html`, `css/styles.css`, `js/main.js` y los medios en `assets/`.

## Ejecutar en local

```bash
npx http-server -p 8080 -c-1 .
# abre http://127.0.0.1:8080
```

Cualquier servidor estático funciona. Se necesita un servidor (no `file://`) para que el navegador cargue la secuencia de frames del hero y los videos.

## Estructura

| Sección | Implementación |
|---|---|
| Hero | Secuencia de 121 frames WebP (15 fps) dibujada en `<canvas>` y controlada por el scroll. El entorno de desarrollo se construye mientras el visitante hace scroll. |
| Logo strip | Marquee con el ecosistema tecnológico del programa. |
| El poder de Claude Code | Clip 2 fijado (sticky) con tres paneles: Desarrolla · Automatiza · Certifícate. |
| Métricas | Contadores animados al entrar en pantalla. |
| Programa | Timeline de 4 meses con línea de progreso ligada al scroll. |
| Transformación | Recorrido en tres etapas sobre fondo oscuro. |
| Beneficios | Ocho tarjetas glassmorphism con spotlight al pasar el cursor. |
| Testimonios | Cuatro tarjetas con retratos, nombre, rol e historia. |
| Inversión | Tarjeta de precio ($8,000 MXN) y propuesta de valor. |
| FAQ | Acordeón accesible (un solo elemento abierto, navegación con teclado). |
| CTA final | Clip 3 de fondo y botón principal. |

Todos los botones "Quiero certificarme" abren un modal con formulario de solicitud (validación y estado de éxito). El envío está simulado en `js/main.js`; conecta ahí tu CRM o endpoint.

## Medios generados

Los tres clips se generaron con Seedance 2.0 (Higgsfield, modo std, 1080p, 16:9, 8 s, sin audio) y los retratos con Recraft V4.1. Las URLs de origen están en `assets/sources.json`.

El workflow `.github/workflows/fetch-assets.yml` descarga esos orígenes y produce los archivos web (frames del hero, MP4 optimizados, pósters y avatares) en `assets/`. Se ejecuta al hacer push de `assets/sources.json` o manualmente desde la pestaña Actions. Para reprocesar con nuevos clips basta con actualizar `assets/sources.json`.

## Propuesta de valor (PDF)

`docs/Propuesta-de-Valor-Certificacion-Claude-Code.pdf` — documento de 8 páginas en A4 con la propuesta de valor del programa, con el mismo sistema visual del landing (fotogramas de los clips, paleta violeta, tipografías Sora / Manrope / JetBrains Mono incrustadas).

Para regenerarlo después de editar `docs/propuesta-de-valor.html`:

```bash
node docs/render-pdf.mjs
```

## AI LAB ENTERPRISE — landing page (`enterprise/`)

Landing cinematográfica independiente para la categoría **AI Powered Enterprise** (`enterprise/index.html`, `enterprise/css/styles.css`, `enterprise/js/main.js`). Sin dependencias.

```bash
npm run start:enterprise      # http://127.0.0.1:8081
npm run verify:enterprise     # 46 checks de Playwright (hero scrub, agentes, orquestador, timeline, CTAs, responsive, performance)
```

| Sección | Implementación |
|---|---|
| Hero | Clip 01 como secuencia de 97 frames WebP (12 fps) en `<canvas>` + red SVG de agentes que se ensambla con el scroll: FINANCE → SUPPORT → MARKET INTELLIGENCE → CONTENT → SALES → OPERATIONS → enlaces → capa de orquestación → workflows → HUD final. |
| As featured in | Marquee monocromo: Forbes · Entrepreneur · Shark Tank · Expansión · Yahoo News. |
| Category | Diagrama ONE BRAIN → ZERO FRICTION → A COORDINATED WORKFORCE. |
| Layer 01–04 | Grafo de conocimiento, mapa de integraciones, ejecución de agentes (sección fijada, activación secuencial + bus de comunicación + workflow compartido) y orquestador multi‑agente con Clip 02 de fondo. |
| How it works | Timeline horizontal ligado al scroll (DIAGNOSE → ARCHITECT → DEPLOY → SCALE). |
| Success stories | Tarjetas Before → Built → Result con **placeholders**; sustituir únicamente con cifras verificadas. |
| Final CTA | Clip 03 de fondo, HUD de control y modal de diagnóstico (envío simulado en `js/main.js`). |

Los tres clips (Seedance 2.0 · std · 1080p · 16:9 · 8 s · sin audio) están referenciados en `enterprise/assets/sources.json`; el workflow `.github/workflows/fetch-enterprise-assets.yml` los descarga y genera frames, MP4/WebM y pósters en `enterprise/assets/`.

## AI LAB — Claude Developer Certification Program (`claude-dev/`)

Landing cinematográfica independiente, **100 % en español**, para el programa de certificación de 4 meses **Claude Developer Certification Program** (`claude-dev/index.html`, `claude-dev/css/styles.css`, `claude-dev/js/main.js`). Sin dependencias. Concepto visual: *agentes de IA trabajando juntos* — un agente → una red de agentes especializados → comunicación → colaboración → sistema multiagente → el humano orquesta → AI Developer.

```bash
npm run start:claude-dev      # http://127.0.0.1:8082
npm run verify:claude-dev     # comprobaciones de Playwright (hero scrub, red interactiva, timeline, galería, certificación, FAQ, formulario, responsive, rendimiento)
npm run build:claude-dev      # HTML autocontenido en claude-dev/dist/
```

| Sección | Implementación |
|---|---|
| Hero | Clip 01 como secuencia de 96 frames WebP (12 fps) en `<canvas>` controlada por el scroll + red SVG de agentes que se ensambla: 0–20 % un agente · 20–40 % agentes especializados · 40–60 % comunicación · 60–80 % colaboración y delegación · 80–100 % tarea completada. Partículas reactivas al cursor. Título CONSTRUYE CON IA. → NO SOLO UN AGENTE. UN EQUIPO DE AGENTES. |
| La nueva fuerza de trabajo | Sección oscuro→claro con red interactiva de 6 agentes (hover/foco/tap revela descripción) y paquetes de datos animados. |
| Transformación | Progresión fijada de 6 etapas (APRENDE → CONÉCTATE) activada por scroll. |
| Programa | Misión de 4 meses en línea de tiempo horizontal ligada al scroll (vertical en móvil). |
| Proyectos | Galería horizontal (arrastre, flechas, teclado, swipe) + capstone con Clip 03 de fondo. |
| Certificación | Tarjeta premium con tilt 3D, brillo y Clip 04; distinción explícita Anthropic (emite) / AI LAB (prepara). |
| Acompañamiento | Clip 02 de fondo + red SVG Instructor · Mentoría · Comunidad · Preparación · Práctica → CERTIFICACIÓN. |
| Perfil AI Developer | Interfaz de perfil que se ensambla por componentes verificados. |
| Talent Launchpad | Diagrama perfiles ↔ AI Talent Network ↔ entornos empresariales + 9 tarjetas. Sin promesas de colocación. |
| Testimoniales | 4 tarjetas **placeholder** claramente marcadas (`data-placeholder="true"`); sustituir con testimonios reales autorizados. |
| Métricas | Solo cifras sustentables: 4 meses · 5+ proyectos · 1 portafolio · 1 examen oficial · soporte hasta aprobar. |
| Inversión | $8,000 MXN, examen oficial incluido, 14 puntos, sin escasez ficticia ni cuentas regresivas. |
| FAQ | Acordeón accesible de 15 preguntas (uno abierto a la vez, teclado). |
| CTA final | Clip 05 de fondo y copy en dos tiempos: NO SOLO USARÁ IA. → LA CONSTRUIRÁ. |

Todos los CTAs abren el modal de solicitud (validación, estado de éxito, foco atrapado). El envío está simulado; para conectarlo a un CRM basta con poner la URL en `data-endpoint` del `<form id="applyForm">` (se envía JSON por POST).

Los cinco clips (Seedance 2.0 · std · 1080p · 16:9 · 8 s · sin audio · sin texto) están referenciados en `claude-dev/assets/sources.json`; el workflow `.github/workflows/fetch-claude-dev-assets.yml` los descarga y genera frames, MP4/WebM y pósters en `claude-dev/assets/`.
