/* global ZAFClient */
const client = ZAFClient.init();
client.invoke("resize", { width: "100%", height: "550px" });

// ==========================================
// INITIALIZATION
// ==========================================
client.on('app.registered', init);

async function init() {
    try {
        const data = await client.get([
            'ticket.subject',
            'ticket.requester.name'
        ]);
        const subject = data['ticket.subject'] || 'No Subject';
        const requester = data['ticket.requester.name'] || 'Unknown';

        document.getElementById('ticket-subject').textContent = subject;
        document.getElementById('ticket-customer').textContent = requester;
    } catch (e) {
        console.error('Failed to fetch ticket info:', e);
        document.getElementById('ticket-subject').textContent = 'Error loading';
        document.getElementById('ticket-customer').textContent = 'Error loading';
    }
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const settingsToggle = document.getElementById("settings-toggle");
const settingsChevron = document.getElementById("settings-chevron");
const settingsPanel = document.getElementById("settings-panel");

const btnGenerate = document.getElementById("btn-generate");
const btnInsert = document.getElementById("btn-insert");
const btnCopy = document.getElementById("btn-copy");
const btnRegenerate = document.getElementById("btn-regenerate");
const btnAttach = document.getElementById("btn-attach-context");
const btnAddUrl = document.getElementById("btn-add-url");

const inputInstruction = document.getElementById("ai-custom-instruction");
const inputContextFile = document.getElementById("context-file-input");
const inputKbFile = document.getElementById("kb-file-input");
const inputKbUrl = document.getElementById("kb-url-input");
const dropZone = document.getElementById("kb-drop-zone");

const outputArea = document.getElementById("ai-output");
const loadingIndicator = document.getElementById("loading-indicator");
const resultArea = document.getElementById("result-area");
const kbStatus = document.getElementById("kb-upload-status");
const contextFileName = document.getElementById("context-file-name");

// ==========================================
// EVENT LISTENERS
// ==========================================

// 1. Toggle Settings
settingsToggle.addEventListener("click", () => {
    const isHidden = settingsPanel.style.display === "none";
    settingsPanel.style.display = isHidden ? "block" : "none";
    
    if (isHidden) {
        settingsChevron.classList.add("open");
    } else {
        settingsChevron.classList.remove("open");
    }
});

// 2. Attach Context File
btnAttach.addEventListener("click", () => {
    inputContextFile.click();
});

inputContextFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        contextFileName.textContent = e.target.files[0].name;
    }
});

// 3. KB: Drag & Drop
dropZone.addEventListener("click", () => inputKbFile.click());
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#1f73b7";
});
dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "#c2c8cc";
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#c2c8cc";
    if (e.dataTransfer.files.length > 0) {
        handleKbUpload(e.dataTransfer.files[0]);
    }
});
inputKbFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        handleKbUpload(e.target.files[0]);
    }
});

// 4. KB: Add URL
btnAddUrl.addEventListener("click", () => {
    const url = inputKbUrl.value.trim();
    if (url) handleKbUrl(url);
});

// 5. Generate Reply
btnGenerate.addEventListener("click", async () => {
    setLoading(true);
    
    try {
        console.log('[AI Assistant] Starting draft generation...');
        
        // A. Get Ticket Data
        const ticketData = await client.get([
            'ticket.subject',
            'ticket.description',
            'ticket.requester.name'
        ]);

        const subject = ticketData['ticket.subject'];
        const description = ticketData['ticket.description'];
        const requesterName = ticketData['ticket.requester.name'];

        console.log('[AI Assistant] Ticket data:', { subject, requesterName });

        // B. Build ticket context
        const ticketContent = `Subject: ${subject}\n\nCustomer: ${requesterName}\n\nMessage:\n${description}`;

        // C. Get User Inputs
        const instruction = inputInstruction.value.trim();
        let fileContent = null;

        // D. Read Attached File (if any)
        if (inputContextFile.files.length > 0) {
            fileContent = await readFileAsText(inputContextFile.files[0]);
            console.log('[AI Assistant] File attached, length:', fileContent.length);
        }

        // E. Get API Endpoint
        const meta = await client.metadata();
        const baseUrl = meta.settings.api_endpoint ? String(meta.settings.api_endpoint).replace(/\/+$/, "") : "";

        console.log('[AI Assistant] API Endpoint:', baseUrl);

        // F. Mock Mode Check
        if (!baseUrl || baseUrl.includes("localhost")) {
            console.log('[AI Assistant] Running in MOCK mode');
            await mockResponse(subject, requesterName);
            
            // Auto-insert mock response
            console.log('[AI Assistant] Auto-inserting mock draft...');
            try {
                const replyTypeInput = document.querySelector('input[name="reply-type"]:checked');
                const replyType = replyTypeInput ? replyTypeInput.value : 'public';
                
                // Ensure editor exists
                await client.get('ticket.editor');
                
                // Set comment type
                if (replyType === 'internal') {
                    await client.invoke('ticket.comment.type', 'internalNote');
                } else {
                    await client.invoke('ticket.comment.type', 'publicReply');
                }
                
                // Insert text
                await client.invoke('ticket.editor.insert', outputArea.value);
                
                // Notify
                const notifyMsg = replyType === 'internal' 
                    ? 'Mock draft inserted as internal note!' 
                    : 'Mock draft inserted into public reply!';
                await client.invoke('notify', notifyMsg, 'notice');
                
            } catch (err) {
                console.error('[AI Assistant] Mock auto-insert failed:', err);
            }
            return;
        }

        // G. Call Backend API
        console.log('[AI Assistant] Calling API:', `${baseUrl}/api/ai-reply`);
        
        const resp = await client.request({
            url: `${baseUrl}/api/ai-reply`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                ticketContent,
                customInstruction: instruction,
                fileContext: fileContent
            })
        });

        console.log('[AI Assistant] API Response:', resp);

        if (resp && resp.reply) {
            // Show draft in sidebar
            outputArea.value = resp.reply;
            resultArea.style.display = "block";
            // Resize to fit result
            client.invoke('resize', { width: "100%", height: "600px" });

            // ✅ AUTO-INSERT into ticket reply box
            console.log('[AI Assistant] Auto-inserting draft...');
             
            try {
                // Get reply type (public or internal)
                const replyTypeInput = document.querySelector('input[name="reply-type"]:checked');
                const replyType = replyTypeInput ? replyTypeInput.value : 'public';
                 
                // 1. Ensure editor exists first
                await client.get('ticket.editor');
                 
                // 2. Set comment type BEFORE inserting
                if (replyType === 'internal') {
                    await client.invoke('ticket.comment.type', 'internalNote');
                } else {
                    await client.invoke('ticket.comment.type', 'publicReply');
                }
                 
                // 3. Then insert text
                await client.invoke('ticket.editor.insert', resp.reply);
                 
                // 4. Finally show notification
                const notifyMsg = replyType === 'internal' 
                    ? 'AI draft inserted as internal note!' 
                    : 'AI draft inserted into public reply!';
                await client.invoke('notify', notifyMsg, 'notice');
                 
                console.log('[AI Assistant] Draft inserted successfully');
                 
            } catch (insertError) {
                console.error('[AI Assistant] Auto-insert failed:', insertError);
                alert('Draft generated but could not auto-insert. Use the "Insert into Ticket Reply" button below.');
            }

        } else {
            throw new Error('No reply received from API');
        }

    } catch (err) {
        console.error('[AI Assistant] Error:', err);
        alert("Error generating reply: " + (err.responseText || err.statusText || err.message));
    } finally {
        setLoading(false);
    }
});

