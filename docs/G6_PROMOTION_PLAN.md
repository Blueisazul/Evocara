# PLAN DE PROMOCIÓN CONTROLADA G6: OPENMEMORY EN INVENTORYHUB

**Versión:** 1.0.0  
**Fecha:** 2026-10-18  
**Gate:** G6 (Promoción Controlada en Consumidor)  
**Estado Oficial:** `G6_READY_FOR_PROMOTION`  

---

## 1. Resumen Ejecutivo y Alcance

El presente documento establece el procedimiento técnico, formal y reproducible para promover el artefacto candidato **`openmemory@0.3.14-rc4`** al consumidor de referencia **`InventoryHub`**, asegurando cero tiempo de inactividad no planificado, inmutabilidad de los datos persistentes de memoria y capacidad de reversión atómica (rollback) bidireccional garantizada.

### 1.1 Identificación de Componentes

| Parámetro | Detalle de Origen | Detalle de Destino |
| :--- | :--- | :--- |
| **Paquete** | `openmemory` | `openmemory` |
| **Versión** | `0.3.1` | `0.3.14-rc4` |
| **Dependencia** | `file:scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz` | `file:.../openmemory-0.3.14-rc4.tgz` |
| **SHA-256 Artefacto** | `48d022f8ef35914769ef2df423a39a1c391cb383686e6a2575ca6906a115b1ef` | `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` |
| **Tamaño Artefacto** | 147.676 bytes | 167.133 bytes |
| **Consumidor** | `InventoryHub` (`C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`) | Entorno ESM con persistencia SQLite y MCP local |

---

## 2. Inventario Exacto de Modificaciones Previstas

### 2.1 Archivos que se modificarán en el Consumidor
1. **`InventoryHub/package.json`**:
   - `dependencies.openmemory` se actualizará de `0.3.1` a la referencia exacta del tarball candidato `0.3.14-rc4`.
2. **`InventoryHub/package-lock.json`**:
   - Se regenerará el árbol de resolución con la integridad criptográfica de `0.3.14-rc4`.
3. **`InventoryHub/node_modules/openmemory/`**:
   - Reemplazo atómico de la biblioteca activa a `0.3.14-rc4`.
4. **`InventoryHub/backups/backup_promo_<operationId>/`**:
   - Directorio de respaldo transaccional generado automáticamente antes de la mutación.
5. **`InventoryHub/operation_manifest.json`**:
   - Registro auditable de la operación con estado final `COMMITTED`.

### 2.2 Archivos estrictamente protegidos (Inmutables)
* **`InventoryHub/.openmemory/*`**: Todo el estado persistente (`openmemory.json`, `project-state.json`, `handoff.md`, `adrs/`, `knowledge/`, `logs/events.jsonl`) permanece intacto.
* **`InventoryHub/src/*`**: Todo el código de negocio del consumidor (`Database.js`, `InventoryRepository.js`, `index.js`).
* **`InventoryHub/opencode.json`**: Mantiene su configuración intacta apuntando a `node_modules/openmemory/dist/mcp.js`.
* **`InventoryHub/test_*.js` / `test_*.mjs`**: Suites de pruebas del consumidor sin alteraciones.
* **`InventoryHub/scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz`**: El paquete original se conserva intacto para habilitar cualquier rollback posterior.

---

## 3. Precondiciones Técnicas Mandatorias

Antes de iniciar la ventana de promoción real, deben satisfacerse los siguientes criterios:

1. **Gate G5 Verificado:** El reporte `docs/G5_REMOTE_CI_FINAL_REPORT.md` debe constatar el veredicto `G5_PASSED` (CI remoto Run ID `39089378899`, 9/9 plataformas aprobadas).
2. **Integridad Criptográfica del Artefacto:** El hash SHA-256 de `.work/artifacts/openmemory-0.3.14-rc4.tgz` debe coincidir con `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`.
3. **Consumidor en Quiescencia:**
   - Cero procesos activos accediendo a las bases de datos SQLite de `InventoryHub`.
   - Cero ficheros `-wal` con tamaño > 0 bytes y cero ficheros `-shm` activos.
