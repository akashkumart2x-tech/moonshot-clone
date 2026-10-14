
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_assets/audio_a.wav')
$speak.Speak('Welcome to Video A. We are demonstrating artificial intelligence caption generation.')
$speak.Dispose()
