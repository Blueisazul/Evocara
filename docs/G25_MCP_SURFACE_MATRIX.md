# Matriz de Superficie MCP — De 40 a 8 Herramientas Curadas (Hito G25)

## 1. Resumen Ejecutivo de la Refactorización

En el hito G25 (Bloque B), OpenMemory refactoriza su capa de interoperabilidad LLM vía el Model Context Protocol (MCP) para resolver la sobrecarga cognitiva del agente. La interfaz previa exponía **40 herramientas heterogéneas** que mezclaban memoria de trabajo, gobernanza metodológica en cascada (StageEngine de 12 fases) y administración interna de bajo nivel.

La nueva arquitectura establece:
1. **Perfil Curado por Defecto (`profile: "curated"`)**: Expone al LLM exactamente **8 herramientas esenciales** agrupadas por capacidades cognitivas de memoria y continuidad.
2. **Fachada Completa Opcional (`profile: "full"`)**: Mantiene disponibles las 42 herramientas (40 históricas + 2 lecturas/escrituras de alta fidelidad) para agentes de infraestructura, pruebas de regresión y operadores legacy.
3. **Consistencia de Ejecución (`CallToolRequestSchema`)**: Ninguna herramienta fue eliminada silenciosamente. Todas las 42 capacidades continúan siendo ejecutables por invocación directa.
4. **Gobierno y Administración vía CLI**: Todas las operaciones administrativas (locks, rotación/compactación de logs, diagnósticos de salud, checkpoints SQLite y auditoría) disponen de comandos directos en el CLI `openmemory`.

---

## 2. Las 8 Herramientas Curadas Esenciales para el Agente

| # | Grupo de Capacidad | Herramienta Curada | Justificación Funcional |
|---|---|---|---|
| 1 | **Consultar estado o contexto relevante** | `openmemory_status` | Proporciona en una sola llamada el estado del proyecto, fase activa, objetivo en curso, resumen de ADRs y puntero al handoff. |
| 2 | **Consultar conocimiento del proyecto** | `openmemory_query_knowledge` | Búsqueda semántica determinista vía BM25 modular con scoring TMS, ponderación de campos, supresión de falsos positivos y aislamiento estricto de frontera de proyecto. |
| 3 | **Registrar conocimiento y hallazgos** | `openmemory_record_knowledge` | Almacenamiento estructurado de fuentes, repositorios y hallazgos bajo autorización obligatoria de sesión y grafo de procedencia. |
| 4 | **Consultar decisiones arquitectónicas** | `openmemory_get_adr` | Recuperación directa de ADRs por identificador (MADR con votos y consecuencias) o listado de todas las decisiones registradas. |
| 5 | **Registrar o actualizar ADRs** | `openmemory_save_adr` | Registro atómico de decisiones arquitectónicas en formato MADR con sesión activa obligatoria. |
| 6 | **Recuperar el handoff** | `openmemory_get_handoff` | Recuperación en tiempo constante (< 1 ms, benchmark p50 = 0.48 ms) del documento narrativo de continuidad inter-sesión. |
| 7 | **Actualizar el handoff** | `openmemory_update_handoff` | Mutación atómica del relato de continuidad (objetivo activo, fase, tareas completadas y siguientes pasos). |
| 8 | **Historial y procedencia de memoria** | `openmemory_analyze_knowledge_tms` | Análisis de integridad del Truth Maintenance System (TMS): estados del ciclo de vida, detección de contradicciones y dependencias. |

---

## 3. Matriz de Reconciliación de las 40 Herramientas Originales

