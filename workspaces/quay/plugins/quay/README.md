# Quay Plugin for Backstage/RHDH - Tag Management Fork

This fork of the [Backstage Community Quay Plugin](https://github.com/backstage/community-plugins/tree/main/workspaces/quay) adds **tag and label management capabilities** to the Portal UI.

## Features

The standard Quay plugin provides read-only visibility into container repositories. This fork adds:

| Feature | Description |
|---------|-------------|
| **Add New Tag** | Create a new tag pointing to an existing manifest digest |
| **Edit Labels** | Add or remove manifest labels (key=value metadata) |
| **Delete Tag** | Remove a tag from the repository |

Actions are accessible via a kebab menu (⋮) on each tag row in the Image Registry tab.

## Prerequisites

- Red Hat Developer Hub (RHDH) / Backstage Portal instance
- Quay Registry (tested with Project Quay and Quay.io)
- Node.js 18+ and Yarn (for building)
- Robot account with Write permissions on target repositories

## Quick Start

```bash
# Clone and build
git clone https://github.com/jonnyfiveiq/community-plugins.git
cd community-plugins
git checkout feature/quay-tag-management
cd workspaces/quay
yarn install && yarn tsc
cd plugins/quay
npx @janus-idp/cli package export-dynamic-plugin

# Output: backstage-community-plugin-quay-X.X.X-dynamic.tgz
```

---

## Complete Setup Guide

### 1. Quay Robot Account Configuration

Write operations require a robot account with appropriate permissions.

#### Step 1: Create Robot Account

1. Log into Quay UI (e.g., `https://your-quay-server`)
2. Navigate to your organization → **Robot Accounts**
3. Click **Create Robot Account**
4. Enter name: `portal_writer`
5. Description: `Portal write access for tag management`

#### Step 2: Grant Repository Permissions

For each repository that needs Portal management:

1. Navigate to **Repository → Settings → User and Robot Permissions**
2. Add the robot account (e.g., `orgname+portal_writer`)
3. Set permission level to **Write**

#### Permission Levels

| Level | Capabilities |
|-------|-------------|
| **Read** | Pull images, view tags and labels |
| **Write** | Push images, create/delete tags, manage labels |
| **Admin** | Full control including repository settings |

#### Step 3: Get Robot Token

1. Navigate to **Robot Accounts → Click robot name → Robot Token**
2. Copy the token for Portal configuration

---

### 2. Backend Proxy Configuration

The plugin requires a backend proxy to communicate with the Quay API.

#### Option A: Portal Built-in Proxy (Read + Write via Robot Token)

Add to your Portal's `app-config.yaml`:

```yaml
proxy:
  endpoints:
    '/quay/api':
      target: 'https://your-quay-server'
      headers:
        X-Requested-With: 'XMLHttpRequest'
        Authorization: 'Bearer YOUR_ROBOT_TOKEN'
      changeOrigin: true
      secure: false  # Set to true if using valid SSL certificate
```

#### Option B: Dedicated Backend Proxy Server

For more control over CORS and authentication, deploy a separate proxy:

```javascript
// quay-proxy.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['https://your-portal-url:7007'],
  credentials: true
}));

// Proxy to Quay API
app.use('/api/v1', createProxyMiddleware({
  target: 'https://your-quay-server',
  changeOrigin: true,
  secure: false,
  headers: {
    'Authorization': 'Bearer YOUR_ROBOT_TOKEN'
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Quay proxy running on port ${PORT}`);
});
```

Run with:
```bash
npm install express cors http-proxy-middleware
node quay-proxy.js
```

If using Option B, add CSP exception in Portal `app-config.yaml`:

```yaml
backend:
  csp:
    connect-src:
      - "'self'"
      - "https:"
      - "http://your-proxy-host:3001"
```

---

### 3. Build the Dynamic Plugin

```bash
# Clone the repository
git clone https://github.com/jonnyfiveiq/community-plugins.git
cd community-plugins
git checkout feature/quay-tag-management

# Navigate to Quay workspace
cd workspaces/quay

# Install dependencies and compile TypeScript
yarn install
yarn tsc

# Build the dynamic plugin
cd plugins/quay
npx @janus-idp/cli package export-dynamic-plugin
```

This produces: `backstage-community-plugin-quay-X.X.X-dynamic.tgz`

---

### 4. Deploy to Portal

#### Step 1: Copy Plugin to Server

```bash
scp backstage-community-plugin-quay-*.tgz admin@portal-server:~/
```

#### Step 2: Extract Plugin

```bash
# On Portal server
cd /var/lib/portal/dynamic-plugins-root/

# Create directory for new plugin
sudo mkdir backstage-community-plugin-quay-1.29.0
cd backstage-community-plugin-quay-1.29.0

# Extract the tarball
sudo tar -xzf ~/backstage-community-plugin-quay-*.tgz

