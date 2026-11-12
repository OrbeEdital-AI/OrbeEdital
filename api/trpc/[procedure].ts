export default async function handler(req: any, res: any): Promise<void> {
  try {
    const { handleTrpcRequest } = await import("../../server/vercel-app");
    handleTrpcRequest(req, res);
  } catch (error) {
    console.error("tRPC function initialization failed", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: { message: "Não foi possível processar a solicitação." } }));
    }
  }
}
