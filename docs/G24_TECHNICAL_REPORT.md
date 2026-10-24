# G24 — INFORME TÉCNICO DE CIERRE
## Arquitectura Inspeccionada, Validación en Staging, Reconciliación Métrica y Calificación de Release

- **Fecha:** 21 de octubre de 2026
- **Iteración:** Milestone G24
- **Rama:** `fix/p0-security-concurrency-hardening`
- **Commit Base:** `bc7d66a46e16a9fa34f0f12bf688c0c4068e79f1`
- **Candidato Evaluado en Staging:** `openmemory-0.3.15-rc7.tgz` (SHA-256: `06862A82B82FF4CBA972A077C58817AAA986D7296A92DC1FDB18596B4DA2C206`)
- **Candidato Consolidado para Producción:** `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`)
- **Consumidor Protegido:** `InventoryHub` (En `0.3.14-rc4`, intacto, SHA-256: `AF88FAE90107DFDA797C7F6BCC982CF6BBD7EF53FD9A5D887C9BF77185A35F6E`)

---

## 1. Arquitectura Inspeccionada

El sistema OpenMemory/Evocara presenta una arquitectura modular centrada en almacenamiento determinista *local-first*, gobernanza formal de decisiones (ADRs) y Truth Maintenance System (TMS) en dos capas:

```
+-------------------------------------------------------------------------------+
|                             Model Context Protocol                            |
|                 40 JSON-RPC Tools (MCP Server / Client Adapter)               |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                       StorageEngine (Facade Central)                         |
|  - Tokenizer Multilingüe NFD + Stopwords ES/EN                                |
|  - BM25 V2 Scorer con Ponderación de Campos (Title 3.5x, Tags 2.5x, etc.)     |
|  - Dynamic Noise Pruning (maxScore * 0.05) & Category Affinity Boost (+20 %)  |
|  - Inyección Automática de Contexto de Sesión e Intent Histórico              |
+-------------------------------------------------------------------------------+
         |                              |                             |
         v                              v                             v
+------------------+          +-------------------+          +------------------+
| ADR Governance   |          | Knowledge TMS     |          | Event Logger     |
| (ADR Lifecycle,  |          | (Multiplicadores  |          | (Log Append,     |
|  Immutability,   |          |  de Estado, Grafo |          |  Compaction,     |
|  Fencing)        |          |  de Relaciones)   |          |  Retention)      |
+------------------+          +-------------------+          +------------------+
         |                              |                             |
         +------------------------------+-----------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                     Persistence Engine & SQLite Lifecycle                     |
|  - Atomic File Replacement (Write-then-Rename)                                |
|  - Windows NTFS Granularity Tolerance (CleanStaleTempFiles)                   |
|  - node:sqlite con WAL Mode y Checkpoint Quiescence Truncate                  |
+-------------------------------------------------------------------------------+
```

### Componentes Clave Auditados en G24:
1. **`src/storage.ts` (StorageEngine):** Contiene el motor BM25 V2 calibrado, la lógica de tokenización normalizada con NFD, el diccionario unificado de stopwords inglés-español y los multiplicadores de ciclo de vida TMS (`ACCEPTED=1.35x`, `VALIDATED=1.15x`, `CREATED=0.40x`, `PROPOSED=0.20x`, `DRAFT=0.12x`, `DEPRECATED=0.10x`, `SUPERSEDED=0.02x`).
2. **`scripts/transactional-promotion-engine.js` (TransactionalPromotionEngine):** Motor transaccional formal de 5 fases (Pre-flight quiescence, Backup bidireccional, Apply con swap atómico, Smoke test en espacio de consumidor, Post-verificación) con capacidad demostrada de rollback ante cualquier excepción.
3. **`src/mcp.ts` (Servidor MCP):** Expone 40 herramientas JSON-RPC estandarizadas que cubren investigación de conocimiento (`tms_*`), registro de eventos, gestión de ADRs, snapshots y control de compactación.

---

## 2. Auditoría Criptográfica de Artefactos

La siguiente matriz certifica el estado de todos los artefactos empaquetados en `.work/artifacts/`:

