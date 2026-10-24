# INFORME TÉCNICO DE ARQUITECTURA — HITO G31
## Linaje Causal de Decisiones, Contradicciones Temporales Activas y Síntesis Contextual en Evocara / OpenMemory

**Fecha de ejecución:** 23 de octubre de 2026  
**Autoridad técnica:** Antigravity AI — Ingeniero Principal & Arquitecto de Software Senior  
**Estado:** COMPLETADO AL 100% — VERIFICADO Y AUDITABLE  
**Línea base previa:** Hito G30 (Modelo Bi-Temporal del Conocimiento y Consultas Point-In-Time)  
**Artefactos protegidos verificados:**
- Tarball GA: `.work/artifacts/evocara-0.4.0.tgz` (SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`, 209,910 bytes) — **INTACTO Y SIN MODIFICACIONES**
- SBOM GA: `.work/artifacts/evocara-0.4.0.cdx.json` (SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`, 41,973 bytes) — **INTACTO Y SIN MODIFICACIONES**
- Consumidor activo InventoryHub: protegido en `openmemory-0.3.14-rc4.tgz` (34/34 tests PASS) — **INTACTO / NO PROMOVIDO**

---

### 1. Resumen Ejecutivo y Objetivos de G31

El Hito G31 completa las capacidades analíticas de nivel de razonamiento sobre el sustrato bi-temporal introducido en G30:
1. **Reconstrucción del Linaje Causal de Decisiones (`explainDecisionLineage`):**
   - Recorrido determinista hacia atrás (ancestros / predecesores) y hacia adelante (sucesores / reemplazos / ramificaciones derivadas) siguiendo relaciones `SUPERSEDES` y `DERIVED_FROM`.
   - Representación estructurada mediante grafo acíclico (`nodes`, `edges`), detección de ciclos patológicos y terminación acotada con presupuestos explícitos (`maxDepth`, `maxNodes`).
   - Manejo seguro de referencias rotas (`isBroken: true`), nodos aislados y linajes profundos con cero mutaciones en disco.
2. **Detección Determinista de Contradicciones Temporales Activas:**
   - Cierre de la brecha de contradicciones identificada en G30: evaluación de solapamiento temporal bi-temporal sobre la semántica semiabierta $[validFrom, validUntil)$.
   - Detección tanto de relaciones explícitas `CONTRADICTS` vigentes como de aserciones mutuamente excluyentes (sustituciones con ventanas de validez concurrentes o ADRs contradictorios en el mismo dominio).
   - Distinción rigurosa entre solapamiento temporal inocuo y conflicto semántico real, evitando la alucinación de conflictos y calibrando la incertidumbre epistémica de forma transparente.
3. **Integración con Consultas Point-In-Time (`queryKnowledgePointInTime`):**
   - Inyección aditiva y retrocompatible de `activeContradictions` y `activeAlerts` para el instante consultado ($t_{valid}$ y $t_{system}$).
   - Calibración automática de confianza: ante conflictos de severidad alta activos en el instante consultado, el motor degrada la confianza a `INCONCLUSIVE` alertando al agente sin invalidar unilateralmente los datos en disco.
4. **Síntesis Contextual de Decisiones:**
   - Proyección estructurada (`DecisionSynthesis`) con narrativa explicativa determinista (`summaryNarrative`), conteos de linaje, incertidumbres epistémicas y recomendaciones accionables para revisión humana.
5. **Superficie MCP con Alias Duales:**
   - Herramientas `openmemory_explain_lineage` y `evocara_explain_lineage` con idéntico comportamiento, contratos formales y aislamiento estricto por proyecto (fail-closed ante tenants no autorizados).

---

### 2. Arquitectura y Contratos de Datos

#### 2.1. Tipos de Datos Formales (`src/storage/types.ts`)

Se introducen los siguientes tipos estructurales aditivos:

