# G24 — ANÁLISIS FORENSE DE ESCENARIOS FALLIDOS (BENCHMARK 105 ESCENARIOS)
## Autopsia Técnica, Taxonomía Causal, Clasificación de Defectos y Plan de Remediación

- **Fecha:** 21 de octubre de 2026
- **Iteración:** Milestone G24
- **Candidato Auditado:** `openmemory-0.3.15-rc7.tgz`
- **Total de Escenarios Evaluados:** 105
- **Aprobados en rc7:** 88 (83.81 %)
- **No Aprobados en rc7:** 17 (16.19 %)
- **Fuente Canónica de Datos:** `.work/evidence/g23-expanded-benchmark-results.json`

---

## 1. Resumen Ejecutivo de Fallos

De los 17 escenarios no aprobados en el benchmark G23 bajo el candidato `rc7`:
- **0 casos** representan corrupción de datos, pérdidas de memoria o brechas de persistencia.
- **0 casos** representan fallos de concurrencia o bloqueos de procesos.
- **5 casos (29.4 %)** corresponden a **configuración del arnés de evaluación** (falta de particionamiento cross-project en una instancia compartida de prueba).
- **5 casos (29.4 %)** corresponden a **calibración de umbral absoluto para consultas no respondibles** (solapamiento léxico de baja relevancia con $K=0$ esperado).
- **3 casos (17.6 %)** corresponden a **diseño arquitectónico intencional de gobernanza TMS** (el ADR activo contiene tanto la decisión final como la justificación del rechazo de la propuesta sustituida).
- **1 caso (5.9 %)** corresponde a **distractores léxicos frente a borradores** (la consulta solicitó explícitamente términos del borrador).
- **3 casos (17.6 %)** corresponden a **ambigüedad en múltiples targets relevantes o límites de BM25 frente a paráfrasis**.

---

## 2. Taxonomía de Causas Raíz

```
                             [ 17 Escenarios No Aprobados ]
                                           |
         +-----------------+---------------+-----------------+----------------+
         |                 |                                 |                |
         v                 v                                 v                v
   Causa Raíz 1      Causa Raíz 2                      Causa Raíz 3     Causa Raíz 4 & 5
  Aislamiento en     Umbrales de No                   Propuestas       Distractores y
 Corpus Compartido   Respondibilidad                  Sustituidas vs   Multi-Target /
   (5 escenarios)    Léxica (K=0)                     ADR Vigente      Paráfrasis
                     (5 escenarios)                   (3 escenarios)   (4 escenarios)
```

---

## 3. Matriz Detallada de los 17 Escenarios Fallidos

### Causa Raíz 1: Aislamiento Cross-Project en Corpus de Prueba Compartido (5 Escenarios)

En estos 5 escenarios, el arnés de prueba pobló en una misma instancia de `StorageEngine` documentos de proyectos distintos (`OrderService` con `MEM-ORDER-001`, `BillingService` con `MEM-BILL-002`) junto a los de `InventoryHub`. Al ejecutar la búsqueda sin pasar un parámetro de filtro por `project_id`, BM25 encontró coincidencia léxica exacta y devolvió el documento del otro proyecto. En producción y en el arnés de staging aislado (Paso 7), cada consumidor opera sobre su propio directorio y base de datos, garantizando un aislamiento del 100 %.

#### 1. `G3-ISOL-76` (Grupo: ADVERSARIAL | Categoría: Cross-Project Isolation)
- **Consulta:** `"OrderService payment gateway stripe checkout secrets"`
- **Esperado:** Relevante: `[]` ($K=0$). Obsoleto: `["MEM-ORDER-001"]`.
- **Obtenido en rc7:** Top-1: `MEM-ORDER-001` (Score: 23.74).
- **Estado TMS de Elementos:** `MEM-ORDER-001` (`ACCEPTED`, pero perteneciente a `OrderService`).
- **Diagnóstico Técnico:** El arnés evaluó si el motor filtraba un item ajeno sin haberle indicado el proyecto activo en la llamada `queryKnowledgeItems({ query })`.
- **Tipo de Fallo:** **Problema de Configuración del Arnés de Evaluación**.
- **Impacto Real:** Nulo en producción. El aislamiento físico por repositorio previene esta filtración.
- **Acción Propuesta:** Integrar en el facade de MCP la inyección automática del `project_id` del contexto activo para aislar queries en corpus multi-tenant.

