import { Router, type IRouter } from "express";
import healthRouter from "./health";
import billingRouter from "./billing";
import entradasRouter from "./entradas";
import saidasRouter from "./saidas";
import dashboardRouter from "./dashboard";
import avisosRouter from "./avisos";
import relatorioRouter from "./relatorio";
import scanRouter from "./scan";
import conciliacaoRouter from "./conciliacao";
import { requireSubscription } from "../middlewares/requireSubscription";
import { requireConciliacao } from "../middlewares/requireConciliacao";

const router: IRouter = Router();

router.use(healthRouter);
router.use(billingRouter);

router.use(
  requireSubscription,
  entradasRouter,
  saidasRouter,
  dashboardRouter,
  avisosRouter,
  relatorioRouter,
  scanRouter,
);

router.use(requireConciliacao, conciliacaoRouter);

export default router;
