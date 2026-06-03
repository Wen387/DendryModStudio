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

export interface AssetSlotDefinition {
  role: string;
  type: 'image' | 'audio' | 'asset' | string;
  label: string;
  roleLabel: string;
}

export interface AssetInstallRequest {
  sourceName: string;
  sourcePath: string;
  targetPath: string;
  type: 'image' | 'audio' | 'asset' | string;
  label: string;
  role: string;
  directive: string;
  placementId: string;
  placementKind: string;
  displayLocation: string;
  operationCapability: string;
  sectionId: string;
  optionId: string;
  branchKind: string;
  relatedOptionIds: string[];
  roleLabel: string;
  sourceSize?: number;
  sourceLastModified?: number;
  status: 'ready_for_review' | 'needs_source_file' | string;
}

export interface AssetContractModelApi {
  AUDIO_MODIFIER_KEYWORDS: readonly string[];
  normalizeTarget(value: unknown): 'event' | 'card';
  normalizeAssetDirective(value: unknown): string;
  formatDirectiveText(directive: unknown, path: unknown, modifiers?: unknown[]): string;
  roleForAssetDirective(directive: unknown, target: unknown): string;
  assetRoleLabel(role: unknown): string;
  assetSlotDefinitions(target: unknown): AssetSlotDefinition[];
  normalizeAssetPlacementKind(value: unknown): string;
  isFlowPlacementKind(kind: unknown): boolean;
  assetTypeForExtension(extension: unknown): string;
  extensionForPath(path: unknown): string;
  fileName(path: unknown): string;
  safeId(value: unknown): string;
  safeAssetFileName(value: unknown, type?: unknown): string;
  suggestAssetTargetPath(asset: unknown, options?: Record<string, unknown>): string;
  assetInstallRequest(input: unknown, options?: Record<string, unknown>): AssetInstallRequest;
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

export interface RouteRuntimeSemantics {
  selectionMode: string;
  exclusivity: string;
  possibleRandomization: boolean;
  multiValidRisk: boolean;
  unconditionalCandidateCount: number;
  conditionalCandidateCount: number;
  dynamicTargetCount: number;
  unresolvedTargetCount: number;
  reason: string;
  warnings: string[];
  preRouteScript: RoutePreRouteScriptSummary;
  collisionSummary: RouteCollisionSummary;
}

export interface RoutePreRouteScriptEffect {
  variable: string;
  op: string;
  value: string;
  condition: string;
  source: SourceRef;
}

export interface RoutePreRouteScriptSummary {
  ownerId: string;
  hook: string;
  rawPresent: boolean;
  effectCount: number;
  safeEffectCount: number;
  opaqueBlockCount: number;
  writes: string[];
  directDependencyWrites: string[];
  routeDependencyWriteCount: number;
  opaque: boolean;
  opaqueReasons: string[];
  status: string;
  effects: RoutePreRouteScriptEffect[];
}

export interface RouteCollisionCountBucket {
  zeroValidCount: number;
  oneValidCount: number;
  multiValidCount: number;
}

export interface RouteCollisionExample {
  state?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  validTargets?: string[];
}

export interface RouteCollisionSummary {
  tested: boolean;
  sampleCount: number;
  dependencyCount: number;
  before: RouteCollisionCountBucket;
  after: RouteCollisionCountBucket;
  preRouteMutationCount: number;
  verdict: string;
  reason: string;
  examples: {
    multiValidBefore: RouteCollisionExample[];
    multiValidAfter: RouteCollisionExample[];
    zeroValidAfter: RouteCollisionExample[];
    preRouteMutation: RouteCollisionExample[];
  };
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
  preRouteScript: RoutePreRouteScriptSummary;
  runtimeSemantics: RouteRuntimeSemantics;
  semanticTier?: 'static_exact' | 'guided_profile' | 'runtime_observed' | 'manual_boundary' | string;
  safeEditEligible?: boolean;
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
  possibleRandomRouteCount: number;
  unconditionalMixedRouteCount: number;
  explicitExclusiveRouteCount: number;
  preRouteScriptCount: number;
  preRouteRouteDependencyWriteCount: number;
  preRouteOpaqueScriptCount: number;
  collisionTestedRouteCount: number;
  collisionProvenMultiValidCount: number;
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

export interface ExistingSceneTextBlockRow {
  id?: string;
  role?: string;
  text?: string;
  originalText?: string;
  sectionId?: string;
  semanticRole?: string;
  branchKind?: string;
  label?: string;
  sectionLabel?: string;
  conditions?: unknown[];
  source?: SourceRef;
  hasInlineConditionals?: boolean;
  [extension: string]: unknown;
}

export interface ExistingSceneOptionRow {
  id?: string;
  label?: string;
  targetId?: string;
  rawTargetId?: string;
  sectionId?: string;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface ExistingSceneConditionalAlternative {
  condition: string;
  text: string;
  source: SourceRef;
}

export interface ExistingSceneTextBlockSemantics {
  semanticRole: string;
  branchKind: string;
  label: string;
  sectionLabel: string;
  conditions: string[];
  relatedOptionIds: string[];
  relatedOptionLabels: string[];
  ownedOptionIds: string[];
  ownedOptionLabels: string[];
  hasConditionalRows: boolean;
}

export interface ExistingSceneLogicalTextRun {
  kind: string;
  rows: ExistingSceneTextBlockRow[];
}

export interface ExistingSceneTextBlockHelperDeps {
  sourceRef?: (source: unknown) => SourceRef;
  humanSectionId?: (sectionId: string) => string;
}

export interface InlineConditionalTreeNode {
  condition: string;
  text: string;
  children: InlineConditionalTreeNode[];
}

export interface ExistingSceneConditionalTreeNode {
  condition: string;
  text: string;
  children: ExistingSceneConditionalTreeNode[];
  source: SourceRef;
}

export interface ExistingSceneTextBlockHelpersApi {
  textBlockSemantics(
    scene: ProjectIndexScene,
    sectionId: string,
    rows: ExistingSceneTextBlockRow[],
    optionRows: ExistingSceneOptionRow[]
  ): ExistingSceneTextBlockSemantics;
  detectVisualKinds(value: unknown): string[];
  conditionalAlternativesForRows(rows: ExistingSceneTextBlockRow[]): ExistingSceneConditionalAlternative[];
  conditionalTreeForRows(rows: ExistingSceneTextBlockRow[]): ExistingSceneConditionalTreeNode[];
  extractInlineConditionalTree(value: unknown): InlineConditionalTreeNode[];
  lastMeaningfulCondition(values: unknown[]): string;
  isBlockTextRole(role: unknown): boolean;
  logicalTextRuns(rows: ExistingSceneTextBlockRow[]): ExistingSceneLogicalTextRun[];
  isMixedInlineConditionalSource(value: unknown): boolean;
  isStructuralSceneLine(value: unknown): boolean;
  findSceneSection(scene: ProjectIndexScene, sectionId: string): ProjectIndexSection | null;
  sectionTargetedByOption(sceneId: string, sectionId: string, option: ExistingSceneOptionRow): boolean;
  sectionOwnsOption(sceneId: string, sectionId: string, option: ExistingSceneOptionRow): boolean;
  sectionIdVariants(sceneId: string, sectionId: string): string[];
  optionTargetVariants(sceneId: string, option: ExistingSceneOptionRow): string[];
  optionOwnerVariants(sceneId: string, option: ExistingSceneOptionRow): string[];
  optionIdVariants(sceneId: string, option: ExistingSceneOptionRow): string[];
  endpointVariants(sceneId: string, values: unknown[] | unknown): string[];
  isOpeningSectionId(sceneId: string, sectionId: string): boolean;
  sectionDisplayLabel(sceneId: string, section: ProjectIndexSection | null | undefined, sectionId: string): string;
}

export interface ExistingSceneTextBlockHelpersFactory {
  create(deps?: ExistingSceneTextBlockHelperDeps): ExistingSceneTextBlockHelpersApi;
}

export interface ExistingSceneLogicFieldOwner {
  sceneId?: string;
  sectionId?: string;
  itemId?: string;
  kind?: string;
  [extension: string]: unknown;
}

export interface ExistingSceneLogicField {
  id: string;
  role: string;
  label: string;
  original: string;
  value: string;
  source: SourceRef;
  sourcePath: string;
  editability: string;
  owner: ExistingSceneLogicFieldOwner;
  sectionId: string;
  optionId: string;
  inputType: string;
  transform: string;
  searchText: string;
  confidence: string;
  reason: string;
  [extension: string]: unknown;
}

export interface ExistingSceneLogicFieldChange {
  fieldId: string;
  role: string;
  label: string;
  sectionId: string;
  optionId: string;
  source: SourceRef;
  editability: string;
  before: string;
  after: string;
  [extension: string]: unknown;
}

export interface ExistingSceneLogicFieldsApi {
  buildRouteFields(scene: ProjectIndexScene, options: unknown[]): ExistingSceneLogicField[];
  buildEffectFields(scene: ProjectIndexScene, effects: unknown[], options: unknown[]): ExistingSceneLogicField[];
  changeForLogicField(
    field: ExistingSceneLogicField,
    afterValue: unknown,
    fallback?: (field: ExistingSceneLogicField, before: string, after: string) => ExistingSceneLogicFieldChange
  ): ExistingSceneLogicFieldChange | null;
  effectExpression(effect: unknown): string;
  routeSearchToken(anchorText: unknown, target: unknown): string;
  routeReplacementToken(beforeToken: unknown, afterTarget: unknown): string;
  isSimpleEffectExpression(value: unknown): boolean;
}

export interface ExistingSceneStructureOperationsApi {
  advancedRemoveLayerChange(field: Record<string, unknown>): unknown[] | Record<string, unknown> | null;
  advancedRerouteLayerChanges(field: Record<string, unknown>, afterText: string): unknown[] | null;
  classifyChange(change: unknown): ExistingSceneStructureOperationSummary;
  normalizeStructureAction(value: unknown): string;
  sourceSupportsAdvancedOptionDelete(sourceInput: unknown): boolean;
  sourceSupportsAdvancedSectionDelete(sourceInput: unknown): boolean;
  sourceSupportsAdvancedRouteDelete(sourceInput: unknown): boolean;
  sourceSupportsAdvancedRouteReroute(sourceInput: unknown): boolean;
  structureActionFallbackText(field: Record<string, unknown>, afterText: string): string;
  structureActionReviewPolicy(field: Record<string, unknown>): ExistingSceneStructureOperationSummary;
  routeLineReplacement(anchorText: string, nextTarget: string): string;
  routeClauseDeleteReplacement(anchorText: string, target: string, condition?: string): {ok: boolean; line: string};
}

export interface ExistingSceneStructureOperationSummary {
  status: 'guarded_apply' | 'advanced_apply' | 'manual_review' | 'refused' | string;
  operationType?: string;
  editability?: string;
  sourceBacked?: boolean;
  reason: string;
}

export interface ExistingSceneStructureOperationsFactory {
  create(deps?: {
    sourceRef?: (input: unknown) => SourceRef;
    baseFieldChange?: (field: Record<string, unknown>, before: string, after: string) => Record<string, unknown>;
    isProtectedRouterPath?: (relPath: string) => boolean;
    normalizeStructuralEffect?: (value: unknown) => string;
  }): ExistingSceneStructureOperationsApi;
}

export interface EventStructureEffect {
  variable: string;
  op: '=' | '+=' | '-=' | string;
  value: unknown;
  condition: string;
  hook?: string;
  [extension: string]: unknown;
}

export interface EventStructureEffectConditionSplit {
  value: string;
  condition: string;
}

export interface EventStructureEffectModelApi {
  effectFromDraft(effect: unknown): EventStructureEffect;
  effectToDraft(effect: unknown): EventStructureEffect;
  parseEffect(value: unknown): EventStructureEffect;
  splitEffectCondition(value: unknown): EventStructureEffectConditionSplit;
  effectLabel(effect: unknown): string;
  effectLabelForSource(effect: unknown): string;
  effectValue(value: unknown, op?: unknown): string | number;
  normalizeEffectOp(value: unknown): '=' | '+=' | '-=';
  rawEffectLines(value: unknown): string[];
  joinRawEffectLines(value: unknown): string;
}

export interface EventStructureEffectSourceRemoval {
  ok: boolean;
  nextLine: string;
}

export interface EventStructureEffectSourceHelpersApi {
  isOnArrivalEffectLine(value: unknown): boolean;
  looksLikeStandaloneEffectAnchor(anchor: unknown): boolean;
  effectRemovalFromSourceLine(anchor: unknown, candidates?: unknown[]): EventStructureEffectSourceRemoval;
  splitEffectClauses(text: unknown): string[];
  normalizeEffectClause(value: unknown): string;
}

export interface EventStructureCommand {
  type: string;
  action?: string;
  id?: string;
  fieldId?: string;
  optionId?: string;
  sectionId?: string;
  targetId?: string;
  targetLabel?: string;
  effectIndex?: number | null;
  value?: string;
  sourceContext?: Record<string, unknown> | null;
  mode?: string;
  [extension: string]: unknown;
}

export interface EventStructureCommandModelApi {
  applyCommand(structure: unknown, command: unknown): Record<string, unknown>;
  commandsFromValues(values: unknown, structure?: unknown): EventStructureCommand[];
  parseAddOption(value: unknown): Record<string, unknown>;
  parseBranch(value: unknown): Record<string, unknown>;
  isEventStructureField(key: unknown): boolean;
}

export type RouteSemanticTier = 'static_exact' | 'guided_profile' | 'runtime_observed' | 'manual_boundary' | string;

export interface RouteTargetResolution {
  status: string;
  target?: string;
  resolvedId?: string;
  scope?: string;
  candidateTargets?: string[];
  candidates?: Array<Record<string, unknown>>;
  quality?: string;
  reason?: string;
  proof?: string;
  ambiguous?: boolean;
  shadowed?: boolean;
  [extension: string]: unknown;
}

export interface RouteDynamicBinding {
  kind: string;
  variable?: string;
  source?: string;
  shape?: string;
  condition?: string;
  selector?: string;
  candidateTargets?: string[];
  primaryTarget?: string;
  profileBacked?: boolean;
  manualBoundary?: boolean;
  reason?: string;
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
  semanticTier?: RouteSemanticTier;
  targetResolution?: RouteTargetResolution;
  dynamicBinding?: RouteDynamicBinding | null;
  runtimeSemantics?: RouteRuntimeSemantics | null;
  safeEditEligible?: boolean;
  dynamicTarget?: boolean;
  targetSource?: string;
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
  dynamicRouteWrites?: Array<Record<string, unknown>>;
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

export interface RouteUnderstandingEventSeriesStage {
  sceneId?: string;
  id?: string;
  stageLabel?: string;
  label?: string;
  [extension: string]: unknown;
}

export interface RouteUnderstandingEventSeriesPattern {
  id?: string;
  prefix?: string;
  match?: string;
  sceneIds?: string[];
  stages?: RouteUnderstandingEventSeriesStage[];
  [extension: string]: unknown;
}

export interface RouteUnderstandingSchedulerSceneEvidence {
  sceneId?: string;
  id?: string;
  tag?: string;
  deckRoute?: string;
  route?: string;
  target?: string;
  protected?: boolean;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingProtectedRouterSceneEvidence {
  sceneId?: string;
  id?: string;
  reason?: string;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingUtilityRouteSceneEvidence {
  sceneId?: string;
  id?: string;
  utilityKind?: string;
  kind?: string;
  returnBinding?: string;
  binding?: string;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingProfileEvidence {
  profileId?: string;
  profileName?: string;
  eventSeriesPatterns?: RouteUnderstandingEventSeriesPattern[];
  schedulerScenes?: RouteUnderstandingSchedulerSceneEvidence[];
  protectedRouterScenes?: Array<string | RouteUnderstandingProtectedRouterSceneEvidence>;
  utilityRouteScenes?: RouteUnderstandingUtilityRouteSceneEvidence[];
  routeQualityVars?: unknown[];
  routeHelperTables?: unknown[];
  staticAliases?: Record<string, string> | unknown[];
  packages?: RouteUnderstandingProfileEvidence[];
  [extension: string]: unknown;
}

export interface RouteUnderstandingBuildOptions {
  eventId?: string;
  structure?: Record<string, unknown>;
  projectIndex?: ProjectIndex | Record<string, unknown>;
  profileEvidence?: RouteUnderstandingProfileEvidence[];
  routeEvidence?: RouteEvidenceMap;
  scriptImpactMap?: ScriptImpactMap;
  eventSeriesPatterns?: RouteUnderstandingEventSeriesPattern[];
  schedulerScenes?: RouteUnderstandingSchedulerSceneEvidence[];
  protectedRouterScenes?: Array<string | RouteUnderstandingProtectedRouterSceneEvidence>;
  utilityRouteScenes?: RouteUnderstandingUtilityRouteSceneEvidence[];
  options?: {
    projectIndex?: ProjectIndex | Record<string, unknown>;
    profileEvidence?: RouteUnderstandingProfileEvidence[];
    [extension: string]: unknown;
  };
  [extension: string]: unknown;
}

export interface RouteUnderstandingOutgoingRef {
  target: string;
  kind: string;
  condition?: string;
  source: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingEventChainItem {
  sceneId: string;
  sourcePath: string;
  stageLabel: string;
  entryGuard: string;
  metadata: {
    tags?: string[];
    priority?: string;
    frequency?: string;
    maxVisits?: string;
    [extension: string]: unknown;
  };
  outgoingRefs: RouteUnderstandingOutgoingRef[];
  semanticTier: RouteSemanticTier;
  evidenceClass: string;
  order?: number;
  [extension: string]: unknown;
}

export interface RouteUnderstandingEventChainSection {
  items: RouteUnderstandingEventChainItem[];
  summary?: Record<string, unknown>;
  [extension: string]: unknown;
}

export interface RouteUnderstandingSchedulerContextItem {
  sceneId: string;
  tag: string;
  deckRoute: string;
  entryMode: string;
  readiness: 'scheduler_proven' | 'profile_guided' | 'focused_entry_only' | 'unknown_wiring' | string;
  protected: boolean;
  semanticTier: RouteSemanticTier;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingSchedulerContextSection {
  items: RouteUnderstandingSchedulerContextItem[];
  summary?: Record<string, unknown>;
  [extension: string]: unknown;
}

export interface RouteUnderstandingUtilityCall {
  from: string;
  utilitySceneId: string;
  setJumpTarget: string;
  returnBinding: string;
  utilityKind: string;
  semanticTier: RouteSemanticTier;
  evidenceClass?: string;
  safeEditEligible: boolean;
  source?: SourceRef;
  [extension: string]: unknown;
}

export interface RouteUnderstandingStateDependency {
  ownerId: string;
  predicateReads: string[];
  preRouteWrites: string[];
  directDependencyWrites: string[];
  opaque: boolean;
  manualReasons: string[];
  [extension: string]: unknown;
}

export interface RouteUnderstandingModel {
  schemaVersion: string;
  kind: 'route_understanding';
  eventId: string;
  summary: Record<string, unknown>;
  eventChain: RouteUnderstandingEventChainSection;
  schedulerContext: RouteUnderstandingSchedulerContextSection;
  utilityCalls: RouteUnderstandingUtilityCall[];
  stateDependencies: RouteUnderstandingStateDependency[];
  diagnostics?: DiagnosticRow[];
  [extension: string]: unknown;
}

export interface RouteUnderstandingModelApi {
  buildRouteUnderstanding(eventBody: unknown, options?: RouteUnderstandingBuildOptions): RouteUnderstandingModel;
}

export type RouteGuidedEditKind =
  | 'utility_pair'
  | 'route_table_binding'
  | 'explicit_fallback_helper'
  | string;

export interface UtilityPairEdit {
  from: string;
  utilitySceneId: string;
  setJumpTarget: string;
  returnBinding: string;
  utilityKind: string;
  callSource: SourceRef;
  setJumpSource: SourceRef;
  callText: string;
  setJumpText: string;
  exactSource: boolean;
  profileBacked: boolean;
  [extension: string]: unknown;
}

export interface RouteBindingTableRowEdit {
  id: string;
  label: string;
  key?: string;
  condition?: string;
  target: string;
  source: SourceRef;
  sourceText: string;
  editable: boolean;
  manualReason?: string;
  [extension: string]: unknown;
}

export interface RouteBindingTableEdit {
  variable: string;
  shape: string;
  sourceKind: string;
  source: SourceRef;
  sourceText: string;
  candidateTargets: string[];
  rows: RouteBindingTableRowEdit[];
  [extension: string]: unknown;
}

export interface ExplicitFallbackSuggestion {
  sourceText: string;
  suggestedText: string;
  conditionalTarget: string;
  fallbackTarget: string;
  predicate: string;
  complementPredicate: string;
  source: SourceRef;
  editable: boolean;
  manualReason?: string;
  [extension: string]: unknown;
}

export interface RouteGuidedEditEntry {
  id: string;
  kind: RouteGuidedEditKind;
  label: string;
  semanticTier: RouteSemanticTier;
  safeEditEligible: boolean;
  installSafety: InstallSafety | string;
  evidenceClass?: string;
  source?: SourceRef;
  sourceEvidence?: Record<string, unknown>;
  manualReasons: string[];
  editAction?: EditAction | Record<string, unknown>;
  utilityPair?: UtilityPairEdit;
  routeTable?: RouteBindingTableEdit;
  fallbackSuggestion?: ExplicitFallbackSuggestion;
  [extension: string]: unknown;
}

export interface RouteGuidedEditModel {
  schemaVersion: string;
  kind: 'route_guided_edit_model';
  eventId: string;
  entries: RouteGuidedEditEntry[];
  summary: Record<string, unknown>;
  diagnostics: DiagnosticRow[];
}

export interface RouteGuidedEditBuildOptions {
  eventId?: string;
  projectIndex?: ProjectIndex | Record<string, unknown>;
  profileEvidence?: RouteUnderstandingProfileEvidence[];
  routeEvidence?: RouteEvidenceMap;
  scriptImpactMap?: ScriptImpactMap;
  routeUnderstanding?: RouteUnderstandingModel;
  routeOrderGroups?: unknown[];
  [extension: string]: unknown;
}

export interface RouteGuidedEditModelApi {
  buildRouteGuidedEditModel(eventBody: unknown, options?: RouteGuidedEditBuildOptions): RouteGuidedEditModel;
  build?: (eventBody: unknown, options?: RouteGuidedEditBuildOptions) => RouteGuidedEditModel;
}

export interface RouteScriptIntelligenceModel {
  schemaVersion: string;
  kind: 'route_script_intelligence_model';
  ok: boolean;
  eventId: string;
  routes: RouteEvidenceMap;
  scripts: ScriptImpactMap;
  routeUnderstanding?: RouteUnderstandingModel | null;
  routeGuidedEdits?: RouteGuidedEditModel | null;
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

export interface PredicateConditionModelApi {
  summarizePredicate(rawInput: string): PredicateSummary;
  predicateDependencies(raw: string): string[];
}

export interface RouteRuntimeTrialModelApi {
  enrichRuntimeSemantics(
    semantics: RouteRuntimeSemantics | Record<string, unknown>,
    preRouteScript: RoutePreRouteScriptSummary | Record<string, unknown>,
    collisionSummary: RouteCollisionSummary | Record<string, unknown>
  ): RouteRuntimeSemantics;
  preRouteScriptSummary(input: Record<string, unknown>): RoutePreRouteScriptSummary;
  emptyPreRouteScriptSummary(ownerId: string): RoutePreRouteScriptSummary;
  routeCollisionSummary(
    state: Record<string, unknown>,
    candidates: RouteCandidate[],
    preRouteScript: RoutePreRouteScriptSummary | Record<string, unknown>,
    options?: Record<string, unknown>
  ): RouteCollisionSummary;
  emptyCollisionSummary(): RouteCollisionSummary;
}

export interface RouteRuntimeSemanticsApi {
  routeRuntimeSemantics(
    state: Record<string, unknown>,
    candidates: RouteCandidate[],
    fallbackCandidate: RouteCandidate | null,
    dynamicTargetCount: number,
    unresolvedTargetCount: number
  ): RouteRuntimeSemantics;
  emptyPreRouteScriptSummary(ownerId: string): RoutePreRouteScriptSummary;
  emptyCollisionSummary(): RouteCollisionSummary;
}

declare global {
  interface Window {
    ProjectMapRouteStateModel?: RouteStateApi;
    ProjectMapPredicateConditionModel?: PredicateConditionModelApi;
    ProjectMapRouteRuntimeTrialModel?: RouteRuntimeTrialModelApi;
    ProjectMapRouteRuntimeSemanticsModel?: RouteRuntimeSemanticsApi;
    ProjectMapExistingSceneStructureOperations?: ExistingSceneStructureOperationsFactory;
    ProjectMapEventStructureEffectModel?: EventStructureEffectModelApi;
    ProjectMapEventStructureEffectSourceHelpers?: EventStructureEffectSourceHelpersApi;
    ProjectMapEventStructureCommandModel?: EventStructureCommandModelApi;
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
