# Tornamesa — hoja de ruta viva

**Actualizado:** 2026-11-19 · **Estado del proyecto:** Fase 2B (Tops) · **Fuente de verdad de ejecución:** GitHub `main` + Supabase desplegado y verificado.

Esta guía se mantiene en el repositorio, se revisa en **cada PR** y reemplaza las listas de tareas informales. Los PDF «Tornamesa: prompt de desarrollo» y «Tornamesa: guía de mejoras y nuevas funcionalidades» (15-11-2026) conservan el contexto histórico; cuando una decisión posterior y validada difiere de los PDF, se documenta aquí. El código y las migraciones realmente aplicadas prevalecen sobre suposiciones.

## Convenciones para mantenerla

1. Antes de comenzar un PR: elegir **una tarea delimitada**, revisar archivos reales y dependencias, indicar pruebas y si necesita SQL manual. No modificar producción ni Supabase desde herramientas automáticas.
2. Al abrir el PR: cambiar su tarea a **En curso**, añadir vínculo de PR y criterios verificables; dejar constancia de riesgos y trabajo expresamente fuera de alcance.
3. Al fusionarlo y verificarlo: marcar **Hecho**, fechar y enlazar PR/validación. Si surge otra idea, añadirla al backlog con prioridad, fundamento y dependencia; **no** introducir cambios no previstos.
4. Si una propuesta queda descartada, moverla a **Descartado/pospuesto** explicando por qué; no borrarla sin dejar rastro. No declarar una prueba como superada si solo fue prevista.
5. En cada PR comprobar: privacidad/autorización, móvil, escritorio, estados vacíos y errores, accesibilidad, rendimiento, compatibilidad con datos históricos. Mantener diseño sobrio y la paleta existente.
6. Migraciones, si fueran necesarias: un archivo nuevo bajo `supabase/migrations/`, respaldo previo, rollback documentado, consultas de solo lectura y ejecución manual por el propietario.

**Estados:** Hecho = implementado y fusionado; Verificar = requiere comprobación reproducible; En curso = PR abierto; Pendiente = tarea aceptada sin iniciar; Idea = no aprobada ni diseñada; Pospuesto = fuera del alcance actual.

## Historial verificado (PR fusionados en main)

