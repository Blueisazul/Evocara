# ROADMAP ACTUALIZADO DE OPENMEMORY / EVOCARA (G31 -> G32 -> G33 -> G34 / Release v0.4.0 GA)
## Estado de Maduración, Entregables G33, Criterios de Salida y Próximos Hitos

- **Fecha de Actualización:** 24 de octubre de 2026
- **Línea Base:** Milestone G33 Certificado al 100 % (Promoción Local Controlada en InventoryHub y Consolidación en Master)
- **Artefacto Definitivo Generado:** `evocara-0.4.0.tgz` (SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`, 209,910 bytes)
- **SBOM Validado:** `evocara-0.4.0.cdx.json` (SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`, 41,973 bytes)
- **Manifiesto de Release:** `evocara-0.4.0-manifest.json` (3,074 bytes)
- **Consumidor Activo (Desarrollo Local):** `InventoryHub` (**Promovido formalmente a `evocara@0.4.0`**, 34/34 pruebas de negocio aprobadas en vivo, `inventory-data.json` ausente)
- **Consumidor Calificado en Staging:** `InventoryHub` (8/8 fases aprobadas, 34/34 pruebas bajo `evocara@0.4.0`, 100 % paridad en rollback drill)
- **Benchmark de Continuidad (G32):** **7 / 7 escenarios aprobados (100.0 % ON vs 14.3 % OFF)**, +77.1 pp exactitud de decisión, -88.6 % consumo de tokens de contexto, cero regresiones de negocio.
- **Benchmark Canónico:** **105 / 105 escenarios aprobados (100.0 %)**, Precision@1 = 100.0 %, MRR = 1.000, False Discovery Rate = 0.0 %
- **Superficie MCP:** 8 herramientas esenciales curadas por defecto; soporte de alias duales `evocara_*` / `openmemory_*` y 42 herramientas en perfil completo.
- **Binarios CLI Duales:** `evocara` y `openmemory` totalmente operativos.

---

## 1. Estado Consolidado de los Hitos Recientes

