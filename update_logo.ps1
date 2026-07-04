$b64 = (Get-Content -Path "C:\Users\Dell\.gemini\antigravity\scratch\gym-finance-app\assets\logo_base64.txt" -Raw).Trim()
$html = Get-Content -Path "C:\Users\Dell\.gemini\antigravity\scratch\gym-finance-app\index.html" -Raw
$html = $html -replace 'data:image/png;base64,[A-Za-z0-9+/=]+', ("data:image/png;base64," + $b64)
Set-Content -Path "C:\Users\Dell\.gemini\antigravity\scratch\gym-finance-app\index.html" -Value $html -Encoding UTF8
