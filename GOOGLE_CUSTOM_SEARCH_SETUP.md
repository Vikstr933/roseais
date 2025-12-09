# 🔍 Google Custom Search API Setup Guide

This guide will help you set up Google Custom Search API for Elon's web search functionality.

## Why Google Custom Search API?

- **Better Results**: More accurate and comprehensive search results than free alternatives
- **Local Business Info**: Excellent for finding addresses, phone numbers, business hours
- **Reliable**: Production-grade API with good uptime
- **Free Tier**: 100 free searches per day (perfect for most use cases)

## Step-by-Step Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "AI Library Search")
4. Click "Create"

### Step 2: Enable Custom Search API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Custom Search API"
3. Click on "Custom Search API"
4. Click **Enable**

### Step 3: Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy your API key (you'll need this for `GOOGLE_CUSTOM_SEARCH_API_KEY`)
4. (Optional) Click "Restrict Key" to limit usage:
   - Under "API restrictions", select "Restrict key"
   - Choose "Custom Search API"
   - Click "Save"

### Step 4: Create a Custom Search Engine

1. Go to [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/create)
2. Click **Add** to create a new search engine
3. **Sites to search**: Enter `*` (asterisk) to search the entire web
   - Or specify domains like `*.com`, `*.se` for specific regions
4. **Name**: Give it a name (e.g., "Elon Web Search")
5. Click **Create**
6. Click **Control Panel** for your new search engine
7. Under **Basics**, find **Search engine ID** (you'll need this for `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`)
8. Under **Setup**, enable **Search the entire web**
9. Click **Save**

### Step 5: Add Environment Variables

Add these to your `.env` file (or Render/Vercel environment variables):

```env
GOOGLE_CUSTOM_SEARCH_API_KEY=your-api-key-here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your-search-engine-id-here
```

**For Production (Render):**
1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add the two variables above
5. Click **Save Changes**

## How It Works

1. **Primary**: Elon uses Google Custom Search API when configured
2. **Fallback**: If Google fails or isn't configured, falls back to DuckDuckGo
3. **Error Handling**: If both fail, Elon will inform the user and provide error logs

## Pricing

- **Free Tier**: 100 searches per day
- **Paid**: $5 per 1,000 additional searches
- **Monthly Free**: 100 searches/day = ~3,000 searches/month free

## Testing

Once configured, test with:
- "Colorama Lund address"
- "Tesla contact information"
- "Stockholm weather"

Elon should now return accurate, real-time information from Google!

## Troubleshooting

### "API key not valid"
- Check that the API key is correct
- Ensure Custom Search API is enabled in your Google Cloud project
- Verify API key restrictions allow Custom Search API

### "Search engine ID not found"
- Check that the Search Engine ID is correct
- Ensure "Search the entire web" is enabled in your search engine settings

### "Quota exceeded"
- You've exceeded 100 free searches per day
- Wait 24 hours or upgrade to paid tier
- System will automatically fall back to DuckDuckGo

### Still using DuckDuckGo?
- Check that both environment variables are set correctly
- Restart your backend server after adding environment variables
- Check logs for "Google Custom Search API not configured" message

## Security Best Practices

1. **Restrict API Key**: Limit to Custom Search API only
2. **Set Quota Limits**: In Google Cloud Console, set daily quotas
3. **Monitor Usage**: Check API usage in Google Cloud Console regularly
4. **Never Commit Keys**: Keep `.env` file out of version control

## Support

If you encounter issues:
1. Check Google Cloud Console for API errors
2. Review backend logs for detailed error messages
3. Verify environment variables are set correctly
4. Test API key directly using curl:

```bash
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_ENGINE_ID&q=test"
```