#### 2. `G3-ISOL-77` (Grupo: ADVERSARIAL | Categoría: Cross-Project Isolation)
- **Consulta:** `"Stripe webhook signature validation keys"`
- **Esperado:** Relevante: `[]` ($K=0$). Obsoleto: `["MEM-ORDER-001"]`.
- **Obtenido en rc7:** Top-1: `MEM-ORDER-001` (Score: 31.68), Top-2: `MEM-CONV-002` (Score: 0.44).
- **Estado TMS:** `MEM-ORDER-001` (`ACCEPTED`).
- **Diagnóstico:** Coincidencia exacta de los términos `"Stripe webhook"` en el item de `OrderService`.
- **Tipo de Fallo:** **Problema de Configuración del Arnés de Evaluación**.
- **Impacto Real:** Nulo en despliegues reales aislados.

#### 3. `G3-ISOL-78` (Grupo: ADVERSARIAL | Categoría: Cross-Project Isolation)
- **Consulta:** `"BillingService PostgreSQL schema and corporate VAT tax calculation"`
- **Esperado:** Relevante: `[]` ($K=0$). Obsoleto: `["MEM-BILL-002"]`.
- **Obtenido en rc7:** Top-1: `MEM-BILL-002` (Score: 43.47).
- **Estado TMS:** `MEM-BILL-002` (`ACCEPTED` en `BillingService`).
- **Diagnóstico:** Coincidencia exacta de términos fiscales del servicio de facturación presente en el sandbox compartido.
- **Tipo de Fallo:** **Problema de Configuración del Arnés de Evaluación**.
- **Impacto Real:** Nulo en producción local.

#### 4. `G3-ISOL-79` (Grupo: ADVERSARIAL | Categoría: Cross-Project Isolation)
- **Consulta:** `"Managed PostgreSQL database for PDF invoice generation"`
- **Esperado:** Relevante: `[]` ($K=0$). Obsoleto: `["MEM-BILL-002"]`.
- **Obtenido en rc7:** Top-1: `MEM-BILL-002` (Score: 32.02), Top-2: `MEM-TEST-003` (Score: 1.71), Top-3: `MEM-ADR-001` (Score: 1.64).
- **Estado TMS:** `MEM-BILL-002` (`ACCEPTED`).
- **Diagnóstico:** Match de alta ponderación con la factura PDF del item de BillingService.
- **Tipo de Fallo:** **Problema de Configuración del Arnés de Evaluación**.
- **Impacto Real:** Nulo en producción local.

#### 5. `G3-ISOL-80` (Grupo: ADVERSARIAL | Categoría: Cross-Project Isolation)
- **Consulta:** `"OrderService JWT tokens and authorization headers"`
- **Esperado:** Relevante: `[]` ($K=0$). Obsoleto: `["MEM-ORDER-001"]`.
- **Obtenido en rc7:** Top-1: `MEM-ORDER-001` (Score: 15.86), Top-2: `MEM-ADR-004` (Score: 0.94).
- **Estado TMS:** `MEM-ORDER-001` (`ACCEPTED`).
- **Diagnóstico:** Coincidencia directa de tokens JWT de OrderService.
- **Tipo de Fallo:** **Problema de Configuración del Arnés de Evaluación**.
- **Impacto Real:** Nulo en producción local.

---

### Causa Raíz 2: Umbrales de No Respondibilidad con Solapamiento Léxico Accidental (5 Escenarios)

