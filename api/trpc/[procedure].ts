import { handleTrpcRequest } from "../../server/vercel-app";

export default function handler(req: any, res: any): void {
  handleTrpcRequest(req, res);
}
