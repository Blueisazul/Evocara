import * as fs from "fs";
import * as path from "path";

export type MasterPhaseId =
  | "DESCUBRIR"
  | "DEFINIR"
  | "INVESTIGAR"
  | "COMPARAR"
  | "DISEÑAR"
  | "PLANIFICAR"
  | "IMPLEMENTAR"
  | "VALIDAR"
  | "EVALUAR"
  | "CONSOLIDAR"
  | "ACTUALIZAR_MEMORIA"
  | "PREPARAR_CONTINUIDAD";

export const MASTER_PHASE_ORDER: MasterPhaseId[] = [
  "DESCUBRIR",
  "DEFINIR",
  "INVESTIGAR",
  "COMPARAR",
  "DISEÑAR",
  "PLANIFICAR",
  "IMPLEMENTAR",
  "VALIDAR",
  "EVALUAR",
  "CONSOLIDAR",
  "ACTUALIZAR_MEMORIA",
  "PREPARAR_CONTINUIDAD",
];

export interface PhaseDefinition {
  id: MasterPhaseId;
  name: string;
  objective: string;
  inputs: string[];
  allowedActivities: string[];
  prohibitedActivities: string[];
  deliverables: string[];
  definitionOfDone: string[];
  exitCondition: string;
  nextPhase: MasterPhaseId | null;
  humanApprovalRequired: boolean;
}

