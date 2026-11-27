# PR #22 — Wrapped gallery

## Objetivo

Conservar las cinco tarjetas y cinco paletas del PR #21. Reemplazar el selector de tarjeta, los controles externos y el Preview separado por una sola acción **View Wrapped** en Yearly Top. La ventana modal contiene un carrusel horizontal de imágenes verticales, resumen primero, cinco indicadores de posición, flechas, colores y los botones Share image / Download PNG. Sin autoplay, sonido, replay ni cambio de la proporción 1080×1350.

La referencia aportada por el usuario y las interfaces de compartición de Spotify sirven para entender la navegación y la ubicación de los controles, no para copiar diseño, logotipo o métricas.

## Implementación

- Diálogo HTML nativo, foco inicial y devuelto al botón al cerrar, Escape, bloqueo temporal de desplazamiento de la página, adaptación a la altura y anchura disponibles.
- Scroll horizontal nativo con snap; puntos, flechas y teclado. La navegación selecciona un tipo de historia; los colores modifican únicamente la paleta y se conservan al cambiar de historia dentro de la ventana.
- PNG solicitado solo tras estabilizar la selección. AbortController evita resultados de solicitudes antiguas; la imagen visible se identifica por tarjeta y color. Los Blob URL de combinaciones visitadas existen solamente durante la sesión de la galería y se revocan al cerrarla. Compartir/descargar reutiliza el mismo PNG, sin segunda generación. El cambio de usuario/año cierra o desmonta la galería.
- Se conserva el límite de generación del servidor; ante 429, mensaje con Retry-After si existe y botón de reintento. No precargar las 25 combinaciones.
- La página anual, las cinco composiciones PNG, la ruta de servidor, las RPC, la privacidad y Monthly Top no cambian. Sin dependencias ni migraciones.

## QA antes de fusionar

| Caso | Resultado esperado |
|---|---|
| Abrir desde Yearly Top 2025 | Resumen primero; 561 escuchas, 226 álbumes y 145 artistas. |
| Deslizar en iOS/Android | Un slide por gesto; puntos, título y posición sincronizados; sin scroll horizontal de página. |
| Escritorio | Flechas, puntos y teclado; Escape, cierre y retorno del foco. |
| 320/375/440/768 px y desktop | Imagen vertical completa, controles alcanzables, sin corte; en pantalla muy baja, scroll vertical del modal. |
| Cambiar color | Actualiza automáticamente solo el slide activo; conserva color al avanzar. |
| Cambios rápidos / cierre durante carga | No muestra PNG obsoleto, no abre descargas involuntarias y libera URL al cerrar. |
| Volver a combinación visitada | Reutiliza Blob; no repite petición. |
| Share / Download | Exactamente el archivo de la tarjeta visible y su color, fallback a descarga si el navegador no comparte. |
| Año vacío, perfil privado, 429 | Estados claros; no cambia autorización; retry visible. |
| CI | Contratos actualizados; pruebas reales de PNG de PR #20/#21 conservadas; npm test y build verdes. |

Los contratos de código no sustituyen pruebas de interacción real en navegador. No fusionar sin QA visual y táctil. Reversión: revertir el PR; no hay datos a restaurar.
