# Historial de versiones

Vigía usa [versionado semántico](https://semver.org/lang/es/) `MAYOR.MENOR.PARCHE`:

- **MAYOR**: cambios que rompen compatibilidad (por ejemplo, otro formato de credenciales o de la API).
- **MENOR**: funciones nuevas compatibles.
- **PARCHE**: correcciones sin funciones nuevas.

La versión vive solo en `package.json`; el servidor la muestra en el login, en el pie de la aplicación, en `GET /api/version` y en el log de arranque.

## 1.3.0 – 2026-10-11
- Versión visible en la pantalla de login y en el pie de la aplicación (`GET /api/version`).
- Historial de versiones (este archivo).

## 1.2.0 – 2026-10-11
- Revisión contra 16 atributos de calidad de talla mundial (ISO/IEC 25010, OWASP, WCAG, SRE, DORA, 12-factor, IA responsable), con "No aplica" cuando no se pueden juzgar.
- Nivel de madurez (prototipo, piloto, producción interna, talla mundial) y pasos para subir de nivel.
- Cada hallazgo indica el atributo afectado; un hallazgo crítico de seguridad o privacidad obliga a rechazar.
- SPEC con diagramas de componentes y de secuencia (`docs/SPEC.md`).

## 1.1.0 – 2026-10-10
- Login con usuario y contraseña (scrypt), sesiones de 8 horas y bloqueo por intentos fallidos.
- Roles administrador / usuario y página de administración de usuarios.
- Despliegue en Google Cloud Run (Dockerfile, Secret Manager, bucket de Cloud Storage).
- Los archivos `.env` nunca se envían al modelo; diff recortado entre archivos.
- SDK de Anthropic actualizado, streaming y structured outputs (JSON schema).
- Servidor solo en `127.0.0.1` por defecto; compatibilidad con el proxy corporativo (`--use-system-ca`).

## 1.0.0
- Versión inicial: revisión de diff entre versiones, proyecto completo desde GitHub y proyecto subido.
