# INFORME DE AUDITORÍA TÉCNICA INDEPENDIENTE — ITERACIÓN P0.5

**Proyecto:** Evocara / OpenMemory  
**Iteración:** P0.5 — Cierre de Release, Auditoría Independiente y Preparación de Promoción Controlada  
**Fecha de Auditoría:** 17 de octubre de 2026  
**Rama Auditada:** `fix/p0-security-concurrency-hardening`  
**Commit Base HEAD:** `1ef6a7c` (`1ef6a7cb9f3aa87566c3e0eaf576770e2f19b09e`)  
**Repositorio Canónico:** `C:\Users\sant1\Downloads\OpenMemory`  
**Consumidor Protegido:** `InventoryHub` (`openmemory@0.3.1` — Verificado intacto)  
**Auditor Responsable:** Antigravity AI — Modo Agente Autónomo

---

## 1. Alcance y Metodología de la Auditoría Independiente

En cumplimiento del mandato P0.5, no se aceptaron los informes de iteraciones previas (P0.2, P0.3, P0.4) como prueba suficiente por sí mismos. Se procedió a contrastar empíricamente cada afirmación técnica, diseño y garantía contra el código fuente activo, los tests automatizados, los artefactos generados y el entorno del sistema de archivos.

### Módulos y Documentos Auditados
1. `src/storage/domains/backup-manager.ts`: Restauración transaccional, staging, reconciliación en arranque y máquina de estados.
2. `src/storage/core/path-security.ts`: Validación de confinamiento de rutas, caracteres reservados y dispositivos especiales.
3. `src/storage/core/persistence-engine.ts`: Exclusión mutua (`withStateLock`), detección de procesos vivos y escrituras atómicas duraderas.
4. `src/storage.ts`: Fachada unificada de almacenamiento y delegación de operaciones de estado.
5. `package.json` y `package-lock.json`: Metadatos, dependencias, scripts de build y codificación de archivos.
6. `.github/workflows/ci.yml`: Matriz de integración continua, pasos de compilación, tests y empaquetado.
7. `scripts/safe-test-runner.js` y `.work/experiments/`: Aislamiento de suites, cobertura adversarial y prevención de residuos.
8. Artefactos en `.work/artifacts/`: Integridad criptográfica, métricas y contenido de los tarballs `rc1`, `rc2` y `rc3`.

---

## 2. Auditoría Detallada de los 10 Puntos Críticos del Mandato

### Verificación 1: Idempotencia de Recuperación Post-Crash durante `RECOVERING`
* **Inspección en Código (`BackupManager.doRecoverInterruptedRestore`):**  
  Al escanear directorios `.recovery-<opId>`, si el manifiesto registra `phase === 'RECOVERING'`, el proceso vuelve a ingresar al flujo de reversión compensatoria. Previo a escribir en el estado vivo, el archivo `restore-recovery.json` se preserva en disco con `phase: 'RECOVERING'`.
* **Prueba Adversarial (Suite `TRANS-BACKUP`, Test 12):**  
  Se simuló una interrupción mediante inyección de fallo durante `RECOVERING`. El subsiguiente arranque detectó la operación interrumpida y completó la restauración de los archivos originales sin pérdida de datos.
* **Dictamen:** **CONFORME.** La recuperación es estrictamente idempotente ante caídas sucesivas.

### Verificación 2: Inmunidad frente a Snapshots Corruptos, Incompletos o Manipulados
* **Inspección en Código (`BackupManager.doRestoreBackup`):**  
  La Etapa 0 (Pre-Flight) se ejecuta antes de crear carpetas de staging o mutar el estado vivo. Exige la presencia obligatoria de `manifest.json`, verifica la existencia física del 100% de los archivos listados y calcula su SHA-256 en memoria comparándolo con el declarado en el manifiesto.
* **Prueba Adversarial (Suite `TRANS-BACKUP`, Tests 2, 4, 13):**  
  - Snapshots con archivos eliminados de disco son rechazados (`Restore aborted: file ... declared in manifest does not exist`).
  - Snapshots con contenido alterado (hash mismatch) son rechazados (`Cryptographic mismatch in backup file`).
  - Snapshots sin `manifest.json` son rechazados inmediatamente (`Restore failed: Backup is missing cryptographic manifest.json`).
  En todos los casos, el estado vivo permanece 100% inalterado.
