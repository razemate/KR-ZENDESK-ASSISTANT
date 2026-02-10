1. Complete Instructions for AI Builder (IDE) - Zendesk Private App Development
Copy and paste this entire section to your AI builder:

🎯 ZENDESK PRIVATE APP DEVELOPMENT - CRITICAL REQUIREMENTS
A. MANDATORY FILE STRUCTURE
app-name/
├── manifest.json          ✅ REQUIRED - Must be valid JSON
├── assets/
│   ├── logo.png          ✅ REQUIRED - Exactly 128x128px PNG
│   ├── logo-small.png    ✅ REQUIRED - Exactly 64x64px PNG
│   ├── iframe.html       ✅ REQUIRED - Main UI file
│   ├── *.css            ⚠️  Optional - Stylesheets
│   └── *.js             ⚠️  Optional - JavaScript files
└── translations/
    └── en.json           ✅ REQUIRED - i18n translations
UPLOAD WILL FAIL IF:

Missing manifest.json
Missing both logo files (128px and 64px)
Missing translations/en.json
Invalid JSON syntax in any JSON file
B. MANIFEST.JSON REQUIREMENTS
✅ REQUIRED FIELDS (Non-negotiable)
{
  "name": "App Name",
  "author": {
    "name": "Company Name",
    "email": "support@company.com"    ← MUST HAVE EMAIL
  },
  "version": "1.0.0",
  "frameworkVersion": "2.0",           ← MUST BE "2.0"
  "defaultLocale": "en",               ← MUST HAVE THIS
  "location": {
    "support": {
      "ticket_sidebar": {              ← or navbar, topbar
        "url": "assets/iframe.html"    ← Path to main HTML
      }
    }
  }
}
⚠️ COMMON MANIFEST ERRORS TO AVOID
// ❌ WRONG - Will cause upload failure
{
  "author": "John Doe",              // Must be object with email
  "frameworkVersion": "1.0",         // Must be "2.0"
  "location": {
    "support": {
      "ticket_sidebar": "assets/iframe.html"  // Missing url property
    }
  }
}

// ✅ CORRECT
{
  "author": {
    "name": "John Doe",
    "email": "john@company.com"
  },
  "frameworkVersion": "2.0",
  "location": {
    "support": {
      "ticket_sidebar": {
        "url": "assets/iframe.html",
        "flexible": true
      }
    }
  }
}
C. ZENDESK APP FRAMEWORK (ZAF) - CRITICAL API USAGE
1. ALWAYS Initialize ZAF Client First
// ✅ CORRECT - Must be first thing in your main.js
const client = ZAFClient.init();

// ❌ WRONG - Don't try to use DOM before ZAF loads
document.getElementById('btn').addEventListener('click', ...);  // May fail
2. Getting Ticket Data - CORRECT SYNTAX
// ✅ CORRECT - Use client.get() with exact property names
const data = await client.get([
  'ticket.subject',           // ← Exact property name
  'ticket.description',       // ← Not 'ticket.body' or 'ticket.message'
  'ticket.requester.email',   // ← Use dot notation
  'ticket.requester.name',
  'ticket.id',
  'ticket.status'
]);

// Access results
const subject = data['ticket.subject'];         // ← Use bracket notation
const email = data['ticket.requester.email'];

// ❌ WRONG - These will fail
const data = await client.get('ticket');        // Too broad
const subject = data.subject;                   // Wrong access pattern
3. Inserting Text into Ticket Reply
// ✅ CORRECT - Use invoke method
client.invoke('ticket.editor.insert', 'Your draft text here');

// ❌ WRONG - These don't exist
client.insertText('...');
client.ticket.reply('...');
4. Making External API Calls - CRITICAL CORS HANDLING
// ✅ CORRECT - Use client.request() to avoid CORS
const response = await client.request({
  url: 'https://your-backend.vercel.app/api/endpoint',
  type: 'POST',                    // GET, POST, PUT, DELETE
  contentType: 'application/json',
  data: JSON.stringify({ key: 'value' })
});

// ❌ WRONG - Will fail with CORS error
const response = await fetch('https://your-backend.vercel.app/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' })
});
D. TICKET SIDEBAR CONSTRAINTS (CRITICAL UI RULES)
✅ DESIGN FOR NARROW WIDTH
/* Ticket sidebar is approximately 300-500px wide */
body {
  width: 100%;
  max-width: 500px;  /* Don't exceed this */
  padding: 10px;
  box-sizing: border-box;
}

/* ✅ CORRECT - Single column layouts only */
.container {
  display: flex;
  flex-direction: column;  /* NOT row */
  gap: 10px;
}