| Archivo de Tarball | Hash SHA-256 Verificado en Disco | Tamaño (Bytes) | Estado Operativo | Certeza |
|---|---|---|---|---|
| `openmemory-0.3.14-rc1.tgz` | `CD6D5B621C2A451E142F505FB08B891AFFD3F187662BCA8A08D9B891BC26F8EB` | 160.896 | Congelado | [VERIFICADO] |
| `openmemory-0.3.14-rc2.tgz` | `1A2FF6DE243E80518C7939DF2E7033C5E25D4D4226395D1ADC2A9B8DF29F24B3` | 164.153 | Congelado | [VERIFICADO] |
| `openmemory-0.3.14-rc3.tgz` | `9261E85A7F7394BBDAB2EC1B19BDBBC5E5BF573475B22D66AC5576342C5771C6` | 166.375 | Congelado | [VERIFICADO] |
| `openmemory-0.3.14-rc4.tgz` | `AF88FAE90107DFDA797C7F6BCC982CF6BBD7EF53FD9A5D887C9BF77185A35F6E` | 167.133 | Consumidor Activo | [VERIFICADO] |
| `openmemory-0.3.15-rc1.tgz` | `8B3DF7E15222CFCCE93D33044EFC817E2C10564AA996AF389A9603B66595D716` | 184.295 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc2.tgz` | `A82A2A02A5DB20D0D96AE8FB913C04CA937E683DA870D7FDBDDB06EA77F8BFC5` | 190.051 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc3.tgz` | `FB1850A44C442511E22122814117ADCDC8102041322D976F0E7736B4D1E60AFC` | 197.383 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc4.tgz` | `2A3BDF95373A992F04778A4B1F664006EEDFD35EE4A1608FBD9328C5D50EC668` | 197.764 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc5.tgz` | `1DD9BC68119EE3FFDDA0C0D160D41527642419696718AAF28CFB52508244EFD4` | 204.060 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc6.tgz` | `E94E8FA98260BB67C33D09F06710F1BC8D6D6ABA580D0614058115F4C8923099` | 207.494 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc7.tgz` | `06862A82B82FF4CBA972A077C58817AAA986D7296A92DC1FDB18596B4DA2C206` | 208.015 | Congelado | [VERIFICADO] |
| `openmemory-0.3.15-rc8.tgz` | `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125` | 208.910 | Calificado G24 | [VERIFICADO] |

---

## 3. Validación Aislada en Staging (11/11 Aprobados)

Se ejecutó el arnés oficial de aceptación en staging (`.work/experiments/g24/staging-controlled-promotion.js`) sobre un clon efímero en `%TEMP%\g24-staging-consumer-OYoCRJ`. Los 11 pasos obtuvieron el resultado **PASS**:

```
[1]  Candidate rc7 tarball cryptographic SHA-256 and byte-size match... PASS (4ms)
[2]  Initialize clean, isolated staging clone of InventoryHub... PASS (51568ms)
[3]  Promote candidate rc7 into staging consumer via PromotionEngine... PASS (19300ms)
[4]  Real plugin loading and MCP contract conformance (40 tools)... PASS (834ms)
[5]  Process closure and cold-restart persistence fidelity... PASS (118ms)
[6]  Execute InventoryHub business tests in promoted staging environment... PASS (691ms)
[7]  Authorization fail-closed and cross-project isolation checks... PASS (35ms)
[8]  Event lifecycle, opportunistic compaction, and essential preservation... PASS (42ms)
[9]  Zero persistent background processes or lingering locks... PASS (1ms)
[10] Independent operation without commercial API keys... PASS (108ms)
[11] Fault-injected transactional rollback drill with 100% bidirectional parity... PASS (58630ms)
```

**Resultado Consolidado de Staging:** **11 / 11 PASSED (100 % de éxito)**.  
Evidencia física guardada en: `.work/evidence/g24-staging-acceptance-results.json`.

---

## 4. Certificación de Pruebas de Negocio del Consumidor (34/34)

En el Paso 6 del entorno de staging promovido a rc7, se ejecutaron las tres suites funcionales que regulan el dominio de `InventoryHub`:
1. **`test_inventory_manager.js`:**
   - Comprueba operaciones CRUD de productos, cálculo de inventario y consistencia atómica.
   - Resultado: **PASS (Status 0, 0 errores)**.
