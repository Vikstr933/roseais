# Git & Deployment Setup Script
# Run this script to configure Git and verify deployment setup

Write-Host "🚀 Git & Deployment Setup" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check Git installation
Write-Host "1. Checking Git installation..." -ForegroundColor Yellow
$gitVersion = git --version
Write-Host "   ✅ $gitVersion" -ForegroundColor Green

# Check Git configuration
Write-Host ""
Write-Host "2. Checking Git configuration..." -ForegroundColor Yellow
$gitName = git config --global user.name
$gitEmail = git config --global user.email

if ($gitName) {
    Write-Host "   ✅ Git user.name: $gitName" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Git user.name not set" -ForegroundColor Red
    Write-Host "   Run: git config --global user.name 'Your Name'" -ForegroundColor Yellow
}

if ($gitEmail) {
    Write-Host "   ✅ Git user.email: $gitEmail" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Git user.email not set" -ForegroundColor Red
    Write-Host "   Run: git config --global user.email 'your@email.com'" -ForegroundColor Yellow
}

# Check repository connection
Write-Host ""
Write-Host "3. Checking GitHub repository connection..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    Write-Host "   ✅ Remote: $remoteUrl" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No remote repository configured" -ForegroundColor Red
}

# Check .env file
Write-Host ""
Write-Host "4. Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content .env -Raw
    
    if ($envContent -match "GITHUB_TOKEN=") {
        $hasToken = $envContent -match "GITHUB_TOKEN=ghp_" -or $envContent -match "GITHUB_TOKEN=gho_"
        if ($hasToken) {
            Write-Host "   ✅ GITHUB_TOKEN configured" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  GITHUB_TOKEN needs to be set" -ForegroundColor Yellow
            Write-Host "   Get token from: https://github.com/settings/tokens" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  GITHUB_TOKEN not found in .env" -ForegroundColor Yellow
    }
    
    if ($envContent -match "VERCEL_TOKEN=") {
        $hasVercel = $envContent -match "VERCEL_TOKEN=.+" -and -not ($envContent -match "VERCEL_TOKEN=your_vercel_token")
        if ($hasVercel) {
            Write-Host "   ✅ VERCEL_TOKEN configured" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  VERCEL_TOKEN needs to be set" -ForegroundColor Yellow
            Write-Host "   Get token from: https://vercel.com/account/tokens" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  VERCEL_TOKEN not found in .env" -ForegroundColor Yellow
    }
    
    if ($envContent -match "DATABASE_URL=") {
        $hasDb = $envContent -match "DATABASE_URL=postgresql://" -and -not ($envContent -match "DATABASE_URL=postgresql://username:password")
        if ($hasDb) {
            Write-Host "   ✅ DATABASE_URL configured" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  DATABASE_URL needs to be set" -ForegroundColor Yellow
            Write-Host "   Get from: https://app.supabase.com/project/_/settings/database" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  DATABASE_URL not found in .env" -ForegroundColor Yellow
    }
    
    if ($envContent -match "ANTHROPIC_API_KEY=") {
        $hasAnthropic = $envContent -match "ANTHROPIC_API_KEY=sk-ant-" -and -not ($envContent -match "ANTHROPIC_API_KEY=sk-ant-api03-your-key-here")
        if ($hasAnthropic) {
            Write-Host "   ✅ ANTHROPIC_API_KEY configured" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  ANTHROPIC_API_KEY needs to be set" -ForegroundColor Yellow
            Write-Host "   Get from: https://console.anthropic.com/" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  ANTHROPIC_API_KEY not found in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  .env file not found" -ForegroundColor Red
    Write-Host "   Create .env file from env.example" -ForegroundColor Yellow
}

# Check current Git status
Write-Host ""
Write-Host "5. Current Git status..." -ForegroundColor Yellow
$status = git status --short 2>$null
if ($status) {
    Write-Host "   Files changed:" -ForegroundColor Cyan
    git status --short | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "   To commit and push:" -ForegroundColor Yellow
    Write-Host "   git add ." -ForegroundColor Cyan
    Write-Host "   git commit -m 'Your message'" -ForegroundColor Cyan
    Write-Host "   git push origin main" -ForegroundColor Cyan
} else {
    Write-Host "   ✅ Working directory clean" -ForegroundColor Green
}

Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configure Git:" -ForegroundColor Yellow
Write-Host "   git config --global user.name 'Your Name'" -ForegroundColor White
Write-Host "   git config --global user.email 'your@email.com'" -ForegroundColor White
Write-Host ""
Write-Host "2. Get GitHub Token:" -ForegroundColor Yellow
Write-Host "   https://github.com/settings/tokens" -ForegroundColor White
Write-Host "   Add to .env as: GITHUB_TOKEN=ghp_..." -ForegroundColor White
Write-Host ""
Write-Host "3. Get Vercel Token:" -ForegroundColor Yellow
Write-Host "   https://vercel.com/account/tokens" -ForegroundColor White
Write-Host "   Add to .env as: VERCEL_TOKEN=..." -ForegroundColor White
Write-Host ""
Write-Host "4. Push updates:" -ForegroundColor Yellow
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Your message'" -ForegroundColor White
Write-Host "   git push origin main" -ForegroundColor White
Write-Host ""
Write-Host "📖 Full guide: See GIT_AND_DEPLOYMENT_SETUP.md" -ForegroundColor Cyan
Write-Host ""

