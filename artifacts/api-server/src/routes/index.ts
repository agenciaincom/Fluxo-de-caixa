import { Router, type IRouter } from "express";
import healthRouter from "./health";
import billingRouter from "./billing";
import entradasRouter from "./entradas";
import saidasRouter from "./saidas";
import dashboardRouter from "./dashboard";
import avisosRouter from "./avisos";
import relatorioRouter from "./relatorio";
import scanRouter from "./scan";
import { requireSubscription } from "../middlewares/requireSubscription";

const router: IRouter = Router();

router.use(healthRouter);
router.use(billingRouter);

router.use(requireSubscription);

router.use(entradasRouter);
router.use(saidasRouter);
router.use(dashboardRouter);
router.use(avisosRouter);
router.use(relatorioRouter);
router.use(scanRouter);

export default router;
