# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G36
## Adopción Pública y Continuidad Operativa de Evocara v0.4.0 GA

- **Fecha:** 25 de octubre de 2026
- **Autor / Rol:** Antigravity (Senior Software Architect & Release Manager)
- **Hito G35:** PARCIALMENTE COMPLETADO (Tag Git `v0.4.0` publicado en GitHub; `npm publish` y release web pendientes)
- **Hito G36:** BLOQUEADO POR DEPENDENCIA (A la espera de disponibilidad pública de `evocara@0.4.0` en npm)
- **Próximo Paso Inmediato:** El propietario debe ejecutar el comando manual de publicación en npm y adjuntar los artefactos en GitHub Releases con sus credenciales personales.

---

## 1. Identificación de Fuentes y Estado Técnico Confirmado

- **Repositorio Canónico Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Local:** `master`
- **HEAD Local:** `799597c0418ec74cc4b3d4793e3cb04e4cccb927`
- **Remoto Canónico:** `https://github.com/Blueisazul/Evocara.git`
- **HEAD Remoto:** `799597c0418ec74cc4b3d4793e3cb04e4cccb927` (`origin/master` sincronizado)
- **Tag Oficial de Release:** `v0.4.0` verificado remotamente en GitHub ([https://github.com/Blueisazul/Evocara/tree/v0.4.0](https://github.com/Blueisazul/Evocara/tree/v0.4.0))
- **Artefactos Locales Protegidos e Inmutables:**
  - Tarball: `.work/artifacts/evocara-0.4.0.tgz` (SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`, 209,910 bytes)
  - SBOM: `.work/artifacts/evocara-0.4.0.cdx.json` (SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`, 41,973 bytes)
  - Manifiesto: `.work/artifacts/evocara-0.4.0-manifest.json` (SHA-256: `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108`, 3,074 bytes)
- **Consumidor Real InventoryHub:** 34/34 pruebas aprobadas; `inventory-data.json` ausente.
- **Copia Histórica Downloads:** Preservada intacta (9,528 archivos).

---

## 2. Estado de Publicación Externa

- **Registro npm (`registry.npmjs.org`):** `404 Not Found`. `evocara@0.4.0` no está publicado todavía.
- **GitHub Releases:** No existe release pública formalizada aún (lista vacía en API de GitHub).
- **Tag Git Remoto:** `v0.4.0` publicado exitosamente en GitHub.

---

## 3. Decisiones Técnicas Tomadas y Justificación

1. **No Falsificación ni Simulación de Adopción de Registro:** Conforme a la regla arquitectónica de no simular una publicación ni sustituir el registro público por una instalación local sin dejar clara la diferencia, el Hito G36 no ejecutó `npm install` contra el tarball local para fingir una adopción de registro.
2. **Respeto a las Operaciones Manuales del Propietario:** No se solicitaron tokens ni se intentaron eludir las restricciones de autenticación (`ENEEDAUTH`).
3. **Inmutabilidad Absoluta de Artefactos:** Los 3 archivos protegidos de GA no fueron regenerados ni modificados.

---

## 4. Runbook de Cierre para el Propietario

En cuanto el propietario ejecute:

```bash
# 1. En una terminal personal autenticada:
npm login
npm publish .work/artifacts/evocara-0.4.0.tgz --access public

# 2. En el navegador:
# Crear la release en https://github.com/Blueisazul/Evocara/releases/new
# Seleccionar tag: v0.4.0
# Título: Evocara v0.4.0 GA — Deterministic Operational Memory & Stage Governance
# Copiar notas de docs/G35_TECHNICAL_REPORT.md
# Adjuntar los 3 archivos de .work/artifacts/
```

Antigravity procederá de inmediato con la suite automatizada de adopción limpia de G36 (`npm install evocara@0.4.0`), validando la resolución pública de módulos, CLI, MCP y persistencia local sin riesgos para los consumidores locales existentes.