| # | Herramienta Original (G24) | Destino en G25 | Vía de Acceso en Perfil Curado | Comando CLI Equivalente |
|---|---|---|---|---|
| 1 | `openmemory_health_summary` | Mantenida (Admin/Full) | Subyacente en `openmemory_status` | `openmemory health` |
| 2 | `openmemory_diagnostics_detail` | Mantenida (Admin/Full) | Operación administrativa | `openmemory diagnostics` |
| 3 | `openmemory_inspect_locks` | Mantenida (Admin/Full) | Operación administrativa | `openmemory locks` / `openmemory cleanup` |
| 4 | `openmemory_promotion_status` | Mantenida (Admin/Full) | Operación de release | `openmemory status` |
| 5 | `openmemory_candidate_integrity` | Mantenida (Admin/Full) | Operación de release | `openmemory verify` |
| 6 | `openmemory_sqlite_checkpoint` | Mantenida (Admin/Full) | Ciclo de vida SQLite | `openmemory sqlite checkpoint` |
| 7 | `openmemory_status` | **Curada #1** | **Expuesta directamente** | `openmemory status` |
| 8 | `openmemory_get_handoff` | **Curada #6** | **Expuesta directamente** | Archivo `.openmemory/handoff.md` |
| 9 | `openmemory_save_adr` | **Curada #5** | **Expuesta directamente** | `openmemory adr save` |
| 10 | `openmemory_vote_adr` | Mantenida (Admin/Full) | Gobernanza multi-agente | `openmemory adr vote` |
| 11 | `openmemory_cleanup_locks` | Mantenida (Admin/Full) | Operación administrativa | `openmemory cleanup` / `openmemory locks cleanup` |
| 12 | `openmemory_create_backup` | Mantenida (Admin/Full) | Operación de infraestructura | `openmemory backup` |
| 13 | `openmemory_run_diagnostics` | Mantenida (Admin/Full) | Operación administrativa | `openmemory diagnostics` |
| 14 | `openmemory_record_knowledge` | **Curada #3** | **Expuesta directamente** | `openmemory record` |
| 15 | `openmemory_query_knowledge` | **Curada #2** | **Expuesta directamente** | `openmemory query` |
| 16 | `openmemory_get_stage` | Mantenida (Admin/Full) | Desacoplada de memoria central | `openmemory stage` |
| 17 | `openmemory_start_stage` | Mantenida (Admin/Full) | Desacoplada de memoria central | `openmemory stage start` |
| 18 | `openmemory_complete_stage` | Mantenida (Admin/Full) | Desacoplada de memoria central | `openmemory stage complete` |
| 19 | `openmemory_request_approval` | Mantenida (Admin/Full) | Gobernanza opcional | `openmemory approve request` |
| 20 | `openmemory_approve_stage` | Mantenida (Admin/Full) | Gobernanza opcional | `openmemory approve` |
| 21 | `openmemory_reject_stage` | Mantenida (Admin/Full) | Gobernanza opcional | `openmemory approve reject` |
| 22 | `openmemory_get_phase_report` | Mantenida (Admin/Full) | Auditoría de fase | `openmemory report` |
| 23 | `openmemory_get_roadmap` | Mantenida (Admin/Full) | Coordinación de roadmap | `openmemory roadmap` |
| 24 | `openmemory_approve_phase` | Mantenida (Admin/Full) | Gobernanza opcional | `openmemory phase approve` |
| 25 | `openmemory_reject_phase` | Mantenida (Admin/Full) | Gobernanza opcional | `openmemory phase reject` |
| 26 | `openmemory_save_oss_evaluation` | Mantenida (Admin/Full) | Investigación tecnológica | `openmemory oss save` |
| 27 | `openmemory_register_session` | Mantenida (Admin/Full) | Manejado automáticamente por plugin | `openmemory sessions register` |
| 28 | `openmemory_list_sessions` | Mantenida (Admin/Full) | Inspección de sesiones | `openmemory sessions list` |
| 29 | `openmemory_assemble_cross_context`| Mantenida (Admin/Full) | Manejado automáticamente por plugin | `openmemory context assemble` |
| 30 | `openmemory_create_coordination_task`| Mantenida (Admin/Full)| Coordinación multi-agente | `openmemory task create` |
| 31 | `openmemory_list_coordination_tasks`| Mantenida (Admin/Full)| Coordinación multi-agente | `openmemory task list` |
| 32 | `openmemory_claim_coordination_task`| Mantenida (Admin/Full)| Coordinación multi-agente | `openmemory task claim` |
| 33 | `openmemory_update_coordination_task`| Mantenida (Admin/Full)| Coordinación multi-agente | `openmemory task update` |
| 34 | `openmemory_rotate_event_logs` | Mantenida (Admin/Full) | Mantenimiento de logs | `openmemory logs rotate` |
| 35 | `openmemory_compact_event_logs` | Mantenida (Admin/Full) | Compactación oportunista (1 MB) | `openmemory logs compact` |
| 36 | `openmemory_get_event_retention_policy`| Mantenida (Admin/Full)| Inspección de retención | `openmemory logs policy` |
| 37 | `openmemory_transition_knowledge_lifecycle`| Mantenida (Admin/Full)| Transiciones de estado TMS | `openmemory tms transition` |
| 38 | `openmemory_create_knowledge_relation`| Mantenida (Admin/Full)| Relaciones entre ítems TMS | `openmemory tms relate` |
| 39 | `openmemory_analyze_knowledge_tms` | **Curada #8** | **Expuesta directamente** | `openmemory tms analyze` |
| 40 | `openmemory_reconcile_sessions` | Mantenida (Admin/Full) | Gobernanza Single Writer | `openmemory sessions reconcile` |
| +1 | `openmemory_get_adr` | **Curada #4** (Nueva) | **Expuesta directamente** | `openmemory adr` |
| +2 | `openmemory_update_handoff` | **Curada #7** (Nueva) | **Expuesta directamente** | Edición de `handoff.md` |

---

## 4. Garantías de No Regresión y Conformance

1. **Agente LLM en OpenCode**: Recibe un catálogo limpio de 8 herramientas de memoria, reduciendo el consumo de tokens de esquema en ~80 % y eliminando alucinaciones sobre procesos de gobernanza no aplicables.
2. **Llamadas Históricas**: Las 40 herramientas históricas continúan resolviéndose en el `CallToolRequestSchema` sin error `Unknown MCP tool`.
3. **Validación Automatizada**: Verificada al 100 % mediante la suite `.work/experiments/test-g25-mcp-curated-surface.js` (9/9 pruebas pasadas).
