# PR #23 — acabado editorial del Wrapped
- Cuatro paletas: Night, Ocean, Violet y Moss; fondo oscuro, contraste suave y continuidad con Monthly Wrapped.
- 1080 × 1920 (9:16), tipografía y portadas mayores; cifras próximas al título/artista; galería ajustada a altura del viewport. Inspiración editorial en Spotify Wrapped y YouTube Recap, sin copiar composiciones ni métricas.
- Evitar consultas de álbumes y portadas en artistas/insights; álbum principal solo obtiene una portada; conservar cache efímera, cancelación, rate limit y autorización por petición. Debounce 90ms; color anterior visible mientras se actualiza, exportación bloqueada hasta PNG correcto.
- No reemplazar next/og hasta medir latencia. No precargar todas las combinaciones: el límite actual es 8/minuto. Sin nuevos datos ni SQL.
- QA: PNG real 1080×1920, cinco slides, cuatro paletas, años vacíos y 1–4 discos, títulos largos, contraste, móvil 320/375/440 y escritorio, compartir/descargar mismo PNG, cierre durante carga, 429 y privacidad. Medir primera carga y cambio de color, frío/caliente; no prometer velocidad sin medición.
- PR #22 fusionado y validado por el usuario. PR #23 no debe fusionarse hasta CI y QA visual. Reversión: revertir el PR, sin restaurar datos.
