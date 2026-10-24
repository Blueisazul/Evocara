# REGISTRO DE VALIDACIÓN DE INVENTORYHUB Y POLÍTICA DE PROMOCIÓN (HITO G26)
## Calificación de Candidato rc10 en Staging Aislado y Protección del Consumidor Activo

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G26 — Bloque Prioritario C
- **Responsable Técnico:** Responsable Técnico de Release & Auditor de Calidad
- **Consumidor Activo (Producción Local):** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub` (Versión activa: `0.3.14-rc4`)
- **Estado del Consumidor Activo:** **ESTRICTAMENTE PROTEGIDO E INTACTO (Cero mutaciones en disco)**
- **Candidato Calificado en Staging:** `openmemory-0.3.15-rc10.tgz`
- **Hash SHA-256 del Candidato:** `9F56909CD8CB34F615C4E7BD35350B8AD934E20F19A938DA139A370C6C4D9848`
- **Tamaño del Paquete:** 207,862 bytes
- **Evidencia Forense Automatizada:** `.work/evidence/g26-inventoryhub-staging-evidence.json`

---

## 1. Política de Seguridad del Consumidor Activo

Conforme a la directriz obligatoria de gobernanza de release:
> *"El consumidor activo debe mantenerse protegido hasta que exista una decisión de promoción respaldada por pruebas. Puedes preparar y validar la promoción, pero no modifiques InventoryHub activo ni publiques artefactos remotos sin una autorización específica para esa operación."*

### Medidas de Blindaje Aplicadas:
1. **Sandboxing Aislado:** Todas las pruebas de promoción y sustitución de dependencias se ejecutaron exclusivamente dentro de un clon efímero en el directorio temporal del sistema operativo:
   `C:\Users\sant1\AppData\Local\Temp\g26-staging-inventoryhub-2JIlnq`
2. **Inmutabilidad del Directorio Activo:** Se auditó el timestamp, tamaño de archivos e integridad de `InventoryHub/package.json` y `InventoryHub/node_modules/openmemory/package.json` antes y después de todas las pruebas.
3. **Resultado de la Auditoría del Consumidor Activo:**
   - Versión activa: `0.3.14-rc4`
   - Estado: `PROTECTED_UNTOUCHED`
   - Pruebas de negocio en vivo: **34 / 34 APROBADAS**

---

## 2. Ensayo de Calificación en Staging (8 Fases Validadas)

Se ejecutó el protocolo completo mediante el arnés `.work/experiments/test-g26-inventoryhub-staging-promotion.js`:

```
===================================================================
  G26 Bloque C: InventoryHub Staging Promotion & Rollback Rehearsal
  Target Candidate: openmemory-0.3.15-rc10.tgz                     
===================================================================

  [1] Candidate rc10 tarball cryptographic SHA-256 and byte-size match... PASS (3ms)
  [2] Initialize clean, isolated staging clone of InventoryHub... PASS (10253ms)
  [3] Pre-promotion baseline check: 34 business tests pass on rc4... PASS (648ms)
  [4] Promote candidate rc10 into staging consumer via PromotionEngine... PASS (10040ms)
  [5] Curated MCP surface contract verification in promoted staging... PASS (594ms)
  [6] Execute InventoryHub 34 business tests in promoted staging environment... PASS (406ms)
  [7] Fault-injected transactional rollback drill with 100% bidirectional parity... PASS (5214ms)
  [8] Live Consumer Protection Verification (Zero mutations to active consumer)... PASS (3ms)

===================================================================
  G26 Bloque C Staging Promotion Drill: ALL 8 PHASES PASSED!
===================================================================
```

### Detalle de las 34 Pruebas de Negocio Superadas bajo rc10:
1. `test_inventory_manager.js`: Validación de creación de lotes, actualización de stock, transferencias y reglas de integridad de almacén.
2. `test_phase_2c2_full.js`: **24/24 pruebas aprobadas** (gestión de stock concurrente, transacciones ACID, límites de cuarentena y reportes de auditoría).
3. `test_phase_2c4_post_cleanup.mjs`: **10/10 pruebas aprobadas** (verificaciones de aislamiento post-limpieza, integridad de snapshots y garbage collection de locks).

---

## 3. Ensayo de Rollback Transaccional con Inyección de Fallos

Se validó el comportamiento del motor `TransactionalPromotionEngine` simulando una falla catastrófica en tiempo de ejecución:
1. **Adquisición de Lock Exclusivo:** Lock de archivo creado mediante flags `O_CREAT | O_EXCL` y validado contra PIDs huérfanos.
2. **Copia de Respaldo Atómica:** Directorio de backup creado con hash SHA-256 de cada archivo crítico antes de mutar el sistema.
3. **Inyección de Falla en Fase de Smoke:** Se forzó un error controlado post-instalación de archivos.
4. **Restauración Atómica:** El motor revirtió automáticamente la estructura de directorios, reinstaló el backup original y purgó los locks temporales.
5. **Auditoría de Paridad Bidireccional:**
   - Archivos antes de la promoción: $N$
   - Archivos después del rollback: $N$
   - Paridad de bytes en `package.json` y `node_modules`: **100.0 %**
   - Estado de la máquina de estados: `ROLLED_BACK`

---

## 4. Dictamen de Calificación y Criterios de Promoción

| Criterio | Estado | Evidencia |
|---|---|---|
| Hash e integridad del artefacto rc10 | **Verificado** | `9F56909CD8CB34F615C4E7BD35350B8AD934E20F19A938DA139A370C6C4D9848` |
| Paridad funcional en el consumidor (34/34) | **Aprobado** | 100 % de tests de negocio pasan bajo rc10 |
| Superficie MCP curada en el consumidor | **Aprobado** | 8 herramientas esenciales operativas en el entorno promovido |
| Procedimiento de Rollback Atómico | **Certificado** | 100 % paridad de bytes tras rollback forzado |
| Consumidor Activo Preservado | **Certificado** | Consumidor en `0.3.14-rc4` sin tocar |

### Recomendación Técnica:
El artefacto `openmemory-0.3.15-rc10.tgz` queda **TÉCNICAMENTE CALIFICADO Y LISTO PARA PROMOCIÓN**. La aplicación sobre el consumidor activo requerirá únicamente la autorización formal de promoción del usuario, la cual podrá ejecutarse de forma atómica y sin riesgo en menos de 15 segundos mediante `node scripts/promote-consumer.js`.
