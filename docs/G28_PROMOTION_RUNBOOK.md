# RUNBOOK TRANSACCIONAL DE PROMOCIÓN Y ROLLBACK (HITO G28)
## Procedimiento Seguro de Promoción de InventoryHub a Evocara v0.4.0 GA

- **Fecha de Emisión:** 22 de octubre de 2026
- **Milestone:** G28 — Cierre de Evocara v0.4.0 GA
- **Consumidor Destino:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Actual en Vivo:** `0.3.14-rc4`
- **Versión Definitiva a Promover:** `0.4.0`
- **Paquete Tarball Definitivo:** `.work/artifacts/evocara-0.4.0.tgz`
- **Hash SHA-256 del Tarball:** `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
- **Tamaño del Tarball:** 209,910 bytes (76 archivos verificados)
- **SBOM Asociado:** `.work/artifacts/evocara-0.4.0.cdx.json` (SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`)
- **Manifiesto de Release:** `.work/artifacts/evocara-0.4.0-manifest.json`
- **Herramienta Oficial de Ejecución:** `scripts/transactional-promotion-engine.js`

> [!CAUTION]
> **RESTRICCIÓN OPERATIVA ESTRICTA:**
> Este runbook ha sido ensayado y certificado al 100 % en el entorno de staging aislado durante G28 (8/8 fases superadas, 34/34 pruebas de negocio aprobadas y rollback drill con paridad de bytes del 100 %).
> **BAJO NINGUNA CIRCUNSTANCIA DEBE EJECUTARSE** sobre el consumidor activo `InventoryHub` sin la autorización humana explícita del usuario para esa operación específica. El consumidor activo permanece protegido en `0.3.14-rc4`.

---

## 1. Verificaciones Previas y Condiciones de Aborto Inmediato

Antes de iniciar cualquier acción en el directorio de producción local, verificar:
1. **PID del Proceso:** Confirmar que ningún proceso Node.js o editor esté bloqueando archivos en `InventoryHub`.
2. **Existencia de Locks Huérfanos:** Verificar que no exista `.promotion.lock` en la raíz de `InventoryHub`. Si existe y el PID es inactivo, ejecutar `node scripts/cleanup-locks.js`.
3. **Estado Inicial del Consumidor:** Confirmar que `InventoryHub/node_modules/openmemory/package.json` declara exactamente `0.3.14-rc4`.
4. **Condición de Aborto 1:** Discrepancia en el hash SHA-256 del tarball candidato (`70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`).
5. **Condición de Aborto 2:** Fallo en cualquiera de las 34 pruebas de negocio previas a la mutación.
6. **Condición de Aborto 3:** Error en la fase de extracción o en el smoke test de MCP.
7. **Condición de Aborto 4:** Quiescencia de SQLite rota (presencia de archivos `.db-wal` > 0 bytes o `.db-shm` activos).

---

## 2. Protocolo de Ejecución Paso a Paso

### Paso 1: Verificación de Línea Base en Vivo (Operación de Solo Lectura)
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```
*Criterio de Aceptación:* Exactamente 34 / 34 pruebas aprobadas.

### Paso 2: Creación de Backup Atómico Transaccional
El motor `TransactionalPromotionEngine` crea automáticamente una copia de seguridad timestamped en `InventoryHub/backups/backup_<ID>/` conteniendo:
- `package.json` original respaldado (`package.json.bak`).
- `package-lock.json` original respaldado (`package-lock.json.bak`).
- Estado SQLite verificado y quiescente (0 archivos WAL/SHM activos).
- Manifiesto criptográfico de hashes de los archivos respaldados.

### Paso 3: Aplicación Transaccional del Paquete Definitivo
Una vez recibida la autorización explícita del usuario, ejecutar:
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

### Paso 4: Verificación Posterior a la Promoción (Smoke Test y MCP)
1. **Comprobar Versión Activa:**
   ```bash
   node -e "console.log(require('C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub/node_modules/evocara/package.json').version)"
   ```
   *Salida requerida:* `0.4.0`

2. **Ejecutar Batería de Pruebas de Negocio en Producción Local:**
   ```bash
   cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
   node test_inventory_manager.js
   node test_phase_2c2_full.js
   node test_phase_2c4_post_cleanup.mjs
   ```
   *Criterio de Aceptación:* 34 / 34 pruebas aprobadas al 100 %.

3. **Verificar Interfaz MCP con Doble Nomenclatura:**
   ```bash
   node -e "
   const evocara = require('C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub/node_modules/evocara');
   const server = evocara.createEvocaraMCPServer();
   console.log('Evocara MCP Server initialized successfully:', typeof server._requestHandlers.get('tools/list') === 'function');
   "
   ```

---

## 3. Procedimiento de Rollback de Emergencia

Si se produce cualquier anomalía, degradación de latencia o incoherencia en las pruebas de negocio tras la promoción:

### Opción A: Rollback Automático por el Motor
Si la promoción falla durante el proceso, `TransactionalPromotionEngine` se aborta fail-closed y ejecuta el rollback automático, alcanzando el estado `ROLLED_BACK`.

### Opción B: Rollback Manual Controlado
Ejecutar el comando de restauración transaccional:
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory"
node -e "
const { TransactionalPromotionEngine } = require('./scripts/transactional-promotion-engine.js');
const rec = TransactionalPromotionEngine.recoverInterruptedPromotion(
  'C:\\\\Users\\\\sant1\\\\OneDrive\\\\Documentos\\\\ChatGPT\\\\OpenMemory\\\\InventoryHub',
  { logger: console.log }
);
console.log('Recovery Result:', JSON.stringify(rec, null, 2));
"
```

O restaurar el snapshot original desde el directorio `backups/`:
```bash
cd "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub"
# Restaurar package.json y package-lock.json originales desde el último backup
copy /Y backups\<ULTIMO_BACKUP>\package.json.bak package.json
copy /Y backups\<ULTIMO_BACKUP>\package-lock.json.bak package-lock.json
npm install
node test_phase_2c2_full.js
```
*Criterio de Éxito del Rollback:* Paridad de bytes del 100 % con el estado `0.3.14-rc4` y 34/34 pruebas de negocio aprobadas.
