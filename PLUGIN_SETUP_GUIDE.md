# 📚 Plugin Integration Setup Guide

You now have **3 powerful integrations** available:
1. **Gmail** 📧 - Email management
2. **Google Calendar** 📅 - Event scheduling
3. **Notion** 📝 - Notes and knowledge management

---

## 🎉 What's New

Your AI assistant can now:
- ✅ Check your emails and calendar in one place
- ✅ Schedule meetings while referencing your inbox
- ✅ Create notes from email conversations
- ✅ Find free time slots for meetings
- ✅ Search across all your productivity tools
- ✅ Provide comprehensive daily briefings

**Example conversation:**
> **You:** "What should I work on today?"
> **Assistant:** "Good morning! 🌅 You have 3 meetings today:
> - 10am: Team standup
> - 2pm: Client presentation (I noticed Sarah emailed you the slides yesterday)
> - 4pm: 1-on-1 with John
>
> You also have 2 high-priority emails and 3 tasks in your Notion workspace. Want me to help prioritize?"

---

## 🚀 Quick Setup

### **1. Google Calendar** (5 minutes)

#### Step 1: Update Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (same one used for Gmail)
3. Go to **APIs & Services** → **Credentials**
4. Edit your existing OAuth 2.0 Client ID
5. Add to **Authorized redirect URIs**:
   ```
   http://localhost:3001/api/plugins/google-calendar/callback
   ```
6. Add these scopes in **OAuth consent screen**:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`

#### Step 2: Update .env
```bash
# Already have these from Gmail setup
GOOGLE_CLIENT_ID=your_actual_client_id
GOOGLE_CLIENT_SECRET=your_actual_secret

# Add this new line
GOOGLE_REDIRECT_URI_CALENDAR=http://localhost:3001/api/plugins/google-calendar/callback
```

#### Step 3: Connect in App
1. Restart your server
2. Go to Integrations page
3. Click "Connect Google Calendar"
4. Grant permissions

**Done!** ✅ Your assistant can now access your calendar.

---

### **2. Notion** (3 minutes)

#### Step 1: Create Notion Integration
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name it: "AI Library Assistant"
4. Select your workspace
5. Click **Submit**
6. Copy the **"Internal Integration Token"** (starts with `secret_`)

#### Step 2: Share Pages with Integration
1. Open Notion
2. Go to any page/database you want the assistant to access
3. Click **"..."** (top right) → **"Add connections"**
4. Select "AI Library Assistant"
5. Repeat for all pages you want to access

**Pro tip:** Share your main workspace page to give access to everything underneath!

#### Step 3: Add to .env
```bash
NOTION_API_KEY=secret_your_actual_token_here

# Optional: Set a parent page for new notes
NOTION_PARENT_PAGE_ID=your_page_id_here
```

**Get Page ID:** Open any Notion page → Copy URL → Extract the ID:
```
https://notion.so/My-Page-abc123def456?v=xxx
                      ^^^^^^^^^^^^^^^^
                      This is the Page ID
```

#### Step 4: Connect in App
1. Restart your server
2. Go to Integrations page
3. Click "Connect Notion"
4. Paste your API key

**Done!** ✅ Your assistant can now search and create Notion pages.

---

## 🎯 What Your Assistant Can Do Now

### **Gmail + Calendar Integration**
```
You: "Check my emails"
Assistant: Shows you 3 unread emails

You: "When can I meet with Sarah this week?"
Assistant: Checks calendar → "You're free Thursday 2-4pm and Friday 10-11am"

