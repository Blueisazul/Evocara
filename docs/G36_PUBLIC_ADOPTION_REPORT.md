# INFORME DE ADOPCIÓN PÚBLICA Y CIERRE TÉCNICO — HITO G36
## Validación de Adopción de Evocara v0.4.0 GA y Cierre de Publicación

- **Fecha:** 25 de octubre de 2026
- **Responsable:** Senior Software Architect, Release Engineering & Supply Chain Assurance
- **Estado de G35:** PARCIAL / PENDIENTE_MANUAL (TAG Git `v0.4.0` publicado en GitHub; `npm publish` y GitHub Release pendientes de ejecución manual por el propietario)
- **Estado de G36:** BLOQUEADO POR DEPENDENCIA (A la espera de publicación efectiva de `evocara@0.4.0` en el registro público de npm)
- **Repositorio Canónico Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Canónica:** `master` (HEAD: `84c742de6a428e7e734268ce740dcc3f246778be`)
- **Repositorio Remoto:** `https://github.com/Blueisazul/Evocara.git`
- **Tag Oficial de Release Verificado:** `v0.4.0` ([https://github.com/Blueisazul/Evocara/tree/v0.4.0](https://github.com/Blueisazul/Evocara/tree/v0.4.0))

---

## 1. Resumen Ejecutivo y Estado de Fuentes

El Hito G36 tiene como objetivo verificar la adopción pública y reutilización limpia de **Evocara v0.4.0 GA** como dependencia externa directamente desde el registro npm (`npm install evocara@0.4.0`), demostrando que un consumidor de terceros puede inicializar el almacenamiento local-first, ejecutar herramientas MCP y gozar de persistencia sin dependencias locales del repositorio de desarrollo.

### Precondición Crítica:
Conforme a las directivas de seguridad e integridad del proyecto:
1. **La validación desde el registro público de npm NO puede simularse ni sustituirse ficticiamente por una instalación local.**
2. En la inspección en vivo de `https://registry.npmjs.org/evocara`:
   - `npm view evocara` arrojó `E404 Not Found` (el paquete no ha sido publicado aún en npm).
3. En la inspección en vivo de la API de GitHub (`/repos/Blueisazul/Evocara/releases`):
   - Arrojó `[]` (la release con adjuntos de release aún no ha sido creada en la interfaz de GitHub).
4. El Tag oficial Git `v0.4.0` **SÍ está publicado y verificado en GitHub** apuntando al commit canónico `be36171`.
5. Por lo tanto, **G35 permanece parcialmente completado** y **G36 queda formalmente documentado como bloqueado por su precondición de disponibilidad pública en npm**, proporcionando al propietario la lista exacta de comandos pendientes.

---

## 2. Auditoría Criptográfica de Artefactos GA Locales Protegidos

Los tres artefactos de release certificados se mantienen inmutables y con verificación bit-a-bit al 100 %:

| Artefacto | Ruta | Tamaño (Bytes) | SHA-256 Verificado | Estado |
|---|---|---|---|---|
| **Tarball GA** | `.work/artifacts/evocara-0.4.0.tgz` | `209,910` | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` | **INMUTABLE (100 % Match)** |
| **SBOM CycloneDX** | `.work/artifacts/evocara-0.4.0.cdx.json` | `41,973` | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` | **INMUTABLE (100 % Match)** |
| **Manifiesto SLSA** | `.work/artifacts/evocara-0.4.0-manifest.json` | `3,074` | `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108` | **INMUTABLE (100 % Match)** |

---

## 3. Distinción Rigurosa: Validación Local vs Validación Pública de Registro

### 3.1. Validación del Artefacto Local (Completada en G35)
En el Hito G35 se ejecutó la suite `.work/experiments/test-g35-isolated-install.js` sobre un sandbox temporal (`AppData\Local\Temp\evocara-g35-install-*`), demostrando que el tarball empaquetado:
- Contiene exactamente 76 archivos auditados (0 secretos, 0 rutas absolutas, 0 archivos de desarrollo).
- Ejecuta los binarios CLI `dist/cli.js` bajo las identidades simétricas `evocara` y `openmemory`.
- Exporta 45 símbolos en su punto de entrada principal y soporta la importación limpia de `evocara/storage` y `evocara/mcp`.
- Proporciona inicialización limpia de SQLite sin llamadas de red obligatorias ni dependencias foráneas.

### 3.2. Validación desde el Registro Público de npm (G36 - Pendiente de Publicación)
Una vez que el propietario ejecute `npm publish`, el procedimiento automatizado de G36 ejecutará:
```bash
# En un directorio temporal completamente aislado:
npm init -y
npm install evocara@0.4.0
```
Y evaluará los contratos de resolución desde `registry.npmjs.org`:
1. **Puntos de entrada públicos:** `require('evocara')`, `require('evocara/storage')`, `require('evocara/mcp')`.
2. **Ejecución CLI:** `npx evocara --version` y `npx openmemory --version`.
3. **Persistencia entre procesos:** Escritura de un KnowledgeItem en SQLite, terminación del proceso Node.js, reapertura independiente y recuperación determinista del ítem.
4. **Superficie MCP Curada:** Creación del servidor MCP en modo estándar y verificación de las 8 herramientas esenciales.

---

## 4. Estado de los Consumidores Reales

### 4.1. InventoryHub (Consumidor Promovido)
- **Ruta:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Dependencia:** `evocara: file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz`
- **Pruebas Ejecutadas:**
  - `test_phase_2c4_post_cleanup.mjs`: **10/10 PASS** (`inventory-data.json` AUSENTE).
  - `test_phase_2c2_full.js`: **24/24 PASS** (FIFO, COGS, rollback de déficit, precisión decimal y persistencia SQLite entre procesos).
- **Total:** **34/34 PASS (100 %)**. Cero regresiones.

### 4.2. Copia Histórica Protegida
- **Ruta:** `C:\Users\sant1\Downloads\OpenMemory`
- **Estado:** 9,528 archivos preservados intactos.

---

## 5. Acciones Manuales Pendientes para el Propietario (Runbook de Cierre G35)

Para completar la publicación de G35 y habilitar la ejecución inmediata de las pruebas de registro público de G36:

1. **Paso 1: Publicar en npm**  
   En tu terminal con sesión iniciada en npm:
   ```bash
   npm login
   npm publish .work/artifacts/evocara-0.4.0.tgz --access public
   ```

2. **Paso 2: Formalizar la Release en GitHub**  
   Navega a [https://github.com/Blueisazul/Evocara/releases/new](https://github.com/Blueisazul/Evocara/releases/new):
   - **Tag version:** Selecciona `v0.4.0` (ya existe en GitHub).
   - **Release title:** `Evocara v0.4.0 GA — Deterministic Operational Memory & Stage Governance`
   - **Release notes:** Pega las notas documentadas en la Sección 6 de `docs/G35_TECHNICAL_REPORT.md`.
   - **Adjuntar archivos:**
     - `.work/artifacts/evocara-0.4.0.tgz`
     - `.work/artifacts/evocara-0.4.0.cdx.json`
     - `.work/artifacts/evocara-0.4.0-manifest.json`
   - Presiona **Publish release**.

---

## 6. Distinción Rigurosa del Estado Actual

- **Implementado:** SÍ (Evocara v0.4.0 GA completo).
- **Probado localmente:** SÍ (34/34 InventoryHub, contratos y smoke tests en sandbox).
- **Empaquetado y certificado:** SÍ (Tarball `evocara-0.4.0.tgz`, SBOM y manifiesto SLSA v1.0).
- **Sincronizado con GitHub:** SÍ (Rama `master` sincronizada en commit `799597c`; Tag oficial `v0.4.0` publicado en `https://github.com/Blueisazul/Evocara/tree/v0.4.0`).
- **Publicado en npm:** NO (Pendiente ejecución manual por el propietario con `npm login`).
- **Publicado como GitHub Release:** NO (Tag `v0.4.0` publicado; release web pendiente de adjuntos).
- **Instalado y validado desde npm:** NO (Bloqueado a la espera de `npm publish`).
- **Validado en consumidor real:** SÍ (InventoryHub en vivo, 34/34 tests PASS).
- **Desplegado:** NO.