* **Dictamen:** **CONFORME.**

### Verificación 3: Tratamiento Seguro de `FAILED_ROLLBACK` y Preservación de Evidencias
* **Hallazgo P0.5 Inicial (DEFECTO IDENTIFICADO):**  
  En la implementación original de P0.4, si un rollback compensatorio fallaba por saturación de disco o denegación de permisos, la fase se marcaba como `FAILED_ROLLBACK`. Sin embargo, en el siguiente arranque, la condición `if (phase === 'APPLYING' || phase === 'RECOVERING')` evaluaba a falso y saltaba al bloque `else`, ejecutando `fs.rmSync(recoveryDir, { recursive: true, force: true })`. Esto destruía los únicos archivos de respaldo existentes.
* **Corrección Implementada en P0.5:**  
  1. Se incluyó `phase === 'FAILED_ROLLBACK'` en la condición de reconciliación de arranque para reintentar la compensación.
  2. En el bloque `else`, se restringió el borrado exclusivamente a fases explícitamente limpiables (`PREPARED`, `COMPLETED`, `ROLLED_BACK`). Toda fase desconocida o ambigua se traslada a cuarentena no destructiva (`.quarantined-recovery-*`).
  3. Si el reintento de rollback vuelve a fallar, el error es capturado, la fase `FAILED_ROLLBACK` se preserva en disco y la carpeta jamás es eliminada.
* **Dictamen:** **SUBSANADO Y VERIFICADO.** (Probado empíricamente en Suite `TRANS-BACKUP`, Tests 10 y 11).

### Verificación 4: Exclusión Mutua Compartida entre Restauración y Recuperación
* **Inspección en Código (`src/storage.ts` y `PersistenceEngine`):**  
  - `StorageEngine.restoreBackup` se ejecuta envuelto en `this.persistenceEngine.withStateLock(..., 'backup-restore')`.
  - `StorageEngine.recoverInterruptedRestore` se ejecuta envuelto en `this.persistenceEngine.withStateLock(..., 'backup-crash-recovery')`.
  - En P0.5 se identificó que `createBackup` realizaba lecturas sin exclusión de estado; se envolvió en `this.persistenceEngine.withStateLock(..., 'backup-create')`.
  - El motor de cerrojos implementa re-entrancia cooperativa (`activeLockHolder`), evitando interbloqueos (deadlocks) cuando un método con cerrojo invoca internamente a otro.
* **Dictamen:** **CONFORME.**

### Verificación 5: Cobertura de Cerrojos y Límites de Exclusión Multiproceso
* **Inspección en Código (`PersistenceEngine.tryAcquireLockDetailed`):**  
  El cerrojo utiliza el archivo atómico `.openmemory.lock` creado con bandera `wx` en el sistema de archivos. Incorpora el PID del proceso titular y una marca de expiración.
* **Límite Real Declarado:**  
  El cerrojo garantiza exclusión mutua estricta entre procesos cooperativos (procesos que utilizan OpenMemory). **No constituye una barrera física universal** contra procesos externos al entorno que manipulen archivos directamente mediante herramientas del sistema operativo.
* **Dictamen:** **CONFORME.**

### Verificación 6: Validación de Rutas y Caracteres Específicos por Plataforma
* **Inspección en Código (`src/storage/core/path-security.ts`):**  
  La función `validateSubpath` implementa:
  - Detección de bytes nulos (`\0`).
  - Normalización canónica vía `path.resolve` y validación de prefijo de directorio raíz (`targetPath.startsWith(canonicalRoot + path.sep)`).
  - Detección de dispositivos reservados DOS/Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
  - Detección de flujos alternos de datos NTFS (`Alternate Data Streams`, delimitados por `:`).
  - Rutas absolutas ajenas y traversals codificados (`%2e%2e`, `..`).
* **Dictamen:** **CONFORME.** (54 comprobaciones unitarias en Suite `SEC-001`).

