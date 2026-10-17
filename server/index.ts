import "dotenv/config";
import express from "express";
import cors from "cors";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "./db.js";
import { matches, matchEvents } from "./schema.js";

const app = express();
app.use(cors());
app.use(express.json());
const clients = new Map<number, Set<express.Response>>();

const eventInput = z.object({
  matchId: z.number().int().positive(),
  type: z.enum(["goal", "foul", "substitution", "yellow_card", "red_card", "start", "half_time", "full_time"]),
  minute: z.number().int().min(0).max(150),
  team: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().min(3).max(300)
});

app.get("/api/matches", async (_req, res) => {
  try { res.json(await db.select().from(matches).orderBy(asc(matches.id))); }
  catch { res.status(500).json({ error: "No se pudieron cargar los partidos." }); }
});

app.get("/api/matches/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "ID de partido inválido." });
  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return res.status(404).json({ error: "Partido no encontrado." });
    const events = await db.select().from(matchEvents)
      .where(eq(matchEvents.matchId, id))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt), asc(matchEvents.id));
    res.json({ match, events });
  } catch { res.status(500).json({ error: "No se pudo cargar el partido." }); }
});

app.get("/api/matches/:id/events/stream", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).end("ID inválido");
  const [match] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, id));
  if (!match) return res.status(404).end("Partido no encontrado");
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ matchId: id })}\n\n`);
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id)!.add(res);
  const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(": keep-alive\\n\\n"); }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.get(id)?.delete(res);
    if (clients.get(id)?.size === 0) clients.delete(id);
  });
});

app.post("/api/events", async (req, res) => {
  const parsed = eventInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa el formulario: minuto, tipo y descripción son obligatorios.", details: parsed.error.flatten() });
  try {
    const input = parsed.data;
    const [match] = await db.select().from(matches).where(eq(matches.id, input.matchId));
    if (!match) return res.status(404).json({ error: "El partido seleccionado no existe." });
    // Persist first; only after commit/insert succeeds is the event broadcast.
    const [event] = await db.insert(matchEvents).values({
      matchId: input.matchId, type: input.type, minute: input.minute,
      team: input.team || null, description: input.description
    }).returning();
    if (input.type === "goal") {
      const homeGoal = input.team === match.homeTeam;
      const awayGoal = input.team === match.awayTeam;
      if (homeGoal || awayGoal) {
        await db.update(matches).set({
          homeScore: match.homeScore + (homeGoal ? 1 : 0),
          awayScore: match.awayScore + (awayGoal ? 1 : 0)
        }).where(eq(matches.id, input.matchId));
      }
    }
    const payload = JSON.stringify(event);
    for (const client of clients.get(input.matchId) ?? []) {
      client.write(`id: ${event.id}\nevent: match-event\ndata: ${payload}\n\n`);
    }
    res.status(201).json(event);
  } catch { res.status(500).json({ error: "No se pudo guardar el evento." }); }
});

app.patch("/api/matches/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(["scheduled", "live", "finished"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Estado inválido." });
  const [updated] = await db.update(matches).set({ status: parsed.data.status }).where(eq(matches.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Partido no encontrado." });
  res.json(updated);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API lista en http://localhost:${port}`));
process.on("SIGINT", async () => { await pool.end(); process.exit(0); });
