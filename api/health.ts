type HealthRequest = {
  method?: string;
};

type HealthResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default function handler(
  _req: HealthRequest,
  res: HealthResponse
): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  res.end(JSON.stringify({ status: "ok", diagnostic: "isolated-health" }));
}
