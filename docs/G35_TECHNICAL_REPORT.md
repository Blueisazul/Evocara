# INFORME TÉCNICO DE EJECUCIÓN — HITO G35
## Certificación de Release y Publicación Oficial de Evocara v0.4.0 GA

- **Fecha:** 25 de octubre de 2026
- **Responsable:** Senior Software Architect, Release Engineering & Supply Chain Assurance
- **Estado del Hito:** TAG v0.4.0 PUBLICADO EN GITHUB / PENDIENTE PUBLICACIÓN MANUAL EN npm Y ASSETS DE RELEASE
- **Repositorio Canónico Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Canónica:** `master` (HEAD: `be36171d7ba3f3b683953fbc593e6e0658fc28f5`)
- **Repositorio Remoto:** `https://github.com/Blueisazul/Evocara.git`
- **Estado de Sincronización Remota:** 100 % sincronizado (ahead 0, behind 0; HEAD remoto coincide con `be36171`)
- **Tag Oficial de Release:** `v0.4.0` (creado y publicado en GitHub, apuntando a `be36171`)
- **Versión Objetivo:** `evocara@0.4.0`

---

## 1. Resumen Ejecutivo

El Hito G35 constituye la etapa de ingeniería de release, aseguramiento de la cadena de suministro y publicación formal de **Evocara v0.4.0 GA** (sucesor oficial y clean-room de OpenMemory).

Durante esta fase:
1. Se verificó el preflight mínimo del repositorio local y remoto, confirmando paridad total entre `master` y `origin/master`.
2. Se certificó la inmutabilidad y los hashes criptográficos SHA-256 del tarball GA (`evocara-0.4.0.tgz`), SBOM CycloneDX (`evocara-0.4.0.cdx.json`) y el Manifiesto de Procedencia SLSA v1.0 (`evocara-0.4.0-manifest.json`).
3. Se auditó el contenido del paquete (76 archivos de distribución exactos; cero archivos `.env`, cero claves privadas, cero datos sensibles o de desarrollo interno).
4. Se ejecutó una validación en sandbox aislado instalando el tarball en un workspace limpio temporal (`test-g35-isolated-install.js`), certificando la ejecución limpia de los binarios CLI (`evocara` y `openmemory`), las 45 exportaciones del paquete y los adaptadores MCP.
5. Se comprobó la integridad del consumidor de desarrollo `InventoryHub`, aprobando el 100 % de las pruebas de negocio (34/34 tests) con preservación absoluta de la ausencia del JSON legado (`inventory-data.json`).
6. Se presentó la solicitud formal de autorización al propietario para las operaciones externas. El propietario autorizó expresamente la sincronización de `master` y el envío del tag Git `v0.4.0` a GitHub, acordando realizar el `npm publish` y el adjunto de artefactos en la GitHub Release manualmente en su terminal/navegador con sus credenciales personales.
7. Se ejecutó `git tag -a v0.4.0` y `git push origin master v0.4.0`, verificándose remotamente vía Git y API de GitHub.

---

## 2. Fase A: Preflight Mínimo y Verificación del Estado Real

### 2.1. Estado de Git y Grafo de Commits
- **Ruta:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Local:** `master`
- **HEAD Local:** `be36171d7ba3f3b683953fbc593e6e0658fc28f5`
- **HEAD Remoto (`origin/master`):** `be36171d7ba3f3b683953fbc593e6e0658fc28f5`
- **Divergencia:** 0 commits ahead, 0 commits behind.
- **Ramas y Tags Remotos:** `origin/master` sincronizado; tag oficial `v0.4.0` publicado junto con tags históricos `v0.3.0` y `v0.3.1`.
- **Copia Histórica Protegida:** `C:\Users\sant1\Downloads\OpenMemory` verificada con 9,528 archivos intactos e inalterados.

### 2.2. Inventario Criptográfico de Artefactos GA Protegidos

