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

Cambiar de rama en GitHub Desktop cambia los archivos del repositorio. En Ubuntu, el actualizador automático descrito abajo detecta ese cambio y reconstruye la web. Si está desactivado, hay que usar los comandos de despliegue manual indicados.

## Actualización automática al cambiar de rama en Ubuntu

Instalar desde `dev`, una vez que los scripts hayan llegado al servidor mediante Git:

```bash
bash scripts/install-auto-web-deploy.sh
sudo loginctl enable-linger "$(id -un)"
```

El temporizador de usuario `espacio-to-web-branch.timer` revisa la rama y el commit aproximadamente cada tres segundos. Al seleccionar `main` o `dev` en GitHub Desktop **del servidor Ubuntu**, compila una copia del commit seleccionado y reemplaza únicamente el contenedor web del puerto 5173. No descarga commits ni cambia ramas por su cuenta. Los cambios de rama en el Mac no afectan a Ubuntu.

La etiqueta DEV corresponde a la versión que está publicada. Durante la compilación sigue disponible la versión anterior; cuando termina, refresca la página para ver la nueva. No se modifican API ni base de datos, y las dos ramas comparten los mismos datos existentes.

No publica cambios sin commit, ramas distintas de `main`/`dev` ni checkouts separados de una rama. Si la rama cambia durante la compilación, descarta ese resultado y revisa la nueva selección. Los errores se registran en el journal y se reintentan tras un minuto; si el reemplazo de la web falla, restaura la imagen anterior.

El instalador guarda una copia del actualizador en `~/.local/libexec/espacio-to` para que siga funcionando al cambiar a una rama que todavía no incluya estos scripts. El estado se guarda en `~/.local/state/espacio-to-web-deploy`. Repite la instalación desde `dev` cuando se actualice el propio automatismo.

```bash
# Estado y últimos despliegues
systemctl --user status espacio-to-web-branch.timer
journalctl --user -u espacio-to-web-branch.service -n 50 --no-pager

# Detenerlo antes de realizar un despliegue manual
systemctl --user stop espacio-to-web-branch.timer espacio-to-web-branch.service

# Volver a activarlo
systemctl --user start espacio-to-web-branch.timer

# Desactivarlo de manera permanente
systemctl --user disable --now espacio-to-web-branch.timer
systemctl --user stop espacio-to-web-branch.service
```

La revisión en localhost sigue precediendo a la publicación de código nuevo. Al estar activado este temporizador, cualquier nuevo commit que llegue a la rama seleccionada en Ubuntu también reconstruye la web. La promoción de código de `dev` a `main` continúa siendo una decisión del usuario.

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
