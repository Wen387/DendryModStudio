export interface SourceRef {
  path: string;
  line?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  anchorText?: string;
  endAnchorText?: string;
  excerpt?: string;
  [extension: string]: unknown;
}

export interface DiagnosticRow {
  severity: 'info' | 'warning' | 'error' | string;
  code: string;
  message?: string;
  source?: SourceRef;
  sceneId?: string;
  ownerId?: string;
  target?: string;
  [extension: string]: unknown;
}

export interface PredicateComparison {
  left: string;
  op: string;
  right: string;
  dependencies: string[];
}

export interface DynamicQRef {
  raw: string;
  expression: string;
  dependencies: string[];
}

export interface PredicateSummary {
  schemaVersion: string;
  kind: 'predicate_summary';
  raw: string;
  status: 'empty' | 'parsed' | 'dynamic' | 'opaque';
  dependencies: string[];
  operators: string[];
  comparisons: PredicateComparison[];
  dynamicRefs: DynamicQRef[];
  ast: unknown | null;
  opaqueReasons: string[];
}

export interface RouteCandidate {
  id: string;
  order: number;
  raw: string;
  rawTarget: string;
  target: string;
  resolvedTarget: string;
  targetResolved: boolean;
  targetKind: string;
  routeKind: string;
  routePurpose: string;
  predicate: string;
  predicateSummary: PredicateSummary;
  isFallback: boolean;
  dynamicTarget: boolean;
  targetSource: string;
  confidence: string;
  installSafety: string;
  source: SourceRef;
}

export interface RouteState {
  id: string;
  sceneId: string;
  ownerId: string;
  ownerKind: string;
  routeField: string;
  routeKind: string;
  routePurpose: string;
  chainContext: string;
  parserBacked: boolean;
  confidence: string;
  installSafety: string;
  reviewBoundary: string;
  source: SourceRef;
  sourceRaw: string;
  candidates: RouteCandidate[];
  candidateCount: number;
  fallbackCandidate: RouteCandidate | null;
  dependencies: string[];
  predicateDependencyCount: number;
  dynamicTargetCount: number;
  unresolvedTargetCount: number;
  status: string;
  summaryLabel: string;
}

export interface ConditionState {
  id: string;
  sceneId: string;
  ownerId: string;
  ownerKind: string;
  optionId: string;
  conditionKind: string;
  raw: string;
  summary: PredicateSummary;
  dependencies: string[];
  status: string;
  source: SourceRef;
}

export interface RouteStateSummary {
  routeStateCount: number;
  routeCandidateCount: number;
  orderedChainCount: number;
  predicateRouteCount: number;
  fallbackCount: number;
  dynamicTargetCount: number;
  unresolvedTargetCount: number;
  setJumpCount: number;
  goToRefCount: number;
  conditionStateCount: number;
  predicateDependencyCount: number;
  opaquePredicateCount: number;
  diagnosticCount: number;
}

export interface RouteStateDiagnostic {
  severity: string;
  code: string;
  sceneId?: string;
  ownerId?: string;
  message: string;
  source?: SourceRef;
}

export interface ProjectIndexEdge {
  from?: string;
  to?: string;
  targetId?: string;
  rawTarget?: string;
  kind?: string;
  condition?: string;
  predicate?: string;
  source?: SourceRef;
  confidence?: string;
  parserBacked?: boolean;
  dynamicTarget?: boolean;
  targetSource?: string;
  [extension: string]: unknown;
}

export interface ProjectIndex {
  schemaVersion?: string;
  project?: Record<string, unknown>;
  scenes?: ProjectIndexScene[];
  edges?: ProjectIndexEdge[];
  variables?: unknown[];
  diagnostics?: DiagnosticRow[];
  semantic?: Record<string, unknown>;
  [extension: string]: unknown;
}

export interface RouteStateModel {
  schemaVersion: string;
  kind: 'route_state_model';
  summary: RouteStateSummary;
  states: RouteState[];
  conditionStates: ConditionState[];
  diagnostics: RouteStateDiagnostic[];
}

export interface SceneRouteState {
  schemaVersion: string;
  kind: 'scene_route_state';
  sceneId: string;
  title: string;
  summary: RouteStateSummary;
  states: RouteState[];
  conditionStates: ConditionState[];
  diagnostics: RouteStateDiagnostic[];
}

export interface ProjectIndexScene {
  id: string;
  title?: string;
  type?: string;
  path?: string;
  viewIf?: string;
  sourceSpan?: SourceRef;
  topLevelSpan?: SourceRef;
  routes?: Record<string, unknown[]>;
  options?: unknown[];
  sections?: ProjectIndexSection[];
  effects?: unknown[];
  metadata?: Record<string, unknown>;
  [extension: string]: unknown;
}

