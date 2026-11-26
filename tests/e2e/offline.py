"""Run against a production build served at CHESSLENS_TEST_URL."""
import os
from playwright.sync_api import expect, sync_playwright

url = os.environ.get("CHESSLENS_TEST_URL", "http://127.0.0.1:4188/chesslens/")
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get("CHESSLENS_CHROMIUM"),
        args=["--no-sandbox", "--no-zygote", "--disable-gpu", "--single-process"],
    )
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    expect(page.get_by_text("การเชื่อมต่อ: ออนไลน์", exact=True)).to_be_visible()
    expect(page.get_by_text("โหลดไฟล์แล้ว · เล่นได้แม้ไม่มีเน็ต", exact=True)).to_be_visible(timeout=30000)
    page.wait_for_function("!!navigator.serviceWorker.controller")
    expect(page.get_by_role("button", name="ติดตั้ง ChessLens")).to_be_visible()
    expect(page.locator('meta[property="og:title"]')).to_have_attribute("content", page.title())
    expect(page.locator('link[rel="canonical"]')).to_have_attribute(
        "href", "https://golfchinnawat.github.io/chesslens/"
    )

    page.get_by_role("link", name="รีวิวเกม", exact=True).click()
    page.get_by_label("วางข้อความ PGN").fill(
        '[White "Offline White"]\n[Black "Offline Black"]\n\n1. e4 e5 2. Nf3 Nc6 *'
    )
    page.get_by_role("button", name="นำเข้าเกม", exact=True).click()
    page.get_by_label("ความลึก", exact=False).select_option("12")
    page.get_by_role("button", name="เริ่มวิเคราะห์", exact=True).click()
    page.wait_for_function("!!localStorage.getItem('chesslens.review.v1.latest')")

    expect(page.get_by_role("heading", name="Offline White — Offline Black")).to_be_visible()
    page.goto(url)
    context.set_offline(True)
    expect(page.get_by_text("การเชื่อมต่อ: ออฟไลน์", exact=True)).to_be_visible()
    page.goto(url)
    expect(page.get_by_text("การเชื่อมต่อ: ออฟไลน์", exact=True)).to_be_visible()
    expect(page.get_by_text("โหลดไฟล์แล้ว · เล่นได้แม้ไม่มีเน็ต", exact=True)).to_be_visible()
    page.get_by_label("สีของคุณ").select_option("white")
    page.get_by_label("ระดับบอท").select_option("1")
    page.get_by_role("button", name="เกมใหม่", exact=True).click()
    page.locator('[data-square="e2"]').click()
    page.locator('[data-square="e4"]').click()
    expect(page.locator("tbody tr td button").nth(1)).to_be_visible(timeout=25000)

    page.get_by_role("link", name="รีวิวเกม", exact=True).click()
    expect(page.get_by_role("heading", name="Offline White — Offline Black")).to_be_visible()
    expect(page.get_by_role("region", name="กระดานรีวิวเกม")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth") <= 390
    assert not errors, errors
    print("Passed: subpath install metadata, offline Stockfish move and cached review")