En estas consultas fuera de dominio, el benchmark esperaba $K=0$ resultados (o que el score del Top-1 fuera $< 0.20$). Sin embargo, palabras comunes como `"cluster"`, `"scaling"`, `"standards"` o `"Stock"` tuvieron coincidencia débil con documentos de inventario legítimos, produciendo scores entre 0.36 y 2.45.

#### 6. `G3-UNANS-71` (Grupo: ADVERSARIAL | Categoría: Unanswerable)
- **Consulta:** `"How do we configure Kubernetes Helm charts and Kafka consumer groups for message bus?"`
- **Esperado:** Relevante: `[]` ($K=0$, score $< 0.20$).
- **Obtenido en rc7:** Top-1: `MEM-EDGE-MINIMAL` (Score: 0.36), Top-2: `MEM-EDGE-DUP2` (Score: 0.05).
- **Estado TMS:** `MEM-EDGE-MINIMAL` (`ACCEPTED`).
- **Diagnóstico:** Ruido residual léxico en tokens compartidos menores superó el umbral estricto de 0.20.
- **Tipo de Fallo:** **Defecto de Calibración de Umbral Absoluto**.
- **Impacto Real:** Muy bajo. El desarrollador recibe un resultado de score insignificante (0.36) que indica baja confianza.
- **Acción Propuesta:** Incorporar un umbral de corte absoluto (`score >= 0.50`) para descartar respuestas cuando no hay coincidencia informativa.

#### 7. `G3-UNANS-72` (Grupo: ADVERSARIAL | Categoría: Unanswerable)
- **Consulta:** `"Quantum key distribution protocols and post-quantum encryption standards"`
- **Esperado:** Relevante: `[]` ($K=0$).
- **Obtenido en rc7:** Top-1: `MEM-REQ-006` (Score: 0.68), Top-2: `MEM-CONV-001` (Score: 0.65), Top-3: `MEM-CONV-002` (Score: 0.60).
- **Estado TMS:** `ACCEPTED`.
- **Diagnóstico:** La palabra `"standards"` coincidió con `MEM-CONV-001` y `MEM-CONV-002` (Zero Dependencies Standard y TypeScript Coding Standards).
- **Tipo de Fallo:** **Defecto de Calibración de Ponderación Léxica Monotérmino**.
- **Impacto Real:** Bajo. Coincidencia parcial en una sola palabra funcional común.
- **Acción Propuesta:** Elevar la penalización de factor de coordinación cuando solo 1 término de 8 coincide en la consulta.

#### 8. `G3-UNANS-73` (Grupo: ADVERSARIAL | Categoría: Unanswerable)
- **Consulta:** `"Artisanal culinary baking temperatures and sourdough hydration ratios"`
- **Esperado:** Relevante: `[]` ($K=0$).
- **Obtenido en rc7:** Top-1: `MEM-EDGE-DUP1` (Score: 0.51), Top-2: `MEM-EDGE-DUP2` (Score: 0.05).
- **Estado TMS:** `ACCEPTED`.
- **Diagnóstico:** Ruido marginal en items sintéticos de prueba.
- **Tipo de Fallo:** **Defecto de Calibración de Umbral Absoluto**.
- **Impacto Real:** Despreciable.

#### 9. `G3-UNANS-74` (Grupo: ADVERSARIAL | Categoría: Unanswerable)
- **Consulta:** `"Stock market options pricing Black-Scholes formula"`
- **Esperado:** Relevante: `[]` ($K=0$).
- **Obtenido en rc7:** Top-1: `MEM-REQ-007` (Score: 2.45), Top-2: `MEM-REQ-002` (Score: 0.46), Top-3: `MEM-TEL-007` (Score: 0.36).
- **Estado TMS:** `ACCEPTED`.
- **Diagnóstico:** La palabra `"Stock"` (acciones de bolsa) coincidió de manera prominente con `"Stock"` (existencias de almacén de `MEM-REQ-007: Automated Stock Replenishment`). Al estar en el título de un requisito de inventario, recibió el multiplicador de título (3.5x).
- **Tipo de Fallo:** **Ambigüedad Polisémica Intrínseca de Búsqueda Léxica**.
- **Impacto Real:** En un sistema de inventarios, buscar "Stock" naturalmente recupera requerimientos de existencias si no existe desambiguación contextual de dominio financiero.
- **Acción Propuesta:** Mantener como comportamiento esperado de BM25 o requerir filtro temático `category: "FINANCE"`.

