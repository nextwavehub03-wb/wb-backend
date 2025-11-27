import express from "express";
import cors from "cors";
import pkg from "pg";
import fs from "fs";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" })); // para sa base64 photos

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render Postgres TLS
});

// Health
app.get("/", (_req, res) => res.json({ ok: true }));

// ===== MIGRATIONS =====
async function runMigrations() {
  const sql = fs.readFileSync("./migrations.sql", "utf8");
  await pool.query(sql);
  console.log("Migrations complete.");
}
if (process.argv[2] === "migrate") {
  runMigrations().then(() => process.exit(0));
}

// ===== INVENTORY =====
// GET all
app.get("/api/inventory", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, unit, model, year, dealer, price, descr, photos, created_at FROM inventory ORDER BY id DESC"
  );
  res.json(rows);
});

// BULK replace (para compatible sa saveInventory(list))
app.put("/api/inventory/bulk", async (req, res) => {
  const list = req.body?.list || [];
  // simple strategy: truncate then reinsert (ok for small data sets)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE inventory RESTART IDENTITY");
    for (const item of list) {
      const { unit, model, year, dealer, price, desc, descr, photos, createdAt } = item;
      await client.query(
        `INSERT INTO inventory (unit, model, year, dealer, price, descr, photos, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, to_timestamp($8/1000.0))`,
        [
          unit || "",
          model || "",
          Number(year) || null,
          dealer || null,
          String(price ?? ""),
          (descr ?? desc ?? "") || "",
          JSON.stringify(photos || []),
          createdAt || Date.now()
        ]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, count: list.length });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "bulk_failed" });
  } finally {
    client.release();
  }
});

// ===== INQUIRIES (sanla) =====
// GET list (para sa admin render at client refresh)
app.get("/api/inquiries", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, unit, model, year, contact, attachments, status, created_at FROM inquiries ORDER BY id DESC"
  );
  res.json(rows);
});

// POST new (client-side submit)
app.post("/api/inquiries", async (req, res) => {
  const { unit, model, year, contact, attachments, status, createdAt } = req.body || {};
  if (!unit || !model) return res.status(400).json({ error: "missing_fields" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO inquiries (unit, model, year, contact, attachments, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7/1000.0))
       RETURNING *`,
      [
        unit,
        model,
        Number(year) || null,
        contact || null,
        JSON.stringify(attachments || []),
        status || "new",
        createdAt || Date.now()
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "insert_failed" });
  }
});

// OPTIONAL: update status
app.patch("/api/inquiries/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const { rows } = await pool.query(
    "UPDATE inquiries SET status = COALESCE($1, status) WHERE id=$2 RETURNING *",
    [status, id]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

// ===== HOME BOTTOM GALLERY =====
app.get("/api/gallery", async (_req, res) => {
  const { rows } = await pool.query("SELECT images FROM gallery WHERE id=TRUE");
  res.json(rows[0]?.images || []);
});

app.put("/api/gallery", async (req, res) => {
  const images = req.body?.images || [];
  await pool.query("UPDATE gallery SET images=$1 WHERE id=TRUE", [JSON.stringify(images)]);
  res.json({ ok: true, count: images.length });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API listening on", PORT));
