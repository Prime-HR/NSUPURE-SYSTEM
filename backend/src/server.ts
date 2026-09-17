import { app } from "./app.js";
import { ENV } from "./config/env.js";
import { prisma } from "./utils/prisma.js";

const server = app.listen(ENV.PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`  NSUPURE MINERAL WATER ENTERPRISE - Operational API  `);
  console.log(`  Factory: Adumasa, Juaben Constituency, Ghana        `);
  console.log(`  Listening on http://localhost:${ENV.PORT}           `);
  console.log(`  Environment: ${ENV.NODE_ENV}                         `);
  console.log(`=======================================================`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    await prisma.$disconnect();
    console.log("Database connection closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
