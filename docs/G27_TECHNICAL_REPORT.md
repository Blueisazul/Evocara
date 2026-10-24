# INFORME TÉCNICO DE EJECUCIÓN — HITO G27
## Transición de Nomenclatura Evocara, Auditoría de Cadena de Suministro (SBOM) y Calificación de Release Candidate

- **Fecha:** 22 de octubre de 2026
- **Iteración:** Milestone G27
- **Repositorio Canónico:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Repositorio Experimental:** `C:\Users\sant1\Downloads\OpenMemory` (100 % sincronizado)
- **Consumidor Activo (Producción Local):** `InventoryHub` (Protegido en `0.3.14-rc4`, cero mutaciones)
- **Consumidor Calificado en Staging:** `InventoryHub` (8/8 fases superadas, 34/34 pruebas de negocio aprobadas bajo rc11)
- **Candidato Calificado:** `openmemory-0.3.15-rc11.tgz` (SHA-256: `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`)
- **SBOM Validado:** `openmemory-0.3.15-rc11.cdx.json` (SHA-256: `3f123387ddcbc70fc9387a45bea36522118f373b2d69e3588dbe1cac266198f7`)
- **Dictamen Final G27:** **PASS (Transición Dual Evocara/OpenMemory 100% Funcional sin Rupturas, SBOM CycloneDX 1.5 Verificado Criptográficamente, 105/105 Benchmark Canónico Preservado, Calificación en Staging 8/8 Fases Aprobada, Consumidor Activo Protegido)**

---

## 1. Resumen Ejecutivo y Resultados del Hito G27

El hito G27 consolida los hitos previos de estabilización (G24), modularización y simplificación MCP (G25) y resolución de brechas de recuperación (G26), cerrando los requisitos clave para la publicación de **Evocara v0.4.0 GA**:

1. **Transición de Nomenclatura Dual sin Regresiones (Bloque A):**
   - Se implementó la identidad formal de **Evocara** sobre el catálogo MCP y el CLI preservando compatibilidad 100 % retrospectiva con OpenMemory.
   - Despachador de MCP con normalización transparente de prefijo (`evocara_*` $\leftrightarrow$ `openmemory_*`), garantizando cero duplicación de lógica, idéntica autorización y mismo aislamiento fail-closed.
   - Declaración de binarios duales en `package.json` (`openmemory` y `evocara`), permitiendo invocar indistintamente ambos comandos.
   - Nueva suite de regresión `.work/experiments/test-g27-evocara-compatibility.js`: **9 / 9 pruebas aprobadas**.
2. **Seguridad de la Cadena de Suministro y SBOM CycloneDX 1.5 (Bloque B):**
   - Generación del Software Bill of Materials en formato CycloneDX 1.5 JSON (`.work/artifacts/openmemory-0.3.15-rc11.cdx.json`).
   - Validación criptográfica de atadura al tarball (`node scripts/generate-sbom.js --validate` exit code 0, 96 componentes rastreados).
   - Auditoría de dependencias (`npm audit`) analizada en profundidad: los avisos `GHSA-6qxp-vccf-f47h` y `GHSA-5r4p-p66f-jhc7` fueron evaluados y dictaminados como no aplicables por estar restringidos a transporte HTTP/OAuth inexistente en la arquitectura STDIO local de Evocara.
   - Auditoría de licencias: 100 % de dependencias en licencias permisivas (MIT, Apache 2.0, BSD), 0 dependencias GPL o comerciales.
3. **Calificación Reproducible del Candidato `rc11` (Bloque C):**
   - Empaquetado limpio `openmemory-0.3.15-rc11.tgz` (208,927 bytes, SHA-256 `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`).
   - Cero archivos residuales, secretos ni experimentos de laboratorio en el paquete distribuido.
   - Manifiesto criptográfico generado en `.work/artifacts/openmemory-0.3.15-rc11-manifest.json`.
