# INFORME DE EJECUCIÓN TÉCNICA — ITERACIÓN P0.5

**Proyecto:** Evocara / OpenMemory  
**Iteración:** P0.5 — Cierre de Release, Auditoría Independiente y Preparación de Promoción Controlada  
**Fecha de Ejecución:** 17 de octubre de 2026  
**Rama Canónica:** `fix/p0-security-concurrency-hardening`  
**Commit Base:** `1ef6a7c`  
**Candidato Generado y Calificado:** `openmemory@0.3.14-rc4`  
**Artefacto Distribuible:** `.work/artifacts/openmemory-0.3.14-rc4.tgz` (SHA-256: `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`)  
**Consumidor Protegido:** `InventoryHub` (`openmemory@0.3.1` — 100% INTACTO)

---

## 1. Resumen Ejecutivo de Ejecución

Durante la iteración P0.5 se ejecutó un ciclo completo de auditoría independiente, endurecimiento de código, expansión de pruebas adversariales, empaquetado determinista, validación en sandbox sintético y actualización de la documentación de release.

Se corrigieron 5 defectos arquitectónicos y de formato identificados en la auditoría independiente, se expandieron las pruebas a **157 comprobaciones automatizadas (100% exitosas)** y se generó el nuevo candidato reproducible **`openmemory@0.3.14-rc4.tgz`**, preservando sin alteración los candidatos históricos `rc1`, `rc2` y `rc3`.

---

## 2. Modificaciones Implementadas en el Código Fuente

### 2.1 Módulo `src/storage/domains/backup-manager.ts`
* **Reintento Idempotente de `FAILED_ROLLBACK`:**  
  Se modificó la condición de recuperación en arranque (`doRecoverInterruptedRestore`) para incluir `phase === 'FAILED_ROLLBACK'`. Ante un intento previo fallido, el sistema vuelve a intentar restaurar los archivos originales sobre el estado vivo.
* **Cuarentena No Destructiva para Fases Ambiguas:**  
  En el bloque de descarte de directorios de recuperación, se restringió el borrado exclusivamente a las fases `PREPARED`, `COMPLETED` y `ROLLED_BACK`. Cualquier fase no reconocida es aislada en `.quarantined-recovery-<opId>-<timestamp>`.
* **Exigencia Estricta de `manifest.json`:**  
  En `doRestoreBackup`, se añadió la verificación obligatoria de presencia de `manifest.json`. Si un snapshot carece de manifiesto criptográfico, la operación aborta de inmediato antes de iniciar el staging o alterar archivos vivos.
* **Exclusión Mutua en `createBackup`:**  
  Se encapsuló la lectura y volcado de snapshots dentro de `withStateLock(..., 'backup-create')`.

### 2.2 Módulo `src/storage/core/persistence-engine.ts`
* **Reclamación Segura de Locks Sin Expiración Huérfanos:**  
  En `tryAcquireLockDetailed`, se añadió una comprobación de inactividad física (`now - stat.mtimeMs >= ttlMs`) cuando tanto `exp` como `pid` son indefinidos, evitando deadlocks permanentes por cerrojos huérfanos legacy.

### 2.3 Módulo `src/storage.ts`
* **Envoltorio de Cerrojo para `createBackup`:**  
  Se delegó la invocación de `createBackup` dentro de `withStateLock(..., 'backup-create')`, garantizando que la fachada de alto nivel mantenga la invariante Single-Writer durante la creación de copias de seguridad.

### 2.4 Metadatos y Dependencias (`package.json` y `package-lock.json`)
* **Versión del Paquete:** Actualizada a `0.3.14-rc4`.
* **Depuración de BOM:** Se eliminó el byte order mark UTF-8 (`\uFEFF`) de `package-lock.json`.

---

## 3. Matriz de Pruebas y Resultados de Validación

Todas las pruebas se ejecutaron mediante el arnés aislado `npm run test:safe`, garantizando cero contaminación del árbol de trabajo (`working tree`).

| Suite ID | Nombre de la Suite | Tipo | Pruebas / Comprobaciones | Duración | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | Path Traversal, DOS Devices & ADS Hardening | Seguridad | 54 / 54 | 1,223 ms | **100% PASS** |
| **PERSIST-001** | Multi-Process Concurrency & Lock Stress | Concurrencia | 7 / 7 escenarios | 1,515 ms | **100% PASS** |
| **F13.3.3** | ADR Governance Domain Unit & Facade Tests | Dominio | 22 / 22 | 1,273 ms | **100% PASS** |
| **SPIKE** | OpenMemory Plugin Spike Empirical Suite | Integración | 18 / 18 | 1,248 ms | **100% PASS** |
| **TRANS-BACKUP**| Transactional Backup, Crash Recovery & Quarantine | Resiliencia | 56 / 56 | 1,489 ms | **100% PASS** |
| **TOTAL** | **Safe Test Harness Consolidado** | **Global** | **157 / 157** | **6,839 ms** | **100% PASS** |

