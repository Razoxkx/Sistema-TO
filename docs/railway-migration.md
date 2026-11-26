# Espacio TO en Railway

El proyecto utiliza tres servicios en la misma región y entorno:

| Servicio | Origen | Acceso |
| --- | --- | --- |
| Sistema-TO (web) | `deploy/railway/Dockerfile.web` | HTTPS público, puerto interno 5173 |
| api | `deploy/railway/Dockerfile.api` | Red privada, puerto 3001 |
| MySQL | Imagen oficial `mysql:8.4` | Red privada, puerto 3306; volumen en `/var/lib/mysql` |

Los Dockerfiles se compilan desde la raíz del repositorio. No se suben `.env`, respaldos SQL ni contraseñas a Git. Railway configura la ruta de cada Dockerfile en el servicio correspondiente. El Compose de Ubuntu no se utiliza en Railway.

## Variables

Web:

```text
PORT=5173
API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:3001
```

El Dockerfile de web toma `RAILWAY_GIT_BRANCH` al compilar para decidir si muestra DEV. `APP_GIT_BRANCH` sirve como alternativa para las compilaciones locales. El proxy resuelve la API mediante los DNS del contenedor y preserva `/api`, cookies y el protocolo HTTPS del acceso público.

API:

```text
NODE_ENV=production
HOST=::
PORT=3001
APP_ORIGIN=https://sistema-to.up.railway.app
LOCAL_AUTH_ENABLED=true
DB_HOST=${{MySQL.RAILWAY_PRIVATE_DOMAIN}}
DB_PORT=3306
DB_NAME=${{MySQL.MYSQL_DATABASE}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
```

`SESSION_SECRET`, las credenciales y la configuración de OpenAI se configuran exclusivamente en las variables privadas del servidor. Se conservan el ID de cliente Google y las restricciones de correos del sistema original. El nuevo origen HTTPS debe estar autorizado en Google Cloud para usar Google en ese dominio; el acceso local con correo y contraseña conserva sus cuentas tras copiar los datos.

MySQL mantiene su contraseña raíz generada por Railway y utiliza una cuenta de aplicación independiente, `MYSQL_USER=espacio_to`, con su propia `MYSQL_PASSWORD`. `MYSQL_DATABASE=espacio_to`. No se necesita publicar el puerto MySQL ni la API.

## Validación y publicación

Los cambios se escriben en el Mac sobre `dev` y se prueban antes de publicarlos. La primera revisión en Railway puede fijarse a un commit de `dev`; `main` se modifica únicamente después de la aprobación del usuario. Un servicio fijado a un commit no se actualiza automáticamente con cada push. La promoción se hace cambiando su fuente al commit o rama ya aprobado.

La web utiliza `/healthz` como comprobación de arranque. La API utiliza `/api/health`, que verifica también MySQL. Mantener una réplica por servicio y la misma región. La API se reinicia si MySQL todavía está arrancando.

## Copia de los datos existentes

1. Extraer un respaldo consistente con `mysqldump --single-transaction`, incluyendo tablas, índices, disparadores y rutinas. Guardarlo fuera del repositorio en un directorio privado.
2. Crear MySQL 8.4 con volumen persistente y configurar las credenciales privadas antes de su primer arranque.
3. Importar la copia en la base nueva usando la CLI oficial de Railway por SSH. No publicar MySQL para hacer la importación. La importación de un dump con `DROP TABLE` solo se ejecuta contra una base de destino nueva y comprobada vacía.
4. Comparar todas las tablas y sus filas, además de las sumas de los importes de sesiones. Verificar que las contraseñas locales y las asociaciones entre terapeutas, fichas, sesiones y planes se conservan.
5. Validar el acceso HTTPS, la sesión, los formularios, el calendario, las finanzas y los PDF. No crear cuentas ni fichas de prueba dentro de los datos clínicos migrados.
6. Acordar el cambio de dirección de uso. La copia es una instantánea: cualquier escritura posterior en la base anterior requiere otra sincronización antes de utilizarla como versión definitiva.

El volumen conserva la base entre despliegues; las copias de seguridad se administran desde Backups en Railway. Se conserva el respaldo previo a la migración hasta verificar el traslado.

## Plan

El usuario eligió Hobby como opción viable. Hobby tiene un mínimo de US$5 mensuales que incluye US$5 de consumo; no es una tarifa fija ilimitada. El panel Usage muestra el gasto de los tres servicios y del almacenamiento. No se habilitan servicios de alta disponibilidad ni réplicas adicionales para este despliegue.
