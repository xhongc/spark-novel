import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: process.env.JWT_SECRET || "spark-dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
};
