# Tornamesa

Lleva un diario de los **discos** que escuchas. Puntúalos, escribe reseñas, arma tu top del mes y compártelo si quieres.

**App:** [https://tornamesa-nu.vercel.app](https://tornamesa-nu.vercel.app)

> Early access / versión estable temprana. Puede haber detalles por pulir. El feedback ayudaría mucho.

---

## ¿Qué es?

Tornamesa está pensado para quien lleva (o quiere llevar) un registro serio de **álbumes**, no solo de canciones sueltas como lo hacen las plataformas convencionales: logs, ratings del 1 al 10, reseñas, diary, listas y un monthly top con un resumen para compartir.

---

## Capturas

**Perfil:**
https://i.imgur.com/9ahMPnf.png

**Top mensual:**
https://i.imgur.com/H6CQ0R3.png

**Diario:**
https://i.imgur.com/5pi7Axu.png

**Página de álbum:**
https://i.imgur.com/F958P2s.png

---

## Funciones

- **Log de escuchas** — registra un disco cuando lo escuchas  
- **Rating y reseñas** — del 1 al 10, reseña textual si lo deseas 
- **Diary** — historial con edición de fecha, rating y reseña  
- **Monthly top** — ranking del mes (y semanas) + **resumen** descargable  
- **Listas** — “To listen” y listas propias  
- **Perfiles y social** — seguidores, actividad de amigos, descubrir por gustos (10★)  
- **Privacidad** — perfil privado, diario público/privado, ocultar actividad  
- **Importación** — migrar logs desde notas `.txt` (formato mes a mes)

---

## Stack

- [Next.js](https://nextjs.org/) 14 (App Router)  
- [Supabase](https://supabase.com/) (auth + base de datos)  
- Metadatos de catálogo vía [Spotify Web API](https://developer.spotify.com/)  
- Rate limiting con [Upstash Redis](https://upstash.com/)  
- Deploy en [Vercel](https://vercel.com/)

Tornamesa **no tiene nada que ver** con Spotify.

---

## Self-hosting

No he realizado una guía completa. De igual manera necesitarías:

- Proyecto Supabase (auth + tablas)  
- Credenciales de Spotify (Client ID / Secret)  
- Opcional: Upstash Redis y Cloudflare Turnstile  

---

## Feedback

Issues y sugerencias son bienvenidas. Si usas la app en el día a día y algo falla, puedes comentarme cualquier tema a mi Discord (josents)

---

## Licencia

[MIT](./LICENSE) © 2026 josentss
