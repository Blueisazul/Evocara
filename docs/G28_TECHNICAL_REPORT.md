# INFORME TÉCNICO G28 — CIERRE DE EVOCARA v0.4.0 GA
## Auditoría Final, Paquete Definitivo, SBOM CycloneDX 1.5 y Preparación Transaccional de Promoción

- **Fecha:** 22 de octubre de 2026
- **Autor:** Antigravity (Arquitecto de Software Senior, Responsable de Release y Auditor de Seguridad)
- **Línea Base Previa:** Hito G27 Certificado (`openmemory-0.3.15-rc11.tgz`)
- **Artefacto Definitivo Producido:** `.work/artifacts/evocara-0.4.0.tgz` (209,910 bytes)
- **Hash SHA-256 del Artefacto:** `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
- **SBOM Asociado:** `.work/artifacts/evocara-0.4.0.cdx.json` (41,973 bytes, SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`)
- **Manifiesto de Release:** `.work/artifacts/evocara-0.4.0-manifest.json` (3,074 bytes)
- **Consumidor Activo:** `InventoryHub` (Protegido en `0.3.14-rc4`, 34/34 pruebas aprobadas, 0 mutaciones en vivo)

---

## 1. Resumen Ejecutivo y Dictamen de Release

El hito **G28** ha alcanzado el objetivo estratégico fundamental del proyecto: realizar el corte definitivo del paquete de producción **Evocara v0.4.0 GA**, generando sus artefactos criptográficos y SBOM correspondientes, verificando la compatibilidad hacia atrás integral con OpenMemory, y calificando el procedimiento transaccional de promoción en staging sin comprometer en ningún momento el consumidor de producción local activo.

### Dictamen Técnico Oficial:
**EVOCARA v0.4.0 ESTÁ TÉCNICAMENTE CALIFICADA Y LISTA PARA GENERAL AVAILABILITY (GA).**
- La base de código compila limpiamente sin advertencias ni errores (`npm run build`, exit code 0).
- El empaquetado reproducible produce `evocara-0.4.0.tgz` con 76 archivos estrictamente auditados (cero fugas de código fuente `.ts`, pruebas, temporales o credenciales).
- El SBOM CycloneDX 1.5 JSON ha sido generado y validado con éxito, enlazado criptográficamente con el hash SHA-256 del tarball.
- Todas las baterías de pruebas existentes (105 escenarios del benchmark canónico, invariantes de ranking, pruebas multilingües, consultas no respondibles, contratos MCP curados y compatibilidad dual) han aprobado al 100 % (0 regresiones).
- La prueba de instalación limpia desde el tarball definitivo en un sandbox aislado superó el 100 % de los criterios.
- Las 8 fases de calificación en staging sobre un clon de `InventoryHub` fueron superadas con éxito (34/34 pruebas de negocio aprobadas bajo v0.4.0 y rollback drill atómico con paridad de bytes del 100 %).
- El consumidor activo `InventoryHub` permanece rigurosamente intacto en `0.3.14-rc4`.

---

## 2. Bloque A — Auditoría y Verificación del Candidato G27

Antes de iniciar modificaciones, se auditó exhaustivamente el estado heredado de G27:
1. **Verificación Criptográfica del Candidato G27:**
   - Tarball `openmemory-0.3.15-rc11.tgz`: 208,927 bytes, SHA-256: `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`.
   - SBOM `openmemory-0.3.15-rc11.cdx.json`: 41,998 bytes, SHA-256: `3f123387ddcbc70fc9387a45bea36522118f373b2d69e3588dbe1cac266198f7`.
   - Manifiesto `openmemory-0.3.15-rc11-manifest.json`: 2,096 bytes, SHA-256: `d34122dfaba830e5bfaff9518a993ed54b0e8ddd3db0520ae1b3478ee54f8406`.
   - Se ejecutó `node scripts/generate-sbom.js --validate .work/artifacts/openmemory-0.3.15-rc11.cdx.json --tarball .work/artifacts/openmemory-0.3.15-rc11.tgz`, resultando en validación exitosa (Exit 0).
2. **Preservación de Artefactos de Referencia:** Los archivos candidatos de G27 fueron protegidos y permanecen archivados en `.work/artifacts/` para trazabilidad forense histórica.
3. **Estado de Git:** Se confirmó que el árbol de trabajo contenía únicamente las modificaciones legítimas de infraestructura y gobernanza de hitos previos.

---

