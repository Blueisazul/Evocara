# RUNBOOK TRANSACCIONAL DE PROMOCIÓN Y ROLLBACK (HITO G29)
## Procedimiento Blindado para la Promoción de InventoryHub a Evocara v0.4.0 GA

- **Fecha de Emisión:** 22 de octubre de 2026
- **Milestone:** G29 — Preparación de Promoción y Continuidad Operativa
- **Rol:** Release Manager & Auditor de Seguridad
- **Consumidor Destino:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Activa Actual:** `0.3.14-rc4` (Sin modificaciones)
- **Versión Autorizada para Promover:** `0.4.0` (Evocara GA)
- **Tarball Autorizado:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory\.work\artifacts\evocara-0.4.0.tgz`
- **Hash SHA-256 Autorizado:** `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
- **Tamaño Exacto del Tarball:** `209,910 bytes`
- **Herramienta Oficial de Promoción:** `scripts/transactional-promotion-engine.js`

> [!CAUTION]
> **ESTADO DE AUTORIZACIÓN: PENDIENTE DE CONFIRMACIÓN HUMANA EXPLÍCITA**
> La calificación técnica en staging demostró 100 % de paridad funcional y paridad de rollback.
> **ESTE COMANDO NO DEBE EJECUTARSE** hasta que el operador humano emita una autorización específica para la mutación en disco de `InventoryHub`. El presente runbook establece el protocolo exacto y verificable para cuando dicha autorización sea concedida.

---

## 1. Estado Inicial Esperado y Línea Base

Antes de intervenir el directorio de `InventoryHub`, deben cumplirse estrictamente los siguientes estados:
1. **Línea de Código en Consumidor:**
   - `InventoryHub/package.json` declara: `"openmemory": "file:../../../../../Downloads/OpenMemory/.work/artifacts/openmemory-0.3.14-rc4.tgz"`.
   - `InventoryHub/node_modules/openmemory/package.json` declara versión `"0.3.14-rc4"`.
2. **Salud de Negocio Previa (Read-Only Baseline):**
   - Ejecutar la batería de 34 pruebas sin mutar datos:
     ```bash
     cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
     node test_inventory_manager.js
     node test_phase_2c2_full.js
     node test_phase_2c4_post_cleanup.mjs
     ```
   - *Criterio de Aceptación:* Exactamente **34 / 34 pruebas aprobadas**.
3. **Quiescencia y Seguridad en Disco:**
   - 0 archivos `.promotion.lock` en `InventoryHub`.
   - 0 archivos temporales activos de SQLite (`.db-wal` > 0 bytes o `.db-shm` bloqueados).
   - Ausencia de procesos externos (editores, IDEs, terminales secundarias) reteniendo descriptores de archivo en `InventoryHub`.

---

## 2. Precondiciones de Ejecución y Condiciones de Aborto Inmediato

El motor `TransactionalPromotionEngine` evalúa automáticamente estas condiciones en su fase `PREFLIGHT`. La ejecución se aborta **fail-closed** inmediatamente si:

| ID Condición | Condición de Aborto | Acción del Motor |
|---|---|---|
| **ABORT-01** | Hash SHA-256 de `evocara-0.4.0.tgz` no coincide exactamente con `70f31da...` | Detención inmediata, 0 escrituras |
| **ABORT-02** | Tamaño del tarball difiere de 209,910 bytes | Detención inmediata, 0 escrituras |
| **ABORT-03** | Falla cualquiera de las 34 pruebas de negocio en la verificación previa | Aborto fail-closed |
| **ABORT-04** | Detección de contienda concurrente (lock existente perteneciente a proceso vivo) | Aborto fail-closed |
| **ABORT-05** | Detección de enlaces simbólicos (symlinks/junctions) que apunten fuera de `InventoryHub` | Aborto de seguridad |
| **ABORT-06** | Falta de permisos de escritura o espacio en disco en `InventoryHub` | Aborto fail-closed |

---

## 3. Respaldo Requerido (Backup Atómico Transaccional)

