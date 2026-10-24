# INFORME DE COMPATIBILIDAD MCP, AISLAMIENTO DE PROYECTO Y PERSISTENCIA (HITO G26)
## Verificación de Garantías de Memoria, Procedencia y Seguridad

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G26 — Bloque Prioritario B
- **Auditor:** Ingeniero de Calidad y Fiabilidad de Software
- **Resultado Global:** **100 % APROBADO (Garantías Verificadas y Libres de Regresión)**

---

## 1. Resumen de Garantías y Pruebas Ejecutadas

| Dimensión de Seguridad / Memoria | Contrato Verificado | Suite de Prueba | Resultado |
|---|---|---|---|
| **Aislamiento entre Proyectos** | Rechazo fallo-cerrado ante `projectId` divergente | `test-g25-mcp-curated-surface.js` (Test 5) | **PASS (isError: true)** |
| **Consultas Fuera de Dominio** | Resultado estrictamente vacío ($K=0$, 0 alucinaciones) | `test-g24-coordination-unanswerable.js` | **PASS (0 resultados)** |
| **Separación Epistémica TMS** | Diferenciación estricta: FACT, HYPOTHESIS, CONCLUSION | `test-g23-robustness-invariants.js` | **PASS (10/10 Invariantes)** |
| **Decisiones Vigentes vs Obsoletas** | Multiplicador TMS (`SUPERSEDED = 0.05x`, `DRAFT = 0.01x`) | `test-g23-expanded-100-benchmark.js` | **PASS (0 obsoletos en Top-1)** |
| **Procedencia y Trazabilidad** | Conservación íntegra de `sourceEvidence`, actor y sesión | `test-g25-extended-session.js` | **PASS (100 % fidelidad)** |
| **Persistencia Inter-Sesión** | Compactación de log determinista (1 MB -> 298 KB) | `test-g25-extended-session.js` | **PASS (10/10 esenciales)** |
| **Recuperación en Arranque Frío** | Continuidad tras reinicio completo de proceso | `test-g25-extended-session.js` (Fase 4) | **PASS (Handoff < 1 ms)** |
| **Compatibilidad MCP Dual** | 8 herramientas curadas por defecto / 42 en perfil full | `test-g25-mcp-curated-surface.js` | **PASS (9/9 pruebas)** |

---

## 2. Aislamiento Estricto de Proyectos y Fallo-Cerrado

### Mecanismo de Seguridad:
1. En la frontera del servidor MCP (`src/mcp.ts`), cualquier llamada a `openmemory_query_knowledge` o `openmemory_record_knowledge` que especifique un `projectId` es contrastada contra el proyecto deducido del almacenamiento local (`storage.deriveProjectName()`).
2. Ante cualquier discrepancia (ej. un agente de `BillingService` intentando acceder al espacio de `InventoryHub`), la llamada es **rechazada de forma cerrada e irrevocable** sin consultar los archivos de datos:
   ```json
   {
     "isError": true,
     "content": [{
       "type": "text",
       "text": "Access denied: Project boundary violation. Request projectId 'BillingService' does not match active storage project 'InventoryHub'."
     }]
   }
   ```
3. En el motor `BM25Engine`, las consultas multi-servicio aíslan los resultados aplicando el filtro `isItemInScope` antes de computar el ranking, garantizando que credenciales, secretos y tokens de un servicio nunca se filtren a otro.

---

## 3. Tipificación Epistémica y Ciclo de Vida del Truth Maintenance System (TMS)

El sistema de memoria clasifica y gobierna el conocimiento según dos ejes ortogonales:

### A. Tipificación Epistémica (`KnowledgeClassification`):
- `FACT`: Hechos verificados mediante pruebas ejecutables o auditorías forenses directas.
- `OBSERVATION`: Datos empíricos observados durante la ejecución de tareas o perfiles de carga.
- `FINDING`: Hallazgos analíticos con base documental o metodológica.
- `HYPOTHESIS`: Inferencias o propuestas de diseño que requieren validación experimental.
- `CONCLUSION`: Síntesis finales avaladas por consenso de agentes o decisiones de arquitectura.

### B. Ciclo de Vida Formal de TMS:
$$\text{CREATED} \longrightarrow \text{VALIDATED} \longrightarrow \text{ACCEPTED} \longrightarrow \text{SUPERSEDED} \mid \text{DEPRECATED}$$

- **Multiplicadores de Relevancia por Estado de Verdad:**
  - `ACCEPTED`: Multiplicador **1.20x** (prioridad a decisiones y hechos ratificados).
  - `VALIDATED`: Multiplicador **1.00x** (peso neutral).
  - `CREATED`: Multiplicador **0.80x**.
  - `SUPERSEDED`: Multiplicador **0.05x** (degradación al fondo del ranking salvo búsqueda histórica explícita).
  - `DRAFT` / `PROPOSED`: Multiplicador **0.01x** (inmunidad ante distractores en consultas de producción).

---

## 4. Persistencia de ADRs y Protocolo de Handoff

1. **Estándar MADR 3.0:** Los ADRs se persisten como archivos individuales Markdown estructurados en `.work/decisions/` acompañados de un índice JSON centralizado (`adrs.json`).
2. **Handoff Inter-Sesión:**
   - Estructurado en tres bloques clave: `activeGoal`, `phaseStatus`, `recentAccomplishments` y `immediateNextSteps`.
   - Recuperación en memoria de alta velocidad: latencia $p50 = 0.48\text{ ms}$, $p95 = 0.59\text{ ms}$, eliminando cualquier fricción de inicio de sesión para el agente par.
3. **Resiliencia de Registro de Eventos:**
   - La compactación oportunista a 1 MB retiene el 100 % de los eventos tipificados como `ESSENTIAL` (`adr.saved`, `adr.voted`, `session.created`, `session.compacted`).
   - Auditoría post-compactación confirma 0 líneas JSONL corruptas y paridad completa de estados.

---

## 5. Compatibilidad de Superficie MCP (8 Curadas vs 42 Totales)

1. **Perfil Curado (`profile: "curated"` - Por Defecto):**
   - Expone exactamente 8 herramientas ortogonales optimizadas para pair programming con LLMs.
   - Reduce el consumo de tokens de contexto de ~7,900 a ~1,450 tokens.
   - Elimina la ambigüedad en la selección de herramientas para el agente.
2. **Perfil Completo (`profile: "full"`):**
   - Expone las 42 herramientas para compatibilidad retrospectiva total con pipelines legados y agentes de infraestructura.
3. **Preservación de Manejadores Internos:**
   - Las 42 herramientas permanecen implementadas en el despachador central `server.setRequestHandler(CallToolRequestSchema)`. Cualquier agente o script que invoque por nombre una herramienta histórica recibe una respuesta válida sin errores de método desconocido.
