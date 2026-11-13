import { handleVercelRequest } from "../_vercel-app.mjs";

export default function handler(req: any, res: any): void {
  handleVercelRequest(req, res);
}