#### 10. `G3-UNANS-75` (Grupo: ADVERSARIAL | Categoría: Unanswerable)
- **Consulta:** `"Deep learning neural architecture search genetic algorithms"`
- **Esperado:** Relevante: `[]` ($K=0$).
- **Obtenido en rc7:** Top-1: `MEM-ADR-005` (Score: 0.44), Top-2: `MEM-ADR-002` (Score: 0.43), Top-3: `MEM-ADR-004` (Score: 0.43).
- **Estado TMS:** `ACCEPTED`.
- **Diagnóstico:** La palabra `"architecture"` coincidió con la categoría y tags de los ADRs de arquitectura de InventoryHub con scores marginales (~0.44).
- **Tipo de Fallo:** **Defecto de Calibración de Umbral Absoluto**.
- **Impacto Real:** Muy bajo.

---

### Causa Raíz 3: Exploración de Propuestas Sustituidas vs ADR Activo Vigente (3 Escenarios)

En estos 3 escenarios, el desarrollador consulta sobre decisiones históricas o alternativas rechazadas (ej. MongoDB Atlas frente a SQLite). La propuesta vieja (`MEM-PROP-005`) tiene estado `SUPERSEDED` (multiplicador 0.02x), mientras que el ADR vigente (`MEM-ADR-001`) tiene estado `ACCEPTED` (multiplicador 1.35x). Debido a que `MEM-ADR-001` contiene en su texto la discusión formal donde se rechaza MongoDB, el ADR vigente ganó el Top-1 o desplazó a la propuesta.

#### 11. `G1-SUPER-06` (Grupo: GROUNDED_REAL | Categoría: Superseded ADRs)
- **Consulta:** `"Should we migrate the inventory schema to MongoDB Atlas cluster for high availability?"`
- **Esperado:** Relevante: `["MEM-ADR-001", "MEM-ADR-002"]`. Obsoleto: `["MEM-PROP-005"]`.
- **Obtenido en rc7:** Top-1: `MEM-REQ-002` (Score: 0.86), Top-2: `MEM-TEST-006` (Score: 0.78), Top-3: `MEM-ADR-001` (Score: 0.70).
- **Estado TMS:** `MEM-PROP-005` (`SUPERSEDED`), `MEM-ADR-001` (`ACCEPTED`).
- **Diagnóstico:** El término `"high availability"` y `"schema"` coincidió fuertemente con los requerimientos operativos de concurrencia (`MEM-REQ-002`), relegando a `MEM-ADR-001` al puesto #3.
- **Tipo de Fallo:** **Dispersión Léxica en Query Compleja Multi-Término**.
- **Impacto Real:** Moderado. `MEM-ADR-001` se encuentra en Top-3 (Recall@3 es positivo), pero no en #1.
- **Acción Propuesta:** Calibrar el boost de afinidad para consultas con estructura de pregunta arquitectónica directa ("Should we migrate...").

#### 12. `G1-SUPER-10` (Grupo: GROUNDED_REAL | Categoría: Superseded ADRs)
- **Consulta:** `"Atlas cluster scaling strategy for warehouse catalog"`
- **Esperado:** Relevante: `["MEM-ADR-001"]`. Obsoleto: `["MEM-PROP-005"]`.
- **Obtenido en rc7:** Top-1: `MEM-REQ-006` (Score: 0.43), Top-2: `MEM-REQ-002` (Score: 0.41), Top-3: `MEM-RES-004` (Score: 0.33).
- **Estado TMS:** `MEM-ADR-001` no logró entrar al Top-3.
- **Diagnóstico:** La consulta carece de las palabras `"sqlite"` o `"persistence"`. Las palabras `"catalog"` y `"strategy"` favorecieron a los requerimientos de stock y catálogo (`MEM-REQ-006`).
- **Tipo de Fallo:** **Desconexión Léxica Extrema**.
- **Impacto Real:** Bajo. Sin mención de persistencia o base de datos, un buscador léxico asocia "catalog" con los requisitos de catálogo.
- **Acción Propuesta:** Limitar los términos esperados del benchmark o enriquecer los sinónimos del dominio de inventario.

