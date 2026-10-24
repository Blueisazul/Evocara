# INFORME TÉCNICO DE EJECUCIÓN — HITO G33
## Promoción Controlada de Evocara v0.4.0 GA, Integración Local y Cierre de Continuidad

- **Fecha:** 24 de octubre de 2026
- **Estado del Hito:** APROBADO (100 %)
- **Rama Integrada:** `feat/g31-g32-continuity` -> `master`
- **Artefacto GA Validado:** `evocara-0.4.0.tgz`
  - SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
  - Tamaño: 209,910 bytes
- **SBOM CycloneDX Validado:** `evocara-0.4.0.cdx.json`
  - SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
  - Tamaño: 41,973 bytes
- **Consumidor Activo Promovido:** `InventoryHub` (`c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`)
- **Dependencia Instalada:** `"evocara": "file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz"`
- **Resultado en Consumidor:** 34 / 34 pruebas de negocio aprobadas (100 %)
- **Estado de Regresión:** Cero regresiones; archivo retirado `inventory-data.json` permanece ABSENTE.
- **Estado del Remoto GitHub:** `https://github.com/Blueisazul/Evocara` (Desactualizado, sin push, protegido).

---

## 1. Resumen Ejecutivo

El Hito G33 tenía como objetivo primordial ejecutar la **promoción local controlada de Evocara v0.4.0 GA** en el entorno de desarrollo de `InventoryHub` y la **integración local de la rama de trabajo `feat/g31-g32-continuity` en `master`**, preservando de manera inviolable los artefactos históricos (`OpenMemory v0.3.1`, paquete protegido `openmemory-0.3.14-rc4.tgz`), las copias congeladas y la inmutabilidad del repositorio remoto en GitHub.

Todas las fases del protocolo se completaron con una tasa de éxito del 100 %:
1. **Fase A (Preflight y Protección):** Verificación de identidad canónica, comprobación bit-a-bit de checksums y tamaños del tarball GA y del SBOM CycloneDX, y congelación de líneas base.
2. **Fase B (Validación de Artefactos y Contratos):** Extracción y ejecución aislada de contratos públicos (45 exportaciones), binarios CLI duales (`evocara` y `openmemory`), servidores MCP curados, registro de sesiones, gobernanza ADR con votación por consenso, almacenamiento de investigaciones y recuperación determinista BM25 en sandbox temporal en `os.tmpdir()`.
3. **Fase C (Promoción Controlada en Staging y Producción Local):**
   - *Ensayo en Staging:* Clonación selectiva de `InventoryHub` en `os.tmpdir()`, validación previa (34/34), instalación de `evocara-0.4.0.tgz`, validación posterior (34/34 PASS, cero regresiones) y verificación completa de reversibilidad (rollback a `0.3.14-rc4` con 34/34 PASS).
   - *Promoción en Desarrollo Activo:* Respaldo atómico de metadatos en `InventoryHub/backups/backup_g33_promo_*/`, actualización de dependencia a `evocara@0.4.0`, reconfiguración de `opencode.json` y aprobación del 100 % de las 34 pruebas de negocio de InventoryHub.
4. **Fase D (Consolidación Local en Master):** Verificación del grafo de commits, inclusión de todos los entregables de G32/G33, merge limpio y trazable en `master` y verificación de compilación y regresión.
5. **Fase E (Gobernanza y Continuidad):** Actualización de `ROADMAP.md`, manifiestos de operación y elaboración de este informe y el documento de handoff.

---

## 2. Fase A: Preflight y Protección Criptográfica

Antes de modificar cualquier archivo en el sistema de archivos, se auditaron las identidades de repositorio y los artefactos de distribución:

| Componente | Ruta Canónica | Estado / Checksum | Resultado |
|---|---|---|---|
| **Repositorio Evocara** | `c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory` | Rama `feat/g31-g32-continuity`, HEAD `b905c6c` | Canónico Verificado |
| **Repositorio Histórico** | `c:\Users\sant1\Downloads\OpenMemory` | Rama `fix/p0-security-concurrency-hardening`, commit `bc7d66a` | Congelado / Intacto |
| **Tarball GA** | `.work/artifacts/evocara-0.4.0.tgz` | SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` (209,910 bytes) | Coincidencia Exacta |
| **SBOM CycloneDX** | `.work/artifacts/evocara-0.4.0.cdx.json` | SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` (41,973 bytes) | Coincidencia Exacta |
| **Consumidor InventoryHub** | `c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub` | Línea base `openmemory-0.3.14-rc4.tgz`, 34/34 tests aprobados | Verificado |

