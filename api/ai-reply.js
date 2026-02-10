import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Helper for JSON responses with CORS
const json = (res, status, data) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow Zendesk to call this
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (status === 200) {
      res.status(status).json(data);
  } else {
      res.status(status).json(data);
  }
};

export default async function handler(req, res) {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1. Method Check
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    // 2. Parse Body
    const { ticketContent, customInstruction, fileContext } = req.body || {};

    if (!ticketContent) {
      return json(res, 400, { ok: false, error: "Missing ticket content" });
    }

    // 3. RAG: Retrieve Relevant Info from Supabase
    //    We embed the ticket content to find similar past issues/docs
    const embeddingResult = await embeddingModel.embedContent(ticketContent);
    const embedding = embeddingResult.embedding.values;

    const { data: documents, error: searchError } = await supabase.rpc('match_knowledge_base', {
      query_embedding: embedding,
      match_threshold: 0.5, // Adjust sensitivity
      match_count: 3        // Get top 3 matches
    });

    if (searchError) {
      console.error("Supabase Search Error:", searchError);
      // We continue without context if search fails
    }

    // Format retrieved context
    let contextText = "";
    if (documents && documents.length > 0) {
      contextText = documents.map(doc => `[Reference]: ${doc.content}`).join("\n\n");
    }

    // 4. Construct Prompt
    const systemPrompt = `You are a helpful, professional customer support agent.
Use the provided [Reference] context to answer the customer's question if relevant.
If the references don't help, use your general knowledge but be polite.
Follow any [Custom Instructions] provided by the agent.`;

    let userPrompt = `CUSTOMER TICKET:\n"${ticketContent}"\n\n`;

    if (contextText) {
      userPrompt += `RELEVANT KNOWLEDGE BASE:\n${contextText}\n\n`;
    }

    if (fileContext) {
      userPrompt += `ATTACHED FILE CONTEXT:\n${fileContext}\n\n`;
    }

    if (customInstruction) {
      userPrompt += `CUSTOM INSTRUCTIONS:\n${customInstruction}\n\n`;
    }

    userPrompt += `Please draft a reply to the customer.`;

    // 5. Call Gemini
    const result = await model.generateContent({
        contents: [
            { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }]}
        ]
    });

    const reply = result.response.text();

    // 6. Return Result
    return json(res, 200, { ok: true, reply });

  } catch (e) {
    console.error("AI Error:", e);
    return json(res, 500, { ok: false, error: e.message || "AI Service Error" });
  }
}
