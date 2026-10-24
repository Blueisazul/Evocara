# DOCUMENTO DE CONTINUIDAD Y HANDOFF (HITO G26 -> G27)
## Transición hacia la Promoción Autorizada de InventoryHub y Publicación de Evocara v0.4.0 GA

- **Fecha:** 22 de octubre de 2026
- **Emisor:** Agente Autónomo G26 (Arquitecto de Software & Release Manager)
- **Receptor:** Agente Operativo G27 / Operador Humano
- **Línea Base Consolidada:** Hito G26 Completado al 100 %
- **Candidato Calificado:** `openmemory-0.3.15-rc10.tgz` (SHA-256: `9F56909CD8CB34F615C4E7BD35350B8AD934E20F19A938DA139A370C6C4D9848`)
- **Consumidor Activo:** `InventoryHub` (Protegido en `0.3.14-rc4`, 34/34 pruebas de negocio aprobadas)

---

## 1. Estado Verificado y Logros de G26

1. **Benchmark Canónico:**
   - **105 / 105 escenarios aprobados (100.0 %)**.
   - Precision@1: **100.0 %**, Recall@3: **97.6 %**, MRR: **1.000**, FDR: **0.0 %**.
   - Los 11 fallos heredados de G25 fueron diagnosticados y resueltos en su causa raíz compartida sin alterar consultas ni expectativas.
2. **Garantías de Memoria y Seguridad:**
   - Aislamiento de proyecto estricto con fallo-cerrado verificado.
   - Supresión cuadrática y atenuación exponencial de falsos positivos ($K=0$).
   - Multiplicador de ciclo de vida TMS para decisiones obsoletas y borradores (`SUPERSEDED = 0.05x`, `DRAFT = 0.01x`).
   - Compactación determinista de log de eventos (1.11 MB a 298 KB, 100 % de eventos esenciales preservados).
   - Handoff de ultra-baja latencia ($p50 = 0.494\text{ ms}$) y continuidad tras arranque en frío.
3. **Calificación en Staging de InventoryHub:**
   - Ensayo de 8 fases completado exitosamente en sandbox efímero.
   - Las **34 pruebas de negocio de InventoryHub** pasaron al 100 % bajo el candidato `rc10`.
   - Ensayo de rollback transaccional con inyección de fallos completado con 100 % de paridad de bytes.
   - El consumidor activo de producción local **no fue alterado** (cero mutaciones en disco).
4. **Evaluación de Arquitectura OSS:**
   - Se concluyó formalmente que `BM25Engine` acoplado a TMS es la solución óptima (local-first, cero dependencias, 30-100x más rápida que Mem0 o Graphiti).

---

## 2. Ubicación de Entregables y Artefactos

| Artefacto / Documento | Ruta en el Repositorio | Descripción |
|---|---|---|
| **Informe Técnico G26** | `docs/G26_TECHNICAL_REPORT.md` | Informe completo de implementación y métricas. |
| **Matriz de los 11 Fallos** | `docs/G26_BENCHMARK_FAILURE_MATRIX.md` | Análisis forense de cada uno de los 11 escenarios y sus correcciones. |
| **Evaluación de Arquitectura** | `docs/G26_ARCHITECTURE_EVALUATION.md` | Comparativa técnica frente a Mem0, Graphiti y SQLite FTS5. |
| **Informe MCP y Persistencia** | `docs/G26_MCP_ISOLATION_PERSISTENCE_REPORT.md` | Validación de garantías de aislamiento, TMS y compatibilidad dual. |
| **Registro de Staging** | `docs/G26_INVENTORYHUB_PROMOTION_RECORD.md` | Evidencia de las 8 fases en staging y protección del consumidor activo. |
| **Roadmap Actualizado** | `ROADMAP.md` | Plan de hitos y criterios de salida actualizados. |
| **Paquete Candidato rc10** | `.work/artifacts/openmemory-0.3.15-rc10.tgz` | Tarball local listo para promoción (207,862 bytes). |
| **Manifiesto de Release** | `.work/artifacts/openmemory-0.3.15-rc10-manifest.json` | Hash SHA-256 y contratos del candidato. |
| **Evidencia Bruta Benchmark** | `.work/evidence/g23-expanded-benchmark-results.json` | 105 resultados brutos verificados. |
| **Evidencia Bruta Staging** | `.work/evidence/g26-inventoryhub-staging-evidence.json` | Registro de staging y rollback. |

---

## 3. Próximo Bloque de Trabajo Recomendado (Milestone G27)

### Objetivo Principal:
Cerrar la promoción autorizada del consumidor activo `InventoryHub` a `rc10`, consolidar la nomenclatura formal hacia **Evocara v0.4.0**, y preparar el corte definitivo de General Availability (GA).

### Secuencia de Tareas:
1. **Tarea 1 — Promoción Autorizada de InventoryHub en Producción Local:**
   - Una vez recibida la autorización explícita del usuario, ejecutar la promoción atómica sobre `InventoryHub` utilizando `TransactionalPromotionEngine`:
     ```bash
     node scripts/promote-consumer.js --consumer="C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" --tarball=".work/artifacts/openmemory-0.3.15-rc10.tgz"
     ```
   - Ejecutar y verificar las 34 pruebas de negocio en el entorno en vivo.
2. **Tarea 2 — Transición de Nomenclatura a Evocara (v0.4.0):**
   - Configurar alias duales en MCP (`openmemory_*` y `evocara_*`) para garantizar compatibilidad sin fricciones.
   - Registrar binario CLI dual (`openmemory` y `evocara`).
   - Actualizar encabezados y documentación de producto manteniendo la inmutabilidad de los reportes históricos.
3. **Tarea 3 — Corte Final de Release Evocara v0.4.0 GA:**
   - Generación de manifiesto SBOM (`Software Bill of Materials`).
   - Empaquetado final limpio `evocara-0.4.0.tgz`.
   - Congelación de release y cierre formal del ciclo de desarrollo.