## 3. Bloque B — Implementación y Corte Definitivo de Evocara v0.4.0 GA

Para transicionar de la denominación histórica OpenMemory a la identidad oficial Evocara sin incurrir en rupturas para consumidores existentes:

### 3.1 Alineación de package.json
- **Identidad Primaria:** Se configuró `"name": "evocara"` y `"version": "0.4.0"`.
- **Descripción:** `"Deterministic operational memory & stage governance framework for OpenCode and AI developer agents (formerly OpenMemory)"`.
- **Binarios Duales en `bin`:**
  ```json
  "bin": {
    "evocara": "./dist/cli.js",
    "openmemory": "./dist/cli.js"
  }
  ```
- **Exportaciones Modulares:** Se mantuvieron los puntos de entrada canónicos (`.`, `./storage`, `./mcp`, `./cli`, `./installer`, etc.) garantizando paridad total en importaciones ESM y CommonJS.

### 3.2 Actualización de CLI y Servidor MCP
- **CLI (`src/cli.ts`):** El comando `version` (`--version`, `-v`) fue actualizado para emitir la firma oficial: `Evocara (formerly OpenMemory) v0.4.0 (package: evocara@0.4.0)`. El comando `help` documenta ambas formas de invocación (`evocara <command>` o `openmemory <command>`).
- **Servidor MCP (`src/mcp.ts`):** Mantiene la resolución transparente de prefijos: cualquier llamada a `evocara_*` o `openmemory_*` se enruta al mismo manejador tipado, garantizando idénticas reglas de autorización, aislamiento de proyecto y recuperación BM25.
- **Configuración MCP (`mcp_config.json`):** Declara servidores duales `evocara` y `openmemory`.
- **Instalador (`src/installer.ts`):** Exporta los alias oficiales `installEvocara`, `uninstallEvocara` e `initEvocaraInteractive` manteniendo operativas las firmas históricas.
- **Documentación (`README.md`):** Actualizada íntegramente con la identidad oficial de Evocara y la matriz de compatibilidad.

### 3.3 Automatización de Release y Validación de SBOM
- Se actualizaron `scripts/generate-sbom.js` y `scripts/generate-release-manifest.js` para resolver dinámicamente nombres y versiones a partir de `${pkg.name}-${pkg.version}`, permitiendo generar tanto paquetes `evocara` como `openmemory`.
- Se empaquetó el tarball definitivo con `npm pack --pack-destination .work/artifacts/`, produciendo:
  - **Tarball:** `.work/artifacts/evocara-0.4.0.tgz` (209,910 bytes, SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`).
  - **SBOM:** `.work/artifacts/evocara-0.4.0.cdx.json` (41,973 bytes, SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`).
  - **Manifiesto:** `.work/artifacts/evocara-0.4.0-manifest.json` (3,074 bytes).

---

## 4. Bloque C — Validación Exhaustiva y Regresión

Se ejecutaron de manera sistemática todas las suites pertinentes contra la versión compilada y el paquete definitivo:

| Suite | Archivo de Prueba | Escenarios | Aprobados | Tasa de Éxito |
|---|---|---|---|---|
| **BM25 Pure Unit** | `test-g25-bm25-unit.js` | 9 | 9 | 100.0 % |
| **Benchmark Canónico 105** | `test-g23-expanded-100-benchmark.js` | 105 | 105 | 100.0 % (P@1 100 %, MRR 1.000, FDR 0.0 %) |
| **Spanish Multilingual** | `test-g24-multilingual-spanish.js` | 7 | 7 | 100.0 % |
| **Coordination & Unanswerable** | `test-g24-coordination-unanswerable.js` | 4 | 4 | 100.0 % |
| **Robustness Invariants & TMS** | `test-g23-robustness-invariants.js` | 10 | 10 | 100.0 % |
| **MCP Curated Surface** | `test-g25-mcp-curated-surface.js` | 9 | 9 | 100.0 % |
| **Dual Evocara Compatibility** | `test-g27-evocara-compatibility.js` | 9 | 9 | 100.0 % |
| **Clean Installation Acceptance**| `test-g28-clean-installation.js` | 4 | 4 | 100.0 % |
| **Staging InventoryHub Promotion**| `test-g28-inventoryhub-staging-promotion.js` | 8 | 8 | 100.0 % (34/34 tests de negocio aprobados) |

