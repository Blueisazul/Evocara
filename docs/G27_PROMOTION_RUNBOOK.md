# RUNBOOK TRANSACCIONAL DE PROMOCIÓN Y ROLLBACK (HITO G27)
## Procedimiento Seguro de Promoción de InventoryHub a Evocara v0.4.0 (openmemory-0.3.15-rc11)

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G27 — Bloque D
- **Consumidor Destino:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Actual en Vivo:** `0.3.14-rc4`
- **Versión Candidata a Promover:** `0.3.15-rc11`
- **Paquete Tarball:** `.work/artifacts/openmemory-0.3.15-rc11.tgz`
- **Hash SHA-256 Autorizado:** `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`
- **Herramienta Oficial de Ejecución:** `scripts/transactional-promotion-engine.js`

> [!CAUTION]
> **RESTRICCIÓN OPERATIVA ESTRICTA:**
> Este runbook está técnicamente ensayado y validado al 100 % en staging. **NO DEBE EJECUTARSE** sobre el consumidor activo `InventoryHub` sin la autorización humana explícita del usuario para esa operación específica.

---

## 1. Verificaciones Previas y Condiciones de Aborto Inmediato

Antes de iniciar cualquier acción en el directorio de producción local, verificar:
1. **PID del Proceso:** Confirmar que ningún proceso Node.js o editor esté bloqueando archivos en `InventoryHub`.
2. **Existencia de Locks Huérfanos:** Verificar que no exista `.promotion.lock` en la raíz de `InventoryHub`. Si existe y el PID es inactivo, ejecutar `node scripts/cleanup-locks.js`.
3. **Estado Inicial del Consumidor:** Confirmar que `InventoryHub/node_modules/openmemory/package.json` declara exactamente `0.3.14-rc4`.
4. **Condición de Aborto 1:** Discrepancia en el hash SHA-256 del tarball candidato.
5. **Condición de Aborto 2:** Fallo en cualquiera de las 34 pruebas de negocio previas a la mutación.
6. **Condición de Aborto 3:** Error en la fase de extracción o en el smoke test de MCP.

---

## 2. Protocolo de Ejecución Paso a Paso

### Paso 1: Ejecución de Línea Base en Vivo (Lectura Pura)
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```
*Criterio de salida:* 34 / 34 pruebas aprobadas.

### Paso 2: Creación de Backup Atómico
El motor `TransactionalPromotionEngine` crea automáticamente una copia de seguridad timestamped en `InventoryHub/backups/backup-<TIMESTAMP>/` conteniendo:
- `package.json` original.
- `package-lock.json` original.
- Copia íntegra de `node_modules/openmemory/`.
- Manifiesto criptográfico de hashes de los archivos respaldados.

### Paso 3: Aplicación Transaccional del Paquete Candidato
Una vez recibida la autorización explícita del usuario, ejecutar:
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory"
node -e "
const { TransactionalPromotionEngine } = require('./scripts/transactional-promotion-engine.js');
const engine = new TransactionalPromotionEngine({
  consumerPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\InventoryHub',
  tarballPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\OpenMemory\\\\.work\\\\artifacts\\\\openmemory-0.3.15-rc11.tgz',
  originalVersion: '0.3.14-rc4',
  expectedVersion: '0.3.15-rc11',
  dryRun: false
});
const res = engine.runPromotion();
console.log('Promotion Result:', JSON.stringify(res, null, 2));
process.exit(res.success ? 0 : 1);
"
```
*Criterio de salida:* `state: "COMMITTED"`, `success: true`.

### Paso 4: Verificación Post-Promoción (Aceptación en Vivo)
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```
*Criterio de salida:* Las 34 pruebas de negocio deben aprobar al 100 % bajo la versión promovida `0.3.15-rc11`.

---

## 3. Procedimiento de Rollback de Emergencia

En caso de interrupción del proceso, corte de energía o fallo en las pruebas post-promoción:

### Opción A: Rollback Automático del Motor
Si la falla ocurre durante `engine.runPromotion()`, la máquina de estados transiciona automáticamente a `ROLLING_BACK` -> `ROLLED_BACK`, restaurando el backup y purgando los locks.

### Opción B: Rollback Manual de Contingencia
Si fuera necesario revertir manualmente el consumidor al estado inicial `0.3.14-rc4`:
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory"
node -e "
const { TransactionalPromotionEngine } = require('./scripts/transactional-promotion-engine.js');
const engine = new TransactionalPromotionEngine({
  consumerPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\InventoryHub',
  tarballPath: 'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\OpenMemory\\\\.work\\\\artifacts\\\\openmemory-0.3.15-rc11.tgz',
  originalVersion: '0.3.14-rc4',
  expectedVersion: '0.3.15-rc11'
});
engine.executeRollback();
console.log('Manual Rollback Completed.');
"
```
### Verificación Post-Rollback:
1. Confirmar versión instalada:
   ```bash
   node -e "console.log(require('C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub/node_modules/openmemory/package.json').version)"
   ```
   *Debe imprimir:* `0.3.14-rc4`.
2. Re-ejecutar las 34 pruebas de negocio de InventoryHub para certificar que el consumidor está 100 % recuperado.
