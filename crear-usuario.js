// Crea o actualiza un usuario en el archivo de credenciales.
// Uso: npm run crear-usuario                    (pregunta el usuario)
//      npm run crear-usuario -- juan            (usuario como argumento)
//      npm run crear-usuario -- juan --admin    (lo deja como administrador)
// El primer usuario del archivo queda como administrador automáticamente.
// Una vez exista un admin, lo normal es crear usuarios desde la página "Usuarios".
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { hashClave, leerUsuarios, guardarUsuarios, validarNuevoUsuario, rolDe, MIN_CLAVE } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archivo = path.resolve(__dirname, process.env.CREDENTIALS_FILE || "credenciales.json");

function preguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      // Muestra asteriscos en lugar de la contraseña
      rl._writeToOutput = (s) => {
        if (/^[\r\n]+$/.test(s)) process.stdout.write(s);
        else if (s.startsWith(texto)) process.stdout.write(texto + "*".repeat(s.length - texto.length));
        else process.stdout.write("*".repeat(s.length));
      };
    }
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta);
    });
  });
}

const args = process.argv.slice(2);
const comoAdmin = args.includes("--admin");
const usuario = (args.find((a) => !a.startsWith("--")) || (await preguntar("Usuario: "))).trim();

const errorUsuario = validarNuevoUsuario({ usuario });
if (errorUsuario) {
  console.error(errorUsuario);
  process.exit(1);
}

const clave = await preguntar(`Contraseña (mínimo ${MIN_CLAVE} caracteres): `, true);
const errorClave = validarNuevoUsuario({ usuario, clave });
if (errorClave) {
  console.error(errorClave);
  process.exit(1);
}
if ((await preguntar("Repite la contraseña: ", true)) !== clave) {
  console.error("Las contraseñas no coinciden.");
  process.exit(1);
}

const usuarios = fs.existsSync(archivo) ? leerUsuarios(archivo) : [];
const existente = usuarios.find((u) => u.usuario === usuario);
// Conserva el rol actual al cambiar la contraseña, salvo que se pida --admin
const rol = comoAdmin || usuarios.length === 0 ? "admin" : rolDe(existente);
const actualizado = { usuario, rol, hash: hashClave(clave), actualizado: new Date().toISOString() };

guardarUsuarios(archivo, [...usuarios.filter((u) => u.usuario !== usuario), actualizado]);
console.log(`${existente ? "Contraseña actualizada" : "Usuario creado"}: ${usuario} (${rol}) → ${archivo}`);
