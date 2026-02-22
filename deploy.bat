@echo off
echo ========================================
echo SipSync Firebase Deployment
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Firebase authentication...
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo.
    echo You need to login to Firebase first.
    echo This will open your browser...
    echo.
    pause
    firebase login
    if errorlevel 1 (
        echo.
        echo Login failed. Please try again.
        pause
        exit /b 1
    )
)

echo.
echo Deploying to Firebase Hosting...
firebase deploy --only hosting

if errorlevel 1 (
    echo.
    echo Deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment Successful!
echo ========================================
echo.
echo Your site is live at:
echo https://sipsync-b400e.web.app
echo.
pause
