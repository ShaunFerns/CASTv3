import { Router, type IRouter } from "express";
import { db, moduleReviewsTable, programmesTable, programmeModulesTable, gaClassificationsTable } from "@workspace/db";
import { ne } from "drizzle-orm";

const router: IRouter = Router();

// ── GreenComp area groupings ───────────────────────────────────────────────
const GC_AREAS: Record<string, string[]> = {
  values:     ["ValuingSustainability", "SupportingFairness", "PromotingNature"],
  complexity: ["SystemsThinking", "CriticalThinking", "ProblemFraming"],
  futures:    ["FuturesLiteracy", "Adaptability", "ExploratoryThinking"],
  action:     ["PoliticalAgency", "CollectiveAction", "IndividualInitiative"],
};

// ── DigComp 3.0 area groupings ────────────────────────────────────────────
const DC_AREAS: Record<string, string[]> = {
  information:    ["BrowsingInfo", "EvaluatingInfo", "ManagingInfo"],
  communication:  ["Interacting", "Sharing", "Citizenship", "Collaborating", "DigitalBehaviour", "ManagingIdentity"],
  contentCreation:["DevelopingContent", "IntegratingContent", "CopyrightLicences", "ComputationalThinking"],
  safety:         ["ProtectingDevices", "ProtectingData", "SupportingWellbeing", "EnvironmentalImpact"],
  problemSolving: ["SolvingTechnical", "IdentifyingNeeds", "CreativeSolutions", "AddressingCompetenceGaps"],
};

// ── EntreComp area groupings ──────────────────────────────────────────────
const EC_AREAS: Record<string, string[]> = {
  ideas:     ["SpottingOpportunities", "Creativity", "Vision", "ValuingIdeas", "EthicalSustainableThinking"],
  resources: ["SelfAwareness", "Motivation", "MobilisingResources", "FinancialLiteracy", "MobilisingOthers"],
  action:    ["TakingInitiative", "PlanningManagement", "CopingWithUncertainty", "WorkingWithOthers", "LearningThroughExperience"],
};
const GA_DOMAINS = ["People", "Planet", "Partnership"] as const;

const ALL_SARS = [
  "Language Studies", "Quantitative Analysis", "Writing and Text Analysis",
  "Health / Wellness / Sports", "Sustainability", "Communications",
  "Creativity", "Digital Literacy",
];

