// Integration-test setup. testcontainers boot is per-suite (in beforeAll).
// This file is reserved for future global setup (e.g., Pino silencer).
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
