import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorHandler } from "../src/middleware/errorHandler";
import { authMiddleware } from "../src/middleware/auth.middleware";
import logger from "../src/utils/logger";

jest.mock("jsonwebtoken");

describe("🧱 Middleware Tests", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("errorHandler", () => {
    it("should respond with custom error message and status", () => {
      const error = { message: "Custom Error", statusCode: 400, stack: "fake-stack" };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(error.stack);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Custom Error" });
    });

    it("should respond with 500 if no statusCode is provided", () => {
      const error = { message: "Unknown error", stack: "stack-trace" };

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Unknown error" });
    });

    it("should handle errors with no message gracefully", () => {
      const error = {};

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
    });
  });

  describe("authMiddleware", () => {
    beforeEach(() => {
      process.env.JWT_SECRET = "test-secret";
      jest.spyOn(logger, "warn").mockImplementation(() => {});
    });

    it("should return 401 if no token provided", () => {
      mockReq.headers = {};

      authMiddleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Token not provided or invalid",
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should return 401 if header format is invalid", () => {
      mockReq.headers = { authorization: "InvalidTokenFormat" };

      authMiddleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Token not provided or invalid",
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should return 401 if JWT_SECRET is not configured", () => {
      delete process.env.JWT_SECRET;
      mockReq.headers = { authorization: "Bearer faketoken" };

      authMiddleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Token invalid or expired",
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should call next() if token is valid", () => {
      mockReq.headers = { authorization: "Bearer validtoken" };
      (jwt.verify as jest.Mock).mockReturnValue({ id: "123", name: "Tester" });

      authMiddleware(mockReq as any, mockRes as any, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith("validtoken", "test-secret");
      expect(mockReq.user).toEqual({ id: "123", name: "Tester" });
      expect(mockNext).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should return 401 if token is invalid", () => {
      mockReq.headers = { authorization: "Bearer invalidtoken" };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      authMiddleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Token invalid or expired",
      });
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
