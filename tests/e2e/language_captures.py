"""Check locale persistence and real-game capture history on the production build."""

import json
import os
import re
import time
from playwright.sync_api import expect, sync_playwright

root = os.environ.get("CHESSLENS_TEST_URL", "http://127.0.0.1:4188/chesslens/")
views = {
    "play": "Play Bot",
    "review": "Game Review",
    "opening": "Openings",
    "puzzles": "Puzzles",
    "online": "Play a Friend",
    "account": "Account",
    "smoke": "Stockfish Test",
}

with sync_playwright() as playwright:
    for width in (390, 1280):
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("CHESSLENS_CHROMIUM"),
            args=["--no-sandbox", "--no-zygote", "--disable-gpu", "--single-process"],
        )
        page = browser.new_page(viewport={"width": width, "height": 844})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(root)
        expect(page.locator("html")).to_have_attribute("lang", "th")
        expect(page.get_by_role("region", name="หมากที่กินได้")).to_be_visible()
        page.get_by_label("ภาษา").select_option("en")
        expect(page.locator("html")).to_have_attribute("lang", "en")
        expect(page.get_by_role("heading", name="Play against Stockfish")).to_be_visible()

        page.evaluate("""() => localStorage.setItem('chesslens.play.v1', JSON.stringify({
          pgn: '1. e4 d5 2. exd5 Qxd5 *',
          player: 'w', orientation: 'w', choice: 'white', manualEnd: null, level: 4
        }))""")
        page.reload()
        play_captures = page.get_by_role("region", name="Captured pieces")
        expect(play_captures.get_by_role("img", name="Pawn × 1")).to_have_count(2)
        page.get_by_role("button", name="exd5", exact=True).click()
        expect(play_captures.get_by_role("img", name="Pawn × 1")).to_have_count(1)

        for view, label in views.items():
            page.goto(root if view == "play" else root + "?view=" + view)
            expect(page.get_by_label("Language")).to_have_value("en")
            expect(
                page.get_by_role("navigation", name="Main navigation").get_by_role(
                    "link", name=label
                )
            ).to_have_attribute("aria-current", "page")
            assert page.evaluate("document.documentElement.scrollWidth") <= width

        page.goto(root + "?view=review")
        if width == 1280:
            page.get_by_label("Paste PGN").fill("1. e4 d5 2. exd5 Qxd5 3. Nc3 *")
            page.get_by_role("button", name="Import game", exact=True).click()
            page.get_by_label("Depth").select_option("12")
            page.get_by_role("button", name="Start analysis").click()
            captures = page.get_by_role("region", name="Captured pieces")
            expect(captures).to_be_visible(timeout=60000)
            white = captures.get_by_text("Captured by White").locator("..")
            black = captures.get_by_text("Captured by Black").locator("..")
            page.get_by_role("button", name=re.compile(r"\bexd5\b")).click()
            expect(white.get_by_role("img", name="Pawn × 1")).to_be_visible()
            expect(black.get_by_role("img")).to_have_count(0)
            page.get_by_role("button", name=re.compile(r"\bQxd5\b")).click()
            expect(white.get_by_role("img", name="Pawn × 1")).to_be_visible()
            expect(black.get_by_role("img", name="Pawn × 1")).to_be_visible()
            page.get_by_role("button", name="First position", exact=True).click()
            expect(captures.get_by_role("img")).to_have_count(0)

        page.get_by_label("Language").select_option("th")
        expect(page.locator("html")).to_have_attribute("lang", "th")
        expect(page.get_by_label("ภาษา")).to_have_value("th")
        assert "view=review" in page.url
        if width == 1280:
            room = "bd7be724-a9f0-4f3e-a854-edf652e2ec94"
            player = "8d7be724-a9f0-4f3e-a854-edf652e2ec94"
            page.evaluate(
                """session => localStorage.setItem('sb-chesslens-test-auth-token', JSON.stringify(session))""",
                {
                    "access_token": "mock-token",
                    "refresh_token": "mock-refresh",
                    "expires_at": int(time.time()) + 3600,
                    "user": {"id": player, "aud": "authenticated"},
                },
            )
            data = {
                "id": room,
                "room_code": "A7F32B0D91",
                "white_id": player,
                "black_id": "opponent",
                "revision": 4,
                "turn_started_at": None,
                "white_ms": 600000,
                "black_ms": 600000,
                "pgn": "1. e4 d5 2. exd5 Qxd5 *",
                "result": None,
                "reason": None,
            }

            def supabase(route):
                headers = {
                    "access-control-allow-origin": "*",
                    "access-control-allow-headers": "*",
                    "access-control-allow-methods": "GET, POST, OPTIONS",
                    "content-type": "application/json",
                }
                if route.request.method == "OPTIONS":
                    route.fulfill(status=204, headers=headers)
                else:
                    result = [data] if "/online_rooms?" in route.request.url else None
                    route.fulfill(headers=headers, body=json.dumps(result))

            page.route("https://chesslens-test.supabase.co/**", supabase)
            page.goto(root + "?view=online&room=" + room)
            room_captures = page.get_by_role("region", name="หมากที่กินได้")
            expect(room_captures.get_by_role("img", name="เบี้ย × 1")).to_have_count(2)

        assert not errors, errors
        browser.close()
        print(f"{width}px: locale switching, persistence, and route checks passed")
