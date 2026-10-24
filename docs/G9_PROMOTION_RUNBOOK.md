# G9 Transactional Promotion & Disaster Recovery Runbook

**Document ID:** OM-G9-PROMOTION-RUNBOOK  
**Milestone:** G9 Transactional Promotion & Recovery  
**Target Candidate:** `openmemory@0.3.15-rc1`  
**Engine:** `scripts/transactional-promotion-engine.js` (P1.5/G9 Hardened)  
**Author:** Antigravity Principal Systems Engineer & Security Architect  
**Status:** IMPLEMENTED AND VERIFIED  
**Date:** 2026-10-18  

---

## 1. Arquitectura y Máquina de Estados de Promoción

La promoción de OpenMemory hacia cualquier consumidor (ej. `InventoryHub`) opera bajo una máquina de estados estricta, fail-safe y atómica:

```
  +--------------------+
  |   UNINITIALIZED    |
  +--------------------+
            |
            v
  +--------------------+
  |   LOCK_ACQUIRED    | ----> (Error: Concurrencia / Exclusión Mutua)
  +--------------------+
            |
            v
  +--------------------+
  | PREFLIGHT_VERIFIED | ----> (Error: Quiescencia / Hash Mismatch / Permisos)
  +--------------------+
            |
            v
  +--------------------+
  |     BACKED_UP      | ----> (Error I/O / Inconsistencia de Backup)
  +--------------------+
            |
            v
  +--------------------+
  |      APPLYING      | ----> (Fallo de Instalación / Paquete Dañado)
  +--------------------+
            |
            v
  +--------------------+
  |   SMOKE_TESTING    | ----> (Fallo de Smoke Test / Mutación No Autorizada)
  +--------------------+
            |
            v
  +--------------------+
  |   POST_VERIFYING   | ----> (Fallo en Paridad Contable / Regresión npm audit)
  +--------------------+
            |
            v
  +--------------------+
  |     COMMITTED      | (Éxito definitivo, lock liberado)
  +--------------------+

  ======================= FLUJO DE ROLLBACK ATÓMICO =======================
  Cualquier fallo en las fases activas transiciona a:
    -> ROLLING_BACK
         |
         +--> ROLLED_BACK     (Restauración al 100% con paridad bilateral)
         |
         +--> FAILED_ROLLBACK (Doble fallo: cuarentena forense segura en backups/.quarantine-*)
```

---

## 2. Invariantes Críticos de Seguridad Pre-Flight

Antes de realizar la menor modificación en el directorio del consumidor, el motor ejecuta 9 comprobaciones obligatorias:

1. **Identidad del Consumidor:** El directorio destino debe existir, contener un `package.json` válido y no ser el repositorio fuente de OpenMemory (prevención de auto-promoción).
2. **Permisos de Escritura:** Se verifica la capacidad de escritura en el directorio raíz del consumidor y en `backups/`.
3. **Integridad Criptográfica del Candidato:** Se valida el tamaño físico exacto en bytes y el hash SHA-256 del tarball local (`.work/artifacts/openmemory-0.3.15-rc1.tgz`).
4. **Quiescencia SQLite:**
   - Si existe `.db-wal` con tamaño > 0 bytes: **ABORTA INMEDIATAMENTE**.
   - Si existe `.db-shm`: se comprueba la contención real mediante la API nativa de SQLite (`DatabaseSync.prepare("PRAGMA wal_checkpoint(PASSIVE)")`). Si existen locks activos de lectores/escritores, **ABORTA**.
5. **Exclusión Mutua de Promoción:** Se comprueba el lock `.promotion.lock`. Si otra promoción está en curso, se aborta sin corrupción de concurrencia.
6. **Defensa contra Symlinks y Path Traversal:** Se verifica `isContainedWithin` en todos los archivos de estado; se rechaza cualquier enlace simbólico dentro de `.openmemory/`.

---

## 3. Procedimientos Operativos de Promoción

> [!IMPORTANT]
> **REGLA DE ORO DE GOBERNANZA:**  
> Jamás ejecutes una promoción sobre un consumidor real de producción sin autorización humana previa expresa. Toda prueba destructiva o de estrés debe ejecutarse exclusivamente en sandboxes temporales (`os.tmpdir()`).

### 3.1 Paso 1: Verificación en Modo Dry-Run (Sin mutaciones)
Ejecuta la promoción en modo de ensayo seguro:
```bash
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --tarball "C:\Users\sant1\Downloads\OpenMemory\.work\artifacts\openmemory-0.3.15-rc1.tgz" \
  --expected-sha256 "8b3df7e15222cfcce93d33044efc817e2c10564aa996af389a9603b66595d716" \
  --expected-size 184295 \
  --expected-version "0.3.15-rc1" \
  --original-version "0.3.14-rc4" \
  --dry-run
```

### 3.2 Paso 2: Promoción Real con Verificación Integral
Cuando el operador humano autorice la promoción:
```bash
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --tarball "C:\Users\sant1\Downloads\OpenMemory\.work\artifacts\openmemory-0.3.15-rc1.tgz" \
  --expected-sha256 "8b3df7e15222cfcce93d33044efc817e2c10564aa996af389a9603b66595d716" \
  --expected-size 184295 \
  --expected-version "0.3.15-rc1" \
  --original-version "0.3.14-rc4" \
  --consumer-test "node test_inventory_manager.js && node test_phase_2c2_full.js && node test_phase_2c4_post_cleanup.mjs"
```

---

## 4. Procedimientos de Recuperación y Gestión de Fallos

### 4.1 Recuperación de Operación Interrumpida (Crash Recovery)
Si el proceso de Node.js se apaga abruptamente (ej. corte de energía, `kill -9`) en mitad de una fase:
1. El motor detecta el estado inconsistente en `operation_manifest.json`.
2. Para restaurar el consumidor a su estado previo sin pérdida de datos, ejecuta:
```bash
node scripts/transactional-promotion-engine.js \
  --consumer "<ruta-del-consumidor>" \
  --recover
```
El motor:
- Adquiere o reclama el lock obsoleto.
- Lee el catálogo del backup previo en `backups/backup_<operationId>`.
- Restaura `.openmemory/` mediante swap atómico protegido.
- Reinstala el paquete original anterior.
- Registra `ROLLED_BACK` y libera el lock.

### 4.2 Política de Retención y Poda de Backups
Para evitar el crecimiento indefinido del disco en el consumidor, el motor incorpora la poda segura:
- Se conservan siempre los últimos `N` backups válidos (defecto: 5).
- Los backups asociados a operaciones interrumpidas o al snapshot más reciente **nunca se eliminan**.

---

## 5. Ejemplo Reproducible en Sandbox Aislado

Para validar el flujo completo sin tocar ningún consumidor de producción:
```bash
node scripts/safe-test-runner.js G9-PROMOTION
```
La suite ejecuta 8 escenarios adversariales (incluyendo contención de locks, inyección de fallos en instalación y recuperación tras reinicio) en sandboxes efímeros con limpieza garantizada.