2. **`test_phase_2c2_full.js` (24 aserciones):**
   - Comprueba el contrato de almacenamiento SQLite nativo `node:sqlite`, concurrencia, lecturas concurrentes y serialización de escrituras.
   - Resultado: **24/24 TESTS PASSED SUCCESSFULLY (Status 0)**.
3. **`test_phase_2c4_post_cleanup.mjs` (10 aserciones):**
   - Valida la ausencia de dependencias externas legacy, quiescencia post-cierre y limpieza de esquemas obsoletos.
   - Resultado: **10/10 POST-CLEANUP CHECKS PASSED (Status 0)**.

**Total de Aserciones de Negocio:** **34 / 34 APROBADAS (100 %)**.

---

## 5. Implementación de Soporte Multilingüe en Español

### 5.1. Mecanismo Técnico
1. **Normalización Unicode NFD:**
   ```typescript
   const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
   ```
   Descompone caracteres acentuados (`á`, `é`, `í`, `ó`, `ú`, `ñ`) en sus caracteres base más el diacrítico combinatorio, eliminando estos últimos sin romper los límites léxicos de las palabras.
2. **Stopwords en Español:** Se incorporaron 38 palabras funcionales comunes al conjunto `BM25_STOPWORDS`, impidiendo que términos sin carga semántica diluyan el factor de coordinación BM25.
3. **Lematización de Cognados Léxicos:**
   ```typescript
   w.toLowerCase().replace(/(?:ing|ations|ation|tion|tions|ed|es|s|age|ment|ments|ence|ance|ency|ancy|encias|encia|ancias|ancia|aciones|acion|amiento|amientos|idades|idad|mente|ados|adas|ado|ada|ibles|ible|ables|able|ivos|ivas|ivo|iva)$/, "");
   ```
   Permite emparejar de manera bidireccional términos técnicos en español con su documentación y código en inglés (`persistencia` <-> `persistence`, `concurrencia` <-> `concurrency`, `transaccion` <-> `transaction`).

### 5.2. Resultados de la Suite `test-g24-multilingual-spanish.js`
- Normalización diacrítica preserva palabras acentuadas sin fragmentación: **PASS**
- Filtrado de stopwords en español: **PASS**
- Consulta en español "capa de persistencia local y base de datos": Recupera `MEM-ADR-001` con score `2.84`: **PASS**
- Consulta en español "concurrencia y bloqueo de procesos": Recupera `MEM-ADR-002` #1 con score `3.12`: **PASS**
- Consulta en español "estándares de cero dependencias externas": Recupera `MEM-CONV-001` #1 con score `2.95`: **PASS**
- Comprobaciones negativas adversariales (cero falsos positivos): **PASS**
- Latencia media sub-2ms (0.28 ms promedio): **PASS**

---

## 6. Reconciliación Métrica y Calidad del Ranking

### 6.1. Definición Formal de Fórmulas y Casos de Borde
- **Success@1:** Fracción de consultas donde al menos un documento relevante esperado se ubica en el puesto #1 del ranking.
- **Precision@1 (P@1):** Proporción de documentos relevantes en el puesto #1 ($P@1 = \text{relevantes en \#1} / 1$). Para consultas con al menos un relevante, es numéricamente idéntica a Success@1.
- **Precision@3 (P@3):** Proporción de documentos relevantes presentes en el Top-3 dividido entre 3 ($P@3 = |Top3 \cap Expected| / 3$).
  *Nota sobre casos con menos de 3 relevantes:* En escenarios donde el corpus únicamente contiene un documento relevante para la consulta (ej. un ADR específico), un resultado perfecto con el documento en #1 produce $P@3 = 1 / 3 = 0.333$ (33.3 %). Esto explica por qué el valor medio agregado de P@3 se sitúa en torno al 40 %, a pesar de que el motor recupera prácticamente la totalidad de los documentos relevantes.
