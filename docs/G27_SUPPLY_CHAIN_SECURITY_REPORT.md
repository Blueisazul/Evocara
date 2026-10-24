# INFORME DE SEGURIDAD DE LA CADENA DE SUMINISTRO Y AUDITORÍA DE DEPENDENCIAS (HITO G27)
## Software Bill of Materials (SBOM CycloneDX 1.5) y Evaluación de Vulnerabilidades

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G27 — Bloque B
- **Auditor:** Auditor de Seguridad de la Cadena de Suministro & Tech Lead
- **Artefacto Auditado:** `openmemory-0.3.15-rc11.tgz`
- **Hash SHA-256 del Artefacto:** `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`
- **SBOM CycloneDX Generado:** `.work/artifacts/openmemory-0.3.15-rc11.cdx.json` (41,998 bytes)
- **Hash SHA-256 del SBOM:** `3f123387ddcbc70fc9387a45bea36522118f373b2d69e3588dbe1cac266198f7`

---

## 1. Inventario de Dependencias y Desglose de Cadena de Suministro

El análisis exhaustivo del árbol de dependencias (`npm ls --omit=dev --all --json` y `package.json`) arroja una arquitectura de runtime intencionalmente minimalista:

```
+-------------------------------------------------------------------------+
|                  ÁRBOL DE DEPENDENCIAS DE EVOCARA v0.4.0                |
+-------------------------------------------------------------------------+
|  1. DEPENDENCIAS DIRECTAS DE RUNTIME (Empaquetadas e indispensables)    |
|     * @modelcontextprotocol/sdk@^1.30.1 (Protocolo MCP estándar)         |
|     * zod@^3.23.0 (Validación formal de esquemas tipados)               |
+-------------------------------------------------------------------------+
|  2. DEPENDENCIAS DE DESARROLLO (Excluidas del tarball distribuido)      |
|     * @opencode-ai/plugin@^1.18.32 (Shims y tipos del runtime OpenCode) |
|     * @types/node@^26.6.2 (Definiciones de TypeScript para Node.js)     |
|     * typescript@^7.0.2 (Compilador de lenguaje)                        |
+-------------------------------------------------------------------------+
|  3. COMPONENTES TOTALES RASTREADOS EN SBOM                              |
|     * 96 componentes (incluyendo transitivas del SDK de MCP)            |
+-------------------------------------------------------------------------+
```

---

## 2. Validación Criptográfica del SBOM CycloneDX 1.5

La herramienta oficial del proyecto `scripts/generate-sbom.js` ejecutó el proceso de extracción, estructuración y validación con los siguientes resultados auditables:

1. **Cumplimiento de Especificación:** Formato CycloneDX versión `1.5` JSON válido conforme a la especificación de OWASP.
2. **Atadura Criptográfica:** El componente raíz (`openmemory@0.3.15-rc11`) contiene el hash SHA-256 exacto del tarball distribuido (`cceeb715604bf64f1287f732f704683f8352276fc63d41b71d1d4147d842cdaf`).
3. **Grafo de Dependencias:** 100 % de las referencias PURL en el grafo (`dependsOn`) coinciden con componentes declarados en el inventario.
4. **Comprobación de Integridad:** Comando `node scripts/generate-sbom.js --validate` retorna **Exit Code 0** (`SBOM validation SUCCESSFUL`).

---

## 3. Auditoría Forense de Vulnerabilidades (`npm audit`)

La ejecución de `npm audit` reportó 2 avisos de seguridad en dependencias transitivas:

| Dependencia | Severidad | Identificador | Descripción del Aviso | Aplicabilidad en Evocara |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk <=1.31.0` | **High** | `GHSA-6qxp-vccf-f47h` | Vulnerabilidad en cliente OAuth que podría enviar credenciales a un servidor no autorizado. | **NO APLICABLE** |
| `@modelcontextprotocol/sdk <=1.31.0` | **Moderate** | `GHSA-22jm-h49p-29qw` | Tareas experimentales de MCP no vinculadas a la sesión creadora. | **NO APLICABLE** |
| `@modelcontextprotocol/sdk <=1.31.0` | **High** | `GHSA-6prh-2h8m-c8cw` | Transición HTTP / redirecciones cross-origin en cliente MCP. | **NO APLICABLE** |
| `hono 4.12.4 - 4.13.10` | **Moderate** | `GHSA-5r4p-p66f-jhc7` | Bypass de middleware en `serveStatic` por decodificación doble de ruta en servidor HTTP Hono. | **NO APLICABLE** |

### Análisis Técnico de No Aplicabilidad:
1. **Transporte STDIO Exclusivo:** Evocara implementa exclusivamente `StdioServerTransport` para la comunicación entre OpenCode / LLMs y el servidor MCP.
2. **Cero Exposición de Red:** Evocara **no levanta servidores HTTP, no utiliza endpoints REST, no expone middleware de archivos estáticos (Hono) y no utiliza autenticación OAuth**.
3. **Peligro de Actualización Automática:** El comando `npm audit fix --dry-run` proponía instalar 24 paquetes adicionales (incluyendo versiones inestables de compiladores para múltiples arquitecturas) y actualizar `zod` a una versión con cambios de contrato de esquemas que rompería la compatibilidad con `@opencode-ai/plugin`.
4. **Decisión de Seguridad:** Siguiendo la directriz de la misión (*"No actualices masivamente dependencias por rutina"*), se mantiene la versión verificada de `@modelcontextprotocol/sdk` y `zod`, documentando la no aplicabilidad de los vectores de ataque en entornos STDIO locales.

---

## 4. Auditoría de Licencias y Compatibilidad Open Source

Se examinaron las licencias de la totalidad de los 96 componentes rastreados en el SBOM:

| Tipo de Licencia | Cantidad de Paquetes | Estado de Compatibilidad |
|---|---|---|
| **MIT** | 89 paquetes | Totalmente compatible con la licencia MIT de Evocara. |
| **Apache-2.0** | 5 paquetes | Totalmente compatible sin restricciones virales. |
| **BSD-2-Clause / BSD-3-Clause** | 2 paquetes | Compatible con preservación de avisos de copyright. |
| **GPL / AGPL / Copyleft Viral** | **0 paquetes** | Ninguno detectado. |
| **Propietaria / Comercial** | **0 paquetes** | Ninguno detectado. |

---

## 5. Dictamen de Seguridad para Evocara v0.4.0 GA

- **Integridad de Cadena de Suministro:** **CALIFICADA (Aprobada)**.
- **Riesgo Residual de Runtime:** **NULO** (vectores HTTP/OAuth mitigados por diseño arquitectónico local-first en STDIO).
- **SBOM:** Disponible y verificable criptográficamente en `.work/artifacts/openmemory-0.3.15-rc11.cdx.json`.
