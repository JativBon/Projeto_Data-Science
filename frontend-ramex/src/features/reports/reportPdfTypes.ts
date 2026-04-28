export type ReportOrigin = "preloaded" | "upload";

export type ReportAnalysisType = "pure" | "forum" | "both";

export type ReportData = {
  datasetName: string;
  datasetOrigin: ReportOrigin;
  analysisType?: ReportAnalysisType;
  datasetType?: string;
  generatedAt: string;
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
    polytree?: string;
    forumGraph?: string;
    forumSimplified?: string;
  };
};