Antes de cualquier mutación de paquetes, el motor realiza automáticamente la Fase 2 (`BACKED_UP`):
- Ubicación del respaldo: `InventoryHub/backups/backup_<OPERATION_ID>/`.
- Componentes respaldados y catalogados criptográficamente:
  1. `package.json` original copiado a `package.json.bak` con hash SHA-256.
  2. `package-lock.json` original copiado a `package-lock.json.bak` (si existe).
  3. Directorio `.openmemory/` completo clonado recursivamente con inventario de hashes de cada archivo.
  4. Tarball original catalogado (`openmemory-0.3.14-rc4.tgz`).
  5. Registro de quiescencia de bases de datos SQLite existentes.
  6. Manifiesto atómico persistido en `InventoryHub/operation_manifest.json`.

---

## 4. Comando de Promoción para Ejecución Posterior (Post-Autorización)

Una vez obtenida la autorización explícita del usuario, el comando unificado que debe ejecutarse es:

```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory"
node -e "
const { TransactionalPromotionEngine } = require('./scripts/transactional-promotion-engine.js');
const engine = new TransactionalPromotionEngine({
  consumerPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\InventoryHub',
  tarballPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\OpenMemory\\\\.work\\\\artifacts\\\\evocara-0.4.0.tgz',
  expectedSha256: '70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a',
  expectedSize: 209910,
  originalVersion: '0.3.14-rc4',
  expectedVersion: '0.4.0',
  dryRun: false
});
const res = engine.runPromotion();
console.log('Promotion Result:', JSON.stringify(res, null, 2));
process.exit(res.success ? 0 : 1);
"
```

---

## 5. Comprobaciones Posteriores a la Promoción

Tras la finalización del comando (`state: "COMMITTED"`):

### Verificación 1: Versión de Paquete Instalado
```bash
node -e "console.log(require('C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub/node_modules/evocara/package.json').version)"
```
*Salida requerida:* `0.4.0`.

### Verificación 2: Batería de Pruebas de Negocio en Consumidor Promovido
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```
*Criterio de Aceptación:* Exactamente **34 / 34 pruebas aprobadas**.

### Verificación 3: Smoke Test de MCP y Doble Nomenclatura
```bash
node -e "
const evocara = require('C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub/node_modules/evocara');
const server = evocara.createEvocaraMCPServer();
const hasTools = typeof server._requestHandlers.get('tools/list') === 'function';
console.log('Evocara MCP Server Operational:', hasTools);
process.exit(hasTools ? 0 : 1);
"
```
*Salida requerida:* `Evocara MCP Server Operational: true`.

---

## 6. Procedimiento de Rollback de Emergencia

Si se detecta cualquier anomalía tras la promoción o si el smoke test falla:

### Procedimiento A: Rollback Automático
Si la falla ocurre durante la ejecución de `runPromotion()`, el motor revierte automáticamente todas las operaciones, reinstala el paquete original y deja `InventoryHub` en estado `ROLLED_BACK`.

### Procedimiento B: Recuperación Manual Asistida
Si la operación fue interrumpida externamente (corte de energía, terminación forzada):
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory"
node -e "
const { TransactionalPromotionEngine } = require('./scripts/transactional-promotion-engine.js');
const rec = TransactionalPromotionEngine.recoverInterruptedPromotion(
  'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\InventoryHub',
  { logger: console.log }
);
console.log('Recovery Status:', JSON.stringify(rec, null, 2));
process.exit(rec.recovered ? 0 : 1);
"
```

### Procedimiento C: Restauración Manual por Snapshot
En caso de requerir restauración manual directa desde el backup:
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
# Identificar el ID del último backup en backups/
# Restaurar archivos de configuración
copy /Y backups\<BACKUP_ID>\package.json.bak package.json
copy /Y backups\<BACKUP_ID>\package-lock.json.bak package-lock.json
npm install
node test_phase_2c2_full.js
```
*Criterio de Éxito del Rollback:* Paridad del 100 % de bytes en `package.json` y 34/34 pruebas de negocio aprobadas.

---

## 7. Evidencia que Debe Conservarse

Tras cualquier intento de promoción (exitoso o abortado), es mandatorio conservar:
1. `InventoryHub/operation_manifest.json`: Manifiesto de la operación con timestamps y hashes.
2. `InventoryHub/promotion_abort_evidence.json` (en caso de aborto o rollback).
3. Directorio de backup completo: `InventoryHub/backups/backup_<ID>/`.
4. Registro de salida de la terminal y códigos de retorno.
5. Evidencia de pruebas de negocio ejecutadas.