export interface ProjectIndexSection {
  id: string;
  title?: string;
  viewIf?: string;
  chooseIf?: string;
  unavailableSubtitle?: string;
  sourceSpan?: SourceRef;
  routes?: Record<string, unknown[]>;
  options?: unknown[];
  metadata?: Record<string, unknown>;
  [extension: string]: unknown;
}

export interface RouteEvidenceItem {
  id: string;
  sourceKind: string;
  from: string;
  target: string;
  rawTarget: string;
  predicate: string;
  evidenceClass: string;
  parserBacked: boolean;
  confidence: string;
  owner: string;
  source: SourceRef;
  diagnostics: DiagnosticRow[];
  [extension: string]: unknown;
}

export interface RouteEvidenceMap {
  schemaVersion?: string;
  kind?: string;
  items: RouteEvidenceItem[];
  summary: Record<string, number>;
  diagnostics?: DiagnosticRow[];
  [extension: string]: unknown;
}

export interface GuidedScriptEdit {
  id: string;
  variable: string;
  op: string;
  value: string;
  source: SourceRef;
  safetyClass?: string;
  [extension: string]: unknown;
}

export interface ScriptImpactBlock {
  id: string;
  label: string;
  text?: string;
  rawText?: string;
  rawPreview?: string;
  source: SourceRef;
  safetyClass: 'guided' | 'advanced_review' | 'manual_boundary' | string;
  category?: string;
  boundaryCategory?: string;
  boundaryReasons?: string[];
  routeTargets?: string[];
  reads: string[];
  writes: string[];
  guidedEdits: GuidedScriptEdit[];
  optionInfluence?: boolean;
  routeInfluence?: boolean;
  displayInfluence?: boolean;
  [extension: string]: unknown;
}

export interface ScriptImpactMap {
  schemaVersion?: string;
  kind?: string;
  blocks: ScriptImpactBlock[];
  summary: Record<string, number>;
  categorySummary: Record<string, number>;
  manualCategorySummary: Record<string, number>;
  advancedCategorySummary: Record<string, number>;
  [extension: string]: unknown;
}

export interface RouteScriptIntelligenceModel {
  schemaVersion: string;
  kind: 'route_script_intelligence_model';
  ok: boolean;
  eventId: string;
  routes: RouteEvidenceMap;
  scripts: ScriptImpactMap;
  guidedScriptEdits: GuidedScriptEdit[];
  diagnostics: DiagnosticRow[];
  summary: Record<string, unknown>;
}

export interface SemanticFieldControl {
  id: string;
  label: string;
  value?: string;
  mode?: string;
  options?: unknown[];
  [extension: string]: unknown;
}

export interface SemanticEditorEvidence {
  routeEvidence?: unknown;
  effectEvidence?: unknown;
  dynamicKeyEvidence?: unknown;
  routerEvidence?: unknown;
  [extension: string]: unknown;
}

export interface SemanticLogicEditorModel {
  schemaVersion: string;
  kind: 'semantic_logic_editor_model';
  ok: boolean;
  mappingBug: boolean;
  editorKind: string;
  title: string;
  installSafety: string;
  operationType: string;
  source: SourceRef;
  currentText: string;
  fieldControls: Record<string, any> | null;
  semanticEditor: Record<string, unknown>;
  evidence: SemanticEditorEvidence;
  routeEvidence: unknown[];
  effectEvidence: unknown[];
  dynamicKeyEvidence: unknown[];
  routerEvidence: unknown[];
  diagnostics: DiagnosticRow[];
  [extension: string]: unknown;
}

export interface SemanticLogicProposal {
  schemaVersion: string;
  kind: string;
  ok: boolean;
  mappingBug?: boolean;
  installPlan?: {operations: InstallPlanOperation[]; [extension: string]: unknown} | null;
  operations?: InstallPlanOperation[];
  diagnostics: DiagnosticRow[];
  [extension: string]: unknown;
}

export interface EventWorkbenchModel {
  schemaVersion: string;
  kind: string;
  sceneId: string;
  title: string;
  routeState?: SceneRouteState;
  [extension: string]: unknown;
}

export interface DynamicSemanticWorkbenchModel {
  schemaVersion?: string;
  kind: string;
  summary: Record<string, any>;
  workflows: Array<Record<string, any>>;
  manualBoundaryPackages: Array<Record<string, any>>;
  routeStateSummary?: RouteStateSummary;
  routeStates?: RouteState[];
  conditionStates?: ConditionState[];
  [extension: string]: unknown;
}

export type InstallSafety = 'safe_apply' | 'guarded_apply' | 'advanced_apply' | 'manual_review' | 'refused';