| Artefacto | Ruta | Tamaño (Bytes) | SHA-256 Declarado / Verificado | Estado |
|---|---|---|---|---|
| **Tarball GA** | `.work/artifacts/evocara-0.4.0.tgz` | `209,910` | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` | **INMUTABLE (100 % Match)** |
| **SBOM CycloneDX** | `.work/artifacts/evocara-0.4.0.cdx.json` | `41,973` | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` | **INMUTABLE (100 % Match)** |
| **Manifiesto SLSA** | `.work/artifacts/evocara-0.4.0-manifest.json` | `3,074` | `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108` | **INMUTABLE (100 % Match)** |

---

## 3. Fase B: Certificación Reproducible del Paquete

### 3.1. Inspección de Archivos Empaquetados
Se realizó la inspección forense del tarball `.work/artifacts/evocara-0.4.0.tgz` frente a la simulación `npm pack --dry-run`:
- **Total de Archivos en Tarball:** 76 archivos.
- **Total de Archivos en Dry-Run:** 76 archivos.
- **Discrepancias:** 0 archivos faltantes, 0 archivos sobrantes (Paridad 100 %).
- **Auditoría de Higiene:**
  - Cero archivos de entorno (`.env`, `.env.*`).
  - Cero certificados o claves privadas (`*.pem`, `*.key`).
  - Cero artefactos de pruebas o directorios experimentales (`.work/`, `tests/`, `experiments/`).
  - Cero bases de datos locales (`.openmemory/`, `*.sqlite`, `*.db`).
  - Archivos estrictamente de distribución: `dist/` (JavaScript compilado, TypeScript `.d.ts` y mapas `.map`), `config/`, `.opencode/`, `mcp_config.json`, `AGENTS.md`, `README.md` y `LICENSE`.

### 3.2. Superficie de Exportación y Binarios CLI
- **Identificadores Binarios:**
  - `evocara` -> `./dist/cli.js`
  - `openmemory` -> `./dist/cli.js` (alias compatible)
- **Subpath Exports Declarados en `package.json`:**
  - `.` (Main entry: 45 exportaciones)
  - `./storage` (`StorageEngine`, `PersistenceEngine`, `HealthCoordinator`)
  - `./stage-engine` (`StageEngine`)
  - `./master-prompt` (`MasterPromptGovernance`)
  - `./installer` (`installEvocara`, `installOpenMemory`)
  - `./plugin` (`createOpenMemoryPlugin`)
  - `./mcp` (`createMCPServer`, `registerTools`, catálogo curado)
  - `./cli`
  - `./package.json`
- **Dependencias Externas de Runtime:** Estrictamente 2 dependencias esenciales:
  - `@modelcontextprotocol/sdk` (`^1.30.1`)
  - `zod` (`^3.23.0`)

---

## 4. Fase C: Validación y Regresión Proporcional al Riesgo

### 4.1. Resultados de las Baterías de Validación

1. **Compilación TypeScript (`npm run build`):**
   - Comando: `tsc`
   - Código de salida: `0` (Limpio, 0 errores, 0 advertencias).
2. **Validación de Contratos y Caja Negra del Tarball (`test-g33-artifact-contract-validation.js`):**
   - Extracción en sandbox temporal `AppData\Local\Temp\evocara-g33-verify-*`.
   - Verificación de 45 símbolos exportados.
   - Inicialización de `StorageEngine`, gobernanza ADR, registro de sesión y búsqueda determinista BM25.
   - Código de salida: `0` (100 % PASS).
3. **Smoke Test de Instalación Aislada (`test-g35-isolated-install.js`):**
   - Inicialización de proyecto consumidor sintético en workspace temporal `AppData\Local\Temp\evocara-g35-install-*`.
   - `npm install ../artifacts/evocara-0.4.0.tgz`.
   - Ejecución de `node_modules/evocara/dist/cli.js --help`.
   - `require('evocara')`, `require('evocara/storage')`, `require('evocara/mcp')`.
   - Código de salida: `0` (100 % PASS).
