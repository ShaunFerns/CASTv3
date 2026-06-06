import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import modulesRouter from "./modules/index.js";
import dashboardRouter from "./dashboard/index.js";
import exportRouter from "./exportRoutes/index.js";
import sarDefinitionsRouter from "./sarDefinitionsRoute/index.js";
import structureRouter from "./structure/index.js";
import programmeMappingRouter from "./programmeMappingRoutes/index.js";
import moduleCatalogueRouter from "./moduleCatalogueRoutes/index.js";
import castOverviewRouter from "./castOverview/index.js";
import authRouter from "./authRoutes/index.js";
import securityRouter from "./security/index.js";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(securityRouter);
router.use(modulesRouter);
router.use(dashboardRouter);
router.use(exportRouter);
router.use(sarDefinitionsRouter);
router.use(structureRouter);
router.use(programmeMappingRouter);
router.use(moduleCatalogueRouter);
router.use(castOverviewRouter);

export default router;
