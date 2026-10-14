import subprocess
import os

print("=== Generating 3 Distinct Test Videos ===")
os.makedirs("test_assets", exist_ok=True)

# Generate Audio for Video A
ps_a = """
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_assets/audio_a.wav')
$speak.Speak('Welcome to Video A. We are demonstrating artificial intelligence caption generation.')
$speak.Dispose()
"""
with open("test_assets/gen_a.ps1", "w", encoding="utf-8") as f:
    f.write(ps_a)
subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", "test_assets/gen_a.ps1"], check=True)

# Generate Audio for Video B
ps_b = """
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_assets/audio_b.wav')
$speak.Speak('This is Video B. We are discussing international markets, interest rates, and cryptocurrency investments.')
$speak.Dispose()
"""
with open("test_assets/gen_b.ps1", "w", encoding="utf-8") as f:
    f.write(ps_b)
subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", "test_assets/gen_b.ps1"], check=True)

# Generate Silent Audio for Video C
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "4.5",
    "test_assets/audio_c.wav"
], check=True)

# Video A: Blue background + Audio A (~6s)
subprocess.run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=navy:s=1080x1920:r=30",
    "-i", "test_assets/audio_a.wav",
    "-shortest",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "128k",
    "test_assets/video_a.mp4"
], check=True)

# Video B: Green background + Audio B (~8s)
subprocess.run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=darkgreen:s=1080x1920:r=30",
    "-i", "test_assets/audio_b.wav",
    "-shortest",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "128k",
    "test_assets/video_b.mp4"
], check=True)

# Video C: Red background + Silent Audio (~4.5s)
subprocess.run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=darkred:s=1080x1920:r=30",
    "-i", "test_assets/audio_c.wav",
    "-shortest",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "128k",
    "test_assets/video_c.mp4"
], check=True)

print("Generated test videos:")
for f in ["video_a.mp4", "video_b.mp4", "video_c.mp4"]:
    p = os.path.join("test_assets", f)
    print(f"  {f}: size={os.path.getsize(p)} bytes")
