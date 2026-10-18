# INFORME DE INTEGRIDAD Y REPRODUCIBILIDAD DEL EMPAQUETADO (P0.6)

**Módulo:** `scripts/verify-release-integrity.js`  
**Fecha:** 17 de octubre de 2026  
**Rama:** `fix/p0-security-concurrency-hardening`  
**Candidato Evaluado:** `openmemory@0.3.14-rc4`  
**Suma de Verificación SHA-256 Canónica:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`  
**Tamaño Canónico:** 167,133 bytes

---

## 1. Resumen Ejecutivo

En cumplimiento del Bloque C del mandato P0.6, se llevó a cabo una auditoría exhaustiva sobre los mecanismos de construcción y distribución de OpenMemory. Se implementó una herramienta de verificación automática (`scripts/verify-release-integrity.js`), se ejecutó un experimento de empaquetado doble independiente para contrastar determinismo bit a bit, y se generó una matriz diferencial de contenido entre los cuatro candidatos históricos (`RC1`, `RC2`, `RC3` y `RC4`).

El proceso de empaquetado demostró ser **100% determinista y reproducible bit a bit**, generando exactamente el mismo tarball de 167,133 bytes con el hash SHA-256 declarado.

---

## 2. Experimento de Doble Empaquetado Independiente

Se ejecutaron dos procesos independientes de `npm pack` en directorios temporales aislados (`om-pack-repro-A-*` y `om-pack-repro-B-*`), introduciendo una pausa deliberada entre ambos para forzar discrepancias de timestamp (`mtime`):

```
Tarball A:
  Archivo: openmemory-0.3.14-rc4.tgz
  Tamaño:  167,133 bytes
  SHA-256: af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e

Tarball B:
  Archivo: openmemory-0.3.14-rc4.tgz
  Tamaño:  167,133 bytes
  SHA-256: af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e
```

* **Coincidencia Bit a Bit del Tarball Completo:** **SÍ (100% Idéntico)**
* **Archivos Internos Extraídos Comparados:** 69 archivos
* **Paridad de Hashes de Archivos Extraídos:** **69 / 69 (100% Idénticos)**

---

## 3. Matriz Diferencial de Contenido entre Candidatos Históricos

Se catalogó y contrastó criptográficamente el contenido interno de los cuatro tarballs archivados en `.work/artifacts/`:

| Candidato | Fecha / Iteración | Tamaño Tarball | SHA-256 Tarball | Total Archivos | Archivos Core |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RC1** | P0.2 (15 Oct 2026) | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` | 69 | 15 / 15 |
| **RC2** | P0.3 (16 Oct 2026) | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` | 69 | 15 / 15 |
| **RC3** | P0.4 (16 Oct 2026) | 166,375 B | `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6` | 69 | 15 / 15 |
| **RC4** | P0.5 (17 Oct 2026) | 167,133 B | `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` | 69 | 15 / 15 |

### Evolución del Código Fuente Empaquetado:

1. **RC1 -> RC2 (Endurecimiento de Persistencia Atómica):**
   * 13 archivos modificados, 56 sin cambios.
   * Cambios principales: `path-security.js` (inclusión de defensas contra dispositivos DOS y ADS), `persistence-engine.js` (atomic writes con fsyncSync), `backup-manager.js` (staging y cálculo previo de hashes).

2. **RC2 -> RC3 (Recuperación Post-Crash y Cerrojo Asíncrono):**
   * 12 archivos modificados, 57 sin cambios.
   * Cambios principales: incorporación de máquina de estados (`APPLYING`, `RECOVERING`, `COMPLETED`), reconciliación automática en boot, cuarentena de carpetas corruptas.

3. **RC3 -> RC4 (Reintento de FAILED_ROLLBACK y Cerrojo en Backup):**
   * 8 archivos modificados, 61 sin cambios.
   * Modificaciones puntuales:
     - `dist/storage.js` (+83 B): Envoltorio `withStateLock` sobre `createBackup`.
     - `dist/storage/core/persistence-engine.js` (+200 B): Reclamación segura de cerrojos huérfanos sin PID tras TTL de inactividad de disco.
     - `dist/storage/domains/backup-manager.js` (+1,221 B): Reintento de `FAILED_ROLLBACK` en boot, cuarentena no destructiva de fases desconocidas y validación obligatoria de `manifest.json`.
     - `package.json`: Bump de versión de `0.3.14-rc3` a `0.3.14-rc4`.

---

## 4. Lista Blanca de Contenido y Control de Fugas

Se verificó que el tarball generado cumple estrictamente con la política de distribución limpia:

* **Archivos Requeridos (15/15 presentes):**
  - `dist/index.js`, `dist/index.d.ts`
  - `dist/storage.js`, `dist/storage.d.ts`
  - `dist/mcp.js`, `dist/mcp.d.ts`
  - `dist/storage/core/path-security.js`, `dist/storage/core/path-security.d.ts`
  - `dist/storage/core/persistence-engine.js`, `dist/storage/core/persistence-engine.d.ts`
  - `dist/storage/domains/backup-manager.js`, `dist/storage/domains/backup-manager.d.ts`
  - `dist/installer.js`
  - `dist/stage-engine.js`
  - `dist/cli.js`
* **Control de Exclusión (Cero Fugas):**
  - 0 archivos en `src/`
  - 0 archivos en `.work/`
  - 0 scripts de prueba (`test-*` o `*.spec.*`)
  - 0 archivos temporales o de scratch

---

## 5. Límites Reales de Reproducibilidad entre Entornos

Aunque en el entorno de desarrollo local (Windows Node.js v22) el empaquetado es 100% determinista, se documentan los límites intrínsecos de reproducibilidad entre entornos heterogéneos:

1. **Fin de Línea (CRLF vs LF):** Si un clon de Git en Windows utiliza `core.autocrlf = true`, los archivos de texto (`README.md`, `package.json`) tendrán bytes `\r\n`, produciendo un SHA-256 distinto al generado en un entorno Linux con `\n`.
2. **Permisos de Archivo POSIX:** Windows no almacena bits de permisos ejecutables (`chmod +x` o `0755`), asignando `0666` por defecto a los archivos empaquetados por `npm pack`. En Linux/macOS, los archivos en `dist/cli.js` pueden conservar permisos `0755`, alterando la cabecera tar.
3. **Bandera de SO en Cabecera GZIP:** La compresión gzip almacena un byte que identifica el sistema operativo de origen (e.g. 0 para Unix, 11 para NTFS/Windows).

**Mitigación Canónica:** El artefacto oficial calificado es el generado en el entorno controlado de release, archivado en `.work/artifacts/openmemory-0.3.14-rc4.tgz` con su hash canónico `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`.