| Hito | Iniciativa Principal | Estado | Evidencia y Métricas Clave |
|---|---|---|---|
| **G24** | Auditoría y Estabilización Integral de Memoria | **APROBADO** | Baterías unitarias y contratos formalizados. Candidato `rc8` generado. |
| **G25** | Certificación de Sesión, Simplificación MCP y Modularización BM25 | **APROBADO** | Sesión de 89 interacciones (compactación 1.11 MB -> 298 KB, handoff < 50 ms), catálogo curado de 8 herramientas, extracción de `BM25Engine`. Benchmark: 94/105. |
| **G26** | Cierre de Brechas de Recuperación y Calificación en Staging | **APROBADO** | 105 / 105 benchmark canónico aprobado. Causas raíz resueltas. Candidato `rc10` calificado en staging (8/8 fases). |
| **G27** | Transición Nomenclatura Evocara, SBOM CycloneDX y Candidato rc11 | **APROBADO** | Alias duales MCP y CLI dual (`evocara` y `openmemory`). SBOM CycloneDX 1.5 generado. Candidato `rc11` calificado en staging. |
| **G28** | **Cierre Definitivo Evocara v0.4.0 GA, SBOM, Manifiesto y Calificación** | **APROBADO (100 %)** | **Corte oficial de `evocara-0.4.0.tgz`**. SBOM CycloneDX 1.5 definitivo (`evocara-0.4.0.cdx.json`). Manifiesto SLSA v1.0. Instalación limpia en sandbox aprobada. Staging calificado (8/8 fases, 34/34 pruebas bajo v0.4.0, 100 % paridad de rollback). Consumidor activo protegido en `0.3.14-rc4`. |
| **G29** | **Calidad del Conocimiento, Supersession Atómica y Estado Epistémico** | **APROBADO (100 %)** | **Motor vertical de ciclo de vida del conocimiento implementado**. `supersedeKnowledgeDecision` atómica, diferenciación de estado epistémico (`VERIFIED_FACT`, `WORKING_HYPOTHESIS`), enriquecimiento de procedencia en MCP, `includeObsolete` en recuperación. Suite 7/7 aprobada. Cero regresiones en los 105 benchmarks. |
| **G30** | **Modelo Bi-Temporal del Conocimiento y Consultas Point-In-Time** | **APROBADO (100 %)** | **Modelo bi-temporal nativo local-first implementado**. Diferenciación ortogonal entre tiempo de validez de dominio (`[validFrom, validUntil)`) y tiempo de registro/transacción (`recordedAt`, `supersededAtSystem`). Consultas point-in-time (`queryKnowledgePointInTime`), corrección retroactiva no destructiva (`correctKnowledgeRetroactive`), protección de estados terminales y degradación para registros legados. Suite G30: 15/15 aprobados (100 %). Benchmark canónico: 105/105 aprobados (100 % P@1, MRR 1.000). Consumidor InventoryHub intacto (34/34 PASS). |
| **G31** | **Linaje Causal, Contradicciones Temporales y Síntesis Contextual** | **APROBADO (100 %)** | **Capacidades de razonamiento y linaje causal implementadas**. `explainDecisionLineage(itemId)` bidireccional sobre relaciones `SUPERSEDES` y `DERIVED_FROM`, detección determinista de contradicciones temporales semiabiertas $[validFrom, validUntil)$, enriquecimiento de `queryKnowledgePointInTime` con calibración de confianza a `INCONCLUSIVE`, síntesis contextual estructurada y alias duales MCP (`openmemory_explain_lineage` y `evocara_explain_lineage`). Suite G31: 18/18 aprobados (100 %). Benchmark de rendimiento: p50 = 0.93ms en cadena de 50 nodos. Cero regresiones en G29/G30/G23. Consumidor InventoryHub intacto (34/34 PASS). |
| **G32** | **Continuidad Inter-Sesión y Utilidad Práctica en Consumidor Real** | **APROBADO (100 %)** | **Evaluación empírica ON vs OFF en InventoryHub implementada y certificada**. 7 escenarios representativos evaluados en sandbox aislado: 7/7 PASS (100.0 %) en Condición ON frente a 1/7 PASS (14.3 %) en Condición OFF. Exactitud de decisiones: +77.1 pp a favor de Evocara. Ahorro de contexto: -88.6 % tokens requeridos. Prevención demostrada de fallo en pruebas de negocio (evitó resurrección de JSON legado que rompe Phase 2C.4). Cero mutaciones en proyecto real. Suite `.work/experiments/test-g32-continuity-benchmark.js`, evidencia estructurada `docs/G32_TECHNICAL_REPORT.md` y `.work/evidence/g32-continuity-benchmark-results.json`. |
| **G33** | **Promoción Controlada de v0.4.0 GA, Integración Local y Cierre de Continuidad** | **APROBADO (100 %)** | **Promoción formal de InventoryHub a `evocara@0.4.0` ejecutada y validada (34/34 pruebas PASS, cero regresiones)**. Integración local de `feat/g31-g32-continuity` en `master` con compilación limpia (`tsc`) y suites de regresión aprobadas al 100 %. Calificación previa en staging (34/34 tests) y reversibilidad total demostrada (rollback drill con 34/34 tests). Respaldo atómico en `InventoryHub/backups/backup_g33_promo_*/`. Remoto GitHub protegido (sin push). Informes `docs/G33_TECHNICAL_REPORT.md` y `docs/G33_CONTINUITY_HANDOFF.md`. |
| **G34** | **Reconciliación Git con GitHub y Preparación de Publicación de v0.4.0 GA** | **PREPARADO / PENDIENTE AUTORIZACIÓN** | **Preflight forense completado**. Identificada divergencia (5 commits locales vs 22 commits remotos sobre base `4ab1463`). Estrategia de reconciliación no destructiva `-s ours` ensayada y certificada en sandbox (100% de paridad con Evocara v0.4.0 GA, compilación limpia, cero regresiones). Checklist de publicación de v0.4.0 validado. Push remoto detenido a la espera de autorización humana explícita. Informes `docs/G34_TECHNICAL_REPORT.md` y `docs/G34_CONTINUITY_HANDOFF.md`. |

---

## 2. Detalle de Logros del Hito G30

