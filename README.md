# Zendesk AI Assistant App

This is a Zendesk Support App that uses OpenAI to automatically generate draft replies for tickets.

## Prerequisites

- Node.js (Installed)
- Zendesk CLI (`@zendesk/zcli`) (Installed)
- A Zendesk Support Account
- An OpenAI API Key (for the backend)
- A Vercel Account (or similar) to host the backend

## Project Structure

- `assets/`: Contains the frontend code (HTML/CSS/JS) that runs inside Zendesk.
- `manifest.json`: The app configuration file.
- `api/ai-reply.js`: The backend serverless function (compatible with Vercel).

## Setup Instructions

### 1. Authenticate Zendesk CLI
Before you can run or package the app, you must log in to your Zendesk instance:

```bash
zcli login -i
```
Follow the interactive prompts to enter your subdomain, email, and API token.

### 2. Local Development (Mock Mode)
You can test the app locally without a backend. The app is configured to use a "Mock Mode" if the API endpoint is not set.

```bash
zcli apps:server
```
Then, open your Zendesk instance and append `?zat=true` to the ticket URL (e.g., `https://subdomain.zendesk.com/agent/tickets/123?zat=true`). You might need to allow "Unsafe scripts" in your browser shield settings to load localhost content.

### 3. Deploying the Backend
The `api/ai-reply.js` file is designed to be deployed as a Serverless Function on Vercel.

1.  Create a new Vercel project.
2.  Deploy the `api` directory.
3.  Set the `OPENAI_API_KEY` environment variable in Vercel.
4.  Get your deployed URL (e.g., `https://my-zendesk-ai.vercel.app`).

### 4. Configuring the App
Once your backend is deployed:
1.  Open `manifest.json`.
2.  Update `domainWhitelist` with your Vercel domain (without `https://`).
3.  When installing the app in Zendesk, enter the full URL (e.g., `https://my-zendesk-ai.vercel.app`) in the `api_endpoint` setting.

### 5. Packaging & Installing
To create the zip file for upload:

```bash
zcli apps:package
```
This will create a `.zip` file in the current directory. Upload this file to Zendesk Admin Center > Apps > Private Apps.