export type InstallOperationType =
  | 'create_file'
  | 'replace_text'
  | 'insert_text'
  | 'replace_section'
  | 'copy_asset_file'
  | 'manual_snippet'
  | (string & {});

export interface SourceEvidence extends SourceRef {
  rawAnchorText?: string;
  rawEndAnchorText?: string;
  expectedRangeHash?: string;
  deletesSourceLine?: boolean;
  deleteMode?: '' | 'line';
}

export interface InstallOperationTarget {
  path: string;
  type: InstallOperationType;
  safety: InstallSafety;
  source: SourceEvidence;
}

export interface InstallPlanOperation {
  id: string;
  type: InstallOperationType;
  path: string;
  safety: InstallSafety;
  description?: string;
  content?: string;
  search?: string;
  replace?: string;
  anchorText?: string;
  endAnchorText?: string;
  rawAnchorText?: string;
  rawEndAnchorText?: string;
  expectedRangeHash?: string;
  deleteMode?: '' | 'line';
  position?: 'before' | 'after';
  dedupeSearch?: string;
  sourceName?: string;
  sourcePath?: string;
  assetType?: string;
  label?: string;
  role?: string;
  line?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  allowEmptyReplace?: boolean;
  deletesSourceLine?: boolean;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface InstallPlan {
  schemaVersion?: string;
  kind?: string;
  id?: string;
  draftKind?: string;
  title?: string;
  status?: string;
  validationCommand?: string;
  project?: Record<string, unknown> | null;
  operations: InstallPlanOperation[];
  [extension: string]: unknown;
}

export interface TextOperationEvidence {
  status: string;
  message?: string;
  match?: string;
  line?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  beforeSnippet?: string;
  afterSnippet?: string;
  beforeHash?: string;
  afterHash?: string;
  diff?: string;
  [extension: string]: unknown;
}

export interface AssetOperationEvidence {
  status: string;
  message?: string;
  match?: string;
  sourcePath?: string;
  sourceHash?: string;
  targetHash?: string;
  beforeSnippet?: string;
  afterSnippet?: string;
  diff?: string;
  [extension: string]: unknown;
}

export interface InstallPreflightResult {
  id: string;
  type: string;
  path: string;
  status: string;
  sourceHash?: string;
  evidence?: TextOperationEvidence | AssetOperationEvidence | Record<string, unknown>;
  [extension: string]: unknown;
}

export interface InstallOperationSummary {
  safeApply: number;
  guardedApply: number;
  advancedApply: number;
  manualReview: number;
  refused: number;
  total: number;
}

export interface InstallChangedFile {
  operationId: string;
  type: string;
  path: string;
  status: string;
  evidenceStatus?: string;
  match?: string;
  line?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  operationCount: number;
}

export interface InstallApplyResult {
  ok: boolean;
  dryRun: boolean;
  allowAdvanced?: boolean;
  operationSummary: InstallOperationSummary;
  results: InstallPreflightResult[];
  diagnostics: DiagnosticRow[];
  verifiedDiff?: string;
  changedFiles?: InstallChangedFile[];
  operationCount?: number;
  uniqueFileCount?: number;
  [extension: string]: unknown;
}

export interface InstallOperationClassification {
  status: InstallSafety;
  label: string;
  level: number;
  reason: string;
  operation: InstallPlanOperation;
  [extension: string]: unknown;
}

export interface ReviewApplyReadiness {
  canApply: boolean;
  checked?: boolean;
  needsCheck: boolean;
  needsAdvancedConsent: boolean;
  manualReviewCount: number;
  refusedCount: number;
  automaticOperationCount: number;
  eligibleAutomaticOperationCount?: number;
  skippedAdvancedOperationCount?: number;
  [extension: string]: unknown;
}

export interface ReviewApplyStep {
  kind: string;
  count?: number;
  skipped?: number;
  labelParts?: string[];
  [extension: string]: unknown;
}

export interface ReviewApplyUiState {
  summary: InstallOperationSummary;
  readiness: ReviewApplyReadiness;
  autoApplyAvailable: boolean;
  checked: boolean;
  failedResult: InstallPreflightResult | null;
  postApply: {statusKind: string; steps: ReviewApplyStep[]} | null;
  statusKind: string;
  steps: ReviewApplyStep[];
  [extension: string]: unknown;
}

export interface InstallResultReportOptions {
  plan?: InstallPlan | null;
  t?: (key: string, fallback: string) => string;
}

export interface InstallOperationContractsApi {
  INSTALL_OPERATION_CONTRACTS_VERSION: string;
  APPLY_STATUSES: Set<string>;
  INSTALL_LEVELS: Record<string, number>;
  normalizeInstallOperation(operation: unknown, index?: number): InstallPlanOperation;
  normalizeOperationType(value: unknown): InstallOperationType;
  normalizeSafety(value: unknown): InstallSafety;
  normalizeSourceEvidence(source: unknown, fallback?: Partial<SourceEvidence>): SourceEvidence;
  normalizeInstallTarget(operation: unknown): InstallOperationTarget;
  summarizeInstallOperations(planOrOperations: unknown, classify?: (operation: unknown) => InstallOperationClassification): InstallOperationSummary;
  emptyOperationSummary(): InstallOperationSummary;
  renderPatchPreview(plan: unknown): string;
  renderOperationPreview(operation: unknown): string;
  prefixLines(prefix: string, text: unknown): string;
  markCommittedResults(results: InstallPreflightResult[]): InstallPreflightResult[];
  finalizeApplyResult(result: InstallApplyResult | Record<string, unknown>, includeEvidence?: boolean): InstallApplyResult;
  normalizeApplyResult(result: unknown): InstallApplyResult;
  normalizePreflightResult(result: unknown): InstallPreflightResult;
  normalizeOperationEvidence(evidence: unknown): Record<string, unknown>;
  withOperationEvidence(result: unknown, includeEvidence?: boolean, operation?: unknown, evidence?: unknown): InstallPreflightResult;
  textOperationEvidence(operation: InstallPlanOperation | Record<string, unknown>, status: string, beforeText?: unknown, afterText?: unknown, details?: unknown): TextOperationEvidence;
  manualOperationEvidence(operation: InstallPlanOperation | Record<string, unknown>, status: string, message: string): TextOperationEvidence;
  failedOperationEvidence(operation: InstallPlanOperation | Record<string, unknown>, match: string, message: string): TextOperationEvidence;
  assetOperationEvidence(operation: InstallPlanOperation | Record<string, unknown>, status: string, details?: unknown): AssetOperationEvidence;
  evidenceMessage(status: unknown): string;
  uniqueChangedFiles(files: Array<InstallChangedFile | null | undefined | false>): InstallChangedFile[];
  changedFileForResult(result: unknown, dryRun?: boolean): InstallChangedFile | null;
  classifyReviewApplyReadiness(summary: unknown, checked?: boolean, allowAdvanced?: boolean): ReviewApplyReadiness;
}

export interface InstallReviewStateModelApi {
  buildReviewApplyReadiness(
    summary: unknown,
    checked?: boolean,
    allowAdvanced?: boolean,
    contracts?: Pick<InstallOperationContractsApi, 'classifyReviewApplyReadiness'>
  ): ReviewApplyReadiness;
  buildReviewApplyUiState(options?: {
    summary?: unknown;
    readiness?: ReviewApplyReadiness | null;
    lastResult?: unknown;
    postApplyVerification?: unknown;
  }): ReviewApplyUiState;
  firstFailedResult(result: unknown): InstallPreflightResult | null;
  resultHasFailures(result: unknown): boolean;
}

export interface InstallResultReportModelApi {
  buildInstallResultReport(result: unknown, options?: InstallResultReportOptions): string;
  postApplyVerificationLabel(verification: unknown, t: (key: string, fallback: string) => string): string;
  rollbackNotes(results: unknown[], plan?: InstallPlan | unknown, t?: (key: string, fallback: string) => string): string[];
  groupResults(results: unknown[]): Map<string, unknown[]>;
  resultHasFailures(result: unknown): boolean;
}

export interface EditAction {
  kind: string;
  actionKind: string;
  routeClass: string;
  targetView: string;
  targetId: string;
  source?: SourceRef;
  installSafety?: string;
  operationType?: string;
}

export interface RouteStateApi {
  buildRouteStateModel(projectIndex: ProjectIndex, options?: Record<string, unknown>): RouteStateModel;
  routeStatesForScene(projectIndex: ProjectIndex, sceneOrId: ProjectIndexScene | string, options?: Record<string, unknown>): SceneRouteState;
  summarizePredicate(rawInput: string): PredicateSummary;
  predicateDependencies(raw: string): string[];
  conditionStatesForScene(projectIndex: ProjectIndex, sceneOrId: ProjectIndexScene | string): ConditionState[];
}

declare global {
  interface Window {
    ProjectMapRouteStateModel?: RouteStateApi;
    ProjectMapRouteScriptIntelligenceModel?: unknown;
    ProjectMapSemanticLogicEditor?: unknown;
    ProjectMapEventWorkbenchModel?: unknown;
    ProjectMapDynamicSemanticWorkbenchModel?: unknown;
    ProjectMapInstallOperationContracts?: InstallOperationContractsApi;
    ProjectMapInstallReviewStateModel?: InstallReviewStateModelApi;
    ProjectMapInstallResultReportModel?: InstallResultReportModelApi;
    ProjectMapSourceSliceEditor?: unknown;
  }
}
