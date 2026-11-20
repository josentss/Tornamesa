# PR #21 — Yearly Wrapped: cinco tarjetas y cinco paletas

**Estado:** En curso. El Wrapped Anual ya funciona tras PR #20, según el PNG real verificado por el propietario. Esta fase es una mejora de presentación, no una corrección de cifras.

## Criterio de diseño

El usuario compartió la tarjeta real de Tornamesa 2025 y referencias visuales de Spotify Wrapped 2024/2025. Tomamos **las ideas** de una historia por imagen, carátulas grandes, jerarquía editorial, colores alternativos y exportación individual; no copiamos sus composiciones, logos ni textos. Conservamos la identidad oscura, sobria y cian de Tornamesa.

## Cinco tarjetas

1. **Year in review:** imagen original, predeterminada.
2. **Album of the year:** carátula principal, título, artista y escuchas.
3. **Top five albums:** ranking de cinco álbumes con portadas, artista y cantidad.
4. **Top five artists:** artistas ordenados según escuchas de álbumes por artista principal de catálogo, con barras relativas y conteos; sin fotos inventadas.
5. **Year in numbers:** mes más activo, álbumes registrados por primera vez ese año, reescuchas y gráfico de los doce meses.

**Cinco colores:** Night (original), Ocean, Violet, Ember y Forest. Todas las variantes PNG 1080×1350, con un solo archivo por solicitud. Selector compacto, vista previa bajo demanda, descarga/compartición y Share link intacto.

## Fuente de datos y protección

- Mantener exclusivamente las funciones existentes top_albums (cinco primeros) y yearly_top_stats; ningún SQL nuevo.
- Aceptar solamente tipos de tarjeta y paletas de listas cerradas, con HTTP 400 antes de consultar datos. Mantener autorización de top, rate limits y Cache-Control private/no-store.
- Vista previa mediante Blob URL temporal en memoria, revocado al cambiar selección o cerrar página; sin subir ni cachear permanentemente imágenes privadas.
- Imágenes de catálogo permitidas por whitelist existente; usar portada alternativa si falla.
- No inventar minutos, canciones principales, géneros, percentiles mundiales, «edad sonora» ni rachas diarias. Los importados históricos tienen fechas técnicas.
- No tocar Supabase, RLS, búsqueda, Import logs, Monthly Top ni SEO.

## QA previo a fusionar

| Caso | Verificación esperada | Estado |
|---|---|---|
| Resumen 2025 Night | Sigue igual que PR #20: 561 listens, 226 albums, 145 artists, agosto 107 y top 5 | Pendiente |
| Cuatro historias nuevas | Render PNG real 1080×1350, cinco portadas y nombres largos sin corte | CI + visual pendiente |
| Cinco temas, incluida imagen original | Paleta legible y consistente, selección visible | Pendiente |
| Año vacío y 1–4 álbumes | Sin posiciones inventadas ni errores de Satori | CI + visual pendiente |
| Privacidad y perfil público/privado | Misma autorización que Yearly Top y 403 en terceros no permitidos | Pendiente |
| Año, tarjeta y color inválidos | HTTP 400 antes de leer datos | CI + API pendiente |
| Preview, Download, Share image | Mismo PNG para la selección, caché efímera, sin archivos obsoletos | Pendiente |
| Móvil 320/375/440/768 y escritorio | Controles discretos y sin scroll lateral | Pendiente |
| npm test y npm run build | Verdes en HEAD final | Pendiente |

## Pospuesto

Stories 1080×1920 o formato cuadrado, animaciones, canciones, género, imágenes de artistas, exportar todos los PNG de golpe y SEO. Mantener este trabajo en el roadmap, sin introducirlo por sorpresa.

## Reversión

Revertir PR #21. No hay migraciones ni cambios de registros; la imagen básica del PR #20 seguirá disponible.
