import { Router } from "express";
import { db } from "../db";
import { buildings } from "../db/schema";

const router = Router();

// GET all buildings
router.get("/", async (req, res) => {
  try {
    const result = await db.select().from(buildings);
    res.json({ data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch buildings" });
  }
});

// POST create building
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await db
      .insert(buildings)
      .values({ name })
      .returning();

    res.json({
      message: "Building created",
      data: result[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Insert failed" });
  }
});

export default router;