4. **Ausencia de Bloqueos:** El archivo `.promotion.lock` no debe existir en `InventoryHub` o debe ser un bloqueo huérfano con TTL expirado y proceso inactivo.
5. **Ensayo de Aislamiento Superado:** La suite `G6-REHEARSAL` debe haber completado con 100% de éxito en un entorno aislado sin tocar el consumidor real.

---

## 4. Procedimiento de Ejecución Paso a Paso

### Paso 1: Ensayo en Modo Simulación (`--dry-run`)
Ejecutar la validación completa sin modificar paquetes ni archivos:

```powershell
node scripts/promotion-engine.js `
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" `
  --tarball "C:\Users\sant1\Downloads\OpenMemory\.work\artifacts\openmemory-0.3.14-rc4.tgz" `
  --expected-sha256 "af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e" `
  --expected-size 167133 `
  --expected-version "0.3.14-rc4" `
  --original-version "0.3.1" `
  --dry-run
```
*Criterio de éxito:* Mensaje `Promotion successfully committed and verified!` con estado `COMMITTED` en stdout, confirmando preflight y catálogo sin mutación física.

### Paso 2: Promoción Real Supervisada
Una vez aprobada la ventana y verificadas las precondiciones, ejecutar la promoción con el gancho de pruebas de aceptación del consumidor:

```powershell
node scripts/promotion-engine.js `
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" `
  --tarball "C:\Users\sant1\Downloads\OpenMemory\.work\artifacts\openmemory-0.3.14-rc4.tgz" `
  --expected-sha256 "af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e" `
  --expected-size 167133 `
  --expected-version "0.3.14-rc4" `
  --original-version "0.3.1" `
  --consumer-test "node test_inventory_manager.js && node test_phase_2c2_full.js && node test_phase_2c4_post_cleanup.mjs"
```

### Fases de la Transacción Automatizada:
1. **Fase 0 (Bloqueo):** Adquisición atómica de `.promotion.lock` con token criptográfico único y TTL dinámico.
2. **Fase 1 (Pre-Flight):** Validación de integridad SHA-256 del candidato y escaneo recursivo de quiescencia SQLite.
3. **Fase 2 (Backup Transaccional):** Respaldo íntegro de `.openmemory/`, `package.json` y `package-lock.json` en `backups/backup_<opId>` con verificación bidireccional del 100% de los hashes.
4. **Fase 3 (Instalación):** Aplicación atómica de `npm install <tarball> --save-exact` y comprobación de versión `0.3.14-rc4` en `node_modules/openmemory/package.json`.
5. **Fase 4 (Smoke Test & Aceptación):** 
   - Smoke test de solo lectura verificando los 8 exports públicos y los 29 tools MCP.
   - Verificación de 0 mutaciones en disco.
   - Ejecución del test suite de aceptación de `InventoryHub` (FIFO, COGS, Rollback en déficit, SQLite).
6. **Fase 5 (Post-Verificación & Commit):** Verificación de integridad de base de datos SQLite pre y post, persistencia de `operation_manifest.json` y liberación segura del lock.

---

## 5. Criterios de Aborto y Condiciones de Rollback

El motor abortará la transacción e iniciará el rollback automático e inmediato si ocurre cualquiera de los siguientes eventos:

1. **Fallo de Hash:** La suma de verificación SHA-256 del tarball no coincide con el valor esperado.
2. **Falta de Quiescencia:** Detección de base de datos SQLite con archivo WAL (> 0 B) o SHM en uso.
3. **Fallo en Creación de Backup:** Discrepancia en cantidad de archivos o suma de comprobación entre el origen y el respaldo.
4. **Fallo o Timeout de npm install:** Si el comando `npm install` falla o supera el tiempo límite de 180 segundos.
5. **Mutación Indebida:** Si el smoke test modifica algún archivo protegido del consumidor.
6. **Fallo en Pruebas de Aceptación:** Si cualquiera de las suites de prueba de `InventoryHub` retorna código de salida distinto de 0.
7. **Violación de Bloqueo (`assertLockHeld`):** Si el fichero de bloqueo `.promotion.lock` es manipulado, eliminado o su token alterado durante la ejecución.
8. **Interrupción por Señal:** Recepción de `SIGINT` o `SIGTERM` durante la ejecución.

