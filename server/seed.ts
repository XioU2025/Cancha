import { db, pool } from "./db.js";
import { matches, matchEvents } from "./schema.js";
import { eq } from "drizzle-orm";

try {
  const existing = await db.select().from(matches);
  if (existing.length === 0) {
    const inserted = await db.insert(matches).values([
      { homeTeam: "Atlético Aurora", awayTeam: "Deportivo Central", status: "live", homeScore: 1, awayScore: 0 },
      { homeTeam: "Real Montaña", awayTeam: "Estrella del Sur", status: "live", homeScore: 0, awayScore: 0 }
    ]).returning();
    await db.insert(matchEvents).values([
      { matchId: inserted[0].id, type: "start", minute: 0, description: "¡Comienza el partido!" },
      { matchId: inserted[0].id, type: "goal", minute: 23, team: "Atlético Aurora", description: "Gol de Atlético Aurora" },
      { matchId: inserted[1].id, type: "start", minute: 0, description: "¡Comienza el partido!" }
    ]);
    console.log("Datos de ejemplo creados.");
  } else console.log("Ya existen partidos; no se modificaron los datos.");
} finally { await pool.end(); }
