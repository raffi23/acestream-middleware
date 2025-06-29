import { AxiosError } from "axios";
import { NextFunction, Request, Response } from "express";

export const error_middleware = (
  error: AxiosError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isAxiosError = error instanceof AxiosError;
  const status = isAxiosError ? error.status ?? 500 : 500;
  const message = error.message || "Internal server error";

  res.status(status).json({ success: false, message });
};
