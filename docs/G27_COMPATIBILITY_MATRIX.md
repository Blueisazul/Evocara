# MATRIZ DE COMPATIBILIDAD Y NOMENCLATURA DUAL (HITO G27)
## Transición sin Rupturas: OpenMemory -> Evocara v0.4.0 GA

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G27 — Bloque A
- **Candidato Cualificado:** `openmemory-0.3.15-rc11.tgz` (SHA-256: `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`)
- **Suite de Regresión Automatizada:** `.work/experiments/test-g27-evocara-compatibility.js` (9/9 pruebas APROBADAS)

---

## 1. Principio de Diseño: Nomenclatura Dual y Despacho Unificado

Para permitir que el producto adopte su identidad formal como **Evocara** sin provocar disrupciones en proyectos, agentes o scripts que dependen del ecosistema OpenMemory:
1. **Cero Duplicación de Lógica:** Todos los alias resuelven al mismo despachador interno en `src/mcp.ts` mediante normalización transparente de prefijo (`name.startsWith("evocara_") ? name.replace(/^evocara_/, "openmemory_") : name`).
2. **Gobernanza Idéntica:** Ambas llamadas aplican exactamente las mismas reglas de validación de esquemas Zod, verificación de sesión de escritor único, invariantes de Truth Maintenance System (TMS) y rechazo con fallo cerrado ante violaciones de frontera de proyecto (`isError: true`).
3. **Consumo de Contexto Optimizado:** Por defecto, `tools/list` continúa exponiendo únicamente el catálogo curado de 8 herramientas esenciales (~1,450 tokens), evitando inflar la ventana de contexto del LLM con 16 o 84 herramientas duplicadas.

---

## 2. Matriz de Equivalencia de Herramientas MCP

### Catálogo Curado Esencial (8 Herramientas Cognitivas):

| Capacidad Cognitiva | Identificador Histórico | Identificador Nuevo Evocara | Manejador Compartido | Comportamiento & Paridad |
|---|---|---|---|---|
| **Estado y Contexto** | `openmemory_status` | `evocara_status` | `formatProjectContextSummary()` | Idéntico resumen de fase, meta activa, ADRs y puntero de handoff |
| **Búsqueda Semántica** | `openmemory_query_knowledge` | `evocara_query_knowledge` | `BM25Engine.rankMatches()` | Idéntico ranking BM25, 100 % paridad de scores, aislamiento de proyecto |
| **Registro de Conocimiento** | `openmemory_record_knowledge` | `evocara_record_knowledge` | `StorageEngine.saveResearch()` | Idéntica validación de sesión y persistencia atómica en `research.json` |
| **Consulta de ADRs** | `openmemory_get_adr` | `evocara_get_adr` | `StorageEngine.getADR()` | Idéntico parser MADR 3.0 y listado de decisiones |
| **Escritura de ADRs** | `openmemory_save_adr` | `evocara_save_adr` | `StorageEngine.saveADR()` | Idéntica verificación de lock y votación de consenso |
| **Lectura de Handoff** | `openmemory_get_handoff` | `evocara_get_handoff` | `StorageEngine.getHandoff()` | Idéntica lectura de narrativa inter-sesión |
| **Actualización de Handoff** | `openmemory_update_handoff` | `evocara_update_handoff` | `StorageEngine.updateHandoff()` | Idéntica mutación atómica sin dobles escrituras |
| **Análisis TMS y Procedencia** | `openmemory_analyze_knowledge_tms` | `evocara_analyze_knowledge_tms` | `StorageEngine.analyzeKnowledgeTMS()` | Idéntico grafo de dependencias, consistencia y ciclo de vida |

### Catálogo Completo / Administrativo (34 Herramientas de Mantenimiento):
Todas las herramientas históricas (`openmemory_health_summary`, `openmemory_inspect_locks`, `openmemory_create_backup`, `openmemory_rotate_event_logs`, `openmemory_compact_event_logs`, `openmemory_transition_knowledge_lifecycle`, `openmemory_create_knowledge_relation`, `openmemory_reconcile_sessions`, etc.) están mapeadas 1:1 con su correspondiente alias `evocara_*` y se encuentran activas en el despachador `CallToolRequestSchema`.

---

## 3. Configuración de Prefijos MCP (`MCPServerOptions`)

El servidor MCP permite configurar explícitamente el prefijo expuesto en `tools/list`:

```typescript
export interface MCPServerOptions {
  profile?: "curated" | "full";                     // Default: "curated" (8 herramientas)
  prefix?: "openmemory" | "evocara" | "dual";       // Default: "openmemory"
}
```

| Configuración | Herramientas Listadas en `tools/list` | Herramientas Invocables en `tools/call` | Caso de Uso |
|---|---|---|---|
| `prefix: "openmemory"` (Default) | 8 herramientas `openmemory_*` | Ambas (`openmemory_*` y `evocara_*`) | Entornos legacy, OpenCode estándar, suites existentes |
| `prefix: "evocara"` | 8 herramientas `evocara_*` | Ambas (`openmemory_*` y `evocara_*`) | Nuevas instalaciones de Evocara v0.4.0 |
| `prefix: "dual"` | 16 herramientas (ambas familias) | Ambas (`openmemory_*` y `evocara_*`) | Agentes de orquestación y auditorías de migración |
| `profile: "full", prefix: "evocara"` | 42 herramientas `evocara_*` | Ambas (42 y 42) | Agentes administrativos en modo Evocara |

---

## 4. Matriz de Equivalencia CLI

En `package.json`, la clave `bin` declara ambos ejecutables apuntando al mismo runtime (`./dist/cli.js`):

```json
"bin": {
  "openmemory": "./dist/cli.js",
  "evocara": "./dist/cli.js"
}
```

| Comando | Invocación Tradicional | Invocación Nueva Evocara | Salida Verificada |
|---|---|---|---|
| **Versión** | `openmemory version` | `evocara version` | `Evocara (formerly OpenMemory) v0.4.0-rc1 (package: openmemory@0.3.15-rc11)` |
| **Ayuda** | `openmemory --help` | `evocara --help` | Mensaje de ayuda unificado con ambas nomenclaturas |
| **Estado** | `openmemory status` | `evocara status` | Resumen de contexto y estado de gobernanza |
| **Consulta BM25** | `openmemory query -q "storage"` | `evocara query -q "storage"` | Ranking BM25 sobre base de conocimiento |
| **Gestión TMS** | `openmemory tms analyze` | `evocara tms analyze` | Auditoría de consistencia de Truth Maintenance System |
| **Logs** | `openmemory logs compact` | `evocara logs compact` | Compactación determinista de log operacional a 1 MB |
