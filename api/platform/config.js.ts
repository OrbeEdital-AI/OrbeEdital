import type { Request, Response } from "express";
import app from "../../server/vercel-app";

export default function handler(req: Request, res: Response): void {
  app(req, res);
}
