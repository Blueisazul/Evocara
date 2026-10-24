# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G31
## Transición Hacia el Hito G32: Validación de Continuidad entre Sesiones y Explicabilidad en Consumidores Reales

**Fecha:** 23 de octubre de 2026  
**Autor:** Antigravity AI — Ingeniero Principal & Arquitecto de Software Senior  
**Estado:** Hito G31 COMPLETADO AL 100% — Entregado y verificado  
**Rama:** `main` (workspace local activo `OpenMemory/OpenMemory`)

---

### 1. Estado Actual del Repositorio

El Hito G31 ha quedado completamente implementado y verificado en el código base de Evocara / OpenMemory:
1. **Tipos de Linaje Causal y Contradicciones (`src/storage/types.ts`):**
   - Estructuras: `LineageNode`, `LineageEdge`, `LineageContradiction`, `DecisionSynthesis`, `DecisionLineageResult`, `DecisionLineageParams`.
   - Extensión de `PointInTimeQueryResult` con `activeContradictions` y `activeAlerts`.
2. **Lógica de Grafo Causal y Contradicciones Temporales (`src/storage/domains/knowledge-tms.ts`):**
   - Método `findItemContradictions`: chequeo de relaciones `CONTRADICTS` explícitas, solapamientos en semántica semiabierta $[validFrom, validUntil)$ y exclusión mutua de versiones.
   - Método `explainDecisionLineage`: recorrido determinista en anchura (BFS) bidireccional, recolección de ancestros (`SUPERSEDES`), sucesores y derivaciones (`DERIVED_FROM`), detección de ciclos, soporte de referencias rotas (`isBroken`) y generación de síntesis textual estructurada.
3. **Persistencia e Integración en StorageEngine (`src/storage.ts`):**
   - Método público `explainDecisionLineage(itemId, options)`: aislamiento multitenant estricto (fail-closed ante consultas cross-project), resolución de scopes y cero mutaciones en disco.
   - Enriquecimiento de `queryKnowledgePointInTime` con detección automática de contradicciones activas y degradación de confianza a `INCONCLUSIVE` ante conflictos severos.
4. **Exposición MCP con Alias Duales (`src/mcp.ts`):**
   - Herramientas simétricas `openmemory_explain_lineage` y `evocara_explain_lineage` con contratos declarados, proyección rica en Markdown y bloque JSON estructurado.
5. **Suites y Benchmarks Automatizados:**
   - Suite de aceptación G31: `.work/experiments/test-g31-lineage-and-contradictions-suite.js` (18/18 PASS, 100%).
   - Benchmark de rendimiento G31: `.work/experiments/benchmark-g31-lineage-perf.js` (p50 = 0.93ms en cadena de 50 nodos).
   - Evidencia estructurada: `docs/G31_TEST_EVIDENCE.json`.

---

### 2. Instrucciones de Reproducción Local

Para reproducir y validar de forma autónoma el 100% de los resultados de G31:

```bash
# 1. Compilación TypeScript
npm run build

# 2. Ejecutar la suite de aceptación G31 (18 escenarios)
node .work/experiments/test-g31-lineage-and-contradictions-suite.js

# 3. Ejecutar el benchmark de escalabilidad y rendimiento G31
node .work/experiments/benchmark-g31-lineage-perf.js

# 4. Ejecutar las suites de regresión histórica
node .work/experiments/test-g30-bitemporal-suite.js
node .work/experiments/test-g29-knowledge-lifecycle-suite.js
node .work/experiments/test-g25-bm25-unit.js
node .work/experiments/test-g27-evocara-compatibility.js
node .work/experiments/test-g25-mcp-curated-surface.js
node .work/experiments/test-g23-expanded-100-benchmark.js

# 5. Verificar integridad del consumidor protegido InventoryHub
node ../InventoryHub/test_phase_2c4_post_cleanup.mjs
node ../InventoryHub/test_phase_2c2_full.js
```

---

### 3. Estado de los Artefactos Protegidos

1. **Tarball GA Evocara v0.4.0:**
   - Ruta: `.work/artifacts/evocara-0.4.0.tgz`
   - Tamaño: `209,910` bytes
   - SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
   - Estado: **INTACTO Y PRESERVADO**. Sin modificaciones ni regeneración.

2. **SBOM CycloneDX GA:**
   - Ruta: `.work/artifacts/evocara-0.4.0.cdx.json`
   - Tamaño: `41,973` bytes
   - SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
   - Estado: **INTACTO Y PRESERVADO**.

3. **Consumidor Activo InventoryHub:**
   - Ubicación: `../InventoryHub`
   - Dependencia: `openmemory: file:../../../../../Downloads/OpenMemory/.work/artifacts/openmemory-0.3.14-rc4.tgz`
   - Pruebas de negocio: `34 / 34 PASSED (100%)`.
   - Estado: **INTACTO Y PRESERVADO** (Sin promoción ni modificaciones en producción local).

---

### 4. Riesgos Residuales y Consideraciones

1. **Datos Legados Sin Marcas Temporales:**
   - Los registros creados con versiones anteriores a G30 no contienen `validFrom` o `validUntil`. El motor los trata como abiertos, documentando la incertidumbre en `synthesis.uncertainties` sin falsos conflictos.
2. **Promoción de Producción Local:**
   - La actualización de `InventoryHub` a `evocara@0.4.0` continúa formalmente congelada a la espera de autorización explícita del usuario, conforme a las restricciones del proyecto.

---

### 5. Recomendación para el Siguiente Hito (G32)

A partir de las brechas reales observadas tras completar el sustrato bi-temporal (G30) y el linaje causal/contradictorio (G31):
- **Hito G32 Recomendado:** **Benchmark de Continuidad Entre Sesiones y Explicabilidad Real en InventoryHub**.
  - Crear un benchmark comparativo de continuidad agente-memoria (con memoria habilitada vs. deshabilitada) evaluando tareas reales de refactorización y auditoría en un entorno clonado de InventoryHub.
  - Medir la reducción de tokens consumidos, la eliminación de re-indagaciones de arquitectura y la capacidad del agente para justificar decisiones mediante `explainDecisionLineage`.
  - Evaluar la conveniencia de una herramienta MCP de síntesis global de proyecto antes de considerar motores semánticos o grafos avanzados.
