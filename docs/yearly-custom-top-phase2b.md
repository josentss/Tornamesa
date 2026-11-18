# Fase 2B — PR #15 · Motor compartido de Top Anual y Personalizado

## Alcance y decisiones de producto

Este PR es **exclusivamente de fundamentos**. No cambia Monthly Top, Diary,
Import logs, Spotify, el diseño existente ni las rutas públicas. Las
interfaces y la API llegan en los PR siguientes, tras probar esta base.

- **Top Anual**: un resumen musical atractivo y compartible: escuchas,
  álbumes únicos, álbumes/artistas destacados, valoraciones generales,
  descubrimientos y evolución por meses.
- **Top Personalizado**: selección de meses no consecutivos, incluso de
  distintos años; atajos de 3/6/12 meses; orden por escuchas, valoración
  general y reescuchas; mínimos; 10/25/50/100; artista principal.
- Diseño posterior: tarjetas del Monthly Top, paleta oscura y azul existente,
  filtros compactos y plegables, espacio moderado, sin banners ni iconos
  repetidos. Compartir será una acción relevante, no una colección de
  controles ornamentales.
- Privacidad: la futura API **deberá** usar getRequestUser +
  canViewWithFollows antes de ejecutar la función SQL. Preservar el
  comportamiento productivo de seguimiento mutuo, incluso donde el plan
  antiguo difiere de la app actual.
- Puntuaciones: **reviews.rating** es la única calificación de un álbum
  (PR #9). La indicación antigua del roadmap sobre promediar
  listens.rating ha quedado sustituida; no reintroducir fallback.
- La "vista de reescuchados" debe contener solo álbumes con al menos 2
  escuchas; contar repeticiones como listen_count - 1.
- No presentar "minutos escuchados" exactos: una escucha de un álbum no
  demuestra reproducción íntegra y 3.541 de 3.677 álbumes del diagnóstico
  no tenían duración registrada. No inferir minutos con datos incompletos.
- Los filtros por artista se basan en albums.artist (artista principal), no
  prometen filtrar colaboradores aún no representados en el catálogo.
- Las fechas generadas por Import logs se conservan tal cual. No cambiar
  interpretación de Weekly Top ni exigir fechas por línea.

## Archivos del PR

- src/lib/topRanges.js — períodos UTC [inicio, fin) por meses del perfil.
- src/lib/topRanking.js — orden de referencia determinista para pruebas.
- supabase/migrations/20261117_03_top_albums_ranges.sql —
  RPC de lectura top_albums(uuid,jsonb,text,integer,numeric,integer,text).
- tests/yearlyCustomTopEngine.test.mjs — rangos, DST, desempates y contrato SQL.
- docs/yearly-custom-top-phase2b.md — este plan y la guía de implantación.

## Motor SQL

- Función `public.top_albums` de solo lectura con `SECURITY DEFINER`,
  `search_path = ''`, `REVOKE ... anon,authenticated,PUBLIC` y permiso
  `EXECUTE` solamente para service_role. NO llamarla desde Supabase JS
  del navegador.
- Rangos de meses en UTC del **propietario**; hasta 24 no solapados,
  incluyendo combinaciones de años diferentes. Validación repetida en SQL.
- Usa `EXISTS` contra los rangos para que una escucha jamás se sume dos
  veces. Agrupa en Postgres sin descargar cientos de filas al servidor.
- Orden por escuchas, rating, reescuchas; desempate estable por total,
  primera escucha y Spotify ID COLLATE "C".
- Validación server-side adicional en los PR #16/17: períodos,
  filtros, permisos y rateLimit de lectura.
- Sin índices nuevos: necesitamos diagnosticar primero los índices reales
  de listens/reviews y comparar EXPLAIN en el entorno de pruebas.
- Sin caching anual todavía. Los resúmenes de años cerrados se diseñarán
  tras medir resultados; no tocar triggers del Monthly Top sin necesidad.

## Antes de ejecutar SQL — consulta SOLO LECTURA

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('listens', 'reviews', 'albums')
ORDER BY tablename, indexname;

SELECT n.nspname, p.proname,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'top_albums';

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'listens' AND column_name IN
      ('user_id','album_id','listened_at')) OR
    (table_name = 'reviews' AND column_name IN
      ('user_id','album_id','rating')) OR
    (table_name = 'albums' AND column_name IN ('spotify_id','artist'))
  )
ORDER BY table_name, column_name;
```

Si existe una función top_albums homónima, revisar la firma antes de
ejecutar la migración. No sobreescribir funciones desconocidas sin verificar.

## Aplicación manual (después del diagnóstico)

1. Respaldar Supabase.
2. Revisar `supabase/migrations/20261117_03_top_albums_ranges.sql`.
3. Ejecutarla manualmente en el editor SQL. No ejecutar consultas
   masivas con usuario real ni cambiar índices de producción para probar.
4. Verificación de permisos, SOLO LECTURA:

```sql
SELECT
 has_function_privilege('anon',
   'public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)',
   'EXECUTE') AS anon_exec,
 has_function_privilege('authenticated',
   'public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)',
   'EXECUTE') AS authenticated_exec,
 has_function_privilege('service_role',
   'public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)',
   'EXECUTE') AS service_exec;
```

Esperado: false / false / true. La función no escribe filas ni crea
resúmenes. Si SQL falla, la transacción debe revertirse íntegramente.

## Pruebas

- `npm test` y `npm run build` en Vercel; la compilación sin SQL aplicado
  es esperable, ya que la RPC no es llamada aún por interfaces existentes.
- Pruebas unitarias sin Spotify, Supabase ni red: meses no contiguos,
  2026 completo, DST, cambios de año, duplicados, máximo 24 meses,
  orden determinista y reseña canónica.
- Tras SQL y antes de PR #16, comparar resultados con cuenta devtest y
  períodos ya verificados del Monthly Top. Una consulta de los doce meses
  del año y una selección personalizada de esos mismos doce meses debe
  producir idéntica clasificación para los mismos filtros.
- Próximo PR #16: API GET `/api/profiles/username/[username]/top`
  con canViewWithFollows + rateLimit + validación, y UI anual.
- Próximo PR #17: filtros personalizados, URL reproducible, artista
  principal, compartir/guardar como lista con permisos correctos.
- Compartir imagen tipo Wrapped: iteración posterior, con protección
  de acceso al render y exportación coherente en móvil y escritorio.

## Limitaciones conocidas

Este motor solo calcula ranking de álbumes y sus puntuaciones; no devuelve
aún el resumen completo de estadísticas anuales (mes más activo,
descubrimientos reales, artistas, gráficos). Esas consultas y una posible
caché de años cerrados se añadirán después de verificar el ranking.

La privacidad se garantiza en la futura API antes del llamado RPC; esta
función es interna y por eso no está expuesta a anon ni authenticated.
No dejar una ruta de servidor que acepte un user_id arbitrario sin comprobar
`canViewWithFollows`. No reutilizar resultados con identidad privada
en cachés compartidas.

Reversión, si aún no hay otros PRs dependiendo de ella: ejecutar
manualmente el `DROP FUNCTION` comentado al final de la migración;
no hay datos históricos que recuperar.