---

## 6. Procedimiento de Restauración (Rollback)

### 6.1 Rollback Automatizado (Por el Motor)
En caso de aborto, el motor ejecuta la máquina de reversión:
1. Lee `operation_manifest.json` y los metadatos de backup.
2. Restaura `.openmemory/` utilizando un área de intercambio de staging atómica (`.staging-rollback-<opId>`).
3. Si el swap falla, rescata el estado en `.live-swap-<opId>` para prevenir pérdida de datos.
4. Restaura `package.json` y `package-lock.json` desde sus copias de respaldo.
5. Reinstala la dependencia original usando `originalSpecifier` (`file:scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz`).
6. Verifica que la versión instalada vuelve a ser `0.3.1` y que el catálogo de `.openmemory/` tiene 100% de paridad con el estado pre-promoción.
7. Libera el bloqueo mutuo y registra la evidencia de aborto en `promotion_abort_evidence.json`.

### 6.2 Procedimiento de Emergencia Manual (En caso de fallo catastrófico del host)
Si ocurriese una pérdida total de energía o terminación forzada del proceso Node antes del rollback:
1. Localizar el último directorio de respaldo en `InventoryHub/backups/backup_promo_<timestamp>/`.
2. Restaurar `package.json.bak` a `package.json`.
3. Restaurar `package-lock.json.bak` a `package-lock.json`.
4. Restaurar el subdirectorio `openmemory/` a `InventoryHub/.openmemory/`.
5. Ejecutar `npm install file:scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz --save-exact` en `InventoryHub`.
6. Eliminar el archivo `.promotion.lock` huérfano si existe.
7. Ejecutar `node test_inventory_manager.js` para validar la integridad recuperada.

---

## 7. Pruebas de Aceptación Posteriores a la Promoción

Una vez completada la promoción real, se deben ejecutar los siguientes comandos para certificar el cierre de G6:

1. **Verificación de Versión en Runtime:**
   ```powershell
   node -e "const pkg = require('./node_modules/openmemory/package.json'); console.log('Active OpenMemory:', pkg.version);"
   ```
   *Salida esperada:* `Active OpenMemory: 0.3.14-rc4`

2. **Verificación de Servidor MCP (29 Herramientas):**
   ```powershell
   node -e "const { createMCPServer } = require('openmemory'); const s = createMCPServer(); s._requestHandlers.get('tools/list')({method:'tools/list'},{}).then(r => console.log('MCP Tools:', r.tools.length));"
   ```
   *Salida esperada:* `MCP Tools: 29` (o superior).

3. **Verificación Funcional del Consumidor (`InventoryHub`):**
   ```powershell
   node test_inventory_manager.js
   node test_phase_2c2_full.js
   node test_phase_2c4_post_cleanup.mjs
   ```
   *Salida esperada:* 100% de pruebas aprobadas sin errores.

---

## 8. Evidencias que se Conservarán

1. **`docs/G6_PROMOTION_READINESS_REPORT.md`**: Informe técnico de preparación y resultados de ensayo.
2. **`docs/G6_EVIDENCE_MANIFEST.json`**: Manifiesto criptográfico con identificadores de ejecución y hashes.
3. **`InventoryHub/operation_manifest.json`**: Manifiesto generado por el motor en la promoción real.
4. **`InventoryHub/backups/backup_promo_*`**: Copia de seguridad completa del estado pre-promoción.
5. **Logs de ejecución**: Salidas de terminal completas sin exposición de credenciales ni secretos.