| Bloque | Objetivo G30 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Modelado Bi-Temporal y Reglas de Dominio | **APROBADO (100 %)** | Campos `validFrom`, `validUntil`, `recordedAt`, `supersededAtSystem` en `KnowledgeItem` y `KnowledgeRelation`. Semántica de intervalo semiabierto `[validFrom, validUntil)` con soporte de intervalos abiertos en el futuro. Validación de no inversión (`validFrom <= validUntil`) y formato ISO 8601. |
| **Bloque B** | Reconstrucción Point-In-Time en KnowledgeTMS | **APROBADO (100 %)** | Métodos `isItemValidAtDomainTime`, `wasItemKnownAtSystemTime`, `wasItemSupersededAtSystemTime` y `evaluateBiTemporalItem` en `KnowledgeTMS`. Proyección determinista de estado efectivo (`effectiveLifecycleState`) sin mutar físicamente ítems en disco. |
| **Bloque C** | Integración en StorageEngine y MCP | **APROBADO (100 %)** | `queryKnowledgePointInTime` con reporte de confianza (`HIGH`, `INCONCLUSIVE`, `UNANSWERABLE`). `correctKnowledgeRetroactive` auditable. `supersedeKnowledgeDecision` bi-temporal. Exposición en `openmemory_query_knowledge` y `evocara_query_knowledge`. |
| **Bloque D** | Suite Reproducible G30 (15 Escenarios) | **APROBADO (100 %)** | Suite `.work/experiments/test-g30-bitemporal-suite.js`: 15/15 escenarios aprobados (100 %). Evidencia automatizada guardada en `docs/G30_TEST_EVIDENCE.json`. |
| **Bloque E** | Batería de Regresión y Control de Calidad | **APROBADO (100 %)** | Cero regresiones: G29 Lifecycle (7/7 PASS), BM25 Unit (9/9 PASS), Evocara Compatibility (9/9 PASS), Benchmark Canónico (105/105 PASS, P@1 = 100 %, MRR = 1.000). Tarball GA verificado (`70f31da...`, 209,910 bytes). InventoryHub protegido intacto (34/34 PASS). |

---

## 2.1. Detalle de Logros del Hito G31

| Bloque | Objetivo G31 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Reconstrucción del Linaje Causal de Decisiones | **APROBADO (100 %)** | Método `explainDecisionLineage(itemId, options)` en `StorageEngine` y `KnowledgeTMS`. BFS bidireccional sobre relaciones `SUPERSEDES` y `DERIVED_FROM`. Detección de ciclos, resolución de referencias rotas (`isBroken`) y presupuestos acotados (`maxDepth`, `maxNodes`). Inmutabilidad en disco. |
| **Bloque B** | Detección de Contradicciones Temporales Activas | **APROBADO (100 %)** | Intersección determinista sobre semántica semiabierta $[validFrom, validUntil)$. Detección de conflictos `CONTRADICTS` explícitos y versiones concurrentes con solapamiento temporal. Preservación de incertidumbre epistémica sin alucinaciones. |
| **Bloque C** | Integración en Consultas Point-In-Time | **APROBADO (100 %)** | Inyección aditiva de `activeContradictions` y `activeAlerts` en `queryKnowledgePointInTime`. Calibración automática de nivel de confianza a `INCONCLUSIVE` ante conflictos activos. |
| **Bloque D** | Síntesis Contextual y Exposición MCP Dual | **APROBADO (100 %)** | Proyección `DecisionSynthesis` con narrativa, estadísticas y recomendaciones. Herramientas MCP simétricas `openmemory_explain_lineage` y `evocara_explain_lineage` con aislamiento fail-closed. |
| **Bloque E** | Suite Reproducible G31 (18 Escenarios) y Rendimiento | **APROBADO (100 %)** | Suite `.work/experiments/test-g31-lineage-and-contradictions-suite.js`: 18/18 escenarios aprobados (100 %). Benchmark sobre 486 ítems: p50 = 0.93ms (cadena 50 nodos), p50 = 0.83ms (árbol 16 nodos). Evidencia en `docs/G31_TEST_EVIDENCE.json`. |
| **Bloque F** | Batería de Regresión y Control de Línea Base | **APROBADO (100 %)** | Cero regresiones en G30 (15/15 PASS), G29 (7/7 PASS), BM25 (9/9 PASS), Evocara (9/9 PASS), Curated MCP (9/9 PASS) y Benchmark Canónico (105/105 PASS). Tarball GA verificado (`70f31da...`). Consumidor InventoryHub intacto (34/34 PASS). |

