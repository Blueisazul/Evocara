# INFORME DE EJECUCIÓN TÉCNICA P0.4 — AUDITORÍA ADVERSARIAL, RECUPERACIÓN TRANSACCIONAL, CI MULTIPLATAFORMA Y CALIFICACIÓN DE RELEASE

**Proyecto:** Evocara / OpenMemory  
**Iteración:** P0.4  
**Rama:** `fix/p0-security-concurrency-hardening`  
**Commit base:** `1ef6a7c` (`1ef6a7cb9f3aa87566c3e0eaf576770e2f19b09e`)  
**Repositorio canónico:** `C:\Users\sant1\Downloads\OpenMemory`  
**Consumidor protegido:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub` (`openmemory@0.3.1` — Estrictamente inalterado)  
**Candidato calificado P0.4:** `openmemory@0.3.14-rc3` (SHA-256: `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6`)  
**Fecha de finalización:** 15 de octubre de 2026  
**Autor:** Antigravity AI — Ingeniero Principal & Responsable de Release

---

## 1. Estado Inicial Comprobado

La iteración P0.4 inició con una inspección determinista del entorno:
* **Rama y Commit:** `fix/p0-security-concurrency-hardening` sobre base `1ef6a7c`.
* **Candidatos Existentes Preservados:**
  - `openmemory-0.3.14-rc1.tgz` (160,896 B | SHA-256: `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb`)
  - `openmemory-0.3.14-rc2.tgz` (164,153 B | SHA-256: `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3`)
* **Línea Base Heredada:** 125 aserciones superadas en total aislamiento.
* **Consumidor:** `InventoryHub` con `0.3.1` y SQLite 100% inalterada.
* **Documento Inicial:** Emitido [docs/INFORME-P0.4-AUDITORIA-INICIAL.md](file:///C:/Users/sant1/Downloads/OpenMemory/docs/INFORME-P0.4-AUDITORIA-INICIAL.md).

---

## 2. Archivos Modificados y Justificación de Cambios

1. `src/storage/core/path-security.ts`:
   - *Justificación:* Bloqueo de NTFS Alternate Data Streams (`:`) y caracteres reservados de sistema de archivos (`< > : " | ? *`) dentro de `resolveSecurePath`.
2. `src/storage/core/persistence-engine.ts`:
   - *Justificación:* Blindaje de `cleanupStaleLocks` para locks con `exp === undefined` garantizando que no se eliminen si el proceso titular sigue vivo; validación de enteros para PIDs en `isProcessDead`.
3. `src/storage/domains/backup-manager.ts`:
   - *Justificación:* Reconciliación durable con comprobación de completitud en pre-flight (`manifest.json`), cuarentena no destructiva de carpetas `.recovery-*` corruptas, validación criptográfica de snapshots durante el rollback (`previousHash`), preservación de directorios ante fallos de rollback (`FAILED_ROLLBACK`) y exclusión mutua de procesos mediante `withStateLock`.
4. `src/storage.ts`:
   - *Justificación:* Envoltura de `restoreBackup` y `recoverInterruptedRestore` bajo `withStateLock` para garantizar consistencia atómica entre el motor de persistencia y la proyección de estado `projectStageState`.
5. `.work/experiments/test-sec001-path-traversal.js`:
   - *Justificación:* Adición de sección 3G con 8 verificaciones de ADS y caracteres prohibidos.
6. `.work/experiments/test-persist001-concurrency.js`:
   - *Justificación:* Adición de TEST 6 verificando que locks sin `exp` de procesos vivos no se destruyan.
7. `.work/experiments/test-backup-transactional.js`:
   - *Justificación:* Expansión a 9 pruebas exhaustivas, incluyendo rechazo de backups incompletos, cuarentena de manifiestos dañados, integridad de snapshot en reversión y simulación real de caída de proceso hijo.
8. `.github/workflows/ci.yml`:
   - *Justificación:* Implementación del pipeline de integración continua multiplataforma (Windows, Linux, macOS).
9. `package.json`:
   - *Justificación:* Bump de versión formal a `0.3.14-rc3`.
10. `docs/`:
   - *Justificación:* Actualización de `RELEASE-CANDIDATE-0.3.14-RC3.md`, `RESTORE-RECOVERY-DESIGN.md` y `PRODUCTION-PROMOTION-ROLLBACK.md`.

---

## 3. Defectos Encontrados y Severidad

