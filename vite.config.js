import { defineConfig } from 'vite';

// Codespaces reenvía los puertos mediante un dominio HTTPS propio de cada instancia.
// Se permiten los hosts de esta instancia; se mantiene la comprobación de otros hosts.
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
const allowedHosts = codespace
  ? [5173, 4173].map((port) => `${codespace}-${port}.${forwardingDomain}`)
  : [];

export default defineConfig({
  // GitHub Pages publica este proyecto bajo /Rofee/; el desarrollo usa la raíz.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Rofee/' : '/',
  server: { host: '0.0.0.0', port: 5173, allowedHosts },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts },
});
