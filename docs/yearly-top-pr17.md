# PR #17 — Yearly Top: QA y límites

**Alcance:** ajustar exclusivamente la experiencia visual existente en \`src/app/[username]/yearly-top/page.js\`, reforzar su contrato de pruebas y abrir \`docs/PROJECT_ROADMAP.md\`. Sin migración, dependencias nuevas, cambios de importador, búsqueda, RLS, API o README.

## Cambios verificables

- Gráfico de doce meses: abreviaturas de tres letras en móvil y escritorio; nombres completos y totales para lectores de pantalla; máximo mensual con cantidad indicada.
- Tarjetas de álbum: foco de teclado visible, portada decorativa sin repetir el nombre audible.
- Ranking: expresa "Top N of X albums" porque la API entrega como máximo 50; botón expandible enlazado con \`aria-controls\` y \`aria-expanded\`.
- Selector de año, enlace a Monthly y compartir: indicadores visibles de foco.
- Los contadores, RPC, fechas, orden de álbumes, derechos de acceso, esquema de color y layout estructural se conservan.

## QA antes de fusionar (propietario / Vercel Preview)

| Caso | Resultado esperado | Estado |
|---|---|---|
| \`/@usuario/yearly-top?year=2025\` (ruta real \`/usuario/yearly-top?year=2025\`) | Cuenta principal: **esperado** 561 escuchas y 226 álbumes únicos después de limpiezas SQL; comparar API y BD, no afirmar como verificado aquí | Pendiente |
| Gráfico 2025 | Agosto 107 y septiembre 68; la suma de 12 meses iguala total 561; abreviaturas distinguibles en 375px | Pendiente |
| 2026 y año sin escuchas | Datos actuales intactos, sin UI desbordada ni resultados inventados | Pendiente |
| 1, 10, >10 y >50 álbumes en ranking | Control aparece solo si hay más de 10; 50 es máximo de API; se muestra total de álbumes del año aparte | Pendiente |
| Teclado y lector de pantalla | Tab llega a selector, compartir, mensual, álbumes, expandir; foco visible; 12 meses y totales anunciables | Pendiente |
| Móvil 320/375/768px y escritorio | Sin desplazamiento horizontal inesperado; legible, coherente con paleta actual | Pendiente |
| Privacidad | Propietario 200; privado no mutuo 403; mutuo autorizado 200 si diario público; diario privado tercero 403; anónimo sobre público 200 | Pendiente |
| API año inválido | \`?year=abc\`, \`?year=2200\` devuelven 400 en API, no filtran contenido | Pendiente |
| Compartir | Copia o comparte enlace a año correcto; permiso del receptor se comprueba en API | Pendiente |
| Tests/build | \`npm test\`, \`npm run build\`; anotar resultados de CI sobre HEAD final | Pendiente |

**No ejecutar SQL:** este PR no necesita alterar datos de Supabase ni recalcular histórico manualmente.

## Alcance futuro, no mezclado

Imagen anual exportable y Top Personalizado van en PR separados. El problema de identificación de artistas de Import logs y la pérdida visual de ediciones con IDs distintos se documentan en el roadmap, sin tocar el importador.

**Rollback:** revertir PR #17 (solo JSX, pruebas y documentación). No hay datos que restaurar.