---

## 2.2. Detalle de Logros del Hito G32

| Bloque | Objetivo G32 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Aislamiento y Entorno Sandbox | **APROBADO (100 %)** | Clon selectivo en `os.tmpdir()` de `InventoryHub` sin mutar proyecto de desarrollo real. Ejecución autónoma con limpieza garantizada. |
| **Bloque B** | Diseño de Escenarios Representativos | **APROBADO (100 %)** | 7 tareas de desarrollo real: justificación de ADR (Task 1), restricciones de valoración y déficit (Task 2), estado de retiro de JSON legado (Task 3), supersesión de arquitectura ESM (Task 4), contradicción de dependencias externas (Task 5), prevención de investigación redundante de timer Windows (Task 6) y honestidad epistémica $K=0$ en Shopify (Task 7). |
| **Bloque C** | Medición Empírica ON vs OFF | **APROBADO (100 %)** | Aprobación de 7/7 (100.0 %) en ON vs 1/7 (14.3 %) en OFF. Exactitud media: 100.0 % (ON) vs 22.9 % (OFF). Reducción de tokens: 580 vs 5,070 (-88.6 %). Falsos descubrimientos: 0.0 % (ON) vs 100.0 % (OFF). |
| **Bloque D** | Preservación de Pruebas de Negocio | **APROBADO (100 %)** | Condición ON mantiene 34/34 pruebas de negocio aprobadas en InventoryHub. Condición OFF sufre regresión crítica al recrear archivo `inventory-data.json`, fallando Phase 2C.4. |
| **Bloque E** | Evidencia y Handoff G32 | **APROBADO (100 %)** | Evidencia en `.work/evidence/g32-continuity-benchmark-results.json`, informe en `docs/G32_TECHNICAL_REPORT.md` y handoff en `docs/G32_CONTINUITY_HANDOFF.md`. |

---

## 2.3. Detalle de Logros del Hito G33

| Bloque | Objetivo G33 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Preflight y Verificación Criptográfica | **APROBADO (100 %)** | Verificación bit-a-bit del tarball GA `evocara-0.4.0.tgz` (`70f31da...`, 209,910 bytes) y SBOM CycloneDX `evocara-0.4.0.cdx.json` (`6621e53...`, 41,973 bytes). Identificación de repositorios canónico (`OpenMemory`) e histórico congelado (`Downloads/OpenMemory`). |
| **Bloque B** | Validación de Contratos y Caja Negra del Tarball | **APROBADO (100 %)** | Suite `.work/experiments/test-g33-artifact-contract-validation.js`: Extracción en `os.tmpdir()`, 45 contratos de exportación, binarios CLI duales (`evocara`, `openmemory`), StorageEngine, gobernanza de sesión/ADR con consenso y BM25 determinista. |
| **Bloque C** | Rehearsal en Staging y Rollback | **APROBADO (100 %)** | Suite `.work/experiments/test-g33-staging-promotion.js`: Clonación en sandbox temporal, 34/34 pruebas de línea base, instalación de `evocara@0.4.0`, 34/34 pruebas de negocio post-promoción (`inventory-data.json` ausente) y prueba de reversibilidad total (rollback a `0.3.14-rc4` con 34/34 PASS). Evidencia en `.work/evidence/g33-staging-promotion-results.json`. |
| **Bloque D** | Promoción Formal en Desarrollo de InventoryHub | **APROBADO (100 %)** | Suite `.work/experiments/promote-inventoryhub-g33.js`: Respaldo atómico en `InventoryHub/backups/backup_g33_promo_*/`, actualización de dependencia a `evocara: file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz`, reconfiguración de `opencode.json` y aprobación del 100 % de las 34 pruebas de negocio en vivo (`test_phase_2c4_post_cleanup.mjs` 10/10, `test_phase_2c2_full.js` 24/24). Manifiesto en `InventoryHub/operation_manifest.json`. |
| **Bloque E** | Consolidación Local en Master | **APROBADO (100 %)** | Merge no fast-forward de `feat/g31-g32-continuity` en `master`. Compilación limpia (`npm run build` exit code 0). Cero cambios perdidos, cero modificaciones en artefactos protegidos y cero operaciones remotas (`git push`). |

