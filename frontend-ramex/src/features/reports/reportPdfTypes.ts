export type ReportOrigin = "preloaded" | "upload";

export type ReportAnalysisType = "pure" | "forum" | "both";

export type ReportData = {
  datasetName: string;
  datasetOrigin: ReportOrigin;
  analysisType?: ReportAnalysisType;
  datasetType?: string;
  generatedAt: string;
  eventConstruction?: {
    mode?: "simple" | "advanced";
    caseColumn?: string | null;
    timeColumn?: string;
    caseWindow?: string;
    eventColumn?: string;
    eventColumns?: string[];
    ignoredColumns?: string[];
    numericDiscretization?: Record<string, string>;
    rules?: Record<string, string>;
    generatedEventColumn?: string;
    generatedCaseColumn?: string;
    uniqueEvents?: number;
    eventExamples?: string[];
    warnings?: string[];
  };
  parameters?: {
    minFrequency?: number;
    topN?: number | null;
    topKPerNode?: number;
    maxDepth?: number;
    polytreeStrategy?: "top-k" | "multiobjective" | string;
    minWeight?: number | null;
    alpha?: number;
    beta?: number;
    gamma?: number;
    delta?: number;
    epsilon?: number;
    zeta?: number;
    preserveWeightTarget?: number;
    maxBranching?: number;
    minScore?: number;
  };
  metrics: {
    sequences?: number;
    nodes?: number;
    edges?: number;
    density?: number;
    totalWeight?: number;
    ramexEdges?: number;
    ramexWeight?: number;
    ramexPreservedPercent?: number;
    polytreeNodes?: number;
    polytreeEdges?: number;
    polytreeWeight?: number;
    polytreePreservedPercent?: number;
    polytreeAverageScore?: number;
    polytreeInterpretabilityScore?: number;
    ramex2007PreservedPercent?: number;
    forwardPreservedPercent?: number;
    backForwardPreservedPercent?: number;
  };
  topTransitions: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
  allTransitions?: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
  transitionMatrix?: Record<string, Record<string, number>>;
  ramexEdges?: Array<{
    from: string;
    to: string;
    weight: number;
    level?: number;
  }>;
  polytreeEdges?: Array<{
    from: string;
    to: string;
    weight: number;
    level?: number;
    strategy?: string;
    score?: number;
    reason?: string;
  }>;
  pureRamex?: {
    bestAlgorithm?: string;
    structuralType?: string;
    summary?: string;
    ramex2007Root?: string;
    ramex2007Edges?: Array<{
      from: string;
      to: string;
      weight: number;
      level?: number;
    }>;
    ramex2007DominantPaths?: Array<{
      path?: string;
      branchDepth?: number;
      pathWeight?: number;
      bottleneckWeight?: number;
    }>;
    rows?: Array<{
      algorithm: string;
      method?: string;
      selectedEdges?: number;
      preservedWeightPercent?: number;
      anchor?: string;
    }>;
  };
  ramexForum?: {
    metrics?: {
      nodes?: number;
      edges?: number;
      totalWeight?: number;
      normalizedRelations?: number;
      mostInfluentialNode?: string;
      mostReceivedNode?: string;
      averageRelativeWeight?: number;
    };
    topRelation?: {
      from?: string;
      to?: string;
      weight?: number;
      relativeWeight?: number;
    };
    dominantPath?: string[];
    edges?: Array<{
      from?: string;
      to?: string;
      weight?: number;
      relativeWeight?: number;
      rank?: number;
    }>;
    simplifiedEdges?: Array<{
      from?: string;
      to?: string;
      weight?: number;
      relativeWeight?: number;
    }>;
    interpretation?: string;
    temporalPhase1?: {
      signals?: number;
      temporalRelations?: number;
      latencyMax?: number;
      epsilon?: number;
      totalInfluenceWeight?: number;
      graph?: string;
      matrix?: string;
    };
    temporalPhase2?: {
      heuristicUsed?: string;
      initialNodeMode?: string;
      selectedInitialNode?: string | null;
      initialEdge?: string | null;
      nodesBefore?: number;
      edgesBefore?: number;
      nodesAfter?: number;
      edgesAfter?: number;
      preservedInfluencePercent?: number;
      isDag?: boolean;
      isTree?: boolean;
      isPolytree?: boolean;
      dominantPath?: string[];
      edges?: Array<{
        from?: string;
        to?: string;
        weight?: number;
        direction?: string;
      }>;
      structureImage?: string;
      heuristicImage?: string;
    };
    images?: {
      graph?: string;
      simplified?: string;
    };
  };
  interpretations: {
    executiveSummary: string;
    graphInterpretation: string;
    ramexInterpretation: string;
    polytreeInterpretation: string;
    datasetInterpretation?: string;
    datasetsComparison?: string;
    conclusion: string;
  };
  images?: {
    graph?: string;
    ramex?: string;
    ramex2007?: string;
    ramex2007Analytical?: string;
    ramex2007Sankey?: string;
    forwardSankey?: string;
    backForwardSankeyTop50?: string;
    backForwardSankeyFull?: string;
    polytree?: string;
    forumGraph?: string;
    forumSimplified?: string;
  };
  frontendExports?: {
    observedGraph?: string;
    ramex2007Graph?: string;
    ramex2007Sankey?: string;
    forwardSankey?: string;
    backForwardSankeyTop50?: string;
    backForwardSankeyFull?: string;
    polytree?: string;
    temporalPhase1?: string;
    temporalPhase2?: string;
  };
  backendTechnicalImages?: {
    graph?: string;
    ramex2007?: string;
    forward?: string;
    backForward?: string;
    polytree?: string;
    forumGraph?: string;
    forumPhase2?: string;
  };
};
