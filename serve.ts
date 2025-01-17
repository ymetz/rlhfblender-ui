/* eslint-disable node/no-unpublished-import */
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

// Frontend
app.use(express.static("build"));
// Proxy requests to the backend
app.use(
  "/",
  createProxyMiddleware({
    target:
      "http://" + process.env.BACKEND_HOST + ":" + process.env.BACKEND_PORT,
    changeOrigin: false,
    proxyTimeout: 1000 * 60 * 5, // 5 minutes
    timeout: 1000 * 60 * 5, // 5 minutes
  }),
);
// Allow CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

app.listen(3000);
