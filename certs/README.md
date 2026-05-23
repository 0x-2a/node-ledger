# TLS Certificates

This directory holds TLS certs for HTTPS mode.

## Generate a self-signed cert for local development

```bash
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

The paths are configured in `config.yaml`:
```yaml
server:
  protocol: https
  tls:
    key: ./certs/server.key
    cert: ./certs/server.crt
```

## Switch to HTTPS

1. Run the `openssl` command above to generate certs.
2. Edit `config.yaml` and set `server.protocol: https`.
3. `pnpm dev` (or `pnpm start` after `pnpm build`).
4. Your server will now listen on `https://localhost:3000`.

> For production, replace with certs from Let's Encrypt or your CA.
