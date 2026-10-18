# MANIFIESTO DE CANDIDATO A RELEASE — openmemory@0.3.14-rc4

**Fecha de Generación:** 2026-10-17T14:58:33.385Z  
**Versión Calificada:** `openmemory@0.3.14-rc4`  
**Artefacto Distribuible:** `openmemory-0.3.14-rc4.tgz`  
**Ubicación Persistente:** `.work/artifacts/openmemory-0.3.14-rc4.tgz`  
**Tamaño del Archivo:** 167133 bytes (163.2 kB)  
**Suma de Verificación SHA-256:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`  
**Estado:** `CALIFICADO Y VERIFICADO EN SANDBOX AISLADO`  
**Consumidor Protegido:** `InventoryHub` (`openmemory@0.3.1` — ESTRICTAMENTE INTACTO)

---

## 1. Verificaciones Criptográficas y Métricas del Paquete

* **Total de Archivos Empaquetados:** 69
* **Archivos Core Requeridos:** 15/15 presentes
* **Fuga de Código Fuente:** 0 archivos (`src/`, `.work/`, tests completamente excluidos)
* **Vulnerabilidades npm audit:** 0 encontradas en instalación aislada

---

## 2. Mejoras Incorporadas en RC4 (Iteración P0.5)

1. **Reintento Idempotente y Preservación de `FAILED_ROLLBACK`:**
   * Las operaciones marcadas previamente como `FAILED_ROLLBACK` no son eliminadas en arranques posteriores; se reintentan de forma segura e idempotente una vez solventada la condición de fallo.
2. **Cuarentena No Destructiva de Fases Ambiguas:**
   * Ante fases desconocidas o corruptas en directorios `.recovery-*`, el sistema nunca borra datos; los pone en cuarentena (`.quarantined-*`).
3. **Exigencia Estricta de `manifest.json` Criptográfico:**
   * Ningún snapshot puede restaurarse si carece del manifiesto criptográfico de hashes SHA-256.
4. **Exclusión Mutua Completa con `withStateLock` para Creación de Backups:**
   * Tanto `createBackup` como `restoreBackup` y `recoverInterruptedRestore` operan bajo exclusión mutua de procesos cooperativos.
5. **Reclamación Segura de Locks Sin Expiración Huérfanos:**
   * Locks sin `expiresAt` y sin `pid` son reclamados tras el umbral TTL de inactividad física, eliminando posibles bloqueos permanentes.
6. **Normalización de `package-lock.json`:**
   * Eliminación del UTF-8 Byte Order Mark (BOM) para compatibilidad estricta con motores JSON multiplataforma.

---

## 3. Registro Histórico de Candidatos en el Repositorio

| Versión | Archivo | Tamaño | SHA-256 | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `0.3.14-rc1` | `openmemory-0.3.14-rc1.tgz` | 160,896 B | `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb` | Preservado (P0.2) |
| `0.3.14-rc2` | `openmemory-0.3.14-rc2.tgz` | 164,153 B | `1a2ff6de243e80518c7939df2e7033c5e25d4d4226395d1adc2a9b8df29f24b3` | Preservado (P0.3) |
| `0.3.14-rc3` | `openmemory-0.3.14-rc3.tgz` | 166,375 B | `9261e85a7f7394bbdab2ec1b19bdbbc5e5bf573475b22d66ac5576342c5771c6` | Preservado (P0.4) |
| **`0.3.14-rc4`** | **`openmemory-0.3.14-rc4.tgz`** | **167133 B** | **`af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e`** | **APROBADO Y CALIFICADO (P0.5)** |

---

## 4. Recalificación y Verificación de Integridad en P0.6

* **Fecha de Verificación P0.6:** 17 de octubre de 2026
* **Determinismo de Empaquetado:** Bit a bit idéntico (100% reproducible en doble pack independiente).
* **Paridad Criptográfica del Tarball:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` (167,133 bytes).
* **Batería de Consumidor Sintético:** 7/7 fases superadas en sandbox aislado (`test-synthetic-consumer-promotion.js`).
* **Verificación de Rollback Verificable:** Probada con inducción de fallos y comprobación de paridad contra inventario de Gate 0.
* **Comparador Granular de Vulnerabilidades:** Integrado y validado (`scripts/compare-audit-advisories.js`).
* **Estado de Promoción:** `LISTO PARA REVISIÓN` (Promoción a InventoryHub sujeta a autorización explícita).

---

## 5. Recalificación y Auditoría Independiente en P0.7