| ID | Severidad | Módulo | Defecto Confirmado |
| :--- | :--- | :--- | :--- |
| **DEF-P0.4-B1** | **Crítica (P0)** | `backup-manager.ts` | Eliminación destructiva de snapshots de recuperación cuando el manifiesto está corrupto o truncado por un corte de energía. |
| **DEF-P0.4-B2** | **Crítica (P0)** | `backup-manager.ts` | Eliminación de la carpeta de recuperación e informe de éxito falso cuando el rollback falla por error de disco (`rollbackErrors.length > 0`). |
| **DEF-P0.4-B3** | **Alta (P1)** | `backup-manager.ts` | Ausencia de verificación de hash SHA-256 en archivos del recovery snapshot al revertir hacia el estado vivo. |
| **DEF-P0.4-B4** | **Alta (P1)** | `storage.ts` / `backup-manager.ts` | Ausencia de exclusión mutua (`withStateLock`) durante restauraciones y recuperaciones, permitiendo carreras concurrentes de E/S. |
| **DEF-P0.4-B5** | **Alta (P1)** | `backup-manager.ts` | Restauración parcial silenciosa (franken-state) ante backups donde faltan archivos declarados en `manifest.json`. |
| **DEF-P0.4-C1** | **Alta (P1)** | `path-security.ts` | Omisión de validación de Alternate Data Streams NTFS (`:`) en componentes de `resolveSecurePath`. |
| **DEF-P0.4-C2** | **Media (P2)** | `persistence-engine.ts` | Reclamación prematura en `cleanupStaleLocks` de locks con `exp === undefined` cuyo PID titular sigue con vida. |

---

## 4. Soluciones Implementadas

1. **Cuarentena No Destructiva (`.quarantined-*`):**
   Si `recoverInterruptedRestore` encuentra una carpeta `.recovery-*` con manifiesto dañado o ilegible, evalúa si contiene archivos. Si hay archivos de snapshot, la renombra a `.quarantined-recovery-...`, preservando la evidencia física para recuperación manual sin borrarla.
2. **Preservación Obligatoria ante Fallo de Rollback (`FAILED_ROLLBACK`):**
   Si ocurre cualquier excepción de E/S durante el rollback, el manifiesto se marca con fase `FAILED_ROLLBACK` y la carpeta `.recovery-<opId>` permanece en disco.
3. **Validación Criptográfica en Rollback:**
   Cada archivo a restaurar en reversión es contrastado con `sha256(content) === fileItem.previousHash`. Si no coincide, se detiene la sobrescritura y se registra error.
4. **Validación de Completitud en Pre-flight:**
   Antes de mutar el estado vivo, `doRestoreBackup` comprueba que el 100% de los archivos declarados en `manifest.json` existan físicamente en el snapshot y tengan sumas criptográficas válidas.
5. **Bloqueo Transaccional Reentrante:**
   `restoreBackup` y `recoverInterruptedRestore` operan dentro de `withStateLock`, garantizando la invariante Single-Writer.
6. **Filtro de NTFS ADS e Illegal Chars:**
   `resolveSecurePath` rechaza cualquier componente que contenga `/[<>:"|?*]/`, bloqueando flujos alternativos de NTFS y caracteres ilegales.
7. **Protección de Locks sin `exp` de Procesos Vivos:**
   `cleanupStaleLocks` solo purga locks con `exp === undefined` si han superado el umbral `olderThanMs` y su PID está comprobado como muerto.

---

## 5. Comandos Ejecutados y Códigos de Salida

| Comando | Propósito | Exit Code |
| :--- | :--- | :--- |
| `git status --short --branch` | Verificación de baseline | 0 |
| `npm run build` (`npx tsc`) | Compilación de TypeScript y tipos | 0 |
| `node .work/experiments/test-sec001-path-traversal.js` | Suite SEC-001 (60 checks) | 0 |
| `node .work/experiments/test-persist001-concurrency.js` | Suite PERSIST-001 (6 tests) | 0 |
| `node .work/experiments/test-backup-transactional.js` | Suite TRANS-BACKUP (44 tests) | 0 |
| `npm run test:safe` | Ejecución segura de 5 suites completas | 0 |
| `node scratch/build_and_validate_candidate_rc3.js` | Empaquetado y sandbox de validación | 0 |

---

## 6. Resultados por Suite y Plataforma

