# PR #16 · Yearly Top (Fase 2B)

## Objetivo y límites

Primera experiencia de resumen anual de Tornamesa, conservando la paleta
\`#0a0f16\`, \`#131e2c\`, \`#2a3645\` y \`#7cc7e8\` existente. Diseño sin
banners grandes ni iconos repetidos, usable en móviles y ordenadores.

### Qué se entrega

- Ruta \`/[username]/yearly-top?year=2026\`: portada anual sobria,
  escuchas totales, álbumes y artistas únicos, álbumes registrados por
  primera vez durante el año, reescuchas y gráfico de doce meses.
- Ranking de hasta 50 álbumes (10 visibles inicialmente), top 5 artistas
  principales, cinco álbumes mejor puntuados según \`reviews.rating\`.
- Selector de años con actividad y enlace para compartir; no se publica
  información privada fuera de las reglas de acceso existentes.
- Acceso discreto desde Monthly Top y desde el widget del perfil.
- Estados vacíos y de error separados, accesibles y responsivos.
- Sin dependencias nuevas. No toca Import logs, Spotify, Diary,
  los cálculos previos de Monthly Top ni sus triggers.

### Qué NO se entrega en este PR

- No hay minutos de reproducción exactos: Tornamesa registra álbumes,
  no canciones ni duración real de reproducción.
- Compartir genera un **enlace**, no todavía una imagen/PNG estilo Wrapped.
  La exportación de imagen y el Top Personalizado se trabajan después.
- El Top de artistas se basa en \`albums.artist\`, que representa solo el
  artista principal. No debe etiquetarse como ranking exhaustivo
  de todos los colaboradores.
- No hay cache persistente de resúmenes anuales ni tablas
  \`yearly_summaries\`; primero se mide este motor de solo lectura.
- No hay racha de días: las importaciones sin fecha exacta no dan una
  métrica diaria fiable. No se alteran las fechas de Import logs.
- No modifica README.

## Base de datos y seguridad

Este PR requiere una migración adicional, **manual**:

\`supabase/migrations/20261118_01_yearly_top_stats.sql\`

Crea \`public.yearly_top_stats(uuid, integer)\` como función de solo
lectura: \`SECURITY DEFINER SET search_path = ''\`. Revoca EXECUTE de
\`PUBLIC\`, \`anon\` y \`authenticated\` y concede EXECUTE solo a
\`service_role\`. La función \`top_albums\` del PR #15 permanece sin
cambios. La nueva función consulta \`public.listens\`, \`public.albums\`,
\`public.reviews\` y \`public.monthly_top_timezone\` dentro de PostgreSQL,
sin paginar escuchas en PostgREST.

**Privacidad:** solo la ruta de servidor puede llamar las RPC después
de \`getRequestUser\` + \`canViewWithFollows\` con scope \`top\`.
La ruta no acepta \`user_id\` desde el cliente, usa \`no-store\`
también en respuestas con datos públicos, limita 30 lecturas/minuto
por identidad/IP y devuelve mensajes genéricos ante errores. El acceso
mutuo a privados sigue las políticas actualmente desplegadas; un
\`diary_public=false\` continúa bloqueando tops a terceros.

## Orden de aplicación

1. **No fusionar el PR todavía.** Asegurar que el PR #15 está en main
   y la función \`top_albums\` ya fue creada/verificada.
2. Respaldar Supabase, revisar SQL y confirmar ausencia de función
   homónima con:
   \`\`\`sql
   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='yearly_top_stats';
   \`\`\`
3. Ejecutar manualmente el contenido completo de
   \`supabase/migrations/20261118_01_yearly_top_stats.sql\` en SQL Editor.
   El esperado es \`Success. No rows returned\`.
4. Comprobar permisos con la consulta read-only:
   \`\`\`sql
   SELECT
     to_regprocedure('public.yearly_top_stats(uuid,integer)') IS NOT NULL AS creada,
     has_function_privilege('anon',
       'public.yearly_top_stats(uuid,integer)','EXECUTE') AS anon,
     has_function_privilege('authenticated',
       'public.yearly_top_stats(uuid,integer)','EXECUTE') AS authenticated,
     has_function_privilege('service_role',
       'public.yearly_top_stats(uuid,integer)','EXECUTE') AS service_role;
   \`\`\`
   Esperado: \`true / false / false / true\`.
5. Comparar resumen real de \`devtest\`:
   \`\`\`sql
   SELECT
     (s->>'totalListens')::bigint AS escuchas,
     (s->>'uniqueAlbums')::bigint AS albumes,
     (s->>'repeatListens')::bigint AS reescuchas,
     (s->>'discoveries')::bigint AS primeros_registros,
     jsonb_array_length(s->'monthly') AS meses,
     (SELECT sum((m->>'listens')::bigint)
      FROM jsonb_array_elements(s->'monthly') AS m) AS suma_meses,
     jsonb_array_length(s->'topArtists') AS artistas_destacados
   FROM public.profiles p
   CROSS JOIN LATERAL public.yearly_top_stats(p.id, 2026) AS s
   WHERE lower(p.username)='devtest';
   \`\`\`
   Como comprobación orientativa, en el diagnóstico del PR #15 se
   observaron 12 escuchas, 7 álbumes únicos y 5 reescuchas anuales.
   Estos valores pueden cambiar si se han añadido registros desde entonces.
   La \`suma_meses\` debe coincidir con \`escuchas\` y \`meses=12\`.
6. Con Vercel preview y el SQL aplicado, probar:
   - \`/devtest/yearly-top?year=2026\`: gráfico, cifras y álbumes.
   - Navegar desde Monthly Top y volver.
   - Año vacío, varios años y cambio de año.
   - Calificaciones globales con la cuenta de pruebas que tenga reseñas.
   - Móvil: tarjetas y 12 barras sin desplazamiento horizontal de página.
   - Copiar/compartir enlace; el receptor solo podrá abrir si su permiso
     de privacidad lo autoriza.
   - Propietario del perfil privado: permitido.
   - Anónimo/tercero no mutuo sobre perfil privado: 403, sin datos.
   - Mutual autorizado, \`diary_public=true\`: permitido si cumple canView.
   - Diary no público: tercero, incluso seguidor mutuo, 403.
   - \`year=abc\` y \`year=2200\`: 400; petición repetida: 429.
   - El endpoint debe devolver \`Cache-Control: private, no-store\`.
7. Solo después del éxito de esta batería: marcar PR listo y hacer
   **Squash and merge**, verificar producción.

## Riesgos y seguimiento

- Recuentos agregados correctos sin cap de 1.000 filas gracias a SQL.
  Si el tráfico aumenta, medir con \`EXPLAIN (ANALYZE, BUFFERS)\`
  en un entorno controlado antes de proponer índices o caché.
- La valoración es \`reviews.rating\`; sin reseña será \`null\`.
- Los años importados usan las fechas asignadas por Tornamesa.
- Fallo en RPC de estadísticas por no aplicar migración: API devuelve 500
  genérico y registra el detalle en servidor. No fusionar antes del SQL.
- La exportación Wrapped visual, filtros personalizados y guardado como
  lista quedan para etapas posteriores, sin contaminar este PR.
- Revertir solo si no hay otras dependencias: ejecutar manualmente
  \`DROP FUNCTION public.yearly_top_stats(uuid, integer)\`;
  no hay filas que recuperar.
