# G8 Release Candidate Report: SQLite Lifecycle, Continuous Observability & Resilient Candidate

**Report ID:** OM-G8-RC-REPORT-2026-10-18  
**Milestone:** G7.2 / G8  
**Status:** CANDIDATE_READY_FOR_HUMAN_RELEASE_REVIEW  
**Target Candidate:** `openmemory@0.3.15-rc1`  
**Author:** Antigravity Principal Systems Engineer  
**Date:** 2026-10-18  

---

## 1. Resumen Ejecutivo

En cumplimiento de la Misión Autónoma G7.2 / G8, se ha completado la consolidación integral del ciclo de vida de almacenamiento SQLite, la observabilidad periódica continua y segura, el endurecimiento frente a vulnerabilidades y condiciones de carrera de diagnósticos y locks, y la preparación reproducible del candidato de lanzamiento `openmemory@0.3.15-rc1`.

El artefacto candidato ha sido empaquetado, verificado criptográficamente y sometido a una instalación de prueba en un sandbox aislado y efímero (`os.tmpdir()`), validando la funcionalidad completa de las APIs de persistencia, ciclo de vida SQLite, coordinador de diagnósticos, herramientas MCP y CLI desde el paquete instalado en `node_modules`, no solo desde `src/`.

El consumidor de referencia `InventoryHub` ha permanecido **100 % intacto** en su estado documentado con `openmemory@0.3.14-rc4`, con sus 34/34 aserciones contables y de persistencia pasando satisfactoriamente. En estricto respeto a los límites de gobernanza, no se ha publicado en npm, no se han creado tags de release en git ni se han realizado operaciones remotas.

---

## 2. Estado Inicial y Divergencias Respecto al Informe Anterior

- **Entorno Canónico:** `C:\Users\sant1\Downloads\OpenMemory` en rama `fix/p0-security-concurrency-hardening` (HEAD `d8b416b`).
- **Estado de Partida:** G6 verificado y aprobado (`G6_PASSED`), G7 implementado y validado (`G7_IMPLEMENTED_AND_VERIFIED`), consumidor `InventoryHub` con `openmemory@0.3.14-rc4`.
- **Divergencias Detectadas y Resueltas:**
  1. *Falsos Positivos de Quiescencia SQLite:* `StorageEngine.auditWorkspaceSQLite` interpretaba erróneamente cualquier archivo `-shm` preexistente como una transacción activa no consolidada. Se corrigió para evaluar exclusivamente archivos `-wal` con tamaño físico `size > 0`.
  2. *Laguna de Liveness en Advisory Locks:* `inspectLocks()` sólo comprobaba expiración temporal por timestamp. Si un proceso moría imprevistamente, el lock permanecía como activo hasta agotar su TTL. Se introdujo detección de orfandad con `isProcessDead(lockData.pid)` y cota máxima de 5 minutos contra reciclado de PIDs.
  3. *Ausencia de API de Checkpoint Controlado:* SQLite en Node 22 (`DatabaseSync`) consolida automáticamente el WAL al cerrar conexiones, pero carecía de una interfaz explícita y coordinada para checkpoints en caliente durante la ejecución continua de servicios. Se introdujo `SQLiteLifecycleManager`.

---

## 3. Arquitectura y Subsistemas Implementados

### 3.1 Bloque A — SQLite Lifecycle & Safe Checkpointing (`src/storage/core/sqlite-lifecycle.ts`)
- **Registro Explícito:** Gestión de bases administradas vs externas/workspace.
- **Coordinación Exclusiva:** Adquisición de lock mutuo (`sqlite-maint-${hash}`) durante el checkpoint.
- **Semántica de Checkpointing:** Ejecución determinista de `PRAGMA wal_checkpoint(TRUNCATE)`.
- **Interpretación Estricta:** Si `busy !== 0`, se reporta invariablemente como `success: false, busy: true`, impidiendo falsos positivos de éxito.
- **Verificación Física:** Comprobación de que el tamaño del archivo `-wal` posterior al checkpoint es exactamente 0 bytes.
- **Prohibición de Borrado Manual:** Cero desvinculaciones manuales (`unlink`) de archivos `-wal` o `-shm`.

### 3.2 Bloque B — Observabilidad Periódica (`src/storage/core/health-coordinator.ts`)
- **Ciclo de Vida Explícito:** Control manual mediante `start()` y `stop()`.
- **No Invasivo y Solo Lectura:** Las ejecuciones periódicas se restringen estrictamente a `repair: false`.
- **Prevención de Solapamiento:** Flag atómico `isExecuting` que descarta ticks concurrentes si un diagnóstico previo continúa activo.
- **Contención de Fallos:** Bloques `try/catch` de aislamiento que registran telemetría (`health.coordinator_exception`) sin terminar el proceso anfitrión.
- **Liberación de Event Loop:** Temporizadores configurados con `timer.unref()` para evitar bloqueos del proceso de Node.js.
- **Detección de Transición de Estado y Throttling:** Notificación en cambios de estado y limitador de alertas para evitar spam en logs.

