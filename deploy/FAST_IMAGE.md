# Fast Custom Image

This repository builds the custom Fast image in GitHub Actions and publishes it
to GitHub Container Registry (GHCR). The deployment server only pulls the image;
it does not need the Go, Node.js, or pnpm toolchains.

## 1. Publish the branch

Push the custom code and `.github/workflows/fast-image.yml` to a branch named
`fast-image-v0161` in your GitHub fork. Every relevant push to that branch runs the
`Build Fast Image` workflow. You can also rerun it manually from GitHub Actions.

The workflow publishes these tags:

- `ghcr.io/OWNER/REPOSITORY-fast:fast`: current deployment tag
- `ghcr.io/OWNER/REPOSITORY-fast:fast-RUN_NUMBER`: immutable rollback tag
- `ghcr.io/OWNER/REPOSITORY-fast:fast-sha-COMMIT`: source commit tag

For this repository's usual fork name, the image is
`ghcr.io/OWNER/sub2api-fast:fast`.

## 2. Configure GHCR access

For password-free pulls, open the package settings on GitHub and change the
package visibility to Public once. If the package must remain private, create a
classic personal access token with `read:packages` and log in on the deployment
server:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
```

Do not store the token in this repository or in `deploy/.env`.

## 3. Pull and run

The Compose override defaults to this repository's Fast image. To use a pinned
rollback tag or a different registry, set the image in `deploy/.env`:

```dotenv
SUB2API_FAST_IMAGE=ghcr.io/OWNER/sub2api-fast:fast
```

Then update only the application container. PostgreSQL and Redis remain
running:

```bash
docker compose \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.fast.yml \
  pull sub2api

docker compose \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.fast.yml \
  up -d --no-deps sub2api

docker compose \
  -f deploy/docker-compose.yml \
  -f deploy/docker-compose.fast.yml \
  ps sub2api
```

Use `deploy/docker-compose.local.yml` in the commands instead if that is your
base Compose file.

After the container is healthy, edit an OpenAI account in the admin UI and turn
on `Official Fast mode`. Requests routed to that account will include
`service_tier: priority`.

## Roll back

Set `SUB2API_FAST_IMAGE` to a previous immutable `fast-RUN_NUMBER` tag and run
the same `pull` and `up` commands. To return to the upstream image, omit
`docker-compose.fast.yml` and start the application from the base Compose file.