---

## 2.4. Detalle de Logros y Preparación del Hito G34

| Bloque | Objetivo G34 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Preflight Local y Remoto (Auditoría Forense) | **APROBADO (100 %)** | Identificación de URL canónica `https://github.com/Blueisazul/Evocara.git`, rama remota principal `master` en `1ae1a48` (OpenMemory v0.3.1). Inventario de divergencia sobre base `4ab1463` (5 commits locales vs 22 commits remotos). Auditoría de seguridad sin secretos (0 `.env`, 0 claves privadas). |
| **Bloque B** | Estrategia de Reconciliación no Destructiva | **APROBADO (100 %)** | Simulación `.work/experiments/test-g34-reconcile-simulation.js`: Ensayo comparativo entre `-X ours` (fallido por splicing de tipos) y `-s ours` (exitoso al 100 %). `origin/master` se incorpora como ancestro directo sin tocar un solo bit del código canónico de v0.4.0 GA. Permite push de avance normal (fast-forward) sin `--force`. |
| **Bloque C** | Validación Previa al Push | **APROBADO (100 %)** | Compilación limpia `npm run build` (`tsc`). Batería de contratos y GA tarball `test-g33-artifact-contract-validation.js` al 100 %. Consumidor InventoryHub en vivo con 34/34 pruebas aprobadas. |
| **Bloque D** | Autorización y Sincronización Remota | **DETENIDO / PENDIENTE** | Operación remota detenida por protocolo de seguridad hasta autorización explícita del propietario. Plan de rollback documentado. |
| **Bloque E** | Preparación de Publicación de v0.4.0 GA | **APROBADO (100 %)** | Checklist de release completado: metadatos, binarios duales, exportaciones, MCP dual, documentación y SBOM validados. |

---

## 3. Matriz de Seguimiento y Estado Real del Proyecto (Hito G34)

| Hito | Estado verificado | Evidencia | Pendientes | Siguiente acción |
|---|---|---|---|---|
| **G28** | **Confirmado al 100 %**. Artefactos de release calificados técnicamente para GA. Tarball, SBOM y manifiesto sin discrepancias. | Hashes SHA-256 idénticos bit-a-bit, SBOM CycloneDX 1.5, manifiesto SLSA v1.0. | Publicación en registro y despliegue pendientes de autorización humana. | Preservar artefactos congelados sin mutación. |
| **G29** | **Completado al 100 %**. Ciclo de vida de conocimiento implementado, runbook de promoción calificado. | Informe `docs/G29_EXECUTION_REPORT.md`, suite `test-g29-knowledge-lifecycle-suite.js` (7/7 PASS). | Autorización explícita humana para promoción activa. | Mantener consumidor InventoryHub protegido. |
| **G30** | **Completado al 100 %**. Soporte bi-temporal e histórico point-in-time nativo en KnowledgeTMS y StorageManager. | Informes `docs/G30_TECHNICAL_REPORT.md`, `docs/G30_EXECUTION_REPORT.md`, evidencia `docs/G30_TEST_EVIDENCE.json`, suite `test-g30-bitemporal-suite.js` (15/15 PASS). | Ninguno para este hito. | Línea base para G31. |
| **G31** | **Completado al 100 %**. Linaje causal de decisiones, detección de contradicciones temporales y síntesis contextual MCP. | Informes `docs/G31_TECHNICAL_REPORT.md`, `docs/G31_EXECUTION_REPORT.md`, evidencia `docs/G31_TEST_EVIDENCE.json`, suite `test-g31-lineage-and-contradictions-suite.js` (18/18 PASS). | Ninguno para este hito. | Línea base para G32. |
| **G32** | **Completado al 100 %**. Benchmark de continuidad entre sesiones y utilidad demostrada en InventoryHub. | Suite `test-g32-continuity-benchmark.js` (7/7 PASS ON vs 1/7 OFF), evidencia `g32-continuity-benchmark-results.json`, informe `docs/G32_TECHNICAL_REPORT.md`. | Ninguno para este hito. | Hito G33 completado con éxito. |
| **G33** | **Completado al 100 %**. Promoción local controlada a Evocara v0.4.0 GA en InventoryHub e integración local en master. | Informes `docs/G33_TECHNICAL_REPORT.md`, `docs/G33_CONTINUITY_HANDOFF.md`, evidencia `g33-staging-promotion-results.json`, `g33-inventoryhub-promotion-results.json`, 34/34 tests aprobados. | Ninguno para este hito. | Línea base consolidada para G34. |
| **G34** | **Preparado / Pendiente de Autorización**. Reconciliación Git con GitHub ensayada y validada; push detenido por protocolo de seguridad. | Informes `docs/G34_TECHNICAL_REPORT.md`, `docs/G34_CONTINUITY_HANDOFF.md`, simulación `test-g34-reconcile-simulation.js`. | Autorización explícita del usuario para ejecutar `git push`. | Solicitar autorización al usuario para sincronizar `origin/master`. |
| **Siguiente hito funcional (G35)** | **Planificado**. Publicación Oficial de Evocara v0.4.0 GA en Registro Externo y GitHub Release. | Artefacto `.work/artifacts/evocara-0.4.0.tgz` y SBOM. | Aprobación de release y credenciales de publicación. | Ejecutar publicación tras sincronización remota. |

