# REGISTRO DE RELEASE CANDIDATE DEFINITIVO (HITO G28)
## Paquete de Producción Evocara v0.4.0 GA, Manifiestos y Verificación Criptográfica

- **Fecha de Corte:** 22 de octubre de 2026
- **Responsable de Release:** Arquitecto de Software & Release Manager
- **Nombre Canónico del Paquete:** `evocara`
- **Versión de Release:** `0.4.0` (Corte definitivo para General Availability)
- **Denominación del Artefacto:** `evocara-0.4.0.tgz`
- **Ubicación en el Repositorio:** `.work/artifacts/evocara-0.4.0.tgz`
- **Estado de Calificación:** **CALIFICADO Y CERTIFICADO PARA GA**

---

## 1. Identificadores Criptográficos y Metadatos

| Propiedad | Valor Oficial Verificado |
|---|---|
| **Nombre del Paquete** | `evocara` |
| **Versión SemVer** | `0.4.0` |
| **Archivo Tarball** | `evocara-0.4.0.tgz` |
| **Tamaño del Tarball** | `209,910 bytes` (209.9 KB) |
| **Hash SHA-256 (Tarball)** | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` |
| **Archivo SBOM** | `evocara-0.4.0.cdx.json` |
| **Tamaño del SBOM** | `41,973 bytes` |
| **Hash SHA-256 (SBOM)** | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` |
| **Estándar SBOM** | CycloneDX 1.5 JSON |
| **Archivo de Manifiesto** | `evocara-0.4.0-manifest.json` |
| **Tamaño del Manifiesto** | `3,074 bytes` |
| **Commit Base de Git** | `9dfd79c260e34636d4df91829f33f107db9240fa` |
| **Rama de Trabajo** | `master` |
| **Entorno de Compilación** | Node.js `v22.15.0`, npm `10.9.2`, TypeScript `7.0.2`, Windows x64 |

---

## 2. Comparativa respecto al Candidato Anterior (`openmemory-0.3.15-rc11.tgz`)

| Dimensión | Candidato G27 (`openmemory@0.3.15-rc11`) | Release Definitiva G28 (`evocara@0.4.0`) |
|---|---|---|
| **Nombre de Paquete en npm** | `openmemory` | `evocara` |
| **Versión** | `0.3.15-rc11` | `0.4.0` |
| **Tamaño del Tarball** | 208,927 bytes | 209,910 bytes (+983 bytes por documentación y aliases) |
| **Total de Archivos en Paquete** | 76 | 76 |
| **Binarios CLI** | `openmemory`, `evocara` | `evocara`, `openmemory` |
| **Firma CLI Version** | `Evocara (formerly OpenMemory) v0.4.0-rc1` | `Evocara (formerly OpenMemory) v0.4.0` |
| **Exportaciones de Instalador** | `installOpenMemory`, `uninstallOpenMemory` | `installEvocara`, `installOpenMemory`, `uninstallEvocara` |
| **Configuración MCP** | Servidor `openmemory` | Servidores duales `evocara` y `openmemory` |
| **Tarball SHA-256** | `CCEEB715604BF64F1287F732F704683F...` | `70F31DA7E822BFA8ECE60395212E009C...` |
| **SBOM SHA-256** | `3f123387ddcbc70fc9387a45bea36522...` | `6621e53a415cc7406c02bfcbf55a769c...` |

---

## 3. Resumen Consolidado de Suites Ejecutadas en G28

| Suite de Validación | Script / Comando | Resultado | Evidencia / Métricas |
|---|---|---|---|
| **Compilación TypeScript** | `npm run build` | **PASS (0 errores)** | 21 artefactos generados en `dist/` |
| **Unitaria BM25Engine** | `test-g25-bm25-unit.js` | **9/9 PASSED (100%)** | Ponderación, matching multilingüe y ranking |
| **Benchmark Canónico 105** | `test-g23-expanded-100-benchmark.js` | **105/105 PASSED (100%)** | P@1: 100 %, MRR: 1.000, FDR: 0.0 % |
| **Español Multilingüe** | `test-g24-multilingual-spanish.js` | **7/7 PASSED (100%)** | Diacríticos, stopwords y consultas en español |
| **Consultas No Respondibles** | `test-g24-coordination-unanswerable.js` | **4/4 PASSED (100%)** | K=0 garantizado, supresión cuadrática |
| **Invariantes y Robustez** | `test-g23-robustness-invariants.js` | **10/10 PASSED (100%)** | Aislamiento de proyecto, determinismo |
| **Superficie Curada MCP** | `test-g25-mcp-curated-surface.js` | **9/9 PASSED (100%)** | Perfil curado de 8 herramientas (~1,450 tokens) |
| **Compatibilidad Dual G27** | `test-g27-evocara-compatibility.js` | **9/9 PASSED (100%)** | Invocación `evocara_*` / `openmemory_*` y CLI dual |
| **Instalación Limpia Tarball** | `test-g28-clean-installation.js` | **4/4 PASSED (100%)** | Sandbox limpio: `npm install evocara-0.4.0.tgz` |
| **Calificación en Staging** | `test-g28-inventoryhub-staging-promotion.js` | **8/8 FASES PASSED** | 34/34 pruebas de negocio aprobadas bajo v0.4.0 |
| **Simulacro de Rollback** | `test-g28-inventoryhub-staging-promotion.js` | **ROLLED_BACK (100%)** | Paridad de bytes del 100 % en restauración |
| **Validación de SBOM** | `node scripts/generate-sbom.js --validate` | **PASS (Exit 0)** | 96 componentes rastreados, atado a tarball |
| **Validación de Manifiesto** | `node scripts/generate-release-manifest.js` | **PASS (Exit 0)** | Esquema SLSA y enlaces criptográficos verificados |

---

## 4. Estado de Protección del Consumidor Activo

- **Consumidor:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Activa Verificada:** `0.3.14-rc4` (Sin modificaciones en disco, 0 mutaciones realizadas).
- **Pruebas de Negocio en Vivo:** 34/34 aprobadas.
- **Autorización de Promoción:** Pendiente de confirmación humana explícita por el usuario.
