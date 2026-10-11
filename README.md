# Vigía – agente de code review

Revisa la calidad del código con Claude, de tres formas:

- **Comparar versiones:** diff entre dos ramas, tags o commits de un repo de GitHub.
- **Proyecto completo desde GitHub:** los archivos de una rama.
- **Proyecto completo subido:** una carpeta, archivos sueltos o un .zip cargados desde la página.

## Uso
1. `npm install`
2. Copia `.env.example` a `.env` y pon tu `ANTHROPIC_API_KEY` (y `GITHUB_TOKEN` si el repo es privado).
3. Crea el primer usuario: `npm run crear-usuario` (o `npm run crear-usuario -- juan`). Pide la contraseña dos veces (mínimo 12 caracteres). El primer usuario queda como administrador.
4. `npm start` y abre http://localhost:3000

Para publicarlo en Google Cloud Run, sigue [DEPLOY.md](DEPLOY.md). La especificación y la arquitectura (diagramas de componentes y de secuencia) están en [docs/SPEC.md](docs/SPEC.md).

## Versiones
La versión está en `package.json` y se muestra en el login y en el pie de la aplicación. Para publicar una versión nueva:
1. Sube el número con versionado semántico: `npm version patch --no-git-tag-version` (corrección), `minor` (función nueva) o `major` (cambio incompatible).
2. Anota los cambios en [CHANGELOG.md](CHANGELOG.md).
3. Despliega (ver [DEPLOY.md](DEPLOY.md)).

## Usuarios y roles
- **Administrador:** usa Vigía y además ve el botón **Usuarios**, desde donde crea usuarios, cambia contraseñas y roles, y elimina cuentas.
- **Usuario:** solo usa Vigía.
- Siempre debe quedar al menos un administrador, y nadie puede eliminar su propia cuenta.
- Al cambiar la contraseña de alguien o eliminarlo, se cierran sus sesiones abiertas.
- Desde la consola también se puede: `npm run crear-usuario -- correo@terpel.com --admin` (crea un admin o recupera el acceso si se olvida la contraseña). No hace falta reiniciar el servidor.

## Login
- Las credenciales están en `credenciales.json` (ruta configurable con `CREDENTIALS_FILE`). La contraseña se guarda hasheada con scrypt, nunca en texto plano.
- La sesión dura 8 horas, en una cookie `HttpOnly` y `SameSite=Strict`. Las sesiones viven en memoria: al reiniciar el servidor hay que volver a entrar.
- Tras 5 intentos fallidos desde la misma IP, el login se bloquea 15 minutos.
- No subas `credenciales.json` ni `.env` a un repositorio (ya están en `.gitignore`).

## Red corporativa (Netskope)
La red de Terpel inspecciona el tráfico HTTPS con Netskope. Node.js no confía en ese certificado por defecto, así que `npm start` arranca con `--use-system-ca` para usar los certificados del llavero del Mac. Si arrancas el servidor a mano, usa `node --use-system-ca server.js`.

## Seguridad
- Por defecto el servidor solo escucha en este equipo (`HOST=127.0.0.1`). Si lo abres a la red con `HOST=0.0.0.0`, ponlo detrás de HTTPS.
- Las claves de Anthropic y GitHub viven solo en el servidor; el navegador nunca las ve.
- Los archivos `.env` nunca se envían al agente: en el diff y en el proyecto se omite su contenido y se reportan como hallazgo.

## Cómo funciona
- `GET /api/refs?repo=dueño/repo` → ramas y tags para autocompletar.
- `POST /api/review {repo, base, head}` → llama a `GitHub /compare/base...head` (formato diff) y lo envía al agente.
- `POST /api/review-project {repo, ref}` → lee los archivos de la rama desde GitHub.
- `POST /api/review-upload {name, files, envFiles}` → revisa archivos cargados desde la página.
- La respuesta del agente usa *structured outputs* (JSON schema), así que siempre llega en el formato esperado.

## Siguientes pasos
- Mover los usuarios a un proveedor de identidad (por ejemplo, Entra ID de Terpel) en lugar del archivo.
- Webhook de GitHub para revisar cada Pull Request automáticamente y comentar en el PR.
- Guardar historial de puntajes por repo para ver tendencia.
