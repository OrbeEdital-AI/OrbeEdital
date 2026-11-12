import type { Request, Response } from "express";
import app from "../../[...path]";

export default function handler(req: Request, res: Response): void {
  app(req, res);
}
