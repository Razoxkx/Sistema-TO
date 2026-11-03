# Flujo de desarrollo

Los cambios de código se realizan únicamente en el repositorio del Mac, sobre la rama `dev`. Primero se revisan desde `http://localhost:5173`. La etiqueta naranja DEV identifica el entorno de desarrollo, incluido el sidebar retraído y el menú móvil.

Para publicar una versión estable, los cambios de `dev` se integran en `main` después de la revisión del usuario. No se editan archivos de código ni se copian fuentes directamente al servidor: Ubuntu recibe las versiones mediante Git y reconstruye sus imágenes.

## Vista temporal de dev en Ubuntu

Por decisión del usuario, el puerto 5173 puede mostrar temporalmente la rama `dev`, sustituyendo la web estable. Se mantiene la base de datos existente; esta modalidad no crea un entorno de datos separado.

```bash
cd /home/razoxk/Documents/GitHub/Sistema-TO
git fetch origin
git switch dev
git pull --ff-only origin dev
docker compose -f compose.server.yaml build --build-arg VITE_APP_ENV=development web
docker compose -f compose.server.yaml up -d --no-deps web
```

La etiqueta se decide al compilar: `VITE_APP_ENV=development` la muestra en la web de Docker, y Vite local la muestra en modo desarrollo. No depende de `NODE_ENV` de la API.

## Volver a la web estable

```bash
git fetch origin
git switch main
git pull --ff-only origin main
docker compose -f compose.server.yaml build --build-arg VITE_APP_ENV=production web
docker compose -f compose.server.yaml up -d --no-deps web
```

Los comandos anteriores actualizan únicamente la web, adecuados para el cambio visual de DEV. Una modificación futura de API requiere reconstruir y desplegar también ese servicio.
