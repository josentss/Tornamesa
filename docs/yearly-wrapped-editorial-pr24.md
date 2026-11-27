# PR #24 — historias editoriales compartibles
El propietario verificó PNGs 9:16 y cuatro colores del PR #23. Reportó solapamiento en resumen, círculo innecesario, jerarquía y espacios mejorables. Referencias: sus Spotify Wrapped 2024/25, YouTube Music Recap, Apple Replay; adoptar una historia por tarjeta, no copiar identidad.

- Unificar las cinco plantillas en Frame común de 1080×1920 con zonas reservadas, encabezado y pie consistentes, sin círculo ni posicionamiento absoluto.
- Resumen: cifra principal, álbumes/artistas distintos, disco #1 y artista principal; Top 5 completo queda en slide 3. Mes más activo queda en slide 5. Solo recuperar una portada para resumen.
- Álbum: composición de portada y datos agrupados. Rankings: cifras próximas, filas de tamaño definido. Artistas: destacar #1 y mostrar álbumes distintos del campo albums ya presente en yearly_top_stats. Números: mes, descubrimientos, reescuchas y gráfico con cero real.
- Conservar los cuatro colores exactos, el carrusel, exportación del PNG visible, permisos, límite de generación y cache pública limitada. Sin SQL ni dependencias.
- Posponer preview HTML instantáneo separado de PNG: exige comprobar paridad visual y autorización; no mezclar con rediseño. Este PR conserva preview PNG exacto.
- QA: generación real para 5 tarjetas, paletas, vacío, 1 disco, títulos largos, cifras grandes y zonas seguras. Los tests de firma PNG no demuestran ausencia de solapamiento: inspeccionar las imágenes reales a escala móvil, revisar bordes y textos, descargar y compartir en Preview. No fusionar sin verificación visual.
