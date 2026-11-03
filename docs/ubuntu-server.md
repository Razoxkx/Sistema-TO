# Servidor Ubuntu de Espacio TO

Ruta: `/home/razoxk/Documents/GitHub/Sistema-TO`.

Acceso privado: `http://100.94.70.111:5173`. El dispositivo debe tener acceso al servidor mediante Tailscale. Utiliza correo y contraseña local. Una IP HTTP privada no permite el ingreso directo con Google; las cuentas Google que ya activaron una contraseña conservan el acceso a sus mismas fichas.

## Servicios

Se usa `compose.server.yaml`, con proyecto Docker `espacio-to`. Web se publica únicamente en la IP Tailscale y loopback. MySQL y API permanecen dentro de la red Docker, sin puertos publicados. Los datos se conservan en `espacio-to_mysql_data`. Los contenedores tienen reinicio automático y se pueden consultar desde Portainer.

```bash
cd /home/razoxk/Documents/GitHub/Sistema-TO
docker compose -f compose.server.yaml ps
docker compose -f compose.server.yaml logs --tail=80 api web
```

Para reconstruir después de actualizar el código:

```bash
docker compose -f compose.server.yaml up -d --build --wait
```

No uses `down -v`: eliminaría el volumen de la base. La configuración privada está en `.env` con permisos 600 y no se incluye en Git ni en las imágenes.

## Configuración

`APP_ORIGIN=http://100.94.70.111:5173`, `WEB_BIND_ADDRESS=100.94.70.111` y `LOCAL_AUTH_ENABLED=true`. Los orígenes adicionales de loopback permiten revisar el servicio desde el propio servidor. Si cambia la IP de Tailscale, actualiza ambos valores y recrea los servicios.

Este despliegue conserva HTTP dentro de Tailscale y `NODE_ENV=development`, como el acceso local existente. Tailscale protege el transporte entre dispositivos; no se publica la aplicación en todas las interfaces ni se desactivan las comprobaciones de sesión y origen. Para un despliegue HTTPS, configura TLS, un origen HTTPS y `NODE_ENV=production`.

La generación de informes necesita `OPENAI_API_KEY` en `.env` y saldo del proveedor. Al cambiar variables recrea API con `docker compose -f compose.server.yaml up -d api`. No pegues claves en el chat ni las añadas a Git.

## Copias de seguridad

La migración guarda una copia de la base y del código anterior en una carpeta privada bajo `/home/razoxk/.local/share/espacio-to/backups/`. Estos archivos contienen información clínica y deben mantenerse con acceso restringido.

Para crear otra copia, utiliza un directorio privado y el contenedor de esta aplicación:

```bash
umask 077
mkdir -p "$HOME/.local/share/espacio-to/backups"
docker compose -f compose.server.yaml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --events --triggers --hex-blob --set-gtid-purged=OFF --no-tablespaces "$MYSQL_DATABASE"' > "$HOME/.local/share/espacio-to/backups/espacio-to-$(date +%Y%m%d-%H%M%S).sql"
```

No se configuró una copia periódica automática. La copia inicial es una instantánea; los cambios que se hagan después en el sistema del Mac no se sincronizan con Ubuntu. Utiliza la dirección del servidor para continuar trabajando con los datos migrados.
