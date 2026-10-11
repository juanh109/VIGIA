// Login con usuario y contraseña. Las credenciales viven en un archivo JSON con la
// contraseña hasheada (scrypt); las sesiones se guardan en memoria del servidor.
import crypto from "node:crypto";
import fs from "node:fs";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const COOKIE = "vigia_sesion";
const DURACION_MS = 8 * 60 * 60 * 1000; // la sesión dura 8 horas
const MAX_FALLOS = 5;                   // intentos fallidos antes de bloquear
const BLOQUEO_MS = 15 * 60 * 1000;      // tiempo de bloqueo por IP
const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashClave(clave) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(clave, sal, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString("hex")}$${hash.toString("hex")}`;
}

async function verificarClave(clave, guardado) {
  const [alg, N, r, p, salHex, hashHex] = String(guardado).split("$");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtenido = await scrypt(clave, Buffer.from(salHex, "hex"), esperado.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(obtenido, esperado);
}

export const USUARIO_RE = /^[\w.@-]{3,50}$/;
export const MIN_CLAVE = 12;
export const ROLES = ["admin", "usuario"];
export const rolDe = (u) => (u?.rol === "admin" ? "admin" : "usuario");

export function leerUsuarios(archivo) {
  const datos = JSON.parse(fs.readFileSync(archivo, "utf8"));
  return Array.isArray(datos.usuarios) ? datos.usuarios : [];
}

// Escribe a un temporal y lo renombra, para no dejar el archivo a medias si algo falla
export function guardarUsuarios(archivo, usuarios) {
  const tmp = `${archivo}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ usuarios }, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, archivo);
  try {
    fs.chmodSync(archivo, 0o600);
  } catch {
    // Algunos sistemas de archivos (p. ej. un bucket de Cloud Storage montado) no soportan chmod
  }
}

export function validarNuevoUsuario({ usuario, clave, rol }) {
  if (typeof usuario !== "string" || !USUARIO_RE.test(usuario)) {
    return "Usuario inválido: usa de 3 a 50 caracteres (letras, números, punto, guion, guion bajo o @).";
  }
  if (clave !== undefined && (typeof clave !== "string" || clave.length < MIN_CLAVE || clave.length > 200)) {
    return `La contraseña debe tener entre ${MIN_CLAVE} y 200 caracteres.`;
  }
  if (rol !== undefined && !ROLES.includes(rol)) return "Rol inválido.";
  return null;
}