You: "Schedule 30min with Sarah on Thursday at 2pm"
Assistant: Creates calendar event → Sends confirmation
```

### **Calendar Capabilities**
- `list_calendar_events` - "Show my schedule for today/this week"
- `create_calendar_event` - "Schedule a meeting with John tomorrow at 3pm"
- `find_available_slots` - "When am I free on Friday?"

### **Notion Capabilities**
- `search_notion_pages` - "Find my notes about the project"
- `create_notion_page` - "Create a new note about today's meeting"
- `get_recent_notion_pages` - "What did I work on recently?"

### **Combined Power**
```
You: "Summarize my day"
Assistant:
"📅 Calendar: 3 meetings (team standup, client call, 1-on-1)
📧 Gmail: 5 unread emails (2 high priority from Sarah about Q4 budget)
📝 Notion: 3 tasks due today (Review PR, Update docs, Team sync prep)

I noticed Sarah's email relates to your 2pm meeting. Want me to create a Notion page with meeting prep notes?"
```

---

## 🔧 Troubleshooting

### Gmail/Calendar Issues

**Problem:** "No refresh token received"
**Solution:**
1. Go to [Google Account Settings](https://myaccount.google.com/permissions)
2. Remove "AI Library" from connected apps
3. Reconnect in your app (you'll see consent screen again)

**Problem:** "Token expired"
**Solution:** The app should auto-refresh. If it doesn't, check server logs and reconnect.

### Notion Issues

**Problem:** "Can't find pages"
**Solution:** Make sure you shared the pages with your integration (Step 2)

**Problem:** "Can't create pages"
**Solution:** Set `NOTION_PARENT_PAGE_ID` in .env and share that page with the integration

---

## 📊 API Rate Limits

Be aware of API limits:

| Service | Limit | Mitigation |
|---------|-------|------------|
| Gmail | 250 quota units/second | App handles automatically |
| Calendar | 1M requests/day | More than enough for personal use |
| Notion | 3 requests/second | App handles automatically |

---

## 🎨 Customization

### Sync Frequency
Edit in `server/plugins/[PluginName].ts`:
```typescript
settings: {
  syncFrequency: 'hourly',  // or 'daily', 'realtime'
  maxEventsPerSync: 100
}
```

### Add More Plugins
Want to add Slack, Trello, or other services? The architecture is ready:
1. Create `[ServiceName]Plugin.ts`
2. Implement the same interface
3. Register in `server/routes/plugins.ts`

---

## 🚦 Next Steps

1. **Restart your server** to load the new plugins
2. **Connect Calendar and Notion** from Integrations page
3. **Try these commands** in the assistant:
   - "What's on my calendar today?"
   - "Search my Notion for meeting notes"
   - "Create a new note about this conversation"
4. **Ask for a daily summary:** "What should I focus on today?"

---

## 🎓 Advanced Usage

### Create Smart Workflows
```
"When I get an email from Sarah about meetings, check my calendar and suggest times"
"Every Monday morning, create a Notion page with my week's schedule"
"If I have a meeting in 30 minutes, show me related emails and Notion notes"
```

### Use Natural Language
The assistant understands context:
```
You: "Check my emails"
Assistant: Shows emails

You: "Create a meeting about the second one"
Assistant: Knows which email you mean → Creates relevant meeting

You: "Add notes to Notion"
Assistant: Creates Notion page with email content + meeting details
```

---

## 📚 Resources

- [Google Calendar API Docs](https://developers.google.com/calendar)
- [Notion API Docs](https://developers.notion.com/)
- [Gmail API Docs](https://developers.google.com/gmail/api)

---

## ✨ Tips for Best Results

1. **Be specific with time:** "Schedule meeting Thursday 2pm" vs "Schedule meeting sometime"
2. **Use names:** "Find notes about Project X" vs "Find notes"
3. **Combine requests:** "Check emails and calendar for today"
4. **Ask for suggestions:** "What should I prioritize?" lets the AI analyze everything

---

## 🎉 You're All Set!

Your AI assistant is now connected to your entire productivity stack. Try asking:
- "Give me a full briefing for today"
- "What meetings do I have this week?"
- "Find my Notion notes about the project"
- "Create a meeting summary and save it to Notion"

Enjoy your supercharged productivity assistant! 🚀
