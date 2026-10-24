# INFORME TÉCNICO DE INGENIERÍA — HITO G29
## Cierre del Ciclo de Vida del Conocimiento, Supersession Atómica y Calidad Epistémica de Evocara

- **Fecha:** 22 de octubre de 2026
- **Rol:** Arquitecto de Software Senior, Tech Lead y Responsable de Calidad
- **Línea Base Inicial:** Hito G28 (Artefacto `evocara-0.4.0.tgz` calificado, InventoryHub en staging 8/8 aprobado, consumidor activo protegido en `0.3.14-rc4`)
- **Estado Final del Hito G29:** **COMPLETADO AL 100 % CON EVIDENCIAS VERIFICABLES**
- **Resultado de Regresiones:** **Cero regresiones**. Benchmark Canónico: 105/105 aprobados (100.0 % P@1, MRR 1.000, 3.55 ms p50). Batería unitaria BM25, español, MCP curado y compatibilidad dual 100 % aprobadas.

---

## 1. Contexto, Diagnóstico y Selección del Bloque Estratégico

Al inicio de esta iteración, la auditoría del estado real en disco reveló:
1. **Línea de Release Validada (G28):** El candidato definitivo `evocara-0.4.0.tgz` (209,910 bytes, SHA-256: `70f31da...`), su SBOM CycloneDX 1.5 (`evocara-0.4.0.cdx.json`) y el staging de InventoryHub quedaron certificados sin mutaciones de código en producción local.
2. **Consumidor Activo Intacto:** `InventoryHub` permanece protegido en `0.3.14-rc4`, con 34/34 pruebas en vivo aprobadas, sin sufrir mutaciones ni ejecuciones de promoción no autorizadas.
3. **Selección del Bloque (Escenario B / Sección 5 del Prompt):** Dado que la release se encuentra estable y empaquetada, el esfuerzo se concentró verticalmente en la **Calidad del Conocimiento, Ciclo de Vida y Gobernanza Epistémica**.

### Brechas Funcionales Detectadas y Resueltas:
- **Brecha 1 (Supersession Incompleta):** La sustitución de una decisión arquitectónica requería hasta cuatro llamadas aisladas (crear nuevo ítem, crear relación `SUPERSEDES`, actualizar estado del ítem antiguo a `SUPERSEDED`, actualizar nuevo a `ACCEPTED`). Si una fallaba, el sistema quedaba en un estado inconsistente.
- **Brecha 2 (Contaminación de Obsoletos):** Al navegar o consultar por categoría/tema sin un término de búsqueda textual (`query` vacío), los ítems `SUPERSEDED` y `DEPRECATED` se retornaban con la misma prioridad que los vigentes.
- **Brecha 3 (Confusión Epistémica):** La interfaz MCP no permitía a los modelos de lenguaje distinguir visual ni semánticamente entre un **hecho empírico verificado** (con referencia a pruebas o benchmark) y una **hipótesis de trabajo** preliminar.
- **Brecha 4 (Pérdida de Procedencia en MCP):** Al invocar `openmemory_query_knowledge`, la salida formateada en Markdown omitía el `agentId`, `timestamp`, `evidenceReference` y `rationale` de evaluación.

---

## 2. Implementación Técnica Vertical (Arquitectura y Código)

### A. Tipado y Modelado (`src/storage/types.ts`)
- **`EpistemicStatus`:** Se definió la tipificación formal de estados epistemológicos:
  - `VERIFIED_FACT`: Hechos empíricos o decisiones aceptadas/validadas con `evidenceReference` mandatorio $\ge 3$ caracteres.
  - `WORKING_HYPOTHESIS`: Hipótesis en estado `CREATED` o de clasificación `HYPOTHESIS`.
  - `HISTORICAL_DECISION`: Memorias obsoletas en estado terminal `SUPERSEDED` o `DEPRECATED`.
  - `UNVALIDATED_OBSERVATION`: Observaciones y fuentes no verificadas.
- **`getEpistemicStatus(item: KnowledgeItem): EpistemicStatus`:** Función pura de evaluación determinista de estatus epistémico.
- **`SupersedeKnowledgeParams` y `SupersedeKnowledgeResult`:** Interfaces contractuales para la operación atómica de supersession.
- **`ResearchFilter.includeObsolete?: boolean`:** Parámetro explícito para controlar la visibilidad de ítems obsoletos.

