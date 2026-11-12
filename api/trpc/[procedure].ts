// @ts-expect-error The generated bundle is created by `pnpm build` before Vercel packages API handlers.
import { handleVercelRequest } from "../_vercel-app.mjs";

export default function handler(req: any, res: any): void {
  try {
    handleVercelRequest(req, res);
  } catch (error) {
    console.error("tRPC handler failed", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: { message: "Não foi possível processar a solicitação." } }));
    }
  }
}