| Área | PR | Estado / alcance |
|---|---|---|
| Privacidad y preferencias | [#1–#6](https://github.com/josentss/Tornamesa/pulls?q=is%3Apr+is%3Amerged+privacy) | **Hecho**: controles de visibilidad, seguimiento mutuo y UX de preferencias. |
| Monthly Top / Wrapped | [#7](https://github.com/josentss/Tornamesa/pull/7) | **Hecho**: rebuild atómico y resúmenes dirty-on-write según fechas locales. |
| Diario y reseñas | [#8](https://github.com/josentss/Tornamesa/pull/8), [#9](https://github.com/josentss/Tornamesa/pull/9) | **Hecho**: valoración global por álbum en `reviews.rating`. |
| Import logs y cuota Spotify | [#10](https://github.com/josentss/Tornamesa/pull/10) | **Hecho**: Preview local primero; límite remoto; Commit atómico e idempotente por línea en archivos nuevos. |
| Search | [#11](https://github.com/josentss/Tornamesa/pull/11), [#12](https://github.com/josentss/Tornamesa/pull/12) | **Hecho**: frescura automática de Spotify con caché coordinada; UI minimalista. |
| Líneas inválidas de Import | [#13](https://github.com/josentss/Tornamesa/pull/13), [#14](https://github.com/josentss/Tornamesa/pull/14) | **Hecho**: descartes visibles y discretos; validación de fuente en Commit. |
| Motor anual y personalizado | [#15](https://github.com/josentss/Tornamesa/pull/15) | **Hecho**: `top_albums` read-only, rangos de meses sin duplicados ni cap de 1000 filas. |
| Primer Yearly Top | [#16](https://github.com/josentss/Tornamesa/pull/16) | **Hecho**: API con autorización, estadística anual, página y enlaces. |

**Datos históricos, tarea operativa (fuera de PR):** se corrigieron por SQL con respaldo las asignaciones de Epistolares, Charlie Parker, Madlib y King Crimson; se excluyó voluntariamente el registro de vídeo «The King of Limbs (FTB)». Última cifra **esperada**: 561 escuchas / 226 álbumes únicos para 2025. **Verificar** contra SQL actual y API del Top Anual antes de dar por finalizadas todas las pruebas. No reimportar los .txt de 2025: el ledger del PR #10 no registró imports anteriores.

## Prioridad inmediata — Fase 2B

| Orden | Tarea | Estado | Cierre / comprobación |
|---|---|---|---|
| 1 | **Yearly Top — ajuste discreto de móvil, accesibilidad y ranking** ([PR #17](https://github.com/josentss/Tornamesa/pulls)) | **En curso** | 12 meses distinguibles; lector de pantalla con totales; controles por teclado; ranking limitado a 50 explicado; PR sin alteraciones de SQL ni privacidad; revisar Preview. |
| 2 | **QA de Yearly Top con datos corregidos** | **Verificar** | Cuenta principal 2025 = **561 / 226**; agosto 107, septiembre 68; 12 meses suman 561; perfiles privados y diario OFF no filtran datos; 2026 y años vacíos intactos. |
| 3 | **Imagen anual compartible** | **Pendiente** | Confirmar uso real de `/api/og/wrapped`; respetar visibilidad, permisos, año, móvil y exportación; generar usando las cifras del mismo motor, sin divergencias ni caché pública de datos privados. |
| 4 | **Top Personalizado v1** | **Pendiente** | API/UI con `top_albums`: meses no consecutivos hasta 24, atajos, mínimo y orden por escuchas/rating/reescuchas, filtros en URL; mismo resultado que el anual al seleccionar 12 meses equivalentes. |
| 5 | **Guardar selección del Top como lista** | **Pendiente** | Definir UX y permisos, no asumir escritura silenciosa ni duplicar elementos. |

**No perseguir métricas falsas:** no derivar minutos de reproducción ni rachas diarias exactas de importaciones históricas con fechas artificiales. El ranking de artistas usa `albums.artist` (artista principal) y no representa todas las colaboraciones.

## Integridad, Import logs y catálogo — backlog acotado

| Prioridad | Trabajo | Estado / aceptación |
|---|---|---|
| Alta | Evitar `matched` automático con artista incompatible aunque coincida el título | **Pendiente**: pruebas de regresión con King Crimson/The Doraemons, Madlib/Kado, Charlie Parker/Anna Niva; preservar colaboraciones y alias legítimos. |
| Alta | Deduplicación de búsqueda por identidad de lanzamiento | **Pendiente**: conservar dos Spotify IDs diferentes si son ediciones distintas, incluidos `epistolares` y `epistolares+`; sin romper cuotas/frescura/orden. |
| Media | Parsing de artistas múltiples y títulos con comas | **Pendiente**: `Braille` (Méne, Nsqk) y casos de colaboradores, sin inferir un artista equivocado. |
| Media | Ediciones y partes de reediciones | **Pendiente**: distinguir deluxe verdaderos de remasters del álbum original; caso `Inspiration Information` (disco 1) versus `Wings Of Love` (disco 2); no cambiar escuchas válidas automáticamente. |
| Futura | Catálogo externo a Spotify | **Idea de diseño**: identidad interna estable, fuentes opcionales, tracklist, portada, duración, procedencia; revisar derechos/licencias y modelos de acceso antes de almacenar metadatos. |

**Regla para cambios de catálogo:** ninguna reasignación masiva automática. Separar búsquedas (descubrimiento) de Import (identificación conservadora), mantener selección humana para ambiguos y conservar respaldos. **No** volver a importar archivos históricos con el ledger nuevo.

## SEO — fase de descubrimiento y crecimiento (no dentro del PR #17)

**Hallazgo inicial del repositorio:** `src/app/layout.js` ya define metadatos globales, Open Graph y Twitter; `src/app/album/[id]/page.js` es una página de cliente. No se localizaron `src/app/sitemap.js` ni `src/app/robots.js` en el snapshot revisado. Esto requiere un **diagnóstico completo**, no empezar por agregar keywords sin estrategia.

| Etapa | Estado | Alcance y criterio de aceptación |
|---|---|---|
| SEO-0: inventario técnico y privacidad | **Pendiente** | Inventariar rutas indexables, respuestas HTML sin JS, metadatos actuales, status 200/404, canonical y reglas de exclusión; revisar robots.txt y sitemap existentes en producción antes de crear nuevos. Nunca indexar diarios o tops privados, endpoints ni URLs con datos sensibles. |
| SEO-1: álbumes públicos | **Pendiente** | Diseñar `generateMetadata` del álbum usando datos públicos de servidor, título/artista, descripción útil, canonical y OG por álbum, sin duplicar llamadas a Spotify ni filtrar reviews privadas; medir respuesta HTML renderizada. |
| SEO-2: sitemap y canonical | **Pendiente** | Sitemap solo para rutas públicas útiles y canónicas; robots coherente con privacidad, búsqueda interna y páginas dinámicas; comprobar Search Console y cobertura real. |
| SEO-3: rendimiento e indexación | **Pendiente** | Baseline Lighthouse / Core Web Vitals, revisar fuentes de latencia y LCP/CLS; validar OG compartido, datos estructurados de `MusicAlbum` solo si campos reales son completos y visibles. |
| SEO-4: contenidos e internacionalización | **Idea** | Alinear títulos/descripciones y lenguajes con la futura traducción en/es; no insertar hreflang sin versiones reales. |

No prometer posiciones de Google ni cifras de tráfico sin medición. El objetivo inicial es **indexación correcta, metadatos verificables y respeto de la privacidad**.

## Otras fases posteriores (según guía y decisiones actuales)

- **Fase 1 residual — verificar**: revisión separada de integridad del esquema, pipeline CI/lint, i18n, dependencias y rutas; no reabrir privacidad sin un fallo reproducido. La decisión vigente de acceso mutuo prevalece sobre los PDF de noviembre.
- **Fase 3 — pendiente**: comentarios en reseñas con autorización del propietario/terceros, RLS, moderación y tasa; diseñar antes de migrar.
- **Fase 4 — ideas**: traducción es/en, notificaciones, reacciones, metas, PWA y calendario de actividad (sin métricas engañosas). Priorizar con datos de uso.

## Decisiones vivas (registro breve)

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-11-16 | Privacidad con acceso por **seguimiento mutuo verificado** y `diary_public` independiente | PR #5/#6 cambian la regla del prompt original. |
| 2026-11-17 | Una **reseña canónica** por usuario y álbum, sin promedio de notas de listens | PR #9; evita valoraciones contradictorias. |
| 2026-11-17 | Import offline por defecto; búsqueda Spotify limitada y ledger para **nuevos** archivos | PR #10; protege cuota e integridad. |
| 2026-11-18 | Año y meses agregados por SQL, sin cache anual persistente prematura | PR #15/#16; medir antes de introducir tablas de resumen. |
| 2026-11-19 | Historial 2025 corregido con migraciones manuales y reversibles | Integridad de esc. históricas; conservar backups. |
| 2026-11-19 | Priorizar cierre de Yearly Top y documento mantenible; SEO después | Evitar PR mezclados, regresiones y trabajo sin plan. |

## Plantilla de actualización por PR

Copiar este bloque al plan o descripción de cada PR y actualizar esta guía **en el mismo PR** cuando cambie una prioridad o decisión.

```md
### PR # — área / objetivo
- Estado: Pendiente | En curso | Verificar | Hecho
- Problema reproducido / petición:
- Alcance y archivos:
- Fuera de alcance:
- Datos, privacidad y permisos que deben permanecer:
- SQL manual / respaldo / reversión: ninguno o detallar
- Pruebas automatizadas: comandos y resultados reales
- QA Preview: escenarios móvil/escritorio/errores/privacidad
- Riesgos y rollback de código:
- Cierre: fecha, enlace PR, resultado de QA
- Ideas nuevas para backlog (sin implementarlas de improviso):
```

**Regla de cierre:** no fusionar solo porque Vercel compila. Verificar las pruebas relevantes, la apariencia en Preview y, cuando corresponda, los resultados SQL por el propietario.
