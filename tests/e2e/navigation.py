"""Check the published layout on all routes using a Supabase-enabled build."""
import os
from playwright.sync_api import expect, sync_playwright

root = os.environ.get("CHESSLENS_TEST_URL", "http://127.0.0.1:4187/chesslens/")
views = ("review", "account", "opening", "puzzles", "online", "smoke", "play")

with sync_playwright() as playwright:
    for width in (390, 800, 1280):
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("CHESSLENS_CHROMIUM"),
            args=["--no-sandbox", "--no-zygote", "--disable-gpu", "--single-process"],
        )
        page = browser.new_page(viewport={"width": width, "height": 844})
        reference = None
        for view in views:
            href = "./" if view == "play" else "?view=" + view
            page.goto(root if view == "play" else root + href)
            nav = page.get_by_role("navigation", name="เมนูหลัก")
            links = nav.get_by_role("link")
            expect(links).to_have_count(len(views))
            expect(nav.locator('[aria-current="page"]')).to_have_attribute("href", href)
            active = nav.locator('[aria-current="page"]').inner_text()
            expect(page.get_by_text("หน้าปัจจุบัน", exact=True).locator("..")).to_have_text(
                "หน้าปัจจุบัน" + active
            )
            brand = page.get_by_role("link", name="ChessLens", exact=True)
            expect(brand).to_be_visible()
            positions = links.evaluate_all(
                "links => links.map(link => link.getBoundingClientRect().toJSON())"
            )
            positions.append(brand.bounding_box())
            if reference is None:
                reference = positions
            assert positions == reference, (width, view)
            assert page.evaluate("document.documentElement.scrollWidth") <= width
            brand.click()
            expect(page.get_by_role("heading", name="เล่นกับ Stockfish")).to_be_visible()
            assert page.url == root
            if width >= 768:
                assert page.evaluate("document.documentElement.scrollHeight") <= 845
        print(f"{width}px: all navigation positions and Home links passed")
        browser.close()
