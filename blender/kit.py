# Набор устройств стенда для Blender 5.x. Запуск без интерфейса:
#   blender -b --factory-startup --python blender/kit.py -- <out.glb> [<папка превью>]
# Каждая модель стоит на полу (z=0), лицом к -Y (в three.js это +Z), размеры совпадают с прежними в src/gl/kit.js.
# Материалы — только метки: в игре их подменяют общие материалы сцены по имени.
# Индикаторы — отдельные объекты led_<цвет>, экраны — объект face с UV 0..1.
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.abspath('kit.glb')
PREV = argv[1] if len(argv) > 1 else None

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)

# ---------- материалы-метки (цвета как в игре, для превью) ----------
MAT = {}
def mat(name, color, rough=.5, metal=0., emit=None, alpha=1.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 6
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    MAT[name] = m; return m
mat('shell', (.46, .48, .52), .34, .18)
mat('frame', (.024, .028, .035), .32, .7)
mat('dark', (.008, .009, .011), .55, .4)
mat('steel', (.33, .36, .41), .28, .85)
mat('rubber', (.003, .003, .004), .9, 0)
mat('glass', (.006, .008, .01), .08, 0, alpha=.42)
mat('mesh', (.02, .022, .026), .45, .6)          # перфорация: в игре — альфа-текстура
mat('screen', (.02, .05, .06), .2, 0, emit=(.05, .2, .25))
mat('cloud', (.27, .3, .36), .62, .05)
mat('fabric', (.012, .013, .016), .85, 0)
mat('state', (0, 0, 0), .4, 0, emit=(.2, 1, .6))     # светящаяся деталь, цвет задаёт игра
mat('paint_y', (.9, .62, .08), .45, .1)              # жёлтая краска «опасно»
for n, c in {'led_g': (.2, 1, .6), 'led_a': (1, .65, .12), 'led_b': (.15, .6, 1), 'led_r': (1, .1, .04)}.items():
    mat(n, (0, 0, 0), .4, 0, emit=c)

# ---------- примитивы ----------
def _fin(o, m, bev, seg):
    o.data.materials.append(MAT[m])
    if bev > 0:
        md = o.modifiers.new('b', 'BEVEL'); md.width = bev; md.segments = seg; md.limit_method = 'ANGLE'; md.harden_normals = False
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='b')
    for p in o.data.polygons: p.use_smooth = True
    return o