### B. Motor de Almacenamiento y Gobernanza (`src/storage.ts`)
1. **`supersedeKnowledgeDecision(params: SupersedeKnowledgeParams): SupersedeKnowledgeResult`:**
   - Valida la sesión activa del llamador (`validateSessionOwnership`).
   - Requiere rol autorizado (`HUMAN_OPERATOR` o `LEAD_AGENT`).
   - Verifica la protección de estados terminales: si el ítem de destino ya está `SUPERSEDED` o `DEPRECATED`, la operación se rechaza inmediatamente para evitar ciclos y corrupción.
   - Valida la prevención de ciclos de supersession mediante `KnowledgeTMS.validateRelationCreation`.
   - Modifica atómicamente el ítem antiguo a `SUPERSEDED`, crea el nuevo ítem en estado `ACCEPTED`, genera la relación canónica `SUPERSEDES` con procedencia completa, persiste en disco bajo `withStateLock` y emite el evento estructurado `knowledge.decision_superseded`.
2. **Filtrado en `queryKnowledgeItems(filter?: ResearchFilter)`:**
   - Si `includeObsolete === false`, se descartan automáticamente todos los ítems `SUPERSEDED` y `DEPRECATED`.
   - En consultas de exploración (sin texto `query`), se excluyen por defecto los obsoletos a menos que se solicite explícitamente `includeObsolete: true` o un `lifecycleState` histórico.
   - En consultas de búsqueda textual, se mantiene el multiplicador calibrado de BM25 (`0.02` para superseded en consultas normales, `1.30` en consultas históricas explícitas), preservando el 100% de los 105 escenarios del benchmark canónico.

### C. Adaptador MCP y Superficie Curada (`src/mcp.ts`)
1. **`openmemory_record_knowledge` / `evocara_record_knowledge`:**
   - Incorpora `supersedesItemId`, `evaluationRationale` y `evidenceReference`.
   - Si se especifica `supersedesItemId`, se canaliza directamente a `supersedeKnowledgeDecision`.
   - Si se registran ítems regulares, se preserva el `lifecycleState`, `evidenceReference` y la evaluación técnica.
2. **`openmemory_query_knowledge` / `evocara_query_knowledge`:**
   - Admite `includeObsolete` (booleano).
   - Renderiza un formato Markdown enriquecido con distintivos visuales accesibles:
     - `🟢 [VERIFIED FACT]` para hechos demostrados empíricamente con enlace a pruebas.
     - `🟡 [WORKING HYPOTHESIS]` para hipótesis de trabajo.
     - `⚪ [HISTORICAL / SUPERSEDED]` para memorias obsoletas.
     - Metadata de procedencia completa: `Agent`, `Timestamp`, `Evidence Reference` y `Rationale`.

---

## 3. Verificación y Resultados de Pruebas

### A. Suite de Calidad del Conocimiento (`test-g29-knowledge-lifecycle-suite.js`)
Se ejecutó la nueva batería determinista que evalúa los 7 escenarios requeridos:

| Escenario | Descripción de la Prueba | Resultado | Detalle |
|---|---|---|---|
| **Escenario 1** | Registro de decisión en Sesión 1 y recuperación en Sesión 2 | **PASS** | `DEC-001` recuperado en Top-1 en sesión posterior independiente con persistencia intacta. |
| **Escenario 2** | Supersession atómica y supresión de obsoletos | **PASS** | `DEC-001` pasa a `SUPERSEDED`, `DEC-002` se crea como `ACCEPTED`, relación `SUPERSEDES` verificada. Consulta normal retorna `DEC-002`, `includeObsolete: false` excluye `DEC-001`, consulta histórica recupera `DEC-001`. |
| **Escenario 3** | Diferenciación de estado epistémico | **PASS** | `getEpistemicStatus` clasifica con precisión milimétrica `VERIFIED_FACT`, `WORKING_HYPOTHESIS` y `UNVALIDATED_OBSERVATION`. |
| **Escenario 4** | Procedencia completa y auditoría en MCP | **PASS** | `openmemory_query_knowledge` renderiza badge `🟢 [VERIFIED FACT]`, agente originador y `**Evidence Reference:** \`test-g23-expanded-100-benchmark.js\``. |
| **Escenario 5** | Sandboxing multi-proyecto fail-closed | **PASS** | Consulta a proyecto no autorizado `ForeignCustomerProjectX` es rechazada inmediatamente con error de seguridad fail-closed. |
| **Escenario 6** | Durabilidad y reinicio en frío (Cold Reboot) | **PASS** | Reinicio completo de la instancia de `StorageEngine` preserva los 5 ítems, los estados del ciclo de vida y la estructura del grafo de relaciones TMS. |
| **Escenario 7** | Protección de estado terminal y no destructividad | **PASS** | Intento de resurrección de ítem `SUPERSEDED` y doble supersession son bloqueados. Registro en disco preservado para cumplimiento y auditoría. |

