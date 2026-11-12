import { handleVercelRequest } from "../../server/vercel-app";

export default function handler(req: any, res: any): void {
  handleVercelRequest(req, res);
}
