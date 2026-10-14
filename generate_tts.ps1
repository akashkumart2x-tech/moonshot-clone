
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speak.SetOutputToWaveFile('test_speech.wav')
$speak.Speak('Welcome to Video A. We are demonstrating artificial intelligence caption generation.')
$speak.Dispose()