---

## 4. Criterios de Salida para Release General (Evocara v0.4.0 GA)

1. [x] Sesión prolongada en OpenCode certificada (>40 interacciones, compactación determinista a 1 MB, handoff < 50 ms).
2. [x] Superficie MCP simplificada y curada (8 herramientas para LLM, 42 herramientas en modo full/admin).
3. [x] Consultas no respondibles calibradas ($K=0$, cero alucinaciones en escenarios `UNANS`).
4. [x] Aislamiento de proyecto estricto y a prueba de confusión de identidad.
5. [x] Motor de recuperación desacoplado y con pruebas unitarias independientes (`BM25Engine`).
6. [x] Benchmark Canónico al 100 % (105 / 105 escenarios aprobados, Precision@1 = 100.0 %, MRR = 1.000).
7. [x] Transición de nomenclatura Evocara implementada con alias duales compatibles en MCP y CLI.
8. [x] SBOM CycloneDX 1.5 generado y validado criptográficamente contra el artefacto candidato.
9. [x] 34 pruebas de negocio de InventoryHub aprobadas en entorno promovido de staging bajo `evocara@0.4.0`.
10. [x] Simulacro de rollback transaccional probado con 100 % de paridad de bytes.
11. [x] Artefacto definitivo `evocara-0.4.0.tgz`, SBOM `evocara-0.4.0.cdx.json` y manifiesto generados y validados.
12. [x] Consumidor de producción local protegido intacto en `0.3.14-rc4` durante fases de prueba.
13. [x] **Ciclo de vida del conocimiento y gobernanza epistémica certificados (Hito G29 completado al 100 %).**
14. [x] **Modelo bi-temporal del conocimiento y consultas point-in-time certificados (Hito G30 completado al 100 %).**
15. [x] **Linaje causal de decisiones, contradicciones temporales y síntesis contextual certificados (Hito G31 completado al 100 %).**
16. [x] **Benchmark de continuidad inter-sesión y utilidad demostrada en consumidor real certificados (Hito G32 completado al 100 %).**
17. [x] **Promoción en entorno de desarrollo local formalizada en `InventoryHub` bajo `evocara@0.4.0` con 34/34 pruebas aprobadas (Hito G33).**
18. [ ] **Sincronización controlada y push al repositorio remoto GitHub (Reconciliación Git ensayada al 100%, pendiente autorización del usuario - Hito G34).**
19. [ ] **Publicación formal en registro npm y GitHub Release v0.4.0 GA (Pendiente - Hito G35).**