### Verificación 7: Limpieza de Locks Huérfanos y Manejo de Procesos Vivos
* **Inspección en Código (`PersistenceEngine.isProcessDead`):**  
  La comprobación de vida utiliza `process.kill(pid, 0)`. Distingue explícitamente entre `ESRCH` (proceso muerto) y `EPERM` (proceso vivo sin permisos de señalización).
* **Hallazgo P0.5 Inicial (DEFECTO IDENTIFICADO):**  
  Si un cerrojo en disco carecía de `expiresAt` y simultáneamente carecía de `pid` (un cerrojo huérfano legacy o corrupto), `tryAcquireLockDetailed` no lo reclamaba nunca, produciendo un bloqueo permanente indefinido.
* **Corrección Implementada en P0.5:**  
  Se añadió una comprobación de inactividad física (`now - stat.mtimeMs >= ttlMs`) para cerrojos huérfanos sin PID ni expiración, reclamándolos de forma segura tras superar el TTL.
* **Dictamen:** **SUBSANADO Y VERIFICADO.** (Probado en Suite `PERSIST-001`, Test 7).

### Verificación 8: Garantías Reales de Durabilidad
* **Inspección en Código (`PersistenceEngine.atomicWriteFileSync`):**  
  El flujo de escritura realiza:
  1. Escritura en archivo temporal único (`.tmp-<hex>`).
  2. Sincronización a disco con `fs.fsyncSync(fd)`.
  3. Cierre del descriptor.
  4. Renombrado atómico con `fs.renameSync`.
  5. Sincronización del directorio contenedor con `fsyncSync` en plataformas compatibles.
* **Límite Real Declarado:**  
  Esta técnica garantiza consistencia ante fallos del proceso y cortes eléctricos a nivel del sistema de archivos local (NTFS/POSIX). **No protege contra fallos físicos del soporte magnético/flash (bad sectors, degradación de disco)**, los cuales requieren redundancia de hardware externa.
* **Dictamen:** **CONFORME.**

### Verificación 9: Confinamiento de Manifiestos y Prevención de Arbitrary File Write
* **Inspección en Código (`BackupManager.doRestoreBackup`):**  
  Al procesar `manifest.files`, cada ruta relativa es pasada por `validateSubpath(this.storageDir, relPath)`. Si un manifiesto contiene referencias como `../../etc/passwd` o rutas absolutas `C:\Windows`, la restauración aborta antes de staging.
* **Dictamen:** **CONFORME.**

### Verificación 10: Política Anti-Pérdida en Arranque ante Estados Ambiguos
* **Inspección en Código (`BackupManager.doRecoverInterruptedRestore`):**  
  - Si un directorio `.recovery-*` carece de `restore-recovery.json` o está truncado, pero contiene archivos de snapshot, se renombra a `.quarantined-recovery-<opId>-<timestamp>`.
  - En P0.5, si el manifiesto existe pero contiene una fase desconocida o no estándar, se traslada igualmente a cuarentena.
  - El sistema **nunca elimina datos de usuario ante incertidumbre**.
* **Dictamen:** **CONFORME.** (Probado en Suite `TRANS-BACKUP`, Tests 8 y 11).

---

## 3. Auditoría de Dependencias y Formato de Archivos

* **Auditoría de `package-lock.json`:**  
  Se detectó y eliminó un prefijo UTF-8 Byte Order Mark (`0xEF 0xBB 0xBF`) que provocaba fallos de sintaxis en analizadores estrictos de JSON. Tras la eliminación, el archivo fue validado con `JSON.parse`.
* **Auditoría de Vulnerabilidades (`npm audit`):**  
  La instalación limpia en sandbox aislado arrojó **0 vulnerabilidades**.

---

## 4. Conclusión de la Auditoría

El código fuente de OpenMemory en la rama `fix/p0-security-concurrency-hardening` ha sido saneado de los defectos latentes identificados. La arquitectura modular, las salvaguardas transaccionales y la máquina de estados de recuperación se encuentran completamente respaldadas por pruebas adversariales reproducibles.
