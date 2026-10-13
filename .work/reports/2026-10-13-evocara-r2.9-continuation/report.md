# Evocara R2.9 — validación de gate y continuidad

## Dictamen

**`COMPLETED_DOCUMENTAL`; driver y persistencia `BLOCKED_BY_AUTHORIZATION`.** Se validó la identidad del checkout, la integridad/hash de los artefactos R2.8 y se verificó Node/configuración local y metadatos oficiales fijados a `better-sqlite3@13.0.3`. No hay nueva aprobación del propietario. No se instaló el driver, no se creó DB ni se ejecutaron pruebas.

## Estado inicial/final

- Inicio y cierre: rama `master`, HEAD `4ab1463446c72bd557f3a6d340285259743f23e9`.
- Se conservaron las siete modificaciones rastreadas listadas al inicio: `.openmemory/spike/events.jsonl`, `.openmemory/spike/state.json`, `.work/evidence/opencode-compaction-payload.json`, `.work/evidence/phase-2-spike-results.json`, `.work/evidence/phase-3.5-e2e-test-results.json`, `.work/evidence/phase-4.3-installer-test-results.json`, `.work/evidence/phase-4.5-benchmark-test-results.json`. Solo se observaron nombres con `git status`; contenido no leído.
- El target R2.9 estaba ausente antes de crearlo. Solo se añadieron ocho archivos allí (siete documentos más manifiesto). Archivos de producto cambiados: cero.

## Validaciones y defectos documentales

- Los seis hashes de documentos R2.8 registrados por su manifiesto coinciden. JSON R2.8 parsea.
- R2.8 no contiene `implementation-design.md`; su propio prompt apunta al diseño existente en R2.6. Se reutilizó ese diseño. Esto es una discrepancia de ubicación respecto al pedido de R2.9, no evidencia de pérdida del diseño.
- El prompt R2.7 referencia un decision-register ausente, corregido mediante un registro nuevo en R2.8. No se editaron informes anteriores.
- El checkout ejecuta Node `v22.15.0`, npm `10.9.2`, Windows `win32/x64`. `package.json` no declara `engines`; no hay dependencia `better-sqlite3` en `package.json` ni en `package-lock.json`.
- Fuente oficial del tag `v13.0.3`: MIT, `engines.node >=22`, dependencia runtime `node-addon-api ^8.0.0`, `gypfile:false`; exporta módulos para Linux glibc/musl x64/arm64, macOS x64/arm64 y Windows x64/arm64. Esto no demuestra que el tarball instalado contiene un prebuild válido para cada combinación ni instalación limpia.
- La fuente `binding.gyp` documenta fallback de compilación C++20 si no hay prebuild. El issue upstream #1516 reporta invocation de node-gyp/Python en instalación Windows limpia; es un reporte, no reproducido localmente.
- Node v22.15 satisface la restricción declarada `>=22` del candidato, pero no constituye soporte runtime aprobado por Evocara. Tampoco se fijó OS/CPU público.

## Trabajo y pruebas

Comandos de preflight, comprobación de rutas/hashes, `node --version`, `npm --version`, `node -p` de versión/plataforma, búsqueda literal read-only en manifests y revisión documental: resultados registrados en `validation-results.md` y `verification-result.json`. Consultas web fueron de documentación oficial/versionada. No se ejecutaron tests, builds, instalación, scripts de instalación, P01–P12, bases de datos, migraciones, backup/restore ni benchmark: `NOT RUN`.

La corrección de R2.9 es aditiva: se documenta evidencia actual de runtime/driver y se consolidan estados y bloqueos. No se modificaron código, configuración, dependencias ni contratos públicos.

## Siguiente gate

Para evaluar el driver, el propietario debe aprobar exactamente tag/artefacto, Node mínimo, OS/CPU y condiciones offline/prebuild/toolchain y comandos permitidos (D-02). Eso no autoriza DB. Para piloto, debe levantar explícitamente `DENIED`, aprobar contratos D-04/D-07/D-09/D-10 aplicables y autorizar root/fixtures/comandos P01–P12. Integración, cutover, restore real, borrado y benchmark conservan gates separados.
