import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PartyPopper,
  Star,
  Heart,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import "../styles/encuesta-galletas.css";

/* /exec de TU deployment (Sheet + Codigo.gs) */
const API_URL = "https://script.google.com/macros/s/AKfycbxgQuRw6REZOdIWgrojIxbL-hjAMg5VCUkgbmbbY6CX2pRBSXTcgHOWgP1MC1-bcXdW/exec";
const SHEET = "Respuestas";
const QUEUE_KEY = "encuesta_galletas_cola_v1";

/* ---------- OPCIONES DEL ESTUDIO DE MERCADO ---------- */
const GANAS = [
  { valor: 1, emoji: "🙅", texto: "Nada" },
  { valor: 2, emoji: "😕", texto: "Poquito" },
  { valor: 3, emoji: "🙂", texto: "Normal" },
  { valor: 4, emoji: "😋", texto: "Muchas" },
  { valor: 5, emoji: "🤩", texto: "¡Muchísimas!" },
];

const GRADOS = [
  "Transición", "1°", "2°", "3°", "4°", "5°",
  "6°", "7°", "8°", "9°", "10°", "11°",
];

const GENEROS = [
  { valor: "Niña", emoji: "👧" },
  { valor: "Niño", emoji: "👦" },
  { valor: "Prefiero no decir", emoji: "🙂" },
];

const FRECUENCIAS = [
  { valor: "Todos los días",           emoji: "🗓️" },
  { valor: "Varias veces por semana",  emoji: "📅" },
  { valor: "Una vez por semana",       emoji: "1️⃣" },
  { valor: "De vez en cuando",         emoji: "🤏" },
  { valor: "Casi nunca",               emoji: "🚫" },
];

const LUGARES = [
  { valor: "Tienda del cole", emoji: "🏫" },
  { valor: "En casa",         emoji: "🏠" },
  { valor: "Supermercado",    emoji: "🛒" },
  { valor: "Panadería",       emoji: "🥐" },
  { valor: "Otro",            emoji: "✨" },
];

const PRECIOS = [
  { valor: 1000, label: "$1.000" },
  { valor: 1500, label: "$1.500" },
  { valor: 2000, label: "$2.000" },
  { valor: 2500, label: "$2.500" },
  { valor: 3000, label: "$3.000 o más" },
];

const COMPRA = [
  { valor: "Sí",      emoji: "💚", clase: "si" },
  { valor: "Tal vez", emoji: "🤔", clase: "talvez" },
  { valor: "No",      emoji: "🙅", clase: "no" },
];

const TAMANOS = [
  { valor: "Pequeña", emoji: "🤏" },
  { valor: "Mediana", emoji: "👌" },
  { valor: "Grande",  emoji: "🙌" },
];

const RELLENOS = [
  { valor: "Poco",  emoji: "🥄", label: "Poco relleno" },
  { valor: "Mucho", emoji: "🍫", label: "Mucho relleno" },
];

const CANT_CHISPAS = [
  { valor: "Pocas",  emoji: "✨", label: "Pocas" },
  { valor: "Muchas", emoji: "🌟", label: "Muchas" },
];

const ATRIBUTOS = [
  { valor: "Sabor",      emoji: "😋" },
  { valor: "Relleno",    emoji: "🍫" },
  { valor: "Textura",    emoji: "🥨" },
  { valor: "Tamaño",     emoji: "📏" },
  { valor: "Decoración", emoji: "🎨" },
];

const TOTAL_PASOS = 7;

const FORM_VACIO = {
  nombre: "", edad: "", grado: "", genero: "",
  frecuencia: "", lugar: "",
  ganas: 0, nutellaGusto: 0, recomendaria: 0,
  compraria: "", precio: 0,
  tamano: "", relleno: "", chispas: "",
  atributo: "", prefiere: "", comentarios: "",
};

/* ---------- COLA DE GUARDADO (localStorage) ---------- */
const leerCola = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
  catch { return []; }
};
const guardarCola = (q) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
};

