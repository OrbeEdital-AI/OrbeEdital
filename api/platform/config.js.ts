// @ts-expect-error The generated bundle is created by `pnpm build` before Vercel packages API handlers.
import { handleVercelRequest } from "../_vercel-app.mjs";

export default function handler(req: any, res: any): void {
  handleVercelRequest(req, res);
}