def box(sx, sy, sz, loc, m, bev=.02, seg=2, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.scale = (sx, sy, sz)
    if rot: o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return _fin(o, m, min(bev, sx * .3, sy * .3, sz * .3), seg)

def cyl(r, depth, loc, m, rot=(0, 0, 0), verts=24, bev=.01, seg=2, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return _fin(o, m, min(bev, r * .3, depth * .3), seg)

def sphere(r, loc, m, seg=24, ring=12, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r, location=loc)
    o = bpy.context.object; o.scale = scale; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _fin(o, m, 0, 0)

def tube(pts, r, m, res=6):
    cu = bpy.data.curves.new('c', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 2; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for p, c in zip(sp.bezier_points, pts):
        p.co = c; p.handle_left_type = p.handle_right_type = 'AUTO'
    cu.resolution_u = res
    o = bpy.data.objects.new('c', cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o = bpy.context.object
    o.data.materials.clear(); o.data.materials.append(MAT[m])
    for p in o.data.polygons: p.use_smooth = True
    return o

def plane(w, h, loc, m='screen', rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = (w, h, 1); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(MAT[m]); return o

def led(loc, color='g', r=.03):
    o = sphere(r, loc, 'led_' + color, 10, 6); o.name = 'led_' + color; return o

def model(name, body, extras=(), x=0.):
    """body — детали корпуса (сливаются в один меш); extras — индикаторы/экраны, остаются дочерними."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in body: o.select_set(True)
    bpy.context.view_layer.objects.active = body[0]; bpy.ops.object.join()
    root = bpy.context.object; root.name = name; root.data.name = name
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # одинаковые материалы → одна группа на материал (меньше вызовов отрисовки)
    seen = {}
    for i, s in enumerate(root.material_slots): seen.setdefault(s.material.name, i)
    me = root.data
    remap = {i: seen[s.material.name] for i, s in enumerate(root.material_slots)}
    for p in me.polygons: p.material_index = remap[p.material_index]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=.0004); bpy.ops.object.mode_set(mode='OBJECT')
    root.data.update()
    for o in extras:
        o.parent = root
    root.location.x = x
    return root

def grille(x0, x1, z0, z1, y, n, m='rubber', t=.012, depth=.02, vertical=True):
    out = []
    for i in range(n):
        if vertical:
            x = x0 + (x1 - x0) * (i + .5) / n; out.append(box(t, depth, z1 - z0, (x, y, (z0 + z1) / 2), m, .004, 1))
        else:
            z = z0 + (z1 - z0) * (i + .5) / n; out.append(box(x1 - x0, depth, t, ((x0 + x1) / 2, y, z), m, .004, 1))
    return out

# ================= серверная стойка =================
def build_rack(X):
    w, h, d = 1.5, 3.6, 1.3; F = -d / 2   # лицевая плоскость
    B, E = [], []
    # каркас: 4 стойки, верх, цоколь, боковины с филёнкой
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.append(box(.09, .09, h - .14, (sx * (w / 2 - .045), sy * (d / 2 - .045), .07 + (h - .14) / 2), 'frame', .02))
        B.append(box(.03, d - .14, h - .5, (sx * (w / 2 - .02), 0, h / 2), 'frame', .01))
        for zz in (.6, h / 2, h - .6):
            B.append(box(.012, d - .3, .012, (sx * (w / 2 + .0), 0, zz), 'dark', .003, 1))
    B.append(box(w, d, .12, (0, 0, h - .06), 'frame', .035, 3))
    B.append(box(w * .8, d * .7, .02, (0, 0, h + .005), 'dark', .005))
    for i in range(7):
        B.append(box(w * .62, .03, .012, (0, -d * .25 + i * d * .085, h + .012), 'rubber', .004, 1))
    B.append(box(w - .02, d - .02, .16, (0, 0, .08), 'frame', .03, 3))
    for sx in (-1, 1):
        for sy in (-1, 1):
            B.append(cyl(.05, .06, (sx * (w / 2 - .14), sy * (d / 2 - .14), .0), 'rubber', verts=16))
    B.append(box(w - .2, d - .25, h - .4, (0, .05, h / 2), 'dark', .01))   # внутренний объём
    # юниты-серверы
    units = 8; z0, z1 = .3, h - .3; uh = (z1 - z0) / units; iw = w - .24
    for i in range(units):
        z = z0 + uh * (i + .5); kind = i % 4
        B.append(box(iw, .05, uh * .86, (0, F + .07, z), 'frame' if kind in (1, 3) else 'shell', .012, 2))
        # ручки-ушки
        for sx in (-1, 1):
            B.append(box(.04, .05, uh * .55, (sx * (iw / 2 - .05), F + .03, z), 'steel', .012, 2))
        if kind in (0, 2):   # корзины дисков
            for k in range(6):
                x = -iw * .36 + k * iw * .118
                B.append(box(iw * .1, .02, uh * .6, (x, F + .04, z), 'dark', .006, 1))
                B.append(box(iw * .07, .012, .02, (x, F + .03, z - uh * .18), 'steel', .004, 1))
                E.append(led((x + iw * .03, F + .028, z + uh * .2), 'g' if (i + k) % 5 else 'a', .012))
            B += grille(iw * .3, iw * .44, z - uh * .3, z + uh * .3, F + .04, 6)
        elif kind == 1:      # 2U с экранчиком и вентиляцией
            B += grille(-iw * .4, iw * .1, z - uh * .28, z + uh * .28, F + .04, 9, vertical=False)
            B.append(box(iw * .16, .015, uh * .3, (iw * .26, F + .036, z), 'rubber', .004))
            E.append(led((iw * .4, F + .03, z + uh * .16), 'g', .016)); E.append(led((iw * .4, F + .03, z - uh * .02), 'b', .016))
        else:                # коммутационная панель с патч-кордами
            for k in range(12):
                x = -iw * .4 + k * iw * .072
                B.append(box(iw * .045, .02, uh * .28, (x, F + .04, z), 'rubber', .004, 1))
                if k % 3 != 1:
                    B.append(tube([Vector((x, F + .02, z)), Vector((x, F - .05, z - .06)), Vector((iw * .5 - .02, F - .04, z - uh * .35))], .009, 'rubber', 5))
            E.append(led((iw * .45, F + .03, z), 'g', .014))
    # стеклянная дверь в рамке
    for sx in (-1, 1):
        B.append(box(.06, .05, h - .44, (sx * (w / 2 - .09), F + .02, h / 2), 'steel', .012))
        for k in range(26):
            B.append(box(.022, .01, .022, (sx * (w / 2 - .09), F - .006, .3 + k * (h - .6) / 25), 'dark', .004, 1))
    # световая полоса по ребру
    E.append(box(.025, .02, h - .7, (-w / 2 + .005, F - .005, h / 2), 'led_b', 0)); E[-1].name = 'led_b'
    # кабели сверху в лоток
    B.append(box(w * .82, .03, .03, (0, F + .02, h - .14), 'steel', .01))
    return model('rack', B, E, X)

# ================= коммутатор =================
def build_switch(X):
    w, h, d = 4.4, .9, 1.5; F = -d / 2
    B, E = [], []
    B.append(box(w, d, h, (0, 0, h / 2), 'frame', .06, 3))
    B.append(box(w - .12, .02, h - .14, (0, F - .005, h / 2), 'dark', .02))
    for sx in (-1, 1):   # ушки крепления
        B.append(box(.18, .04, h - .1, (sx * (w / 2 + .07), F + .05, h / 2), 'steel', .015))
        for zz in (.25, h - .25): B.append(cyl(.03, .05, (sx * (w / 2 + .07), F + .02, zz), 'rubber', rot=(math.pi / 2, 0, 0), verts=12))
    n = 14; pw = w * .56 / n; x0 = -w * .44
    for r, zz in enumerate((h * .62, h * .34)):
        for i in range(n):
            x = x0 + pw * (i + .5) + (i // 6) * .05
            B.append(box(pw * .78, .04, .2, (x, F - .01, zz), 'steel', .006, 1))     # окантовка порта
            B.append(box(pw * .62, .05, .15, (x, F - .015, zz + .005), 'rubber', .004, 1))
            B.append(box(pw * .22, .052, .04, (x, F - .016, zz - .07), 'rubber', .002, 1))  # защёлка
            if r == 0: E.append(led((x - pw * .25, F - .02, zz + .135), 'a' if i % 5 == 3 else 'g', .016))
            if (i + r * 3) % 4 == 0:   # воткнутый патч-корд
                B.append(box(pw * .6, .14, .13, (x, F - .09, zz), 'shell' if i % 2 else 'rubber', .02))
                B.append(tube([Vector((x, F - .16, zz)), Vector((x, F - .35, zz - .05)), Vector((x + .2, F - .4, -.0 + .02))], .022, 'rubber', 6))
    # SFP-клетки и консоль
    for i in range(4):
        x = w * .2 + i * .22
        B.append(box(.17, .05, .12, (x, F - .01, h * .6), 'steel', .01)); B.append(box(.12, .055, .07, (x, F - .015, h * .6), 'dark', .005))
    B.append(box(.36, .04, .16, (w * .33, F - .01, h * .3), 'rubber', .01))
    E.append(box(w * .16, .02, .04, (w * .38, F - .02, h * .3 - .15), 'led_b', 0)); E[-1].name = 'led_b'
    E.append(led((w * .44, F - .02, h * .62), 'g', .02)); E.append(led((w * .44, F - .02, h * .5), 'g', .02))
    for i in range(16):   # вентиляция сверху
        B.append(box(.5, .03, .02, (-w * .3 + (i % 8) * .3 - .2, -d * .2 + (i // 8) * .35, h + .002), 'dark', .006, 1))
    return model('switch', B, E, X)

# ================= аппарат (сервер / средство защиты) =================
def build_appliance(X, name='appliance', w=2.6, h=1.7, d=1.7, faceW=1.05, faceH=1.05, faceX=.12, light=True):
    F = -d / 2; B, E = [], []
    sh = 'shell' if light else 'frame'
    B.append(box(w, d - .1, h - .08, (0, .05, h / 2 + .04), sh, .09, 4))
    B.append(box(w - .16, .06, h - .3, (0, F + .05, h / 2 + .04), 'frame', .05, 3))           # лицевая рамка
    # решётка слева
    gx0, gx1 = -w / 2 + .18, -w / 2 + .18 + w * .22
    B += grille(gx0, gx1, h * .22, h * .82, F + .01, 7, 'rubber', .028, .03)
    # экран в утопленной рамке
    fx = w * faceX
    B.append(box(faceW + .08, .03, faceH + .08, (fx, F + .02, h / 2 + .04), 'rubber', .02))
    face = plane(faceW, faceH, (fx, F - .0, h / 2 + .04)); face.name = 'face'
    # кнопка питания и индикаторы
    B.append(cyl(.06, .04, (w / 2 - .2, F + .01, h * .78), 'steel', rot=(math.pi / 2, 0, 0), verts=20))
    E.append(led((w / 2 - .2, F - .015, h * .78), 'g', .026))
    E.append(led((w / 2 - .2, F + .0, h * .22), 'g', .022))
    E.append(box(w * .3, .02, .025, (0, F + .015, .1), 'led_b', 0)); E[-1].name = 'led_b'
    # ножки и шов корпуса
    for sx in (-1, 1):
        for sy in (-1, 1): B.append(cyl(.07, .05, (sx * (w / 2 - .2), sy * (d / 2 - .25), .025), 'rubber', verts=16))
        B.append(box(.02, d - .3, .02, (sx * (w / 2 + .002), .1, h * .5), 'dark', .005, 1))
    for i in range(6):
        B.append(box(w * .5, .04, .015, (0, .1 + i * .1 - .25, h + .04), 'dark', .005, 1))
    root = model(name, B, E + [face], X)
    return root

# ================= монитор =================
def build_monitor(X):
    w, h = 1.5, .92; B, E = [], []
    cz = 1.0
    B.append(box(w, .05, h, (0, 0, cz), 'frame', .025, 3))
    B.append(box(w * .3, .06, h * .55, (0, .04, cz), 'frame', .03, 3))   # горб сзади
    B.append(box(w - .02, .02, .07, (0, -.012, cz - h / 2 + .05), 'dark', .01))  # подбородок
    E.append(led((w * .42, -.03, cz - h / 2 + .05), 'g', .01))
    face = plane(w * .94, h * .8, (0, -.027, cz + .04)); face.name = 'face'
    B.append(box(.08, .05, .62, (0, .08, .45), 'steel', .02, 2, rot=(-.12, 0, 0)))
    B.append(cyl(.26, .03, (0, .05, .015), 'steel', verts=32, bev=.01))
    return model('monitor', B, E + [face], X)

# ================= ноутбук =================
def build_laptop(X):
    w = 1.9; dd = w * .68; B, E = [], []
    B.append(box(w, dd, .08, (0, 0, .04), 'shell', .03, 3))
    B.append(box(w * .9, dd * .52, .01, (0, -.05, .082), 'dark', .005))
    for r in range(4):     # клавиши
        for c in range(13):
            B.append(box(w * .055, w * .05, .012, (-w * .4 + c * w * .067, -dd * .2 + r * dd * .095 + dd * .02, .09), 'rubber', .004, 1))
    B.append(box(w * .3, dd * .22, .006, (0, -dd * .33, .083), 'steel', .004))
    lid_y = dd / 2 - .02
    B.append(box(w, .045, w * .62, (0, lid_y + .04, .08 + w * .31), 'shell', .025, 3, rot=(.25, 0, 0)))
    face = plane(w * .9, w * .54, (0, lid_y + .0 - .03, .08 + w * .31), rot=(math.pi / 2 + .25, 0, 0)); face.name = 'face'
    return model('laptop', B, [face], X)

# ================= пульт SOC: стол, три монитора, клавиатура, кресло =================
def build_soc(X):
    B, E, faces = [], [], []
    B.append(box(6.2, 1.6, .12, (0, -.4 + .8, .82), 'frame', .04, 3))
    B.append(box(6.0, .05, .3, (0, -.4 + 1.58, .62), 'dark', .02))   # кабель-канал
    for x in (-2.8, 2.8):
        B.append(box(.12, 1.3, .1, (x, .4, .05), 'steel', .03)); B.append(box(.12, .12, .8, (x, .4, .43), 'steel', .03))
    for i, x in enumerate((-2.05, 0, 2.05)):
        z = 1.6 + (.12 if i == 1 else 0); ry = (i - 1) * .18
        B.append(box(1.95, .08, 1.2, (x, 0, z), 'frame', .03, 3, rot=(0, 0, ry)))
        f = plane(1.8, 1.06, (x - math.sin(ry) * .045, -.045 * math.cos(ry), z), rot=(math.pi / 2, 0, ry)); f.name = 'face%d' % i; faces.append(f)
        B.append(cyl(.035, .7, (x, .12, 1.15), 'steel', verts=12))
    B.append(box(5.0, .07, .07, (0, .2, 1.15), 'steel', .02))
    # клавиатура и мышь
    B.append(box(1.3, .42, .04, (0, -.1 - .2, .9), 'shell', .015)); B.append(box(1.2, .34, .012, (0, -.1 - .2, .925), 'rubber', .004))
    B.append(sphere(.08, (.95, -.3, .9), 'shell', 16, 8, (1, 1.5, .5)))
    E.append(box(6.0, .02, .025, (0, -.4 + .0 - .0, .76), 'led_b', 0)); E[-1].name = 'led_b'
    root = model('soc', B, E + faces, X)
    return root

# ================= облако «интернет» =================
def build_cloud(X):
    mb = bpy.data.metaballs.new('cl'); mb.resolution = .09; mb.render_resolution = .09
    for (x, y, z, r) in [(0, 0, .75, 1.5), (1.4, -.5, .55, 1.05), (-1.4, -.3, .5, 1.1), (.5, 1.2, .45, .95), (-.6, -1.2, .45, .9), (1.0, .7, .7, .8), (-1.0, .8, .6, .75)]:
        e = mb.elements.new(); e.co = (x, y, z); e.radius = r * 1.25
    o = bpy.data.objects.new('cl', mb); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, .05), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(o.data); bm.free()
    md = o.modifiers.new('d', 'DECIMATE'); md.ratio = .35; bpy.ops.object.modifier_apply(modifier='d')
    o.data.materials.clear(); o.data.materials.append(MAT['cloud'])
    for p in o.data.polygons: p.use_smooth = True
    return model('cloud', [o], [], X)

# ================= столб проёма межсетевого экрана =================
def build_post(X):
    B, E = [], []
    B.append(box(.5, .5, .12, (0, 0, .06), 'frame', .03, 3))
    B.append(box(.4, .4, .9, (0, 0, .55), 'frame', .06, 3))
    for i in range(5): B.append(box(.405, .405, .025, (0, 0, .22 + i * .15), 'dark', .006, 1))
    B.append(box(.46, .46, .06, (0, 0, 1.02), 'steel', .02, 2))
    E.append(box(.44, .44, .03, (0, 0, 1.07), 'led_r', 0)); E[-1].name = 'led_r'
    return model('post', B, E, X)

# ================= песочница ИИ-агента: «порты» прав =================
def text_mesh(txt, size, loc, m, depth=.04, rot=(0, 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot); t = bpy.context.object
    t.data.body = txt; t.data.size = size; t.data.extrude = depth; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='MESH'); t = bpy.context.object
    t.data.materials.clear(); t.data.materials.append(MAT[m]); return t

def build_p_read(X):   # репозиторий: стопка картриджей с кодом
    B, E = [], []
    B.append(box(1.3, 1.0, .12, (0, 0, .06), 'frame', .03, 3))
    for i in range(3):
        z = .2 + i * .27
        B.append(box(1.16 - i * .04, .86 - i * .03, .22, (0, 0, z), 'shell' if i % 2 == 0 else 'frame', .05, 3))
        B.append(box(.5, .02, .05, (-.2, -.43 + i * .015, z), 'dark', .01, 1))
        E.append(box(.16, .02, .05, (.38, -.43 + i * .015, z), 'state', .01, 1)); E[-1].name = 'state'
    E.append(text_mesh('</>', .42, (0, -.02, .76), 'state', .03)); E[-1].name = 'state'
    return model('p_read', B, E, X)

def build_p_tests(X):  # тесты: пробирки в штативе
    B, E = [], []
    B.append(box(1.3, .7, .14, (0, 0, .07), 'frame', .04, 3))
    for sx in (-1, 1): B.append(box(.08, .5, .9, (sx * .6, 0, .55), 'frame', .03))
    B.append(box(1.28, .55, .08, (0, 0, .68), 'shell', .03, 2))
    for i, lv in enumerate((.45, .3, .55)):
        x = -.36 + i * .36
        B.append(cyl(.135, .95, (x, 0, .6), 'glass', verts=24, bev=.03))
        E.append(cyl(.11, lv, (x, 0, .16 + lv / 2), 'state', verts=20, bev=.02)); E[-1].name = 'state'
        B.append(cyl(.15, .08, (x, 0, 1.1), 'steel', verts=24, bev=.02))
    return model('p_tests', B, E, X)

def build_p_net(X):    # интернет: глобус на подставке
    B, E = [], []
    B.append(cyl(.55, .12, (0, 0, .06), 'frame', verts=48, bev=.03))
    B.append(cyl(.06, .3, (0, 0, .25), 'steel', verts=16))
    c = (0, 0, .82)
    B.append(sphere(.5, c, 'dark', 32, 16))
    for k in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=.515, minor_radius=.02, location=c, rotation=(math.pi / 2, 0, k * math.pi / 4), major_segments=48, minor_segments=4)
        t = bpy.context.object; t.data.materials.append(MAT['state']); t.name = 'state'; E.append(t)
    for zz in (-.25, 0, .25):
        r = math.sqrt(.515 ** 2 - zz ** 2)
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=.018, location=(0, 0, c[2] + zz), major_segments=48, minor_segments=4)
        t = bpy.context.object; t.data.materials.append(MAT['state']); t.name = 'state'; E.append(t)
    bpy.ops.mesh.primitive_torus_add(major_radius=.62, minor_radius=.03, location=c, rotation=(0, math.radians(23), 0), major_segments=64, minor_segments=8)
    t = bpy.context.object; t.data.materials.append(MAT['steel']); bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > .25], context='VERTS'); bm.to_mesh(t.data); bm.free(); B.append(t)
    return model('p_net', B, E, X)

def build_p_secrets(X):  # секреты: сейф
    B, E = [], []
    B.append(box(1.2, 1.0, 1.05, (0, 0, .58), 'shell', .1, 4))
    B.append(box(.96, .04, .82, (0, -.5, .6), 'frame', .04, 3))
    for zz in (.35, .85):
        B.append(cyl(.05, .14, (-.5, -.5, zz), 'steel', verts=16))
    B.append(cyl(.2, .06, (.05, -.54, .62), 'steel', rot=(math.pi / 2, 0, 0), verts=40, bev=.02))
    B.append(cyl(.06, .05, (.05, -.58, .62), 'dark', rot=(math.pi / 2, 0, 0), verts=24))
    for k in range(3):
        a = k * 2 * math.pi / 3
        B.append(box(.035, .035, .26, (.05 + .14 * math.sin(a), -.6, .62 + .14 * math.cos(a)), 'steel', .01, 1, rot=(0, a, 0)))
    E.append(box(.24, .02, .04, (.3, -.53, .92), 'state', .01, 1)); E[-1].name = 'state'
    for sx in (-1, 1): B.append(box(.18, .16, .06, (sx * .42, 0, .03), 'rubber', .02))
    return model('p_secrets', B, E, X)

def build_p_deploy(X):   # деплой в прод: красная кнопка под откинутой крышкой
    B, E = [], []
    B.append(box(1.25, 1.05, .34, (0, 0, .17), 'frame', .06, 3))
    n = 10
    for i in range(n):   # «зебра» по верхнему краю
        x = -.6 + (i + .5) * 1.2 / n
        B.append(box(1.2 / n - .015, .05, .07, (x, -.52, .3), 'paint_y' if i % 2 == 0 else 'dark', .005, 1))
    B.append(cyl(.38, .08, (0, -.05, .38), 'steel', verts=48, bev=.02))
    E.append(cyl(.3, .16, (0, -.05, .48), 'led_r', verts=48, bev=.06, seg=4)); E[-1].name = 'led_r'
    B.append(box(.86, .86, .03, (0, .36, .78), 'glass', .02, 2, rot=(math.radians(62), 0, 0)))
    B.append(box(.9, .06, .06, (0, .4, .36), 'steel', .02))
    E.append(box(.2, .02, .04, (.42, -.53, .14), 'state', .01, 1)); E[-1].name = 'state'
    return model('p_deploy', B, E, X)

print('building…')
roots = [build_rack(-12), build_switch(-7), build_appliance(-2), build_appliance(2, 'tool', 1.7, .95, 1.2, 1.2, .6, .08, light=False),
         build_monitor(5), build_laptop(7.5), build_soc(13), build_cloud(22), build_post(27),
         build_p_read(32), build_p_tests(35), build_p_net(38), build_p_secrets(41), build_p_deploy(44)]
for r in roots:
    tris = sum(len(p.vertices) - 2 for p in r.data.polygons) + sum(sum(len(p.vertices) - 2 for p in c.data.polygons) for c in r.children if c.type == 'MESH')
    print('MODEL', r.name, 'tris', tris, 'mats', len(r.data.materials), 'kids', len(r.children))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_normals=True, export_texcoords=True, export_extras=False)
print('EXPORTED', OUT, os.path.getsize(OUT))

# ---------- превью ----------
if PREV:
    os.makedirs(PREV, exist_ok=True)
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: sc.render.engine = eng; break
        except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.012, .013, .016, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0)); fl = bpy.context.object
    fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.03, .033, .04, 1)
    fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .6; fl.data.materials.append(fm)
    def light(kind, loc, energy, color=(1, 1, 1), size=3, rot=None):
        ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = color
        if kind == 'AREA': ld.size = size
        o = bpy.data.objects.new(kind, ld); o.location = loc; bpy.context.collection.objects.link(o)
        tc = o.constraints.new('TRACK_TO'); tc.target = target; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
        return o
    target = bpy.data.objects.new('t', None); bpy.context.collection.objects.link(target)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam); sc.camera = cam
    ct = cam.constraints.new('TRACK_TO'); ct.target = target; ct.track_axis = 'TRACK_NEGATIVE_Z'; ct.up_axis = 'UP_Y'
    key = light('AREA', (-6, -8, 9), 2500, (1, .95, .88), 6)
    rim = light('AREA', (7, 6, 5), 1500, (.45, .55, 1), 5)
    for r in roots:
        dims = r.dimensions; c = r.location.copy(); size = max(dims.x, dims.y, dims.z)
        target.location = (c.x, c.y, dims.z * .45)
        cam.location = (c.x + size * .9, c.y - size * 1.9, dims.z * .45 + size * .8); cam.data.lens = 50
        key.location = (c.x - size * 2, c.y - size * 2.5, size * 3); rim.location = (c.x + size * 2.2, c.y + size * 2, size * 1.6)
        for o in roots:
            for x in [o, *o.children]: x.hide_render = o is not r
        sc.render.filepath = os.path.join(PREV, r.name + '.png'); bpy.ops.render.render(write_still=True)
    print('PREVIEWS', PREV)