// ── GET /cast-overview ────────────────────────────────────────────────────────
router.get("/cast-overview", async (_req, res): Promise<void> => {
  try {
    // ── 1. All modules ───────────────────────────────────────────────────────
    const modules = await db.select({
      id:                     moduleReviewsTable.id,
      reviewStatus:           moduleReviewsTable.reviewStatus,
      averageScoreFinal:      moduleReviewsTable.averageScoreFinal,
      selectedSarFinal:       moduleReviewsTable.selectedSarFinal,
      primarySarAi:           moduleReviewsTable.primarySarAi,
      freeElectiveProcessedAt: moduleReviewsTable.freeElectiveProcessedAt,
      freeElectiveBandAi:     moduleReviewsTable.freeElectiveBandAi,
      freeElectiveAverageAi:  moduleReviewsTable.freeElectiveAverageAi,
      createdAt:              moduleReviewsTable.createdAt,
    }).from(moduleReviewsTable);

    const total = modules.length;
    const scored   = modules.filter(m => m.averageScoreFinal != null).length;
    const reviewed = modules.filter(m => m.reviewStatus === "reviewed").length;

    // SAR band counts (raw, no calibration uplift)
    const sarBands = { strongFit: 0, moderateFit: 0, weakFit: 0 };
    let sarScoreSum = 0;
    let sarScoreCount = 0;
    const sarCounts: Record<string, number> = {};

    for (const m of modules) {
      const score = m.averageScoreFinal;
      if (score != null) {
        sarScoreSum += score;
        sarScoreCount++;
        if (score >= 3.0) sarBands.strongFit++;
        else if (score >= 2.0) sarBands.moderateFit++;
        else sarBands.weakFit++;
      }
      const sar = m.selectedSarFinal ?? m.primarySarAi;
      if (sar) sarCounts[sar] = (sarCounts[sar] ?? 0) + 1;
    }

    // Free electives
    const feModules = modules.filter(m => m.freeElectiveProcessedAt != null);
    const feRecommended = feModules.filter(m => m.freeElectiveBandAi === "Recommended").length;
    const feScoreSum = feModules.reduce((sum, m) => sum + (m.freeElectiveAverageAi ?? 0), 0);

    // ── 2. Programmes ────────────────────────────────────────────────────────
    const programmes = await db.select({ id: programmesTable.id, name: programmesTable.name, code: programmesTable.code })
      .from(programmesTable);

    const pmRows = await db.select({
      programmeId: programmeModulesTable.programmeId,
      moduleId:    programmeModulesTable.moduleId,
    }).from(programmeModulesTable);

    const mappedModuleIds = new Set(pmRows.map(r => r.moduleId));
    const perProg: Record<number, number> = {};
    for (const r of pmRows) perProg[r.programmeId] = (perProg[r.programmeId] ?? 0) + 1;

    // ── 3. GA classifications ────────────────────────────────────────────────
    const gaRows = await db.select({
      moduleId: gaClassificationsTable.moduleId,
      domain:   gaClassificationsTable.domain,
      level:    gaClassificationsTable.level,
      lens:     gaClassificationsTable.lens,
    }).from(gaClassificationsTable)
      .where(ne(gaClassificationsTable.level, "None"));

    // GA (lens="ga")
    const gaActive = new Set<number>();
    const gaByDomain: Record<string, Set<number>> = { People: new Set(), Planet: new Set(), Partnership: new Set() };
    for (const r of gaRows) {
      if (r.lens !== "ga") continue;
      if (!GA_DOMAINS.includes(r.domain as typeof GA_DOMAINS[number])) continue;
      gaActive.add(r.moduleId);
      gaByDomain[r.domain]?.add(r.moduleId);
    }

    // GreenComp (lens="greencomp")
    const gcActive = new Set<number>();
    const gcByArea: Record<string, Set<number>> = { values: new Set(), complexity: new Set(), futures: new Set(), action: new Set() };
    for (const r of gaRows) {
      if (r.lens !== "greencomp") continue;
      gcActive.add(r.moduleId);
      for (const [area, keys] of Object.entries(GC_AREAS)) {
        if (keys.includes(r.domain)) gcByArea[area].add(r.moduleId);
      }
    }

    // DigComp (lens="digcomp")
    const dcActive = new Set<number>();
    const dcByArea: Record<string, Set<number>> = {
      information: new Set(), communication: new Set(), contentCreation: new Set(),
      safety: new Set(), problemSolving: new Set(),
    };
    for (const r of gaRows) {
      if (r.lens !== "digcomp") continue;
      dcActive.add(r.moduleId);
      for (const [area, keys] of Object.entries(DC_AREAS)) {
        if (keys.includes(r.domain)) dcByArea[area].add(r.moduleId);
      }
    }

    // EntreComp (lens="entrecomp")
    const ecActive = new Set<number>();
    const ecByArea: Record<string, Set<number>> = {
      ideas: new Set(), resources: new Set(), action: new Set(),
    };
    for (const r of gaRows) {
      if (r.lens !== "entrecomp") continue;
      ecActive.add(r.moduleId);
      for (const [area, keys] of Object.entries(EC_AREAS)) {
        if (keys.includes(r.domain)) ecByArea[area].add(r.moduleId);
      }
    }

    // Latest module upload
    const latestUpload = modules.reduce<string | null>((latest, m) => {
      if (!m.createdAt) return latest;
      const ts = m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt);
      return latest === null || ts > latest ? ts : latest;
    }, null);

    // ── Response ─────────────────────────────────────────────────────────────
    res.json({
      modules: {
        total,
        scored,
        reviewed,
        mapped: mappedModuleIds.size,
        latestUpload,
      },
      sar: {
        scored,
        avgScore: sarScoreCount > 0 ? Math.round((sarScoreSum / sarScoreCount) * 100) / 100 : null,
        bands: sarBands,
        bySar: ALL_SARS.map(name => ({ name, count: sarCounts[name] ?? 0 })),
      },
      freeElectives: {
        analysed:    feModules.length,
        recommended: feRecommended,
        avgScore:    feModules.length > 0 ? Math.round((feScoreSum / feModules.length) * 100) / 100 : null,
      },
      programmes: {
        total:        programmes.length,
        list:         programmes.map(p => ({ ...p, moduleCount: perProg[p.id] ?? 0 })),
        totalMappings: pmRows.length,
        uniqueMapped: mappedModuleIds.size,
      },
      ga: {
        classified: gaActive.size,
        byDomain: {
          People:      gaByDomain.People.size,
          Planet:      gaByDomain.Planet.size,
          Partnership: gaByDomain.Partnership.size,
        },
      },
      greencomp: {
        classified: gcActive.size,
        byArea: {
          values:     gcByArea.values.size,
          complexity: gcByArea.complexity.size,
          futures:    gcByArea.futures.size,
          action:     gcByArea.action.size,
        },
      },
      digcomp: {
        classified: dcActive.size,
        byArea: {
          information:    dcByArea.information.size,
          communication:  dcByArea.communication.size,
          contentCreation:dcByArea.contentCreation.size,
          safety:         dcByArea.safety.size,
          problemSolving: dcByArea.problemSolving.size,
        },
      },
      entrecomp: {
        classified: ecActive.size,
        byArea: {
          ideas:     ecByArea.ideas.size,
          resources: ecByArea.resources.size,
          action:    ecByArea.action.size,
        },
      },
    });
  } catch (err) {
    console.error("[cast-overview]", err);
    res.status(500).json({ error: "Failed to aggregate CAST overview" });
  }
});

export default router;
