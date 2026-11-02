# Espacio TO

Sistema de terapia ocupacional con acceso local o Google. React + Vite, API Node.js/Express, MySQL 8.4 y Docker Compose. Incluye fichas clínicas, sesiones, calendario, planificaciones, finanzas mensuales e informes.

## Revisar el diseño

Requiere Node.js 22.12+ (recomendado 24 LTS).

```bash
npm ci
npm run dev
```

Abre http://localhost:5173. El ingreso requiere una cuenta real y MySQL disponible; no se simula una sesión. Para crear una cuenta local, configura primero las variables indicadas a continuación.

## Acceso y registro dentro de la red local

Con MySQL disponible, configura en `.env`:

```dotenv
LOCAL_AUTH_ENABLED=true
APP_ORIGIN=http://localhost:5173
APP_ALLOWED_ORIGINS=http://192.168.1.8:5173,http://127.0.0.1:5173
WEB_BIND_ADDRESS=192.168.1.8
```

Inicia la aplicación con `npm run dev`. Desde un teléfono conectado a la misma red, abre `http://192.168.1.8:5173` y pulsa **Crear cuenta local**. El registro solicita nombre, correo, contraseña de 12–128 caracteres y su confirmación. Después puedes ingresar con correo y contraseña. Cada cuenta tiene sus propias fichas; el registro local no verifica el correo ni incluye recuperación por email.

**Si ya utilizabas Google:** entra desde `http://localhost:5173` con esa cuenta, abre **Mi cuenta** y pulsa **Activar acceso local** después de elegir tu contraseña. Así ambos métodos acceden al mismo terapeuta y conservan sus fichas, sesiones y planificaciones. No crees una segunda cuenta para trasladar datos. Por seguridad no se unen cuentas automáticamente por coincidencia de correo.

Google no admite este origen HTTP con IP privada. En esa dirección se ofrece directamente el acceso local y no se carga su SDK. El acceso local no necesita Internet; Google y la generación de informes con OpenAI sí. HTTP dentro de la LAN no cifra el tráfico: esta configuración está pensada para una red de confianza; un despliegue de producción requiere HTTPS.

Si cambia la IP del equipo, actualiza `APP_ALLOWED_ORIGINS` y, para Docker, `WEB_BIND_ADDRESS`. Los orígenes deben ser exactos, sin rutas, comodines ni barra final. Reinicia tu proceso de desarrollo después de cambiar `.env`. En Docker, `WEB_BIND_ADDRESS` determina la interfaz publicada; su valor predeterminado es `127.0.0.1`. La dirección `localhost` siempre se refiere al dispositivo desde el que navegas.

Si accedes por Tailscale, añade también el origen de esa conexión a `APP_ALLOWED_ORIGINS`, conservando los anteriores: por ejemplo, `http://100.74.209.47:5173`. Una IP de Tailscale es distinta de la IP de Wi-Fi, por lo que debe autorizarse explícitamente. Reinicia tu proceso de desarrollo para que la API vuelva a leer `.env`. El acceso desde esa dirección utiliza correo y contraseña locales.

## Configurar Google y MySQL

1. Copia `.env.example` a `.env`.
2. Genera un secreto con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` y úsalo como `SESSION_SECRET`. Define también contraseñas distintas para `DB_PASSWORD` y `MYSQL_ROOT_PASSWORD`.
3. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configura Google Auth Platform (marca, audiencia y datos de contacto) y crea un **ID de cliente OAuth de tipo Aplicación web**.
4. Agrega `http://localhost` y `http://localhost:5173` a **Orígenes autorizados de JavaScript**. Este flujo usa el botón oficial y una devolución de llamada JavaScript; no necesita URI de redirección ni client secret.
5. Copia el ID en `GOOGLE_CLIENT_ID`. Si tu configuración de Google está en pruebas y requiere usuarios de prueba, agrega las cuentas que utilizarás.
6. Opcionalmente configura `ALLOWED_EMAILS=persona@ejemplo.cl,otra@ejemplo.cl`. La lista limita tanto Google como el registro e ingreso local. Vacía permite registros locales y cuentas Google con correo verificado.
7. Inicia MySQL con `docker compose up -d db`, y luego `npm run dev`. Las tablas se crean al iniciar la API con la base disponible. Reinicia la API si iniciaste MySQL después de ella.

