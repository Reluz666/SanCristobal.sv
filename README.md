# Ventas POS Pro

Sistema de punto de venta, control de inventario con Kardex valorizado y facturación electrónica SUNAT (UBL 2.1) para empresas peruanas. Está compuesto por una API REST en Laravel y un cliente web en React con TypeScript.

Una misma instalación atiende a varias empresas con sus datos aislados. El punto de venta permite registrar ventas directamente, con lector de código de barras o teclado. La apertura y el cierre de caja son opcionales y, en la configuración local de San Cristóbal, están desactivados.

> [!IMPORTANT]
> **Esta es una versión de demostración.** La facturación electrónica viene configurada en modo de prueba: los comprobantes se firman con un certificado autofirmado y **no se envían a SUNAT**, por lo que no tienen validez tributaria. Para usar el sistema en un negocio real es obligatorio configurar la conexión con SUNAT (RUC, usuario SOL secundario y certificado digital propios). Los pasos están en [INSTALLATION.md, sección 9](INSTALLATION.md#9-configurar-sunat-para-emitir-comprobantes-reales).
>
> **¿Quieres usarlo en tu negocio?** Escríbeme desde mi perfil de GitHub, [github.com/luid-dev](https://github.com/luid-dev), y lo adapto a tu empresa: datos fiscales, catálogo, almacenes, cajas, series de comprobantes, conexión real con SUNAT y los ajustes que tu operación necesite.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalación rápida](#instalación-rápida)
- [Cómo se usa](#cómo-se-usa)
- [Configuración de SUNAT](#configuración-de-sunat)
- [Stack](#stack)
- [Decisiones de arquitectura](#decisiones-de-arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Pruebas y calidad](#pruebas-y-calidad)
- [API v1](#api-v1)
- [Estado del proyecto](#estado-del-proyecto)
- [Uso comercial y contacto](#uso-comercial-y-contacto)

## Funcionalidades

- **Punto de venta**: búsqueda por código de barras, SKU o nombre, carrito con IGV incluido y cobro con efectivo, Yape, Plin, tarjeta o transferencia (pagos combinados).
- **Caja opcional**: apertura de turno con fondo inicial y cierre con arqueo cuando la empresa tiene habilitadas las sesiones de caja. San Cristóbal registra ventas directas sin abrir ni cerrar caja.
- **Comprobantes**: factura (01), boleta (03), nota de venta interna y nota de crédito (07) por anulación. La factura exige RUC de 11 dígitos y la boleta superior a S/ 700 exige cliente identificado.
- **Inventario**: Kardex valorizado por producto y almacén (Formato 13.1) con costo promedio ponderado. Anular una venta devuelve el stock con un movimiento de entrada por devolución.
- **Facturación electrónica**: XML UBL 2.1 firmado con SHA-256 mediante Greenter, envío a SUNAT (beta o producción) o simulación local, y ticket térmico de 80 mm con QR e importe en letras.
- **Clientes**: alta y búsqueda por DNI o RUC desde la caja.
- **Resumen operativo**: ventas del día, ticket promedio, actividad por hora, productos con bajo stock y estado de la instalación, según los permisos del usuario.
- **Seguridad**: tokens con expiración, roles y permisos por empresa y auditoría de operaciones críticas.

## Requisitos

| Herramienta | Versión |
| --- | --- |
| PHP | 8.3 o superior, con `bcmath`, `dom`, `openssl`, `soap`, `zlib`, `pdo_pgsql` y `pdo_sqlite` |
| Composer | 2.x |
| Node.js | 20.19+ o 22.12+ |
| Docker con Compose v2 | Para PostgreSQL 17 y Redis 7 (opcional: se puede usar SQLite) |
| Navegador | Chrome, Edge, Firefox o Safari actualizados |
| Equipo | 4 GB de RAM como mínimo y 2 GB libres en disco |

Para el uso real además se necesita un RUC habilitado como emisor electrónico, un usuario SOL secundario y un certificado digital. El detalle por sistema operativo está en [INSTALLATION.md](INSTALLATION.md).

## Instalación rápida

La guía completa, con instalación sin Docker, verificación y solución de problemas, está en **[INSTALLATION.md](INSTALLATION.md)**.

```bash
git clone https://github.com/luid-dev/ventas-pos-pro.git
cd ventas-pos-pro

# 1. PostgreSQL y Redis
docker compose up -d

# 2. API (http://localhost:8000/api/v1)
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve

# 3. Cliente web (http://localhost:5173), en otra terminal
cd frontend
npm ci
cp .env.example .env
npm run dev
```

### Credenciales locales iniciales

Estas cuentas y contraseñas son únicamente para instalaciones locales o de prueba. No las uses ni las publiques en producción; antes del lanzamiento deben crearse usuarios con contraseñas únicas y seguras.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@ventaspos.pe` | `Password123!` |
| Cajero | `cajero@ventaspos.pe` | `Password123!` |

- Empresa: SAN CRISTOBAL-PAKAMUROS E.I.R.L., RUC `20607442381`, almacén activo `ALM-01`. Las ventas locales no requieren apertura de caja.
- Series: `F001`, `B001`, `FC01`, `BC01` y `NV01`.
- Documentos de prueba para buscar clientes: DNI `12345678`, `87654321`, `45678912` y RUC `20123456789`, `20600000001`.

## Cómo se usa

El flujo de venta local es: iniciar sesión, agregar productos, elegir el comprobante y los medios de pago, y confirmar la venta. No se necesita abrir ni cerrar caja. La empresa puede habilitar sesiones de caja en otra configuración si su operación las requiere.

### 1. Inicio de sesión

Cada usuario pertenece a una empresa y solo ve sus datos. Inicia sesión con sus credenciales locales; la pantalla no incluye accesos automáticos de demostración.

### 2. Registro de la venta

Si hay más de un almacén activo, selecciona primero el almacén de salida; el stock, la serie y la venta usarán ese almacén. Cuando solo hay uno, se selecciona automáticamente. Luego escanea el código de barras o escribe el SKU o el nombre y presiona `Enter`. Cada lectura agrega una unidad; la cantidad también se puede ajustar en el carrito. Arriba del carrito se elige el tipo de comprobante: boleta, factura o nota de venta. Los totales se recalculan al céntimo con el IGV desglosado.

### 3. Cliente del comprobante

Con `F8` se abre la búsqueda de cliente por DNI o RUC. Si el documento no existe en la empresa, se completa el formulario y se registra en el momento. La factura no se puede emitir sin un cliente con RUC.

### 4. Cobro

Con `F4` se abre el cobro. Se pueden combinar varios medios de pago (efectivo, Yape, Plin, tarjeta o transferencia) y la venta solo se emite cuando la suma cuadra exactamente con el total.

### 5. Comprobante y ticket

Al confirmar, la venta, el correlativo y el movimiento de inventario se guardan en una sola transacción. Luego se genera y firma el XML UBL 2.1 y se muestra el ticket de 80 mm listo para imprimir, con código QR, hash y estado de SUNAT.

### 6. Kardex valorizado

En **Inventario** se ve cada movimiento con su documento de origen, cantidad, costo unitario, saldo en unidades y saldo valorizado con costo promedio ponderado. Se puede filtrar por producto, almacén, tipo de movimiento y fechas.

### 7. Facturación

En **Facturación** se listan los comprobantes emitidos con su estado ante SUNAT. Desde aquí se reimprime el ticket o se anula una venta, lo que genera la nota de crédito y devuelve el stock al almacén.

### 8. Resumen

La pantalla de inicio muestra los indicadores diarios disponibles para el usuario y el estado de la instalación. Los datos dependen de sus permisos y de los registros existentes; no representan un turno de caja.

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `F2` | Buscar producto |
| `F4` | Cobrar |
| `F8` | Cliente (DNI o RUC) |
| `Esc` | Cancelar o cerrar el diálogo |
| `Ctrl/Cmd + K` | Paleta de comandos |

## Configuración de SUNAT

El envío se controla con la variable `SUNAT_MODE` en `backend/.env`:

| Modo | Comportamiento |
| --- | --- |
| `simulate` (por defecto) | Firma el XML y genera un CDR local. No sale a la red. Es el modo con el que se publica este repositorio. |
| `auto` | Intenta enviar a SUNAT y usa la simulación solo si no hay conexión. |
| `live` | Requiere una respuesta real de SUNAT. |

Para emitir comprobantes válidos hay que:

1. Convertir el certificado digital de la empresa a PEM y guardarlo en `backend/storage/app/sunat/`.
2. Definir `SUNAT_SOL_RUC`, `SUNAT_SOL_USER`, `SUNAT_SOL_PASSWORD` y `SUNAT_CERTIFICATE_PATH`.
3. Probar en `SUNAT_ENVIRONMENT=beta` con `SUNAT_MODE=live` y, cuando SUNAT acepte los comprobantes, pasar a `production`.
4. Registrar los datos reales de la empresa: RUC, razón social, dirección fiscal, almacenes, cajas, series y catálogo.

Los pasos completos están en [INSTALLATION.md](INSTALLATION.md#9-configurar-sunat-para-emitir-comprobantes-reales). Si prefieres que lo configure por ti, revisa [Uso comercial y contacto](#uso-comercial-y-contacto).

## Stack

| Capa | Tecnología |
| --- | --- |
| API | PHP 8.3+, Laravel 13, Laravel Sanctum |
| Base de datos | PostgreSQL 16+ (SQLite en memoria para las pruebas) |
| Cache, sesiones y colas | Redis 7 |
| Facturación electrónica | Greenter (UBL 2.1) |
| Permisos y auditoría | spatie/laravel-permission, spatie/laravel-activitylog |
| Cliente web | React 18, TypeScript 5 en modo estricto, Vite 7 |
| Interfaz | Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| Estado y datos | TanStack Query, Zustand, Zod, React Hook Form, decimal.js |

## Decisiones de arquitectura

### Aislamiento por empresa

El aislamiento se aplica en tres capas independientes:

1. El trait `BelongsToCompany` registra un global scope que filtra cada consulta por `company_id` y lo asigna al crear registros.
2. El middleware `EnsureTenantScope` fija la empresa activa (`TenantContext`) y el equipo de permisos antes de resolver los modelos de la ruta.
3. Cada modelo expuesto tiene una policy que valida el permiso y la pertenencia a la empresa.

Las tablas usan un `id` BIGINT interno y un `uuid` como clave pública de ruta. Las respuestas nunca exponen IDs numéricos.

### Concurrencia en ventas

La venta se confirma en una sola transacción. El turno de caja, la serie del comprobante y la existencia del producto en el almacén se leen con `lockForUpdate()` (`SELECT ... FOR UPDATE`), de modo que dos cajas no pueden vender el mismo stock ni repetir un correlativo. El endpoint de venta acepta la cabecera `Idempotency-Key` (o `X-Idempotency-Key`): un doble clic o un reintento de red devuelve la misma venta en lugar de registrar otra.

### Precisión decimal

Precios y costos unitarios se guardan como `NUMERIC(14,4)` y los totales como `NUMERIC(12,2)`. En PHP los cálculos usan BCMath con redondeo half-up explícito, nunca `float`. El IGV de cada línea se obtiene por diferencia contra el total para que la suma cuadre al céntimo. En el cliente los importes llegan como texto y se operan con decimal.js.

### Facturación electrónica

`SunatService` genera y firma el XML con Greenter después del commit de la venta, así una caída de SUNAT no revierte la venta ni el movimiento de inventario. Las credenciales SOL y el certificado se pueden definir por empresa dentro de `companies.settings` o de forma global en el `.env`.

### Seguridad de la API

- Tokens Bearer de Sanctum con expiración (12 horas por defecto) y revocación al cerrar sesión.
- Roles y permisos con `spatie/laravel-permission` en modo equipos, usando `company_id` como equipo.
- Rate limiting: 5 intentos por minuto en el login (por email e IP) y 120 peticiones por minuto en rutas autenticadas.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Strict-Transport-Security` en todas las respuestas, incluidas las de error.
- Credenciales SOL y contraseñas de certificados cifradas campo por campo dentro de `companies.settings` (`Crypt`, AES-256-CBC).
- Auditoría con `company_id`, usuario, IP, user agent y `trace_id` para inicios de sesión (incluidos los fallidos), apertura y cierre de caja, anulaciones y cambios en los modelos auditados.

### Contrato de respuesta

Todas las respuestas, incluidos los errores 401, 403, 404, 422, 429 y 500, tienen la misma forma. Los errores de validación llegan como lista `[{ "field": ..., "messages": [...] }]` y los errores 500 no exponen detalles internos en producción.

```json
{
  "success": true,
  "message": "Sesión iniciada correctamente.",
  "data": { "...": "..." },
  "errors": null,
  "meta": { "timestamp": "...", "trace_id": "..." }
}
```

El mismo `trace_id` se devuelve en la cabecera `X-Trace-Id` y se guarda en los logs y en la auditoría.

## Estructura del repositorio

```text
ventas-pos-pro/
├── docker-compose.yml       PostgreSQL y Redis para desarrollo
├── INSTALLATION.md          Guía de instalación y configuración de SUNAT
├── backend/                 API Laravel
│   ├── app/
│   │   ├── Casts/           Cifrado selectivo de companies.settings
│   │   ├── DTOs/            Datos inmutables de los casos de uso
│   │   ├── Enums/           Catálogos SUNAT, medios de pago y estados
│   │   ├── Exceptions/      Excepciones de dominio con salida JSON
│   │   ├── Http/            Controladores v1, middleware, requests y resources
│   │   ├── Models/
│   │   ├── Policies/
│   │   ├── Services/        Venta, Kardex, caja y SUNAT
│   │   ├── Support/         Dinero con BCMath, QR, importe en letras
│   │   └── Traits/
│   ├── database/            Migraciones, factories y datos locales de San Cristóbal
│   └── tests/Feature/
└── frontend/                Cliente React
    └── src/
        ├── api/             Cliente Axios y validación del contrato
        ├── components/      Layout de la aplicación y componentes base
        ├── features/        auth, pos, inventory, invoicing, overview
        ├── hooks/           Atajos de teclado y lector de código de barras
        ├── lib/             Moneda, decimales, fechas y esquemas Zod
        ├── stores/          Sesión, carrito y preferencias (Zustand)
        └── types/
```

## Pruebas y calidad

```bash
cd backend
php artisan test
vendor/bin/pint --test
```

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Las pruebas de integración cubren el aislamiento entre empresas, la venta completa con stock, Kardex y SUNAT, la idempotencia, las reglas de boleta y factura, la anulación con nota de crédito, la autenticación, el rate limiting y el contrato de errores. Por defecto corren sobre SQLite en memoria; en [INSTALLATION.md](INSTALLATION.md#8-ejecutar-las-pruebas) se explica cómo correrlas sobre PostgreSQL.

## API v1

Todas las rutas, salvo `health` y `auth/login`, requieren `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/v1/health` | Estado del servicio |
| POST | `/api/v1/auth/login` | Inicio de sesión |
| GET | `/api/v1/auth/me` | Usuario, empresa y permisos de la sesión |
| POST | `/api/v1/auth/logout` | Revoca el token actual |
| GET | `/api/v1/pos/products` | Catálogo con stock por almacén |
| GET | `/api/v1/pos/warehouses` | Almacenes activos disponibles para seleccionar en el POS |
| GET, POST | `/api/v1/pos/customers` | Búsqueda y alta de clientes |
| GET | `/api/v1/pos/customers/lookup` | Consulta por DNI o RUC |
| GET | `/api/v1/pos/cash-registers` | Cajas disponibles cuando la empresa habilita sesiones de caja |
| GET | `/api/v1/pos/cash-sessions/current` | Turno abierto; no se consulta para San Cristóbal mientras la función está desactivada |
| POST | `/api/v1/pos/cash-sessions/open` | Apertura de turno, solo con la función habilitada |
| POST | `/api/v1/pos/cash-sessions/{session}/close` | Cierre con arqueo, solo con la función habilitada |
| GET, POST | `/api/v1/pos/sales` | Listado y registro de ventas |
| GET | `/api/v1/pos/sales/{sale}` | Detalle de una venta |
| GET | `/api/v1/pos/sales/{sale}/ticket` | Datos del ticket de 80 mm |
| POST | `/api/v1/pos/sales/{sale}/void` | Anulación con nota de crédito |
| GET | `/api/v1/inventory/kardex` | Movimientos valorizados |
| GET | `/api/v1/inventory/warehouses` | Almacenes |

## Estado del proyecto

| Módulo | Estado |
| --- | --- |
| Autenticación, roles y aislamiento por empresa | Completo |
| Punto de venta y cobro directo | Completo |
| Sesiones de caja | Opcionales; desactivadas para San Cristóbal |
| Comprobantes, ticket y anulación con nota de crédito | Completo |
| Kardex valorizado | Completo |
| Envío a SUNAT | Implementado, publicado en modo `simulate` |
| Configuración de empresa desde la interfaz | En desarrollo |
| Gestión de usuarios y auditoría desde la interfaz | En desarrollo |

Mientras la pantalla de configuración no esté terminada, los datos de una empresa nueva (RUC, almacenes, cajas, series y catálogo) se cargan en base de datos o con un seeder propio.

## Uso comercial y contacto

El código se publica como proyecto de portafolio. Si quieres usar Ventas POS Pro en tu negocio, puedo encargarme de:

- Configurar la facturación electrónica con tu RUC, usuario SOL y certificado digital.
- Cargar tu empresa, sedes, almacenes, cajas, series y catálogo de productos.
- Adaptar los flujos de venta, comprobantes o reportes a tu forma de trabajar.
- Instalarlo en tu servidor o en la nube.

Contáctame desde mi perfil de GitHub: **[github.com/luid-dev](https://github.com/luid-dev)**.

## Autor

**luidDev** · [github.com/luid-dev](https://github.com/luid-dev)
