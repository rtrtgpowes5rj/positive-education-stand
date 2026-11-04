# 3D-иконки для схем уровней (Blender 5.x): устройства на подиуме и знаки этапов атаки.
#   blender -b --factory-startup --python blender/icons.py -- <папка вывода PNG>
# Каждая иконка рендерится дважды: обычная (мятные индикаторы) и «под атакой» (красные).
# Примитивы и материалы берутся из kit.py — тот же стиль, что у моделей в 3D-мире.
import bpy, math, os, sys
KIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kit.py')
src = open(KIT, encoding='utf-8').read().split("print('building…')")[0]
exec(compile(src, KIT, 'exec'))
OUTDIR = OUT if not OUT.endswith('.glb') else os.path.abspath('icons')
os.makedirs(OUTDIR, exist_ok=True)

mat('ring', (0, 0, 0), .4, 0, emit=(.2, 1, .6))
mat('gold', (.62, .45, .16), .3, .9)
mat('chip', (.015, .016, .02), .4, .3)
mat('pcb', (.02, .09, .06), .5, .1)

def screen(w, h, loc, rot=(math.pi / 2, 0, 0), E=None, B=None):
    B.append(plane(w, h, loc, 'dark', rot))
    import mathutils
    R = mathutils.Euler(rot).to_matrix()
    n = R @ mathutils.Vector((0, 0, 1)); ux = R @ mathutils.Vector((1, 0, 0)); uy = R @ mathutils.Vector((0, 1, 0))
    def at(fx, fy, lift=.006):
        return tuple(loc[i] + ux[i] * fx * w + uy[i] * fy * h + n[i] * lift for i in range(3))
    rows = [(-.3, .3, .5, 'ring'), (-.3, .15, .3, 'steel'), (-.3, 0, .42, 'steel'), (-.3, -.15, .22, 'steel')]
    for fx, fy, fw, m in rows:
        o = plane(w * fw, h * .06, at(fx + fw / 2, fy), m, rot); (E if m == 'ring' else B).append(o)
    # «график» справа
    for i, hh in enumerate((.18, .3, .22, .4, .26)):
        o = plane(w * .05, h * hh, at(.22 + i * .065, -.3 + hh / 2), 'ring', rot); E.append(o)

def pedestal(r=1.0, B=None, E=None):
    B.append(cyl(r, .14, (0, 0, -.07), 'frame', verts=64, bev=.04, seg=3))
    B.append(cyl(r * .93, .02, (0, 0, .005), 'dark', verts=64, bev=.004, seg=1))
    bpy.ops.mesh.primitive_torus_add(major_radius=r * .985, minor_radius=.018, location=(0, 0, -.02), major_segments=96, minor_segments=8)
    t = bpy.context.object; t.data.materials.append(MAT['ring']); t.name = 'ring'; E.append(t)

# ---------- устройства ----------
def pc():
    B, E = [], []
    pedestal(1.15, B, E)
    # системный блок справа
    B.append(box(.42, .9, 1.1, (.72, .1, .55), 'shell', .04, 3))
    B.append(box(.36, .02, .95, (.72, -.36, .57), 'dark', .01))
    E.append(led((.72, -.38, 1.0), 'g', .03))
    # монитор
    B.append(box(1.5, .07, .95, (-.18, .02, 1.12), 'frame', .03, 3))
    screen(1.4, .85, (-.18, -.02, 1.13), E=E, B=B)
    B.append(box(.08, .06, .45, (-.22, .1, .45), 'steel', .02))
    B.append(box(.5, .34, .04, (-.22, .1, .02), 'steel', .015))
    # клавиатура
    B.append(box(1.0, .32, .04, (-.22, -.55, .02), 'frame', .015))
    for i in range(3):
        B.append(box(.9, .07, .015, (-.22, -.64 + i * .09, .05), 'dark', .004, 1))
    return B, E

def laptop():
    B, E = [], []
    pedestal(1.15, B, E)
    B.append(box(1.6, 1.05, .07, (0, -.15, .035), 'shell', .03, 3))
    for i in range(4):
        B.append(box(1.35, .12, .015, (0, -.48 + i * .15, .075), 'dark', .005, 1))
    B.append(box(.5, .3, .01, (0, -.6, .072), 'frame', .004, 1))
    lid = box(1.6, .05, 1.0, (0, .38, .52), 'shell', .025, 3, rot=(math.radians(-12), 0, 0)); B.append(lid)
    screen(1.45, .86, (0, .35, .53), rot=(math.radians(90 - 12), 0, 0), E=E, B=B)
    return B, E