# Set ownership (adjust user as needed)
sudo chown -R portal:root .
```

#### Step 3: Update Plugin Configuration

Edit `/var/lib/portal/config/dynamic-plugins.yaml`:

```yaml
plugins:
  # Quay Plugin with Tag Management
  - package: ./dynamic-plugins-root/backstage-community-plugin-quay-1.29.0
    disabled: false
    pluginConfig:
      dynamicPlugins:
        frontend:
          backstage-community.plugin-quay:
            mountPoints:
              - mountPoint: entity.page.image-registry/cards
                importName: QuayPage
```

**Note:** Remove or comment out any existing Quay plugin entry pointing to `./dynamic-plugins/dist/backstage-community-plugin-quay`.

#### Step 4: Configure Quay UI URL

Add to `app-config.yaml`:

```yaml
quay:
  uiUrl: 'https://your-quay-server'
```

#### Step 5: Restart Portal

```bash
sudo systemctl restart portal
```

---

### 5. Register Container Images in Catalog

Each Quay repository must be registered as a Component entity in the Portal catalog.

#### Example Catalog Entry

Create or update your `catalog-info.yaml`:

```yaml
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-execution-environment
  title: My Execution Environment
  description: Custom EE for Ansible automation
  annotations:
    quay.io/repository-slug: orgname/my-ee
spec:
  type: container-image
  lifecycle: production
  owner: user:default/admin
  system: ansible-platform
```

**Key annotation:** `quay.io/repository-slug` must match the Quay repository path (`namespace/repo-name`).

#### Bulk Registration

For large registries, generate catalog entries from the Quay API:

```bash
#!/bin/bash
# generate-catalog.sh
QUAY_HOST="https://your-quay-server"
ORG="admin"
TOKEN="YOUR_ROBOT_TOKEN"

curl -s -H "Authorization: Bearer $TOKEN" \
  "$QUAY_HOST/api/v1/repository?namespace=$ORG" | \
  jq -r '.repositories[].name' | while read repo; do
    cat <<EOF
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${repo}
  annotations:
    quay.io/repository-slug: ${ORG}/${repo}
spec:
  type: container-image
  lifecycle: production
  owner: user:default/admin
EOF
done
```

---

### 6. Verification

1. Navigate to a container image Component in the Portal catalog
2. Click on the **Image Registry** tab
3. Verify tags are displayed from Quay
4. Click the kebab menu (⋮) on any tag row
5. Test each action:
   - **Add New Tag** - Enter a new tag name, click Create
   - **Edit Labels** - Add/remove labels
   - **Delete Tag** - Confirm deletion

#### Check Logs

```bash
# Portal logs
journalctl -u portal -f | grep -iE "(quay|proxy)"

# Backend proxy logs (if using Option B)
tail -f /var/log/quay-proxy.log
```

---

## Troubleshooting

### "403 Forbidden" on write operations

- Verify robot account has **Write** permission on the repository
- Check the token is correctly configured in the proxy
- Ensure the proxy headers include `Authorization: Bearer <token>`

### "CORS error" in browser console

- Add Portal URL to proxy CORS configuration
- If using dedicated proxy, verify CSP `connect-src` includes the proxy URL

### Tags not loading

- Verify `quay.io/repository-slug` annotation matches repository path exactly
- Check proxy endpoint is reachable: `curl -k https://portal:7007/api/proxy/quay/api/v1/repository/org/repo/tag/`
- Verify Quay API is accessible with token

### Plugin not appearing

- Check plugin is extracted to correct directory
- Verify `dynamic-plugins.yaml` package path matches extracted location
- Check Portal logs for plugin loading errors
- Ensure no duplicate Quay plugin entries in config

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Portal UI     │────▶│  Portal Proxy   │────▶│   Quay API      │
│  (Quay Plugin)  │     │  /api/proxy/    │     │   /api/v1/      │
│                 │     │  quay/api       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              │ Authorization:
                              │ Bearer <robot_token>
                              ▼
                        ┌─────────────────┐
                        │  Quay Registry  │
                        │                 │
                        │  - Repositories │
                        │  - Tags         │
                        │  - Manifests    │
                        │  - Labels       │
                        └─────────────────┘
```

---

## API Endpoints Used

| Operation | HTTP Method | Endpoint |
|-----------|-------------|----------|
| List tags | GET | `/api/v1/repository/{org}/{repo}/tag/` |
| Create tag | PUT | `/api/v1/repository/{org}/{repo}/tag/{tag}` |
| Delete tag | DELETE | `/api/v1/repository/{org}/{repo}/tag/{tag}` |
| List labels | GET | `/api/v1/repository/{org}/{repo}/manifest/{digest}/labels` |
| Add label | POST | `/api/v1/repository/{org}/{repo}/manifest/{digest}/labels` |
| Delete label | DELETE | `/api/v1/repository/{org}/{repo}/manifest/{digest}/labels/{id}` |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `yarn test`
5. Submit a pull request

---

## License

Apache-2.0 (same as upstream Backstage Community Plugins)

---

## Acknowledgments

- [Backstage Community Plugins](https://github.com/backstage/community-plugins) - Original Quay plugin
- [Red Hat Developer Hub](https://developers.redhat.com/rhdh) - Dynamic plugin infrastructure
- [Project Quay](https://www.projectquay.io/) - Container registry