**Resultado de la Suite:** **7 / 7 PASSED (100 %)**.

### B. Batería de Regresiones Históricas Revalidadas

| Suite de Prueba | Archivo de Ejecución | Resultado | Métrica / Observaciones |
|---|---|---|---|
| **Benchmark Canónico 105** | `.work/experiments/test-g23-expanded-100-benchmark.js` | **105 / 105 PASSED (100 %)** | P@1: 100.0 %, P@3: 73.0 %, Recall@3: 97.6 %, MRR: 1.000, FDR: 0.0 %, Latencia p50: 3.55 ms. |
| **BM25 Unit Suite** | `.work/experiments/test-g25-bm25-unit.js` | **9 / 9 PASSED (100 %)** | Ponderación, tokenización, supresión cuadrática y ordenación TMS intactas. |
| **Multilingüe Español** | `.work/experiments/test-g24-multilingual-spanish.js` | **7 / 7 PASSED (100 %)** | Normalización diacrítica, stopwords en español y sinónimos de dominio operativos. |
| **Consultas No Respondibles** | `.work/experiments/test-g24-coordination-unanswerable.js` | **4 / 4 PASSED (100 %)** | Supresión estricta de solapamientos unigramas ($K=0$). |
| **MCP Curado (8 Tools)** | `.work/experiments/test-g25-mcp-curated-surface.js` | **9 / 9 PASSED (100 %)** | 8 herramientas expuestas por defecto, aislamiento de proyectos verificado. |
| **Compatibilidad Dual** | `.work/experiments/test-g27-evocara-compatibility.js` | **9 / 9 PASSED (100 %)** | Paridad de comportamiento idéntica entre prefijos `openmemory_*` y `evocara_*`. |

---

## 4. Auditoría de Seguridad y Límites Operativos

1. **Inviolabilidad de InventoryHub:**
   - Durante toda la ejecución del Hito G29, el consumidor activo local `InventoryHub` permaneció en modo de solo lectura estricto, operando sobre su versión certificada `0.3.14-rc4`.
   - Se ejecutaron cero operaciones de promoción destructiva y cero escrituras en su carpeta.
2. **Control de Cadena de Suministro y Red:**
   - Cero dependencias npm externas añadidas (árbol de dependencias se mantiene 100 % local con `@modelcontextprotocol/sdk` y `zod`).
   - Cero llamadas a APIs comerciales, LLMs remotos o servicios cloud.
   - Cero operaciones remotas de git (`push`, `tag`) o de registro (`npm publish`).

---

## 5. Inventario de Archivos Modificados y Firmas SHA-256

| Archivo Modificado | Tamaño (Bytes) | SHA-256 |
|---|---|---|
| `src/storage/types.ts` | 24,939 | `bc1b478c201a21eb8e0b51283149419fd20ba0ef70236419e9380796b558f0c4` |
| `src/storage.ts` | 128,806 | `691cbb20dd88d467bd248981f061eee2eaff4ac210cfd15fb7f87f745c328071` |
| `src/mcp.ts` | 95,062 | `33262eb0e2fc91141bc59765ba28ede99c5cfb80faf56a35e3634abbd1cc0ff6` |
| `.work/experiments/test-g29-knowledge-lifecycle-suite.js` | 17,264 | `b6e9a0f862514b38fdf60f23d9645ac876bed01148dbfa691a3ebb22c16a0cca` |
| `.work/evidence/g29-knowledge-lifecycle-evidence.json` | 3,842 | `0013f412497042078bcfa12a4f0d3a51f0f4e3c5979f4277fa37f6a27cf0e2d1` |
| `docs/G29_OSS_ARCHITECTURE_EVALUATION.md` | 5,420 | `e5bc416b0a80d463b2f567b5f096ae58022d863f6a2bc4ad60c6d96a78242557` |
| `ROADMAP.md` | 9,820 | `e634bc3ecb8e8f6e8c853ba5e5ccf3a8b23f54cfc072eef003184cf434e7f955` |
