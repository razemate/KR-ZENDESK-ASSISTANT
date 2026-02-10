import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const json = (res, status, data) => {
  res.status(status).json(data);
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const { type, name, content } = req.body || {};

    if (!content) {
      return json(res, 400, { ok: false, error: "Missing content" });
    }

    // 1. Generate Embedding for the File/URL Content
    const embeddingResult = await embeddingModel.embedContent(content);
    const embedding = embeddingResult.embedding.values;

    // 2. Insert into Supabase Knowledge Base
    const { error } = await supabase
      .from('knowledge_base')
      .insert({
        content: content,
        metadata: { 
            source: type || 'file', 
            name: name || 'Unknown',
            ingested_at: new Date().toISOString()
        },
        embedding: embedding
      });

    if (error) {
      throw error;
    }

    return json(res, 200, { ok: true, message: "Ingested successfully" });

  } catch (e) {
    console.error("Ingest Error:", e);
    return json(res, 500, { ok: false, error: e.message || "Ingest Service Error" });
  }
}
