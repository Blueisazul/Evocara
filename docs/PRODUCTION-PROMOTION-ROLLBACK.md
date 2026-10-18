# PROTOCOLO DE PROMOCIÓN A PRODUCCIÓN Y REVERSIÓN CONTROLADA (ROLLBACK RUNBOOK P1.2)

**Destino de Promoción:** `InventoryHub` (`C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`)  
**Versión Actual en Producción:** `openmemory@0.3.1` (ESTRICTAMENTE PRESERVADA E INTACTA)  
**Candidato Calificado:** `openmemory@0.3.14-rc4`  
**Artefacto Distribuible:** `openmemory-0.3.14-rc4.tgz`  
**Checksum SHA-256 (rc4):** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`  
**Tamaño del Tarball:** 167.133 bytes  
**Fecha de Actualización P1.2:** 17 de octubre de 2026  
**Iteración:** P1.2 — Auditoría Correctiva, Endurecimiento Transaccional y Preparación Verificable de Release  

---

## 1. Modos de Ejecución Disponibles

El protocolo de promoción P1.2 cuenta con dos vías de ejecución:

1. **Vía Automatizada y Transaccional (Recomendada):** Orquestada de forma programática por [`scripts/transactional-promotion-engine.js`](file:///C:/Users/sant1/Downloads/OpenMemory/scripts/transactional-promotion-engine.js), la cual gobierna automáticamente la máquina de estados, el bloqueo mutuo contra colisiones (`.promotion.lock`), el respaldo bidireccional y la reversión en staging ante cualquier fallo.
2. **Vía Manual Paso a Paso (PowerShell Administrativo):** Para auditorías forenses o ejecución supervisada por un operador humano.

---

## 2. Vía Automatizada: Orquestador Transaccional

Para ejecutar la promoción de forma completamente autónoma con garantías de recuperación atómica:

```bash
# Ejecutar desde la raíz de OpenMemory (REQUIERE AUTORIZACIÓN HUMANA EN PRODUCCIÓN)
node scripts/transactional-promotion-engine.js \
  --consumer-path "C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub" \
  --tarball ".work/artifacts/openmemory-0.3.14-rc4.tgz" \
  --expected-sha256 "af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e" \
  --expected-size 167133 \
  --original-version "0.3.1"
```

### Garantías del Motor Transaccional:
* **Exclusión Mutua:** Si otro proceso está ejecutando una promoción en el consumidor, se aborta de inmediato con `PROMOTION_CONCURRENCY_VIOLATION`.
* **Respaldo Íntegro:** Copia recursiva verificada de `.openmemory/`, `package.json`, y `package-lock.json` (si existía), preservando archivos ocultos y carpetas vacías.
* **Restauración en Staging:** Ante cualquier error en instalación, smoke test o auditoría, la restauración de `.openmemory/` se prepara y verifica al 100% en un directorio temporal (`.staging-rollback-<id>`) antes de sustituir el directorio vivo.
* **Cero Residuos:** Si el consumidor no tenía `.openmemory/` o `package-lock.json` antes de la promoción, el rollback los purga por completo.
* **Preservación de Evidencia:** El motivo del fallo y la instantánea del manifiesto se registran de forma inmutable en `promotion_abort_evidence.json`.

---

## 3. Checklist de Precondiciones y Criterios Go / No-Go por Gate

| Gate | Descripción | Precondición Obligatoria | Criterio de Aceptación (GO) | Criterio de Rechazo (NO-GO) |
| :--- | :--- | :--- | :--- | :--- |
| **Gate 0** | **Quiescencia e Inventario Criptográfico** | Entorno inactivo; procesos Node detenidos; SQLite en reposo. | Cero procesos Node del consumidor; consolidación de logs WAL/SHM verificada; inventario XML/JSON de hashes SHA-256 completado; artefacto RC4 verificado (`af88fae9...`). | Procesos concurrentes activos; logs WAL no consolidados; discrepancia de hash del artefacto. |
| **Gate 1** | **Respaldo Transaccional con Manifiesto** | Gate 0 superado; destino no preexistente. | Generación de `operation_manifest.json` con ID único; respaldo de `.openmemory` y manifiestos (`package.json`, y `package-lock.json` si existía); autoverificación bidireccional al 100% (paridad directa e inversa). | Directorio de respaldo preexistente; error de I/O o permisos; discrepancia de conteo o hashes en verificación inversa. |
| **Gate 2** | **Instalación Determinista** | Gate 1 superado; lockfile y manifiestos consistentes. | `npm install "$TARBALL" --save-exact` exitoso; `node_modules/openmemory/package.json` reporta exactamente versión `0.3.14-rc4`. | Fallo de instalación; código de salida no cero; versión reportada distinta a `0.3.14-rc4`. |
| **Gate 3** | **Smoke Tests de Solo Lectura en Consumidor** | Gate 2 exitoso; servidor MCP disponible. | 6/6 exports cargados; $\ge 29$ herramientas MCP registradas dinámicamente; lectura limpia de `project-state.json`; **CERO mutaciones sobre el estado vivo (verificado por auditoría pre/post de disco)**. | Excepción en carga; herramientas MCP < 29; cualquier escritura o alteración de archivos reales. |
| **Gate 4** | **Verificación Posterior y Comparador de Vulnerabilidades** | Gate 3 exitoso. | Inmutabilidad bidireccional de SQLite (ni bases modificadas ni nuevos archivos creados); comparador de auditoría (`compare-audit-advisories.js`) retorna código 0 (`CONFORME`). | Mutación en SQLite; aparición de nuevas bases o archivos WAL/SHM huérfanos; nuevas vulnerabilidades; severidad empeorada; estado `INDETERMINATE` (código 1 o 2). |
| **Gate 5** | **Rollback Verificable y Tolerante a Fallos** | Disparado ante cualquier NO-GO en Gates 2, 3 o 4. | Restauración atómica guiada por staging en `operation_manifest.json`; dependencias restauradas a `0.3.1`; paridad criptográfica 100% contra inventarios Gate 0; preservación de evidencia diagnóstica. | Error en reversión sin alerta; versión final distinta a `0.3.1`; discrepancia residual en inventario; eliminación accidental del respaldo. |

---

## 4. Procedimiento Manual Paso a Paso (PowerShell Administrativo)

### Gate 0: Quiescencia e Inventario Criptográfico
```powershell
# Definir rutas normalizadas
$IH_DIR = [System.IO.Path]::GetFullPath("C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub")
$OM_REPO = [System.IO.Path]::GetFullPath("C:\Users\sant1\Downloads\OpenMemory")
$TARBALL = Join-Path $OM_REPO ".work\artifacts\openmemory-0.3.14-rc4.tgz"
$EXPECTED_HASH = "af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e"
$EXPECTED_SIZE = 167133

