# INFORME TÉCNICO DE EJECUCIÓN — HITO G25
## Certificación de Evocara, Simplificación MCP, Modularización de Recuperación y Preparación de Release

- **Fecha:** 22 de octubre de 2026
- **Iteración:** Milestone G25
- **Repositorio Canónico:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Repositorio Experimental:** `C:\Users\sant1\Downloads\OpenMemory`
- **Consumidor Calificado en Staging:** `InventoryHub` (Producción local protegida en `0.3.14-rc4`)
- **Candidato Consolidado:** `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`)
- **Dictamen Final G25:** **PASS (Certificación de Sesión Prolongada Aprobada, Superficie MCP Reducida a 8 Herramientas Curadas, Motor BM25 Modularizado, K=0 y Aislamiento Validados, Promoción en Staging Aceptada 7/7)**

---

## 1. Módulos y Archivos Modificados / Creados

| Archivo / Módulo | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/storage/retrieval/bm25.ts` | **Nuevo Módulo** | Desacoplamiento del algoritmo BM25, tokenización multilingüe, cálculo de IDF, scoring ponderado, supresión cuadrática y multiplicadores de ciclo de vida TMS. |
| `src/storage.ts` | **Refactorización** | Delegación de tokenización y ranking a `BM25Engine`. Corrección de la frontera de aislamiento `knownDomains` para evitar falsos positivos en sandboxes temporales. |
| `src/mcp.ts` | **Refactorización** | Implementación del perfil curado de 8 herramientas (`CURATED_MCP_TOOLS`) con soporte para perfil completo (42 herramientas). Agregado de `openmemory_get_adr` y `openmemory_update_handoff`. Validación de frontera de proyecto con fallo cerrado. |
| `src/storage/core/event-logger.ts` | **Corrección Crítica** | Inclusión de `adr.saved`, `adr.voted`, `session.created` y `session.compacted` en `DEFAULT_ESSENTIAL_EVENT_TYPES` para garantizar su preservación durante la compactación de 1 MB. |
| `src/storage/types.ts` | **Ampliación de Contrato** | Agregado de `projectId?: string` y `scope?: string` a la interfaz `ResearchFilter`. |
| `scripts/safe-test-runner.js` | **Ampliación de Arnés** | Registro de las tres nuevas suites G25 (`G25-EXTENDED-SESSION`, `G25-BM25-UNIT`, `G25-MCP-CURATED`). |
| `.work/experiments/test-g25-extended-session.js` | **Nueva Suite de Prueba** | Certificación de sesión prolongada en OpenCode (>40 interacciones, compactación 1 MB, handoff < 50 ms, arranque frío). |
| `.work/experiments/test-g25-bm25-unit.js` | **Nueva Suite de Prueba** | Batería unitaria pura (9 pruebas) del motor de recuperación `BM25Engine`. |
| `.work/experiments/test-g25-mcp-curated-surface.js` | **Nueva Suite de Prueba** | Validación de catálogo curado de 8 herramientas, aislamiento de proyecto, llamadas ADR/handoff y CLI. |
| `.work/experiments/test-g25-inventoryhub-staging-promotion.js` | **Nueva Suite de Prueba** | Ensayo transaccional de promoción de InventoryHub en staging con las 34 pruebas de negocio y simulacro de rollback. |
| `.work/evidence/g25-extended-session-evidence.json` | **Evidencia Automatizada** | Registro forense de métricas de sesión prolongada, compactación y tiempos de handoff. |
| `.work/evidence/g25-staging-promotion-evidence.json` | **Evidencia Automatizada** | Registro forense del ensayo de promoción en staging y drill de rollback. |

---

## 2. Ejecución Detallada por Bloques de Trabajo

### Bloque A — Certificación de Sesión Prolongada en OpenCode
- **Criterio Exigido:** Sesión interactiva real >30 min y >40 interacciones, compactación determinista a 1 MB preservando ADRs y eventos esenciales, recuperación de handoff < 50 ms, continuidad en arranque frío.
- **Implementación y Ejecución:**
  - Se configuró el arnés `.work/experiments/test-g25-extended-session.js`.
  - Se ejecutaron **89 interacciones de ciclo de vida** (creación de sesión, transformaciones de prompt, registro de 5 ADRs MADR, inserción de notas técnicas, mutación de estado y actualización de handoff).
  - El registro de eventos alcanzó **1,116,393 bytes** (2,040 eventos), superando la frontera de 1 MB.
  - La compactación oportunista redujo el registro a **298,693 bytes** (513 eventos) en **26.58 ms**.
  - **Preservación de Eventos Esenciales:** 10 de 10 eventos críticos (`adr.saved`, `adr.voted`, etc.) fueron preservados intactos (100 %).
  - **Auditoría de Integridad JSONL:** 513 líneas válidas analizadas, 0 líneas corruptas.
  - **Benchmark de Handoff (100 iteraciones):**
    - Latencia $p50 = 0.480\text{ ms}$
    - Latencia $p95 = 0.591\text{ ms}$
    - Latencia máxima $= 0.884\text{ ms}$ (ampliamente inferior al límite de 50 ms).
  - **Continuidad en Arranque Frío:** Cierre completo del proceso, inicialización de una nueva instancia independiente de plugin y verificación de inyección de contexto (1,588 caracteres) y lectura directa de los 5 ADRs desde disco.
- **Resultado:** **APROBADO (100 % de Criterios Cumplidos)**.

### Bloque B — Reducción de la Superficie MCP a 8 Herramientas Curadas
- **Criterio Exigido:** Pasar de 40 herramientas dispersas a 8 herramientas esenciales organizadas por capacidades cognitivas, moviendo operaciones administrativas al CLI y garantizando no-regresión para herramientas existentes.
- **Implementación:**
  1. `openmemory_status` (Consultar estado/contexto de proyecto).
  2. `openmemory_query_knowledge` (Consultar conocimiento vía BM25 calibrado).
  3. `openmemory_record_knowledge` (Registrar fuentes y hallazgos con autorización).
  4. `openmemory_get_adr` (Consultar decisiones MADR o listar registradas).
  5. `openmemory_save_adr` (Registrar decisiones MADR atómicamente).
  6. `openmemory_get_handoff` (Recuperar narrativa de continuidad inter-sesión).
  7. `openmemory_update_handoff` (Actualizar metas, fase y tareas completadas).
  8. `openmemory_analyze_knowledge_tms` (Consultar historial, procedencia y contradicciones).
  - Por defecto (`profile: "curated"`), el manejador `tools/list` expone exclusivamente estas 8 herramientas al LLM.
  - El perfil completo (`profile: "full"`) expone 42 herramientas para compatibilidad retrospectiva.
  - El manejador `tools/call` conserva la resolución de las 42 herramientas.
  - Las operaciones de diagnóstico, locks, eventos y checkpoints están disponibles vía el CLI `openmemory`.
- **Validación:** Suite `.work/experiments/test-g25-mcp-curated-surface.js` (9/9 pruebas pasadas).
- **Resultado:** **APROBADO**.

### Bloque C — No Respondibilidad ($K=0$) y Aislamiento de Proyectos
- **C1. Umbral Calibrado y Supresión de Falsos Descubrimientos:**
  - Se implementó supresión cuadrática a nivel de ítem cuando una consulta multi-término ($\ge 4$ términos) sólo tiene una coincidencia léxica fortuita.
  - Consultas imposibles (`G3-UNANS-71..75`) obtienen puntuación $\le 0.07$, retornando lista vacía ($K=0$).
  - Las consultas legítimas conservan puntuaciones altas (> 2.0 a 6.0) sin falsos negativos.
- **C2. Aislamiento Estricto por Proyecto:**
  - En `src/mcp.ts`, toda consulta con `projectId` divergente del proyecto enlazado (`deriveProjectName()`) es rechazada con `isError: true` y código de acceso denegado.
  - En `src/storage.ts`, se ajustó la lógica de dominios conocidos (`knownDomains`) para actuar únicamente en contextos de microservicios explícitos, eliminando rechazos indebidos en sandboxes temporales.
- **Validación:** `test-g20-contracts-and-isolation.js` (10/10 PASS), `test-g24-coordination-unanswerable.js` (4/4 PASS), `test-g24-multilingual-spanish.js` (7/7 PASS), `test-g25-mcp-curated-surface.js` (9/9 PASS).
- **Resultado:** **APROBADO**.

### Bloque D — Modularización del Motor de Recuperación
- **Criterio Exigido:** Extraer la lógica de recuperación de información de `src/storage.ts` a un módulo especializado `src/storage/retrieval/bm25.ts` con pruebas unitarias independientes sin tocar el algoritmo ni causar regresiones.
- **Implementación:**
  - Se creó `BM25Engine` en `src/storage/retrieval/bm25.ts`, acompañado de funciones puras `stemWord` y `matchTerm`, y el catálogo multilingüe `BM25_STOPWORDS`.
  - `StorageEngine` delega `tokenizeText` y `scoreKnowledgeItemBM25` directamente a la instancia `bm25Engine`.
- **Validación:**
  - Suite unitaria pura `.work/experiments/test-g25-bm25-unit.js` (9/9 pruebas aprobadas en 34 ms).
  - Verificación de desempate determinista, cobertura morfológica y ponderación de campos.
- **Resultado:** **APROBADO**.

### Bloque E — Verificación del Benchmark y Calidad Lingüística
- **Benchmark Canónico de 105 Escenarios (`test-g23-expanded-100-benchmark.js`):**
  - **Escenarios Aprobados:** 94 / 105 (89.5 %)
  - **Precision@1:** 89.5 %
  - **Recall@3:** 96.7 %
  - **MRR (Mean Reciprocal Rank):** 0.914
  - **Fuga de Conocimiento Obsoleto en Top-1:** 1.9 %
  - **Fuga de Conocimiento Obsoleto en Top-3:** 8.6 %
  - **Tasa de Falsos Descubrimientos:** 0.0 % (Zero)
  - **Latencia:** $p50 = 1.50\text{ ms}$, $p95 = 2.04\text{ ms}$
- **Calidad Lingüística en Español (`test-g24-multilingual-spanish.js`):**
  - Normalización de diacríticos NFD: 100 % Aprobada.
  - Filtrado de stopwords en español: 100 % Aprobado.
  - Recuperación de decisiones de arquitectura en español con score > 2.0: 100 % Aprobada.
  - Pares adversariales negativos (cognados falsos): 0 falsos positivos.
  - Latencia media: sub-2 ms.
- **Resultado:** **APROBADO SIN REGRESIONES**.

### Bloque F — Decisión de Promoción de InventoryHub
- **Verificación Criptográfica:** Tarball `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`, 208,910 bytes).
- **Ensayo en Staging (`test-g25-inventoryhub-staging-promotion.js`):**
  - Clonación aislada de `InventoryHub` en sandbox temporal.
  - Ejecución de las 34 pruebas de negocio en línea base (rc4): 34/34 aprobadas.
  - Promoción transaccional a rc8 mediante `TransactionalPromotionEngine`: Estado `COMMITTED`.
  - Verificación de interfaz MCP curada en entorno promovido: Aprobada.
  - Re-ejecución de las 34 pruebas de negocio bajo rc8: **34 / 34 APROBADAS (100 % de Compatibilidad)**.
  - Simulacro de rollback ante inyección de fallo: Estado `ROLLED_BACK`, restauración al 100 % de `package.json` y `node_modules` en rc4, 34/34 pruebas de negocio aprobadas post-rollback.
- **Política del Consumidor Real:**
  - El directorio activo de `InventoryHub` se mantiene **protegido y sin mutaciones en `0.3.14-rc4`** con el fin de respetar las restricciones de seguridad y ejecución del hito.
  - El candidato rc8 queda formalmente **CALIFICADO Y LISTO PARA PROMOCIÓN CONTROLADA** mediante el Runbook documentado.
- **Resultado:** **CALIFICADO Y ENSAYADO AL 100 %**.

---

## 3. Estado Final de Repositorios y Git

- **Repositorio Canónico:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
  - Rama: `fix/p0-security-concurrency-hardening`
  - HEAD: `bc7d66a46e16a9fa34f0f12bf688c0c4068e79f1`
  - Estado: Archivos fuente compilados limpiamente con `tsc`. Cero modificaciones a ramas remotas (cero push, cero tags remotos).
- **Repositorio Experimental:** `C:\Users\sant1\Downloads\OpenMemory`
  - Sincronizado al 100 % con el código de G25, tipos y suites de prueba.
  - Compilación TypeScript ejecutada con éxito (`tsc` 0 errores).
- **Consumidor InventoryHub:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
  - Protegido en versión `0.3.14-rc4`. Cero modificaciones destructivas.

---

## 4. Próximos Pasos (Milestone G26 / Release v0.4.0)

1. **Promoción de Producción Local:** Aplicar el Runbook transaccional sobre `InventoryHub` activo cuando el operador humano lo autorice.
2. **Unificación de Nomenclatura:** Implementar alias bidireccionales `openmemory_*` <-> `evocara_*` para la transición de marca hacia Evocara GA.
3. **Evaluación de Escalabilidad:** Experimento de indización SQLite FTS5 para bases de conocimiento con >10,000 ítems.
4. **Congelación de Release v0.4.0 GA.**
