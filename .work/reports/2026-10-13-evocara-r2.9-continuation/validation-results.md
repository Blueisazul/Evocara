# Resultados de validación R2.9

| Comprobación | Comando/fuente | Resultado real | Alcance/límite |
|---|---|---|---|
| Checkout raíz/rama/HEAD | `Get-Location`; `git rev-parse --show-toplevel`, `--abbrev-ref HEAD`, `HEAD` | PASS: ruta esperada, `master`, `4ab1463446c72bd557f3a6d340285259743f23e9` | Solo identidad Git. |
| Estado Git | `git status --short` al inicio/cierre | PASS: siete modificaciones rastreadas conocidas más reportes no rastreados; solo R2.9 agregado | No se leyó contenido de `.openmemory/` ni `.work/evidence/`. |
| Documentos requeridos R2.8 | `Test-Path` para continuidad, register, design, matrix, report y manifest | R2.8 prompt/register/matrix/report/manifest existen. `R2.8/implementation-design.md` no existe; el prompt apunta a R2.6, donde está el diseño | Discrepancia de ubicación identificada y acotada. |
| Respuestas nuevas de owner | Lectura de formulario `owner-decisions.md` R2.4.2 y registros R2.7/R2.8 | No hay respuestas rellenadas ni aprobación nueva identificada | No se infiere autorización del silencio. |
| Integridad R2.8 | Parse de `verification-result.json`; recálculo de los seis `newArtifactHashes` | PASS: JSON válido, 6/6 coinciden | No valida verdad funcional de documentos. |
| Runtime instalado | `node --version`; `npm --version`; `node -p "JSON.stringify({version:process.version,platform:process.platform,arch:process.arch})"` | `v22.15.0`, `10.9.2`, `win32/x64` | Observado en esta máquina; no es soporte oficial de Evocara. |
| Runtime declarado por proyecto | Lectura de `package.json` | No hay campo `engines`; paquete `openmemory@0.1.0` | No define matriz mínima del producto. |
| Driver declarado por producto | `Select-String -SimpleMatch 'better-sqlite3' package.json package-lock.json` | Sin coincidencias | No se inspeccionó `node_modules`; no se infiere estado de instalación de paquete fuera de manifests. |
| Driver upstream 13.0.3 | [tag package.json](https://raw.githubusercontent.com/WiseLibs/better-sqlite3/v13.0.3/package.json) | Publica MIT, Node `>=22`, `node-addon-api ^8.0.0`, `gypfile:false`; exports indican targets Linux/macOS/Windows x64/arm64 y Linux musl | Fuente upstream, no install local ni garantía de prebuild por target. |
| Fallback/build | [tag binding.gyp](https://raw.githubusercontent.com/WiseLibs/better-sqlite3/v13.0.3/binding.gyp), [compilation docs](https://raw.githubusercontent.com/WiseLibs/better-sqlite3/v13.0.3/docs/compilation.md) | Fallback compila fuentes C++ si falta prebuild; C++20 aparece en configuración | No se invocó compiler/node-gyp. |
| Riesgo de instalación Windows | [issue upstream #1516](https://github.com/WiseLibs/better-sqlite3/issues/1516) | Issue abierto reporta node-gyp/Python en clean install con v13.0.3 | No reproducido localmente; no prueba resultado para cada entorno. |
| P01–P12 / funcionalidad | No ejecutados por autorización vigente | `NOT RUN`; piloto `DENIED` | Sin aceptación técnica/funcional. |
| Instalación/build/tests/DB/migración/backup-restore/benchmark | No ejecutados | `NOT RUN` | Prohibido por D-02/piloto pendientes y alcance R2.9. |

## Referencias de decisión cruzada

- D-02 se bloquea en selección explícita de candidato/runtime/targets/install policy.
- D-04 autoridad por entidad sigue pendiente; no cambiar canon.
- D-07 CAS es requisito aprobado con límites; semantics/commit mapping no implementados ni probados.
- D-09 requiere D-06 para principal, D-04 para authority y D-07 para atomicity; receipt/unknown/retención pendientes.
- D-10 es objetivo fail-closed; la implementación no se acepta ni revalida en esta misión.
- P09/P10 requieren además D-05/D-08/D-13; P01–P12 siguen bloqueados por permiso del piloto.
