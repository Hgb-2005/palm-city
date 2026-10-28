@echo off
cd /d "%~dp0"
title Palm City Preview
echo Palm City preview: http://127.0.0.1:4173/
echo Keep this window open while using the preview.
echo Press Ctrl+C to stop.
echo.
python -m http.server 4173 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Preview could not start. If it is already running, open the URL above.
  pause
)