### 3.3 Bloque C — Auditoría de Seguridad y Hardening
- **Hardening de Advisory Locks:** `PersistenceEngine.inspectLocks()` y `cleanupStaleLocks()` enriquecidos con `isProcessDead(pid)`, cota de antigüedad (300,000 ms) y absorción de carreras TOCTOU.
- **Protección de Workspace:** Exclusión de symlinks (`fs.lstatSync`) y directorios voluminosos (`node_modules`, `dist`, `.work`).
- **Exposición de Métodos en StorageEngine:** `checkpointDatabase()`, `checkpointAllManaged()`, `checkpointWorkspace()`, `inspectLocks()`, `startHealthCoordinator()`, `shutdown()`.

### 3.4 Integración CLI y MCP
- **CLI:** `openmemory sqlite checkpoint [dbPath] [--mode TRUNCATE|FULL|PASSIVE|RESTART] [--json]`.
- **MCP:** Herramienta `openmemory_sqlite_checkpoint`.

---

## 4. Matriz de Verificación y Pruebas

Todas las suites se ejecutaron en sandboxes aislados temporales a través de `scripts/safe-test-runner.js`:

| Suite ID | Tipo | Descripción | Pruebas | Resultado | Código Salida |
|---|---|---|---|---|---|
| **G7.2-LIFECYCLE** | Resiliencia | Ciclo de vida SQLite, checkpoint WAL TRUNCATE, contención busy, dead PID locks, quiescencia -shm, health coordinator | 8/8 | **PASSED** | 0 |
| **G7-DIAGNOSTICS** | Observabilidad | Diagnósticos de subsistemas, cuarentena de logs torn, DAG cycles, CLI flags | 8/8 | **PASSED** | 0 |
| **SEC-001** | Seguridad | Path traversal, domain IDs, reserved DOS names, symlink escapes | 60/60 | **PASSED** | 0 |
| **PERSIST-001** | Concurrencia | Estrés multi-proceso, exclusión mutua, timeouts de locks, auto-recovery | 7/7 | **PASSED** | 0 |
| **AUDIT-P16** | Auditoría | Auditoría profunda de persistencia transaccional y rollback | 6/6 | **PASSED** | 0 |
| **ADVERSARIAL-P15**| Adversarial | Detección de token hijack, eliminación de locks, live swap rescue | 10/10 | **PASSED** | 0 |
| **G6-REHEARSAL** | Rehearsal | Promoción simulada de InventoryHub, inyección de fallos y rollback | 8/8 | **PASSED** | 0 |
| **RC-VERIFY-SANDBOX**| Release Eng | Instalación limpia de `openmemory-0.3.15-rc1.tgz` en sandbox efímero, MCP tools, CLI y Storage APIs | 8/8 | **PASSED** | 0 |

---

## 5. Estado del Consumidor de Referencia (`InventoryHub`)

- **Ruta:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Instalada:** `openmemory@0.3.14-rc4` (intacta, sin cambios).
- **Resultados de Aceptación:**
  - `node test_inventory_manager.js`: **PASSED**
  - `node test_phase_2c2_full.js`: **24/24 PASSED**
  - `node test_phase_2c4_post_cleanup.mjs`: **10/10 PASSED**
- **Veredicto del Consumidor:** **UNTOUCHED & VERIFIED (34/34 aserciones pasando).**

---

## 6. Identificación del Artefacto Candidato

- **Paquete:** `openmemory`
- **Versión:** `0.3.15-rc1`
- **Archivo:** `.work/artifacts/openmemory-0.3.15-rc1.tgz`
- **Tamaño:** `184,295` bytes
- **SHA-256:** `8b3df7e15222cfcce93d33044efc817e2c10564aa996af389a9603b66595d716`
- **Integridad:** `sha512-8q24rROste0KEu4n7hQj1nvd6s01rJg541B0sQx8hE90h32O5XGf3bK+tO8eU8qXGj3l9i3bVzUM90IJ8f9rvQ==`
- **Commit Base:** `d8b416b` (en rama `fix/p0-security-concurrency-hardening`)

---

## 7. Cumplimiento de Gobernanza

- **Publicación en npm:** PROHIBIDA Y NO EJECUTADA.
- **Git Push y Remotos:** NO EJECUTADOS.
- **Tags Oficiales:** NO CREADOS.
- **Promoción a Producción en InventoryHub:** NO EJECUTADA (permanece en 0.3.14-rc4).
- **Atestación SLSA:** Documentado formalmente que en entornos locales sin pipeline CI/CD con OIDC / GitHub Actions sigstore, la generación de firmas SLSA de procedencia requiere credenciales OIDC de red que no están configuradas; el hash SHA-256 y el manifiesto criptográfico de procedencia local actúan como base verificable.

---

## 8. Veredicto Final y Próximos Pasos

### Veredicto: `CANDIDATE_READY_FOR_HUMAN_RELEASE_REVIEW`

El candidato `openmemory@0.3.15-rc1` satisface íntegramente los criterios técnicos, de resiliencia y de ciclo de vida, encontrándose listo para revisión y autorización de promoción por parte del operador humano.

### Próximas Tres Prioridades de Mayor Impacto:
1. **Autorización Humana para Promoción a InventoryHub:** Promoción controlada de `openmemory@0.3.15-rc1` mediante `PromotionEngine` transaccional con rollback verificado.
2. **Dashboard MCP de Diagnósticos en Tiempo Real:** Exposición de endpoints de streaming o consulta continua del estado de salud consolidado de múltiples agentes.
3. **Pipeline de Firma Criptográfica y Atestación SLSA:** Integración de llaves cosign o pipeline OIDC para atestaciones SLSA Level 3 en el proceso de release formal.
