# 🚀 New Computer Setup Guide

Welcome! This guide will help you get your development environment up and running on your new computer.

## ✅ What's Already Done

- ✅ Node.js installed (v24.11.1)
- ✅ npm installed (v11.6.2)
- ✅ Dependencies installed (`npm install` completed)
- ✅ `.env` file created with security keys generated

## 📋 What You Need to Do Next

### Step 1: Set Up Database (REQUIRED)

You need a PostgreSQL database. Choose one option:

#### Option A: Supabase (Recommended - Free & Easy)

1. Go to https://supabase.com/
2. Sign up/login and create a new project
3. Go to **Settings** → **Database**
4. Copy the **Connection String** (URI)
5. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@[PROJECT].supabase.co:5432/postgres`
6. Replace `[YOUR-PASSWORD]` with your database password
7. Update `DATABASE_URL` in your `.env` file

#### Option B: Local PostgreSQL

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. Create a database: `createdb ai_library`
3. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/ai_library
   ```

### Step 2: Get AI API Keys (REQUIRED)

#### Anthropic Claude API (Required)

1. Go to https://console.anthropic.com/
2. Sign up/login
3. Go to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-api03-`)
6. Update `ANTHROPIC_API_KEY` in your `.env` file

#### OpenAI API (Optional)

Only needed if you want to use GPT models:
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

### Step 3: Update Your .env File

Open `.env` in your editor and update these values:

```env
# Replace with your Supabase connection string
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres

# Replace with your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_ACTUAL_KEY_HERE
```

**Note:** The security keys (SESSION_SECRET, ENCRYPTION_KEY, etc.) are already generated - don't change them!

### Step 4: Run Database Migrations

Once your database is set up, run:

```powershell
# Make sure Node.js is in PATH
$env:Path = "C:\Program Files\nodejs;" + $env:Path

# Run migrations
npm run migrate
```

This will create all the necessary tables in your database.

### Step 5: Start the Development Server

```powershell
# Set PATH (if not already set)
$env:Path = "C:\Program Files\nodejs;" + $env:Path

# Start both frontend and backend
npm run dev
```

You should see:
- ✅ Frontend running at http://localhost:5173
- ✅ Backend running at http://localhost:3001

## 🎯 Quick Start (Minimum Setup)

If you want to get started quickly, you only need:

1. **DATABASE_URL** - From Supabase (5 minutes)
2. **ANTHROPIC_API_KEY** - From Anthropic (2 minutes)

Then run:
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run migrate
npm run dev
```

## 🔧 Troubleshooting

### "npm is not recognized"

Run this in PowerShell:
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

Or restart your PowerShell window.

### "Database connection failed"

- Check your `DATABASE_URL` format
- Make sure your Supabase project is active
- Verify the password is correct

### "ANTHROPIC_API_KEY is not set"

- Make sure `.env` file exists in project root
- Check the key starts with `sk-ant-api03-`
- No spaces around the `=` sign

### Port Already in Use

If port 3001 or 5173 is already in use:
- Change `PORT=3001` in `.env` to another port
- Or stop the process using that port

## 📚 Additional Resources

- **Full Setup Guide**: See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md)
- **Database Setup**: See [DATABASE_SETUP_INSTRUCTIONS.md](./DATABASE_SETUP_INSTRUCTIONS.md)
- **Project README**: See [README.md](./README.md)

## ✅ Checklist

- [ ] Created Supabase account and project
- [ ] Updated `DATABASE_URL` in `.env`
- [ ] Got Anthropic API key
- [ ] Updated `ANTHROPIC_API_KEY` in `.env`
- [ ] Ran `npm run migrate`
- [ ] Started dev server with `npm run dev`
- [ ] Opened http://localhost:5173 in browser

## 🎉 You're Ready!

Once you've completed the checklist, your development environment is ready!

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

Happy coding! 🚀

