# Servarr deployment and automatic updates

[compose.servarr.yml](../compose.servarr.yml) contains the PlanScan and Watchtower services. To add them to an existing Servarr stack, copy those two entries under its `services` key and retain its existing `cloudflared` network declaration. The file's external network declaration is for standalone use against an existing `servarr_cloudflared` network.

Before changing a live stack, save a private backup of its Compose file. Keep its `.env` and tunnel token on the server. Validate the edited file with `docker compose config --quiet`, then start only the new services:

```sh
docker compose build planscan
docker compose up -d --no-deps planscan watchtower
```

PlanScan is reachable on the host's loopback port 4173 and by its Docker service name on the tunnel network. The image's health check must pass before configuring public access. No project data volume is required; users retain project files and browser drafts.

## Cloudflare Tunnel

Use this published application route on the existing tunnel:

| Setting | Value |
| --- | --- |
| Public hostname | `planscan.geopointstudio.com` |
| Service type | HTTP |
| Service URL | `planscan:4173` |
| Complete internal URL | `http://planscan:4173` |

The public address remains **https://planscan.geopointstudio.com**. PlanScan's internal HTTP listener does not accept `https://planscan:4173`. The Compose service shares the tunnel's Docker network and enables `TRUST_PROXY=1` so HTTPS-origin map requests work through Cloudflare.

## Update flow

1. Push a change to `main` in the public PlanScan repository.
2. GitHub Actions runs model/server tests, builds and starts the production container, checks health and runs the browser suite.
3. Successful checks advance the `deploy` branch to that commit. Failed checks leave `deploy` unchanged.
4. [Nicholas Fedor's Watchtower fork](https://github.com/nicholas-fedor/watchtower) checks `deploy` every 300 seconds, builds that exact Git commit with the Docker daemon and recreates PlanScan with its existing networks, environment and other settings.

This uses the fork's [Git monitoring feature](https://github.com/nicholas-fedor/watchtower/blob/main/docs/advanced-features/git-monitoring/index.md). No registry account or GitHub token is needed on the server for this public repository. If a Git build fails, the running container is retained and a later check retries. Changes to the server's Compose configuration still require a deliberate Compose apply; Git monitoring updates the application image.

Other running containers use Watchtower's normal registry-image update path unless excluded by their Watchtower labels. Existing pinned image versions remain pinned. Watchtower's Docker socket mount lets it manage those containers; do not publish its management API.

Check status and the deployed source revision:

```sh
docker compose ps planscan watchtower
docker logs --tail 80 watchtower
docker inspect --format '{{index .Config.Labels "com.centurylinklabs.watchtower.git-last-commit"}}' planscan
```

After the first Git rebuild, the last command reports the deployed commit. For an initially built image, set `org.opencontainers.image.revision` to the source commit when building if revision tracking must survive a Watchtower restart before its first rebuild. The server deployment uses that image label.
