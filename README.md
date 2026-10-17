# Cancha Live — eventos de fútbol en tiempo real

Aplicación académica TypeScript + React + Express + PostgreSQL + Drizzle ORM. Usa **Server-Sent Events (SSE)** para transmitir nuevos eventos del servidor al navegador y migraciones SQL versionadas para crear/evolucionar el esquema.

## Requisitos
- Node.js 20 o superior
- PostgreSQL 14 o superior
- npm

## Instalación

1. Crea una base de datos vacía en PostgreSQL:

   ```sql
   CREATE DATABASE futbol_sse;
   ```

2. Copia `.env.example` como `.env` y ajusta `DATABASE_URL` a tu usuario, contraseña y base de datos local.

3. Instala dependencias:

   ```bash
   npm install
   ```

4. Aplica las migraciones versionadas:

   ```bash
   npm run db:migrate
   ```

5. Inserta dos partidos de demostración y eventos iniciales:

   ```bash
   npm run db:seed
   ```

6. Inicia API y frontend en terminal:

   ```bash
   npm run dev
   ```

   Frontend: http://localhost:5173  
   API: http://localhost:3000

## Comandos de base de datos

- `npm run db:migrate`: aplica en orden `drizzle/0000_initial.sql` y `drizzle/0001_event_details.sql`. Las migraciones aplicadas quedan registradas en `app_migrations`.
- `npm run db:generate`: genera una nueva migración Drizzle a partir de cambios en `server/schema.ts`. Revisa la migración generada antes de aplicarla.
- `npm run db:seed`: inserta los dos partidos de muestra si la tabla `matches` está vacía.
- `npm run typecheck`: verifica tipos TypeScript.
- `npm run build`: comprueba TypeScript y construye el frontend.

Para agregar una migración manual versionada, crea un archivo SQL numerado nuevo dentro de `drizzle/` y añade su nombre a la lista en `server/migrate.ts`. No edites migraciones ya aplicadas en ambientes compartidos.

## Cómo funciona SSE

1. El cliente solicita `GET /api/matches/:id` para cargar marcador e historial persistidos.
2. Tras la carga inicial abre `GET /api/matches/:id/events/stream`, que responde `Content-Type: text/event-stream`.
3. El administrador envía `POST /api/events`. El servidor valida los datos y persiste el evento antes de transmitirlo.
4. Los clientes conectados reciben `event: match-event`; cada evento lleva un ID y el cliente evita duplicados por ID.
5. Las conexiones se guardan por ID de partido y solo reciben los eventos correspondientes a ese partido. `EventSource` se cierra al cambiar o desmontar la vista.

## Rutas principales

- `GET /api/matches` — lista de partidos y marcadores.
- `GET /api/matches/:id` — partido + historial ordenado por minuto, fecha de creación e ID.
- `GET /api/matches/:id/events/stream` — flujo SSE aislado por partido.
- `POST /api/events` — registrar evento validado.
- `PATCH /api/matches/:id/status` — actualizar estado del partido.