/* ❌ WRONG - Will overflow sidebar */
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;  /* Too wide! */
}
⚠️ IFRAME HEIGHT MANAGEMENT
// ✅ Set initial height in your main.js
client.invoke('resize', { width: '100%', height: '500px' });

// ✅ Update height dynamically when content changes
function updateHeight() {
  const height = document.body.scrollHeight;
  client.invoke('resize', { width: '100%', height: `${height}px` });
}
E. COMMON ZENDESK API GOTCHAS
1. Ticket Comments Are NOT Easily Accessible
// ⚠️ WARNING - ticket.comments doesn't give full conversation history
const data = await client.get('ticket.comments');
// Returns limited metadata, not full comment text

// ✅ BETTER - Use ticket.description for initial message
const data = await client.get('ticket.description');
// This gives you the customer's original message
2. Async/Await is Required
// ✅ CORRECT - Always await ZAF calls
const data = await client.get('ticket.subject');
console.log(data['ticket.subject']);

// ❌ WRONG - Will return Promise, not data
const data = client.get('ticket.subject');
console.log(data);  // [object Promise]
3. Error Handling
// ✅ CORRECT - Wrap ZAF calls in try/catch
try {
  const data = await client.get('ticket.subject');
  // Process data
} catch (error) {
  console.error('ZAF Error:', error);
  // Show user-friendly error
}
F. VERCEL BACKEND REQUIREMENTS (If Using External API)
1. CORS Headers - MANDATORY
// api/your-endpoint.js
export default async function handler(req, res) {
  // ✅ MUST HAVE - Zendesk will block without CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // ✅ MUST HANDLE OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Your logic here
  return res.status(200).json({ data: 'response' });
}
2. Always Return JSON with 200 Status
// ✅ CORRECT - Even errors return 200 with error field
try {
  const result = await processRequest();
  return res.status(200).json({ success: true, data: result });
} catch (error) {
  return res.status(200).json({ success: false, error: error.message });
}

// ❌ WRONG - Don't return 404/500 from Zendesk-facing endpoints
return res.status(500).json({ error: 'Failed' });
G. SECURITY - NEVER DO THESE
// ❌ NEVER hardcode API keys in code
const API_KEY = 'sk_live_12345';

// ❌ NEVER commit .env files
// ❌ NEVER expose keys in client-side JavaScript
// ❌ NEVER log sensitive data to console

// ✅ CORRECT - Use Vercel environment variables
const API_KEY = process.env.OPENAI_API_KEY;  // Server-side only
H. TESTING BEFORE UPLOAD
1. Validate Manifest
# Install ZCLI
npm install -g @zendesk/zcli

# Validate your app
zcli apps:validate /path/to/your-app

# Must show: ✓ No errors found
2. Test Locally
# Serve app locally
zcli apps:server /path/to/your-app

# Open Zendesk ticket and append: ?zcli_apps=true
# https://yoursubdomain.zendesk.com/agent/tickets/123?zcli_apps=true
I. PACKAGING FOR UPLOAD
# ✅ CORRECT - Zip from inside app directory
cd your-app-name/
zip -r ../app.zip . -x "*.git*" -x "*node_modules*" -x "*.DS_Store"

# ❌ WRONG - Don't zip the parent folder
zip -r app.zip your-app-name/  # Creates extra nested folder
Upload via: Admin Center → Apps & Integrations → Zendesk Support apps → Upload Private App

J. DEBUGGING CHECKLIST
When app doesn't work:

Open Browser Console (F12)

Look for JavaScript errors
Check Network tab for failed API calls
Look for CORS errors (red flag)
Check Zendesk Console Logs

console.log('[MY APP] Debug message');  // Use prefixes to find your logs
Verify ZAF SDK Loaded

if (typeof ZAFClient === 'undefined') {
  console.error('ZAF SDK not loaded!');
}
Test API Endpoint Directly

curl -X POST https://your-backend.vercel.app/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
K. QUICK REFERENCE - MOST USED ZAF METHODS
// Get ticket data
const data = await client.get('ticket.subject');

// Insert text into reply
await client.invoke('ticket.editor.insert', 'text');

// Make external API call
const response = await client.request({
  url: 'https://api.example.com/endpoint',
  type: 'POST',
  data: JSON.stringify({ key: 'value' })
});

// Get app settings from manifest
const metadata = await client.metadata();
const apiUrl = metadata.settings.api_endpoint;

// Resize iframe
await client.invoke('resize', { width: '100%', height: '500px' });

