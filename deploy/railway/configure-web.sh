#!/bin/sh
set -e
case "${PORT:-}" in ''|*[!0-9]*) echo 'PORT debe ser un puerto válido.' >&2; exit 1 ;; esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then echo 'PORT fuera de rango.' >&2; exit 1; fi
if ! printf '%s' "${API_UPSTREAM:-}" | grep -Eq '^[A-Za-z0-9.-]+:[0-9]{1,5}$'; then
  echo 'Configura API_UPSTREAM con el nombre privado de la API y su puerto.' >&2
  exit 1
fi
DNS_RESOLVERS=$(awk '$1 == "nameserver" { if ($2 ~ /:/) printf "[%s] ", $2; else printf "%s ", $2 }' /etc/resolv.conf)
if [ -z "$DNS_RESOLVERS" ]; then echo 'No hay servidores DNS disponibles.' >&2; exit 1; fi
export DNS_RESOLVERS
# Keep Nginx variables such as $host and $request_uri intact.
export NGINX_ENVSUBST_FILTER='^(PORT|API_UPSTREAM|DNS_RESOLVERS)$'