4. **Validación del Consumidor Real InventoryHub:**
   - Ubicación: `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
   - Dependencia activa: `evocara: file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz`
   - `test_phase_2c4_post_cleanup.mjs`: **10/10 PASS** (confirmación estricta de que `inventory-data.json` permanece AUSENTE).
   - `test_phase_2c2_full.js`: **24/24 PASS** (FIFO, COGS, reversión de déficit, precisión monetaria y persistencia SQLite entre procesos).
   - Total de pruebas en consumidor: **34/34 PASS (100 %)**.

---

## 5. Fase D: Preparación de la Publicación y Auditoría de Destinos

### 5.1. Estado del Registro npm
- **Consulta:** `npm view evocara`
- **Resultado:** `E404 Not Found - GET https://registry.npmjs.org/evocara - Not found`
- **Interpretación:** El nombre `evocara` está libre y disponible para registro inicial en npm. No existen colisiones de versión ni paquetes preexistentes.
- **Estado de Autenticación Local:**
  - `npm whoami` arrojó `ENEEDAUTH`.
  - No existe sesión activa en la máquina local. Se requiere autenticación interactiva (`npm login` / `npm adduser`) o provisión de `NPM_TOKEN` para ejecutar `npm publish`.

### 5.2. Estado de GitHub Releases
- **Consulta:** `GET https://api.github.com/repos/Blueisazul/Evocara/releases`
- **Resultado:** `[]` (Sin releases creadas previamente en el repositorio).
- **Herramienta CLI:** `gh` CLI no está instalado en el sistema operativo.
- **Estrategia de Release GitHub:**
  - Crear el tag Git localmente: `git tag -a v0.4.0 -m "release: Evocara v0.4.0 GA"`
  - Enviar el tag al remoto: `git push origin v0.4.0`
  - Generar la GitHub Release adjuntando los artefactos vía API REST de GitHub o mediante la interfaz web oficial.

---

## 6. Notas de Release Formales (Borrador v0.4.0 GA)

```markdown
# Evocara v0.4.0 GA — Deterministic Operational Memory & Stage Governance

Evocara v0.4.0 marca la primera versión de Disponibilidad General (GA) del framework de memoria determinista, gobernanza de ciclo de vida de desarrollo y adaptadores MCP para agentes de desarrollo de software (anteriormente conocido como OpenMemory).

Esta versión establece la identidad formal de **Evocara** con compatibilidad hacia atrás del 100 % con OpenMemory, proporcionando un motor de almacenamiento local-first basado en SQLite, consultas bi-temporales point-in-time, reconstrucción de linaje causal de decisiones y continuidad probada entre sesiones.

### Novedades y Capacidades Certificadas

1. **Modelo de Conocimiento Bi-Temporal y Consultas Point-in-Time (Hito G30):**
   - Representación explícita de tiempo de dominio $[validFrom, validUntil)$ y tiempo de sistema $[recordedAt, supersededAtSystem)$.
   - Método `queryKnowledgePointInTime` en `StorageEngine` y `KnowledgeTMS`, permitiendo reconstruir exactamente qué sabía el sistema en cualquier punto temporal sin alucinaciones.
   - Calibración de certidumbre epistémica (`HIGH`, `INCONCLUSIVE`, `UNANSWERABLE`).

2. **Linaje Causal de Decisiones y Detección de Contradicciones (Hito G31):**
   - Función `explainDecisionLineage(itemId)` bidireccional sobre relaciones `SUPERSEDES` y `DERIVED_FROM`.
   - Detección determinista de contradicciones temporales activas ante versiones concurrentes.
   - Síntesis contextual estructurada de decisiones (`DecisionSynthesis`).
   - Exposición MCP dual: `openmemory_explain_lineage` y `evocara_explain_lineage`.

3. **Continuidad Inter-Sesión Demostrada en Consumidores Reales (Hito G32):**
   - Benchmark empírico sobre el consumidor real InventoryHub (7/7 escenarios aprobados en condición ON vs 1/7 en condición OFF).
   - Reducción del 88.6 % en tokens de contexto requeridos por el LLM.
   - Prevención activa de regresiones arquitectónicas y resurrección de archivos legados.

4. **Transición de Nomenclatura y Compatibilidad Hacia Atrás:**
   - Binarios CLI simétricos: `evocara` y `openmemory`.
   - Superficie MCP curada: 8 herramientas esenciales para LLM y 42 herramientas en modo extendido.
   - Alias duales compatibles en todas las herramientas MCP (`evocara_*` y `openmemory_*`).

5. **Aseguramiento de Cadena de Suministro y Reproducibilidad:**
   - SBOM en estándar CycloneDX v1.5 (`evocara-0.4.0.cdx.json`).
   - Manifiesto de procedencia SLSA v1.0 (`evocara-0.4.0-manifest.json`).
   - Cero dependencias externas complejas (únicamente `@modelcontextprotocol/sdk` y `zod`).

### Artefactos de Release y Hashes Criptográficos

- **evocara-0.4.0.tgz** (209,910 bytes)
  `SHA-256: 70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