export const PHASE_DEFINITIONS: Record<MasterPhaseId, PhaseDefinition> = {
  DESCUBRIR: {
    id: "DESCUBRIR",
    name: "1. Descubrir (Discover)",
    objective: "Comprender el problema, explorar el dominio, identificar requerimientos generales del usuario y contexto existente.",
    inputs: ["Prompt inicial del usuario", "Código preexistente", "Documentos de contexto"],
    allowedActivities: ["Lectura e inspección de archivos", "Preguntas aclaratorias", "Análisis de dominio"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Resumen de descubrimiento", "Contexto inicial en memoria"],
    definitionOfDone: ["Visión general del proyecto comprendida y alcance inicial trazado"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "DEFINIR",
    humanApprovalRequired: true,
  },
  DEFINIR: {
    id: "DEFINIR",
    name: "2. Definir (Define)",
    objective: "Establecer formalmente requerimientos funcionales y no funcionales, límites del sistema y criterios de éxito.",
    inputs: ["Entregables de DESCUBRIR"],
    allowedActivities: ["Especificación de requerimientos", "Estructuración de metas en project-state.json"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Requerimientos funcionales y no funcionales", "Metas de proyecto en proyecto-state.json"],
    definitionOfDone: ["Requerimientos clave especificados de forma no ambigua"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "INVESTIGAR",
    humanApprovalRequired: true,
  },
  INVESTIGAR: {
    id: "INVESTIGAR",
    name: "3. Investigar (Research)",
    objective: "Investigar dependencias, estándares de la industria, arquitecturas relevantes e integrar conocimiento previo.",
    inputs: ["Requerimientos de DEFINIR"],
    allowedActivities: ["Consulta de memoria vía openmemory_query_knowledge", "Investigación técnica", "Spikes de lectura"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Registros de conocimiento sintéticos en OpenMemory (openmemory_record_knowledge)"],
    definitionOfDone: ["Alternativas y conceptos técnicos investigados y registrados en memoria"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "COMPARAR",
    humanApprovalRequired: true,
  },
  COMPARAR: {
    id: "COMPARAR",
    name: "4. Comparar (Compare OSS & Alternatives)",
    objective: "Evaluar alternativas Open Source y patrones arquitectónicos existentes según la regla de 'No reinventar la rueda'.",
    inputs: ["Hallazgos de INVESTIGAR"],
    allowedActivities: ["Análisis comparativo de librerías OSS", "Matriz de trade-offs", "Borrador de ADR"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Matriz comparativa de software Open Source vs. desarrollo propio", "ADRs preliminares"],
    definitionOfDone: ["Justificación de reutilización Open Source vs desarrollo propio documentada"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "DISEÑAR",
    humanApprovalRequired: true,
  },
  DISEÑAR: {
    id: "DISEÑAR",
    name: "5. Diseñar (Design)",
    objective: "Diseñar la arquitectura del sistema, esquemas de datos, APIs y decisiones de diseño fundamentales.",
    inputs: ["Alternativas seleccionadas en COMPARAR"],
    allowedActivities: ["Redacción de ADRs definitivos", "Especificaciones de esquemas de datos", "Diseño de APIs en documentación"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["ADRs aceptados en .openmemory/adrs/", "Especificaciones arquitectónicas"],
    definitionOfDone: ["Arquitectura y esquemas completamente definidos e inmutables para la fase"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "PLANIFICAR",
    humanApprovalRequired: true,
  },
  PLANIFICAR: {
    id: "PLANIFICAR",
    name: "6. Planificar (Plan)",
    objective: "Desglosar la implementación en tareas atómicas verificables y secuenciadas.",
    inputs: ["Diseño arquitectónico de DISEÑAR"],
    allowedActivities: ["Desglose de tareas en project-state.json", "Definición de criterios de prueba por tarea"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Plan de tareas ordenado con criterios de prueba por tarea"],
    definitionOfDone: ["Tareas desglosadas con dependencias y criterios de aceptación claros"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "IMPLEMENTAR",
    humanApprovalRequired: true,
  },
  IMPLEMENTAR: {
    id: "IMPLEMENTAR",
    name: "7. Implementar (Implement)",
    objective: "Ejecutar la codificación y construcción de las tareas planificadas.",
    inputs: ["Plan de tareas de PLANIFICAR"],
    allowedActivities: ["Edición, creación y refactorización de código fuente de producción"],
    prohibitedActivities: ["UNAPPROVED_ARCHITECTURE_DEVIATION"],
    deliverables: ["Código fuente compilable e implementado"],
    definitionOfDone: ["Código desarrollado según plan y libre de errores sintácticos/compilación"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "VALIDAR",
    humanApprovalRequired: true,
  },
  VALIDAR: {
    id: "VALIDAR",
    name: "8. Validar (Validate)",
    objective: "Ejecutar pruebas unitarias, de integración, empíricas y verificación runtime.",
    inputs: ["Código producido en IMPLEMENTAR"],
    allowedActivities: ["Ejecución de suites de prueba", "Verificación runtime", "Scripts de validación empírica"],
    prohibitedActivities: ["UNAPPROVED_FEATURE_CREATION"],
    deliverables: ["Logs y reportes de pruebas en .work/evidence/"],
    definitionOfDone: ["Todas las pruebas ejecutadas con resultado PASSED sin regresiones"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "EVALUAR",
    humanApprovalRequired: true,
  },
  EVALUAR: {
    id: "EVALUAR",
    name: "9. Evaluar (Evaluate)",
    objective: "Analizar la conformidad con los requerimientos originales y los SLAs del sistema.",
    inputs: ["Resultados de prueba de VALIDAR"],
    allowedActivities: ["Análisis de cobertura", "Auditoría de cumplimiento de requerimientos", "Evaluación de métricas"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Informe de evaluación de requerimientos y métricas de desempeño"],
    definitionOfDone: ["Cumplimiento verificado contra los requerimientos iniciales"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "CONSOLIDAR",
    humanApprovalRequired: true,
  },
  CONSOLIDAR: {
    id: "CONSOLIDAR",
    name: "10. Consolidar (Consolidate)",
    objective: "Limpiar código temporal, formatear repositorio y consolidar documentación final.",
    inputs: ["Artefactos de EVALUAR"],
    allowedActivities: ["Eliminación de archivos temporales .tmp", "Formateo de código", "Ordenación de repositorio"],
    prohibitedActivities: ["FUNCTIONAL_CODE_MUTATION"],
    deliverables: ["Repositorio limpio y documentación consolidada"],
    definitionOfDone: ["Sin residuos temporales, código limpio y documentado"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "ACTUALIZAR_MEMORIA",
    humanApprovalRequired: true,
  },
  ACTUALIZAR_MEMORIA: {
    id: "ACTUALIZAR_MEMORIA",
    name: "11. Actualizar Memoria (Update Memory)",
    objective: "Persistir lecciones aprendidas, ADRs definitivos y conocimiento acumulado en OpenMemory.",
    inputs: ["Resultados consolidados del proyecto"],
    allowedActivities: ["Invocación de openmemory_record_knowledge", "Actualización de project-state.json"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: ["Base de conocimiento de OpenMemory actualizada"],
    definitionOfDone: ["Todo el conocimiento relevante persistido en .openmemory/"],
    exitCondition: "Reporte de fase generado y aprobación humana explícita recibida",
    nextPhase: "PREPARAR_CONTINUIDAD",
    humanApprovalRequired: true,
  },
  PREPARAR_CONTINUIDAD: {
    id: "PREPARAR_CONTINUIDAD",
    name: "12. Preparar Continuidad (Prepare Continuity)",
    objective: "Generar la síntesis narrativa de entrega (handoff.md) y snapshot de respaldo para la siguiente sesión.",
    inputs: ["Estado final del proyecto"],
    allowedActivities: ["Actualización de handoff.md", "Creación de backup snapshot"],
    prohibitedActivities: ["MODIFY_PRODUCTION_CODE", "CREATE_PRODUCTION_FILES", "DELETE_PRODUCTION_FILES"],
    deliverables: [".openmemory/handoff.md actualizado", "Backup snapshot en .openmemory/backups/"],
    definitionOfDone: ["Handoff completo que permite retomar la siguiente sesión sin pérdida de contexto"],
    exitCondition: "Reporte de cierre de sesión completado",
    nextPhase: null,
    humanApprovalRequired: true,
  },
};

export function loadMasterPromptMarkdown(rootDir?: string): string {
  const base = rootDir || process.cwd();
  const configPath = path.join(base, "config", "master-prompt.md");
  if (fs.existsSync(configPath)) {
    try {
      return fs.readFileSync(configPath, "utf-8");
    } catch (_) {}
  }
  return `# PROMPT MAESTRO DE GOBERNANZA\nCiclo de 12 Fases: DESCUBRIR -> DEFINIR -> INVESTIGAR -> COMPARAR -> DISEÑAR -> PLANIFICAR -> IMPLEMENTAR -> VALIDAR -> EVALUAR -> CONSOLIDAR -> ACTUALIZAR_MEMORIA -> PREPARAR_CONTINUIDAD\nRegla: Autonomía dentro de la fase, pero aprobración humana obligatoria antes de avanzar de fase. Prohibido implementar código fuera de la fase IMPLEMENTAR.`;
}
