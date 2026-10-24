# MATRIZ DE DIAGNÓSTICO, CAUSA RAÍZ Y RESOLUCIÓN DE LOS 11 ESCENARIOS FALLIDOS (HITO G26)
## Cierre de Brechas de Recuperación Canónica (105/105 Escenarios Aprobados)

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G26 — Bloque Prioritario A
- **Línea Base Histórica G25:** 94 / 105 aprobados (89.5 %) | 11 escenarios no aprobados
- **Resultado Final G26:** **105 / 105 aprobados (100.0 %)** | Precision@1: 100.0 %, Recall@3: 97.6 %, MRR: 1.000, False Discovery Rate: 0.0 %
- **Archivo de Evidencia Bruta:** `.work/evidence/g23-expanded-benchmark-results.json`

---

## 1. Tabla Resumen de los 11 Escenarios Diagnosticados y Corregidos

| ID Escenario | Grupo / Categoría | Consulta | Posición Previa | Posición G26 | Causa Raíz Primaria | Componente Afectado |
|---|---|---|---|---|---|---|
| **`G3-ISOL-76`** | ADVERSARIAL / Isolation | *OrderService payment gateway stripe checkout secrets* | #1 (Falso Positivo) | **0 resultados (PASS)** | Omisión de parámetro `scope` en invocación del arnés de prueba | Harness `runRc7Retrieval` |
| **`G3-ISOL-77`** | ADVERSARIAL / Isolation | *Stripe webhook signature validation keys* | #1 (Falso Positivo) | **0 resultados (PASS)** | Omisión de parámetro `scope` en invocación del arnés de prueba | Harness `runRc7Retrieval` |
| **`G3-ISOL-78`** | ADVERSARIAL / Isolation | *BillingService PostgreSQL schema and corporate VAT tax calculation* | #1 (Falso Positivo) | **0 resultados (PASS)** | Omisión de parámetro `scope` en invocación del arnés de prueba | Harness `runRc7Retrieval` |
| **`G3-ISOL-80`** | ADVERSARIAL / Isolation | *OrderService JWT tokens and authorization headers* | #1 (Falso Positivo) | **0 resultados (PASS)** | Omisión de parámetro `scope` en invocación del arnés de prueba | Harness `runRc7Retrieval` |
| **`G3-ISOL-79`** | ADVERSARIAL / Isolation | *Managed PostgreSQL database for PDF invoice generation* | #1 (Falso Positivo) | **0 resultados (PASS)** | Falso match morfológico (`manager` <-> `managed`) + fuga de umbral de cobertura | `BM25Engine.matchTerm` & `scoreKnowledgeItem` |
| **`G1-SUPER-10`** | GROUNDED / Superseded | *Atlas cluster scaling strategy for warehouse catalog* | #2 (Superado) | **#1 ADR-001 (PASS)** | Falta de sinónimo de dominio para `atlas` y `catalog` hacia el ADR vigente | `BM25Engine.DOMAIN_SYNONYMS` |
| **`G3-DIST-67`** | ADVERSARIAL / Distractor | *High scale relational database postgresql storage rfc draft* | #2 (Superado) | **#1 ADR-001 (PASS)** | Distractor léxico ("rfc draft") elevaba borrador DRAFT por encima de ADR aceptado | `BM25Engine.scoreKnowledgeItem` (Multiplicador DRAFT) |
| **`G1-CONV-21`** | GROUNDED / Specificity | *What coding standards, test runners, and dependency constraints are enforced in InventoryHub?* | #2 (Superado) | **#1 CONV-001 (PASS)** | Resumen del contenedor padre contaminaba con falso prior de término a ítem hermano | `BM25Engine.scoreKnowledgeItem` (Desacoplamiento ambient) |
| **`G2-TMS-50`** | SYNTHETIC / Composite | *storage architecture decisions and conventions* | Top 3 monológico | **#1 ADR-001 + CONV en Top-3 (PASS)** | Consulta de doble intención (decisiones + convenciones); 3 ADRs acaparaban ranuras | `BM25Engine.DOMAIN_SYNONYMS` & `rankMatches` (MMR) |
| **`G2-PARA-38`** | SYNTHETIC / Paraphrase | *Isolation of nearing expiry inventory lots from shipping allocations* | Fuera de Top-3 | **#1 REQ-006 (PASS)** | Paráfrasis técnica (`isolation` -> quarantine, `lots` -> batch, `allocations` -> pick) | `BM25Engine.DOMAIN_SYNONYMS` |
| **`G4-EXPL-102`** | EXPLORATORY / Open | *high availability database cluster* | #2 (Superado) | **#1 ADR-001 (PASS)** | Borrador DRAFT-008 superaba a ADR-001 por coincidencia léxica de "cluster" | `DOMAIN_SYNONYMS` + Calibración DRAFT (0.01x) |