def tower(light=True, emblem=None):
    B, E = [], []
    pedestal(1.0, B, E)
    sh = 'shell' if light else 'frame'
    B.append(box(.8, 1.15, 1.5, (0, 0, .75), sh, .05, 3))
    B.append(box(.68, .03, 1.3, (0, -.58, .78), 'frame', .02))
    for i in range(4):   # корзины дисков
        z = .32 + i * .3
        B.append(box(.58, .02, .22, (0, -.6, z), 'dark', .01))
        B.append(box(.4, .015, .03, (-.04, -.615, z + .06), 'steel', .005, 1))
        E.append(led((.22, -.62, z), 'g' if i % 2 == 0 else 'b', .02))
    B.extend(grille(-.28, .28, 1.32, 1.4, -.6, 9, 'rubber', .012, .02))
    if emblem == 'key':  # контроллер домена — ключ на крыше
        B.append(cyl(.16, .05, (0, 0, 1.53), 'gold', verts=32, bev=.01))
        B.append(box(.06, .42, .05, (0, .25, 1.53), 'gold', .01))
        B.append(box(.06, .05, .12, (0, .42, 1.5), 'gold', .01))
        B.append(box(.06, .05, .09, (0, .33, 1.5), 'gold', .01))
    return B, E

def nas():
    B, E = [], []
    pedestal(1.1, B, E)
    B.append(box(1.3, 1.05, 1.15, (0, 0, .58), 'shell', .14, 5))
    B.append(box(1.12, .04, .92, (0, -.5, .6), 'frame', .03))
    for i in range(4):
        x = -.42 + i * .28
        B.append(box(.22, .03, .82, (x, -.53, .6), 'dark', .012))
        B.append(box(.05, .01, .5, (x, -.55, .6), 'steel', .004, 1))
        E.append(led((x, -.56, .95), 'b' if i < 3 else 'g', .018))
    B.append(cyl(.05, .02, (.48, -.53, .2), 'steel', rot=(math.pi / 2, 0, 0), verts=24))
    return B, E

def server1u():
    B, E = [], []
    for k in range(3):
        z = .2 + k * .42
        B.append(box(1.5, 1.0, .38, (0, 0, z), 'shell' if k == 0 else 'frame', .03, 3))
        B.append(box(1.4, .02, .3, (0, -.5, z), 'dark', .01))
        for i in range(6):
            B.append(box(.16, .015, .2, (-.55 + i * .2, -.515, z), 'mesh', .005, 1))
        E.append(box(.08, .02, .22, (.66, -.52, z), 'ring', .005, 1))
    return B, E

# ---------- знаки этапов атаки ----------
def lock():
    B, E = [], []
    pass
    B.append(box(.95, .5, .78, (0, 0, .48), 'gold', .08, 4))
    bpy.ops.mesh.primitive_torus_add(major_radius=.3, minor_radius=.07, location=(0, 0, .9), rotation=(math.pi / 2, 0, 0), major_segments=48, minor_segments=12)
    t = bpy.context.object; bpy.ops.object.transform_apply(rotation=True); t.data.materials.append(MAT['steel'])
    bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.02], context='VERTS'); bm.to_mesh(t.data); bm.free()
    B.append(t)
    for sx in (-1, 1): B.append(cyl(.07, .22, (sx * .3, 0, .82), 'steel', verts=16))
    B.append(box(.72, .04, .26, (0, -.26, .45), 'frame', .02))
    for i in range(4): E.append(led((-.24 + i * .16, -.29, .45), 'g', .035))
    return B, E

def crown():
    B, E = [], []
    pass
    B.append(box(1.0, .7, .22, (0, 0, .13), 'frame', .06, 3))      # подушка
    B.append(cyl(.5, .3, (0, 0, .42), 'gold', verts=48, bev=.03))
    B.append(cyl(.44, .32, (0, 0, .43), 'dark', verts=48, bev=.01))
    for i in range(5):
        a = math.radians(-90 + (i - 2) * 38); x, y = .47 * math.cos(a), .47 * math.sin(a)
        B.append(cyl(.12, .42, (x, y, .78), 'gold', verts=4, r2=.0, bev=.0, rot=(0, 0, a)))
        B.append(sphere(.05, (x, y, 1.0), 'gold', 12, 8))
    for i in range(3):
        a = math.radians(-90 + (i - 1) * 38)
        o = sphere(.07, (.5 * math.cos(a), .5 * math.sin(a), .45), 'ring', 16, 10); o.name = 'gem'; E.append(o)
    return B, E

