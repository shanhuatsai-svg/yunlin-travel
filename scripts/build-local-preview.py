"""Build a standalone HTML preview from the current website files."""

import re
from pathlib import Path


def replace_once(page, old, new):
    if page.count(old) != 1:
        raise ValueError(f"Expected one occurrence of {old!r}")
    return page.replace(old, new, 1)


def main():
    root = Path(__file__).resolve().parents[1]
    destination = root.parent / "雲林旅遊網-本機預覽.html"
    styles = (root / "styles.css").read_text(encoding="utf-8")
    if re.search(r"</style", styles, re.IGNORECASE):
        raise ValueError("Cannot inline styles.css because it contains a closing style tag")
    page = replace_once(
        (root / "index.html").read_text(encoding="utf-8"),
        '<link rel="stylesheet" href="./styles.css">',
        f"<style>\n{styles}\n#preview-site-info:not(:target) {{ display: none; }}\n</style>",
    )
    page = replace_once(
        page,
        '<a href="./site-info.html">使用條款與隱私</a>',
        '<a href="#preview-site-info">使用條款與隱私</a>',
    )

    info_page = (root / "site-info.html").read_text(encoding="utf-8")
    info = re.search(r'<main class="site-width info-page">(.*?)</main>', info_page, re.DOTALL)
    if not info:
        raise ValueError("Could not find the usage and privacy content")
    page = replace_once(
        page,
        "</main>",
        '<section id="preview-site-info" class="info-page">'
        f'{info.group(1)}'
        '      <a href="#top">返回首頁</a>\n'
        '    </section>\n'
        '  </main>',
    )

    scripts = []
    for filename in ("destinations.js", "restaurants.js", "itinerary.js", "google-ratings.js", "app.js"):
        tag = f'<script src="./{filename}" defer></script>'
        page = replace_once(page, f"  {tag}\n", "")
        code = (root / filename).read_text(encoding="utf-8")
        if re.search(r"</script", code, re.IGNORECASE):
            raise ValueError(f"Cannot inline {filename} because it contains a closing script tag")
        scripts.append(f"<script>\n{code}\n</script>")

    # Keep the preview free of any key and run the scripts after the DOM is present.
    page = re.sub(r'  <meta name="google-maps-browser-key" content="[^"]*">\n', "", page, count=1)
    page = replace_once(page, "</body>", "\n".join(scripts) + "\n</body>")
    destination.write_text(page, encoding="utf-8")
    print(f"Local preview created: {destination.name}")


if __name__ == "__main__":
    main()