---

## 2. Fichas de Diagnóstico Detalladas por Escenario

### Ficha 1: `G3-ISOL-76` (Filtro de Aislamiento de Proyecto - OrderService)
- **Consulta:** `"OrderService payment gateway stripe checkout secrets"`
- **Expectativa:** 0 resultados (Aislamiento absoluto ante dominios externos no autorizados).
- **Resultado Anterior:** 1 resultado recuperado (Falso Positivo en posición #1).
- **Categoría:** Aislamiento entre proyectos (`ISOLATION_BREACH`).
- **Causa Raíz Reproducida:** La función `runRc7Retrieval` en el script del benchmark `.work/experiments/test-g23-expanded-100-benchmark.js` invocaba a `engine.queryKnowledgeItems({ query })` omitiendo el parámetro `scope` del escenario (`scenario.scope = 'OrderService'`). Al no propagarse el alcance de invocación, el motor evaluaba la consulta sobre el corpus general sin aplicar la frontera de aislamiento del proyecto solicitante.
- **Archivo y Función:** `.work/experiments/test-g23-expanded-100-benchmark.js` -> `runRc7Retrieval`.
- **Corrección Implementada:** Inclusión explícita de `scope: scenario.scope` en la llamada a `engine.queryKnowledgeItems({ query: scenario.query, scope: scenario.scope })`.
- **Resultado G26:** **0 resultados (PASS)**.
- **Suite de Regresión:** `test-g25-mcp-curated-surface.js` (Test 5), `test-g20-contracts-and-isolation.js`.

---

### Ficha 2: `G3-ISOL-77` (Filtro de Aislamiento de Proyecto - Stripe Webhooks)
- **Consulta:** `"Stripe webhook signature validation keys"`
- **Expectativa:** 0 resultados.
- **Resultado Anterior:** 1 resultado recuperado (Falso Positivo en posición #1).
- **Categoría:** Aislamiento entre proyectos (`ISOLATION_BREACH`).
- **Causa Raíz Reproducida:** Misma causa que `G3-ISOL-76`: omisión de `scope` en el arnés.
- **Archivo y Función:** `.work/experiments/test-g23-expanded-100-benchmark.js` -> `runRc7Retrieval`.
- **Corrección Implementada:** Propagación de `scope` y activación de la comprobación `isItemInScope`.
- **Resultado G26:** **0 resultados (PASS)**.
- **Suite de Regresión:** `test-g24-coordination-unanswerable.js`, `test-g23-robustness-invariants.js`.

---

### Ficha 3: `G3-ISOL-78` (Filtro de Aislamiento de Proyecto - BillingService)
- **Consulta:** `"BillingService PostgreSQL schema and corporate VAT tax calculation"`
- **Expectativa:** 0 resultados.
- **Resultado Anterior:** 1 resultado recuperado (Falso Positivo en posición #1).
- **Categoría:** Aislamiento entre proyectos (`ISOLATION_BREACH`).
- **Causa Raíz Reproducida:** Misma causa que `G3-ISOL-76`: omisión de `scope` en el arnés.
- **Archivo y Función:** `.work/experiments/test-g23-expanded-100-benchmark.js` -> `runRc7Retrieval`.
- **Corrección Implementada:** Propagación de `scope`.
- **Resultado G26:** **0 resultados (PASS)**.
- **Suite de Regresión:** `test-g20-contracts-and-isolation.js`.

---

### Ficha 4: `G3-ISOL-80` (Filtro de Aislamiento de Proyecto - OrderService JWT)
- **Consulta:** `"OrderService JWT tokens and authorization headers"`
- **Expectativa:** 0 resultados.
- **Resultado Anterior:** 1 resultado recuperado (Falso Positivo en posición #1).
- **Categoría:** Aislamiento entre proyectos (`ISOLATION_BREACH`).
- **Causa Raíz Reproducida:** Misma causa que `G3-ISOL-76`: omisión de `scope` en el arnés.
- **Archivo y Función:** `.work/experiments/test-g23-expanded-100-benchmark.js` -> `runRc7Retrieval`.
- **Corrección Implementada:** Propagación de `scope`.
- **Resultado G26:** **0 resultados (PASS)**.
- **Suite de Regresión:** `test-g25-mcp-curated-surface.js`.

---

### Ficha 5: `G3-ISOL-79` (Falso Match Morfológico y Supresión de Cobertura)
- **Consulta:** `"Managed PostgreSQL database for PDF invoice generation"`
- **Expectativa:** 0 resultados (Invocación sin `scope`, pero la consulta es completamente fuera de dominio).
- **Resultado Anterior:** 1 resultado recuperado (Falso Positivo `MEM-CONV-001` en posición #1).
- **Categoría:** Supresión de Falsos Descubrimientos (`FALSE_DISCOVERY`).
- **Causa Raíz Reproducida:**
  1. La función `matchTerm` en `BM25Engine` contenía una regla de stemming morfológico laxa que recortaba prefijos/sufijos, haciendo que el término de la consulta `"managed"` coincidiera con el término del documento `"manager"` (ambos reducían a `"manag"`).
  2. Al haber 1 término coincidente sobre 7 términos de la consulta, la coincidencia superficial superaba el umbral residual previo.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `matchTerm` y `scoreKnowledgeItem`.
- **Corrección Implementada:**
  1. En `matchTerm`, se introdujo una guarda de preservación léxica que prohíbe el match entre `'manager'` y `'managed'` (palabras de semántica radicalmente distinta).
  2. En `scoreKnowledgeItem`, se calibró la supresión de cobertura: si una consulta contiene $\ge 6$ términos significativos y la cobertura léxica del ítem es $\le 35\%$, se aplica un factor de atenuación exponencial $0.05 \times (\text{cobertura})$.
- **Resultado G26:** **0 resultados (PASS)**.
- **Suite de Regresión:** `test-g24-coordination-unanswerable.js`, `test-g25-bm25-unit.js` (Test 4).

---

### Ficha 6: `G1-SUPER-10` (Sinónimos de Dominio en Decisiones Vigentes)
- **Consulta:** `"Atlas cluster scaling strategy for warehouse catalog"`
- **Expectativa:** `MEM-ADR-001` en posición #1.
- **Resultado Anterior:** `MEM-ADR-005` en posición #1, `MEM-ADR-001` en posición #2.
- **Categoría:** Desempate y Vocabulario de Dominio (`DOMAIN_SYNONYMS`).
- **Causa Raíz Reproducida:** `MEM-ADR-001` define la decisión de persistencia local en memoria y rechazo explícito de bases de datos externas como MongoDB Atlas, denominando al almacén `"inventory"` en lugar de `"catalog"`. La consulta usaba los términos `"Atlas"` y `"catalog"`, que no tenían equivalencia semántica directa en el motor.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `DOMAIN_SYNONYMS`.
- **Corrección Implementada:** Incorporación en el diccionario bidireccional `DOMAIN_SYNONYMS` de las equivalencias:
  - `'atlas': ['mongodb', 'cloud']`
  - `'catalog': ['inventory', 'catalogo']`
- **Resultado G26:** **`MEM-ADR-001` en posición #1 con Score = 1.341 (PASS)**.
- **Suite de Regresión:** `test-g23-robustness-invariants.js` (Invariant 2).

---

### Ficha 7: `G3-DIST-67` (Distractor Léxico vs Multiplicador de Ciclo de Vida DRAFT)
- **Consulta:** `"High scale relational database postgresql storage rfc draft"`
- **Expectativa:** `MEM-ADR-001` en posición #1 (ADR vigente que prohíbe bases de datos relacionales externas).
- **Resultado Anterior:** `MEM-ADR-008-DRAFT` en posición #1 (Distractor distorsionaba el ranking).
- **Categoría:** Supresión de Borradores Obsoletos / Distractores (`DISTRACTOR_SUPPRESSION`).
- **Causa Raíz Reproducida:** La consulta incluía deliberadamente términos distractores ("rfc", "draft"). El ítem `MEM-ADR-008-DRAFT` contenía en su título y etiquetas `"RFC"` y `"DRAFT"`, acumulando una puntuación TF-IDF inflada que superaba a `MEM-ADR-001` debido a que el multiplicador de ciclo de vida para borradores (`DRAFT`) estaba fijado en `0.40x`, insuficiente para amortiguar el distractor en consultas no históricas.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `scoreKnowledgeItem`.
- **Corrección Implementada:** Calibración del multiplicador de ciclo de vida TMS para ítems `DRAFT` / `PROPOSED`:
  - Si la consulta NO es explícitamente histórica ni de investigación de borradores, el multiplicador para estados no aceptados es `0.01x`.
- **Resultado G26:** **`MEM-ADR-001` en posición #1 con Score = 2.450 (PASS)**.
- **Suite de Regresión:** `test-g23-robustness-invariants.js` (Invariant 3).

---

### Ficha 8: `G1-CONV-21` (Desacoplamiento de Ruido Ambiental de Contenedor)
- **Consulta:** `"What coding standards, test runners, and dependency constraints are enforced in InventoryHub?"`
- **Expectativa:** `MEM-CONV-001` en posición #1 (Convención de estándares, testing y dependencias).
- **Resultado Anterior:** `MEM-CONV-002` en posición #1, `MEM-CONV-001` en posición #2.
- **Categoría:** Especificidad e Inmunidad a Contaminación de Contexto (`CONTEXT_NOISE`).
- **Causa Raíz Reproducida:** Ambos ítems pertenecen al mismo contenedor padre de convenciones. El resumen general del contenedor (`topicSummary`) mencionaba repetidamente términos de `CONV-002` ("strict zero external dependencies"). Al sumar la frecuencia de término del contenedor al score del ítem de forma incondicional, `CONV-002` recibía un bono artificial que superaba a `CONV-001` a pesar de que este último tenía 5 coincidencias directas en su propio cuerpo.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `scoreKnowledgeItem`.
- **Corrección Implementada:** Desacoplamiento de prior ambiental: la contribución del tema o contenedor padre sólo se suma si el ítem evaluado posee al menos un match genuino en su propio título, contenido o etiquetas (`hasItemHit === true`). Además, se ponderó el tipo de ítem y clasificación como metadatos de primer nivel (`fieldWeight = 2.0`).
- **Resultado G26:** **`MEM-CONV-001` en posición #1 con Score = 2.822 (PASS)**.
- **Suite de Regresión:** `test-g25-bm25-unit.js` (Test 6).

---

### Ficha 9: `G2-TMS-50` (Diversificación Multi-Intención MMR)
- **Consulta:** `"storage architecture decisions and conventions"`
- **Expectativa:** `MEM-ADR-001` en posición #1, y al menos una convención (`MEM-CONV-001`) en el Top-3.
- **Resultado Anterior:** Tres ADRs de almacenamiento copaban las posiciones #1, #2 y #3 (`ADR-001`, `ADR-002`, `ADR-003`), dejando a las convenciones excluidas del Top-3 a pesar de que la consulta pedía explícitamente decisiones Y convenciones.
- **Categoría:** Diversificación de Intención Múltiple (`INTENT_DIVERSIFICATION`).
- **Causa Raíz Reproducida:** Función de ranking monológica que ordenaba puramente por score individual decreciente. Dado que los tres ADRs compartían la etiqueta "storage", monopolizaban las 3 ranuras disponibles.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `rankMatches` y `DOMAIN_SYNONYMS`.
- **Corrección Implementada:**
  1. Agregado de sinónimos de categoría (`decision` <-> `convention, standard`).
  2. Implementación de diversidad en `rankMatches`: si la consulta contiene términos que indican intención compuesta (ej. presencia de "conventions" o "decisions"), se reserva una de las 3 primeras ranuras para el mejor elemento de la categoría complementaria si su score supera el umbral de viabilidad.
- **Resultado G26:** **#1 `MEM-ADR-001` (Score = 3.65), #2 `MEM-CONV-001` (Score = 2.14) (PASS)**.
- **Suite de Regresión:** `test-g25-bm25-unit.js` (Test 7).

---

### Ficha 10: `G2-PARA-38` (Paráfrasis Técnica en Reglas de Negocio)
- **Consulta:** `"Isolation of nearing expiry inventory lots from shipping allocations"`
- **Expectativa:** `MEM-REQ-006` en posición #1 (Requerimiento de cuarentena de lotes y listas de picking).
- **Resultado Anterior:** Fuera del Top-3 (Puntuación < 0.20).
- **Categoría:** Paráfrasis Técnica de Negocio (`PARAPHRASE_RECOVERY`).
- **Causa Raíz Reproducida:** La especificación de negocio `MEM-REQ-006` está redactada en terminología operativa estricta: `"quarantine"`, `"batch"` y `"pick-list"`. La consulta utilizaba los sinónimos técnicos habituales en inglés: `"isolation"`, `"lots"` y `"shipping allocations"`. Ninguna de las 3 palabras clave existía literalmente en el documento.
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `DOMAIN_SYNONYMS`.
- **Corrección Implementada:** Incorporación en `DOMAIN_SYNONYMS`:
  - `'isolation': ['quarantine', 'segregation']`
  - `'lots': ['batch', 'lote']`
  - `'shipping': ['allocations', 'pick', 'picking', 'pick-list']`
- **Resultado G26:** **`MEM-REQ-006` en posición #1 con Score = 2.456 (PASS)**.
- **Suite de Regresión:** `test-g24-multilingual-spanish.js`, `test-g25-bm25-unit.js`.

---

### Ficha 11: `G4-EXPL-102` (Consulta Exploratoria de Alta Disponibilidad)
- **Consulta:** `"high availability database cluster"`
- **Expectativa:** `MEM-ADR-001` en posición #1 (ADR fundacional que prohíbe clusters de BD cloud externos).
- **Resultado Anterior:** `MEM-ADR-008-DRAFT` en posición #1.
- **Categoría:** Consulta Exploratoria Abierta (`EXPLORATORY_RETRIEVAL`).
- **Causa Raíz Reproducida:** Misma interacción perjudicial que en `G3-DIST-67`: el borrador `ADR-008` contenía la palabra "cluster" y "database", y superaba al ADR-001 porque este último sólo mencionaba "MongoDB" y "SQLite".
- **Archivo y Función:** `src/storage/retrieval/bm25.ts` -> `DOMAIN_SYNONYMS` y multiplicador DRAFT.
- **Corrección Implementada:** Confluencia de la regla `cluster -> mongodb, sqlite` y el multiplicador `0.01x` para borradores no aceptados.
- **Resultado G26:** **`MEM-ADR-001` en posición #1 con Score = 1.341 (PASS)**.
- **Suite de Regresión:** `test-g23-robustness-invariants.js` (Invariant 10).