def ram():
    B, E = [], []
    pass
    rot = (0, 0, 0)
    B.append(box(1.6, .08, .55, (0, 0, .42), 'pcb', .015, 2))
    for i in range(8): B.append(box(.15, .1, .22, (-.66 + i * .19, -.02, .45), 'chip', .01))
    for i in range(16): B.append(box(.05, .09, .06, (-.72 + i * .096, 0, .17), 'gold', .005, 1))
    B.append(box(1.5, .1, .06, (0, -.01, .66), 'frame', .02))
    E.append(box(.6, .03, .05, (.4, -.08, .66), 'ring', .01))
    E[-1].name = 'ring_bar'
    return B, E

def lateral():
    B, E = [], []
    pass
    for sx in (-1, 1):
        B.append(box(.62, .62, .62, (sx * .55, 0, .33), 'shell' if sx < 0 else 'frame', .05, 3))
        B.append(box(.46, .02, .38, (sx * .55, -.32, .36), 'dark', .01))
        E.append(led((sx * .55 + .16, -.34, .2), 'g', .022))
    t = tube([(-.5, 0, .72), (0, 0, 1.2), (.42, 0, .86)], .06, 'ring'); E.append(t)
    head = cyl(.17, .3, (.52, 0, .74), 'ring', rot=(0, math.radians(145), 0), verts=24, r2=0); E.append(head)
    return B, E

ICONS = {'pc': pc, 'laptop': laptop, 'dc': lambda: tower(True, 'key'), 'fs': nas, 'srv': server1u,
         'st_brute': lock, 'st_priv': crown, 'st_dump': ram, 'st_lateral': lateral}

# ---------- рендер ----------
sc = bpy.context.scene
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: sc.render.engine = eng; break
    except Exception: pass
SZ = int(os.environ.get('ICON_PX', '320'))
sc.render.resolution_x = sc.render.resolution_y = SZ
sc.render.film_transparent = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items] else 'None'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (.03, .035, .045, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6
try:
    sc.eevee.use_shadows = True
except Exception: pass

target = bpy.data.objects.new('t', None); bpy.context.collection.objects.link(target)
def light(kind, loc, energy, color=(1, 1, 1), size=3):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    o = bpy.data.objects.new(kind, ld); o.location = loc; bpy.context.collection.objects.link(o)
    tc = o.constraints.new('TRACK_TO'); tc.target = target; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    return o
light('AREA', (-4, -5, 6), 900, (1, .95, .88), 4)      # ключевой тёплый
light('AREA', (5, 4, 3), 700, (.5, .62, 1), 3)         # контровой холодный
light('AREA', (0, -6, .6), 120, (1, 1, 1), 6)          # заполняющий снизу-спереди
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
ct = cam.constraints.new('TRACK_TO'); ct.target = target; ct.track_axis = 'TRACK_NEGATIVE_Z'; ct.up_axis = 'UP_Y'
az, el = math.radians(-32), math.radians(28)
D = 12
OFF = (D * math.sin(-az) * math.cos(el), -D * math.cos(az) * math.cos(el), D * math.sin(el))

EMIT = {'ring': None, 'led_g': None, 'led_b': None, 'led_a': None, 'screen': None}
def set_state(hot):
    red = (1, .12, .05)
    for n, c in {'ring': (.2, 1, .6), 'led_g': (.2, 1, .6), 'led_b': (.15, .6, 1), 'screen': (.05, .2, .25)}.items():
        b = MAT[n].node_tree.nodes['Principled BSDF']
        b.inputs['Emission Color'].default_value = (*(red if hot else c), 1)
        b.inputs['Emission Strength'].default_value = (4 if n == 'screen' and hot else 2.2 if n == 'screen' else 7)
        if n == 'screen': b.inputs['Base Color'].default_value = ((.25, .02, .01) if hot else (.02, .05, .06)) + (1,)

for name, fn in ICONS.items():
    for o in list(bpy.data.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    B, E = fn()
    root = model(name, B, E)
    xs = [(o.matrix_world @ v.co) for o in [root, *root.children] for v in o.data.vertices]
    lo = [min(p[i] for p in xs) for i in range(3)]; hi = [max(p[i] for p in xs) for i in range(3)]
    target.location = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2 - .05)
    cam.location = tuple(target.location[i] + OFF[i] for i in range(3))
    cam.data.ortho_scale = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1.12
    for hot in (False, True):
        if name.startswith('st_') and hot: continue
        set_state(hot)
        sc.render.filepath = os.path.join(OUTDIR, name + ('_hot' if hot else '') + '.png')
        bpy.ops.render.render(write_still=True)
    print('ICON', name)
print('DONE', OUTDIR)