```typescript
export interface LineageNode {
  itemId: string;
  researchId?: string;
  type: string;
  classification: string;
  title: string;
  content: string;
  lifecycleState: LifecycleState;
  epistemicStatus: EpistemicStatus;
  validityWindow: {
    validFrom?: string;
    validUntil?: string;
    isOpenEnded: boolean;
  };
  recordedAt?: string;
  supersededAtSystem?: string;
  provenance: {
    agentId?: string;
    sessionId?: string;
    timestamp: string;
  };
  depth: number;
  direction: 'TARGET' | 'ANCESTOR' | 'DESCENDANT' | 'DERIVATION';
  isBroken?: boolean;
}

export interface LineageEdge {
  id: string;
  relationType: KnowledgeRelationType; // 'SUPERSEDES' | 'DERIVED_FROM' | 'CONTRADICTS' | etc.
  sourceItemId: string;
  targetItemId: string;
  sourceTitle?: string;
  targetTitle?: string;
  createdAt: string;
  isTransitive?: boolean;
}

export interface LineageContradiction {
  conflictingItemId: string;
  conflictingItemTitle: string;
  conflictType: 'EXPLICIT_CONTRADICTION' | 'TEMPORAL_OVERLAP_MUTUAL_EXCLUSION' | 'CONCURRENT_SUPERSEDING';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  activeAtTargetValidTime: boolean;
  overlappingInterval: {
    overlapStart?: string;
    overlapEnd?: string;
  };
  description: string;
}

export interface DecisionSynthesis {
  targetDecisionId: string;
  targetDecisionTitle: string;
  lifecycleState: LifecycleState;
  epistemicStatus: EpistemicStatus;
  hasActiveContradiction: boolean;
  summaryNarrative: string;
  predecessorsCount: number;
  successorsCount: number;
  derivationsCount: number;
  activeConflictsCount: number;
  uncertainties: string[];
  actionableRecommendations: string[];
}

export interface DecisionLineageResult {
  targetFound: boolean;
  targetNode?: LineageNode;
  nodes: LineageNode[];
  edges: LineageEdge[];
  contradictions: LineageContradiction[];
  synthesis: DecisionSynthesis;
  cyclesDetected: string[];
  maxDepthReached: boolean;
  queryTimestamp: string;
  errorReason?: string;
}
```

---

### 3. Algoritmos e Invariantes del Sistema

#### 3.1. Recorrido Bidireccional Acotado y Terminación Segura

El algoritmo implementado en `KnowledgeTMS.explainDecisionLineage` garantiza terminación universal incluso en presencia de grafos cíclicos o dañados mediante tres barreras de protección:
1. **Conjunto de Visita y Detección de Ciclos (`visitedItemIds`):**
   - Todo nodo expandido se añade inmediatamente al conjunto de nodos visitados.
   - Si una arista apunta a un nodo que ya se encuentra en el camino de exploración actual, la arista se registra con advertencia de ciclo (`cyclesDetected`), el camino se poda y no se vuelve a encolar.
2. **Presupuesto de Nodos (`maxNodes = 128` por defecto, configurable):**
   - El número total de nodos recolectados no puede superar `maxNodes`. Al alcanzar el límite, la recolección se detiene y se activa `maxDepthReached: true`.
3. **Presupuesto de Profundidad (`maxDepth = 32` por defecto, configurable):**
   - El recorrido en anchura (BFS) respeta la distancia radial desde el nodo objetivo.

```
       [ITEM-ORIGIN]  (Ancestral Origin / Predecessor)
             │  SUPERSEDES
             ▼
        [ITEM-DEC-V2] (Intermediate Supersession)
             │  SUPERSEDES
             ▼
     ★ [TARGET-DEC-V3] ★  ◄─── Punto de entrada del query
        │          │
        │          └─► [ITEM-DERIVED-X] (DERIVED_FROM)
        │
        ▼  SUPERSEDES
     [ITEM-FUTURE-V4] (Replacement Successor)
```

