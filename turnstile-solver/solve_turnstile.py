#!/usr/bin/env python3
"""
Standalone script to solve Turnstile directly from command line
Usage: python solve_turnstile.py <url> <sitekey> [browser_type]
browser_type: chromium (default), camoufox, chrome, msedge
"""
import asyncio
import sys
import json
from async_solver import get_turnstile_token

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "error": "Usage: python solve_turnstile.py <url> <sitekey> [browser_type]"}), file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    sitekey = sys.argv[2]
    # Use camoufox by default for better bot evasion, fallback to chromium if not available
    browser_type = sys.argv[3] if len(sys.argv) > 3 else "camoufox"
    
    try:
        result = await get_turnstile_token(
            url=url,
            sitekey=sitekey,
            debug=False,
            headless=True,
            useragent=None,
            browser_type=browser_type
        )
        print(json.dumps(result))
    except Exception as e:
        # If camoufox fails, try chromium as fallback
        if browser_type == "camoufox":
            try:
                result = await get_turnstile_token(
                    url=url,
                    sitekey=sitekey,
                    debug=False,
                    headless=True,
                    useragent=None,
                    browser_type="chromium"
                )
                print(json.dumps(result))
            except Exception as e2:
                print(json.dumps({"status": "error", "error": f"Both camoufox and chromium failed. Last error: {str(e2)}"}), file=sys.stderr)
                sys.exit(1)
        else:
            print(json.dumps({"status": "error", "error": str(e)}), file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

