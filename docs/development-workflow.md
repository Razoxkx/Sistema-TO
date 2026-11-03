# Flujo de desarrollo

Los cambios de código se realizan únicamente en el repositorio del Mac, sobre la rama `dev`. Primero se revisan desde `http://localhost:5173`. La etiqueta naranja DEV aparece exclusivamente en la rama Git `dev`, incluido el sidebar retraído y el menú móvil. Usar Vite en `main` no debe activar esa etiqueta.

Para publicar una versión estable, los cambios de `dev` se integran en `main` después de la revisión del usuario. No se editan archivos de código ni se copian fuentes directamente al servidor: Ubuntu recibe las versiones mediante Git y reconstruye sus imágenes.

## Vista temporal de dev en Ubuntu

Por decisión del usuario, el puerto 5173 puede mostrar temporalmente la rama `dev`, sustituyendo la web estable. Se mantiene la base de datos existente; esta modalidad no crea un entorno de datos separado.

```bash
cd /home/razoxk/Documents/GitHub/Sistema-TO
git fetch origin
git switch dev
git pull --ff-only origin dev
docker compose -f compose.server.yaml build --build-arg "APP_GIT_BRANCH=$(git branch --show-current)" web
docker compose -f compose.server.yaml up -d --no-deps web
```

Vite consulta la rama Git real y observa los cambios de HEAD para recargar la vista local cuando se cambia de rama. El contenedor de compilación no incluye `.git`; recibe `APP_GIT_BRANCH` desde la rama seleccionada en el servidor. No se usa `NODE_ENV`, el modo de Vite ni una etiqueta de entorno para decidir si mostrar DEV. El comando `bash scripts/deploy-web.sh`, disponible en `dev`, obtiene automáticamente la rama actual y ejecuta la compilación y el reemplazo de la web.

Cambiar de rama en GitHub Desktop cambia los archivos del repositorio, pero no la imagen Docker que ya está ejecutándose. Después de seleccionar una rama hay que reconstruir y desplegar la web con los comandos indicados.

## Volver a la web estable

```bash
git fetch origin
git switch main
git pull --ff-only origin main
docker compose -f compose.server.yaml build --build-arg "APP_GIT_BRANCH=$(git branch --show-current)" web
docker compose -f compose.server.yaml up -d --no-deps web
```

Los comandos anteriores actualizan únicamente la web, adecuados para el cambio visual de DEV. Una modificación futura de API requiere reconstruir y desplegar también ese servicio.

## GitHub Desktop en Ubuntu

Abre el repositorio `/home/razoxk/Documents/GitHub/Sistema-TO`, pulsa Fetch origin y busca `dev` en Current branch. Si la rama ya existe en la terminal pero no aparece en la interfaz, vuelve a abrir el repositorio en Desktop y comprueba que no sea otro clon. La autenticación de GitHub Desktop y la de Git por terminal pueden ser distintas.

El primer despliegue de `dev` se transportó mediante un paquete Git del commit subido, porque Git por terminal en Ubuntu no tenía autenticación para descargar el repositorio privado. Esto conserva ramas e historial y no implica editar fuentes en el servidor. Para futuros `git fetch`/`git pull` directos, configura el acceso del servidor al repositorio; no introduzcas tokens en el código.