4. **Validación en Staging de InventoryHub y Blindaje de Producción (Bloque D):**
   - Ejecución del ensayo completo de promoción en sandbox aislado (`test-g27-inventoryhub-staging-promotion.js`): **8 / 8 fases aprobadas**.
   - Las **34 pruebas de negocio de InventoryHub** pasaron al 100 % bajo el candidato `rc11`.
   - Simulacro de rollback atómico con inyección de fallas en fase de smoke test: verificado con **100 % de paridad de bytes**.
   - **Consumidor Activo (`InventoryHub`):** Estrictamente preservado e intacto en `0.3.14-rc4` (cero mutaciones en disco).
5. **Preservación Íntegra de Garantías de Recuperación y Memoria (Bloque E):**
   - Benchmark Canónico de 105 escenarios: **105 / 105 Aprobados (100.0 %)**, Precision@1 = 100.0 %, MRR = 1.000, FDR = 0.0 %.
   - Suite Unitaria BM25: **9 / 9 Aprobadas**.
   - Suite Multilingüe en Español: **7 / 7 Aprobadas**.
   - Consultas No Respondibles ($K=0$): **4 / 4 Aprobadas**.
   - Invariantes Formales de Ranking: **10 / 10 Aprobados**.

---

## 2. Inventario de Archivos Modificados y Creados en G27

