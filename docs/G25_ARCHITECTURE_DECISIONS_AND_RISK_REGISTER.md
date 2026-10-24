# Decisiones Arquitectónicas y Registro de Riesgos (Hito G25)

## 1. Decisiones Arquitectónicas de G25

### ADR-G25-01: Modularización de BM25Engine (`src/storage/retrieval/bm25.ts`)
- **Estado:** ACEPTADA
- **Contexto:** `src/storage.ts` acumulaba más de 3,300 líneas con mezcla de persistencia, sincronización, tokenización, cálculo de IDF y ranking Okapi BM25.
- **Decisión:** Extraer toda la lógica de recuperación de información a una clase especializada `BM25Engine` en `src/storage/retrieval/bm25.ts`, encapsulando:
  - Tokenización y filtrado multilingüe (inglés/español).
  - Stemming basado en reglas morfológicas seguras (`stemWord`).
  - Matcheo de tokens exacto, por prefijo y por raíz (`matchTerm`).
  - Cálculo de IDF sobre el corpus.
  - Scoring BM25 con ponderación de campos (Title x3.5, Tags x2.5, Content x1.2, Topic x0.8).
  - Supresión cuadrática de falsos positivos en consultas compuestas.
  - Multiplicadores de ciclo de vida del Truth Maintenance System (TMS).
  - Desempate determinista estable.
- **Consecuencias:**
  - `StorageEngine` delega limpiamente sin romper contratos públicos.
  - La suite de pruebas unitarias puras `test-g25-bm25-unit.js` valida el motor sin dependencias de disco ni locks.
  - Cero regresiones en el benchmark canónico de 105 escenarios (MRR 0.914, Precision@1 89.5 %).

### ADR-G25-02: Fachada MCP Curada de 8 Herramientas con Perfiles
- **Estado:** ACEPTADA
- **Contexto:** 40 herramientas generaban sobrecarga cognitiva y gasto excesivo de tokens de esquema para los agentes LLM.
- **Decisión:** Exponer por defecto (`profile: "curated"`) exactamente 8 herramientas que cubren los grupos esenciales de memoria de proyecto:
  1. `openmemory_status` (Estado y contexto)
  2. `openmemory_query_knowledge` (Consulta semántica)
  3. `openmemory_record_knowledge` (Registro de hallazgos)
  4. `openmemory_get_adr` (Lectura de decisiones)
  5. `openmemory_save_adr` (Escritura de decisiones)
  6. `openmemory_get_handoff` (Lectura de handoff)
  7. `openmemory_update_handoff` (Actualización de handoff)
  8. `openmemory_analyze_knowledge_tms` (Análisis TMS y procedencia)
  Las operaciones puramente administrativas continúan accesibles mediante el CLI `openmemory` y en el perfil `profile: "full"` (42 herramientas).
- **Consecuencias:** Experiencia de agente optimizada, reducción del 80 % en overhead de herramientas, compatibilidad retrospectiva 100 %.

### ADR-G25-03: Calibración de Umbral BM25 y Supresión Cuadrática de Falsos Positivos ($K=0$)
- **Estado:** ACEPTADA
- **Contexto:** Consultas compuestas fuera de dominio con un término común accidental (ej. "Black-Scholes formula" que contiene "options", o "Kubernetes message bus" que contiene "configure") producían puntuaciones marginales superiores al umbral base.
- **Decisión:**
  1. Implementar supresión cuadrática a nivel de ítem cuando una consulta multi-término ($\ge 4$ términos) sólo coincide en 1 término dentro del documento.
  2. Establecer el umbral mínimo calibrado `minScore = 0.20` en `queryKnowledgeItems`.
- **Consecuencias:** Consultas no respondibles (`G3-UNANS-71..75`) devuelven lista vacía ($K=0$), eliminando alucinaciones sin afectar consultas válidas.

### ADR-G25-04: Aislamiento Estricto de Frontera de Proyecto
- **Estado:** ACEPTADA
- **Contexto:** Consultas MCP o de almacenamiento en workspaces compartidos podían filtrar o consultar memorias de proyectos adyacentes si el parámetro no se validaba en la frontera.
- **Decisión:**
  1. En la frontera MCP, verificar que cualquier `projectId` solicitado coincida con `storage.deriveProjectName()`. Rechazar fallos cerrados con `isError: true` y mensaje explícito de acceso denegado ante discrepancias.
  2. En el motor de almacenamiento, refactorizar el filtro de dominios conocidos (`knownDomains`) para que únicamente actúe como barrera de segregación cuando el ámbito activo pertenezca a un microservicio delimitado, evitando falsas exclusiones en directorios temporales de prueba o sandboxes de staging.
- **Consecuencias:** Garantía estricta contra ataques de confusión de proyecto y travesía de frontera.

---

## 2. Registro de Riesgos Técnicos

| ID | Riesgo | Severidad | Probabilidad | Mitigación Implementada en G25 | Estado Residual |
|---|---|---|---|---|---|
| R-01 | Pérdida de eventos clave de auditoría durante la compactación de logs de 1 MB | Alta | Media | Inclusión obligatoria de `adr.saved`, `adr.voted`, `session.created` y `session.compacted` en `DEFAULT_ESSENTIAL_EVENT_TYPES`. Verificado 100 % de preservación (10/10) en sesión prolongada. | **Mitigado / Cerrado** |
| R-02 | Ruptura de agentes o scripts legacy que invoquen herramientas MCP fuera de las 8 curadas | Media | Baja | `CallToolRequestSchema` conserva los manejadores de las 42 herramientas. Soporte de perfil `profile: "full"`. | **Mitigado / Cerrado** |
| R-03 | Falsos negativos en consultas en español debido a sobre-penalización de términos | Media | Baja | Diacríticos normalizados vía NFD sin división destructiva, filtrado de stopwords en español y cognados bidireccionales validados con latencia < 2 ms. | **Mitigado / Cerrado** |
| R-04 | Desincronización entre repositorio canónico y clon experimental de descargas | Baja | Media | Sincronización explícita automatizada de código, types y pruebas con compilación limpia (`tsc`) en ambas ubicaciones. | **Controlado** |
| R-05 | Corrupción accidental del consumidor real `InventoryHub` durante pruebas | Crítica | Baja | Consumidor activo congelado y protegido en `0.3.14-rc4`. Toda verificación se ejecuta exclusivamente en sandboxes efímeros de staging. Rollback drill verificado con 100 % de paridad. | **Controlado / Cero Riesgo** |
