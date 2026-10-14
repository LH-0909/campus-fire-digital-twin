"""Build labelled QA comparisons from actual browser screenshots, without editing them."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent.parent
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
sources={
 'command':'ChatGPT 图像 2026年10月13日 19_43_40-1.png',
 'student':'ChatGPT 图像 2026年10月13日 19_44_05-2.png',
 'review':'ChatGPT 图像 2026年10月13日 19_44_12-4.png',
}
for page,source in sources.items():
 reference=Image.open(root/'图片'/source).convert('RGB')
 latest=root/'artifacts'/f'realism-{page}-final.png'
 actual=Image.open(latest if latest.exists() else root/'artifacts'/f'realism-{page}.png').convert('RGB')
 assert reference.size==actual.size==(1672,941)
 sheet=Image.new('RGB',(1672,1912),'#071d2b')
 sheet.paste(reference,(0,0));sheet.paste(actual,(0,971))
 ImageDraw.Draw(sheet).text((18,946),'上：用户参考图   下：本次实际3D网页渲染（演练时刻及数值不同）',font=font,fill='white')
 sheet.save(root/'artifacts'/f'qa-realism-{page}.jpg',quality=92)

before=Image.open(root/'artifacts'/'twin-student.png').convert('RGB').crop((431,145,1241,761))
after=Image.open(root/'artifacts'/'realism-student.png').convert('RGB').crop((431,145,1241,761))
sheet=Image.new('RGB',(1620,656),'#071d2b')
sheet.paste(before,(0,40));sheet.paste(after,(810,40))
draw=ImageDraw.Draw(sheet)
draw.text((18,9),'旧模型：纯色墙面与地面',font=font,fill='white')
draw.text((828,9),'新模型：扫描材质、门框五金、顶灯、墙裙与地砖',font=font,fill='white')
sheet.save(root/'artifacts'/'realism-corridor-before-after.jpg',quality=95)
print('Saved 3 source/render comparisons and 1 corridor before/after comparison.')
