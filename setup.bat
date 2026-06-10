@echo off
REM Colors not available in batch, using basic output

echo.
echo ================================================
echo Leave Management System - Setup Script
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo [OK] Node.js found
echo.

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install backend dependencies
    exit /b 1
)

echo [OK] Backend dependencies installed
echo.

REM Initialize database
echo Initializing database...
call npm run seed

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to initialize database
    exit /b 1
)

echo [OK] Database initialized
echo.

REM Install frontend dependencies
cd ..\frontend
echo Installing frontend dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install frontend dependencies
    exit /b 1
)

echo [OK] Frontend dependencies installed
echo.

echo ================================================
echo Setup complete!
echo ================================================
echo.
echo To start the application:
echo 1. Terminal 1 - Backend:   cd backend ^&^& npm run dev
echo 2. Terminal 2 - Frontend:  cd frontend ^&^& npm start
echo.
echo The app will be available at http://localhost:3000
echo.