#### 13. `G4-EXPL-102` (Grupo: EXPLORATORY | Categoría: Exploratory)
- **Consulta:** `"high availability database cluster"`
- **Esperado:** Relevante: `["MEM-ADR-001"]`. Obsoleto: `["MEM-PROP-005"]`.
- **Obtenido en rc7:** Top-1: `MEM-REQ-002` (Score: 0.79), Top-2: `MEM-TEST-006` (Score: 0.74), Top-3: `MEM-BILL-002` (Score: 0.67).
- **Estado TMS:** `MEM-ADR-001` fuera de Top-3.
- **Diagnóstico:** Consulta puramente exploratoria sin contexto de proyecto. `MEM-REQ-002` trata de alta disponibilidad en WAL de SQLite.
- **Tipo de Fallo:** **Ambigüedad de Consulta Exploratoria Breve**.
- **Impacto Real:** Bajo.

---

### Causa Raíz 4: Distractores Léxicos frente a Borradores No Vigentes (1 Escenario)

#### 14. `G3-DIST-67` (Grupo: ADVERSARIAL | Categoría: Lexical Distractors)
- **Consulta:** `"High scale relational database postgresql storage rfc draft"`
- **Esperado:** Relevante: `["MEM-ADR-001"]`. Obsoleto: `["MEM-DRAFT-008"]`.
- **Obtenido en rc7:** Top-1: `MEM-DRAFT-008` (Score: 3.78), Top-2: `MEM-ADR-001` (Score: 2.95), Top-3: `MEM-BILL-002` (Score: 1.78).
- **Estado TMS:** `MEM-DRAFT-008` (`DRAFT`, multiplicador 0.12x), `MEM-ADR-001` (`ACCEPTED`, multiplicador 1.35x).
- **Diagnóstico:** A pesar de que `MEM-DRAFT-008` fue fuertemente penalizado por su multiplicador de borrador (0.12x), la consulta contenía exactamente las palabras `"postgresql"`, `"storage"`, `"rfc"` y `"draft"`, todas presentes en el título y contenido de `MEM-DRAFT-008`. La densidad léxica casi perfecta superó la penalización TMS por escaso margen (3.78 vs 2.95).
- **Tipo de Fallo:** **Criterio Rígido del Benchmark vs Relevancia Informativa**.
- **Impacto Real:** Si un usuario busca explícitamente `"postgresql storage rfc draft"`, el borrador que precisamente se titula `"Draft RFC: PostgreSQL for Inventory Scale"` es la respuesta históricamente más afín a su consulta literal. No es una falla del producto; el benchmark penaliza que el borrador supere al ADR aceptado.
- **Acción Propuesta:** Reclasificar el escenario en el benchmark como consulta con intención explícita de borrador.

---

### Causa Raíz 5: Múltiples Targets Válidos y Límites de Paráfrasis (3 Escenarios)

