# Guía de instalación

Esta guía explica cómo dejar Ventas POS Pro funcionando en una computadora local: qué se necesita instalar, cómo levantar la API y el cliente web, cómo verificar que todo responde y cómo resolver los problemas más comunes.

Para una descripción general del sistema, ver el [README](README.md).

## Contenido

1. [Requisitos del equipo](#1-requisitos-del-equipo)
2. [Software necesario](#2-software-necesario)
3. [Obtener el código](#3-obtener-el-código)
4. [Opción A: instalación con Docker (PostgreSQL y Redis)](#4-opción-a-instalación-con-docker-postgresql-y-redis)
5. [Opción B: instalación rápida sin Docker (SQLite)](#5-opción-b-instalación-rápida-sin-docker-sqlite)
6. [Cliente web](#6-cliente-web)
7. [Verificar la instalación](#7-verificar-la-instalación)
8. [Ejecutar las pruebas](#8-ejecutar-las-pruebas)
9. [Configurar SUNAT para emitir comprobantes reales](#9-configurar-sunat-para-emitir-comprobantes-reales)
10. [Compilar para producción](#10-compilar-para-producción)
11. [Problemas frecuentes](#11-problemas-frecuentes)

## 1. Requisitos del equipo

| Recurso | Mínimo | Recomendado |
| --- | --- | --- |
| Sistema operativo | macOS 13, Windows 10/11 (con WSL2 si se usa Docker) o Linux con kernel 5.x | macOS 14+ o Ubuntu 22.04+ |
| Memoria RAM | 4 GB | 8 GB o más |
| Espacio en disco | 2 GB libres (dependencias + imágenes Docker) | 5 GB |
| Navegador | Chrome, Edge, Firefox o Safari en su última versión | Chrome o Edge |
| Red | Solo para instalar dependencias. En modo `simulate` el sistema no necesita internet | Conexión estable si se envía a SUNAT |

Opcional: un lector de código de barras USB. El POS lo trata como un teclado, así que funciona sin drivers adicionales.

## 2. Software necesario

| Herramienta | Versión | Para qué se usa |
| --- | --- | --- |
| PHP | 8.3 o superior | Ejecutar la API Laravel |
| Composer | 2.x | Instalar dependencias de PHP |
| Node.js | 20.19+ o 22.12+ | Ejecutar y compilar el cliente React (requisito de Vite 7) |
| npm | 10+ (viene con Node.js) | Instalar dependencias del cliente |
| Docker Desktop / Docker Engine | 24+ con Docker Compose v2 | PostgreSQL 17 y Redis 7 (opción A) |
| Git | 2.x | Clonar el repositorio |
| OpenSSL | Cualquier versión reciente | Generar el certificado de prueba y convertir certificados reales |

### Extensiones de PHP

Comprueba las extensiones instaladas con `php -m`. Deben aparecer todas estas:

| Extensión | Motivo |
| --- | --- |
| `bcmath` | Cálculo de precios, IGV y costos sin errores de redondeo |
| `dom`, `xml`, `libxml` | Generación y firma del XML UBL 2.1 |
| `openssl` | Firma digital del comprobante y certificado de prueba |
| `soap` | Envío a los servicios web de SUNAT |
| `zlib` y `zip` | Compresión del XML que se envía a SUNAT y lectura del CDR |
| `pdo_pgsql` | Conexión a PostgreSQL (opción A) |
| `pdo_sqlite` | Conexión a SQLite (opción B y pruebas automatizadas) |
| `mbstring`, `curl`, `fileinfo`, `tokenizer`, `ctype` | Requeridas por Laravel |

### Instalación por sistema operativo

**macOS (Homebrew)**

```bash
brew install php composer node git
brew install --cask docker
```

La fórmula `php` de Homebrew ya incluye `bcmath`, `soap`, `pdo_pgsql` y `pdo_sqlite`.

**Ubuntu / Debian**

```bash
sudo apt update
sudo apt install php8.3-cli php8.3-bcmath php8.3-xml php8.3-soap php8.3-zip \
  php8.3-pgsql php8.3-sqlite3 php8.3-mbstring php8.3-curl unzip git
# Composer: https://getcomposer.org/download/
# Node.js 22: https://nodejs.org/ o con nvm
```

**Windows**

La forma más simple es trabajar dentro de WSL2 con Ubuntu y seguir los pasos de Linux. Si se prefiere Windows nativo, se puede usar [Laragon](https://laragon.org/) o la distribución oficial de PHP, activando en `php.ini` las líneas `extension=bcmath`, `extension=soap`, `extension=zip`, `extension=pdo_pgsql`, `extension=pdo_sqlite` y `extension=openssl`.

## 3. Obtener el código

```bash
git clone https://github.com/luid-dev/ventas-pos-pro.git
cd ventas-pos-pro
```

El repositorio tiene dos aplicaciones independientes:

```text
ventas-pos-pro/
├── docker-compose.yml   PostgreSQL y Redis
├── backend/             API REST en Laravel
└── frontend/            Cliente web en React + TypeScript
```

## 4. Opción A: instalación con Docker (PostgreSQL y Redis)

Es la configuración equivalente a producción y la recomendada.

### 4.1 Levantar los servicios

Desde la raíz del proyecto:

```bash
docker compose up -d
docker compose ps
```

Se levantan dos contenedores, accesibles solo desde `127.0.0.1`:

| Servicio | Imagen | Puerto | Credenciales |
| --- | --- | --- | --- |
| PostgreSQL | `postgres:17.6-bookworm` | 5432 | usuario `postgres`, contraseña `secret`, base `ventas_pos_pro` |
| Redis | `redis:7.4.6-alpine` | 6379 | sin contraseña |

Espera a que ambos aparezcan como `healthy`. Si los puertos ya están ocupados por otra instalación:

```bash
FORWARD_DB_PORT=5433 FORWARD_REDIS_PORT=6380 docker compose up -d
```

En ese caso cambia también `DB_PORT=5433` y `REDIS_PORT=6380` en `backend/.env`.

### 4.2 Configurar la API

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

`.env.example` ya apunta a los contenedores de Docker, así que no hace falta editar nada más para trabajar en local.

El comando `migrate --seed` crea las tablas y carga la configuración local de SAN CRISTOBAL-PAKAMUROS E.I.R.L.: usuarios iniciales, roles, almacén, caja, series de comprobantes, catálogo con stock inicial, cliente genérico y un certificado autofirmado en `storage/app/sunat/demo-cert.pem` para firmar en modo simulación.

### 4.3 Iniciar la API

```bash
php artisan serve
```

La API queda disponible en `http://localhost:8000/api/v1`. Deja esta terminal abierta.

## 5. Opción B: instalación rápida sin Docker (SQLite)

Útil para revisar el sistema sin instalar Docker. No usa Redis: cache, sesiones y colas se guardan en la base de datos.

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edita `backend/.env` y deja estas variables así (borra la línea `DB_DATABASE` y las demás `DB_*` pueden quedarse, se ignoran):

```dotenv
DB_CONNECTION=sqlite
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
```

Luego crea la base y cárgala:

```bash
touch database/database.sqlite
php artisan migrate --seed
php artisan serve
```

En Windows nativo, en lugar de `touch` crea un archivo vacío llamado `database.sqlite` dentro de `backend/database/`.

## 6. Cliente web

En otra terminal, desde la raíz del proyecto:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

El cliente queda en `http://localhost:5173`. Las variables de `frontend/.env` son:

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | URL de la API, sin barra final |
| `VITE_APP_NAME` | `Ventas POS Pro` | Nombre que se muestra si la empresa no define uno |
| `VITE_APP_ENV` | `development` | `development`, `staging` o `production` |

Si la API corre en otro host o puerto, cambia `VITE_API_BASE_URL` y agrega el origen del cliente a `CORS_ALLOWED_ORIGINS` en `backend/.env`.

## 7. Verificar la instalación

1. Comprueba la API:

   ```bash
   curl http://localhost:8000/api/v1/health
   ```

   Debe responder `"status":"available"`.

2. Abre `http://localhost:5173` e inicia sesión con una de las cuentas locales iniciales. Estas credenciales son solo para local/pruebas: no las uses en producción y reemplázalas antes del lanzamiento:

   | Rol | Correo | Contraseña |
   | --- | --- | --- |
   | Administrador | `admin@ventaspos.pe` | `Password123!` |
   | Cajero | `cajero@ventaspos.pe` | `Password123!` |

3. Entra a **Punto de venta**, agrega un producto y cobra una boleta. Si se muestra el ticket con el código QR, la instalación está completa.

Para empezar de cero con los datos locales de San Cristóbal en cualquier momento:

```bash
cd backend
php artisan migrate:fresh --seed
```

## 8. Ejecutar las pruebas

```bash
cd backend
php artisan test            # pruebas de integración (SQLite en memoria)
vendor/bin/pint --test      # estilo de código
```

```bash
cd frontend
npm run typecheck           # TypeScript estricto
npm run lint                # oxlint
npm run build               # compilación de producción
```

Para correr las pruebas de la API sobre PostgreSQL en lugar de SQLite:

```bash
docker compose exec postgres createdb -U postgres ventas_pos_pro_test
cd backend
DB_CONNECTION=pgsql DB_DATABASE=ventas_pos_pro_test php artisan test
```

## 9. Configurar SUNAT para emitir comprobantes reales

> **Importante:** tal como se entrega, el sistema trabaja en modo de prueba. Firma los comprobantes con un certificado autofirmado y no los envía a SUNAT, por lo que **no tienen validez tributaria**. Para usarlo en un negocio real hay que configurar los datos propios de la empresa ante SUNAT.

Si quieres implementarlo en tu negocio y prefieres que lo configure y adapte por ti, escríbeme desde mi perfil de GitHub: [github.com/luid-dev](https://github.com/luid-dev).

### 9.1 Qué se necesita

- RUC activo y habilitado como emisor electrónico desde el sistema del contribuyente.
- Un **usuario SOL secundario** con perfil de facturación electrónica (se crea desde SUNAT Operaciones en Línea).
- Un **certificado digital** emitido por una entidad acreditada (normalmente se entrega como `.pfx` o `.p12` con su contraseña).

### 9.2 Convertir el certificado

El sistema lee el certificado en formato PEM sin contraseña. Para convertir el `.pfx`:

```bash
openssl pkcs12 -in certificado.pfx -out backend/storage/app/sunat/certificado.pem -nodes
```

Con OpenSSL 3 y certificados antiguos puede hacer falta agregar `-legacy`. La carpeta `storage/app/sunat/` está excluida de Git; el certificado nunca debe subirse al repositorio.

### 9.3 Variables de entorno

En `backend/.env`:

```dotenv
SUNAT_MODE=live                 # simulate | auto | live
SUNAT_ENVIRONMENT=beta          # beta para pruebas con SUNAT, production para emitir
SUNAT_SOL_RUC=20XXXXXXXXX       # RUC del emisor
SUNAT_SOL_USER=USUARIO1         # usuario SOL secundario
SUNAT_SOL_PASSWORD=clave_sol
SUNAT_CERTIFICATE_PATH=sunat/certificado.pem
```

| `SUNAT_MODE` | Comportamiento |
| --- | --- |
| `simulate` | Firma el XML y genera un CDR local. No sale a internet. Es el valor por defecto. |
| `auto` | Intenta enviar a SUNAT y, si no hay conexión, usa la simulación. |
| `live` | Exige respuesta real de SUNAT. |

Con las variables vacías y `SUNAT_ENVIRONMENT=beta`, el envío usa las credenciales públicas de prueba de SUNAT (`MODDATOS`), que solo sirven para el entorno beta.

Las credenciales también pueden guardarse por empresa dentro de `companies.settings.sunat` (`sol_ruc`, `sol_user`, `sol_password`, `certificate_path`, `environment`). Esos campos se cifran con la `APP_KEY` y tienen prioridad sobre el `.env`, lo que permite que cada empresa de la misma instalación emita con su propio RUC.

### 9.4 Datos de la empresa

La instalación local crea SAN CRISTOBAL-PAKAMUROS E.I.R.L. (RUC `20607442381`) mediante `database/seeders/DemoPortfolioSeeder.php`, junto con su almacén principal, caja, series (`NV01`, `B001`, `F001`, `FC01`, `BC01`) y catálogo inicial. La pantalla de configuración de empresa todavía está en desarrollo, por lo que actualmente estos datos se administran en la base de datos y en el seeder de desarrollo.

Antes de pasar a `production`, emite varios comprobantes en `beta` y revisa que el CDR devuelto por SUNAT sea de aceptación.

## 10. Compilar para producción

Cliente web:

```bash
cd frontend
VITE_API_BASE_URL=https://api.tudominio.pe/api/v1 VITE_APP_ENV=production npm run build
```

Los archivos estáticos quedan en `frontend/dist/` y pueden servirse con Nginx, Apache o cualquier hosting estático.

API:

```bash
cd backend
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
php artisan migrate --force
```

En el `.env` de producción: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` con HTTPS, `FRONTEND_URL` y `CORS_ALLOWED_ORIGINS` con el dominio real del cliente, y contraseñas propias para PostgreSQL y Redis. La API debe publicarse detrás de un servidor web (Nginx + PHP-FPM) con certificado TLS. No ejecutes `--seed` en producción: el seeder crea usuarios de demostración con contraseña conocida.

## 11. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `could not find driver` al migrar | Falta `pdo_pgsql` o `pdo_sqlite` | Instala la extensión y verifica con `php -m` |
| `Call to undefined function bcadd()` | Falta `bcmath` | Instala o activa la extensión `bcmath` |
| `Class "SoapClient" not found` | Falta `soap` | Instala o activa la extensión `soap` |
| `Connection refused` en el puerto 5432 o 6379 | Los contenedores no están corriendo | `docker compose up -d` y espera el estado `healthy` |
| `address already in use` al levantar Docker | Hay otro PostgreSQL o Redis en esos puertos | Usa `FORWARD_DB_PORT` y `FORWARD_REDIS_PORT` (sección 4.1) |
| El login muestra "No se pudo conectar con el servidor" | La API no está corriendo o la URL no coincide | Revisa `php artisan serve` y `VITE_API_BASE_URL` |
| Error de CORS en la consola del navegador | El origen del cliente no está permitido | Agrega la URL del cliente a `CORS_ALLOWED_ORIGINS` y ejecuta `php artisan config:clear` |
| "No se encontró el certificado digital configurado" | No existe el archivo de `SUNAT_CERTIFICATE_PATH` | Ejecuta `php artisan db:seed` para regenerar el certificado de prueba o revisa la ruta del certificado real |
| `npm ci` falla por la versión de Node | Node.js anterior a 20.19 | Actualiza Node.js a 20.19+ o 22.12+ |
| Cambios en `.env` que no se aplican | Configuración en caché | `php artisan config:clear` |