Documentación oficial: [botón de Google Identity Services](https://developers.google.com/identity/gsi/web/guides/display-button), [verificación del token en el servidor](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Ejecutar todo en Docker

Con `.env` configurado, detén `npm run dev` para liberar el puerto 5173 y ejecuta:

```bash
docker compose up --build -d
```

Abre la dirección configurada en `WEB_BIND_ADDRESS`, en el puerto 5173. `docker compose down` detiene los servicios conservando los datos en el volumen. MySQL se publica solo en loopback en el puerto 3307 para desarrollo local.

## Sesión y seguridad

- El servidor verifica firma, audiencia, emisor y expiración con `google-auth-library`; exige email verificado y nonce vinculado al navegador mediante cookie firmada.
- Las mutaciones requieren un `Origin` autorizado en `APP_ORIGIN` o `APP_ALLOWED_ORIGINS`; no se habilita CORS abierto. Los accesos, registros y cambios de contraseña tienen límites de intentos.
- Tokens de sesión aleatorios de 256 bits, almacenados como SHA-256 en MySQL. Duración: 8 horas. Cookies HttpOnly y SameSite=Lax, Secure en producción. Cerrar sesión revoca el token en la base de datos.
- Las cuentas Google se identifican por su `sub` verificado. No se guardan sus tokens. Se conserva la URL HTTPS de la foto de perfil recibida en el token verificado; si no está disponible, se muestran las iniciales.
- Las contraseñas locales se guardan como hashes scrypt con sal aleatoria individual (`N=32768`, `r=8`, `p=3`), nunca en texto plano. El servidor limita la concurrencia del cálculo y utiliza comparación de tiempo constante. Cambiar o activar la contraseña requiere sesión; si ya existe, exige la contraseña actual. Al guardar revoca las otras sesiones abiertas.
- No se guardan credenciales en localStorage. `.env` se excluye de Git y Docker.
- Para un despliegue público: HTTPS mediante proxy de entrada, `NODE_ENV=production`, `APP_ORIGIN=https://tu-dominio`, origen equivalente en Google y un `SESSION_SECRET` estable. Compose es una base local, no configura TLS ni despliegue público.
- El aviso de privacidad describe los datos tratados por la aplicación; el responsable del despliegue debe completar sus condiciones y datos de contacto.

## Verificación

```bash
npm test
npm run build
```

Las pruebas de autenticación comprueban Google con verificador simulado, registro e ingreso local, validación, orígenes, sesiones y cambio de contraseña. Con `RUN_MYSQL_TESTS=1` se verifican además la persistencia real, el aislamiento entre terapeutas y la activación local de una cuenta Google conservando sus fichas. La prueba real con Google necesita tu cliente OAuth y una cuenta autorizada.

## Estructura

- `src/`: interfaz React y estilos adaptables.
- `server/`: endpoints de autenticación, integración con Google y MySQL.
- `tests/`: pruebas de integración HTTP de autenticación.
- `compose.yaml`, `Dockerfile`, `nginx.conf`: servicios locales contenerizados.

Cada terapeuta accede exclusivamente a las fichas clínicas creadas con su cuenta.

## Apariencia

El selector del encabezado permite elegir **Claro**, **Oscuro** o **Sistema**, tanto antes como después de iniciar sesión. En smartphone se muestra como un icono de sol, luna o monitor. La elección se recuerda en ese navegador y dirección del sitio; Sistema sigue la apariencia del dispositivo y responde cuando cambia. El tema oscuro conserva los verdes clínicos y se aplica a formularios, fichas, calendario, finanzas y modales. Cambiarlo no descarta los formularios abiertos.

## Sidebar del terapeuta

Después del acceso se muestra Inicio con un sidebar retráctil. El estado expandido se conserva localmente; en celular se abre como un menú modal con cierre por Escape y retorno del foco. La foto y el botón de cierre de sesión están en el pie del menú. Las cuentas creadas antes de incorporar la foto deben iniciar sesión nuevamente para actualizarla.

La API agrega automáticamente las columnas nuevas en bases existentes al iniciar. La foto se obtiene exclusivamente del token Google verificado; el nombre y correo de una cuenta local provienen de su registro. **Mi cuenta** permite activar o cambiar la contraseña local.

## Usuarios y ficha clínica

Desde Usuarios puedes buscar por nombre y abrir cada ficha desde una tarjeta con nombre, edad y dirección; también puedes crear, consultar y editar fichas. El formulario organiza los doce campos en columnas adaptables y las observaciones se amplían automáticamente según el contenido, sin tiradores de redimensionado. Nombre y edad (0–130, años enteros) son obligatorios. Se incluyen dirección, antecedentes médicos, uso de medicamentos, enfermedades crónicas, rutinas, dificultades visibles, objetivos a trabajar, entorno familiar, observación de vivienda y habilidades a reforzar. Los textos conservan sus saltos de línea y admiten hasta 5000 caracteres por observación (500 para dirección).

Los endpoints `/api/usuarios` requieren sesión y todas las consultas se limitan al terapeuta autenticado. El cliente no puede elegir al propietario de una ficha. Las listas están paginadas en grupos de 20 y no incluyen los antecedentes clínicos. Las respuestas usan `Cache-Control: no-store`; los datos de fichas no se guardan en almacenamiento del navegador.

La tabla `clinical_records` se crea automáticamente. La edición comprueba la versión para evitar sobrescribir cambios de otra pestaña; ante conflicto conserva el formulario para que puedas recuperar tus notas.

La prueba adicional de MySQL utiliza únicamente datos sintéticos y los retira al finalizar:

```bash
RUN_MYSQL_TESTS=1 node --env-file=.env --test tests/*.test.js
```

### Sesiones de atención

Al abrir la tarjeta de un usuario, la ficha aparece en un modal con fondo difuminado. Incluye «Editar ficha», «Nueva sesión» y las vistas «Ficha clínica» / «Sesiones».

«Nueva sesión» registra fecha, actividades realizadas (obligatorias), objetivos trabajados, observaciones y próximos pasos. El historial se ordena por fecha y se guarda en MySQL en `clinical_sessions`, asociado a la ficha y accesible solo por su terapeuta. La tabla se crea automáticamente al iniciar la API; no requiere borrar datos existentes. Las notas se ajustan al contenido, y cerrar o volver con cambios pendientes solicita descartarlos o seguir editando.

Cada nueva sesión incluye un valor obligatorio en pesos chilenos (CLP), sin decimales; se admite $0. El importe se guarda individualmente y se muestra en el historial con formato chileno (por ejemplo, $20.000 CLP). La migración añade `clinical_sessions.amount` sin asignar precios a atenciones anteriores: estas muestran «Valor sin registrar».

El historial permite **Editar sesión**: fecha (incluidas atenciones anteriores), valor y notas. La edición conserva el mismo registro y detecta cambios concurrentes para evitar sobrescribir otra actualización. La API añade `GET` y `PUT /api/usuarios/:id/sesiones/:sessionId`, siempre con autenticación y propiedad de la ficha. La columna de versión se incorpora automáticamente al iniciar.

### Finanzas mensuales

El sidebar incluye **Finanzas** (`#finanzas`). Muestra el mes actual de Chile por defecto y cambia al nuevo mes automáticamente, conservando el historial. El selector, los botones anterior/siguiente y los doce meses del año permiten consultar períodos anteriores (`#finanzas/AAAA-MM`). «Mes actual» vuelve al período automático.

Los ingresos se calculan sumando el valor de las sesiones por su **fecha de atención**, tanto en total como por usuario. Registrar una atención atrasada o editar fecha/valor actualiza los meses correspondientes. No se borra ni reinicia la información al cambiar de mes. Las sesiones de $0 son válidas; las que aún no tienen valor se cuentan y señalan para completarlas. El cálculo representa los valores registrados en las sesiones; no hay un estado de pago separado.

`GET /api/finanzas?mes=AAAA-MM&page=1` devuelve resumen, detalle por usuario paginado e historial del año. Todas las consultas se limitan al terapeuta autenticado y no se cachean. Los totales abarcan todas las páginas del período.

### Informes con IA

En la ficha, abre **Informes → Nuevo informe**. Puedes incluir todas las sesiones o un rango de fechas. «Revisar sesiones» muestra las notas que respaldarán el informe; la generación requiere autorizar su envío a OpenAI. La clave se configura únicamente en el `.env` de la API como `OPENAI_API_KEY`; `OPENAI_MODEL` permite cambiar el modelo (por defecto `gpt-4.1-mini`). Nunca uses una variable `VITE_` para esta clave. Docker Compose pasa ambas variables solo al servicio API.

El sistema solicita un borrador estructurado mediante Responses API, valida las referencias y lo guarda en MySQL. No hay un resumen simulado como alternativa cuando falla la IA. Incluye resumen, actividades, objetivos, avances, dificultades, acuerdos y límites de la información. Cada apartado conserva sus números de sesiones de respaldo. El terapeuta puede editar el título, los textos y las referencias; al guardar elige borrador o revisión. La descarga PDF identifica el estado y contiene el período, el usuario, el terapeuta y las referencias.

Los informes conservan una copia de las notas y versiones utilizadas. Editar una sesión posteriormente no cambia un informe existente. La versión del informe evita que dos ediciones se sobrescriban. Se limita cada generación a 200 sesiones y 180.000 caracteres de fuentes; si se supera, el sistema solicita un período más corto sin omitir notas silenciosamente. Se permiten seis intentos de generación por terapeuta cada quince minutos y una generación simultánea por proceso de API. El proveedor tiene un tiempo límite de 90 segundos; Nginx permite 120 segundos.

Solo se envían a OpenAI las fechas y notas seleccionadas, numeradas. No se añaden el nombre, edad, dirección, información de contacto, importes ni IDs de la base de datos. Los textos libres pueden contener datos identificativos: deben revisarse antes del envío. Se usa `store: false`; esto no equivale a una garantía de retención cero del proveedor. Consulta los [controles de datos oficiales](https://developers.openai.com/api/docs/guides/your-data). Las notas se tratan como datos y no como instrucciones; la IA no tiene acceso a herramientas ni a otras fichas. Sus resultados siempre requieren revisión profesional.

Si OpenAI devuelve `credit_balance_exhausted`, revisa los créditos de la organización en la plataforma de API. Crear una clave no añade saldo. La aplicación muestra el error y no guarda un informe incompleto. La [documentación de errores](https://developers.openai.com/api/docs/guides/error-codes) distingue los bloqueos de saldo de los límites temporales.

La tabla `clinical_reports` se crea automáticamente al iniciar la API, sin borrar las fichas o sesiones. Rutas autenticadas: `GET/POST /api/usuarios/:id/informes`, `GET /fuentes`, `GET/PUT /:reportId` y `GET /:reportId/pdf`. El PDF se genera en memoria con PDFKit y fuentes Unicode incluidas, con licencia en `server/fonts/LICENSE.txt`.

### Calendario y planificaciones

El sidebar incluye **Calendario**. Permite seleccionar un día y agendar una sesión para un usuario ya registrado, con nombre, fecha y hora de Chile. Un nombre vacío recibe automáticamente «Sesión número N», con numeración por usuario. El calendario y la ficha usan el mismo registro de sesión: cambiar un horario actualiza también la información mostrada en las planificaciones vinculadas. Las atenciones anteriores se conservan; no se inventan horas para las que no las tenían.

Las sesiones del calendario nacen **Programadas**. «Registrar atención» abre el formulario de sesión para completar lo realizado y su valor; al guardar pasan a **Realizadas**. Finanzas e Informes incluyen únicamente sesiones realizadas. Las sesiones anteriores a este cambio mantienen ese estado por defecto.

Dentro de cada ficha, la pestaña **Planificaciones** contiene materiales a usar, objetivos con lista de tareas marcables, plan de ejecución y observaciones. Al pulsar «Guardar planificación» se abre la selección de una sesión ya creada del mismo usuario, con su nombre, fecha y hora. «Confirmar y guardar» realiza el guardado; no se crean sesiones desde ese formulario. Se pueden editar los objetivos y cambiar la sesión asignada al volver a guardar. La planificación no almacena una copia independiente del horario: lo consulta siempre desde la sesión.

La API agrega `GET/POST /api/calendario`, `GET/PUT /api/calendario/:id`, `GET /api/usuarios/:id/sesiones-agendadas` y `GET/POST /api/usuarios/:id/planificaciones`, con `GET/PUT /:planId` para consultar/editar. Todas las rutas requieren sesión y verifican la propiedad de fichas y sesiones. Sesiones y planificaciones usan versiones para detectar ediciones concurrentes. Los campos nuevos y la tabla `clinical_plans` se incorporan automáticamente al iniciar la API, sin borrar los datos existentes.
