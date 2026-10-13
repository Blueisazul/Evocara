# Próximas acciones R2.9

1. **Resolver D-02:** propietario fija si evalúa `better-sqlite3@13.0.3`, runtime mínimo, OS/CPU, offline/prebuild/fallback y comandos. El checkout Node v22.15.0 supera el `>=22` upstream, pero Evocara no declara `engines`; por tanto no se declara plataforma soportada.
2. **Cerrar contratos necesarios antes de piloto:** D-04 authority por entidad; D-07 revisión/CAS, contención y commit unknown; D-09 namespace/hash/receipt/status/retención; D-10 estados fail-closed y health readonly. Resolver D-05/06/08/12/13 donde afecten deletion, actor, backup, audit y restore.
3. **Piloto separado:** obtener autorización inequívoca que levante `DENIED`, identifique root fuera de OneDrive, artefacto/runtime/plataforma y casos exactos. Revisar harness antes de escribir. Si cualquier precondición falta, no crear DB.
4. **Después de piloto aceptado:** solicitar autorización de integración CLI/MCP y cerrar D-06/D-11. El piloto no la habilita.
5. **Gates adicionales:** aprobar backup/restore y deletion antes de pruebas de recovery; aprobar autoridad/rollback antes de migración/cutover; benchmark solo con permiso, baseline/candidate inmutables, ledger y umbrales aprobados.

No hay una prueba segura de producto que avance el gate de persistencia sin la aprobación faltante. La próxima actividad autorizable de mayor valor es resolver D-02 documentalmente con las cuatro entradas concretas de `owner-decisions.md`.