* **Fecha de Verificación P0.7:** 17 de octubre de 2026
* **Paridad Criptográfica del Tarball:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` (167,133 bytes) verificado intacto.
* **Batería de Pruebas Negativas:** 10/10 escenarios superados (`test-synthetic-consumer-promotion.js`), incluyendo colisión de respaldo, snapshots corruptos, mutación de SQLite, nuevos avisos, fallos de red y reversión verificable.
* **Runbook Endurecido:** Mapeo de rutas exacto por prefijo, autoverificación bidireccional y smoke tests aislados sin mutación de archivos vivos.
* **Estado de CI Remota:** Configurada en `.github/workflows/ci.yml` (Ubuntu, macOS, Windows en Node 18, 20, 22). Registrada como **Bloqueo Externo** a la espera de autorización humana formal para commit y push.
* **Recomendación de Release:** `LISTO PARA REVISIÓN HUMANA` (Promoción hacia InventoryHub estrictamente bloqueada hasta autorización formal).

---

## 6. Recalificación y Cierre de Brechas de Seguridad en P0.8

* **Fecha de Verificación P0.8:** 17 de octubre de 2026
* **Paridad Criptográfica del Tarball:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` (167,133 bytes) verificado 100% bit a bit idéntico.
* **Suite de Recuperación Adversarial P0.8:** 10/10 escenarios de recuperación adversarial superados (`test-p08-recovery-scenarios.js`).
  - Artefacto corrupto/tampered rechazado antes de tocar disco.
  - Colisión de respaldo evitada sin sobrescritura.
  - Verificación bidireccional de respaldo (archivos faltantes, huérfanos o modificados).
  - Rechazo estricto de inyecciones de path traversal.
  - Limpieza atómica y rollback ante fallo entre pasos consecutivos.
  - Detección de restauración parcial de manifiestos/lockfiles.
  - Alerta de emergencia ante fallo en rollback y preservación de evidencia diagnóstica.
  - Clasificación de fallos de red en auditorías de vulnerabilidades como `INDETERMINATE` (bloqueo preventivo).
  - Invariante estricta de cero mutaciones sobre el consumidor real (`InventoryHub`).
  - Preservación de evidencia diagnóstica persistente (`promotion_abort_evidence.json`).
* **Runbook P0.8 Endurecido:** `docs/PRODUCTION-PROMOTION-ROLLBACK.md` actualizado con checklist Go/No-Go formal (Gates 0 a 5), quiescencia estricta de SQLite y procesos concurrentes, mapeo relativo canónico con `[System.IO.Path]::GetRelativePath`, y consulta dinámica a MCP Server en tiempo de ejecución.
* **Batería Integral de Pruebas:** 8/8 suites ejecutadas y aprobadas en `scripts/safe-test-runner.js` (191+ comprobaciones pasando, cero polución).
* **Consumidor InventoryHub:** Verificado de solo lectura, intacto en `openmemory@0.3.1`.
* **Recomendación Final P0.8:** `LISTO PARA REVISIÓN HUMANA / SOLICITUD DE AUTORIZACIÓN PARA PUSH REMOTO Y PREPARACIÓN DE RELEASE`.

---

## 7. Recalificación, Seguridad de Producción y Resiliencia en P0.9

* **Fecha de Verificación P0.9:** 17 de octubre de 2026
* **Paridad Criptográfica del Tarball:** `af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e` (167,133 bytes) verificado 100% bit a bit idéntico (Doble empaquetado independiente consistente).
* **Suite de Recuperación Adversarial P0.9:** 14/14 escenarios adversariales de fallo y recuperación superados (`test-p09-recovery-scenarios.js`):
  1. Artefacto corrupto/tampered rechazado antes de tocar disco.
  2. Colisión de respaldo preexistente evitada sin sobrescritura.
  3. Verificación bidireccional estricta de respaldo (archivos faltantes, huérfanos o modificados).
  4. Detección de drift o mutación concurrente en inventario durante la copia del respaldo.
  5. Rechazo estricto de inyecciones de path traversal, rutas malformadas y escapes de junction/symlink.
  6. Manejo transaccional de fallos entre pasos consecutivos de promoción con reversión atómica limpia.
  7. Resiliencia de rollback ante consumidores sin `package-lock.json` original.
  8. Detección y bloqueo crítico ante lockfile declarado ausente o corrupto.
  9. Vinculación estricta por `operationId` en `operation_manifest.json` previniendo desalineaciones cross-operación.
  10. Detección explícita de recuperación incompleta tras rollback con emisión de alerta de emergencia.
  11. Detección y resurrección automática de estados intermedios interrumpidos (APPLYING/RECOVERING).
  12. Clasificación de fallos de red en auditorías como `INDETERMINATE` (bloqueo preventivo y salida con código 2).
  13. Verificación bidireccional de inmutabilidad de SQLite (detecta bases modificadas, borradas O archivos nuevos).
  14. Invariante estricta de cero mutaciones sobre el consumidor real (`InventoryHub`).
* **Runbook P0.9 Endurecido:** `docs/PRODUCTION-PROMOTION-ROLLBACK.md` actualizado con `operation_manifest.json`, eliminación total de comodines, manejo de lockfiles opcionales, quiescencia verificada de SQLite y smoke tests estrictamente de solo lectura en producción (cero escrituras sobre el consumidor).
* **Batería Integral de Pruebas:** 9/9 suites ejecutadas y aprobadas en `scripts/safe-test-runner.js` (209+ comprobaciones aprobadas, 100% de éxito, 0 polución del árbol de trabajo).
* **Consumidor InventoryHub:** Verificado de solo lectura, 100% intacto en `openmemory@0.3.1`.
* **Recomendación Final P0.9:** `LISTO PARA REVISIÓN TÉCNICA / SOLICITUD DE AUTORIZACIÓN PARA PUSH REMOTO Y PREPARACIÓN DE RELEASE`.
