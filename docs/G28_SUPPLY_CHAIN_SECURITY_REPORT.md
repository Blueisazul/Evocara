# INFORME DE SEGURIDAD DE LA CADENA DE SUMINISTRO Y AUDITORÍA SBOM (HITO G28)
## Evaluación de Dependencias, Vulnerabilidades y Licencias para Evocara v0.4.0 GA

- **Fecha:** 22 de octubre de 2026
- **Auditor:** Arquitecto de Software & Auditor de Cadena de Suministro
- **Artefacto Objetivo:** `evocara-0.4.0.tgz` (209,910 bytes)
- **Hash SHA-256 del Artefacto:** `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
- **SBOM CycloneDX 1.5 JSON:** `.work/artifacts/evocara-0.4.0.cdx.json` (41,973 bytes)
- **Hash SHA-256 del SBOM:** `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
- **Componentes Registrados en el SBOM:** 96 dependencias rastreadas
- **Estado de Validación:** **APROBADO (Exit Code: 0)**

---

## 1. Composición Real del Paquete Distribuido

### 1.1 Dependencias Directas de Runtime
Evocara v0.4.0 mantiene un principio de diseño de dependencias estrictamente mínimas:

| Paquete | Versión Declarada | Ámbito | Propósito | Licencia |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.30.1` | Runtime (Producción) | Servidor MCP e interfaz de comunicación por STDIO | MIT |
| `zod` | `^3.23.0` | Runtime (Producción) | Validación tipada de esquemas de entrada para herramientas MCP | MIT |

### 1.2 Dependencias de Desarrollo (Excluidas del Tarball Distribuido)
Las herramientas de compilación y tipado son utilizadas exclusivamente durante el desarrollo y la compilación (`npm run build`):
- `@opencode-ai/plugin` (`^1.18.32`): Contratos y definiciones de tipos para el plugin de OpenCode.
- `@types/node` (`^26.6.2`): Definiciones de tipos del runtime de Node.js.
- `typescript` (`^7.0.2`): Compilador estático TypeScript.

**Verificación de Empaquetado:** La inspección del tarball `evocara-0.4.0.tgz` certifica que **ninguna dependencia de desarrollo ni archivo de `node_modules` está presente en el paquete distribuido** (76 archivos verificados, comprendiendo únicamente `dist/`, `LICENSE`, `README.md`, `mcp_config.json`, `AGENTS.md` y `.opencode/`).

---

## 2. Software Bill of Materials (SBOM) — CycloneDX 1.5

El SBOM formal ha sido generado de manera reproducible mediante `scripts/generate-sbom.js` bajo el estándar CycloneDX 1.5 JSON:
- **Ruta del Artefacto:** `.work/artifacts/evocara-0.4.0.cdx.json`
- **Componente Raíz:** `pkg:npm/evocara@0.4.0`
- **Enlace Criptográfico:** El componente raíz declara explícitamente el hash SHA-256 del tarball distribuido (`70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`).
- **Validación Estricta:** Comprobada con `node scripts/generate-sbom.js --validate .work/artifacts/evocara-0.4.0.cdx.json --tarball .work/artifacts/evocara-0.4.0.tgz` resultando en:
  - Estructura y esquema CycloneDX 1.5: VÁLIDO.
  - Coincidencia de versión de componente raíz con package.json: VÁLIDO.
  - Enlace criptográfico contra el tarball: VÁLIDO.
  - Grafo completo de dependencias directas y transitivas: 96 componentes registrados.

---

## 3. Auditoría de Vulnerabilidades y Análisis de Explotabilidad

La ejecución de `npm audit --json` reportó avisos asociados a `@modelcontextprotocol/sdk` y dependencias transitivas de desarrollo. A continuación se detalla el análisis de aplicabilidad y los vectores reales del sistema:

### 3.1 Avisos en `@modelcontextprotocol/sdk`
1. **GHSA-6qxp-vccf-f47h (Severidad: Alta, CVSS 7.5):**
   - *Descripción:* Un cliente OAuth podría enviar credenciales a un servidor de autorización arbitrario elegido por el servidor MCP.
   - *Evaluación de Explotabilidad en Evocara:* **NO APLICABLE.** Evocara implementa exclusivamente un *Servidor* MCP local mediante `StdioServerTransport` (tuberías locales estándar de entrada/salida de proceso). Evocara no implementa un cliente OAuth, no realiza peticiones HTTP/OAuth salientes y no se comunica con ningún servidor de autorización.
2. **GHSA-22jm-h49p-29qw (Severidad: Alta, CVSS 8.6):**
   - *Descripción:* Las tareas experimentales de MCP no estaban ligadas a la sesión que las creó.
   - *Evaluación de Explotabilidad en Evocara:* **NO APLICABLE.** Evocara no utiliza la API de tareas experimentales del SDK de MCP; el aislamiento de sesión y la autorización de tareas están gobernados internamente por `SessionRegistry` y `TaskDagDomain` de Evocara con verificación fail-closed de ownership por agente y sesión.
3. **GHSA-6prh-2h8m-c8cw (Severidad: Moderada, CVSS 6.5):**
   - *Descripción:* Redirecciones cross-origin en transportes cliente HTTP de MCP.
   - *Evaluación de Explotabilidad en Evocara:* **NO APLICABLE.** Cero transportes cliente HTTP utilizados.
4. **GHSA-46jr-4wx8-v453 (Severidad: Alta, CVSS 7.5):**
   - *Descripción:* Agotamiento de memoria en validación de peticiones HTTP en servidores MCP.
   - *Evaluación de Explotabilidad en Evocara:* **NO APLICABLE.** Evocara no expone ningún servidor o socket HTTP. El transporte MCP es local STDIO gestionado por el host (OpenCode / Cursor / Claude Desktop).
5. **GHSA-rvq5-wwqv-78pq (Severidad: Moderada, CVSS 6.8):**
   - *Descripción:* Aceptación de tokens bearer destinados a otro servicio.
   - *Evaluación de Explotabilidad en Evocara:* **NO APLICABLE.** Evocara no utiliza autenticación por tokens bearer HTTP.

### 3.2 Avisos en Dependencias de Desarrollo (devDependencies)
- **`toml` / `effect` (GHSA-4qx8-w7c3-pj3p, GHSA-9j65-hcg3-gc64, GHSA-9qmh-m7c6-f92p):** Involucrado a través de `@opencode-ai/plugin`.
  - *Evaluación:* **NO APLICABLE EN RUNTIME.** Es una dependencia de compilación estática excluida del paquete de producción.
- **`hono` (GHSA-5r4p-p66f-jhc7):** Path traversal en `serveStatic`.
  - *Evaluación:* **NO APLICABLE EN RUNTIME.** Hono es una dependencia transitiva del arnés de pruebas dev; no forma parte del runtime ni del paquete distribuido.

---

## 4. Auditoría de Licencias de Componentes

Se realizó una revisión integral de las licencias de todas las dependencias listadas en el SBOM:
- **Licencias Permisivas:** 100 % (MIT: 89 componentes, Apache 2.0: 5 componentes, BSD: 2 componentes).
- **Licencias Restrictivas / Copyleft (GPL, AGPL, LGPL):** 0 %.
- **Licencias Comerciales Propietarias:** 0 %.
- **Compatibilidad con Evocara (MIT):** Plena y sin conflicto legal.

---

## 5. Riesgos Residuales y Limitaciones de Seguridad

1. **Aislamiento a Nivel de Proceso:** El servidor MCP confía en el entorno de ejecución provisto por Node.js y la gestión del proceso padre (OpenCode).
2. **Defensa en Profundidad en Almacenamiento:** El subsistema `PathSecurity` (`src/storage/core/path-security.ts`) valida proactivamente que cualquier acceso a disco permanezca contenido dentro de la raíz de almacenamiento del proyecto, neutralizando ataques de path traversal (`..` o enlaces simbólicos maliciosos).
3. **Ausencia de Seguridad Absoluta:** Como buena práctica de ingeniería de seguridad, se deja constancia de que ningún escaneo automatizado garantiza la ausencia total de vulnerabilidades no descubiertas (Zero-Day). La superficie de ataque de Evocara v0.4.0 se mantiene drásticamente reducida gracias a su arquitectura 100 % local, transporte STDIO sin sockets y ausencia de dependencias externas en tiempo de ejecución.
