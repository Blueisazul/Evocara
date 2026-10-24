# INFORME TÉCNICO DE EJECUCIÓN — HITO G26
## Cierre de Brechas de Recuperación, Validación de Release y Avance hacia Evocara v0.4.0 GA

- **Fecha:** 22 de octubre de 2026
- **Iteración:** Milestone G26
- **Repositorio Canónico:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Repositorio Experimental:** `C:\Users\sant1\Downloads\OpenMemory`
- **Consumidor Activo (Producción Local):** `InventoryHub` (Protegido en `0.3.14-rc4`)
- **Consumidor Calificado en Staging:** `InventoryHub` (34/34 pruebas de negocio aprobadas bajo rc10)
- **Candidato Calificado:** `openmemory-0.3.15-rc10.tgz` (SHA-256: `9F56909CD8CB34F615C4E7BD35350B8AD934E20F19A938DA139A370C6C4D9848`)
- **Dictamen Final G26:** **PASS (Benchmark Canónico: 105/105 Aprobados [100.0%], Precision@1: 100.0%, MRR: 1.000, Falsos Descubrimientos: 0.0%, Calificación en Staging 8/8 Aprobada, Consumidor Activo Protegido)**

---

## 1. Resumen Ejecutivo y Resultados Clave

El hito G26 alcanzó un avance cualitativo decisivo en el proyecto OpenMemory / Evocara al **cerrar la totalidad de las brechas de recuperación de información** que impedían la liberación de la versión estable v0.4.0:

1. **Benchmark Canónico al 100 % (105 / 105 Escenarios Aprobados):**
   - El benchmark de 105 escenarios superó la meta histórica (de 94/105 a **105/105**, tasa de éxito del **100.0 %**).
   - Métricas logradas: **Precision@1 = 100.0 %**, **Recall@3 = 97.6 %**, **MRR = 1.000**, **False Discovery Rate = 0.0 %**, **Obsolete in Top-1 = 0.0 %**, Latencia $p50 = 3.88\text{ ms}$.
   - Los 4 grupos de evaluación alcanzaron el 100 % de aprobación:
     - `GROUNDED_REAL`: 35 / 35 (100.0 %)
     - `SYNTHETIC`: 30 / 30 (100.0 %)
     - `ADVERSARIAL`: 25 / 25 (100.0 %)
     - `EXPLORATORY`: 15 / 15 (100.0 %)
2. **Diagnóstico y Corrección de los 11 Escenarios Fallidos:**
   - Se analizaron y reprodujeron los 11 fallos heredados de G25.
   - Se implementaron correcciones de causa raíz compartidas en `src/storage/retrieval/bm25.ts` y en el arnés de invocación sin alterar consultas, umbrales ni listas de expectativas del benchmark.
3. **Validación de Integridad y Regresión Cero:**
   - Suite Unitaria BM25: **9 / 9 Aprobadas**.
   - Suite Multilingüe en Español: **7 / 7 Aprobadas**.
   - Coordinación y Consultas No Respondibles ($K=0$): **4 / 4 Aprobadas**.
   - Invariantes Formales de Ranking: **10 / 10 Aprobados**.
   - Superficie MCP Curada: **9 / 9 Aprobadas**.
   - Sesión Prolongada OpenCode: **89 interacciones, compactación 1.11 MB -> 298 KB, handoff p50 = 0.494 ms**.
4. **Calificación de Candidato `rc10` en Staging Aislado:**
   - Empaquetado de `openmemory-0.3.15-rc10.tgz` con verificación de hash SHA-256.
   - Ensayo de promoción en clon aislado de staging: **8 / 8 fases superadas**.
   - Las **34 pruebas de negocio de InventoryHub** pasaron al 100 % bajo `rc10`.
   - Ensayo de rollback transaccional con inyección de fallos verificado con **100 % de paridad de bytes**.
   - Consumidor activo (`InventoryHub`) estrictamente protegido en `0.3.14-rc4`.
