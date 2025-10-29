@echo off
echo ============================================================
echo IMPORTING TO SUPABASE DATABASE
echo ============================================================
echo.

REM Supabase connection details
set PGHOST=aws-1-eu-north-1.pooler.supabase.com
set PGPORT=6543
set PGUSER=postgres.hngwzhlhlaggzzmgcwys
set PGDATABASE=postgres

echo Importing localhost-backup.sql to Supabase...
echo Host: %PGHOST%
echo.

psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f localhost-backup.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo SUCCESS! Database imported to Supabase!
    echo ============================================================
    echo.
    echo All tables, agents, users, and data have been migrated.
    echo You can now restart your dev server.
) else (
    echo.
    echo ============================================================
    echo ERROR: Import failed!
    echo ============================================================
    echo.
    echo Check the errors above for details.
)

pause
