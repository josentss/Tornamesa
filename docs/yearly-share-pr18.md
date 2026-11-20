# PR #18 — Yearly Wrapped Image (v1)

**Estado:** En curso, rama `feat/yearly-wrapped-image-pr18` · **Dependencia:** PR [#17](https://github.com/josentss/Tornamesa/pull/17) fusionado y validado.

## Objetivo y experiencia

El Yearly Top ya ofrece una página fiable. Incorporar **una sola tarjeta PNG 1080 × 1350**, preparada para compartir y descargar, sin parecer una copia de Spotify Wrapped. Mantener la misma paleta `#0a0f16`, `#131e2c`, `#2a3645` y `#7cc7e8`. Portada #1 protagonista; no adornos, banners, iconos excesivos ni animaciones.

En la página mantener `Share link` y agregar un bloque discreto bajo el resumen con `Share image` y `Download PNG`. Web Share API con archivos cuando exista; descarga como fallback. Mostrar errores accesibles y estados de trabajo. Al cambiar de año, descartar mensajes viejos; no disparar solicitudes mientras otra sigue activa.

## Contenido de la imagen

- Marca Tornamesa y nombre `@username`; año.
- Escuchas totales; álbumes únicos y artistas únicos.
- Portada/título/artista del #1; top 5 con cantidad de escuchas.
- Artista principal más escuchado y mes con mayor actividad y su cantidad.
- Año vacío: imagen discreta sin inventar datos. Pocos álbumes: nunca inventar puestos.
- Las etiquetas serán en inglés como la UI actual; la futura i18n va separada.

**Formato:** PNG 1080×1350 v1. Story y cuadrado pospuestos. No incluir minutos, rachas reales, duración hipotética ni reseñas. Las cifras deben provenir de la misma lógica actual de Top Anual; sin calcular nada a partir de los listados truncados.

## Arquitectura y límites

- Reutilizar `next/og` presente en `/api/og/wrapped` (Monthly Wrapped), pero crear `/api/og/yearly` independiente. No alterar la imagen mensual actual.
- El endpoint anual debe validar `username` y `year`, resolver propietario y aplicar **`getRequestUser` + `canViewWithFollows(..., 'top')` antes de invocar RPC**. El ID del propietario nunca viene directamente del cliente.
- Usar `top_albums` (mismos meses y sort `listens`), `yearly_top_stats` y `albums` para la portada/título. No generar estadísticas con un segundo algoritmo; el límite de cinco posiciones no modifica el top 50 de la página.
- `Cache-Control: private, no-store` tanto en éxito como errores; limitar solicitudes; no incluir imágenes privadas en caché pública. Prohibir fetch de carátulas a hosts arbitrarios (SSRF); tamaño máximo, timeout, respuesta de imagen validada y fallback si falla.
- Desde el navegador enviar bearer opcional como en la API del Yearly Top. `Share link` permanece sin cambios. `Share image` usa `navigator.canShare({files})`; si no está disponible, descargar.
- **Sin migraciones, sin dependencias, sin cambios en RLS, Monthly Top, Import logs, Spotify Search o modelos de datos.**

## Pruebas de aceptación (pendiente de Preview)

| Caso | Esperado | Estado |
|---|---|---|
| Cuenta principal, 2025 | Imagen con 561 escuchas y 226 álbumes únicos, mismos top 5 y primer artista que la página | Pendiente |
| 2026 y año sin actividad | Se permite año con datos; año vacío no inventa métricas ni discos | Pendiente |
| 0, 1–4 y ≥5 álbumes | Sin posiciones inventadas, sin overflow de texto/cover | Pendiente |
| Carátula válida/ausente/fallida | Si falla imagen, placeholder limpio y sin error 500 por portada | Pendiente |
| Nombre o artista muy largo | Corte visual y tipografía legible en 1080×1350 | Pendiente |
| Privacidad | Propietario permitido; público anónimo permitido; privado no mutuo 403; mutuo si diario público permitido; tercero con diario privado 403 | Pendiente |
| Year inválido | Año no numérico/fuera de 1900–2100 devuelve HTTP 400 sin acceder a datos | Pendiente |
| Límite de peticiones | Ráfagas responden 429; nunca se calcula un resumen privado para no autorizados | Pendiente |
| Descarga y compartir | Archivo `.png`; Web Share en móvil; fallback a descarga sin Web Share; `Share link` anterior conserva comportamiento | Pendiente |
| Responsive | Cabecera y bloque de exportación cómodos en 320/375/440/768px y escritorio | Pendiente |
| Tests y CI | `npm test` y `npm run build` verdes sobre el último commit; navegador Preview comprobado | Pendiente |

## Fuera de alcance

Variantes 1080×1920 / cuadradas; exportación de estadísticas privadas sin autenticación; nuevas métricas; SEO, búsqueda, Import logs, catálogo externo, Top Personalizado. Mantener la hoja de ruta actualizada en cada PR.

## Reversión

Revertir PR #18; no hay datos, esquemas ni SQL que restaurar.