- **evocara-0.4.0.cdx.json** (41,973 bytes)
  `SHA-256: 6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
- **evocara-0.4.0-manifest.json** (3,074 bytes)
  `SHA-256: 5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108`
```

---

---

## 7. Distinción Rigurosa del Estado Actual del Proyecto

- **Implementado:** SÍ (Evocara v0.4.0 GA completo, motor bi-temporal, linaje causal, BM25).
- **Probado y Certificado:** SÍ (34/34 InventoryHub, 18/18 G31, 15/15 G30, 105/105 BM25, pruebas de instalación en sandbox aislada).
- **Empaquetado:** SÍ (`.work/artifacts/evocara-0.4.0.tgz` inmutable y certificado).
- **Integrado Localmente:** SÍ (`master` en commit `be36171`).
- **Sincronizado con GitHub:** SÍ (Rama `master` sincronizada en `https://github.com/Blueisazul/Evocara.git` y Tag `v0.4.0` publicado).
- **Preparado para Publicación:** SÍ (Notas de release, artefactos, hashes y validaciones listos).
- **Publicado en npm:** **PENDIENTE DE PUBLICACIÓN MANUAL POR EL USUARIO** (Conforme a la opción autorizada por el propietario).
- **Publicado como GitHub Release:** **PENDIENTE DE CARGA DE ASSETS POR EL USUARIO** (Tag `v0.4.0` publicado en GitHub; release web pendiente de adjuntos).
- **Desplegado:** NO.

---

## 8. Runbook de Publicación Manual para el Propietario

Conforme a la autorización otorgada por el propietario en la sesión interactiva, el tag Git `v0.4.0` y la rama `master` han sido publicados en GitHub. Las acciones restantes a ejecutar por el usuario son:

1. **Publicación en el registro npm:**
   Ejecutar en tu terminal personal autenticada:
   ```bash
   npm login
   npm publish .work/artifacts/evocara-0.4.0.tgz --access public
   ```

2. **Formalización de la GitHub Release:**
   Acceder a `https://github.com/Blueisazul/Evocara/releases/new`:
   - Seleccionar el tag existente: `v0.4.0`
   - Título de la Release: `Evocara v0.4.0 GA — Deterministic Operational Memory & Stage Governance`
   - Pegar las notas de release preparadas en la Sección 6 de este documento.
   - Adjuntar los tres archivos inmutables certificados:
     - `.work/artifacts/evocara-0.4.0.tgz`
     - `.work/artifacts/evocara-0.4.0.cdx.json`
     - `.work/artifacts/evocara-0.4.0-manifest.json`
   - Publicar la release.