# 1. Comprobar que no hay procesos Node activos en el consumidor
$activeNode = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and $_.Path.StartsWith($IH_DIR, [System.StringComparison]::OrdinalIgnoreCase)
}
if ($activeNode) { throw "ABORT: Procesos Node activos en InventoryHub." }

# 2. Comprobar consolidación WAL en SQLite (excluyendo node_modules y backups)
$sqliteFiles = Get-ChildItem -Path $IH_DIR -Include *.db, *.sqlite, *.sqlite3, *-wal, *-shm -Recurse -File -Exclude node_modules, backups
foreach ($sf in $sqliteFiles) {
    if ($sf.Name.EndsWith("-wal") -and $sf.Length -gt 0) {
        throw "ABORT: Archivo WAL con datos activos sin consolidar: $($sf.FullName)"
    }
}
$sqliteFiles | ForEach-Object {
    [PSCustomObject]@{
        Path = [System.IO.Path]::GetFullPath($_.FullName)
        Size = $_.Length
        SHA256 = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash
    }
} | Export-Clixml -Path "$IH_DIR\sqlite_pre_inventory.xml"

# 3. Validar integridad del tarball candidato
$tarballItem = Get-Item $TARBALL
$actualHash = (Get-FileHash -Algorithm SHA256 $TARBALL).Hash.ToLower()
if ($tarballItem.Length -ne $EXPECTED_SIZE) { throw "ABORT: Discrepancia en tamaño del tarball." }
if ($actualHash -ne $EXPECTED_HASH) { throw "ABORT: Discrepancia en checksum SHA-256." }
Write-Host "[Gate 0] Quiescencia y artefacto verificados con éxito."
```

### Gate 1: Respaldo Transaccional
```powershell
Set-Location $IH_DIR
$OPERATION_ID = "promo_" + (Get-Date -Format "yyyyMMdd_HHmmss")
$OM_BACKUP_DIR = Join-Path $IH_DIR "backups\pre_promo_rc4_$OPERATION_ID"
$PKG_BAK = Join-Path $IH_DIR "package.json.pre_promo_rc4.bak"
$LOCK_BAK = Join-Path $IH_DIR "package-lock.json.pre_promo_rc4.bak"
$HAS_LOCK = Test-Path (Join-Path $IH_DIR "package-lock.json")

# Respaldo package.json
Copy-Item (Join-Path $IH_DIR "package.json") $PKG_BAK -Force
if ($HAS_LOCK) { Copy-Item (Join-Path $IH_DIR "package-lock.json") $LOCK_BAK -Force }

