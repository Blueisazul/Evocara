# INFORME DE AUDITORÍA REAL DEL ESTADO INICIAL — P0.4

**Proyecto:** Evocara / OpenMemory  
**Iteración:** P0.4 — Consolidación, Auditoría Adversarial, CI Multiplataforma y Release  
**Rama:** `fix/p0-security-concurrency-hardening`  
**Commit base:** `1ef6a7c` (`1ef6a7cb9f3aa87566c3e0eaf576770e2f19b09e`)  
**Repositorio canónico:** `C:\Users\sant1\Downloads\OpenMemory`  
**Consumidor protegido:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub` (`openmemory@0.3.1` — Estrictamente inalterado)  
**Fecha de auditoría:** 15 de octubre de 2026  
**Auditor:** Antigravity AI — Ingeniero Principal & Arquitecto de Sistemas

---

## 1. Verificación del Estado Real del Repositorio

Antes de realizar cualquier modificación, se ejecutó una verificación empírica completa del estado de trabajo, historial de Git, dependencias y artefactos compilados:

### 1.1 Estado de Git y Ramas
* **Rama Activa:** `fix/p0-security-concurrency-hardening`.
* **Commit HEAD:** `1ef6a7c fix(mcp,cli,storage): add defensive check for optional summary field in knowledge query`.
* **Consistencia de Cambios Preexistentes:**
  - Archivos rastreados modificados: `src/storage.ts`, `src/storage/core/persistence-engine.ts`, `package.json`, `docs/`, `CHANGELOG.md`, `README.md`.
  - Archivos creados en iteraciones P0.2 / P0.3: `src/storage/core/path-security.ts`, `src/storage/domains/backup-manager.ts`, `scripts/safe-test-runner.js`, suites experimentales `.work/experiments/`.
  - **Invariante de Preservación:** Cero commits automáticos creados; todos los cambios permanecen en el árbol de trabajo para revisión explícita.

### 1.2 Verificación Criptográfica de Artefactos Heredados

| Artefacto | Tamaño | Checksum SHA-256 Esperado | Checksum SHA-256 Real | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `openmemory-0.3.14-rc1.tgz` | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` | **COINCIDENCIA EXACTA** |
| `openmemory-0.3.14-rc2.tgz` | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` | **COINCIDENCIA EXACTA** |

Ambos artefactos existen físicamente en `.work/artifacts/` y están protegidos contra eliminación o sobrescritura accidental.

### 1.3 Reproducibilidad de la Línea Base (125 Aserciones)
Se ejecutó la suite completa a través de `npm run test:safe`:
* `SEC-001` (52 checks): **SUPERADA** (109ms).
* `PERSIST-001` (5 escenarios): **SUPERADA** (3296ms).
* `F13.3.3` (10 tests): **SUPERADA** (2136ms).
* `SPIKE` (24 checks): **SUPERADA** (1668ms).
* `TRANS-BACKUP` (34 checks): **SUPERADA** (204ms).
* **Resultado Global:** 125/125 aserciones exitosas (100% PASS) en 7.41s sin polución de archivos residuales.

### 1.4 Estado de InventoryHub
* `InventoryHub/package.json`: apunta a `openmemory-0.3.1.tgz`.
* `InventoryHub/node_modules/openmemory`: versión `0.3.1` instalada.
* Bases de datos SQLite: Cero modificaciones; inalteradas.

---

## 2. Discrepancias y Hallazgos Críticos Auditados en P0.4

A pesar de que las pruebas de P0.3 pasaron satisfactoriamente para los escenarios cubiertos, una auditoría adversarial en profundidad del código fuente descubrió **defectos arquitectónicos latentes** en la recuperación de desastres, la seguridad de rutas y la gestión de locks:

### 2.1 Bloque B: Defectos en el Protocolo de Restauración y Recuperación (`backup-manager.ts`)

| ID | Severidad | Defecto Confirmado | Impacto Técnico |
| :--- | :--- | :--- | :--- |
| **DEF-P0.4-B1** | **Crítica (P0)** | **Destrucción de snapshots de recuperación ante manifiesto corrupto o ausente.** En `recoverInterruptedRestore()`, si `restore-recovery.json` no se puede parsear o no existe, el código ejecuta `fs.rmSync(recoveryDir, { recursive: true })`. | Si un fallo de energía corrompió el archivo de manifiesto durante la restauración, el reinicio de OpenMemory destruye de forma irreversible los archivos de recuperación originales, impidiendo cualquier posibilidad de restaurar el estado vivo a mano o de forma forense. |
| **DEF-P0.4-B2** | **Crítica (P0)** | **Destrucción de snapshots de recuperación cuando el rollback falla por error de E/S.** En `recoverInterruptedRestore()`, la línea de limpieza de `recoveryDir` se ejecuta independientemente de si `rollbackErrors.length > 0`. | Si la reversión falla (ej. disco lleno o permisos momentáneos), se destruye el directorio `.recovery-<opId>`, perdiendo para siempre los archivos necesarios para reintentar la recuperación. |
| **DEF-P0.4-B3** | **Alta (P1)** | **Ausencia de verificación criptográfica de archivos del snapshot de recuperación durante el rollback.** Al revertir archivos desde `.recovery-<opId>`, no se valida el hash contra `fileItem.previousHash`. | Si un archivo en la carpeta de recuperación quedó parcialmente volcado o truncado por un corte de energía, el rollback sobrescribe el estado vivo con datos corruptos sin emitir alarma. |
| **DEF-P0.4-B4** | **Alta (P1)** | **Falta de exclusión mutua (`withStateLock`) en `restoreBackup` y `recoverInterruptedRestore`.** Ni `StorageEngine.restoreBackup` ni `BackupManager` adquieren el lock de transacción durante la restauración o recuperación. | Si dos procesos concurrentes llaman a restaurar o si un agente ejecuta consultas MCP mientras se aplican archivos, se producen carreras graves de E/S, sobrescritura cruzada o estados parcialmente leídos. |
| **DEF-P0.4-B5** | **Alta (P1)** | **Aceptación de backups incompletos por falta de validación de completitud.** Si un archivo declarado en `manifest.json` del backup fue borrado o no existe en disco, `restoreBackup` lo ignora silenciosamente y restaura los demás. | El sistema queda en un estado heterogéneo y roto (franken-state), restaurando un snapshot incompleto como si hubiera sido exitoso. |
| **DEF-P0.4-B6** | **Media (P2)** | **Estado no persistido durante la fase intermedia de recuperación.** `recoverInterruptedRestore` pasa de `APPLYING` a `ROLLED_BACK` solo al final del bucle. Si el proceso cae a mitad del rollback, el estado queda ambiguo. | Falta una fase intermedia durable (`RECOVERING`) que garantice reanudación segura ante caídas repetidas. |

---

### 2.2 Bloque C: Defectos en Seguridad de Rutas y Persistencia

| ID | Severidad | Defecto Confirmado | Impacto Técnico |
| :--- | :--- | :--- | :--- |
| **DEF-P0.4-C1** | **Alta (P1)** | **Omisión de verificación de caracteres reservados NTFS (`:` Alternate Data Streams) en `resolveSecurePath`.** `resolveSecurePath` valida directivas relativas y dispositivos DOS, pero no rechaza caracteres como `:` (ej. `test.txt:stream`). | En sistemas NTFS de Windows, permite interactuar con flujos de datos alternativos no auditados o manipular la resolución de extensiones. |
| **DEF-P0.4-C2** | **Media (P2)** | **Reclamación prematura en `cleanupStaleLocks` para locks con `exp === undefined`.** En `cleanupStaleLocks`, si un lock JSON no posee `expiresAt`, la condición `(exp === undefined || exp <= now || deadProcess)` evalúa a `true`, eliminando el lock incluso si el PID asociado está **vivo**. | Riesgo de robar el bloqueo a un proceso legítimo en ejecución si el lock proviene de una versión anterior o formato mínimo. |

---

## 3. Plan de Implementación P0.4

El plan de trabajo comprende cuatro bloques de ingeniería secuenciales:

1. **Bloque B — Endurecimiento del Motor de Recuperación Transaccional:**
   - Modificar `src/storage/domains/backup-manager.ts` y `src/storage.ts`:
     - Incorporar cuarentena protectora (`.recovery-quarantined-*`) en lugar de borrar directorios ante manifiestos corruptos o ilegibles.
     - Preservar estrictamente el snapshot de recuperación si `rollbackErrors.length > 0`.
     - Validar criptográficamente cada archivo a restaurar en el rollback contra `fileItem.previousHash`.
     - Validar la completitud absoluta de los archivos declarados en `manifest.json` del backup antes de iniciar cualquier operación sobre el estado vivo.
     - Integrar `withStateLock` en `restoreBackup` y `recoverInterruptedRestore` para garantizar exclusión mutua total frente a invocaciones concurrentes o comandos MCP.
     - Registrar la transición de estado durable `RECOVERING`.
2. **Bloque C — Seguridad de Rutas y Persistencia:**
   - En `src/storage/core/path-security.ts`: añadir rechazo explícito de `:` (Alternate Data Streams) y caracteres ilegales NTFS en componentes de ruta.
   - En `src/storage/core/persistence-engine.ts`: corregir `cleanupStaleLocks` para que si `exp === undefined`, el lock solo se considere obsoleto si el archivo tiene al menos `olderThanMs` de antigüedad física y el PID está comprobado como muerto.
3. **Bloque D — CI Multiplataforma:**
   - Crear `.github/workflows/ci.yml` con matriz de ejecución en Windows, Linux y macOS.
   - Configurar `npm ci`, `npm run build`, `safe-test-runner.js`, `npm pack` e inspección de tarball.
4. **Bloque E y F — Harness, Pruebas de Resiliencia y Calificación de Release:**
   - Incorporar pruebas con procesos hijos reales que simulen crashes abruptos (`SIGKILL` / `process.exit(1)`) durante la fase `APPLYING`.
   - Reconstruir y calificar el paquete como `openmemory@0.3.14-rc3` (preservando `rc1` y `rc2`).
   - Validar la instalación del nuevo candidato en sandbox aislado.
