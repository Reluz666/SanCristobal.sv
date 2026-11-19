# Pendientes antes de producción

**Estado:** bloqueado para producción. Este documento es una lista de trabajo; no implica que el sistema ya esté listo para operar con datos reales.

El proyecto se está adaptando para **SAN CRISTOBAL-PAKAMUROS E.I.R.L.**. Los datos y las cuentas de demostración actuales son únicamente para desarrollo local. Revisar esta lista y ejecutar cada etapa antes de publicar el sistema o cargar información real.

## Completado durante la adaptación local

- [x] La identidad de la empresa de demostración se adaptó a San Cristóbal.
- [x] El flujo de venta directa se habilitó sin exigir apertura de caja.
- [x] Los indicadores principales del panel se conectaron a datos de la API y se corrigieron etiquetas de modo SUNAT.
- [x] La pantalla de inicio de sesión dejó de mostrar las credenciales de demostración.
- [x] El seeder de demostración se limita a entornos `local` y `testing`.
- [x] El POS inicia en boleta, admite pagos divididos, solicita identificación antes del cobro cuando corresponde y permite escanear productos aunque haya un filtro de categoría activo.
- [x] Los indicadores de Kardex se calculan sobre el catálogo completo del almacén de referencia, y el valor se identifica como potencial a precio de venta.
- [x] Nombre, color, logo y datos de cobro se centralizaron en la configuración pública de la empresa; la interfaz aplica esos valores sin teléfonos de pago incrustados.

Esto no sustituye la validación de producción. La migración de datos, los documentos tributarios y el entorno real requieren una revisión previa.

## Bloqueantes de producción

### 1. Usuarios y credenciales

- [ ] Definir el mecanismo seguro para crear el primer administrador y los vendedores de producción, sin usar cuentas compartidas de demostración.
- [ ] Asignar contraseñas únicas, almacenarlas mediante el flujo normal de autenticación y exigir su cambio inicial cuando corresponda.
- [ ] Confirmar que ninguna cuenta o contraseña de desarrollo se copie a la base de producción.
- [ ] Verificar que los permisos asignados a cada rol correspondan a las tareas reales.

**Criterio de cierre:** se puede crear y recuperar el acceso a las cuentas iniciales de forma controlada; no se usa ninguna credencial de demostración.

### 2. Datos iniciales y despliegue

- [ ] Crear un proceso explícito de inicialización de producción para empresa, usuarios, almacenes, productos, stock, series y permisos.
- [ ] Confirmar que el despliegue ejecuta migraciones, pero no ejecuta `DemoPortfolioSeeder` ni `DatabaseSeeder` en producción. El seeder de demostración debe seguir rechazando los entornos distintos de `local` y `testing`.
- [ ] Definir quién revisa y autoriza los datos fiscales, catálogo, precios, stock y series antes de cargarlos.
- [ ] Confirmar y configurar los números oficiales de Yape/Plin, el logo y el color de marca. Los teléfonos de cobro son distintos del teléfono de contacto y se mantienen vacíos hasta su confirmación.
- [ ] Mantener los datos de ventas, clientes, certificados y productos de prueba fuera de producción.

**Criterio de cierre:** el procedimiento de despliegue está documentado y se probó en una base limpia sin crear datos de demostración.

### 3. SUNAT y documentos tributarios

- [ ] Confirmar con la empresa y el contador los datos fiscales, domicilio, ubigeo, régimen, impuestos y series que se usarán.
- [ ] Configurar credenciales y certificados autorizados para el ambiente correspondiente; retirar el certificado autofirmado de demostración.
- [ ] Mantener el modo de simulación hasta completar pruebas de homologación y autorización para emisión real.
- [x] Corregir las unidades de demostración fardo/bolsa a los códigos del Catálogo N.° 03 (`BE`/`BG`) en el seeder y en los productos/líneas de venta locales existentes.
- [ ] Validar los formatos/casos de boleta, factura, nota de crédito, anulaciones y respuestas de SUNAT.
- [ ] Validar comprobantes de extremo a extremo en el ambiente de pruebas de SUNAT antes de habilitar emisión real.

**Criterio de cierre:** la empresa confirma los datos y series, las pruebas tributarias requeridas pasan y el cambio a emisión real se autoriza explícitamente.

### 4. Operación, protección y continuidad

- [ ] Configurar `APP_DEBUG=false`, HTTPS, claves y secretos propios del entorno, CORS/orígenes permitidos y acceso restringido a la API.
- [ ] Elegir y configurar base de datos, caché, almacenamiento y correo de producción; no reutilizar contraseñas ni archivos `.env` locales.
- [ ] Definir backups automáticos cifrados y comprobar una restauración antes de cargar datos reales.
- [ ] Definir monitoreo de errores, disponibilidad, espacio, tareas programadas y alertas operativas.
- [ ] Definir responsables y procedimiento para incidentes, recuperación y rotación de secretos.

**Criterio de cierre:** el entorno se despliega con configuración segura y una restauración de backup se completa en un entorno controlado.

### 5. Verificación final

- [ ] Ejecutar pruebas de autenticación, permisos y aislamiento entre empresas con la configuración de producción prevista.
- [ ] Probar venta directa, actualización de stock, pagos, impresión de ticket, errores de red, reintentos y anulaciones según las políticas operativas aprobadas.
- [ ] Comprobar el flujo completo de comprobantes en simulación/homologación antes de la emisión real.
- [ ] Resolver vulnerabilidades de dependencias aplicables y registrar las excepciones aceptadas con responsable y fecha de revisión.
- [ ] Hacer una prueba de aceptación con usuarios de San Cristóbal y registrar su aprobación antes de habilitar el sistema.

**Criterio de cierre:** los responsables funcionales y técnicos aprueban los resultados y no quedan bloqueantes abiertos.

## Nota sobre los datos actuales

Las cuentas, catálogo, stock, ventas y certificados de la instalación local son datos de desarrollo/prueba. No deben copiarse como datos iniciales de producción. La contraseña compartida de demostración se conserva únicamente para que los tests y la instalación local actual sigan funcionando; no se muestra en la interfaz de acceso y nunca debe reutilizarse en el entorno real.
