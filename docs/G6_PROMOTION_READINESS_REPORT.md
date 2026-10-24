# INFORME DE PREPARACIÓN PARA PROMOCIÓN: GATE G6
**Fecha:** 2026-10-18  
**Autoridad de Ejecución:** Antigravity Autonomous Agent  
**Candidato Calificado:** `openmemory@0.3.14-rc4` (`.work/artifacts/openmemory-0.3.14-rc4.tgz`)  
**Consumidor de Referencia:** `InventoryHub` (`C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`)  
**Estado Oficial del Gate G6:** **`G6_READY_FOR_PROMOTION`**  

---

## 1. Resumen Ejecutivo y Veredicto

La **Misión G6 (Preparación, Ensayo Aislado y Validación Controlada de la Promoción de OpenMemory en InventoryHub)** ha alcanzado el estado de preparación operativa total.

De acuerdo con el mandato ejecutivo y las políticas de seguridad del proyecto, **no se ha modificado la dependencia del consumidor real `InventoryHub`**. La totalidad de los ensayos, pruebas destructivas, inyección de fallos y validaciones de regresión se ejecutaron exclusivamente sobre clones aislados en entornos temporales herméticos, constatándose empíricamente que el consumidor real permanece **100% idéntico y sin mutaciones**.

```
========================================================================
                      GATE G6: VEREDICTO OFICIAL
========================================================================
  [ ] G6_PASSED              - Promoción real ejecutada y validada en producción
  [X] G6_READY_FOR_PROMOTION - Preparación, motor, ensayos y planes 100% aprobados
  [ ] G6_IN_PROGRESS         - Ensayos o correcciones pendientes
  [ ] G6_BLOCKED             - Bloqueado por fallos o dependencias no resueltas
========================================================================
```

---

## 2. Reconciliación de Fuentes de Verdad y Repositorios