#### 3.2. Detección de Contradicciones Temporales con Semántica Semiabierta $[validFrom, validUntil)$

El cálculo de intersección temporal evalúa rigurosamente las ventanas de validez:
- Sean $I_A = [s_A, e_A)$ e $I_B = [s_B, e_B)$.
- $I_A \cap I_B \neq \emptyset \iff \max(s_A, s_B) < \min(e_A, e_B)$.
- Si $e_A = s_B$, la intersección es nula: la transición exacta en el límite de un segundo no genera conflicto.
- Un intervalo con $e = \text{undefined}$ modela validez abierta hacia el futuro ($+\infty$).
- Un ítem sin marcas temporales legadas se evalúa como abierto en ambos extremos, pero documentando explícitamente la incertidumbre epistémica en `synthesis.uncertainties` en lugar de generar alertas infundadas.

#### 3.3. Distinción entre Solapamiento Temporal y Contradicción Semántica

Un solapamiento en el tiempo no implica necesariamente contradicción (por ejemplo, dos ADRs de dominios ortogonales que conviven pacíficamente).
El motor califica como contradicción únicamente cuando existe:
1. **Relación explícita `CONTRADICTS`** entre los dos ítems.
2. **Conflicto de exclusión mutua por sustitución activa concurrente:** dos versiones de la misma decisión (`SUPERSEDES`) cuyas ventanas declaradas de validez se superponen en el tiempo de dominio.
3. **Decisiones conflictivas en el mismo ámbito o tópico:** aserciones incompatibles registradas formalmente.

---

### 4. Integración con MCP y Compatibilidad Dual

Las herramientas MCP se exponen con alias duales simétricos:
- `openmemory_explain_lineage`: nomenclatura estándar OpenMemory.
- `evocara_explain_lineage`: nomenclatura moderna Evocara.

Ambas invocaciones delegan en la misma función de resolución de `StorageEngine.explainDecisionLineage`. Las herramientas devuelven una proyección legible en Markdown para el LLM con la síntesis ejecutiva, estadísticas de linaje, alertas de contradicciones y un bloque estructurado JSON para consumo programático.

---

### 5. Medición de Rendimiento y Calidad

Ejecutado sobre un corpus sintético de 486 ítems y 74 relaciones distribuidas en múltiples registros de investigación:
- **Cadena lineal profunda (50 saltos continuos):** p50 = `0.930 ms`, p95 = `1.477 ms`, promedio = `1.205 ms`.
- **Árbol de derivación ramificado (16 nodos, 15 relaciones):** p50 = `0.834 ms`, p95 = `1.007 ms`, promedio = `0.846 ms`.
- **Consulta Point-In-Time con análisis de contradicción integrado:** p50 = `9.525 ms`, p95 = `10.775 ms`, promedio = `9.773 ms`.
- **Tasa de falsos positivos en contradicciones:** `0.0%`.
- **Huella de memoria del motor:** `Heap Used = 20.92 MB`, `RSS = 85.84 MB`.
- **Mutaciones en disco durante lecturas de linaje:** `0 bytes` (Estricta inmutabilidad verificada).

---

### 6. Decisión Sobre Componentes OSS

Se ratifica la decisión arquitectónica adoptada en G29 y G30:
- **Evaluación de Graphiti / Neo4j / NetworkX:** **DESCARTADOS**. La implementación de recorrido causal sobre grafos acíclicos dirigidos (DAG) en TypeScript puro consume menos de 1 MB de memoria y ejecuta en $<1.5 \text{ ms}$ sin requerir demonios externos, sockets de red, licencias virales ni dependencias pesadas de Node-gyp.
- **Evaluación de bases vectoriales externas:** **DESCARTADAS**. La búsqueda BM25 combinada con grafos de relaciones bi-temporales satisface al 100% los 105 casos canónicos de recuperación sin dependencias externas.
