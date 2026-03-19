import "./config/env"; // load env FIRST

import express from "express";
import buildingsRouter from "./routes/buildings";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// routes
app.use("/buildings", buildingsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});