export const Home = () => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | done | error
  const [pendientes, setPendientes] = useState(0);
  const [form, setForm] = useState(FORM_VACIO);

  const update = useCallback((campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
  }, []);

  /* ---- Sincronización en segundo plano (procesa la cola) ---- */
  const sincronizar = useCallback(async () => {
    let cola = leerCola();
    if (cola.length === 0) { setPendientes(0); setSyncState("idle"); return; }

    setSyncState("syncing");
    setPendientes(cola.length);
    const restantes = [];

    for (const item of cola) {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "registrar_respuesta", sheet: SHEET, data: item }),
        });
        const json = JSON.parse(await res.text());
        if (json.status === "error") throw new Error(json.message);
        // ✔ guardado -> no se agrega a "restantes"
      } catch (e) {
        console.error("Fallo al sincronizar, se reintentará:", e);
        restantes.push(item); // se conserva para reintentar
      }
    }

    guardarCola(restantes);
    setPendientes(restantes.length);

    if (restantes.length === 0) {
      setSyncState("done");
      setTimeout(() => setSyncState("idle"), 2000);
    } else {
      setSyncState("error");
      setTimeout(() => sincronizar(), 6000); // reintento automático
    }
  }, []);

  /* Al abrir la app, reintenta lo que haya quedado pendiente */
  useEffect(() => { sincronizar(); }, [sincronizar]);

  /* ---- Validación por paso ---- */
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return form.edad && form.grado && form.genero;
      case 2: return form.frecuencia && form.lugar;
      case 3: return form.ganas > 0;
      case 4: return form.nutellaGusto > 0 && form.recomendaria > 0;
      case 5: return form.compraria && form.precio > 0;
      case 6: return form.tamano && form.relleno && form.chispas;
      case 7: return form.atributo && form.prefiere; // comentarios opcional
      default: return true;
    }
  }, [step, form]);

  /* ---- ENVIAR: optimistic UI (muestra "gracias" al instante) ---- */
  const enviar = useCallback(() => {
    const data = {
      Nombre: form.nombre || "Anónimo",
      Edad: form.edad,
      Grado: form.grado,
      Genero: form.genero,
      Muestra: form.frecuencia,        // Frecuencia de consumo
      Codigo: form.lugar,              // Dónde compra
      Tamano: form.tamano,             // Tamaño preferido
      Nutella: form.relleno,           // Relleno preferido
      Chispas: form.chispas,           // Chispas preferidas
      Gusto: form.ganas,               // Ganas de probarla (interés)
      Sabor: form.nutellaGusto,        // ¿Le gusta la Nutella?
      Textura: form.recomendaria,      // ¿La recomendaría?
      Compraria: form.compraria,
      Precio: form.precio,
      Atributo_Importante: form.atributo,
      Prefiere: form.prefiere,
      Comentarios: form.comentarios || "",
    };

    // 1) Se guarda YA en la cola local (nada se pierde)
    const cola = leerCola();
    cola.push(data);
    guardarCola(cola);

    // 2) Optimistic: mostramos gracias de inmediato
    setDone(true);

    // 3) Sincroniza en segundo plano
    sincronizar();
  }, [form, sincronizar]);

  const next = useCallback(() => {
    if (!canAdvance) return;
    if (step === TOTAL_PASOS) { enviar(); return; }
    setStep((s) => s + 1);
  }, [canAdvance, step, enviar]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  /* Toast de sincronización (se muestra en cualquier pantalla) */
  const syncToast = syncState !== "idle" ? (
    <div className={`enc-sync-toast enc-sync-toast--${syncState}`}>
      {syncState === "syncing" && <Loader2 className="enc-spin" size={18} />}
      {syncState === "done" && <CheckCircle2 size={18} />}
      {syncState === "error" && <AlertTriangle size={18} />}
      <span>
        {syncState === "syncing" && `Sincronizando${pendientes ? ` (${pendientes})` : ""}...`}
        {syncState === "done" && "¡Guardado!"}
        {syncState === "error" && `Sin conexión, guardado local (${pendientes})`}
      </span>
      {syncState === "error" && (
        <button className="enc-sync-retry" onClick={sincronizar}>Reintentar</button>
      )}
    </div>
  ) : null;

  /* ============ PANTALLA FINAL ============ */
  if (done) {
    return (
      <div className="enc-app enc-app--done">
        <div className="enc-confetti" aria-hidden>
          {["🍪","🍫","⭐","🎉","✨","🍪","🎊","🍫"].map((e, i) => (
            <span key={i} style={{ "--i": i }}>{e}</span>
          ))}
        </div>
        <div className="enc-done-card">
          <div className="enc-done-emoji">🎉🍪</div>
          <h1>¡Muchas gracias!</h1>
          <p>Tu opinión nos ayuda a crear la galleta perfecta.</p>
          <button
            className="enc-btn enc-btn--primary"
            onClick={() => { setForm(FORM_VACIO); setDone(false); setStep(0); }}
          >
            <PartyPopper size={20} /> Encuestar a otra persona
          </button>
        </div>
        {syncToast}
      </div>
    );
  }

  /* ============ INTRO ============ */
  if (step === 0) {
    return (
      <div className="enc-app">
        <div className="enc-intro">
          <div className="enc-intro-cookie">🍪</div>
          <p className="enc-eyebrow">Instituto CREAR · Estudio de mercado</p>
          <h1 className="enc-intro-title">¡Ayúdanos a crear una galleta!</h1>
          <p className="enc-intro-text">
            Estamos pensando en lanzar una galleta <b>chocochip rellena de Nutella</b> 🍫.
            Antes de hacerla queremos saber tu opinión. ¡Son solo unos toques! 😋
          </p>
          <button className="enc-btn enc-btn--primary enc-btn--xl" onClick={() => setStep(1)}>
            ¡Empezar! <ChevronRight size={22} />
          </button>
        </div>
        {syncToast}
      </div>
    );
  }

  /* ============ WIZARD ============ */
  return (
    <div className="enc-app">
      <div className="enc-progress">
        {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
          <span
            key={i}
            className={`enc-dot ${i + 1 < step ? "done" : ""} ${i + 1 === step ? "active" : ""}`}
          />
        ))}
      </div>

      <div className="enc-card">
        {/* PASO 1: Sobre ti */}
        {step === 1 && (
          <div className="enc-step">
            <h2 className="enc-q">Cuéntanos de ti 🙋</h2>

            <label className="enc-label">Tu nombre (opcional)</label>
            <input
              className="enc-input"
              type="text"
              placeholder="Escribe tu nombre..."
              value={form.nombre}
              onChange={(e) => update("nombre", e.target.value)}
            />

            <label className="enc-label">¿Cuántos años tienes?</label>
            <div className="enc-chips">
              {[5,6,7,8,9,10,11,12,13,14,15,16,17].map((n) => (
                <button
                  key={n}
                  className={`enc-chip ${form.edad === n ? "sel" : ""}`}
                  onClick={() => update("edad", n)}
                >{n}</button>
              ))}
            </div>

            <label className="enc-label">¿En qué curso estás?</label>
            <div className="enc-chips">
              {GRADOS.map((g) => (
                <button
                  key={g}
                  className={`enc-chip ${form.grado === g ? "sel" : ""}`}
                  onClick={() => update("grado", g)}
                >{g}</button>
              ))}
            </div>

            <label className="enc-label">¿Eres...?</label>
            <div className="enc-options enc-options--3">
              {GENEROS.map((g) => (
                <button
                  key={g.valor}
                  className={`enc-option ${form.genero === g.valor ? "sel" : ""}`}
                  onClick={() => update("genero", g.valor)}
                >
                  <span className="enc-option-emoji">{g.emoji}</span>
                  <span>{g.valor}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 2: Hábitos de consumo */}
        {step === 2 && (
          <div className="enc-step">
            <h2 className="enc-q">Tus galletas del día a día 🍪</h2>

            <label className="enc-label">¿Cada cuánto comes galletas?</label>
            <div className="enc-options enc-options--wrap">
              {FRECUENCIAS.map((f) => (
                <button
                  key={f.valor}
                  className={`enc-option ${form.frecuencia === f.valor ? "sel" : ""}`}
                  onClick={() => update("frecuencia", f.valor)}
                >
                  <span className="enc-option-emoji">{f.emoji}</span>
                  <span>{f.valor}</span>
                </button>
              ))}
            </div>

            <label className="enc-label">¿Dónde las consigues normalmente?</label>
            <div className="enc-options enc-options--wrap">
              {LUGARES.map((l) => (
                <button
                  key={l.valor}
                  className={`enc-option ${form.lugar === l.valor ? "sel" : ""}`}
                  onClick={() => update("lugar", l.valor)}
                >
                  <span className="enc-option-emoji">{l.emoji}</span>
                  <span>{l.valor}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 3: Interés en el concepto (la estrella) */}
        {step === 3 && (
          <div className="enc-step enc-step--center">
            <div className="enc-concept">
              <span className="enc-concept-emoji">🍪</span>
              <span className="enc-concept-plus">+</span>
              <span className="enc-concept-emoji">🍫</span>
            </div>
            <h2 className="enc-q">Galleta chocochip rellena de Nutella...<br/>¿te dan ganas de probarla?</h2>
            <div className="enc-caras">
              {GANAS.map((c) => (
                <button
                  key={c.valor}
                  className={`enc-cara ${form.ganas === c.valor ? "sel" : ""}`}
                  onClick={() => update("ganas", c.valor)}
                >
                  <span className="enc-cara-emoji">{c.emoji}</span>
                  <span className="enc-cara-txt">{c.texto}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 4: Nutella + recomendación */}
        {step === 4 && (
          <div className="enc-step">
            <h2 className="enc-q">Del 1 al 5... ⭐</h2>

            <label className="enc-label">¿Qué tanto te gusta la <b>Nutella</b>?</label>
            <div className="enc-stars">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  className={`enc-star ${form.nutellaGusto >= n ? "sel" : ""}`}
                  onClick={() => update("nutellaGusto", n)}
                  aria-label={`nutella ${n}`}
                >
                  <Star size={40} fill={form.nutellaGusto >= n ? "currentColor" : "none"} />
                </button>
              ))}
            </div>

            <label className="enc-label">¿Se la <b>recomendarías a un amigo</b>?</label>
            <div className="enc-stars enc-stars--heart">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  className={`enc-star ${form.recomendaria >= n ? "sel" : ""}`}
                  onClick={() => update("recomendaria", n)}
                  aria-label={`recomendaria ${n}`}
                >
                  <Heart size={38} fill={form.recomendaria >= n ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 5: Compra + precio */}
        {step === 5 && (
          <div className="enc-step">
            <h2 className="enc-q">¿La comprarías? 💰</h2>
            <div className="enc-options enc-options--3">
              {COMPRA.map((c) => (
                <button
                  key={c.valor}
                  className={`enc-option enc-option--${c.clase} ${form.compraria === c.valor ? "sel" : ""}`}
                  onClick={() => update("compraria", c.valor)}
                >
                  <span className="enc-option-emoji">{c.emoji}</span>
                  <span>{c.valor}</span>
                </button>
              ))}
            </div>

            <label className="enc-label">¿Cuánto pagarías por ella?</label>
            <div className="enc-precios">
              {PRECIOS.map((p) => (
                <button
                  key={p.valor}
                  className={`enc-precio ${form.precio === p.valor ? "sel" : ""}`}
                  onClick={() => update("precio", p.valor)}
                >{p.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 6: Cómo la prefieres (config del producto) */}
        {step === 6 && (
          <div className="enc-step">
            <h2 className="enc-q">¿Cómo te gustaría la galleta? ✨</h2>

            <label className="enc-label">Tamaño</label>
            <div className="enc-options enc-options--3">
              {TAMANOS.map((t) => (
                <button
                  key={t.valor}
                  className={`enc-option ${form.tamano === t.valor ? "sel" : ""}`}
                  onClick={() => update("tamano", t.valor)}
                >
                  <span className="enc-option-emoji">{t.emoji}</span>
                  <span>{t.valor}</span>
                </button>
              ))}
            </div>

            <label className="enc-label">Cantidad de relleno</label>
            <div className="enc-options enc-options--2">
              {RELLENOS.map((r) => (
                <button
                  key={r.valor}
                  className={`enc-option ${form.relleno === r.valor ? "sel" : ""}`}
                  onClick={() => update("relleno", r.valor)}
                >
                  <span className="enc-option-emoji">{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            <label className="enc-label">Chispas de chocolate</label>
            <div className="enc-options enc-options--2">
              {CANT_CHISPAS.map((c) => (
                <button
                  key={c.valor}
                  className={`enc-option ${form.chispas === c.valor ? "sel" : ""}`}
                  onClick={() => update("chispas", c.valor)}
                >
                  <span className="enc-option-emoji">{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 7: Atributo + textura + comentarios */}
        {step === 7 && (
          <div className="enc-step">
            <h2 className="enc-q">Casi listo 🤩</h2>

            <label className="enc-label">Lo más importante en una galleta para ti</label>
            <div className="enc-options enc-options--wrap">
              {ATRIBUTOS.map((a) => (
                <button
                  key={a.valor}
                  className={`enc-option ${form.atributo === a.valor ? "sel" : ""}`}
                  onClick={() => update("atributo", a.valor)}
                >
                  <span className="enc-option-emoji">{a.emoji}</span>
                  <span>{a.valor}</span>
                </button>
              ))}
            </div>

            <label className="enc-label">¿Cómo te gustan más?</label>
            <div className="enc-options enc-options--2">
              <button
                className={`enc-option ${form.prefiere === "Crujiente" ? "sel" : ""}`}
                onClick={() => update("prefiere", "Crujiente")}
              >
                <span className="enc-option-emoji">🥨</span>
                <span>Crujientes</span>
              </button>
              <button
                className={`enc-option ${form.prefiere === "Suave" ? "sel" : ""}`}
                onClick={() => update("prefiere", "Suave")}
              >
                <span className="enc-option-emoji">☁️</span>
                <span>Suavecitas</span>
              </button>
            </div>

            <label className="enc-label">¿Algo más que quieras contarnos? (opcional)</label>
            <textarea
              className="enc-textarea"
              rows={3}
              placeholder="Ej: le pondría más chocolate..."
              value={form.comentarios}
              onChange={(e) => update("comentarios", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Navegación */}
      <div className="enc-nav">
        <button className="enc-btn enc-btn--ghost" onClick={back}>
          <ChevronLeft size={20} /> Atrás
        </button>
        <button
          className="enc-btn enc-btn--primary"
          onClick={next}
          disabled={!canAdvance}
        >
          {step === TOTAL_PASOS ? (
            <>¡Enviar! <PartyPopper size={20} /></>
          ) : (
            <>Siguiente <ChevronRight size={20} /></>
          )}
        </button>
      </div>

      {syncToast}
    </div>
  );
};