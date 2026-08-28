# Jira Local Tracker

A small local dashboard for viewing Jira tasks, tracking your own workflow status, saving private notes, and getting AI delivery insights.

The app treats Jira as **read-only** for issue status. Your local status, labels, pins, notes, and Jira status history are saved to disk and are not sent back to Jira.

## Requirements

- Node.js 18 or newer
- An Atlassian Jira Cloud account (only needed for live Jira data)
- npm (included with Node.js)

## Run locally

### 1. Install dependencies

From the project folder:

```bash
npm install
```

### 2. Create your environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

The example file contains fake values. With those values, the app runs in demo mode and loads sample issues.

### 3. Start the app

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200).

Click **Sync** to load issues. If your `.env` still contains the dummy values, the demo board is used.

## Configure live Jira access

### 1. Find your Jira site URL

Your Jira site URL is the address you use to open Jira, for example:

```text
https://my-company.atlassian.net
```

Use the site URL only. Do not add `/browse`, `/rest/api`, or a trailing path.

### 2. Find your Atlassian account email

Use the email address associated with the Atlassian account that should access the issues.

### 3. Create a Jira API token

1. Sign in to Atlassian.
2. Open [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
3. Select **Create API token**.
4. Give it a descriptive name, such as `jira-local-tracker`.
5. Create the token and copy it immediately.

The token is shown only when it is created. Treat it like a password.

### 4. Put the real values in `.env`

Edit the `.env` file in the project root:

```env
JIRA_BASE_URL=https://my-company.atlassian.net
JIRA_EMAIL=your.name@company.com
JIRA_API_TOKEN=paste_your_token_here
JIRA_JQL=assignee = currentUser() ORDER BY updated DESC
OPENAI_API_KEY=
PORT=4000
```

Then restart the app:

```bash
npm start
```

The **demo** badge should disappear after the app loads. Click **Sync** to fetch your Jira issues.

### Jira permissions

The Jira user represented by the email and token must be allowed to browse the relevant Jira projects and issues. The default JQL shows issues assigned to that Jira user. You can change `JIRA_JQL`, for example:

```env
# All issues in one project
JIRA_JQL=project = ABC ORDER BY updated DESC

# Assigned issues that are not done
JIRA_JQL=assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC
```

Keep the JQL on one line.

## Optional AI provider

The app always provides local insights without an external AI key. To enable OpenAI-generated insights, add a real key to `.env`:

```env
OPENAI_API_KEY=your_openai_api_key
```

The key is read only by the server and is never placed in Angular browser code. If it is missing or dummy, local heuristics are used instead.

## Local-only tracking and persistence

From an issue row you can set:

- **My status** — Pending, Waiting, Blocked, Review, Done, or a custom value
- Local label
- Private notes
- Pin

These values are stored in:

```text
data/store.json
```

They survive browser refreshes and project restarts. The `data` folder is ignored by Git, so local tracking is not uploaded to GitHub.

## Security and GitHub safety

Never commit `.env`, API tokens, passwords, or `data/store.json`.

This repository ignores:

- `.env` and other environment files
- `data/store.json` and local tracking data
- build output and dependencies

Only `.env.example` should be committed, and it must contain placeholders such as:

```env
JIRA_EMAIL=example@example.com
JIRA_API_TOKEN=your_jira_api_token_here
```

If a real token was ever committed or shared, revoke it from Atlassian and create a new one. Removing a secret from the latest file is not enough if it exists in Git history.

## Upload the project to GitHub

Create a new empty repository on [GitHub](https://github.com/new). Do not add a README, `.gitignore`, or license there if this project already contains them.

Then, from the project folder:

```bash
git init
git add .
git commit -m "Add Jira local tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with your GitHub details.

Before pushing, verify that no secret or local database is staged:

```bash
git status
git diff --cached --name-only
```

You should see `.env.example`, but not `.env` or `data/store.json`.

If this project is already connected to a GitHub remote, use:

```bash
git add .
git commit -m "Document setup and protect local secrets"
git push
```

## Useful commands

```bash
npm start       # Start the local app
npm run build   # Create a production build
```