* **Entorno de Ejecución Local:** Windows 11 Pro / Node.js v22.15.0.
* **Métricas por Suite:**
  - `SEC-001` (Rutas & ADS): **60/60 checks PASSED** (86ms).
  - `PERSIST-001` (Concurrencia & Locks): **6/6 escenarios PASSED** (3264ms).
  - `F13.3.3` (Gobernanza ADR): **10/10 tests PASSED** (1604ms).
  - `SPIKE` (Eventos & Sesiones): **24/24 checks PASSED** (1317ms).
  - `TRANS-BACKUP` (Transaccional & Crash): **44/44 tests PASSED** (306ms).
* **Total Aserciones Verificadas:** **144 aserciones independientes (100% PASS)**.
* **CI Multiplataforma:** Configurado en `.github/workflows/ci.yml` con matriz para Windows, Ubuntu y macOS (Node.js 18, 20, 22).

---

## 7. Resultados de Compilación, Empaquetado y Checksums

* **TypeScript:** Cero errores (`tsc` completado limpiamente).
* **Artefacto:** `openmemory-0.3.14-rc3.tgz`.
* **Tamaño:** `166,375 bytes` (166.4 kB).
* **Checksum SHA-256:** `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6`.
* **Archivos Empaquetados:** 69 archivos (15 archivos core verificados, 0 archivos de fuentes/tests filtrados).
* **Validación en Sandbox Aislado:**
  - `npm install` contra el tarball: 0 vulnerabilidades.
  - Carga de exports públicos: OK.
  - Detección de traversal, DOS y ADS: OK.
  - Persistencia de estado: OK.
  - Exclusión mutua `withStateLock`: OK.
  - Inicialización del servidor MCP (29 herramientas): OK.
  - Restauración transaccional y crash recovery: OK.

---

## 8. Riesgos Residuales y Limitaciones

1. **Fallo Físico de Disco Durante Rollback:** Si el medio de almacenamiento se vuelve de solo lectura o falla físicamente a nivel de hardware, el rollback compensatorio no puede escribir en el disco. En este escenario, OpenMemory activa la salvaguarda de P0.4: marca `FAILED_ROLLBACK` y **preserva intacto el snapshot de recuperación** en lugar de destruirlo, permitiendo extraer la información de forma externa.
2. **Reciclado Rápido de PIDs:** Si el sistema operativo recicla un PID inmediatamente tras la muerte de un proceso y asigna el mismo ID a un proceso no relacionado, el lock esperará pasivamente al TTL de 5.000 ms antes de liberarse.

---

## 9. Estado Final de Git

* **Rama:** `fix/p0-security-concurrency-hardening`.
* **Commits Creados:** Cero (respetando la restricción de gobernanza).
* **Árbol de Trabajo:** Modificaciones consolidadas listas para revisión humana.
* **Archivos No Relacionados:** Preservados sin alteración.

---

## 10. Registro de Artefactos Generados

| Versión | Ubicación | Tamaño | SHA-256 |
| :--- | :--- | :--- | :--- |
| `0.3.14-rc1` | `.work/artifacts/openmemory-0.3.14-rc1.tgz` | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` |
| `0.3.14-rc2` | `.work/artifacts/openmemory-0.3.14-rc2.tgz` | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` |
| **`0.3.14-rc3`** | **`.work/artifacts/openmemory-0.3.14-rc3.tgz`** | **166,375 B** | **`9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6`** |

---

## 11. Decisión Técnica Recomendada

El candidato **`openmemory@0.3.14-rc3`** es el artefacto técnicamente más sólido y riguroso generado hasta la fecha. Resuelve las vulnerabilidades críticas de pérdida de datos ante caídas imprevistas, bloquea ataques de Alternate Data Streams en Windows, garantiza la completitud de snapshots antes de su aplicación y provee exclusión mutua total en la capa de persistencia.

**Recomendación:** **APROBAR para consideración de promoción formal** cuando el usuario decida autorizar la ventana de mantenimiento en InventoryHub.

---

## 12. Próximo Bloque de Trabajo Prioritario

1. **Prioridad 1:** Recepción de autorización explícita para la ejecución controlada de los Gates 0 a 4 del runbook `PRODUCTION-PROMOTION-ROLLBACK.md` en `InventoryHub`.
2. **Prioridad 2:** Consolidación de Git en `fix/p0-security-concurrency-hardening` y creación del tag `v0.3.14-rc3`.
3. **Prioridad 3:** Fusión (merge) hacia la rama principal una vez confirmada la promoción en producción.
