# обрезка по содержимому (общая рамка для пары обычная/_hot) → webp в public/icons
from PIL import Image
import glob,os,sys
src,dst=sys.argv[1],sys.argv[2];os.makedirs(dst,exist_ok=True);tot=0
names=sorted({os.path.basename(f)[:-4].replace('_hot','') for f in glob.glob(src+'/*.png')})
for n in names:
    fs=[f for f in (f'{src}/{n}.png',f'{src}/{n}_hot.png') if os.path.exists(f)]
    ims=[Image.open(f).convert('RGBA') for f in fs]
    bb=[b for b in (im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox() for im in ims) if b]
    x0=min(b[0] for b in bb);y0=min(b[1] for b in bb);x1=max(b[2] for b in bb);y1=max(b[3] for b in bb)
    side=int(max(x1-x0,y1-y0)*1.04)
    for f,im in zip(fs,ims):
        c=Image.new('RGBA',(side,side));c.paste(im.crop((x0,y0,x1,y1)),((side-(x1-x0))//2,(side-(y1-y0))//2))
        c=c.resize((256,256),Image.LANCZOS);o=f'{dst}/{os.path.basename(f)[:-4]}.webp';c.save(o,'WEBP',quality=88,method=6);tot+=os.path.getsize(o)
print('KB',tot//1024,names)
