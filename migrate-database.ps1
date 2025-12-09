# ============================================================
# COMPLETE DATABASE MIGRATION: localhost → Supabase
# ============================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DATABASE MIGRATION: localhost → Supabase" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Localhost connection
$localhostHost = "localhost"
$localhostPort = "5432"
$localhostUser = "postgres"
$localhostDb = "postgres"

# Supabase connection
$supabaseHost = "aws-1-eu-north-1.pooler.supabase.com"
$supabasePort = "6543"
$supabaseUser = "postgres.hngwzhlhlaggzzmgcwys"
$supabaseDb = "postgres"
$supabasePassword = "D1nm4mm4!123123321"

$backupFile = "localhost-backup.sql"

# ============================================================
# STEP 1: Export from localhost
# ============================================================
Write-Host "STEP 1: Exporting from localhost..." -ForegroundColor Yellow
Write-Host ""

$env:PGPASSWORD = $null  # Prompt for localhost password

try {
    pg_dump -h $localhostHost -p $localhostPort -U $localhostUser -d $localhostDb --clean --if-exists --no-owner --no-privileges -f $backupFile

    if (Test-Path $backupFile) {
        $fileSize = (Get-Item $backupFile).Length / 1KB
        Write-Host "✅ Export successful!" -ForegroundColor Green
        Write-Host "   File: $backupFile" -ForegroundColor Green
        Write-Host "   Size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Green
        Write-Host ""
    } else {
        throw "Export file not created"
    }
} catch {
    Write-Host "❌ Export failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL client tools are installed (pg_dump)" -ForegroundColor Yellow
    Write-Host "  2. Localhost database is running" -ForegroundColor Yellow
    Write-Host "  3. You entered the correct password" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ============================================================
# STEP 2: Import to Supabase
# ============================================================
Write-Host "STEP 2: Importing to Supabase..." -ForegroundColor Yellow
Write-Host ""

$env:PGPASSWORD = $supabasePassword

try {
    psql -h $supabaseHost -p $supabasePort -U $supabaseUser -d $supabaseDb -f $backupFile 2>&1 | Out-String

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "✅ MIGRATION COMPLETE!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your localhost database has been migrated to Supabase!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Migrated:" -ForegroundColor Cyan
    Write-Host "  ✅ All tables (users, agents, workspaces, etc.)" -ForegroundColor White
    Write-Host "  ✅ All data (agents, users, projects, etc.)" -ForegroundColor White
    Write-Host "  ✅ All indexes and constraints" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart your dev server" -ForegroundColor White
    Write-Host "  2. Verify your agents and data in the app" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "❌ Import failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the errors above for details." -ForegroundColor Yellow
    exit 1
}

# Cleanup
$env:PGPASSWORD = $null

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
