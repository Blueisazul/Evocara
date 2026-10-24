# REGISTRO DE CALIFICACIÓN DE RELEASE CANDIDATE (HITO G27)
## Candidato Calificado: openmemory-0.3.15-rc11.tgz (Hacia Evocara v0.4.0 GA)

- **Fecha:** 22 de octubre de 2026
- **Milestone:** G27 — Bloque C
- **Responsable de Release:** Tech Lead & Release Manager
- **Nombre de Paquete:** `openmemory` (con ejecutables duales `evocara` y `openmemory`)
- **Versión de Candidato:** `0.3.15-rc11`
- **Objetivo de Release:** Evocara v0.4.0 General Availability
- **Hash SHA-256:** `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`
- **Tamaño del Artefacto:** 208,927 bytes
- **Cantidad de Archivos Empaquetados:** 76 archivos
- **Ubicación Física:** `.work/artifacts/openmemory-0.3.15-rc11.tgz`
- **Manifiesto de Release:** `.work/artifacts/openmemory-0.3.15-rc11-manifest.json`
- **SBOM Asociado:** `.work/artifacts/openmemory-0.3.15-rc11.cdx.json` (SHA-256: `3f123387ddcbc70fc9387a45bea36522118f373b2d69e3588dbe1cac266198f7`)

---

## 1. Diferencias Técnicas Respecto al Candidato Anterior (rc10)

| Dimensión | Candidato rc10 (G26) | Candidato rc11 (G27) | Justificación de Release |
|---|---|---|---|
| **Identidad de Producto** | Exclusivamente `openmemory_*` | Nomenclatura dual `openmemory_*` y `evocara_*` | Permite la adopción de la marca Evocara sin romper integraciones previas. |
| **Binarios CLI** | `openmemory` únicamente | `openmemory` y `evocara` en `package.json` (`bin`) | Permite a desarrolladores y agentes invocar la herramienta como `evocara`. |
| **Opciones de Servidor MCP** | Perfil `curated` / `full` | Perfil `curated` / `full` + Selector de prefijo (`prefix: "openmemory" \| "evocara" \| "dual"`) | Flexibilidad total para clientes MCP nuevos y tradicionales. |
| **Software Bill of Materials** | No generado para rc10 | Generado en CycloneDX 1.5 JSON y atado criptográficamente | Requisito formal de auditoría de supply chain para GA. |
| **Tamaño de Paquete** | 207,862 bytes | 208,927 bytes (+1,065 bytes) | Inclusión del despachador de alias y tipos de Evocara. |

---

## 2. Matriz de Suites de Pruebas Ejecutadas y Aprobadas

| Suite de Prueba | Archivo de Arnés | Pruebas | Resultado | Evidencia Bruta |
|---|---|---|---|---|
| **Benchmark Canónico Expandido** | `test-g23-expanded-100-benchmark.js` | 105 / 105 | **100.0 % PASS** | `.work/evidence/g23-expanded-benchmark-results.json` |
| **Suite Unitaria Pura BM25** | `test-g25-bm25-unit.js` | 9 / 9 | **100.0 % PASS** | Salida en consola exitosa (9/9) |
| **Multilingüe en Español** | `test-g24-multilingual-spanish.js` | 7 / 7 | **100.0 % PASS** | Salida en consola exitosa (7/7) |
| **Coordinación y Consultas No Respondibles ($K=0$)** | `test-g24-coordination-unanswerable.js` | 4 / 4 | **100.0 % PASS** | Salida en consola exitosa (4/4) |
| **Invariantes Formales de Ranking** | `test-g23-robustness-invariants.js` | 10 / 10 | **100.0 % PASS** | Salida en consola exitosa (10/10) |
| **Superficie MCP Curada y Aislamiento** | `test-g25-mcp-curated-surface.js` | 9 / 9 | **100.0 % PASS** | Salida en consola exitosa (9/9) |
| **Compatibilidad Dual Evocara / OpenMemory** | `test-g27-evocara-compatibility.js` | 9 / 9 | **100.0 % PASS** | Salida en consola exitosa (9/9) |
| **Calificación Staging InventoryHub** | `test-g27-inventoryhub-staging-promotion.js` | 8 / 8 fases | **100.0 % PASS** | `.work/evidence/g27-inventoryhub-staging-evidence.json` |
| **Pruebas de Negocio del Consumidor en Staging** | `test_inventory_manager.js`, `test_phase_2c2_full.js`, `test_phase_2c4_post_cleanup.mjs` | 34 / 34 | **100.0 % PASS** | Salida en sandbox exitosa (34/34) |
| **Simulacro de Rollback con Inyección de Fallas** | `test-g27-inventoryhub-staging-promotion.js` (Paso 7) | Paridad 100% | **100.0 % PASS** | Restauración exacta de bytes |

---

## 3. Contenido Forense del Tarball (`npm pack`)

Se auditó que el paquete distribuido contiene exclusivamente los componentes de producción:
- `.opencode/`: Plugins oficiales y definiciones de skills.
- `dist/`: Código compilado TypeScript (Storage, BM25, MCP, CLI, StageEngine, MasterPrompt).
- `package.json`: Metadatos limpios, dependencias mínimas y binarios duales.
- `AGENTS.md`, `LICENSE`, `README.md`, `mcp_config.json`.
- **Cero archivos residuales:** Excluidos `.git`, `.work`, tests, reportes de laboratorio, archivos temporales y secretos.

---

## 4. Clasificación Formal de la Release

**RELEASE CANDIDATE CALIFICADO (Apto para Promoción y Release GA)**.
El artefacto `openmemory-0.3.15-rc11.tgz` cumple con la totalidad de los requisitos técnicos, de calidad, seguridad y compatibilidad de Evocara v0.4.0 GA. Queda en custodia local a la espera de la autorización explícita del usuario para ejecutar la promoción final del consumidor activo `InventoryHub`.
