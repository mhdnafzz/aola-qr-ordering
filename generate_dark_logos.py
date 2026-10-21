from PIL import Image
import base64

def make_dark(input_path, out_png, out_svg, width, height):
    img = Image.open(input_path).convert('RGBA')
    r, g, b, a = img.split()
    # Create dark slate #0F172A (15, 23, 42) with same alpha
    dark_r = Image.new('L', img.size, 15)
    dark_g = Image.new('L', img.size, 23)
    dark_b = Image.new('L', img.size, 42)
    dark_img = Image.merge('RGBA', (dark_r, dark_g, dark_b, a))
    dark_img.save(out_png, 'PNG')
    
    with open(out_png, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">\n  <image width="{width}" height="{height}" href="data:image/png;base64,{b64}"/>\n</svg>'
    with open(out_svg, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"Generated {out_png} and {out_svg}")

if __name__ == '__main__':
    make_dark('AU-full.png', 'AU-dark.png', 'AU-dark.svg', 636, 320)
    make_dark('AU-icon.png', 'AU-dark-icon.png', 'AU-dark-icon.svg', 296, 320)
