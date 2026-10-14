@echo off
rem Starts the MedConnect test emulator.
rem -dns-server is REQUIRED: the emulator's default DNS (10.0.2.3) times out
rem on this network, which breaks the app's API calls.
set "SDK=%LOCALAPPDATA%\Android\Sdk"
if not exist "%SDK%\emulator\emulator.exe" set "SDK=E:\AndroidSdk"
"%SDK%\emulator\emulator.exe" -avd medconnect -no-boot-anim -gpu swiftshader_indirect -dns-server 8.8.8.8,1.1.1.1 -no-snapshot-save
pause
