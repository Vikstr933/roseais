@echo off
echo ============================================================
echo EXPORTING LOCALHOST DATABASE
echo ============================================================
echo.

REM Set localhost connection details
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres
set PGDATABASE=postgres

echo Exporting schema and data to localhost-backup.sql...
echo.

pg_dump -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% --clean --if-exists --no-owner --no-privileges -f localhost-backup.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo SUCCESS! Database exported to localhost-backup.sql
    echo ============================================================
    echo.
    echo File size:
    dir localhost-backup.sql | findstr localhost-backup.sql
    echo.
    echo Next step: Run import-to-supabase.bat
) else (
    echo.
    echo ============================================================
    echo ERROR: Export failed!
    echo ============================================================
    echo.
    echo Make sure:
    echo 1. PostgreSQL client tools are installed
    echo 2. Localhost database is running
    echo 3. Password is correct
)

pause