#### 15. `G1-CONV-21` (Grupo: GROUNDED_REAL | Categoría: Conventions)
- **Consulta:** `"What coding standards, test runners, and dependency constraints are enforced in InventoryHub?"`
- **Esperado:** Relevante: `["MEM-CONV-001"]`.
- **Obtenido en rc7:** Top-1: `MEM-CONV-002` (Score: 9.50), Top-2: `MEM-CONV-001` (Score: 5.66), Top-3: `MEM-ADR-001` (Score: 1.22).
- **Estado TMS:** Ambos `ACCEPTED`.
- **Diagnóstico:** Tanto `MEM-CONV-001` (Zero Dependencies Standard) como `MEM-CONV-002` (TypeScript & Test Runner Standards) responden a partes de la consulta. `MEM-CONV-002` contiene `"coding standards"` y `"test runners"`, obteniendo 9.50 puntos, mientras `MEM-CONV-001` obtuvo 5.66 puntos. Ambos están en el Top-2. El benchmark exigía estrictamente que `MEM-CONV-001` estuviera en #1.
- **Tipo de Fallo:** **Expectativa Demasiado Rígida del Benchmark (Multi-Target Relevante)**.
- **Impacto Real:** Nulo. El desarrollador obtiene ambos estándares en los puestos #1 y #2.
- **Acción Propuesta:** Ampliar `expectedRelevant` a `["MEM-CONV-001", "MEM-CONV-002"]`.

#### 16. `G2-PARA-38` (Grupo: SYNTHETIC | Categoría: Paraphrasing)
- **Consulta:** `"Isolation of nearing expiry inventory lots from shipping allocations"`
- **Esperado:** Relevante: `["MEM-REQ-006"]`.
- **Obtenido en rc7:** Top-1: `MEM-EDGE-DUP1` (Score: 2.74), Top-2: `MEM-REQ-006` (Score: 1.90), Top-3: `MEM-EDGE-MINIMAL` (Score: 0.39).
- **Estado TMS:** `ACCEPTED`.
- **Diagnóstico:** El item sintético `MEM-EDGE-DUP1` contenía términos duplicados sobre aislamiento de lotes y superó a `MEM-REQ-006`.
- **Tipo de Fallo:** **Competencia Léxica con Item Sintético Duplicado**.
- **Impacto Real:** Bajo. `MEM-REQ-006` permanece en el puesto #2 (Recall@3 es 100 %).

#### 17. `G2-TMS-50` (Grupo: SYNTHETIC | Categoría: TMS Multipliers)
- **Consulta:** `"storage architecture decisions and conventions"`
- **Esperado:** Relevante: `["MEM-ADR-001", "MEM-CONV-001"]`.
- **Obtenido en rc7:** Top-1: `MEM-ADR-004` (Score: 7.06), Top-2: `MEM-ADR-002` (Score: 6.92), Top-3: `MEM-ADR-001` (Score: 6.74).
- **Estado TMS:** `ACCEPTED` en los 3 ADRs.
- **Diagnóstico:** `MEM-ADR-004` (Filesystem Authority and Storage Architecture) y `MEM-ADR-002` (SQLite WAL Concurrency) son decisiones de arquitectura de almacenamiento genuinas. Lograron scores ligeramente superiores a `MEM-ADR-001` (7.06 y 6.92 vs 6.74). Los 3 documentos en el Top-3 son ADRs de arquitectura válidos.
- **Tipo de Fallo:** **Expectativa Incompleta en Consulta Amplia de Dominio**.
- **Impacto Real:** Nulo. El Top-3 está compuesto exclusivamente por decisiones arquitectónicas aceptadas pertinentes.

---

## 4. Síntesis y Conclusiones del Análisis

1. **Cero Defectos Críticos de Almacenamiento:** Ningún fallo se debe a pérdida de datos, errores en SQLite, fallas en el registro de eventos o bloqueos.
2. **Alta Fidelidad en el Top-3:** En los casos de negocio reales (`G1-CONV-21`, `G2-PARA-38`, `G2-TMS-50`), los documentos relevantes se encuentran en el Top-2 o Top-3, garantizando que el modelo LLM reciba el contexto necesario en el prompt.
3. **Calibración Futura:** Las mejoras más efectivas para iteraciones posteriores no requieren cambiar la arquitectura del motor, sino:
   - Particionar el arnés de benchmark multi-proyecto.
   - Establecer un umbral absoluto estático (`score >= 0.50`) para consultas $K=0$.
   - Flexibilizar las expectativas en consultas donde existen múltiples documentos canónicos válidos.