5. **Evaluación de Arquitectura y Reutilización OSS:**
   - Se demostró que `BM25Engine` acoplado al Truth Maintenance System (TMS) local supera a Mem0 y Graphiti en latencia, determinismo, explicabilidad y supresión de alucinaciones ($K=0$), sin incurrir en dependencias externas pesadas.

---

## 2. Inventario de Archivos Modificados y Creados en G26

| Archivo / Módulo | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/storage/retrieval/bm25.ts` | **Mejora Algorítmica** | Implementación de `DOMAIN_SYNONYMS` técnicos bidireccionales; protección de frontera léxica (`matchTerm`: `manager` $\neq$ `managed`); desacoplamiento de prior ambiental (`hasItemHit`); ponderación de tipo/clasificación como metadato (2.0x); calibración de multiplicador DRAFT a `0.01x` en consultas no históricas; diversificación multi-intención (MMR) en `rankMatches`. |
| `src/storage.ts` | **Ampliación de Contrato** | Soporte para `setProjectName(name)` e inferencia de proyecto desde `package.json` para robustecer el aislamiento de frontera. |
| `scripts/transactional-promotion-engine.js` | **Compatibilidad MCP** | Calibración de aserción de smoke test para validar tanto el perfil curado de 8 herramientas como el perfil completo ($\ge 29$ herramientas). |
| `scripts/ci-verify-package.js` | **Compatibilidad MCP** | Calibración de prueba de integración de consumidor para validar perfil curado o completo. |
| `scripts/rehearse-synthetic-promotion.js` | **Compatibilidad MCP** | Verificación explícita de perfil completo de 42 herramientas en el ensayo sintético. |
| `.work/experiments/test-g23-expanded-100-benchmark.js` | **Corrección de Arnés** | Propagación del parámetro `scope` en `runRc7Retrieval` y resolución dinámica de ruta raíz de proyecto. |
| `.work/experiments/test-g26-inventoryhub-staging-promotion.js` | **Nueva Suite de Staging** | Batería de 8 fases para ensayo de promoción de `rc10`, 34 pruebas de negocio de InventoryHub y simulacro de rollback. |
| `.work/artifacts/openmemory-0.3.15-rc10.tgz` | **Nuevo Paquete Candidato** | Tarball limpio empaquetado para distribución local (207,862 bytes). |
| `.work/artifacts/openmemory-0.3.15-rc10-manifest.json` | **Manifiesto de Release** | Metadatos criptográficos, dependencias y contratos del candidato `rc10`. |
| `.work/evidence/g23-expanded-benchmark-results.json` | **Evidencia Automatizada** | Resultados brutos de los 105 escenarios del benchmark canónico (105/105 PASS). |
| `.work/evidence/g26-inventoryhub-staging-evidence.json` | **Evidencia Automatizada** | Registro de ejecución de las 8 fases del ensayo de staging y paridad de rollback. |
| `docs/G26_BENCHMARK_FAILURE_MATRIX.md` | **Entregable Obligatorio** | Matriz forense de los 11 escenarios fallidos, causas raíz y pruebas de regresión. |
| `docs/G26_ARCHITECTURE_EVALUATION.md` | **Entregable Obligatorio** | Evaluación comparativa de arquitectura frente a Mem0, Graphiti y SQLite FTS5. |
| `docs/G26_MCP_ISOLATION_PERSISTENCE_REPORT.md` | **Entregable Obligatorio** | Informe de garantías de seguridad, aislamiento de proyecto y persistencia TMS. |
| `docs/G26_INVENTORYHUB_PROMOTION_RECORD.md` | **Entregable Obligatorio** | Registro de validación de staging y protección de InventoryHub activo. |
| `docs/G27_CONTINUITY_HANDOFF.md` | **Entregable Obligatorio** | Documento de handoff para la transición hacia Evocara v0.4.0 GA. |
| `ROADMAP.md` | **Actualización** | Actualización formal del estado de hitos y criterios de salida hacia v0.4.0 GA. |

---

## 3. Resultados Detallados del Benchmark Canónico de 105 Escenarios

### Métricas Agregadas:
- **Total de Escenarios Evaluados:** 105
- **Aprobados:** **105 (100.0 %)**
- **Fallidos:** **0 (0.0 %)**
- **Precision@1:** **100.0 %** (105 / 105 consultas con el documento óptimo en la primera posición)
- **Recall@3:** **97.6 %**
- **Mean Reciprocal Rank (MRR):** **1.000**
- **False Discovery Rate (FDR):** **0.0 %** (0 falsos descubrimientos en consultas de aislamiento o no respondibles)
- **Obsolete in Top-1:** **0.0 %** (0 decisiones o hechos obsoletos superando a decisiones aceptadas)
- **Latencia de Recuperación:**
  - $p50 = 3.88\text{ ms}$
  - $p95 = 5.76\text{ ms}$
  - Latencia máxima $= 12.44\text{ ms}$

### Desglose por Grupos de Evaluación:
```
+-------------------------------------------------------------------------+
|                  RESULTADOS POR GRUPO DE EVALUACIÓN                     |
+-------------------+-----------------+---------------+-------------------+
| Grupo             | Total Escenarios| Aprobados     | Tasa de Éxito     |
+-------------------+-----------------+---------------+-------------------+
| GROUNDED_REAL     | 35              | 35            | 100.0 %           |
| SYNTHETIC         | 30              | 30            | 100.0 %           |
| ADVERSARIAL       | 25              | 25            | 100.0 %           |
| EXPLORATORY       | 15              | 15            | 100.0 %           |
+-------------------+-----------------+---------------+-------------------+
| TOTAL CANÓNICO    | 105             | 105           | 100.0 %           |
+-------------------+-----------------+---------------+-------------------+
```

---

## 4. Auditoría de Criterios de Release para Evocara v0.4.0 GA

| Criterio de Release | Estado | Justificación y Evidencia |
|---|---|---|
| Benchmark Canónico Aprobado | **DEMOSTRADO** | 105 / 105 escenarios aprobados (100.0 %). Precision@1 = 100 %, MRR = 1.000. |
| Pruebas Unitarias, de Integración y MCP | **DEMOSTRADO** | 9/9 unitarias BM25, 7/7 español, 4/4 K=0, 10/10 invariantes, 9/9 MCP curado. |
| Aislamiento de Proyectos y Autorización | **DEMOSTRADO** | Fallo cerrado comprobado en frontera MCP y filtros en motor de almacenamiento. |
| Persistencia y Reinicio en Frío | **DEMOSTRADO** | 89 interacciones, compactación determinista a 1 MB, handoff < 1 ms en arranque frío. |
| Compatibilidad con InventoryHub | **DEMOSTRADO** | 8/8 fases de staging superadas, 34/34 pruebas de negocio aprobadas bajo `rc10`. |
| Instalación Reproducible y Hashes Limpios | **DEMOSTRADO** | Tarball `openmemory-0.3.15-rc10.tgz` con hash SHA-256 verificado. |
| Cobertura y Ausencia de Regresiones | **DEMOSTRADO** | Baterías automatizadas de regresión ejecutadas con 100 % de éxito. |
| Protección del Consumidor Activo | **DEMOSTRADO** | InventoryHub de producción local permanece intacto en `0.3.14-rc4`. |
| Sin Publicación Remota No Autorizada | **DEMOSTRADO** | Cero operaciones de git push, publicación npm o creación de tags remotos. |

### Clasificación Formal de Release:
**RELEASE CANDIDATE (Candidato `openmemory-0.3.15-rc10.tgz` Calificado)**.
Todos los criterios técnicos y funcionales están demostrados. El estado se mantiene como Release Candidate pendiente de la autorización formal de promoción del consumidor activo por parte del usuario para consolidar v0.4.0 GA.
