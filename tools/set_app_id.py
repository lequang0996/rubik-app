"""Đổi ID gói (applicationId) TRƯỚC khi đăng lên Google Play lần đầu — sau đó không thể đổi nữa.
Chạy:  python tools/set_app_id.py com.tencuaban.rubikstudio"""
import os, re, sys, json, shutil
if len(sys.argv) != 2 or not re.fullmatch(r'[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+', sys.argv[1]):
    sys.exit('Dùng: python tools/set_app_id.py com.ten.cuaban  (chữ thường, số, dấu chấm, gạch dưới; ≥2 đoạn)')
new = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfgp = os.path.join(root, 'capacitor.config.json')
cfg = json.load(open(cfgp, encoding='utf-8')); old = cfg['appId']; cfg['appId'] = new
json.dump(cfg, open(cfgp, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
app = os.path.join(root, 'android/app')
def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs: s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)
sub(os.path.join(app, 'build.gradle'), [(f'"{old}"', f'"{new}"')])
sub(os.path.join(app, 'src/main/res/values/strings.xml'), [(f'>{old}<', f'>{new}<')])
src = os.path.join(app, 'src/main/java')
oldd, newd = os.path.join(src, *old.split('.')), os.path.join(src, *new.split('.'))
if oldd != newd:
    os.makedirs(newd, exist_ok=True)
    for f in os.listdir(oldd):
        sub(os.path.join(oldd, f), [(f'package {old};', f'package {new};')])
        shutil.move(os.path.join(oldd, f), os.path.join(newd, f))
    # dọn thư mục rỗng
    d = oldd
    while d != src and not os.listdir(d):
        os.rmdir(d); d = os.path.dirname(d)
print(f'Đã đổi {old} → {new}')
