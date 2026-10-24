# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G30
## Transición Hacia el Hito G31: Proyección de Linaje Causal y Síntesis Contextual

**Fecha:** 23 de octubre de 2026  
**Autor:** Antigravity AI — Ingeniero Principal & Arquitecto de Software Senior  
**Estado:** Hito G30 COMPLETADO AL 100% — Entregado y verificado  
**Rama:** `main` (workspace local activo `OpenMemory/OpenMemory`)

---

### 1. Estado Actual del Repositorio

El Hito G30 ha quedado completamente implementado y verificado en el código fuente de Evocara / OpenMemory:
1. **Tipos bi-temporales (`src/storage/types.ts`):** `validFrom`, `validUntil`, `recordedAt`, `supersededAtSystem`, interfaces `PointInTimeQueryParams`, `PointInTimeItemResult`, `PointInTimeQueryResult`, `RetroactiveCorrectionParams`, `RetroactiveCorrectionResult`.
2. **Lógica de dominio bi-temporal (`src/storage/domains/knowledge-tms.ts`):** Métodos `validateTemporalInterval`, `isItemValidAtDomainTime`, `wasItemKnownAtSystemTime`, `wasItemSupersededAtSystemTime`, `evaluateBiTemporalItem`, `detectTemporalContradictions`.
3. **Persistencia, sustitución y consultas temporales (`src/storage.ts`):**
   - `internalSaveResearch`: persistencia de metadatos temporales en items y relations.
   - `supersedeKnowledgeDecision`: sincronización atómica de cierre/apertura de intervalos y relaciones `SUPERSEDES`.
   - `queryKnowledgeItems`: evaluación temporal bi-temporal y puntuación con `effectiveItem`.
   - `queryKnowledgePointInTime`: API de punto en el tiempo determinista con reporte de `confidence` (`HIGH`, `INCONCLUSIVE`, `UNANSWERABLE`).
   - `correctKnowledgeRetroactive`: corrección retroactiva no destructiva.
4. **Exposición MCP (`src/mcp.ts`):** Parámetros `asOfValidTime`, `asOfSystemTime`, `strictTemporal` en `openmemory_query_knowledge` y `evocara_query_knowledge`.
5. **Suite de pruebas reproducibles:** `.work/experiments/test-g30-bitemporal-suite.js` (15/15 PASS).

---

### 2. Instrucciones de Reproducción Local

Para reproducir y validar de forma autónoma el 100% de los resultados de G30:

```bash
# 1. Compilación TypeScript
npm run build

# 2. Ejecutar la suite bi-temporal G30
node .work/experiments/test-g30-bitemporal-suite.js

# 3. Ejecutar las suites de regresión
node .work/experiments/test-g29-knowledge-lifecycle-suite.js
node .work/experiments/test-g25-bm25-unit.js
node .work/experiments/test-g27-evocara-compatibility.js
node .work/experiments/test-g23-expanded-100-benchmark.js

# 4. Verificar integridad de InventoryHub
cd ../InventoryHub
node test_phase_2c4_post_cleanup.mjs
node test_phase_2c2_full.js
```

---

### 3. Estado de los Artefactos Protegidos

1. **Tarball GA Evocara v0.4.0:**
   - Ruta: `.work/artifacts/evocara-0.4.0.tgz`
   - Tamaño: `209,910` bytes
   - SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
   - Estado: **INTACTO Y PRESERVADO**. No se ha reconstruido ni modificado.

2. **Consumidor Activo InventoryHub:**
   - Dependencia activa: `openmemory-0.3.14-rc4.tgz`
   - Tests: 34 / 34 PASS.
   - Estado: **INTACTO Y NO PROMOVIDO**. Pendiente de autorización explícita humana para promoción.

---

### 4. Propuesta para el Siguiente Bloque: Hito G31

**Título:** Proyección de Linaje Causal, Detección de Contradicciones Temporales Activas y Síntesis Contextual de Decisión.

**Objetivo:**  
Aprovechar las relaciones bi-temporales implementadas en G30 (`SUPERSEDES`, `DERIVES_FROM`, `CONTRADICTS`) para permitir que un agente de IA pueda solicitar no solo el estado en una fecha, sino la **cadena causal completa de por qué cambió una decisión** (`explainDecisionLineage`), y alertar activamente si dos aserciones contradictorias solapan sus ventanas de validez en el tiempo de dominio.

**Criterios de Aceptación para G31:**
1. Método `explainDecisionLineage(itemId)` que reconstruya el DAG de sustituciones y derivaciones hacia atrás y hacia adelante.
2. Detección automática en tiempo de consulta de contradicciones epistémicas activas (`CONTRADICTS` con intervalos solapados).
3. Herramienta MCP `openmemory_explain_lineage` (y su alias `evocara_explain_lineage`).
4. Cero regresiones en la suite bi-temporal G30 (15/15) ni en el benchmark canónico (105/105).
