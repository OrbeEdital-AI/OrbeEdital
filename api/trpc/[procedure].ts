import { handleVercelRequest } from "../../server/vercel-app.ts";

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
