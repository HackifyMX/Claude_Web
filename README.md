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