### Nuevos Escenarios Adversariales Validados en P0.5:
* **TRANS-BACKUP Test 10:** Reintento exitoso en boot tras una reversión previa marcada como `FAILED_ROLLBACK`.
* **TRANS-BACKUP Test 11:** Preservación forzosa intacta de la evidencia de `FAILED_ROLLBACK` cuando el reintento vuelve a fallar por error de E/S.
* **TRANS-BACKUP Test 12:** Idempotencia ante una segunda interrupción producida durante la fase `RECOVERING`.
* **TRANS-BACKUP Test 13:** Rechazo estricto de snapshots que carecen de `manifest.json` sin mutación del estado vivo.
* **TRANS-BACKUP Test 14:** Re-entrancia cooperativa del cerrojo de estado durante operaciones transaccionales anidadas.
* **PERSIST-001 Test 7:** Reclamación limpia de cerrojos huérfanos sin PID y sin expiración tras expirar el TTL físico.

---

## 4. Empaquetado y Calificación en Sandbox Aislado

Se generó el paquete distribuible mediante `npm pack` en un entorno aislado temporal y se transfirió a la ubicación persistente:
* **Artefacto:** `.work/artifacts/openmemory-0.3.14-rc4.tgz`
* **Tamaño:** 167,133 bytes (163.2 kB)
* **Checksum SHA-256:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`
* **Total de Archivos Empaquetados:** 69 archivos (15/15 archivos core requeridos presentes).
* **Filtro de Fugas:** 0 archivos fuente (`src/`), scripts de prueba (`test-*`) ni artefactos temporales (`.work/`) en el paquete.

### Validación en Sandbox Sintético de Consumidor
Se creó un directorio temporal (`om-consumer-sandbox-rc4-*`), se instaló el tarball generado (`npm install openmemory-0.3.14-rc4.tgz`) y se ejecutó una batería de 7 pruebas de verificación contra el paquete instalado:
1. **Carga de Exports Públicos:** `StorageEngine`, `createMCPServer`, `PersistenceEngine`, `validateSubpath`. (SUPERADA)
2. **Defensas de Seguridad SEC-001:** Validación de rechazo de path traversal, dispositivos DOS y flujos ADS sobre el paquete empaquetado. (SUPERADA)
3. **Operaciones Legítimas de Almacenamiento:** Inicialización, lectura, escritura y preservación de estado. (SUPERADA)
4. **Exclusión Mutua `withStateLock`:** Cerrojo de estado operativo en el paquete empaquetado. (SUPERADA)
5. **Servidor MCP:** Inicialización y disponibilidad de las 29 herramientas públicas. (SUPERADA)
6. **Restauración Transaccional y Recuperación Post-Crash:** Verificación de flujo completo en el paquete instalado. (SUPERADA)
7. **Reintento de `FAILED_ROLLBACK`:** Verificación de la nueva salvaguarda P0.5 en el paquete empaquetado. (SUPERADA)

---

## 5. Cadena de Custodia de Candidatos a Release

Todos los artefactos previos han sido verificados y preservados en sus ubicaciones originales:

| Candidato | Archivo | Tamaño | SHA-256 |
| :--- | :--- | :--- | :--- |
| **RC1** | `.work/artifacts/openmemory-0.3.14-rc1.tgz` | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` |
| **RC2** | `.work/artifacts/openmemory-0.3.14-rc2.tgz` | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` |
| **RC3** | `.work/artifacts/openmemory-0.3.14-rc3.tgz` | 166,375 B | `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6` |
| **RC4** | `.work/artifacts/openmemory-0.3.14-rc4.tgz` | 167,133 B | `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` |

---

## 6. Verificación de Gobernanza e Invariantes

1. **InventoryHub Intacto:**  
   - `node_modules/openmemory` permanece en `openmemory@0.3.1`.
   - Cero bases de datos SQLite han sido abiertas, modificadas o bloqueadas.
2. **Git y Repositorio:**  
   - Rama activa: `fix/p0-security-concurrency-hardening`.
   - Commit HEAD base: `1ef6a7c`.
   - Cero commits creados, cero tags, cero operaciones de push, cero fusiones (`merges`).
3. **Publicación:**  
   - Cero publicaciones a npm o registros externos.
