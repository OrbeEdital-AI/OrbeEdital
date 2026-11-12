import { handleTrpcRequest } from "../../server/vercel-app.ts";

export default function handler(req: any, res: any): void {
  try {
    handleTrpcRequest(req, res);
  } catch (error) {
    console.error("tRPC handler failed", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const message = error instanceof Error ? error.message : String(error);
      res.end(JSON.stringify({ error: { message } }));
    }
  }
}
