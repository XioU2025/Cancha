import { useCallback, useEffect, useMemo, useState } from "react";

type Match = { id: number; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; status: "scheduled" | "live" | "finished" };
type EventType = "goal" | "foul" | "substitution" | "yellow_card" | "red_card" | "start" | "half_time" | "full_time";
type MatchEvent = { id: number; matchId: number; type: EventType; minute: number; team: string | null; description: string; createdAt: string };
const API = import.meta.env.VITE_API_URL || "";
const labels: Record<EventType, string> = { goal: "Gol", foul: "Falta", substitution: "Cambio", yellow_card: "Amarilla", red_card: "Roja", start: "Inicio", half_time: "Descanso", full_time: "Final" };
const icons: Record<EventType, string> = { goal: "⚽", foul: "⚑", substitution: "🔄", yellow_card: "🟨", red_card: "🟥", start: "▶", half_time: "⏸", full_time: "🏁" };
async function getJson<T>(url: string): Promise<T> { const r = await fetch(API + url); if (!r.ok) throw new Error("No se pudo cargar la información."); return r.json(); }
//.
export default function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [view, setView] = useState<"public" | "admin">("public");
  const [connection, setConnection] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "goal" as EventType, minute: "45", team: "", description: "" });
  const selected = matches.find(m => m.id === selectedId) ?? null;

  const refreshMatches = useCallback(async () => {
    try {
      const data = await getJson<Match[]>("/api/matches");
      setMatches(data);
      setSelectedId(old => old && data.some(m => m.id === old) ? old : (data[0]?.id ?? null));
    } catch { setError("No se pudo conectar con el servidor. Comprueba la base de datos y la API."); }
  }, []);
  useEffect(() => { void refreshMatches(); }, [refreshMatches]);

  useEffect(() => {
    if (!selectedId) { setEvents([]); return; }
    let active = true;
    let source: EventSource | null = null;
    setConnection("reconnecting");
    setError("");
    // Initial state comes from HTTP; SSE starts only after history is loaded.
    getJson<{ match: Match; events: MatchEvent[] }>(`/api/matches/${selectedId}`).then(data => {
      if (!active) return;
      setEvents(data.events);
      setMatches(old => old.map(m => m.id === data.match.id ? data.match : m));
      source = new EventSource(`${API}/api/matches/${selectedId}/events/stream`);
      source.addEventListener("connected", () => { if (active) setConnection("connected"); });
      source.addEventListener("match-event", (message: MessageEvent) => {
        if (!active) return;
        const incoming = JSON.parse(message.data) as MatchEvent;
        if (incoming.matchId !== selectedId) return;
        setEvents(old => old.some(e => e.id === incoming.id) ? old : [...old, incoming].sort((a,b) => a.minute-b.minute || new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime() || a.id-b.id));
        if (incoming.type === "goal") void refreshMatches();
      });
      source.onopen = () => { if (active) setConnection("connected"); };
      source.onerror = () => { if (active) setConnection(source.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting"); };
    }).catch(() => { if (active) { setError("No se pudo cargar el partido."); setConnection("disconnected"); } });
    return () => { active = false; source?.close(); setConnection("disconnected"); };
  }, [selectedId, refreshMatches]);

  const orderedEvents = useMemo(() => [...events].sort((a,b) => a.minute-b.minute || new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime() || a.id-b.id), [events]);

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault(); if (!selectedId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(API + "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: selectedId, type: form.type, minute: Number(form.minute), team: form.team || null, description: form.description }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo registrar el evento.");
      setForm(f => ({ ...f, description: "" }));
      await refreshMatches();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al registrar."); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-ball">⚽</span><span>CANCHA<span className="brand-accent">LIVE</span><small>FÚTBOL EN TIEMPO REAL</small></span></a>
      <nav><button className={view === "public" ? "nav-btn active" : "nav-btn"} onClick={() => setView("public")}>Vista pública</button><button className={view === "admin" ? "nav-btn active" : "nav-btn"} onClick={() => setView("admin")}>⚙ Administración</button></nav>
    </header>
    <main>
      <section className="hero"><div><div className="eyebrow"><span className="live-dot" /> CENTRO DE PARTIDOS</div><h1>El fútbol <span>no se detiene.</span></h1><p>Marcadores y momentos clave, actualizados al instante.</p></div><div className="hero-mark">90<span>′</span><small>MINUTOS DE PASIÓN</small></div></section>
      {error && <div className="alert">⚠ {error}</div>}
      <section className="section-head"><div><span className="kicker">EN DIRECTO</span><h2>Partidos destacados</h2></div><span className="match-count">{matches.length} PARTIDOS</span></section>
      <div className="match-grid">{matches.map(m => <button key={m.id} onClick={() => setSelectedId(m.id)} className={`match-card ${selectedId === m.id ? "selected" : ""}`}>
        <div className="card-top"><span className={m.status === "live" ? "status live" : "status"}><i />{m.status === "live" ? "EN VIVO" : m.status === "finished" ? "FINALIZADO" : "PROGRAMADO"}</span><span className="match-id">PARTIDO #{String(m.id).padStart(2,"0")}</span></div>
        <div className="teams"><div className="team"><span className="team-crest">{m.homeTeam.slice(0,1)}</span><span>{m.homeTeam}</span></div><div className="score">{m.homeScore}<span>:</span>{m.awayScore}</div><div className="team away"><span className="team-crest">{m.awayTeam.slice(0,1)}</span><span>{m.awayTeam}</span></div></div>
        <div className="card-bottom"><span>{selectedId === m.id ? "PARTIDO SELECCIONADO" : "VER DETALLES"}</span><span>↗</span></div>
      </button>)}
      {matches.length === 0 && <div className="empty">Cargando partidos…</div>}</div>

      {selected && <section className="details-layout">
        <div className="timeline-panel"><div className="panel-heading"><div><span className="kicker">SEGUIMIENTO DEL PARTIDO</span><h2>Línea de tiempo</h2></div><span className={`connection ${connection}`}><i />{connection === "connected" ? "Conectado" : connection === "reconnecting" ? "Reconectando" : "Desconectado"}</span></div>
          <div className="detail-score"><div><span>{selected.homeTeam}</span><strong>{selected.homeScore}</strong></div><b>—</b><div className="right-score"><strong>{selected.awayScore}</strong><span>{selected.awayTeam}</span></div></div>
          <div className="timeline">{orderedEvents.length ? orderedEvents.map(ev => <article className="event-row" key={ev.id}><div className="event-minute">{ev.minute}<small>MIN</small></div><div className={`event-icon ${ev.type}`}>{icons[ev.type]}</div><div className="event-copy"><div><strong>{ev.description}</strong><span className={`event-tag ${ev.type}`}>{labels[ev.type]}</span></div><p>{ev.team || "Evento del partido"}</p></div></article>) : <div className="empty">Todavía no hay eventos. ¡El partido está por comenzar!</div>}</div>
          <div className="timeline-foot"><span><i className="live-dot" /> ACTUALIZACIÓN EN TIEMPO REAL</span><span>{orderedEvents.length} EVENTOS</span></div>
        </div>
        <aside className="side-panel"><div className="side-title"><span className="kicker">PARTIDO ACTUAL</span><h3>{selected.homeTeam}<br/><span>vs.</span> {selected.awayTeam}</h3></div><div className="side-stat"><span>Estado</span><strong>{selected.status === "live" ? "● En vivo" : selected.status === "finished" ? "Finalizado" : "Programado"}</strong></div><div className="side-stat"><span>Eventos registrados</span><strong>{events.length}</strong></div><div className="side-stat"><span>Canal de eventos</span><strong className="mono">SSE / {selected.id}</strong></div><div className="side-note">Los eventos se guardan en la base de datos antes de emitirse a los espectadores.</div></aside>
      </section>}

      {view === "admin" && selected && <section className="admin-panel"><div className="admin-header"><div><span className="kicker">ZONA PRIVADA · DEMOSTRACIÓN</span><h2>Registrar evento</h2><p>Elige un partido arriba y publica una incidencia en directo.</p></div><span className="admin-symbol">＋</span></div>
        <form onSubmit={submitEvent} className="event-form">
          <label>Partido seleccionado<select value={selectedId} onChange={e => setSelectedId(Number(e.target.value))}>{matches.map(m => <option key={m.id} value={m.id}>{m.homeTeam} vs. {m.awayTeam}</option>)}</select></label>
          <div className="form-row"><label>Tipo de evento<select value={form.type} onChange={e => setForm({...form,type:e.target.value as EventType})}>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{icons[key as EventType]} {label}</option>)}</select></label><label>Minuto<input type="number" min="0" max="150" required value={form.minute} onChange={e => setForm({...form,minute:e.target.value})}/></label></div>
          <label>Equipo (opcional)<select value={form.team} onChange={e => setForm({...form,team:e.target.value})}><option value="">Evento general</option><option value={selected.homeTeam}>{selected.homeTeam}</option><option value={selected.awayTeam}>{selected.awayTeam}</option></select></label>
          <label>Descripción<input minLength={3} maxLength={300} required placeholder="Ej. ¡Gran remate y gol!" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label>
          <button className="submit-btn" disabled={busy}>{busy ? "Guardando…" : "↗  Registrar y transmitir evento"}</button>
        </form><p className="admin-hint">La API valida los datos, guarda el evento y luego lo transmite por SSE solo a las conexiones de este partido.</p>
      </section>}
    </main>
    <footer><span>⚽ CANCHA<span className="brand-accent">LIVE</span></span><span>PROYECTO ACADÉMICO · SSE + DRIZZLE ORM</span><span>HECHO PARA VIVIR EL JUEGO</span></footer>
  </div>;
}
