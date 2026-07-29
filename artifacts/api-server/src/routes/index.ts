import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entradasRouter from "./entradas";
import saidasRouter from "./saidas";
import dashboardRouter from "./dashboard";
import avisosRouter from "./avisos";
import relatorioRouter from "./relatorio";
import scanRouter from "./scan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entradasRouter);
router.use(saidasRouter);
router.use(dashboardRouter);
router.use(avisosRouter);
router.use(relatorioRouter);
router.use(scanRouter);

export default router;