| Archivo / Módulo | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/mcp.ts` | **Mejora de Contrato** | Soporte de opción `prefix?: "openmemory" \| "evocara" \| "dual"`; exportación de `EVOCARA_CURATED_MCP_TOOLS` y `createEvocaraMCPServer`; normalización de nombres en `CallToolRequestSchema` (`evocara_*` $\rightarrow$ `openmemory_*`). |
| `src/cli.ts` | **Identidad Dual** | Adición de comandos `version`, `--version`, `-v`; mensaje de ayuda con soporte dual `evocara <cmd>` y `openmemory <cmd>`. |
| `package.json` | **Release Candidate** | Incremento de versión a `0.3.15-rc11`; adición de binario `evocara` en el bloque `bin`. |
| `.work/experiments/test-g27-evocara-compatibility.js` | **Nueva Suite de Prueba** | 9 pruebas automatizadas de compatibilidad de nomenclatura dual, aislamiento, invocación MCP y CLI. |
| `.work/experiments/test-g27-inventoryhub-staging-promotion.js` | **Nueva Suite de Staging** | Arnés de 8 fases para calificación de `rc11` en staging efímero, 34 pruebas de negocio de InventoryHub y ensayo de rollback. |
| `.work/artifacts/openmemory-0.3.15-rc11.tgz` | **Nuevo Paquete Candidato** | Tarball limpio empaquetado para distribución local (208,927 bytes). |
| `.work/artifacts/openmemory-0.3.15-rc11.cdx.json` | **Nuevo SBOM Oficial** | Inventario estructurado CycloneDX 1.5 JSON (41,998 bytes) con 96 componentes rastreados. |
| `.work/artifacts/openmemory-0.3.15-rc11-manifest.json` | **Manifiesto de Release** | Manifiesto criptográfico con metadatos de release, hashes y contratos. |
| `.work/evidence/g27-inventoryhub-staging-evidence.json` | **Evidencia Automatizada** | Registro de ejecución de las 8 fases de staging y paridad de rollback. |
| `docs/G27_COMPATIBILITY_MATRIX.md` | **Entregable Obligatorio** | Matriz forense de equivalencia entre herramientas `openmemory_*` y `evocara_*`, CLI y perfiles MCP. |
| `docs/G27_SUPPLY_CHAIN_SECURITY_REPORT.md` | **Entregable Obligatorio** | Informe de auditoría de dependencias, análisis de avisos de seguridad y validación de SBOM. |
| `docs/G27_RELEASE_CANDIDATE_RECORD.md` | **Entregable Obligatorio** | Registro de calificación de release candidate con hashes, tamaños y resultados de suites. |
| `docs/G27_PROMOTION_RUNBOOK.md` | **Entregable Obligatorio** | Runbook operacional transaccional con pasos previos, comando atómico y procedimiento de rollback. |
| `docs/G28_CONTINUITY_HANDOFF.md` | **Entregable Obligatorio** | Documento de continuidad y handoff hacia el hito G28 / corte formal de GA. |
| `ROADMAP.md` | **Actualización** | Actualización de estado de hitos, criterios de salida de v0.4.0 GA y próximas prioridades. |

---

## 3. Resultados Detallados de Pruebas de Regresión y Compatibilidad

```
========================================================================================
RESUMEN DE SUITES DE PRUEBAS VERIFICADAS EN EL HITO G27
========================================================================================
Suite                                  | Pruebas  | Aprobadas | Tasa     | Estado
---------------------------------------|----------|-----------|----------|--------------
G27 Evocara Compatibility Suite        | 9        | 9         | 100.0 %  | APROBADO
Canonical Retrieval Benchmark (rc7)    | 105      | 105       | 100.0 %  | APROBADO
BM25Engine Pure Unit Suite             | 9        | 9         | 100.0 %  | APROBADO
Spanish Multilingual Retrieval Suite   | 7        | 7         | 100.0 %  | APROBADO
Item Coordination & Unanswerable (K=0) | 4        | 4         | 100.0 %  | APROBADO
Robustness & Ranking Invariants Suite  | 10       | 10        | 100.0 %  | APROBADO
Curated 8-Tool MCP Surface Suite       | 9        | 9         | 100.0 %  | APROBADO
InventoryHub Staging Promotion (rc11)  | 8 fases  | 8 fases   | 100.0 %  | APROBADO
InventoryHub Business Tests in Staging | 34       | 34        | 100.0 %  | APROBADO
========================================================================================
TOTAL COMBINADO                        | 195      | 195       | 100.0 %  | REGRESIÓN CERO
========================================================================================
```

---

## 4. Estado de Protección del Consumidor Activo (`InventoryHub`)

- **Ruta de Producción Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión en Vivo Comprobada:** `0.3.14-rc4`
- **Integridad de Archivos:** **0 mutaciones en disco (100 % inalterado)**.
- **Pruebas de Negocio en Vivo Ejecutadas:**
  - `test_inventory_manager.js`: **PASS**
  - `test_phase_2c2_full.js`: **PASS (24/24)**
  - `test_phase_2c4_post_cleanup.mjs`: **PASS (10/10)**
- **Total en Vivo:** **34 / 34 APROBADAS**.
- **Política de Release Respetada:** La promoción no fue forzada sobre el consumidor activo. Queda redactado el runbook de promoción transaccional y el script de rollback en espera de la autorización humana del usuario.

---

## 5. Clasificación de Release y Criterios para Evocara v0.4.0 GA

- **Clasificación:** **RELEASE CANDIDATE CALIFICADO (Candidate rc11)**.
- **Evaluación de Criterios de GA:**
  - [x] Benchmark canónico 105/105 aprobado (100.0 % Precision@1, MRR 1.000).
  - [x] Cero alucinaciones en consultas no respondibles ($K=0$).
  - [x] Aislamiento de proyecto estricto con fallo cerrado comprobado.
  - [x] Sesión prolongada en OpenCode certificada con compactación a 1 MB y handoff < 1 ms.
  - [x] Superficie MCP curada (8 herramientas) y catálogo completo (42 herramientas).
  - [x] Transición de nomenclatura Evocara implementada con alias duales compatibles.
  - [x] SBOM CycloneDX 1.5 generado y validado criptográficamente contra el tarball.
  - [x] Auditoría de dependencias realizada y riesgos evaluados.
  - [x] Staging de InventoryHub con 34/34 pruebas de negocio aprobadas bajo rc11.
  - [x] Rollback atómico ensayado con paridad de bytes del 100 %.
  - [ ] **Promoción en vivo de InventoryHub autorizada por el usuario.**
  - [ ] **Corte formal y publicación de Evocara v0.4.0 GA.**
