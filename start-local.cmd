@echo off
echo Starting Monitoring Service Components...

REM Kill any existing processes on our ports
echo Cleaning up existing processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *4001*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *5001*" 2>nul

REM Start the monitoring server with environment variables
echo Starting monitoring server on port 4001...
start "Monitoring Server - Port 4001" cmd /c "cd packages\server && set PORT=4001 && set DATABASE_URL=postgresql://monitoring:monitoring_password@localhost:5433/monitoring_service && set REDIS_URL=redis://localhost:6379 && set ADMIN_API_KEY=msk_admin_ca59f583e49d188262a53049aa8974184e20bbe83707d6b11b117d59125263d9 && npm run dev"

REM Wait for server to start
timeout /t 5 /nobreak >nul

REM Start the dashboard
echo Starting monitoring dashboard on port 5001...
start "Monitoring Dashboard - Port 5001" cmd /c "cd packages\dashboard && npm run dev"

echo.
echo Monitoring Service Started:
echo - Server: http://localhost:4001
echo - Dashboard: http://localhost:5001
echo.
echo Admin API Key: msk_admin_ca59f583e49d188262a53049aa8974184e20bbe83707d6b11b117d59125263d9
echo.
echo Press any key to stop all services...
pause >nul

echo Stopping services...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Monitoring*" 2>nul
echo Services stopped.