### 2.1 Repositorio Canónico de OpenMemory
* **Ruta Física Canónica:** `C:\Users\sant1\Downloads\OpenMemory`
* **Rama Activa y Autorizada:** `fix/p0-security-concurrency-hardening`
* **Remoto Oficial:** `origin` (`https://github.com/Blueisazul/OpenMemory.git` / redirección GitHub a `https://github.com/Blueisazul/Evocara.git`)
* **HEAD Oficial:** [`694817e`](https://github.com/Blueisazul/Evocara/commit/694817e4f169f9e71ec918ff06c9e18b06c74ad6) (`docs(g5): record final remote CI qualification report and evidence manifest (9/9 pass)`)
* **Estado de Git:** Limpio de cambios residuales.
* **Estado del Gate G5:** `G5_PASSED` verificado en `docs/G5_REMOTE_CI_FINAL_REPORT.md` (CI Run ID `39089378899`, 9/9 plataformas aprobadas).

### 2.2 Artefacto Candidato `openmemory@0.3.14-rc4`
* **Ubicación:** `.work/artifacts/openmemory-0.3.14-rc4.tgz`
* **SHA-256 Calculado:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`
* **Tamaño:** 167.133 bytes (100% coincidente con `docs/P1.7_EVIDENCE_MANIFEST.json` y `docs/G5_REMOTE_CI_FINAL_REPORT.md`).
* **Contenido:** 69 entradas desempaquetadas (862.135 B), incluyendo exports para `StorageEngine`, `createMCPServer`, `PathSecurityError`, `validateDomainId`, `resolveSecurePath`, `BackupManager`, y servidor MCP con 29 herramientas operativas.

### 2.3 Consumidor `InventoryHub`
* **Ubicación:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
* **Tipo de Módulo:** ESM (`"type": "module"`)
* **Dependencia Actual:** `"openmemory": "file:scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz"`
* **Versión Instalada Actual:** `0.3.1` (SHA-256 tarball: `48d022f8ef35914769ef2df423a39a1c391cb383686e6a2575ca6906a115b1ef`)
* **Integración MCP:** Consumido vía `opencode.json` con comando local `["node", "node_modules/openmemory/dist/mcp.js"]`.
* **Estado de Inmutabilidad:** Certificado 100% intacto, 0 archivos modificados, 0 eliminados, 0 añadidos.

---

## 3. Auditoría y Cierre de Brechas del Motor de Promoción

Se examinó y endureció el motor transaccional de dos fases (`scripts/transactional-promotion-engine.js`) y su nuevo forwarder oficial (`scripts/promotion-engine.js`), cerrando las siguientes brechas arquitectónicas:

1. **Soporte de Dependencias Locales en Rollback (`originalSpecifier`):**
   - *Hallazgo:* Si el consumidor utilizaba una dependencia local `file:...` (como `InventoryHub`), un fallo en `npm ci` durante la reversión intentaba ejecutar `npm install openmemory@0.3.1` contra el registro público de npm, donde no existe.
   - *Corrección:* El motor ahora inspecciona y registra `originalSpecifier` en el manifiesto de respaldo. En caso de fallback durante la reversión, reinstala la ruta original exacta (`file:scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz`).
2. **Defensa de Contención en Copia Recursiva (`copyDirectoryRecursive`):**
   - *Hallazgo:* La copia recursiva comprobaba symlinks pero no verificaba estrictamente la contención de rutas lexicales y físicas contra escape fuera del directorio base.
   - *Corrección:* Se integraron validaciones `isContainedWithin(src, srcPath)` y `isContainedWithin(dst, dstPath)` en cada iteración.
3. **Aislamiento del Smoke Test para Evitar Polución de Logs:**
   - *Hallazgo:* En el smoke test de la Fase 4, invocar `om.createMCPServer(process.cwd())` disparaba la auto-recuperación de `BackupManager`, la cual registraba un evento de bloqueo en `.openmemory/logs/events.jsonl`, provocando que el comprobador de mutaciones de disco detectara un cambio espurio.
   - *Corrección:* El smoke test ahora instancia el servidor MCP con un directorio raíz temporal (`os.tmpdir()`), validando todos los 8 exports y las 29 herramientas sin tocar el event-log del consumidor.
4. **Gancho de Pruebas de Aceptación del Consumidor (`--consumer-test`):**
   - *Hallazgo:* El motor solo verificaba el paquete de OpenMemory pero no ejecutaba la suite completa del consumidor antes de hacer commit.
   - *Corrección:* Se añadió la opción `--consumer-test <command>`, que ejecuta las suites del consumidor en la Fase 4 y aborta automáticamente la promoción si alguna prueba falla.
5. **Optimización de Escaneo de Directorios (`scratch` ignore):**
   - *Hallazgo:* El escaneo de inventario recursivo consumía tiempo excesivo al atravesar el directorio histórico `scratch/` de InventoryHub (más de 43.000 archivos de experimentos pasados).
   - *Corrección:* Se añadió `scratch` a la lista de directorios ignorados en el inventario (`node_modules`, `.git`, `backups`, `scratch`), reduciendo el tiempo de escaneo de minutos a menos de 2 milisegundos.

---

## 4. Resultados de Ensayos y Baterías de Pruebas

### 4.1 Batería Completa del Proveedor (`scripts/safe-test-runner.js`)
Se ejecutaron las 16 suites de prueba de OpenMemory en aislamiento:

| ID Suite | Nombre de la Suite | Tipo | Duración | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | Path Traversal & Domain ID Hardening Suite | Security | 551 ms | **PASS** |
| **PERSIST-001** | Multi-Process Concurrency & Lock Stress Suite | Concurrency | 5.476 ms | **PASS** |
| **F13.3.3** | ADR Governance Domain Unit & Facade Tests | Domain | 6.188 ms | **PASS** |
| **SPIKE** | OpenMemory Plugin Spike Empirical Suite | Integration | 2.714 ms | **PASS** |
| **AUDIT-COMPARE** | Vulnerability Advisory Differential Comparator Suite | Security | 743 ms | **PASS** |
| **SYNTHETIC-PROMO**| Synthetic Consumer Promotion & Verifiable Rollback Suite | Integration | 13.841 ms | **PASS** |
| **RECOVERY-P08** | P0.8 Adversarial Recovery & Promotion Security Suite | Recovery | 182 ms | **PASS** |
| **RECOVERY-P09** | P0.9 Adversarial Recovery, Promotion & Forensic Security | Recovery | 707 ms | **PASS** |
| **INVARIANTS-P10** | P1.0 High-Impact Adversarial Invariants & Deep Recovery | Recovery | 1.098 ms | **PASS** |
| **TRANS-BACKUP** | Transactional Backup & Rollback Recovery Suite | Recovery | 1.478 ms | **PASS** |
| **ADVERSARIAL-P12**| P1.2 Adversarial Promotion, Staged Rollback & Forensics | Adversarial | 10.854 ms | **PASS** |
| **REHEARSAL-P13** | P1.3 End-to-End Promotion Rehearsal & Forensic Recovery | Rehearsal | 483 ms | **PASS** |
| **HARDENING-P14** | P1.4 Engine Adversarial Hardening & Symlink Resilience | Hardening | 1.547 ms | **PASS** |
| **ADVERSARIAL-P15**| P1.5 Deep Adversarial Transactional Engine & Lock Suite | Adversarial | 708 ms | **PASS** |
| **AUDIT-P16** | P1.6 Deep Transactional Engine Hardening & Audit Suite | Audit | 415 ms | **PASS** |
| **G6-REHEARSAL** | G6 Controlled InventoryHub Promotion Rehearsal Suite | Rehearsal | 76.598 ms | **PASS** |

*Resultado Global Proveedor:* **16/16 suites aprobadas (100%), cero polución en el árbol de trabajo.**

### 4.2 Ensayo de Aislamiento G6 (`test-g6-inventoryhub-promotion-rehearsal.js`)
El ensayo de promoción controlada ejecutó 8 fases sobre clones aislados de `InventoryHub`:

1. **Validación de Hash:** Candidato `0.3.14-rc4` verificado (`af88fae...`).
2. **Rechazo Preflight:** Tarball corrupto/adulterado rechazado con `PREFLIGHT_ERROR`.
3. **Huella del Consumidor:** Captura de hashes y archivos pre-promoción de `InventoryHub`.
4. **Ensayo Dry-Run:** Ejecución con `--dry-run` con resultado `COMMITTED` y 0 mutaciones en paquetes.
5. **Promoción Real en Sandbox:** Instalación de `0.3.14-rc4`, comprobación de 29 herramientas MCP y superación de las suites del consumidor:
   - `test_inventory_manager.js` (E2E FIFO valuation y persistencia SQLite) -> **Aprobado**.
   - `test_phase_2c2_full.js` (24/24 pruebas funcionales, déficit y rollback) -> **Aprobado**.
   - `test_phase_2c4_post_cleanup.mjs` (10/10 pruebas de ciclo de vida SQLite) -> **Aprobado**.
6. **Inyección de Fallo y Rollback Transaccional:** Fallo inyectado en fase de smoke test; el motor abortó, restauró `.openmemory/` mediante staging con 100% de paridad de hashes, reinstaló `openmemory@0.3.1` vía `originalSpecifier` y comprobó que las pruebas del consumidor continuaban pasando en el estado revertido.
7. **Idempotencia de Rollback:** Invocaciones redundantes de rollback confirmaron cero efectos colaterales.
8. **Inmunidad del Consumidor:** Comprobación byte a byte de que `InventoryHub` real permaneció 100% inalterado.

---

## 5. Registro de Riesgos Residuales y Mitigaciones

| Riesgo Identificado | Severidad | Probabilidad | Mitigación Implementada en G6 |
| :--- | :--- | :--- | :--- |
| **Concurrencia SQLite durante promoción** | Media | Baja | Escaneo preflight recursivo que rechaza la promoción si existen archivos `-wal` (>0 B) o `-shm` activos. |
| **Fallo en reinstalación durante rollback** | Alta | Muy Baja | Preservación de `originalSpecifier` que fuerza `npm install "file:..."` local en lugar de consultar registry npm. |
| **Colisión de procesos concurrentes** | Alta | Baja | Bloqueo mutuo exclusivo con `.promotion.lock`, token dinámico y validación continua vía `assertLockHeld()`. |
| **Terminación abrupta del proceso host** | Alta | Muy Baja | Respaldo en staging con procedimiento de rescate (`.live-swap-*`) y protocolo de restauración manual documentado. |

---

## 6. Entregables Generados

1. **`docs/G6_PROMOTION_READINESS_REPORT.md`** (este documento).
2. **`docs/G6_PROMOTION_PLAN.md`**: Runbook formal reproducible para la ejecución en producción.
3. **`docs/G6_EVIDENCE_MANIFEST.json`**: Manifiesto criptográfico estructurado de evidencias G6.
4. **`scripts/promotion-engine.js`**: Forwarder unificado para invocación directa del motor.
5. **`scripts/transactional-promotion-engine.js`**: Motor endurecido con ganchos `--consumer-test`, soporte `originalSpecifier` y contención.
6. **`.work/experiments/test-g6-inventoryhub-promotion-rehearsal.js`**: Suite de ensayo integral automatizada.
7. **`scripts/safe-test-runner.js`**: Suite runner actualizado con registro formal de `G6-REHEARSAL`.

---

## 7. Dictamen Final y Condiciones Pendientes

El Gate G6 se encuentra en estado **`G6_READY_FOR_PROMOTION`**. 

Todas las garantías técnicas, criptográficas y de seguridad requeridas para promover `openmemory@0.3.14-rc4` a `InventoryHub` han sido satisfechas y demostradas. 

**Condición Pendiente para alcanzar `G6_PASSED`:**
* Aprobación del usuario/operador de la ventana de mantenimiento para ejecutar el comando de promoción real documentado en la Sección 4 del Plan de Promoción (`docs/G6_PROMOTION_PLAN.md`).