---

## 3. Fase B: Validación de Artefactos y Contratos Públicos

Se implementó el arnés reproducible `.work/experiments/test-g33-artifact-contract-validation.js`, extrayendo el paquete `evocara-0.4.0.tgz` en un directorio temporal aislado en `os.tmpdir()` para verificar su comportamiento de caja negra sin depender del código fuente local:

1. **Manifest y Metadatos:** Nombre `evocara`, versión `0.4.0`, licencia `MIT`.
2. **Ejecutables Duales:** `bin/evocara` y `bin/openmemory` se ejecutan limpiamente con código de salida 0.
3. **Contratos Públicos de Exportación:** 45 exportaciones principales disponibles en `./dist/index.js`, interfaces de `storage`, `stage-engine`, `installer` y `mcp`.
4. **Gobernanza de Sesión y ADR:**
   - Registro de sesión exitoso (`storageEngine.registerSession`).
   - Propuesta de decisión (`saveADR` con estado `PROPOSED`) y validación estricta de ownership (`agentId`, `sessionId`).
   - Transición de estado mediante consenso (`voteADR` a `IN_REVIEW`/`ACCEPTED`).
5. **Recuperación Determinista:**
   - Registro de investigación (`saveResearch`) con ítems indexados.
   - Búsqueda determinista BM25 (`queryKnowledgeItems({ query: 'deterministic' })`) resolviendo coincidencias exactas.

---

## 4. Fase C: Promoción Controlada en InventoryHub

### 4.1. Ensayo de Calificación en Staging (Aislamiento Total)
Mediante `.work/experiments/test-g33-staging-promotion.js`:
- Se clonó selectivamente `InventoryHub` en `os.tmpdir()/inventoryhub-g33-staging-*` (8,282 ms).
- **Línea Base Inicial:** `test_phase_2c4_post_cleanup.mjs` (10/10 PASS), `test_phase_2c2_full.js` (24/24 PASS) -> 34/34 PASS.
- **Instalación:** `npm install <tarball>` completada en 1s.
- **Post-Promoción en Staging:** 34/34 pruebas de negocio aprobadas. Se confirmó que `inventory-data.json` permaneció ABSENTE (evitando la regresión observada en G32 bajo condición OFF).
- **Verificación de Rollback:** Reversión completa a `openmemory-0.3.14-rc4.tgz` y re-ejecución de 34/34 pruebas aprobadas al 100 %.
- Evidencia archivada en `.work/evidence/g33-staging-promotion-results.json`.

### 4.2. Promoción en el Entorno de Desarrollo Activo
Tras el éxito del 100 % en staging, se ejecutó `.work/experiments/promote-inventoryhub-g33.js`:
1. Respaldo atómico de metadatos en:
   `InventoryHub/backups/backup_g33_promo_1792863055838/`
   Archivos respaldados: `package.json`, `package-lock.json`, `opencode.json`, `operation_manifest.json`.
2. Instalación de Evocara v0.4.0 GA:
   `npm install "c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory\.work\artifacts\evocara-0.4.0.tgz"`
   Agregado 1 paquete en 664 ms.
3. Actualización de especificación de dependencia:
   ```json
   "dependencies": {
     "evocara": "file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz"
   }
   ```
4. Actualización de `InventoryHub/opencode.json`:
   ```json
   "mcp": {
     "openmemory": {
       "type": "local",
       "command": [
         "node",
         "node_modules/evocara/dist/mcp.js"
       ]
     },
     "evocara": {
       "type": "local",
       "command": [
         "node",
         "node_modules/evocara/dist/mcp.js"
       ]
     }
   }
   ```
5. **Ejecución de Pruebas de Negocio en Entorno Activo Promovido:**
   - `node test_phase_2c4_post_cleanup.mjs`: **10 / 10 CHECKS PASSED**
   - `node test_phase_2c2_full.js`: **24 / 24 CHECKS PASSED**
   - **Total de Pruebas de Negocio:** **34 / 34 APROBADAS (100 %)**
   - **Invariante Crítica:** `inventory-data.json is absent (mandatory): true`
6. Manifiesto de operación registrado en `InventoryHub/operation_manifest.json` y evidencia en `.work/evidence/g33-inventoryhub-promotion-results.json`.

---

## 5. Fase D: Integración Local en Master

