import pathlib, sys
src = pathlib.Path(__file__).parent / 'src'
r = lambda n: (src / n).read_text(encoding='utf-8')
js = (r('geo.js').split('if (typeof module')[0] + '\n' + r('data.js').split('if (typeof module')[0] + '\n' + r('scene.js') + '\n' + r('app.js') + '\n' + r('ui.js') + '\n' + r('game.js'))
css = r('base.css') + '\n' + r('extra.css')
# versão local (bibliotecas e fontes embutidas) para testes
npm = pathlib.Path('node_modules/three')
libs_local = ''.join('<script>' + (npm / p).read_text() + '</script>\n' for p in ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/renderers/CSS2DRenderer.js'])
local = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Vila Militar 4D</title>\n<style>\n'
         + r('fonts.css') + '\n' + css + '\n</style></head><body>\n' + r('body.html') + '\n' + libs_local + '<script>\n' + js + '\n</script>\n</body></html>\n')
out = pathlib.Path(__file__).parent / 'Vila_Militar_4D_Terraplenagem_Pavimentacao.html'
out.write_text(local, encoding='utf-8')
# versão artefato (CDN e Google Fonts)
art = ('<title>Vila Militar 4D</title>\n<meta name="description" content="Obra de terraplenagem e pavimentação em CBUQ na Vila Militar, em 4D, com missão de decisões do engenheiro residente.">\n'
       '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
       '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap">\n'
       '<style>\n' + css + '\n</style>\n' + r('body.html') + '\n'
       '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
       '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n'
       '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js"></script>\n'
       '<script>\n' + js + '\n</script>\n')
art_out = pathlib.Path(__file__).parent / 'vila-militar-4d-artefato.html'
art_out.parent.mkdir(parents=True, exist_ok=True); art_out.write_text(art, encoding='utf-8')
print(out.name, len(local.encode()) // 1024, 'KB ·', art_out.name, len(art.encode()) // 1024, 'KB')