// Show notification
await client.invoke('notify', 'Operation successful!');
L. FINAL PRE-BUILD CHECKLIST
Before you start coding:

 Manifest has all required fields (name, author.email, version, frameworkVersion, defaultLocale)
 Both logo files prepared (128x128 and 64x64 PNG)
 Location matches user request (ticket_sidebar, navbar, or topbar)
 translations/en.json exists with app metadata
 HTML file includes ZAF SDK script tag
 JavaScript initializes ZAF client before DOM operations
 All external API calls use client.request(), not fetch()
 CSS designed for narrow width (if ticket_sidebar)
 Vercel backend has CORS headers configured
 No hardcoded credentials anywhere
ONLY START CODING AFTER THIS CHECKLIST IS COMPLETE.

🚨 MOST COMMON FAILURES (Avoid These)
Missing author.email in manifest → Upload rejected
Using fetch() instead of client.request() → CORS errors
Wrong property names in client.get() → Returns undefined
Forgetting defaultLocale in manifest → Upload rejected
Missing CORS headers in backend → API calls fail silently
Not handling OPTIONS preflight → POST requests fail
Using frameworkVersion: "1.0" → Deprecated, use "2.0"
Multi-column layouts in ticket_sidebar → UI overflow/broken
END OF INSTRUCTIONS - SAVE THIS ENTIRE DOCUMENT FOR REFERENCE

2. Fixed Auto Draft Reply App Files
I'll provide you with completely corrected, production-ready files:

FIXED FILE 1: manifest.json
{
  "name": "AI Draft Assistant",
  "author": {
    "name": "Katusa Research",
    "email": "support@katusaresearch.com",
    "url": "https://katusaresearch.com"
  },
  "version": "1.0.3",
  "frameworkVersion": "2.0",
  "defaultLocale": "en",
  "private": true,
  "location": {
    "support": {
      "ticket_sidebar": {
        "url": "assets/iframe.html",
        "flexible": true
      }
    }
  },
  "domainWhitelist": [
    "kr-zendesk-ai-assistant.vercel.app"
  ],
  "parameters": [
    {
      "name": "api_endpoint",
      "type": "text",
      "required": true,
      "secure": false,
      "default": "https://kr-zendesk-ai-assistant.vercel.app"
    }
  ]
}
FIXED FILE 2: assets/iframe.html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Draft Assistant</title>
  <link href="app-styles.css" rel="stylesheet">
</head>
<body>
  <!-- HEADER / SETTINGS TOGGLE -->
  <div class="settings-toggle" id="settings-toggle">
    <div class="toggle-left">
      <svg class="gear-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      <span class="app-title">Knowledge Base Settings</span>
    </div>
    <svg class="chevron-icon" id="settings-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>

  <!-- SETTINGS PANEL (Hidden by default) -->
  <div id="settings-panel" class="settings-panel" style="display:none;">
    <div class="panel-section">
      <div class="label">Add to Knowledge Base</div>
      
      <!-- URL Input -->
      <input type="text" id="kb-url-input" placeholder="Enter URL to scrape..." />
      <button id="btn-add-url" class="btn-secondary">Add URL</button>

      <div class="divider">OR</div>

      <!-- File Upload -->
      <div class="file-drop-zone" id="kb-drop-zone">
        <span>📄 Drag & Drop PDF/Text here or click to browse</span>
        <input type="file" id="kb-file-input" accept=".pdf,.txt,.doc,.docx" hidden />
      </div>
      <div id="kb-upload-status" class="status-text"></div>
    </div>
  </div>

  <!-- MAIN UI -->
  <div class="main-container">
    
    <!-- Ticket Info Display -->
    <div id="ticket-info" class="ticket-info">
      <div class="info-label">Ticket:</div>
      <div id="ticket-subject" class="info-value">Loading...</div>
      <div class="info-label">Customer:</div>
      <div id="ticket-customer" class="info-value">Loading...</div>
    </div>

    <!-- Additional Instructions Box -->
    <div class="input-group">
      <label class="input-label">Additional Instructions (optional)</label>
      <textarea id="ai-custom-instruction" 
                placeholder="e.g., Be more friendly, include refund policy, mention 24-hour support..."
                rows="3"></textarea>
    </div>

    <!-- Attachment Button (Context for THIS draft) -->
    <div class="input-group">
      <button id="btn-attach-context" class="btn-outline">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
        Attach Reference Document
      </button>
      <input type="file" id="context-file-input" accept=".pdf,.txt,.doc,.docx" hidden />
      <span id="context-file-name" class="file-name"></span>
    </div>

    <!-- Generate Button -->
    <div class="action-row">
      <button id="btn-generate" class="btn-primary">
        🤖 Generate Draft Reply
      </button>
    </div>

    <!-- Loading State -->
    <div id="loading-indicator" class="loading-state" style="display:none;">
      <div class="spinner"></div>
      <span>AI is analyzing ticket and generating reply...</span>
    </div>

    <!-- Result Area -->
    <div id="result-area" class="result-area" style="display:none;">
      <label class="input-label">Generated Draft Reply</label>
      <textarea id="ai-output" rows="12"></textarea>
      <div class="result-actions">
        <button id="btn-insert" class="btn-success">
          ✓ Insert into Ticket Reply
        </button>
        <button id="btn-copy" class="btn-secondary">
          📋 Copy to Clipboard
        </button>
        <button id="btn-regenerate" class="btn-secondary">
          🔄 Regenerate
        </button>
      </div>
    </div>

  </div>

  <script src="https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js"></script>
  <script src="main.js"></script>
