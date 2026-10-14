import subprocess
import os

ps_script = """
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_speech.wav')
$speak.Speak('Welcome to Video A. We are demonstrating artificial intelligence caption generation.')
$speak.Dispose()
"""

with open("generate_tts.ps1", "w", encoding="utf-8") as f:
    f.write(ps_script)

res = subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", "generate_tts.ps1"], capture_output=True, text=True)
print("Return code:", res.returncode)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
if os.path.exists("test_speech.wav"):
    print("Wave file created! Size:", os.path.getsize("test_speech.wav"))
