# REGISTRO DE CIERRE DE RELEASE Y PROVENIENCIA (HITO G29)
## Delimitación de Estados de Release, Proveniencia Criptográfica y Gobernanza de Despliegue

- **Fecha de Corte:** 22 de octubre de 2026
- **Release Manager & Arquitecto:** Arquitecto de Software Senior de Evocara
- **Nombre Canónico del Paquete:** `evocara`
- **Versión Oficial:** `0.4.0` (General Availability)
- **Artefacto de Distribución:** `.work/artifacts/evocara-0.4.0.tgz` (209,910 bytes, SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`)
- **SBOM CycloneDX 1.5:** `.work/artifacts/evocara-0.4.0.cdx.json` (41,973 bytes, SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`)
- **Manifiesto de Release:** `.work/artifacts/evocara-0.4.0-manifest.json` (3,074 bytes)

---

## 1. Delimitación Estricta de Estados de Release

Para evitar ambigüedades operativas, se formaliza la distinción entre los tres estados del ciclo de vida del software:

```
┌─────────────────────────────────┐      ┌─────────────────────────────┐      ┌─────────────────────────────┐
│     ARTEFACTO GA CALIFICADO     │      │      RELEASE PUBLICADA      │      │     DESPLIEGUE PROMOVIDO    │
│  (Construcción Criptográfica)   │  !=  │  (Distribución en Registro) │  !=  │   (Consumidor en Producción)│
│                                 │      │                             │      │                             │
│  • evocara-0.4.0.tgz generado   │      │  • npm publish ejecutado    │      │  • InventoryHub actualizado │
│  • SBOM y Manifiesto enlazados  │      │  • Git tags creados en remoto│     │  • node_modules activo mutado│
│  • 100% Suites en Staging PASS  │      │  • Tarball en CDN/Registro  │      │  • Tráfico real procesado   │
│                                 │      │                             │      │                             │
│      [ESTADO: COMPLETADO]       │      │   [ESTADO: NO PUBLICADO]    │      │    [ESTADO: NO PROMOVIDO]   │
└─────────────────────────────────┘      └─────────────────────────────┘      └─────────────────────────────┘
```

1. **Artefacto GA Calificado [COMPLETADO]:**
   - El tarball `evocara-0.4.0.tgz` fue empaquetado, verificado criptográficamente y validado en sandbox limpio y staging aislado. Cumple al 100 % los criterios técnicos para GA.
2. **Release Publicada [PENDIENTE / NO EJECUTADO]:**
   - No se ha ejecutado `npm publish`.
   - No se han creado tags de Git remotos ni se ha realizado `git push`.
   - No se han enviado credenciales ni tokens OIDC a registros externos.
3. **Despliegue Promovido en Consumidor [PENDIENTE / NO EJECUTADO]:**
   - El consumidor activo de referencia `InventoryHub` permanece en `0.3.14-rc4`.
   - No se han mutado dependencias activas ni bases de datos de producción.

---

## 2. Registro de Proveniencia y Trazabilidad Criptográfica

| Atributo | Valor Registrado | Mecanismo de Validación |
|---|---|---|
| **Repositorio Canónico** | `https://github.com/Evocara/OpenMemory` | Metadato de manifiesto SLSA v1.0 |
| **Commit Base de Git** | `9dfd79c260e34636d4df91829f33f107db9240fa` | `git log -1` y `manifest.source.commit` |
| **Rama de Trabajo** | `master` | `git branch` y `manifest.source.branch` |
| **Tarball SHA-256** | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` | Recalculado vía Node.js Crypto |
| **Tarball Tamaño** | 209,910 bytes | `fs.statSync()` exacto |
| **SBOM SHA-256** | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` | Recalculado vía Node.js Crypto |
| **Nivel SLSA** | SLSA Build Level 1 Candidate (Local) / Nivel 2+ (Configurado en CI) | `.github/workflows/ci.yml` con `actions/attest-build-provenance` |
| **Árbol de Dependencias** | 96 componentes rastreados en CycloneDX 1.5 | `scripts/generate-sbom.js --validate` (Exit 0) |

---

## 3. Compatibilidad Dual de Nomenclatura (`evocara` y `openmemory`)

Para garantizar que los consumidores heredados no sufran rupturas de contrato mientras se adopta la nueva marca Evocara, se certifica la compatibilidad dual:

1. **Binarios de Línea de Comandos (CLI):**
   - Comando `evocara`: Binario principal mapeado a `./dist/cli.js`.
   - Comando `openmemory`: Alias canónico retrocompatible mapeado a `./dist/cli.js`.
   - Ambos comandos aceptan las mismas sub-órdenes: `version`, `help`, `status`, `query`, `init`.
2. **Superficie MCP (Model Context Protocol):**
   - `openmemory_*`: Prefijo predeterminado para herramientas curadas (8 herramientas esenciales) y perfil completo.
   - `evocara_*`: Prefijo configurable (`EVOCARA_MCP_PREFIX=evocara` o exportación `createEvocaraMCPServer`).
   - Modo `dual`: Soporte simultáneo de ambos prefijos para clientes que requieran transición gradual.
3. **Exportaciones del Paquete:**
   - Ambas nomenclaturas comparten el mismo motor `StorageEngine`, `StageEngine` y `KnowledgeTMS`.
   - Compatibilidad demostrada en la suite `test-g27-evocara-compatibility.js` (9/9 pruebas aprobadas al 100 %).

---

## 4. Medidas Preventivas contra Promociones o Publicaciones Accidentales

Para mitigar riesgos de intervención destructiva:
1. **Separación de Directorios:**
   - `OpenMemory/OpenMemory` es el espacio de desarrollo y construcción del motor.
   - `OpenMemory/InventoryHub` es el consumidor activo de referencia.
   - Ningún script de compilación (`npm run build`, `npm pack`) tiene permitido escribir o instalar dentro de `InventoryHub`.
2. **Bloqueo Fail-Closed en Motor de Promoción:**
   - `TransactionalPromotionEngine` rechaza intervenir si `consumerPath` coincide con la raíz del motor `OpenMemory`.
   - Requiere presencia física de `package.json` y valida versión original antes de mutar.
3. **Mecanismo de Lock Exclusivo:**
   - La presencia de `.promotion.lock` previene colisiones concurrentes y carreras entre procesos.

---

## 5. Checklist de Aprobación Humana para Despliegue y Publicación

Cualquier operación que modifique el estado de publicación o despliegue exige la firma explícita de los siguientes puntos por el operador humano:

- [ ] **Autorización de Publicación en Registro npm:**
  - [ ] Credenciales de publicación verificadas en entorno aislado (2FA activo).
  - [ ] Aprobación de nombre de paquete público `evocara@0.4.0`.
  - [ ] Ejecución de `npm publish .work/artifacts/evocara-0.4.0.tgz --access public`.
- [ ] **Autorización de Tag y Push en Git:**
  - [ ] Confirmación del commit base `9dfd79c260e34636d4df91829f33f107db9240fa`.
  - [ ] Creación de tag firmado: `git tag -s v0.4.0 -m "Release Evocara v0.4.0 GA"`.
  - [ ] Push controlado a rama protegida: `git push origin v0.4.0`.
- [ ] **Autorización de Promoción de InventoryHub:**
  - [ ] Lectura del runbook `docs/G29_PROMOTION_RUNBOOK.md`.
  - [ ] Verificación de 34/34 pruebas de negocio previas.
  - [ ] Autorización explícita del comando de mutación de `TransactionalPromotionEngine`.
  - [ ] Ejecución de comprobaciones posteriores y validación de 34/34 pruebas post-promoción.
