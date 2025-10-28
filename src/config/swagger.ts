import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Express } from "express";

export const setupSwagger = (app: Express) => {
  const swaggerPath = path.join(__dirname, "../docs/openapi.yaml");
  const swaggerDocument = YAML.load(swaggerPath);

  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  console.log("📚 Swagger disponible en: http://localhost:4000/api/v1/docs");
};