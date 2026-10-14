@echo off
REM Local dev launcher for the MedConnect API server.
REM Expects a PostgreSQL already listening (see: gradlew devDatabase).
setlocal

if "%DATABASE_URL%"=="" set DATABASE_URL=jdbc:postgresql://localhost:5432/postgres?user=postgres
if "%JWT_SECRET%"=="" set JWT_SECRET=local-dev-secret
if "%PORT%"=="" set PORT=8099
if "%RUN_MIGRATIONS%"=="" set RUN_MIGRATIONS=true

echo DATABASE_URL=%DATABASE_URL%
echo PORT=%PORT%
echo.

call "%~dp0gradlew.bat" --no-daemon --console=plain shadowJar
if errorlevel 1 exit /b 1

java -jar "%~dp0build\libs\medconnect-server.jar" %*