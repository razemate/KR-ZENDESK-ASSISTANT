const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config({ path: '../.env' }); // Load from root .env

// --- CONFIGURATION ---
// 1. Supabase (New Knowledge Base & Existing Subscriptions)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Google Gemini (For Embeddings)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004"}); // Optimized for embeddings

// 3. Zendesk (For Fetching Tickets)
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_AUTH = Buffer.from(`${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64');
const ZENDESK_API_URL = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;

// --- MAIN SYNC FUNCTION ---
async function syncTickets() {
  console.log("Starting 2025 Ticket Sync...");

  try {
    // STEP 1: READ ONLY from Existing Table (Woocommerce Subscriptions)
    // REPLACE 'woocommerce_subscriptions' with your ACTUAL table name
    console.log("Fetching subscribers from Supabase...");
    const { data: subscribers, error: subError } = await supabase
      .from('woocommerce_subscriptions') 
      .select('email'); // We only need the email to find their tickets

    if (subError) throw new Error(`Error fetching subscribers: ${subError.message}`);
    if (!subscribers || subscribers.length === 0) {
      console.log("No subscribers found. Exiting.");
      return;
    }

    const subscriberEmails = new Set(subscribers.map(s => s.email.toLowerCase()));
    console.log(`Found ${subscriberEmails.size} unique subscribers.`);

    // STEP 2: Fetch 2025 Tickets from Zendesk
    // We'll search for tickets created after Jan 1, 2025
    console.log("Fetching 2025 tickets from Zendesk...");
    const query = "type:ticket created>2025-01-01 status:closed"; // Only closed/solved tickets ideally
    let url = `${ZENDESK_API_URL}/search.json?query=${encodeURIComponent(query)}`;
    
    let processedCount = 0;

    while (url) {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Basic ${ZENDESK_AUTH}` }
      });

      const tickets = response.data.results;
      
      for (const ticket of tickets) {
        // Filter: Is this ticket from one of our subscribers?
        const requesterUrl = `${ZENDESK_API_URL}/users/${ticket.requester_id}.json`;
        try {
            // Optimization: In a real script, you might batch user lookups or rely on `via` object
            // For now, we fetch the user to get the email
            const userRes = await axios.get(requesterUrl, { headers: { 'Authorization': `Basic ${ZENDESK_AUTH}` }});
            const userEmail = userRes.data.user.email.toLowerCase();

            if (subscriberEmails.has(userEmail)) {
                await processTicket(ticket);
                processedCount++;
            }
        } catch (err) {
            console.error(`Failed to check user for ticket ${ticket.id}:`, err.message);
        }
      }

      url = response.data.next_page; // Pagination
    }

    console.log(`Sync Complete! Processed and indexed ${processedCount} tickets.`);

  } catch (err) {
    console.error("Critical Error:", err);
  }
}

// --- HELPER: Process & Index a Single Ticket ---
async function processTicket(ticket) {
  // 1. Get the conversation (comments) to find the Solution
  const commentsUrl = `${ZENDESK_API_URL}/tickets/${ticket.id}/comments.json`;
  const commentsRes = await axios.get(commentsUrl, { headers: { 'Authorization': `Basic ${ZENDESK_AUTH}` }});
  const comments = commentsRes.data.comments;

  // Simple heuristic: Last public comment from an Agent is likely the "Solution"
  // First comment is the "Problem"
  const problem = ticket.description;
  const agentReplies = comments.filter(c => c.author_id !== ticket.requester_id && c.public);
  
  if (agentReplies.length === 0) return; // No agent reply found
  
  const solution = agentReplies[agentReplies.length - 1].body; // Last reply

  // 2. Prepare Text for Embedding
  // Format: "Problem: <text> \n\n Solution: <text>"
  const textContent = `Ticket ID: ${ticket.id}\nSubject: ${ticket.subject}\n\nProblem:\n${problem}\n\nSolution:\n${solution}`;

  // 3. Generate Embedding (Gemini)
  const embeddingResult = await model.embedContent(textContent);
  const embedding = embeddingResult.embedding.values;

  // 4. WRITE ONLY to New Table (knowledge_base)
  const { error } = await supabase
    .from('knowledge_base')
    .insert({
      content: textContent,
      metadata: { 
        source: 'ticket', 
        ticket_id: ticket.id, 
        created_at: ticket.created_at,
        tags: ticket.tags
      },
      embedding: embedding
    });

  if (error) {
    console.error(`Failed to insert ticket ${ticket.id}:`, error.message);
  } else {
    console.log(`Indexed Ticket ${ticket.id}`);
  }
}

// Run the script
syncTickets();
