# MANIFIESTO DE CANDIDATO A RELEASE — openmemory@0.3.14-rc3

**Fecha de Generación:** 2026-10-16T02:42:49.744Z  
**Versión Calificada:** `openmemory@0.3.14-rc3`  
**Artefacto Distribuible:** `openmemory-0.3.14-rc3.tgz`  
**Ubicación Persistente:** `.work/artifacts/openmemory-0.3.14-rc3.tgz`  
**Tamaño del Archivo:** 166375 bytes (162.5 kB)  
**Suma de Verificación SHA-256:** `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6`  
**Estado:** `CALIFICADO Y VERIFICADO EN SANDBOX AISLADO`  
**Consumidor Protegido:** `InventoryHub` (`openmemory@0.3.1` — ESTRICTAMENTE INTACTO)

---

## 1. Verificaciones Criptográficas y Métricas del Paquete

* **Total de Archivos Empaquetados:** 69
* **Archivos Core Requeridos:** 15/15 presentes
* **Fuga de Código Fuente:** 0 archivos (`src/`, `.work/`, tests completamente excluidos)
* **Vulnerabilidades npm audit:** 0 encontradas en instalación aislada

---

## 2. Mejoras Incorporadas en RC3 (Iteración P0.4)

1. **Blindaje contra NTFS Alternate Data Streams (ADS):**
   * Validación estricta de componentes de ruta en `resolveSecurePath` bloqueando `:` y caracteres reservados NTFS (`< > : " | ? *`).
2. **Protección de Locks con `exp === undefined`:**
   * En `cleanupStaleLocks`, no se eliminan locks activos con proceso vivo aun si la fecha de expiración no está definida.
3. **Validación de Completitud de Snapshots en Pre-flight:**
   * Si un backup declara archivos en `manifest.json`, la falta de cualquiera de ellos detiene la restauración antes de tocar el estado vivo.
4. **Cuarentena No Destructiva de Directorios de Recuperación:**
   * Los directorios `.recovery-*` con manifiestos ilegibles o corruptos son renombrados a `.quarantined-*`, preservando la evidencia física para auditoría.
5. **Detección de Manipulación en Archivos de Recuperación durante Rollback:**
   * Cada archivo del recovery snapshot es contrastado contra su `previousHash` antes de ser aplicado.
6. **Exclusión Mutua con `withStateLock`:**
   * `restoreBackup` y `recoverInterruptedRestore` operan bajo lock transaccional reentrante, evitando carreras con comandos MCP o lecturas concurrentes.

---

## 3. Registro de Candidatos en el Repositorio

| Versión | Archivo | Tamaño | SHA-256 | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `0.3.14-rc1` | `openmemory-0.3.14-rc1.tgz` | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` | Preservado (P0.2) |
| `0.3.14-rc2` | `openmemory-0.3.14-rc2.tgz` | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` | Preservado (P0.3) |
| **`0.3.14-rc3`** | **`openmemory-0.3.14-rc3.tgz`** | **166375 B** | **`9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6`** | **APROBADO Y CALIFICADO (P0.4)** |
