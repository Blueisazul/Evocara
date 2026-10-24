# ROADMAP ACTUALIZADO DE OPENMEMORY / EVOCARA (G25 -> G26 / Release v0.4.0)
## Estado de Maduración, Entregables G25, Criterios de Salida y Próximos Hitos

- **Fecha de Actualización:** 22 de octubre de 2026
- **Línea Base:** Milestone G25 Certificado
- **Candidato Consolidado:** `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`)
- **Consumidor Calificado en Staging:** `InventoryHub` (34/34 pruebas de negocio aprobadas bajo rc8; consumidor de producción local protegido en `0.3.14-rc4`)
- **Superficie MCP:** 8 herramientas esenciales curadas por defecto; 42 herramientas en perfil completo/admin.

---

## 1. Estado de los Objetivos de G25

| Bloque | Objetivo G25 | Estado | Evidencia y Métricas |
|---|---|---|---|
| **Bloque A** | Certificación de Sesión Prolongada en OpenCode | **APROBADO** | 89 interacciones, compactación de 1.11 MB a 298 KB (10/10 eventos esenciales preservados), recuperación de handoff p50 = 0.48 ms (< 50 ms), continuidad en arranque frío. (`.work/evidence/g25-extended-session-evidence.json`) |
| **Bloque B** | Reducción de Superficie MCP de 40 a 8 Herramientas | **APROBADO** | Catálogo curado de 8 herramientas por defecto (`profile: "curated"`), reducción del 80 % en overhead cognitivo. Soporte de 42 herramientas en `profile: "full"`. Operaciones administrativas integradas en CLI. (`docs/G25_MCP_SURFACE_MATRIX.md`, 9/9 pruebas) |
| **Bloque C1** | Umbral Calibrado y Supresión de No Respondibles ($K=0$) | **APROBADO** | Supresión cuadrática a nivel de ítem; consultas no respondibles `G3-UNANS-71..75` retornan $K=0$ sin falsos descubrimientos ni degradación de consultas legítimas. |
| **Bloque C2** | Aislamiento Estricto de Frontera de Proyecto | **APROBADO** | Validación de frontera MCP con fallo cerrado (`isError: true`, acceso denegado). Segregación estricta de dominios en almacenamiento sin falsos positivos en directorios temporales. |
| **Bloque D** | Modularización del Motor de Recuperación (`BM25Engine`) | **APROBADO** | Extracción limpia a `src/storage/retrieval/bm25.ts`. Tipado estricto, cero dependencias circulares. Batería unitaria dedicada 9/9 aprobada (`test-g25-bm25-unit.js`). |
| **Bloque E** | Verificación de Benchmark Canónico de 105 Escenarios | **APROBADO** | 94 / 105 escenarios aprobados (89.5 %), Precision@1: 89.5 %, Recall@3: 96.7 %, MRR: 0.914, latencia p50 = 1.50 ms, p95 = 2.04 ms. Cero regresiones. |
| **Bloque F** | Calificación de Promoción y Rollback de InventoryHub | **APROBADO** | Promoción en clon de staging 7/7 aprobada, 34/34 pruebas de negocio de InventoryHub aprobadas. Simulacro de rollback verificado al 100 %. Consumidor activo protegido en rc4. |

---

## 2. Matriz de Prioridades para el Hito G26 (Hacia Evocara v0.4.0 GA)

```
[ G25: Certificación y Estabilización Completadas ]
                      |
                      v
       [ G26-P1: Promoción Oficial de InventoryHub ]
                      |
       +--------------+--------------+
       |                             |
       v                             v
[ G26-P2: Nomenclatura Evocara ] [ G26-P3: SQLite Indexing Experiment ]
       |                             |
       +--------------+--------------+
                      |
                      v
     [ G26-P4: Release v0.4.0 GA Candidate ]
```

| Prioridad | Iniciativa | Justificación Técnica | Criterios de Salida (DoD) |
|---|---|---|---|
| **P1** | **Promoción en Producción Local de `InventoryHub`** | Aplicar el candidato verificado `0.3.15-rc8` sobre el directorio activo de `InventoryHub` utilizando el Runbook Transaccional. | Ejecución atómica de `TransactionalPromotionEngine`, backup automático, 34/34 pruebas de negocio aprobadas en vivo. |
| **P2** | **Transición de Nomenclatura a Evocara (v0.4.0)** | Actualizar nombres de paquetes, variables de entorno y documentación externa (`openmemory` -> `evocara`) con alias de compatibilidad hacia atrás. | Alias MCP duales (`openmemory_*` / `evocara_*`), CLI binario dual (`openmemory` / `evocara`). |
| **P3** | **Evaluación Experimental de Indización SQLite (`node:sqlite`)** | Evaluar si un índice FTS5 en `node:sqlite` aporta beneficios medibles sobre el motor `BM25Engine` en memoria actual para bases de conocimiento con >10,000 ítems. | Experimento comparativo de latencia p50/p95, uso de memoria y portabilidad sin dependencias binarias externas. |
| **P4** | **Release Final v0.4.0 General Availability** | Empaquetado final y congelación de release estable. | Auditoría de seguridad 100 % limpia, manifiesto SBOM, cobertura de pruebas >90 %, benchmark 105/105 validado. |

---

## 3. Criterios de Salida para Release General (Evocara v0.4.0)

1. [x] Sesión prolongada en OpenCode certificada (>40 interacciones, compactación determinista a 1 MB, handoff < 50 ms).
2. [x] Superficie MCP simplificada y curada (8 herramientas para LLM, 42 herramientas en modo full/admin).
3. [x] Consultas no respondibles calibradas ($K=0$, cero alucinaciones en escenarios `UNANS`).
4. [x] Aislamiento de proyecto estricto y a prueba de confusión de identidad.
5. [x] Motor de recuperación desacoplado y con pruebas unitarias independientes (`BM25Engine`).
6. [x] 34 pruebas de negocio de InventoryHub aprobadas en entorno promovido.
7. [x] Simulacro de rollback transaccional probado con 100 % de paridad de bytes.
8. [ ] Promoción de producción local activada formalmente en `InventoryHub`.
9. [ ] Cierre de alias de transición de marca OpenMemory -> Evocara.
