import { Router, type IRouter } from "express";
import { SAR_FRAMEWORK } from "../../lib/sarFramework.js";

const router: IRouter = Router();

router.get("/sar-definitions", (_req, res): void => {
  const definitions = SAR_FRAMEWORK.map((sar) => ({
    name: sar.name,
    definition: sar.definition,
    criteria: sar.criteria.map((c) => c.name),
  }));
  res.json(definitions);
});

export default router;