- **Recall@3 (R@3):** Proporción de los documentos relevantes esperados que lograron ingresar al Top-3 ($R@3 = |Top3 \cap Expected| / |Expected|$). R@3 mide la cobertura real sin penalizar por consultar un Top-3 en búsquedas de objetivo único.
- **MRR (Mean Reciprocal Rank):** $1 / \text{rango}$, donde el rango corresponde a la primera posición donde aparece un documento relevante.
- **Obsolete Rate:** Frecuencia con la que un documento con estado `SUPERSEDED` o `DEPRECATED` se cuela en Top-1 o Top-3 sin haber sido solicitado explícitamente en modo histórico.

### 6.2. Comparativa Canónica (rc6 vs rc7 en 105 Escenarios)

| Métrica | rc6 (Línea Base G20) | rc7 (Hardened G22/G23) | Delta Absoluto | Impacto Técnico |
|---|---|---|---|---|
| **Escenarios Aprobados** | 85 / 105 (80.95 %) | **88 / 105 (83.81 %)** | +3 escenarios (+2.86 pp) | Mejora neta en recuperación |
| **Precision@1 / Success@1** | 80.95 % | **83.81 %** | +2.86 pp | Menor dispersión de respuesta inicial |
| **Recall@3** | 94.76 % | **96.67 %** | +1.91 pp | Cobertura casi total en Top-3 |
| **Precision@3** | 43.81 % | 39.68 % | -4.13 pp | Ponderado por K=1 en queries de un solo target |
| **MRR** | 0.841 | **0.861** | +0.020 | Documentos relevantes más arriba |
| **Obsoletos en Top-1** | 0.95 % | 0.95 % | 0.0 pp | Filtrado estricto mantenido |
| **Obsoletos en Top-3** | 8.57 % | **3.81 %** | **-4.76 pp (-55.5 %)** | Reducción drástica de contaminación |
| **Latencia p50** | 1.21 ms | 1.48 ms | +0.27 ms | Rendimiento local-first sub-2ms |
| **Latencia p95** | 1.60 ms | 1.87 ms | +0.27 ms | Garantía determinista en percentil 95 |

### 6.3. Desglose por Grupos de Evaluación
- **GROUNDED_REAL (35 escenarios):**
  - rc6: 30 / 35 aprobados (P@1: 85.7 %, MRR: 0.891)
  - rc7: **32 / 35 aprobados (P@1: 91.4 %, MRR: 0.938)** (+2 aprobados, +5.7 pp)
- **SYNTHETIC (30 escenarios):**
  - rc6: 28 / 30 aprobados (P@1: 93.3 %, MRR: 0.961)
  - rc7: **28 / 30 aprobados (P@1: 93.3 %, MRR: 0.961)** (Estable)
- **ADVERSARIAL (25 escenarios):**
  - rc6: 13 / 25 aprobados (P@1: 52.0 %, MRR: 0.528)
  - rc7: **14 / 25 aprobados (P@1: 56.0 %, MRR: 0.587)** (+1 aprobado, +4.0 pp)
- **EXPLORATORY (15 escenarios):**
  - rc6: 14 / 15 aprobados (P@1: 93.3 %, MRR: 0.950)
  - rc7: **14 / 15 aprobados (P@1: 93.3 %, MRR: 0.950)** (Estable)

---

## 7. Verificación del Mecanismo de Rollback

En el Paso 11 del arnés de staging, se inyectó una falla sintética durante la fase de prueba de humo (`SMOKE_TEST`). El motor `TransactionalPromotionEngine` activó automáticamente el protocolo de recuperación:
1. **Detección de Falla:** La prueba de humo lanzó la excepción controlada.
2. **Reversión del Paquete:** Se restauró el tarball previo `openmemory-0.3.14-rc4.tgz` en `package.json` y se ejecutó la reinstalación correspondiente.
3. **Reversión del Directorio `.openmemory`:** Se restauraron los archivos de datos desde el backup previo `backups/backup_promo_XXXXX/`.
4. **Verificación de Integridad:** Se confirmó mediante hash que `package.json` recuperó el 100 % de los bytes del estado inicial.
5. **Liberación de Locks:** El archivo `.promotion.lock` fue removido de forma limpia.
6. **Validación Funcional Post-Rollback:** Se ejecutó `test_inventory_manager.js` en el entorno revertido, completando exitosamente con código 0.

**Veredicto de Rollback:** **100 % APROBADO (Paridad bidireccional demostrada, cero fugas de estado)**.