</body>
</html>
FIXED FILE 3: assets/app-styles.css
/* Global Reset & Base Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  padding: 12px;
  margin: 0;
  box-sizing: border-box;
  color: #2f3941;
  background: #fff;
}

*, *:before, *:after {
  box-sizing: inherit;
}

/* Header / Settings Toggle */
.settings-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: #f8f9f9;
  border: 1px solid #d8dcde;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: background 0.2s, border-color 0.2s;
}

.settings-toggle:hover {
  background-color: #f0f3f5;
  border-color: #c2c8cc;
}

.toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-title {
  font-weight: 600;
  font-size: 13px;
  color: #2f3941;
}

.gear-icon {
  color: #68737d;
  flex-shrink: 0;
}

.chevron-icon {
  color: #68737d;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.chevron-icon.open {
  transform: rotate(180deg);
}

/* Settings Panel */
.settings-panel {
  background: #fff;
  border: 1px solid #d8dcde;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.panel-section .label {
  font-weight: 600;
  margin-bottom: 8px;
  display: block;
  font-size: 12px;
}

.divider {
  text-align: center;
  color: #87929d;
  font-size: 11px;
  margin: 12px 0;
  position: relative;
}

.divider:before,
.divider:after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #d8dcde;
}

.divider:before { left: 0; }
.divider:after { right: 0; }

/* File Drop Zone */
.file-drop-zone {
  border: 2px dashed #c2c8cc;
  border-radius: 4px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  background: #fafbfb;
  transition: all 0.2s;
  font-size: 12px;
  color: #68737d;
}

.file-drop-zone:hover {
  background: #f0f3f5;
  border-color: #1f73b7;
  color: #1f73b7;
}

/* Main Container */
.main-container {
  padding: 0;
}

/* Ticket Info Display */
.ticket-info {
  background: #f0f3f5;
  border: 1px solid #d8dcde;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 15px;
  font-size: 12px;
}

.info-label {
  font-weight: 600;
  color: #68737d;
  margin-top: 6px;
}

.info-label:first-child {
  margin-top: 0;
}

.info-value {
  color: #2f3941;
  margin-bottom: 4px;
  word-break: break-word;
}

/* Input Groups */
.input-group {
  margin-bottom: 14px;
}

.input-label {
  display: block;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 6px;
  color: #2f3941;
}

/* Inputs & Textareas */
textarea,
input[type="text"] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d8dcde;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
  resize: vertical;
}

textarea:focus,
input[type="text"]:focus {
  border-color: #1f73b7;
  outline: none;
  box-shadow: 0 0 0 3px rgba(31, 115, 183, 0.15);
}

textarea {
  line-height: 1.5;
}

/* Buttons */
button {
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  padding: 9px 16px;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  font-family: inherit;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #1f73b7;
  color: white;
  border: 1px solid #1f73b7;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background-color: #144a75;
  border-color: #144a75;
}

.btn-secondary {
  background-color: white;
  color: #2f3941;
  border: 1px solid #d8dcde;
  width: 100%;
  margin-top: 8px;
}

.btn-secondary:hover:not(:disabled) {
  border-color: #87929d;
  background-color: #f8f9f9;
}

.btn-outline {
  background: white;
  border: 1px solid #d8dcde;
  color: #2f3941;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.btn-outline:hover:not(:disabled) {
  background: #f8f9f9;
  border-color: #87929d;
}

.btn-success {
  background-color: #038153;
  color: white;
  border: 1px solid #038153;
  width: 100%;
}

.btn-success:hover:not(:disabled) {
  background-color: #03582f;
  border-color: #03582f;
}

/* Action Row */
.action-row {
  margin-top: 12px;
}

/* File Name Display */
.file-name {
  display: inline-block;
  font-size: 11px;
  color: #1f73b7;
  margin-top: 6px;
  font-style: italic;
}

/* Status Text */
.status-text {
  font-size: 11px;
  color: #68737d;
  margin-top: 8px;
  min-height: 16px;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  background: #f8f9f9;
  border: 1px solid #d8dcde;
  border-radius: 4px;
  margin-top: 12px;
  color: #68737d;
  font-size: 12px;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(31, 115, 183, 0.2);
  border-radius: