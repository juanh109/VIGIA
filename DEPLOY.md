# Publicar Vigía en Google Cloud Run

Se despliega desde **Cloud Shell** (la terminal de Google Cloud en el navegador): no necesitas instalar `gcloud` ni Docker, y no te afecta el proxy de la red.

## Cómo queda armado

| Pieza | Dónde vive |
|---|---|
| Código | Imagen de contenedor construida por Cloud Build desde el `Dockerfile` |
| `ANTHROPIC_API_KEY` (y `GITHUB_TOKEN` si lo usas) | Secret Manager |
| `credenciales.json` (usuarios) | Bucket de Cloud Storage montado en `/data` (persiste entre reinicios) |
| Sesiones de login | Memoria del servidor → el servicio corre con **1 instancia máxima** |

## Antes de empezar

- Un **proyecto de Google Cloud con facturación activa** y permisos para crear servicios de Cloud Run, buckets, secretos y cuentas de servicio (rol Owner/Editor, o pídele al equipo de nube de Terpel que lo haga contigo).
- Tu **`credenciales.json`** local, con tu usuario administrador ya creado.

## 1. Empaqueta el proyecto (en tu Mac)

```bash
cd "/Users/juanhernandez/Library/CloudStorage/OneDrive-OrganizaciónTERPELS.A/Terpel01/33_Cursosr/vigia"
zip -r ~/Desktop/vigia.zip . -x "node_modules/*" ".env" "credenciales.json*" ".DS_Store"
cp credenciales.json ~/Desktop/
```

Quedan en el Escritorio `vigia.zip` (sin claves) y `credenciales.json`.

## 2. Abre Cloud Shell y sube los archivos

1. Entra a https://console.cloud.google.com y elige tu proyecto.
2. Arriba a la derecha, pulsa el ícono **Activar Cloud Shell** (`>_`).
3. En la barra de Cloud Shell: menú **⋮ → Subir** → sube `vigia.zip` y `credenciales.json`.
4. Descomprime:

```bash
mkdir -p vigia && cd vigia && unzip -o ../vigia.zip && mv ../credenciales.json .
```

## 3. Variables y servicios

Cambia `TU-PROYECTO` por el ID de tu proyecto:

```bash
PROYECTO=TU-PROYECTO
REGION=us-east1
BUCKET=${PROYECTO}-vigia-datos
SA=vigia-run@${PROYECTO}.iam.gserviceaccount.com

gcloud config set project $PROYECTO
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com storage.googleapis.com
```

> Si se cierra Cloud Shell, vuelve a ejecutar las cuatro líneas de variables antes de seguir.

## 4. Cuenta de servicio

```bash
gcloud iam service-accounts create vigia-run --display-name "Vigia Cloud Run"
```

## 5. Secretos

La clave se escribe sin que se vea ni quede en el historial (pégala y pulsa Enter):

```bash
read -rs CLAVE && printf '%s' "$CLAVE" | gcloud secrets create anthropic-api-key --data-file=- && unset CLAVE
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member serviceAccount:$SA --role roles/secretmanager.secretAccessor
```

Solo si vas a revisar repos **privados** de GitHub:

```bash
read -rs TOKEN && printf '%s' "$TOKEN" | gcloud secrets create github-token --data-file=- && unset TOKEN
gcloud secrets add-iam-policy-binding github-token \
  --member serviceAccount:$SA --role roles/secretmanager.secretAccessor
```

## 6. Bucket para los usuarios

```bash
gcloud storage buckets create gs://$BUCKET --location $REGION \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage cp credenciales.json gs://$BUCKET/credenciales.json
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member serviceAccount:$SA --role roles/storage.objectUser
rm credenciales.json
```

## 7. Desplegar

```bash
gcloud run deploy vigia --source . --region $REGION \
  --service-account $SA \
  --execution-environment gen2 \
  --add-volume name=datos,type=cloud-storage,bucket=$BUCKET \
  --add-volume-mount volume=datos,mount-path=/data \
  --set-env-vars CREDENTIALS_FILE=/data/credenciales.json,TRUST_PROXY=1,ANTHROPIC_MODEL=claude-sonnet-5-5 \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --max-instances 1 --timeout 900 --memory 512Mi \
  --allow-unauthenticated
```

- Si creaste el secreto de GitHub, cambia la línea de secretos por:
  `--set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest,GITHUB_TOKEN=github-token:latest`
- La primera vez pregunta si crea un repositorio de Artifact Registry: responde **Y**.
- Tarda unos minutos. Al final muestra la URL: `https://vigia-xxxxx.us-east1.run.app`. Ábrela y entra con tu usuario.

## Actualizar a una versión nueva

Sube el zip nuevo a Cloud Shell, descomprímelo en `~/vigia`, define las variables del paso 3 y repite el paso 7. Los usuarios no se pierden: viven en el bucket.

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| `... allowedPolicyMemberDomains` o no deja usar `--allow-unauthenticated` | Política de la organización Terpel que impide servicios públicos. Pide al equipo de nube una excepción para el proyecto o publicarlo con IAP (acceso solo con cuentas @terpel.com). |
| Error de permisos de Cloud Build al desplegar | En proyectos nuevos, la cuenta de Cloud Build necesita permisos. Dale a la cuenta `PROJECT_NUMBER-compute@developer.gserviceaccount.com` el rol **Cloud Run Builder** (`roles/run.builder`), o pide ayuda al equipo de nube. |
| La URL muestra "Service Unavailable" | Revisa los logs: `gcloud run services logs read vigia --region $REGION`. Si dice que no existe el archivo de credenciales, falta el paso 6. |
| Tras un rato sin uso hay que volver a iniciar sesión | Normal: Cloud Run apaga la instancia cuando nadie la usa y las sesiones están en memoria. Para evitarlo, añade `--min-instances 1` (tiene costo mensual). |

## Costos

Cloud Run cobra solo mientras atiende solicitudes (con `--min-instances 0`, el valor por defecto). Para una herramienta interna el costo de Google Cloud suele ser mínimo; el gasto principal es el uso de la API de Anthropic.

## Seguridad

- La URL de Cloud Run es pública en internet: el login de Vigía es la única barrera. Usa contraseñas largas y crea solo los usuarios necesarios.
- Para más protección, pon el servicio detrás de **IAP** (Identity-Aware Proxy) para que solo cuentas de Terpel lleguen a la página de login.
- Nunca subas `.env` ni `credenciales.json` al zip ni a un repositorio (`.gcloudignore` y `.dockerignore` ya los excluyen).
