const express = require("express");
const { encode } = require("./cbor-encode.js");

function createTestServer() {
  const app = express();
  app.use(express.raw({ type: "*/*" }));

  app.post("/api/GetItem", (req, res) => {
    const body = encode({ id: "123", name: "Test Item", active: true });
    res.set("Content-Type", "application/cbor");
    res.send(Buffer.from(body));
  });

  app.post("/api/SlowOperation", (req, res) => {
    const delay = parseInt(req.query.delay) || 2000;
    setTimeout(() => {
      const body = encode({ status: "completed", duration: delay });
      res.set("Content-Type", "application/cbor");
      res.send(Buffer.from(body));
    }, delay);
  });

  app.post("/api/Error", (req, res) => {
    const body = encode({ __type: "ValidationException", message: "Invalid input" });
    res.set("Content-Type", "application/cbor");
    res.status(400).send(Buffer.from(body));
  });

  let server;
  return {
    start(port = 0) {
      return new Promise((resolve) => {
        server = app.listen(port, "127.0.0.1", () => {
          resolve(server.address().port);
        });
      });
    },
    stop() {
      return new Promise((resolve) => {
        if (server) server.close(resolve);
        else resolve();
      });
    },
  };
}

module.exports = { createTestServer };
