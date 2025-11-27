CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  unit TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  dealer TEXT,
  price TEXT,          -- iniwan kong TEXT kasi string din sa UI
  descr TEXT,          -- "desc" sa UI; reserved word sa iba, kaya "descr"
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  unit TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  contact TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,  -- base64 images/pdfs
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,    -- single row table (id=true)
  images JSONB DEFAULT '[]'::jsonb
);

INSERT INTO gallery (id, images)
  VALUES (TRUE, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
