#!/usr/bin/env python3
import os
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFilter

def create_spaces_icon(base_icns_path, output_icns_path):
    temp_dir = tempfile.mkdtemp()
    base_iconset = os.path.join(temp_dir, 'base.iconset')
    spaces_iconset = os.path.join(temp_dir, 'spaces.iconset')
    os.makedirs(spaces_iconset, exist_ok=True)

    # 1. Decompose base icns
    subprocess.run(['iconutil', '-c', 'iconset', base_icns_path, '-o', base_iconset], check=True)

    # 2. Load 1024x1024 master image
    master_path = os.path.join(base_iconset, 'icon_512x512@2x.png')
    base_img = Image.open(master_path).convert('RGBA')

    # Create overlay layer for the Spaces badge
    badge_layer = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge_layer)

    # Badge bounding box: bottom right quadrant
    # Width 360, Height 360, centered around (780, 780)
    bx0, by0, bx1, by1 = 620, 620, 980, 980
    corner_radius = 80

    # Draw shadow
    shadow_layer = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sdraw.rounded_rectangle([bx0 - 10, by0 + 10, bx1 + 10, by1 + 30], radius=corner_radius, fill=(0, 0, 0, 140))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(25))

    # Draw Badge Background (Gradient / Sleek Deep Indigo/Cyan)
    badge_bg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(badge_bg)
    # Outer glowing border
    bdraw.rounded_rectangle([bx0 - 6, by0 - 6, bx1 + 6, by1 + 6], radius=corner_radius + 6, fill=(56, 189, 248, 200))
    # Inner dark glass body
    bdraw.rounded_rectangle([bx0, by0, bx1, by1], radius=corner_radius, fill=(15, 23, 42, 245))

    # Draw 3 Layered Workspace Windows inside the badge
    # Each window has a titlebar and body
    # Layer 1 (Back window)
    l1_x, l1_y, l1_w, l1_h = 690, 670, 170, 115
    bdraw.rounded_rectangle([l1_x, l1_y, l1_x + l1_w, l1_y + l1_h], radius=16, fill=(30, 41, 59, 220), outline=(94, 234, 212, 180), width=4)
    bdraw.rectangle([l1_x, l1_y, l1_x + l1_w, l1_y + 26], fill=(45, 212, 191, 120))

    # Layer 2 (Middle window)
    l2_x, l2_y, l2_w, l2_h = 725, 715, 175, 120
    bdraw.rounded_rectangle([l2_x, l2_y, l2_x + l2_w, l2_y + l2_h], radius=16, fill=(30, 41, 59, 240), outline=(56, 189, 248, 220), width=4)
    bdraw.rectangle([l2_x, l2_y, l2_x + l2_w, l2_y + 28], fill=(14, 165, 233, 140))

    # Layer 3 (Front primary window)
    l3_x, l3_y, l3_w, l3_h = 760, 760, 185, 130
    # Window shadow
    bdraw.rounded_rectangle([l3_x + 4, l3_y + 6, l3_x + l3_w + 4, l3_y + l3_h + 6], radius=18, fill=(0, 0, 0, 80))
    # Window body
    bdraw.rounded_rectangle([l3_x, l3_y, l3_x + l3_w, l3_y + l3_h], radius=18, fill=(15, 23, 42, 255), outline=(255, 255, 255, 255), width=5)
    # Title bar
    bdraw.rounded_rectangle([l3_x, l3_y, l3_x + l3_w, l3_y + 34], radius=18, fill=(30, 58, 138, 255))
    bdraw.rectangle([l3_x, l3_y + 20, l3_x + l3_w, l3_y + 34], fill=(30, 58, 138, 255))
    # Window traffic lights
    bdraw.ellipse([l3_x + 12, l3_y + 11, l3_x + 24, l3_y + 23], fill=(239, 68, 68, 255))
    bdraw.ellipse([l3_x + 30, l3_y + 11, l3_x + 42, l3_y + 23], fill=(245, 158, 11, 255))
    bdraw.ellipse([l3_x + 48, l3_y + 11, l3_x + 60, l3_y + 23], fill=(16, 185, 129, 255))
    # Window code layout lines
    bdraw.rounded_rectangle([l3_x + 16, l3_y + 48, l3_x + 65, l3_y + 56], radius=4, fill=(56, 189, 248, 220))
    bdraw.rounded_rectangle([l3_x + 72, l3_y + 48, l3_x + 140, l3_y + 56], radius=4, fill=(148, 163, 184, 180))
    bdraw.rounded_rectangle([l3_x + 24, l3_y + 66, l3_x + 110, l3_y + 74], radius=4, fill=(129, 140, 248, 200))
    bdraw.rounded_rectangle([l3_x + 24, l3_y + 84, l3_x + 155, l3_y + 92], radius=4, fill=(52, 211, 153, 200))
    bdraw.rounded_rectangle([l3_x + 16, l3_y + 102, l3_x + 80, l3_y + 110], radius=4, fill=(244, 114, 182, 200))

    # Composite layers
    final_master = Image.alpha_composite(base_img, shadow_layer)
    final_master = Image.alpha_composite(final_master, badge_bg)

    # 3. Export all Apple Icon sizes
    sizes = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]

    for size, name in sizes:
        resized = final_master.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(spaces_iconset, name), 'PNG')

    # 4. Compile into icns
    os.makedirs(os.path.dirname(output_icns_path), exist_ok=True)
    subprocess.run(['iconutil', '-c', 'icns', spaces_iconset, '-o', output_icns_path], check=True)
    print(f"Successfully generated {output_icns_path}")

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    base_icns = os.path.join(root, 'resources', 'darwin', 'code.icns')
    output_icns = os.path.join(root, 'resources', 'darwin', 'CodeSpaces.icns')
    create_spaces_icon(base_icns, output_icns)