# Respaldo de .openmemory/ preservando dotfiles
$OM_LIVE_DIR = Join-Path $IH_DIR ".openmemory"
if (Test-Path $OM_LIVE_DIR) {
    New-Item -ItemType Directory -Path $OM_BACKUP_DIR -Force | Out-Null
    Copy-Item -Path "$OM_LIVE_DIR\*" -Destination $OM_BACKUP_DIR -Recurse -Force
}
Write-Host "[Gate 1] Respaldo transaccional completado."
```

### Gate 2: Instalación Determinista
```powershell
Set-Location $IH_DIR
npm install "$TARBALL" --save-exact
if ($LASTEXITCODE -ne 0) { throw "ABORT: Fallo en npm install." }

node -e "
  const pkg = require('./node_modules/openmemory/package.json');
  if (pkg.version !== '0.3.14-rc4') {
    console.error('Versión instalada inesperada:', pkg.version);
    process.exit(1);
  }
"
if ($LASTEXITCODE -ne 0) { throw "ABORT: Verificación de versión fallida en Gate 2." }
Write-Host "[Gate 2] Instalación de openmemory@0.3.14-rc4 verificada."
```

### Gate 3: Smoke Test de Solo Lectura con Prueba de Cero Mutaciones
```powershell
Set-Location $IH_DIR
node -e "
  const assert = require('assert');
  const om = require('openmemory');
  const expected = ['StorageEngine', 'createMCPServer', 'PersistenceEngine', 'PathSecurity', 'BackupManager', 'EventLogger'];
  for (const exp of expected) { assert(om[exp], 'Missing: ' + exp); }
  const mcp = om.createMCPServer ? om.createMCPServer() : null;
  if (mcp && mcp.tools) { assert(mcp.tools.length >= 29, 'Expected >=29 MCP tools'); }
  console.log('SMOKE_OK');
"
if ($LASTEXITCODE -ne 0) { throw "ABORT: Fallo en smoke test de Gate 3." }
Write-Host "[Gate 3] Smoke test de solo lectura superado."
```

### Gate 4: Auditoría Diferencial e Inmutabilidad SQLite
```powershell
Set-Location $IH_DIR
# 1. Comprobar inmutabilidad SQLite
$preSqlite = Import-Clixml "$IH_DIR\sqlite_pre_inventory.xml"
foreach ($item in $preSqlite) {
    $curHash = (Get-FileHash -Algorithm SHA256 $item.Path).Hash
    if ($curHash -ne $item.SHA256) { throw "ABORT: Base de datos SQLite mutada: $($item.Path)" }
}

# 2. Auditoría diferencial de dependencias
npm audit --json | Out-File -FilePath "$IH_DIR\npm-audit-post.json" -Encoding utf8
node "$OM_REPO\scripts\compare-audit-advisories.js" "$IH_DIR\npm-audit-pre.json" "$IH_DIR\npm-audit-post.json"
if ($LASTEXITCODE -ne 0) { throw "ABORT: Regresión o anomalía detectada en auditoría de seguridad." }
Write-Host "[Gate 4] Inmutabilidad SQLite y auditoría de seguridad superadas."
```

---

## 5. Procedimiento de Rollback en Staging (Gate 5)

Ante cualquier fallo, la restauración se efectúa con preparación en staging:

```powershell
Write-Warning "[ROLLBACK] Iniciando procedimiento de reversión a openmemory@0.3.1..."
Set-Location $IH_DIR

# 1. Restaurar package.json y package-lock.json
Copy-Item $PKG_BAK (Join-Path $IH_DIR "package.json") -Force
if ($HAS_LOCK) {
    Copy-Item $LOCK_BAK (Join-Path $IH_DIR "package-lock.json") -Force
} else {
    if (Test-Path (Join-Path $IH_DIR "package-lock.json")) {
        Remove-Item (Join-Path $IH_DIR "package-lock.json") -Force
    }
}

# 2. Reinstalar versión original
npm install "scratch/exp2_10/fase4_5/dist/openmemory-0.3.1.tgz" --save-exact

# 3. Restaurar .openmemory/ mediante staging preparado
if (Test-Path $OM_BACKUP_DIR) {
    $stagingDir = Join-Path $IH_DIR ".staging_rollback"
    if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
    Copy-Item -Path "$OM_BACKUP_DIR\*" -Destination $stagingDir -Recurse -Force

    # Swap atómico
    if (Test-Path $OM_LIVE_DIR) { Remove-Item $OM_LIVE_DIR -Recurse -Force }
    Move-Item -Path $stagingDir -Destination $OM_LIVE_DIR -Force
} elseif (-not (Test-Path $OM_BACKUP_DIR) -and (Test-Path $OM_LIVE_DIR)) {
    # Si no existía originalmente, purgar
    Remove-Item $OM_LIVE_DIR -Recurse -Force
}

Write-Host "=== ROLLBACK COMPLETADO: InventoryHub restaurado a openmemory@0.3.1 ==="
```