// 6. Insert Reply (Manual)
if (btnInsert) {
    btnInsert.addEventListener("click", async () => {
        try {
            const replyTypeInput = document.querySelector('input[name="reply-type"]:checked');
            const replyType = replyTypeInput ? replyTypeInput.value : 'public';
             
            // Ensure editor exists
            await client.get('ticket.editor');

            if (replyType === 'internal') {
                await client.invoke('ticket.comment.type', 'internalNote');
            } else {
                await client.invoke('ticket.comment.type', 'publicReply');
            }
             
            await client.invoke('ticket.editor.insert', outputArea.value);
             
            await client.invoke('notify', `Draft inserted as ${replyType === 'internal' ? 'internal note' : 'public reply'}!`, 'notice');
             
            console.log('[AI Assistant] Manual insert successful');
        } catch (error) {
            console.error('[AI Assistant] Insert error:', error);
            alert('Failed to insert draft: ' + error.message);
        }
    });
}

// 7. Copy to Clipboard
if (btnCopy) {
    btnCopy.addEventListener("click", () => {
        outputArea.select();
        document.execCommand("copy"); // Fallback for older browsers
        // Or use navigator.clipboard.writeText(outputArea.value)
        client.invoke('notify', 'Copied to clipboard!');
    });
}

// 8. Regenerate
if (btnRegenerate) {
    btnRegenerate.addEventListener("click", () => btnGenerate.click());
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function handleKbUpload(file) {
    kbStatus.textContent = `Uploading ${file.name}...`;
    
    try {
        const text = await readFileAsText(file);
        const meta = await client.metadata();
        const baseUrl = meta.settings.api_endpoint ? String(meta.settings.api_endpoint).replace(/\/+$/, "") : "";

        if (!baseUrl || baseUrl.includes("localhost")) {
             kbStatus.textContent = "Mock Upload Complete";
             return;
        }

        await client.request({
            url: `${baseUrl}/api/ingest`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                type: 'file',
                name: file.name,
                content: text
            })
        });
        kbStatus.textContent = "✓ Added to Knowledge Base";
    } catch (err) {
        kbStatus.textContent = "Error: " + err.message;
    }
}

async function handleKbUrl(url) {
    kbStatus.textContent = `Scraping ${url}...`;
    try {
        const meta = await client.metadata();
        const baseUrl = meta.settings.api_endpoint ? String(meta.settings.api_endpoint).replace(/\/+$/, "") : "";

        await client.request({
            url: `${baseUrl}/api/ingest`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                type: 'url',
                url: url
            })
        });
        kbStatus.textContent = "✓ URL content added to Knowledge Base";
    } catch (err) {
        kbStatus.textContent = "Error: " + err.message;
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function setLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? "flex" : "none";
    btnGenerate.disabled = isLoading;
    if (!isLoading && outputArea.value) {
        resultArea.style.display = "block";
    }
}

async function mockResponse(subject, requesterName) {
    await new Promise(r => setTimeout(r, 2000));
    outputArea.value = `Dear ${requesterName},

Thank you for contacting us regarding: ${subject}

[This is a MOCK response. Configure your API endpoint at https://kr-zendesk-ai-assistant.vercel.app to get real AI-generated replies.]

We appreciate your patience and will get back to you shortly.

Best regards,
Support Team`;
    resultArea.style.display = "block";
    setLoading(false);
}