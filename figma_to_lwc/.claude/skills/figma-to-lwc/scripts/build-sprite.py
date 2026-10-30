# Figma 에서 받은 아이콘 SVG 들을 lightning-icon src 용 스프라이트 한 파일로 합친다.
# 사용: python build-sprite.py <svg 폴더> <출력 .svg>
# 각 파일은 <symbol id="파일 이름"> 이 되고, path 의 fill 을 지워 lightning-icon 의 색 hook 을 따르게 한다.
import pathlib
import re
import sys

src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
symbols = []
for f in sorted(src.glob("*.svg")):
    s = f.read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    body = re.search(r"<svg[^>]*>(.*)</svg>", s, re.S).group(1)
    body = re.sub(r"<defs>.*?</defs>", "", body, flags=re.S)  # Figma 가 붙이는 뷰박스 크기 clipPath 는 효과가 없다
    body = re.sub(r"</?g[^>]*>", "", body)
    body = re.sub(r'\s*fill="(?!none)[^"]*"', "", body)
    # 선(stroke) 아이콘: 선 색도 같은 hook 을 따르게 하고, fill="none" 은 남겨 열린 선 안쪽이 칠해지지 않게 한다
    body = re.sub(
        r"<(\w+)([^>]*?)\sstroke=\"[^\"]*\"",
        lambda m: f'<{m[1]}{re.sub(r" fill=\"none\"", "", m[2])} fill="none" style="stroke: var(--slds-c-icon-color-foreground, currentColor)"',
        body,
    )
    symbols.append(f'<symbol id="{f.stem}" viewBox="{vb}">{body.strip()}</symbol>')

if not symbols:
    sys.exit(f"{src}: svg 파일이 없다")
out.write_text('<svg xmlns="http://www.w3.org/2000/svg">\n' + "\n".join(symbols) + "\n</svg>\n", encoding="utf-8")
print(f"{out}: {len(symbols)}개")