export function crearAuth({ archivo }) {
  const sesiones = new Map(); // token -> { usuario, expira }
  const intentos = new Map(); // ip -> { fallos, bloqueadoHasta }
  // Hash de relleno: si el usuario no existe igual se calcula un scrypt, para que el
  // tiempo de respuesta no revele qué usuarios existen.
  const HASH_RELLENO = hashClave(crypto.randomBytes(16).toString("hex"));

  setInterval(() => {
    const ahora = Date.now();
    for (const [token, s] of sesiones) if (s.expira < ahora) sesiones.delete(token);
    for (const [ip, i] of intentos) if (i.bloqueadoHasta && i.bloqueadoHasta < ahora) intentos.delete(ip);
  }, 10 * 60 * 1000).unref();

  function leerCookie(req) {
    const par = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
    return par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : null;
  }

  function sesionDe(req) {
    const token = leerCookie(req);
    if (!token) return null;
    const s = sesiones.get(token);
    if (!s || s.expira < Date.now()) {
      sesiones.delete(token);
      return null;
    }
    return { token, ...s };
  }

  function cookie(req, valor, maxAgeSeg) {
    return `${COOKIE}=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeg}${req.secure ? "; Secure" : ""}`;
  }

  async function login(req, res) {
    const ip = req.ip;
    const registro = intentos.get(ip) || { fallos: 0, bloqueadoHasta: 0 };
    if (registro.bloqueadoHasta > Date.now()) {
      return res.status(429).json({ error: "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo." });
    }

    const { usuario, clave } = req.body || {};
    if (typeof usuario !== "string" || typeof clave !== "string" || !usuario.trim() || !clave || clave.length > 200) {
      return res.status(400).json({ error: "Escribe tu usuario y tu contraseña." });
    }

    let usuarios;
    try {
      usuarios = leerUsuarios(archivo);
    } catch (e) {
      console.error("No se pudo leer el archivo de credenciales:", e.message);
      return res.status(500).json({ error: "El servidor no pudo leer las credenciales." });
    }

    const u = usuarios.find((x) => x.usuario === usuario.trim());
    const claveOk = await verificarClave(clave, u?.hash ?? HASH_RELLENO);
    if (!u || !claveOk) {
      registro.fallos += 1;
      if (registro.fallos >= MAX_FALLOS) {
        registro.fallos = 0;
        registro.bloqueadoHasta = Date.now() + BLOQUEO_MS;
        console.warn(`Login bloqueado temporalmente para ${ip}`);
      }
      intentos.set(ip, registro);
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }

    intentos.delete(ip);
    const token = crypto.randomBytes(32).toString("base64url");
    sesiones.set(token, { usuario: u.usuario, expira: Date.now() + DURACION_MS });
    res.setHeader("Set-Cookie", cookie(req, token, DURACION_MS / 1000));
    res.json({ usuario: u.usuario });
  }

  function logout(req, res) {
    const s = sesionDe(req);
    if (s) sesiones.delete(s.token);
    res.setHeader("Set-Cookie", cookie(req, "", 0));
    res.json({ ok: true });
  }

  function requerirSesion(req, res, next) {
    const s = sesionDe(req);
    if (s) {
      req.usuario = s.usuario;
      return next();
    }
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
    }
    res.redirect("/login.html");
  }

  function cerrarSesionesDe(usuario) {
    for (const [token, s] of sesiones) if (s.usuario === usuario) sesiones.delete(token);
  }

  // El rol se lee del archivo en cada solicitud, así un cambio de rol aplica de inmediato
  function rolActual(usuario) {
    return rolDe(leerUsuarios(archivo).find((u) => u.usuario === usuario));
  }

  function sesion(req, res) {
    res.json({ usuario: req.usuario, rol: rolActual(req.usuario) });
  }

  function requerirAdmin(req, res, next) {
    if (rolActual(req.usuario) === "admin") return next();
    res.status(403).json({ error: "Solo un administrador puede hacer esto." });
  }

  // --- Administración de usuarios (solo admin) -------------------------------
  const publico = (u) => ({ usuario: u.usuario, rol: rolDe(u), actualizado: u.actualizado ?? null });
  const quedaOtroAdmin = (usuarios, excepto) => usuarios.some((u) => u.usuario !== excepto && rolDe(u) === "admin");

  function listarUsuarios(req, res) {
    res.json({ usuarios: leerUsuarios(archivo).map(publico).sort((a, b) => a.usuario.localeCompare(b.usuario)) });
  }

  function crearUsuario(req, res) {
    const usuario = String(req.body?.usuario || "").trim();
    const { clave } = req.body || {};
    const rol = req.body?.rol || "usuario";
    const error = validarNuevoUsuario({ usuario, clave: clave ?? "", rol });
    if (error) return res.status(400).json({ error });

    const usuarios = leerUsuarios(archivo);
    if (usuarios.some((u) => u.usuario === usuario)) {
      return res.status(409).json({ error: "Ese usuario ya existe." });
    }
    const nuevo = { usuario, rol, hash: hashClave(clave), actualizado: new Date().toISOString() };
    guardarUsuarios(archivo, [...usuarios, nuevo]);
    console.log(`${req.usuario} creó el usuario ${usuario} (${rol})`);
    res.status(201).json(publico(nuevo));
  }

  function actualizarUsuario(req, res) {
    const usuario = req.params.usuario;
    const { clave, rol } = req.body || {};
    if (clave === undefined && rol === undefined) return res.status(400).json({ error: "No hay cambios." });
    const error = validarNuevoUsuario({ usuario, clave, rol });
    if (error) return res.status(400).json({ error });

    const usuarios = leerUsuarios(archivo);
    const u = usuarios.find((x) => x.usuario === usuario);
    if (!u) return res.status(404).json({ error: "Ese usuario no existe." });
    if (rol === "usuario" && rolDe(u) === "admin" && !quedaOtroAdmin(usuarios, usuario)) {
      return res.status(409).json({ error: "Debe quedar al menos un administrador." });
    }

    if (rol !== undefined) u.rol = rol;
    if (clave !== undefined) u.hash = hashClave(clave);
    u.actualizado = new Date().toISOString();
    guardarUsuarios(archivo, usuarios);
    // Con contraseña nueva, el usuario debe volver a entrar (salvo el admin que se la cambia a sí mismo)
    if (clave !== undefined && usuario !== req.usuario) cerrarSesionesDe(usuario);
    console.log(`${req.usuario} actualizó el usuario ${usuario}${rol ? ` (rol: ${rol})` : ""}${clave ? " (contraseña)" : ""}`);
    res.json(publico(u));
  }

  function eliminarUsuario(req, res) {
    const usuario = req.params.usuario;
    if (usuario === req.usuario) return res.status(409).json({ error: "No puedes eliminar tu propio usuario." });
    const usuarios = leerUsuarios(archivo);
    const u = usuarios.find((x) => x.usuario === usuario);
    if (!u) return res.status(404).json({ error: "Ese usuario no existe." });
    if (rolDe(u) === "admin" && !quedaOtroAdmin(usuarios, usuario)) {
      return res.status(409).json({ error: "Debe quedar al menos un administrador." });
    }
    guardarUsuarios(archivo, usuarios.filter((x) => x.usuario !== usuario));
    cerrarSesionesDe(usuario);
    console.log(`${req.usuario} eliminó el usuario ${usuario}`);
    res.json({ ok: true });
  }

  return {
    login, logout, requerirSesion, sesion, requerirAdmin,
    listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario,
  };
}
