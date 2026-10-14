const fs = require('fs');
const { execSync } = require('child_process');

const assContent = `[Script Info]
Title: Word Highlight Test
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,40,40,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:03.00,Default,,0,0,0,,{\\c&H00FFFFFF&}Log sochte hain {\\c&H0000FFFF&\\b1}SHAYAD{\\r\\c&H00FFFFFF&} yahan
Dialogue: 0,0:00:03.00,0:00:06.00,Default,,0,0,0,,{\\c&H00FFFFFF&}to aaj apna {\\c&H00D542E8&\\b1}FUTURE SECURE{\\r\\c&H00FFFFFF&} hota!
`;

fs.writeFileSync('exports/test_highlight.ass', assContent, 'utf8');
const escapedAss = 'exports/test_highlight.ass'.replace(/\\/g, '/').replace(/:/g, '\\:');

console.log('Burning ASS subtitles onto demo clip...');
execSync(
  `ffmpeg -y -i "assets/demo_reel.mp4" -vf "subtitles='${escapedAss}'" -t 6 -c:v libx264 -preset ultrafast "exports/test_ass_render.mp4"`,
  { stdio: 'pipe' }
);

console.log('Extracting test frame at 4s...');
execSync(
  `ffmpeg -y -ss 00:00:04 -i "exports/test_ass_render.mp4" -vframes 1 -q:v 2 "exports/test_ass_frame.jpg"`,
  { stdio: 'pipe' }
);

console.log('ASS burn test completed successfully!');
