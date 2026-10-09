$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path "out" | Out-Null
javac --add-modules jdk.httpserver -d out src\Main.java
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
java --add-modules jdk.httpserver -cp out Main
