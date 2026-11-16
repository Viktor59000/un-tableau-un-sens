# Régénère les répliques de Gladys (app/lines.json -> assets/voice/*.mp3).
# Usage, depuis la racine du projet :  powershell -File tools\voix.ps1
# Prérequis : voix Windows « Microsoft Hortense Desktop », Python + « pip install lameenc ».
$wav = Join-Path $env:TEMP "spes-voix"; New-Item -ItemType Directory -Force $wav | Out-Null; Remove-Item "$wav\*.wav" -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Speech
$j = Get-Content -Raw -Encoding UTF8 "app\lines.json" | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice("Microsoft Hortense Desktop")
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($p in $j.PSObject.Properties) {
  $txt = if ($p.Value.say) { $p.Value.say } else { $p.Value.t }   # « say » = graphie phonétique pour la synthèse
  $esc = [System.Security.SecurityElement]::Escape($txt)
  $ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'><prosody rate='+16%' pitch='-4%'>$esc</prosody></speak>"
  $s.SetOutputToWaveFile((Join-Path $wav ($p.Name + ".wav")), $fmt); $s.SpeakSsml($ssml)
}
$s.SetOutputToNull(); $s.Dispose()
python tools\voix_mp3.py $wav