**Resultados del Benchmark:** Se preservó estrictamente la expectativa y calibración del benchmark canónico (105/105 escenarios aprobados, Precision@1 del 100.0 %, Recall@3 del 97.6 %, MRR de 1.000 y tasa de falsos descubrimientos del 0.0 %).

---

## 5. Bloque D — Seguridad de la Cadena de Suministro

- **SBOM CycloneDX 1.5:** Rastrea de forma exhaustiva 96 dependencias (directas y transitivas).
- **Dependencias de Producción:** Estrictamente 2 paquetes (`@modelcontextprotocol/sdk` y `zod`).
- **Análisis de Vulnerabilidades (`npm audit`):**
  - Los avisos sobre `@modelcontextprotocol/sdk` (GHSA-6qxp-vccf-f47h, GHSA-22jm-h49p-29qw, GHSA-6prh-2h8m-c8cw, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq) fueron evaluados y declarados **no aplicables**, dado que Evocara opera exclusivamente como servidor MCP STDIO local (tuberías de proceso) sin sockets HTTP, sin cliente OAuth y sin endpoints remotos.
  - Los avisos en dependencias de desarrollo (`toml`, `effect`, `hono`, `ip-address`) fueron evaluados como **no aplicables en runtime**, comprobándose que no forman parte del tarball distribuido.
- **Licenciamiento:** 100 % de licencias permisivas (MIT, Apache 2.0 y BSD). Cero licencias copyleft o comerciales.

---

## 6. Bloque E — Preparación de Promoción de InventoryHub

1. **Estado del Consumidor Activo:**
   - Ubicación: `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`.
   - Versión en `node_modules/openmemory`: `0.3.14-rc4`.
   - Pruebas en vivo ejecutadas en modo lectura pura: 34 / 34 pasaron limpiamente.
   - **Inviolabilidad:** Cero escrituras, cero promociones directas. El directorio activo se mantuvo 100 % intacto.
2. **Calificación en Staging (Clon Aislado):**
   - Se inicializó un clon limpio de `InventoryHub` en el directorio temporal del sistema.
   - `TransactionalPromotionEngine` aplicó `evocara-0.4.0.tgz` alcanzando el estado `COMMITTED`.
   - Las 34 pruebas de negocio (`test_inventory_manager.js`, `test_phase_2c2_full.js`, `test_phase_2c4_post_cleanup.mjs`) pasaron al 100 % en el entorno promovido.
   - Se comprobó que el servidor MCP responde correctamente en el consumidor a consultas de estado y herramientas.
3. **Simulacro de Rollback con Inyección de Fallos:**
   - Se inyectó un fallo simulado en la fase de smoke test.
   - El motor abortó de forma atómica y ejecutó la reversión al estado `ROLLED_BACK`.
   - Se verificó la paridad de bytes del 100 % en `package.json` y el paso íntegro de las 34 pruebas de negocio post-rollback.
4. **Runbook:** Se generó `docs/G28_PROMOTION_RUNBOOK.md` con las instrucciones exactas para ejecutar la promoción en vivo cuando el usuario lo autorice explícitamente.

---

## 7. Entregables Producidos en G28

1. `docs/G28_TECHNICAL_REPORT.md`: Este informe técnico consolidado.
2. `docs/G28_RELEASE_RECORD.md`: Registro oficial de release de `evocara-0.4.0.tgz`.
3. `docs/G28_SUPPLY_CHAIN_SECURITY_REPORT.md`: Auditoría de SBOM, vulnerabilidades y licencias.
4. `docs/G28_PROMOTION_RUNBOOK.md`: Protocolo de promoción transaccional y rollback para `InventoryHub`.
5. `docs/G29_CONTINUITY_HANDOFF.md`: Contexto técnico para continuar hacia la publicación final.
6. `ROADMAP.md`: Hoja de ruta actualizada con el hito G28 completado.
7. `.work/artifacts/evocara-0.4.0.tgz`: Paquete distribuido oficial (209,910 bytes).
8. `.work/artifacts/evocara-0.4.0.cdx.json`: SBOM CycloneDX 1.5 JSON (41,973 bytes).
9. `.work/artifacts/evocara-0.4.0-manifest.json`: Manifiesto criptográfico y de procedencia (3,074 bytes).
10. `.work/evidence/g28-inventoryhub-staging-evidence.json`: Evidencia de staging y rollback.
11. `.work/experiments/test-g28-clean-installation.js`: Suite de instalación en limpio.
12. `.work/experiments/test-g28-inventoryhub-staging-promotion.js`: Suite de staging y rollback drill.