- **Rama Origen:** `feat/g31-g32-continuity`
- **Rama Destino:** `master`
- **Punto de Partida:** `master` en `9dfd79c` (ancestro directo de `feat/g31-g32-continuity`).
- **Commits Integrados:**
  - `0d68365`: Checkpoint de línea base canónica G30 y G31 (bi-temporal, linaje causal).
  - `b905c6c`: Implementación y certificación del benchmark G32 de continuidad inter-sesión.
  - Commit G33: Validación de contratos, scripts de promoción y evidencias de calificación.
- **Entregables de G32/G33 Incorporados:**
  - `.work/experiments/test-g32-continuity-benchmark.js`
  - `.work/evidence/g32-continuity-benchmark-results.json`
  - `.work/experiments/test-g33-artifact-contract-validation.js`
  - `.work/experiments/test-g33-staging-promotion.js`
  - `.work/experiments/promote-inventoryhub-g33.js`
  - `.work/evidence/g33-staging-promotion-results.json`
  - `.work/evidence/g33-inventoryhub-promotion-results.json`
  - `docs/G32_TECHNICAL_REPORT.md`
  - `docs/G32_CONTINUITY_HANDOFF.md`
  - `docs/G33_TECHNICAL_REPORT.md`
  - `docs/G33_CONTINUITY_HANDOFF.md`
  - `ROADMAP.md`
- **Compilación de Validación:** `npm run build` (`tsc`) Exit code 0 sin advertencias.
- **Suites de Regresión:**
  - `test-g31-lineage-and-contradictions-suite.js`: 18/18 PASS
  - `test-g30-bitemporal-suite.js`: 15/15 PASS
  - `test-g27-evocara-compatibility.js`: 9/9 PASS
  - `test-g25-mcp-curated-surface.js`: 9/9 PASS
  - `test-g23-expanded-100-benchmark.js`: 105/105 PASS

---

## 6. Procedimiento Probado de Rollback

En caso de requerirse revertir `InventoryHub` a la versión previa protegida (`openmemory-0.3.14-rc4.tgz`), el procedimiento comprobado en el simulacro de staging es:

1. Restaurar `package.json` desde el respaldo:
   ```powershell
   Copy-Item "backups/backup_g33_promo_1792863055838/package.json" "package.json" -Force
   ```
2. Restaurar `opencode.json` desde el respaldo:
   ```powershell
   Copy-Item "backups/backup_g33_promo_1792863055838/opencode.json" "opencode.json" -Force
   ```
3. Reinstalar dependencias mediante npm:
   ```powershell
   npm install --no-audit --no-fund
   ```
4. Verificar las 34 pruebas de negocio:
   ```powershell
   node test_phase_2c4_post_cleanup.mjs
   node test_phase_2c2_full.js
   ```

---

## 7. Distinción Rigurosa del Estado del Proyecto

Para máxima claridad técnica ante el Tech Lead y futuros agentes:
- **Implementado:** SÍ (Motor bi-temporal, linaje causal, dualidad de nomenclatura, contratos MCP, herramientas curadas).
- **Probado:** SÍ (34/34 pruebas en consumidor, 18/18 G31, 15/15 G30, 7/7 G29, 105/105 BM25 canónico).
- **Reproducible:** SÍ (Scripts automatizados en `.work/experiments/`).
- **Empaquetado:** SÍ (`evocara-0.4.0.tgz` verificado con SHA-256 inmutable y SBOM CycloneDX 1.5).
- **Integrado Localmente:** SÍ (`master` sincronizado localmente con `feat/g31-g32-continuity`).
- **Instalado en Entorno de Desarrollo Activo:** SÍ (`InventoryHub` operando con `evocara@0.4.0`).
- **Publicado en Registro Externo (npm):** NO (Sin autorización explícita; paquete no subido a npm).
- **Publicado / Pushed en Remoto GitHub:** NO (GitHub permanece desactualizado; cero operaciones `git push`).
- **Desplegado en Producción Externa:** NO (Operación exclusivamente local-first y de desarrollo).

---

## 8. Conclusión y Próximos Pasos

El Hito G33 ha cumplido íntegramente todos sus objetivos y criterios de aceptación sin una sola discrepancia ni regresión. `InventoryHub` se encuentra formalmente promocionado a Evocara v0.4.0 GA en el entorno de desarrollo local, con trazabilidad completa y capacidad inmediata de rollback.

**Siguiente Paso Recomendado (G34):**
- Planificación y ejecución de la sincronización controlada del repositorio remoto GitHub (`https://github.com/Blueisazul/Evocara`), sujeta a la configuración de credenciales y autorización explícita por parte del propietario del proyecto.
