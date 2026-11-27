"""Exercise localized bot game results in the built application."""

import os
from playwright.sync_api import expect, sync_playwright

root = os.environ.get("CHESSLENS_TEST_URL", "http://127.0.0.1:4188/chesslens/")

with sync_playwright() as playwright:
    for width, lang, labels in (
        (390, "th", ("คุณชนะ", "คุณแพ้", "เสมอ", "รุกฆาต", "ตกลงเสมอ", "ดูผลการแข่งขัน", "ปิดผลการแข่งขัน", "เกมใหม่", "ยอมแพ้")),
        (1280, "en", ("You won", "You lost", "Draw", "Checkmate", "Draw agreed", "Show game result", "Close game result", "New game", "Resign")),
    ):
        win, loss, draw, mate, agreement, reopen, close, new_game, resign = labels
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("CHESSLENS_CHROMIUM"),
            args=["--no-sandbox", "--no-zygote", "--disable-gpu", "--single-process"],
        )
        page = browser.new_page(viewport={"width": width, "height": 844})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(root + "?lang=" + lang)
        dialog = page.get_by_role("dialog")
        expect(dialog).to_have_count(0)

        page.once("dialog", lambda event: event.accept())
        page.get_by_role("button", name=resign, exact=True).click()
        expect(dialog.get_by_role("heading")).to_have_text(loss)
        expect(dialog).to_contain_text("0-1")
        expect(dialog).to_contain_text(resign)
        dialog.get_by_role("button", name=close).click()
        expect(dialog).to_have_count(0)
        page.get_by_role("button", name=reopen).click()
        expect(dialog).to_be_visible()
        page.keyboard.press("Escape")
        expect(dialog).to_have_count(0)
        page.get_by_role("button", name=new_game).click()
        expect(page.get_by_role("button", name=reopen)).to_have_count(0)

        for pgn, side, end, heading, reason, score in (
            ("1. f3 e5 2. g4 Qh4# 0-1", "b", None, win, mate, "0-1"),
            ("1. f3 e5 2. g4 Qh4# 0-1", "w", None, loss, mate, "0-1"),
            ("1. e4 e5 1/2-1/2", "w", "agreed", draw, agreement, "1/2-1/2"),
        ):
            page.evaluate(
                """state => localStorage.setItem('chesslens.play.v1', JSON.stringify(state))""",
                dict(pgn=pgn, player=side, orientation=side,
                     choice="white" if side == "w" else "black", level=4, manualEnd=end),
            )
            page.reload()
            expect(dialog.get_by_role("heading")).to_have_text(heading)
            expect(dialog).to_contain_text(reason)
            expect(dialog).to_contain_text(score)
            assert page.evaluate("document.documentElement.scrollWidth") <= width
        assert not errors, errors
        browser.close()
        print(f"{lang} at {width}px: resignation, win, loss, draw, close, and reopen passed")
