
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_assets/audio_b.wav')
$speak.Speak('This is Video B. We are discussing international markets, interest rates, and cryptocurrency investments.')
$speak.Dispose()
